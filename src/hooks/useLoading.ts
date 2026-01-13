/**
 * useLoading Hook - Loading state management
 *
 * Features:
 * - Loading state tracking
 * - Minimum display time (prevent flicker)
 * - Timeout handling
 * - Multiple concurrent loading states
 * - Error state integration
 *
 * @module hooks/useLoading
 */

import { useState, useCallback, useRef, useEffect } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export interface LoadingState {
  /** Whether currently loading */
  isLoading: boolean;
  /** Current loading message */
  message?: string;
  /** Progress value (0-100) */
  progress?: number;
  /** Error that occurred during loading */
  error?: Error | null;
  /** Timestamp when loading started */
  startedAt?: number;
}

export interface UseLoadingOptions {
  /** Minimum time to show loading state (ms) - prevents flicker */
  minDisplayTime?: number;
  /** Maximum time before timeout (ms) */
  timeout?: number;
  /** Initial loading state */
  initialLoading?: boolean;
  /** Initial message */
  initialMessage?: string;
  /** Callback when timeout occurs */
  onTimeout?: () => void;
  /** Callback when loading completes */
  onComplete?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export interface UseLoadingReturn {
  /** Current loading state */
  state: LoadingState;
  /** Whether currently loading */
  isLoading: boolean;
  /** Current error if any */
  error: Error | null;
  /** Current progress value */
  progress: number | undefined;
  /** Current loading message */
  message: string | undefined;
  /** Start loading */
  startLoading: (message?: string) => void;
  /** Stop loading */
  stopLoading: () => void;
  /** Set loading error */
  setError: (error: Error | null) => void;
  /** Update progress */
  setProgress: (value: number) => void;
  /** Update message */
  setMessage: (message: string) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Execute async function with loading state */
  withLoading: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<UseLoadingOptions, 'onTimeout' | 'onComplete' | 'onError'>> = {
  minDisplayTime: 300,
  timeout: 30000,
  initialLoading: false,
  initialMessage: '',
};

// ============================================================================
// useLoading Hook
// ============================================================================

export function useLoading(options: UseLoadingOptions = {}): UseLoadingReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const [state, setState] = useState<LoadingState>({
    isLoading: opts.initialLoading,
    message: opts.initialMessage,
    progress: undefined,
    error: null,
    startedAt: opts.initialLoading ? Date.now() : undefined,
  });

  const timeoutRef = useRef<number | null>(null);
  const minDisplayRef = useRef<number | null>(null);
  const loadingStartRef = useRef<number | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (minDisplayRef.current) clearTimeout(minDisplayRef.current);
    };
  }, []);

  /**
   * Start loading state
   */
  const startLoading = useCallback((message?: string) => {
    const now = Date.now();
    loadingStartRef.current = now;

    // Clear any existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (minDisplayRef.current) clearTimeout(minDisplayRef.current);

    setState({
      isLoading: true,
      message: message ?? opts.initialMessage,
      progress: undefined,
      error: null,
      startedAt: now,
    });

    // Set timeout if configured
    if (opts.timeout > 0) {
      timeoutRef.current = window.setTimeout(() => {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: new Error('Loading timeout'),
        }));
        options.onTimeout?.();
      }, opts.timeout);
    }
  }, [opts.timeout, opts.initialMessage, options]);

  /**
   * Stop loading state (respects minimum display time)
   */
  const stopLoading = useCallback(() => {
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const elapsed = loadingStartRef.current ? Date.now() - loadingStartRef.current : 0;
    const remaining = Math.max(0, opts.minDisplayTime - elapsed);

    const doStop = () => {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        startedAt: undefined,
      }));
      loadingStartRef.current = null;
      options.onComplete?.();
    };

    if (remaining > 0) {
      minDisplayRef.current = window.setTimeout(doStop, remaining);
    } else {
      doStop();
    }
  }, [opts.minDisplayTime, options]);

  /**
   * Set error state
   */
  const setError = useCallback((error: Error | null) => {
    // Clear any timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (minDisplayRef.current) {
      clearTimeout(minDisplayRef.current);
      minDisplayRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isLoading: false,
      error,
      startedAt: undefined,
    }));

    if (error) {
      options.onError?.(error);
    }
  }, [options]);

  /**
   * Update progress
   */
  const setProgress = useCallback((value: number) => {
    setState((prev) => ({
      ...prev,
      progress: Math.max(0, Math.min(100, value)),
    }));
  }, []);

  /**
   * Update message
   */
  const setMessage = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      message,
    }));
  }, []);

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (minDisplayRef.current) clearTimeout(minDisplayRef.current);
    loadingStartRef.current = null;

    setState({
      isLoading: opts.initialLoading,
      message: opts.initialMessage,
      progress: undefined,
      error: null,
      startedAt: opts.initialLoading ? Date.now() : undefined,
    });
  }, [opts.initialLoading, opts.initialMessage]);

  /**
   * Execute async function with loading state
   */
  const withLoading = useCallback(async <T>(
    fn: () => Promise<T>,
    message?: string
  ): Promise<T> => {
    startLoading(message);
    try {
      const result = await fn();
      stopLoading();
      return result;
    } catch (error) {
      setError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }, [startLoading, stopLoading, setError]);

  return {
    state,
    isLoading: state.isLoading,
    error: state.error ?? null,
    progress: state.progress,
    message: state.message,
    startLoading,
    stopLoading,
    setError,
    setProgress,
    setMessage,
    reset,
    withLoading,
  };
}

// ============================================================================
// useMultiLoading Hook - Multiple concurrent loading states
// ============================================================================

export interface MultiLoadingState {
  [key: string]: LoadingState;
}

export interface UseMultiLoadingReturn {
  /** All loading states */
  states: MultiLoadingState;
  /** Whether any loading is active */
  isAnyLoading: boolean;
  /** Whether specific key is loading */
  isLoading: (key: string) => boolean;
  /** Start loading for a key */
  startLoading: (key: string, message?: string) => void;
  /** Stop loading for a key */
  stopLoading: (key: string) => void;
  /** Set error for a key */
  setError: (key: string, error: Error | null) => void;
  /** Set progress for a key */
  setProgress: (key: string, value: number) => void;
  /** Reset a specific key */
  reset: (key: string) => void;
  /** Reset all states */
  resetAll: () => void;
}

export function useMultiLoading(options: UseLoadingOptions = {}): UseMultiLoadingReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const [states, setStates] = useState<MultiLoadingState>({});
  const timeoutsRef = useRef<Map<string, number>>(new Map());
  const minDisplayRef = useRef<Map<string, number>>(new Map());
  const startTimesRef = useRef<Map<string, number>>(new Map());

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((t) => clearTimeout(t));
      minDisplayRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  const isLoading = useCallback((key: string): boolean => {
    return states[key]?.isLoading ?? false;
  }, [states]);

  const startLoading = useCallback((key: string, message?: string) => {
    const now = Date.now();
    startTimesRef.current.set(key, now);

    // Clear existing timeouts
    const existingTimeout = timeoutsRef.current.get(key);
    if (existingTimeout) clearTimeout(existingTimeout);
    const existingMinDisplay = minDisplayRef.current.get(key);
    if (existingMinDisplay) clearTimeout(existingMinDisplay);

    setStates((prev) => ({
      ...prev,
      [key]: {
        isLoading: true,
        message,
        progress: undefined,
        error: null,
        startedAt: now,
      },
    }));

    // Set timeout
    if (opts.timeout > 0) {
      const timeout = window.setTimeout(() => {
        setStates((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            isLoading: false,
            error: new Error('Loading timeout'),
          },
        }));
        options.onTimeout?.();
      }, opts.timeout);
      timeoutsRef.current.set(key, timeout);
    }
  }, [opts.timeout, options]);

  const stopLoading = useCallback((key: string) => {
    const existingTimeout = timeoutsRef.current.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutsRef.current.delete(key);
    }

    const startTime = startTimesRef.current.get(key);
    const elapsed = startTime ? Date.now() - startTime : 0;
    const remaining = Math.max(0, opts.minDisplayTime - elapsed);

    const doStop = () => {
      setStates((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          isLoading: false,
          startedAt: undefined,
        },
      }));
      startTimesRef.current.delete(key);
      options.onComplete?.();
    };

    if (remaining > 0) {
      const timeout = window.setTimeout(doStop, remaining);
      minDisplayRef.current.set(key, timeout);
    } else {
      doStop();
    }
  }, [opts.minDisplayTime, options]);

  const setError = useCallback((key: string, error: Error | null) => {
    const existingTimeout = timeoutsRef.current.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      timeoutsRef.current.delete(key);
    }
    const existingMinDisplay = minDisplayRef.current.get(key);
    if (existingMinDisplay) {
      clearTimeout(existingMinDisplay);
      minDisplayRef.current.delete(key);
    }

    setStates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        isLoading: false,
        error,
        startedAt: undefined,
      },
    }));

    if (error) {
      options.onError?.(error);
    }
  }, [options]);

  const setProgress = useCallback((key: string, value: number) => {
    setStates((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      return {
        ...prev,
        [key]: {
          ...existing,
          progress: Math.max(0, Math.min(100, value)),
        },
      };
    });
  }, []);

  const reset = useCallback((key: string) => {
    const existingTimeout = timeoutsRef.current.get(key);
    if (existingTimeout) clearTimeout(existingTimeout);
    const existingMinDisplay = minDisplayRef.current.get(key);
    if (existingMinDisplay) clearTimeout(existingMinDisplay);
    timeoutsRef.current.delete(key);
    minDisplayRef.current.delete(key);
    startTimesRef.current.delete(key);

    setStates((prev) => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const resetAll = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    minDisplayRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current.clear();
    minDisplayRef.current.clear();
    startTimesRef.current.clear();
    setStates({});
  }, []);

  return {
    states,
    isAnyLoading: Object.values(states).some((s) => s.isLoading),
    isLoading,
    startLoading,
    stopLoading,
    setError,
    setProgress,
    reset,
    resetAll,
  };
}

// ============================================================================
// useAsyncOperation Hook - For individual async operations
// ============================================================================

export interface AsyncOperationState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  isSuccess: boolean;
  isError: boolean;
}

export interface UseAsyncOperationOptions<T> extends UseLoadingOptions {
  /** Callback on success */
  onSuccess?: (data: T) => void;
}

export interface UseAsyncOperationReturn<T> extends AsyncOperationState<T> {
  /** Execute the async operation */
  execute: (...args: unknown[]) => Promise<T | null>;
  /** Reset state */
  reset: () => void;
  /** Current progress */
  progress: number | undefined;
  /** Current message */
  message: string | undefined;
  /** Update progress */
  setProgress: (value: number) => void;
}

export function useAsyncOperation<T>(
  asyncFn: (...args: unknown[]) => Promise<T>,
  options: UseAsyncOperationOptions<T> = {}
): UseAsyncOperationReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const loading = useLoading(options);

  const execute = useCallback(async (...args: unknown[]): Promise<T | null> => {
    loading.startLoading(options.initialMessage);
    try {
      const result = await asyncFn(...args);
      setData(result);
      loading.stopLoading();
      options.onSuccess?.(result);
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      loading.setError(err);
      return null;
    }
  }, [asyncFn, loading, options]);

  const reset = useCallback(() => {
    setData(null);
    loading.reset();
  }, [loading]);

  return {
    data,
    isLoading: loading.isLoading,
    error: loading.error,
    isSuccess: !loading.isLoading && !loading.error && data !== null,
    isError: !loading.isLoading && loading.error !== null,
    execute,
    reset,
    progress: loading.progress,
    message: loading.message,
    setProgress: loading.setProgress,
  };
}

// ============================================================================
// useDelayedLoading Hook - Show loading only after a delay
// ============================================================================

export interface UseDelayedLoadingOptions extends UseLoadingOptions {
  /** Delay before showing loading indicator (ms) */
  delay?: number;
}

export function useDelayedLoading(options: UseDelayedLoadingOptions = {}) {
  const { delay = 200, ...loadingOptions } = options;
  const [showLoading, setShowLoading] = useState(false);
  const loading = useLoading(loadingOptions);
  const delayRef = useRef<number | null>(null);

  const startLoading = useCallback((message?: string) => {
    loading.startLoading(message);

    // Only show loading after delay
    delayRef.current = window.setTimeout(() => {
      if (loading.isLoading) {
        setShowLoading(true);
      }
    }, delay);
  }, [loading, delay]);

  const stopLoading = useCallback(() => {
    if (delayRef.current) {
      clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    setShowLoading(false);
    loading.stopLoading();
  }, [loading]);

  useEffect(() => {
    return () => {
      if (delayRef.current) clearTimeout(delayRef.current);
    };
  }, []);

  return {
    ...loading,
    isLoading: loading.isLoading,
    showLoading,
    startLoading,
    stopLoading,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useLoading;
