/**
 * MIME Type Utilities
 * 
 * Shared utilities for determining file MIME types based on filename/extension.
 */

/**
 * Get MIME type from filename based on extension
 */
export function getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
        // Documents
        'pdf': 'application/pdf',
        'txt': 'text/plain',
        'md': 'text/markdown',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'html': 'text/html',
        'json': 'application/json',
        'csv': 'text/csv',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'xls': 'application/vnd.ms-excel',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Images
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        // Code
        'py': 'text/x-python',
        'js': 'text/javascript',
        'ts': 'text/typescript',
        'jsx': 'text/javascript',
        'tsx': 'text/typescript',
        'java': 'text/x-java-source',
        'cpp': 'text/x-c++src',
        'c': 'text/x-csrc',
        'h': 'text/x-chdr',
        'cs': 'text/x-csharp',
        'go': 'text/x-go',
        'rb': 'text/x-ruby',
        'php': 'text/x-php',
        'sh': 'text/x-shellscript',
        'yaml': 'text/yaml',
        'yml': 'text/yaml',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
}

/**
 * Convert any value to string representation
 */
export function valueToString(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}
