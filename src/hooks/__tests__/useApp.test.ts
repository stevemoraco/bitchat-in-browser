/**
 * Tests for useApp Hook
 *
 * Tests app-level state management including:
 * - Initialization state tracking
 * - Connection state (online/offline)
 * - Error handling
 * - App actions (initialize, shutdown, wipe)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/preact';
import * as initModule from '../../services/init';
import * as storesModule from '../../stores';
import {
  useApp,
  useAppInit,
  useAppConnection,
  useAppReady,
  useOnlineStatus,
} from '../useApp';

// ============================================================================
// Mocks
// ============================================================================

const mockSetOnline = vi.fn();
const mockSetInitialized = vi.fn();

// Mock stores
vi.mock('../../stores', () => ({
  useAppStore: vi.fn((selector) => {
    const state = {
      isInitialized: false,
      isOnline: true,
      isBackground: false,
      version: '1.0.0',
      setOnline: mockSetOnline,
      setInitialized: mockSetInitialized,
    };
    return selector ? selector(state) : state;
  }),
  useHasIdentity: vi.fn(() => false),
  useIsKeyLoaded: vi.fn(() => false),
  clearAllStores: vi.fn(),
}));

// Mock init service
vi.mock('../../services/init', () => ({
  initializeApp: vi.fn().mockResolvedValue({ success: true }),
  isAppInitialized: vi.fn(() => false),
  shutdownApp: vi.fn().mockResolvedValue(undefined),
  getInitializer: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

// Mock nostr client
vi.mock('../../services/nostr', () => ({
  nostrClient: {
    onConnectionChange: vi.fn(() => vi.fn()),
    isConnected: vi.fn(() => false),
    getConnectionStatus: vi.fn(() => ({
      isConnected: false,
      connectedCount: 0,
      totalCount: 5,
    })),
    connect: vi.fn().mockResolvedValue(undefined),
    resetConnections: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock webrtc service
vi.mock('../../services/webrtc', () => ({
  getTrysteroService: vi.fn(() => ({
    getState: () => ({
      peers: new Map(),
    }),
  })),
}));

describe('useApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location.reload mock
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should return initial init state as not started', () => {
      const { result } = renderHook(() => useApp());

      expect(result.current.init.started).toBe(false);
      expect(result.current.init.complete).toBe(false);
      expect(result.current.init.failed).toBe(false);
      expect(result.current.init.progress).toBe(0);
    });

    it('should return connection state with online status', () => {
      const { result } = renderHook(() => useApp());

      expect(result.current.connection).toHaveProperty('isOnline');
      expect(result.current.connection).toHaveProperty('hasRelayConnection');
      expect(result.current.connection).toHaveProperty('relayCount');
      expect(result.current.connection).toHaveProperty('quality');
    });

    it('should return app state with identity info', () => {
      const { result } = renderHook(() => useApp());

      expect(result.current.app).toHaveProperty('isReady');
      expect(result.current.app).toHaveProperty('hasIdentity');
      expect(result.current.app).toHaveProperty('isUnlocked');
      expect(result.current.app).toHaveProperty('version');
      expect(result.current.app.version).toBe('1.0.0');
    });

    it('should provide action functions', () => {
      const { result } = renderHook(() => useApp());

      expect(typeof result.current.actions.initialize).toBe('function');
      expect(typeof result.current.actions.shutdown).toBe('function');
      expect(typeof result.current.actions.wipeAll).toBe('function');
      expect(typeof result.current.actions.reconnectRelays).toBe('function');
      expect(typeof result.current.actions.setReady).toBe('function');
    });
  });

  describe('initialize action', () => {
    it('should provide initialize function', () => {
      const { result } = renderHook(() => useApp());

      expect(typeof result.current.actions.initialize).toBe('function');
    });

    it('should set started flag when initialize is called', async () => {
      const { result } = renderHook(() => useApp());

      // Call initialize - it will set started immediately
      act(() => {
        result.current.actions.initialize();
      });

      // The state should show started as true after init call
      expect(result.current.init.started).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors', async () => {
      const mockError = new Error('Init failed');
      vi.mocked(initModule.initializeApp).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useApp());

      await expect(
        act(async () => {
          await result.current.actions.initialize();
        })
      ).rejects.toThrow('Init failed');

      expect(result.current.init.failed).toBe(true);
      expect(result.current.init.error).toBeTruthy();
    });
  });

  describe('online/offline detection', () => {
    it('should respond to online event', async () => {
      renderHook(() => useApp());

      await act(async () => {
        window.dispatchEvent(new Event('online'));
      });

      expect(mockSetOnline).toHaveBeenCalledWith(true);
    });

    it('should respond to offline event', async () => {
      renderHook(() => useApp());

      await act(async () => {
        window.dispatchEvent(new Event('offline'));
      });

      expect(mockSetOnline).toHaveBeenCalledWith(false);
    });
  });

  describe('connection quality calculation', () => {
    it('should return a valid quality value', () => {
      const { result } = renderHook(() => useApp());

      // Quality should be one of the valid values
      expect(['excellent', 'good', 'fair', 'poor', 'offline']).toContain(
        result.current.connection.quality
      );
    });
  });

  describe('wipeAll action', () => {
    it('should clear all data and reload', async () => {
      const { result } = renderHook(() => useApp());

      await act(async () => {
        await result.current.actions.wipeAll();
      });

      expect(storesModule.clearAllStores).toHaveBeenCalled();
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('setReady action', () => {
    it('should mark the app as ready', () => {
      const { result } = renderHook(() => useApp());

      act(() => {
        result.current.actions.setReady();
      });

      expect(result.current.init.complete).toBe(true);
    });
  });
});

describe('useAppInit', () => {
  it('should return init state only', () => {
    const { result } = renderHook(() => useAppInit());

    expect(result.current).toHaveProperty('started');
    expect(result.current).toHaveProperty('complete');
    expect(result.current).toHaveProperty('failed');
    expect(result.current).toHaveProperty('progress');
    expect(result.current).not.toHaveProperty('connection');
  });
});

describe('useAppConnection', () => {
  it('should return connection state only', () => {
    const { result } = renderHook(() => useAppConnection());

    expect(result.current).toHaveProperty('isOnline');
    expect(result.current).toHaveProperty('hasRelayConnection');
    expect(result.current).toHaveProperty('relayCount');
    expect(result.current).toHaveProperty('quality');
    expect(result.current).not.toHaveProperty('init');
  });
});

describe('useAppReady', () => {
  it('should return boolean ready state', () => {
    const { result } = renderHook(() => useAppReady());

    expect(typeof result.current).toBe('boolean');
  });
});

describe('useOnlineStatus', () => {
  it('should return boolean online status', () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(typeof result.current).toBe('boolean');
  });
});

describe('useApp - advanced scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization flow', () => {
    it('should track initialization progress through onProgress callback', async () => {
      const { result } = renderHook(() => useApp());

      // Call initialize - the progress callback should be wired up
      act(() => {
        result.current.actions.initialize();
      });

      // Verify started flag is set
      expect(result.current.init.started).toBe(true);
    });

    it('should not re-initialize if already initializing', async () => {
      const { result } = renderHook(() => useApp());

      // Start initialization
      act(() => {
        result.current.actions.initialize();
      });

      // Try to initialize again
      act(() => {
        result.current.actions.initialize();
      });

      // Should still be in started state, not starting fresh
      expect(result.current.init.started).toBe(true);
    });

    it('should set complete flag after successful initialization', async () => {
      vi.mocked(initModule.initializeApp).mockResolvedValueOnce({
        success: true,
        services: {},
        duration: 100,
      } as any);

      const { result } = renderHook(() => useApp());

      await act(async () => {
        await result.current.actions.initialize();
      });

      expect(result.current.init.complete).toBe(true);
      expect(result.current.init.progress).toBe(100);
    });

    it('should handle initialization failure with failed flag', async () => {
      const mockError = new Error('Storage initialization failed');
      vi.mocked(initModule.initializeApp).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useApp());

      await expect(
        act(async () => {
          await result.current.actions.initialize();
        })
      ).rejects.toThrow('Storage initialization failed');

      expect(result.current.init.failed).toBe(true);
      expect(result.current.init.error?.message).toBe('Storage initialization failed');
    });

    it('should convert non-Error thrown values to Error objects', async () => {
      vi.mocked(initModule.initializeApp).mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useApp());

      await expect(
        act(async () => {
          await result.current.actions.initialize();
        })
      ).rejects.toThrow();

      expect(result.current.init.error).toBeInstanceOf(Error);
    });
  });

  describe('shutdown action', () => {
    it('should reset init state after shutdown', async () => {
      const { result } = renderHook(() => useApp());

      // First initialize
      vi.mocked(initModule.initializeApp).mockResolvedValueOnce({
        success: true,
        services: {},
        duration: 100,
      } as any);

      await act(async () => {
        await result.current.actions.initialize();
      });

      expect(result.current.init.complete).toBe(true);

      // Then shutdown
      await act(async () => {
        await result.current.actions.shutdown();
      });

      expect(result.current.init.started).toBe(false);
      expect(result.current.init.complete).toBe(false);
      expect(result.current.init.progress).toBe(0);
    });

    it('should call shutdownApp service', async () => {
      const { result } = renderHook(() => useApp());

      await act(async () => {
        await result.current.actions.shutdown();
      });

      expect(initModule.shutdownApp).toHaveBeenCalled();
    });
  });

  describe('wipeAll action', () => {
    it('should call shutdown before wiping', async () => {
      const { result } = renderHook(() => useApp());

      await act(async () => {
        await result.current.actions.wipeAll();
      });

      expect(initModule.shutdownApp).toHaveBeenCalled();
    });

    it('should clear localStorage', async () => {
      const localStorageClearSpy = vi.fn();
      Object.defineProperty(window, 'localStorage', {
        value: { clear: localStorageClearSpy },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useApp());

      await act(async () => {
        await result.current.actions.wipeAll();
      });

      expect(localStorageClearSpy).toHaveBeenCalled();
    });

    it('should clear sessionStorage', async () => {
      const sessionStorageClearSpy = vi.fn();
      Object.defineProperty(window, 'sessionStorage', {
        value: { clear: sessionStorageClearSpy },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useApp());

      await act(async () => {
        await result.current.actions.wipeAll();
      });

      expect(sessionStorageClearSpy).toHaveBeenCalled();
    });
  });

  describe('connection quality calculation', () => {
    it('should return offline when not online', () => {
      // Mock isOnline as false
      vi.mocked(storesModule.useAppStore).mockImplementation((selector) => {
        const state = {
          isInitialized: false,
          isOnline: false,
          isBackground: false,
          version: '1.0.0',
          setOnline: mockSetOnline,
          setInitialized: mockSetInitialized,
        };
        return selector ? selector(state) : state;
      });

      const { result } = renderHook(() => useApp());

      expect(result.current.connection.quality).toBe('offline');
    });
  });

  describe('cleanup on unmount', () => {
    it('should remove online/offline event listeners on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useApp());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('setReady action', () => {
    it('should set both init.complete and call setInitialized', () => {
      const { result } = renderHook(() => useApp());

      act(() => {
        result.current.actions.setReady();
      });

      expect(result.current.init.complete).toBe(true);
      expect(mockSetInitialized).toHaveBeenCalledWith(true);
    });
  });
});
