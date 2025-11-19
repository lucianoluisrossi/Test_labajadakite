// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDitwwF3Z5F9KCm9mP0LsXWDuflGtXCFcw",
  authDomain: "labajadakite.firebaseapp.com",
  projectId: "labajadakite",
  storageBucket: "labajadakite.firebasestorage.app",
  messagingSenderId: "982938582037",
  appId: "1:982938582037:web:7141082f9ca601e9aa221c",
  measurementId: "G-R926P5WBWW"
};

let db;
let messagesCollection;
let galleryCollection;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    messagesCollection = collection(db, "kiter_board");
    galleryCollection = collection(db, "daily_gallery_meta"); 
    console.log("✅ Firebase inicializado.");
} catch (e) {
    console.error("❌ Error crítico inicializando Firebase:", e);
}

document.addEventListener('DOMContentLoaded', () => {
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(console.error);
        });
    }

    // --- GESTIÓN DE VISTAS (SPA) ---
    const viewDashboard = document.getElementById('view-dashboard');
    const viewCommunity = document.getElementById('view-community');
    const navHomeBtn = document.getElementById('nav-home');
    const navCommunityBtn = document.getElementById('nav-community');
    const backToHomeBtn = document.getElementById('back-to-home');
    const fabCommunity = document.getElementById('fab-community');
    const notificationBadge = document.getElementById('notification-badge');
    const newMessageToast = document.getElementById('new-message-toast');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuBackdrop = document.getElementById('menu-backdrop');

    let currentView = 'dashboard';

    function switchView(viewName) {
        currentView = viewName;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (viewName === 'dashboard') {
            viewDashboard.classList.remove('hidden');
            viewCommunity.classList.add('hidden');
            fabCommunity.classList.remove('hidden'); 
            
            navHomeBtn.classList.add('bg-blue-50', 'text-blue-700');
            navCommunityBtn.classList.remove('bg-blue-50', 'text-blue-700');
        } else {
            viewDashboard.classList.add('hidden');
            viewCommunity.classList.remove('hidden');
            fabCommunity.classList.add('hidden'); 
            
            navHomeBtn.classList.remove('bg-blue-50', 'text-blue-700');
            navCommunityBtn.classList.add('bg-blue-50', 'text-blue-700');

            markMessagesAsRead();
        }

        if (mobileMenu.classList.contains('translate-x-full') === false) {
            toggleMenu();
        }
    }

    navHomeBtn.addEventListener('click', () => switchView('dashboard'));
    navCommunityBtn.addEventListener('click', () => switchView('community'));
    backToHomeBtn.addEventListener('click', () => switchView('dashboard'));
    fabCommunity.addEventListener('click', () => switchView('community'));
    newMessageToast.addEventListener('click', () => switchView('community'));


    const menuButton = document.getElementById('menu-button');
    const menuCloseButton = document.getElementById('menu-close-button');

    function toggleMenu() {
        if (mobileMenu.classList.contains('translate-x-full')) {
            mobileMenu.classList.remove('translate-x-full'); 
            menuBackdrop.classList.remove('hidden'); 
        } else {
            mobileMenu.classList.add('translate-x-full'); 
            menuBackdrop.classList.add('hidden'); 
        }
    }

    if (menuButton) menuButton.addEventListener('click', toggleMenu);
    if (menuCloseButton) menuCloseButton.addEventListener('click', toggleMenu);
    if (menuBackdrop) menuBackdrop.addEventListener('click', toggleMenu);


    // --- FUNCIÓN DE COMPRESIÓN DE IMÁGENES ---
    async function compressImage(file) {
        return new Promise((resolve, reject) => {
            const MAX_WIDTH = 800; 
            const QUALITY = 0.6;   

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;

                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
                    resolve(dataUrl);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    // --- LÓGICA GALERÍA ---
    const galleryUploadInput = document.getElementById('gallery-upload-input');
    const galleryGrid = document.getElementById('gallery-grid');
    const imageModal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');

    if (galleryUploadInput && db) {
        galleryUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            if (!file.type.startsWith('image/')) {
                alert("Solo se permiten imágenes.");
                return;
            }

            galleryUploadInput.parentElement.innerHTML = `...`;
            
            try {
                const base64String = await compressImage(file);
                await addDoc(galleryCollection, {
                    url: base64String,
                    type: 'base64',
                    timestamp: serverTimestamp()
                });
                alert("¡Foto subida!");
            } catch (error) {
                console.error("Error:", error);
                alert("Error al subir.");
            } finally {
                window.location.reload(); 
            }
        });
    }

    if (galleryGrid && db) {
        const q = query(galleryCollection, orderBy("timestamp", "desc"), limit(20));

        onSnapshot(q, (snapshot) => {
            galleryGrid.innerHTML = ''; 
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            let hasImages = false;

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.timestamp && data.url) {
                    const imgDate = data.timestamp.toDate();
                    if (now - imgDate.getTime() < oneDay) {
                        hasImages = true;
                        const imgContainer = document.createElement('div');
                        imgContainer.className = "relative aspect-square cursor-pointer overflow-hidden rounded-lg shadow-sm bg-gray-200";
                        imgContainer.innerHTML = `
                            <img src="${data.url}" class="w-full h-full object-cover" loading="lazy" alt="Foto">
                            <div class="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white text-[10px] px-1 rounded-tl">
                                ${timeAgo(imgDate)}
                            </div>
                        `;
                        imgContainer.addEventListener('click', () => {
                            modalImg.src = data.url;
                            imageModal.classList.remove('hidden');
                        });
                        galleryGrid.appendChild(imgContainer);
                    }
                }
            });

            if (!hasImages) {
                galleryGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-4 text-sm">Sin fotos recientes.</div>';
            }
        });
    }


    // --- LÓGICA PIZARRA KITERA ---
    const messageForm = document.getElementById('kiter-board-form');
    const messagesContainer = document.getElementById('messages-container');
    const authorInput = document.getElementById('message-author');
    const textInput = document.getElementById('message-text');

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + "m";
        return "ahora";
    }

    function markMessagesAsRead() {
        const now = Date.now();
        localStorage.setItem('lastReadTime', now);
        notificationBadge.classList.add('hidden');
        newMessageToast.classList.add('hidden');
    }

    if (messageForm && db) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const author = authorInput.value.trim();
            const text = textInput.value.trim();

            if (author && text) {
                try {
                    await addDoc(messagesCollection, {
                        author: author,
                        text: text,
                        timestamp: serverTimestamp() 
                    });
                    textInput.value = ''; 
                    localStorage.setItem('kiterName', author);
                    markMessagesAsRead(); 
                } catch (e) {
                    console.error(e);
                }
            }
        });
        const savedName = localStorage.getItem('kiterName');
        if (savedName) authorInput.value = savedName;
    }

    if (messagesContainer && db) {
        const q = query(messagesCollection, orderBy("timestamp", "desc"), limit(50));

        onSnapshot(q, (snapshot) => {
            messagesContainer.innerHTML = ''; 
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            let hasMessages = false;
            
            const lastReadTime = parseInt(localStorage.getItem('lastReadTime') || '0');
            let newestMessageTime = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.timestamp) {
                    const msgDate = data.timestamp.toDate();
                    const msgTime = msgDate.getTime();
                    
                    if (msgTime > newestMessageTime) newestMessageTime = msgTime;

                    if (now - msgTime < oneDay) {
                        hasMessages = true;
                        const div = document.createElement('div');
                        div.className = "bg-gray-50 p-2 rounded border border-gray-100 text-sm mb-2";
                        div.innerHTML = `
                            <div class="flex justify-between items-baseline">
                                <span class="font-bold text-blue-900 text-xs">${data.author}</span>
                                <span class="text-[10px] text-gray-400">${timeAgo(msgDate)}</span>
                            </div>
                            <p class="text-gray-800 text-sm leading-tight">${data.text}</p>
                        `;
                        messagesContainer.appendChild(div);
                    }
                }
            });

            if (!hasMessages) {
                messagesContainer.innerHTML = '<p class="text-center text-gray-400 text-xs py-2">Sé el primero en escribir.</p>';
            } else {
                if (newestMessageTime > lastReadTime && lastReadTime > 0) {
                    if (currentView === 'dashboard') {
                        notificationBadge.classList.remove('hidden');
                        newMessageToast.classList.remove('hidden');
                        setTimeout(() => {
                            newMessageToast.classList.add('hidden');
                        }, 5000);
                    } else {
                        markMessagesAsRead();
                    }
                } else if (lastReadTime === 0 && newestMessageTime > 0) {
                    localStorage.setItem('lastReadTime', now);
                }
            }

        }, (error) => console.error(error));
    }


    // --- URLs de las Funciones Serverless (Proxy) ---
    const weatherApiUrl = 'api/data';

    // --- ELEMENTOS DEL DOM (RECUPERADOS TODOS) ---
    const tempEl = document.getElementById('temp-data');
    const humidityEl = document.getElementById('humidity-data'); // RECUPERADO
    const pressureEl = document.getElementById('pressure-data'); // RECUPERADO
    const rainfallDailyEl = document.getElementById('rainfall-daily-data'); 
    const uviEl = document.getElementById('uvi-data'); // RECUPERADO
    const errorEl = document.getElementById('error-message');
    const lastUpdatedEl = document.getElementById('last-updated');

    const windHighlightCard = document.getElementById('wind-highlight-card');
    const unifiedWindDataCardEl = document.getElementById('unified-wind-data-card');
    
    const highlightWindDirEl = document.getElementById('highlight-wind-dir-data');
    const highlightWindSpeedEl = document.getElementById('highlight-wind-speed-data');
    const highlightGustEl = document.getElementById('highlight-gust-data');
    const windArrowEl = document.getElementById('wind-arrow'); 
    
    const verdictCardEl = document.getElementById('verdict-card');
    const verdictDataEl = document.getElementById('verdict-data');
    
    const stabilityCardEl = document.getElementById('stability-card');
    const stabilityDataEl = document.getElementById('stability-data');
    
    // Skeletons (RECUPERADOS)
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
            lastUpdatedEl.textContent = 'Actualizando...';
        }
    }
    
    function updateTimeAgo() {
        if (!lastUpdateTime) return;
        const now = new Date();
        const secondsAgo = Math.round((now - lastUpdateTime) / 1000);
        
        if (secondsAgo < 5) lastUpdatedEl.textContent = "Ahora";
        else if (secondsAgo < 60) lastUpdatedEl.textContent = `Hace ${secondsAgo}s`;
        else lastUpdatedEl.textContent = `${lastUpdateTime.toLocaleTimeString('es-AR', {hour:'2-digit', minute:'2-digit'})}`;
    }

    function convertDegreesToCardinal(degrees) {
        if (degrees === null || isNaN(degrees)) return 'N/A';
        const val = Math.floor((degrees / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
        return arr[val % 16];
    }

    function calculateGustFactor(speed, gust) {
        if (speed === null || gust === null || speed <= 0) {
            return { factor: null, text: 'N/A', color: ['bg-gray-100', 'border-gray-300'] };
        }
        const MIN_KITE_WIND = 12; 
        if (speed < MIN_KITE_WIND) {
             return { factor: null, text: 'No Aplica', color: ['bg-gray-100', 'border-gray-300'] };
        }
        
        if (gust <= speed) {
             return { factor: 0, text: 'Ultra Estable', color: ['bg-green-400', 'border-green-600'] };
        }
        
        const factor = (1 - (speed / gust)) * 100; 

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
                return ["¡PELIGRO! OFFSHORE", ['bg-red-400', 'border-red-600']];
            }
        }
        if (speed === null) return ["Calculando...", ['bg-gray-100', 'border-gray-300']];
        
        if (speed <= 14) return ["FLOJO...", ['bg-blue-200', 'border-blue-400']];
        else if (speed <= 18) return ["¡IDEAL!", ['bg-green-300', 'border-green-500']];
        else if (speed <= 22) return ["¡MUY BUENO!", ['bg-yellow-300', 'border-yellow-500']];
        else if (speed <= 27) return ["¡FUERTE!", ['bg-orange-300', 'border-orange-500']];
        else { 
            if (speed > 33) return ["¡DEMASIADO!", ['bg-purple-400', 'border-purple-600']];
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

                updateCardColors(windHighlightCard, ['bg-gray-100', 'border-gray-300']); 
                updateCardColors(unifiedWindDataCardEl, getWindyColorClasses(windSpeedValue));

                highlightWindSpeedEl.textContent = windSpeed ? `${windSpeed.value} ${windSpeed.unit}` : 'N/A';
                highlightGustEl.textContent = windGust ? `${windGust.value} ${windGust.unit}` : 'N/A';
                highlightWindDirEl.textContent = windDirCardinal; 

                tempEl.textContent = temp ? `${temp.value} ${temp.unit}` : 'N/A';
                humidityEl.textContent = humidity ? `${humidity.value} ${humidity.unit}` : 'N/A'; // RECUPERADO
                pressureEl.textContent = pressureRel ? `${pressureRel.value} ${pressureRel.unit}` : 'N/A'; // RECUPERADO
                rainfallDailyEl.textContent = rainfallDaily ? `${rainfallDaily.value} ${rainfallDaily.unit}` : 'N/A'; 
                uviEl.textContent = uvi ? uvi.value : 'N/A'; // RECUPERADO
                
                showSkeletons(false); 
                lastUpdateTime = new Date(); 
                updateTimeAgo(); 

            } else {
                throw new Error(json.msg || 'Formato de datos incorrecto de la fuente.');
            }
        } catch (error) {
            console.error('Error al obtener datos del clima:', error);
            errorEl.textContent = `Error: ${error.message}`;
            errorEl.classList.remove('hidden');
            showSkeletons(false);
            updateCardColors(verdictCardEl, ['bg-red-400', 'border-red-600']);
            verdictDataEl.textContent = 'Error API';
            if (lastUpdatedEl) lastUpdatedEl.textContent = "Error";
        }
    }
    
    fetchWeatherData();
    setInterval(fetchWeatherData, 30000);
    setInterval(updateTimeAgo, 5000);
});