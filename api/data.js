// Función Serverless Mejorada para proxy de la API de Ecowitt (Vercel)
// Proxy optimizado con caché, validación y manejo robusto de errores

// CONFIGURACIÓN DE LA API ECOWITT
const ECOWITT_URL = 'https://api.ecowitt.net/api/v3/device/real_time';
const APPLICATION_KEY = '515398061FDA504607F0329996375FC2';
const API_KEY = '2b181909-3bd1-4a8f-8cf1-91cb95e75ff5';
const MAC_ADDRESS = 'C8:C9:A3:1C:0D:E5';

// URL completa con unidades configuradas para Argentina
const FULL_API_URL = `${ECOWITT_URL}?application_key=${APPLICATION_KEY}&api_key=${API_KEY}&mac=${MAC_ADDRESS}&call_back=all&temp_unitid=1&pressure_unitid=3&wind_speed_unitid=8&rainfall_unitid=12&solar_irradiance_unitid=14&capacity_unitid=25`;

// Configuración de caché y timeouts
const CACHE_DURATION = 30 * 1000; // 30 segundos
const REQUEST_TIMEOUT = 10 * 1000; // 10 segundos
const MAX_RETRIES = 2;

// Cache en memoria simple (se resetea con cada deploy)
let cache = {
    data: null,
    timestamp: 0
};

// Función para validar datos de respuesta
function validateWeatherData(data) {
    if (!data || typeof data !== 'object') {
        return false;
    }
    
    // Verificar estructura básica esperada
    if (data.code !== undefined && data.msg !== undefined) {
        return true;
    }
    
    return false;
}

// Función para crear respuesta de error consistente
function createErrorResponse(message, statusCode = 500, originalError = null) {
    const errorResponse = {
        code: -1,
        msg: "error",
        error: message,
        timestamp: new Date().toISOString(),
        source: "la-bajada-api"
    };
    
    if (originalError && process.env.NODE_ENV === 'development') {
        errorResponse.debug = originalError.message;
    }
    
    return { response: errorResponse, status: statusCode };
}

// Función para realizar petición con timeout y reintentos
async function fetchWithRetry(url, options = {}, retries = MAX_RETRIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'LaBajada-Kitesurf-Dashboard-v3.9.3',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                ...options.headers
            }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return response;
        
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (retries > 0 && (error.name === 'AbortError' || error.message.includes('fetch'))) {
            console.warn(`Reintentando petición... Intentos restantes: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo
            return fetchWithRetry(url, options, retries - 1);
        }
        
        throw error;
    }
}

// Función principal del handler
export default async function handler(req, res) {
    // Configurar CORS para el frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=30'); // Cache de 30 segundos
    
    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Solo permitir GET
    if (req.method !== 'GET') {
        const { response, status } = createErrorResponse('Método no permitido. Solo GET.', 405);
        return res.status(status).json(response);
    }
    
    try {
        const now = Date.now();
        
        // Verificar caché
        if (cache.data && (now - cache.timestamp) < CACHE_DURATION) {
            console.log('📦 Devolviendo datos desde caché');
            return res.status(200).json({
                ...cache.data,
                cached: true,
                cache_age: Math.floor((now - cache.timestamp) / 1000)
            });
        }
        
        console.log('🌐 Obteniendo datos frescos de Ecowitt...');
        
        // Realizar petición a Ecowitt
        const response = await fetchWithRetry(FULL_API_URL);
        const data = await response.json();
        
        // Validar datos recibidos
        if (!validateWeatherData(data)) {
            throw new Error('Datos inválidos recibidos de Ecowitt');
        }
        
        // Agregar metadatos útiles
        const enrichedData = {
            ...data,
            timestamp: new Date().toISOString(),
            source: 'ecowitt-api',
            location: 'Claromecó, Buenos Aires, Argentina',
            spot: 'La Bajada',
            cached: false
        };
        
        // Actualizar caché
        cache = {
            data: enrichedData,
            timestamp: now
        };
        
        console.log('✅ Datos obtenidos y cacheados exitosamente');
        
        // Devolver respuesta exitosa
        res.status(200).json(enrichedData);
        
    } catch (error) {
        console.error('❌ Error en API de datos climáticos:', error);
        
        // Si hay datos en caché (aunque sean viejos), devolverlos como fallback
        if (cache.data) {
            console.log('⚠️ Devolviendo datos de caché como fallback');
            return res.status(200).json({
                ...cache.data,
                cached: true,
                stale: true,
                cache_age: Math.floor((Date.now() - cache.timestamp) / 1000),
                warning: 'Datos de caché debido a error en API'
            });
        }
        
        // Crear respuesta de error apropiada
        let errorMessage = 'Error interno del servidor al obtener datos climáticos';
        let statusCode = 500;
        
        if (error.message.includes('HTTP 4')) {
            errorMessage = 'Error de autenticación con la API de Ecowitt';
            statusCode = 502;
        } else if (error.name === 'AbortError') {
            errorMessage = 'Timeout al conectar con la API de Ecowitt';
            statusCode = 504;
        } else if (error.message.includes('fetch')) {
            errorMessage = 'Error de conexión con la API de Ecowitt';
            statusCode = 502;
        }
        
        const { response, status } = createErrorResponse(errorMessage, statusCode, error);
        res.status(status).json(response);
    }
}

// Función para limpiar caché (útil para debugging)
export function clearCache() {
    cache = { data: null, timestamp: 0 };
    console.log('🗑️ Caché limpiado');
}