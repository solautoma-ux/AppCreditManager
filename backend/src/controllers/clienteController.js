import { clienteService } from '../services/clienteService.js';
import { errorHandler } from '../utils/errorHandler.js';

export const getClientes = async (req, res) => {
    try {
        // Aislamiento de Datos: Determinamos el admin_id según el rol
        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);
        
        const arr_clientes = await clienteService.getClientes(str_adminId);
        res.json(arr_clientes);
    } catch (error) {
        errorHandler(res, error, 'getClientes');
    }
};

export const createCliente = async (req, res) => {
    try {
        const obj_clientData = req.body;
        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);
        // creado_por_id también debe usar el ID real de la tabla usuarios
        const str_creadoPorId = str_dbId;

        if (!obj_clientData.cedula || !obj_clientData.nombre) {
            return res.status(400).json({ error: 'Faltan datos requeridos (cédula, nombre)' });
        }

        const result = await clienteService.createCliente(obj_clientData, str_adminId, str_creadoPorId);
        res.status(201).json(result);
    } catch (error) {
        errorHandler(res, error, 'createCliente');
    }
};

export const updateCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const obj_updates = req.body;
        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);

        const result = await clienteService.updateCliente(id, obj_updates, str_adminId);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'updateCliente');
    }
};

export const checkCedulaExists = async (req, res) => {
    try {
        const { cedula } = req.query;
        if (!cedula) return res.status(400).json({ error: 'Se requiere cédula' });

        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);
        const result = await clienteService.checkCedulaExists(cedula, str_adminId);
        
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'checkCedulaExists');
    }
};

export const linkClienteToEncargado = async (req, res) => {
    try {
        const { id } = req.params;
        const { encargado_id } = req.body;

        const result = await clienteService.linkClienteToEncargado(id, encargado_id);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'linkClienteToEncargado');
    }
};

export const archivarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);

        const result = await clienteService.archivarCliente(id, str_adminId);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'archivarCliente');
    }
};

export const activarCliente = async (req, res) => {
    try {
        const { id } = req.params;
        const str_dbId = req.user.db_id || req.user.id;
        const str_adminId = req.user.rol === 'admin' ? str_dbId : (req.user.admin_padre_id || str_dbId);

        const result = await clienteService.activarCliente(id, str_adminId);
        res.json(result);
    } catch (error) {
        errorHandler(res, error, 'activarCliente');
    }
};
