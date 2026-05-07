import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import * as creditoController from '../controllers/creditoController.js';

const router = express.Router();

// All credit routes are protected by authentication
router.use(authenticate);

router.get('/', creditoController.getCreditos);
router.get('/buscar', creditoController.buscarCreditosPorCliente);
router.get('/cliente/:clienteId', creditoController.getCreditosByCliente);
router.post('/vencimientos', creditoController.verificarVencimientos);

router.post('/simular', creditoController.simularCredito);
router.post('/crear', creditoController.createCredito);
router.post('/refinanciar/:id', creditoController.refinanciarCredito);
router.put('/:id', creditoController.updateCredito);

router.delete('/:id/seguro', creditoController.deleteCreditoSeguro);
router.post('/:id/liquidar', creditoController.liquidarCreditoForzado);

export default router;
