/**
 * 生产环境日志工具
 * 
 * 用途：
 * 1. 开发环境：正常输出日志到控制台
 * 2. 生产环境：静默日志输出，可选发送到监控服务
 * 
 * 使用方法：
 * import { logger } from '@/utils/logger';
 * 
 * logger.log('用户操作', { userId: '123' });
 * logger.error('API 错误', error);
 * logger.warn('配额即将用尽', { remaining: 5 });
 */

const isDev = process.env.NODE_ENV === 'development';
const isClient = typeof window !== 'undefined';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * 日志上下文信息
 */
interface LogContext {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
  userAgent?: string;
  url?: string;
}

/**
 * 格式化日志上下文
 */
function formatContext(level: LogLevel, message: string, data?: unknown): LogContext {
  const context: LogContext = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (data !== undefined) {
    context.data = data;
  }

  if (isClient) {
    context.userAgent = navigator.userAgent;
    context.url = window.location.href;
  }

  return context;
}

/**
 * 发送日志到监控服务（可选）
 * 
 * 集成示例：
 * - Sentry: Sentry.captureMessage(message, level)
 * - LogRocket: LogRocket.error(message, data)
 * - 自定义服务: fetch('/api/logs', { method: 'POST', body: JSON.stringify(context) })
 */
function sendToMonitoring(context: LogContext): void {
  // 仅在生产环境且为错误级别时发送
  if (!isDev && context.level === LogLevel.ERROR) {
    // TODO: 集成监控服务
    // 示例：Sentry
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(new Error(context.message), {
    //     extra: context.data,
    //   });
    // }
  }
}

/**
 * 通用日志记录函数
 */
function logWithLevel(
  level: LogLevel,
  message: string,
  data?: unknown
): void {
  const context = formatContext(level, message, data);

  // 开发环境：输出到控制台
  if (isDev) {
    const logFn = {
      [LogLevel.DEBUG]: console.log,
      [LogLevel.INFO]: console.log,
      [LogLevel.WARN]: console.warn,
      [LogLevel.ERROR]: console.error,
    }[level];

    if (data !== undefined) {
      logFn(`[${level}]`, message, data);
    } else {
      logFn(`[${level}]`, message);
    }
  }

  // 生产环境：发送到监控服务
  sendToMonitoring(context);
}

/**
 * 日志工具对象
 */
export const logger = {
  /**
   * 调试日志（仅开发环境）
   */
  debug: (message: string, data?: unknown) => {
    logWithLevel(LogLevel.DEBUG, message, data);
  },

  /**
   * 信息日志
   */
  log: (message: string, data?: unknown) => {
    logWithLevel(LogLevel.INFO, message, data);
  },

  /**
   * 信息日志（别名）
   */
  info: (message: string, data?: unknown) => {
    logWithLevel(LogLevel.INFO, message, data);
  },

  /**
   * 警告日志
   */
  warn: (message: string, data?: unknown) => {
    logWithLevel(LogLevel.WARN, message, data);
  },

  /**
   * 错误日志（始终记录，生产环境发送到监控）
   */
  error: (message: string, error?: unknown) => {
    logWithLevel(LogLevel.ERROR, message, error);
  },

  /**
   * 性能日志（测量函数执行时间）
   */
  perf: (label: string, fn: () => unknown) => {
    if (!isDev) {
      return fn();
    }

    const start = performance.now();
    const result = fn();
    const end = performance.now();

    console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  },

  /**
   * 异步性能日志
   */
  perfAsync: async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
    if (!isDev) {
      return await fn();
    }

    const start = performance.now();
    const result = await fn();
    const end = performance.now();

    console.log(`[PERF] ${label}: ${(end - start).toFixed(2)}ms`);
    return result;
  },
};

/**
 * 替换现有 console 日志的辅助函数
 * 
 * 迁移建议：
 * 1. console.log(...) → logger.log('描述', data)
 * 2. console.error(...) → logger.error('错误描述', error)
 * 3. console.warn(...) → logger.warn('警告描述', data)
 */

// 默认导出
export default logger;
