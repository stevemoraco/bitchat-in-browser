/**
 * Error Recovery Service - BitChat In Browser
 *
 * Provides automatic error recovery strategies including:
 * - Retry with exponential backoff
 * - Circuit breaker pattern
 * - Fallback behaviors
 * - Transient error detection
 *
 * @module services/errors/recovery
 */

import {
  BitChatError,
  ErrorCode,
  ErrorCategory,
  isRecoverableError,
  getErrorCode,
} from './index';

// ============================================================================
// Types
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: number;
  /** Error codes that should trigger retry */
  retryableCodes?: ErrorCode[];
  /** Error categories that should trigger retry */
  retryableCategories?: ErrorCategory[];
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown, attempt: number) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Retry result
 */
export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: unknown;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Circuit breaker state
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time in ms before attempting recovery */
  recoveryTimeoutMs: number;
  /** Number of successes in half-open to close circuit */
  successThreshold: number;
  /** Time window for tracking failures */
  windowMs: number;
  /** Callback when circuit state changes */
  onStateChange?: (state: CircuitState, stats: CircuitStats) => void;
}

/**
 * Circuit breaker statistics
 */
export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  totalCalls: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Fallback configuration
 */
export interface FallbackConfig<T> {
  /** Primary fallback value or function */
  primary: T | (() => T | Promise<T>);
  /** Secondary fallback if primary fails */
  secondary?: T | (() => T | Promise<T>);
  /** Final fallback if all else fails */
  final?: T;
  /** Callback when fallback is used */
  onFallback?: (error: unknown, fallbackLevel: number) => void;
}

// ============================================================================
// Default Configurations
// ============================================================================

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.2,
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 30000,
  successThreshold: 2,
  windowMs: 60000,
};

/**
 * Error codes that are typically transient and worth retrying
 */
const TRANSIENT_ERROR_CODES: ErrorCode[] = [
  ErrorCode.NETWORK_OFFLINE,
  ErrorCode.NETWORK_TIMEOUT,
  ErrorCode.RELAY_CONNECTION_FAILED,
  ErrorCode.RELAY_TIMEOUT,
  ErrorCode.RELAY_RATE_LIMITED,
  ErrorCode.WEBRTC_CONNECTION_FAILED,
  ErrorCode.WEBRTC_SIGNALING_FAILED,
  ErrorCode.SYNC_TIMEOUT,
  ErrorCode.SYNC_FAILED,
  ErrorCode.STORAGE_WRITE_FAILED,
  ErrorCode.STORAGE_READ_FAILED,
];

/**
 * Categories that typically have transient errors
 */
const TRANSIENT_CATEGORIES: ErrorCategory[] = [
  ErrorCategory.NETWORK,
  ErrorCategory.SYNC,
];

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   async () => {
 *     return await fetchFromRelay(url);
 *   },
 *   {
 *     maxAttempts: 3,
 *     initialDelayMs: 1000,
 *     onRetry: (error, attempt) => {
 *       console.log(`Retry attempt ${attempt}`);
 *     },
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    jitterFactor,
    retryableCodes,
    retryableCategories,
    isRetryable,
    onRetry,
  } = finalConfig;

  let attempt = 0;
  let totalDelayMs = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    try {
      const value = await fn();
      return {
        success: true,
        value,
        attempts: attempt + 1,
        totalDelayMs,
      };
    } catch (error) {
      lastError = error;
      attempt++;

      // Check if we should retry
      const shouldRetry =
        attempt < maxAttempts &&
        checkRetryable(error, attempt, {
          retryableCodes,
          retryableCategories,
          isRetryable,
        });

      if (!shouldRetry) {
        break;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt - 1),
        maxDelayMs
      );
      const jitter = baseDelay * jitterFactor * (Math.random() * 2 - 1);
      const delayMs = Math.round(baseDelay + jitter);

      onRetry?.(error, attempt, delayMs);

      await sleep(delayMs);
      totalDelayMs += delayMs;
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: attempt,
    totalDelayMs,
  };
}

/**
 * Check if an error is retryable
 */
function checkRetryable(
  error: unknown,
  attempt: number,
  options: {
    retryableCodes?: ErrorCode[];
    retryableCategories?: ErrorCategory[];
    isRetryable?: (error: unknown, attempt: number) => boolean;
  }
): boolean {
  // Custom check first
  if (options.isRetryable) {
    return options.isRetryable(error, attempt);
  }

  // Check if it's a recoverable BitChatError
  if (isRecoverableError(error)) {
    const code = getErrorCode(error);
    const codes = options.retryableCodes ?? TRANSIENT_ERROR_CODES;

    if (codes.includes(code)) {
      return true;
    }

    if (error instanceof BitChatError) {
      const categories = options.retryableCategories ?? TRANSIENT_CATEGORIES;
      if (categories.includes(error.category)) {
        return true;
      }
    }
  }

  // Check for common transient error patterns
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('econnreset') ||
      message.includes('etimedout')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Create a retryable version of a function
 */
export function withRetry<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  config: Partial<RetryConfig> = {}
): (...args: Args) => Promise<T> {
  return async (...args: Args): Promise<T> => {
    const result = await retry(() => fn(...args), config);

    if (result.success && result.value !== undefined) {
      return result.value;
    }

    throw result.error;
  };
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker implementation for protecting against cascading failures.
 *
 * States:
 * - Closed: Normal operation, calls pass through
 * - Open: Calls immediately fail, giving service time to recover
 * - Half-Open: Allows limited calls to test if service has recovered
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   recoveryTimeoutMs: 30000,
 * });
 *
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await callExternalService();
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Circuit is open, use fallback
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitState = 'closed';
  private failures: { timestamp: number }[] = [];
  private halfOpenSuccesses = 0;
  private lastStateChange = Date.now();
  private totalCalls = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailure: number | null = null;
  private lastSuccess: number | null = null;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Execute a function through the circuit breaker
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check state before executing
    this.updateState();

    if (this.state === 'open') {
      throw new CircuitOpenError(
        'Circuit breaker is open',
        this.getStats()
      );
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Get current state
   */
  public getState(): CircuitState {
    this.updateState();
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  public getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.getRecentFailures().length,
      successes: this.halfOpenSuccesses,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  public reset(): void {
    this.setState('closed');
    this.failures = [];
    this.halfOpenSuccesses = 0;
  }

  /**
   * Force circuit open (for manual intervention)
   */
  public forceOpen(): void {
    this.setState('open');
  }

  /**
   * Record a successful call
   */
  private recordSuccess(): void {
    this.totalSuccesses++;
    this.lastSuccess = Date.now();

    if (this.state === 'half-open') {
      this.halfOpenSuccesses++;

      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.setState('closed');
        this.failures = [];
        this.halfOpenSuccesses = 0;
      }
    }
  }

  /**
   * Record a failed call
   */
  private recordFailure(): void {
    this.totalFailures++;
    this.lastFailure = Date.now();

    if (this.state === 'half-open') {
      this.setState('open');
      this.halfOpenSuccesses = 0;
      return;
    }

    this.failures.push({ timestamp: Date.now() });

    if (this.getRecentFailures().length >= this.config.failureThreshold) {
      this.setState('open');
    }
  }

  /**
   * Update state based on time
   */
  private updateState(): void {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastStateChange;
      if (elapsed >= this.config.recoveryTimeoutMs) {
        this.setState('half-open');
        this.halfOpenSuccesses = 0;
      }
    }
  }

  /**
   * Set circuit state
   */
  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.lastStateChange = Date.now();
      this.config.onStateChange?.(newState, this.getStats());
    }
  }

  /**
   * Get failures within the window
   */
  private getRecentFailures(): { timestamp: number }[] {
    const cutoff = Date.now() - this.config.windowMs;
    this.failures = this.failures.filter((f) => f.timestamp > cutoff);
    return this.failures;
  }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  public readonly stats: CircuitStats;

  constructor(message: string, stats: CircuitStats) {
    super(message);
    this.name = 'CircuitOpenError';
    this.stats = stats;
  }
}

/**
 * Create a circuit-protected version of a function
 */
export function withCircuitBreaker<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  config: Partial<CircuitBreakerConfig> = {}
): {
  execute: (...args: Args) => Promise<T>;
  getStats: () => CircuitStats;
  reset: () => void;
} {
  const breaker = new CircuitBreaker(config);

  return {
    execute: (...args: Args) => breaker.execute(() => fn(...args)),
    getStats: () => breaker.getStats(),
    reset: () => breaker.reset(),
  };
}

// ============================================================================
// Fallback
// ============================================================================

/**
 * Execute with fallback values/functions
 */
export async function withFallback<T>(
  fn: () => Promise<T>,
  config: FallbackConfig<T>
): Promise<T> {
  const { primary, secondary, final, onFallback } = config;

  try {
    return await fn();
  } catch (primaryError) {
    // Try primary fallback
    try {
      onFallback?.(primaryError, 1);
      const value =
        typeof primary === 'function'
          ? await (primary as () => T | Promise<T>)()
          : primary;
      return value;
    } catch (primaryFallbackError) {
      // Try secondary fallback
      if (secondary !== undefined) {
        try {
          onFallback?.(primaryFallbackError, 2);
          const value =
            typeof secondary === 'function'
              ? await (secondary as () => T | Promise<T>)()
              : secondary;
          return value;
        } catch {
          // Fall through to final
        }
      }

      // Try final fallback
      if (final !== undefined) {
        onFallback?.(primaryFallbackError, 3);
        return final;
      }

      // No fallback available, rethrow original error
      throw primaryError;
    }
  }
}

/**
 * Create a function with built-in fallback
 */
export function createWithFallback<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  config: FallbackConfig<T>
): (...args: Args) => Promise<T> {
  return (...args: Args) => withFallback(() => fn(...args), config);
}

// ============================================================================
// Recovery Strategies
// ============================================================================

/**
 * Recovery strategy type
 */
export type RecoveryStrategy = 'retry' | 'fallback' | 'circuit-breaker' | 'ignore';

/**
 * Get recommended recovery strategy for an error
 */
export function getRecoveryStrategy(error: unknown): RecoveryStrategy {
  if (!isRecoverableError(error)) {
    return 'ignore';
  }

  const code = getErrorCode(error);

  // Network errors should use retry with circuit breaker
  if (TRANSIENT_ERROR_CODES.includes(code)) {
    return 'retry';
  }

  // Storage errors might need fallback
  if (error instanceof BitChatError && error.category === ErrorCategory.STORAGE) {
    return 'fallback';
  }

  return 'retry';
}

/**
 * Apply recovery strategy to a function
 */
export async function applyRecovery<T>(
  fn: () => Promise<T>,
  options: {
    strategy?: RecoveryStrategy;
    retryConfig?: Partial<RetryConfig>;
    fallbackValue?: T;
  } = {}
): Promise<T> {
  const { strategy = 'retry', retryConfig, fallbackValue } = options;

  switch (strategy) {
    case 'retry':
      const result = await retry(fn, retryConfig);
      if (result.success && result.value !== undefined) {
        return result.value;
      }
      if (fallbackValue !== undefined) {
        return fallbackValue;
      }
      throw result.error;

    case 'fallback':
      if (fallbackValue === undefined) {
        return fn();
      }
      return withFallback(fn, { primary: fallbackValue });

    case 'circuit-breaker':
      const breaker = new CircuitBreaker();
      return breaker.execute(fn);

    case 'ignore':
    default:
      return fn();
  }
}

// ============================================================================
// Transient Error Detection
// ============================================================================

/**
 * Check if an error is transient (temporary, worth retrying)
 */
export function isTransientError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (TRANSIENT_ERROR_CODES.includes(code)) {
    return true;
  }

  if (error instanceof BitChatError) {
    return TRANSIENT_CATEGORIES.includes(error.category);
  }

  return false;
}

/**
 * Check if error indicates we should back off
 */
export function shouldBackoff(error: unknown): boolean {
  const code = getErrorCode(error);
  return code === ErrorCode.RELAY_RATE_LIMITED;
}

/**
 * Get recommended backoff time based on error
 */
export function getBackoffTime(error: unknown): number {
  const code = getErrorCode(error);

  switch (code) {
    case ErrorCode.RELAY_RATE_LIMITED:
      return 30000; // 30 seconds
    case ErrorCode.NETWORK_TIMEOUT:
    case ErrorCode.RELAY_TIMEOUT:
    case ErrorCode.SYNC_TIMEOUT:
      return 5000; // 5 seconds
    case ErrorCode.RELAY_CONNECTION_FAILED:
    case ErrorCode.WEBRTC_CONNECTION_FAILED:
      return 10000; // 10 seconds
    default:
      return 1000; // 1 second default
  }
}

// ============================================================================
// Utilities
// ============================================================================

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Debounce errors to prevent rapid-fire error handling
 */
export function createErrorDebouncer(
  handler: (errors: unknown[]) => void,
  delayMs: number = 1000
): (error: unknown) => void {
  let errors: unknown[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (error: unknown) => {
    errors.push(error);

    if (timeoutId === null) {
      timeoutId = setTimeout(() => {
        handler(errors);
        errors = [];
        timeoutId = null;
      }, delayMs);
    }
  };
}

/**
 * Throttle error handling
 */
export function createErrorThrottler(
  handler: (error: unknown) => void,
  limitMs: number = 1000
): (error: unknown) => void {
  let lastCall = 0;
  let pendingError: unknown = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (error: unknown) => {
    const now = Date.now();
    const elapsed = now - lastCall;

    if (elapsed >= limitMs) {
      lastCall = now;
      handler(error);
    } else {
      pendingError = error;

      if (timeoutId === null) {
        timeoutId = setTimeout(() => {
          if (pendingError !== null) {
            lastCall = Date.now();
            handler(pendingError);
            pendingError = null;
          }
          timeoutId = null;
        }, limitMs - elapsed);
      }
    }
  };
}

// ============================================================================
// Export
// ============================================================================

export {
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  TRANSIENT_ERROR_CODES,
  TRANSIENT_CATEGORIES,
};
