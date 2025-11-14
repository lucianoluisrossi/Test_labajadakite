// app.js

// NOTA: Las líneas de import/inject de Vercel Analytics están eliminadas de aquí
// para evitar el error de sintaxis del navegador. Se inyectan via CDN en index.html.

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

    // --- URLs de las Funciones Serverless (Proxy) ---
    const weatherApiUrl = 'api/data';
    const windyApiUrl = 'api/windy'; // Usaremos esta para la Ventana Optima

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
    const verdictDataLoaderEl = document.getElementById('verdict-data-loader');

    // --- ELEMENTOS DEL DOM (Ventana Optima) ---
    const optimalWindowLoader = document.getElementById('optimal-window-loader');
    const optimalWindowContainer = document.getElementById('optimal-window-container');
    const optimalWindowError = document.getElementById('optimal-window-error');
    

    // --- MEJORA UX: IDs de todos los Skeletons y Contenidos ---
    const skeletonLoaderIds = [
        'verdict-data-loader',
        'highlight-wind-dir-data-loader', 'highlight-wind-speed-data-loader', 'highlight-gust-data-loader',
        'temp-data-loader', 'humidity-data-loader', 'pressure-data-loader', 
        'rainfall-daily-data-loader', 'uvi-data-loader'
    ];
    const dataContentIds = [
        'verdict-data',
        'highlight-wind-dir-data', 'highlight-wind-speed-data', 'highlight-gust-data',
        'temp-data', 'humidity-data', 'pressure-data',
        'rainfall-daily-data', 'uvi-data'
    ];

    // --- MEJORA UX: Variable para "Time Ago" ---
    let lastUpdateTime = null;

    // --- MEJORA UX: Función para mostrar/ocultar Skeletons ---
    function showSkeletons(isLoading) {
        // Manejar skeletons de datos principales
        skeletonLoaderIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = isLoading ? 'block' : 'none';
        });
        dataContentIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = isLoading ? 'none' : 'block';
        });

        if (isLoading) {
            if (lastUpdatedEl) lastUpdatedEl.textContent = 'Actualizando datos...';
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
    
    // --- FUNCIÓN DE VEREDICTO (Lógica de Seguridad de Viento y Potencia) ---
    function getSpotVerdict(speed, gust, degrees) {
        // Esta función devuelve [texto, [claseFondo, claseBorde]]
        
        // 1. Chequeo de Peligro (Offshore) - Lógica Corregida
        if (degrees !== null) {
            // Rango de Peligro (N, NNE, NE, ENE, NO, NNO, ONO)
            if ((degrees > 292.5 || degrees <= 67.5)) { 
                return ["¡PELIGRO! VIENTO OFFSHORE", ['bg-red-400', 'border-red-600']];
            }
        }
        
        // 2. Chequeo de Viento (basado en 'speed')
        if (speed === null) {
            return ["Calculando...", ['bg-gray-100', 'border-gray-300']];
        }
        // 3. Chequeo de Viento Navegable
        if (speed <= 14) {
            return ["FLOJO...", ['bg-blue-200', 'border-blue-400']];
        } else if (speed <= 18) {
            return ["¡IDEAL!", ['bg-green-300', 'border-green-500']];
        } else if (speed <= 22) {
            return ["¡MUY BUENO!", ['bg-yellow-300', 'border-yellow-500']];
        } else if (speed <= 27) {
            return ["¡FUERTE!", ['bg-orange-300', 'border-orange-500']];
        } else { // > 27
            if (speed > 33) {
                return ["¡DEMASIADO FUERTE!", ['bg-purple-400', 'border-purple-600']];
            } else {
                return ["¡MUY FUERTE!", ['bg-red-400', 'border-red-600']];
            }
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
        // Clases de flecha
        'text-red-600', 'text-green-600', 'text-yellow-600', 'text-gray-900'
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
            if (speedInKnots <= 10) {
                return ['bg-blue-200', 'border-blue-400']; // Azul (Flojo)
            } else if (speedInKnots <= 16) {
                return ['bg-green-300', 'border-green-500']; // Verde (Ideal/Medio)
            } else if (speedInKnots <= 21) {
                return ['bg-yellow-300', 'border-yellow-500']; // Amarillo (Bueno/Fuerte)
            } else if (speedInKnots <= 27) {
                return ['bg-orange-300', 'border-orange-500']; // Naranja (Fuerte)
            } else if (speedInKnots <= 33) {
                return ['bg-red-400', 'border-red-600']; // Rojo (Muy Fuerte)
            } else {
                return ['bg-purple-400', 'border-purple-600']; // Púrpura (Demasiado Fuerte)
            }
        }
        return ['bg-gray-100', 'border-gray-300']; // Default (Gris)
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
                } catch (e) {
                    // No era JSON, usar el texto plano
                }
                throw new Error(errorText);
            }
            return response.json();
        } catch (error) {
            if (retries > 0) {
                await new Promise(res => setTimeout(res, delay));
                return fetchWithBackoff(url, options, retries - 1, delay * 2);
            }
            throw error; // Lanzar el error final
        }
    }

    // --- Funciones de Ayuda de Windy (Convertir vectores U/V a Knots/Degrees) ---
    function convertUVtoKnots(u, v) {
        // (m/s * 1.94384) = knots
        return Math.sqrt(u * u + v * v) * 1.94384;
    }
    function convertUVtoDegrees(u, v) {
        // Dirección meteorológica (de dónde viene el viento)
        let degrees = (Math.atan2(u, v) * (180 / Math.PI)) + 180;
        return (degrees + 360) % 360; // Asegurar 0-360
    }
    
    // --- NUEVA FUNCIÓN: RENDERIZAR LA VENTANA ÓPTIMA ---
    function renderOptimalWindow(forecastData) {
        if (!forecastData || !forecastData['wind_u-surface']) {
            optimalWindowError.textContent = "Datos de pronóstico incompletos.";
            optimalWindowError.classList.remove('hidden');
            return;
        }

        const u = forecastData['wind_u-surface'];
        const v = forecastData['wind_v-surface'];
        const times = forecastData.times; // Array de timestamps (en minutos desde 1970)

        const hoursToDisplay = 8;
        let html = '';

        // El pronóstico de Windy trae un punto de datos cada 3 horas (usaremos 8 puntos = 24h)
        for (let i = 0; i < hoursToDisplay; i++) {
            if (i >= u.length) break; // Parar si no hay más datos

            const speedKnots = convertUVtoKnots(u[i], v[i]);
            const directionDegrees = convertUVtoDegrees(u[i], v[i]);
            const cardinal = convertDegreesToCardinal(directionDegrees);

            // Determinar color de fondo y borde según la lógica de fuerza de viento
            const [verdictText, verdictClasses] = getSpotVerdict(speedKnots, null, directionDegrees);
            
            // Extraer solo la clase de fondo (bg-...) y la clase de borde (border-...)
            const bgClass = verdictClasses.find(c => c.startsWith('bg-'));
            const borderClass = verdictClasses.find(c => c.startsWith('border-'));

            // Convertir el timestamp (minutos desde 1970) a un objeto Date
            const date = new Date(times[i] * 1000); // Convertir a milisegundos
            const hour = date.getHours().toString().padStart(2, '0');
            const minutes = date.getMinutes().toString().padStart(2, '0');

            html += `
                <div class="p-2 ${bgClass} ${borderClass} rounded-lg flex flex-col justify-between text-center shadow-md border">
                    <p class="text-xs font-bold text-gray-900">${hour}:${minutes}</p>
                    <p class="text-lg font-extrabold text-gray-900">${Math.round(speedKnots)} kts</p>
                    <p class="text-xs text-gray-700">${cardinal}</p>
                </div>
            `;
        }

        optimalWindowContainer.innerHTML = html;
        optimalWindowContainer.classList.remove('data-content');
    }


    // --- NUEVA FUNCIÓN: OBTENER PRONÓSTICO PARA VENTANA ÓPTIMA (WINDY) ---
    async function fetchOptimalWindow() {
        optimalWindowLoader.style.display = 'flex';
        optimalWindowContainer.classList.add('data-content');
        optimalWindowError.classList.add('hidden');

        try {
            // Coordenadas de Claromecó (hardcodeadas aquí para la función)
            const LAT = -38.860571; 
            const LON = -60.079501;
            
            const windyPayload = {
                lat: LAT,
                lon: LON,
                model: "gfs", // Un buen modelo global
                // Pedimos viento (u-v vectors) y el array de tiempos
                parameters: ["wind"], 
                levels: ["surface"],
                // Solicitamos 8 pasos de pronóstico, que por defecto son 3 horas cada uno (24h)
                hours: 8 
            };
            
            const windyData = await fetchWithBackoff(windyApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(windyPayload)
            });

            // Procesar y renderizar los datos
            renderOptimalWindow(windyData);

        } catch (error) {
            console.error('Error al obtener el pronóstico de la ventana:', error);
            optimalWindowError.textContent = `Error: ${error.message}`;
            optimalWindowError.classList.remove('hidden');

        } finally {
            optimalWindowLoader.style.display = 'none';
        }
    }
    
    // --- FUNCIÓN: OBTENER DATOS DEL CLIMA (ECOWITT) ---
    async function fetchWeatherData() {
        // ... (El resto de tu función fetchWeatherData permanece igual) ...
        // ... (Se ha omitido aquí por brevedad, pero debe estar completo en tu app.js) ...
        
        // --- FUNCIÓN: OBTENER DATOS DEL CLIMA (ECOWITT) ---
        // Pegar el contenido completo de tu fetchWeatherData() AQUÍ
        // ... (Tu código de fetchWeatherData) ...
        
        showSkeletons(true); // MEJORA UX: Mostrar skeletons
        errorEl.classList.add('hidden'); // Ocultar error antiguo

        let windSpeedValue = null; 
        let windGustValue = null; 
        let windDirDegrees = null;
        let tempValue = null;

        try {
            const json = await fetchWithBackoff(weatherApiUrl, {});

            if (json.code === 0 && json.data) {
                const data = json.data;
                
                // Extracción de datos
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
                
                // ** LÓGICA DE VIENTO **
                windSpeedValue = (windSpeed && windSpeed.value !== null) ? parseFloat(windSpeed.value) : null;
                windGustValue = (windGust && windGust.value !== null) ? parseFloat(windGust.value) : null; 
                windDirDegrees = (windDir && windDir.value !== null) ? parseFloat(windDir.value) : null;
                tempValue = (temp && temp.value !== null) ? parseFloat(temp.value) : null;
                const windDirCardinal = windDirDegrees !== null ? convertDegreesToCardinal(windDirDegrees) : 'N/A';
                
                // --- (LÓGICA DE VEREDICTO SIMPLE) ---
                const [verdictText, verdictColors] = getSpotVerdict(windSpeedValue, windGustValue, windDirDegrees);
                
                // 1. Asignar el color de la tarjeta de veredicto
                updateCardColors(verdictCardEl, verdictColors);
                // 2. Asignar el texto de veredicto
                verdictDataEl.textContent = verdictText;
                
                // MEJORA UX: Aplicar rotación Y COLOR (Red/Yellow/Green) a la flecha
                if (windArrowEl && windDirDegrees !== null) {
                    windArrowEl.style.transform = `rotate(${windDirDegrees}deg)`;
                    
                    // Lógica de color de flecha MEJORADA
                    const isOffshore = (windDirDegrees > 292.5 || windDirDegrees <= 67.5);
                    const isCross = (windDirDegrees > 67.5 && windDirDegrees <= 112.5) || (windDirDegrees > 247.5 && windDirDegrees <= 292.5);
                    const isOnshore = !isOffshore && !isCross;

                    windArrowEl.classList.remove('text-red-600', 'text-green-600', 'text-yellow-600', 'text-gray-900');
                    if (isOffshore) {
                        windArrowEl.classList.add('text-red-600');
                    } else if (isCross) {
                        windArrowEl.classList.add('text-yellow-600');
                    } else if (isOnshore) {
                        windArrowEl.classList.add('text-green-600');
                    } else {
                         windArrowEl.classList.add('text-gray-900');
                    }
                } else if (windArrowEl) {
                    windArrowEl.classList.remove('text-red-600', 'text-green-600', 'text-yellow-600');
                    windArrowEl.classList.add('text-gray-900');
                }

                // Aplicar clase de color al card de viento PRINCIPAL (Neutral)
                updateCardColors(windHighlightCard, getMainCardColorClasses(windSpeedValue));
                // Aplicar clase de color a la SUB-TARJETA de velocidad (Lógica Windy)
                updateCardColors(windSpeedSubCardEl, getWindyColorClasses(windSpeedValue));
                // Aplicar clase de color a la SUB-TARJETA de ráfaga (Lógica Windy)
                updateCardColors(windGustSubCardEl, getWindyColorClasses(windGustValue));

                // Actualizar UI del card de viento
                highlightWindSpeedEl.textContent = windSpeed ? `${windSpeed.value} ${windSpeed.unit}` : 'N/A';
                highlightGustEl.textContent = windGust ? `${windGust.value} ${windGust.unit}` : 'N/A';
                highlightWindDirEl.textContent = windDirCardinal; 

                // Actualizar UI de datos generales
                tempEl.textContent = temp ? `${temp.value} ${temp.unit}` : 'N/A';
                humidityEl.textContent = humidity ? `${humidity.value} ${humidity.unit}` : 'N/A';
                pressureEl.textContent = pressureRel ? `${pressureRel.value} ${pressureRel.unit}` : 'N/A'; 
                rainfallDailyEl.textContent = rainfallDaily ? `${rainfallDaily.value} ${rainfallDaily.unit}` : 'N/A'; 
                uviEl.textContent = uvi ? uvi.value : 'N/A'; 
                
                showSkeletons(false); // Ocultar skeletons
                
                lastUpdateTime = new Date(); // Registrar tiempo
                updateTimeAgo(); // Actualizar "Time Ago"

            } else {
                throw new Error(json.msg || 'Formato de datos incorrecto de la fuente.');
            }
        } catch (error) {
            console.error('Error al obtener datos del clima:', error);
            
            errorEl.textContent = `Error: No se pudieron cargar los datos. (${error.message})`;
            errorEl.classList.remove('hidden');
            
            showSkeletons(false);
            
            // Resetear UI a N/A y colores a Error
            updateCardColors(verdictCardEl, ['bg-red-400', 'border-red-600']);
            verdictDataEl.textContent = 'Error en API (Ecowitt)';
            
            if (lastUpdatedEl) lastUpdatedEl.textContent = "Error en la actualización.";
        }
    }
    
    // --- INICIALIZACIÓN ---
    
    // Cargar datos del clima al iniciar
    fetchWeatherData();
    // Cargar la nueva Ventana Optima al iniciar
    fetchOptimalWindow();

    // Actualizar datos cada 30 segundos (30000ms)
    setInterval(fetchWeatherData, 30000);
    // La Ventana Óptima se actualiza menos frecuente ya que es un PRONÓSTICO (cada 5 minutos)
    setInterval(fetchOptimalWindow, 300000); // 5 minutos = 300,000 ms 
    
    // MEJORA UX: Actualizar el "Time Ago" cada 5 segundos
    setInterval(updateTimeAgo, 5000);
});