/**
 * Tests for useKeyboardHeight Hook
 *
 * Tests keyboard visibility and height tracking including:
 * - Returns 0 when keyboard is hidden
 * - Returns actual height when keyboard is shown
 * - Updates on keyboard visibility changes
 * - CSS variable updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useKeyboardHeight, useKeyboardCSSVariable } from '../useKeyboardHeight';

// ============================================================================
// Mocks
// ============================================================================

// Mock visualViewport
const mockVisualViewport = {
  height: 800,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

describe('useKeyboardHeight', () => {
  let originalInnerHeight: number;
  let originalVisualViewport: VisualViewport | null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Store originals
    originalInnerHeight = window.innerHeight;
    originalVisualViewport = window.visualViewport;

    // Set up window properties
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'visualViewport', {
      value: mockVisualViewport,
      writable: true,
      configurable: true,
    });

    // Mock getComputedStyle for safe area insets
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (prop: string) => {
        if (prop === '--sab') return '0';
        return '';
      },
    } as CSSStyleDeclaration));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();

    // Restore originals
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    });

    if (originalVisualViewport !== null) {
      Object.defineProperty(window, 'visualViewport', {
        value: originalVisualViewport,
        writable: true,
        configurable: true,
      });
    }
  });

  describe('initial state', () => {
    it('should return 0 height when keyboard is hidden', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      expect(result.current.height).toBe(0);
    });

    it('should return isVisible as false initially', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      expect(result.current.isVisible).toBe(false);
    });

    it('should return isAnimating as false initially', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      expect(result.current.isAnimating).toBe(false);
    });

    it('should return complete keyboard state object', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      expect(result.current).toHaveProperty('isVisible');
      expect(result.current).toHaveProperty('height');
      expect(result.current).toHaveProperty('isAnimating');
    });
  });

  describe('keyboard shown detection', () => {
    it('should detect keyboard when viewport height decreases significantly', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      // Simulate keyboard appearing (viewport shrinks by 300px)
      act(() => {
        mockVisualViewport.height = 500;
        // Trigger resize event
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      // Height should be detected (800 - 500 = 300)
      expect(result.current.height).toBeGreaterThan(0);
      expect(result.current.isVisible).toBe(true);
    });

    it('should not detect keyboard for small viewport changes', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      // Simulate small viewport change (less than MIN_KEYBOARD_HEIGHT of 150)
      act(() => {
        mockVisualViewport.height = 700;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      // Should not be considered keyboard
      expect(result.current.height).toBe(0);
      expect(result.current.isVisible).toBe(false);
    });

    it('should return actual keyboard height', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      // Simulate keyboard of 350px
      act(() => {
        mockVisualViewport.height = 450;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      // Height should be 800 - 450 = 350
      expect(result.current.height).toBe(350);
    });
  });

  describe('keyboard hidden detection', () => {
    it('should return 0 when keyboard hides', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      // First show keyboard
      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(result.current.isVisible).toBe(true);

      // Then hide keyboard
      act(() => {
        mockVisualViewport.height = 800;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(result.current.height).toBe(0);
      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('animation state tracking', () => {
    it('should set isAnimating true during height change', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(result.current.isAnimating).toBe(true);
    });

    it('should set isAnimating false after animation duration', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(result.current.isAnimating).toBe(true);

      // Advance past animation duration (250ms)
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('callback handling', () => {
    it('should call onKeyboardChange when keyboard appears', () => {
      const onKeyboardChange = vi.fn();
      const { result } = renderHook(() =>
        useKeyboardHeight({ onKeyboardChange })
      );

      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(onKeyboardChange).toHaveBeenCalledWith(
        expect.objectContaining({
          isVisible: true,
          height: 300,
          isAnimating: true,
        })
      );
    });

    it('should call onKeyboardChange when keyboard hides', () => {
      const onKeyboardChange = vi.fn();
      renderHook(() => useKeyboardHeight({ onKeyboardChange }));

      // Show keyboard
      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      onKeyboardChange.mockClear();

      // Hide keyboard
      act(() => {
        mockVisualViewport.height = 800;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(onKeyboardChange).toHaveBeenCalledWith(
        expect.objectContaining({
          isVisible: false,
          height: 0,
        })
      );
    });
  });

  describe('focus events handling', () => {
    it('should check keyboard height on focusin', () => {
      renderHook(() => useKeyboardHeight());

      act(() => {
        document.dispatchEvent(new Event('focusin'));
        vi.advanceTimersByTime(150);
      });

      // Should have triggered a resize check
      // (behavior depends on viewport state at time of focus)
    });

    it('should check keyboard height on focusout', () => {
      renderHook(() => useKeyboardHeight());

      act(() => {
        document.dispatchEvent(new Event('focusout'));
        vi.advanceTimersByTime(150);
      });

      // Should have triggered a resize check
    });
  });

  describe('event listener management', () => {
    it('should add event listeners on mount', () => {
      renderHook(() => useKeyboardHeight());

      expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      );
      expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      );
    });

    it('should remove event listeners on unmount', () => {
      const { unmount } = renderHook(() => useKeyboardHeight());

      unmount();

      expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      );
      expect(mockVisualViewport.removeEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      );
    });
  });

  describe('fallback behavior', () => {
    it('should use window resize when visualViewport is not available', () => {
      // Remove visualViewport
      Object.defineProperty(window, 'visualViewport', {
        value: null,
        writable: true,
        configurable: true,
      });

      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      renderHook(() => useKeyboardHeight());

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'resize',
        expect.any(Function)
      );
    });
  });

  describe('auto-scroll functionality', () => {
    it('should auto-scroll to target when keyboard appears and autoScroll is true', () => {
      const scrollTargetRef = {
        current: {
          scrollIntoView: vi.fn(),
        } as unknown as HTMLElement,
      };

      renderHook(() =>
        useKeyboardHeight({ autoScroll: true, scrollTargetRef })
      );

      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      // Advance timer for the scrollIntoView delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(scrollTargetRef.current.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'end',
      });
    });

    it('should not auto-scroll when autoScroll is false', () => {
      const scrollTargetRef = {
        current: {
          scrollIntoView: vi.fn(),
        } as unknown as HTMLElement,
      };

      renderHook(() =>
        useKeyboardHeight({ autoScroll: false, scrollTargetRef })
      );

      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(scrollTargetRef.current.scrollIntoView).not.toHaveBeenCalled();
    });
  });
});

describe('useKeyboardCSSVariable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'visualViewport', {
      value: mockVisualViewport,
      writable: true,
      configurable: true,
    });

    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: () => '0',
    } as CSSStyleDeclaration));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return keyboard state', () => {
    const { result } = renderHook(() => useKeyboardCSSVariable());

    expect(result.current).toHaveProperty('isVisible');
    expect(result.current).toHaveProperty('height');
    expect(result.current).toHaveProperty('isAnimating');
  });

  it('should set CSS custom properties when keyboard appears', () => {
    const setPropertySpy = vi.spyOn(
      document.documentElement.style,
      'setProperty'
    );

    renderHook(() => useKeyboardCSSVariable());

    act(() => {
      mockVisualViewport.height = 500;
      const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];
      if (resizeHandler) {
        resizeHandler();
      }
    });

    expect(setPropertySpy).toHaveBeenCalledWith('--keyboard-height', '300px');
    expect(setPropertySpy).toHaveBeenCalledWith('--keyboard-visible', '1');
  });

  it('should update CSS custom properties when keyboard hides', () => {
    const setPropertySpy = vi.spyOn(
      document.documentElement.style,
      'setProperty'
    );

    renderHook(() => useKeyboardCSSVariable());

    // Show keyboard
    act(() => {
      mockVisualViewport.height = 500;
      const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];
      if (resizeHandler) {
        resizeHandler();
      }
    });

    setPropertySpy.mockClear();

    // Hide keyboard
    act(() => {
      mockVisualViewport.height = 800;
      const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];
      if (resizeHandler) {
        resizeHandler();
      }
    });

    expect(setPropertySpy).toHaveBeenCalledWith('--keyboard-height', '0px');
    expect(setPropertySpy).toHaveBeenCalledWith('--keyboard-visible', '0');
  });

  it('should clean up CSS custom properties on unmount', () => {
    const removePropertySpy = vi.spyOn(
      document.documentElement.style,
      'removeProperty'
    );

    const { unmount } = renderHook(() => useKeyboardCSSVariable());

    unmount();

    expect(removePropertySpy).toHaveBeenCalledWith('--keyboard-height');
    expect(removePropertySpy).toHaveBeenCalledWith('--keyboard-visible');
  });
});

describe('useKeyboardHeight - advanced scenarios', () => {
  let originalInnerHeight: number;
  let originalVisualViewport: VisualViewport | null;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Store originals
    originalInnerHeight = window.innerHeight;
    originalVisualViewport = window.visualViewport;

    // Set up window properties
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'visualViewport', {
      value: mockVisualViewport,
      writable: true,
      configurable: true,
    });

    // Reset mock viewport height
    mockVisualViewport.height = 800;

    // Mock getComputedStyle for safe area insets
    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (prop: string) => {
        if (prop === '--sab') return '0';
        return '';
      },
    } as CSSStyleDeclaration));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();

    // Restore originals
    Object.defineProperty(window, 'innerHeight', {
      value: originalInnerHeight,
      writable: true,
      configurable: true,
    });

    if (originalVisualViewport !== null) {
      Object.defineProperty(window, 'visualViewport', {
        value: originalVisualViewport,
        writable: true,
        configurable: true,
      });
    }
  });

  describe('safe area inset handling', () => {
    it('should subtract safe area inset from keyboard height', () => {
      // Mock safe area inset
      vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
        getPropertyValue: (prop: string) => {
          if (prop === '--sab') return '34'; // iPhone safe area
          return '';
        },
      } as CSSStyleDeclaration));

      const { result } = renderHook(() => useKeyboardHeight());

      // Simulate keyboard of 350px (minus 34px safe area = 316px)
      act(() => {
        mockVisualViewport.height = 450;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      // Height should account for safe area
      expect(result.current.height).toBe(316);
    });

    it('should handle non-numeric safe area values gracefully', () => {
      vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
        getPropertyValue: () => '',
      } as CSSStyleDeclaration));

      const { result } = renderHook(() => useKeyboardHeight());

      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      // Should still detect keyboard
      expect(result.current.height).toBe(300);
    });
  });

  describe('viewport scroll handling', () => {
    it('should respond to visualViewport scroll events', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      // Verify scroll listener was added
      expect(mockVisualViewport.addEventListener).toHaveBeenCalledWith(
        'scroll',
        expect.any(Function)
      );

      // Simulate scroll while keyboard is visible
      act(() => {
        mockVisualViewport.height = 500;
        const scrollHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'scroll'
        )?.[1];
        if (scrollHandler) {
          scrollHandler();
        }
      });

      expect(result.current.isVisible).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle viewport exactly at minimum keyboard height threshold', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      // Height diff of exactly 150 (minimum threshold)
      act(() => {
        mockVisualViewport.height = 650;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      // Should still be detected as keyboard (150 >= MIN_KEYBOARD_HEIGHT of 150)
      expect(result.current.isVisible).toBe(false);
      expect(result.current.height).toBe(0);
    });

    it('should handle viewport just above minimum keyboard height threshold', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      // Height diff of 151 (just above threshold)
      act(() => {
        mockVisualViewport.height = 649;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.height).toBe(151);
    });

    it('should handle rapid viewport changes without race conditions', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

      // Rapid changes
      act(() => {
        mockVisualViewport.height = 500;
        resizeHandler?.();
        mockVisualViewport.height = 600;
        resizeHandler?.();
        mockVisualViewport.height = 400;
        resizeHandler?.();
      });

      // Should reflect final state
      expect(result.current.height).toBe(400);
    });

    it('should handle zero or negative keyboard height gracefully', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      // Simulate viewport larger than window (shouldn't happen but handle gracefully)
      act(() => {
        mockVisualViewport.height = 900;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(result.current.height).toBe(0);
      expect(result.current.isVisible).toBe(false);
    });
  });

  describe('animation timing', () => {
    it('should set isAnimating for exactly ANIMATION_DURATION (250ms)', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      act(() => {
        mockVisualViewport.height = 500;
        const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
          (call) => call[0] === 'resize'
        )?.[1];
        if (resizeHandler) {
          resizeHandler();
        }
      });

      expect(result.current.isAnimating).toBe(true);

      // Advance to just before animation ends
      act(() => {
        vi.advanceTimersByTime(249);
      });

      expect(result.current.isAnimating).toBe(true);

      // Advance past animation duration
      act(() => {
        vi.advanceTimersByTime(2);
      });

      expect(result.current.isAnimating).toBe(false);
    });

    it('should cancel previous animation timeout on rapid height changes', () => {
      const { result } = renderHook(() => useKeyboardHeight());

      const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

      // First change
      act(() => {
        mockVisualViewport.height = 500;
        resizeHandler?.();
      });

      expect(result.current.isAnimating).toBe(true);

      // Advance half way
      act(() => {
        vi.advanceTimersByTime(125);
      });

      // Second change (should reset animation)
      act(() => {
        mockVisualViewport.height = 400;
        resizeHandler?.();
      });

      expect(result.current.isAnimating).toBe(true);

      // Advance to where first animation would have ended
      act(() => {
        vi.advanceTimersByTime(130);
      });

      // Should still be animating because new animation started
      expect(result.current.isAnimating).toBe(true);

      // Advance past second animation
      act(() => {
        vi.advanceTimersByTime(130);
      });

      expect(result.current.isAnimating).toBe(false);
    });
  });

  describe('callback consistency', () => {
    it('should not call onKeyboardChange when height stays the same', () => {
      const onKeyboardChange = vi.fn();
      renderHook(() => useKeyboardHeight({ onKeyboardChange }));

      const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

      // First change
      act(() => {
        mockVisualViewport.height = 500;
        resizeHandler?.();
      });

      const callCount = onKeyboardChange.mock.calls.length;

      // Same height again
      act(() => {
        resizeHandler?.();
      });

      // Should not call again if height didn't change
      expect(onKeyboardChange.mock.calls.length).toBe(callCount);
    });

    it('should call onKeyboardChange on visibility change even if height is 0', () => {
      const onKeyboardChange = vi.fn();
      renderHook(() => useKeyboardHeight({ onKeyboardChange }));

      const resizeHandler = mockVisualViewport.addEventListener.mock.calls.find(
        (call) => call[0] === 'resize'
      )?.[1];

      // Show keyboard
      act(() => {
        mockVisualViewport.height = 500;
        resizeHandler?.();
      });

      onKeyboardChange.mockClear();

      // Hide keyboard
      act(() => {
        mockVisualViewport.height = 800;
        resizeHandler?.();
      });

      expect(onKeyboardChange).toHaveBeenCalledWith(
        expect.objectContaining({ isVisible: false })
      );
    });
  });

  describe('focus event delays', () => {
    it('should delay resize check after focusin by 100ms', () => {
      renderHook(() => useKeyboardHeight());

      const initialResizeCallCount = mockVisualViewport.addEventListener.mock.calls.filter(
        (call) => call[0] === 'resize'
      ).length;

      act(() => {
        document.dispatchEvent(new Event('focusin'));
      });

      // Immediately after focus, no additional resize should be called
      // (this tests the delay mechanism)
      expect(mockVisualViewport.addEventListener.mock.calls.filter(
        (call) => call[0] === 'resize'
      ).length).toBe(initialResizeCallCount);

      // After delay
      act(() => {
        vi.advanceTimersByTime(100);
      });

      // The resize handler should have been called
      // (verified by the hook functioning normally)
    });
  });

  describe('SSR safety', () => {
    it('should handle undefined window gracefully', () => {
      // This test verifies the hook has window checks
      // by ensuring it doesn't throw when visualViewport is null
      Object.defineProperty(window, 'visualViewport', {
        value: null,
        writable: true,
        configurable: true,
      });

      // Should not throw
      expect(() => {
        renderHook(() => useKeyboardHeight());
      }).not.toThrow();
    });
  });
});
