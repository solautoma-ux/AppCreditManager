import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import * as pagoController from '../controllers/pagoController.js';

const router = express.Router();

// Todas las rutas de pagos requieren autenticación
router.use(authenticate);

// Rutas de Pagos
router.post('/registrar', pagoController.registrarPago);
router.post('/reprogramar', pagoController.reprogramarCredito);
router.post('/deshacer/:id', pagoController.deshacerPago);
router.get('/credito/:creditoId', pagoController.getPagosCredito);
router.get('/credito-detalle/:creditoId', pagoController.getCreditoDetalle);

export default router;
