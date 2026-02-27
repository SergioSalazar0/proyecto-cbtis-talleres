import nodemailer from 'nodemailer';

let transporter = null;

const getEnvBoolean = (value, defaultValue = false) => {
    if (value === undefined) return defaultValue;
    return String(value).toLowerCase() === 'true';
};

const isEmailEnabled = () => getEnvBoolean(process.env.EMAIL_ENABLED, false);

const getEmailConfig = () => {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = getEnvBoolean(process.env.SMTP_SECURE, false);
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    return {
        host,
        port,
        secure,
        user,
        pass,
        fromName: process.env.EMAIL_FROM_NAME || 'Sistema Talleres CBTIS 258',
        fromAddress: process.env.EMAIL_FROM_ADDRESS || user
    };
};

const getTransporter = () => {
    if (transporter) {
        return transporter;
    }

    const config = getEmailConfig();

    if (!config.user || !config.pass) {
        return null;
    }

    transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        }
    });

    return transporter;
};

export const canSendEmails = () => {
    if (!isEmailEnabled()) return false;
    const config = getEmailConfig();
    return Boolean(config.user && config.pass);
};

export const sendBulkEmail = async ({ recipients, subject, text, html }) => {
    if (!canSendEmails()) {
        return {
            sent: false,
            reason: 'EMAIL_DISABLED_OR_NOT_CONFIGURED'
        };
    }

    const validRecipients = (recipients || [])
        .map(email => String(email || '').trim())
        .filter(Boolean);

    if (validRecipients.length === 0) {
        return {
            sent: false,
            reason: 'NO_RECIPIENTS'
        };
    }

    const emailTransporter = getTransporter();

    if (!emailTransporter) {
        return {
            sent: false,
            reason: 'TRANSPORTER_NOT_AVAILABLE'
        };
    }

    const config = getEmailConfig();

    const info = await emailTransporter.sendMail({
        from: `"${config.fromName}" <${config.fromAddress}>`,
        to: config.fromAddress,
        bcc: validRecipients,
        subject,
        text,
        html
    });

    return {
        sent: true,
        messageId: info.messageId,
        recipients: validRecipients.length
    };
};
