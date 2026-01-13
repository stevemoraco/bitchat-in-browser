/**
 * BitChat In Browser - Router Configuration
 *
 * Configures preact-router for the PWA with hash-based routing
 * to support IPFS hosting and deep links.
 *
 * Routes:
 * - /onboarding - Onboarding flow
 * - /channels - Channels list
 * - /channels/:id - Channel chat view
 * - /messages - Direct messages list
 * - /messages/:pubkey - DM chat view
 * - /peers - Peers list
 * - /peers/:fingerprint - Peer profile
 * - /settings - Settings page
 * - /settings/* - Settings subsections
 * - /download - Native app download page
 * - /share - P2P sharing page
 */

import { FunctionComponent, ComponentChildren } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import Router, { Route, RouterOnChangeArgs } from 'preact-router';
import {
  hashHistory,
  push,
  replace,
  back,
  getCurrentPath as getHistoryPath,
  listen,
} from './history';
import { AuthGuard, OnboardingGuard } from './guards';

// ============================================================================
// Types
// ============================================================================

export interface RouteParams {
  id?: string;
  pubkey?: string;
  fingerprint?: string;
  section?: string;
  /** Catch-all for settings subsections */
  '*'?: string;
}

export interface RouteComponentProps<T = RouteParams> {
  path?: string;
  matches?: T;
  url?: string;
}

// ============================================================================
// Route Definitions
// ============================================================================

export const ROUTES = {
  ONBOARDING: '/onboarding',
  CHANNELS: '/channels',
  CHANNEL_DETAIL: '/channels/:id',
  MESSAGES: '/messages',
  MESSAGE_DETAIL: '/messages/:pubkey',
  PEERS: '/peers',
  PEER_DETAIL: '/peers/:fingerprint',
  SETTINGS: '/settings',
  SETTINGS_SECTION: '/settings/:section*',
  DOWNLOAD: '/download',
  SHARE: '/share',
  HOME: '/',
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

// ============================================================================
// History Wrapper for preact-router compatibility
// ============================================================================

/**
 * Creates a history object compatible with preact-router
 * Uses the hashHistory singleton from ./history
 */
const routerHistory = {
  get location() {
    return { pathname: getHistoryPath() };
  },
  getCurrentLocation() {
    return { pathname: getHistoryPath() };
  },
  listen(callback: (location: { pathname: string }) => void) {
    return listen((event) => {
      callback({ pathname: event.to });
    });
  },
  push(path: string) {
    push(path);
  },
  replace(pathToReplace: string) {
    replace(pathToReplace);
  },
};

// ============================================================================
// Scroll Position Management
// ============================================================================

const scrollPositions = new Map<string, number>();

/**
 * Save scroll position for current route
 */
function saveScrollPosition(path: string): void {
  const scrollContainer = document.querySelector('[data-scroll-container]');
  if (scrollContainer) {
    scrollPositions.set(path, scrollContainer.scrollTop);
  }
}

/**
 * Restore scroll position for route
 */
function restoreScrollPosition(path: string): void {
  const scrollContainer = document.querySelector('[data-scroll-container]');
  if (scrollContainer) {
    const savedPosition = scrollPositions.get(path);
    if (savedPosition !== undefined) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        scrollContainer.scrollTop = savedPosition;
      });
    } else {
      // Scroll to top for new routes
      scrollContainer.scrollTop = 0;
    }
  }
}

// ============================================================================
// 404 Not Found Component
// ============================================================================

interface NotFoundProps extends RouteComponentProps {
  default?: boolean;
}

const NotFound: FunctionComponent<NotFoundProps> = () => {
  const handleGoHome = useCallback(() => {
    push(ROUTES.CHANNELS);
  }, []);

  return (
    <div class="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
      <div class="text-6xl mb-4 text-terminal-green/50">[404]</div>
      <h1 class="text-2xl font-bold mb-2">&gt; Route Not Found</h1>
      <p class="text-terminal-green/70 mb-6 max-w-md">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <button onClick={handleGoHome} class="btn-terminal">
        [BACK TO CHANNELS]
      </button>
    </div>
  );
};

// ============================================================================
// Router Component
// ============================================================================

interface AppRouterProps {
  /**
   * Called when route changes
   */
  onRouteChange?: (args: RouterOnChangeArgs) => void;

  /**
   * Route components mapped by path
   */
  children: ComponentChildren;
}

export const AppRouter: FunctionComponent<AppRouterProps> = ({
  onRouteChange,
  children,
}) => {
  const [currentPath, setCurrentPath] = useState(getHistoryPath());

  // Handle route changes
  const handleRouteChange = useCallback(
    (args: RouterOnChangeArgs) => {
      const previousPath = currentPath;
      const newPath = args.url;

      // Save scroll position of previous route
      saveScrollPosition(previousPath);

      // Update current path
      setCurrentPath(newPath);

      // Restore scroll position for new route
      restoreScrollPosition(newPath);

      // Call external handler if provided
      if (onRouteChange) {
        onRouteChange(args);
      }
    },
    [currentPath, onRouteChange]
  );

  // Listen to history changes (browser back/forward)
  useEffect(() => {
    const unsubscribe = listen((event) => {
      setCurrentPath(event.to);
    });

    return unsubscribe;
  }, []);

  return (
    <Router history={routerHistory as any} onChange={handleRouteChange}>
      {children}
      <NotFound default />
    </Router>
  );
};

// ============================================================================
// Protected Route Wrapper
// ============================================================================

interface ProtectedRouteProps extends RouteComponentProps {
  component: FunctionComponent<RouteComponentProps>;
  guard?: 'auth' | 'onboarding';
}

/**
 * Wraps a route component with guards
 */
export const ProtectedRoute: FunctionComponent<ProtectedRouteProps> = ({
  component: Component,
  guard,
  path,
  ...props
}) => {
  // Combine route props for the component
  const routeProps: RouteComponentProps = {
    path,
    ...props,
  };

  // No guard, render directly
  if (!guard) {
    return <Component {...routeProps} />;
  }

  // Auth guard - redirect to onboarding if no identity
  if (guard === 'auth') {
    return (
      <AuthGuard redirectTo={ROUTES.ONBOARDING}>
        <Component {...routeProps} />
      </AuthGuard>
    );
  }

  // Onboarding guard - redirect to channels if already onboarded
  if (guard === 'onboarding') {
    return (
      <OnboardingGuard redirectTo={ROUTES.CHANNELS}>
        <Component {...routeProps} />
      </OnboardingGuard>
    );
  }

  return <Component {...routeProps} />;
};

// ============================================================================
// Route Helper Functions
// ============================================================================

/**
 * Navigate to a route
 */
export function navigate(path: string, shouldReplace = false): void {
  if (shouldReplace) {
    replace(path);
  } else {
    push(path);
  }
}

/**
 * Navigate back in history
 */
export function goBack(): void {
  back();
}

/**
 * Build a channel route
 */
export function channelRoute(channelId: string): string {
  return `${ROUTES.CHANNELS}/${encodeURIComponent(channelId)}`;
}

/**
 * Build a message route
 */
export function messageRoute(pubkey: string): string {
  return `${ROUTES.MESSAGES}/${encodeURIComponent(pubkey)}`;
}

/**
 * Build a peer route
 */
export function peerRoute(fingerprint: string): string {
  return `${ROUTES.PEERS}/${encodeURIComponent(fingerprint)}`;
}

/**
 * Build a settings section route
 */
export function settingsRoute(section?: string): string {
  if (section) {
    return `${ROUTES.SETTINGS}/${section}`;
  }
  return ROUTES.SETTINGS;
}

/**
 * Get current route path
 */
export function getCurrentPath(): string {
  return getHistoryPath();
}

/**
 * Check if current path matches a route pattern
 */
export function isCurrentRoute(pattern: string | RegExp): boolean {
  const currentPath = getCurrentPath();

  if (typeof pattern === 'string') {
    // Convert route pattern to regex
    const regexPattern = pattern
      .replace(/:[^/]+/g, '[^/]+') // Replace :param with regex
      .replace(/\*/g, '.*'); // Replace * with wildcard
    return new RegExp(`^${regexPattern}$`).test(currentPath);
  }

  return pattern.test(currentPath);
}

// ============================================================================
// Exports
// ============================================================================

export { hashHistory, Route };
export type { RouterOnChangeArgs };
