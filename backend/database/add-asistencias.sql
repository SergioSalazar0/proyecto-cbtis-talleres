-- Agregar tabla de asistencias y su indice
-- Ejecuta este script en la base de datos talleres_cbtis258

CREATE TABLE IF NOT EXISTS asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID REFERENCES perfiles_alumno(id) ON DELETE CASCADE,
    taller_id UUID REFERENCES talleres(id) ON DELETE CASCADE,
    fecha_sesion DATE NOT NULL,
    sesion_asistencia_id UUID REFERENCES sesiones_asistencia(id) ON DELETE SET NULL,
    registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asistencias_taller_fecha ON asistencias(taller_id, fecha_sesion);
CREATE INDEX IF NOT EXISTS idx_asistencias_sesion_asistencia ON asistencias(sesion_asistencia_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_asistencias_unica_con_sesion
    ON asistencias(alumno_id, taller_id, fecha_sesion, sesion_asistencia_id)
    WHERE sesion_asistencia_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_asistencias_unica_sin_sesion
    ON asistencias(alumno_id, taller_id, fecha_sesion)
    WHERE sesion_asistencia_id IS NULL;
