import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Cliente de Resend inicializado con la API Key del entorno.
 * Render permite conexiones HTTP salientes (a diferencia de SMTP puerto 587/465).
 */
const resend = new Resend(process.env.RESEND_API_KEY);

/** Dirección remitente configurable desde variables de entorno */
const str_emailFrom = process.env.EMAIL_FROM || 'noreply@resend.dev';

/**
 * Envía un email genérico usando la API de Resend.
 * @param {string} to - Email del destinatario
 * @param {string} subject - Asunto del email
 * @param {string} html - Contenido HTML del email
 * @returns {{ success: boolean, messageId?: string, error?: any }}
 */
export const sendEmail = async (to, subject, html) => {
    try {
        const { data, error } = await resend.emails.send({
            from: `Control Créditos <${str_emailFrom}>`,
            to,
            subject,
            html
        });

        if (error) {
            console.error('❌ Resend error:', error);
            return { success: false, error };
        }

        console.log('✅ Email enviado correctamente. ID:', data.id);
        return { success: true, messageId: data.id };

    } catch (err) {
        console.error('❌ Error inesperado enviando email:', err);
        return { success: false, error: err };
    }
};

/**
 * Envía el email de bienvenida/invitación a un nuevo usuario del sistema.
 * @param {string} email - Email del usuario
 * @param {string} nombre - Nombre del usuario
 * @param {string} rol - Rol asignado (admin, encargado)
 */
export const sendWelcomeEmail = async (email, nombre, rol) => {
    const str_loginUrl = `${process.env.FRONTEND_URL}/login`;
    const str_appName = process.env.APP_NAME || 'Control de Créditos';

    const str_subject = `Bienvenido al ${str_appName}`;

    const str_html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #4F46E5;">¡Hola, ${nombre}! 👋</h2>
            <p>Has sido registrado como <strong>${rol.toUpperCase()}</strong> en el Sistema de Control de Créditos.</p>
            
            <p>Para comenzar, por favor inicia sesión con tu cuenta de Google asociada a este correo (<strong>${email}</strong>).</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${str_loginUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Ingresar al Sistema
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Si no reconoces este registro, por favor ignora este correo.</p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">${str_appName} © ${new Date().getFullYear()}</p>
        </div>
    `;

    return sendEmail(email, str_subject, str_html);
};
