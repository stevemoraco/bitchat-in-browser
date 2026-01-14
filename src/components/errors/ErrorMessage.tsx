/**
 * Error Message Components - BitChat In Browser
 *
 * Components for displaying error messages including:
 * - Inline error messages
 * - Toast notifications
 * - Dismissible error banners
 *
 * @module components/errors/ErrorMessage
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import {
  ErrorSeverity,
  getUserMessage,
  isBitChatError,
  isRecoverableError,
} from '../../services/errors';

// ============================================================================
// Types
// ============================================================================

export interface ErrorMessageProps {
  /** The error to display */
  error: Error | string | null;
  /** Whether the error is dismissible */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Custom class name */
  className?: string;
  /** Display variant */
  variant?: 'inline' | 'banner' | 'compact';
  /** Show icon */
  showIcon?: boolean;
}

export interface ToastProps {
  /** Unique toast ID */
  id: string;
  /** Message content */
  message: string;
  /** Toast type */
  type: 'error' | 'warning' | 'info' | 'success';
  /** Duration in ms (0 for persistent) */
  duration?: number;
  /** Callback when toast is dismissed */
  onDismiss?: (id: string) => void;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastContainerProps {
  /** Position on screen */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  /** Maximum toasts to show */
  maxToasts?: number;
}

// ============================================================================
// Error Message Component
// ============================================================================

/**
 * Inline error message component
 *
 * @example
 * ```tsx
 * <ErrorMessage
 *   error={error}
 *   dismissible
 *   onDismiss={() => setError(null)}
 *   onRetry={() => retryOperation()}
 * />
 * ```
 */
export const ErrorMessage: FunctionComponent<ErrorMessageProps> = ({
  error,
  dismissible = false,
  onDismiss,
  onRetry,
  className = '',
  variant = 'inline',
  showIcon = true,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Reset visibility when error changes
  useEffect(() => {
    if (error) {
      setIsVisible(true);
    }
  }, [error]);

  if (!error || !isVisible) {
    return null;
  }

  const message = typeof error === 'string' ? error : getUserMessage(error);
  const bitChatError = typeof error !== 'string' && isBitChatError(error) ? error : null;
  const severity = bitChatError?.severity ?? ErrorSeverity.ERROR;
  const canRetry = onRetry && (typeof error === 'string' || isRecoverableError(error));

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  // Get variant-specific styles
  const variantStyles = {
    inline: 'p-3 rounded border',
    banner: 'px-4 py-3 border-y',
    compact: 'px-2 py-1 rounded text-sm',
  }[variant];

  // Get severity-specific styles
  const severityStyles = {
    [ErrorSeverity.INFO]: {
      container: 'bg-terminal-blue/10 border-terminal-blue/30',
      text: 'text-terminal-blue',
      icon: '[i]',
    },
    [ErrorSeverity.WARNING]: {
      container: 'bg-terminal-yellow/10 border-terminal-yellow/30',
      text: 'text-terminal-yellow',
      icon: '[!]',
    },
    [ErrorSeverity.ERROR]: {
      container: 'bg-terminal-red/10 border-terminal-red/30',
      text: 'text-terminal-red',
      icon: '[X]',
    },
    [ErrorSeverity.CRITICAL]: {
      container: 'bg-terminal-red/20 border-terminal-red/50',
      text: 'text-terminal-red',
      icon: '[!!]',
    },
  }[severity];

  return (
    <div
      class={`${variantStyles} ${severityStyles.container} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div class="flex items-start gap-2">
        {/* Icon */}
        {showIcon && (
          <span class={`${severityStyles.text} font-bold flex-shrink-0`}>
            {severityStyles.icon}
          </span>
        )}

        {/* Message */}
        <div class="flex-1 min-w-0">
          <p class={`${severityStyles.text} ${variant === 'compact' ? '' : 'leading-relaxed'}`}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-2 flex-shrink-0">
          {canRetry && (
            <button
              onClick={onRetry}
              class="text-terminal-green hover:underline text-sm font-medium"
            >
              [Retry]
            </button>
          )}
          {dismissible && (
            <button
              onClick={handleDismiss}
              class="text-terminal-green/50 hover:text-terminal-green text-sm"
              aria-label="Dismiss"
            >
              [X]
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Toast Component
// ============================================================================

/**
 * Individual toast notification
 */
export const Toast: FunctionComponent<ToastProps> = ({
  id,
  message,
  type,
  duration = 5000,
  onDismiss,
  action,
}) => {
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get type-specific styles
  const typeStyles = {
    error: {
      container: 'bg-terminal-bg border-terminal-red/50',
      icon: '[X]',
      iconColor: 'text-terminal-red',
    },
    warning: {
      container: 'bg-terminal-bg border-terminal-yellow/50',
      icon: '[!]',
      iconColor: 'text-terminal-yellow',
    },
    info: {
      container: 'bg-terminal-bg border-terminal-blue/50',
      icon: '[i]',
      iconColor: 'text-terminal-blue',
    },
    success: {
      container: 'bg-terminal-bg border-terminal-green/50',
      icon: '[+]',
      iconColor: 'text-terminal-green',
    },
  }[type];

  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss?.(id);
    }, 200); // Match animation duration
  }, [id, onDismiss]);

  // Auto-dismiss timer
  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(handleDismiss, duration);
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
    return undefined;
  }, [duration, handleDismiss]);

  // Pause timer on hover
  const handleMouseEnter = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (duration > 0 && !timerRef.current) {
      timerRef.current = setTimeout(handleDismiss, duration);
    }
  }, [duration, handleDismiss]);

  return (
    <div
      class={`
        ${typeStyles.container}
        border rounded shadow-lg
        p-3 min-w-[280px] max-w-[400px]
        transform transition-all duration-200
        ${isExiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div class="flex items-start gap-2">
        {/* Icon */}
        <span class={`${typeStyles.iconColor} font-bold flex-shrink-0`}>
          {typeStyles.icon}
        </span>

        {/* Message */}
        <div class="flex-1 min-w-0">
          <p class="text-terminal-green text-sm leading-relaxed">{message}</p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          class="text-terminal-green/50 hover:text-terminal-green text-sm flex-shrink-0"
          aria-label="Dismiss"
        >
          [x]
        </button>
      </div>

      {/* Action button */}
      {action && (
        <div class="mt-2 flex justify-end">
          <button
            onClick={() => {
              action.onClick();
              handleDismiss();
            }}
            class="text-terminal-green hover:underline text-sm font-medium"
          >
            [{action.label}]
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Toast Container Component
// ============================================================================

/**
 * Container for managing and displaying multiple toasts
 */
export const ToastContainer: FunctionComponent<
  ToastContainerProps & { toasts: ToastProps[] }
> = ({ toasts, position = 'bottom-right', maxToasts = 5 }) => {
  // Position styles
  const positionStyles = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }[position];

  // Stack direction
  const stackDirection = position.startsWith('top') ? 'flex-col' : 'flex-col-reverse';

  // Limit displayed toasts
  const displayedToasts = toasts.slice(0, maxToasts);

  if (displayedToasts.length === 0) {
    return null;
  }

  return (
    <div
      class={`fixed ${positionStyles} z-50 flex ${stackDirection} gap-2`}
      aria-label="Notifications"
    >
      {displayedToasts.map((toast) => (
        <Toast key={toast.id} {...toast} />
      ))}
    </div>
  );
};

// ============================================================================
// Error Banner Component
// ============================================================================

interface ErrorBannerProps {
  /** The error to display */
  error: Error | string | null;
  /** Whether to show at top or bottom */
  position?: 'top' | 'bottom';
  /** Whether dismissible */
  dismissible?: boolean;
  /** Dismiss callback */
  onDismiss?: () => void;
  /** Retry callback */
  onRetry?: () => void;
}

/**
 * Full-width error banner for important errors
 */
export const ErrorBanner: FunctionComponent<ErrorBannerProps> = ({
  error,
  position = 'top',
  dismissible = true,
  onDismiss,
  onRetry,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (error) {
      setIsVisible(true);
    }
  }, [error]);

  if (!error || !isVisible) {
    return null;
  }

  const message = typeof error === 'string' ? error : getUserMessage(error);
  const canRetry = onRetry && (typeof error === 'string' || isRecoverableError(error));

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const positionStyles = position === 'top' ? 'top-0' : 'bottom-0';

  return (
    <div
      class={`
        fixed left-0 right-0 ${positionStyles} z-40
        bg-terminal-red/10 border-y border-terminal-red/30
        px-4 py-2
      `}
      role="alert"
    >
      <div class="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-terminal-red font-bold">[!]</span>
          <span class="text-terminal-red text-sm truncate">{message}</span>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          {canRetry && (
            <button
              onClick={onRetry}
              class="text-terminal-green hover:underline text-sm"
            >
              [Retry]
            </button>
          )}
          {dismissible && (
            <button
              onClick={handleDismiss}
              class="text-terminal-green/50 hover:text-terminal-green text-sm"
              aria-label="Dismiss"
            >
              [X]
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Connection Status Banner
// ============================================================================

interface ConnectionStatusProps {
  /** Whether online */
  isOnline: boolean;
  /** Whether reconnecting */
  isReconnecting?: boolean;
  /** Retry callback */
  onRetry?: () => void;
}

/**
 * Banner showing network connection status
 */
export const ConnectionStatusBanner: FunctionComponent<ConnectionStatusProps> = ({
  isOnline,
  isReconnecting = false,
  onRetry,
}) => {
  if (isOnline && !isReconnecting) {
    return null;
  }

  return (
    <div
      class={`
        fixed top-0 left-0 right-0 z-50
        ${isOnline ? 'bg-terminal-yellow/10 border-terminal-yellow/30' : 'bg-terminal-red/10 border-terminal-red/30'}
        border-b px-4 py-2
      `}
      role="status"
      aria-live="polite"
    >
      <div class="max-w-screen-xl mx-auto flex items-center justify-center gap-3">
        {isReconnecting ? (
          <>
            <span class="text-terminal-yellow animate-pulse">[...]</span>
            <span class="text-terminal-yellow text-sm">Reconnecting...</span>
          </>
        ) : (
          <>
            <span class="text-terminal-red">[!]</span>
            <span class="text-terminal-red text-sm">You are offline</span>
            {onRetry && (
              <button
                onClick={onRetry}
                class="text-terminal-green hover:underline text-sm ml-2"
              >
                [Retry]
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Loading Error Component
// ============================================================================

interface LoadingErrorProps {
  /** What was being loaded */
  what?: string;
  /** The error */
  error?: Error | string | null;
  /** Retry callback */
  onRetry?: () => void;
}

/**
 * Error display for failed loading operations
 */
export const LoadingError: FunctionComponent<LoadingErrorProps> = ({
  what = 'content',
  error,
  onRetry,
}) => {
  const message = error
    ? typeof error === 'string'
      ? error
      : getUserMessage(error)
    : `Failed to load ${what}`;

  return (
    <div class="flex flex-col items-center justify-center py-8 px-4 text-center">
      <div class="text-terminal-red text-2xl font-bold mb-2">[X]</div>
      <p class="text-terminal-red mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} class="btn-terminal">
          [TRY AGAIN]
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Field Error Component
// ============================================================================

interface FieldErrorProps {
  /** Error message */
  error?: string | null;
  /** Field ID for aria-describedby */
  fieldId?: string;
}

/**
 * Inline error for form fields
 */
export const FieldError: FunctionComponent<FieldErrorProps> = ({
  error,
  fieldId,
}) => {
  if (!error) {
    return null;
  }

  return (
    <p
      class="text-terminal-red text-sm mt-1"
      id={fieldId ? `${fieldId}-error` : undefined}
      role="alert"
    >
      {error}
    </p>
  );
};

// ============================================================================
// Export
// ============================================================================

export default ErrorMessage;
