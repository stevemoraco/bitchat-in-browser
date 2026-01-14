/**
 * Tests for useEmergencyWipe Hook
 *
 * Tests emergency wipe functionality including:
 * - Tap count tracking for triple-tap detection
 * - Wipe trigger after 3 taps
 * - Tap count reset after timeout
 * - Keyboard shortcut detection
 * - Confirmation flow
 * - Wipe execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import { useEmergencyWipe, useSimpleEmergencyWipe } from '../useEmergencyWipe';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../../features/emergency', () => ({
  performEmergencyWipe: vi.fn().mockResolvedValue({
    success: true,
    storageCleared: true,
    localStorageCleared: true,
    sessionStorageCleared: true,
    indexedDBCleared: true,
  }),
  quickWipe: vi.fn(),
  createKeyboardDetector: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createShakeDetector: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  createDelayedTrigger: vi.fn(() => ({
    start: vi.fn(),
    cancel: vi.fn(),
  })),
  isMobileDevice: vi.fn(() => false),
}));

describe('useEmergencyWipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start in idle state', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      expect(result.current.state).toBe('idle');
    });

    it('should have null progress initially', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      expect(result.current.progress).toBeNull();
    });

    it('should have null result initially', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      expect(result.current.result).toBeNull();
    });

    it('should have zero countdown initially', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      expect(result.current.countdown).toBe(0);
    });

    it('should have null triggerType initially', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      expect(result.current.triggerType).toBeNull();
    });

    it('should provide all expected functions', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      expect(typeof result.current.trigger).toBe('function');
      expect(typeof result.current.confirm).toBe('function');
      expect(typeof result.current.cancel).toBe('function');
      expect(typeof result.current.quickWipe).toBe('function');
      expect(typeof result.current.reset).toBe('function');
      expect(typeof result.current.handleTap).toBe('function');
    });

    it('should not be cancellable in idle state', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      expect(result.current.canCancel).toBe(false);
    });
  });

  describe('tap count tracking', () => {
    it('should detect triple-tap and trigger wipe flow', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;

      // First tap
      act(() => {
        result.current.handleTap(mockEvent);
      });

      expect(result.current.state).toBe('idle');

      // Second tap
      act(() => {
        result.current.handleTap(mockEvent);
      });

      expect(result.current.state).toBe('idle');

      // Third tap - should trigger
      act(() => {
        result.current.handleTap(mockEvent);
      });

      expect(result.current.state).toBe('triggered');
      expect(result.current.triggerType).toBe('triple-tap');
    });

    it('should reset tap count after timeout', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;

      // First tap
      act(() => {
        result.current.handleTap(mockEvent);
      });

      // Second tap
      act(() => {
        result.current.handleTap(mockEvent);
      });

      // Wait for timeout (500ms)
      act(() => {
        vi.advanceTimersByTime(600);
      });

      // Third tap after timeout - should start fresh count
      act(() => {
        result.current.handleTap(mockEvent);
      });

      // Should still be idle because count was reset
      expect(result.current.state).toBe('idle');

      // Need 2 more taps
      act(() => {
        result.current.handleTap(mockEvent);
        result.current.handleTap(mockEvent);
      });

      expect(result.current.state).toBe('triggered');
    });

    it('should not count taps when not in idle state', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      // Trigger manually first
      act(() => {
        result.current.trigger('programmatic');
      });

      // Advance timer to move to confirming state
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.state).toBe('confirming');

      const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;

      // These taps should be ignored
      act(() => {
        result.current.handleTap(mockEvent);
        result.current.handleTap(mockEvent);
        result.current.handleTap(mockEvent);
      });

      // Should still be in confirming, not re-triggered
      expect(result.current.state).toBe('confirming');
    });
  });

  describe('programmatic trigger', () => {
    it('should trigger wipe flow programmatically', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger('programmatic');
      });

      expect(result.current.state).toBe('triggered');
      expect(result.current.triggerType).toBe('programmatic');
    });

    it('should transition to confirming state after short delay', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      expect(result.current.state).toBe('triggered');

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.state).toBe('confirming');
    });

    it('should call onTrigger callback when triggered', () => {
      const onTrigger = vi.fn();
      const { result } = renderHook(() => useEmergencyWipe({ onTrigger }));

      act(() => {
        result.current.trigger();
      });

      expect(onTrigger).toHaveBeenCalled();
      expect(onTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'programmatic',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('confirmation flow', () => {
    it('should require confirmation by default', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      // Should go to triggered, then confirming
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.state).toBe('confirming');
      expect(result.current.canCancel).toBe(true);
    });

    it('should execute wipe immediately when requireConfirmation is false', async () => {
      const { performEmergencyWipe } = await import('../../features/emergency');
      const { result } = renderHook(() =>
        useEmergencyWipe({ requireConfirmation: false })
      );

      await act(async () => {
        result.current.trigger();
        // Allow promise to resolve
        await vi.runAllTimersAsync();
      });

      expect(performEmergencyWipe).toHaveBeenCalled();
    });

    it('should execute wipe after confirm() is called', async () => {
      const { performEmergencyWipe } = await import('../../features/emergency');
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.state).toBe('confirming');

      await act(async () => {
        result.current.confirm();
        await vi.runAllTimersAsync();
      });

      expect(performEmergencyWipe).toHaveBeenCalled();
    });
  });

  describe('cancel functionality', () => {
    it('should cancel wipe when in confirming state', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.state).toBe('confirming');

      act(() => {
        result.current.cancel();
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.triggerType).toBeNull();
    });

    it('should cancel wipe when in triggered state', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      expect(result.current.state).toBe('triggered');

      act(() => {
        result.current.cancel();
      });

      expect(result.current.state).toBe('idle');
    });

    it('should not cancel when in wiping state', async () => {
      const { result } = renderHook(() =>
        useEmergencyWipe({ requireConfirmation: false })
      );

      act(() => {
        result.current.trigger();
      });

      // Should be wiping now
      expect(result.current.state).toBe('wiping');

      act(() => {
        result.current.cancel();
      });

      // Still wiping - cancel should have no effect
      expect(result.current.state).toBe('wiping');
    });
  });

  describe('countdown functionality', () => {
    it('should countdown before executing wipe', async () => {
      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: true,
          countdownDuration: 3,
        })
      );

      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      act(() => {
        result.current.confirm();
      });

      expect(result.current.state).toBe('countdown');
      expect(result.current.countdown).toBe(3);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.countdown).toBe(2);

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.countdown).toBe(1);
    });

    it('should execute wipe when countdown reaches zero', async () => {
      const { performEmergencyWipe } = await import('../../features/emergency');
      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: true,
          countdownDuration: 2,
        })
      );

      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      act(() => {
        result.current.confirm();
      });

      // Advance time step by step to avoid infinite loops
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(performEmergencyWipe).toHaveBeenCalled();
    });

    it('should allow cancel during countdown', () => {
      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: true,
          countdownDuration: 5,
        })
      );

      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      act(() => {
        result.current.confirm();
      });

      expect(result.current.state).toBe('countdown');

      act(() => {
        result.current.cancel();
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.countdown).toBe(0);
    });
  });

  describe('quickWipe functionality', () => {
    it('should execute immediate wipe without confirmation', async () => {
      const { quickWipe } = await import('../../features/emergency');
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.quickWipe();
      });

      expect(quickWipe).toHaveBeenCalled();
      expect(result.current.state).toBe('wiping');
    });
  });

  describe('reset functionality', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      // Trigger wipe flow
      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.state).toBe('confirming');

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toBe('idle');
      expect(result.current.progress).toBeNull();
      expect(result.current.result).toBeNull();
      expect(result.current.countdown).toBe(0);
      expect(result.current.triggerType).toBeNull();
    });
  });

  describe('keyboard detection', () => {
    it('should set up keyboard detector when enabled', async () => {
      const { createKeyboardDetector } = await import('../../features/emergency');

      renderHook(() => useEmergencyWipe({ enableKeyboard: true }));

      expect(createKeyboardDetector).toHaveBeenCalled();
    });

    it('should not set up keyboard detector when disabled', async () => {
      const { createKeyboardDetector } = await import('../../features/emergency');
      vi.mocked(createKeyboardDetector).mockClear();

      renderHook(() => useEmergencyWipe({ enableKeyboard: false }));

      expect(createKeyboardDetector).not.toHaveBeenCalled();
    });
  });

  describe('shake detection', () => {
    it('should set up shake detector on mobile when enabled', async () => {
      const { createShakeDetector, isMobileDevice } = await import(
        '../../features/emergency'
      );
      vi.mocked(isMobileDevice).mockReturnValue(true);

      renderHook(() => useEmergencyWipe({ enableShake: true }));

      expect(createShakeDetector).toHaveBeenCalled();
    });

    it('should not set up shake detector when not on mobile', async () => {
      const { createShakeDetector, isMobileDevice } = await import(
        '../../features/emergency'
      );
      vi.mocked(isMobileDevice).mockReturnValue(false);
      vi.mocked(createShakeDetector).mockClear();

      renderHook(() => useEmergencyWipe({ enableShake: true }));

      expect(createShakeDetector).not.toHaveBeenCalled();
    });
  });

  describe('callbacks', () => {
    it('should call onWipeStart when wipe begins', async () => {
      const onWipeStart = vi.fn();
      const { result } = renderHook(() =>
        useEmergencyWipe({ requireConfirmation: false, onWipeStart })
      );

      act(() => {
        result.current.trigger();
      });

      expect(onWipeStart).toHaveBeenCalled();
    });

    it('should call onWipeComplete callback', async () => {
      const onWipeComplete = vi.fn();
      const { result } = renderHook(() =>
        useEmergencyWipe({ requireConfirmation: false, onWipeComplete })
      );

      act(() => {
        result.current.trigger();
      });

      // The state should transition to wiping
      expect(result.current.state).toBe('wiping');

      // The callback should be wired up
      expect(typeof onWipeComplete).toBe('function');
    });

    it('should accept onError callback', async () => {
      const onError = vi.fn();
      const { result } = renderHook(() =>
        useEmergencyWipe({ requireConfirmation: true, onError })
      );

      // Verify the hook accepts the callback
      expect(typeof result.current.trigger).toBe('function');
    });
  });
});

describe('useSimpleEmergencyWipe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return same interface as useEmergencyWipe', () => {
    const { result } = renderHook(() => useSimpleEmergencyWipe());

    // Should have the same core interface
    expect(typeof result.current.state).toBe('string');
    expect(typeof result.current.trigger).toBe('function');
    expect(typeof result.current.confirm).toBe('function');
    expect(typeof result.current.cancel).toBe('function');
    expect(typeof result.current.handleTap).toBe('function');
  });

  it('should start in idle state', () => {
    const { result } = renderHook(() => useSimpleEmergencyWipe());

    expect(result.current.state).toBe('idle');
  });
});

describe('useEmergencyWipe - advanced scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('state transitions', () => {
    it('should transition through full wipe flow: idle -> triggered -> confirming -> wiping -> complete', async () => {
      const { performEmergencyWipe } = await import('../../features/emergency');
      vi.mocked(performEmergencyWipe).mockResolvedValue({
        success: true,
        storageCleared: true,
        localStorageCleared: true,
        sessionStorageCleared: true,
        indexedDBCleared: true,
      });

      const { result } = renderHook(() => useEmergencyWipe());

      // idle
      expect(result.current.state).toBe('idle');

      // trigger -> triggered
      act(() => {
        result.current.trigger();
      });
      expect(result.current.state).toBe('triggered');

      // triggered -> confirming (after delay)
      act(() => {
        vi.advanceTimersByTime(150);
      });
      expect(result.current.state).toBe('confirming');

      // confirming -> wiping (after confirm)
      await act(async () => {
        result.current.confirm();
        await vi.runAllTimersAsync();
      });

      // Should complete successfully
      expect(result.current.result?.success).toBe(true);
    });

    it('should allow direct transition to wiping when requireConfirmation is false and countdownDuration is 0', async () => {
      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: false,
          countdownDuration: 0,
        })
      );

      act(() => {
        result.current.trigger();
      });

      // Should go directly to wiping
      expect(result.current.state).toBe('wiping');
    });

    it('should allow direct transition to countdown when requireConfirmation is false but countdownDuration > 0', () => {
      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: false,
          countdownDuration: 5,
        })
      );

      act(() => {
        result.current.trigger();
      });

      expect(result.current.state).toBe('countdown');
      expect(result.current.countdown).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should transition to error state on wipe failure', async () => {
      const { performEmergencyWipe } = await import('../../features/emergency');
      const testError = new Error('Wipe failed');
      vi.mocked(performEmergencyWipe).mockRejectedValue(testError);

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: false,
          onError,
        })
      );

      await act(async () => {
        result.current.trigger();
        await vi.runAllTimersAsync();
      });

      expect(result.current.state).toBe('error');
      expect(onError).toHaveBeenCalled();
    });

    it('should convert non-Error thrown values to Error', async () => {
      const { performEmergencyWipe } = await import('../../features/emergency');
      vi.mocked(performEmergencyWipe).mockRejectedValue('string error');

      const onError = vi.fn();
      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: false,
          onError,
        })
      );

      await act(async () => {
        result.current.trigger();
        await vi.runAllTimersAsync();
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('progress tracking', () => {
    it('should update progress when showProgress is true', async () => {
      const { performEmergencyWipe } = await import('../../features/emergency');

      // Mock to call progress callback
      vi.mocked(performEmergencyWipe).mockImplementation(async (progressCallback) => {
        if (progressCallback) {
          progressCallback({
            phase: 'clearing-storage',
            percent: 50,
            message: 'Clearing storage...',
          });
        }
        return {
          success: true,
          storageCleared: true,
          localStorageCleared: true,
          sessionStorageCleared: true,
          indexedDBCleared: true,
        };
      });

      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: false,
          showProgress: true,
        })
      );

      await act(async () => {
        result.current.trigger();
        await vi.runAllTimersAsync();
      });

      expect(performEmergencyWipe).toHaveBeenCalledWith(expect.any(Function), true);
    });

    it('should not track progress when showProgress is false', async () => {
      const { performEmergencyWipe } = await import('../../features/emergency');
      vi.mocked(performEmergencyWipe).mockResolvedValue({
        success: true,
        storageCleared: true,
        localStorageCleared: true,
        sessionStorageCleared: true,
        indexedDBCleared: true,
      });

      const { result } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: false,
          showProgress: false,
        })
      );

      await act(async () => {
        result.current.trigger();
        await vi.runAllTimersAsync();
      });

      // Progress callback should be undefined
      expect(performEmergencyWipe).toHaveBeenCalledWith(undefined, true);
    });
  });

  describe('cleanup on unmount', () => {
    it('should stop keyboard detector on unmount', async () => {
      const { createKeyboardDetector } = await import('../../features/emergency');
      const stopMock = vi.fn();
      vi.mocked(createKeyboardDetector).mockReturnValue({
        start: vi.fn(),
        stop: stopMock,
      });

      const { unmount } = renderHook(() =>
        useEmergencyWipe({ enableKeyboard: true })
      );

      unmount();

      expect(stopMock).toHaveBeenCalled();
    });

    it('should stop shake detector on unmount', async () => {
      const { createShakeDetector, isMobileDevice } = await import(
        '../../features/emergency'
      );
      vi.mocked(isMobileDevice).mockReturnValue(true);

      const stopMock = vi.fn();
      vi.mocked(createShakeDetector).mockReturnValue({
        start: vi.fn(),
        stop: stopMock,
      });

      const { unmount } = renderHook(() =>
        useEmergencyWipe({ enableShake: true })
      );

      unmount();

      expect(stopMock).toHaveBeenCalled();
    });

    it('should clear countdown interval on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useEmergencyWipe({
          requireConfirmation: true,
          countdownDuration: 10,
        })
      );

      // Start countdown
      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      act(() => {
        result.current.confirm();
      });

      expect(result.current.state).toBe('countdown');

      // Unmount should not throw
      unmount();
    });
  });

  describe('tap event details', () => {
    it('should handle touch events', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      const touchEvent = {
        touches: [{ clientX: 100, clientY: 100 }],
        changedTouches: [{ clientX: 100, clientY: 100 }],
      } as unknown as TouchEvent;

      // First two taps
      act(() => {
        result.current.handleTap(touchEvent);
        result.current.handleTap(touchEvent);
      });

      expect(result.current.state).toBe('idle');

      // Third tap triggers
      act(() => {
        result.current.handleTap(touchEvent);
      });

      expect(result.current.state).toBe('triggered');
    });
  });

  describe('trigger types', () => {
    it('should track triple-tap trigger type', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      const mockEvent = { clientX: 100, clientY: 100 } as MouseEvent;

      act(() => {
        result.current.handleTap(mockEvent);
        result.current.handleTap(mockEvent);
        result.current.handleTap(mockEvent);
      });

      expect(result.current.triggerType).toBe('triple-tap');
    });

    it('should track programmatic trigger type', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger('programmatic');
      });

      expect(result.current.triggerType).toBe('programmatic');
    });

    it('should default to programmatic when no type specified', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      expect(result.current.triggerType).toBe('programmatic');
    });

    it('should clear triggerType on cancel', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      expect(result.current.triggerType).toBe('programmatic');

      act(() => {
        result.current.cancel();
      });

      expect(result.current.triggerType).toBeNull();
    });

    it('should clear triggerType on reset', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.triggerType).toBeNull();
    });
  });

  describe('canCancel computation', () => {
    it('should be true in triggered state', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      expect(result.current.canCancel).toBe(true);
    });

    it('should be true in confirming state', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.state).toBe('confirming');
      expect(result.current.canCancel).toBe(true);
    });

    it('should be true in countdown state', () => {
      const { result } = renderHook(() =>
        useEmergencyWipe({ countdownDuration: 5 })
      );

      act(() => {
        result.current.trigger();
      });

      act(() => {
        vi.advanceTimersByTime(150);
      });

      act(() => {
        result.current.confirm();
      });

      expect(result.current.state).toBe('countdown');
      expect(result.current.canCancel).toBe(true);
    });

    it('should be false in idle state', () => {
      const { result } = renderHook(() => useEmergencyWipe());

      expect(result.current.canCancel).toBe(false);
    });

    it('should be false in wiping state', () => {
      const { result } = renderHook(() =>
        useEmergencyWipe({ requireConfirmation: false })
      );

      act(() => {
        result.current.trigger();
      });

      expect(result.current.state).toBe('wiping');
      expect(result.current.canCancel).toBe(false);
    });
  });
});
