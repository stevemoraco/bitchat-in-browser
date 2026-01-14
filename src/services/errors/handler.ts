/**
 * Error Handler - BitChat In Browser
 *
 * Global error handling infrastructure for capturing, logging,
 * and managing errors throughout the application.
 *
 * @module services/errors/handler
 */

import type {
  ErrorCode} from './index';
import {
  BitChatError,
  ErrorSeverity,
  ErrorCategory,
  type SerializedError,
} from './index';

// ============================================================================
// Types
// ============================================================================

/**
 * Error handler callback
 */
export type ErrorHandler = (error: BitChatError) => void;

/**
 * Error log entry
 */
export interface ErrorLogEntry {
  id: string;
  error: SerializedError;
  timestamp: number;
  handled: boolean;
}

/**
 * Error handler configuration
 */
export interface ErrorHandlerConfig {
  /** Maximum errors to keep in log */
  maxLogSize: number;
  /** Whether to log to console */
  logToConsole: boolean;
  /** Whether to capture unhandled rejections */
  captureUnhandledRejections: boolean;
  /** Whether to capture global errors */
  captureGlobalErrors: boolean;
  /** Custom error handlers by category */
  categoryHandlers: Partial<Record<ErrorCategory, ErrorHandler>>;
  /** Custom error handlers by code */
  codeHandlers: Partial<Record<ErrorCode, ErrorHandler>>;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  totalErrors: number;
  byCategory: Record<ErrorCategory, number>;
  bySeverity: Record<ErrorSeverity, number>;
  lastError: ErrorLogEntry | null;
  recentErrors: ErrorLogEntry[];
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ErrorHandlerConfig = {
  maxLogSize: 100,
  logToConsole: true,
  captureUnhandledRejections: true,
  captureGlobalErrors: true,
  categoryHandlers: {},
  codeHandlers: {},
};

// ============================================================================
// Global Error Handler
// ============================================================================

/**
 * GlobalErrorHandler manages application-wide error handling.
 *
 * Features:
 * - Captures unhandled errors and promise rejections
 * - Maintains error log for debugging
 * - Routes errors to appropriate handlers
 * - Provides error statistics
 *
 * @example
 * ```typescript
 * const handler = GlobalErrorHandler.getInstance();
 *
 * // Register custom handler for network errors
 * handler.addCategoryHandler(ErrorCategory.NETWORK, (error) => {
 *   showNetworkErrorToast(error.userMessage);
 * });
 *
 * // Handle an error
 * handler.handleError(someError);
 *
 * // Get error stats
 * const stats = handler.getStats();
 * ```
 */
export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler | null = null;
  private config: ErrorHandlerConfig;
  private errorLog: ErrorLogEntry[] = [];
  private listeners: Set<ErrorHandler> = new Set();
  private installed = false;
  private sessionId: string;

  private constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }

  /**
   * Initialize with configuration
   */
  public static initialize(config: Partial<ErrorHandlerConfig> = {}): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler(config);
    } else {
      GlobalErrorHandler.instance.configure(config);
    }
    GlobalErrorHandler.instance.install();
    return GlobalErrorHandler.instance;
  }

  /**
   * Reset for testing
   */
  public static _resetForTesting(): void {
    if (GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance.uninstall();
    }
    GlobalErrorHandler.instance = null;
  }

  /**
   * Update configuration
   */
  public configure(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Install global handlers
   */
  public install(): void {
    if (this.installed || typeof window === 'undefined') {
      return;
    }

    if (this.config.captureGlobalErrors) {
      window.addEventListener('error', this.handleGlobalError);
    }

    if (this.config.captureUnhandledRejections) {
      window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    }

    this.installed = true;
    this.log('info', 'Global error handlers installed');
  }

  /**
   * Uninstall global handlers
   */
  public uninstall(): void {
    if (!this.installed || typeof window === 'undefined') {
      return;
    }

    window.removeEventListener('error', this.handleGlobalError);
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);

    this.installed = false;
    this.log('info', 'Global error handlers uninstalled');
  }

  /**
   * Handle a global error event
   */
  private handleGlobalError = (event: ErrorEvent): void => {
    const error = this.wrapError(event.error ?? new Error(event.message), {
      component: 'global',
      operation: 'uncaught error',
      data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });

    this.handleError(error, { source: 'global' });

    // Prevent default error logging (we handle it)
    event.preventDefault();
  };

  /**
   * Handle an unhandled promise rejection
   */
  private handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const error = this.wrapError(event.reason, {
      component: 'global',
      operation: 'unhandled rejection',
    });

    this.handleError(error, { source: 'promise' });

    // Prevent default error logging (we handle it)
    event.preventDefault();
  };

  /**
   * Handle an error
   *
   * @param error - The error to handle
   * @param options - Additional handling options
   */
  public handleError(
    error: unknown,
    options: {
      source?: string;
      silent?: boolean;
      context?: Record<string, unknown>;
    } = {}
  ): BitChatError {
    const bitChatError = this.wrapError(error, options.context);

    // Add to log
    const logEntry = this.addToLog(bitChatError);

    // Log to console if enabled
    if (this.config.logToConsole && !options.silent) {
      this.logToConsole(bitChatError);
    }

    // Call category handler
    const categoryHandler = this.config.categoryHandlers[bitChatError.category];
    if (categoryHandler) {
      try {
        categoryHandler(bitChatError);
      } catch (handlerError) {
        this.log('error', 'Category handler threw error:', handlerError);
      }
    }

    // Call code handler
    const codeHandler = this.config.codeHandlers[bitChatError.code];
    if (codeHandler) {
      try {
        codeHandler(bitChatError);
      } catch (handlerError) {
        this.log('error', 'Code handler threw error:', handlerError);
      }
    }

    // Notify listeners
    this.notifyListeners(bitChatError);

    // Mark as handled
    logEntry.handled = true;

    return bitChatError;
  }

  /**
   * Wrap an error in BitChatError
   */
  private wrapError(
    error: unknown,
    context?: Record<string, unknown>
  ): BitChatError {
    if (error instanceof BitChatError) {
      // Add session ID if not present
      if (!error.context.sessionId) {
        error.context.sessionId = this.sessionId;
      }
      return error;
    }

    if (error instanceof Error) {
      return BitChatError.fromError(error, {
        context: {
          sessionId: this.sessionId,
          ...context,
        },
      });
    }

    return new BitChatError(
      typeof error === 'string' ? error : 'Unknown error',
      {
        context: {
          sessionId: this.sessionId,
          ...context,
          data: { originalValue: String(error) },
        },
      }
    );
  }

  /**
   * Add an error to the log
   */
  private addToLog(error: BitChatError): ErrorLogEntry {
    const entry: ErrorLogEntry = {
      id: this.generateId(),
      error: error.serialize(),
      timestamp: Date.now(),
      handled: false,
    };

    this.errorLog.unshift(entry);

    // Trim log if too large
    if (this.errorLog.length > this.config.maxLogSize) {
      this.errorLog = this.errorLog.slice(0, this.config.maxLogSize);
    }

    return entry;
  }

  /**
   * Log error to console
   */
  private logToConsole(error: BitChatError): void {
    const logString = error.toLogString();

    switch (error.severity) {
      case ErrorSeverity.INFO:
        console.info(`[BitChat] ${logString}`);
        break;
      case ErrorSeverity.WARNING:
        console.warn(`[BitChat] ${logString}`);
        break;
      case ErrorSeverity.ERROR:
        console.error(`[BitChat] ${logString}`, error);
        break;
      case ErrorSeverity.CRITICAL:
        console.error(`[BitChat CRITICAL] ${logString}`, error);
        break;
    }
  }

  /**
   * Add an error listener
   */
  public addListener(handler: ErrorHandler): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }

  /**
   * Remove an error listener
   */
  public removeListener(handler: ErrorHandler): void {
    this.listeners.delete(handler);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(error: BitChatError): void {
    this.listeners.forEach((listener) => {
      try {
        listener(error);
      } catch (listenerError) {
        this.log('error', 'Error listener threw error:', listenerError);
      }
    });
  }

  /**
   * Add a handler for a specific error category
   */
  public addCategoryHandler(category: ErrorCategory, handler: ErrorHandler): void {
    this.config.categoryHandlers[category] = handler;
  }

  /**
   * Add a handler for a specific error code
   */
  public addCodeHandler(code: ErrorCode, handler: ErrorHandler): void {
    this.config.codeHandlers[code] = handler;
  }

  /**
   * Get error log
   */
  public getLog(): ErrorLogEntry[] {
    return [...this.errorLog];
  }

  /**
   * Get recent errors (last N)
   */
  public getRecentErrors(count: number = 10): ErrorLogEntry[] {
    return this.errorLog.slice(0, count);
  }

  /**
   * Get error by ID
   */
  public getErrorById(id: string): ErrorLogEntry | undefined {
    return this.errorLog.find((entry) => entry.id === id);
  }

  /**
   * Clear error log
   */
  public clearLog(): void {
    this.errorLog = [];
  }

  /**
   * Get error statistics
   */
  public getStats(): ErrorStats {
    const byCategory: Record<ErrorCategory, number> = {
      [ErrorCategory.GENERIC]: 0,
      [ErrorCategory.NETWORK]: 0,
      [ErrorCategory.CRYPTO]: 0,
      [ErrorCategory.STORAGE]: 0,
      [ErrorCategory.IDENTITY]: 0,
      [ErrorCategory.NOSTR]: 0,
      [ErrorCategory.SYNC]: 0,
      [ErrorCategory.CHANNEL]: 0,
      [ErrorCategory.SERVICE_WORKER]: 0,
    };

    const bySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.INFO]: 0,
      [ErrorSeverity.WARNING]: 0,
      [ErrorSeverity.ERROR]: 0,
      [ErrorSeverity.CRITICAL]: 0,
    };

    this.errorLog.forEach((entry) => {
      byCategory[entry.error.category]++;
      bySeverity[entry.error.severity]++;
    });

    return {
      totalErrors: this.errorLog.length,
      byCategory,
      bySeverity,
      lastError: this.errorLog[0] ?? null,
      recentErrors: this.errorLog.slice(0, 5),
    };
  }

  /**
   * Export error log for debugging
   */
  public exportLog(): string {
    const exportData = {
      sessionId: this.sessionId,
      exportedAt: new Date().toISOString(),
      stats: this.getStats(),
      errors: this.errorLog,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Internal logging
   */
  private log(level: 'info' | 'warn' | 'error', ...args: unknown[]): void {
    if (!this.config.logToConsole) return;

    const prefix = '[ErrorHandler]';
    switch (level) {
      case 'info':
        console.info(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'error':
        console.error(prefix, ...args);
        break;
    }
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the global error handler instance
 */
export function getErrorHandler(): GlobalErrorHandler {
  return GlobalErrorHandler.getInstance();
}

/**
 * Initialize global error handling
 */
export function initErrorHandling(config?: Partial<ErrorHandlerConfig>): GlobalErrorHandler {
  return GlobalErrorHandler.initialize(config);
}

/**
 * Handle an error through the global handler
 */
export function handleError(
  error: unknown,
  options?: { silent?: boolean; context?: Record<string, unknown> }
): BitChatError {
  return GlobalErrorHandler.getInstance().handleError(error, options);
}

/**
 * Create a safe wrapper for async functions
 */
export function createSafeAsync<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options?: {
    context?: Record<string, unknown>;
    onError?: (error: BitChatError) => void;
    fallback?: T;
  }
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    try {
      return await fn(...args);
    } catch (error) {
      const bitChatError = handleError(error, { context: options?.context });
      options?.onError?.(bitChatError);

      if (options?.fallback !== undefined) {
        return options.fallback;
      }

      throw bitChatError;
    }
  };
}

/**
 * Create a safe wrapper for sync functions
 */
export function createSafe<T, Args extends unknown[]>(
  fn: (...args: Args) => T,
  options?: {
    context?: Record<string, unknown>;
    onError?: (error: BitChatError) => void;
    fallback?: T;
  }
): (...args: Args) => T {
  return (...args: Args): T => {
    try {
      return fn(...args);
    } catch (error) {
      const bitChatError = handleError(error, { context: options?.context });
      options?.onError?.(bitChatError);

      if (options?.fallback !== undefined) {
        return options.fallback;
      }

      throw bitChatError;
    }
  };
}

// ============================================================================
// Export
// ============================================================================

export default GlobalErrorHandler;
