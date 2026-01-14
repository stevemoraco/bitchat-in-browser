/**
 * Error Boundary Component - BitChat In Browser
 *
 * React error boundary with terminal-style UI for catching and displaying
 * errors in component trees. Provides recovery options and error reporting.
 *
 * @module components/errors/ErrorBoundary
 */

import { Component, type ComponentChildren, type FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import {
  ErrorSeverity,
  getUserMessage,
  isBitChatError,
  isRecoverableError,
} from '../../services/errors';
import { handleError } from '../../services/errors/handler';

// ============================================================================
// Types
// ============================================================================

interface ErrorBoundaryProps {
  /** Child components to wrap */
  children: ComponentChildren;
  /** Custom fallback UI */
  fallback?: ComponentChildren | ((error: Error, reset: () => void) => ComponentChildren);
  /** Error handler callback */
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
  /** Whether to show error details */
  showDetails?: boolean;
  /** Custom component name for context */
  componentName?: string;
  /** Whether to allow retry */
  allowRetry?: boolean;
  /** Whether to allow reporting */
  allowReport?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: { componentStack: string } | null;
}

// ============================================================================
// Error Boundary Class Component
// ============================================================================

/**
 * ErrorBoundary catches JavaScript errors in child component trees,
 * logs them, and displays a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   componentName="ChatView"
 *   onError={(error) => console.error(error)}
 * >
 *   <ChatMessages />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static override defaultProps = {
    showDetails: false,
    allowRetry: true,
    allowReport: true,
  };

  static override getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    this.setState({ errorInfo });

    // Handle through global error handler
    handleError(error, {
      context: {
        component: this.props.componentName ?? 'Unknown',
        operation: 'render',
        data: { componentStack: errorInfo.componentStack },
      },
    });

    // Call custom error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  override render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails, allowRetry, allowReport } = this.props;

    if (!hasError || !error) {
      return children;
    }

    // Custom fallback
    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback(error, this.handleReset);
      }
      return fallback;
    }

    // Default error UI
    return (
      <ErrorDisplay
        error={error}
        errorInfo={errorInfo}
        showDetails={showDetails}
        allowRetry={allowRetry}
        allowReport={allowReport}
        onRetry={this.handleReset}
        onReload={this.handleReload}
      />
    );
  }
}

// ============================================================================
// Error Display Component
// ============================================================================

interface ErrorDisplayProps {
  error: Error;
  errorInfo?: { componentStack: string } | null;
  showDetails?: boolean;
  allowRetry?: boolean;
  allowReport?: boolean;
  onRetry?: () => void;
  onReload?: () => void;
  compact?: boolean;
}

export const ErrorDisplay: FunctionComponent<ErrorDisplayProps> = ({
  error,
  errorInfo,
  showDetails = false,
  allowRetry = true,
  allowReport = true,
  onRetry,
  onReload,
  compact = false,
}) => {
  const [showStack, setShowStack] = useState(false);
  const [copied, setCopied] = useState(false);

  const bitChatError = isBitChatError(error) ? error : null;
  const userMessage = getUserMessage(error);
  const isRecoverable = isRecoverableError(error);
  const severity = bitChatError?.severity ?? ErrorSeverity.ERROR;

  // Get severity color
  const severityColor = {
    [ErrorSeverity.INFO]: 'text-terminal-blue',
    [ErrorSeverity.WARNING]: 'text-terminal-yellow',
    [ErrorSeverity.ERROR]: 'text-terminal-red',
    [ErrorSeverity.CRITICAL]: 'text-terminal-red',
  }[severity];

  // Handle copy to clipboard
  const handleCopyReport = useCallback(async () => {
    const report = generateErrorReport(error, errorInfo);
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = report;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [error, errorInfo]);

  if (compact) {
    return (
      <div class="p-3 border border-terminal-red/30 rounded bg-terminal-red/5">
        <div class="flex items-center gap-2">
          <span class={`${severityColor} font-bold`}>[!]</span>
          <span class="text-sm">{userMessage}</span>
          {allowRetry && isRecoverable && onRetry && (
            <button
              onClick={onRetry}
              class="ml-auto text-terminal-xs text-terminal-green hover:underline"
            >
              [RETRY]
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="p-4 space-y-4">
      {/* Error header */}
      <div class="flex items-start gap-3">
        <div class={`${severityColor} text-2xl font-bold`}>[!]</div>
        <div class="flex-1">
          <h3 class={`${severityColor} font-bold text-lg`}>
            {severity === ErrorSeverity.CRITICAL ? 'Critical Error' : 'Error'}
          </h3>
          <p class="text-terminal-green/80 mt-1">{userMessage}</p>
        </div>
      </div>

      {/* Error details (collapsible) */}
      {showDetails && (
        <div class="border border-terminal-green/20 rounded">
          <button
            onClick={() => setShowStack(!showStack)}
            class="w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-terminal-green/5"
          >
            <span class="text-terminal-green/70">Technical Details</span>
            <span class="text-terminal-green/50">{showStack ? '[-]' : '[+]'}</span>
          </button>

          {showStack && (
            <div class="px-3 pb-3 space-y-3">
              {/* Error name and code */}
              <div class="text-terminal-xs space-y-1">
                <div class="flex gap-2">
                  <span class="text-terminal-green/50">Name:</span>
                  <span class="text-terminal-green/80">{error.name}</span>
                </div>
                {bitChatError && (
                  <>
                    <div class="flex gap-2">
                      <span class="text-terminal-green/50">Code:</span>
                      <span class="text-terminal-green/80">{bitChatError.code}</span>
                    </div>
                    <div class="flex gap-2">
                      <span class="text-terminal-green/50">Category:</span>
                      <span class="text-terminal-green/80">{bitChatError.category}</span>
                    </div>
                    <div class="flex gap-2">
                      <span class="text-terminal-green/50">Recoverable:</span>
                      <span class="text-terminal-green/80">
                        {bitChatError.recoverable ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Stack trace */}
              {error.stack && (
                <div>
                  <div class="text-terminal-xs text-terminal-green/50 mb-1">Stack Trace:</div>
                  <pre class="text-terminal-xs text-terminal-green/60 overflow-x-auto whitespace-pre-wrap break-all bg-terminal-bg/50 p-2 rounded">
                    {error.stack}
                  </pre>
                </div>
              )}

              {/* Component stack */}
              {errorInfo?.componentStack && (
                <div>
                  <div class="text-terminal-xs text-terminal-green/50 mb-1">Component Stack:</div>
                  <pre class="text-terminal-xs text-terminal-green/60 overflow-x-auto whitespace-pre-wrap break-all bg-terminal-bg/50 p-2 rounded">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recovery suggestions */}
      {isRecoverable && (
        <div class="text-sm text-terminal-green/70 border border-terminal-green/20 rounded p-3">
          <div class="font-bold mb-1">Suggestions:</div>
          <ul class="list-disc list-inside space-y-1 text-terminal-xs">
            {getRecoverySuggestions(error).map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div class="flex flex-wrap gap-2">
        {allowRetry && isRecoverable && onRetry && (
          <button onClick={onRetry} class="btn-terminal">
            [TRY AGAIN]
          </button>
        )}
        {onReload && (
          <button
            onClick={onReload}
            class="px-4 py-2 border border-terminal-green/50 text-terminal-green/70 hover:text-terminal-green hover:border-terminal-green transition-colors"
          >
            [RELOAD APP]
          </button>
        )}
        {allowReport && (
          <button
            onClick={handleCopyReport}
            class="px-4 py-2 border border-terminal-green/30 text-terminal-green/50 hover:text-terminal-green hover:border-terminal-green/50 transition-colors"
          >
            {copied ? '[COPIED!]' : '[COPY ERROR REPORT]'}
          </button>
        )}
      </div>

      {/* Help text */}
      <p class="text-terminal-xs text-terminal-green/40">
        If this error persists, try clearing your browser data or using a different browser.
      </p>
    </div>
  );
};

// ============================================================================
// Full-Page Error Display
// ============================================================================

interface FullPageErrorProps {
  error: Error;
  errorInfo?: { componentStack: string } | null;
  onRetry?: () => void;
}

export const FullPageError: FunctionComponent<FullPageErrorProps> = ({
  error,
  errorInfo,
  onRetry,
}) => {
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  return (
    <div class="min-h-screen min-h-[100dvh] bg-terminal-bg text-terminal-green font-mono flex flex-col items-center justify-center p-4">
      <div class="max-w-lg w-full">
        {/* Terminal-style header */}
        <div class="text-center mb-6">
          <div class="text-4xl text-terminal-red font-bold mb-2">[!]</div>
          <h1 class="text-xl font-bold">Something went wrong</h1>
        </div>

        <ErrorDisplay
          error={error}
          errorInfo={errorInfo}
          showDetails
          allowRetry
          allowReport
          onRetry={onRetry}
          onReload={handleReload}
        />
      </div>
    </div>
  );
};

// ============================================================================
// Inline Error Wrapper
// ============================================================================

interface InlineErrorBoundaryProps {
  children: ComponentChildren;
  fallback?: ComponentChildren;
  componentName?: string;
}

/**
 * Lightweight error boundary for inline content
 */
export class InlineErrorBoundary extends Component<
  InlineErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  override state = { hasError: false, error: null };

  static override getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error) {
    handleError(error, {
      context: { component: this.props.componentName },
      silent: true,
    });
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <span class="text-terminal-red text-sm">
          [Error loading content]
        </span>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate an error report for copying
 */
function generateErrorReport(
  error: Error,
  errorInfo?: { componentStack: string } | null
): string {
  const timestamp = new Date().toISOString();
  const bitChatError = isBitChatError(error) ? error : null;

  const sections = [
    '=== BitChat Error Report ===',
    `Timestamp: ${timestamp}`,
    `User Agent: ${navigator.userAgent}`,
    '',
    '--- Error Details ---',
    `Name: ${error.name}`,
    `Message: ${error.message}`,
  ];

  if (bitChatError) {
    sections.push(
      `Code: ${bitChatError.code}`,
      `Category: ${bitChatError.category}`,
      `Severity: ${bitChatError.severity}`,
      `Recoverable: ${bitChatError.recoverable}`,
      `User Message: ${bitChatError.userMessage}`
    );

    if (bitChatError.context.component) {
      sections.push(`Component: ${bitChatError.context.component}`);
    }
    if (bitChatError.context.operation) {
      sections.push(`Operation: ${bitChatError.context.operation}`);
    }
  }

  if (error.stack) {
    sections.push('', '--- Stack Trace ---', error.stack);
  }

  if (errorInfo?.componentStack) {
    sections.push('', '--- Component Stack ---', errorInfo.componentStack);
  }

  sections.push('', '=== End of Report ===');

  return sections.join('\n');
}

/**
 * Get recovery suggestions based on error type
 */
function getRecoverySuggestions(error: unknown): string[] {
  const suggestions: string[] = [];

  if (isBitChatError(error)) {
    const code = error.code;

    // Network-related suggestions
    if (code >= 2000 && code < 3000) {
      suggestions.push('Check your internet connection');
      suggestions.push('The relay server may be temporarily unavailable');
      suggestions.push('Try again in a few moments');
    }

    // Crypto-related suggestions
    if (code >= 3000 && code < 4000) {
      suggestions.push('Try reloading the app');
      suggestions.push('Make sure your browser supports Web Crypto API');
    }

    // Storage-related suggestions
    if (code >= 4000 && code < 5000) {
      suggestions.push('Check available storage space');
      suggestions.push('Try clearing old messages');
      suggestions.push('Enable storage access in browser settings');
    }

    // Identity-related suggestions
    if (code >= 5000 && code < 6000) {
      suggestions.push('Check your key format');
      suggestions.push('Try importing your key again');
    }
  }

  // Default suggestions
  if (suggestions.length === 0) {
    suggestions.push('Try reloading the page');
    suggestions.push('Clear browser cache and try again');
    suggestions.push('Check browser console for more details');
  }

  return suggestions;
}

// ============================================================================
// Export
// ============================================================================

export default ErrorBoundary;
