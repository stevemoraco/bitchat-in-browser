/**
 * useTouchGestures - Touch interaction hooks for PWA
 *
 * Provides hooks for native-feeling touch interactions:
 * - Swipe to go back
 * - Pull to refresh
 * - Long press context menus
 * - Tap handling
 *
 * Mobile-first design optimized for iOS and Android.
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { RefObject } from 'preact';

// ============================================================================
// Types
// ============================================================================

export interface SwipeState {
  /** Whether a swipe is in progress */
  isSwiping: boolean;
  /** Current swipe direction */
  direction: SwipeDirection | null;
  /** Swipe distance in pixels */
  distance: number;
  /** Swipe velocity in pixels per millisecond */
  velocity: number;
  /** Progress as percentage (0-1) */
  progress: number;
}

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeOptions {
  /** Minimum distance to trigger swipe (default: 50) */
  threshold?: number;
  /** Minimum velocity to trigger swipe (default: 0.3) */
  velocityThreshold?: number;
  /** Whether to prevent default scroll (default: false) */
  preventDefault?: boolean;
  /** Directions to detect (default: all) */
  directions?: SwipeDirection[];
  /** Whether the gesture is enabled (default: true) */
  enabled?: boolean;
}

export interface SwipeCallbacks {
  /** Called when swipe starts */
  onSwipeStart?: () => void;
  /** Called during swipe with progress */
  onSwipeMove?: (state: SwipeState) => void;
  /** Called when swipe ends successfully */
  onSwipeEnd?: (direction: SwipeDirection) => void;
  /** Called when swipe is cancelled */
  onSwipeCancel?: () => void;
}

export interface PullToRefreshState {
  /** Whether pulling is in progress */
  isPulling: boolean;
  /** Whether refresh was triggered */
  isRefreshing: boolean;
  /** Pull distance in pixels */
  pullDistance: number;
  /** Progress as percentage (0-1) */
  progress: number;
  /** Whether threshold has been reached */
  isThresholdReached: boolean;
}

export interface PullToRefreshOptions {
  /** Distance needed to trigger refresh (default: 80) */
  threshold?: number;
  /** Maximum pull distance (default: 150) */
  maxPullDistance?: number;
  /** Whether the gesture is enabled (default: true) */
  enabled?: boolean;
  /** Resistance factor for overscroll (default: 0.5) */
  resistance?: number;
}

export interface LongPressState {
  /** Whether long press is active */
  isPressed: boolean;
  /** Whether long press was completed */
  isLongPressed: boolean;
  /** Press position */
  position: { x: number; y: number } | null;
}

export interface LongPressOptions {
  /** Duration in ms to trigger long press (default: 500) */
  delay?: number;
  /** Movement tolerance in pixels (default: 10) */
  moveTolerance?: number;
  /** Whether the gesture is enabled (default: true) */
  enabled?: boolean;
  /** Whether to cancel on context menu (default: true) */
  cancelOnContextMenu?: boolean;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SWIPE_THRESHOLD = 50;
const DEFAULT_VELOCITY_THRESHOLD = 0.3;
const DEFAULT_PULL_THRESHOLD = 80;
const DEFAULT_MAX_PULL_DISTANCE = 150;
const DEFAULT_LONG_PRESS_DELAY = 500;
const DEFAULT_MOVE_TOLERANCE = 10;
const DEFAULT_RESISTANCE = 0.5;

// ============================================================================
// useSwipeGesture Hook
// ============================================================================

/**
 * Detect swipe gestures on an element
 *
 * @param elementRef - Ref to the target element
 * @param callbacks - Swipe event callbacks
 * @param options - Configuration options
 * @returns Current swipe state
 *
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * const swipe = useSwipeGesture(ref, {
 *   onSwipeEnd: (direction) => {
 *     if (direction === 'right') navigateBack();
 *   }
 * });
 */
export function useSwipeGesture(
  elementRef: RefObject<HTMLElement>,
  callbacks: SwipeCallbacks = {},
  options: SwipeOptions = {}
): SwipeState {
  const {
    threshold = DEFAULT_SWIPE_THRESHOLD,
    velocityThreshold = DEFAULT_VELOCITY_THRESHOLD,
    preventDefault = false,
    directions = ['left', 'right', 'up', 'down'],
    enabled = true,
  } = options;

  const [state, setState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    distance: 0,
    velocity: 0,
    progress: 0,
  });

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const getSwipeDirection = useCallback(
    (deltaX: number, deltaY: number): SwipeDirection | null => {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY) {
        const direction = deltaX > 0 ? 'right' : 'left';
        return directions.includes(direction) ? direction : null;
      } 
        const direction = deltaY > 0 ? 'down' : 'up';
        return directions.includes(direction) ? direction : null;
      
    },
    [directions]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };

      setState({
        isSwiping: true,
        direction: null,
        distance: 0,
        velocity: 0,
        progress: 0,
      });

      callbacks.onSwipeStart?.();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const direction = getSwipeDirection(deltaX, deltaY);
      const elapsed = Date.now() - touchStartRef.current.time;
      const velocity = elapsed > 0 ? distance / elapsed : 0;
      const progress = Math.min(distance / threshold, 1);

      if (preventDefault && direction) {
        e.preventDefault();
      }

      const newState: SwipeState = {
        isSwiping: true,
        direction,
        distance,
        velocity,
        progress,
      };

      setState(newState);
      callbacks.onSwipeMove?.(newState);
    };

    const handleTouchEnd = () => {
      if (!touchStartRef.current) return;

      const { distance, direction, velocity } = state;

      if (direction && distance >= threshold && velocity >= velocityThreshold) {
        callbacks.onSwipeEnd?.(direction);
      } else {
        callbacks.onSwipeCancel?.();
      }

      touchStartRef.current = null;
      setState({
        isSwiping: false,
        direction: null,
        distance: 0,
        velocity: 0,
        progress: 0,
      });
    };

    const handleTouchCancel = () => {
      touchStartRef.current = null;
      callbacks.onSwipeCancel?.();
      setState({
        isSwiping: false,
        direction: null,
        distance: 0,
        velocity: 0,
        progress: 0,
      });
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefault });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [
    elementRef,
    enabled,
    threshold,
    velocityThreshold,
    preventDefault,
    getSwipeDirection,
    callbacks,
    state,
  ]);

  return state;
}

// ============================================================================
// useSwipeBack Hook
// ============================================================================

/**
 * Swipe from left edge to go back (iOS-style navigation)
 *
 * @param onBack - Callback when swipe back is triggered
 * @param options - Configuration options
 * @returns Ref to attach to container and swipe state
 *
 * @example
 * const { ref, state, canSwipeBack } = useSwipeBack(() => router.back());
 * return <div ref={ref} className={canSwipeBack ? 'can-swipe-back' : ''}>...</div>;
 */
export function useSwipeBack(
  onBack: () => void,
  options: { edgeWidth?: number; threshold?: number; enabled?: boolean } = {}
): {
  ref: RefObject<HTMLDivElement>;
  state: SwipeState;
  canSwipeBack: boolean;
} {
  const { edgeWidth = 20, threshold = 100, enabled = true } = options;

  const ref = useRef<HTMLDivElement>(null);
  const [canSwipeBack, setCanSwipeBack] = useState(false);

  const [state, setState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    distance: 0,
    velocity: 0,
    progress: 0,
  });

  const touchStartXRef = useRef<number | null>(null);
  const isEdgeSwipeRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      // Only trigger if starting from left edge
      if (touch.clientX <= edgeWidth) {
        isEdgeSwipeRef.current = true;
        touchStartXRef.current = touch.clientX;
        setCanSwipeBack(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEdgeSwipeRef.current || touchStartXRef.current === null) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartXRef.current;

      if (deltaX > 0) {
        const progress = Math.min(deltaX / threshold, 1);
        setState({
          isSwiping: true,
          direction: 'right',
          distance: deltaX,
          velocity: 0,
          progress,
        });
      }
    };

    const handleTouchEnd = () => {
      if (!isEdgeSwipeRef.current) return;

      if (state.distance >= threshold) {
        onBack();
      }

      isEdgeSwipeRef.current = false;
      touchStartXRef.current = null;
      setCanSwipeBack(false);
      setState({
        isSwiping: false,
        direction: null,
        distance: 0,
        velocity: 0,
        progress: 0,
      });
    };

    const handleTouchCancel = () => {
      isEdgeSwipeRef.current = false;
      touchStartXRef.current = null;
      setCanSwipeBack(false);
      setState({
        isSwiping: false,
        direction: null,
        distance: 0,
        velocity: 0,
        progress: 0,
      });
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, edgeWidth, threshold, onBack, state.distance]);

  return { ref, state, canSwipeBack };
}

// ============================================================================
// usePullToRefresh Hook
// ============================================================================

/**
 * Pull down to refresh content
 *
 * @param onRefresh - Async callback when refresh is triggered
 * @param options - Configuration options
 * @returns Ref to attach to container and pull state
 *
 * @example
 * const { ref, state } = usePullToRefresh(async () => {
 *   await fetchData();
 * });
 */
export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  options: PullToRefreshOptions = {}
): {
  ref: RefObject<HTMLDivElement>;
  state: PullToRefreshState;
} {
  const {
    threshold = DEFAULT_PULL_THRESHOLD,
    maxPullDistance = DEFAULT_MAX_PULL_DISTANCE,
    enabled = true,
    resistance = DEFAULT_RESISTANCE,
  } = options;

  const ref = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<PullToRefreshState>({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    progress: 0,
    isThresholdReached: false,
  });

  const touchStartYRef = useRef<number | null>(null);
  const isAtTopRef = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only enable pull to refresh when scrolled to top
      const touch = e.touches[0];
      if (!touch) return;

      if (element.scrollTop <= 0) {
        isAtTopRef.current = true;
        touchStartYRef.current = touch.clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isAtTopRef.current || touchStartYRef.current === null || state.isRefreshing) {
        return;
      }

      const touch = e.touches[0];
      if (!touch) return;

      const deltaY = touch.clientY - touchStartYRef.current;

      // Only trigger on downward pull
      if (deltaY > 0) {
        e.preventDefault();

        // Apply resistance to make it feel natural
        const resistedDistance = deltaY * resistance;
        const clampedDistance = Math.min(resistedDistance, maxPullDistance);
        const progress = Math.min(clampedDistance / threshold, 1);
        const isThresholdReached = clampedDistance >= threshold;

        setState((prev) => ({
          ...prev,
          isPulling: true,
          pullDistance: clampedDistance,
          progress,
          isThresholdReached,
        }));
      }
    };

    const handleTouchEnd = async () => {
      if (!isAtTopRef.current || touchStartYRef.current === null) return;

      const wasThresholdReached = state.isThresholdReached;

      isAtTopRef.current = false;
      touchStartYRef.current = null;

      if (wasThresholdReached && !state.isRefreshing) {
        setState((prev) => ({
          ...prev,
          isPulling: false,
          isRefreshing: true,
          pullDistance: threshold,
          progress: 1,
        }));

        try {
          await onRefresh();
        } finally {
          setState({
            isPulling: false,
            isRefreshing: false,
            pullDistance: 0,
            progress: 0,
            isThresholdReached: false,
          });
        }
      } else {
        setState({
          isPulling: false,
          isRefreshing: false,
          pullDistance: 0,
          progress: 0,
          isThresholdReached: false,
        });
      }
    };

    const handleTouchCancel = () => {
      isAtTopRef.current = false;
      touchStartYRef.current = null;
      if (!state.isRefreshing) {
        setState({
          isPulling: false,
          isRefreshing: false,
          pullDistance: 0,
          progress: 0,
          isThresholdReached: false,
        });
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, threshold, maxPullDistance, resistance, onRefresh, state.isRefreshing, state.isThresholdReached]);

  return { ref, state };
}

// ============================================================================
// useLongPress Hook
// ============================================================================

/**
 * Detect long press gestures for context menus
 *
 * @param onLongPress - Callback when long press is triggered
 * @param options - Configuration options
 * @returns Event handlers to spread on target element
 *
 * @example
 * const longPress = useLongPress((position) => {
 *   showContextMenu(position);
 * });
 * return <div {...longPress.handlers}>...</div>;
 */
export function useLongPress(
  onLongPress: (position: ContextMenuPosition) => void,
  options: LongPressOptions = {}
): {
  handlers: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
    onContextMenu: (e: Event) => void;
  };
  state: LongPressState;
} {
  const {
    delay = DEFAULT_LONG_PRESS_DELAY,
    moveTolerance = DEFAULT_MOVE_TOLERANCE,
    enabled = true,
    cancelOnContextMenu = true,
  } = options;

  const [state, setState] = useState<LongPressState>({
    isPressed: false,
    isLongPressed: false,
    position: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      const position = { x: touch.clientX, y: touch.clientY };
      startPosRef.current = position;

      setState({
        isPressed: true,
        isLongPressed: false,
        position,
      });

      timerRef.current = setTimeout(() => {
        setState((prev) => ({
          ...prev,
          isLongPressed: true,
        }));
        onLongPress(position);
      }, delay);
    },
    [enabled, delay, onLongPress]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!startPosRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = Math.abs(touch.clientX - startPosRef.current.x);
      const deltaY = Math.abs(touch.clientY - startPosRef.current.y);

      // Cancel if moved too far
      if (deltaX > moveTolerance || deltaY > moveTolerance) {
        clearTimer();
        setState({
          isPressed: false,
          isLongPressed: false,
          position: null,
        });
        startPosRef.current = null;
      }
    },
    [moveTolerance, clearTimer]
  );

  const handleTouchEnd = useCallback(() => {
    clearTimer();
    setState({
      isPressed: false,
      isLongPressed: false,
      position: null,
    });
    startPosRef.current = null;
  }, [clearTimer]);

  const handleTouchCancel = useCallback(() => {
    clearTimer();
    setState({
      isPressed: false,
      isLongPressed: false,
      position: null,
    });
    startPosRef.current = null;
  }, [clearTimer]);

  const handleContextMenu = useCallback(
    (e: Event) => {
      if (cancelOnContextMenu) {
        e.preventDefault();
      }
    },
    [cancelOnContextMenu]
  );

  // Cleanup timer on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
      onContextMenu: handleContextMenu,
    },
    state,
  };
}

// ============================================================================
// useContextMenu Hook
// ============================================================================

export interface ContextMenuState {
  isOpen: boolean;
  position: ContextMenuPosition | null;
  targetData: unknown;
}

/**
 * Manage context menu state with long press support
 *
 * @returns Context menu state and control functions
 *
 * @example
 * const { state, open, close, getLongPressProps } = useContextMenu<MessageType>();
 * return (
 *   <>
 *     {messages.map(msg => (
 *       <div {...getLongPressProps(msg)}>...</div>
 *     ))}
 *     {state.isOpen && (
 *       <ContextMenu position={state.position} onClose={close}>
 *         ...actions for {state.targetData}
 *       </ContextMenu>
 *     )}
 *   </>
 * );
 */
export function useContextMenu<T = unknown>(): {
  state: ContextMenuState;
  open: (position: ContextMenuPosition, data?: T) => void;
  close: () => void;
  getLongPressProps: (data?: T) => ReturnType<typeof useLongPress>['handlers'];
} {
  const [state, setState] = useState<ContextMenuState>({
    isOpen: false,
    position: null,
    targetData: null,
  });

  const dataRef = useRef<T | null>(null);

  const open = useCallback((position: ContextMenuPosition, data?: T) => {
    setState({
      isOpen: true,
      position,
      targetData: data ?? null,
    });
  }, []);

  const close = useCallback(() => {
    setState({
      isOpen: false,
      position: null,
      targetData: null,
    });
  }, []);

  const getLongPressProps = useCallback(
    (data?: T) => {
      dataRef.current = data ?? null;
      const { handlers } = useLongPress((position) => {
        open(position, dataRef.current ?? undefined);
      });
      return handlers;
    },
    [open]
  );

  // Close menu when clicking outside or pressing escape
  useEffect(() => {
    if (!state.isOpen) return;

    const handleClickOutside = () => {
      close();
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    // Delay adding listener to prevent immediate close
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [state.isOpen, close]);

  return { state, open, close, getLongPressProps };
}

// ============================================================================
// useDoubleTap Hook
// ============================================================================

/**
 * Detect double tap gestures
 *
 * @param onDoubleTap - Callback when double tap is detected
 * @param options - Configuration options
 * @returns Event handlers to spread on target element
 */
export function useDoubleTap(
  onDoubleTap: (position: ContextMenuPosition) => void,
  options: { delay?: number; enabled?: boolean } = {}
): {
  handlers: {
    onTouchEnd: (e: TouchEvent) => void;
  };
} {
  const { delay = 300, enabled = true } = options;

  const lastTapRef = useRef<{ time: number; position: ContextMenuPosition } | null>(null);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      if (!enabled) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const position = { x: touch.clientX, y: touch.clientY };
      const now = Date.now();

      if (lastTapRef.current) {
        const timeDiff = now - lastTapRef.current.time;
        if (timeDiff < delay) {
          onDoubleTap(position);
          lastTapRef.current = null;
          return;
        }
      }

      lastTapRef.current = { time: now, position };
    },
    [enabled, delay, onDoubleTap]
  );

  return {
    handlers: {
      onTouchEnd: handleTouchEnd,
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export default useSwipeGesture;
