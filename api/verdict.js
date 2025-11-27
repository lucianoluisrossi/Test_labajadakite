// --- API Serverless Mejorada para el Veredicto de Gemini ---
// Versión optimizada con caché, validación y manejo robusto de errores

// Importar la SDK de Google
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configuración
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de caché
const REQUEST_TIMEOUT = 15 * 1000; // 15 segundos timeout
const MAX_RETRIES = 2;

// Cache en memoria para veredictos (evita llamadas repetidas)
let verdictCache = new Map();

// Función para limpiar caché viejo
function cleanOldCache() {
    const now = Date.now();
    for (const [key, value] of verdictCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            verdictCache.delete(key);
        }
    }
}

// Función para crear clave de caché
function createCacheKey(speed, gust, direction, temp) {
    return `${speed || 'null'}-${gust || 'null'}-${direction || 'null'}-${Math.round(temp || 0)}`;
}

// Función para validar datos de entrada
function validateInputData(data) {
    const { speed, gust, direction, cardinal, temp } = data;
    
    // Al menos velocidad o dirección deben estar presentes
    if (speed === null && direction === null) {
        return { valid: false, error: 'Se requiere al menos velocidad o dirección del viento' };
    }
    
    // Validar rangos razonables
    if (speed !== null && (speed < 0 || speed > 100)) {
        return { valid: false, error: 'Velocidad de viento fuera de rango válido (0-100 nudos)' };
    }
    
    if (direction !== null && (direction < 0 || direction >= 360)) {
        return { valid: false, error: 'Dirección de viento fuera de rango válido (0-359°)' };
    }
    
    if (temp !== null && (temp < -50 || temp > 60)) {
        return { valid: false, error: 'Temperatura fuera de rango válido (-50 a 60°C)' };
    }
    
    return { valid: true };
}

// Función para generar veredicto con timeout
async function generateVerdictWithTimeout(model, userQuery, timeout = REQUEST_TIMEOUT) {
    return Promise.race([
        model.generateContent(userQuery),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout en generación de veredicto')), timeout)
        )
    ]);
}

// Función para crear veredicto de fallback basado en datos
function createFallbackVerdict(speed, direction, cardinal) {
    // Verificar offshore (peligroso)
    if (direction !== null && (direction > 292.5 || direction <= 67.5)) {
        return "¡PELIGRO! VIENTO OFFSHORE";
    }
    
    // Veredictos basados en velocidad
    if (speed !== null) {
        if (speed <= 10) return "Muy flojo para navegar";
        if (speed <= 14) return "Flojo, ideal para aprender";
        if (speed <= 16) return "Aceptable para 12m";
        if (speed <= 19) return "¡Ideal para 10m!";
        if (speed <= 22) return "¡Muy bueno para 9m!";
        if (speed <= 27) return "¡Fuerte! Usar 7-8m";
        if (speed <= 33) return "¡Muy fuerte! Solo expertos";
        return "¡Demasiado fuerte!";
    }
    
    return "Datos insuficientes";
}

export default async function handler(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Manejar preflight OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // Verificar método POST
    if (req.method !== 'POST') {
        return res.status(405).json({ 
            error: 'Método no permitido. Usar POST.',
            timestamp: new Date().toISOString()
        });
    }
    
    try {
        // Limpiar caché viejo
        cleanOldCache();
        
        // Validar datos de entrada
        const validation = validateInputData(req.body);
        if (!validation.valid) {
            return res.status(400).json({
                error: validation.error,
                timestamp: new Date().toISOString()
            });
        }
        
        const { speed, gust, direction, cardinal, temp } = req.body;
        
        // Verificar caché
        const cacheKey = createCacheKey(speed, gust, direction, temp);
        const cachedResult = verdictCache.get(cacheKey);
        
        if (cachedResult) {
            console.log('📦 Devolviendo veredicto desde caché');
            return res.status(200).json({
                verdict: cachedResult.verdict,
                cached: true,
                cache_age: Math.floor((Date.now() - cachedResult.timestamp) / 1000),
                timestamp: new Date().toISOString()
            });
        }
        
        // Obtener clave API
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('❌ GEMINI_API_KEY no configurada');
            // Usar veredicto de fallback
            const fallbackVerdict = createFallbackVerdict(speed, direction, cardinal);
            return res.status(200).json({
                verdict: fallbackVerdict,
                fallback: true,
                reason: 'API key no disponible',
                timestamp: new Date().toISOString()
            });
        }
        
        // Construir prompts mejorados
        const systemPrompt = `
            Eres "KiteBot", un experto local de kitesurf en el spot "La Bajada" de Claromecó, Argentina.
            Analizas PRONÓSTICOS (datos futuros) y das veredictos MUY cortos (máximo 6 palabras).
            
            REGLAS CRÍTICAS:
            - SEGURIDAD PRIMERO: Si dirección es offshore (N, NNE, NE, NO, NNO) = "¡PELIGRO! OFFSHORE"
            - USA JERGA ARGENTINA: "se pone bueno", "arrachado", "ideal para 9m", "se plancha"
            - SÉ CONCISO: Solo el veredicto, sin explicaciones
            - RECOMIENDA KITE: Si navegable (15-25kt) sugiere tamaño
            - CONSIDERA TEMPERATURA: Menciona si hace frío/calor extremo
            
            EJEMPLOS:
            - 18kt, SE, 22°C → "¡Ideal para 10m!"
            - 12kt, E, 15°C → "Flojo, ideal 12m"
            - 25kt, N, 20°C → "¡PELIGRO! OFFSHORE"
            - 8kt, S, 25°C → "Muy flojo"
        `;
        
        const userQuery = `
            PRONÓSTICO La Bajada (próximas 6h):
            - Velocidad: ${speed !== null ? speed + ' nudos' : 'N/A'}
            - Dirección: ${direction !== null ? direction + '°' : 'N/A'} (${cardinal || 'N/A'})
            - Racha: ${gust !== null ? gust + ' nudos' : 'No disponible'}
            - Temperatura: ${temp !== null ? temp + '°C' : 'N/A'}
            
            Veredicto (máx 6 palabras):
        `;
        
        console.log('🤖 Generando veredicto con Gemini...');
        
        // Llamar a Gemini con reintentos
        let result;
        let lastError;
        
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const genAI = new GoogleGenerativeAI(apiKey);
                const model = genAI.getGenerativeModel({
                    model: "gemini-2.0-flash-exp",
                    systemInstruction: {
                        parts: [{ text: systemPrompt }],
                        role: "model"
                    },
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 50,
                    }
                });
                
                result = await generateVerdictWithTimeout(model, userQuery);
                break; // Éxito, salir del loop
                
            } catch (error) {
                lastError = error;
                console.warn(`⚠️ Intento ${attempt + 1} falló:`, error.message);
                
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
        }
        
        // Si todos los intentos fallaron, usar fallback
        if (!result) {
            console.error('❌ Todos los intentos con Gemini fallaron:', lastError?.message);
            const fallbackVerdict = createFallbackVerdict(speed, direction, cardinal);
            
            return res.status(200).json({
                verdict: fallbackVerdict,
                fallback: true,
                reason: 'Error en API de Gemini',
                timestamp: new Date().toISOString()
            });
        }
        
        // Procesar respuesta de Gemini
        const response = await result.response;
        let verdict = response.text().trim();
        
        // Limpiar y validar respuesta
        verdict = verdict.replace(/['"]/g, '').substring(0, 50); // Máximo 50 caracteres
        
        if (!verdict || verdict.length < 3) {
            verdict = createFallbackVerdict(speed, direction, cardinal);
        }
        
        // Guardar en caché
        verdictCache.set(cacheKey, {
            verdict: verdict,
            timestamp: Date.now()
        });
        
        console.log('✅ Veredicto generado y cacheado:', verdict);
        
        // Devolver respuesta exitosa
        res.status(200).json({
            verdict: verdict,
            cached: false,
            ai_generated: true,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error en API de veredicto:', error);
        
        // Intentar crear veredicto de fallback
        try {
            const { speed, direction, cardinal } = req.body || {};
            const fallbackVerdict = createFallbackVerdict(speed, direction, cardinal);
            
            res.status(200).json({
                verdict: fallbackVerdict,
                fallback: true,
                reason: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        } catch (fallbackError) {
            res.status(500).json({
                error: 'Error interno del servidor',
                timestamp: new Date().toISOString()
            });
        }
    }
}

// Función para limpiar caché manualmente (útil para debugging)
export function clearVerdictCache() {
    verdictCache.clear();
    console.log('🗑️ Caché de veredictos limpiado');
}