/**
 * Accessibility Hooks - BitChat In Browser
 *
 * Provides accessibility utilities for focus management, keyboard navigation,
 * and ARIA label generation. These hooks help ensure WCAG 2.1 AA compliance
 * throughout the application.
 *
 * @module hooks/useA11y
 */

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

/** Direction for arrow key navigation */
export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

/** Options for focus trap hook */
export interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  active?: boolean;
  /** Initial element to focus (selector or ref) */
  initialFocus?: string | HTMLElement | null;
  /** Element to return focus to on deactivation */
  returnFocus?: HTMLElement | null;
  /** Allow escape key to deactivate trap */
  escapeDeactivates?: boolean;
  /** Callback when escape is pressed */
  onEscape?: () => void;
}

/** Options for roving tabindex hook */
export interface UseRovingTabIndexOptions<T extends HTMLElement = HTMLElement> {
  /** Array of refs to the items */
  items: (T | null)[];
  /** Current focused index */
  currentIndex?: number;
  /** Whether navigation wraps around */
  wrap?: boolean;
  /** Orientation for arrow key navigation */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Callback when index changes */
  onIndexChange?: (index: number) => void;
}

/** Options for keyboard navigation hook */
export interface UseKeyboardNavigationOptions {
  /** Callback for Enter key */
  onEnter?: () => void;
  /** Callback for Escape key */
  onEscape?: () => void;
  /** Callback for Space key */
  onSpace?: () => void;
  /** Callback for Tab key */
  onTab?: (shiftKey: boolean) => void;
  /** Callback for arrow keys */
  onArrow?: (direction: NavigationDirection) => void;
  /** Callback for Home key */
  onHome?: () => void;
  /** Callback for End key */
  onEnd?: () => void;
  /** Whether to prevent default behavior */
  preventDefault?: boolean;
  /** Whether to stop propagation */
  stopPropagation?: boolean;
}

/** Return type for focus trap hook */
export interface UseFocusTrapReturn {
  /** Ref to attach to the container element */
  containerRef: preact.RefObject<HTMLElement>;
  /** Manually activate the focus trap */
  activate: () => void;
  /** Manually deactivate the focus trap */
  deactivate: () => void;
  /** Whether the trap is currently active */
  isActive: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Selector for focusable elements */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled') && el.offsetParent !== null
  );
}

/**
 * Check if an element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  return element.matches(FOCUSABLE_SELECTOR) && !element.hasAttribute('disabled');
}

/**
 * Move focus to the first focusable element in a container
 */
export function focusFirst(container: HTMLElement): boolean {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0 && focusable[0]) {
    focusable[0].focus();
    return true;
  }
  return false;
}

/**
 * Move focus to the last focusable element in a container
 */
export function focusLast(container: HTMLElement): boolean {
  const focusable = getFocusableElements(container);
  const last = focusable[focusable.length - 1];
  if (focusable.length > 0 && last) {
    last.focus();
    return true;
  }
  return false;
}

/**
 * Get the current active element, accounting for shadow DOM
 */
export function getActiveElement(doc: Document = document): Element | null {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
}

// ============================================================================
// Focus Trap Hook
// ============================================================================

/**
 * useFocusTrap - Trap focus within a container element
 *
 * Implements a focus trap for modal dialogs, dropdowns, and other
 * overlay components. Ensures keyboard users cannot tab outside
 * the trapped region.
 *
 * @example
 * ```tsx
 * const { containerRef } = useFocusTrap({
 *   active: isOpen,
 *   onEscape: () => setIsOpen(false),
 * });
 *
 * return (
 *   <div ref={containerRef} role="dialog">
 *     {content}
 *   </div>
 * );
 * ```
 */
export function useFocusTrap(options: UseFocusTrapOptions = {}): UseFocusTrapReturn {
  const {
    active = true,
    initialFocus,
    returnFocus,
    escapeDeactivates = true,
    onEscape,
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const [isActive, setIsActive] = useState(active);
  const previousActiveRef = useRef<Element | null>(null);

  // Store reference to element that had focus before trap activation
  useEffect(() => {
    if (active && !isActive) {
      previousActiveRef.current = getActiveElement();
    }
    setIsActive(active);
  }, [active, isActive]);

  // Handle initial focus when trap activates
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Determine initial focus target
    let target: HTMLElement | null = null;

    if (typeof initialFocus === 'string') {
      target = containerRef.current.querySelector<HTMLElement>(initialFocus);
    } else if (initialFocus instanceof HTMLElement) {
      target = initialFocus;
    }

    // Focus the target or first focusable element
    if (target) {
      target.focus();
    } else {
      focusFirst(containerRef.current);
    }
  }, [isActive, initialFocus]);

  // Handle keyboard events for focus trapping
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key
      if (event.key === 'Escape' && escapeDeactivates) {
        event.preventDefault();
        onEscape?.();
        return;
      }

      // Handle Tab key for focus trapping
      if (event.key === 'Tab') {
        const focusable = getFocusableElements(container);
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = getActiveElement();

        if (event.shiftKey) {
          // Shift+Tab: wrap to last if on first element
          if (active === first && last) {
            event.preventDefault();
            last.focus();
          }
        } else {
          // Tab: wrap to first if on last element
          if (active === last && first) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [isActive, escapeDeactivates, onEscape]);

  // Return focus when trap deactivates
  useEffect(() => {
    if (isActive) return;

    const target = returnFocus || (previousActiveRef.current as HTMLElement | null);
    if (target && typeof target.focus === 'function') {
      target.focus();
    }
  }, [isActive, returnFocus]);

  const activate = useCallback(() => setIsActive(true), []);
  const deactivate = useCallback(() => setIsActive(false), []);

  return {
    containerRef,
    activate,
    deactivate,
    isActive,
  };
}

// ============================================================================
// Roving TabIndex Hook
// ============================================================================

/**
 * useRovingTabIndex - Implement roving tabindex pattern for lists
 *
 * Provides keyboard navigation within a group of elements using
 * arrow keys, with only one element having tabindex="0" at a time.
 *
 * @example
 * ```tsx
 * const items = [ref1, ref2, ref3];
 * const { currentIndex, handleKeyDown } = useRovingTabIndex({
 *   items,
 *   orientation: 'vertical',
 * });
 * ```
 */
export function useRovingTabIndex<T extends HTMLElement = HTMLElement>(
  options: UseRovingTabIndexOptions<T>
): {
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
} {
  const {
    items,
    currentIndex: initialIndex = 0,
    wrap = true,
    orientation = 'vertical',
    onIndexChange,
  } = options;

  const [currentIndex, setCurrentIndexInternal] = useState(initialIndex);

  const setCurrentIndex = useCallback(
    (index: number) => {
      setCurrentIndexInternal(index);
      onIndexChange?.(index);
    },
    [onIndexChange]
  );

  // Update tabindex attributes
  useEffect(() => {
    items.forEach((item, index) => {
      if (item) {
        item.setAttribute('tabindex', index === currentIndex ? '0' : '-1');
      }
    });
  }, [items, currentIndex]);

  // Focus current item
  useEffect(() => {
    const currentItem = items[currentIndex];
    if (currentItem) {
      currentItem.focus();
    }
  }, [items, currentIndex]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key } = event;
      let nextIndex = currentIndex;
      const itemCount = items.filter(Boolean).length;

      // Determine navigation based on orientation
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      switch (key) {
        case 'ArrowUp':
          if (isVertical) {
            event.preventDefault();
            nextIndex = wrap
              ? (currentIndex - 1 + itemCount) % itemCount
              : Math.max(0, currentIndex - 1);
          }
          break;
        case 'ArrowDown':
          if (isVertical) {
            event.preventDefault();
            nextIndex = wrap
              ? (currentIndex + 1) % itemCount
              : Math.min(itemCount - 1, currentIndex + 1);
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            event.preventDefault();
            nextIndex = wrap
              ? (currentIndex - 1 + itemCount) % itemCount
              : Math.max(0, currentIndex - 1);
          }
          break;
        case 'ArrowRight':
          if (isHorizontal) {
            event.preventDefault();
            nextIndex = wrap
              ? (currentIndex + 1) % itemCount
              : Math.min(itemCount - 1, currentIndex + 1);
          }
          break;
        case 'Home':
          event.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          event.preventDefault();
          nextIndex = itemCount - 1;
          break;
      }

      if (nextIndex !== currentIndex) {
        setCurrentIndex(nextIndex);
      }
    },
    [currentIndex, items, wrap, orientation, setCurrentIndex]
  );

  return {
    currentIndex,
    setCurrentIndex,
    handleKeyDown,
  };
}

// ============================================================================
// Keyboard Navigation Hook
// ============================================================================

/**
 * useKeyboardNavigation - Generic keyboard event handler hook
 *
 * Provides a reusable keyboard event handler with callbacks for
 * common navigation keys.
 *
 * @example
 * ```tsx
 * const { handleKeyDown } = useKeyboardNavigation({
 *   onEnter: () => selectItem(),
 *   onEscape: () => closeMenu(),
 *   onArrow: (dir) => navigateMenu(dir),
 * });
 * ```
 */
export function useKeyboardNavigation(
  options: UseKeyboardNavigationOptions
): {
  handleKeyDown: (event: KeyboardEvent) => void;
} {
  const {
    onEnter,
    onEscape,
    onSpace,
    onTab,
    onArrow,
    onHome,
    onEnd,
    preventDefault = true,
    stopPropagation = false,
  } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key, shiftKey } = event;
      let handled = false;

      switch (key) {
        case 'Enter':
          if (onEnter) {
            onEnter();
            handled = true;
          }
          break;
        case 'Escape':
          if (onEscape) {
            onEscape();
            handled = true;
          }
          break;
        case ' ':
          if (onSpace) {
            onSpace();
            handled = true;
          }
          break;
        case 'Tab':
          if (onTab) {
            onTab(shiftKey);
            handled = true;
          }
          break;
        case 'ArrowUp':
          if (onArrow) {
            onArrow('up');
            handled = true;
          }
          break;
        case 'ArrowDown':
          if (onArrow) {
            onArrow('down');
            handled = true;
          }
          break;
        case 'ArrowLeft':
          if (onArrow) {
            onArrow('left');
            handled = true;
          }
          break;
        case 'ArrowRight':
          if (onArrow) {
            onArrow('right');
            handled = true;
          }
          break;
        case 'Home':
          if (onHome) {
            onHome();
            handled = true;
          }
          break;
        case 'End':
          if (onEnd) {
            onEnd();
            handled = true;
          }
          break;
      }

      if (handled) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }
      }
    },
    [onEnter, onEscape, onSpace, onTab, onArrow, onHome, onEnd, preventDefault, stopPropagation]
  );

  return { handleKeyDown };
}

// ============================================================================
// Focus Management Hook
// ============================================================================

/**
 * useFocusOnMount - Focus an element when component mounts
 *
 * @example
 * ```tsx
 * const inputRef = useFocusOnMount<HTMLInputElement>();
 * return <input ref={inputRef} />;
 * ```
 */
export function useFocusOnMount<T extends HTMLElement = HTMLElement>(
  options: { delay?: number; select?: boolean } = {}
): preact.RefObject<T> {
  const { delay = 0, select = false } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (ref.current) {
        ref.current.focus();
        if (select && 'select' in ref.current && typeof (ref.current as unknown as HTMLInputElement).select === 'function') {
          (ref.current as unknown as HTMLInputElement).select();
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, select]);

  return ref;
}

/**
 * useFocusReturn - Return focus to a previous element on unmount
 *
 * @example
 * ```tsx
 * useFocusReturn(); // Returns focus to previously focused element on unmount
 * ```
 */
export function useFocusReturn(): void {
  const previousElementRef = useRef<Element | null>(null);

  useEffect(() => {
    previousElementRef.current = getActiveElement();

    return () => {
      const element = previousElementRef.current;
      if (element && typeof (element as HTMLElement).focus === 'function') {
        (element as HTMLElement).focus();
      }
    };
  }, []);
}

// ============================================================================
// ARIA Label Generators
// ============================================================================

/**
 * ARIA label generator utilities
 *
 * Generate consistent ARIA labels for common UI patterns.
 */
export const ariaLabels = {
  /**
   * Generate label for a close button
   */
  closeButton: (context?: string): string => context ? `Close ${context}` : 'Close',

  /**
   * Generate label for a toggle button
   */
  toggleButton: (name: string, isExpanded: boolean): string => `${name}, ${isExpanded ? 'expanded' : 'collapsed'}`,

  /**
   * Generate label for a navigation item with badge
   */
  navItemWithBadge: (name: string, count: number): string => {
    if (count === 0) return name;
    return `${name}, ${count} ${count === 1 ? 'unread' : 'unread'}`;
  },

  /**
   * Generate label for a loading state
   */
  loading: (action: string): string => `${action}, please wait`,

  /**
   * Generate label for a message
   */
  message: (sender: string, timestamp: string, isOwn: boolean): string => {
    const prefix = isOwn ? 'You' : sender;
    return `Message from ${prefix} at ${timestamp}`;
  },

  /**
   * Generate label for a peer status
   */
  peerStatus: (name: string, status: 'online' | 'offline' | 'away'): string => `${name}, ${status}`,

  /**
   * Generate label for connection status
   */
  connectionStatus: (relayCount: number, peerCount: number): string => {
    const relayText = `${relayCount} ${relayCount === 1 ? 'relay' : 'relays'} connected`;
    const peerText = `${peerCount} ${peerCount === 1 ? 'peer' : 'peers'} connected`;
    return `${relayText}, ${peerText}`;
  },

  /**
   * Generate label for a form field
   */
  formField: (label: string, required: boolean, error?: string): string => {
    let result = label;
    if (required) result += ', required';
    if (error) result += `, error: ${error}`;
    return result;
  },

  /**
   * Generate label for a progress indicator
   */
  progress: (label: string, current: number, max: number): string => {
    const percent = Math.round((current / max) * 100);
    return `${label}: ${percent}% complete`;
  },
} as const;

// ============================================================================
// Reduced Motion Hook
// ============================================================================

/**
 * usePrefersReducedMotion - Check if user prefers reduced motion
 *
 * @example
 * ```tsx
 * const prefersReducedMotion = usePrefersReducedMotion();
 * const animationDuration = prefersReducedMotion ? 0 : 300;
 * ```
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// High Contrast Hook
// ============================================================================

/**
 * usePrefersHighContrast - Check if user prefers high contrast
 *
 * @example
 * ```tsx
 * const prefersHighContrast = usePrefersHighContrast();
 * ```
 */
export function usePrefersHighContrast(): boolean {
  const [prefersHighContrast, setPrefersHighContrast] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-contrast: high)').matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersHighContrast(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersHighContrast;
}

// ============================================================================
// Screen Reader Detection Hook
// ============================================================================

/**
 * useScreenReaderAnnounce - Imperatively announce messages to screen readers
 *
 * @example
 * ```tsx
 * const announce = useScreenReaderAnnounce();
 * announce('Item added to cart', 'polite');
 * ```
 */
export function useScreenReaderAnnounce(): (
  message: string,
  priority?: 'polite' | 'assertive'
) => void {
  const announceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create announcement container if it doesn't exist
    let container = document.getElementById('sr-announcements') as HTMLDivElement | null;

    if (!container) {
      container = document.createElement('div');
      container.id = 'sr-announcements';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      container.className = 'sr-only';
      document.body.appendChild(container);
    }

    announceRef.current = container;

    return () => {
      // Don't remove - might be used by other components
    };
  }, []);

  return useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const container = announceRef.current;
    if (!container) return;

    // Update priority if needed
    container.setAttribute('aria-live', priority);

    // Clear and set message to ensure announcement
    container.textContent = '';
    requestAnimationFrame(() => {
      container.textContent = message;
    });
  }, []);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  useFocusTrap,
  useRovingTabIndex,
  useKeyboardNavigation,
  useFocusOnMount,
  useFocusReturn,
  usePrefersReducedMotion,
  usePrefersHighContrast,
  useScreenReaderAnnounce,
  ariaLabels,
  getFocusableElements,
  isFocusable,
  focusFirst,
  focusLast,
  getActiveElement,
};
