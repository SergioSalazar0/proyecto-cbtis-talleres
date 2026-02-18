-- Agregar campos adicionales a la tabla perfiles_instructor
-- Para permitir que los instructores actualicen su perfil completo

ALTER TABLE perfiles_instructor
ADD COLUMN IF NOT EXISTS descripcion TEXT,
ADD COLUMN IF NOT EXISTS contacto_emergencia VARCHAR(150),
ADD COLUMN IF NOT EXISTS telefono_emergencia VARCHAR(20),
ADD COLUMN IF NOT EXISTS direccion TEXT;

-- Comentarios para documentar las columnas
COMMENT ON COLUMN perfiles_instructor.descripcion IS 'Descripción personal del instructor, logros y habilidades';
COMMENT ON COLUMN perfiles_instructor.contacto_emergencia IS 'Nombre del contacto de emergencia';
COMMENT ON COLUMN perfiles_instructor.telefono_emergencia IS 'Teléfono del contacto de emergencia';
COMMENT ON COLUMN perfiles_instructor.direccion IS 'Dirección del instructor';
