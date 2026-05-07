/**
 * Global Error Handler for Controllers
 * @param {object} res - Express response object
 * @param {Error} error - Error object caught
 * @param {string} context - Name of the function/context where the error occurred
 */
export const errorHandler = (res, error, context = 'Unknown') => {
    console.error(`[Error - ${context}]:`, error);

    // If it's a known Supabase error or specific logic error, we can handle it here.
    // For now, we return a generic 500 or the error message if it's safe.
    
    const statusCode = error.status || error.statusCode || 500;
    const message = error.message || 'Error interno del servidor';

    return res.status(statusCode).json({
        success: false,
        error: message
    });
};
