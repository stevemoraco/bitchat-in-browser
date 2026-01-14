/**
 * Notification Service Tests
 *
 * Tests for the NotificationService class including:
 * - Permission management
 * - Capability detection
 * - Showing notifications
 * - Badge management
 * - Event handling
 * - Cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NotificationService,
  getNotificationService,
  resetNotificationService,
  type NotificationPermission,
  type NotificationCapabilities,
  type NotificationEvent,
  type NotificationEventListener,
} from '../index';

// ============================================================================
// Test Setup
// ============================================================================

// Mock getTotalUnreadCount
vi.mock('../../../stores/messages-store', () => ({
  getTotalUnreadCount: vi.fn(() => 5),
}));

// Store original globals
const originalNotification = globalThis.Notification;
const originalNavigator = globalThis.navigator;

// Mock Notification API
class MockNotification {
  static permission: NotificationPermission = 'default';
  static requestPermission = vi.fn().mockResolvedValue('granted');

  title: string;
  options?: NotificationOptions;

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
  }

  close = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

// Store mock registration so we can verify calls
let mockShowNotification: ReturnType<typeof vi.fn>;
let mockGetNotifications: ReturnType<typeof vi.fn>;

// Setup mock navigator
function createMockNavigator(options: {
  userAgent?: string;
  standalone?: boolean;
  serviceWorker?: boolean;
  setAppBadge?: boolean;
} = {}) {
  mockShowNotification = vi.fn().mockResolvedValue(undefined);
  mockGetNotifications = vi.fn().mockResolvedValue([
    { close: vi.fn() },
    { close: vi.fn() },
  ]);

  const mockServiceWorkerRegistration = {
    showNotification: mockShowNotification,
    getNotifications: mockGetNotifications,
    update: vi.fn(),
  };

  const mockServiceWorker = options.serviceWorker !== false ? {
    ready: Promise.resolve(mockServiceWorkerRegistration),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    controller: null,
    register: vi.fn(),
    getRegistrations: vi.fn().mockResolvedValue([]),
  } : undefined;

  return {
    userAgent: options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    serviceWorker: mockServiceWorker,
    standalone: options.standalone,
    onLine: true,
    setAppBadge: options.setAppBadge !== false ? vi.fn().mockResolvedValue(undefined) : undefined,
    clearAppBadge: options.setAppBadge !== false ? vi.fn().mockResolvedValue(undefined) : undefined,
  };
}

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    // Reset Notification mock
    (globalThis as any).Notification = MockNotification;
    MockNotification.permission = 'default';
    MockNotification.requestPermission.mockResolvedValue('granted');

    // Reset navigator mock
    Object.defineProperty(globalThis, 'navigator', {
      value: createMockNavigator(),
      writable: true,
      configurable: true,
    });

    // Reset window and document mocks - include Notification reference
    Object.defineProperty(globalThis, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        dispatchEvent: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        Notification: MockNotification,
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'document', {
      value: {
        referrer: '',
      },
      writable: true,
      configurable: true,
    });

    // Reset singleton
    resetNotificationService();
    service = new NotificationService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    resetNotificationService();
  });

  // ============================================================================
  // Permission Management
  // ============================================================================

  describe('Permission Management', () => {
    describe('getPermission', () => {
      it('should return current permission status', () => {
        MockNotification.permission = 'granted';
        expect(service.getPermission()).toBe('granted');
      });

      it('should return denied when Notification API is not available', () => {
        (globalThis as any).Notification = undefined;
        expect(service.getPermission()).toBe('denied');
      });

      it('should return default when permission not yet requested', () => {
        MockNotification.permission = 'default';
        expect(service.getPermission()).toBe('default');
      });
    });

    describe('isGranted', () => {
      it('should return true when permission is granted', () => {
        MockNotification.permission = 'granted';
        expect(service.isGranted()).toBe(true);
      });

      it('should return false when permission is denied', () => {
        MockNotification.permission = 'denied';
        expect(service.isGranted()).toBe(false);
      });

      it('should return false when permission is default', () => {
        MockNotification.permission = 'default';
        expect(service.isGranted()).toBe(false);
      });
    });

    describe('isDenied', () => {
      it('should return true when permission is denied', () => {
        MockNotification.permission = 'denied';
        expect(service.isDenied()).toBe(true);
      });

      it('should return false when permission is granted', () => {
        MockNotification.permission = 'granted';
        expect(service.isDenied()).toBe(false);
      });
    });

    describe('isDefault', () => {
      it('should return true when permission is default', () => {
        MockNotification.permission = 'default';
        expect(service.isDefault()).toBe(true);
      });

      it('should return false when permission is set', () => {
        MockNotification.permission = 'granted';
        expect(service.isDefault()).toBe(false);
      });
    });

    describe('requestPermission', () => {
      it('should request and grant permission', async () => {
        MockNotification.permission = 'default';
        MockNotification.requestPermission.mockResolvedValue('granted');

        const result = await service.requestPermission();

        expect(result).toBe(true);
        expect(MockNotification.requestPermission).toHaveBeenCalled();
      });

      it('should return true immediately if already granted', async () => {
        MockNotification.permission = 'granted';

        const result = await service.requestPermission();

        expect(result).toBe(true);
        expect(MockNotification.requestPermission).not.toHaveBeenCalled();
      });

      it('should return false if already denied', async () => {
        MockNotification.permission = 'denied';

        const result = await service.requestPermission();

        expect(result).toBe(false);
        expect(MockNotification.requestPermission).not.toHaveBeenCalled();
      });

      it('should return false when Notification API not available', async () => {
        (globalThis as any).Notification = undefined;

        const result = await service.requestPermission();

        expect(result).toBe(false);
      });

      it('should return false when permission denied by user', async () => {
        MockNotification.permission = 'default';
        MockNotification.requestPermission.mockResolvedValue('denied');

        const result = await service.requestPermission();

        expect(result).toBe(false);
      });

      it('should notify listeners on permission change', async () => {
        MockNotification.permission = 'default';
        MockNotification.requestPermission.mockResolvedValue('granted');

        const listener = vi.fn();
        service.addEventListener(listener);

        await service.requestPermission();

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'permission-change',
            permission: 'granted',
          })
        );
      });

      it('should handle errors during permission request', async () => {
        MockNotification.permission = 'default';
        MockNotification.requestPermission.mockRejectedValue(new Error('Request failed'));

        const result = await service.requestPermission();

        expect(result).toBe(false);
      });
    });
  });

  // ============================================================================
  // Capability Detection
  // ============================================================================

  describe('Capability Detection', () => {
    describe('getCapabilities', () => {
      it('should detect notification support', () => {
        const caps = service.getCapabilities();

        expect(caps.supported).toBe(true);
      });

      it('should detect push support', () => {
        // PushManager needs to be in window for push support detection
        Object.defineProperty(globalThis, 'PushManager', {
          value: class MockPushManager {},
          writable: true,
          configurable: true,
        });
        (window as any).PushManager = globalThis.PushManager;

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.pushSupported).toBe(true);
      });

      it('should detect badge API support', () => {
        const caps = service.getCapabilities();

        expect(caps.badgeSupported).toBe(true);
      });

      it('should detect iOS user agent', () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)',
          }),
          writable: true,
          configurable: true,
        });

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.isIOS).toBe(true);
        expect(caps.iOSVersion).toBe(16);
      });

      it('should detect iPad user agent', () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator({
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)',
          }),
          writable: true,
          configurable: true,
        });

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.isIOS).toBe(true);
        expect(caps.iOSVersion).toBe(17);
      });

      it('should detect installed PWA via matchMedia', () => {
        (globalThis as any).window.matchMedia = vi.fn().mockReturnValue({ matches: true });

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.isInstalledPWA).toBe(true);
      });

      it('should detect installed PWA via navigator.standalone', () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            ...createMockNavigator(),
            standalone: true,
          },
          writable: true,
          configurable: true,
        });

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.isInstalledPWA).toBe(true);
      });

      it('should detect TWA via document.referrer', () => {
        (globalThis as any).document.referrer = 'android-app://com.example.app';

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.isInstalledPWA).toBe(true);
      });

      it('should report cannot notify on iOS without PWA', () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)',
          }),
          writable: true,
          configurable: true,
        });
        (globalThis as any).window.matchMedia = vi.fn().mockReturnValue({ matches: false });

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.isIOS).toBe(true);
        expect(caps.isInstalledPWA).toBe(false);
        expect(caps.canNotify).toBe(false);
        expect(caps.reason).toContain('Home Screen');
      });

      it('should report cannot notify on old iOS versions', () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            ...createMockNavigator({
              userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
            }),
            standalone: true,
          },
          writable: true,
          configurable: true,
        });
        (globalThis as any).window.matchMedia = vi.fn().mockReturnValue({ matches: true });

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.isIOS).toBe(true);
        expect(caps.iOSVersion).toBe(15);
        expect(caps.canNotify).toBe(false);
        expect(caps.reason).toContain('16.4+');
      });

      it('should allow notifications on iOS 16.4+ as PWA', () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            ...createMockNavigator({
              userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)',
            }),
            standalone: true,
          },
          writable: true,
          configurable: true,
        });
        (globalThis as any).window.matchMedia = vi.fn().mockReturnValue({ matches: true });

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.isIOS).toBe(true);
        expect(caps.isInstalledPWA).toBe(true);
        expect(caps.canNotify).toBe(true);
      });

      it('should cache capabilities', () => {
        const caps1 = service.getCapabilities();
        const caps2 = service.getCapabilities();

        expect(caps1).toBe(caps2);
      });

      it('should reset capabilities cache', () => {
        const caps1 = service.getCapabilities();
        service.resetCapabilities();
        const caps2 = service.getCapabilities();

        expect(caps1).not.toBe(caps2);
      });

      it('should handle non-browser environment', () => {
        (globalThis as any).window = undefined;

        service.resetCapabilities();
        const caps = service.getCapabilities();

        expect(caps.supported).toBe(false);
        expect(caps.canNotify).toBe(false);
        expect(caps.reason).toContain('Not in browser');
      });
    });
  });

  // ============================================================================
  // Show Notifications
  // ============================================================================

  describe('Show Notifications', () => {
    beforeEach(() => {
      // Reset navigator to default mock
      Object.defineProperty(globalThis, 'navigator', {
        value: createMockNavigator(),
        writable: true,
        configurable: true,
      });
      MockNotification.permission = 'granted';
      service.resetCapabilities();
    });

    describe('show', () => {
      it('should show notification via service worker', async () => {
        const result = await service.show({
          title: 'Test Title',
          body: 'Test Body',
        });

        expect(result).toBe(true);
        expect(mockShowNotification).toHaveBeenCalledWith(
          'Test Title',
          expect.objectContaining({
            body: 'Test Body',
          })
        );
      });

      it('should include default icon and badge', async () => {
        await service.show({
          title: 'Test',
          body: 'Body',
        });

        expect(mockShowNotification).toHaveBeenCalledWith(
          'Test',
          expect.objectContaining({
            icon: expect.stringContaining('icon'),
            badge: expect.stringContaining('badge'),
          })
        );
      });

      it('should use custom icon and badge when provided', async () => {
        await service.show({
          title: 'Test',
          body: 'Body',
          icon: '/custom-icon.png',
          badge: '/custom-badge.png',
        });

        expect(mockShowNotification).toHaveBeenCalledWith(
          'Test',
          expect.objectContaining({
            icon: '/custom-icon.png',
            badge: '/custom-badge.png',
          })
        );
      });

      it('should include notification data', async () => {
        await service.show({
          title: 'New Message',
          body: 'Hello',
          data: {
            type: 'message',
            channelId: 'ch123',
            senderFingerprint: 'fp456',
          },
        });

        expect(mockShowNotification).toHaveBeenCalledWith(
          'New Message',
          expect.objectContaining({
            data: expect.objectContaining({
              type: 'message',
              channelId: 'ch123',
            }),
          })
        );
      });

      it('should include vibration pattern when not silent', async () => {
        await service.show({
          title: 'Test',
          body: 'Body',
          vibrate: [200, 100, 200],
          silent: false,
        });

        expect(mockShowNotification).toHaveBeenCalledWith(
          'Test',
          expect.objectContaining({
            vibrate: [200, 100, 200],
          })
        );
      });

      it('should not include vibration when silent', async () => {
        await service.show({
          title: 'Test',
          body: 'Body',
          vibrate: [200, 100, 200],
          silent: true,
        });

        const call = mockShowNotification.mock.calls[0];
        expect(call[1].vibrate).toBeUndefined();
      });

      it('should include actions when provided', async () => {
        await service.show({
          title: 'Test',
          body: 'Body',
          actions: [
            { action: 'reply', title: 'Reply' },
            { action: 'dismiss', title: 'Dismiss' },
          ],
        });

        expect(mockShowNotification).toHaveBeenCalledWith(
          'Test',
          expect.objectContaining({
            actions: expect.arrayContaining([
              expect.objectContaining({ action: 'reply' }),
            ]),
          })
        );
      });

      it('should include image when provided', async () => {
        await service.show({
          title: 'Test',
          body: 'Body',
          image: '/image.png',
        });

        expect(mockShowNotification).toHaveBeenCalledWith(
          'Test',
          expect.objectContaining({
            image: '/image.png',
          })
        );
      });

      it('should notify listeners when notification shown', async () => {
        // Reset to ensure fresh state
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator(),
          writable: true,
          configurable: true,
        });
        service.resetCapabilities();

        const listener = vi.fn();
        service.addEventListener(listener);

        const result = await service.show({
          title: 'Test',
          body: 'Body',
          data: { type: 'message' },
        });

        expect(result).toBe(true);
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'notification-shown',
            notificationData: expect.objectContaining({ type: 'message' }),
          })
        );
      });

      it('should return false when capabilities prevent notifications', async () => {
        // Set iOS without PWA
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator({
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)',
          }),
          writable: true,
          configurable: true,
        });
        (globalThis as any).window.matchMedia = vi.fn().mockReturnValue({ matches: false });

        service.resetCapabilities();

        const result = await service.show({
          title: 'Test',
          body: 'Body',
        });

        expect(result).toBe(false);
      });

      it('should return false when permission not granted', async () => {
        MockNotification.permission = 'default';

        const result = await service.show({
          title: 'Test',
          body: 'Body',
        });

        expect(result).toBe(false);
      });

      it('should handle service worker errors gracefully', async () => {
        const errorNavigator = createMockNavigator();
        (errorNavigator.serviceWorker as any).ready = Promise.resolve({
          showNotification: vi.fn().mockRejectedValue(new Error('SW error')),
          getNotifications: vi.fn().mockResolvedValue([]),
        });

        Object.defineProperty(globalThis, 'navigator', {
          value: errorNavigator,
          writable: true,
          configurable: true,
        });

        const result = await service.show({
          title: 'Test',
          body: 'Body',
        });

        expect(result).toBe(false);
      });

      it('should fallback to Notification API when no service worker', async () => {
        // This test verifies fallback behavior when service worker is unavailable
        // Note: The service checks 'serviceWorker' in navigator first, so we need
        // to reset capabilities after changing the navigator
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            ...createMockNavigator({ serviceWorker: false }),
            // Explicitly remove serviceWorker
          },
          writable: true,
          configurable: true,
        });
        delete (navigator as any).serviceWorker;

        service.resetCapabilities();

        // Create a spy for direct Notification constructor calls
        const mockNotificationInstance = { close: vi.fn() };
        const OriginalNotification = globalThis.Notification;
        (globalThis as any).Notification = vi.fn(() => mockNotificationInstance) as unknown as typeof Notification;
        (globalThis as any).Notification.permission = 'granted';

        const result = await service.show({
          title: 'Test',
          body: 'Body',
        });

        expect(result).toBe(true);
        expect(globalThis.Notification).toHaveBeenCalledWith('Test', expect.any(Object));

        // Restore
        (globalThis as any).Notification = OriginalNotification;
      });
    });

    describe('closeByTag', () => {
      it('should close notifications by tag', async () => {
        await service.closeByTag('test-tag');

        expect(mockGetNotifications).toHaveBeenCalledWith({ tag: 'test-tag' });
      });

      it('should handle missing service worker', async () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator({ serviceWorker: false }),
          writable: true,
          configurable: true,
        });

        // Should not throw
        await expect(service.closeByTag('test-tag')).resolves.not.toThrow();
      });
    });

    describe('closeAll', () => {
      it('should close all notifications', async () => {
        await service.closeAll();

        expect(mockGetNotifications).toHaveBeenCalledWith();
      });
    });
  });

  // ============================================================================
  // Badge Management
  // ============================================================================

  describe('Badge Management', () => {
    describe('setBadge', () => {
      it('should set badge count', async () => {
        const result = await service.setBadge(5);

        expect(result).toBe(true);
        expect((navigator as any).setAppBadge).toHaveBeenCalledWith(5);
      });

      it('should clear badge when count is 0', async () => {
        const result = await service.setBadge(0);

        expect(result).toBe(true);
        expect((navigator as any).clearAppBadge).toHaveBeenCalled();
      });

      it('should notify listeners on badge update', async () => {
        const listener = vi.fn();
        service.addEventListener(listener);

        await service.setBadge(10);

        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'badge-updated',
            badgeCount: 10,
          })
        );
      });

      it('should return false when Badge API not supported', async () => {
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator({ setAppBadge: false }),
          writable: true,
          configurable: true,
        });

        service.resetCapabilities();
        const result = await service.setBadge(5);

        expect(result).toBe(false);
      });

      it('should handle badge API errors', async () => {
        (navigator as any).setAppBadge = vi.fn().mockRejectedValue(new Error('Badge error'));

        service.resetCapabilities();
        const result = await service.setBadge(5);

        expect(result).toBe(false);
      });
    });

    describe('clearBadge', () => {
      it('should clear badge by setting to 0', async () => {
        const result = await service.clearBadge();

        expect(result).toBe(true);
        expect((navigator as any).clearAppBadge).toHaveBeenCalled();
      });
    });

    describe('syncBadgeWithUnreadCount', () => {
      it('should sync badge with unread count from store', async () => {
        await service.syncBadgeWithUnreadCount();

        // getTotalUnreadCount returns 5 from mock
        expect((navigator as any).setAppBadge).toHaveBeenCalledWith(5);
      });
    });

    describe('incrementBadge', () => {
      it('should update badge to current unread count', async () => {
        const result = await service.incrementBadge();

        expect(result).toBe(true);
        expect((navigator as any).setAppBadge).toHaveBeenCalledWith(5);
      });
    });
  });

  // ============================================================================
  // Event Handling
  // ============================================================================

  describe('Event Handling', () => {
    describe('addEventListener', () => {
      it('should add event listener', () => {
        const listener = vi.fn();

        const unsubscribe = service.addEventListener(listener);

        expect(typeof unsubscribe).toBe('function');
      });

      it('should return unsubscribe function that removes listener', async () => {
        // Reset environment
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator(),
          writable: true,
          configurable: true,
        });
        MockNotification.permission = 'granted';
        service.resetCapabilities();

        const listener = vi.fn();
        const unsubscribe = service.addEventListener(listener);
        unsubscribe();

        await service.show({ title: 'Test', body: 'Body' });

        expect(listener).not.toHaveBeenCalled();
      });

      it('should handle errors in listeners gracefully', async () => {
        // Reset environment
        Object.defineProperty(globalThis, 'navigator', {
          value: createMockNavigator(),
          writable: true,
          configurable: true,
        });
        MockNotification.permission = 'granted';
        service.resetCapabilities();

        const errorListener: NotificationEventListener = () => {
          throw new Error('Listener error');
        };
        const goodListener = vi.fn();

        service.addEventListener(errorListener);
        service.addEventListener(goodListener);

        // Should not throw
        const result = await service.show({ title: 'Test', body: 'Body' });

        // Notification should be shown successfully
        expect(result).toBe(true);
        // Good listener should still be called
        expect(goodListener).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Singleton
  // ============================================================================

  describe('Singleton', () => {
    describe('getNotificationService', () => {
      it('should return singleton instance', () => {
        const instance1 = getNotificationService();
        const instance2 = getNotificationService();

        expect(instance1).toBe(instance2);
      });

      it('should return new instance after reset', () => {
        const instance1 = getNotificationService();
        resetNotificationService();
        const instance2 = getNotificationService();

        expect(instance1).not.toBe(instance2);
      });
    });

    describe('resetNotificationService', () => {
      it('should clear singleton instance', () => {
        const instance1 = getNotificationService();
        resetNotificationService();
        const instance2 = getNotificationService();

        expect(instance1).not.toBe(instance2);
      });
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    describe('resetCapabilities', () => {
      it('should clear cached capabilities and detect new environment', () => {
        // Get initial capabilities (should detect notification support)
        const caps1 = service.getCapabilities();
        expect(caps1.supported).toBe(true);

        // Without reset, should return cached value
        const caps2 = service.getCapabilities();
        expect(caps2).toBe(caps1);

        // After reset, should return a new capabilities object
        service.resetCapabilities();
        const caps3 = service.getCapabilities();
        expect(caps3).not.toBe(caps1);

        // Verify the capabilities were recalculated (same values since environment unchanged)
        expect(caps3.supported).toBe(caps1.supported);
      });

      it('should allow re-detection after environment change', () => {
        // Get initial capabilities
        const caps1 = service.getCapabilities();
        expect(caps1.isIOS).toBe(false);

        // Change user agent to iOS
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            ...createMockNavigator(),
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)',
          },
          writable: true,
          configurable: true,
        });

        // Without reset, should return cached value
        const caps2 = service.getCapabilities();
        expect(caps2.isIOS).toBe(false); // Still cached

        // After reset, should detect new environment
        service.resetCapabilities();
        const caps3 = service.getCapabilities();
        expect(caps3.isIOS).toBe(true); // Now detects iOS
      });
    });
  });
});
