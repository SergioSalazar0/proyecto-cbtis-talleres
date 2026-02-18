# 🔧 Fix Encoding UTF-8 - Caracteres Especiales (Acentos, ñ)

## Problema
Los datos guardados en Railway PostgreSQL muestran caracteres extraños:
- ❌ "Antihistam??nicos" en lugar de "Antihistamínicos"
- ❌ "Jos??" en lugar de "José"
- ❌ "Pe??cilina" en lugar de "Penicilina"

## Causa
El encoding de caracteres no estaba configurado explícitamente en UTF-8 en la conexión a PostgreSQL.

---

## ✅ Solución Aplicada en el Código

### 1. Actualizado `backend/database/config-db.js`

**Agregado al poolConfig:**
```javascript
// IMPORTANTE: Configuración de encoding UTF-8
// Esto asegura que los caracteres especiales (acentos, ñ, etc) se manejen correctamente
client_encoding: 'UTF8'
```

**Actualizado evento 'connect':**
```javascript
pool.on('connect', async (client) => {
    // Configurar UTF-8 en cada nueva conexión
    try {
        await client.query("SET CLIENT_ENCODING TO 'UTF8'");
        await client.query("SET NAMES 'UTF8'");
        console.log('🔗 Nueva conexión establecida con la base de datos (UTF-8)');
    } catch (err) {
        console.error('❌ Error configurando encoding UTF-8:', err.message);
    }
});
```

---

## 🚀 Pasos para Aplicar en Railway

### Paso 1: Hacer Deploy del Código Actualizado

```bash
# Los cambios ya están listos, solo commit y push
git add backend/database/config-db.js
git commit -m "fix: Configurar encoding UTF-8 en conexión PostgreSQL"
git push origin main
```

Railway redesplegará automáticamente (1-2 minutos).

### Paso 2: Verificar Encoding de la Base de Datos

Conéctate a Railway PostgreSQL:

**Opción A - Railway CLI:**
```bash
railway run psql
```

**Opción B - Panel Web de Railway:**
1. Ve a tu base de datos PostgreSQL en Railway
2. Click en "Data" → "Query"

Ejecuta este comando:
```sql
SHOW SERVER_ENCODING;
```

**Resultado esperado:** `UTF8`

Si muestra algo diferente (como `SQL_ASCII`), contacta a soporte de Railway.

### Paso 3: Corregir Datos Existentes

Los datos que YA están guardados con `??` necesitan corrección manual.

**Identificar registros con problemas:**
```sql
-- Buscar en informacion_emergencia
SELECT id, usuario_id, medicamentos, alergias
FROM informacion_emergencia
WHERE medicamentos LIKE '%?%' OR alergias LIKE '%?%';
```

**Corregir cada registro manualmente:**
```sql
-- Ejemplo: Corregir "Antihistam??nicos" → "Antihistamínicos"
UPDATE informacion_emergencia 
SET medicamentos = REPLACE(medicamentos, 'Antihistam??nicos', 'Antihistamínicos')
WHERE medicamentos LIKE '%Antihistam??nicos%';

-- Ejemplo: Corregir "Pe??cilina" → "Penicilina"
UPDATE informacion_emergencia 
SET alergias = REPLACE(alergias, 'Pe??cilina', 'Penicilina')
WHERE alergias LIKE '%Pe??cilina%';
```

**Repite para cada valor que tenga `??`**

### Paso 4: Probar con Nuevos Datos

Después del redeploy, inserta un nuevo registro con acentos:

```sql
INSERT INTO informacion_emergencia (
    usuario_id,
    nombre_completo,
    alergias,
    medicamentos,
    condiciones_medicas,
    telefono_emergencia
) VALUES (
    1, -- Usa un usuario_id válido
    'José María González',
    'Penicilina, ácaros',
    'Antihistamínicos y aspirinas',
    'Ninguna',
    '5551234567'
);
```

**Verificar:**
```sql
SELECT * FROM informacion_emergencia 
WHERE nombre_completo LIKE '%José%';
```

✅ **Debe mostrar:** "José María González" (sin `??`)  
❌ **Si muestra:** "Jos?? Mar??a" → Aún hay problema

---

## 🔍 Verificación Completa

### Railway CLI

```bash
# Conectar a Railway DB
railway run psql

# Dentro de psql:
\encoding UTF8
SHOW CLIENT_ENCODING;
SHOW SERVER_ENCODING;

# Probar caracteres especiales
SELECT 'José María, ñoño, áéíóú' AS prueba_utf8;
```

**Resultado esperado:**
```
     prueba_utf8      
----------------------
 José María, ñoño, áéíóú
```

---

## 📊 Checklist de Verificación

- [ ] Código actualizado en `config-db.js`
- [ ] Commit y push realizados
- [ ] Railway redesplegó exitosamente
- [ ] `SHOW SERVER_ENCODING;` retorna `UTF8`
- [ ] Registros existentes con `??` corregidos manualmente
- [ ] Nueva inserción con acentos funciona correctamente
- [ ] Frontend muestra caracteres especiales correctamente

---

## 🐛 Troubleshooting

### Problema: Después del fix, nuevos datos aún tienen ??

**Causa:** Railway no detectó el cambio o hay caché.

**Solución:**
```bash
# Forzar redeploy en Railway
railway redeploy

# O desde el dashboard:
# Railway → tu servicio backend → Deployments → Redeploy latest
```

### Problema: La base de datos no está en UTF8

**Verificar:**
```sql
SELECT datname, pg_encoding_to_char(encoding) 
FROM pg_database 
WHERE datname = current_database();
```

**Si NO es UTF8:**
Railway generalmente crea bases de datos en UTF8 por defecto. Si la tuya no lo está, puede ser una base vieja. Opciones:

1. **Contactar soporte de Railway** para cambiar encoding
2. **Migrar a nueva base de datos UTF8:**
   - Crear nueva DB en Railway
   - Exportar datos: `pg_dump`
   - Importar a nueva DB con UTF8
   - Actualizar `DATABASE_URL`

### Problema: Algunos caracteres se ven bien, otros no

**Causa:** Mezcla de encodings en diferentes inserciones.

**Solución:**
1. Identificar TODOS los registros problemáticos
2. Crear script de limpieza con múltiples REPLACEs
3. Ejecutar en Railway Query

**Ejemplo de script de limpieza:**
```sql
-- Crear función helper
CREATE OR REPLACE FUNCTION fix_encoding_issues()
RETURNS void AS $$
BEGIN
    -- Medicamentos comunes
    UPDATE informacion_emergencia 
    SET medicamentos = REPLACE(medicamentos, '??', 'í')
    WHERE medicamentos LIKE '%??%';
    
    UPDATE informacion_emergencia 
    SET medicamentos = REPLACE(medicamentos, 'Antihistam??nicos', 'Antihistamínicos');
    
    UPDATE informacion_emergencia 
    SET medicamentos = REPLACE(medicamentos, 'paracetam??l', 'paracetamol');
    
    -- Alergias comunes
    UPDATE informacion_emergencia 
    SET alergias = REPLACE(alergias, 'Pe??cilina', 'Penicilina');
    
    UPDATE informacion_emergencia 
    SET alergias = REPLACE(alergias, '??caros', 'ácaros');
    
    -- Nombres
    UPDATE informacion_emergencia 
    SET nombre_completo = REPLACE(nombre_completo, 'Jos??', 'José');
    
    UPDATE informacion_emergencia 
    SET nombre_completo = REPLACE(nombre_completo, 'Mar??a', 'María');
    
    RAISE NOTICE 'Encoding issues fixed!';
END;
$$ LANGUAGE plpgsql;

-- Ejecutar la función
SELECT fix_encoding_issues();
```

---

## 💡 Prevención Futura

### 1. Siempre Usar UTF-8 en Formularios Frontend

Ya configurado en tus HTML:
```html
<meta charset="UTF-8">
```

### 2. Validar en Backend

El código ya valida y sanitiza, pero asegúrate que no haya conversiones de encoding intermedias.

### 3. Headers HTTP

Verifica que Railway sirva con:
```
Content-Type: application/json; charset=utf-8
```

Ya configurado en Express:
```javascript
app.use(express.json({ charset: 'utf-8' }));
```

---

## 🎯 Resumen de Acción Inmediata

### Para Resolver AHORA:

1. **Push del código actualizado:**
   ```bash
   git add .
   git commit -m "fix: Configurar encoding UTF-8 en PostgreSQL"
   git push origin main
   ```

2. **Esperar redeploy:** 1-2 minutos

3. **Conectarse a Railway DB y corregir datos existentes:**
   ```bash
   railway run psql
   ```
   ```sql
   -- Identifica y corrige cada registro con ??
   UPDATE informacion_emergencia 
   SET medicamentos = 'Antihistamínicos y aspirinas'
   WHERE medicamentos LIKE '%??%' AND id = <id_del_registro>;
   ```

4. **Probar con nuevo registro:** Inserta algo con acentos desde tu app

5. **Verificar en frontend:** Debe mostrarse correctamente

---

## ✅ Confirmación de Éxito

Sabrás que está funcionando cuando:

1. ✅ Insertas "José" → Se guarda como "José" (no "Jos??")
2. ✅ Frontend muestra "Antihistamínicos" correctamente
3. ✅ Todos los caracteres especiales (á, é, í, ó, ú, ñ, ü) funcionan
4. ✅ Los logs de Railway muestran: "Nueva conexión establecida (UTF-8)"

---

**Tiempo estimado de solución completa:** 5-10 minutos

1. Push código: 30 segundos
2. Redeploy Railway: 1-2 minutos
3. Corregir datos existentes: 2-5 minutos (dependiendo de cantidad)
4. Pruebas: 2 minutos

---

¿Necesitas ayuda ejecutando los comandos en Railway? Puedo guiarte paso a paso. 🚀
