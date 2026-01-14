/**
 * Tests for useMediaQuery Hook
 *
 * Tests media query functionality including:
 * - Returns true when query matches
 * - Returns false when query doesn't match
 * - Updates on media query change
 * - Device type detection
 * - Orientation detection
 * - Breakpoint utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import {
  useMediaQuery,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsSmallMobile,
  useDeviceType,
  useIsPortrait,
  useIsLandscape,
  useOrientation,
  useIsTouchDevice,
  usePrefersReducedMotion,
  usePrefersDarkMode,
  useSafeAreaInsets,
  useViewportSize,
  useBreakpoint,
  useBelowBreakpoint,
  useBetweenBreakpoints,
  useResponsive,
  useNavigationLayout,
  useModalLayout,
  useChatLayout,
  useIsKeyboardOpen,
  BREAKPOINTS,
  QUERIES,
} from '../useMediaQuery';

// ============================================================================
// Mock Setup
// ============================================================================

// Track registered MediaQueryList listeners
const mediaQueryListeners: Map<string, Set<(event: MediaQueryListEvent) => void>> = new Map();

// Mock MediaQueryList implementation
function createMockMediaQueryList(query: string, matches: boolean): MediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  mediaQueryListeners.set(query, listeners);

  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn((callback) => listeners.add(callback)),
    removeListener: vi.fn((callback) => listeners.delete(callback)),
    addEventListener: vi.fn((_, callback) => listeners.add(callback as any)),
    removeEventListener: vi.fn((_, callback) => listeners.delete(callback as any)),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList;
}

// Helper to simulate media query change
function simulateMediaQueryChange(query: string, matches: boolean) {
  const listeners = mediaQueryListeners.get(query);
  if (listeners) {
    const event = { matches, media: query } as MediaQueryListEvent;
    listeners.forEach((callback) => callback(event));
  }
}

describe('useMediaQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners.clear();

    // Default mock for matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      createMockMediaQueryList(query, false)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('basic functionality', () => {
    it('should return true when media query matches', () => {
      vi.mocked(window.matchMedia).mockImplementation((query) =>
        createMockMediaQueryList(query, true)
      );

      const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));

      expect(result.current).toBe(true);
    });

    it('should return false when media query does not match', () => {
      vi.mocked(window.matchMedia).mockImplementation((query) =>
        createMockMediaQueryList(query, false)
      );

      const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));

      expect(result.current).toBe(false);
    });

    it('should update when media query changes', () => {
      vi.mocked(window.matchMedia).mockImplementation((query) =>
        createMockMediaQueryList(query, false)
      );

      const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));

      expect(result.current).toBe(false);

      act(() => {
        simulateMediaQueryChange('(max-width: 767px)', true);
      });

      expect(result.current).toBe(true);
    });

    it('should register event listener on mount', () => {
      const mockList = createMockMediaQueryList('(max-width: 767px)', false);
      vi.mocked(window.matchMedia).mockReturnValue(mockList);

      renderHook(() => useMediaQuery('(max-width: 767px)'));

      expect(mockList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });

    it('should remove event listener on unmount', () => {
      const mockList = createMockMediaQueryList('(max-width: 767px)', false);
      vi.mocked(window.matchMedia).mockReturnValue(mockList);

      const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));

      unmount();

      expect(mockList.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function)
      );
    });
  });
});

describe('device type hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useIsMobile', () => {
    it('should return true for mobile viewport', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.mobile) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(true);
    });

    it('should return false for non-mobile viewport', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
        createMockMediaQueryList(query, false)
      );

      const { result } = renderHook(() => useIsMobile());

      expect(result.current).toBe(false);
    });
  });

  describe('useIsTablet', () => {
    it('should return true for tablet viewport', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.tablet) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useIsTablet());

      expect(result.current).toBe(true);
    });
  });

  describe('useIsDesktop', () => {
    it('should return true for desktop viewport', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.desktop) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useIsDesktop());

      expect(result.current).toBe(true);
    });
  });

  describe('useIsSmallMobile', () => {
    it('should return true for small mobile viewport', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.smallMobile) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useIsSmallMobile());

      expect(result.current).toBe(true);
    });
  });

  describe('useDeviceType', () => {
    it('should return "mobile" for mobile viewport', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.mobile) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useDeviceType());

      expect(result.current).toBe('mobile');
    });

    it('should return "tablet" for tablet viewport', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.tablet) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useDeviceType());

      expect(result.current).toBe('tablet');
    });

    it('should return "desktop" for desktop viewport', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
        createMockMediaQueryList(query, false)
      );

      const { result } = renderHook(() => useDeviceType());

      expect(result.current).toBe('desktop');
    });
  });
});

describe('orientation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useIsPortrait', () => {
    it('should return true in portrait orientation', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.portrait) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useIsPortrait());

      expect(result.current).toBe(true);
    });
  });

  describe('useIsLandscape', () => {
    it('should return true in landscape orientation', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.landscape) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useIsLandscape());

      expect(result.current).toBe(true);
    });
  });

  describe('useOrientation', () => {
    it('should return "portrait" when in portrait mode', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.portrait) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useOrientation());

      expect(result.current).toBe('portrait');
    });

    it('should return "landscape" when not in portrait mode', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
        createMockMediaQueryList(query, false)
      );

      const { result } = renderHook(() => useOrientation());

      expect(result.current).toBe('landscape');
    });
  });
});

describe('touch and accessibility hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useIsTouchDevice', () => {
    it('should return true for touch devices', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.isTouch) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useIsTouchDevice());

      expect(result.current).toBe(true);
    });
  });

  describe('usePrefersReducedMotion', () => {
    it('should return true when reduced motion is preferred', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.reducedMotion) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => usePrefersReducedMotion());

      expect(result.current).toBe(true);
    });
  });

  describe('usePrefersDarkMode', () => {
    it('should return true when dark mode is preferred', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.darkMode) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => usePrefersDarkMode());

      expect(result.current).toBe(true);
    });
  });
});

describe('useSafeAreaInsets', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: (prop: string) => {
        if (prop === '--safe-area-inset-top') return '44';
        if (prop === '--safe-area-inset-bottom') return '34';
        return '0';
      },
    } as CSSStyleDeclaration));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return safe area inset values', () => {
    const { result } = renderHook(() => useSafeAreaInsets());

    expect(result.current).toHaveProperty('top');
    expect(result.current).toHaveProperty('right');
    expect(result.current).toHaveProperty('bottom');
    expect(result.current).toHaveProperty('left');
  });
});

describe('useViewportSize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'innerHeight', {
      value: 768,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return current viewport size', () => {
    const { result } = renderHook(() => useViewportSize());

    expect(result.current.width).toBe(1024);
    expect(result.current.height).toBe(768);
  });

  it('should update on window resize', () => {
    const { result } = renderHook(() => useViewportSize(50));

    // Change viewport size
    Object.defineProperty(window, 'innerWidth', { value: 800 });
    Object.defineProperty(window, 'innerHeight', { value: 600 });

    act(() => {
      window.dispatchEvent(new Event('resize'));
      vi.advanceTimersByTime(100);
    });

    expect(result.current.width).toBe(800);
    expect(result.current.height).toBe(600);
  });

  it('should debounce resize updates', () => {
    const { result } = renderHook(() => useViewportSize(100));

    // Rapid resize events
    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 800 });
      window.dispatchEvent(new Event('resize'));
    });

    // Should not update immediately due to debounce
    expect(result.current.width).toBe(1024);

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current.width).toBe(800);
  });
});

describe('breakpoint hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useBreakpoint', () => {
    it('should return true when at or above breakpoint', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === `(min-width: ${BREAKPOINTS.lg}px)`) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useBreakpoint('lg'));

      expect(result.current).toBe(true);
    });
  });

  describe('useBelowBreakpoint', () => {
    it('should return true when below breakpoint', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === `(max-width: ${BREAKPOINTS.md - 1}px)`) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useBelowBreakpoint('md'));

      expect(result.current).toBe(true);
    });
  });

  describe('useBetweenBreakpoints', () => {
    it('should return true when between breakpoints', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        const expectedQuery = `(min-width: ${BREAKPOINTS.sm}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`;
        if (query === expectedQuery) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useBetweenBreakpoints('sm', 'lg'));

      expect(result.current).toBe(true);
    });
  });
});

describe('useResponsive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners.clear();

    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      createMockMediaQueryList(query, false)
    );

    vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({
      getPropertyValue: () => '0',
    } as CSSStyleDeclaration));

    Object.defineProperty(window, 'innerWidth', {
      value: 1024,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'innerHeight', {
      value: 768,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return complete responsive state', () => {
    const { result } = renderHook(() => useResponsive());

    expect(result.current).toHaveProperty('deviceType');
    expect(result.current).toHaveProperty('orientation');
    expect(result.current).toHaveProperty('isMobile');
    expect(result.current).toHaveProperty('isTablet');
    expect(result.current).toHaveProperty('isDesktop');
    expect(result.current).toHaveProperty('isPortrait');
    expect(result.current).toHaveProperty('isLandscape');
    expect(result.current).toHaveProperty('safeAreaInsets');
    expect(result.current).toHaveProperty('viewportWidth');
    expect(result.current).toHaveProperty('viewportHeight');
    expect(result.current).toHaveProperty('isTouchDevice');
    expect(result.current).toHaveProperty('isSmallMobile');
    expect(result.current).toHaveProperty('prefersReducedMotion');
  });
});

describe('layout hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('useNavigationLayout', () => {
    it('should return "bottom" for mobile', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
        createMockMediaQueryList(query, false)
      );

      const { result } = renderHook(() => useNavigationLayout());

      expect(result.current).toBe('bottom');
    });

    it('should return "sidebar" for desktop', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.desktop) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useNavigationLayout());

      expect(result.current).toBe('sidebar');
    });
  });

  describe('useModalLayout', () => {
    it('should return "fullscreen" for mobile', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.mobile) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useModalLayout());

      expect(result.current).toBe('fullscreen');
    });

    it('should return "centered" for non-mobile', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
        createMockMediaQueryList(query, false)
      );

      const { result } = renderHook(() => useModalLayout());

      expect(result.current).toBe('centered');
    });
  });

  describe('useChatLayout', () => {
    it('should return "mobile" for mobile devices', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
        if (query === QUERIES.mobile) {
          return createMockMediaQueryList(query, true);
        }
        return createMockMediaQueryList(query, false);
      });

      const { result } = renderHook(() => useChatLayout());

      expect(result.current).toBe('mobile');
    });

    it('should return "three-column" for desktop', () => {
      vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
        createMockMediaQueryList(query, false)
      );

      const { result } = renderHook(() => useChatLayout());

      expect(result.current).toBe('three-column');
    });
  });
});

describe('useIsKeyboardOpen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mediaQueryListeners.clear();

    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'visualViewport', {
      value: null,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return false when keyboard is closed', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      if (query === QUERIES.mobile) {
        return createMockMediaQueryList(query, true);
      }
      return createMockMediaQueryList(query, false);
    });

    const { result } = renderHook(() => useIsKeyboardOpen());

    expect(result.current).toBe(false);
  });

  it('should return false for non-mobile devices', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      createMockMediaQueryList(query, false)
    );

    const { result } = renderHook(() => useIsKeyboardOpen());

    expect(result.current).toBe(false);
  });
});

describe('BREAKPOINTS constant', () => {
  it('should export Tailwind-compatible breakpoints', () => {
    expect(BREAKPOINTS).toEqual({
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
      '2xl': 1536,
    });
  });
});

describe('QUERIES constant', () => {
  it('should export media query strings', () => {
    expect(QUERIES).toHaveProperty('mobile');
    expect(QUERIES).toHaveProperty('tablet');
    expect(QUERIES).toHaveProperty('desktop');
    expect(QUERIES).toHaveProperty('portrait');
    expect(QUERIES).toHaveProperty('landscape');
    expect(QUERIES).toHaveProperty('isTouch');
    expect(QUERIES).toHaveProperty('reducedMotion');
    expect(QUERIES).toHaveProperty('darkMode');
  });
});
