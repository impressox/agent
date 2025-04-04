/**
 * Format message based on client platform type
 * @param text Message text with markdown formatting
 * @param clientType Client platform type (e.g., 'telegram', 'discord')
 * @returns Formatted message string
 */
export const formatClientMessage = (text: string, clientType?: string): string => {
    if (!clientType) return text;

    switch (clientType.toLowerCase()) {
        case 'telegram':
            return text
                .replace(/\*\*/g, '*')     // Bold
                .replace(/\`\`\`/g, '`')    // Code blocks
                .replace(/\`/g, '`')        // Inline code
                .replace(/❌/g, '⛔️')        // Error emoji
                .replace(/💡/g, '💭')        // Suggestion emoji
                .replace(/\_(.+?)\_/g, '_$1_'); // Italics

        case 'discord':
            return text
                .replace(/\*/g, '**')       // Bold
                .replace(/\`/g, '```')      // Code blocks
                .replace(/⌛/g, '<a:loading:123>') // Custom loading emoji
                .replace(/\_(.+?)\_/g, '*$1*');   // Italics

        default:
            // Remove markdown for plain text
            return text
                .replace(/\*\*/g, '')       // Remove bold
                .replace(/\`\`\`/g, '')     // Remove code blocks
                .replace(/\_/g, '')         // Remove italics
                .replace(/\`/g, '');        // Remove inline code
    }
};
