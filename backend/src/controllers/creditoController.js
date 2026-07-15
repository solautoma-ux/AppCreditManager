import * as creditoService from '../services/creditoService.js';
import { errorHandler } from '../utils/errorHandler.js';

export const simularCredito = async (req, res) => {
    try {
        const { capital, tasa, numeroCuotas, frecuencia, fechaInicio } = req.body;
        
        if (!capital || !tasa || !numeroCuotas || !frecuencia || !fechaInicio) {
            return res.status(400).json({ error: 'Faltan parámetros para la simulación.' });
        }

        const obj_simulation = creditoService.simularCredito(
            parseFloat(capital),
            parseFloat(tasa),
            parseInt(numeroCuotas),
            frecuencia,
            fechaInicio
        );

        if (!obj_simulation) {
            return res.status(400).json({ error: 'No se pudo generar la simulación.' });
        }

        res.status(200).json({ success: true, data: obj_simulation });
    } catch (error) {
        errorHandler(res, error, 'simularCredito');
    }
};

export const createCredito = async (req, res) => {
    try {
        const obj_creditoData = req.body;
        // Usar admin_id proporcionado por el frontend o resolverlo
        const str_adminId = obj_creditoData.admin_id || req.user.db_id || req.user.id;

        if (!obj_creditoData.cartera_id || !obj_creditoData.cliente_id || !obj_creditoData.monto_capital) {
            return res.status(400).json({ error: 'Faltan parámetros para crear el crédito.' });
        }

        const obj_result = await creditoService.createCredito(obj_creditoData, str_adminId);
        res.status(201).json({ success: true, data: obj_result });
    } catch (error) {
        errorHandler(res, error, 'createCredito');
    }
};

/**
 * Controlador para manejar la solicitud HTTP de refinanciar un crédito.
 * Recibe el ID del crédito original y los nuevos términos para procesarlos.
 * @param {Object} req - Objeto de solicitud Express.
 * @param {Object} res - Objeto de respuesta Express.
 */
export const refinanciarCredito = async (req, res) => {
    try {
        const { id: str_id } = req.params;
        const obj_newCreditoData = req.body;
        const str_adminId = obj_newCreditoData.admin_id || req.user.db_id || req.user.id;

        if (!str_id || !obj_newCreditoData.monto_capital) {
            return res.status(400).json({ error: 'Faltan parámetros para refinanciar.' });
        }

        const obj_result = await creditoService.refinanciarCredito(str_id, obj_newCreditoData, str_adminId);
        res.status(201).json({ success: true, data: obj_result });
    } catch (error) {
        errorHandler(res, error, 'refinanciarCredito');
    }
};

export const updateCredito = async (req, res) => {
    try {
        const { id: str_id } = req.params;
        const obj_updates = req.body;
        const str_adminId = req.user.rol === 'admin' ? (req.user.db_id || req.user.id) : (req.user.admin_padre_id || req.user.id);

        const obj_result = await creditoService.updateCredito(str_id, obj_updates, str_adminId);
        res.json(obj_result);
    } catch (error) {
        errorHandler(res, error, 'updateCredito');
    }
};

/**
 * NEW METHODS
 */

export const getCreditos = async (req, res) => {
    try {
        const str_adminId = req.user.rol === 'admin' ? (req.user.db_id || req.user.id) : (req.user.admin_padre_id || req.user.id);
        const arr_creditos = await creditoService.getCreditos(str_adminId);
        res.json(arr_creditos);
    } catch (error) {
        errorHandler(res, error, 'getCreditos');
    }
};

export const getCreditosByCliente = async (req, res) => {
    try {
        const { clienteId: str_clienteId } = req.params;
        const str_adminId = req.user.rol === 'admin' ? (req.user.db_id || req.user.id) : (req.user.admin_padre_id || req.user.id);

        if (!str_clienteId) {
            return res.status(400).json({ error: 'Falta el ID del cliente.' });
        }

        const arr_creditos = await creditoService.getCreditosByCliente(str_clienteId, str_adminId);
        res.json(arr_creditos);
    } catch (error) {
        errorHandler(res, error, 'getCreditosByCliente');
    }
};

export const buscarCreditosPorCliente = async (req, res) => {
    try {
        const { term: str_term } = req.query;
        const str_adminId = req.user.rol === 'admin' ? (req.user.db_id || req.user.id) : (req.user.admin_padre_id || req.user.id);

        if (!str_term) {
            return res.status(400).json({ error: 'Falta el término de búsqueda.' });
        }

        const arr_creditos = await creditoService.buscarCreditosPorCliente(str_term, str_adminId);
        res.json(arr_creditos);
    } catch (error) {
        errorHandler(res, error, 'buscarCreditosPorCliente');
    }
};

export const verificarVencimientos = async (req, res) => {
    try {
        const str_adminId = req.user.rol === 'admin' ? (req.user.db_id || req.user.id) : (req.user.admin_padre_id || req.user.id);
        const obj_result = await creditoService.verificarVencimientos(str_adminId);
        res.json(obj_result);
    } catch (error) {
        errorHandler(res, error, 'verificarVencimientos');
    }
};

export const deleteCreditoSeguro = async (req, res) => {
    try {
        const { id: str_creditoId } = req.params;
        const str_adminId = req.user.rol === 'admin' ? (req.user.db_id || req.user.id) : (req.user.admin_padre_id || req.user.id);
        const str_userRol = req.user.rol;

        if (!str_creditoId) {
            return res.status(400).json({ error: 'Falta el ID del crédito.' });
        }

        const obj_result = await creditoService.deleteCreditoSeguro(str_creditoId, str_adminId, str_userRol);
        res.json(obj_result);
    } catch (error) {
        errorHandler(res, error, 'deleteCreditoSeguro');
    }
};

export const liquidarCreditoForzado = async (req, res) => {
    try {
        const { id: str_creditoId } = req.params;
        const str_adminId = req.user.rol === 'admin' ? (req.user.db_id || req.user.id) : (req.user.admin_padre_id || req.user.id);
        const str_userRol = req.user.rol;

        if (!str_creditoId) {
            return res.status(400).json({ error: 'Falta el ID del crédito.' });
        }

        const obj_result = await creditoService.liquidarCreditoForzado(str_creditoId, str_adminId, str_userRol);
        res.json(obj_result);
    } catch (error) {
        errorHandler(res, error, 'liquidarCreditoForzado');
    }
};
