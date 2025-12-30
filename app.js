// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

// Variables globales
let db;
let auth; 
let messagesCollection;
let galleryCollection; 

try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    messagesCollection = collection(db, "kiter_board");
    galleryCollection = collection(db, "daily_gallery_meta"); 
    const checkinsCollection = collection(db, "active_checkins");

    signInAnonymously(auth).catch(e => console.warn("Auth warning:", e));
    console.log("✅ Firebase inicializado.");

    // --- LÓGICA DE CHECK-IN ---
    const btnCheckin = document.getElementById('btn-checkin');
    const btnCheckinText = document.getElementById('btn-checkin-text');
    const checkinCount = document.getElementById('checkin-count');
    const activeKitersContainer = document.getElementById('active-kiters-container');

    if (btnCheckin && db) {
        const qCheckins = query(checkinsCollection, orderBy("timestamp", "desc"));
        onSnapshot(qCheckins, (snapshot) => {
            const now = Date.now();
            const fourHours = 4 * 60 * 60 * 1000;
            const activeKiters = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.timestamp) {
                    const time = data.timestamp.toDate().getTime();
                    if (now - time < fourHours) {
                        activeKiters.push({ id: doc.id, name: data.name });
                    }
                }
            });

            if (checkinCount) checkinCount.innerText = `${activeKiters.length} en el agua`;
            
            if (activeKitersContainer) {
                activeKitersContainer.innerHTML = '';
                if (activeKiters.length > 0) {
                    activeKitersContainer.classList.remove('hidden');
                    activeKiters.forEach(kiter => {
                        const pill = document.createElement('span');
                        pill.className = "bg-white border border-blue-200 text-blue-700 text-[11px] px-2 py-1 rounded-full font-bold shadow-sm";
                        pill.innerText = kiter.name;
                        activeKitersContainer.appendChild(pill);
                    });
                } else {
                    activeKitersContainer.classList.add('hidden');
                }
            }

            const myName = localStorage.getItem('kiterName');
            const alreadyIn = activeKiters.some(k => k.name === myName);
            if (alreadyIn) {
                btnCheckin.classList.replace('bg-blue-600', 'bg-green-600');
                if (btnCheckinText) btnCheckinText.innerText = "¡Ya estás en el agua!";
                btnCheckin.disabled = true;
            }
        });

        btnCheckin.addEventListener('click', async () => {
            let name = localStorage.getItem('kiterName');
            if (!name) {
                name = prompt("Ingresa tu nombre para el Check-in:");
                if (!name) return;
                name = name.trim().substring(0, 15);
                localStorage.setItem('kiterName', name);
            }

            btnCheckin.disabled = true;
            if (btnCheckinText) btnCheckinText.innerText = "Registrando...";

            try {
                await addDoc(checkinsCollection, {
                    name: name,
                    timestamp: serverTimestamp()
                });
            } catch (e) {
                console.error(e);
                alert("Error al hacer check-in");
                btnCheckin.disabled = false;
                if (btnCheckinText) btnCheckinText.innerText = "¡Entrando al agua!";
            }
        });
    }

} catch (e) {
    console.error("❌ Error inicializando Firebase:", e);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 App iniciada.");

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(console.error);
        });
    }

    // --- ELEMENTOS DE NAVEGACIÓN ---
    const viewDashboard = document.getElementById('view-dashboard');
    const viewCommunity = document.getElementById('view-community');
    const navHomeBtn = document.getElementById('nav-home');
    const btnPizarraMenu = document.getElementById('btn-pizarra-menu');
    const backToHomeBtn = document.getElementById('back-to-home');
    const fabCommunity = document.getElementById('fab-community');
    const newMessageToast = document.getElementById('new-message-toast');
    const newPhotoToast = document.getElementById('new-photo-toast');
    const menuButton = document.getElementById('menu-button');
    const menuCloseButton = document.getElementById('menu-close-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuBackdrop = document.getElementById('menu-backdrop');
// --- LÓGICA DE INSTALACIÓN PWA ---
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(() => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt = null;
        }
    }, 3000); // Dispara el cartel a los 3 segundos
});
    function switchView(viewName) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (viewName === 'dashboard') {
            viewDashboard.classList.remove('hidden');
            viewCommunity.classList.add('hidden');
            if(fabCommunity) fabCommunity.classList.remove('hidden');
        } else {
            viewDashboard.classList.add('hidden');
            viewCommunity.classList.remove('hidden');
            if(fabCommunity) fabCommunity.classList.add('hidden');
            markMessagesAsRead();
        }
        if (mobileMenu && !mobileMenu.classList.contains('-translate-x-full')) {
            toggleMenu();
        }
    }

    function toggleMenu() {
        if (mobileMenu.classList.contains('-translate-x-full')) {
            mobileMenu.classList.remove('-translate-x-full'); 
            menuBackdrop.classList.remove('hidden'); 
        } else {
            mobileMenu.classList.add('-translate-x-full'); 
            menuBackdrop.classList.add('hidden'); 
        }
    }

    if (navHomeBtn) navHomeBtn.addEventListener('click', () => switchView('dashboard'));
    if (backToHomeBtn) backToHomeBtn.addEventListener('click', () => switchView('dashboard'));
    if (btnPizarraMenu) btnPizarraMenu.addEventListener('click', () => switchView('community'));
    if (fabCommunity) fabCommunity.addEventListener('click', () => switchView('community'));
    if (newMessageToast) newMessageToast.addEventListener('click', () => switchView('community'));
    if (newPhotoToast) {
        newPhotoToast.addEventListener('click', () => {
            switchView('community');
            // Abrir la galería automáticamente
            const gallerySection = document.getElementById('gallery-section');
            if (gallerySection) gallerySection.setAttribute('open', '');
            markPhotosAsRead();
        });
    }
    if (menuButton) menuButton.addEventListener('click', toggleMenu);
    if (menuCloseButton) menuCloseButton.addEventListener('click', toggleMenu);
    if (menuBackdrop) menuBackdrop.addEventListener('click', toggleMenu);
    
    // Marcar fotos como leídas cuando se abre la galería
    const gallerySection = document.getElementById('gallery-section');
    if (gallerySection) {
        gallerySection.addEventListener('toggle', () => {
            if (gallerySection.hasAttribute('open')) {
                markPhotosAsRead();
            }
        });
    }

    // --- COMPRESIÓN ---
    async function compressImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const MAX_WIDTH = 600; 
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

    // --- GALERÍA ---
    const galleryUploadInput = document.getElementById('gallery-upload-input');
    const galleryGrid = document.getElementById('gallery-grid');
    const imageModal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');

    const handleGalleryUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert("Solo imágenes."); return; }

        const inputElement = e.target;
        const labelElement = inputElement.parentElement;
        const spans = labelElement.querySelectorAll('span');
        const originalTexts = []; 
        spans.forEach(s => originalTexts.push(s.textContent));

        spans.forEach(s => s.textContent = "Subiendo...");
        labelElement.classList.add('opacity-50', 'cursor-wait');
        inputElement.disabled = true; 
        
        try {
            const base64String = await compressImageToBase64(file);
            await addDoc(galleryCollection, {
                url: base64String,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error("Error subiendo:", error);
            alert("No se pudo subir.");
        } finally {
            spans.forEach((s, index) => s.textContent = originalTexts[index]);
            labelElement.classList.remove('opacity-50', 'cursor-wait');
            inputElement.disabled = false;
            inputElement.value = ''; 
        }
    };

    if (galleryUploadInput && db) {
        galleryUploadInput.addEventListener('change', handleGalleryUpload);
    }

    if (galleryGrid && db) {
        const q = query(galleryCollection, orderBy("timestamp", "desc"), limit(20));
        onSnapshot(q, (snapshot) => {
            galleryGrid.innerHTML = ''; 
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            let hasImages = false;
            const lastPhotoReadTime = parseInt(localStorage.getItem('lastPhotoReadTime') || '0');
            let newestPhotoTime = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.timestamp && data.url) {
                    const imgDate = data.timestamp.toDate();
                    const imgTime = imgDate.getTime();
                    if (imgTime > newestPhotoTime) newestPhotoTime = imgTime;

                    if (now - imgTime < oneDay) {
                        hasImages = true;
                        const imgContainer = document.createElement('div');
                        imgContainer.className = "relative aspect-square cursor-pointer overflow-hidden rounded-lg shadow-md bg-gray-100 hover:opacity-90 transition-opacity";
                        imgContainer.innerHTML = `<img src="${data.url}" class="w-full h-full object-cover" loading="lazy" alt="Foto"><div class="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white text-[10px] px-2 py-1 rounded-tl-lg">${timeAgo(imgDate)}</div>`;
                        imgContainer.addEventListener('click', () => {
                            modalImg.src = data.url;
                            imageModal.classList.remove('hidden');
                        });
                        galleryGrid.appendChild(imgContainer);
                    }
                }
            });
            if (!hasImages) galleryGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-4 text-sm">Sin fotos hoy.</div>';
            
            // Notificación de nueva foto
            if (hasImages && newestPhotoTime > lastPhotoReadTime && lastPhotoReadTime > 0) {
                // Solo mostrar si NO estamos viendo la galería abierta
                const gallerySection = document.getElementById('gallery-section');
                const isGalleryOpen = gallerySection && gallerySection.hasAttribute('open');
                if (!isGalleryOpen) {
                    if (newPhotoToast) newPhotoToast.classList.remove('hidden');
                } else {
                    markPhotosAsRead();
                }
            } else if (lastPhotoReadTime === 0 && newestPhotoTime > 0) {
                // Primera vez que carga, inicializar el tiempo
                localStorage.setItem('lastPhotoReadTime', now);
            }
        });
    }

    // --- PIZARRA ---
    const messageForm = document.getElementById('kiter-board-form');
    const messagesContainer = document.getElementById('messages-container');
    const authorInput = document.getElementById('message-author');
    const textInput = document.getElementById('message-text');

    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        let interval = seconds / 3600;
        if (interval > 1) return "hace " + Math.floor(interval) + "h";
        interval = seconds / 60;
        if (interval > 1) return "hace " + Math.floor(interval) + "m";
        return "hace un momento";
    }

    function markMessagesAsRead() {
        const now = Date.now();
        localStorage.setItem('lastReadTime', now);
        const badge = document.getElementById('notification-badge');
        if (badge) badge.classList.add('hidden');
        if (newMessageToast) newMessageToast.classList.add('hidden');
    }

    function markPhotosAsRead() {
        const now = Date.now();
        localStorage.setItem('lastPhotoReadTime', now);
        if (newPhotoToast) newPhotoToast.classList.add('hidden');
    }

    if (messageForm && db) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const author = authorInput.value.trim();
            const text = textInput.value.trim();
            if (author && text) {
                const btn = messageForm.querySelector('button');
                const originalText = btn.innerText;
                btn.innerText = '...';
                btn.disabled = true;
                try {
                    await addDoc(messagesCollection, { author: author, text: text, timestamp: serverTimestamp() });
                    textInput.value = ''; 
                    localStorage.setItem('kiterName', author);
                    markMessagesAsRead();
                } catch (e) { 
                    console.error(e);
                    alert("Error: " + e.message);
                } finally {
                    btn.innerText = originalText;
                    btn.disabled = false;
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
                        div.className = "bg-gray-50 p-3 rounded border border-gray-100 text-sm mb-2";
                        div.innerHTML = `<div class="flex justify-between items-baseline mb-1"><span class="font-bold text-blue-900">${data.author}</span><span class="text-xs text-gray-400">${timeAgo(msgDate)}</span></div><p class="text-gray-700 break-words">${data.text}</p>`;
                        messagesContainer.appendChild(div);
                    }
                }
            });
            if (!hasMessages) messagesContainer.innerHTML = '<p class="text-center text-gray-400 text-xs py-2">No hay mensajes recientes.</p>';
            else {
                if (newestMessageTime > lastReadTime && lastReadTime > 0) {
                    if (viewCommunity.classList.contains('hidden')) {
                        if(newMessageToast) newMessageToast.classList.remove('hidden');
                        const badge = document.getElementById('notification-badge');
                        if(badge) badge.classList.remove('hidden');
                    } else { markMessagesAsRead(); }
                } else if (lastReadTime === 0 && newestMessageTime > 0) {
                    localStorage.setItem('lastReadTime', now);
                }
            }
        });
    }

    // --- API CLIMA ---
    const weatherApiUrl = 'api/data';
    const tempEl = document.getElementById('temp-data');
    const humidityEl = document.getElementById('humidity-data');
    const pressureEl = document.getElementById('pressure-data');
    const rainfallDailyEl = document.getElementById('rainfall-daily-data'); 
    const uviEl = document.getElementById('uvi-data'); 
    const errorEl = document.getElementById('error-message');
    const lastUpdatedEl = document.getElementById('last-updated');

    const windHighlightCard = document.getElementById('wind-highlight-card');
    const unifiedWindDataCardEl = document.getElementById('unified-wind-data-card');
    const highlightWindDirEl = document.getElementById('highlight-wind-dir-data');
    const highlightWindSpeedEl = document.getElementById('highlight-wind-speed-data');
    const highlightGustEl = document.getElementById('highlight-gust-data');
    const windArrowEl = document.getElementById('wind-arrow'); 
    const gustInfoContainer = document.getElementById('gust-info-container');
    const verdictCardEl = document.getElementById('verdict-card');
    const verdictDataEl = document.getElementById('verdict-data');
    const stabilityCardEl = document.getElementById('stability-card');
    const stabilityDataEl = document.getElementById('stability-data');

    const skeletonLoaderIds = ['verdict-data-loader','highlight-wind-dir-data-loader', 'highlight-wind-speed-data-loader', 'highlight-gust-data-loader','temp-data-loader', 'humidity-data-loader', 'pressure-data-loader', 'rainfall-daily-data-loader', 'uvi-data-loader','stability-data-loader'];
    const dataContentIds = ['verdict-data','highlight-wind-dir-data', 'highlight-wind-speed-data', 'highlight-gust-data','temp-data', 'humidity-data', 'pressure-data','rainfall-daily-data', 'uvi-data','stability-data'];

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
        if (isLoading && lastUpdatedEl) lastUpdatedEl.textContent = 'Actualizando...';
    }
    
    function updateTimeAgo() {
        if (!lastUpdateTime) return;
        const now = new Date();
        const secondsAgo = Math.round((now - lastUpdateTime) / 1000);
        if (secondsAgo < 5) lastUpdatedEl.textContent = "Actualizado ahora";
        else if (secondsAgo < 60) lastUpdatedEl.textContent = `Actualizado hace ${secondsAgo} seg.`;
        else lastUpdatedEl.textContent = `Actualizado: ${lastUpdateTime.toLocaleTimeString('es-AR')}`;
    }

    function convertDegreesToCardinal(degrees) {
        if (degrees === null || isNaN(degrees)) return 'N/A';
        const val = Math.floor((degrees / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
        return arr[val % 16];
    }

    function calculateGustFactor(speed, gust) {
        if (speed === null || gust === null || speed <= 0) return { factor: null, text: 'N/A', color: ['bg-gray-100', 'border-gray-300'] };
        const MIN_KITE_WIND = 12; 
        if (speed < MIN_KITE_WIND) return { factor: null, text: 'No Aplica', color: ['bg-gray-100', 'border-gray-300'] };
        if (gust <= speed) return { factor: 0, text: 'Ultra Estable', color: ['bg-green-400', 'border-green-600'] };
        const factor = (1 - (speed / gust)) * 100; 
        if (factor <= 15) return { factor, text: 'Estable', color: ['bg-green-300', 'border-green-500'] }; 
        else if (factor <= 30) return { factor, text: 'Racheado', color: ['bg-yellow-300', 'border-yellow-500'] }; 
        else return { factor, text: 'Muy Racheado', color: ['bg-red-400', 'border-red-600'] }; 
    }
    
    function getSpotVerdict(speed, gust, degrees) {
        if (degrees !== null && (degrees > 292.5 || degrees <= 67.5)) return ["VIENTO OFFSHORE!", ['bg-red-400', 'border-red-600']];
        if (speed === null) return ["Calculando...", ['bg-gray-100', 'border-gray-300']];
        if (speed <= 14) return ["FLOJO...", ['bg-blue-200', 'border-blue-400']];
        else if (speed <= 16) return ["ACEPTABLE", ['bg-cyan-300', 'border-cyan-500']];
        else if (speed <= 19) return ["¡IDEAL!", ['bg-green-300', 'border-green-500']];
        else if (speed <= 22) return ["¡MUY BUENO!", ['bg-yellow-300', 'border-yellow-500']];
        else if (speed <= 27) return ["¡FUERTE!", ['bg-orange-300', 'border-orange-500']];
        else if (speed > 33) return ["¡DEMASIADO FUERTE!", ['bg-purple-400', 'border-purple-600']];
        else return ["¡MUY FUERTE!", ['bg-red-400', 'border-red-600']];
    }

    const allColorClasses = [
        'bg-gray-100', 'border-gray-300', 'bg-blue-200', 'border-blue-400', 'bg-green-300', 'border-green-500',
        'bg-yellow-300', 'border-yellow-500', 'bg-orange-300', 'border-orange-500', 'bg-red-400', 'border-red-600','bg-cyan-300', 'border-cyan-500',
        'bg-purple-400', 'border-purple-600', 'text-red-600', 'text-green-600', 'text-yellow-600', 'text-gray-900',
        'bg-green-400', 'border-green-600', 'bg-gray-50', 'bg-white/30', 'bg-cyan-300', 'border-cyan-500'
    ];

    function updateCardColors(element, newClasses) {
        if (!element) return;
        element.classList.remove(...allColorClasses);
        element.classList.add(...newClasses);
    }

    // --- ESTA ES LA FUNCIÓN QUE FALTABA ---
        
        function getUnifiedWindColorClasses(speedInKnots, degrees) {
        // 1. SEGURIDAD PRIMERO: Si es Offshore, tarjeta ROJA. (desactivado)
        /*if (degrees !== null) {
             if ((degrees > 292.5 || degrees <= 67.5)) { 
                return ['bg-red-400', 'border-red-600'];
            }
        }*/
    
        // 2. Escala Kitera (Igualada a Veredicto)
        if (speedInKnots !== null && !isNaN(speedInKnots)) {
            if (speedInKnots <= 14) return ['bg-blue-200', 'border-blue-400'];       // Flojo
            else if (speedInKnots <= 16) return ['bg-cyan-300', 'border-cyan-500'];  // Aceptable
            else if (speedInKnots <= 19) return ['bg-green-300', 'border-green-500'];// Ideal
            else if (speedInKnots <= 22) return ['bg-yellow-300', 'border-yellow-500']; // Muy Bueno
            else if (speedInKnots <= 27) return ['bg-orange-300', 'border-orange-500']; // Fuerte
            else if (speedInKnots <= 33) return ['bg-red-400', 'border-red-600'];    // Muy Fuerte
            else return ['bg-purple-400', 'border-purple-600'];                      // Demasiado Fuerte
        }
        
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
    
    function getMockWeatherData() {
        return {
            code: 0, msg: "success",
            data: {
                outdoor: { temperature: { value: "24.5", unit: "°C" }, humidity: { value: "55", unit: "%" } },
                wind: { wind_speed: { value: "19.5", unit: "kts" }, wind_gust: { value: "24.2", unit: "kts" }, wind_direction: { value: "95", unit: "deg" } },
                pressure: { relative: { value: "1015", unit: "hPa" } },
                rainfall: { daily: { value: "0.0", unit: "mm" } },
                solar_and_uvi: { uvi: { value: "7" } }
            }
        };
    }

    async function fetchWithBackoff(url, options, retries = 2, delay = 500) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error("Network error");
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
        let json;
        try {
            try {
                json = await fetchWithBackoff(weatherApiUrl, {});
            } catch (e) {
                console.warn("API real falló, usando MOCK.");
                json = getMockWeatherData();
            }

            if (json.code === 0 && json.data) {
                const data = json.data;
                const windSpeedValue = (data.wind?.wind_speed?.value) ? parseFloat(data.wind.wind_speed.value) : null;
                const windGustValue = (data.wind?.wind_gust?.value) ? parseFloat(data.wind.wind_gust.value) : null; 
                const windDirDegrees = (data.wind?.wind_direction?.value) ? parseFloat(data.wind.wind_direction.value) : null;
                
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
                    else windArrowEl.classList.add('text-green-600');
                }

                updateCardColors(windHighlightCard, ['bg-gray-100', 'border-gray-300']); 
                updateCardColors(unifiedWindDataCardEl, getUnifiedWindColorClasses(windSpeedValue, windDirDegrees));
                if (gustInfoContainer) updateCardColors(gustInfoContainer, getUnifiedWindColorClasses(windGustValue, windDirDegrees));

                highlightWindSpeedEl.innerHTML = (windSpeedValue !== null) 
                    ? `${windSpeedValue} <span class="text-xl font-bold align-baseline">kts</span>` 
                    : 'N/A';
                highlightGustEl.textContent = windGustValue ?? 'N/A';
                highlightWindDirEl.textContent = convertDegreesToCardinal(windDirDegrees); 

                if(tempEl) tempEl.textContent = data.outdoor?.temperature?.value ? `${data.outdoor.temperature.value} ${data.outdoor.temperature.unit}` : 'N/A';
                if(humidityEl) humidityEl.textContent = data.outdoor?.humidity?.value ? `${data.outdoor.humidity.value}%` : 'N/A';
                if(pressureEl) pressureEl.textContent = data.pressure?.relative?.value ? `${data.pressure.relative.value} hPa` : 'N/A'; 
                if(rainfallDailyEl) rainfallDailyEl.textContent = data.rainfall?.daily?.value ? `${data.rainfall.daily.value} mm` : 'N/A'; 
                if(uviEl) uviEl.textContent = data.solar_and_uvi?.uvi?.value ?? 'N/A'; 

                const stability = calculateGustFactor(windSpeedValue, windGustValue);
                if (stabilityCardEl) updateCardColors(stabilityCardEl, stability.color);
                if (stabilityDataEl) stabilityDataEl.textContent = stability.text;
                
                // Verificar alertas de viento
                const windDirCardinal = convertDegreesToCardinal(windDirDegrees);
                if (typeof window.checkWindAlert === 'function') {
                    window.checkWindAlert(windSpeedValue, windDirCardinal);
                }
                
                showSkeletons(false); 
                lastUpdateTime = new Date(); 
                updateTimeAgo(); 
            } else {
                throw new Error('Datos incorrectos');
            }
        } catch (error) {
            console.error(error);
            errorEl.classList.remove('hidden');
            showSkeletons(false);
            updateCardColors(verdictCardEl, ['bg-red-400', 'border-red-600']);
            verdictDataEl.textContent = 'Error API';
        }
    }
    
    fetchWeatherData();
    setInterval(fetchWeatherData, 30000);
    setInterval(updateTimeAgo, 5000);

    // --- SISTEMA DE ALERTAS DE VIENTO ---
    const btnWindAlert = document.getElementById('btn-wind-alert');
    const btnAlertText = document.getElementById('btn-alert-text');
    const alertStatus = document.getElementById('alert-status');
    const alertModal = document.getElementById('alert-modal');
    const alertModalClose = document.getElementById('alert-modal-close');
    const alertMinWind = document.getElementById('alert-min-wind');
    const alertMaxWind = document.getElementById('alert-max-wind');
    const btnSaveAlert = document.getElementById('btn-save-alert');
    const btnDisableAlert = document.getElementById('btn-disable-alert');

    let windAlertConfig = JSON.parse(localStorage.getItem('windAlertConfig')) || null;
    let lastAlertTime = parseInt(localStorage.getItem('lastWindAlertTime')) || 0;
    const ALERT_COOLDOWN = 30 * 60 * 1000; // 30 minutos entre alertas

    function updateAlertButtonState() {
        if (windAlertConfig && windAlertConfig.enabled) {
            btnAlertText.textContent = `Alertas: ${windAlertConfig.min}-${windAlertConfig.max} kts`;
            btnWindAlert.classList.remove('bg-orange-500', 'hover:bg-orange-600', 'border-orange-600');
            btnWindAlert.classList.add('bg-green-500', 'hover:bg-green-600', 'border-green-600');
            alertStatus.textContent = `Recibirás alertas cuando el viento esté entre ${windAlertConfig.min} y ${windAlertConfig.max} nudos`;
            alertStatus.classList.remove('hidden');
            btnSaveAlert.textContent = 'Guardar Cambios';
            btnDisableAlert.classList.remove('hidden');
        } else {
            btnAlertText.textContent = 'Activar Alertas de Viento';
            btnWindAlert.classList.remove('bg-green-500', 'hover:bg-green-600', 'border-green-600');
            btnWindAlert.classList.add('bg-orange-500', 'hover:bg-orange-600', 'border-orange-600');
            alertStatus.classList.add('hidden');
            btnSaveAlert.textContent = 'Activar Alertas';
            btnDisableAlert.classList.add('hidden');
        }
    }

    async function requestNotificationPermission() {
        if (!('Notification' in window)) {
            alert('Tu navegador no soporta notificaciones.');
            return false;
        }
        if (Notification.permission === 'granted') {
            return true;
        }
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        alert('Las notificaciones están bloqueadas. Habilítalas en la configuración del navegador.');
        return false;
    }

    function showWindNotification(windSpeed, windDir) {
        if (Notification.permission !== 'granted') return;
        
        const notification = new Notification('La Bajada - Condiciones Ideales!', {
            body: `Viento: ${windSpeed} nudos del ${windDir}\n¡A navegar!`,
            icon: 'logo2.png',
            badge: 'logo2.png',
            tag: 'wind-alert',
            renotify: true,
            vibrate: [200, 100, 200]
        });

        notification.onclick = () => {
            window.focus();
            notification.close();
        };

        // Auto-cerrar después de 10 segundos
        setTimeout(() => notification.close(), 10000);
    }

    function checkWindAlert(windSpeed, windDir) {
        if (!windAlertConfig || !windAlertConfig.enabled) return;
        if (windSpeed === null) return;
        
        const now = Date.now();
        // Evitar spam de notificaciones
        if (now - lastAlertTime < ALERT_COOLDOWN) return;

        if (windSpeed >= windAlertConfig.min && windSpeed <= windAlertConfig.max) {
            showWindNotification(windSpeed, windDir);
            lastAlertTime = now;
            localStorage.setItem('lastWindAlertTime', now);
        }
    }

    // Event listeners del modal
    if (btnWindAlert) {
        btnWindAlert.addEventListener('click', () => {
            if (windAlertConfig) {
                alertMinWind.value = windAlertConfig.min;
                alertMaxWind.value = windAlertConfig.max;
            }
            alertModal.classList.remove('hidden');
        });
    }

    if (alertModalClose) {
        alertModalClose.addEventListener('click', () => {
            alertModal.classList.add('hidden');
        });
    }

    if (alertModal) {
        alertModal.addEventListener('click', (e) => {
            if (e.target === alertModal) {
                alertModal.classList.add('hidden');
            }
        });
    }

    if (btnSaveAlert) {
        btnSaveAlert.addEventListener('click', async () => {
            const min = parseInt(alertMinWind.value);
            const max = parseInt(alertMaxWind.value);

            if (isNaN(min) || isNaN(max) || min < 0 || max > 50 || min >= max) {
                alert('Por favor ingresa un rango válido (mínimo menor que máximo, entre 0 y 50)');
                return;
            }

            const hasPermission = await requestNotificationPermission();
            if (!hasPermission) return;

            windAlertConfig = { enabled: true, min, max };
            localStorage.setItem('windAlertConfig', JSON.stringify(windAlertConfig));
            updateAlertButtonState();
            alertModal.classList.add('hidden');

            // Mostrar confirmación
            if (Notification.permission === 'granted') {
                new Notification('Alertas Activadas', {
                    body: `Te avisaremos cuando el viento esté entre ${min} y ${max} nudos`,
                    icon: 'logo2.png',
                    tag: 'alert-config'
                });
            }
        });
    }

    if (btnDisableAlert) {
        btnDisableAlert.addEventListener('click', () => {
            windAlertConfig = null;
            localStorage.removeItem('windAlertConfig');
            updateAlertButtonState();
            alertModal.classList.add('hidden');
        });
    }

    // Inicializar estado del botón
    updateAlertButtonState();

    // Exponer función para uso global (será llamada desde fetchWeatherData)
    window.checkWindAlert = checkWindAlert;
});