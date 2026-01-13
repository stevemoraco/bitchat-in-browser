/**
 * Update Progress Component
 *
 * Shows installation progress with:
 * - Download progress indicator
 * - Installing status
 * - Restart required notification
 * - Terminal aesthetic styling
 *
 * @module components/updates/UpdateProgress
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { InstallStatus, InstallProgress } from '../../services/updates/installer';

// ============================================================================
// Types
// ============================================================================

export interface UpdateProgressProps {
  /** Current installation progress */
  progress: InstallProgress;
  /** Called when update completes successfully */
  onComplete?: () => void;
  /** Called when update fails */
  onError?: (error: Error) => void;
  /** Whether to show fullscreen overlay */
  fullscreen?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ProgressBarProps {
  progress: number;
  animated?: boolean;
}

const ProgressBar: FunctionComponent<ProgressBarProps> = ({
  progress,
  animated = true,
}) => (
  <div class="w-full h-2 bg-terminal-green/10 border border-terminal-green/30">
    <div
      class={`h-full bg-terminal-green transition-all duration-300 ${
        animated ? 'animate-pulse' : ''
      }`}
      style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
    />
  </div>
);

interface StatusIconProps {
  status: InstallStatus;
}

const StatusIcon: FunctionComponent<StatusIconProps> = ({ status }) => {
  switch (status) {
    case 'pending':
    case 'preserving-state':
    case 'activating':
      return (
        <div class="text-2xl animate-spin">
          [*]
        </div>
      );
    case 'reloading':
      return (
        <div class="text-2xl text-terminal-green animate-pulse">
          [OK]
        </div>
      );
    case 'failed':
      return (
        <div class="text-2xl text-terminal-red">
          [X]
        </div>
      );
    default:
      return (
        <div class="text-2xl text-terminal-green/50">
          [-]
        </div>
      );
  }
};

interface StepIndicatorProps {
  currentStep: number;
  steps: string[];
}

const StepIndicator: FunctionComponent<StepIndicatorProps> = ({
  currentStep,
  steps,
}) => (
  <div class="space-y-2 text-sm">
    {steps.map((step, index) => {
      const isComplete = index < currentStep;
      const isCurrent = index === currentStep;

      return (
        <div
          key={index}
          class={`flex items-center gap-2 ${
            isComplete
              ? 'text-terminal-green'
              : isCurrent
              ? 'text-terminal-green animate-pulse'
              : 'text-terminal-green/30'
          }`}
        >
          <span class="font-mono w-6">
            {isComplete ? '[v]' : isCurrent ? '[>]' : '[ ]'}
          </span>
          <span>{step}</span>
        </div>
      );
    })}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

const UPDATE_STEPS = [
  'Saving session...',
  'Installing update...',
  'Reloading app...',
];

export const UpdateProgress: FunctionComponent<UpdateProgressProps> = ({
  progress,
  onComplete,
  onError,
  fullscreen = false,
  className = '',
}) => {
  const [showRetry, setShowRetry] = useState(false);

  // Calculate current step based on status
  const currentStep = (() => {
    switch (progress.status) {
      case 'preserving-state':
        return 0;
      case 'activating':
        return 1;
      case 'reloading':
        return 2;
      case 'failed':
        return -1;
      default:
        return 0;
    }
  })();

  // Handle status changes
  useEffect(() => {
    if (progress.status === 'reloading') {
      // Update will trigger page reload, notify completion
      onComplete?.();
    } else if (progress.status === 'failed') {
      setShowRetry(true);
      if (progress.error) {
        onError?.(progress.error);
      }
    }
  }, [progress.status, progress.error, onComplete, onError]);

  // Fullscreen overlay variant
  if (fullscreen) {
    return (
      <div
        class={`fixed inset-0 z-50 bg-terminal-bg flex items-center justify-center ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label="Update in progress"
      >
        <div class="max-w-md w-full mx-4 p-6 border border-terminal-green/30">
          {/* Header */}
          <div class="flex items-center gap-4 mb-6">
            <StatusIcon status={progress.status} />
            <div>
              <h2 class="text-terminal-green font-bold text-lg">
                {progress.status === 'failed' ? 'Update Failed' : 'Installing Update'}
              </h2>
              <p class="text-terminal-green/60 text-sm">
                {progress.message}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          {progress.progress !== undefined && progress.status !== 'failed' && (
            <div class="mb-6">
              <ProgressBar
                progress={progress.progress}
                animated={progress.status !== 'reloading'}
              />
              <div class="text-right text-terminal-green/50 text-xs mt-1">
                {progress.progress}%
              </div>
            </div>
          )}

          {/* Step indicator */}
          {progress.status !== 'failed' && (
            <StepIndicator currentStep={currentStep} steps={UPDATE_STEPS} />
          )}

          {/* Error state */}
          {progress.status === 'failed' && (
            <div class="mt-4">
              <div class="bg-terminal-red/10 border border-terminal-red/30 p-3 mb-4">
                <p class="text-terminal-red text-sm">
                  {progress.error?.message || 'An unexpected error occurred during the update.'}
                </p>
              </div>
              {showRetry && (
                <button
                  onClick={() => window.location.reload()}
                  class="w-full px-4 py-3 bg-terminal-green text-terminal-bg font-bold
                         hover:bg-terminal-green/90"
                >
                  [RELOAD APP]
                </button>
              )}
            </div>
          )}

          {/* Warning */}
          {progress.status !== 'failed' && (
            <p class="text-terminal-green/40 text-xs mt-6 text-center">
              Please don't close the app during the update.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Inline/compact variant
  return (
    <div class={`border border-terminal-green/30 p-4 ${className}`}>
      {/* Header */}
      <div class="flex items-center gap-3 mb-3">
        <StatusIcon status={progress.status} />
        <div class="flex-1">
          <div class="text-terminal-green font-bold text-sm">
            {progress.status === 'failed' ? 'Update Failed' : 'Installing Update'}
          </div>
          <div class="text-terminal-green/60 text-xs">
            {progress.message}
          </div>
        </div>
        {progress.progress !== undefined && progress.status !== 'failed' && (
          <div class="text-terminal-green text-sm font-mono">
            {progress.progress}%
          </div>
        )}
      </div>

      {/* Progress bar */}
      {progress.progress !== undefined && progress.status !== 'failed' && (
        <ProgressBar
          progress={progress.progress}
          animated={progress.status !== 'reloading'}
        />
      )}

      {/* Error state */}
      {progress.status === 'failed' && (
        <div class="mt-3">
          <p class="text-terminal-red text-xs mb-2">
            {progress.error?.message || 'Update failed'}
          </p>
          <button
            onClick={() => window.location.reload()}
            class="text-terminal-green text-xs underline hover:no-underline"
          >
            [RELOAD APP]
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Simple Progress Indicator
// ============================================================================

export interface SimpleProgressProps {
  /** Progress percentage (0-100) */
  progress?: number;
  /** Status message */
  message?: string;
  /** Whether update is complete */
  complete?: boolean;
  /** Whether update failed */
  failed?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Minimal progress indicator for embedding in other UI
 */
export const SimpleProgress: FunctionComponent<SimpleProgressProps> = ({
  progress = 0,
  message = 'Updating...',
  complete = false,
  failed = false,
  className = '',
}) => (
  <div class={`flex items-center gap-3 ${className}`}>
    <div class="text-terminal-green font-mono text-sm">
      {complete ? '[OK]' : failed ? '[X]' : '[*]'}
    </div>
    <div class="flex-1">
      <div class="text-terminal-green/80 text-sm">{message}</div>
      {!complete && !failed && progress > 0 && (
        <div class="w-full h-1 bg-terminal-green/10 mt-1">
          <div
            class="h-full bg-terminal-green transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
    {!complete && !failed && progress > 0 && (
      <div class="text-terminal-green/50 text-xs font-mono">
        {progress}%
      </div>
    )}
  </div>
);

// ============================================================================
// Exports
// ============================================================================

export default UpdateProgress;
