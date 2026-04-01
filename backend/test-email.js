import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const testEmail = async () => {
    console.log('--- Email Configuration Test ---');
    console.log('Host:', process.env.EMAIL_HOST);
    console.log('User:', process.env.EMAIL_USER);
    console.log('Pass:', process.env.EMAIL_PASS ? '********' : '(not set)');

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        console.log('Verifying transporter connection...');
        await transporter.verify();
        console.log('✅ SMTP Connection successful!');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to self
            subject: 'Test Email from Credit System',
            text: 'If you receive this, the email configuration is working correctly.'
        };

        console.log('Sending test email...');
        const info = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully!');
        console.log('Message ID:', info.messageId);

    } catch (error) {
        console.error('❌ Error testing email:');
        console.error(error);
    }
};

testEmail();
