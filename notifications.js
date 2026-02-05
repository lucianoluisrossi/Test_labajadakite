// notifications.js
// Sistema de Notificaciones Push para La Bajada Kite App
// Soporta Web Push real (desde servidor) + notificaciones locales como fallback

// VAPID Public Key - debe coincidir con la configurada en Vercel
const VAPID_PUBLIC_KEY = 'BI1RtHhc98w4g4etDGUfArV2SQ3Jhi0PRVKk66mQvNbMHcU8JlDKp18FqyLxDKIlCFNgxGOXVUvqFi0lLB0qjDQ';

export class PushNotificationManager {
    constructor(firebaseApp = null) {
        this.isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
        this.permission = this.isSupported ? Notification.permission : 'denied';
        this.pushSubscription = null; // Suscripción Web Push activa
        this.lastWindConditions = null;
        
        // Configuración de umbrales para notificaciones
        const savedMinWind = localStorage.getItem('notif_min_wind');
        
        this.config = {
            minNavigableWind: savedMinWind ? parseInt(savedMinWind) : 15,
            maxGoodWind: 27,
            dangerousWind: 35,
            offshoreAngles: [315, 67.5],
            checkInterval: 5 * 60 * 1000,
        };
        
        console.log('⚙️ Configuración de notificaciones cargada:', {
            minNavigableWind: this.config.minNavigableWind
        });
        
        // Estado de notificaciones locales enviadas (para evitar spam)
        this.sentNotifications = {
            goodConditions: false,
            windIncreased: false,
            dangerous: false,
            epicEast: false,
            lastReset: Date.now()
        };
        
        // Resetear estado cada 2 horas
        setInterval(() => this.resetNotificationState(), 2 * 60 * 60 * 1000);

        // Verificar si ya hay una suscripción push activa
        this._checkExistingSubscription();
    }

    // Verificar suscripción push existente al cargar
    async _checkExistingSubscription() {
        if (!this.isSupported) return;
        
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                this.pushSubscription = subscription;
                console.log('✅ Suscripción push existente encontrada');
            } else {
                console.log('ℹ️ Sin suscripción push activa');
            }
        } catch (error) {
            console.log('⚠️ Error verificando suscripción push:', error.message);
        }
    }

    checkSupport() {
        if (!this.isSupported) {
            console.warn('⚠️ Push notifications no soportadas en este navegador');
            return false;
        }
        return true;
    }

    // Solicitar permiso Y suscribir a Web Push
    async requestPermission() {
        if (!this.checkSupport()) return false;

        if (this.permission === 'granted' && this.pushSubscription) {
            console.log('✅ Permiso y suscripción push ya activos');
            return true;
        }

        if (this.permission === 'denied') {
            console.log('❌ Permiso de notificaciones denegado por el usuario');
            return false;
        }

        try {
            // 1. Pedir permiso al usuario
            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            if (permission !== 'granted') {
                console.log('❌ Usuario rechazó las notificaciones');
                return false;
            }

            console.log('✅ Permiso concedido, suscribiendo a Web Push...');
            
            // 2. Suscribir a Web Push
            const subscribed = await this._subscribeToPush();
            
            if (subscribed) {
                this.showTestNotification();
                return true;
            } else {
                // Permiso concedido pero falló la suscripción push
                // Aun así funciona con notificaciones locales
                console.warn('⚠️ Push subscription falló, usando notificaciones locales');
                this.showTestNotification();
                return true;
            }
        } catch (error) {
            console.error('Error en requestPermission:', error);
            return false;
        }
    }

    // Suscribir al navegador a Web Push y guardar en servidor
    async _subscribeToPush() {
        try {
            const registration = await navigator.serviceWorker.ready;

            // Convertir VAPID key de base64url a Uint8Array
            const applicationServerKey = this._urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

            // Crear suscripción push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey,
            });

            this.pushSubscription = subscription;
            console.log('✅ Suscripción Web Push creada');

            // Guardar en el servidor
            const saved = await this._saveSubscriptionToServer(subscription);
            
            if (saved) {
                localStorage.setItem('pushSubscribed', 'true');
                console.log('✅ Suscripción guardada en servidor');
            }

            return saved;
        } catch (error) {
            console.error('Error suscribiendo a Web Push:', error);
            return false;
        }
    }

    // Guardar suscripción en el servidor (Firestore via API)
    async _saveSubscriptionToServer(subscription) {
        try {
            const response = await fetch('/api/push-subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    config: {
                        minNavigableWind: this.config.minNavigableWind,
                        maxGoodWind: this.config.maxGoodWind,
                    },
                }),
            });

            const data = await response.json();
            return data.ok === true;
        } catch (error) {
            console.error('Error guardando suscripción en servidor:', error);
            return false;
        }
    }

    // Eliminar suscripción del servidor
    async _removeSubscriptionFromServer() {
        if (!this.pushSubscription) return;

        try {
            await fetch('/api/push-subscribe', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: this.pushSubscription.endpoint,
                }),
            });
        } catch (error) {
            console.error('Error eliminando suscripción del servidor:', error);
        }
    }

    // Desuscribir de Web Push
    async unsubscribe() {
        try {
            if (this.pushSubscription) {
                await this.pushSubscription.unsubscribe();
                await this._removeSubscriptionFromServer();
                this.pushSubscription = null;
                localStorage.removeItem('pushSubscribed');
                console.log('✅ Desuscripto de Web Push');
            }
            return true;
        } catch (error) {
            console.error('Error desuscribiendo:', error);
            return false;
        }
    }

    // Convertir VAPID key de base64url a Uint8Array
    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    showTestNotification() {
        if (this.permission !== 'granted') return;
        
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('¡Notificaciones activadas! 🪁', {
                    body: this.pushSubscription 
                        ? 'Recibirás alertas aunque la app esté cerrada' 
                        : 'Te avisaremos cuando haya buenas condiciones',
                    icon: '/icon-192.png',
                    badge: '/icon-192.png',
                    tag: 'test-notification',
                    requireInteraction: false,
                });
            });
        } else {
            new Notification('¡Notificaciones activadas! 🪁', {
                body: 'Te avisaremos cuando haya buenas condiciones de viento',
                icon: '/icon-192.png',
                badge: '/icon-192.png',
                tag: 'test-notification',
            });
        }
    }

    // Analizar condiciones de viento y enviar notificaciones LOCALES
    // (Las push reales las maneja el servidor via push-alert.js)
    analyzeWindConditions(windData) {
        if (this.permission !== 'granted') return;
        
        const { speed, gust, direction, cardinal } = windData;
        
        if (speed === null || direction === null) return;

        const isOffshore = this.isOffshoreWind(direction);
        const isEastWind = direction >= 68 && direction <= 146;
        const isEpicEast = isEastWind && speed > 17;
        const isNavigable = speed >= this.config.minNavigableWind;
        const isGoodConditions = speed >= this.config.minNavigableWind && speed < 27 && !isOffshore;
        const isDangerous = speed > 27 || gust >= this.config.dangerousWind;

        if (isEpicEast && !this.sentNotifications.epicEast && !isDangerous) {
            this.sendLocalNotification({
                title: '👑 ¡ÉPICO!',
                body: `${speed} kts ${cardinal}`,
                tag: 'epic-east',
                requireInteraction: true,
                vibrate: [200, 100, 200, 100, 200],
            });
            this.sentNotifications.epicEast = true;
        }

        if (isDangerous && !this.sentNotifications.dangerous) {
            let message = speed > 27 ? `Viento ${speed} kts` : `Rachas de ${gust} kts`;
            if (speed > 27 && gust >= this.config.dangerousWind) {
                message = `Viento ${speed} kts, Rachas ${gust} kts`;
            }
            this.sendLocalNotification({
                title: '⚠️ Condiciones extremas',
                body: message,
                tag: 'dangerous-conditions',
                vibrate: [300, 100, 300],
            });
            this.sentNotifications.dangerous = true;
        }

        if (isGoodConditions && !this.sentNotifications.goodConditions && !isDangerous && !isEpicEast) {
            this.sendLocalNotification({
                title: '🪁 ¡Condiciones ideales!',
                body: `${speed} kts ${cardinal}`,
                tag: 'good-conditions',
            });
            this.sentNotifications.goodConditions = true;
        }

        if (this.lastWindConditions && this.lastWindConditions.speed < this.config.minNavigableWind && isNavigable && !this.sentNotifications.windIncreased) {
            this.sendLocalNotification({
                title: '📈 El viento subió',
                body: `Ahora ${speed} kts ${cardinal}`,
                tag: 'wind-increased',
            });
            this.sentNotifications.windIncreased = true;
        }

        this.lastWindConditions = { speed, gust, direction, cardinal };
    }

    isOffshoreWind(degrees) {
        return degrees >= this.config.offshoreAngles[0] || degrees <= this.config.offshoreAngles[1];
    }

    // Enviar notificación LOCAL (cuando la app está abierta)
    sendLocalNotification(options) {
        if (this.permission !== 'granted') return;

        const defaults = {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            data: { url: '/' },
        };

        const notifOptions = { ...defaults, ...options };

        try {
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(notifOptions.title, notifOptions);
                });
            } else {
                new Notification(notifOptions.title, notifOptions);
            }
            console.log('📬 Notificación local enviada:', notifOptions.title);
        } catch (error) {
            console.error('Error enviando notificación local:', error);
        }
    }

    // Alias para compatibilidad con notifications-integration.js
    sendNotification(options) {
        this.sendLocalNotification(options);
    }

    resetNotificationState() {
        const now = Date.now();
        const timeSinceLastReset = now - this.sentNotifications.lastReset;
        
        if (timeSinceLastReset >= 2 * 60 * 60 * 1000) {
            console.log('🔄 Reseteando estado de notificaciones');
            this.sentNotifications = {
                goodConditions: false,
                windIncreased: false,
                dangerous: false,
                epicEast: false,
                lastReset: now,
            };
        }
    }

    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Configuración actualizada:', this.config);
    }

    // Actualizar config en el servidor también
    async syncConfigToServer() {
        if (!this.pushSubscription) return;
        
        try {
            await this._saveSubscriptionToServer(this.pushSubscription);
            console.log('✅ Config sincronizada con servidor');
        } catch (error) {
            console.error('Error sincronizando config:', error);
        }
    }

    getStatus() {
        return {
            supported: this.isSupported,
            permission: this.permission,
            enabled: this.permission === 'granted',
            pushSubscribed: !!this.pushSubscription,
            config: this.config,
            lastWindConditions: this.lastWindConditions,
            sentNotifications: this.sentNotifications,
        };
    }

    savePreferences() {
        localStorage.setItem('notificationConfig', JSON.stringify(this.config));
        localStorage.setItem('notificationsEnabled', this.permission === 'granted');
        // Sincronizar con servidor para que el cron use los umbrales actualizados
        this.syncConfigToServer();
    }

    loadPreferences() {
        const savedConfig = localStorage.getItem('notificationConfig');
        if (savedConfig) {
            try {
                this.config = { ...this.config, ...JSON.parse(savedConfig) };
                console.log('✅ Preferencias de notificaciones cargadas');
            } catch (e) {
                console.error('Error cargando preferencias:', e);
            }
        }
    }
}
