/**
 * useEmergencyWipe Hook
 *
 * React hook for emergency wipe functionality.
 * Manages the complete wipe flow: trigger detection, confirmation, and execution.
 *
 * Features:
 * - Triple-tap detection on specified elements
 * - Keyboard shortcut (Ctrl+Shift+W)
 * - Shake detection on mobile
 * - Confirmation dialog state
 * - Progress tracking
 * - Automatic cleanup
 *
 * @module hooks/useEmergencyWipe
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import {
  performEmergencyWipe,
  quickWipe,
  type WipeProgress,
  type WipeResult,
  type TriggerEvent,
  type TriggerType,
  createKeyboardDetector,
  createShakeDetector,
  createDelayedTrigger,
  isMobileDevice,
} from '../features/emergency';

// ============================================================================
// Types
// ============================================================================

export type WipeState =
  | 'idle'
  | 'triggered'
  | 'confirming'
  | 'countdown'
  | 'wiping'
  | 'complete'
  | 'error';

export interface UseEmergencyWipeOptions {
  /** Enable keyboard shortcut (Ctrl+Shift+W) */
  enableKeyboard?: boolean;
  /** Enable shake detection on mobile */
  enableShake?: boolean;
  /** Require confirmation before wipe (default: true) */
  requireConfirmation?: boolean;
  /** Show detailed progress (default: false for covert) */
  showProgress?: boolean;
  /** Countdown duration in seconds (0 = no countdown) */
  countdownDuration?: number;
  /** Auto-cancel confirmation after seconds (0 = no auto-cancel) */
  autoCancelConfirmation?: number;
  /** Callback when wipe is triggered */
  onTrigger?: (event: TriggerEvent) => void;
  /** Callback when wipe starts */
  onWipeStart?: () => void;
  /** Callback when wipe completes */
  onWipeComplete?: (result: WipeResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseEmergencyWipeReturn {
  /** Current state of the wipe flow */
  state: WipeState;
  /** Current progress during wipe */
  progress: WipeProgress | null;
  /** Result after wipe completes */
  result: WipeResult | null;
  /** Countdown remaining (seconds) */
  countdown: number;
  /** Type of trigger that initiated the wipe */
  triggerType: TriggerType | null;
  /** Trigger the wipe flow programmatically */
  trigger: (type?: TriggerType) => void;
  /** Confirm the wipe (after trigger) */
  confirm: () => void;
  /** Cancel the wipe (during confirmation or countdown) */
  cancel: () => void;
  /** Execute quick wipe (immediate, no confirmation) */
  quickWipe: () => void;
  /** Reset state to idle */
  reset: () => void;
  /** Whether wipe is in a cancellable state */
  canCancel: boolean;
  /** Tap handler for attaching to elements */
  handleTap: (event: MouseEvent | TouchEvent) => void;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<UseEmergencyWipeOptions> = {
  enableKeyboard: true,
  enableShake: true,
  requireConfirmation: true,
  showProgress: false,
  countdownDuration: 0,
  autoCancelConfirmation: 30,
  onTrigger: () => {},
  onWipeStart: () => {},
  onWipeComplete: () => {},
  onError: () => {},
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useEmergencyWipe(
  options: UseEmergencyWipeOptions = {}
): UseEmergencyWipeReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // State
  const [state, setState] = useState<WipeState>('idle');
  const [progress, setProgress] = useState<WipeProgress | null>(null);
  const [result, setResult] = useState<WipeResult | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [triggerType, setTriggerType] = useState<TriggerType | null>(null);

  // Refs for cleanup
  const keyboardDetectorRef = useRef<ReturnType<typeof createKeyboardDetector> | null>(null);
  const shakeDetectorRef = useRef<ReturnType<typeof createShakeDetector> | null>(null);
  const delayedTriggerRef = useRef<ReturnType<typeof createDelayedTrigger> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tapCountRef = useRef(0);
  const lastTapTimeRef = useRef(0);

  // Handle trigger event
  const handleTrigger = useCallback(
    (event: TriggerEvent) => {
      if (state !== 'idle') return;

      setTriggerType(event.type);
      opts.onTrigger(event);

      if (opts.requireConfirmation) {
        setState('triggered');
        // Small delay then show confirmation
        setTimeout(() => {
          setState((currentState) => {
            if (currentState === 'triggered') {
              return 'confirming';
            }
            return currentState;
          });
        }, 100);
      } else if (opts.countdownDuration > 0) {
        setState('countdown');
        setCountdown(opts.countdownDuration);
      } else {
        executeWipe();
      }
    },
    [state, opts]
  );

  // Execute the wipe
  const executeWipe = useCallback(async () => {
    setState('wiping');
    setProgress(null);
    opts.onWipeStart();

    try {
      const wipeResult = await performEmergencyWipe(
        opts.showProgress ? setProgress : undefined,
        true // reload
      );

      setResult(wipeResult);
      setState('complete');
      opts.onWipeComplete(wipeResult);
    } catch (error) {
      setState('error');
      opts.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }, [opts]);

  // Trigger programmatically
  const trigger = useCallback(
    (type: TriggerType = 'programmatic') => {
      handleTrigger({ type, timestamp: Date.now() });
    },
    [handleTrigger]
  );

  // Confirm wipe
  const confirm = useCallback(() => {
    if (state === 'confirming') {
      if (opts.countdownDuration > 0) {
        setState('countdown');
        setCountdown(opts.countdownDuration);
      } else {
        executeWipe();
      }
    }
  }, [state, opts.countdownDuration, executeWipe]);

  // Cancel wipe
  const cancel = useCallback(() => {
    if (state === 'confirming' || state === 'countdown' || state === 'triggered') {
      setState('idle');
      setTriggerType(null);
      setCountdown(0);

      // Cancel delayed trigger if active
      delayedTriggerRef.current?.cancel();
    }
  }, [state]);

  // Quick wipe (no confirmation)
  const doQuickWipe = useCallback(() => {
    setState('wiping');
    opts.onWipeStart();
    quickWipe();
  }, [opts]);

  // Reset state
  const reset = useCallback(() => {
    setState('idle');
    setProgress(null);
    setResult(null);
    setCountdown(0);
    setTriggerType(null);
  }, []);

  // Handle tap (for triple-tap detection)
  const handleTap = useCallback(
    (_event: MouseEvent | TouchEvent) => {
      if (state !== 'idle') return;

      const now = Date.now();
      const TAP_TIMEOUT = 500;
      const TAP_COUNT = 3;

      // Reset if too much time has passed
      if (now - lastTapTimeRef.current > TAP_TIMEOUT) {
        tapCountRef.current = 0;
      }

      tapCountRef.current++;
      lastTapTimeRef.current = now;

      if (tapCountRef.current >= TAP_COUNT) {
        tapCountRef.current = 0;
        handleTrigger({ type: 'triple-tap', timestamp: now });
      }
    },
    [state, handleTrigger]
  );

  // Setup keyboard detection
  useEffect(() => {
    if (!opts.enableKeyboard) return;

    keyboardDetectorRef.current = createKeyboardDetector(handleTrigger);
    keyboardDetectorRef.current.start();

    return () => {
      keyboardDetectorRef.current?.stop();
    };
  }, [opts.enableKeyboard, handleTrigger]);

  // Setup shake detection
  useEffect(() => {
    if (!opts.enableShake || !isMobileDevice()) return;

    shakeDetectorRef.current = createShakeDetector(handleTrigger);
    shakeDetectorRef.current.start();

    return () => {
      shakeDetectorRef.current?.stop();
    };
  }, [opts.enableShake, handleTrigger]);

  // Handle countdown
  useEffect(() => {
    if (state !== 'countdown') {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          executeWipe();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [state, executeWipe]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keyboardDetectorRef.current?.stop();
      shakeDetectorRef.current?.stop();
      delayedTriggerRef.current?.cancel();
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Computed values
  const canCancel = state === 'confirming' || state === 'countdown' || state === 'triggered';

  return {
    state,
    progress,
    result,
    countdown,
    triggerType,
    trigger,
    confirm,
    cancel,
    quickWipe: doQuickWipe,
    reset,
    canCancel,
    handleTap,
  };
}

// ============================================================================
// Simplified Hook
// ============================================================================

/**
 * Simplified hook for basic emergency wipe with defaults.
 * Use this for standard implementations.
 */
export function useSimpleEmergencyWipe() {
  return useEmergencyWipe({
    enableKeyboard: true,
    enableShake: true,
    requireConfirmation: true,
    showProgress: false,
    countdownDuration: 0,
    autoCancelConfirmation: 30,
  });
}

export default useEmergencyWipe;
