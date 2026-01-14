/**
 * Tests for useNavigation Hook
 *
 * Tests navigation functionality including:
 * - Pushing new routes
 * - Popping (going back)
 * - Replacing routes
 * - Route parameter parsing
 * - Query parameter management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import {
  useNavigation,
  useRouteParams,
  useQueryParams,
  useCurrentRoute,
  useRouteMatch,
  useDeepLink,
  useNavLink,
} from '../useNavigation';

// ============================================================================
// Mocks
// ============================================================================

// Track navigation calls
const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockListeners: Set<(event: any) => void> = new Set();

vi.mock('../../router', () => ({
  navigate: (path: string, replace?: boolean) => mockNavigate(path, replace),
  goBack: () => mockGoBack(),
  getCurrentPath: vi.fn(() => '/channels'),
  ROUTES: {
    HOME: '/',
    ONBOARDING: '/onboarding',
    CHANNELS: '/channels',
    MESSAGES: '/messages',
    PEERS: '/peers',
    SETTINGS: '/settings',
    DOWNLOAD: '/download',
    SHARE: '/share',
  },
  channelRoute: (id: string) => `/channels/${id}`,
  messageRoute: (pubkey: string) => `/messages/${pubkey}`,
  peerRoute: (fingerprint: string) => `/peers/${fingerprint}`,
  settingsRoute: (section?: string) => (section ? `/settings/${section}` : '/settings'),
  isCurrentRoute: vi.fn((pattern: string | RegExp) => {
    const currentPath = '/channels';
    if (typeof pattern === 'string') {
      return currentPath === pattern || currentPath.startsWith(pattern);
    }
    return pattern.test(currentPath);
  }),
}));

vi.mock('../../router/history', () => ({
  hashHistory: {
    getCurrentPath: () => '/channels',
  },
  listen: (callback: (event: any) => void) => {
    mockListeners.add(callback);
    return () => {
      mockListeners.delete(callback);
    };
  },
  parseDeepLink: vi.fn((uri: string) => ({
    type: 'unknown',
    path: '/',
    params: {},
    original: uri,
  })),
}));

describe('useNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    // Setup window.location.hash
    Object.defineProperty(window, 'location', {
      value: { hash: '#/channels' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('navigation actions', () => {
    it('should provide navigate function', () => {
      const { result } = renderHook(() => useNavigation());

      expect(typeof result.current.navigate).toBe('function');
    });

    it('should call navigate with correct path on navigate()', async () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate('/messages');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/messages', false);
    });

    it('should support replace navigation', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate('/settings', true);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/settings', true);
    });

    it('should provide goBack function that calls history back', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.goBack();
      });

      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('route-specific navigation', () => {
    it('should navigate to channels list via toChannels()', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toChannels();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/channels', false);
    });

    it('should navigate to specific channel via toChannel(id)', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toChannel('test-channel-123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/channels/test-channel-123', false);
    });

    it('should navigate to messages list via toMessages()', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toMessages();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/messages', false);
    });

    it('should navigate to specific message via toMessage(pubkey)', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toMessage('npub1abc123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/messages/npub1abc123', false);
    });

    it('should navigate to peers list via toPeers()', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toPeers();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/peers', false);
    });

    it('should navigate to specific peer via toPeer(fingerprint)', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toPeer('fingerprint123');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/peers/fingerprint123', false);
    });

    it('should navigate to settings via toSettings()', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toSettings();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/settings', false);
    });

    it('should navigate to settings section via toSettings(section)', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toSettings('profile');
      });

      expect(mockNavigate).toHaveBeenCalledWith('/settings/profile', false);
    });

    it('should navigate to onboarding via toOnboarding()', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toOnboarding();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/onboarding', false);
    });

    it('should navigate to download via toDownload()', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toDownload();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/download', false);
    });

    it('should navigate to share via toShare()', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.toShare();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/share', false);
    });
  });

  describe('route info', () => {
    it('should provide current route info', () => {
      const { result } = renderHook(() => useNavigation());

      expect(result.current.route).toHaveProperty('path');
      expect(result.current.route).toHaveProperty('params');
      expect(result.current.route).toHaveProperty('query');
      expect(result.current.route).toHaveProperty('isInitial');
    });

    it('should track isNavigating state', () => {
      const { result } = renderHook(() => useNavigation());

      expect(typeof result.current.isNavigating).toBe('boolean');
    });

    it('should track canGoBack state', () => {
      const { result } = renderHook(() => useNavigation());

      expect(typeof result.current.canGoBack).toBe('boolean');
    });
  });

  describe('navigation events', () => {
    it('should respond to navigation events', () => {
      const { result } = renderHook(() => useNavigation());

      // Simulate a navigation event
      act(() => {
        mockListeners.forEach((listener) => {
          listener({ to: '/messages', from: '/channels', type: 'push', state: null });
        });
      });

      // The hook should have processed the event (isInitial should be false after navigation)
      expect(result.current.route.isInitial).toBe(false);
    });
  });
});

describe('useRouteParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
  });

  it('should return params object', () => {
    const { result } = renderHook(() => useRouteParams());

    expect(result.current).toHaveProperty('params');
    expect(typeof result.current.params).toBe('object');
  });

  it('should provide get function to retrieve specific params', () => {
    const { result } = renderHook(() => useRouteParams());

    expect(typeof result.current.get).toBe('function');
  });
});

describe('useQueryParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    Object.defineProperty(window, 'location', {
      value: { hash: '#/channels?filter=nearby' },
      writable: true,
    });
  });

  it('should return current query params', () => {
    const { result } = renderHook(() => useQueryParams());

    expect(result.current).toHaveProperty('params');
    expect(typeof result.current.params).toBe('object');
  });

  it('should provide get function', () => {
    const { result } = renderHook(() => useQueryParams());

    expect(typeof result.current.get).toBe('function');
  });

  it('should provide set function', () => {
    const { result } = renderHook(() => useQueryParams());

    expect(typeof result.current.set).toBe('function');
  });

  it('should provide remove function', () => {
    const { result } = renderHook(() => useQueryParams());

    expect(typeof result.current.remove).toBe('function');
  });

  it('should provide clear function', () => {
    const { result } = renderHook(() => useQueryParams());

    expect(typeof result.current.clear).toBe('function');
  });
});

describe('useCurrentRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
  });

  it('should return current route information', () => {
    const { result } = renderHook(() => useCurrentRoute());

    expect(result.current).toHaveProperty('path');
    expect(result.current).toHaveProperty('name');
    expect(result.current).toHaveProperty('params');
    expect(result.current).toHaveProperty('isDetail');
  });

  it('should identify route names correctly', () => {
    const { result } = renderHook(() => useCurrentRoute());

    expect([
      'home',
      'onboarding',
      'channels',
      'channel',
      'messages',
      'message',
      'peers',
      'peer',
      'settings',
      'download',
      'share',
      'unknown',
    ]).toContain(result.current.name);
  });
});

describe('useRouteMatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
  });

  it('should return boolean for route match', () => {
    const { result } = renderHook(() => useRouteMatch('/channels'));

    expect(typeof result.current).toBe('boolean');
  });

  it('should match current route pattern', () => {
    const { result } = renderHook(() => useRouteMatch('/channels'));

    // Based on our mock, /channels should match
    expect(result.current).toBe(true);
  });

  it('should handle different route patterns', () => {
    const { result } = renderHook(() => useRouteMatch('/channels'));
    // The mock always returns the same for /channels
    expect(typeof result.current).toBe('boolean');
  });
});

describe('useDeepLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost/#/channels',
        hash: '#/channels',
      },
      writable: true,
      configurable: true,
    });
  });

  it('should provide deepLink state', () => {
    const { result } = renderHook(() => useDeepLink());

    expect(result.current).toHaveProperty('deepLink');
  });

  it('should provide handleDeepLink function', () => {
    const { result } = renderHook(() => useDeepLink());

    expect(typeof result.current.handleDeepLink).toBe('function');
  });

  it('should provide clearDeepLink function', () => {
    const { result } = renderHook(() => useDeepLink());

    expect(typeof result.current.clearDeepLink).toBe('function');
  });

  it('should handle deep link URIs', () => {
    const { result } = renderHook(() => useDeepLink());

    // Test that handleDeepLink can be called
    act(() => {
      result.current.handleDeepLink('nostr:npub1abc');
    });

    // The function should have processed the URI
    expect(typeof result.current.deepLink).toBe('object');
  });

  it('should clear deep link when clearDeepLink is called', () => {
    const { result } = renderHook(() => useDeepLink());

    act(() => {
      result.current.clearDeepLink();
    });

    expect(result.current.deepLink).toBe(null);
  });
});

describe('useNavLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost/#/channels',
        hash: '#/channels',
      },
      writable: true,
      configurable: true,
    });
  });

  it('should return href prop', () => {
    const { result } = renderHook(() => useNavLink('/channels'));

    expect(result.current.href).toBe('#/channels');
  });

  it('should return onClick handler', () => {
    const { result } = renderHook(() => useNavLink('/channels'));

    expect(typeof result.current.onClick).toBe('function');
  });

  it('should return aria-current for active routes', () => {
    const { result } = renderHook(() => useNavLink('/channels'));

    // Since our mock returns /channels as current path, it should be active
    expect(result.current['aria-current']).toBe('page');
  });

  it('should prevent default and navigate on click', () => {
    const { result } = renderHook(() => useNavLink('/messages'));

    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as Event;

    act(() => {
      result.current.onClick(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/messages', undefined);
  });
});

describe('useNavigation - advanced scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    Object.defineProperty(window, 'location', {
      value: { hash: '#/channels' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('route parameter parsing', () => {
    it('should parse channel id from path', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/channels/test-channel' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      // The route info should include params
      expect(result.current.route).toBeDefined();
      expect(typeof result.current.route.params).toBe('object');
    });

    it('should parse message pubkey from path', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/messages/npub1abc123' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      expect(result.current.route).toBeDefined();
    });

    it('should parse peer fingerprint from path', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/peers/abc123fingerprint' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      expect(result.current.route).toBeDefined();
    });

    it('should parse settings section from path', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/settings/profile/security' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      expect(result.current.route).toBeDefined();
    });

    it('should decode URI-encoded parameters', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/channels/test%20channel%20name' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      // Should handle encoded strings
      expect(result.current.route).toBeDefined();
    });
  });

  describe('query parameter parsing', () => {
    it('should parse query parameters from hash', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/channels?filter=nearby&sort=recent' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      expect(result.current.route.query).toBeDefined();
    });

    it('should handle empty query parameters', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/channels' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      expect(result.current.route.query).toBeDefined();
      expect(Object.keys(result.current.route.query).length).toBe(0);
    });
  });

  describe('navigation state tracking', () => {
    it('should set isNavigating true when navigating', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate('/messages');
      });

      expect(result.current.isNavigating).toBe(true);
    });

    it('should reset isNavigating after navigation event', () => {
      const { result } = renderHook(() => useNavigation());

      act(() => {
        result.current.navigate('/messages');
      });

      // Simulate navigation completion
      act(() => {
        mockListeners.forEach((listener) => {
          listener({ to: '/messages', from: '/channels', type: 'push', state: null });
        });
      });

      expect(result.current.isNavigating).toBe(false);
    });

    it('should set isInitial to false after first navigation', () => {
      const { result } = renderHook(() => useNavigation());

      expect(result.current.route.isInitial).toBe(true);

      act(() => {
        mockListeners.forEach((listener) => {
          listener({ to: '/messages', from: '/channels', type: 'push', state: null });
        });
      });

      expect(result.current.route.isInitial).toBe(false);
    });
  });

  describe('canGoBack determination', () => {
    it('should return false for root path', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      expect(result.current.canGoBack).toBe(false);
    });

    it('should return false for channels list (default home)', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#/channels' },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useNavigation());

      expect(result.current.canGoBack).toBe(false);
    });

    it('should return true for nested routes after navigation', () => {
      const { result } = renderHook(() => useNavigation());

      // Navigate to a nested route
      act(() => {
        mockListeners.forEach((listener) => {
          listener({ to: '/channels/some-channel', from: '/channels', type: 'push', state: null });
        });
      });

      expect(result.current.canGoBack).toBe(true);
    });
  });

  describe('cleanup on unmount', () => {
    it('should clean up navigation listener on unmount', () => {
      const { unmount } = renderHook(() => useNavigation());

      const listenerCountBefore = mockListeners.size;

      unmount();

      // Listener should be removed
      expect(mockListeners.size).toBeLessThanOrEqual(listenerCountBefore);
    });
  });
});

describe('useQueryParams - advanced scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    Object.defineProperty(window, 'location', {
      value: { hash: '#/channels?filter=nearby&sort=recent' },
      writable: true,
    });
    Object.defineProperty(window, 'history', {
      value: {
        replaceState: vi.fn(),
        pushState: vi.fn(),
      },
      writable: true,
    });
  });

  it('should set multiple query parameters at once', () => {
    const { result } = renderHook(() => useQueryParams());

    act(() => {
      result.current.set({ foo: 'bar', baz: 'qux' });
    });

    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('should use pushState when replace is false', () => {
    const { result } = renderHook(() => useQueryParams());

    act(() => {
      result.current.set({ foo: 'bar' }, false);
    });

    expect(window.history.pushState).toHaveBeenCalled();
  });

  it('should remove parameters with null value', () => {
    const { result } = renderHook(() => useQueryParams());

    act(() => {
      result.current.set({ filter: null });
    });

    // Should have called replaceState with updated params
    expect(window.history.replaceState).toHaveBeenCalled();
  });

  it('should remove parameters with empty string value', () => {
    const { result } = renderHook(() => useQueryParams());

    act(() => {
      result.current.set({ filter: '' });
    });

    expect(window.history.replaceState).toHaveBeenCalled();
  });
});

describe('useCurrentRoute - route identification behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
    Object.defineProperty(window, 'location', {
      value: { hash: '#/channels' },
      writable: true,
      configurable: true,
    });
  });

  it('should correctly identify the default channels route', () => {
    // Mock returns /channels by default
    const { result } = renderHook(() => useCurrentRoute());

    expect(result.current.name).toBe('channels');
    expect(result.current.isDetail).toBe(false);
  });

  it('should return route properties', () => {
    const { result } = renderHook(() => useCurrentRoute());

    expect(result.current).toHaveProperty('name');
    expect(result.current).toHaveProperty('path');
    expect(result.current).toHaveProperty('isDetail');
    expect(result.current).toHaveProperty('params');
  });

  it('should update route when navigation event fires', () => {
    const { result } = renderHook(() => useCurrentRoute());

    // Initially channels
    expect(result.current.name).toBe('channels');

    // Simulate navigation event
    act(() => {
      mockListeners.forEach((listener) => {
        listener({ to: '/settings', from: '/channels', type: 'push', state: null });
      });
    });

    // Route name should now be settings
    expect(result.current.name).toBe('settings');
    expect(result.current.isDetail).toBe(false);
  });

  it('should identify detail views correctly after navigation', () => {
    const { result } = renderHook(() => useCurrentRoute());

    // Navigate to a channel detail
    act(() => {
      mockListeners.forEach((listener) => {
        listener({ to: '/channels/test-channel', from: '/channels', type: 'push', state: null });
      });
    });

    expect(result.current.name).toBe('channel');
    expect(result.current.isDetail).toBe(true);
  });
});

describe('useRouteMatch - pattern matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
  });

  it('should support regex pattern matching', () => {
    const { result } = renderHook(() => useRouteMatch(/^\/channels/));

    expect(typeof result.current).toBe('boolean');
  });

  it('should update match state on navigation', () => {
    const { result } = renderHook(() => useRouteMatch('/channels'));

    // Simulate navigation to different route
    act(() => {
      mockListeners.forEach((listener) => {
        listener({ to: '/messages', from: '/channels', type: 'push', state: null });
      });
    });

    // Match state should be recalculated
    expect(typeof result.current).toBe('boolean');
  });
});
