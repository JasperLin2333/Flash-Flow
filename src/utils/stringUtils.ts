/**
 * String Utilities
 * 
 * Shared utility functions for string manipulation.
 */

/**
 * Clean code by removing markdown code block markers
 * 
 * Handles various markdown formats:
 * - \`\`\`python ... \`\`\`
 * - \`\`\`javascript ... \`\`\`
 * - \`\`\` ... \`\`\`
 * 
 * @param code - Raw code string possibly wrapped in markdown
 * @returns Cleaned code without markdown fences
 */
export function cleanCodeBlock(code: string): string {
    // Remove markdown code blocks like \`\`\`python...\`\`\` or \`\`\`...\`\`\`
    let cleaned = code.trim();

    // Remove opening code fence with optional language
    cleaned = cleaned.replace(/^```\w*\n?/m, '');

    // Remove closing code fence
    cleaned = cleaned.replace(/\n?```$/m, '');

    return cleaned.trim();
}
