import express from 'express';
import InformacionEmergenciaController from '../controllers/informacionEmergenciaController.js';
import { authenticateToken, authorizeAlumnoAccess } from '../middlewares/auth.js';

const router = express.Router();

// Obtener mi información de emergencia
router.get(
    '/mi-informacion',
    authenticateToken,
    authorizeAlumnoAccess,
    InformacionEmergenciaController.getMiInformacion
);

// Crear o actualizar información de emergencia
router.post(
    '/',
    authenticateToken,
    authorizeAlumnoAccess,
    InformacionEmergenciaController.createOrUpdate
);

// Actualizar información de emergencia (alias PUT)
router.put(
    '/',
    authenticateToken,
    authorizeAlumnoAccess,
    InformacionEmergenciaController.createOrUpdate
);

// Eliminar información de emergencia
router.delete(
    '/:id',
    authenticateToken,
    authorizeAlumnoAccess,
    InformacionEmergenciaController.delete
);

export default router;
