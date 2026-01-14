/**
 * Skip Links Component - BitChat In Browser
 *
 * Provides skip navigation links for keyboard and screen reader users:
 * - Skip to main content (bypasses header and navigation)
 * - Skip to navigation (quick access to nav tabs)
 *
 * These links are visually hidden until focused, then appear at the top
 * of the viewport. This is a critical WCAG 2.1 AA requirement.
 *
 * @module components/a11y/SkipLinks
 */

import type { FunctionComponent } from 'preact';

// ============================================================================
// Constants
// ============================================================================

/** Default target IDs for skip links */
export const SKIP_LINK_TARGETS = {
  main: 'main-content',
  navigation: 'main-navigation',
} as const;

// ============================================================================
// Types
// ============================================================================

interface SkipLinkProps {
  /** Target element ID (without #) */
  targetId: string;
  /** Link label text */
  label: string;
}

interface SkipLinksProps {
  /** Custom ID for main content target */
  mainContentId?: string;
  /** Custom ID for navigation target */
  navigationId?: string;
  /** Show skip to navigation link */
  showNavigationLink?: boolean;
}

// ============================================================================
// Individual Skip Link
// ============================================================================

const SkipLink: FunctionComponent<SkipLinkProps> = ({ targetId, label }) => {
  const handleClick = (e: Event) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      // Set focus to the target element
      target.setAttribute('tabindex', '-1');
      target.focus();
      // Scroll target into view
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Clean up tabindex after blur
      target.addEventListener(
        'blur',
        () => {
          target.removeAttribute('tabindex');
        },
        { once: true }
      );
    }
  };

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      class="skip-link"
      // Ensure link is focusable and announces correctly
      aria-label={label}
    >
      {label}
    </a>
  );
};

// ============================================================================
// Skip Links Container
// ============================================================================

/**
 * SkipLinks - Accessibility navigation shortcuts
 *
 * Place this component at the very beginning of the app, before any
 * other content. It provides keyboard users with quick navigation
 * to skip repetitive elements.
 *
 * @example
 * ```tsx
 * <SkipLinks />
 * <Header />
 * <main id="main-content">
 *   {content}
 * </main>
 * <nav id="main-navigation">
 *   {navigation}
 * </nav>
 * ```
 */
export const SkipLinks: FunctionComponent<SkipLinksProps> = ({
  mainContentId = SKIP_LINK_TARGETS.main,
  navigationId = SKIP_LINK_TARGETS.navigation,
  showNavigationLink = true,
}) => (
    <div
      class="skip-links"
      role="navigation"
      aria-label="Skip navigation"
    >
      <SkipLink targetId={mainContentId} label="Skip to main content" />
      {showNavigationLink && (
        <SkipLink targetId={navigationId} label="Skip to navigation" />
      )}
    </div>
  );

// ============================================================================
// Utility function for setting up skip link targets
// ============================================================================

/**
 * Ensures an element has the proper attributes to receive focus from skip links
 *
 * @param element - The DOM element to prepare
 * @param role - Optional ARIA role to set
 */
export function prepareSkipLinkTarget(
  element: HTMLElement | null,
  role?: string
): void {
  if (!element) return;

  // Make element focusable (will be set to -1 when focused)
  if (!element.hasAttribute('tabindex')) {
    element.setAttribute('tabindex', '-1');
  }

  // Set role if provided
  if (role && !element.hasAttribute('role')) {
    element.setAttribute('role', role);
  }
}

export default SkipLinks;
