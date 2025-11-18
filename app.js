// app.js

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Registro del Service Worker (PWA) ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js') 
                .then(registration => {
                    console.log('Service Worker: Instalado y registrado con éxito', registration);
                })
                .catch(error => {
                    console.log('Error al registrar el Service Worker:', error);
                });
        });
    }

    // --- LÓGICA DEL MENÚ HAMBURGUESA (IMPRESCINDIBLE PARA ABRIRLO) ---
    const menuButton = document.getElementById('menu-button');
    const menuCloseButton = document.getElementById('menu-close-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuBackdrop = document.getElementById('menu-backdrop');

    function toggleMenu() {
        if (!mobileMenu) return;
        const isClosed = mobileMenu.classList.contains('translate-x-full');
        if (isClosed) {
            mobileMenu.classList.remove('translate-x-full');
            if(menuBackdrop) menuBackdrop.classList.remove('hidden');
        } else {
            mobileMenu.classList.add('translate-x-full');
            if(menuBackdrop) menuBackdrop.classList.add('hidden');
        }
    }

    if (menuButton) {
        menuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
    }
    if (menuCloseButton) {
        menuCloseButton.addEventListener('click', toggleMenu);
    }
    if (menuBackdrop) {
        menuBackdrop.addEventListener('click', toggleMenu);
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
    const highlightWindDirEl = document.getElementById('highlight-wind-dir-data');
    const highlightWindSpeedEl = document.getElementById('highlight-wind-speed-data');
    const highlightGustEl = document.getElementById('highlight-gust-data');
    const windArrowEl = document.getElementById('wind-arrow'); 
    const windSpeedSubCardEl = document.getElementById('wind-speed-sub-card'); 
    const windGustSubCardEl = document.getElementById('wind-gust-sub-card'); 
    
    // --- ELEMENTOS DEL DOM (Veredicto EN VIVO) ---
    const verdictCardEl = document.getElementById('verdict-card');
    const verdictDataEl = document.getElementById('verdict-data');
    
    // --- ELEMENTOS DEL DOM (ESTABILIDAD) ---
    const stabilityCardEl = document.getElementById('stability-card');
    const stabilityDataEl = document.getElementById('stability-data');
    
    // --- MEJORA UX: IDs de todos los Skeletons y Contenidos ---
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

    // --- MEJORA UX: Variable para "Time Ago" ---
    let lastUpdateTime = null;

    // --- MEJORA UX: Función para mostrar/ocultar Skeletons ---
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
    
    // --- MEJORA UX: Función para actualizar "Time Ago" ---
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

    // --- FUNCIÓN: CONVERTIR GRADOS A PUNTO CARDINAL ---
    function convertDegreesToCardinal(degrees) {
        if (degrees === null || isNaN(degrees)) return 'N/A';
        const val = Math.floor((degrees / 22.5) + 0.5);
        const arr = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
        return arr[val % 16];
    }

    // --- FUNCIÓN: CALCULAR ÍNDICE DE ESTABILIDAD (Gust Factor) ---
    function calculateGustFactor(speed, gust) {
        if (speed === null || gust === null || speed <= 0) {
            return { factor: null, text: 'N/A', color: ['bg-gray-100', 'border-gray-300'] };
        }
        const MIN_KITE_WIND = 12; 
        if (speed < MIN_KITE_WIND) {
             return { factor: null, text: '< 12kts (No Aplica)', color: ['bg-gray-100', 'border-gray-300'] };
        }
        if (gust <= speed) {
             return { factor: 100, text: 'Ultra Estable', color: ['bg-green-400', 'border-green-600'] };
        }
        const factor = (speed / gust) * 100; 
        if (factor >= 85) {
            return { factor, text: 'Estable', color: ['bg-green-300', 'border-green-500'] }; 
        } else if (factor >= 70) {
            return { factor, text: 'Racheado', color: ['bg-yellow-300', 'border-yellow-500'] }; 
        } else {
            return { factor, text: 'Muy Racheado', color: ['bg-red-400', 'border-red-600'] }; 
        }
    }
    
    // --- FUNCIÓN DE VEREDICTO (Lógica de Seguridad de Viento y Potencia) ---
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

    // --- CONSTANTES DE CLASES DE COLOR ---
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

    // --- FUNCIÓN DE UTILIDAD: Para actualizar colores de tarjetas ---
    function updateCardColors(element, newClasses) {
        if (!element) return;
        element.classList.remove(...allColorClasses);
        element.classList.add(...newClasses);
    }

    // --- FUNCIÓN: Obtener clases de color para TARJETA PRINCIPAL (Neutral) ---
    function getMainCardColorClasses(speedInKnots) {
        return ['bg-gray-100', 'border-gray-300'];
    }

    // --- FUNCIÓN: Obtener clases de color para SUB-TARJETA (Lógica Windy) ---
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
    
    // --- FUNCIÓN DE UTILIDAD: Fetch con Reintentos (Exponential Backoff) ---
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
    
    // --- FUNCIÓN: OBTENER DATOS DEL CLIMA (ECOWITT) ---
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
                
                // --- CALCULAR ESTABILIDAD (Gust Factor) ---
                const stability = calculateGustFactor(windSpeedValue, windGustValue);
                if (stabilityCardEl) {
                    updateCardColors(stabilityCardEl, stability.color);
                    stabilityDataEl.textContent = stability.factor !== null 
                        ? `${Math.round(stability.factor)}% - ${stability.text}` 
                        : stability.text; 
                }
                
                // --- (LÓGICA DE VEREDICTO SIMPLE) ---
                const [verdictText, verdictColors] = getSpotVerdict(windSpeedValue, windGustValue, windDirDegrees);
                updateCardColors(verdictCardEl, verdictColors);
                verdictDataEl.textContent = verdictText;
                
                // MEJORA UX: Aplicar rotación Y COLOR a la flecha
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
                updateCardColors(windSpeedSubCardEl, getWindyColorClasses(windSpeedValue));
                updateCardColors(windGustSubCardEl, getWindyColorClasses(windGustValue));

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
    
    // --- INICIALIZACIÓN ---
    fetchWeatherData();
    setInterval(fetchWeatherData, 30000);
    setInterval(updateTimeAgo, 5000);
});