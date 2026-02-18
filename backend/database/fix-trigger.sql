-- Script para corregir el trigger de actualización de timestamp
-- Ejecutar este script en pgAdmin conectado a la base de datos talleres_cbtis258

-- Eliminar la función existente (esto también elimina los triggers asociados)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Crear la función corregida que maneja ambos nombres de campos
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    -- Intentar actualizar updated_at si existe, sino fecha_actualizacion
    IF TG_TABLE_NAME = 'usuarios' THEN
        NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    ELSE
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Recrear los triggers para todas las tablas
CREATE TRIGGER update_usuarios_updated_at 
    BEFORE UPDATE ON usuarios 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_perfiles_alumno_updated_at 
    BEFORE UPDATE ON perfiles_alumno 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_perfiles_instructor_updated_at 
    BEFORE UPDATE ON perfiles_instructor 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_talleres_updated_at 
    BEFORE UPDATE ON talleres 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inscripciones_updated_at 
    BEFORE UPDATE ON inscripciones 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Verificar que los triggers se crearon correctamente
SELECT 
    trigger_name, 
    event_manipulation, 
    event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
ORDER BY event_object_table;
