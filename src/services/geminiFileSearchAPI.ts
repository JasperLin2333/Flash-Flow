/**
 * Gemini File Search API Service
 * Provides integration with Google Gemini File Search for RAG functionality
 */

import { GoogleGenAI } from '@google/genai';

// ============ Types ============
export interface FileSearchStore {
    name: string;
    displayName?: string;
    createTime?: string;
}

export interface UploadedFile {
    name: string;
    displayName?: string;
    sizeBytes?: number;
    createTime?: string;
}

export interface SearchResult {
    documents: string[];
    citations?: Array<{
        source: string;
        chunk: string;
    }>;
}

export interface UploadProgress {
    status: 'uploading' | 'processing' | 'completed' | 'error';
    progress?: number;
    message?: string;
}

interface RetrievalMetadataItem {
    source?: string;
    text?: string;
}

// ============ Constants ============
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const DEFAULT_MAX_TOKENS_PER_CHUNK = 200;
const DEFAULT_MAX_OVERLAP_TOKENS = 20;
const DEFAULT_TOP_K = 5;

// ============ API Client ============
class GeminiFileSearchAPI {
    private ai: GoogleGenAI | null = null;
    private apiKey: string | null = null;

    /**
     * 创建 GeminiFileSearchAPI 实例
     * @param apiKey 可选的 API Key，如果不提供则从环境变量读取
     *               支持依赖注入以便于单元测试
     */
    constructor(apiKey?: string) {
        this.apiKey = apiKey ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? null;
        if (this.apiKey) {
            this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        }
    }

    /**
     * 重新初始化 API 客户端（用于动态更新 API Key）
     */
    reinitialize(apiKey: string): void {
        this.apiKey = apiKey;
        this.ai = new GoogleGenAI({ apiKey });
    }

    /**
     * 检查 API 是否已配置
     */
    private ensureInitialized(): void {
        if (!this.ai || !this.apiKey) {
            throw new Error(
                'Gemini API Key not configured. Please set NEXT_PUBLIC_GEMINI_API_KEY in your environment variables.'
            );
        }
    }

    /**
     * 创建 File Search Store
     */
    async createFileSearchStore(displayName: string): Promise<FileSearchStore> {
        this.ensureInitialized();

        try {
            const fileSearchStore = await this.ai!.fileSearchStores.create({
                config: { displayName }
            });

            const storeName = fileSearchStore.name;
            if (!storeName) {
                throw new Error('Failed to create file search store: no name returned');
            }

            return {
                name: storeName,  // Now TypeScript knows it's definitely a string
                displayName: fileSearchStore.displayName,
                createTime: fileSearchStore.createTime
            };
        } catch (error) {
            console.error('[GeminiFileSearchAPI] createFileSearchStore error:', error);
            throw new Error(`Failed to create file search store: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 上传文件到 File Search Store
     */
    async uploadToFileSearchStore(
        file: File,
        fileSearchStoreName: string,
        options?: {
            displayName?: string;
            maxTokensPerChunk?: number;
            maxOverlapTokens?: number;
            onProgress?: (progress: UploadProgress) => void;
        }
    ): Promise<UploadedFile> {
        this.ensureInitialized();

        // 文件大小检查
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
        }

        try {
            options?.onProgress?.({ status: 'uploading', progress: 0, message: 'Starting upload...' });

            // 上传文件到 File Search Store
            let operation = await this.ai!.fileSearchStores.uploadToFileSearchStore({
                file: file,
                fileSearchStoreName,
                config: {
                    displayName: options?.displayName || file.name,
                    chunkingConfig: {
                        whiteSpaceConfig: {
                            maxTokensPerChunk: options?.maxTokensPerChunk || DEFAULT_MAX_TOKENS_PER_CHUNK,
                            maxOverlapTokens: options?.maxOverlapTokens || DEFAULT_MAX_OVERLAP_TOKENS
                        }
                    }
                }
            });

            options?.onProgress?.({ status: 'processing', progress: 50, message: 'Processing file...' });

            // 轮询等待操作完成
            let attempts = 0;
            const maxAttempts = 60; // 最多等待 5 分钟

            while (!operation.done && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000));
                operation = await this.ai!.operations.get({ operation });
                attempts++;

                const progress = 50 + (attempts / maxAttempts) * 40; // 50-90%
                options?.onProgress?.({
                    status: 'processing',
                    progress,
                    message: `Processing... (${attempts}/${maxAttempts})`
                });
            }

            if (!operation.done) {
                throw new Error('File processing timeout after 5 minutes');
            }

            if (operation.error) {
                throw new Error(`File processing failed: ${operation.error.message}`);
            }

            options?.onProgress?.({ status: 'completed', progress: 100, message: 'Upload completed' });

            return {
                name: file.name,
                displayName: options?.displayName || file.name,
                sizeBytes: file.size,
            };
        } catch (error) {
            options?.onProgress?.({
                status: 'error',
                message: error instanceof Error ? error.message : String(error)
            });
            console.error('[GeminiFileSearchAPI] uploadToFileSearchStore error:', error);
            throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 在 File Search Store 中搜索
     */
    async searchInStore(
        query: string,
        fileSearchStoreName: string,
        options?: {
            topK?: number;
            metadataFilter?: string;
        }
    ): Promise<SearchResult> {
        this.ensureInitialized();

        try {
            const response = await this.ai!.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: query,
                config: {
                    tools: [
                        {
                            fileSearch: {
                                fileSearchStoreNames: [fileSearchStoreName],
                                ...(options?.metadataFilter && { metadataFilter: options.metadataFilter })
                            }
                        }
                    ]
                }
            });

            const text = response.text || '';
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

            // 提取引用信息
            const retrievalMetadata = groundingMetadata?.retrievalMetadata;
            const citations = Array.isArray(retrievalMetadata)
                ? (retrievalMetadata as RetrievalMetadataItem[]).map((metadata) => ({
                    source: metadata.source || 'Unknown',
                    chunk: metadata.text || ''
                }))
                : [];

            // 从返回的文本中提取文档块
            // Gemini 会自动基于检索到的内容生成回答
            const documents = citations.map((c) => c.chunk).filter(Boolean);

            return {
                documents: documents.length > 0 ? documents : [text],
                citations: citations.length > 0 ? citations : undefined
            };
        } catch (error) {
            console.error('[GeminiFileSearchAPI] searchInStore error:', error);
            throw new Error(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 使用多模态直接处理文件（不经过 File Search Store）
     * 适用于动态上传的文件，速度更快
     */
    async queryWithFiles(
        query: string,
        files: Array<{ name: string; url: string; type?: string }>
    ): Promise<SearchResult> {
        this.ensureInitialized();

        if (!files || files.length === 0) {
            throw new Error('No files provided for multimodal query');
        }

        try {
            // 构建多模态内容（文件 + 查询）
            const parts: any[] = [];

            // 添加文件内容
            for (const file of files) {
                if (!file.url) continue;

                try {
                    // 从 URL 获取文件
                    const response = await fetch(file.url);
                    if (!response.ok) {
                        console.warn(`[GeminiFileSearchAPI] Failed to fetch file: ${file.name}`);
                        continue;
                    }

                    const blob = await response.blob();
                    const arrayBuffer = await blob.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuffer).toString('base64');

                    // 确定 MIME 类型
                    const mimeType = file.type || blob.type || this.getMimeType(file.name);

                    parts.push({
                        inlineData: {
                            mimeType,
                            data: base64Data
                        }
                    });
                } catch (fetchError) {
                    console.warn(`[GeminiFileSearchAPI] Error fetching file ${file.name}:`, fetchError);
                }
            }

            if (parts.length === 0) {
                throw new Error('No valid files could be loaded');
            }

            // 添加查询文本
            parts.push({ text: query });

            // 调用 Gemini 多模态 API
            const response = await this.ai!.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts }]
            });

            const text = response.text || '';

            return {
                documents: [text],
                citations: files.map(f => ({ source: f.name, chunk: '' }))
            };
        } catch (error) {
            console.error('[GeminiFileSearchAPI] queryWithFiles error:', error);
            throw new Error(`Multimodal query failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 根据文件扩展名推断 MIME 类型
     */
    private getMimeType(filename: string): string {
        const ext = filename.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
            'pdf': 'application/pdf',
            'txt': 'text/plain',
            'md': 'text/markdown',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
        };
        return mimeTypes[ext || ''] || 'application/octet-stream';
    }

    /**
     * 列出所有 File Search Stores
     */
    async listFileSearchStores(): Promise<FileSearchStore[]> {
        this.ensureInitialized();

        try {
            const stores: FileSearchStore[] = [];
            const fileSearchStores = await this.ai!.fileSearchStores.list();

            for await (const store of fileSearchStores) {
                if (store.name) {
                    stores.push({
                        name: store.name,
                        displayName: store.displayName,
                        createTime: store.createTime
                    });
                }
            }

            return stores;
        } catch (error) {
            console.error('[GeminiFileSearchAPI] listFileSearchStores error:', error);
            throw new Error(`Failed to list file search stores: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 删除 File Search Store
     */
    async deleteFileSearchStore(name: string, force: boolean = false): Promise<void> {
        this.ensureInitialized();

        if (!name) {
            throw new Error('Store name is required for deletion');
        }

        try {
            await this.ai!.fileSearchStores.delete({
                name,
                config: { force }
            });
        } catch (error) {
            console.error('[GeminiFileSearchAPI] deleteFileSearchStore error:', error);
            throw new Error(`Failed to delete file search store: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 检查 API 是否可用
     */
    isConfigured(): boolean {
        return !!this.apiKey && !!this.ai;
    }
}

// ============ Singleton Instance ============
export const geminiFileSearchAPI = new GeminiFileSearchAPI();
