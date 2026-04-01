import { supabase } from './supabaseClient';

/**
 * Service for Audit Log / Activity Registry
 * Super Admin: sees everything
 * Admin: sees only their own + their encargados' activities
 */
export const auditService = {
    /**
     * Obtiene los logs de actividad con filtros y paginación usando RPC
     * @param {Object} filters - Filtros opcionales
     * @param {string} filters.usuarioId - Filtrar por usuario específico
     * @param {string} filters.accion - Filtrar por tipo de acción
     * @param {string} filters.tabla - Filtrar por tabla afectada
     * @param {string} filters.fechaDesde - Fecha inicio (YYYY-MM-DD)
     * @param {string} filters.fechaHasta - Fecha fin (YYYY-MM-DD)
     * @param {number} limit - Límite de registros (default 50)
     * @param {number} offset - Offset para paginación
     * @param {string|null} adminId - ID del admin para filtrado por rol (null = super admin)
     * @param {Object} sortConfig - Configuración de ordenamiento { orderBy, order }
     */
    getActivityLogs: async (filters = {}, limit = 50, offset = 0, adminId = null, sortConfig = { orderBy: 'created_at', order: 'desc' }) => {
        try {
            const { data, error } = await supabase.rpc('get_audit_logs_by_role', {
                p_admin_id: adminId,
                p_usuario_filter: filters.usuarioId || null,
                p_accion: filters.accion || null,
                p_tabla: filters.tabla || null,
                p_fecha_desde: filters.fechaDesde ? `${filters.fechaDesde}T00:00:00Z` : null,
                p_fecha_hasta: filters.fechaHasta ? `${filters.fechaHasta}T23:59:59Z` : null,
                p_limit: limit,
                p_offset: offset,
                p_sort_column: sortConfig.orderBy || 'created_at',
                p_sort_order: sortConfig.order || 'desc'
            });

            if (error) throw error;

            // Transform RPC response to match expected format
            const logs = (data || []).map(row => ({
                id: row.id,
                usuario_id: row.usuario_id,
                accion: row.accion,
                tabla_afectada: row.tabla_afectada,
                registro_id: row.registro_id,
                campo_modificado: row.campo_modificado,
                valor_anterior: row.valor_anterior,
                valor_nuevo: row.valor_nuevo,
                ip_address: row.ip_address,
                entidad_codigo: row.entidad_codigo,
                created_at: row.created_at,
                usuario: row.usuario_nombre ? {
                    id: row.usuario_id,
                    nombre: row.usuario_nombre,
                    apellido: row.usuario_apellido,
                    email: row.usuario_email
                } : null
            }));

            // Get total from first row (all rows have same total_count)
            const total = data && data.length > 0 ? data[0].total_count : 0;

            return { data: logs, total };
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            throw error;
        }
    },

    /**
     * Obtiene la lista de acciones únicas para el filtro
     */
    getAcciones: () => ['crear', 'actualizar', 'eliminar', 'habilitar', 'inhabilitar', 'retiro'],

    /**
     * Obtiene la lista de tablas únicas registradas en audit_log
     */
    getTablasAfectadas: async () => {
        try {
            const { data, error } = await supabase
                .from('audit_log')
                .select('tabla_afectada')
                .order('tabla_afectada');

            if (error) throw error;

            // Obtener valores únicos
            const uniqueTables = [...new Set(data.map(d => d.tabla_afectada))];
            return uniqueTables;
        } catch (error) {
            console.error('Error fetching tables:', error);
            return [];
        }
    },

    /**
     * Obtiene usuarios que tienen actividad registrada (filtrado por rol)
     * @param {string|null} adminId - ID del admin para filtrado (null = super admin)
     */
    getUsuariosConActividad: async (adminId = null) => {
        try {
            const { data, error } = await supabase.rpc('get_audit_users_by_role', {
                p_admin_id: adminId
            });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching users with activity:', error);
            return [];
        }
    }
};
