/**
 * Haptic Feedback Utility
 *
 * Provides tactile feedback for user interactions using the Vibration API.
 * Falls back gracefully when the API is not available.
 *
 * Patterns:
 * - Light tap: 10ms on button press
 * - Medium tap: 25ms on send
 * - Success: 10ms, 50ms pause, 10ms on connection
 * - Error: 50ms, 30ms pause, 50ms for errors
 * - Selection: 5ms for selection changes
 */

// ============================================================================
// Type Definitions
// ============================================================================

/** Vibration pattern - array of durations in milliseconds */
type VibrationPattern = number | number[];

/** Haptic feedback intensity levels */
export type HapticIntensity = 'light' | 'medium' | 'heavy';

// ============================================================================
// Vibration Patterns
// ============================================================================

/**
 * Predefined vibration patterns for different interactions
 */
const PATTERNS: Record<string, VibrationPattern> = {
  /** Light tap - for button presses, selections (10ms) */
  light: 10,

  /** Medium tap - for sends, confirmations (25ms) */
  medium: 25,

  /** Heavy tap - for important actions (40ms) */
  heavy: 40,

  /** Success pattern - double tap for positive feedback */
  success: [10, 50, 10],

  /** Error pattern - longer buzz for negative feedback */
  error: [50, 30, 50],

  /** Warning pattern - attention-getting */
  warning: [30, 20, 30],

  /** Selection pattern - very light for selection changes */
  selection: 5,

  /** Notification pattern - for incoming messages */
  notification: [10, 100, 10, 100, 10],
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the Vibration API is available
 */
const isVibrationSupported = (): boolean => typeof navigator !== 'undefined' && 'vibrate' in navigator;

/**
 * Check if reduced motion is preferred
 */
const prefersReducedMotion = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/**
 * Trigger a vibration with the given pattern
 */
const vibrate = (pattern: VibrationPattern): boolean => {
  if (!isVibrationSupported()) return false;
  if (prefersReducedMotion()) return false;

  try {
    return navigator.vibrate(pattern);
  } catch {
    // Vibration failed - some browsers restrict this
    return false;
  }
};

/**
 * Cancel any ongoing vibration
 */
const cancel = (): boolean => {
  if (!isVibrationSupported()) return false;

  try {
    return navigator.vibrate(0);
  } catch {
    return false;
  }
};

// ============================================================================
// Haptic Feedback API
// ============================================================================

/**
 * Haptic feedback interface for triggering tactile feedback
 */
export const hapticFeedback = {
  /**
   * Check if haptic feedback is available
   */
  isSupported: isVibrationSupported,

  /**
   * Light tap feedback - for button presses, selections
   */
  light: () => vibrate(PATTERNS.light),

  /**
   * Medium tap feedback - for sends, confirmations
   */
  medium: () => vibrate(PATTERNS.medium),

  /**
   * Heavy tap feedback - for important actions
   */
  heavy: () => vibrate(PATTERNS.heavy),

  /**
   * Success feedback - double tap pattern for positive outcomes
   */
  success: () => vibrate(PATTERNS.success),

  /**
   * Error feedback - longer pattern for errors/failures
   */
  error: () => vibrate(PATTERNS.error),

  /**
   * Warning feedback - attention-getting pattern
   */
  warning: () => vibrate(PATTERNS.warning),

  /**
   * Selection feedback - very light for selection changes
   */
  selection: () => vibrate(PATTERNS.selection),

  /**
   * Notification feedback - for incoming messages
   */
  notification: () => vibrate(PATTERNS.notification),

  /**
   * Custom vibration pattern
   */
  custom: (pattern: VibrationPattern) => vibrate(pattern),

  /**
   * Cancel any ongoing vibration
   */
  cancel,

  /**
   * Impact feedback with intensity level
   */
  impact: (intensity: HapticIntensity = 'medium') => {
    const pattern = PATTERNS[intensity];
    return vibrate(pattern);
  },
};

// ============================================================================
// React Hook for Haptic Feedback
// ============================================================================

/**
 * Hook to use haptic feedback with automatic cleanup
 */
export const useHapticFeedback = () => hapticFeedback;

// ============================================================================
// Higher-Order Function for Adding Haptics to Handlers
// ============================================================================

/** Pattern names for type safety */
type PatternName = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection' | 'notification';

/**
 * Wrap an event handler to add haptic feedback
 *
 * @example
 * const handleClick = withHaptics(() => {
 *   // click handler logic
 * }, 'light');
 */
export const withHaptics = <T extends (...args: any[]) => any>(
  handler: T,
  feedback: PatternName = 'light'
): T => ((...args: Parameters<T>) => {
    vibrate(PATTERNS[feedback]);
    return handler(...args);
  }) as T;

// ============================================================================
// Export Default
// ============================================================================

export default hapticFeedback;
