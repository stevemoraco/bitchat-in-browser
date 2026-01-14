/**
 * Emergency Wipe Trigger Detection
 *
 * Provides multiple trigger mechanisms for emergency wipe:
 * - Triple-tap logo detection
 * - Keyboard shortcut (Ctrl+Shift+W)
 * - Device shake detection (mobile)
 * - Timer-based delay option
 *
 * @module features/emergency/trigger
 */

// ============================================================================
// Types
// ============================================================================

export type TriggerType = 'triple-tap' | 'keyboard' | 'shake' | 'programmatic';

export interface TriggerEvent {
  type: TriggerType;
  timestamp: number;
}

export type TriggerCallback = (event: TriggerEvent) => void;

export interface TapDetectorConfig {
  /** Number of taps required (default: 3) */
  tapCount?: number;
  /** Maximum time between taps in ms (default: 500) */
  tapTimeout?: number;
  /** Maximum distance between taps in pixels (default: 50) */
  maxDistance?: number;
}

export interface ShakeDetectorConfig {
  /** Acceleration threshold for shake detection (default: 15) */
  threshold?: number;
  /** Minimum shakes required (default: 3) */
  shakeCount?: number;
  /** Time window for shake detection in ms (default: 1000) */
  timeWindow?: number;
}

export interface DelayedTriggerConfig {
  /** Delay before wipe in ms (default: 3000) */
  delay?: number;
  /** Whether the trigger can be cancelled (default: true) */
  cancellable?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TAP_CONFIG: Required<TapDetectorConfig> = {
  tapCount: 3,
  tapTimeout: 500,
  maxDistance: 50,
};

const DEFAULT_SHAKE_CONFIG: Required<ShakeDetectorConfig> = {
  threshold: 15,
  shakeCount: 3,
  timeWindow: 1000,
};

const DEFAULT_DELAY_CONFIG: Required<DelayedTriggerConfig> = {
  delay: 3000,
  cancellable: true,
};

// Keyboard shortcut: Ctrl/Cmd + Shift + W
const TRIGGER_KEY = 'W';
const REQUIRE_CTRL = true;
const REQUIRE_SHIFT = true;

// ============================================================================
// Tap Detector
// ============================================================================

/**
 * Creates a tap detector for triple-tap (or configurable N-tap) detection.
 */
export function createTapDetector(
  callback: TriggerCallback,
  config: TapDetectorConfig = {}
): {
  handleTap: (event: MouseEvent | TouchEvent) => void;
  reset: () => void;
} {
  const { tapCount, tapTimeout, maxDistance } = { ...DEFAULT_TAP_CONFIG, ...config };

  interface TapRecord {
    time: number;
    x: number;
    y: number;
  }

  let taps: TapRecord[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const reset = () => {
    taps = [];
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const getCoordinates = (event: MouseEvent | TouchEvent): { x: number; y: number } => {
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (touch) {
        return { x: touch.clientX, y: touch.clientY };
      }
      return { x: 0, y: 0 };
    }
    return { x: event.clientX, y: event.clientY };
  };

  const handleTap = (event: MouseEvent | TouchEvent) => {
    const now = Date.now();
    const { x, y } = getCoordinates(event);

    // Check if this tap is close enough to previous taps
    if (taps.length > 0) {
      const lastTap = taps[taps.length - 1];
      if (lastTap) {
        const distance = Math.sqrt(Math.pow(x - lastTap.x, 2) + Math.pow(y - lastTap.y, 2));

        if (distance > maxDistance) {
          // Tap too far from previous, start fresh
          reset();
        }
      }
    }

    // Clear previous timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Add new tap
    taps.push({ time: now, x, y });

    // Check if we have enough taps
    if (taps.length >= tapCount) {
      // Verify all taps are within timeout window
      const firstTap = taps[0];
      const firstTapTime = firstTap?.time ?? now;
      const isWithinWindow = taps.every((tap) => tap.time - firstTapTime < tapTimeout * tapCount);

      if (isWithinWindow) {
        callback({
          type: 'triple-tap',
          timestamp: now,
        });
        reset();
        return;
      } 
        // Remove old taps that are outside the window
        taps = taps.filter((tap) => now - tap.time < tapTimeout);
      
    }

    // Set timeout to reset if no more taps
    timeoutId = setTimeout(reset, tapTimeout);
  };

  return { handleTap, reset };
}

// ============================================================================
// Keyboard Shortcut Detector
// ============================================================================

/**
 * Creates a keyboard shortcut listener for emergency wipe.
 * Default: Ctrl+Shift+W (or Cmd+Shift+W on Mac)
 */
export function createKeyboardDetector(
  callback: TriggerCallback
): {
  start: () => void;
  stop: () => void;
} {
  const handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toUpperCase();

    // Check if correct key combination
    const ctrlOrMeta = event.ctrlKey || event.metaKey;
    const isCorrectCombo =
      key === TRIGGER_KEY &&
      (!REQUIRE_CTRL || ctrlOrMeta) &&
      (!REQUIRE_SHIFT || event.shiftKey);

    if (isCorrectCombo) {
      event.preventDefault();
      event.stopPropagation();

      callback({
        type: 'keyboard',
        timestamp: Date.now(),
      });
    }
  };

  const start = () => {
    document.addEventListener('keydown', handleKeyDown, { capture: true });
  };

  const stop = () => {
    document.removeEventListener('keydown', handleKeyDown, { capture: true });
  };

  return { start, stop };
}

// ============================================================================
// Shake Detector (Mobile)
// ============================================================================

/**
 * Creates a shake detector for mobile devices.
 * Uses DeviceMotion API when available.
 */
export function createShakeDetector(
  callback: TriggerCallback,
  config: ShakeDetectorConfig = {}
): {
  start: () => Promise<boolean>;
  stop: () => void;
  isSupported: () => boolean;
} {
  const { threshold, shakeCount, timeWindow } = { ...DEFAULT_SHAKE_CONFIG, ...config };

  interface ShakeRecord {
    time: number;
    magnitude: number;
  }

  let shakes: ShakeRecord[] = [];
  let lastAcceleration = { x: 0, y: 0, z: 0 };
  let isRunning = false;

  const handleMotion = (event: DeviceMotionEvent) => {
    if (!event.accelerationIncludingGravity) return;

    const { x, y, z } = event.accelerationIncludingGravity;
    const now = Date.now();

    // Calculate acceleration change
    const deltaX = Math.abs((x || 0) - lastAcceleration.x);
    const deltaY = Math.abs((y || 0) - lastAcceleration.y);
    const deltaZ = Math.abs((z || 0) - lastAcceleration.z);
    const magnitude = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

    lastAcceleration = { x: x || 0, y: y || 0, z: z || 0 };

    // Check if shake detected
    if (magnitude > threshold) {
      shakes.push({ time: now, magnitude });

      // Remove old shakes outside the time window
      shakes = shakes.filter((shake) => now - shake.time < timeWindow);

      // Check if we have enough shakes
      if (shakes.length >= shakeCount) {
        callback({
          type: 'shake',
          timestamp: now,
        });
        shakes = [];
      }
    }
  };

  const isSupported = (): boolean => typeof DeviceMotionEvent !== 'undefined';

  const start = async (): Promise<boolean> => {
    if (!isSupported()) {
      return false;
    }

    // iOS 13+ requires permission
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      // @ts-expect-error - requestPermission only exists on iOS 13+
      typeof DeviceMotionEvent.requestPermission === 'function'
    ) {
      try {
        // @ts-expect-error - requestPermission only exists on iOS 13+
        const permission = await DeviceMotionEvent.requestPermission();
        if (permission !== 'granted') {
          return false;
        }
      } catch {
        return false;
      }
    }

    window.addEventListener('devicemotion', handleMotion);
    isRunning = true;
    return true;
  };

  const stop = () => {
    if (isRunning) {
      window.removeEventListener('devicemotion', handleMotion);
      isRunning = false;
      shakes = [];
    }
  };

  return { start, stop, isSupported };
}

// ============================================================================
// Delayed Trigger
// ============================================================================

/**
 * Creates a delayed trigger that can be cancelled.
 * Useful for implementing a countdown before wipe.
 */
export function createDelayedTrigger(
  callback: TriggerCallback,
  config: DelayedTriggerConfig = {}
): {
  start: () => void;
  cancel: () => boolean;
  getTimeRemaining: () => number;
  isActive: () => boolean;
} {
  const { delay, cancellable } = { ...DEFAULT_DELAY_CONFIG, ...config };

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let startTime: number | null = null;

  const start = () => {
    if (timeoutId) {
      // Already running
      return;
    }

    startTime = Date.now();
    timeoutId = setTimeout(() => {
      callback({
        type: 'programmatic',
        timestamp: Date.now(),
      });
      timeoutId = null;
      startTime = null;
    }, delay);
  };

  const cancel = (): boolean => {
    if (!cancellable || !timeoutId) {
      return false;
    }

    clearTimeout(timeoutId);
    timeoutId = null;
    startTime = null;
    return true;
  };

  const getTimeRemaining = (): number => {
    if (!startTime) return 0;
    const elapsed = Date.now() - startTime;
    return Math.max(0, delay - elapsed);
  };

  const isActive = (): boolean => timeoutId !== null;

  return { start, cancel, getTimeRemaining, isActive };
}

// ============================================================================
// Combined Trigger Manager
// ============================================================================

export interface TriggerManagerConfig {
  enableTripleTap?: boolean;
  enableKeyboard?: boolean;
  enableShake?: boolean;
  tripleTapConfig?: TapDetectorConfig;
  shakeConfig?: ShakeDetectorConfig;
}

/**
 * Creates a unified trigger manager that handles all trigger types.
 */
export function createTriggerManager(
  callback: TriggerCallback,
  config: TriggerManagerConfig = {}
): {
  start: () => Promise<void>;
  stop: () => void;
  getTapHandler: () => ((event: MouseEvent | TouchEvent) => void) | null;
} {
  const {
    enableTripleTap = true,
    enableKeyboard = true,
    enableShake = true,
    tripleTapConfig,
    shakeConfig,
  } = config;

  const tapDetector = enableTripleTap ? createTapDetector(callback, tripleTapConfig) : null;
  const keyboardDetector = enableKeyboard ? createKeyboardDetector(callback) : null;
  const shakeDetector = enableShake ? createShakeDetector(callback, shakeConfig) : null;

  const start = async () => {
    // Keyboard detection starts immediately
    keyboardDetector?.start();

    // Shake detection may require permission
    if (shakeDetector?.isSupported()) {
      await shakeDetector.start();
    }

    // Triple-tap needs to be attached to specific elements
    // Return the handler for manual attachment
  };

  const stop = () => {
    tapDetector?.reset();
    keyboardDetector?.stop();
    shakeDetector?.stop();
  };

  const getTapHandler = () => tapDetector?.handleTap ?? null;

  return { start, stop, getTapHandler };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if device supports shake detection.
 */
export function supportsShakeDetection(): boolean {
  return typeof DeviceMotionEvent !== 'undefined';
}

/**
 * Check if we're on a mobile device (for enabling shake).
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Request permission for shake detection on iOS 13+.
 */
export async function requestShakePermission(): Promise<boolean> {
  if (
    typeof DeviceMotionEvent !== 'undefined' &&
    // @ts-expect-error - requestPermission only exists on iOS 13+
    typeof DeviceMotionEvent.requestPermission === 'function'
  ) {
    try {
      // @ts-expect-error - requestPermission only exists on iOS 13+
      const permission = await DeviceMotionEvent.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }
  // No permission needed on other platforms
  return true;
}
