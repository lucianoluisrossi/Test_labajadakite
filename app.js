// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
let storage;
let messagesCollection;
let galleryCollection;

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
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

    // --- GESTIÓN DE VISTAS ---
    const viewDashboard = document.getElementById('view-dashboard');
    const viewCommunity = document.getElementById('view-community');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuBackdrop = document.getElementById('menu-backdrop');
    const menuButton = document.getElementById('menu-button');
    const menuCloseButton = document.getElementById('menu-close-button');
    const navHomeBtn = document.getElementById('nav-home');
    const btnPizarraMenu = document.getElementById('btn-pizarra-menu');

    function toggleMenu() {
        if (mobileMenu.classList.contains('-translate-x-full')) {
            mobileMenu.classList.remove('-translate-x-full'); 
            menuBackdrop.classList.remove('hidden'); 
        } else {
            mobileMenu.classList.add('-translate-x-full'); 
            menuBackdrop.classList.add('hidden'); 
        }
    }

    function switchView(viewName) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (viewName === 'dashboard') {
            viewDashboard.classList.remove('hidden');
            viewCommunity.classList.add('hidden');
        } else {
            viewDashboard.classList.add('hidden');
            viewCommunity.classList.remove('hidden');
        }
        if (!mobileMenu.classList.contains('-translate-x-full')) {
            toggleMenu();
        }
    }

    if (menuButton) menuButton.addEventListener('click', toggleMenu);
    if (menuCloseButton) menuCloseButton.addEventListener('click', toggleMenu);
    if (menuBackdrop) menuBackdrop.addEventListener('click', toggleMenu);
    if (navHomeBtn) navHomeBtn.addEventListener('click', () => switchView('dashboard'));
    
    if (btnPizarraMenu) {
        btnPizarraMenu.addEventListener('click', () => switchView('community'));
    }
    
    // --- COMPRESIÓN DE IMÁGENES ---
    async function compressImage(file) {
        return new Promise((resolve, reject) => {
            const MAX_WIDTH = 1024; 
            const QUALITY = 0.7;   
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
                    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', QUALITY);
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

    if (galleryUploadInput && storage && db) {
        galleryUploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) { alert("Solo imágenes"); return; }
            
            const parent = galleryUploadInput.parentElement;
            parent.innerHTML = `Subiendo...`;
            try {
                const compressedBlob = await compressImage(file);
                const fileName = `gallery/${Date.now()}_${Math.floor(Math.random()*1000)}.jpg`;
                const storageRef = ref(storage, fileName);
                await uploadBytes(storageRef, compressedBlob);
                const downloadURL = await getDownloadURL(storageRef);
                await addDoc(galleryCollection, { url: downloadURL, path: fileName, timestamp: serverTimestamp() });
                alert("¡Foto subida!");
            } catch (error) {
                console.error(error);
                alert("Error al subir.");
            } finally {
                // Recargar para resetear input (forma simple)
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
                    if (now - data.timestamp.toDate().getTime() < oneDay) {
                        hasImages = true;
                        const div = document.createElement('div');
                        div.className = "relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-200";
                        div.innerHTML = `<img src="${data.url}" class="w-full h-full object-cover">`;
                        div.onclick = () => { modalImg.src = data.url; imageModal.classList.remove('hidden'); };
                        galleryGrid.appendChild(div);
                    }
                }
            });
            if (!hasImages) galleryGrid.innerHTML = '<div class="col-span-full text-center text-gray-400 py-4">Sin fotos hoy.</div>';
        });
    }

    // --- PIZARRA ---
    const messageForm = document.getElementById('kiter-board-form');
    const messagesContainer = document.getElementById('messages-container');
    const authorInput = document.getElementById('message-author');
    const textInput = document.getElementById('message-text');

    if (messageForm && db) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (authorInput.value && textInput.value) {
                await addDoc(messagesCollection, {
                    author: authorInput.value.trim(),
                    text: textInput.value.trim(),
                    timestamp: serverTimestamp()
                });
                textInput.value = '';
                localStorage.setItem('kiterName', authorInput.value);
            }
        });
        const saved = localStorage.getItem('kiterName');
        if (saved) authorInput.value = saved;
    }

    if (messagesContainer && db) {
        const q = query(messagesCollection, orderBy("timestamp", "desc"), limit(50));
        onSnapshot(q, (snapshot) => {
            messagesContainer.innerHTML = '';
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.timestamp && (now - data.timestamp.toDate().getTime() < oneDay)) {
                    const div = document.createElement('div');
                    div.className = "bg-gray-50 p-2 rounded border mb-2 text-sm";
                    div.innerHTML = `<span class="font-bold text-blue-900">${data.author}:</span> ${data.text}`;
                    messagesContainer.appendChild(div);
                }
            });
        });
    }

    // --- CLIMA ---
    const weatherApiUrl = 'api/data';
    const tempEl = document.getElementById('temp-data');
    const humidityEl = document.getElementById('humidity-data'); 
    const pressureEl = document.getElementById('pressure-data'); 
    const rainfallDailyEl = document.getElementById('rainfall-daily-data'); 
    const uviEl = document.getElementById('uvi-data'); 
    const errorEl = document.getElementById('error-message');
    const lastUpdatedEl = document.getElementById('last-updated');

    // Elementos Tarjeta Unificada (NUEVOS IDs)
    const windHighlightCard = document.getElementById('wind-highlight-card'); 
    const unifiedWindDataCardEl = document.getElementById('unified-wind-data-card'); // LA TARJETA QUE CAMBIA DE COLOR
    const highlightWindDirEl = document.getElementById('highlight-wind-dir-data');
    const highlightWindSpeedEl = document.getElementById('highlight-wind-speed-data');
    const highlightGustEl = document.getElementById('highlight-gust-data');
    const windArrowEl = document.getElementById('wind-arrow'); 
    const gustInfoContainer = document.getElementById('gust-info-container'); // ID PARA LA RACHA
    
    const verdictCardEl = document.getElementById('verdict-card');
    const verdictDataEl = document.getElementById('verdict-data');
    const stabilityCardEl = document.getElementById('stability-card');
    const stabilityDataEl = document.getElementById('stability-data');

    function convertDegreesToCardinal(degrees) {
        if (degrees === null || isNaN(degrees)) return 'N/A';
        const val = Math.floor((degrees / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
        return arr[val % 16];
    }

    function calculateGustFactor(speed, gust) {
        if (!speed || !gust || speed <= 0) return { factor: null, text: 'N/A', color: ['bg-gray-100', 'border-gray-300'] };
        if (speed < 12) return { factor: null, text: 'No Aplica', color: ['bg-gray-100', 'border-gray-300'] };
        if (gust <= speed) return { factor: 0, text: 'Ultra Estable', color: ['bg-green-400', 'border-green-600'] };
        const factor = (1 - (speed / gust)) * 100;
        if (factor <= 15) return { factor, text: 'Estable', color: ['bg-green-300', 'border-green-500'] };
        if (factor <= 30) return { factor, text: 'Racheado', color: ['bg-yellow-300', 'border-yellow-500'] };
        return { factor, text: 'Muy Racheado', color: ['bg-red-400', 'border-red-600'] };
    }
    
    function getSpotVerdict(speed, gust, degrees) {
        if (degrees !== null && (degrees > 292.5 || degrees <= 67.5)) return ["¡PELIGRO! OFFSHORE", ['bg-red-400', 'border-red-600']];
        if (!speed) return ["Calculando...", ['bg-gray-100', 'border-gray-300']];
        if (speed <= 14) return ["FLOJO...", ['bg-blue-200', 'border-blue-400']];
        if (speed <= 18) return ["¡IDEAL!", ['bg-green-300', 'border-green-500']];
        if (speed <= 22) return ["¡MUY BUENO!", ['bg-yellow-300', 'border-yellow-500']];
        if (speed <= 27) return ["¡FUERTE!", ['bg-orange-300', 'border-orange-500']];
        if (speed > 33) return ["¡DEMASIADO!", ['bg-purple-400', 'border-purple-600']];
        return ["¡MUY FUERTE!", ['bg-red-400', 'border-red-600']];
    }

    const allColorClasses = [
        'bg-gray-100', 'border-gray-300', 'bg-blue-200', 'border-blue-400', 'bg-green-300', 'border-green-500',
        'bg-yellow-300', 'border-yellow-500', 'bg-orange-300', 'border-orange-500', 'bg-red-400', 'border-red-600',
        'bg-purple-400', 'border-purple-600', 'text-red-600', 'text-green-600', 'text-yellow-600', 'text-gray-900',
        'bg-green-400', 'border-green-600', 'bg-gray-50', 'bg-white/30'
    ];

    function updateCardColors(element, newClasses) {
        if (!element) return;
        element.classList.remove(...allColorClasses);
        element.classList.add(...newClasses);
    }

    function getWindyColorClasses(speed) {
        if (speed !== null && !isNaN(speed)) {
            if (speed <= 10) return ['bg-blue-200', 'border-blue-400']; 
            if (speed <= 16) return ['bg-green-300', 'border-green-500']; 
            if (speed <= 21) return ['bg-yellow-300', 'border-yellow-500']; 
            if (speed <= 27) return ['bg-orange-300', 'border-orange-500']; 
            if (speed <= 33) return ['bg-red-400', 'border-red-600']; 
            return ['bg-purple-400', 'border-purple-600']; 
        }
        return ['bg-gray-100', 'border-gray-300']; 
    }
    
    async function fetchWeatherData() {
        const skels = document.querySelectorAll('.skeleton-loader');
        const contents = document.querySelectorAll('.data-content');
        skels.forEach(s => s.style.display = 'block');
        contents.forEach(c => c.style.display = 'none');
        if(lastUpdatedEl) lastUpdatedEl.textContent = 'Actualizando...';
        errorEl.classList.add('hidden');

        try {
            const res = await fetch(weatherApiUrl);
            const json = await res.json();
            if (json.code === 0 && json.data) {
                const d = json.data;
                const windSpeed = d.wind?.wind_speed?.value ? parseFloat(d.wind.wind_speed.value) : null;
                const windGust = d.wind?.wind_gust?.value ? parseFloat(d.wind.wind_gust.value) : null;
                const windDir = d.wind?.wind_direction?.value ? parseFloat(d.wind.wind_direction.value) : null;
                
                const [vText, vColors] = getSpotVerdict(windSpeed, windGust, windDir);
                updateCardColors(verdictCardEl, vColors);
                if(verdictDataEl) verdictDataEl.textContent = vText;

                if (windArrowEl && windDir !== null) {
                    windArrowEl.style.transform = `rotate(${windDir}deg)`;
                    // Color flecha
                    const isOff = (windDir > 292.5 || windDir <= 67.5);
                    const isCross = (windDir > 67.5 && windDir <= 112.5) || (windDir > 247.5 && windDir <= 292.5);
                    windArrowEl.classList.remove('text-red-600', 'text-green-600', 'text-yellow-600', 'text-gray-900');
                    if (isOff) windArrowEl.classList.add('text-red-600');
                    else if (isCross) windArrowEl.classList.add('text-yellow-600');
                    else windArrowEl.classList.add('text-green-600');
                }

                // COLOR TARJETA UNIFICADA
                updateCardColors(windHighlightCard, ['bg-gray-100', 'border-gray-300']); 
                updateCardColors(unifiedWindDataCardEl, getWindyColorClasses(windSpeed));
                if (gustInfoContainer) {
                    updateCardColors(gustInfoContainer, getWindyColorClasses(windGust));
                }

                if(highlightWindSpeedEl) highlightWindSpeedEl.textContent = windSpeed ?? 'N/A';
                if(highlightGustEl) highlightGustEl.textContent = windGust ?? 'N/A';
                if(highlightWindDirEl) highlightWindDirEl.textContent = convertDegreesToCardinal(windDir);

                // Otros datos
                if(tempEl) tempEl.textContent = d.outdoor?.temperature?.value + ' ' + d.outdoor?.temperature?.unit || '--';
                if(humidityEl) humidityEl.textContent = d.outdoor?.humidity?.value + '%' || '--';
                if(pressureEl) pressureEl.textContent = d.pressure?.relative?.value + ' hPa' || '--';
                if(rainfallDailyEl) rainfallDailyEl.textContent = d.rainfall?.daily?.value + ' mm' || '--';
                if(uviEl) uviEl.textContent = d.solar_and_uvi?.uvi?.value || '--';

                // Estabilidad
                const stab = calculateGustFactor(windSpeed, windGust);
                if(stabilityCardEl) updateCardColors(stabilityCardEl, stab.color);
                if(stabilityDataEl) stabilityDataEl.textContent = stab.text;

                skels.forEach(s => s.style.display = 'none');
                contents.forEach(c => c.style.display = 'block');
                if(lastUpdatedEl) lastUpdatedEl.textContent = 'Actualizado: ' + new Date().toLocaleTimeString();
            }
        } catch (e) {
            console.error(e);
            errorEl.classList.remove('hidden');
            if(lastUpdatedEl) lastUpdatedEl.textContent = 'Error de conexión';
        }
    }
    
    fetchWeatherData();
    setInterval(fetchWeatherData, 30000);
});