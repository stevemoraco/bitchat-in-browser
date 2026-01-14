/**
 * Navigation Hooks for BitChat In Browser
 *
 * Provides navigation helpers for routing:
 * - useNavigation: Main navigation actions
 * - useRouteParams: Access route parameters
 * - useQueryParams: Access and modify query parameters
 * - useCurrentRoute: Get current route information
 * - useRouteMatch: Check if route matches pattern
 *
 * @module hooks/useNavigation
 */

import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  navigate,
  goBack,
  getCurrentPath,
  ROUTES,
  channelRoute,
  messageRoute,
  peerRoute,
  settingsRoute,
  isCurrentRoute,
} from '../router';
import {
  hashHistory,
  listen,
  parseDeepLink,
  type NavigationEvent,
  type DeepLinkResult,
} from '../router/history';

// ============================================================================
// Types
// ============================================================================

export interface NavigationActions {
  /** Navigate to a path */
  navigate: (path: string, replace?: boolean) => void;
  /** Go back in history */
  goBack: () => void;
  /** Navigate to channels list */
  toChannels: () => void;
  /** Navigate to a specific channel */
  toChannel: (channelId: string) => void;
  /** Navigate to messages list */
  toMessages: () => void;
  /** Navigate to a DM conversation */
  toMessage: (pubkey: string) => void;
  /** Navigate to peers list */
  toPeers: () => void;
  /** Navigate to a peer profile */
  toPeer: (fingerprint: string) => void;
  /** Navigate to settings */
  toSettings: (section?: string) => void;
  /** Navigate to onboarding */
  toOnboarding: () => void;
  /** Navigate to download page */
  toDownload: () => void;
  /** Navigate to share page */
  toShare: () => void;
}

export interface RouteInfo {
  /** Current path */
  path: string;
  /** Route parameters */
  params: Record<string, string>;
  /** Query parameters */
  query: Record<string, string>;
  /** Whether this is the initial route */
  isInitial: boolean;
}

export interface UseNavigationReturn extends NavigationActions {
  /** Current route info */
  route: RouteInfo;
  /** Whether navigation is in progress */
  isNavigating: boolean;
  /** Whether we can go back */
  canGoBack: boolean;
}

export interface UseRouteParamsReturn<T = Record<string, string>> {
  /** Parsed route parameters */
  params: T;
  /** Get a specific parameter */
  get: (key: keyof T) => string | undefined;
}

export interface UseQueryParamsReturn {
  /** Current query parameters */
  params: Record<string, string>;
  /** Get a specific query parameter */
  get: (key: string) => string | undefined;
  /** Set query parameters */
  set: (updates: Record<string, string | null>, replace?: boolean) => void;
  /** Remove a query parameter */
  remove: (key: string) => void;
  /** Clear all query parameters */
  clear: () => void;
}

// ============================================================================
// useNavigation Hook
// ============================================================================

/**
 * Main navigation hook providing navigation actions and route info
 */
export function useNavigation(): UseNavigationReturn {
  const [currentPath, setCurrentPath] = useState(getCurrentPath());
  const [isNavigating, setIsNavigating] = useState(false);
  const [isInitial, setIsInitial] = useState(true);

  // Listen to navigation events
  useEffect(() => {
    const unsubscribe = listen((event: NavigationEvent) => {
      setCurrentPath(event.to);
      setIsInitial(false);
      setIsNavigating(false);
    });

    return unsubscribe;
  }, []);

  // Parse route params from current path
  const routeInfo = useMemo((): RouteInfo => {
    const path = currentPath;
    const params: Record<string, string> = {};
    const query: Record<string, string> = {};

    // Parse path parameters based on common patterns
    // /channels/:id
    const channelMatch = path.match(/^\/channels\/([^/?]+)/);
    if (channelMatch) {
      params.id = decodeURIComponent(channelMatch[1]);
    }

    // /messages/:pubkey
    const messageMatch = path.match(/^\/messages\/([^/?]+)/);
    if (messageMatch) {
      params.pubkey = decodeURIComponent(messageMatch[1]);
    }

    // /peers/:fingerprint
    const peerMatch = path.match(/^\/peers\/([^/?]+)/);
    if (peerMatch) {
      params.fingerprint = decodeURIComponent(peerMatch[1]);
    }

    // /settings/:section (or /settings/section/subsection)
    const settingsMatch = path.match(/^\/settings\/(.+)/);
    if (settingsMatch) {
      params.section = decodeURIComponent(settingsMatch[1]);
    }

    // Parse query parameters from hash
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const queryIndex = hash.indexOf('?');
      if (queryIndex !== -1) {
        const queryString = hash.slice(queryIndex + 1);
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((value, key) => {
          query[key] = value;
        });
      }
    }

    return {
      path,
      params,
      query,
      isInitial,
    };
  }, [currentPath, isInitial]);

  // Navigation actions
  const doNavigate = useCallback((path: string, replace = false) => {
    setIsNavigating(true);
    navigate(path, replace);
  }, []);

  const doGoBack = useCallback(() => {
    setIsNavigating(true);
    goBack();
  }, []);

  const toChannels = useCallback(() => {
    doNavigate(ROUTES.CHANNELS);
  }, [doNavigate]);

  const toChannel = useCallback(
    (channelId: string) => {
      doNavigate(channelRoute(channelId));
    },
    [doNavigate]
  );

  const toMessages = useCallback(() => {
    doNavigate(ROUTES.MESSAGES);
  }, [doNavigate]);

  const toMessage = useCallback(
    (pubkey: string) => {
      doNavigate(messageRoute(pubkey));
    },
    [doNavigate]
  );

  const toPeers = useCallback(() => {
    doNavigate(ROUTES.PEERS);
  }, [doNavigate]);

  const toPeer = useCallback(
    (fingerprint: string) => {
      doNavigate(peerRoute(fingerprint));
    },
    [doNavigate]
  );

  const toSettings = useCallback(
    (section?: string) => {
      doNavigate(settingsRoute(section));
    },
    [doNavigate]
  );

  const toOnboarding = useCallback(() => {
    doNavigate(ROUTES.ONBOARDING);
  }, [doNavigate]);

  const toDownload = useCallback(() => {
    doNavigate(ROUTES.DOWNLOAD);
  }, [doNavigate]);

  const toShare = useCallback(() => {
    doNavigate(ROUTES.SHARE);
  }, [doNavigate]);

  // Check if we can go back
  const canGoBack = useMemo(() => currentPath !== '/' && currentPath !== ROUTES.CHANNELS, [currentPath]);

  return {
    navigate: doNavigate,
    goBack: doGoBack,
    toChannels,
    toChannel,
    toMessages,
    toMessage,
    toPeers,
    toPeer,
    toSettings,
    toOnboarding,
    toDownload,
    toShare,
    route: routeInfo,
    isNavigating,
    canGoBack,
  };
}

// ============================================================================
// useRouteParams Hook
// ============================================================================

/**
 * Access route parameters from the current path
 */
export function useRouteParams<
  T extends Record<string, string> = Record<string, string>
>(): UseRouteParamsReturn<T> {
  const { route } = useNavigation();

  const get = useCallback(
    (key: keyof T): string | undefined => route.params[key as string],
    [route.params]
  );

  return {
    params: route.params as T,
    get,
  };
}

// ============================================================================
// useQueryParams Hook
// ============================================================================

/**
 * Access and modify query parameters
 */
export function useQueryParams(): UseQueryParamsReturn {
  const [params, setParams] = useState<Record<string, string>>({});

  // Parse query params on mount and changes
  useEffect(() => {
    const parseQueryParams = () => {
      if (typeof window === 'undefined') return;

      const hash = window.location.hash;
      const queryIndex = hash.indexOf('?');
      const newParams: Record<string, string> = {};

      if (queryIndex !== -1) {
        const queryString = hash.slice(queryIndex + 1);
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((value, key) => {
          newParams[key] = value;
        });
      }

      setParams(newParams);
    };

    parseQueryParams();

    const unsubscribe = listen(() => {
      parseQueryParams();
    });

    return unsubscribe;
  }, []);

  const get = useCallback(
    (key: string): string | undefined => params[key],
    [params]
  );

  const set = useCallback(
    (updates: Record<string, string | null>, replace = true) => {
      if (typeof window === 'undefined') return;

      const currentPath = getCurrentPath();
      const newParams = { ...params };

      // Apply updates
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') {
          delete newParams[key];
        } else {
          newParams[key] = value;
        }
      });

      // Build new hash
      let newHash = `#${currentPath}`;
      const queryPairs = Object.entries(newParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');

      if (queryPairs) {
        newHash += `?${queryPairs}`;
      }

      if (replace) {
        window.history.replaceState(null, '', newHash);
      } else {
        window.history.pushState(null, '', newHash);
      }

      setParams(newParams);
    },
    [params]
  );

  const remove = useCallback(
    (key: string) => {
      set({ [key]: null });
    },
    [set]
  );

  const clear = useCallback(() => {
    if (typeof window === 'undefined') return;

    const currentPath = getCurrentPath();
    window.history.replaceState(null, '', `#${currentPath}`);
    setParams({});
  }, []);

  return {
    params,
    get,
    set,
    remove,
    clear,
  };
}

// ============================================================================
// useCurrentRoute Hook
// ============================================================================

export interface CurrentRoute {
  /** Current path */
  path: string;
  /** Route name/type */
  name:
    | 'onboarding'
    | 'channels'
    | 'channel'
    | 'messages'
    | 'message'
    | 'peers'
    | 'peer'
    | 'settings'
    | 'download'
    | 'share'
    | 'home'
    | 'unknown';
  /** Route parameters */
  params: Record<string, string>;
  /** Whether this is a detail view */
  isDetail: boolean;
}

/**
 * Get structured information about the current route
 */
export function useCurrentRoute(): CurrentRoute {
  const { route } = useNavigation();

  return useMemo(() => {
    const path = route.path;
    let name: CurrentRoute['name'] = 'unknown';
    let isDetail = false;

    if (path === '/' || path === ROUTES.HOME) {
      name = 'home';
    } else if (path === ROUTES.ONBOARDING) {
      name = 'onboarding';
    } else if (path === ROUTES.CHANNELS) {
      name = 'channels';
    } else if (path.startsWith(`${ROUTES.CHANNELS  }/`)) {
      name = 'channel';
      isDetail = true;
    } else if (path === ROUTES.MESSAGES) {
      name = 'messages';
    } else if (path.startsWith(`${ROUTES.MESSAGES  }/`)) {
      name = 'message';
      isDetail = true;
    } else if (path === ROUTES.PEERS) {
      name = 'peers';
    } else if (path.startsWith(`${ROUTES.PEERS  }/`)) {
      name = 'peer';
      isDetail = true;
    } else if (path === ROUTES.SETTINGS || path.startsWith(`${ROUTES.SETTINGS  }/`)) {
      name = 'settings';
      isDetail = path !== ROUTES.SETTINGS;
    } else if (path === ROUTES.DOWNLOAD) {
      name = 'download';
    } else if (path === ROUTES.SHARE) {
      name = 'share';
    }

    return {
      path,
      name,
      params: route.params,
      isDetail,
    };
  }, [route.path, route.params]);
}

// ============================================================================
// useRouteMatch Hook
// ============================================================================

/**
 * Check if current route matches a pattern
 */
export function useRouteMatch(pattern: string | RegExp): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const checkMatch = () => {
      setMatches(isCurrentRoute(pattern));
    };

    checkMatch();

    const unsubscribe = listen(() => {
      checkMatch();
    });

    return unsubscribe;
  }, [pattern]);

  return matches;
}

// ============================================================================
// useDeepLink Hook
// ============================================================================

export interface UseDeepLinkReturn {
  /** Parsed deep link result */
  deepLink: DeepLinkResult | null;
  /** Handle a deep link */
  handleDeepLink: (uri: string) => void;
  /** Clear the current deep link */
  clearDeepLink: () => void;
}

/**
 * Handle deep links and Nostr URIs
 */
export function useDeepLink(): UseDeepLinkReturn {
  const [deepLink, setDeepLink] = useState<DeepLinkResult | null>(null);
  const { navigate: doNavigate } = useNavigation();

  // Check for deep link on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const fullUrl = window.location.href;
    const result = parseDeepLink(fullUrl);

    if (result.type !== 'unknown') {
      setDeepLink(result);
    }
  }, []);

  const handleDeepLink = useCallback(
    (uri: string) => {
      const result = parseDeepLink(uri);
      setDeepLink(result);

      // Navigate to the parsed path
      if (result.path && result.path !== '/') {
        doNavigate(result.path);
      }
    },
    [doNavigate]
  );

  const clearDeepLink = useCallback(() => {
    setDeepLink(null);
  }, []);

  return {
    deepLink,
    handleDeepLink,
    clearDeepLink,
  };
}

// ============================================================================
// useNavigationListener Hook
// ============================================================================

/**
 * Listen to navigation events
 */
export function useNavigationListener(
  callback: (event: NavigationEvent) => void
): void {
  useEffect(() => {
    const unsubscribe = listen(callback);
    return unsubscribe;
  }, [callback]);
}

// ============================================================================
// Utility: Create navigation link props
// ============================================================================

export interface NavLinkProps {
  href: string;
  onClick: (e: Event) => void;
  'aria-current'?: 'page' | undefined;
}

/**
 * Create props for a navigation link
 */
export function useNavLink(
  to: string,
  options?: { replace?: boolean }
): NavLinkProps {
  const { route } = useNavigation();
  const isActive = route.path === to || route.path.startsWith(`${to  }/`);

  const handleClick = useCallback(
    (e: Event) => {
      e.preventDefault();
      navigate(to, options?.replace);
    },
    [to, options?.replace]
  );

  return {
    href: `#${to}`,
    onClick: handleClick,
    'aria-current': isActive ? 'page' : undefined,
  };
}
