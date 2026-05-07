import express from 'express';
import {
    getClientes,
    createCliente,
    updateCliente,
    checkCedulaExists,
    linkClienteToEncargado,
    archivarCliente,
    activarCliente
} from '../controllers/clienteController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

// Aplica el middleware de autenticación a todas las rutas de clientes
router.use(authenticate);

router.get('/', getClientes);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.get('/check-cedula', checkCedulaExists);
router.post('/:id/vincular', linkClienteToEncargado);
router.post('/:id/archivar', archivarCliente);
router.post('/:id/activar', activarCliente);

export default router;
