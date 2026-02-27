-- Agregar soporte de sesiones en asistencias existentes
-- Ejecuta este script en la base de datos talleres_cbtis258

ALTER TABLE asistencias
ADD COLUMN IF NOT EXISTS sesion_asistencia_id UUID REFERENCES sesiones_asistencia(id) ON DELETE SET NULL;

ALTER TABLE asistencias
DROP CONSTRAINT IF EXISTS asistencias_alumno_id_taller_id_fecha_sesion_key;

CREATE INDEX IF NOT EXISTS idx_asistencias_sesion_asistencia ON asistencias(sesion_asistencia_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_asistencias_unica_con_sesion
    ON asistencias(alumno_id, taller_id, fecha_sesion, sesion_asistencia_id)
    WHERE sesion_asistencia_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_asistencias_unica_sin_sesion
    ON asistencias(alumno_id, taller_id, fecha_sesion)
    WHERE sesion_asistencia_id IS NULL;
