/**
 * WipeTrigger Component
 *
 * Invisible tap target overlay for emergency wipe trigger.
 * Detects triple-tap on the logo area.
 *
 * Features:
 * - Invisible by default (covert)
 * - Visual feedback on tap (subtle)
 * - Configurable tap count and timeout
 *
 * @module components/emergency/WipeTrigger
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { createTapDetector, type TriggerEvent } from '../../features/emergency/trigger';

// ============================================================================
// Types
// ============================================================================

export interface WipeTriggerProps {
  /** Children to render (typically the logo) */
  children: preact.ComponentChildren;
  /** Callback when trigger is activated */
  onTrigger: (event: TriggerEvent) => void;
  /** Number of taps required (default: 3) */
  tapCount?: number;
  /** Maximum time between taps in ms (default: 500) */
  tapTimeout?: number;
  /** Whether to show visual feedback (default: false for covert operation) */
  showFeedback?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether the trigger is enabled (default: true) */
  enabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const WipeTrigger: FunctionComponent<WipeTriggerProps> = ({
  children,
  onTrigger,
  tapCount = 3,
  tapTimeout = 500,
  showFeedback = false,
  className = '',
  enabled = true,
}) => {
  const [tapState, setTapState] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create tap detector
  const tapDetectorRef = useRef(
    createTapDetector(onTrigger, {
      tapCount,
      tapTimeout,
    })
  );

  // Update tap detector if config changes
  useEffect(() => {
    tapDetectorRef.current = createTapDetector(onTrigger, {
      tapCount,
      tapTimeout,
    });
  }, [onTrigger, tapCount, tapTimeout]);

  // Handle tap for visual feedback
  const handleTap = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (!enabled) return;

      // Prevent default to avoid double-tap zoom on mobile
      event.preventDefault();

      // Update visual feedback state
      if (showFeedback) {
        setTapState((prev) => {
          const newState = prev + 1;
          // Reset after timeout
          if (resetTimeoutRef.current) {
            clearTimeout(resetTimeoutRef.current);
          }
          resetTimeoutRef.current = setTimeout(() => {
            setTapState(0);
          }, tapTimeout);
          return newState >= tapCount ? 0 : newState;
        });
      }

      // Pass to tap detector
      tapDetectorRef.current.handleTap(event);
    },
    [enabled, showFeedback, tapCount, tapTimeout]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  // Calculate feedback indicator style
  const feedbackStyle = showFeedback
    ? {
        opacity: tapState / tapCount,
        transform: `scale(${1 + tapState * 0.05})`,
      }
    : {};

  return (
    <div
      ref={containerRef}
      class={`relative cursor-pointer select-none touch-manipulation ${className}`}
      onClick={handleTap as unknown as (event: MouseEvent) => void}
      onTouchEnd={handleTap as unknown as (event: TouchEvent) => void}
      role="button"
      tabIndex={-1}
      aria-hidden="true"
    >
      {/* The actual content (logo) */}
      <div style={feedbackStyle} class="transition-all duration-100">
        {children}
      </div>

      {/* Visual feedback indicator (only when enabled) */}
      {showFeedback && tapState > 0 && (
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="flex gap-1">
            {Array.from({ length: tapCount }).map((_, i) => (
              <div
                key={i}
                class={`w-2 h-2 rounded-full transition-colors duration-100 ${
                  i < tapState ? 'bg-terminal-red' : 'bg-terminal-green/30'
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Simplified Logo Wrapper
// ============================================================================

export interface LogoWipeTriggerProps {
  /** Callback when trigger is activated */
  onTrigger: (event: TriggerEvent) => void;
  /** Whether the trigger is enabled (default: true) */
  enabled?: boolean;
  /** Additional CSS classes for the logo */
  className?: string;
}

/**
 * Pre-configured wipe trigger with BitChat logo.
 * Use this for the standard header logo implementation.
 */
export const LogoWipeTrigger: FunctionComponent<LogoWipeTriggerProps> = ({
  onTrigger,
  enabled = true,
  className = '',
}) => {
  return (
    <WipeTrigger
      onTrigger={onTrigger}
      enabled={enabled}
      tapCount={3}
      tapTimeout={500}
      showFeedback={false} // Covert by default
      className={className}
    >
      <span class="text-xl font-bold text-terminal-green">BitChat</span>
    </WipeTrigger>
  );
};

export default WipeTrigger;
