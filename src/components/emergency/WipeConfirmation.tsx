/**
 * WipeConfirmation Component
 *
 * Confirmation dialog for emergency wipe operation.
 * Requires user to type "WIPE" to confirm.
 *
 * Features:
 * - Type-to-confirm for safety
 * - Optional countdown timer
 * - Cancel button
 * - Keyboard accessible
 *
 * @module components/emergency/WipeConfirmation
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export interface WipeConfirmationProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Callback when wipe is confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
  /** Confirmation word required (default: "WIPE") */
  confirmationWord?: string;
  /** Auto-cancel after timeout in seconds (0 = no timeout) */
  autoCancel?: number;
  /** Whether to show countdown (default: true) */
  showCountdown?: boolean;
  /** Custom title */
  title?: string;
  /** Custom message */
  message?: string;
}

// ============================================================================
// Component
// ============================================================================

export const WipeConfirmation: FunctionComponent<WipeConfirmationProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  confirmationWord = 'WIPE',
  autoCancel = 30,
  showCountdown = true,
  title = 'Emergency Wipe',
  message = 'This will permanently delete all data. This action cannot be undone.',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [countdown, setCountdown] = useState(autoCancel);
  const inputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if input matches confirmation word
  const isConfirmed = inputValue.toUpperCase() === confirmationWord.toUpperCase();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setCountdown(autoCancel);
      // Small delay to allow dialog to render
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, autoCancel]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || autoCancel <= 0) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onCancel();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen, autoCancel, onCancel]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      } else if (event.key === 'Enter' && isConfirmed) {
        onConfirm();
      }
    },
    [onCancel, onConfirm, isConfirmed]
  );

  // Add keyboard listener when open
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen, handleKeyDown]);

  // Handle confirm click
  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
    }
  };

  // Handle input change
  const handleInputChange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    setInputValue(target.value);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wipe-dialog-title"
    >
      <div class="bg-terminal-bg border border-terminal-red rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        {/* Header */}
        <div class="flex items-center justify-between mb-4">
          <h2
            id="wipe-dialog-title"
            class="text-lg font-bold text-terminal-red flex items-center gap-2"
          >
            <span class="text-2xl">[!]</span>
            {title}
          </h2>
          {showCountdown && autoCancel > 0 && (
            <div class="text-terminal-yellow font-mono text-sm">
              {countdown}s
            </div>
          )}
        </div>

        {/* Warning message */}
        <p class="text-terminal-green/80 mb-6 text-sm leading-relaxed">
          {message}
        </p>

        {/* Confirmation input */}
        <div class="mb-6">
          <label class="block text-terminal-green text-sm mb-2">
            Type <span class="text-terminal-red font-bold">{confirmationWord}</span> to confirm:
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onInput={handleInputChange}
            class={`w-full bg-black border rounded px-3 py-2 font-mono text-center uppercase tracking-widest transition-colors ${
              inputValue.length === 0
                ? 'border-terminal-green/30 text-terminal-green'
                : isConfirmed
                  ? 'border-terminal-red text-terminal-red'
                  : 'border-terminal-yellow text-terminal-yellow'
            }`}
            placeholder={confirmationWord}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellcheck={false}
          />
        </div>

        {/* Character progress indicator */}
        <div class="flex justify-center gap-1 mb-6">
          {confirmationWord.split('').map((char, i) => {
            const inputChar = inputValue[i]?.toUpperCase();
            const isCorrect = inputChar === char;
            const isEntered = i < inputValue.length;

            return (
              <div
                key={i}
                class={`w-6 h-6 flex items-center justify-center border rounded font-mono text-sm transition-all ${
                  isEntered
                    ? isCorrect
                      ? 'border-terminal-red bg-terminal-red/20 text-terminal-red'
                      : 'border-terminal-yellow bg-terminal-yellow/20 text-terminal-yellow'
                    : 'border-terminal-green/30 text-terminal-green/30'
                }`}
              >
                {isEntered ? inputChar : char}
              </div>
            );
          })}
        </div>

        {/* Buttons */}
        <div class="flex gap-3">
          <button
            onClick={onCancel}
            class="flex-1 px-4 py-2 border border-terminal-green/50 text-terminal-green rounded hover:bg-terminal-green/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmed}
            class={`flex-1 px-4 py-2 rounded font-bold transition-all ${
              isConfirmed
                ? 'bg-terminal-red border border-terminal-red text-black hover:bg-terminal-red/80 cursor-pointer'
                : 'bg-terminal-red/20 border border-terminal-red/30 text-terminal-red/50 cursor-not-allowed'
            }`}
          >
            Wipe All Data
          </button>
        </div>

        {/* Escape hint */}
        <p class="text-terminal-green/40 text-xs text-center mt-4">
          Press Escape to cancel
        </p>
      </div>
    </div>
  );
};

// ============================================================================
// Quick Confirmation (No typing required)
// ============================================================================

export interface QuickWipeConfirmationProps {
  /** Whether the dialog is visible */
  isOpen: boolean;
  /** Callback when wipe is confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
  /** Auto-confirm countdown in seconds (0 = disabled) */
  autoConfirm?: number;
}

/**
 * Quick confirmation dialog with countdown.
 * Use for emergency situations where typing is not practical.
 */
export const QuickWipeConfirmation: FunctionComponent<QuickWipeConfirmationProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  autoConfirm = 0,
}) => {
  const [countdown, setCountdown] = useState(autoConfirm);

  // Reset countdown when opened
  useEffect(() => {
    if (isOpen) {
      setCountdown(autoConfirm);
    }
  }, [isOpen, autoConfirm]);

  // Auto-confirm countdown
  useEffect(() => {
    if (!isOpen || autoConfirm <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onConfirm();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, autoConfirm, onConfirm]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-modal="true"
    >
      <div class="text-center p-8">
        <div class="text-6xl font-bold text-terminal-red mb-4">
          {autoConfirm > 0 ? countdown : '!'}
        </div>
        <p class="text-terminal-green mb-6">
          {autoConfirm > 0 ? 'Wiping in...' : 'Wipe all data?'}
        </p>
        <div class="flex gap-4 justify-center">
          <button
            onClick={onCancel}
            class="px-6 py-3 border border-terminal-green text-terminal-green rounded hover:bg-terminal-green/10"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            class="px-6 py-3 bg-terminal-red text-black rounded font-bold hover:bg-terminal-red/80"
          >
            Wipe Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default WipeConfirmation;
