/**
 * Browser History Management for BitChat In Browser
 *
 * Provides hash-based routing for IPFS compatibility:
 * - Uses hash fragments (#/) for navigation
 * - Deep link handling for Nostr URIs and app URLs
 * - Back navigation support with state preservation
 * - Scroll position restoration
 *
 * Hash-based routing is required because IPFS gateways serve static files
 * and cannot handle server-side routing/rewrites.
 */

// ============================================================================
// Types
// ============================================================================

export interface RouteState {
  /** Scroll position to restore */
  scrollY?: number;
  /** Custom state data */
  data?: Record<string, unknown>;
  /** Timestamp of navigation */
  timestamp: number;
}

export interface NavigationEvent {
  /** Previous path */
  from: string;
  /** New path */
  to: string;
  /** Navigation type */
  type: 'push' | 'replace' | 'pop';
  /** Route state */
  state: RouteState | null;
}

export type NavigationListener = (event: NavigationEvent) => void;

// ============================================================================
// Hash History Implementation
// ============================================================================

class HashHistory {
  private listeners: Set<NavigationListener> = new Set();
  private scrollPositions: Map<string, number> = new Map();
  private isNavigating = false;

  constructor() {
    // Listen for popstate (back/forward navigation)
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this.handlePopState);
    }
  }

  /**
   * Get the current hash path (without the # prefix)
   */
  getCurrentPath(): string {
    if (typeof window === 'undefined') return '/';
    const hash = window.location.hash;
    // Remove # prefix and ensure leading /
    const path = hash.startsWith('#') ? hash.slice(1) : hash;
    return path.startsWith('/') ? path : `/${  path}`;
  }

  /**
   * Get the current route state from history
   */
  getCurrentState(): RouteState | null {
    if (typeof window === 'undefined') return null;
    return (window.history.state as RouteState) || null;
  }

  /**
   * Navigate to a new path (push to history)
   */
  push(path: string, state?: Partial<RouteState>): void {
    const from = this.getCurrentPath();
    const to = this.normalizePath(path);

    if (from === to) return; // Don't navigate to same path

    // Save current scroll position before navigating
    this.saveScrollPosition(from);

    const routeState: RouteState = {
      scrollY: 0,
      timestamp: Date.now(),
      ...state,
    };

    if (typeof window !== 'undefined') {
      this.isNavigating = true;
      window.history.pushState(routeState, '', `#${to}`);
      this.isNavigating = false;

      this.notifyListeners({
        from,
        to,
        type: 'push',
        state: routeState,
      });

      // Scroll to top on new navigation
      this.restoreScrollPosition(to);
    }
  }

  /**
   * Replace current history entry
   */
  replace(path: string, state?: Partial<RouteState>): void {
    const from = this.getCurrentPath();
    const to = this.normalizePath(path);

    const routeState: RouteState = {
      scrollY: window.scrollY || 0,
      timestamp: Date.now(),
      ...state,
    };

    if (typeof window !== 'undefined') {
      this.isNavigating = true;
      window.history.replaceState(routeState, '', `#${to}`);
      this.isNavigating = false;

      this.notifyListeners({
        from,
        to,
        type: 'replace',
        state: routeState,
      });
    }
  }

  /**
   * Go back in history
   */
  back(): void {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }

  /**
   * Go forward in history
   */
  forward(): void {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  }

  /**
   * Go to a specific position in history
   */
  go(delta: number): void {
    if (typeof window !== 'undefined') {
      window.history.go(delta);
    }
  }

  /**
   * Check if we can go back
   */
  canGoBack(): boolean {
    // We can't truly know this without more complex tracking
    // For now, assume we can if we're not at the root
    return this.getCurrentPath() !== '/';
  }

  /**
   * Subscribe to navigation events
   */
  listen(listener: NavigationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Handle browser back/forward buttons
   */
  private handlePopState = (event: PopStateEvent): void => {
    if (this.isNavigating) return;

    const to = this.getCurrentPath();
    const state = event.state as RouteState | null;

    // Find previous path from scroll positions (best guess)
    const from = this.lastNavigatedPath || '/';
    this.lastNavigatedPath = to;

    this.notifyListeners({
      from,
      to,
      type: 'pop',
      state,
    });

    // Restore scroll position for this path
    this.restoreScrollPosition(to);
  };

  private lastNavigatedPath = '/';

  /**
   * Normalize path to ensure consistency
   */
  private normalizePath(path: string): string {
    // Ensure leading slash
    let normalized = path.startsWith('/') ? path : `/${  path}`;
    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  }

  /**
   * Save scroll position for a path
   */
  private saveScrollPosition(path: string): void {
    if (typeof window !== 'undefined') {
      this.scrollPositions.set(path, window.scrollY);
    }
  }

  /**
   * Restore scroll position for a path
   */
  private restoreScrollPosition(path: string): void {
    if (typeof window === 'undefined') return;

    const savedPosition = this.scrollPositions.get(path);
    const state = this.getCurrentState();

    // Use state scroll position if available, otherwise saved position, otherwise 0
    const scrollY = state?.scrollY ?? savedPosition ?? 0;

    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  }

  /**
   * Notify all listeners of navigation
   */
  private notifyListeners(event: NavigationEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[History] Error in navigation listener:', error);
      }
    });
  }

  /**
   * Destroy the history instance and clean up
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('popstate', this.handlePopState);
    }
    this.listeners.clear();
    this.scrollPositions.clear();
  }
}

// ============================================================================
// Deep Link Handling
// ============================================================================

export interface DeepLinkResult {
  /** Type of deep link */
  type: 'nostr' | 'channel' | 'peer' | 'action' | 'share' | 'unknown';
  /** Parsed path for routing */
  path: string;
  /** Query parameters */
  params: Record<string, string>;
  /** Original URI/URL */
  original: string;
}

/**
 * Parse a deep link URL or Nostr URI
 */
export function parseDeepLink(uri: string): DeepLinkResult {
  const result: DeepLinkResult = {
    type: 'unknown',
    path: '/',
    params: {},
    original: uri,
  };

  try {
    // Handle web+nostr: protocol
    if (uri.startsWith('web+nostr:') || uri.startsWith('nostr:')) {
      const nostrUri = uri.replace(/^web\+/, '');
      result.type = 'nostr';
      result.params.nostr = nostrUri;

      // Parse Nostr URI components
      const nostrPart = nostrUri.replace('nostr:', '');

      if (nostrPart.startsWith('npub')) {
        // Public key - navigate to peer profile
        result.type = 'peer';
        result.path = `/peers/${nostrPart}`;
        result.params.npub = nostrPart;
      } else if (nostrPart.startsWith('note')) {
        // Note ID - try to find the channel
        result.type = 'channel';
        result.params.note = nostrPart;
        result.path = '/channels';
      } else if (nostrPart.startsWith('nevent')) {
        // Event - parse and navigate
        result.type = 'channel';
        result.params.nevent = nostrPart;
        result.path = '/channels';
      }

      return result;
    }

    // Handle internal URLs with query parameters
    const url = new URL(uri, 'http://localhost');
    const action = url.searchParams.get('action');
    const nostr = url.searchParams.get('nostr');

    // Copy all search params
    url.searchParams.forEach((value, key) => {
      result.params[key] = value;
    });

    if (nostr) {
      // Nostr param in URL
      return parseDeepLink(nostr);
    }

    if (action) {
      result.type = 'action';

      switch (action) {
        case 'new-message':
          result.path = '/messages';
          break;
        case 'nearby':
          result.path = '/channels';
          result.params.filter = 'nearby';
          break;
        case 'share':
          result.path = '/share';
          break;
        default:
          result.path = '/';
      }

      return result;
    }

    // Handle share target
    if (
      url.pathname === '/share' ||
      url.pathname === './share' ||
      url.hash.includes('/share')
    ) {
      result.type = 'share';
      result.path = '/share';
      return result;
    }

    // Default to parsing hash for internal navigation
    const hashPath = url.hash.replace('#', '') || '/';
    result.path = hashPath.startsWith('/') ? hashPath : `/${  hashPath}`;
  } catch (error) {
    console.error('[History] Failed to parse deep link:', uri, error);
  }

  return result;
}

/**
 * Handle deep link on app launch
 */
export function handleInitialDeepLink(): DeepLinkResult | null {
  if (typeof window === 'undefined') return null;

  const fullUrl = window.location.href;
  const searchParams = window.location.search;
  const hash = window.location.hash;

  // Check for query parameters first
  if (searchParams) {
    const result = parseDeepLink(fullUrl);
    if (result.type !== 'unknown') {
      return result;
    }
  }

  // Check for hash-based deep link
  if (hash && hash !== '#' && hash !== '#/') {
    return parseDeepLink(fullUrl);
  }

  return null;
}

// ============================================================================
// Singleton Export
// ============================================================================

// Create singleton instance
const hashHistory = new HashHistory();

// Initialize tracking of current path
if (typeof window !== 'undefined') {
  // Set initial path if no hash
  if (!window.location.hash) {
    hashHistory.replace('/');
  }
}

export { hashHistory };

// Convenience methods
export const push = hashHistory.push.bind(hashHistory);
export const replace = hashHistory.replace.bind(hashHistory);
export const back = hashHistory.back.bind(hashHistory);
export const forward = hashHistory.forward.bind(hashHistory);
export const go = hashHistory.go.bind(hashHistory);
export const listen = hashHistory.listen.bind(hashHistory);
export const getCurrentPath = hashHistory.getCurrentPath.bind(hashHistory);
export const getCurrentState = hashHistory.getCurrentState.bind(hashHistory);
export const canGoBack = hashHistory.canGoBack.bind(hashHistory);
