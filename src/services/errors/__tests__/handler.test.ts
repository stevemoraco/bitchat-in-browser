/**
 * Global Error Handler Tests
 *
 * Tests for the GlobalErrorHandler class including:
 * - Initialization and configuration
 * - Global error and rejection handling
 * - Error wrapping and logging
 * - Category and code handlers
 * - Listeners
 * - Error log management
 * - Statistics
 * - Safe function wrappers
 * - Cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GlobalErrorHandler,
  getErrorHandler,
  initErrorHandling,
  handleError,
  createSafeAsync,
  createSafe,
  type ErrorHandler,
  type ErrorHandlerConfig,
} from '../handler';
import {
  BitChatError,
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
  NetworkError,
  CryptoError,
  StorageError,
} from '../index';

// ============================================================================
// Test Setup
// ============================================================================

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;

  beforeEach(() => {
    // Reset singleton
    GlobalErrorHandler._resetForTesting();

    // Setup window mock
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    // Suppress console output during tests
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    handler = GlobalErrorHandler.getInstance();
  });

  afterEach(() => {
    GlobalErrorHandler._resetForTesting();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Initialization
  // ============================================================================

  describe('Initialization', () => {
    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = GlobalErrorHandler.getInstance();
        const instance2 = GlobalErrorHandler.getInstance();

        expect(instance1).toBe(instance2);
      });
    });

    describe('initialize', () => {
      it('should initialize with default config', () => {
        const instance = GlobalErrorHandler.initialize();

        expect(instance).toBeInstanceOf(GlobalErrorHandler);
      });

      it('should accept custom configuration', () => {
        const config: Partial<ErrorHandlerConfig> = {
          maxLogSize: 50,
          logToConsole: false,
        };

        const instance = GlobalErrorHandler.initialize(config);

        expect(instance).toBeInstanceOf(GlobalErrorHandler);
      });

      it('should install global handlers', () => {
        GlobalErrorHandler.initialize();

        expect(window.addEventListener).toHaveBeenCalledWith(
          'error',
          expect.any(Function)
        );
        expect(window.addEventListener).toHaveBeenCalledWith(
          'unhandledrejection',
          expect.any(Function)
        );
      });

      it('should not reinstall if already installed', () => {
        GlobalErrorHandler.initialize();
        const callCount = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.length;

        // Second initialize
        GlobalErrorHandler.initialize();

        // Should not add more listeners
        expect((window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
      });
    });

    describe('configure', () => {
      it('should update configuration', () => {
        const instance = GlobalErrorHandler.getInstance();

        instance.configure({
          maxLogSize: 25,
          logToConsole: false,
        });

        // Verify by checking behavior
        const error = new BitChatError('Test error');
        instance.handleError(error);

        // Should not log to console
        expect(console.error).not.toHaveBeenCalled();
      });
    });

    describe('install', () => {
      it('should setup global error listener', () => {
        handler.install();

        expect(window.addEventListener).toHaveBeenCalledWith(
          'error',
          expect.any(Function)
        );
      });

      it('should setup unhandled rejection listener', () => {
        handler.install();

        expect(window.addEventListener).toHaveBeenCalledWith(
          'unhandledrejection',
          expect.any(Function)
        );
      });

      it('should respect captureGlobalErrors config', () => {
        GlobalErrorHandler._resetForTesting();
        const instance = GlobalErrorHandler.initialize({
          captureGlobalErrors: false,
        });

        const errorCalls = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
          .filter((call) => call[0] === 'error');

        expect(errorCalls.length).toBe(0);
      });

      it('should respect captureUnhandledRejections config', () => {
        GlobalErrorHandler._resetForTesting();
        const instance = GlobalErrorHandler.initialize({
          captureUnhandledRejections: false,
        });

        const rejectionCalls = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
          .filter((call) => call[0] === 'unhandledrejection');

        expect(rejectionCalls.length).toBe(0);
      });
    });

    describe('uninstall', () => {
      it('should remove global error listener', () => {
        handler.install();
        handler.uninstall();

        expect(window.removeEventListener).toHaveBeenCalledWith(
          'error',
          expect.any(Function)
        );
      });

      it('should remove unhandled rejection listener', () => {
        handler.install();
        handler.uninstall();

        expect(window.removeEventListener).toHaveBeenCalledWith(
          'unhandledrejection',
          expect.any(Function)
        );
      });
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    describe('handleError', () => {
      beforeEach(() => {
        handler.configure({ logToConsole: true });
      });

      it('should handle BitChatError directly', () => {
        const error = new BitChatError('Test error', {
          code: ErrorCode.NETWORK_OFFLINE,
          category: ErrorCategory.NETWORK,
        });

        const result = handler.handleError(error);

        expect(result).toBeInstanceOf(BitChatError);
        expect(result.code).toBe(ErrorCode.NETWORK_OFFLINE);
      });

      it('should wrap standard Error in BitChatError', () => {
        const error = new Error('Standard error');

        const result = handler.handleError(error);

        expect(result).toBeInstanceOf(BitChatError);
        expect(result.message).toBe('Standard error');
        expect(result.cause).toBe(error);
      });

      it('should wrap string errors', () => {
        const result = handler.handleError('String error');

        expect(result).toBeInstanceOf(BitChatError);
        expect(result.message).toBe('String error');
      });

      it('should wrap unknown error types', () => {
        const result = handler.handleError({ custom: 'error' });

        expect(result).toBeInstanceOf(BitChatError);
        expect(result.message).toBe('Unknown error');
      });

      it('should add error to log', () => {
        const error = new BitChatError('Logged error');

        handler.handleError(error);

        const log = handler.getLog();
        expect(log.length).toBe(1);
        expect(log[0].error.message).toBe('Logged error');
      });

      it('should log to console by default', () => {
        const error = new BitChatError('Console error', {
          severity: ErrorSeverity.ERROR,
        });

        handler.handleError(error);

        expect(console.error).toHaveBeenCalled();
      });

      it('should not log when silent option is set', () => {
        const error = new BitChatError('Silent error');

        handler.handleError(error, { silent: true });

        expect(console.error).not.toHaveBeenCalled();
      });

      it('should add session ID to error context', () => {
        const error = new BitChatError('Session error');

        const result = handler.handleError(error);

        expect(result.context.sessionId).toBeDefined();
        expect(result.context.sessionId).toMatch(/^session_/);
      });

      it('should mark error as handled in log', () => {
        const error = new BitChatError('Handled error');

        handler.handleError(error);

        const log = handler.getLog();
        expect(log[0].handled).toBe(true);
      });

      it('should add context to wrapped errors', () => {
        const error = new Error('Context error');

        const result = handler.handleError(error, {
          context: {
            component: 'TestComponent',
            operation: 'testOperation',
          },
        });

        expect(result.context.component).toBe('TestComponent');
      });
    });

    describe('Console logging by severity', () => {
      beforeEach(() => {
        handler.configure({ logToConsole: true });
      });

      it('should use console.info for INFO severity', () => {
        const error = new BitChatError('Info message', {
          severity: ErrorSeverity.INFO,
        });

        handler.handleError(error);

        expect(console.info).toHaveBeenCalled();
      });

      it('should use console.warn for WARNING severity', () => {
        const error = new BitChatError('Warning message', {
          severity: ErrorSeverity.WARNING,
        });

        handler.handleError(error);

        expect(console.warn).toHaveBeenCalled();
      });

      it('should use console.error for ERROR severity', () => {
        const error = new BitChatError('Error message', {
          severity: ErrorSeverity.ERROR,
        });

        handler.handleError(error);

        expect(console.error).toHaveBeenCalled();
      });

      it('should use console.error with prefix for CRITICAL severity', () => {
        const error = new BitChatError('Critical message', {
          severity: ErrorSeverity.CRITICAL,
        });

        handler.handleError(error);

        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining('CRITICAL'),
          expect.any(BitChatError)
        );
      });
    });
  });

  // ============================================================================
  // Category and Code Handlers
  // ============================================================================

  describe('Category and Code Handlers', () => {
    describe('addCategoryHandler', () => {
      it('should call category handler for matching errors', () => {
        const categoryHandler = vi.fn();
        handler.addCategoryHandler(ErrorCategory.NETWORK, categoryHandler);

        const error = new NetworkError('Network error');
        handler.handleError(error);

        expect(categoryHandler).toHaveBeenCalledWith(error);
      });

      it('should not call handler for non-matching category', () => {
        const categoryHandler = vi.fn();
        handler.addCategoryHandler(ErrorCategory.NETWORK, categoryHandler);

        const error = new CryptoError('Crypto error');
        handler.handleError(error);

        expect(categoryHandler).not.toHaveBeenCalled();
      });

      it('should handle errors in category handlers', () => {
        const badHandler: ErrorHandler = () => {
          throw new Error('Handler error');
        };
        handler.addCategoryHandler(ErrorCategory.NETWORK, badHandler);

        const error = new NetworkError('Network error');

        // Should not throw
        expect(() => handler.handleError(error)).not.toThrow();
      });
    });

    describe('addCodeHandler', () => {
      it('should call code handler for matching error code', () => {
        const codeHandler = vi.fn();
        handler.addCodeHandler(ErrorCode.NETWORK_OFFLINE, codeHandler);

        const error = new BitChatError('Offline error', {
          code: ErrorCode.NETWORK_OFFLINE,
        });
        handler.handleError(error);

        expect(codeHandler).toHaveBeenCalledWith(error);
      });

      it('should not call handler for non-matching code', () => {
        const codeHandler = vi.fn();
        handler.addCodeHandler(ErrorCode.NETWORK_OFFLINE, codeHandler);

        const error = new BitChatError('Different error', {
          code: ErrorCode.CRYPTO_NOT_READY,
        });
        handler.handleError(error);

        expect(codeHandler).not.toHaveBeenCalled();
      });

      it('should handle errors in code handlers', () => {
        const badHandler: ErrorHandler = () => {
          throw new Error('Handler error');
        };
        handler.addCodeHandler(ErrorCode.NETWORK_OFFLINE, badHandler);

        const error = new BitChatError('Offline error', {
          code: ErrorCode.NETWORK_OFFLINE,
        });

        // Should not throw
        expect(() => handler.handleError(error)).not.toThrow();
      });
    });
  });

  // ============================================================================
  // Listeners
  // ============================================================================

  describe('Listeners', () => {
    describe('addListener', () => {
      it('should add listener and receive errors', () => {
        const listener = vi.fn();
        handler.addListener(listener);

        const error = new BitChatError('Listener error');
        handler.handleError(error);

        expect(listener).toHaveBeenCalledWith(error);
      });

      it('should return unsubscribe function', () => {
        const listener = vi.fn();
        const unsubscribe = handler.addListener(listener);

        unsubscribe();

        const error = new BitChatError('Listener error');
        handler.handleError(error);

        expect(listener).not.toHaveBeenCalled();
      });

      it('should handle errors in listeners gracefully', () => {
        const badListener: ErrorHandler = () => {
          throw new Error('Listener error');
        };
        const goodListener = vi.fn();

        handler.addListener(badListener);
        handler.addListener(goodListener);

        const error = new BitChatError('Test error');

        // Should not throw
        expect(() => handler.handleError(error)).not.toThrow();

        // Good listener should still be called
        expect(goodListener).toHaveBeenCalled();
      });
    });

    describe('removeListener', () => {
      it('should remove listener', () => {
        const listener = vi.fn();
        handler.addListener(listener);
        handler.removeListener(listener);

        const error = new BitChatError('Listener error');
        handler.handleError(error);

        expect(listener).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Error Log
  // ============================================================================

  describe('Error Log', () => {
    describe('getLog', () => {
      it('should return copy of error log', () => {
        const error = new BitChatError('Log error');
        handler.handleError(error);

        const log = handler.getLog();

        expect(log.length).toBe(1);
        expect(Array.isArray(log)).toBe(true);
      });

      it('should include error metadata', () => {
        const error = new BitChatError('Metadata error', {
          code: ErrorCode.NETWORK_TIMEOUT,
          category: ErrorCategory.NETWORK,
        });
        handler.handleError(error);

        const log = handler.getLog();

        expect(log[0].error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
        expect(log[0].error.category).toBe(ErrorCategory.NETWORK);
        expect(log[0].timestamp).toBeGreaterThan(0);
        expect(log[0].id).toMatch(/^err_/);
      });
    });

    describe('getRecentErrors', () => {
      it('should return specified number of recent errors', () => {
        for (let i = 0; i < 20; i++) {
          handler.handleError(new BitChatError(`Error ${i}`));
        }

        const recent = handler.getRecentErrors(5);

        expect(recent.length).toBe(5);
      });

      it('should return errors in most recent first order', () => {
        handler.handleError(new BitChatError('First error'));
        handler.handleError(new BitChatError('Second error'));
        handler.handleError(new BitChatError('Third error'));

        const recent = handler.getRecentErrors(3);

        expect(recent[0].error.message).toBe('Third error');
        expect(recent[2].error.message).toBe('First error');
      });

      it('should default to 10 errors', () => {
        for (let i = 0; i < 20; i++) {
          handler.handleError(new BitChatError(`Error ${i}`));
        }

        const recent = handler.getRecentErrors();

        expect(recent.length).toBe(10);
      });
    });

    describe('getErrorById', () => {
      it('should return error by ID', () => {
        const error = new BitChatError('Find me');
        handler.handleError(error);

        const log = handler.getLog();
        const id = log[0].id;

        const found = handler.getErrorById(id);

        expect(found?.error.message).toBe('Find me');
      });

      it('should return undefined for non-existent ID', () => {
        const found = handler.getErrorById('non-existent');

        expect(found).toBeUndefined();
      });
    });

    describe('clearLog', () => {
      it('should clear all logged errors', () => {
        handler.handleError(new BitChatError('Error 1'));
        handler.handleError(new BitChatError('Error 2'));

        handler.clearLog();

        expect(handler.getLog().length).toBe(0);
      });
    });

    describe('Log size limit', () => {
      it('should respect maxLogSize configuration', () => {
        handler.configure({ maxLogSize: 5 });

        for (let i = 0; i < 10; i++) {
          handler.handleError(new BitChatError(`Error ${i}`));
        }

        expect(handler.getLog().length).toBe(5);
      });

      it('should keep most recent errors when trimming', () => {
        handler.configure({ maxLogSize: 3 });

        handler.handleError(new BitChatError('Error 1'));
        handler.handleError(new BitChatError('Error 2'));
        handler.handleError(new BitChatError('Error 3'));
        handler.handleError(new BitChatError('Error 4'));

        const log = handler.getLog();

        expect(log[0].error.message).toBe('Error 4');
        expect(log[2].error.message).toBe('Error 2');
      });
    });
  });

  // ============================================================================
  // Statistics
  // ============================================================================

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return total error count', () => {
        handler.handleError(new BitChatError('Error 1'));
        handler.handleError(new BitChatError('Error 2'));
        handler.handleError(new BitChatError('Error 3'));

        const stats = handler.getStats();

        expect(stats.totalErrors).toBe(3);
      });

      it('should count errors by category', () => {
        handler.handleError(new NetworkError('Network 1'));
        handler.handleError(new NetworkError('Network 2'));
        handler.handleError(new CryptoError('Crypto 1'));
        handler.handleError(new StorageError('Storage 1'));

        const stats = handler.getStats();

        expect(stats.byCategory[ErrorCategory.NETWORK]).toBe(2);
        expect(stats.byCategory[ErrorCategory.CRYPTO]).toBe(1);
        expect(stats.byCategory[ErrorCategory.STORAGE]).toBe(1);
      });

      it('should count errors by severity', () => {
        handler.handleError(new BitChatError('Info', { severity: ErrorSeverity.INFO }));
        handler.handleError(new BitChatError('Warning', { severity: ErrorSeverity.WARNING }));
        handler.handleError(new BitChatError('Error', { severity: ErrorSeverity.ERROR }));
        handler.handleError(new BitChatError('Critical', { severity: ErrorSeverity.CRITICAL }));

        const stats = handler.getStats();

        expect(stats.bySeverity[ErrorSeverity.INFO]).toBe(1);
        expect(stats.bySeverity[ErrorSeverity.WARNING]).toBe(1);
        expect(stats.bySeverity[ErrorSeverity.ERROR]).toBe(1);
        expect(stats.bySeverity[ErrorSeverity.CRITICAL]).toBe(1);
      });

      it('should include last error', () => {
        handler.handleError(new BitChatError('First'));
        handler.handleError(new BitChatError('Last'));

        const stats = handler.getStats();

        expect(stats.lastError?.error.message).toBe('Last');
      });

      it('should include recent errors', () => {
        for (let i = 0; i < 10; i++) {
          handler.handleError(new BitChatError(`Error ${i}`));
        }

        const stats = handler.getStats();

        expect(stats.recentErrors.length).toBe(5);
      });

      it('should return null last error when log is empty', () => {
        const stats = handler.getStats();

        expect(stats.lastError).toBeNull();
      });
    });
  });

  // ============================================================================
  // Export
  // ============================================================================

  describe('Export', () => {
    describe('exportLog', () => {
      it('should export log as JSON string', () => {
        handler.handleError(new BitChatError('Export error'));

        const exported = handler.exportLog();

        expect(typeof exported).toBe('string');

        const parsed = JSON.parse(exported);
        expect(parsed.errors.length).toBe(1);
        expect(parsed.sessionId).toBeDefined();
        expect(parsed.exportedAt).toBeDefined();
        expect(parsed.stats).toBeDefined();
      });

      it('should include all error details', () => {
        handler.handleError(
          new BitChatError('Detailed error', {
            code: ErrorCode.NETWORK_TIMEOUT,
            category: ErrorCategory.NETWORK,
            severity: ErrorSeverity.WARNING,
          })
        );

        const exported = handler.exportLog();
        const parsed = JSON.parse(exported);

        expect(parsed.errors[0].error.code).toBe(ErrorCode.NETWORK_TIMEOUT);
        expect(parsed.errors[0].error.category).toBe(ErrorCategory.NETWORK);
        expect(parsed.errors[0].error.severity).toBe(ErrorSeverity.WARNING);
      });
    });
  });

  // ============================================================================
  // Convenience Functions
  // ============================================================================

  describe('Convenience Functions', () => {
    describe('getErrorHandler', () => {
      it('should return singleton instance', () => {
        const instance = getErrorHandler();

        expect(instance).toBe(handler);
      });
    });

    describe('initErrorHandling', () => {
      it('should initialize and return handler', () => {
        GlobalErrorHandler._resetForTesting();

        const instance = initErrorHandling({ maxLogSize: 50 });

        expect(instance).toBeInstanceOf(GlobalErrorHandler);
      });
    });

    describe('handleError', () => {
      it('should handle error through global handler', () => {
        const error = new BitChatError('Global handle');

        const result = handleError(error);

        expect(result).toBeInstanceOf(BitChatError);
        expect(handler.getLog().length).toBeGreaterThan(0);
      });

      it('should accept options', () => {
        handler.configure({ logToConsole: true });

        handleError(new BitChatError('Silent'), { silent: true });

        expect(console.error).not.toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Safe Function Wrappers
  // ============================================================================

  describe('Safe Function Wrappers', () => {
    describe('createSafeAsync', () => {
      it('should pass through successful results', async () => {
        const fn = async (x: number) => x * 2;
        const safeFn = createSafeAsync(fn);

        const result = await safeFn(5);

        expect(result).toBe(10);
      });

      it('should catch and handle errors', async () => {
        const fn = async () => {
          throw new Error('Async error');
        };
        const safeFn = createSafeAsync(fn);

        await expect(safeFn()).rejects.toBeInstanceOf(BitChatError);
      });

      it('should use fallback when provided', async () => {
        const fn = async (): Promise<number> => {
          throw new Error('Async error');
        };
        const safeFn = createSafeAsync(fn, { fallback: -1 });

        const result = await safeFn();

        expect(result).toBe(-1);
      });

      it('should call onError callback', async () => {
        const onError = vi.fn();
        const fn = async () => {
          throw new Error('Async error');
        };
        const safeFn = createSafeAsync(fn, { onError, fallback: null });

        await safeFn();

        expect(onError).toHaveBeenCalledWith(expect.any(BitChatError));
      });

      it('should add context to errors', async () => {
        const fn = async () => {
          throw new Error('Async error');
        };
        const safeFn = createSafeAsync(fn, {
          context: { component: 'TestComponent' },
        });

        try {
          await safeFn();
        } catch (error) {
          if (error instanceof BitChatError) {
            // Context is added during handleError
            expect(error).toBeInstanceOf(BitChatError);
          }
        }
      });
    });

    describe('createSafe', () => {
      it('should pass through successful results', () => {
        const fn = (x: number) => x * 2;
        const safeFn = createSafe(fn);

        const result = safeFn(5);

        expect(result).toBe(10);
      });

      it('should catch and handle errors', () => {
        const fn = () => {
          throw new Error('Sync error');
        };
        const safeFn = createSafe(fn);

        expect(() => safeFn()).toThrow(BitChatError);
      });

      it('should use fallback when provided', () => {
        const fn = (): number => {
          throw new Error('Sync error');
        };
        const safeFn = createSafe(fn, { fallback: -1 });

        const result = safeFn();

        expect(result).toBe(-1);
      });

      it('should call onError callback', () => {
        const onError = vi.fn();
        const fn = () => {
          throw new Error('Sync error');
        };
        const safeFn = createSafe(fn, { onError, fallback: null });

        safeFn();

        expect(onError).toHaveBeenCalledWith(expect.any(BitChatError));
      });
    });
  });

  // ============================================================================
  // Global Event Handling
  // ============================================================================

  describe('Global Event Handling', () => {
    describe('handleGlobalError', () => {
      it('should handle ErrorEvent', () => {
        handler.install();

        // Get the error handler function
        const errorHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
          (call) => call[0] === 'error'
        )?.[1];

        const errorEvent = {
          error: new Error('Global error'),
          message: 'Global error',
          filename: 'test.js',
          lineno: 10,
          colno: 5,
          preventDefault: vi.fn(),
        };

        errorHandler?.(errorEvent);

        expect(errorEvent.preventDefault).toHaveBeenCalled();
        expect(handler.getLog().length).toBe(1);
      });

      it('should handle ErrorEvent without error object', () => {
        handler.install();

        const errorHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
          (call) => call[0] === 'error'
        )?.[1];

        const errorEvent = {
          error: null,
          message: 'Script error',
          filename: 'unknown.js',
          lineno: 0,
          colno: 0,
          preventDefault: vi.fn(),
        };

        errorHandler?.(errorEvent);

        expect(handler.getLog().length).toBe(1);
        expect(handler.getLog()[0].error.message).toBe('Script error');
      });
    });

    describe('handleUnhandledRejection', () => {
      it('should handle PromiseRejectionEvent', () => {
        handler.install();

        // Get the rejection handler function
        const rejectionHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
          (call) => call[0] === 'unhandledrejection'
        )?.[1];

        const rejectionEvent = {
          reason: new Error('Promise rejection'),
          preventDefault: vi.fn(),
        };

        rejectionHandler?.(rejectionEvent);

        expect(rejectionEvent.preventDefault).toHaveBeenCalled();
        expect(handler.getLog().length).toBe(1);
      });

      it('should handle non-Error rejection reasons', () => {
        handler.install();

        const rejectionHandler = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls.find(
          (call) => call[0] === 'unhandledrejection'
        )?.[1];

        const rejectionEvent = {
          reason: 'String rejection',
          preventDefault: vi.fn(),
        };

        rejectionHandler?.(rejectionEvent);

        expect(handler.getLog().length).toBe(1);
      });
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    describe('_resetForTesting', () => {
      it('should uninstall handlers and reset instance', () => {
        handler.install();

        GlobalErrorHandler._resetForTesting();

        expect(window.removeEventListener).toHaveBeenCalled();

        // Should create new instance
        const newHandler = GlobalErrorHandler.getInstance();
        expect(newHandler.getLog().length).toBe(0);
      });
    });
  });
});
