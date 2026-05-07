import * as reportService from '../services/reportService.js';
import { errorHandler } from '../utils/errorHandler.js';

export const getFinancialKPIs = async (req, res) => {
    try {
        const { fechaInicio: str_fechaInicio, fechaFin: str_fechaFin, carteraId: str_carteraId } = req.query;
        const str_rol = req.user.rol;
        const str_dbId = req.user.db_id || req.user.id;

        if (!str_fechaInicio || !str_fechaFin) {
            return res.status(400).json({ error: 'Faltan fechas obligatorias para los KPIs.' });
        }

        let str_adminId = null;
        let str_encargadoId = null;

        if (str_rol === 'admin') {
            str_adminId = str_dbId;
        } else if (str_rol === 'encargado') {
            str_encargadoId = str_dbId;
        }
        // Super Admin ve todo

        const obj_kpis = await reportService.getFinancialKPIs(str_fechaInicio, str_fechaFin, str_carteraId, str_adminId, str_encargadoId);
        res.json(obj_kpis);
    } catch (error) {
        errorHandler(res, error, 'getFinancialKPIs');
    }
};

export const getDetailedMorosidad = async (req, res) => {
    try {
        const { carteraId: str_carteraId } = req.query;
        const str_rol = req.user.rol;
        const str_dbId = req.user.db_id || req.user.id;

        let str_adminId = null;
        let str_encargadoId = null;

        if (str_rol === 'admin') {
            str_adminId = str_dbId;
        } else if (str_rol === 'encargado') {
            str_encargadoId = str_dbId;
        }

        const arr_morosidad = await reportService.getDetailedMorosidad(str_carteraId, str_adminId, str_encargadoId);
        res.json(arr_morosidad);
    } catch (error) {
        errorHandler(res, error, 'getDetailedMorosidad');
    }
};

export const getDetailedMovements = async (req, res) => {
    try {
        const { fechaInicio: str_fechaInicio, fechaFin: str_fechaFin, carteraId: str_carteraId } = req.query;
        const str_rol = req.user.rol;
        const str_dbId = req.user.db_id || req.user.id;

        if (!str_fechaInicio || !str_fechaFin) {
            return res.status(400).json({ error: 'Faltan fechas obligatorias para los movimientos.' });
        }

        let str_adminId = null;
        let str_encargadoId = null;

        if (str_rol === 'admin') {
            str_adminId = str_dbId;
        } else if (str_rol === 'encargado') {
            str_encargadoId = str_dbId;
        }

        const arr_movements = await reportService.getDetailedMovements(str_fechaInicio, str_fechaFin, str_carteraId, str_adminId, str_encargadoId);
        res.json(arr_movements);
    } catch (error) {
        errorHandler(res, error, 'getDetailedMovements');
    }
};
