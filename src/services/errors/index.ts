/**
 * Error Service - BitChat In Browser
 *
 * Custom error classes and error handling infrastructure.
 * Provides type-safe errors with codes, context capture, and serialization.
 *
 * @module services/errors
 */

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Error codes for categorization and handling.
 * Format: CATEGORY_SPECIFIC_ERROR
 */
export enum ErrorCode {
  // Generic errors (1xxx)
  UNKNOWN = 1000,
  INVALID_ARGUMENT = 1001,
  NOT_INITIALIZED = 1002,
  OPERATION_CANCELLED = 1003,
  TIMEOUT = 1004,
  NOT_SUPPORTED = 1005,

  // Network errors (2xxx)
  NETWORK_OFFLINE = 2000,
  NETWORK_TIMEOUT = 2001,
  NETWORK_DNS_FAILURE = 2002,
  RELAY_CONNECTION_FAILED = 2010,
  RELAY_AUTHENTICATION_FAILED = 2011,
  RELAY_TIMEOUT = 2012,
  RELAY_MESSAGE_REJECTED = 2013,
  RELAY_RATE_LIMITED = 2014,
  WEBRTC_CONNECTION_FAILED = 2020,
  WEBRTC_SIGNALING_FAILED = 2021,
  WEBRTC_DATA_CHANNEL_ERROR = 2022,
  WEBRTC_ICE_FAILED = 2023,

  // Crypto errors (3xxx)
  CRYPTO_NOT_READY = 3000,
  CRYPTO_KEY_GENERATION_FAILED = 3001,
  CRYPTO_ENCRYPTION_FAILED = 3002,
  CRYPTO_DECRYPTION_FAILED = 3003,
  CRYPTO_SIGNATURE_INVALID = 3004,
  CRYPTO_KEY_INVALID = 3005,
  CRYPTO_NONCE_REUSE = 3006,
  CRYPTO_WASM_LOAD_FAILED = 3007,

  // Storage errors (4xxx)
  STORAGE_NOT_AVAILABLE = 4000,
  STORAGE_QUOTA_EXCEEDED = 4001,
  STORAGE_READ_FAILED = 4002,
  STORAGE_WRITE_FAILED = 4003,
  STORAGE_DELETE_FAILED = 4004,
  STORAGE_CORRUPTED = 4005,
  STORAGE_MIGRATION_FAILED = 4006,
  INDEXEDDB_NOT_SUPPORTED = 4010,
  INDEXEDDB_BLOCKED = 4011,
  OPFS_NOT_SUPPORTED = 4020,
  OPFS_ACCESS_DENIED = 4021,

  // Identity errors (5xxx)
  IDENTITY_NOT_FOUND = 5000,
  IDENTITY_INVALID_KEY = 5001,
  IDENTITY_IMPORT_FAILED = 5002,
  IDENTITY_EXPORT_FAILED = 5003,
  IDENTITY_CREATION_FAILED = 5004,

  // Nostr protocol errors (6xxx)
  NOSTR_INVALID_EVENT = 6000,
  NOSTR_SIGNATURE_FAILED = 6001,
  NOSTR_PUBLISH_FAILED = 6002,
  NOSTR_SUBSCRIPTION_FAILED = 6003,
  NOSTR_NIP17_DECRYPT_FAILED = 6010,
  NOSTR_NIP17_ENCRYPT_FAILED = 6011,

  // Sync errors (7xxx)
  SYNC_CONFLICT = 7000,
  SYNC_VERSION_MISMATCH = 7001,
  SYNC_TIMEOUT = 7002,
  SYNC_FAILED = 7003,

  // Channel errors (8xxx)
  CHANNEL_NOT_FOUND = 8000,
  CHANNEL_ACCESS_DENIED = 8001,
  CHANNEL_CREATION_FAILED = 8002,
  GEOLOCATION_DENIED = 8010,
  GEOLOCATION_UNAVAILABLE = 8011,
  GEOLOCATION_TIMEOUT = 8012,

  // Service Worker errors (9xxx)
  SW_NOT_SUPPORTED = 9000,
  SW_REGISTRATION_FAILED = 9001,
  SW_UPDATE_FAILED = 9002,
  SW_CACHE_FAILED = 9003,
}

/**
 * Error severity levels for logging and display.
 */
export enum ErrorSeverity {
  /** Informational - not a real error, but notable */
  INFO = 'info',
  /** Warning - something unexpected but recoverable */
  WARNING = 'warning',
  /** Error - operation failed but app can continue */
  ERROR = 'error',
  /** Critical - app cannot function properly */
  CRITICAL = 'critical',
}

/**
 * Error categories for grouping.
 */
export enum ErrorCategory {
  GENERIC = 'generic',
  NETWORK = 'network',
  CRYPTO = 'crypto',
  STORAGE = 'storage',
  IDENTITY = 'identity',
  NOSTR = 'nostr',
  SYNC = 'sync',
  CHANNEL = 'channel',
  SERVICE_WORKER = 'service_worker',
}

// ============================================================================
// Error Context
// ============================================================================

/**
 * Context information captured with an error.
 */
export interface ErrorContext {
  /** Component or service where error occurred */
  component?: string;
  /** Operation being performed */
  operation?: string;
  /** Relevant data (sanitized, no secrets) */
  data?: Record<string, unknown>;
  /** User agent */
  userAgent?: string;
  /** Timestamp */
  timestamp: number;
  /** Session ID for correlation */
  sessionId?: string;
  /** Stack frames (if available) */
  stackFrames?: string[];
}

/**
 * Serialized error format for storage/transmission.
 */
export interface SerializedError {
  name: string;
  message: string;
  code: ErrorCode;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  cause?: SerializedError;
  recoverable: boolean;
  userMessage: string;
}

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all BitChat errors.
 * Provides structured error information with context capture.
 */
export class BitChatError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly recoverable: boolean;
  public readonly userMessage: string;
  public override readonly cause?: Error;

  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      category?: ErrorCategory;
      severity?: ErrorSeverity;
      context?: Partial<ErrorContext>;
      cause?: Error;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message);
    this.name = 'BitChatError';
    this.code = options.code ?? ErrorCode.UNKNOWN;
    this.category = options.category ?? ErrorCategory.GENERIC;
    this.severity = options.severity ?? ErrorSeverity.ERROR;
    this.recoverable = options.recoverable ?? false;
    this.cause = options.cause;
    this.userMessage =
      options.userMessage ?? this.getDefaultUserMessage(this.code);

    // Capture context
    this.context = {
      timestamp: Date.now(),
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      ...options.context,
    };

    // Parse stack trace if available
    if (this.stack) {
      this.context.stackFrames = this.parseStack(this.stack);
    }

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get a default user-friendly message for an error code.
   */
  private getDefaultUserMessage(code: ErrorCode): string {
    const messages: Partial<Record<ErrorCode, string>> = {
      [ErrorCode.UNKNOWN]: 'An unexpected error occurred. Please try again.',
      [ErrorCode.NETWORK_OFFLINE]:
        'You appear to be offline. Check your connection.',
      [ErrorCode.NETWORK_TIMEOUT]:
        'Request timed out. Please try again.',
      [ErrorCode.RELAY_CONNECTION_FAILED]:
        'Could not connect to relay. Retrying...',
      [ErrorCode.RELAY_RATE_LIMITED]:
        'Too many requests. Please slow down.',
      [ErrorCode.CRYPTO_DECRYPTION_FAILED]:
        'Could not decrypt message. The key may have changed.',
      [ErrorCode.STORAGE_QUOTA_EXCEEDED]:
        'Storage is full. Please free up some space.',
      [ErrorCode.STORAGE_NOT_AVAILABLE]:
        'Storage is not available. Some features may not work.',
      [ErrorCode.IDENTITY_NOT_FOUND]:
        'No identity found. Please create or import one.',
      [ErrorCode.GEOLOCATION_DENIED]:
        'Location access denied. Enable it for nearby channels.',
      [ErrorCode.SW_NOT_SUPPORTED]:
        'Offline mode not supported in this browser.',
    };
    return messages[code] ?? 'Something went wrong. Please try again.';
  }

  /**
   * Parse stack trace into frames.
   */
  private parseStack(stack: string): string[] {
    return stack
      .split('\n')
      .slice(1) // Remove the error message line
      .map((line) => line.trim())
      .filter((line) => line.startsWith('at '))
      .slice(0, 10); // Limit frames
  }

  /**
   * Serialize error for storage or transmission.
   */
  public serialize(): SerializedError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      context: this.context,
      cause: this.cause instanceof BitChatError ? this.cause.serialize() : undefined,
      recoverable: this.recoverable,
      userMessage: this.userMessage,
    };
  }

  /**
   * Deserialize an error from storage.
   */
  public static deserialize(data: SerializedError): BitChatError {
    return new BitChatError(data.message, {
      code: data.code,
      category: data.category,
      severity: data.severity,
      context: data.context,
      recoverable: data.recoverable,
      userMessage: data.userMessage,
      cause: data.cause ? BitChatError.deserialize(data.cause) : undefined,
    });
  }

  /**
   * Create from a standard Error.
   */
  public static fromError(
    error: Error,
    options?: Partial<{
      code: ErrorCode;
      category: ErrorCategory;
      severity: ErrorSeverity;
      context: Partial<ErrorContext>;
      recoverable: boolean;
      userMessage: string;
    }>
  ): BitChatError {
    if (error instanceof BitChatError) {
      return error;
    }

    return new BitChatError(error.message, {
      ...options,
      cause: error,
    });
  }

  /**
   * Get a string representation for logging.
   */
  public toLogString(): string {
    const parts = [
      `[${this.severity.toUpperCase()}]`,
      `[${this.category}/${this.code}]`,
      this.message,
    ];

    if (this.context.component) {
      parts.push(`in ${this.context.component}`);
    }
    if (this.context.operation) {
      parts.push(`during ${this.context.operation}`);
    }

    return parts.join(' ');
  }
}

// ============================================================================
// Specialized Error Classes
// ============================================================================

/**
 * Network-related errors.
 */
export class NetworkError extends BitChatError {
  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      cause?: Error;
      context?: Partial<ErrorContext>;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? ErrorCode.NETWORK_OFFLINE,
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.WARNING,
      recoverable: options.recoverable ?? true,
    });
    this.name = 'NetworkError';
  }

  /**
   * Create an offline error.
   */
  public static offline(context?: Partial<ErrorContext>): NetworkError {
    return new NetworkError('Network is offline', {
      code: ErrorCode.NETWORK_OFFLINE,
      context,
      recoverable: true,
      userMessage: 'You appear to be offline. Messages will be sent when you reconnect.',
    });
  }

  /**
   * Create a timeout error.
   */
  public static timeout(
    operation: string,
    context?: Partial<ErrorContext>
  ): NetworkError {
    return new NetworkError(`Operation timed out: ${operation}`, {
      code: ErrorCode.NETWORK_TIMEOUT,
      context: { ...context, operation },
      recoverable: true,
      userMessage: 'The request timed out. Please try again.',
    });
  }

  /**
   * Create a relay connection error.
   */
  public static relayConnectionFailed(
    relayUrl: string,
    cause?: Error
  ): NetworkError {
    return new NetworkError(`Failed to connect to relay: ${relayUrl}`, {
      code: ErrorCode.RELAY_CONNECTION_FAILED,
      cause,
      context: { data: { relayUrl } },
      recoverable: true,
      userMessage: 'Could not connect to message relay. Retrying automatically.',
    });
  }

  /**
   * Create a WebRTC connection error.
   */
  public static webrtcFailed(peerId: string, cause?: Error): NetworkError {
    return new NetworkError(`WebRTC connection failed to peer: ${peerId}`, {
      code: ErrorCode.WEBRTC_CONNECTION_FAILED,
      cause,
      context: { data: { peerId: `${peerId.slice(0, 8)  }...` } },
      recoverable: true,
      userMessage: 'Could not establish peer connection. Using relay instead.',
    });
  }
}

/**
 * Cryptographic operation errors.
 */
export class CryptoError extends BitChatError {
  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      cause?: Error;
      context?: Partial<ErrorContext>;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? ErrorCode.CRYPTO_NOT_READY,
      category: ErrorCategory.CRYPTO,
      severity: ErrorSeverity.ERROR,
      recoverable: options.recoverable ?? false,
    });
    this.name = 'CryptoError';
  }

  /**
   * Create a not initialized error.
   */
  public static notReady(context?: Partial<ErrorContext>): CryptoError {
    return new CryptoError('Crypto service not initialized', {
      code: ErrorCode.CRYPTO_NOT_READY,
      context,
      recoverable: false,
      userMessage: 'Encryption is not ready. Please reload the app.',
    });
  }

  /**
   * Create a decryption failed error.
   */
  public static decryptionFailed(
    cause?: Error,
    context?: Partial<ErrorContext>
  ): CryptoError {
    return new CryptoError('Failed to decrypt data', {
      code: ErrorCode.CRYPTO_DECRYPTION_FAILED,
      cause,
      context,
      recoverable: false,
      userMessage: 'Could not decrypt this message. The key may be incorrect.',
    });
  }

  /**
   * Create an encryption failed error.
   */
  public static encryptionFailed(
    cause?: Error,
    context?: Partial<ErrorContext>
  ): CryptoError {
    return new CryptoError('Failed to encrypt data', {
      code: ErrorCode.CRYPTO_ENCRYPTION_FAILED,
      cause,
      context,
      recoverable: false,
      userMessage: 'Could not encrypt the message. Please try again.',
    });
  }

  /**
   * Create an invalid key error.
   */
  public static invalidKey(
    keyType: string,
    context?: Partial<ErrorContext>
  ): CryptoError {
    return new CryptoError(`Invalid ${keyType} key`, {
      code: ErrorCode.CRYPTO_KEY_INVALID,
      context: { ...context, data: { keyType } },
      recoverable: false,
      userMessage: 'The provided key is invalid. Please check and try again.',
    });
  }

  /**
   * Create a WASM load failed error.
   */
  public static wasmLoadFailed(cause?: Error): CryptoError {
    return new CryptoError('Failed to load cryptographic library', {
      code: ErrorCode.CRYPTO_WASM_LOAD_FAILED,
      cause,
      recoverable: false,
      userMessage:
        'Could not load encryption. Your browser may not support required features.',
    });
  }
}

/**
 * Storage-related errors.
 */
export class StorageError extends BitChatError {
  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      cause?: Error;
      context?: Partial<ErrorContext>;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? ErrorCode.STORAGE_NOT_AVAILABLE,
      category: ErrorCategory.STORAGE,
      severity: ErrorSeverity.ERROR,
      recoverable: options.recoverable ?? false,
    });
    this.name = 'StorageError';
  }

  /**
   * Create a quota exceeded error.
   */
  public static quotaExceeded(context?: Partial<ErrorContext>): StorageError {
    return new StorageError('Storage quota exceeded', {
      code: ErrorCode.STORAGE_QUOTA_EXCEEDED,
      context,
      recoverable: false,
      userMessage:
        'Storage is full. Delete some messages or clear old data to continue.',
    });
  }

  /**
   * Create a read error.
   */
  public static readFailed(
    key: string,
    cause?: Error,
    context?: Partial<ErrorContext>
  ): StorageError {
    return new StorageError(`Failed to read data: ${key}`, {
      code: ErrorCode.STORAGE_READ_FAILED,
      cause,
      context: { ...context, data: { key } },
      recoverable: true,
      userMessage: 'Could not load data. Please try again.',
    });
  }

  /**
   * Create a write error.
   */
  public static writeFailed(
    key: string,
    cause?: Error,
    context?: Partial<ErrorContext>
  ): StorageError {
    return new StorageError(`Failed to write data: ${key}`, {
      code: ErrorCode.STORAGE_WRITE_FAILED,
      cause,
      context: { ...context, data: { key } },
      recoverable: true,
      userMessage: 'Could not save data. Please try again.',
    });
  }

  /**
   * Create a corrupted data error.
   */
  public static corrupted(
    description: string,
    context?: Partial<ErrorContext>
  ): StorageError {
    return new StorageError(`Data corruption detected: ${description}`, {
      code: ErrorCode.STORAGE_CORRUPTED,
      context,
      recoverable: false,
      userMessage:
        'Data appears to be corrupted. You may need to clear app data.',
    });
  }

  /**
   * Create an IndexedDB not supported error.
   */
  public static indexedDBNotSupported(): StorageError {
    return new StorageError('IndexedDB is not supported', {
      code: ErrorCode.INDEXEDDB_NOT_SUPPORTED,
      recoverable: false,
      userMessage:
        'Your browser does not support offline storage. Some features will not work.',
    });
  }

  /**
   * Create an OPFS not supported error.
   */
  public static opfsNotSupported(): StorageError {
    return new StorageError('OPFS is not supported', {
      code: ErrorCode.OPFS_NOT_SUPPORTED,
      recoverable: true, // Fall back to IndexedDB
      userMessage: 'High-performance storage not available. Using fallback.',
    });
  }
}

/**
 * Identity-related errors.
 */
export class IdentityError extends BitChatError {
  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      cause?: Error;
      context?: Partial<ErrorContext>;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? ErrorCode.IDENTITY_NOT_FOUND,
      category: ErrorCategory.IDENTITY,
      severity: ErrorSeverity.ERROR,
      recoverable: options.recoverable ?? false,
    });
    this.name = 'IdentityError';
  }

  /**
   * Create a not found error.
   */
  public static notFound(context?: Partial<ErrorContext>): IdentityError {
    return new IdentityError('No identity found', {
      code: ErrorCode.IDENTITY_NOT_FOUND,
      context,
      recoverable: true,
      userMessage: 'No identity found. Please create or import one.',
    });
  }

  /**
   * Create an import failed error.
   */
  public static importFailed(
    reason: string,
    cause?: Error
  ): IdentityError {
    return new IdentityError(`Failed to import identity: ${reason}`, {
      code: ErrorCode.IDENTITY_IMPORT_FAILED,
      cause,
      recoverable: true,
      userMessage: 'Could not import key. Please check the format and try again.',
    });
  }

  /**
   * Create an invalid key error.
   */
  public static invalidKey(keyType: string): IdentityError {
    return new IdentityError(`Invalid ${keyType} key format`, {
      code: ErrorCode.IDENTITY_INVALID_KEY,
      context: { data: { keyType } },
      recoverable: true,
      userMessage: `The ${keyType} key format is invalid. Please check and try again.`,
    });
  }
}

/**
 * Nostr protocol errors.
 */
export class NostrError extends BitChatError {
  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      cause?: Error;
      context?: Partial<ErrorContext>;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? ErrorCode.NOSTR_INVALID_EVENT,
      category: ErrorCategory.NOSTR,
      severity: ErrorSeverity.ERROR,
      recoverable: options.recoverable ?? true,
    });
    this.name = 'NostrError';
  }

  /**
   * Create an invalid event error.
   */
  public static invalidEvent(
    reason: string,
    context?: Partial<ErrorContext>
  ): NostrError {
    return new NostrError(`Invalid Nostr event: ${reason}`, {
      code: ErrorCode.NOSTR_INVALID_EVENT,
      context,
      recoverable: false,
      userMessage: 'Received an invalid message. It has been ignored.',
    });
  }

  /**
   * Create a publish failed error.
   */
  public static publishFailed(
    cause?: Error,
    context?: Partial<ErrorContext>
  ): NostrError {
    return new NostrError('Failed to publish event', {
      code: ErrorCode.NOSTR_PUBLISH_FAILED,
      cause,
      context,
      recoverable: true,
      userMessage: 'Could not send message. Will retry automatically.',
    });
  }

  /**
   * Create a NIP-17 decrypt failed error.
   */
  public static nip17DecryptFailed(cause?: Error): NostrError {
    return new NostrError('Failed to decrypt NIP-17 message', {
      code: ErrorCode.NOSTR_NIP17_DECRYPT_FAILED,
      cause,
      recoverable: false,
      userMessage: 'Could not decrypt this direct message.',
    });
  }
}

/**
 * Sync-related errors.
 */
export class SyncError extends BitChatError {
  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      cause?: Error;
      context?: Partial<ErrorContext>;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? ErrorCode.SYNC_FAILED,
      category: ErrorCategory.SYNC,
      severity: ErrorSeverity.WARNING,
      recoverable: options.recoverable ?? true,
    });
    this.name = 'SyncError';
  }

  /**
   * Create a conflict error.
   */
  public static conflict(context?: Partial<ErrorContext>): SyncError {
    return new SyncError('Sync conflict detected', {
      code: ErrorCode.SYNC_CONFLICT,
      context,
      recoverable: true,
      userMessage: 'Sync conflict detected. Using most recent version.',
    });
  }

  /**
   * Create a timeout error.
   */
  public static timeout(context?: Partial<ErrorContext>): SyncError {
    return new SyncError('Sync timed out', {
      code: ErrorCode.SYNC_TIMEOUT,
      context,
      recoverable: true,
      userMessage: 'Sync is taking longer than expected. Retrying...',
    });
  }
}

/**
 * Channel-related errors.
 */
export class ChannelError extends BitChatError {
  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      cause?: Error;
      context?: Partial<ErrorContext>;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? ErrorCode.CHANNEL_NOT_FOUND,
      category: ErrorCategory.CHANNEL,
      severity: ErrorSeverity.ERROR,
      recoverable: options.recoverable ?? true,
    });
    this.name = 'ChannelError';
  }

  /**
   * Create a geolocation denied error.
   */
  public static geolocationDenied(): ChannelError {
    return new ChannelError('Geolocation permission denied', {
      code: ErrorCode.GEOLOCATION_DENIED,
      recoverable: false,
      userMessage:
        'Location access is required for nearby channels. Please enable it in settings.',
    });
  }

  /**
   * Create a geolocation unavailable error.
   */
  public static geolocationUnavailable(cause?: Error): ChannelError {
    return new ChannelError('Geolocation unavailable', {
      code: ErrorCode.GEOLOCATION_UNAVAILABLE,
      cause,
      recoverable: true,
      userMessage: 'Could not determine your location. Please try again.',
    });
  }
}

/**
 * Service Worker errors.
 */
export class ServiceWorkerError extends BitChatError {
  constructor(
    message: string,
    options: {
      code?: ErrorCode;
      cause?: Error;
      context?: Partial<ErrorContext>;
      recoverable?: boolean;
      userMessage?: string;
    } = {}
  ) {
    super(message, {
      ...options,
      code: options.code ?? ErrorCode.SW_NOT_SUPPORTED,
      category: ErrorCategory.SERVICE_WORKER,
      severity: ErrorSeverity.WARNING,
      recoverable: options.recoverable ?? true,
    });
    this.name = 'ServiceWorkerError';
  }

  /**
   * Create a not supported error.
   */
  public static notSupported(): ServiceWorkerError {
    return new ServiceWorkerError('Service Workers not supported', {
      code: ErrorCode.SW_NOT_SUPPORTED,
      recoverable: false,
      userMessage:
        'Offline mode is not available in this browser. The app will work but requires an internet connection.',
    });
  }

  /**
   * Create a registration failed error.
   */
  public static registrationFailed(cause?: Error): ServiceWorkerError {
    return new ServiceWorkerError('Service Worker registration failed', {
      code: ErrorCode.SW_REGISTRATION_FAILED,
      cause,
      recoverable: true,
      userMessage: 'Could not enable offline mode. Try reloading the page.',
    });
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a BitChatError.
 */
export function isBitChatError(error: unknown): error is BitChatError {
  return error instanceof BitChatError;
}

/**
 * Check if an error is a NetworkError.
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Check if an error is a CryptoError.
 */
export function isCryptoError(error: unknown): error is CryptoError {
  return error instanceof CryptoError;
}

/**
 * Check if an error is a StorageError.
 */
export function isStorageError(error: unknown): error is StorageError {
  return error instanceof StorageError;
}

/**
 * Check if an error is recoverable.
 */
export function isRecoverableError(error: unknown): boolean {
  if (error instanceof BitChatError) {
    return error.recoverable;
  }
  return false;
}

/**
 * Get error code from any error.
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof BitChatError) {
    return error.code;
  }
  return ErrorCode.UNKNOWN;
}

/**
 * Get user message from any error.
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof BitChatError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Options for error construction
 */
interface ErrorConstructorOptions {
  code?: ErrorCode;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  context?: Partial<ErrorContext>;
  cause?: Error;
  recoverable?: boolean;
  userMessage?: string;
}

/**
 * Wrap an async function with error transformation.
 */
export async function wrapAsync<T>(
  fn: () => Promise<T>,
  options: {
    component?: string;
    operation?: string;
    errorClass?: new (message: string, opts?: ErrorConstructorOptions) => BitChatError;
  } = {}
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof BitChatError) {
      // Add context if not already set
      if (options.component && !error.context.component) {
        error.context.component = options.component;
      }
      if (options.operation && !error.context.operation) {
        error.context.operation = options.operation;
      }
      throw error;
    }

    const ErrorClass = options.errorClass ?? BitChatError;
    throw new ErrorClass(
      error instanceof Error ? error.message : 'Unknown error',
      {
        cause: error instanceof Error ? error : undefined,
        context: {
          component: options.component,
          operation: options.operation,
        },
      }
    );
  }
}

/**
 * Create an error from a DOMException.
 */
export function fromDOMException(
  exception: DOMException,
  context?: Partial<ErrorContext>
): BitChatError {
  // Handle specific DOMException types
  switch (exception.name) {
    case 'QuotaExceededError':
      return StorageError.quotaExceeded(context);
    case 'NotFoundError':
      return new StorageError('Resource not found', {
        code: ErrorCode.STORAGE_READ_FAILED,
        cause: exception,
        context,
      });
    case 'SecurityError':
      return new StorageError('Security error accessing storage', {
        code: ErrorCode.OPFS_ACCESS_DENIED,
        cause: exception,
        context,
      });
    case 'AbortError':
      return new BitChatError('Operation was aborted', {
        code: ErrorCode.OPERATION_CANCELLED,
        cause: exception,
        context,
      });
    case 'TimeoutError':
      return new BitChatError('Operation timed out', {
        code: ErrorCode.TIMEOUT,
        cause: exception,
        context,
      });
    default:
      return new BitChatError(exception.message, {
        cause: exception,
        context,
      });
  }
}

// ============================================================================
// Re-exports from Handler and Recovery Modules
// ============================================================================

// Export everything from handler module
export {
  GlobalErrorHandler,
  getErrorHandler,
  initErrorHandling,
  handleError,
  createSafeAsync,
  createSafe,
  type ErrorHandler,
  type ErrorLogEntry,
  type ErrorHandlerConfig,
  type ErrorStats,
} from './handler';

// Export everything from recovery module
export {
  retry,
  withRetry,
  CircuitBreaker,
  CircuitOpenError,
  withCircuitBreaker,
  withFallback,
  createWithFallback,
  getRecoveryStrategy,
  applyRecovery,
  isTransientError,
  shouldBackoff,
  getBackoffTime,
  createErrorDebouncer,
  createErrorThrottler,
  DEFAULT_RETRY_CONFIG,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  TRANSIENT_ERROR_CODES,
  TRANSIENT_CATEGORIES,
  type RetryConfig,
  type RetryResult,
  type CircuitState,
  type CircuitBreakerConfig,
  type CircuitStats,
  type FallbackConfig,
  type RecoveryStrategy,
} from './recovery';
