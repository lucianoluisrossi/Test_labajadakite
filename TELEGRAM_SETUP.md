# Configuración del Bot de Telegram - La Bajada

## Paso 1: Configurar Variables de Entorno en Vercel

Andá a tu proyecto en Vercel → Settings → Environment Variables y agregá:

| Variable | Descripción |
|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token del bot de BotFather |
| `FIREBASE_SERVICE_ACCOUNT` | JSON de cuenta de servicio de Firebase (ver abajo) |
| `ALERT_API_KEY` | (Opcional) Clave para proteger el endpoint de alertas |

### Obtener credenciales de Firebase:
1. Andá a [Firebase Console](https://console.firebase.google.com/)
2. Seleccioná tu proyecto (labajadakite)
3. Configuración del proyecto → Cuentas de servicio
4. Generá una nueva clave privada (descarga un JSON)
5. Copiá TODO el contenido del JSON y pegalo en la variable `FIREBASE_SERVICE_ACCOUNT`

## Paso 2: Subir a Vercel
```bash
git add .
git commit -m "Agregar bot de Telegram con alertas"
git push
```

## Paso 3: Configurar el Webhook de Telegram
Una vez desplegado, abrí esta URL en tu navegador:

```
https://api.telegram.org/bot[TU_TOKEN]/setWebhook?url=https://labajada.vercel.app/api/telegram-webhook
```

Deberías ver:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## Paso 4: Probar el Bot
1. Abrí Telegram y buscá tu bot
2. Enviá `/start` - Te suscribe a las alertas
3. Enviá `/viento` - Muestra condiciones actuales
4. Enviá `/stop` - Cancela la suscripción

## Paso 5: Configurar Alertas Automáticas (Cron)

### Opción A: Vercel Cron (Pro)
Agregá a `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/telegram-alert",
    "schedule": "*/30 * * * *"
  }]
}
```

### Opción B: Servicio externo gratuito
Usá [cron-job.org](https://cron-job.org):
1. Creá una cuenta gratis
2. Agregá un cron job a: `https://labajada.vercel.app/api/telegram-alert`
3. Configurá cada 30 minutos
4. (Opcional) Agregá header `x-api-key` con tu ALERT_API_KEY

## Comandos Disponibles
| Comando | Descripción |
|---------|-------------|
| `/start` | Suscribirse a alertas |
| `/viento` | Ver condiciones actuales |
| `/info` | Info del spot |
| `/stop` | Cancelar suscripción |

## Archivos del Sistema
| Archivo | Descripción |
|---------|-------------|
| `api/_firebase.js` | Conexión a Firebase |
| `api/telegram-webhook.js` | Recibe mensajes del bot |
| `api/telegram-alert.js` | Envía alertas automáticas |

## Condiciones para Alertas
- Viento ≥ 12 nudos
- Dirección: N, NE, NO, NNE, NNO
