/**
 * useMediaQuery - Responsive breakpoint hooks
 *
 * Provides hooks for detecting:
 * - Device type (mobile, tablet, desktop)
 * - Screen orientation
 * - Safe area insets
 * - Specific media queries
 *
 * Mobile-first approach matching Tailwind breakpoints.
 */

import { useState, useEffect, useMemo } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type Orientation = 'portrait' | 'landscape';

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ResponsiveState {
  /** Current device type */
  deviceType: DeviceType;
  /** Screen orientation */
  orientation: Orientation;
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Whether the device is a tablet */
  isTablet: boolean;
  /** Whether the device is a desktop */
  isDesktop: boolean;
  /** Whether in portrait mode */
  isPortrait: boolean;
  /** Whether in landscape mode */
  isLandscape: boolean;
  /** Safe area insets */
  safeAreaInsets: SafeAreaInsets;
  /** Current viewport width */
  viewportWidth: number;
  /** Current viewport height */
  viewportHeight: number;
  /** Whether it's a touch device */
  isTouchDevice: boolean;
  /** Whether it's a small mobile (iPhone SE size) */
  isSmallMobile: boolean;
  /** Whether reduced motion is preferred */
  prefersReducedMotion: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Breakpoints matching Tailwind CSS defaults */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/** Named breakpoint queries */
export const QUERIES = {
  /** Small mobile devices (< 375px) - iPhone SE */
  smallMobile: '(max-width: 374px)',
  /** Mobile devices (< 768px) */
  mobile: '(max-width: 767px)',
  /** Tablet devices (768px - 1023px) */
  tablet: '(min-width: 768px) and (max-width: 1023px)',
  /** Desktop devices (>= 1024px) */
  desktop: '(min-width: 1024px)',
  /** Large desktop (>= 1280px) */
  largeDesktop: '(min-width: 1280px)',
  /** Portrait orientation */
  portrait: '(orientation: portrait)',
  /** Landscape orientation */
  landscape: '(orientation: landscape)',
  /** Hover capable (non-touch) */
  canHover: '(hover: hover) and (pointer: fine)',
  /** Touch device (coarse pointer) */
  isTouch: '(hover: none) and (pointer: coarse)',
  /** Reduced motion preference */
  reducedMotion: '(prefers-reduced-motion: reduce)',
  /** Dark mode preference */
  darkMode: '(prefers-color-scheme: dark)',
  /** High contrast preference */
  highContrast: '(prefers-contrast: high)',
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if code is running in browser environment
 */
const isBrowser = typeof window !== 'undefined';

/**
 * Gets safe area inset values from CSS environment variables
 */
function getSafeAreaInsets(): SafeAreaInsets {
  if (!isBrowser) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  const computedStyle = getComputedStyle(document.documentElement);

  const parseInset = (prop: string): number => {
    const value = computedStyle.getPropertyValue(prop);
    return parseInt(value, 10) || 0;
  };

  // Try to get from CSS custom properties first (set by env())
  return {
    top: parseInset('--safe-area-inset-top') ||
         parseInt(computedStyle.getPropertyValue('padding-top'), 10) || 0,
    right: parseInset('--safe-area-inset-right') ||
           parseInt(computedStyle.getPropertyValue('padding-right'), 10) || 0,
    bottom: parseInset('--safe-area-inset-bottom') ||
            parseInt(computedStyle.getPropertyValue('padding-bottom'), 10) || 0,
    left: parseInset('--safe-area-inset-left') ||
          parseInt(computedStyle.getPropertyValue('padding-left'), 10) || 0,
  };
}

/**
 * Determines device type from viewport width
 * @internal Used by useResponsive hook
 */
function _getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINTS.md) return 'mobile';
  if (width < BREAKPOINTS.lg) return 'tablet';
  return 'desktop';
}

/**
 * Determines orientation from viewport dimensions
 * @internal Used by useResponsive hook
 */
function _getOrientation(width: number, height: number): Orientation {
  return height > width ? 'portrait' : 'landscape';
}

// Export for potential external use
export { _getDeviceType as getDeviceType, _getOrientation as getOrientation };

// ============================================================================
// useMediaQuery - Core Hook
// ============================================================================

/**
 * Hook to check if a media query matches
 *
 * @param query - CSS media query string
 * @returns Whether the media query matches
 *
 * @example
 * const isMobile = useMediaQuery('(max-width: 767px)');
 * const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (!isBrowser) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!isBrowser) return;

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    // Modern browsers
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener('change', handler);
      return () => mediaQueryList.removeEventListener('change', handler);
    }
    // Older browsers fallback
    mediaQueryList.addListener(handler);
    return () => mediaQueryList.removeListener(handler);
  }, [query]);

  return matches;
}

// ============================================================================
// Device Type Hooks
// ============================================================================

/**
 * Check if device is mobile (< 768px)
 */
export function useIsMobile(): boolean {
  return useMediaQuery(QUERIES.mobile);
}

/**
 * Check if device is tablet (768px - 1023px)
 */
export function useIsTablet(): boolean {
  return useMediaQuery(QUERIES.tablet);
}

/**
 * Check if device is desktop (>= 1024px)
 */
export function useIsDesktop(): boolean {
  return useMediaQuery(QUERIES.desktop);
}

/**
 * Check if device is small mobile (< 375px, iPhone SE)
 */
export function useIsSmallMobile(): boolean {
  return useMediaQuery(QUERIES.smallMobile);
}

/**
 * Check if device is large desktop (>= 1280px)
 */
export function useIsLargeDesktop(): boolean {
  return useMediaQuery(QUERIES.largeDesktop);
}

/**
 * Get current device type
 */
export function useDeviceType(): DeviceType {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

// ============================================================================
// Orientation Hooks
// ============================================================================

/**
 * Check if device is in portrait orientation
 */
export function useIsPortrait(): boolean {
  return useMediaQuery(QUERIES.portrait);
}

/**
 * Check if device is in landscape orientation
 */
export function useIsLandscape(): boolean {
  return useMediaQuery(QUERIES.landscape);
}

/**
 * Get current orientation
 */
export function useOrientation(): Orientation {
  const isPortrait = useIsPortrait();
  return isPortrait ? 'portrait' : 'landscape';
}

// ============================================================================
// Touch Detection Hooks
// ============================================================================

/**
 * Check if device supports touch
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery(QUERIES.isTouch);
}

/**
 * Check if device supports hover (non-touch)
 */
export function useCanHover(): boolean {
  return useMediaQuery(QUERIES.canHover);
}

// ============================================================================
// Accessibility Preference Hooks
// ============================================================================

/**
 * Check if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(QUERIES.reducedMotion);
}

/**
 * Check if user prefers dark mode
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery(QUERIES.darkMode);
}

/**
 * Check if user prefers high contrast
 */
export function usePrefersHighContrast(): boolean {
  return useMediaQuery(QUERIES.highContrast);
}

// ============================================================================
// Safe Area Insets Hook
// ============================================================================

/**
 * Get safe area insets (notch, home indicator, etc.)
 *
 * @returns Safe area insets object
 *
 * @example
 * const { top, bottom } = useSafeAreaInsets();
 * return <div style={{ paddingTop: top, paddingBottom: bottom }}>...</div>;
 */
export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>(getSafeAreaInsets);

  useEffect(() => {
    if (!isBrowser) return;

    // Update insets on resize (orientation change can affect them)
    const updateInsets = () => {
      // Small delay to allow CSS env() values to update
      requestAnimationFrame(() => {
        setInsets(getSafeAreaInsets());
      });
    };

    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    // Initial update
    updateInsets();

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, []);

  return insets;
}

// ============================================================================
// Viewport Size Hook
// ============================================================================

interface ViewportSize {
  width: number;
  height: number;
}

/**
 * Get current viewport size with debounced updates
 *
 * @param debounceMs - Debounce delay in milliseconds (default: 100)
 * @returns Current viewport dimensions
 */
export function useViewportSize(debounceMs = 100): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => ({
    width: isBrowser ? window.innerWidth : 0,
    height: isBrowser ? window.innerHeight : 0,
  }));

  useEffect(() => {
    if (!isBrowser) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        setSize({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, debounceMs);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [debounceMs]);

  return size;
}

// ============================================================================
// Breakpoint Hook
// ============================================================================

/**
 * Check if viewport is at or above a specific breakpoint
 *
 * @param breakpoint - Breakpoint name (sm, md, lg, xl, 2xl)
 * @returns Whether viewport is at or above the breakpoint
 *
 * @example
 * const isLargeScreen = useBreakpoint('lg');
 */
export function useBreakpoint(breakpoint: keyof typeof BREAKPOINTS): boolean {
  const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`;
  return useMediaQuery(query);
}

/**
 * Check if viewport is below a specific breakpoint
 *
 * @param breakpoint - Breakpoint name (sm, md, lg, xl, 2xl)
 * @returns Whether viewport is below the breakpoint
 */
export function useBelowBreakpoint(breakpoint: keyof typeof BREAKPOINTS): boolean {
  const query = `(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`;
  return useMediaQuery(query);
}

/**
 * Check if viewport is between two breakpoints
 *
 * @param min - Minimum breakpoint (inclusive)
 * @param max - Maximum breakpoint (exclusive)
 * @returns Whether viewport is between the breakpoints
 */
export function useBetweenBreakpoints(
  min: keyof typeof BREAKPOINTS,
  max: keyof typeof BREAKPOINTS
): boolean {
  const query = `(min-width: ${BREAKPOINTS[min]}px) and (max-width: ${BREAKPOINTS[max] - 1}px)`;
  return useMediaQuery(query);
}

// ============================================================================
// Combined Responsive State Hook
// ============================================================================

/**
 * Get complete responsive state
 *
 * Provides all responsive information in a single hook for convenience.
 * For better performance, use individual hooks when you only need specific values.
 *
 * @returns Complete responsive state object
 *
 * @example
 * const { isMobile, isLandscape, safeAreaInsets } = useResponsive();
 */
export function useResponsive(): ResponsiveState {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();
  const isSmallMobile = useIsSmallMobile();
  const isPortrait = useIsPortrait();
  const isLandscape = useIsLandscape();
  const isTouchDevice = useIsTouchDevice();
  const prefersReducedMotion = usePrefersReducedMotion();
  const safeAreaInsets = useSafeAreaInsets();
  const { width, height } = useViewportSize();

  const deviceType = useMemo((): DeviceType => {
    if (isMobile) return 'mobile';
    if (isTablet) return 'tablet';
    return 'desktop';
  }, [isMobile, isTablet]);

  const orientation = useMemo((): Orientation => isPortrait ? 'portrait' : 'landscape', [isPortrait]);

  return useMemo(
    () => ({
      deviceType,
      orientation,
      isMobile,
      isTablet,
      isDesktop,
      isPortrait,
      isLandscape,
      safeAreaInsets,
      viewportWidth: width,
      viewportHeight: height,
      isTouchDevice,
      isSmallMobile,
      prefersReducedMotion,
    }),
    [
      deviceType,
      orientation,
      isMobile,
      isTablet,
      isDesktop,
      isPortrait,
      isLandscape,
      safeAreaInsets,
      width,
      height,
      isTouchDevice,
      isSmallMobile,
      prefersReducedMotion,
    ]
  );
}

// ============================================================================
// Layout-Specific Hooks
// ============================================================================

/**
 * Determines if navigation should be shown as bottom tabs or sidebar
 */
export function useNavigationLayout(): 'bottom' | 'sidebar' {
  const isDesktop = useIsDesktop();
  return isDesktop ? 'sidebar' : 'bottom';
}

/**
 * Determines if modals should be full screen or centered overlay
 */
export function useModalLayout(): 'fullscreen' | 'centered' {
  const isMobile = useIsMobile();
  return isMobile ? 'fullscreen' : 'centered';
}

/**
 * Determines chat view layout
 */
export function useChatLayout(): 'mobile' | 'split' | 'three-column' {
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isLandscape = useIsLandscape();

  if (isMobile) return 'mobile';
  if (isTablet && isLandscape) return 'split';
  if (isTablet) return 'mobile';
  return 'three-column';
}

// ============================================================================
// Keyboard Detection Hook
// ============================================================================

/**
 * Detects if the virtual keyboard is likely open (mobile only)
 * This is a heuristic based on viewport height changes
 */
export function useIsKeyboardOpen(): boolean {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isBrowser || !isMobile) {
      setIsOpen(false);
      return;
    }

    const initialHeight = window.innerHeight;

    const handleResize = () => {
      // If viewport height decreased significantly, keyboard is likely open
      const heightDiff = initialHeight - window.innerHeight;
      const threshold = initialHeight * 0.2; // 20% threshold
      setIsOpen(heightDiff > threshold);
    };

    // Use visualViewport API if available (more reliable)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  return isOpen;
}

export default useMediaQuery;
