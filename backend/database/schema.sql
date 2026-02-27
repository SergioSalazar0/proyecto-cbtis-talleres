-- Esquema de base de datos para Sistema de Talleres CBTIS 258
-- Ejecutar estos scripts en orden en pgAdmin

-- 1. Crear la base de datos (ejecutar conectado a postgres)
-- CREATE DATABASE talleres_cbtis258;

-- 2. Conectarse a la base de datos talleres_cbtis258 y ejecutar lo siguiente:

-- Crear extensión para UUIDs si no existe
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum para tipos de usuario
CREATE TYPE user_type AS ENUM ('alumno', 'instructor', 'admin');

-- Enum para categorías de talleres
CREATE TYPE categoria_taller AS ENUM ('culturales', 'deportes', 'civicos');

-- Enum para estado de inscripción
CREATE TYPE estado_inscripcion AS ENUM ('activa', 'inactiva', 'cancelada');

-- Tabla de usuarios principales
CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    tipo_usuario user_type NOT NULL DEFAULT 'alumno',
    activo BOOLEAN DEFAULT true,
    fecha_registro TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de perfiles de alumnos
CREATE TABLE perfiles_alumno (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    fecha_nacimiento DATE,
    telefono VARCHAR(20),
    grupo VARCHAR(20),
    semestre VARCHAR(10),
    numero_control VARCHAR(50) UNIQUE,
    direccion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de perfiles de instructores
CREATE TABLE perfiles_instructor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    telefono VARCHAR(20),
    especialidad VARCHAR(200),
    experiencia TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de información de emergencia
CREATE TABLE informacion_emergencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID REFERENCES perfiles_alumno(id) ON DELETE CASCADE,
    contacto_emergencia_nombre VARCHAR(150) NOT NULL,
    contacto_emergencia_telefono VARCHAR(20) NOT NULL,
    contacto_emergencia_relacion VARCHAR(50) NOT NULL,
    tipo_sangre VARCHAR(5),
    alergias TEXT,
    medicamentos TEXT,
    condiciones_medicas TEXT,
    seguro_medico VARCHAR(100),
    numero_seguro VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de talleres
CREATE TABLE talleres (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    categoria categoria_taller NOT NULL,
    instructor_id UUID REFERENCES perfiles_instructor(id) ON DELETE SET NULL,
    cupo_maximo INTEGER DEFAULT 25,
    horario VARCHAR(200),
    lugar VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de inscripciones
CREATE TABLE inscripciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID REFERENCES perfiles_alumno(id) ON DELETE CASCADE,
    taller_id UUID REFERENCES talleres(id) ON DELETE CASCADE,
    estado estado_inscripcion DEFAULT 'activa',
    fecha_inscripcion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    comentarios TEXT,
    
    -- Un alumno solo puede estar inscrito a un taller a la vez
    UNIQUE(alumno_id, taller_id)
);

-- Tabla de asistencias por sesion
CREATE TABLE asistencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alumno_id UUID REFERENCES perfiles_alumno(id) ON DELETE CASCADE,
    taller_id UUID REFERENCES talleres(id) ON DELETE CASCADE,
    fecha_sesion DATE NOT NULL,
    sesion_asistencia_id UUID REFERENCES sesiones_asistencia(id) ON DELETE SET NULL,
    registrado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de sesiones de asistencia (historial de aperturas/cierres de escaneo)
CREATE TABLE sesiones_asistencia (
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

-- Tabla de avisos
CREATE TABLE avisos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    taller_id UUID REFERENCES talleres(id) ON DELETE CASCADE,
    instructor_id UUID REFERENCES perfiles_instructor(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    contenido TEXT NOT NULL,
    importante BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    fecha_publicacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fecha_expiracion TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de fechas importantes
CREATE TABLE fechas_importantes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    taller_id UUID REFERENCES talleres(id) ON DELETE CASCADE,
    instructor_id UUID REFERENCES perfiles_instructor(id) ON DELETE CASCADE,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_evento TIMESTAMP WITH TIME ZONE NOT NULL,
    tipo_evento VARCHAR(50) DEFAULT 'evento',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para logs del sistema
CREATE TABLE logs_sistema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES usuarios(id),
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(50),
    registro_id UUID,
    detalles JSONB,
    ip_address INET,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar talleres predefinidos
INSERT INTO talleres (nombre, descripcion, categoria, cupo_maximo, activo) VALUES
-- Culturales
('Oratoria', 'Desarrollo de habilidades de comunicación y expresión oral', 'culturales', 20, true),
('Danza', 'Expresión artística a través del movimiento corporal', 'culturales', 25, true),
('Fotografía', 'Técnicas de composición y captura fotográfica', 'culturales', 15, true),
('Ajedrez', 'Estrategia y táctica en el juego ciencia', 'culturales', 30, true),
('Arte', 'Expresión plástica y visual', 'culturales', 20, true),

-- Deportes
('Atletismo', 'Disciplinas de pista y campo', 'deportes', 30, true),
('Fútbol', 'Deporte de conjunto más popular del mundo', 'deportes', 25, true),
('Básquetbol', 'Deporte de canasta con balón', 'deportes', 20, true),
('Voleibol', 'Deporte de red con pelota', 'deportes', 18, true),

-- Cívicos
('Escolta', 'Protocolo y ceremonial cívico', 'civicos', 12, true),
('Banda de Guerra', 'Música y marchas militares', 'civicos', 25, true);

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_tipo ON usuarios(tipo_usuario);
CREATE INDEX idx_perfiles_alumno_usuario_id ON perfiles_alumno(usuario_id);
CREATE INDEX idx_perfiles_instructor_usuario_id ON perfiles_instructor(usuario_id);
CREATE INDEX idx_talleres_categoria ON talleres(categoria);
CREATE INDEX idx_talleres_instructor ON talleres(instructor_id);
CREATE INDEX idx_inscripciones_alumno ON inscripciones(alumno_id);
CREATE INDEX idx_inscripciones_taller ON inscripciones(taller_id);
CREATE INDEX idx_asistencias_taller_fecha ON asistencias(taller_id, fecha_sesion);
CREATE INDEX idx_asistencias_sesion_asistencia ON asistencias(sesion_asistencia_id);
CREATE UNIQUE INDEX uq_asistencias_unica_con_sesion
    ON asistencias(alumno_id, taller_id, fecha_sesion, sesion_asistencia_id)
    WHERE sesion_asistencia_id IS NOT NULL;
CREATE UNIQUE INDEX uq_asistencias_unica_sin_sesion
    ON asistencias(alumno_id, taller_id, fecha_sesion)
    WHERE sesion_asistencia_id IS NULL;
CREATE INDEX idx_sesiones_asistencia_taller ON sesiones_asistencia(taller_id, created_at DESC);
CREATE INDEX idx_sesiones_asistencia_fecha ON sesiones_asistencia(fecha_sesion);
CREATE INDEX idx_avisos_taller ON avisos(taller_id);
CREATE INDEX idx_fechas_taller ON fechas_importantes(taller_id);

-- Funciones para actualizar timestamp
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

-- Triggers para actualizar automáticamente updated_at / fecha_actualizacion
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_perfiles_alumno_updated_at BEFORE UPDATE ON perfiles_alumno FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_perfiles_instructor_updated_at BEFORE UPDATE ON perfiles_instructor FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_talleres_updated_at BEFORE UPDATE ON talleres FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inscripciones_updated_at BEFORE UPDATE ON inscripciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Crear usuario administrador por defecto
-- Contraseña: Admin123! (hasheada con bcrypt) desde el thunder client o aplicación correspondiente

-- Vista para obtener información completa de alumnos
CREATE VIEW vista_alumnos_completa AS
SELECT 
    u.id as usuario_id,
    u.email,
    u.activo as usuario_activo,
    pa.id as perfil_id,
    pa.nombre,
    pa.apellido_paterno,
    pa.apellido_materno,
    pa.fecha_nacimiento,
    pa.telefono,
    pa.grupo,
    pa.semestre,
    pa.numero_control,
    pa.direccion,
    ie.contacto_emergencia_nombre,
    ie.contacto_emergencia_telefono,
    ie.contacto_emergencia_relacion,
    ie.tipo_sangre,
    ie.alergias,
    ie.medicamentos,
    ie.condiciones_medicas
FROM usuarios u
LEFT JOIN perfiles_alumno pa ON u.id = pa.usuario_id
LEFT JOIN informacion_emergencia ie ON pa.id = ie.alumno_id
WHERE u.tipo_usuario = 'alumno';

-- Vista para obtener información completa de instructores
CREATE VIEW vista_instructores_completa AS
SELECT 
    u.id as usuario_id,
    u.email,
    u.activo as usuario_activo,
    pi.id as perfil_id,
    pi.nombre,
    pi.apellido_paterno,
    pi.apellido_materno,
    pi.telefono,
    pi.especialidad,
    pi.experiencia
FROM usuarios u
LEFT JOIN perfiles_instructor pi ON u.id = pi.usuario_id
WHERE u.tipo_usuario = 'instructor';

-- Vista para talleres con información del instructor
CREATE VIEW vista_talleres_completa AS
SELECT 
    t.id,
    t.nombre,
    t.descripcion,
    t.categoria,
    t.cupo_maximo,
    t.horario,
    t.lugar,
    t.activo,
    COALESCE(pi.nombre || ' ' || pi.apellido_paterno || ' ' || COALESCE(pi.apellido_materno, ''), 'Sin asignar') as instructor_nombre,
    pi.telefono as instructor_telefono,
    pi.especialidad as instructor_especialidad,
    (SELECT COUNT(*) FROM inscripciones i WHERE i.taller_id = t.id AND i.estado = 'activa') as inscritos_actuales
FROM talleres t
LEFT JOIN perfiles_instructor pi ON t.instructor_id = pi.id;

-- Función para verificar cupo disponible
CREATE OR REPLACE FUNCTION verificar_cupo_disponible(taller_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    cupo_maximo INTEGER;
    inscritos_actuales INTEGER;
BEGIN
    SELECT t.cupo_maximo INTO cupo_maximo
    FROM talleres t
    WHERE t.id = taller_uuid AND t.activo = true;
    
    IF cupo_maximo IS NULL THEN
        RETURN -1; -- Taller no encontrado o inactivo
    END IF;
    
    SELECT COUNT(*) INTO inscritos_actuales
    FROM inscripciones i
    WHERE i.taller_id = taller_uuid AND i.estado = 'activa';
    
    RETURN cupo_maximo - inscritos_actuales;
END;
$$ LANGUAGE plpgsql;