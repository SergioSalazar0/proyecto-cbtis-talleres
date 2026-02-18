-- Agregar tabla de sesiones de asistencia
-- Ejecuta este script en la base de datos talleres_cbtis258

CREATE TABLE IF NOT EXISTS sesiones_asistencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    taller_id UUID REFERENCES talleres(id) ON DELETE CASCADE,
    instructor_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_sesion DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activa',
    total_registrados INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_sesiones_asistencia_taller ON sesiones_asistencia(taller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sesiones_asistencia_fecha ON sesiones_asistencia(fecha_sesion);
