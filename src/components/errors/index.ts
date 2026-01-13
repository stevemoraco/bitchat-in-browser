/**
 * Error Components - BitChat In Browser
 *
 * Central export for all error-related UI components.
 *
 * @module components/errors
 */

// Error Boundary
export {
  ErrorBoundary,
  ErrorDisplay,
  FullPageError,
  InlineErrorBoundary,
} from './ErrorBoundary';

// Error Messages
export {
  ErrorMessage,
  Toast,
  ToastContainer,
  ErrorBanner,
  ConnectionStatusBanner,
  LoadingError,
  FieldError,
  type ErrorMessageProps,
  type ToastProps,
  type ToastContainerProps,
} from './ErrorMessage';
