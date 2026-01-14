/**
 * Error Handling Hooks - BitChat In Browser
 *
 * Custom hooks for managing error state and error handling in components.
 *
 * @module hooks/useError
 */

import { useState, useCallback, useEffect, useRef } from 'preact/hooks';
import {
  BitChatError,
  ErrorCategory,
  getUserMessage,
  isBitChatError,
  type ErrorSeverity,
} from '../services/errors';
import {
  handleError as globalHandleError,
  getErrorHandler,
  type ErrorLogEntry,
} from '../services/errors/handler';
import {
  retry,
  isTransientError,
  type RetryConfig,
  type RetryResult,
} from '../services/errors/recovery';
import type { ToastProps } from '../components/errors/ErrorMessage';

// ============================================================================
// Types
// ============================================================================

/**
 * Error state for a component
 */
export interface ErrorState {
  /** Current error, if any */
  error: BitChatError | null;
  /** Whether there's an error */
  hasError: boolean;
  /** User-friendly error message */
  message: string | null;
  /** Whether the error is recoverable */
  isRecoverable: boolean;
  /** Error severity */
  severity: ErrorSeverity | null;
  /** Timestamp when error occurred */
  timestamp: number | null;
}

/**
 * Error state actions
 */
export interface ErrorActions {
  /** Set an error */
  setError: (error: unknown) => void;
  /** Clear the current error */
  clearError: () => void;
  /** Set error from a caught exception */
  handleError: (error: unknown) => BitChatError;
  /** Clear error after a delay */
  clearErrorAfter: (delayMs: number) => void;
}

/**
 * Return type for useError hook
 */
export interface UseErrorReturn extends ErrorState, ErrorActions {}

/**
 * Options for useError hook
 */
export interface UseErrorOptions {
  /** Initial error */
  initialError?: Error | null;
  /** Auto-clear timeout (0 to disable) */
  autoClearMs?: number;
  /** Whether to log errors globally */
  logGlobally?: boolean;
  /** Component name for context */
  componentName?: string;
  /** Callback when error occurs */
  onError?: (error: BitChatError) => void;
  /** Callback when error is cleared */
  onClear?: () => void;
}

/**
 * Toast state
 */
export interface ToastState {
  toasts: ToastProps[];
}

/**
 * Toast actions
 */
export interface ToastActions {
  showToast: (
    message: string,
    type?: ToastProps['type'],
    options?: Partial<ToastProps>
  ) => string;
  showError: (error: unknown, options?: Partial<ToastProps>) => string;
  showSuccess: (message: string, options?: Partial<ToastProps>) => string;
  showWarning: (message: string, options?: Partial<ToastProps>) => string;
  showInfo: (message: string, options?: Partial<ToastProps>) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

/**
 * Return type for useToasts hook
 */
export interface UseToastsReturn extends ToastState, ToastActions {}

// ============================================================================
// useError Hook
// ============================================================================

/**
 * Hook for managing error state in a component.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { error, hasError, message, setError, clearError, handleError } = useError({
 *     componentName: 'MyComponent',
 *     autoClearMs: 5000,
 *   });
 *
 *   const fetchData = async () => {
 *     try {
 *       const data = await api.getData();
 *       return data;
 *     } catch (e) {
 *       handleError(e);
 *     }
 *   };
 *
 *   if (hasError) {
 *     return <ErrorMessage error={error} onDismiss={clearError} />;
 *   }
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useError(options: UseErrorOptions = {}): UseErrorReturn {
  const {
    initialError = null,
    autoClearMs = 0,
    logGlobally = true,
    componentName,
    onError,
    onClear,
  } = options;

  const [state, setState] = useState<ErrorState>(() => {
    if (initialError) {
      const bitChatError = isBitChatError(initialError)
        ? initialError
        : BitChatError.fromError(initialError);
      return {
        error: bitChatError,
        hasError: true,
        message: bitChatError.userMessage,
        isRecoverable: bitChatError.recoverable,
        severity: bitChatError.severity,
        timestamp: Date.now(),
      };
    }
    return {
      error: null,
      hasError: false,
      message: null,
      isRecoverable: false,
      severity: null,
      timestamp: null,
    };
  });

  const clearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount
  useEffect(() => () => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
    }, []);

  // Auto-clear when autoClearMs is set
  useEffect(() => {
    if (state.hasError && autoClearMs > 0) {
      clearTimeoutRef.current = setTimeout(() => {
        setState({
          error: null,
          hasError: false,
          message: null,
          isRecoverable: false,
          severity: null,
          timestamp: null,
        });
        onClear?.();
      }, autoClearMs);

      return () => {
        if (clearTimeoutRef.current) {
          clearTimeout(clearTimeoutRef.current);
        }
      };
    }
    return undefined;
  }, [state.hasError, autoClearMs, onClear]);

  const setError = useCallback(
    (error: unknown) => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
        clearTimeoutRef.current = null;
      }

      let bitChatError: BitChatError;

      if (error instanceof BitChatError) {
        bitChatError = error;
      } else if (error instanceof Error) {
        bitChatError = BitChatError.fromError(error, {
          context: { component: componentName },
        });
      } else {
        bitChatError = new BitChatError(
          typeof error === 'string' ? error : 'Unknown error',
          { context: { component: componentName } }
        );
      }

      // Log globally if enabled
      if (logGlobally) {
        globalHandleError(bitChatError, { silent: true });
      }

      setState({
        error: bitChatError,
        hasError: true,
        message: bitChatError.userMessage,
        isRecoverable: bitChatError.recoverable,
        severity: bitChatError.severity,
        timestamp: Date.now(),
      });

      onError?.(bitChatError);
    },
    [componentName, logGlobally, onError]
  );

  const clearError = useCallback(() => {
    if (clearTimeoutRef.current) {
      clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = null;
    }

    setState({
      error: null,
      hasError: false,
      message: null,
      isRecoverable: false,
      severity: null,
      timestamp: null,
    });

    onClear?.();
  }, [onClear]);

  const handleError = useCallback(
    (error: unknown): BitChatError => {
      setError(error);
      return state.error ?? BitChatError.fromError(error as Error);
    },
    [setError, state.error]
  );

  const clearErrorAfter = useCallback(
    (delayMs: number) => {
      if (clearTimeoutRef.current) {
        clearTimeout(clearTimeoutRef.current);
      }
      clearTimeoutRef.current = setTimeout(clearError, delayMs);
    },
    [clearError]
  );

  return {
    ...state,
    setError,
    clearError,
    handleError,
    clearErrorAfter,
  };
}

// ============================================================================
// useToasts Hook
// ============================================================================

let toastIdCounter = 0;

/**
 * Hook for managing toast notifications.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { toasts, showError, showSuccess, dismissToast } = useToasts();
 *
 *   const handleSubmit = async () => {
 *     try {
 *       await api.submit();
 *       showSuccess('Submitted successfully!');
 *     } catch (e) {
 *       showError(e);
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <ToastContainer toasts={toasts} />
 *       <button onClick={handleSubmit}>Submit</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useToasts(maxToasts: number = 5): UseToastsReturn {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (
      message: string,
      type: ToastProps['type'] = 'info',
      options: Partial<ToastProps> = {}
    ): string => {
      const id = `toast_${++toastIdCounter}`;
      const toast: ToastProps = {
        id,
        message,
        type,
        duration: 5000,
        onDismiss: dismissToast,
        ...options,
      };

      setToasts((current) => {
        const updated = [toast, ...current];
        return updated.slice(0, maxToasts);
      });

      return id;
    },
    [dismissToast, maxToasts]
  );

  const showError = useCallback(
    (error: unknown, options: Partial<ToastProps> = {}): string => {
      const message = getUserMessage(error);
      return showToast(message, 'error', { duration: 8000, ...options });
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (message: string, options: Partial<ToastProps> = {}): string => showToast(message, 'success', options),
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, options: Partial<ToastProps> = {}): string => showToast(message, 'warning', { duration: 6000, ...options }),
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, options: Partial<ToastProps> = {}): string => showToast(message, 'info', options),
    [showToast]
  );

  const clearAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    dismissToast,
    clearAllToasts,
  };
}

// ============================================================================
// useAsyncError Hook
// ============================================================================

/**
 * Options for useAsyncError hook
 */
export interface UseAsyncErrorOptions<T> extends UseErrorOptions {
  /** Retry configuration */
  retryConfig?: Partial<RetryConfig>;
  /** Fallback value on error */
  fallback?: T;
  /** Whether to retry automatically */
  autoRetry?: boolean;
}

/**
 * Return type for useAsyncError hook
 */
export interface UseAsyncErrorReturn<T> extends UseErrorReturn {
  /** Execute an async operation with error handling */
  execute: (fn: () => Promise<T>) => Promise<T | undefined>;
  /** Execute with retry logic */
  executeWithRetry: (fn: () => Promise<T>) => Promise<RetryResult<T>>;
  /** Whether currently executing */
  isLoading: boolean;
  /** Result of last successful execution */
  data: T | undefined;
}

/**
 * Hook for handling async operations with built-in error handling.
 *
 * @example
 * ```tsx
 * function DataLoader() {
 *   const { execute, isLoading, data, error, hasError } = useAsyncError<User[]>({
 *     componentName: 'DataLoader',
 *     fallback: [],
 *   });
 *
 *   useEffect(() => {
 *     execute(() => fetchUsers());
 *   }, [execute]);
 *
 *   if (isLoading) return <Loading />;
 *   if (hasError) return <ErrorMessage error={error} />;
 *   return <UserList users={data} />;
 * }
 * ```
 */
export function useAsyncError<T>(
  options: UseAsyncErrorOptions<T> = {}
): UseAsyncErrorReturn<T> {
  const { retryConfig, fallback, autoRetry = false, ...errorOptions } = options;

  const errorState = useError(errorOptions);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<T | undefined>(undefined);

  const execute = useCallback(
    async (fn: () => Promise<T>): Promise<T | undefined> => {
      setIsLoading(true);
      errorState.clearError();

      try {
        const result = await fn();
        setData(result);
        return result;
      } catch (error) {
        errorState.setError(error);

        if (fallback !== undefined) {
          setData(fallback);
          return fallback;
        }

        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [errorState, fallback]
  );

  const executeWithRetry = useCallback(
    async (fn: () => Promise<T>): Promise<RetryResult<T>> => {
      setIsLoading(true);
      errorState.clearError();

      const result = await retry(fn, {
        ...retryConfig,
        onRetry: (error, attempt, delayMs) => {
          console.log(`[Retry] Attempt ${attempt}, waiting ${delayMs}ms`);
          retryConfig?.onRetry?.(error, attempt, delayMs);
        },
      });

      if (result.success && result.value !== undefined) {
        setData(result.value);
      } else if (result.error) {
        errorState.setError(result.error);

        if (fallback !== undefined) {
          setData(fallback);
        }
      }

      setIsLoading(false);
      return result;
    },
    [errorState, retryConfig, fallback]
  );

  return {
    ...errorState,
    execute,
    executeWithRetry,
    isLoading,
    data,
  };
}

// ============================================================================
// useGlobalErrors Hook
// ============================================================================

/**
 * Hook for subscribing to global error events.
 *
 * @example
 * ```tsx
 * function ErrorMonitor() {
 *   const { recentErrors, stats, clearLog } = useGlobalErrors();
 *
 *   return (
 *     <div>
 *       <p>Total errors: {stats.totalErrors}</p>
 *       <ul>
 *         {recentErrors.map(entry => (
 *           <li key={entry.id}>{entry.error.message}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGlobalErrors(options: { onError?: (error: BitChatError) => void } = {}) {
  const [recentErrors, setRecentErrors] = useState<ErrorLogEntry[]>([]);
  const handler = getErrorHandler();

  useEffect(() => {
    // Get initial errors
    setRecentErrors(handler.getRecentErrors(10));

    // Subscribe to new errors
    const unsubscribe = handler.addListener((error) => {
      setRecentErrors(handler.getRecentErrors(10));
      options.onError?.(error);
    });

    return unsubscribe;
  }, [handler, options.onError]);

  const stats = handler.getStats();

  const clearLog = useCallback(() => {
    handler.clearLog();
    setRecentErrors([]);
  }, [handler]);

  const exportLog = useCallback(() => handler.exportLog(), [handler]);

  return {
    recentErrors,
    stats,
    clearLog,
    exportLog,
  };
}

// ============================================================================
// useNetworkError Hook
// ============================================================================

/**
 * Hook for handling network-related errors with online/offline detection.
 *
 * @example
 * ```tsx
 * function NetworkStatus() {
 *   const { isOnline, isReconnecting, lastError } = useNetworkError({
 *     onOffline: () => console.log('Went offline'),
 *     onOnline: () => console.log('Back online'),
 *   });
 *
 *   return (
 *     <ConnectionStatusBanner
 *       isOnline={isOnline}
 *       isReconnecting={isReconnecting}
 *     />
 *   );
 * }
 * ```
 */
export function useNetworkError(options: {
  onOffline?: () => void;
  onOnline?: () => void;
  onError?: (error: BitChatError) => void;
} = {}) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastError, setLastError] = useState<BitChatError | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setIsReconnecting(false);
      setLastError(null);
      options.onOnline?.();
    };

    const handleOffline = () => {
      setIsOnline(false);
      options.onOffline?.();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [options.onOnline, options.onOffline]);

  // Subscribe to network errors from global handler
  useEffect(() => {
    const handler = getErrorHandler();
    const unsubscribe = handler.addListener((error) => {
      if (error.category === ErrorCategory.NETWORK) {
        setLastError(error);
        options.onError?.(error);

        // If error is transient, mark as reconnecting
        if (isTransientError(error)) {
          setIsReconnecting(true);
        }
      }
    });

    return unsubscribe;
  }, [options.onError]);

  return {
    isOnline,
    isReconnecting,
    lastError,
    setIsReconnecting,
    clearLastError: () => setLastError(null),
  };
}

// ============================================================================
// useErrorBoundaryReset Hook
// ============================================================================

/**
 * Hook for resetting error boundaries when certain values change.
 *
 * @example
 * ```tsx
 * function MyPage({ userId }) {
 *   const resetKey = useErrorBoundaryReset([userId]);
 *
 *   return (
 *     <ErrorBoundary key={resetKey}>
 *       <UserProfile userId={userId} />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */
export function useErrorBoundaryReset(deps: unknown[]): number {
  const [resetKey, setResetKey] = useState(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setResetKey((k) => k + 1);
  }, deps);

  return resetKey;
}

// ============================================================================
// Export
// ============================================================================

export default useError;
