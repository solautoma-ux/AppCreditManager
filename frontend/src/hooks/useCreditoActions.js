import { useState } from 'react';
import { creditoService } from '../services/creditoService';
import { useToast } from '../context/ToastContext';

/**
 * Hook personalizado para manejar las acciones globales de los créditos (eliminar e interrumpir).
 * Centraliza la lógica de estado de los diálogos y las peticiones al backend respetando el principio DRY.
 * @param {Function} onActionSuccess - Callback que se ejecuta cuando una acción se completa con éxito (ej. recargar datos)
 * @returns {Object} Estado y manejadores para las acciones de los créditos
 */
export const useCreditoActions = (onActionSuccess) => {
    const { showToast } = useToast();
    const [obj_deleteDialog, setDeleteDialog] = useState({ open: false, credito: null, loading: false });
    const [obj_liquidateDialog, setLiquidateDialog] = useState({ open: false, credito: null, loading: false });

    const handleDeleteClick = (credito) => {
        setDeleteDialog({ open: true, credito, loading: false });
    };

    const closeDeleteDialog = () => {
        setDeleteDialog({ open: false, credito: null, loading: false });
    };

    /**
     * Confirma y ejecuta la eliminación segura de un crédito activo sin pagos.
     * @async
     */
    const handleDeleteConfirm = async () => {
        if (!obj_deleteDialog.credito) return;
        setDeleteDialog(prev => ({ ...prev, loading: true }));
        try {
            const obj_result = await creditoService.deleteCreditoSeguro(obj_deleteDialog.credito.id);
            if (obj_result.success) {
                showToast(obj_result.message, 'success');
                if (onActionSuccess) onActionSuccess();
            } else {
                showToast(obj_result.message, 'warning');
            }
        } catch (obj_err) {
            showToast('Error al eliminar: ' + obj_err.message, 'error');
        } finally {
            closeDeleteDialog();
        }
    };

    const handleLiquidateClick = (credito) => {
        setLiquidateDialog({ open: true, credito, loading: false });
    };

    const closeLiquidateDialog = () => {
        setLiquidateDialog({ open: false, credito: null, loading: false });
    };

    /**
     * Confirma y ejecuta la interrupción de un crédito marcándolo como pérdida.
     * @async
     */
    const handleLiquidateConfirm = async () => {
        if (!obj_liquidateDialog.credito) return;
        setLiquidateDialog(prev => ({ ...prev, loading: true }));
        try {
            const obj_result = await creditoService.liquidarCreditoForzado(obj_liquidateDialog.credito.id);
            if (obj_result.success) {
                showToast(obj_result.message, 'success');
                if (onActionSuccess) onActionSuccess();
            } else {
                showToast(obj_result.message, 'warning');
            }
        } catch (obj_err) {
            showToast('Error al liquidar: ' + obj_err.message, 'error');
        } finally {
            closeLiquidateDialog();
        }
    };

    return {
        obj_deleteDialog,
        obj_liquidateDialog,
        handleDeleteClick,
        handleDeleteConfirm,
        closeDeleteDialog,
        handleLiquidateClick,
        handleLiquidateConfirm,
        closeLiquidateDialog
    };
};
