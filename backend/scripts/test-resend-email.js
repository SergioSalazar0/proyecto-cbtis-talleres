import dotenv from 'dotenv';
import { Resend } from 'resend';

dotenv.config();

const to = process.argv[2];

if (!to) {
    console.error('Uso: node scripts/test-resend-email.js correo@destino.com');
    process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM_ADDRESS;
const fromName = process.env.EMAIL_FROM_NAME || 'Sistema Talleres CBTIS 258';

if (!apiKey) {
    console.error('Falta RESEND_API_KEY en .env');
    process.exit(1);
}

if (!fromAddress) {
    console.error('Falta EMAIL_FROM_ADDRESS en .env');
    process.exit(1);
}

const resend = new Resend(apiKey);

const response = await resend.emails.send({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject: '[CBTIS 258] Prueba de correo con Resend',
    text: 'Si recibiste este correo, la integracion con Resend funciona correctamente.',
    html: '<p>Si recibiste este correo, la integracion con <strong>Resend</strong> funciona correctamente.</p>'
});

if (response?.error) {
    console.error('Error de Resend:', response.error.message || response.error);
    process.exit(1);
}

console.log('Correo de prueba enviado correctamente.');
console.log('Email ID:', response?.data?.id || 'N/A');
