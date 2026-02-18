-- ============================================
-- Script para Verificar y Corregir Encoding UTF-8
-- Base de Datos Railway - PostgreSQL
-- ============================================

-- PASO 1: Verificar encoding actual de la base de datos
-- Este comando debe mostrar UTF8
SELECT datname, pg_encoding_to_char(encoding) as encoding 
FROM pg_database 
WHERE datname = current_database();

-- PASO 2: Verificar configuración de cliente
SHOW CLIENT_ENCODING;
SHOW SERVER_ENCODING;

-- PASO 3: Si el encoding NO es UTF8, necesitas recrear la base de datos
-- ADVERTENCIA: Esto requiere backup previo y recreación completa
-- NO ejecutar si ya tienes datos importantes

-- Para Railway, la base de datos ya debería estar en UTF8 por defecto
-- Si no lo está, contacta a soporte de Railway

-- PASO 4: Configurar la sesión actual a UTF8
SET CLIENT_ENCODING TO 'UTF8';
SET NAMES 'UTF8';

-- PASO 5: Verificar que las tablas usan UTF8
SELECT 
    schemaname,
    tablename,
    pg_encoding_to_char(encoding) as table_encoding
FROM pg_tables pt
JOIN pg_database pd ON pd.datname = current_database()
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY tablename;

-- ============================================
-- CORRECCIÓN DE DATOS EXISTENTES
-- ============================================

-- Si ya tienes datos con caracteres mal codificados (como "Antihistam??nicos")
-- necesitas corregirlos manualmente

-- PASO 6: Identificar columnas con problemas de encoding
-- Busca caracteres ?? en tus tablas

-- Ejemplo: Buscar en tabla informacion_emergencia
SELECT 
    id,
    usuario_id,
    alergias,
    medicamentos,
    condiciones_medicas
FROM informacion_emergencia
WHERE 
    alergias LIKE '%?%' OR
    medicamentos LIKE '%?%' OR
    condiciones_medicas LIKE '%?%';

-- PASO 7: Corregir datos específicos
-- IMPORTANTE: Ejecuta estos UPDATEs solo DESPUÉS de configurar UTF8

-- Ejemplo: Si "Antihistam??nicos" debe ser "Antihistamínicos"
-- Reemplaza los ?? por los caracteres correctos

-- UPDATE informacion_emergencia 
-- SET medicamentos = REPLACE(medicamentos, 'Antihistam??nicos', 'Antihistamínicos')
-- WHERE medicamentos LIKE '%Antihistam??nicos%';

-- UPDATE informacion_emergencia 
-- SET alergias = REPLACE(alergias, 'Pe??cilina', 'Penicilina')
-- WHERE alergias LIKE '%Pe??cilina%';

-- Repite para cada valor que necesite corrección

-- ============================================
-- PREVENCIÓN FUTURA
-- ============================================

-- PASO 8: Asegurarse que nuevas inserciones usen UTF8
-- Ya está configurado en el código de Node.js (config-db.js)

-- PASO 9: Verificar que tu cliente SQL también usa UTF8
-- En psql: \encoding UTF8

-- PASO 10: Probar inserción de caracteres especiales
-- Ejecuta este INSERT de prueba:

/*
INSERT INTO informacion_emergencia (
    usuario_id,
    nombre_completo,
    alergias,
    medicamentos,
    condiciones_medicas,
    telefono_emergencia
) VALUES (
    1, -- Cambia por un usuario_id válido
    'Prueba UTF8 - José María',
    'Penicilina, ácaros, látex',
    'Antihistamínicos, aspirinas, paracetamol',
    'Ninguna condición médica específica',
    '5551234567'
);

-- Luego verifica que se guardó correctamente:
SELECT * FROM informacion_emergencia 
WHERE nombre_completo LIKE '%José María%';

-- Si ves "José María" correctamente, el UTF8 está funcionando
-- Si ves "Jos?? Mar??a", aún hay problema de encoding
*/

-- ============================================
-- TROUBLESHOOTING
-- ============================================

-- Si después de todo TODAVÍA ves ?? en los datos:

-- 1. Verifica el encoding en Railway CLI:
--    railway run psql -c "SHOW SERVER_ENCODING"

-- 2. Verifica variables de entorno:
--    echo $LANG
--    echo $LC_ALL

-- 3. Reconecta a la base de datos con UTF8 explícito:
--    railway run psql -c "SET CLIENT_ENCODING TO 'UTF8'"

-- 4. Si nada funciona, puede ser que los datos ya estaban mal 
--    guardados antes. Necesitarás actualizarlos manualmente.

-- ============================================
-- RESUMEN DE ACCIONES NECESARIAS
-- ============================================

/*
✅ Ya hecho en el código:
   - config-db.js configurado con client_encoding: 'UTF8'
   - Evento 'connect' ejecuta SET CLIENT_ENCODING TO 'UTF8'

⚠️ Debes hacer en Railway:
   1. Ejecutar este script para verificar encoding
   2. Si encuentras datos con ??, ejecutar UPDATEs para corregirlos
   3. Redeploy del backend para que use la nueva configuración
   4. Probar con nuevas inserciones

🔍 Para verificar que todo funciona:
   - Inserta un nuevo registro con acentos
   - Consulta ese registro desde la app
   - Debe mostrarse correctamente sin ??
*/

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
