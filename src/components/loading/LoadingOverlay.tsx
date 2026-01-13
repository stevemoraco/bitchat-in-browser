/**
 * LoadingOverlay Component - Full-screen loading overlay
 *
 * Features:
 * - Full-screen overlay for initial app load
 * - Major transition overlays
 * - Terminal-style animations
 * - Optional progress indication
 * - Accessible loading states
 *
 * @module components/loading/LoadingOverlay
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Spinner, DotsSpinner } from './Spinner';
import { ProgressBar, StepProgress } from './Progress';

// ============================================================================
// Types
// ============================================================================

export type OverlayVariant = 'default' | 'minimal' | 'terminal' | 'steps';

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Main message to display */
  message?: string;
  /** Secondary/submessage */
  submessage?: string;
  /** Overlay variant */
  variant?: OverlayVariant;
  /** Progress value (0-100) for determinate progress */
  progress?: number;
  /** Whether progress is indeterminate */
  indeterminate?: boolean;
  /** Steps for step-based loading */
  steps?: Array<{ label: string; status: 'pending' | 'active' | 'completed' | 'error' }>;
  /** Whether to show the logo/branding */
  showLogo?: boolean;
  /** Whether the overlay can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
  /** Additional CSS classes */
  class?: string;
  /** Z-index of the overlay */
  zIndex?: number;
  /** Whether to blur the background */
  blur?: boolean;
  /** Transition duration in ms */
  transitionDuration?: number;
}

// ============================================================================
// Loading Overlay Component
// ============================================================================

export const LoadingOverlay: FunctionComponent<LoadingOverlayProps> = ({
  visible,
  message = 'Loading...',
  submessage,
  variant = 'default',
  progress,
  indeterminate = true,
  steps,
  showLogo = true,
  dismissible = false,
  onDismiss,
  class: className = '',
  zIndex = 50,
  blur = true,
  transitionDuration = 300,
}) => {
  const [isRendered, setIsRendered] = useState(visible);
  const [isVisible, setIsVisible] = useState(false);

  // Handle visibility transitions
  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      // Delay to allow CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
      return undefined;
    } else {
      setIsVisible(false);
      // Wait for fade out before removing from DOM
      const timeout = setTimeout(() => {
        setIsRendered(false);
      }, transitionDuration);
      return () => clearTimeout(timeout);
    }
  }, [visible, transitionDuration]);

  if (!isRendered) return null;

  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return <MinimalOverlayContent message={message} />;
      case 'terminal':
        return <TerminalOverlayContent message={message} submessage={submessage} />;
      case 'steps':
        return (
          <StepsOverlayContent
            message={message}
            submessage={submessage}
            steps={steps || []}
          />
        );
      default:
        return (
          <DefaultOverlayContent
            message={message}
            submessage={submessage}
            progress={progress}
            indeterminate={indeterminate}
            showLogo={showLogo}
          />
        );
    }
  };

  return (
    <div
      class={`
        fixed inset-0 flex items-center justify-center
        bg-terminal-bg/95 ${blur ? 'backdrop-blur-sm' : ''}
        transition-opacity duration-300 ease-in-out
        ${isVisible ? 'opacity-100' : 'opacity-0'}
        ${className}
      `}
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={message}
    >
      {/* Content container */}
      <div
        class={`
          transform transition-all duration-300 ease-out
          ${isVisible ? 'translate-y-0 scale-100' : 'translate-y-4 scale-95'}
        `}
      >
        {renderContent()}
      </div>

      {/* Dismiss button */}
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          class="absolute bottom-8 text-terminal-green/50 hover:text-terminal-green text-sm font-mono transition-colors"
          aria-label="Dismiss"
        >
          [Press ESC or tap to dismiss]
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Overlay Content Variants
// ============================================================================

/**
 * Default overlay content with logo and progress
 */
const DefaultOverlayContent: FunctionComponent<{
  message: string;
  submessage?: string;
  progress?: number;
  indeterminate: boolean;
  showLogo: boolean;
}> = ({ message, submessage, progress, indeterminate, showLogo }) => {
  return (
    <div class="text-center space-y-6 px-8 py-12 max-w-md">
      {/* Logo */}
      {showLogo && (
        <div class="space-y-2">
          <div class="text-4xl text-terminal-green font-bold">&gt;_</div>
          <div class="text-lg font-bold text-terminal-green">BitChat In Browser</div>
        </div>
      )}

      {/* Spinner */}
      <div class="flex justify-center">
        <Spinner size="lg" variant="braille" />
      </div>

      {/* Message */}
      <div class="space-y-2">
        <div class="text-terminal-green/80 font-mono">{message}</div>
        {submessage && (
          <div class="text-terminal-green/50 font-mono text-sm">{submessage}</div>
        )}
      </div>

      {/* Progress bar */}
      {(progress !== undefined || indeterminate) && (
        <div class="max-w-xs mx-auto">
          <ProgressBar
            value={progress ?? 0}
            indeterminate={indeterminate && progress === undefined}
            variant="blocks"
            size="sm"
            showPercentage={progress !== undefined}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Minimal overlay content
 */
const MinimalOverlayContent: FunctionComponent<{
  message: string;
}> = ({ message }) => {
  return (
    <div class="flex items-center gap-3 px-6 py-4 bg-terminal-bg border border-terminal-green/30 rounded-terminal shadow-terminal">
      <Spinner size="sm" />
      <span class="text-terminal-green/80 font-mono">{message}</span>
    </div>
  );
};

/**
 * Terminal-style overlay content
 */
const TerminalOverlayContent: FunctionComponent<{
  message: string;
  submessage?: string;
}> = ({ message, submessage }) => {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const bootSequence = [
      'Initializing BitChat...',
      'Loading cryptographic modules...',
      'Connecting to Nostr relays...',
      'Establishing secure channels...',
      message,
    ];

    let currentLine = 0;
    const interval = setInterval(() => {
      if (currentLine < bootSequence.length) {
        const lineToAdd = bootSequence[currentLine];
        setLines((prev) => [...prev, lineToAdd]);
        currentLine++;
      } else {
        clearInterval(interval);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [message]);

  return (
    <div class="bg-terminal-bg border border-terminal-green/30 rounded-terminal p-6 max-w-lg font-mono text-sm">
      {/* Terminal header */}
      <div class="flex items-center gap-2 mb-4 pb-2 border-b border-terminal-green/20">
        <div class="flex gap-1">
          <div class="w-3 h-3 rounded-full bg-terminal-red/60" />
          <div class="w-3 h-3 rounded-full bg-terminal-yellow/60" />
          <div class="w-3 h-3 rounded-full bg-terminal-green/60" />
        </div>
        <span class="text-terminal-green/50 text-xs flex-1 text-center">
          bitchat-init
        </span>
      </div>

      {/* Boot sequence */}
      <div class="space-y-1">
        {lines.map((line, i) => (
          <div key={i} class="flex items-start gap-2">
            <span class="text-terminal-green/40">&gt;</span>
            <span class="text-terminal-green/80">{line}</span>
            {i === lines.length - 1 && (
              <span class="text-terminal-green animate-cursor-blink">_</span>
            )}
          </div>
        ))}
      </div>

      {/* Submessage */}
      {submessage && (
        <div class="mt-4 pt-4 border-t border-terminal-green/20">
          <DotsSpinner prefix={submessage} speed={400} />
        </div>
      )}
    </div>
  );
};

/**
 * Steps-based overlay content
 */
const StepsOverlayContent: FunctionComponent<{
  message: string;
  submessage?: string;
  steps: Array<{ label: string; status: 'pending' | 'active' | 'completed' | 'error' }>;
}> = ({ message, submessage, steps }) => {
  const completedSteps = steps.filter((s) => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div class="bg-terminal-bg border border-terminal-green/30 rounded-terminal p-6 max-w-md">
      {/* Header */}
      <div class="text-center mb-6">
        <div class="text-lg font-bold text-terminal-green mb-1">{message}</div>
        {submessage && (
          <div class="text-terminal-green/50 text-sm">{submessage}</div>
        )}
      </div>

      {/* Steps */}
      <StepProgress steps={steps} class="mb-6" />

      {/* Overall progress */}
      <ProgressBar
        value={progress}
        variant="ascii"
        size="sm"
        showPercentage={true}
      />
    </div>
  );
};

// ============================================================================
// Specialized Overlays
// ============================================================================

/**
 * App initialization overlay
 */
export const AppInitOverlay: FunctionComponent<{
  visible: boolean;
  phase: 'crypto' | 'storage' | 'network' | 'complete';
}> = ({ visible, phase }) => {
  const getStatus = (
    stepPhase: 'crypto' | 'storage' | 'network',
    currentPhase: 'crypto' | 'storage' | 'network' | 'complete'
  ): 'pending' | 'active' | 'completed' | 'error' => {
    const order = ['crypto', 'storage', 'network', 'complete'];
    const stepIndex = order.indexOf(stepPhase);
    const currentIndex = order.indexOf(currentPhase);

    if (currentPhase === stepPhase) return 'active';
    if (currentIndex > stepIndex) return 'completed';
    return 'pending';
  };

  const steps: Array<{ label: string; status: 'pending' | 'active' | 'completed' | 'error' }> = [
    {
      label: 'Initializing cryptographic engine',
      status: getStatus('crypto', phase),
    },
    {
      label: 'Setting up local storage',
      status: getStatus('storage', phase),
    },
    {
      label: 'Connecting to network',
      status: getStatus('network', phase),
    },
  ];

  return (
    <LoadingOverlay
      visible={visible}
      message="Initializing BitChat"
      submessage="Setting up your secure environment"
      variant="steps"
      steps={steps}
    />
  );
};

/**
 * Sync overlay
 */
export const SyncOverlay: FunctionComponent<{
  visible: boolean;
  progress?: number;
  itemsSynced?: number;
  totalItems?: number;
}> = ({ visible, progress, itemsSynced, totalItems }) => {
  const submessage = itemsSynced !== undefined && totalItems !== undefined
    ? `${itemsSynced} of ${totalItems} items synced`
    : undefined;

  return (
    <LoadingOverlay
      visible={visible}
      message="Syncing Messages"
      submessage={submessage}
      progress={progress}
      indeterminate={progress === undefined}
    />
  );
};

/**
 * Crypto operation overlay
 */
export const CryptoOverlay: FunctionComponent<{
  visible: boolean;
  operation: 'encrypting' | 'decrypting' | 'signing' | 'verifying' | 'generating';
}> = ({ visible, operation }) => {
  const messages = {
    encrypting: 'Encrypting data...',
    decrypting: 'Decrypting data...',
    signing: 'Signing message...',
    verifying: 'Verifying signature...',
    generating: 'Generating keys...',
  };

  return (
    <LoadingOverlay
      visible={visible}
      message={messages[operation]}
      variant="minimal"
      indeterminate={true}
    />
  );
};

/**
 * Transition overlay (for page/view changes)
 */
export const TransitionOverlay: FunctionComponent<{
  visible: boolean;
  message?: string;
}> = ({ visible, message = 'Loading...' }) => {
  return (
    <LoadingOverlay
      visible={visible}
      message={message}
      variant="minimal"
      transitionDuration={150}
      blur={false}
    />
  );
};

// ============================================================================
// Exports
// ============================================================================

export type { LoadingOverlayProps };
export default LoadingOverlay;
