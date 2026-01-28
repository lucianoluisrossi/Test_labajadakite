// notifications.js
// Sistema de Notificaciones Push para La Bajada Kite App

export class PushNotificationManager {
    constructor() {
        this.isSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
        this.permission = this.isSupported ? Notification.permission : 'denied';
        this.lastWindConditions = null;
        
        // Configuración de umbrales para notificaciones
        this.config = {
            minNavigableWind: 12,      // kts - mínimo para navegar
            maxGoodWind: 27,            // kts - máximo para "condiciones ideales" (>27 = extremas)
            dangerousWind: 35,          // kts - rachas peligrosas
            offshoreAngles: [315, 67.5], // N a NE (offshore)
            checkInterval: 5 * 60 * 1000, // 5 minutos
        };
        
        // Estado de notificaciones enviadas (para evitar spam)
        this.sentNotifications = {
            goodConditions: false,
            windIncreased: false,
            dangerous: false,
            lastReset: Date.now()
        };
        
        // Resetear estado cada 2 horas
        setInterval(() => this.resetNotificationState(), 2 * 60 * 60 * 1000);
    }

    // Verificar si el navegador soporta notificaciones
    checkSupport() {
        if (!this.isSupported) {
            console.warn('⚠️ Push notifications no soportadas en este navegador');
            return false;
        }
        return true;
    }

    // Solicitar permiso al usuario
    async requestPermission() {
        if (!this.checkSupport()) {
            return false;
        }

        if (this.permission === 'granted') {
            console.log('✅ Permiso de notificaciones ya concedido');
            return true;
        }

        if (this.permission === 'denied') {
            console.log('❌ Permiso de notificaciones denegado');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            
            if (permission === 'granted') {
                console.log('✅ Permiso de notificaciones concedido');
                this.showTestNotification();
                return true;
            } else {
                console.log('❌ Usuario rechazó las notificaciones');
                return false;
            }
        } catch (error) {
            console.error('Error solicitando permiso:', error);
            return false;
        }
    }

    // Mostrar notificación de prueba
    showTestNotification() {
        if (this.permission !== 'granted') return;
        
        new Notification('¡Notificaciones activadas! 🪁', {
            body: 'Te avisaremos cuando haya buenas condiciones de viento',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: 'test-notification',
            requireInteraction: false
        });
    }

    // Analizar condiciones de viento y enviar notificaciones si corresponde
    analyzeWindConditions(windData) {
        if (this.permission !== 'granted') return;
        
        const { speed, gust, direction, cardinal } = windData;
        
        // Validar datos
        if (speed === null || direction === null) {
            console.log('⚠️ Datos de viento incompletos');
            return;
        }

        // Determinar si es offshore (peligroso)
        const isOffshore = this.isOffshoreWind(direction);
        
        // Determinar estado de navegabilidad
        const isNavigable = speed >= this.config.minNavigableWind;
        const isGoodConditions = speed >= this.config.minNavigableWind && 
                                  speed < 27 && 
                                  !isOffshore;
        const isDangerous = speed > 27 || gust >= this.config.dangerousWind;

        // 1. CONDICIONES EXTREMAS (viento >27 kts O rachas peligrosas)
        if (isDangerous && !this.sentNotifications.dangerous) {
            let message = '';
            if (speed > 27 && gust >= this.config.dangerousWind) {
                message = `Viento ${speed} kts, Rachas ${gust} kts`;
            } else if (speed > 27) {
                message = `Viento ${speed} kts`;
            } else {
                message = `Rachas de ${gust} kts`;
            }
            
            this.sendNotification({
                title: '⚠️ Condiciones extremas',
                body: message,
                tag: 'dangerous-conditions',
                requireInteraction: false,
                vibrate: [300, 100, 300]
            });
            this.sentNotifications.dangerous = true;
        }

        // 2. CONDICIONES IDEALES (15-27 kts, no offshore)
        if (isGoodConditions && !this.sentNotifications.goodConditions && !isDangerous) {
            this.sendNotification({
                title: '🪁 ¡Condiciones ideales!',
                body: `${speed} kts ${cardinal}`,
                tag: 'good-conditions',
                requireInteraction: false
            });
            this.sentNotifications.goodConditions = true;
        }

        // 3. CONDICIONES ACEPTABLES (12-14 kts, no offshore)
        const isAcceptable = speed >= 12 && speed <= 14 && !isOffshore;
        if (isAcceptable && !this.sentNotifications.goodConditions && !isDangerous) {
            this.sendNotification({
                title: '🌬️ Condiciones Aceptables',
                body: `${speed} kts ${cardinal} - Con Kite 14-17 mts`,
                tag: 'acceptable-conditions',
                requireInteraction: false
            });
            this.sentNotifications.goodConditions = true;
        }

        // 4. VIENTO SUBIÓ (solo si antes no era navegable y ahora sí)
        if (this.lastWindConditions && this.lastWindConditions.speed < this.config.minNavigableWind && isNavigable && !this.sentNotifications.windIncreased) {
            this.sendNotification({
                title: '📈 El viento subió',
                body: `Ahora ${speed} kts ${cardinal}`,
                tag: 'wind-increased',
                requireInteraction: false
            });
            this.sentNotifications.windIncreased = true;
        }

        // Guardar condiciones actuales para comparar después
        this.lastWindConditions = { speed, gust, direction, cardinal };
    }

    // Determinar si el viento es offshore
    isOffshoreWind(degrees) {
        // Offshore en La Bajada: N, NNE, NE, NNO, NO (315° a 67.5°)
        return degrees >= this.config.offshoreAngles[0] || degrees <= this.config.offshoreAngles[1];
    }

    // Recomendar tamaño de kite según velocidad de viento
    recommendKiteSize(windSpeed) {
        if (windSpeed < 12) return '12-14m';
        if (windSpeed < 16) return '10-12m';
        if (windSpeed < 20) return '9-10m';
        if (windSpeed < 25) return '7-9m';
        if (windSpeed < 30) return '5-7m';
        return '5m o menos';
    }

    // Enviar notificación
    sendNotification(options) {
        if (this.permission !== 'granted') return;

        const defaultOptions = {
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200],
            data: { url: '/' }
        };

        const notificationOptions = { ...defaultOptions, ...options };

        try {
            // Si hay service worker registrado, usar showNotification
            if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(notificationOptions.title, notificationOptions);
                });
            } else {
                // Fallback: notificación normal
                new Notification(notificationOptions.title, notificationOptions);
            }
            
            console.log('📬 Notificación enviada:', notificationOptions.title);
        } catch (error) {
            console.error('Error enviando notificación:', error);
        }
    }

    // Resetear estado de notificaciones (para evitar spam)
    resetNotificationState() {
        const now = Date.now();
        const timeSinceLastReset = now - this.sentNotifications.lastReset;
        
        // Solo resetear si pasaron al menos 2 horas
        if (timeSinceLastReset >= 2 * 60 * 60 * 1000) {
            console.log('🔄 Reseteando estado de notificaciones');
            this.sentNotifications = {
                goodConditions: false,
                windIncreased: false,
                dangerous: false,
                lastReset: now
            };
        }
    }

    // Configurar preferencias de notificaciones
    setConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        console.log('⚙️ Configuración actualizada:', this.config);
    }

    // Obtener estado de notificaciones
    getStatus() {
        return {
            supported: this.isSupported,
            permission: this.permission,
            enabled: this.permission === 'granted',
            config: this.config,
            lastWindConditions: this.lastWindConditions,
            sentNotifications: this.sentNotifications
        };
    }

    // Guardar preferencias en localStorage
    savePreferences() {
        localStorage.setItem('notificationConfig', JSON.stringify(this.config));
        localStorage.setItem('notificationsEnabled', this.permission === 'granted');
    }

    // Cargar preferencias desde localStorage
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

// Exportar instancia singleton
export const pushManager = new PushNotificationManager();
