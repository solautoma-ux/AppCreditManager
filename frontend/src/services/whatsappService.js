/**
 * Service to handle WhatsApp interactions via URL Scheme (Click to Chat)
 * No API costs, runs purely on client side.
 */

export const whatsappService = {
    /**
     * Generates a WhatsApp Click-to-Chat URL
     * @param {string} phone - Client phone number (e.g., '3001234567')
     * @param {string} message - Message to pre-fill
     * @returns {string} - The full URL
     */
    generateLink: (phone, message) => {
        if (!phone) return '#';

        // 1. Remove ALL non-digit characters (spaces, +, -, etc.)
        let cleanPhone = phone.replace(/\D/g, '');

        // 2. Handle accidental double country code (e.g. "5757..." from "+57 57...")
        // Only if starts with "5757" and length suggests duplication
        if (cleanPhone.startsWith('5757') && cleanPhone.length > 12) {
            cleanPhone = cleanPhone.substring(2); // Remove first "57"
        }

        // 3. Default to Colombia (57) if no country code detected (10 digits = local)
        const finalPhone = cleanPhone.length === 10 ? `57${cleanPhone}` : cleanPhone;

        const encodedMessage = encodeURIComponent(message || '');
        return `https://wa.me/${finalPhone}?text=${encodedMessage}`;
    },

    /**
     * Opens the WhatsApp chat in a new tab immediately
     * @param {string} phone 
     * @param {string} message 
     * @param {string} customSuffix - Optional custom message to append (from admin config)
     */
    sendTo: (phone, message, customSuffix = '') => {
        // Append custom suffix if provided
        const fullMessage = customSuffix ? `${message} ${customSuffix}` : message;
        const url = whatsappService.generateLink(phone, fullMessage);
        window.open(url, '_blank');
    }
};
