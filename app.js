// app.js
// Importamos las funciones necesarias de los SDKs de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDitwwF3Z5F9KCm9mP0LsXWDuflGtXCFcw",
  authDomain: "labajadakite.firebaseapp.com",
  projectId: "labajadakite",
  storageBucket: "labajadakite.firebasestorage.app",
  messagingSenderId: "982938582037",
  appId: "1:982938582037:web:7141082f9ca601e9aa221c",
  measurementId: "G-R926P5WBWW"
};

// Inicializar Firebase
let db;
let messagesCollection;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    messagesCollection = collection(db, "kiter_board");
    console.log("✅ Firebase inicializado. Conectando a 'kiter_board'...");
} catch (e) {
    console.error("❌ Error crítico inicializando Firebase:", e);
}

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Registro del Service Worker (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(console.error);
        });
    }

    // --- LÓGICA DEL MENÚ HAMBURGUESA ---
    const menuButton = document.getElementById('menu-button');
    const menuCloseButton = document.getElementById('menu-close-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuBackdrop = document.getElementById('menu-backdrop');
    
    // NUEVO: Botón de Pizarra en Menú
    const btnPizarraMenu = document.getElementById('btn-pizarra-menu');

    function toggleMenu() {
        if (mobileMenu.classList.contains('translate-x-full')) {
            mobileMenu.classList.remove('translate-x-full'); 
            menuBackdrop.classList.remove('hidden'); 
        } else {
            mobileMenu.classList.add('translate-x-full'); 
            menuBackdrop.classList.add('hidden'); 
        }
    }

    function goToPizarra() {
        // Cierra menú si está abierto
        if (!mobileMenu.classList.contains('translate-x-full')) {
            toggleMenu();
        }
        // Scroll suave
        const pizarraSection = document.getElementById('pizarra-section');
        if (pizarraSection) {
            pizarraSection.scrollIntoView({ behavior: 'smooth' });
            // Al ir, marcamos mensajes como leídos
            markMessagesAsRead();
        }
    }

    if (menuButton) menuButton.addEventListener('click', toggleMenu);
    if (menuCloseButton) menuCloseButton.addEventListener('click', toggleMenu);
    if (menuBackdrop) menuBackdrop.addEventListener('click', toggleMenu);
    if (btnPizarraMenu) btnPizarraMenu.addEventListener('click', goToPizarra);

    // --- LÓGICA DE PIZARRA KITERA ---
    const messageForm = document.getElementById('kiter-board-form');
    const messagesContainer = document.getElementById('messages-container');
    const authorInput = document.getElementById('message-author');
    const textInput = document.getElementById('message-text');
    const newMessageToast = document.getElementById('new-message-toast');

    // Función para formatear tiempo relativo
    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 3600;
        if (interval > 1) return "hace " + Math.floor(interval) + " horas";
        interval = seconds / 60;
        if (interval > 1) return "hace " + Math.floor(interval) + " min";
        return "hace un momento";
    }

    // Función para marcar mensajes como leídos
    function markMessagesAsRead() {
        const now = Date.now();
        localStorage.setItem('lastReadTime', now);
        if (newMessageToast) newMessageToast.classList.add('hidden');
    }

    // Listener para el Toast de Notificación
    if (newMessageToast) {
        newMessageToast.addEventListener('click', goToPizarra);
    }

    // Enviar Mensaje
    if (messageForm && db) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const author = authorInput.value.trim();
            const text = textInput.value.trim();

            if (author && text) {
                try {
                    console.log("Intentando enviar mensaje a Firestore...");
                    await addDoc(messagesCollection, {
                        author: author,
                        text: text,
                        timestamp: serverTimestamp() 
                    });
                    console.log("Mensaje enviado con éxito.");
                    textInput.value = ''; 
                    localStorage.setItem('kiterName', author);
                    // Al enviar, consideramos que hemos leído todo
                    markMessagesAsRead();
                } catch (e) {
                    console.error("Error detallado al enviar:", e);
                    alert(`Error al enviar: ${e.message}. \n\nSi ves 'Missing or insufficient permissions', ve a la Consola de Firebase > Firestore Database > Reglas y permite lectura/escritura global.`);
                }
            }
        });

        const savedName = localStorage.getItem('kiterName');
        if (savedName) authorInput.value = savedName;
    }

    // Escuchar Mensajes en Tiempo Real
    if (messagesContainer && db) {
        const q = query(messagesCollection, orderBy("timestamp", "desc"), limit(50));

        onSnapshot(q, (snapshot) => {
            messagesContainer.innerHTML = ''; 
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            let hasMessages = false;
            
            // Lógica de Notificación
            const lastReadTime = parseInt(localStorage.getItem('lastReadTime') || '0');
            let newestMessageTime = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.timestamp) {
                    const msgDate = data.timestamp.toDate();
                    const msgTime = msgDate.getTime();
                    
                    // Guardar el tiempo del mensaje más nuevo para comparación
                    if (msgTime > newestMessageTime) {
                        newestMessageTime = msgTime;
                    }

                    // FILTRO 24 HORAS
                    if (now - msgTime < oneDay) {
                        hasMessages = true;
                        const div = document.createElement('div');
                        div.className = "bg-gray-50 p-3 rounded border border-gray-100 text-sm";
                        div.innerHTML = `
                            <div class="flex justify-between items-baseline mb-1">
                                <span class="font-bold text-blue-900">${data.author}</span>
                                <span class="text-xs text-gray-400">${timeAgo(msgDate)}</span>
                            </div>
                            <p class="text-gray-700 break-words">${data.text}</p>
                        `;
                        messagesContainer.appendChild(div);
                    }
                }
            });

            if (!hasMessages) {
                messagesContainer.innerHTML = '<p class="text-center text-gray-400 text-xs py-2">No hay mensajes recientes. ¡Sé el primero!</p>';
            } else {
                // Verificar si hay mensajes nuevos NO leídos que sean recientes (últimas 24hs)
                // Y evitar que aparezca en la primera carga si el usuario nunca entró (opcional, aquí mostramos si es nuevo absoluto)
                if (newestMessageTime > lastReadTime && lastReadTime > 0) {
                    if(newMessageToast) newMessageToast.classList.remove('hidden');
                } else if (lastReadTime === 0 && newestMessageTime > 0) {
                    // Primera vez: Marcamos como leido para no molestar, O mostramos notificación.
                    // Decisión: Marcamos como leído para que no salte apenas abres la app por primera vez.
                    localStorage.setItem('lastReadTime', now);
                }
            }

        }, (error) => {
            console.error("Error escuchando mensajes:", error);
            if (messagesContainer) {
                messagesContainer.innerHTML = `<p class="text-center text-red-400 text-xs">Error de permisos: ${error.code}. Revisa las Reglas en Firebase.</p>`;
            }
        });
    }


    // --- URLs de las Funciones Serverless (Proxy) ---
    const weatherApiUrl = 'api/data';

    // --- ELEMENTOS DEL DOM (Datos Generales) ---
    const tempEl = document.getElementById('temp-data');
    const humidityEl = document.getElementById('humidity-data');
    const pressureEl = document.getElementById('pressure-data');
    const rainfallDailyEl = document.getElementById('rainfall-daily-data'); 
    const uviEl = document.getElementById('uvi-data'); 
    const errorEl = document.getElementById('error-message');
    const lastUpdatedEl = document.getElementById('last-updated');

    // --- ELEMENTOS DEL DOM (Viento Resaltado) ---
    const windHighlightCard = document.getElementById('wind-highlight-card');
    const unifiedWindDataCardEl = document.getElementById('unified-wind-data-card');
    
    const highlightWindDirEl = document.getElementById('highlight-wind-dir-data');
    const highlightWindSpeedEl = document.getElementById('highlight-wind-speed-data');
    const highlightGustEl = document.getElementById('highlight-gust-data');
    const windArrowEl = document.getElementById('wind-arrow'); 
    
    // --- ELEMENTOS DEL DOM (Veredicto EN VIVO) ---
    const verdictCardEl = document.getElementById('verdict-card');
    const verdictDataEl = document.getElementById('verdict-data');
    
    // --- ELEMENTOS DEL DOM (ESTABILIDAD) ---
    const stabilityCardEl = document.getElementById('stability-card');
    const stabilityDataEl = document.getElementById('stability-data');
    
    // --- Skeletons y Contenidos ---
    const skeletonLoaderIds = [
        'verdict-data-loader',
        'highlight-wind-dir-data-loader', 'highlight-wind-speed-data-loader', 'highlight-gust-data-loader',
        'temp-data-loader', 'humidity-data-loader', 'pressure-data-loader', 
        'rainfall-daily-data-loader', 'uvi-data-loader',
        'stability-data-loader'
    ];
    const dataContentIds = [
        'verdict-data',
        'highlight-wind-dir-data', 'highlight-wind-speed-data', 'highlight-gust-data',
        'temp-data', 'humidity-data', 'pressure-data',
        'rainfall-daily-data', 'uvi-data',
        'stability-data'
    ];

    let lastUpdateTime = null;

    function showSkeletons(isLoading) {
        skeletonLoaderIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = isLoading ? 'block' : 'none';
        });
        dataContentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = isLoading ? 'none' : 'block';
        });

        if (isLoading && lastUpdatedEl) {
            lastUpdatedEl.textContent = 'Actualizando datos...';
        }
    }
    
    function updateTimeAgo() {
        if (!lastUpdateTime) return;
        const now = new Date();
        const secondsAgo = Math.round((now - lastUpdateTime) / 1000);
        
        if (secondsAgo < 5) {
            lastUpdatedEl.textContent = "Actualizado ahora";
        } else if (secondsAgo < 60) {
            lastUpdatedEl.textContent = `Actualizado hace ${secondsAgo} seg.`;
        } else {
            lastUpdatedEl.textContent = `Actualizado: ${lastUpdateTime.toLocaleTimeString('es-AR')}`;
        }
    }

    function convertDegreesToCardinal(degrees) {
        if (degrees === null || isNaN(degrees)) return 'N/A';
        const val = Math.floor((degrees / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
        return arr[val % 16];
    }

    // --- FUNCIÓN: CALCULAR ESTABILIDAD (Lógica Inversa: 0% = Perfecto) ---
    function calculateGustFactor(speed, gust) {
        if (speed === null || gust === null || speed <= 0) {
            return { factor: null, text: 'N/A', color: ['bg-gray-100', 'border-gray-300'] };
        }
        const MIN_KITE_WIND = 12; 
        // CAMBIO: Texto "No Aplica"
        if (speed < MIN_KITE_WIND) {
             return { factor: null, text: 'No Aplica', color: ['bg-gray-100', 'border-gray-300'] };
        }
        
        if (gust <= speed) {
             // CAMBIO: 0% es perfección
             return { factor: 0, text: 'Ultra Estable', color: ['bg-green-400', 'border-green-600'] };
        }
        
        // CAMBIO: Fórmula Inversa
        const factor = (1 - (speed / gust)) * 100; 

        // CAMBIO: Condicionales Invertidos
        if (factor <= 15) {
            return { factor, text: 'Estable', color: ['bg-green-300', 'border-green-500'] }; 
        } else if (factor <= 30) {
            return { factor, text: 'Racheado', color: ['bg-yellow-300', 'border-yellow-500'] }; 
        } else {
            return { factor, text: 'Muy Racheado', color: ['bg-red-400', 'border-red-600'] }; 
        }
    }
    
    function getSpotVerdict(speed, gust, degrees) {
        if (degrees !== null) {
            if ((degrees > 292.5 || degrees <= 67.5)) { 
                return ["¡PELIGRO! VIENTO OFFSHORE", ['bg-red-400', 'border-red-600']];
            }
        }
        if (speed === null) return ["Calculando...", ['bg-gray-100', 'border-gray-300']];
        
        if (speed <= 14) return ["FLOJO...", ['bg-blue-200', 'border-blue-400']];
        else if (speed <= 18) return ["¡IDEAL!", ['bg-green-300', 'border-green-500']];
        else if (speed <= 22) return ["¡MUY BUENO!", ['bg-yellow-300', 'border-yellow-500']];
        else if (speed <= 27) return ["¡FUERTE!", ['bg-orange-300', 'border-orange-500']];
        else { 
            if (speed > 33) return ["¡DEMASIADO FUERTE!", ['bg-purple-400', 'border-purple-600']];
            else return ["¡MUY FUERTE!", ['bg-red-400', 'border-red-600']];
        }
    }

    const allColorClasses = [
        'bg-gray-100', 'border-gray-300',
        'bg-blue-200', 'border-blue-400',
        'bg-green-300', 'border-green-500',
        'bg-yellow-300', 'border-yellow-500',
        'bg-orange-300', 'border-orange-500',
        'bg-red-400', 'border-red-600',
        'bg-purple-400', 'border-purple-600',
        'text-red-600', 'text-green-600', 'text-yellow-600', 'text-gray-900',
        'bg-green-400', 'border-green-600'
    ];

    function updateCardColors(element, newClasses) {
        if (!element) return;
        element.classList.remove(...allColorClasses);
        element.classList.add(...newClasses);
    }

    function getMainCardColorClasses(speedInKnots) {
        return ['bg-gray-100', 'border-gray-300'];
    }

    function getWindyColorClasses(speedInKnots) {
        if (speedInKnots !== null && !isNaN(speedInKnots)) {
            if (speedInKnots <= 10) return ['bg-blue-200', 'border-blue-400']; 
            else if (speedInKnots <= 16) return ['bg-green-300', 'border-green-500']; 
            else if (speedInKnots <= 21) return ['bg-yellow-300', 'border-yellow-500']; 
            else if (speedInKnots <= 27) return ['bg-orange-300', 'border-orange-500']; 
            else if (speedInKnots <= 33) return ['bg-red-400', 'border-red-600']; 
            else return ['bg-purple-400', 'border-purple-600']; 
        }
        return ['bg-gray-100', 'border-gray-300']; 
    }
    
    async function fetchWithBackoff(url, options, retries = 3, delay = 1000) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                if ((response.status >= 500 || response.status === 429) && retries > 0) {
                    await new Promise(res => setTimeout(res, delay));
                    return fetchWithBackoff(url, options, retries - 1, delay * 2);
                }
                let errorText = await response.text();
                try {
                    const errorJson = JSON.parse(errorText);
                    errorText = errorJson.error || errorText;
                } catch (e) {}
                throw new Error(errorText);
            }
            return response.json();
        } catch (error) {
            if (retries > 0) {
                await new Promise(res => setTimeout(res, delay));
                return fetchWithBackoff(url, options, retries - 1, delay * 2);
            }
            throw error;
        }
    }
    
    async function fetchWeatherData() {
        showSkeletons(true);
        errorEl.classList.add('hidden'); 

        let windSpeedValue = null; 
        let windGustValue = null; 
        let windDirDegrees = null;
        let tempValue = null;

        try {
            const json = await fetchWithBackoff(weatherApiUrl, {});

            if (json.code === 0 && json.data) {
                const data = json.data;
                
                const outdoor = data.outdoor || {};
                const wind = data.wind || {};
                const pressure = data.pressure || {};
                const rainfall = data.rainfall || {}; 
                const solarUVI = data.solar_and_uvi || {}; 
                
                const temp = outdoor.temperature;
                const humidity = outdoor.humidity;
                const pressureRel = pressure.relative;
                const rainfallDaily = rainfall.daily; 
                const uvi = solarUVI.uvi; 
                
                const windSpeed = wind.wind_speed;
                const windGust = wind.wind_gust;
                const windDir = wind.wind_direction;
                
                windSpeedValue = (windSpeed && windSpeed.value !== null) ? parseFloat(windSpeed.value) : null;
                windGustValue = (windGust && windGust.value !== null) ? parseFloat(windGust.value) : null; 
                windDirDegrees = (windDir && windDir.value !== null) ? parseFloat(windDir.value) : null;
                tempValue = (temp && temp.value !== null) ? parseFloat(temp.value) : null;
                const windDirCardinal = windDirDegrees !== null ? convertDegreesToCardinal(windDirDegrees) : 'N/A';
                
                const stability = calculateGustFactor(windSpeedValue, windGustValue);
                if (stabilityCardEl) {
                    updateCardColors(stabilityCardEl, stability.color);
                    stabilityDataEl.textContent = stability.factor !== null 
                        ? `${Math.round(stability.factor)}% - ${stability.text}` 
                        : stability.text; 
                }
                
                const [verdictText, verdictColors] = getSpotVerdict(windSpeedValue, windGustValue, windDirDegrees);
                updateCardColors(verdictCardEl, verdictColors);
                verdictDataEl.textContent = verdictText;
                
                if (windArrowEl && windDirDegrees !== null) {
                    windArrowEl.style.transform = `rotate(${windDirDegrees}deg)`;
                    const isOffshore = (windDirDegrees > 292.5 || windDirDegrees <= 67.5);
                    const isCross = (windDirDegrees > 67.5 && windDirDegrees <= 112.5) || (windDirDegrees > 247.5 && windDirDegrees <= 292.5);
                    const isOnshore = !isOffshore && !isCross;

                    windArrowEl.classList.remove('text-red-600', 'text-green-600', 'text-yellow-600', 'text-gray-900');
                    if (isOffshore) windArrowEl.classList.add('text-red-600');
                    else if (isCross) windArrowEl.classList.add('text-yellow-600');
                    else if (isOnshore) windArrowEl.classList.add('text-green-600');
                    else windArrowEl.classList.add('text-gray-900');
                }

                updateCardColors(windHighlightCard, getMainCardColorClasses(windSpeedValue));
                updateCardColors(unifiedWindDataCardEl, getWindyColorClasses(windSpeedValue));

                highlightWindSpeedEl.textContent = windSpeed ? `${windSpeed.value} ${windSpeed.unit}` : 'N/A';
                highlightGustEl.textContent = windGust ? `${windGust.value} ${windGust.unit}` : 'N/A';
                highlightWindDirEl.textContent = windDirCardinal; 

                tempEl.textContent = temp ? `${temp.value} ${temp.unit}` : 'N/A';
                humidityEl.textContent = humidity ? `${humidity.value} ${humidity.unit}` : 'N/A';
                pressureEl.textContent = pressureRel ? `${pressureRel.value} ${pressureRel.unit}` : 'N/A'; 
                rainfallDailyEl.textContent = rainfallDaily ? `${rainfallDaily.value} ${rainfallDaily.unit}` : 'N/A'; 
                uviEl.textContent = uvi ? uvi.value : 'N/A'; 
                
                showSkeletons(false); 
                lastUpdateTime = new Date(); 
                updateTimeAgo(); 

            } else {
                throw new Error(json.msg || 'Formato de datos incorrecto de la fuente.');
            }
        } catch (error) {
            console.error('Error al obtener datos del clima:', error);
            errorEl.textContent = `Error: No se pudieron cargar los datos. (${error.message})`;
            errorEl.classList.remove('hidden');
            showSkeletons(false);
            updateCardColors(verdictCardEl, ['bg-red-400', 'border-red-600']);
            verdictDataEl.textContent = 'Error en API (Ecowitt)';
            if (lastUpdatedEl) lastUpdatedEl.textContent = "Error en la actualización.";
        }
    }
    
    fetchWeatherData();
    setInterval(fetchWeatherData, 30000);
    setInterval(updateTimeAgo, 5000);
});