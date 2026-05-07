/**
 * Utilidades compartidas para cálculos financieros y de fechas en el frontend.
 * Abstrae la lógica de negocio para no contaminar los componentes visuales.
 */

/**
 * Calcula los días de atraso (mora) comparando la fecha de vencimiento con la fecha actual.
 * @param {string} str_date - Fecha de vencimiento en formato YYYY-MM-DD
 * @returns {number} int_diffDays - Días de mora (0 si no está vencido)
 */
export const calculateDaysOverdue = (str_date) => {
    if (!str_date) return 0;
    const [int_year, int_month, int_day] = str_date.split('-').map(Number);
    const date_due = new Date(int_year, int_month - 1, int_day); // Local 00:00:00
    const date_today = new Date();
    date_today.setHours(0, 0, 0, 0); // Local 00:00:00

    const int_diffTime = date_today - date_due;
    const int_diffDays = Math.floor(int_diffTime / (1000 * 60 * 60 * 24));
    
    return int_diffDays > 0 ? int_diffDays : 0;
};
