// notifications-integration.js
// Código para integrar el sistema de notificaciones con app.js existente
// Agregar este código al final de app.js (antes del cierre de DOMContentLoaded)

import { pushManager } from './notifications.js';

// ==========================================
// INICIALIZACIÓN DE NOTIFICACIONES
// ==========================================

console.log('🔔 Inicializando sistema de notificaciones...');

// Verificar si las notificaciones están realmente activas antes de cargar
const notificationsWereDisabled = localStorage.getItem('notificationsDisabled') === 'true';

// Solo cargar preferencias si NO fueron desactivadas manualmente
if (!notificationsWereDisabled) {
    pushManager.loadPreferences();
} else {
    console.log('⚠️ Notificaciones desactivadas previamente - no auto-cargar');
}

// Elementos del DOM
const notificationsCard = document.getElementById('notifications-card');
const notificationsExpandBtn = document.getElementById('notifications-expand-btn');
const notificationsContent = document.getElementById('notifications-content');
const expandIcon = document.getElementById('expand-icon');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const enableNotificationsBtn = document.getElementById('enable-notifications-btn');
const testNotificationBtn = document.getElementById('test-notification-btn');
const saveConfigBtn = document.getElementById('save-config-btn');

// Sliders de configuración
const minWindSlider = document.getElementById('min-wind-slider');
const minWindValue = document.getElementById('min-wind-value');
const maxWindSlider = document.getElementById('max-wind-slider');
const maxWindValue = document.getElementById('max-wind-value');

// ==========================================
// ACTUALIZAR UI SEGÚN ESTADO DE NOTIFICACIONES
// ==========================================

function updateNotificationsUI() {
    const status = pushManager.getStatus();
    const enableBtn = document.getElementById('enable-notifications-btn');
    const disableBtn = document.getElementById('disable-notifications-btn');
    
    if (status.enabled) {
        // Notificaciones activadas
        statusIndicator.classList.remove('bg-gray-400', 'bg-yellow-400');
        statusIndicator.classList.add('bg-green-500');
        statusText.textContent = 'Notificaciones activadas ✓';
        statusText.classList.remove('text-gray-600');
        statusText.classList.add('text-green-700', 'font-semibold');
        
        // Ocultar botón de activar, mostrar botón de desactivar
        if (enableBtn) {
            enableBtn.classList.add('hidden');
        }
        if (disableBtn) {
            disableBtn.classList.remove('hidden');
            disableBtn.classList.add('flex'); // Asegurar que se muestre como flex
        }
        
    } else if (!status.supported) {
        // No soportadas
        statusIndicator.classList.remove('bg-green-500', 'bg-yellow-400');
        statusIndicator.classList.add('bg-gray-400');
        statusText.textContent = 'No soportadas en este navegador';
        statusText.classList.remove('text-green-700', 'font-semibold');
        statusText.classList.add('text-gray-600');
        
        if (enableBtn) {
            enableBtn.disabled = true;
            enableBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }
        if (disableBtn) {
            disableBtn.classList.add('hidden');
        }
        
    } else if (status.permission === 'denied') {
        // Denegadas
        statusIndicator.classList.remove('bg-green-500', 'bg-gray-400');
        statusIndicator.classList.add('bg-yellow-400');
        statusText.textContent = 'Permisos denegados';
        statusText.classList.remove('text-green-700', 'font-semibold');
        statusText.classList.add('text-gray-600');
        
        if (enableBtn) {
            enableBtn.classList.remove('hidden');
        }
        if (disableBtn) {
            disableBtn.classList.add('hidden');
        }
        
    } else {
        // Desactivadas (default)
        statusIndicator.classList.remove('bg-green-500', 'bg-yellow-400');
        statusIndicator.classList.add('bg-gray-400');
        statusText.textContent = 'Notificaciones desactivadas';
        statusText.classList.remove('text-green-700', 'font-semibold');
        statusText.classList.add('text-gray-600');
        
        // Mostrar botón de activar, ocultar botón de desactivar
        if (enableBtn) {
            enableBtn.classList.remove('hidden');
            enableBtn.classList.add('flex');
            enableBtn.disabled = false;
            enableBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
        if (disableBtn) {
            disableBtn.classList.add('hidden');
            disableBtn.classList.remove('flex');
        }
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

// Toggle expandir/colapsar card
if (notificationsExpandBtn && notificationsContent) {
    notificationsExpandBtn.addEventListener('click', () => {
        notificationsContent.classList.toggle('hidden');
        expandIcon.classList.toggle('rotate-180');
    });
}

// Activar notificaciones
if (enableNotificationsBtn) {
    enableNotificationsBtn.addEventListener('click', async () => {
        const granted = await pushManager.requestPermission();
        if (granted) {
            // Remover flag de desactivación
            localStorage.removeItem('notificationsDisabled');
            
            updateNotificationsUI();
            pushManager.savePreferences();
        } else {
            alert('No se pudo activar las notificaciones. Verifica los permisos del navegador.');
        }
    });
}

// Desactivar notificaciones
const disableNotificationsBtn = document.getElementById('disable-notifications-btn');
if (disableNotificationsBtn) {
    disableNotificationsBtn.addEventListener('click', async () => {
        // Confirmar acción
        const confirmed = confirm('¿Estás seguro que quieres desactivar las notificaciones de viento?');
        if (!confirmed) return;
        
        try {
            console.log('🔄 Desactivando notificaciones...');
            
            // Método 1: Intentar desregistrar con pushManager
            if (pushManager.getRegistration) {
                try {
                    const registration = await pushManager.getRegistration();
                    if (registration) {
                        const unregistered = await registration.unregister();
                        console.log('✅ Service Worker desregistrado:', unregistered);
                    }
                } catch (swError) {
                    console.warn('No se pudo desregistrar con pushManager:', swError);
                }
            }
            
            // Método 2: Intentar desregistrar todos los service workers directamente
            if ('serviceWorker' in navigator) {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    for (const registration of registrations) {
                        await registration.unregister();
                        console.log('✅ Service Worker desregistrado');
                    }
                } catch (swError) {
                    console.warn('No se pudieron desregistrar todos los SW:', swError);
                }
            }
            
            // Limpiar preferencias guardadas (siempre funciona)
            try {
                // Eliminar TODAS las claves relacionadas con notificaciones
                localStorage.removeItem('windNotificationsEnabled');
                localStorage.removeItem('windNotificationsConfig');
                localStorage.removeItem('notificationsLastSent');
                localStorage.removeItem('notificationConfig'); // ← AGREGADO
                localStorage.removeItem('notificationsEnabled'); // ← AGREGADO
                
                // Marcar como desactivadas manualmente
                localStorage.setItem('notificationsDisabled', 'true');
                
                console.log('✅ LocalStorage limpiado completamente');
            } catch (storageError) {
                console.warn('No se pudo limpiar localStorage:', storageError);
            }
            
            // Actualizar estado del pushManager
            if (pushManager) {
                pushManager.permission = 'default';
            }
            
            // Actualizar UI
            updateNotificationsUI();
            
            // Recargar badge
            setTimeout(() => {
                if (window.updateNotificationBadge) {
                    window.updateNotificationBadge();
                }
            }, 100);
            
            alert('✅ Notificaciones desactivadas correctamente.\n\nSi quieres volver a activarlas, solo presiona el botón "Activar Notificaciones".');
            
        } catch (error) {
            console.error('❌ Error al desactivar notificaciones:', error);
            
            // Intentar limpiar de todas formas
            try {
                localStorage.removeItem('windNotificationsEnabled');
                localStorage.removeItem('windNotificationsConfig');
                updateNotificationsUI();
                alert('⚠️ Notificaciones desactivadas parcialmente.\n\nSi siguen apareciendo, ve a Configuración del navegador → Permisos → Notificaciones y revoca el permiso manualmente.');
            } catch (fallbackError) {
                alert('❌ Error al desactivar las notificaciones.\n\nPor favor, desactívalas manualmente desde la configuración del navegador:\n1. Click en el candado/info junto a la URL\n2. Permisos → Notificaciones → Bloquear');
            }
        }
    });
}

// Notificación de prueba
if (testNotificationBtn) {
    testNotificationBtn.addEventListener('click', () => {
        if (pushManager.permission !== 'granted') {
            alert('Primero debes activar las notificaciones');
            return;
        }
        
        pushManager.sendNotification({
            title: '🪁 Notificación de Prueba',
            body: 'Todo funciona correctamente. Te avisaremos cuando haya viento!',
            tag: 'test-notification',
            vibrate: [200, 100, 200]
        });
    });
}

// Actualizar valores de sliders en tiempo real
if (minWindSlider && minWindValue) {
    minWindSlider.addEventListener('input', (e) => {
        minWindValue.textContent = e.target.value;
    });
}

if (maxWindSlider && maxWindValue) {
    maxWindSlider.addEventListener('input', (e) => {
        maxWindValue.textContent = e.target.value;
    });
}

// Guardar configuración
if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
        const newConfig = {
            minNavigableWind: parseInt(minWindSlider.value),
            maxGoodWind: parseInt(maxWindSlider.value)
        };
        
        pushManager.setConfig(newConfig);
        pushManager.savePreferences();
        
        // Feedback visual
        saveConfigBtn.textContent = '✓ Guardado';
        saveConfigBtn.classList.add('bg-green-500', 'text-white');
        
        setTimeout(() => {
            saveConfigBtn.textContent = 'Guardar Configuración';
            saveConfigBtn.classList.remove('bg-green-500', 'text-white');
        }, 2000);
    });
}

// Cargar configuración guardada en los sliders
const loadSavedConfig = () => {
    const config = pushManager.config;
    if (minWindSlider) minWindSlider.value = config.minNavigableWind || 12;
    if (minWindValue) minWindValue.textContent = config.minNavigableWind || 12;
    if (maxWindSlider) maxWindSlider.value = config.maxGoodWind;
    if (maxWindValue) maxWindValue.textContent = config.maxGoodWind;
};

// ==========================================
// INTEGRACIÓN CON fetchWeatherData()
// ==========================================

// Esta función debe ser llamada cada vez que se obtienen nuevos datos del clima
// Agregar al final de la función fetchWeatherData() existente:

function analyzeAndNotify(weatherData) {
    // Verificar que las notificaciones estén activadas
    if (pushManager.permission !== 'granted') return;
    
    // Extraer datos de viento
    const windSpeed = weatherData.wind?.wind_speed?.value || null;
    const windGust = weatherData.wind?.wind_gust?.value || null;
    const windDirection = weatherData.wind?.wind_direction?.value || null;
    
    if (windSpeed === null || windDirection === null) {
        console.log('⚠️ Datos incompletos para notificaciones');
        return;
    }
    
    // Convertir dirección a cardinal
    const cardinal = convertDegreesToCardinal(windDirection);
    
    // Analizar condiciones y enviar notificaciones si corresponde
    pushManager.analyzeWindConditions({
        speed: windSpeed,
        gust: windGust,
        direction: windDirection,
        cardinal: cardinal
    });
}

// ==========================================
// INICIALIZACIÓN
// ==========================================

// Actualizar UI al cargar
updateNotificationsUI();
loadSavedConfig();

// Registrar Service Worker con soporte para push
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw-push.js')
        .then(registration => {
            console.log('✅ Service Worker con Push registrado:', registration);
        })
        .catch(error => {
            console.error('❌ Error registrando Service Worker:', error);
        });
}

// Exportar función para llamar desde fetchWeatherData
window.analyzeAndNotify = analyzeAndNotify;

console.log('✅ Sistema de notificaciones inicializado');

// ==========================================
// HELPER: Convertir grados a cardinal
// ==========================================

function convertDegreesToCardinal(degrees) {
    if (degrees === null) return 'N/A';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}
