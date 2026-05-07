import express from 'express';
import { authenticate } from '../middleware/authMiddleware.js';
import * as reportController from '../controllers/reportController.js';

const router = express.Router();

router.use(authenticate);

router.get('/kpis', reportController.getFinancialKPIs);
router.get('/morosidad', reportController.getDetailedMorosidad);
router.get('/movimientos', reportController.getDetailedMovements);

export default router;
