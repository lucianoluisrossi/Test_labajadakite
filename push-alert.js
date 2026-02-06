// Función Serverless para enviar Web Push notifications
// Se ejecuta via cron de Vercel cada 15 minutos
// Consulta Ecowitt, evalúa condiciones, y envía push a suscriptores activos
//
// ÉPICO requiere condición sostenida 10+ min. Como el cron corre cada 15 min,
// usamos una colección epic_tracker en Firestore para persistir el estado entre ejecuciones.

import { initFirebase } from './_firebase.js';
import admin from 'firebase-admin';

const PUSH_COLLECTION = 'push_subscriptions';
const PUSH_LOG_COLLECTION = 'push_alert_log';
const EPIC_TRACKER_DOC = 'epic_tracker/current';

// Configuración de alertas
const GLOBAL_CONFIG = {
    dangerousSpeed: 30,         // kts - velocidad sostenida peligrosa
    dangerousGust: 35,          // kts - rachas peligrosas
    epicMinWind: 17,            // kts - mínimo para épico
    epicMaxWind: 25,            // kts - máximo para épico (exclusivo)
    epicMinDeg: 68,             // grados - inicio rango E/ESE/SE
    epicMaxDeg: 146,            // grados - fin rango E/ESE/SE
    epicSustainedMinutes: 10,   // minutos que debe mantenerse la condición
    offshoreStart: 292.5,
    offshoreEnd: 67.5,
    cooldownMinutes: 120,
};

// --- Obtener datos de viento de Ecowitt ---
async function getWindData() {
    const FULL_API_URL = 'https://api.ecowitt.net/api/v3/device/real_time?application_key=515398061FDA504607F0329996375FC2&api_key=2b181909-3bd1-4a8f-8cf1-91cb95e75ff5&mac=C8:C9:A3:1C:0D:E5&call_back=all&temp_unitid=1&pressure_unitid=3&wind_speed_unitid=8&rainfall_unitid=12&solar_irradiance_unitid=14&capacity_unitid=25';

    try {
        const response = await fetch(FULL_API_URL);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.code !== 0 || !data.data) return null;

        const wind = data.data.wind || {};
        const outdoor = data.data.outdoor || {};

        return {
            speed: parseFloat(wind.wind_speed?.value || 0),
            gust: parseFloat(wind.wind_gust?.value || 0),
            direction: parseInt(wind.wind_direction?.value || 0),
            temp: parseFloat(outdoor.temperature?.value || 0),
        };
    } catch (error) {
        console.error('Error obteniendo datos de viento:', error);
        return null;
    }
}

function degreesToCardinal(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

function isOffshore(degrees) {
    return degrees >= GLOBAL_CONFIG.offshoreStart || degrees <= GLOBAL_CONFIG.offshoreEnd;
}

function isEpicConditionNow(speed, direction) {
    return speed >= GLOBAL_CONFIG.epicMinWind &&
           speed < GLOBAL_CONFIG.epicMaxWind &&
           direction >= GLOBAL_CONFIG.epicMinDeg &&
           direction <= GLOBAL_CONFIG.epicMaxDeg;
}

// --- Tracker épico persistido en Firestore ---
async function getEpicTracker(db) {
    try {
        const doc = await db.doc(EPIC_TRACKER_DOC).get();
        if (doc.exists) {
            return doc.data();
        }
    } catch (e) {
        console.log('No hay tracker épico previo');
    }
    return { startedAt: null, sustained: false };
}

async function updateEpicTracker(db, windData) {
    const isEpic = isEpicConditionNow(windData.speed, windData.direction);
    const tracker = await getEpicTracker(db);
    const now = Date.now();

    if (isEpic) {
        if (!tracker.startedAt) {
            // Primera lectura en condición épica
            await db.doc(EPIC_TRACKER_DOC).set({
                startedAt: now,
                sustained: false,
                lastCheck: now,
                speed: windData.speed,
                direction: windData.direction,
            });
            return { sustained: false, minutesActive: 0 };
        } else {
            // Ya estaba en condición épica, verificar tiempo
            const minutesActive = (now - tracker.startedAt) / (1000 * 60);
            const sustained = minutesActive >= GLOBAL_CONFIG.epicSustainedMinutes;
            
            await db.doc(EPIC_TRACKER_DOC).set({
                startedAt: tracker.startedAt,
                sustained: sustained,
                lastCheck: now,
                speed: windData.speed,
                direction: windData.direction,
            });
            return { sustained, minutesActive: Math.round(minutesActive) };
        }
    } else {
        // Se rompió la condición épica - resetear
        if (tracker.startedAt) {
            await db.doc(EPIC_TRACKER_DOC).set({
                startedAt: null,
                sustained: false,
                lastCheck: now,
                brokenAt: now,
            });
        }
        return { sustained: false, minutesActive: 0 };
    }
}

// --- Evaluar qué tipo de alerta corresponde ---
function evaluateAlert(windData, subscriberConfig, epicStatus) {
    const { speed, gust, direction } = windData;
    const cardinal = degreesToCardinal(direction);
    const minWind = subscriberConfig?.minNavigableWind || 15;

    // 1. ÉPICO sostenido (E/ESE/SE, 17-25 kts, 10+ min)
    if (epicStatus.sustained) {
        return {
            type: 'epic',
            title: '👑 ¡ÉPICO!',
            body: `${speed.toFixed(0)} kts del ${cardinal} — Sostenido ${epicStatus.minutesActive}+ min`,
            priority: 1,
        };
    }

    // 2. PELIGROSO (>30 kts o rachas >=35 kts)
    if (speed > GLOBAL_CONFIG.dangerousSpeed || gust >= GLOBAL_CONFIG.dangerousGust) {
        return {
            type: 'dangerous',
            title: '⚠️ Condiciones extremas',
            body: `${speed.toFixed(0)} kts, rachas ${gust.toFixed(0)} kts — Precaución`,
            priority: 2,
        };
    }

    // 3. OFFSHORE
    if (isOffshore(direction) && speed >= minWind) {
        return {
            type: 'offshore',
            title: '🚨 Viento Offshore',
            body: `${speed.toFixed(0)} kts del ${cardinal} — ¡No navegar!`,
            priority: 3,
        };
    }

    // 4. CONDICIONES IDEALES
    if (speed >= minWind && speed <= 27 && !isOffshore(direction)) {
        return {
            type: 'good',
            title: '🪁 ¡Hay viento!',
            body: `${speed.toFixed(0)} kts del ${cardinal} — ¡A preparar el equipo!`,
            priority: 4,
        };
    }

    return null;
}

// --- Enviar Web Push ---
async function sendWebPush(subscription, payload) {
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:labajadakite@gmail.com';

    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error('VAPID keys no configuradas');
        return false;
    }

    try {
        const webpush = await import('web-push');
        
        webpush.default.setVapidDetails(
            vapidEmail,
            vapidPublicKey,
            vapidPrivateKey
        );

        await webpush.default.sendNotification(
            subscription,
            JSON.stringify(payload)
        );

        return true;
    } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
            console.log('Suscripción expirada, marcando como inactiva');
            return 'expired';
        }
        console.error('Error enviando push:', error.message);
        return false;
    }
}

// --- Handler principal ---
export default async function handler(req, res) {
    const authHeader = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        // 1. Obtener datos de viento
        const windData = await getWindData();
        if (!windData) {
            return res.status(500).json({ ok: false, error: 'Sin datos de viento' });
        }

        const cardinal = degreesToCardinal(windData.direction);
        console.log(`🌬️ Viento actual: ${windData.speed.toFixed(1)} kts ${cardinal}, rachas ${windData.gust.toFixed(1)} kts`);

        // 2. Firebase
        const db = initFirebase();
        if (!db) {
            return res.status(500).json({ ok: false, error: 'Firebase no disponible' });
        }

        // 3. Actualizar tracker épico persistido
        const epicStatus = await updateEpicTracker(db, windData);
        console.log(`⭐ Epic tracker: sustained=${epicStatus.sustained}, minutes=${epicStatus.minutesActive}`);

        // 4. Obtener suscriptores activos
        const snapshot = await db.collection(PUSH_COLLECTION)
            .where('active', '==', true)
            .get();

        if (snapshot.empty) {
            return res.status(200).json({ 
                ok: true, 
                wind: windData,
                epic: epicStatus,
                subscribers: 0, 
                sent: 0,
                message: 'Sin suscriptores activos' 
            });
        }

        // 5. Verificar cooldown
        const cooldownMs = GLOBAL_CONFIG.cooldownMinutes * 60 * 1000;
        const cooldownTime = new Date(Date.now() - cooldownMs);
        
        let lastAlertType = null;
        try {
            const logSnapshot = await db.collection(PUSH_LOG_COLLECTION)
                .orderBy('timestamp', 'desc')
                .limit(1)
                .get();
            
            if (!logSnapshot.empty) {
                const lastLog = logSnapshot.docs[0].data();
                const lastTime = lastLog.timestamp?.toDate?.() || new Date(0);
                if (lastTime > cooldownTime) {
                    lastAlertType = lastLog.alertType;
                }
            }
        } catch (e) {
            console.log('No hay logs previos o error leyendo:', e.message);
        }

        // 6. Evaluar y enviar a cada suscriptor
        let sent = 0;
        let skipped = 0;
        let expired = 0;
        let alertType = null;

        const results = await Promise.allSettled(
            snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const alert = evaluateAlert(windData, data.config, epicStatus);

                if (!alert) {
                    skipped++;
                    return 'skipped';
                }

                if (lastAlertType === alert.type) {
                    skipped++;
                    return 'cooldown';
                }

                alertType = alert.type;

                const payload = {
                    title: alert.title,
                    body: alert.body,
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: `wind-alert-${alert.type}`,
                    vibrate: alert.priority <= 2 ? [300, 100, 300, 100, 300] : [200, 100, 200],
                    requireInteraction: alert.priority <= 2,
                    data: { url: '/?from_notification=true' },
                };

                const result = await sendWebPush(data.subscription, payload);

                if (result === 'expired') {
                    await db.collection(PUSH_COLLECTION).doc(doc.id).update({ active: false });
                    expired++;
                    return 'expired';
                }

                if (result) {
                    sent++;
                    return 'sent';
                }

                return 'failed';
            })
        );

        // 7. Loguear alerta enviada
        if (sent > 0 && alertType) {
            try {
                await db.collection(PUSH_LOG_COLLECTION).add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    alertType: alertType,
                    windSpeed: windData.speed,
                    windGust: windData.gust,
                    windDirection: windData.direction,
                    cardinal: cardinal,
                    epicSustained: epicStatus.sustained,
                    epicMinutes: epicStatus.minutesActive,
                    subscribersSent: sent,
                    subscribersSkipped: skipped,
                    subscribersExpired: expired,
                });
            } catch (e) {
                console.error('Error guardando log:', e.message);
            }
        }

        // 8. Responder
        return res.status(200).json({
            ok: true,
            wind: {
                speed: windData.speed.toFixed(1),
                gust: windData.gust.toFixed(1),
                direction: cardinal,
                degrees: windData.direction,
                temp: windData.temp.toFixed(1),
            },
            epic: epicStatus,
            alert: alertType ? { type: alertType } : null,
            subscribers: {
                total: snapshot.size,
                sent,
                skipped,
                expired,
            },
            cooldown: lastAlertType ? { lastType: lastAlertType, withinCooldown: true } : null,
        });

    } catch (error) {
        console.error('Error en push-alert:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
