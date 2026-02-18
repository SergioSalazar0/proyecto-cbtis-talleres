# 🔧 Fix Rate Limit 429 - Actualización Rápida

## Problema
Error 429 "Too Many Requests" al probar el registro/login en producción.

## Causa
El rate limiter estaba configurado muy estrictamente:
- Auth limiter: Solo 5 requests cada 15 minutos ❌
- Limiter general: 100 requests cada 15 minutos ❌

## Solución Aplicada

### Cambios en el Código
✅ Auth limiter: 50 requests cada 15 minutos (más permisivo)
✅ Limiter general: 1000 requests cada 15 minutos (muy permisivo para beta)
✅ Agregado `skipSuccessfulRequests: true` en auth limiter
✅ Agregada opción para desactivar rate limit completamente con variable de entorno

---

## 🚀 Pasos para Actualizar Railway

### Opción 1: Desactivar Rate Limit Temporalmente (Recomendado para Beta Testing)

1. Ve a [Railway Dashboard](https://railway.app)
2. Selecciona tu proyecto
3. Click en el servicio **backend**
4. Ve a la pestaña **"Variables"**
5. Agrega esta nueva variable:
   ```
   DISABLE_RATE_LIMIT=true
   ```
6. Railway redesplegará automáticamente
7. ¡Listo! Ya no tendrás límite de requests

### Opción 2: Configurar Límites Personalizados (Más Control)

1. Ve a [Railway Dashboard](https://railway.app)
2. Selecciona tu proyecto
3. Click en el servicio **backend**
4. Ve a la pestaña **"Variables"**
5. Agrega/actualiza estas variables:
   ```
   RATE_LIMIT_MAX_REQUESTS=1000
   AUTH_RATE_LIMIT=50
   RATE_LIMIT_WINDOW_MS=900000
   ```
6. Railway redesplegará automáticamente

### Opción 3: Deploy con Git (Automático)

El código ya está actualizado. Solo necesitas:

```bash
# En tu terminal local
git add .
git commit -m "fix: Ajustar rate limiters para beta testing"
git push origin main
```

Railway detectará el push y redesplegará automáticamente con los nuevos límites.

---

## ✅ Verificar que Funciona

1. Espera 1-2 minutos a que Railway complete el deploy
2. Ve a **Deployments** en Railway y verifica que el último deploy tenga estado **"SUCCESS"**
3. Prueba tu frontend nuevamente
4. Intenta registrar un usuario
5. El error 429 debería desaparecer

### Test de Health Check
```bash
curl https://backend-talleres-production.up.railway.app/api/health
```

Deberías ver:
```json
{
  "status": "OK",
  "timestamp": "2025-11-20T...",
  "service": "Talleres CBTIS 258 API",
  "version": "1.0.0",
  "environment": "production"
}
```

---

## 📊 Límites Actualizados

### Antes (Muy Restrictivo)
```
General: 100 requests / 15 min
Auth:    5 requests / 15 min ❌ <- PROBLEMA
```

### Después (Permisivo para Beta)
```
General: 1000 requests / 15 min ✅
Auth:    50 requests / 15 min ✅
```

### Con DISABLE_RATE_LIMIT=true
```
General: SIN LÍMITE ✅
Auth:    SIN LÍMITE ✅
```

---

## 🔐 Seguridad: Endurecer Después del Testing

Una vez que termines las pruebas beta y tengas usuarios reales, ajusta los límites:

**Configuración Recomendada para Producción:**
```env
RATE_LIMIT_MAX_REQUESTS=300
AUTH_RATE_LIMIT=10
RATE_LIMIT_WINDOW_MS=900000
# NO usar DISABLE_RATE_LIMIT en producción
```

Esto protegerá tu API contra:
- ✅ Ataques de fuerza bruta
- ✅ Scraping excesivo
- ✅ Consumo abusivo de recursos

---

## 🐛 Troubleshooting

### Todavía recibo 429 después del deploy

1. **Verifica que el deploy se completó:**
   - Ve a Railway → Deployments
   - El último debe estar en "SUCCESS"

2. **Limpia tu caché:**
   ```bash
   # En Chrome/Edge DevTools (F12)
   # Application → Clear Storage → Clear site data
   ```

3. **Verifica las variables de entorno:**
   ```bash
   railway variables
   ```

4. **Verifica los logs:**
   ```bash
   railway logs
   ```
   Busca líneas que digan rate limit settings

### El frontend no se conecta al backend

Verifica CORS - asegúrate de tener en Railway:
```env
FRONTEND_URL=https://tu-frontend-url.vercel.app
```

---

## 📝 Variables de Entorno Completas en Railway

Para referencia, estas son TODAS las variables que deberías tener:

```env
# Automáticas (Railway las crea)
DATABASE_URL=postgresql://...

# Que debes configurar
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://proyecto-talleres-cbtis258-frontend.vercel.app
JWT_SECRET=<tu_secret_seguro_generado>
JWT_EXPIRES_IN=7d

# Rate Limiting (elige una opción)
# Opción A - Sin límites (beta testing)
DISABLE_RATE_LIMIT=true

# Opción B - Límites permisivos (recomendado)
RATE_LIMIT_MAX_REQUESTS=1000
AUTH_RATE_LIMIT=50
RATE_LIMIT_WINDOW_MS=900000
```

---

## 🎯 Resumen de Acción Inmediata

**Para resolver AHORA el error 429:**

1. Ve a Railway
2. Backend Service → Variables
3. Agregar: `DISABLE_RATE_LIMIT=true`
4. Esperar redeploy (1-2 min)
5. ¡Listo! Ya puedes probar sin límites

**Después del testing:**

1. Quitar `DISABLE_RATE_LIMIT`
2. Agregar límites razonables
3. Monitorear uso en Railway Metrics

---

¿Necesitas ayuda? Revisa los logs:
```bash
railway logs --filter "rate limit"
```
