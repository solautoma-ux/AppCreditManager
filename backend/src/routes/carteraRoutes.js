import express from 'express';
import {
    getCarteras,
    createCartera,
    updateCartera,
    archivarCartera,
    deleteCarteraSeguro,
    assignEncargado,
    removeEncargado,
    getCarteraEncargado,
    getCarteraDetalle,
    retirarUtilidad
} from '../controllers/carteraController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getCarteras);
router.post('/', createCartera);
router.put('/:id', updateCartera);
router.post('/:id/archivar', archivarCartera);
router.delete('/:id/seguro', deleteCarteraSeguro);
router.post('/:id/encargado', assignEncargado);
router.delete('/:id/encargado', removeEncargado);
router.get('/:id/encargado', getCarteraEncargado);
router.get('/:id/detalle', getCarteraDetalle);
router.post('/:id/retiro', retirarUtilidad);

export default router;
