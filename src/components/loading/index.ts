/**
 * Loading Components - BitChat In Browser
 *
 * Terminal-style loading components for various loading states:
 * - Spinners: Rotating ASCII character animations
 * - Skeletons: Placeholder content loaders
 * - Progress: Progress bars and indicators
 * - Overlays: Full-screen loading states
 *
 * @module components/loading
 */

// ============================================================================
// Spinner Components
// ============================================================================

export {
  Spinner,
  TextSpinner,
  DotsSpinner,
  BlockSpinner,
  PulseSpinner,
  TerminalSpinner,
  type SpinnerSize,
  type SpinnerVariant,
  type SpinnerProps,
} from './Spinner';

// ============================================================================
// Skeleton Components
// ============================================================================

export {
  // Base components
  SkeletonLine,
  SkeletonCircle,
  SkeletonText,
  // Composite components
  SkeletonMessage,
  SkeletonChannel,
  SkeletonPeer,
  SkeletonSettings,
  // List components
  SkeletonMessageList,
  SkeletonChannelList,
  SkeletonPeerList,
  // Terminal-style
  SkeletonTerminal,
  SkeletonCode,
  // Types
  type SkeletonBaseProps,
  type SkeletonLineProps,
  type SkeletonMessageProps,
} from './Skeleton';

// ============================================================================
// Progress Components
// ============================================================================

export {
  ProgressBar,
  InlineProgress,
  TerminalProgress,
  StepProgress,
  CircularProgress,
  TransferProgress,
  type ProgressVariant,
  type ProgressSize,
  type ProgressBaseProps,
  type ProgressBarProps,
} from './Progress';

// ============================================================================
// Overlay Components
// ============================================================================

export {
  LoadingOverlay,
  AppInitOverlay,
  SyncOverlay,
  CryptoOverlay,
  TransitionOverlay,
  type LoadingOverlayProps,
  type OverlayVariant,
} from './LoadingOverlay';

// ============================================================================
// Default Export
// ============================================================================

export { Spinner as default } from './Spinner';
