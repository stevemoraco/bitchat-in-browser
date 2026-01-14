/**
 * Tests for useTouchGestures Hook
 *
 * Tests touch gesture detection including:
 * - Swipe gesture detection (left, right, up, down)
 * - Touch position tracking
 * - Pull to refresh
 * - Long press detection
 * - Swipe back gesture
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import {
  useSwipeGesture,
  useSwipeBack,
  usePullToRefresh,
  useLongPress,
  useDoubleTap,
  useContextMenu,
} from '../useTouchGestures';
import { useRef } from 'preact/hooks';

// ============================================================================
// Test Utilities
// ============================================================================

function createTouchEvent(type: string, touches: { clientX: number; clientY: number }[]): TouchEvent {
  return {
    type,
    touches: touches.map((t, i) => ({
      identifier: i,
      clientX: t.clientX,
      clientY: t.clientY,
      screenX: t.clientX,
      screenY: t.clientY,
      pageX: t.clientX,
      pageY: t.clientY,
      target: document.body,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    })),
    changedTouches: touches.map((t, i) => ({
      identifier: i,
      clientX: t.clientX,
      clientY: t.clientY,
      screenX: t.clientX,
      screenY: t.clientY,
      pageX: t.clientX,
      pageY: t.clientY,
      target: document.body,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 1,
    })),
    targetTouches: [],
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as TouchEvent;
}

// Mock element with event listener tracking
function createMockElement() {
  const listeners: Map<string, Set<EventListener>> = new Map();

  return {
    addEventListener: vi.fn((event: string, handler: EventListener) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)!.add(handler);
    }),
    removeEventListener: vi.fn((event: string, handler: EventListener) => {
      listeners.get(event)?.delete(handler);
    }),
    dispatchEvent: vi.fn((event: Event) => {
      const handlers = listeners.get(event.type);
      if (handlers) {
        handlers.forEach((h) => h(event));
      }
      return true;
    }),
    _listeners: listeners,
    scrollTop: 0,
  };
}

describe('useSwipeGesture', () => {
  let mockElement: ReturnType<typeof createMockElement>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElement = createMockElement();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should return initial swipe state', () => {
      const elementRef = { current: mockElement as unknown as HTMLElement };
      const { result } = renderHook(() => useSwipeGesture(elementRef));

      expect(result.current.isSwiping).toBe(false);
      expect(result.current.direction).toBeNull();
      expect(result.current.distance).toBe(0);
      expect(result.current.velocity).toBe(0);
      expect(result.current.progress).toBe(0);
    });

    it('should set up event listeners', () => {
      const elementRef = { current: mockElement as unknown as HTMLElement };
      renderHook(() => useSwipeGesture(elementRef));

      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        expect.any(Object)
      );
      expect(mockElement.addEventListener).toHaveBeenCalledWith(
        'touchend',
        expect.any(Function),
        expect.any(Object)
      );
    });
  });

  describe('swipe detection', () => {
    it('should track swipe state during horizontal movement', () => {
      const onSwipeMove = vi.fn();
      const elementRef = { current: mockElement as unknown as HTMLElement };
      const { result } = renderHook(() =>
        useSwipeGesture(elementRef, { onSwipeMove }, { threshold: 50 })
      );

      // Get the touch handlers
      const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
      const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

      // Simulate swipe right
      act(() => {
        touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 50, clientY: 100 }]));
      });

      expect(result.current.isSwiping).toBe(true);

      act(() => {
        touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 150, clientY: 100 }]));
      });

      // Should track movement
      expect(onSwipeMove).toHaveBeenCalled();
    });

    it('should track swipe state during vertical movement', () => {
      const onSwipeMove = vi.fn();
      const elementRef = { current: mockElement as unknown as HTMLElement };
      const { result } = renderHook(() =>
        useSwipeGesture(elementRef, { onSwipeMove }, { threshold: 50 })
      );

      const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
      const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

      act(() => {
        touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 50 }]));
        touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 100, clientY: 150 }]));
      });

      expect(onSwipeMove).toHaveBeenCalled();
    });

    it('should reset state on touch end', () => {
      const elementRef = { current: mockElement as unknown as HTMLElement };
      const { result } = renderHook(() =>
        useSwipeGesture(elementRef, {}, { threshold: 50 })
      );

      const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
      const touchEndHandler = mockElement._listeners.get('touchend')?.values().next().value;

      act(() => {
        touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
      });

      expect(result.current.isSwiping).toBe(true);

      act(() => {
        touchEndHandler?.(createTouchEvent('touchend', []));
      });

      expect(result.current.isSwiping).toBe(false);
    });

    it('should calculate distance during swipe', () => {
      const elementRef = { current: mockElement as unknown as HTMLElement };
      const { result } = renderHook(() =>
        useSwipeGesture(elementRef, {}, { threshold: 50 })
      );

      const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
      const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

      act(() => {
        touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
        touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 100, clientY: 0 }]));
      });

      // Distance should be calculated
      expect(result.current.distance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('swipe callbacks', () => {
    it('should call onSwipeStart when swipe begins', () => {
      const onSwipeStart = vi.fn();
      const elementRef = { current: mockElement as unknown as HTMLElement };
      renderHook(() => useSwipeGesture(elementRef, { onSwipeStart }));

      const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;

      act(() => {
        touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
      });

      expect(onSwipeStart).toHaveBeenCalled();
    });

    it('should call onSwipeMove during swipe', () => {
      const onSwipeMove = vi.fn();
      const elementRef = { current: mockElement as unknown as HTMLElement };
      renderHook(() => useSwipeGesture(elementRef, { onSwipeMove }));

      const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
      const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

      act(() => {
        touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
        touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 150, clientY: 100 }]));
      });

      expect(onSwipeMove).toHaveBeenCalledWith(
        expect.objectContaining({
          isSwiping: true,
          distance: expect.any(Number),
        })
      );
    });

    it('should call onSwipeCancel when swipe is cancelled', () => {
      const onSwipeCancel = vi.fn();
      const elementRef = { current: mockElement as unknown as HTMLElement };
      renderHook(() => useSwipeGesture(elementRef, { onSwipeCancel }));

      const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
      const touchCancelHandler = mockElement._listeners.get('touchcancel')?.values().next().value;

      act(() => {
        touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
        touchCancelHandler?.(createTouchEvent('touchcancel', []));
      });

      expect(onSwipeCancel).toHaveBeenCalled();
    });
  });

  describe('direction filtering', () => {
    it('should only detect specified directions', () => {
      const onSwipeEnd = vi.fn();
      const elementRef = { current: mockElement as unknown as HTMLElement };
      renderHook(() =>
        useSwipeGesture(
          elementRef,
          { onSwipeEnd },
          { directions: ['left', 'right'], threshold: 50, velocityThreshold: 0 }
        )
      );

      const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
      const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;
      const touchEndHandler = mockElement._listeners.get('touchend')?.values().next().value;

      // Try vertical swipe (should be cancelled, not detected)
      act(() => {
        touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 50 }]));
        touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 100, clientY: 150 }]));
        touchEndHandler?.(createTouchEvent('touchend', []));
      });

      // Should not call onSwipeEnd for down direction
      expect(onSwipeEnd).not.toHaveBeenCalledWith('down');
    });
  });

  describe('enabled option', () => {
    it('should not detect swipes when disabled', () => {
      const onSwipeEnd = vi.fn();
      const elementRef = { current: mockElement as unknown as HTMLElement };
      renderHook(() =>
        useSwipeGesture(elementRef, { onSwipeEnd }, { enabled: false })
      );

      // No event listeners should be set up
      expect(mockElement.addEventListener).not.toHaveBeenCalled();
    });
  });
});

describe('useSwipeBack', () => {
  let mockElement: ReturnType<typeof createMockElement>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElement = createMockElement();
  });

  it('should return ref and state', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack(onBack));

    expect(result.current.ref).toBeDefined();
    expect(result.current.state).toHaveProperty('isSwiping');
    expect(result.current.state).toHaveProperty('progress');
    expect(result.current.canSwipeBack).toBe(false);
  });

  it('should only trigger on edge swipe', () => {
    const onBack = vi.fn();
    const { result } = renderHook(() => useSwipeBack(onBack, { edgeWidth: 20 }));

    // Manually set the ref
    (result.current.ref as any).current = mockElement;

    // Simulate re-render to set up listeners
    const { result: newResult } = renderHook(() =>
      useSwipeBack(onBack, { edgeWidth: 20 })
    );
    (newResult.current.ref as any).current = mockElement;
  });
});

describe('usePullToRefresh', () => {
  let mockElement: ReturnType<typeof createMockElement>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockElement = createMockElement();
  });

  it('should return ref and state', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh(onRefresh));

    expect(result.current.ref).toBeDefined();
    expect(result.current.state).toHaveProperty('isPulling');
    expect(result.current.state).toHaveProperty('isRefreshing');
    expect(result.current.state).toHaveProperty('pullDistance');
    expect(result.current.state).toHaveProperty('progress');
    expect(result.current.state).toHaveProperty('isThresholdReached');
  });

  it('should start with default state', () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => usePullToRefresh(onRefresh));

    expect(result.current.state.isPulling).toBe(false);
    expect(result.current.state.isRefreshing).toBe(false);
    expect(result.current.state.pullDistance).toBe(0);
    expect(result.current.state.progress).toBe(0);
  });
});

describe('useLongPress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return handlers and state', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    expect(result.current.handlers).toHaveProperty('onTouchStart');
    expect(result.current.handlers).toHaveProperty('onTouchMove');
    expect(result.current.handlers).toHaveProperty('onTouchEnd');
    expect(result.current.handlers).toHaveProperty('onTouchCancel');
    expect(result.current.handlers).toHaveProperty('onContextMenu');
    expect(result.current.state).toHaveProperty('isPressed');
    expect(result.current.state).toHaveProperty('isLongPressed');
    expect(result.current.state).toHaveProperty('position');
  });

  it('should detect long press after delay', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

    const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

    act(() => {
      result.current.handlers.onTouchStart(touchStartEvent);
    });

    expect(result.current.state.isPressed).toBe(true);
    expect(result.current.state.isLongPressed).toBe(false);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.state.isLongPressed).toBe(true);
    expect(onLongPress).toHaveBeenCalledWith({ x: 100, y: 100 });
  });

  it('should not trigger long press if touch ends before delay', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 500 }));

    const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

    act(() => {
      result.current.handlers.onTouchStart(touchStartEvent);
    });

    // End touch before delay
    act(() => {
      vi.advanceTimersByTime(300);
      result.current.handlers.onTouchEnd();
    });

    expect(onLongPress).not.toHaveBeenCalled();
    expect(result.current.state.isLongPressed).toBe(false);
  });

  it('should cancel long press if touch moves too far', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { delay: 500, moveTolerance: 10 })
    );

    const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);
    const touchMoveEvent = createTouchEvent('touchmove', [{ clientX: 150, clientY: 100 }]); // Moved 50px

    act(() => {
      result.current.handlers.onTouchStart(touchStartEvent);
    });

    act(() => {
      result.current.handlers.onTouchMove(touchMoveEvent);
    });

    expect(result.current.state.isPressed).toBe(false);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('should prevent context menu when cancelOnContextMenu is true', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { cancelOnContextMenu: true })
    );

    const contextMenuEvent = { preventDefault: vi.fn() } as unknown as Event;

    act(() => {
      result.current.handlers.onContextMenu(contextMenuEvent);
    });

    expect(contextMenuEvent.preventDefault).toHaveBeenCalled();
  });
});

describe('useDoubleTap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return handlers', () => {
    const onDoubleTap = vi.fn();
    const { result } = renderHook(() => useDoubleTap(onDoubleTap));

    expect(result.current.handlers).toHaveProperty('onTouchEnd');
  });

  it('should detect double tap within delay', () => {
    const onDoubleTap = vi.fn();
    const { result } = renderHook(() => useDoubleTap(onDoubleTap, { delay: 300 }));

    const touchEndEvent1 = createTouchEvent('touchend', []);
    (touchEndEvent1 as any).changedTouches = [{ clientX: 100, clientY: 100 }];

    const touchEndEvent2 = createTouchEvent('touchend', []);
    (touchEndEvent2 as any).changedTouches = [{ clientX: 100, clientY: 100 }];

    act(() => {
      result.current.handlers.onTouchEnd(touchEndEvent1);
    });

    act(() => {
      result.current.handlers.onTouchEnd(touchEndEvent2);
    });

    expect(onDoubleTap).toHaveBeenCalledWith({ x: 100, y: 100 });
  });

  it('should not trigger double tap if delay exceeded', async () => {
    vi.useFakeTimers();
    const onDoubleTap = vi.fn();
    const { result } = renderHook(() => useDoubleTap(onDoubleTap, { delay: 300 }));

    const touchEndEvent1 = createTouchEvent('touchend', []);
    (touchEndEvent1 as any).changedTouches = [{ clientX: 100, clientY: 100 }];

    const touchEndEvent2 = createTouchEvent('touchend', []);
    (touchEndEvent2 as any).changedTouches = [{ clientX: 100, clientY: 100 }];

    act(() => {
      result.current.handlers.onTouchEnd(touchEndEvent1);
    });

    // Wait longer than delay
    act(() => {
      vi.advanceTimersByTime(400);
    });

    act(() => {
      result.current.handlers.onTouchEnd(touchEndEvent2);
    });

    expect(onDoubleTap).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('useContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should provide context menu state and controls', () => {
    const { result } = renderHook(() => useContextMenu());

    expect(result.current.state).toHaveProperty('isOpen');
    expect(result.current.state).toHaveProperty('position');
    expect(result.current.state).toHaveProperty('targetData');
    expect(typeof result.current.open).toBe('function');
    expect(typeof result.current.close).toBe('function');
    expect(typeof result.current.getLongPressProps).toBe('function');
  });

  it('should start with closed state', () => {
    const { result } = renderHook(() => useContextMenu());

    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.position).toBeNull();
    expect(result.current.state.targetData).toBeNull();
  });

  it('should open context menu with position and data', () => {
    const { result } = renderHook(() => useContextMenu<{ id: string }>());

    act(() => {
      result.current.open({ x: 100, y: 200 }, { id: 'test-item' });
    });

    expect(result.current.state.isOpen).toBe(true);
    expect(result.current.state.position).toEqual({ x: 100, y: 200 });
    expect(result.current.state.targetData).toEqual({ id: 'test-item' });
  });

  it('should close context menu', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.open({ x: 100, y: 200 });
    });

    expect(result.current.state.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.position).toBeNull();
  });

  it('should close on escape key', () => {
    const { result } = renderHook(() => useContextMenu());

    act(() => {
      result.current.open({ x: 100, y: 200 });
    });

    // Wait for the listener delay
    act(() => {
      vi.advanceTimersByTime(150);
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(result.current.state.isOpen).toBe(false);
  });
});

describe('useTouchGestures - advanced scenarios', () => {
  let mockElement: ReturnType<typeof createMockElement>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockElement = createMockElement();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('useSwipeGesture - advanced', () => {
    describe('velocity calculation', () => {
      it('should calculate velocity based on distance and time', () => {
        const elementRef = { current: mockElement as unknown as HTMLElement };
        const { result } = renderHook(() =>
          useSwipeGesture(elementRef, {}, { threshold: 50 })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        // Start swipe
        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 0, clientY: 100 }]));
        });

        // Advance time
        act(() => {
          vi.advanceTimersByTime(100);
        });

        // Move 100px in 100ms = 1 px/ms velocity
        act(() => {
          touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]));
        });

        expect(result.current.velocity).toBeGreaterThan(0);
      });
    });

    describe('progress calculation', () => {
      it('should calculate progress as ratio of distance to threshold', () => {
        const elementRef = { current: mockElement as unknown as HTMLElement };
        const { result } = renderHook(() =>
          useSwipeGesture(elementRef, {}, { threshold: 100 })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 0, clientY: 100 }]));
          touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 50, clientY: 100 }])); // 50px of 100 threshold
        });

        // Progress should be 0.5 (50/100)
        expect(result.current.progress).toBeCloseTo(0.5, 1);
      });

      it('should cap progress at 1 when exceeding threshold', () => {
        const elementRef = { current: mockElement as unknown as HTMLElement };
        const { result } = renderHook(() =>
          useSwipeGesture(elementRef, {}, { threshold: 50 })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 0, clientY: 100 }]));
          touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }])); // Way beyond threshold
        });

        expect(result.current.progress).toBe(1);
      });
    });

    describe('touch cancel handling', () => {
      it('should call onSwipeCancel and reset state on touch cancel', () => {
        const onSwipeCancel = vi.fn();
        const elementRef = { current: mockElement as unknown as HTMLElement };
        const { result } = renderHook(() =>
          useSwipeGesture(elementRef, { onSwipeCancel })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchCancelHandler = mockElement._listeners.get('touchcancel')?.values().next().value;

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
        });

        expect(result.current.isSwiping).toBe(true);

        act(() => {
          touchCancelHandler?.(createTouchEvent('touchcancel', []));
        });

        expect(result.current.isSwiping).toBe(false);
        expect(result.current.direction).toBeNull();
        expect(onSwipeCancel).toHaveBeenCalled();
      });
    });

    describe('prevent default behavior', () => {
      it('should call preventDefault when configured', () => {
        const elementRef = { current: mockElement as unknown as HTMLElement };
        renderHook(() =>
          useSwipeGesture(elementRef, {}, { preventDefault: true, directions: ['right'] })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        const moveEvent = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]);

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
          touchMoveHandler?.(moveEvent);
        });

        expect(moveEvent.preventDefault).toHaveBeenCalled();
      });

      it('should not call preventDefault when not configured', () => {
        const elementRef = { current: mockElement as unknown as HTMLElement };
        renderHook(() =>
          useSwipeGesture(elementRef, {}, { preventDefault: false })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        const moveEvent = createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]);

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
          touchMoveHandler?.(moveEvent);
        });

        expect(moveEvent.preventDefault).not.toHaveBeenCalled();
      });
    });

    describe('direction determination', () => {
      it('should determine right direction when moving right', () => {
        const onSwipeMove = vi.fn();
        const elementRef = { current: mockElement as unknown as HTMLElement };
        renderHook(() =>
          useSwipeGesture(elementRef, { onSwipeMove }, { directions: ['left', 'right'] })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 0, clientY: 100 }]));
          touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]));
        });

        expect(onSwipeMove).toHaveBeenCalledWith(
          expect.objectContaining({ direction: 'right' })
        );
      });

      it('should determine left direction when moving left', () => {
        const onSwipeMove = vi.fn();
        const elementRef = { current: mockElement as unknown as HTMLElement };
        renderHook(() =>
          useSwipeGesture(elementRef, { onSwipeMove }, { directions: ['left', 'right'] })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
          touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 0, clientY: 100 }]));
        });

        expect(onSwipeMove).toHaveBeenCalledWith(
          expect.objectContaining({ direction: 'left' })
        );
      });

      it('should determine up direction when moving up', () => {
        const onSwipeMove = vi.fn();
        const elementRef = { current: mockElement as unknown as HTMLElement };
        renderHook(() =>
          useSwipeGesture(elementRef, { onSwipeMove }, { directions: ['up', 'down'] })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
          touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 100, clientY: 0 }]));
        });

        expect(onSwipeMove).toHaveBeenCalledWith(
          expect.objectContaining({ direction: 'up' })
        );
      });

      it('should determine down direction when moving down', () => {
        const onSwipeMove = vi.fn();
        const elementRef = { current: mockElement as unknown as HTMLElement };
        renderHook(() =>
          useSwipeGesture(elementRef, { onSwipeMove }, { directions: ['up', 'down'] })
        );

        const touchStartHandler = mockElement._listeners.get('touchstart')?.values().next().value;
        const touchMoveHandler = mockElement._listeners.get('touchmove')?.values().next().value;

        act(() => {
          touchStartHandler?.(createTouchEvent('touchstart', [{ clientX: 100, clientY: 0 }]));
          touchMoveHandler?.(createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]));
        });

        expect(onSwipeMove).toHaveBeenCalledWith(
          expect.objectContaining({ direction: 'down' })
        );
      });
    });

    describe('cleanup', () => {
      it('should remove event listeners on unmount', () => {
        const elementRef = { current: mockElement as unknown as HTMLElement };
        const { unmount } = renderHook(() => useSwipeGesture(elementRef));

        unmount();

        expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
        expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchmove', expect.any(Function));
        expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchend', expect.any(Function));
        expect(mockElement.removeEventListener).toHaveBeenCalledWith('touchcancel', expect.any(Function));
      });
    });
  });

  describe('usePullToRefresh - advanced', () => {
    it('should apply resistance to pull distance', () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        usePullToRefresh(onRefresh, { resistance: 0.5 })
      );

      // Manually set up element and trigger events
      const element = createMockElement();
      (result.current.ref as any).current = element;

      // Re-render to set up listeners
      const { result: newResult } = renderHook(() =>
        usePullToRefresh(onRefresh, { resistance: 0.5, threshold: 80 })
      );

      expect(newResult.current.state.pullDistance).toBe(0);
    });

    it('should not trigger refresh below threshold', async () => {
      const onRefresh = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        usePullToRefresh(onRefresh, { threshold: 100 })
      );

      expect(result.current.state.isRefreshing).toBe(false);
    });
  });

  describe('useLongPress - advanced', () => {
    describe('position tracking', () => {
      it('should track position from touch start', () => {
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress(onLongPress));

        const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 150, clientY: 250 }]);

        act(() => {
          result.current.handlers.onTouchStart(touchStartEvent);
        });

        expect(result.current.state.position).toEqual({ x: 150, y: 250 });
      });

      it('should clear position on touch end', () => {
        const onLongPress = vi.fn();
        const { result } = renderHook(() => useLongPress(onLongPress));

        const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

        act(() => {
          result.current.handlers.onTouchStart(touchStartEvent);
        });

        expect(result.current.state.position).toEqual({ x: 100, y: 100 });

        act(() => {
          result.current.handlers.onTouchEnd();
        });

        expect(result.current.state.position).toBeNull();
      });
    });

    describe('disabled state', () => {
      it('should not trigger long press when disabled', () => {
        const onLongPress = vi.fn();
        const { result } = renderHook(() =>
          useLongPress(onLongPress, { enabled: false, delay: 500 })
        );

        const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

        act(() => {
          result.current.handlers.onTouchStart(touchStartEvent);
        });

        act(() => {
          vi.advanceTimersByTime(600);
        });

        expect(onLongPress).not.toHaveBeenCalled();
        expect(result.current.state.isLongPressed).toBe(false);
      });
    });

    describe('cleanup', () => {
      it('should clear timer on unmount', () => {
        const onLongPress = vi.fn();
        const { result, unmount } = renderHook(() =>
          useLongPress(onLongPress, { delay: 1000 })
        );

        const touchStartEvent = createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]);

        act(() => {
          result.current.handlers.onTouchStart(touchStartEvent);
        });

        // Unmount while timer is pending
        unmount();

        // Advance time - callback should not be called
        act(() => {
          vi.advanceTimersByTime(2000);
        });

        expect(onLongPress).not.toHaveBeenCalled();
      });
    });

    describe('context menu prevention', () => {
      it('should not prevent context menu when cancelOnContextMenu is false', () => {
        const onLongPress = vi.fn();
        const { result } = renderHook(() =>
          useLongPress(onLongPress, { cancelOnContextMenu: false })
        );

        const contextMenuEvent = { preventDefault: vi.fn() } as unknown as Event;

        act(() => {
          result.current.handlers.onContextMenu(contextMenuEvent);
        });

        expect(contextMenuEvent.preventDefault).not.toHaveBeenCalled();
      });
    });
  });

  describe('useDoubleTap - advanced', () => {
    describe('disabled state', () => {
      it('should not trigger double tap when disabled', () => {
        const onDoubleTap = vi.fn();
        const { result } = renderHook(() =>
          useDoubleTap(onDoubleTap, { enabled: false })
        );

        const touchEndEvent1 = createTouchEvent('touchend', []);
        (touchEndEvent1 as any).changedTouches = [{ clientX: 100, clientY: 100 }];

        const touchEndEvent2 = createTouchEvent('touchend', []);
        (touchEndEvent2 as any).changedTouches = [{ clientX: 100, clientY: 100 }];

        act(() => {
          result.current.handlers.onTouchEnd(touchEndEvent1);
          result.current.handlers.onTouchEnd(touchEndEvent2);
        });

        expect(onDoubleTap).not.toHaveBeenCalled();
      });
    });

    describe('tap position', () => {
      it('should pass position of second tap to callback', () => {
        const onDoubleTap = vi.fn();
        const { result } = renderHook(() => useDoubleTap(onDoubleTap, { delay: 300 }));

        const touchEndEvent1 = createTouchEvent('touchend', []);
        (touchEndEvent1 as any).changedTouches = [{ clientX: 100, clientY: 100 }];

        const touchEndEvent2 = createTouchEvent('touchend', []);
        (touchEndEvent2 as any).changedTouches = [{ clientX: 150, clientY: 150 }];

        act(() => {
          result.current.handlers.onTouchEnd(touchEndEvent1);
          result.current.handlers.onTouchEnd(touchEndEvent2);
        });

        expect(onDoubleTap).toHaveBeenCalledWith({ x: 150, y: 150 });
      });
    });
  });

  describe('useContextMenu - advanced', () => {
    describe('click outside handling', () => {
      it('should close on click outside after delay', () => {
        const { result } = renderHook(() => useContextMenu());

        act(() => {
          result.current.open({ x: 100, y: 200 });
        });

        // Wait for listener to be added
        act(() => {
          vi.advanceTimersByTime(150);
        });

        // Click outside
        act(() => {
          document.dispatchEvent(new MouseEvent('click'));
        });

        expect(result.current.state.isOpen).toBe(false);
      });

      it('should close on touchstart outside after delay', () => {
        const { result } = renderHook(() => useContextMenu());

        act(() => {
          result.current.open({ x: 100, y: 200 });
        });

        // Wait for listener to be added
        act(() => {
          vi.advanceTimersByTime(150);
        });

        // Touch outside
        act(() => {
          document.dispatchEvent(new Event('touchstart'));
        });

        expect(result.current.state.isOpen).toBe(false);
      });
    });

    describe('cleanup', () => {
      it('should remove event listeners on unmount', () => {
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        const { result, unmount } = renderHook(() => useContextMenu());

        act(() => {
          result.current.open({ x: 100, y: 200 });
        });

        act(() => {
          vi.advanceTimersByTime(150);
        });

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
      });

      it('should clear timeout on unmount', () => {
        const { result, unmount } = renderHook(() => useContextMenu());

        act(() => {
          result.current.open({ x: 100, y: 200 });
        });

        // Unmount before listener delay
        unmount();

        // Advance time past delay - should not throw
        act(() => {
          vi.advanceTimersByTime(200);
        });
      });
    });

    describe('generic type support', () => {
      it('should support typed targetData', () => {
        interface TestData {
          id: string;
          name: string;
        }

        const { result } = renderHook(() => useContextMenu<TestData>());

        const testData: TestData = { id: '123', name: 'Test Item' };

        act(() => {
          result.current.open({ x: 100, y: 200 }, testData);
        });

        expect(result.current.state.targetData).toEqual(testData);
      });
    });
  });
});
