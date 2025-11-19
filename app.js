// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
let storage; 
let messagesCollection;
let galleryCollection; 

try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app); 
    messagesCollection = collection(db, "kiter_board");
    galleryCollection = collection(db, "daily_gallery_meta"); 
    console.log("✅ Firebase (DB + Storage) inicializado.");
} catch (e) {
    console.error("❌ Error crítico inicializando Firebase:", e);
}

document.addEventListener('DOMContentLoaded', () => {
    
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js').catch(console.error);
        });
    }

    // --- ELEMENTOS DE NAVEGACIÓN Y VISTAS ---
    const viewDashboard = document.getElementById('view-dashboard');
    const viewCommunity = document.getElementById('view-community');
    
    // Botones de navegación
    const navHomeBtn = document.getElementById('nav-home');
    const btnPizarraMenu = document.getElementById('btn-pizarra-menu');
    const backToHomeBtn = document.getElementById('back-to-home');
    const fabCommunity = document.getElementById('fab-community');
    const newMessageToast = document.getElementById('new-message-toast');

    // Menú Lateral
    const menuButton = document.getElementById('menu-button');
    const menuCloseButton = document.getElementById('menu-close-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuBackdrop = document.getElementById('menu-backdrop');

    // --- LÓGICA DE CAMBIO DE VISTA (SPA) ---
    function switchView(viewName) {
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (viewName === 'dashboard') {
            viewDashboard.classList.remove('hidden');
            viewCommunity.classList.add('hidden');
            if(fabCommunity) fabCommunity.classList.remove('hidden'); // Mostrar botón flotante en home
        } else {
            // Vista Comunidad
            viewDashboard.classList.add('hidden');
            viewCommunity.classList.remove('hidden');
            if(fabCommunity) fabCommunity.classList.add('hidden'); // Ocultar botón flotante en comunidad
            
            markMessagesAsRead(); // Marcar mensajes como leídos al entrar
        }

        // Cerrar menú si está abierto (verificando si NO tiene la clase de oculto)
        if (mobileMenu && !mobileMenu.classList.contains('-translate-x-full')) {
            toggleMenu();
        }
    }

    // --- LÓGICA DEL MENÚ HAMBURGUESA ---
    function toggleMenu() {
        // Nota: Usamos '-translate-x-full' (negativo) porque el menú está a la izquierda
        if (mobileMenu.classList.contains('-translate-x-full')) {
            mobileMenu.classList.remove('-translate-x-full'); 
            menuBackdrop.classList.remove('hidden'); 
        } else {
            mobileMenu.classList.add('-translate-x-full'); 
            menuBackdrop.classList.add('hidden'); 
        }
    }

    // Asignar eventos de navegación
    if (navHomeBtn) navHomeBtn.addEventListener('click', () => switchView('dashboard'));
    if (backToHomeBtn) backToHomeBtn.addEventListener('click', () => switchView('dashboard'));
    
    if (btnPizarraMenu) btnPizarraMenu.addEventListener('click', () => switchView('community'));
    if (fabCommunity) fabCommunity.addEventListener('click', () => switchView('community'));
    if (newMessageToast) newMessageToast.addEventListener('click', () => switchView('community'));

    // Asignar eventos de menú
    if (menuButton) menuButton.addEventListener('click', toggleMenu);
    if (menuCloseButton) menuCloseButton.addEventListener('click', toggleMenu);
    if (menuBackdrop) menuBackdrop.addEventListener('click', toggleMenu);


    // --- FUNCIÓN DE COMPRESIÓN DE IMÁGENES ---
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

                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', QUALITY);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    // --- LÓGICA GALERÍA DEL DÍA ---
    const galleryUploadInput = document.getElementById('gallery-upload-input');
    const galleryGrid = document.getElementById('gallery-grid');
    const imageModal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');

    const handleGalleryUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert("Solo se permiten imágenes.");
            return;
        }

        const parent = e.target.parentElement;
        // Guardar contenido original para restaurar
        const originalContent = parent.innerHTML;
        
        // Feedback visual
        parent.innerHTML = `<span class="animate-pulse">Subiendo...</span>`;
        
        try {
            const compressedBlob = await compressImage(file);
            const fileName = `gallery/${Date.now()}_${Math.floor(Math.random()*1000)}.jpg`;
            const storageRef = ref(storage, fileName);
            
            await uploadBytes(storageRef, compressedBlob);
            const downloadURL = await getDownloadURL(storageRef);

            await addDoc(galleryCollection, {
                url: downloadURL,
                path: fileName,
                timestamp: serverTimestamp()
            });

            // Opcional: alert("Foto subida"); 

        } catch (error) {
            console.error("Error subiendo foto:", error);
            alert("Error al subir la foto.");
        } finally {
            // Restaurar botón original para permitir nueva subida
            // Nota: Es importante restaurar la estructura exacta que espera el CSS/HTML
            parent.innerHTML = `
                <span class="hidden md:inline">Subir Foto</span>
                <span class="md:hidden">Subir</span>
                <input type="file" id="gallery-upload-input" accept="image/*" class="hidden">
            `;
            
            // Reasignar listener al nuevo input creado
            const newInput = document.getElementById('gallery-upload-input');
            if (newInput) {
                newInput.addEventListener('change', handleGalleryUpload);
            }
        }
    };

    if (galleryUploadInput && storage && db) {
        galleryUploadInput.addEventListener('change', handleGalleryUpload);
    }

    // Renderizar Galería
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
                        imgContainer.className = "relative aspect-square cursor-pointer overflow-hidden rounded-lg shadow-md bg-gray-100 hover:opacity-90 transition-opacity";
                        imgContainer.innerHTML = `
                            <img src="${data.url}" class="w-full h-full object-cover" loading="lazy" alt="Foto">
                            <div class="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white text-[10px] px-2 py-1 rounded-tl-lg">
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
                galleryGrid.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg"><span class="text-2xl mb-2">📷</span><p>Sin fotos hoy.</p></div>';
            }
        });
    }


    // --- LÓGICA DE PIZARRA KITERA ---
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
                        div.className = "bg-gray-50 p-3 rounded border border-gray-100 text-sm mb-2";
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
                messagesContainer.innerHTML = '<p class="text-center text-gray-400 text-xs py-2">No hay mensajes recientes.</p>';
            } else {
                // Notificaciones
                if (newestMessageTime > lastReadTime && lastReadTime > 0) {
                    // Solo mostrar si NO estamos ya en la vista comunidad
                    if (viewCommunity.classList.contains('hidden')) {
                        if(newMessageToast) newMessageToast.classList.remove('hidden');
                        const badge = document.getElementById('notification-badge');
                        if(badge) badge.classList.remove('hidden');
                    } else {
                        markMessagesAsRead(); // Si estamos en comunidad, marcar como leído
                    }
                } else if (lastReadTime === 0 && newestMessageTime > 0) {
                    localStorage.setItem('lastReadTime', now);
                }
            }
        });
    }


    // --- URLs de las Funciones Serverless (Proxy) ---
    const weatherApiUrl = 'api/data';

    // --- ELEMENTOS DEL DOM (Datos) ---
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

    // Skeletons
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
        if (degrees !== null && (degrees > 292.5 || degrees <= 67.5)) return ["¡PELIGRO! OFFSHORE", ['bg-red-400', 'border-red-600']];
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
    
    async function fetchWeatherData() {
        showSkeletons(true);
        errorEl.classList.add('hidden'); 
        try {
            const json = await fetchWithBackoff(weatherApiUrl, {});
            if (json.code === 0 && json.data) {
                const data = json.data;
                const windSpeedValue = (data.wind?.wind_speed?.value) ? parseFloat(data.wind.wind_speed.value) : null;
                const windGustValue = (data.wind?.wind_gust?.value) ? parseFloat(data.wind.wind_gust.value) : null; 
                const windDirDegrees = (data.wind?.wind_direction?.value) ? parseFloat(data.wind.wind_direction.value) : null;
                
                // Veredicto
                const [verdictText, verdictColors] = getSpotVerdict(windSpeedValue, windGustValue, windDirDegrees);
                updateCardColors(verdictCardEl, verdictColors);
                verdictDataEl.textContent = verdictText;
                
                // Flecha
                if (windArrowEl && windDirDegrees !== null) {
                    windArrowEl.style.transform = `rotate(${windDirDegrees}deg)`;
                    const isOffshore = (windDirDegrees > 292.5 || windDirDegrees <= 67.5);
                    const isCross = (windDirDegrees > 67.5 && windDirDegrees <= 112.5) || (windDirDegrees > 247.5 && windDirDegrees <= 292.5);
                    windArrowEl.classList.remove('text-red-600', 'text-green-600', 'text-yellow-600', 'text-gray-900');
                    if (isOffshore) windArrowEl.classList.add('text-red-600');
                    else if (isCross) windArrowEl.classList.add('text-yellow-600');
                    else windArrowEl.classList.add('text-green-600');
                }

                // Colores Tarjetas
                updateCardColors(windHighlightCard, ['bg-gray-100', 'border-gray-300']); 
                updateCardColors(unifiedWindDataCardEl, getWindyColorClasses(windSpeedValue));
                if (gustInfoContainer) updateCardColors(gustInfoContainer, getWindyColorClasses(windGustValue));

                // Textos Viento
                highlightWindSpeedEl.textContent = windSpeedValue ?? 'N/A';
                highlightGustEl.textContent = windGustValue ?? 'N/A';
                highlightWindDirEl.textContent = convertDegreesToCardinal(windDirDegrees); 

                // Otros Datos
                tempEl.textContent = data.outdoor?.temperature?.value ? `${data.outdoor.temperature.value} ${data.outdoor.temperature.unit}` : 'N/A';
                humidityEl.textContent = data.outdoor?.humidity?.value ? `${data.outdoor.humidity.value}%` : 'N/A';
                pressureEl.textContent = data.pressure?.relative?.value ? `${data.pressure.relative.value} hPa` : 'N/A'; 
                rainfallDailyEl.textContent = data.rainfall?.daily?.value ? `${data.rainfall.daily.value} mm` : 'N/A'; 
                uviEl.textContent = data.solar_and_uvi?.uvi?.value ?? 'N/A'; 

                // Estabilidad
                const stability = calculateGustFactor(windSpeedValue, windGustValue);
                if (stabilityCardEl) updateCardColors(stabilityCardEl, stability.color);
                if (stabilityDataEl) stabilityDataEl.textContent = stability.text;
                
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
});