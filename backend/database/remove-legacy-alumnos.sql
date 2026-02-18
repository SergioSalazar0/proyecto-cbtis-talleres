-- Eliminar tabla legacy `alumnos` de forma segura
-- Ejecutar en la base de datos `talleres_cbtis258`
-- Recomendado: correr en una ventana de mantenimiento y con respaldo previo

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.alumnos') IS NOT NULL THEN
        -- 1) Respaldar estructura + datos de la tabla legacy
        EXECUTE 'DROP TABLE IF EXISTS alumnos_backup_legacy';
        EXECUTE 'CREATE TABLE alumnos_backup_legacy AS SELECT * FROM alumnos';

        -- 2) Eliminar tabla legacy
        EXECUTE 'DROP TABLE alumnos';
    END IF;
END $$;

COMMIT;

-- Verificación rápida
-- SELECT to_regclass('public.alumnos') AS tabla_alumnos;
-- SELECT COUNT(*) FROM alumnos_backup_legacy;
