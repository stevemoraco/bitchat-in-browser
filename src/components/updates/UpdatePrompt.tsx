/**
 * Update Prompt Component
 *
 * "New version available" notification with:
 * - Update now / Later buttons
 * - What's new summary (optional)
 * - Auto-update countdown option
 * - Terminal aesthetic styling
 *
 * @module components/updates/UpdatePrompt
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export interface UpdatePromptProps {
  /** Current version string */
  currentVersion: string;
  /** New version string */
  newVersion: string;
  /** Release notes / what's new */
  releaseNotes?: string[];
  /** Whether this is a critical security update */
  isCritical?: boolean;
  /** Called when user clicks Update Now */
  onUpdate: () => void;
  /** Called when user clicks Later */
  onDismiss: () => void;
  /** Auto-update countdown in seconds (0 = disabled) */
  autoUpdateSeconds?: number;
  /** Called when auto-update countdown ticks */
  onCountdownTick?: (seconds: number) => void;
  /** Show as compact inline banner */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface CountdownDisplayProps {
  seconds: number;
  onCancel: () => void;
}

const CountdownDisplay: FunctionComponent<CountdownDisplayProps> = ({ seconds, onCancel }) => (
  <div class="flex items-center gap-2 text-sm">
    <span class="text-terminal-yellow">
      Auto-updating in {seconds}s...
    </span>
    <button
      onClick={onCancel}
      class="text-terminal-green/70 hover:text-terminal-green underline"
    >
      [CANCEL]
    </button>
  </div>
);

interface ReleaseNotesProps {
  notes: string[];
}

const ReleaseNotes: FunctionComponent<ReleaseNotesProps> = ({ notes }) => (
  <div class="border border-terminal-green/20 p-3 mt-3">
    <div class="text-terminal-green text-sm font-bold mb-2">
      What's New:
    </div>
    <ul class="text-xs text-terminal-green/70 space-y-1">
      {notes.slice(0, 5).map((note, index) => (
        <li key={index}>+ {note}</li>
      ))}
      {notes.length > 5 && (
        <li class="text-terminal-green/50">
          ... and {notes.length - 5} more
        </li>
      )}
    </ul>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const UpdatePrompt: FunctionComponent<UpdatePromptProps> = ({
  currentVersion,
  newVersion,
  releaseNotes,
  isCritical = false,
  onUpdate,
  onDismiss,
  autoUpdateSeconds = 0,
  onCountdownTick,
  compact = false,
  className = '',
}) => {
  const [countdown, setCountdown] = useState<number | null>(
    autoUpdateSeconds > 0 ? autoUpdateSeconds : null
  );
  const [showNotes, setShowNotes] = useState(false);

  // Handle countdown
  useEffect(() => {
    if (countdown === null || countdown <= 0) {
      if (countdown === 0) {
        onUpdate();
      }
      return;
    }

    const timer = setTimeout(() => {
      const newValue = countdown - 1;
      setCountdown(newValue);
      onCountdownTick?.(newValue);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onUpdate, onCountdownTick]);

  const handleUpdate = useCallback(() => {
    setCountdown(null); // Cancel any countdown
    onUpdate();
  }, [onUpdate]);

  const handleDismiss = useCallback(() => {
    setCountdown(null); // Cancel any countdown
    onDismiss();
  }, [onDismiss]);

  const handleCancelCountdown = useCallback(() => {
    setCountdown(null);
  }, []);

  const toggleNotes = useCallback(() => {
    setShowNotes((prev) => !prev);
  }, []);

  // Compact banner variant
  if (compact) {
    return (
      <div
        class={`flex items-center gap-3 p-2 border ${
          isCritical
            ? 'border-terminal-red/50 bg-terminal-red/5'
            : 'border-terminal-green/30'
        } ${className}`}
      >
        {isCritical && (
          <span class="text-terminal-red text-xs font-bold">[!]</span>
        )}
        <span class="text-terminal-green/80 text-xs flex-1">
          {isCritical ? 'Critical security update' : 'Update available'}:{' '}
          <span class="text-terminal-green">v{newVersion}</span>
        </span>
        {countdown !== null ? (
          <CountdownDisplay seconds={countdown} onCancel={handleCancelCountdown} />
        ) : (
          <>
            <button
              onClick={handleUpdate}
              class="px-2 py-1 text-xs bg-terminal-green text-terminal-bg font-bold
                     hover:bg-terminal-green/90"
            >
              [UPDATE]
            </button>
            <button
              onClick={handleDismiss}
              class="px-2 py-1 text-xs text-terminal-green/50 hover:text-terminal-green/70"
            >
              [X]
            </button>
          </>
        )}
      </div>
    );
  }

  // Full prompt variant
  return (
    <div
      class={`border ${
        isCritical
          ? 'border-terminal-red/50 bg-terminal-red/5'
          : 'border-terminal-green/30'
      } p-4 ${className}`}
    >
      {/* Header */}
      <div class="flex items-start justify-between mb-3">
        <div>
          <div class="flex items-center gap-2">
            {isCritical && (
              <span class="text-terminal-red font-bold">[!]</span>
            )}
            <h3 class="text-terminal-green font-bold">
              {isCritical ? 'Critical Update Available' : 'Update Available'}
            </h3>
          </div>
          <p class="text-terminal-green/60 text-sm mt-1">
            v{currentVersion} → v{newVersion}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          class="text-terminal-green/50 hover:text-terminal-green text-lg"
          aria-label="Close"
        >
          x
        </button>
      </div>

      {/* Critical update warning */}
      {isCritical && (
        <div class="bg-terminal-red/10 border border-terminal-red/30 p-3 mb-3">
          <p class="text-terminal-red text-sm">
            This update contains important security fixes. We strongly recommend
            updating immediately.
          </p>
        </div>
      )}

      {/* Release notes toggle */}
      {releaseNotes && releaseNotes.length > 0 && (
        <>
          <button
            onClick={toggleNotes}
            class="text-terminal-green/70 text-sm hover:text-terminal-green underline mb-2"
          >
            {showNotes ? '[- Hide what\'s new]' : '[+ Show what\'s new]'}
          </button>
          {showNotes && <ReleaseNotes notes={releaseNotes} />}
        </>
      )}

      {/* Countdown display */}
      {countdown !== null && countdown > 0 && (
        <div class="mt-3 p-2 bg-terminal-green/5 border border-terminal-green/20">
          <CountdownDisplay seconds={countdown} onCancel={handleCancelCountdown} />
        </div>
      )}

      {/* Action buttons */}
      <div class="flex gap-3 mt-4">
        <button
          onClick={handleUpdate}
          class={`flex-1 px-4 py-3 font-bold transition-colors ${
            isCritical
              ? 'bg-terminal-red text-terminal-bg hover:bg-terminal-red/90'
              : 'bg-terminal-green text-terminal-bg hover:bg-terminal-green/90'
          }`}
        >
          [UPDATE NOW]
        </button>
        {!isCritical && (
          <button
            onClick={handleDismiss}
            class="px-4 py-3 border border-terminal-green/30 text-terminal-green/70
                   hover:border-terminal-green/50 hover:text-terminal-green transition-colors"
          >
            [LATER]
          </button>
        )}
      </div>

      {/* Info text */}
      <p class="text-terminal-green/40 text-xs mt-3 text-center">
        The app will reload to apply the update.
      </p>
    </div>
  );
};

// ============================================================================
// Toast/Banner Variant
// ============================================================================

export interface UpdateToastProps {
  newVersion: string;
  isCritical?: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * Minimal toast-style update notification
 */
export const UpdateToast: FunctionComponent<UpdateToastProps> = ({
  newVersion,
  isCritical = false,
  onUpdate,
  onDismiss,
  className = '',
}) => (
  <div
    class={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50
            animate-slide-up ${className}`}
    role="alert"
  >
    <div
      class={`flex items-center gap-3 p-3 shadow-lg ${
        isCritical
          ? 'bg-terminal-bg border-2 border-terminal-red'
          : 'bg-terminal-bg border border-terminal-green'
      }`}
    >
      <div class="flex-1">
        <div class="flex items-center gap-2">
          {isCritical && (
            <span class="text-terminal-red font-bold">[!]</span>
          )}
          <span class="text-terminal-green text-sm">
            {isCritical ? 'Critical update' : 'New version'}: v{newVersion}
          </span>
        </div>
      </div>
      <button
        onClick={onUpdate}
        class={`px-3 py-1.5 text-sm font-bold ${
          isCritical
            ? 'bg-terminal-red text-terminal-bg hover:bg-terminal-red/90'
            : 'bg-terminal-green text-terminal-bg hover:bg-terminal-green/90'
        }`}
      >
        UPDATE
      </button>
      <button
        onClick={onDismiss}
        class="text-terminal-green/50 hover:text-terminal-green p-1"
        aria-label="Dismiss"
      >
        x
      </button>
    </div>
  </div>
);

// ============================================================================
// Exports
// ============================================================================

export default UpdatePrompt;
