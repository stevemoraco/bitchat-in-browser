/**
 * Tests for useNotifications Hook
 *
 * Tests notification functionality including:
 * - Permission requests
 * - Handling denied permission
 * - Showing notifications
 * - Badge management
 * - Settings integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/preact';
import {
  useNotifications,
  useNotificationPermission,
  useNotificationSupport,
  useNotificationBadge,
} from '../useNotifications';

// ============================================================================
// Mocks
// ============================================================================

const mockEventListeners: Set<(event: any) => void> = new Set();

vi.mock('../../services/notifications', () => ({
  getNotificationService: vi.fn(() => ({
    getPermission: vi.fn(() => 'default'),
    getCapabilities: vi.fn(() => ({
      canNotify: true,
      isInstalledPWA: false,
      isIOS: false,
      reason: null,
    })),
    requestPermission: vi.fn().mockResolvedValue(true),
    setBadge: vi.fn().mockResolvedValue(true),
    clearBadge: vi.fn().mockResolvedValue(true),
    addEventListener: vi.fn((callback) => {
      mockEventListeners.add(callback);
      return () => mockEventListeners.delete(callback);
    }),
    resetCapabilities: vi.fn(),
  })),
}));

vi.mock('../../services/notifications/local', () => ({
  showMessageNotification: vi.fn().mockResolvedValue(true),
  clearChannelNotifications: vi.fn().mockResolvedValue(undefined),
  clearAllNotifications: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../stores/messages-store', () => ({
  useTotalUnreadCount: vi.fn(() => 5),
}));

vi.mock('../../stores/settings-store', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      settings: { notifications: 'all' },
      setNotifications: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventListeners.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initial state', () => {
    it('should return permission state', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current).toHaveProperty('permission');
      expect(result.current).toHaveProperty('isGranted');
      expect(result.current).toHaveProperty('isDenied');
      expect(result.current).toHaveProperty('isDefault');
    });

    it('should return capabilities', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current).toHaveProperty('capabilities');
      expect(result.current).toHaveProperty('canNotify');
      expect(result.current).toHaveProperty('isInstalledPWA');
      expect(result.current).toHaveProperty('isIOS');
    });

    it('should return action functions', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.requestPermission).toBe('function');
      expect(typeof result.current.showNotification).toBe('function');
      expect(typeof result.current.clearChannel).toBe('function');
      expect(typeof result.current.clearAll).toBe('function');
    });

    it('should return badge management functions', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.setBadge).toBe('function');
      expect(typeof result.current.clearBadge).toBe('function');
      expect(typeof result.current.syncBadge).toBe('function');
      expect(result.current).toHaveProperty('badgeCount');
    });

    it('should return settings', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current).toHaveProperty('notificationsEnabled');
      expect(result.current).toHaveProperty('notificationLevel');
      expect(typeof result.current.setNotificationLevel).toBe('function');
    });

    it('should return loading state', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.isRequesting).toBe('boolean');
    });
  });

  describe('permission requests', () => {
    it('should provide requestPermission function', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.requestPermission).toBe('function');
    });

    it('should return boolean from permission request', async () => {
      const { result } = renderHook(() => useNotifications());

      let granted: boolean | undefined;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(typeof granted).toBe('boolean');
    });

    it('should set isRequesting during permission request', async () => {
      const { getNotificationService } = await import('../../services/notifications');
      const mockService = getNotificationService();

      // Make the request take some time
      vi.mocked(mockService.requestPermission).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      const { result } = renderHook(() => useNotifications());

      // Start request but don't wait
      let requestPromise: Promise<boolean>;
      act(() => {
        requestPromise = result.current.requestPermission();
      });

      // Should be requesting
      expect(result.current.isRequesting).toBe(true);

      // Wait for completion
      await act(async () => {
        await requestPromise;
      });

      expect(result.current.isRequesting).toBe(false);
    });

    it('should not request permission when canNotify is false', async () => {
      const { getNotificationService } = await import('../../services/notifications');
      vi.mocked(getNotificationService).mockReturnValue({
        getPermission: vi.fn(() => 'default'),
        getCapabilities: vi.fn(() => ({
          canNotify: false,
          isInstalledPWA: false,
          isIOS: false,
          reason: 'not-supported',
        })),
        requestPermission: vi.fn(),
        setBadge: vi.fn(),
        clearBadge: vi.fn(),
        addEventListener: vi.fn(() => vi.fn()),
        resetCapabilities: vi.fn(),
      });

      const { result } = renderHook(() => useNotifications());

      let granted: boolean = true;
      await act(async () => {
        granted = await result.current.requestPermission();
      });

      expect(granted).toBe(false);
    });
  });

  describe('handling denied permission', () => {
    it('should track denied permission state', async () => {
      const { getNotificationService } = await import('../../services/notifications');
      vi.mocked(getNotificationService).mockReturnValue({
        getPermission: vi.fn(() => 'denied'),
        getCapabilities: vi.fn(() => ({
          canNotify: true,
          isInstalledPWA: false,
          isIOS: false,
          reason: null,
        })),
        requestPermission: vi.fn().mockResolvedValue(false),
        setBadge: vi.fn(),
        clearBadge: vi.fn(),
        addEventListener: vi.fn(() => vi.fn()),
        resetCapabilities: vi.fn(),
      });

      const { result } = renderHook(() => useNotifications());

      expect(result.current.isDenied).toBe(true);
      expect(result.current.isGranted).toBe(false);
    });

    it('should not show notifications when permission is denied', async () => {
      const { getNotificationService } = await import('../../services/notifications');
      vi.mocked(getNotificationService).mockReturnValue({
        getPermission: vi.fn(() => 'denied'),
        getCapabilities: vi.fn(() => ({
          canNotify: true,
          isInstalledPWA: false,
          isIOS: false,
          reason: null,
        })),
        requestPermission: vi.fn().mockResolvedValue(false),
        setBadge: vi.fn(),
        clearBadge: vi.fn(),
        addEventListener: vi.fn(() => vi.fn()),
        resetCapabilities: vi.fn(),
      });

      const { showMessageNotification } = await import('../../services/notifications/local');

      const { result } = renderHook(() => useNotifications());

      let shown: boolean = true;
      await act(async () => {
        shown = await result.current.showNotification({
          title: 'Test',
          body: 'Test body',
          channelId: 'channel-1',
        });
      });

      expect(shown).toBe(false);
      expect(showMessageNotification).not.toHaveBeenCalled();
    });
  });

  describe('showing notifications', () => {
    it('should show notification when permission is granted', async () => {
      const { getNotificationService } = await import('../../services/notifications');
      vi.mocked(getNotificationService).mockReturnValue({
        getPermission: vi.fn(() => 'granted'),
        getCapabilities: vi.fn(() => ({
          canNotify: true,
          isInstalledPWA: false,
          isIOS: false,
          reason: null,
        })),
        requestPermission: vi.fn().mockResolvedValue(true),
        setBadge: vi.fn().mockResolvedValue(true),
        clearBadge: vi.fn().mockResolvedValue(true),
        addEventListener: vi.fn(() => vi.fn()),
        resetCapabilities: vi.fn(),
      });

      const { showMessageNotification } = await import('../../services/notifications/local');

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.showNotification({
          title: 'New Message',
          body: 'Hello world',
          channelId: 'channel-1',
        });
      });

      expect(showMessageNotification).toHaveBeenCalledWith({
        title: 'New Message',
        body: 'Hello world',
        channelId: 'channel-1',
      });
    });
  });

  describe('badge management', () => {
    it('should provide setBadge function', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.setBadge).toBe('function');
    });

    it('should provide clearBadge function', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.clearBadge).toBe('function');
    });

    it('should provide syncBadge function', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.syncBadge).toBe('function');
    });

    it('should track badgeCount', () => {
      const { result } = renderHook(() => useNotifications());

      expect(typeof result.current.badgeCount).toBe('number');
    });
  });

  describe('channel notifications', () => {
    it('should clear channel notifications', async () => {
      const { clearChannelNotifications } = await import('../../services/notifications/local');

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.clearChannel('channel-123');
      });

      expect(clearChannelNotifications).toHaveBeenCalledWith('channel-123');
    });

    it('should clear all notifications', async () => {
      const { clearAllNotifications } = await import('../../services/notifications/local');

      const { result } = renderHook(() => useNotifications());

      await act(async () => {
        await result.current.clearAll();
      });

      expect(clearAllNotifications).toHaveBeenCalled();
    });
  });

  describe('settings integration', () => {
    it('should provide notification level from settings', () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.notificationLevel).toBe('all');
    });

    it('should set notification level in settings', async () => {
      const { useSettingsStore } = await import('../../stores/settings-store');
      const mockSetNotifications = vi.fn();
      vi.mocked(useSettingsStore).mockImplementation((selector) => {
        const state = {
          settings: { notifications: 'all' },
          setNotifications: mockSetNotifications,
        };
        return selector ? selector(state) : state;
      });

      const { result } = renderHook(() => useNotifications());

      act(() => {
        result.current.setNotificationLevel('mentions');
      });

      expect(mockSetNotifications).toHaveBeenCalledWith('mentions');
    });
  });

  describe('event handling', () => {
    it('should handle permission change events', async () => {
      const onPermissionChange = vi.fn();
      const { result } = renderHook(() =>
        useNotifications({ onPermissionChange })
      );

      // Wait for event listener to be set up
      await waitFor(() => {
        expect(mockEventListeners.size).toBeGreaterThan(0);
      });

      // Simulate permission change event
      act(() => {
        mockEventListeners.forEach((callback) => {
          callback({ type: 'permission-change', permission: 'granted' });
        });
      });

      expect(onPermissionChange).toHaveBeenCalledWith('granted');
    });

    it('should handle notification click events', async () => {
      const onNotificationClick = vi.fn();
      const { result } = renderHook(() =>
        useNotifications({ onNotificationClick })
      );

      await waitFor(() => {
        expect(mockEventListeners.size).toBeGreaterThan(0);
      });

      act(() => {
        mockEventListeners.forEach((callback) => {
          callback({
            type: 'notification-clicked',
            notificationData: { channelId: 'test-channel' },
          });
        });
      });

      expect(onNotificationClick).toHaveBeenCalledWith({ channelId: 'test-channel' });
    });
  });

  describe('auto-sync badge', () => {
    it('should auto-sync badge when enabled and granted', async () => {
      const { getNotificationService } = await import('../../services/notifications');
      vi.mocked(getNotificationService).mockReturnValue({
        getPermission: vi.fn(() => 'granted'),
        getCapabilities: vi.fn(() => ({
          canNotify: true,
          isInstalledPWA: false,
          isIOS: false,
          reason: null,
        })),
        requestPermission: vi.fn().mockResolvedValue(true),
        setBadge: vi.fn().mockResolvedValue(true),
        clearBadge: vi.fn().mockResolvedValue(true),
        addEventListener: vi.fn(() => vi.fn()),
        resetCapabilities: vi.fn(),
      });

      const mockService = getNotificationService();

      renderHook(() => useNotifications({ autoSyncBadge: true }));

      // Should sync badge on mount when granted
      await waitFor(() => {
        expect(mockService.setBadge).toHaveBeenCalledWith(5);
      });
    });
  });
});

describe('useNotificationPermission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventListeners.clear();
  });

  it('should return current permission status', () => {
    const { result } = renderHook(() => useNotificationPermission());

    expect(typeof result.current).toBe('string');
    expect(['default', 'granted', 'denied']).toContain(result.current);
  });

  it('should update when permission changes', () => {
    const { result } = renderHook(() => useNotificationPermission());

    act(() => {
      mockEventListeners.forEach((callback) => {
        callback({ type: 'permission-change', permission: 'granted' });
      });
    });

    expect(result.current).toBe('granted');
  });
});

describe('useNotificationSupport', () => {
  it('should return notification capabilities', () => {
    const { result } = renderHook(() => useNotificationSupport());

    expect(result.current).toHaveProperty('canNotify');
    expect(result.current).toHaveProperty('isInstalledPWA');
    expect(result.current).toHaveProperty('isIOS');
  });

  it('should detect when notifications are not supported', async () => {
    const { getNotificationService } = await import('../../services/notifications');
    vi.mocked(getNotificationService).mockReturnValue({
      getPermission: vi.fn(() => 'default'),
      getCapabilities: vi.fn(() => ({
        canNotify: false,
        isInstalledPWA: false,
        isIOS: false,
        reason: 'not-supported',
      })),
      requestPermission: vi.fn(),
      setBadge: vi.fn(),
      clearBadge: vi.fn(),
      addEventListener: vi.fn(() => vi.fn()),
      resetCapabilities: vi.fn(),
    });

    const { result } = renderHook(() => useNotificationSupport());

    expect(result.current.canNotify).toBe(false);
  });
});

describe('useNotificationBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventListeners.clear();
  });

  it('should return badge count', () => {
    const { result } = renderHook(() => useNotificationBadge());

    expect(typeof result.current.badgeCount).toBe('number');
  });

  it('should provide setBadge function', () => {
    const { result } = renderHook(() => useNotificationBadge());

    expect(typeof result.current.setBadge).toBe('function');
  });

  it('should provide clearBadge function', () => {
    const { result } = renderHook(() => useNotificationBadge());

    expect(typeof result.current.clearBadge).toBe('function');
  });

  it('should handle setBadge call', async () => {
    const { result } = renderHook(() => useNotificationBadge());

    await act(async () => {
      await result.current.setBadge(15);
    });

    expect(result.current.badgeCount).toBe(15);
  });

  it('should handle clearBadge call', async () => {
    const { result } = renderHook(() => useNotificationBadge());

    await act(async () => {
      await result.current.clearBadge();
    });

    expect(result.current.badgeCount).toBe(0);
  });
});
