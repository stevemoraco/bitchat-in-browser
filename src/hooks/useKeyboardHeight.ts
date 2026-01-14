/**
 * useKeyboardHeight Hook
 *
 * Provides accurate keyboard height detection using the visualViewport API.
 * Enables smooth keyboard avoidance animations for input areas.
 *
 * Features:
 * - Uses visualViewport API for accurate keyboard height
 * - Smooth transition support
 * - Handles iOS safe area insets
 * - Falls back gracefully when API unavailable
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export interface KeyboardState {
  /** Whether the keyboard is visible */
  isVisible: boolean;
  /** Height of the keyboard in pixels */
  height: number;
  /** Whether the keyboard is currently animating */
  isAnimating: boolean;
}

export interface UseKeyboardHeightOptions {
  /** Callback when keyboard visibility changes */
  onKeyboardChange?: (state: KeyboardState) => void;
  /** Whether to auto-adjust scroll position */
  autoScroll?: boolean;
  /** Element ref to scroll to when keyboard appears */
  scrollTargetRef?: { current: HTMLElement | null };
}

// ============================================================================
// Constants
// ============================================================================

const ANIMATION_DURATION = 250; // ms - matches iOS keyboard animation
const MIN_KEYBOARD_HEIGHT = 150; // Minimum height to consider as keyboard

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook to track keyboard visibility and height
 */
export function useKeyboardHeight(options: UseKeyboardHeightOptions = {}): KeyboardState {
  const { onKeyboardChange, autoScroll = false, scrollTargetRef } = options;

  const [state, setState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
    isAnimating: false,
  });

  const initialViewportHeightRef = useRef<number>(0);
  const animationTimeoutRef = useRef<number | null>(null);
  const lastHeightRef = useRef<number>(0);

  // Calculate keyboard height from viewport change
  const calculateKeyboardHeight = useCallback(() => {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return 0;
    }

    const viewport = window.visualViewport;
    const windowHeight = window.innerHeight;
    const viewportHeight = viewport.height;

    // Keyboard height is the difference between window height and viewport height
    const heightDiff = windowHeight - viewportHeight;

    // Account for safe area inset on iOS
    const safeAreaInset = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0'
    );

    // Only consider it a keyboard if the height difference is significant
    if (heightDiff > MIN_KEYBOARD_HEIGHT) {
      return Math.max(0, heightDiff - safeAreaInset);
    }

    return 0;
  }, []);

  // Handle viewport resize
  const handleResize = useCallback(() => {
    const newHeight = calculateKeyboardHeight();
    const wasVisible = state.isVisible;
    const isVisible = newHeight > 0;

    // Clear any existing animation timeout
    if (animationTimeoutRef.current !== null) {
      clearTimeout(animationTimeoutRef.current);
    }

    // Start animation state
    setState((prev) => ({
      ...prev,
      isAnimating: prev.height !== newHeight,
      height: newHeight,
      isVisible,
    }));

    // End animation state after duration
    animationTimeoutRef.current = window.setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isAnimating: false,
      }));
    }, ANIMATION_DURATION);

    // Track last height for change detection
    lastHeightRef.current = newHeight;

    // Notify callback
    if (onKeyboardChange && (wasVisible !== isVisible || state.height !== newHeight)) {
      onKeyboardChange({ isVisible, height: newHeight, isAnimating: true });
    }

    // Auto-scroll if enabled
    if (autoScroll && isVisible && scrollTargetRef?.current) {
      setTimeout(() => {
        scrollTargetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }
  }, [calculateKeyboardHeight, state.isVisible, state.height, onKeyboardChange, autoScroll, scrollTargetRef]);

  // Set up event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Store initial viewport height
    initialViewportHeightRef.current = window.innerHeight;

    // Use visualViewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);

      // Initial check
      handleResize();

      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize);
        window.visualViewport?.removeEventListener('scroll', handleResize);
        if (animationTimeoutRef.current !== null) {
          clearTimeout(animationTimeoutRef.current);
        }
      };
    }

    // Fallback to window resize
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationTimeoutRef.current !== null) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [handleResize]);

  // Handle focus events on inputs
  useEffect(() => {
    const handleFocus = () => {
      // Small delay to let keyboard appear
      setTimeout(handleResize, 100);
    };

    const handleBlur = () => {
      // Small delay to let keyboard hide
      setTimeout(handleResize, 100);
    };

    // Listen for focus on input elements
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, [handleResize]);

  return state;
}

// ============================================================================
// CSS Variable Updater
// ============================================================================

/**
 * Hook that updates CSS custom properties based on keyboard state
 * Useful for CSS-based keyboard avoidance
 */
export function useKeyboardCSSVariable(): KeyboardState {
  const state = useKeyboardHeight({
    onKeyboardChange: (newState) => {
      // Update CSS custom properties
      document.documentElement.style.setProperty(
        '--keyboard-height',
        `${newState.height}px`
      );
      document.documentElement.style.setProperty(
        '--keyboard-visible',
        newState.isVisible ? '1' : '0'
      );
    },
  });

  // Clean up CSS variables on unmount
  useEffect(() => () => {
      document.documentElement.style.removeProperty('--keyboard-height');
      document.documentElement.style.removeProperty('--keyboard-visible');
    }, []);

  return state;
}

// ============================================================================
// Export Default
// ============================================================================

export default useKeyboardHeight;
