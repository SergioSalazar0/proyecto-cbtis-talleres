-- Agregar tabla de asistencias y su indice
-- Ejecuta este script en la base de datos talleres_cbtis258

CREATE TABLE IF NOT EXISTS asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID REFERENCES perfiles_alumno(id) ON DELETE CASCADE,
    taller_id UUID REFERENCES talleres(id) ON DELETE CASCADE,
    fecha_sesion DATE NOT NULL,
    registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alumno_id, taller_id, fecha_sesion)
);

CREATE INDEX IF NOT EXISTS idx_asistencias_taller_fecha ON asistencias(taller_id, fecha_sesion);
