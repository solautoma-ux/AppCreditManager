import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    // Force Node's socket to strictly use IPv4
    tls: {
        rejectUnauthorized: false
    },
    // Nodemailer passthrough to net.connect
    family: 4 
});

// Verify connection configuration
transporter.verify(function (error, success) {
    if (error) {
        console.error('❌ Nodemailer Error:', error);
    } else {
        console.log('✅ Server is ready to take our messages. Email User:', process.env.EMAIL_USER);
    }
});

/**
 * Send an email
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
export const sendEmail = async (to, subject, html) => {
    try {
        const info = await transporter.sendMail({
            from: `"Control Créditos" <${process.env.EMAIL_USER}>`, // sender address
            to, // list of receivers
            subject, // Subject line
            html, // html body
        });

        console.log("Message sent: %s", info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error };
    }
};

/**
 * Send welcome email to new user
 * @param {string} email - User email
 * @param {string} nombre - User name
 * @param {string} rol - User role
 * @param {string} password - Temporary password (if applicable) or just link
 */
export const sendWelcomeEmail = async (email, nombre, rol) => {
    const loginUrl = `${process.env.FRONTEND_URL}/login`; // Configurable URL

    const subject = `Bienvenido al ${process.env.APP_NAME}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #4F46E5;">¡Hola, ${nombre}! 👋</h2>
            <p>Has sido registrado como <strong>${rol.toUpperCase()}</strong> en el Sistema de Control de Créditos.</p>
            
            <p>Para comenzar, por favor inicia sesión con tu cuenta de Google asociada a este correo (${email}).</p>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Ingresar al Sistema
                </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">Si no reconoce este registro, por favor ignore este correo.</p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">${process.env.APP_NAME} © ${new Date().getFullYear()}</p>
        </div>
    `;

    return sendEmail(email, subject, html);
};
