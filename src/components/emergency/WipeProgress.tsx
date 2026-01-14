/**
 * WipeProgress Component
 *
 * Progress indicator during emergency wipe operation.
 * Shows status messages and progress bar.
 *
 * Features:
 * - Minimal visual indication (covert)
 * - Fast progress updates
 * - Automatic redirect when complete
 *
 * @module components/emergency/WipeProgress
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { type WipeProgress, type WipeStep } from '../../features/emergency/wipe';

// ============================================================================
// Types
// ============================================================================

export interface WipeProgressProps {
  /** Whether the wipe is in progress */
  isActive: boolean;
  /** Current progress state */
  progress: WipeProgress | null;
  /** Whether to show detailed messages (default: false for covert operation) */
  showDetails?: boolean;
  /** Callback when wipe is complete */
  onComplete?: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** User-friendly messages for each wipe step */
const STEP_MESSAGES: Record<WipeStep, string> = {
  preparing: 'Preparing...',
  'clearing-memory': 'Clearing keys...',
  'clearing-indexeddb': 'Clearing database...',
  'clearing-localstorage': 'Clearing local data...',
  'clearing-sessionstorage': 'Clearing session...',
  'clearing-opfs': 'Clearing files...',
  'clearing-caches': 'Clearing cache...',
  'unregistering-sw': 'Cleanup...',
  complete: 'Complete',
};

/** Minimal messages for covert mode */
const COVERT_MESSAGES: Record<WipeStep, string> = {
  preparing: '...',
  'clearing-memory': '...',
  'clearing-indexeddb': '...',
  'clearing-localstorage': '...',
  'clearing-sessionstorage': '...',
  'clearing-opfs': '...',
  'clearing-caches': '...',
  'unregistering-sw': '...',
  complete: '...',
};

// ============================================================================
// Component
// ============================================================================

export const WipeProgressIndicator: FunctionComponent<WipeProgressProps> = ({
  isActive,
  progress,
  showDetails = false,
  onComplete,
}) => {
  const [dots, setDots] = useState(0);

  // Animate dots for covert mode
  useEffect(() => {
    if (!isActive || showDetails) return;

    const interval = setInterval(() => {
      setDots((prev) => (prev + 1) % 4);
    }, 200);

    return () => clearInterval(interval);
  }, [isActive, showDetails]);

  // Notify on completion
  useEffect(() => {
    if (progress?.step === 'complete') {
      onComplete?.();
    }
  }, [progress?.step, onComplete]);

  if (!isActive) {
    return null;
  }

  const currentProgress = progress?.progress ?? 0;
  const currentStep = progress?.step ?? 'preparing';
  const messages = showDetails ? STEP_MESSAGES : COVERT_MESSAGES;

  // Covert mode - minimal UI
  if (!showDetails) {
    return (
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black">
        <div class="text-terminal-green font-mono">
          {'.'.repeat(dots + 1)}
        </div>
      </div>
    );
  }

  // Detailed mode - full progress UI
  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      role="status"
      aria-live="polite"
    >
      <div class="max-w-sm w-full mx-4 text-center">
        {/* Progress indicator */}
        <div class="mb-6">
          <div class="text-4xl font-bold text-terminal-red mb-2">
            {Math.round(currentProgress)}%
          </div>
          <div class="text-terminal-green font-mono text-sm">
            {messages[currentStep]}
          </div>
        </div>

        {/* Progress bar */}
        <div class="h-1 bg-terminal-green/20 rounded-full overflow-hidden">
          <div
            class="h-full bg-terminal-red transition-all duration-200 ease-out"
            style={{ width: `${currentProgress}%` }}
          />
        </div>

        {/* Step indicators */}
        <div class="mt-4 flex justify-center gap-1">
          {Object.keys(STEP_MESSAGES).map((step, index) => {
            const stepIndex = Object.keys(STEP_MESSAGES).indexOf(currentStep);
            const isComplete = index < stepIndex;
            const isCurrent = index === stepIndex;

            return (
              <div
                key={step}
                class={`w-2 h-2 rounded-full transition-colors ${
                  isComplete
                    ? 'bg-terminal-red'
                    : isCurrent
                      ? 'bg-terminal-yellow animate-pulse'
                      : 'bg-terminal-green/20'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Simplified Wipe Screen
// ============================================================================

export interface WipeScreenProps {
  /** Whether the wipe is in progress */
  isActive: boolean;
  /** Current progress (0-100) */
  progress?: number;
  /** Status message */
  message?: string;
}

/**
 * Simple wipe screen for basic use cases.
 * Shows a minimal black screen with optional progress.
 */
export const WipeScreen: FunctionComponent<WipeScreenProps> = ({
  isActive,
  progress,
  message,
}) => {
  if (!isActive) {
    return null;
  }

  return (
    <div class="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {progress !== undefined && (
        <div class="text-center">
          <div class="text-terminal-red font-mono text-2xl mb-2">
            {Math.round(progress)}%
          </div>
          {message && (
            <div class="text-terminal-green/50 font-mono text-xs">
              {message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Complete Screen
// ============================================================================

export interface WipeCompleteProps {
  /** Whether to show the complete screen */
  isVisible: boolean;
  /** Duration of the wipe in ms */
  duration?: number;
  /** Number of errors that occurred */
  errorCount?: number;
  /** Callback to reload/redirect */
  onReload?: () => void;
}

/**
 * Screen shown after wipe is complete.
 * Typically shown briefly before redirect.
 */
export const WipeComplete: FunctionComponent<WipeCompleteProps> = ({
  isVisible,
  duration,
  errorCount = 0,
  onReload,
}) => {
  // Auto-reload after a short delay
  useEffect(() => {
    if (!isVisible) return;

    const timeout = setTimeout(() => {
      onReload?.();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [isVisible, onReload]);

  if (!isVisible) {
    return null;
  }

  return (
    <div class="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <div class="text-center">
        <div class="text-4xl mb-4">
          {errorCount === 0 ? (
            <span class="text-terminal-green">[OK]</span>
          ) : (
            <span class="text-terminal-yellow">[!]</span>
          )}
        </div>
        <div class="text-terminal-green font-mono mb-2">Wipe complete</div>
        {duration !== undefined && (
          <div class="text-terminal-green/50 font-mono text-xs">
            {(duration / 1000).toFixed(1)}s
          </div>
        )}
        <div class="text-terminal-green/30 font-mono text-xs mt-4">
          Redirecting...
        </div>
      </div>
    </div>
  );
};

export default WipeProgressIndicator;
