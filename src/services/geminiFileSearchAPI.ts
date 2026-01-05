/**
 * Gemini File Search API Constants
 * 
 * Constants for RAG file upload validation.
 * All API calls are handled via server-side API routes (/api/rag/*).
 */

// ============ Constants ============
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const MAX_FILE_COUNT = 3;
export const DEFAULT_MAX_TOKENS_PER_CHUNK = 200;
export const DEFAULT_MAX_OVERLAP_TOKENS = 20;

// Supported extensions for UI validation (Broad Gemini API Support)
export const SUPPORTED_FILE_EXTENSIONS = [
    // Documents & Text
    '.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.json', '.csv', '.xlsx', '.xls', '.pptx',
    // Images
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
    // Code
    '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rb', '.php', '.sh', '.yaml', '.yml'
];
