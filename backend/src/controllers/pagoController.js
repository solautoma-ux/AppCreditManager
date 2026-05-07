import { pagoService } from '../services/pagoService.js';
import { errorHandler } from '../utils/errorHandler.js';

export const registrarPago = async (req, res) => {
    try {
        const str_userToken = req.userToken;
        const str_dbId = req.user.db_id || req.user.id;
        
        const {
            credito_id, 
            monto_total, 
            monto_a_capital, 
            monto_a_interes, 
            fecha_pago, 
            notas
        } = req.body;

        if (!credito_id || monto_total === undefined || monto_a_capital === undefined || monto_a_interes === undefined || !fecha_pago) {
            return res.status(400).json({ error: 'Faltan parámetros obligatorios para registrar el pago.' });
        }

        const obj_pagoData = {
            str_creditoId: credito_id,
            dbl_montoTotal: monto_total,
            dbl_montoCapital: monto_a_capital,
            dbl_montoInteres: monto_a_interes,
            date_fechaPago: fecha_pago,
            str_notas: notas
        };

        const result = await pagoService.registrarPago(str_userToken, obj_pagoData, str_dbId);
        res.status(201).json({ success: true, data: result });
    } catch (error) {
        errorHandler(res, error, 'registrarPago');
    }
};

export const reprogramarCredito = async (req, res) => {
    try {
        const str_userToken = req.userToken;
        const { credito_id, nueva_fecha } = req.body;

        if (!credito_id || !nueva_fecha) {
            return res.status(400).json({ error: 'Faltan parámetros obligatorios para reprogramar.' });
        }

        const result = await pagoService.reprogramarCredito(str_userToken, credito_id, nueva_fecha);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        errorHandler(res, error, 'reprogramarCredito');
    }
};

export const deshacerPago = async (req, res) => {
    try {
        const str_userToken = req.userToken;
        const str_dbId = req.user.db_id || req.user.id;
        const { id } = req.params; // pago_id

        if (!id) {
            return res.status(400).json({ error: 'Falta el ID del pago a deshacer.' });
        }

        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);

        const result = await pagoService.deshacerPago(str_userToken, id, str_adminId);
        res.status(200).json({ success: true, data: result });
    } catch (error) {
        errorHandler(res, error, 'deshacerPago');
    }
};

export const getPagosCredito = async (req, res) => {
    try {
        const str_userToken = req.userToken;
        const { creditoId } = req.params;

        if (!creditoId) {
            return res.status(400).json({ error: 'Falta el ID del crédito.' });
        }

        const arr_pagos = await pagoService.getPagosCredito(str_userToken, creditoId);
        res.status(200).json(arr_pagos);
    } catch (error) {
        errorHandler(res, error, 'getPagosCredito');
    }
};

export const getCreditoDetalle = async (req, res) => {
    try {
        const str_userToken = req.userToken;
        const { creditoId } = req.params;

        if (!creditoId) {
            return res.status(400).json({ error: 'Falta el ID del crédito.' });
        }

        const obj_detalle = await pagoService.getCreditoDetalle(str_userToken, creditoId);
        res.status(200).json(obj_detalle);
    } catch (error) {
        errorHandler(res, error, 'getCreditoDetalle');
    }
};
