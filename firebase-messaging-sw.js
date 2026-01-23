// Service Worker para Firebase Cloud Messaging
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDitwwF3Z5F9KCm9mP0LsXWDuflGtXCFcw",
    authDomain: "labajadakite.firebaseapp.com",
    projectId: "labajadakite",
    storageBucket: "labajadakite.firebasestorage.app",
    messagingSenderId: "982938582037",
    appId: "1:982938582037:web:7141082f9ca601e9aa221c"
});

const messaging = firebase.messaging();

// Manejar notificaciones en background
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Notificación recibida en background:', payload);
    
    const notificationTitle = payload.notification?.title || '🪁 La Bajada';
    const notificationOptions = {
        body: payload.notification?.body || 'Hay viento para navegar!',
        icon: '/logo-192.png',
        badge: '/logo-192.png',
        vibrate: [200, 100, 200],
        tag: 'wind-notification',
        renotify: false,
        data: {
            url: payload.data?.url || '/'
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Manejar click en notificación
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Click en notificación');
    event.notification.close();
    
    const urlToOpen = event.notification.data?.url || '/';
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((windowClients) => {
                for (const client of windowClients) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});
