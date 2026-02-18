-- Alinear tabla `perfiles_alumno` a la estructura esperada por el backend actual
-- Útil cuando la tabla fue creada en una versión anterior del proyecto
-- Ejecutar en la base de datos talleres_cbtis258

BEGIN;

-- 1) Agregar columnas faltantes (si no existen)
ALTER TABLE public.perfiles_alumno ADD COLUMN IF NOT EXISTS apellido_paterno VARCHAR(100);
ALTER TABLE public.perfiles_alumno ADD COLUMN IF NOT EXISTS apellido_materno VARCHAR(100);
ALTER TABLE public.perfiles_alumno ADD COLUMN IF NOT EXISTS grupo VARCHAR(20);
ALTER TABLE public.perfiles_alumno ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE public.perfiles_alumno ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE public.perfiles_alumno ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- 2) Intentar migrar datos desde columnas legacy comunes (si existen)
DO $$
BEGIN
    -- Si existe columna `apellidos`, separar en paterno/materno cuando sea posible
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'perfiles_alumno'
          AND column_name = 'apellidos'
    ) THEN
        EXECUTE $SQL$
            UPDATE public.perfiles_alumno
            SET
                apellido_paterno = COALESCE(
                    NULLIF(apellido_paterno, ''),
                    NULLIF(split_part(apellidos, ' ', 1), '')
                ),
                apellido_materno = COALESCE(
                    NULLIF(apellido_materno, ''),
                    NULLIF(regexp_replace(apellidos, '^\S+\s*', ''), '')
                )
            WHERE apellidos IS NOT NULL
        $SQL$;
    END IF;

    -- Si existe columna `grupo_especialidad`, copiar a `grupo` cuando grupo esté vacío
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'perfiles_alumno'
          AND column_name = 'grupo_especialidad'
    ) THEN
        EXECUTE $SQL$
            UPDATE public.perfiles_alumno
            SET grupo = COALESCE(NULLIF(grupo, ''), NULLIF(grupo_especialidad, ''))
            WHERE grupo IS NULL OR grupo = ''
        $SQL$;
    END IF;
END $$;

-- 3) Normalizar números de control (quitar espacios al inicio/fin)
UPDATE public.perfiles_alumno
SET numero_control = TRIM(numero_control)
WHERE numero_control IS NOT NULL
  AND numero_control <> TRIM(numero_control);

-- 4) Crear índices/constraints esperados
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'perfiles_alumno_numero_control_key'
    ) THEN
        ALTER TABLE public.perfiles_alumno
        ADD CONSTRAINT perfiles_alumno_numero_control_key UNIQUE (numero_control);
    END IF;
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'No se pudo crear UNIQUE(numero_control): hay duplicados. Limpia duplicados y vuelve a intentar.';
END $$;

CREATE INDEX IF NOT EXISTS idx_perfiles_alumno_usuario_id ON public.perfiles_alumno(usuario_id);
CREATE INDEX IF NOT EXISTS idx_perfiles_alumno_numero_control ON public.perfiles_alumno(numero_control);

COMMIT;

-- Verificación rápida sugerida:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'perfiles_alumno'
-- ORDER BY ordinal_position;
--
-- SELECT id, nombre, apellido_paterno, apellido_materno, numero_control, grupo
-- FROM public.perfiles_alumno
-- LIMIT 20;
