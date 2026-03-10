import { Resend } from 'resend';

let resendClient = null;

const getEnvBoolean = (value, defaultValue = false) => {
    if (value === undefined) return defaultValue;
    return String(value).toLowerCase() === 'true';
};

const isEmailEnabled = () => getEnvBoolean(process.env.EMAIL_ENABLED, false);

const getEmailConfig = () => {
    const apiKey = process.env.RESEND_API_KEY;
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;

    return {
        apiKey,
        fromName: process.env.EMAIL_FROM_NAME || 'Sistema Talleres CBTIS 258',
        fromAddress
    };
};

const getResendClient = () => {
    if (resendClient) {
        return resendClient;
    }

    const config = getEmailConfig();

    if (!config.apiKey) {
        return null;
    }

    resendClient = new Resend(config.apiKey);

    return resendClient;
};

export const canSendEmails = () => {
    if (!isEmailEnabled()) return false;
    const config = getEmailConfig();
    return Boolean(config.apiKey && config.fromAddress);
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

    const client = getResendClient();

    if (!client) {
        return {
            sent: false,
            reason: 'RESEND_CLIENT_NOT_AVAILABLE'
        };
    }

    const config = getEmailConfig();

    const response = await client.emails.send({
        from: `"${config.fromName}" <${config.fromAddress}>`,
        to: config.fromAddress,
        bcc: validRecipients,
        subject,
        text,
        html
    });

    if (response?.error) {
        return {
            sent: false,
            reason: 'RESEND_SEND_ERROR',
            error: response.error.message || 'Error desconocido de Resend'
        };
    }

    return {
        sent: true,
        messageId: response?.data?.id || null,
        recipients: validRecipients.length
    };
};
