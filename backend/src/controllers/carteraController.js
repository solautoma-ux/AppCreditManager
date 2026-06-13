import { carteraService } from '../services/carteraService.js';
import { errorHandler } from '../utils/errorHandler.js';

export const getCarteras = async (req, res) => {
    try {
        // Pasamos el token del usuario para que Supabase aplique RLS exactamente como el frontend original
        const arr_carteras = await carteraService.getCarteras(req.userToken);
        res.json(arr_carteras);
    } catch (error) {
        errorHandler(res, error, 'getCarteras');
    }
};

export const createCartera = async (req, res) => {
    try {
        const obj_carteraData = req.body;
        // db_id = ID real en tabla usuarios (admin_id en carteras)
        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);
        
        obj_carteraData.admin_id = str_adminId;

        if (!obj_carteraData.nombre || !obj_carteraData.monto_inicial) {
            return res.status(400).json({ error: 'Faltan datos requeridos (nombre, monto_inicial)' });
        }

        const result = await carteraService.createCartera(obj_carteraData);
        res.status(201).json(result);
    } catch (error) {
        errorHandler(res, error, 'createCartera');
    }
};

export const updateCartera = async (req, res) => {
    try {
        const { id } = req.params;
        const obj_updates = req.body;
        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);

        const result = await carteraService.updateCartera(id, obj_updates, str_adminId);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'updateCartera');
    }
};

export const archivarCartera = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await carteraService.archivarCartera(id);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'archivarCartera');
    }
};

export const deleteCarteraSeguro = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await carteraService.deleteCarteraSeguro(id);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'deleteCarteraSeguro');
    }
};

export const assignEncargado = async (req, res) => {
    try {
        const { id } = req.params;
        const { encargado_id } = req.body;
        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : req.user.admin_padre_id;

        if (!encargado_id) return res.status(400).json({ error: 'Falta encargado_id' });

        const result = await carteraService.assignEncargado(id, encargado_id, str_adminId);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'assignEncargado');
    }
};

export const removeEncargado = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await carteraService.removeEncargado(id);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'removeEncargado');
    }
};

export const getCarteraEncargado = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await carteraService.getCarteraEncargado(id);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'getCarteraEncargado');
    }
};

export const getCarteraDetalle = async (req, res) => {
    try {
        const { id } = req.params;
        // Para más seguridad, podríamos validar que el user tiene acceso a esta cartera
        const result = await carteraService.getCarteraDetalle(id);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'getCarteraDetalle');
    }
};

export const retirarUtilidad = async (req, res) => {
    try {
        const { id } = req.params;
        const { monto, notas } = req.body;
        const str_userToken = req.userToken;

        if (!monto) return res.status(400).json({ error: 'Falta el monto a retirar' });

        const result = await carteraService.retirarUtilidad(str_userToken, id, monto, notas);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'retirarUtilidad');
    }
};
