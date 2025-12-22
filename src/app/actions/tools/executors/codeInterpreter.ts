"use server";

import { Sandbox } from "@e2b/code-interpreter";
import { createClient } from "@supabase/supabase-js";
import type { ToolExecutionResult } from "../types";

/**
 * Code Interpreter Inputs
 */
export interface CodeInterpreterInputs {
    code: string;
    outputFileName?: string;
    inputFiles?: { name: string; url: string }[];
}

/**
 * Get MIME type from file extension
 */
function getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
        // Spreadsheets
        csv: 'text/csv',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        // Documents
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        txt: 'text/plain',
        md: 'text/markdown',
        // Data
        json: 'application/json',
        xml: 'application/xml',
        // Images
        png: 'image/png',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        // Archives
        zip: 'application/zip',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Clean code by removing markdown code block markers
 */
function cleanCodeInput(code: string): string {
    // Remove markdown code blocks like ```python...``` or ```...```
    let cleaned = code.trim();
    
    // Remove opening code fence with optional language
    cleaned = cleaned.replace(/^```\w*\n?/m, '');
    
    // Remove closing code fence
    cleaned = cleaned.replace(/\n?```$/m, '');
    
    return cleaned.trim();
}

/**
 * Execute Python code in E2B sandbox
 * 
 * Features:
 * - Upload input files to sandbox
 * - Execute Python code
 * - Download generated output file
 * - Upload to Supabase Storage for persistent access
 */
export async function executeCodeInterpreter(inputs: CodeInterpreterInputs): Promise<ToolExecutionResult> {
    // Validate E2B API key
    if (!process.env.E2B_API_KEY) {
        return {
            success: false,
            error: "E2B API Key 未配置。请在环境变量中设置 E2B_API_KEY",
        };
    }
    
    // Clean code input to remove markdown formatting
    const cleanedCode = cleanCodeInput(inputs.code);

    // Create sandbox with timeout
    let sbx: Sandbox | null = null;

    try {
        sbx = await Sandbox.create({
            timeoutMs: 60000, // 60 second timeout
        });

        // 1. Upload input files to sandbox
        if (inputs.inputFiles && inputs.inputFiles.length > 0) {
            for (const file of inputs.inputFiles) {
                try {
                    const response = await fetch(file.url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch file: ${file.name}`);
                    }
                    const content = await response.arrayBuffer();
                    await sbx.files.write(`/home/user/${file.name}`, content);
                } catch (fileError) {
                    if (process.env.NODE_ENV === 'development') {
                        console.error(`Error uploading file ${file.name}:`, fileError);
                    }
                    // Continue with other files, don't fail completely
                }
            }
        }

        // 2. Execute Python code
        const execution = await sbx.runCode(cleanedCode);

        // Collect logs
        const stdout = execution.logs.stdout?.join('\n') || '';
        const stderr = execution.logs.stderr?.join('\n') || '';

        // Check for errors in execution
        if (execution.error) {
            return {
                success: false,
                error: `代码执行错误: ${execution.error.name}: ${execution.error.value}`,
                data: {
                    logs: stdout,
                    errors: stderr,
                },
            };
        }

        // 3. Handle generated output file (BEFORE killing sandbox)
        let generatedFile: { name: string; url: string; type: string } | null = null;

        if (inputs.outputFileName) {
            try {
                // Read the generated file from sandbox
                const fileContent = await sbx.files.read(`/home/user/${inputs.outputFileName}`);

                // Upload to Supabase Storage
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
                const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

                if (supabaseUrl && supabaseServiceKey) {
                    const supabase = createClient(supabaseUrl, supabaseServiceKey);
                    const fileName = `sandbox-outputs/${Date.now()}-${inputs.outputFileName}`;
                    const mimeType = getMimeType(inputs.outputFileName);

                    const { error: uploadError } = await supabase.storage
                        .from('flow-files')
                        .upload(fileName, fileContent, {
                            contentType: mimeType,
                            upsert: false,
                        });

                    if (uploadError) {
                        if (process.env.NODE_ENV === 'development') {
                            console.error("Supabase upload error:", uploadError);
                        }
                    } else {
                        const { data: urlData } = supabase.storage
                            .from('flow-files')
                            .getPublicUrl(fileName);

                        generatedFile = {
                            name: inputs.outputFileName,
                            url: urlData.publicUrl,
                            type: mimeType,
                        };
                    }
                } else {
                    if (process.env.NODE_ENV === 'development') {
                        console.warn("Supabase credentials not configured, cannot persist generated file");
                    }
                    // 返回文件生成信息，但没有持久化URL
                    generatedFile = {
                        name: inputs.outputFileName,
                        url: "", // Supabase未配置，没有持久化URL
                        type: getMimeType(inputs.outputFileName),
                    };
                }
            } catch (fileReadError) {
                console.error(`Error reading output file ${inputs.outputFileName}:`, fileReadError);
                // File might not exist if code didn't generate it
            }
        }

        return {
            success: true,
            data: {
                logs: stdout,
                errors: stderr,
                generatedFile,
                result: execution.results?.[0]?.text || null,
                // 添加提示信息
                message: generatedFile && !generatedFile.url 
                    ? `文件 ${generatedFile.name} 已生成，但由于Supabase未配置，文件无法持久化保存。请配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 环境变量。`
                    : undefined,
            },
        };
    } catch (error) {
        console.error("Code interpreter error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "代码执行失败",
        };
    } finally {
        // Always clean up sandbox
        if (sbx) {
            try {
                await sbx.kill();
            } catch (killError) {
                console.error("Error killing sandbox:", killError);
            }
        }
    }
}
