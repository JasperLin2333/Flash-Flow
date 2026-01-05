/**
 * 共享文件处理工具函数
 * 用于 InputPromptDialog、OutputDebugDialog 等组件
 */

/**
 * 获取文件扩展名（小写，包含点）
 * @example getFileExtension("report.pdf") => ".pdf"
 */
export function getFileExtension(filename: string): string {
    const lastDot = filename.lastIndexOf('.');
    return lastDot >= 0 ? filename.substring(lastDot).toLowerCase() : '';
}

/**
 * 验证文件类型是否在允许列表中
 * 
 * @param file - 要验证的文件
 * @param allowedTypes - 允许的类型列表，支持格式：扩展名(.pdf)、逗号分隔(.png,.jpg)、通配符(*\/*)
 * @returns 是否通过验证
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
    // 通配符检查
    if (allowedTypes.some(t => t === '*/*' || t === '*')) return true;

    const ext = getFileExtension(file.name);

    // 展开逗号分隔的值并检查扩展名
    const allowedExts = allowedTypes.flatMap(t =>
        t.split(',').map(s => s.trim().toLowerCase())
    );

    return allowedExts.some(allowed => {
        // 直接扩展名匹配（如 ".pdf", ".png"）
        if (allowed.startsWith('.')) {
            return ext === allowed;
        }
        // 无点的扩展名匹配（如 "pdf", "png"）
        return ext === '.' + allowed || ext === allowed;
    });
}

/**
 * 格式化文件大小为可读字符串
 * @example formatFileSize(1024) => "1KB"
 * @example formatFileSize(1048576) => "1MB"
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
