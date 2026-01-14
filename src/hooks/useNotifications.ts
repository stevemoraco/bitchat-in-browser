/**
 * useNotifications Hook
 *
 * React hook for managing notification state and permissions.
 * Provides a simple interface for:
 * - Checking notification permission status
 * - Requesting permission
 * - Enabling/disabling notifications
 * - Listening to notification events
 * - Managing badge count
 *
 * @module hooks/useNotifications
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import {
  getNotificationService,
  type NotificationService,
  type NotificationPermission,
  type NotificationCapabilities,
  type NotificationEvent,
  type NotificationEventListener
} from '../services/notifications';
import {
  showMessageNotification,
  clearChannelNotifications,
  clearAllNotifications,
  type MessageNotificationOptions
} from '../services/notifications/local';
import { useTotalUnreadCount } from '../stores/messages-store';
import { useSettingsStore } from '../stores/settings-store';

// ============================================================================
// Types
// ============================================================================

export interface UseNotificationsOptions {
  /** Auto-sync badge with unread count (default: true) */
  autoSyncBadge?: boolean;
  /** Auto-request permission on mount (default: false) */
  autoRequestPermission?: boolean;
  /** Listen for notification events (default: true) */
  listenToEvents?: boolean;
  /** Callback when permission changes */
  onPermissionChange?: (permission: NotificationPermission) => void;
  /** Callback when notification is clicked */
  onNotificationClick?: (data?: Record<string, unknown>) => void;
}

export interface UseNotificationsReturn {
  // Permission state
  /** Current notification permission */
  permission: NotificationPermission;
  /** Whether notifications are granted */
  isGranted: boolean;
  /** Whether notifications were denied */
  isDenied: boolean;
  /** Whether permission hasn't been requested yet */
  isDefault: boolean;

  // Capabilities
  /** Platform capabilities for notifications */
  capabilities: NotificationCapabilities;
  /** Whether notifications can work on this platform */
  canNotify: boolean;
  /** Whether running as installed PWA */
  isInstalledPWA: boolean;
  /** Whether on iOS */
  isIOS: boolean;

  // Actions
  /** Request notification permission */
  requestPermission: () => Promise<boolean>;
  /** Show a message notification */
  showNotification: (options: MessageNotificationOptions) => Promise<boolean>;
  /** Clear notifications for a channel */
  clearChannel: (channelId: string) => Promise<void>;
  /** Clear all notifications */
  clearAll: () => Promise<void>;

  // Badge management
  /** Current badge count */
  badgeCount: number;
  /** Set badge count manually */
  setBadge: (count: number) => Promise<boolean>;
  /** Clear badge */
  clearBadge: () => Promise<boolean>;
  /** Sync badge with unread count */
  syncBadge: () => Promise<void>;

  // Settings
  /** Whether notifications are enabled in settings */
  notificationsEnabled: boolean;
  /** Notification level from settings */
  notificationLevel: 'all' | 'mentions' | 'none';
  /** Set notification level */
  setNotificationLevel: (level: 'all' | 'mentions' | 'none') => void;

  // Loading state
  /** Whether permission is being requested */
  isRequesting: boolean;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_OPTIONS: Required<UseNotificationsOptions> = {
  autoSyncBadge: true,
  autoRequestPermission: false,
  listenToEvents: true,
  onPermissionChange: () => {},
  onNotificationClick: () => {},
};

// ============================================================================
// Hook Implementation
// ============================================================================

export function useNotifications(
  options: UseNotificationsOptions = {}
): UseNotificationsReturn {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Get notification service
  const serviceRef = useRef<NotificationService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = getNotificationService();
  }
  const service = serviceRef.current;

  // State
  const [permission, setPermission] = useState<NotificationPermission>(
    service.getPermission()
  );
  const [capabilities] = useState<NotificationCapabilities>(
    service.getCapabilities()
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [badgeCount, setBadgeCountState] = useState(0);

  // Get unread count from store
  const unreadCount = useTotalUnreadCount();

  // Get notification settings from store
  const notificationLevel = useSettingsStore((state) => state.settings.notifications);
  const setNotifications = useSettingsStore((state) => state.setNotifications);

  // Computed values
  const isGranted = permission === 'granted';
  const isDenied = permission === 'denied';
  const isDefault = permission === 'default';
  const canNotify = capabilities.canNotify;
  const isInstalledPWA = capabilities.isInstalledPWA;
  const isIOS = capabilities.isIOS;
  const notificationsEnabled = notificationLevel !== 'none' && isGranted;

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!canNotify) {
      console.warn('[useNotifications] Cannot request permission:', capabilities.reason);
      return false;
    }

    setIsRequesting(true);

    try {
      const granted = await service.requestPermission();
      const newPermission = service.getPermission();
      setPermission(newPermission);

      if (newPermission !== permission) {
        opts.onPermissionChange(newPermission);
      }

      return granted;
    } finally {
      setIsRequesting(false);
    }
  }, [service, canNotify, capabilities.reason, permission, opts]);

  // Show notification
  const showNotification = useCallback(
    async (notificationOptions: MessageNotificationOptions): Promise<boolean> => {
      if (!isGranted) {
        console.warn('[useNotifications] Cannot show notification: not granted');
        return false;
      }

      return showMessageNotification(notificationOptions);
    },
    [isGranted]
  );

  // Clear channel notifications
  const clearChannel = useCallback(
    async (channelId: string): Promise<void> => {
      await clearChannelNotifications(channelId);
    },
    []
  );

  // Clear all notifications
  const clearAll = useCallback(async (): Promise<void> => {
    await clearAllNotifications();
  }, []);

  // Set badge count
  const setBadge = useCallback(
    async (count: number): Promise<boolean> => {
      setBadgeCountState(count);
      return service.setBadge(count);
    },
    [service]
  );

  // Clear badge
  const clearBadge = useCallback(async (): Promise<boolean> => {
    setBadgeCountState(0);
    return service.clearBadge();
  }, [service]);

  // Sync badge with unread count
  const syncBadge = useCallback(async (): Promise<void> => {
    setBadgeCountState(unreadCount);
    await service.setBadge(unreadCount);
  }, [service, unreadCount]);

  // Set notification level in settings
  const setNotificationLevel = useCallback(
    (level: 'all' | 'mentions' | 'none') => {
      setNotifications(level);
    },
    [setNotifications]
  );

  // Setup event listeners
  useEffect(() => {
    if (!opts.listenToEvents) return;

    const handleEvent: NotificationEventListener = (event: NotificationEvent) => {
      switch (event.type) {
        case 'permission-change':
          if (event.permission) {
            setPermission(event.permission);
            opts.onPermissionChange(event.permission);
          }
          break;

        case 'notification-clicked':
          opts.onNotificationClick(event.notificationData as Record<string, unknown> | undefined);
          break;

        case 'badge-updated':
          if (typeof event.badgeCount === 'number') {
            setBadgeCountState(event.badgeCount);
          }
          break;
      }
    };

    const unsubscribe = service.addEventListener(handleEvent);

    return () => {
      unsubscribe();
    };
  }, [service, opts]);

  // Auto-sync badge with unread count
  useEffect(() => {
    if (!opts.autoSyncBadge) return;
    if (!isGranted) return;

    setBadgeCountState(unreadCount);
    service.setBadge(unreadCount);
  }, [opts.autoSyncBadge, isGranted, unreadCount, service]);

  // Auto-request permission on mount
  useEffect(() => {
    if (!opts.autoRequestPermission) return;
    if (!canNotify) return;
    if (!isDefault) return;

    requestPermission();
  }, [opts.autoRequestPermission, canNotify, isDefault, requestPermission]);

  // Listen for service worker messages
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      const { type, data } = event.data || {};

      switch (type) {
        case 'GET_BADGE_COUNT':
          // Service worker is requesting badge count
          navigator.serviceWorker.controller?.postMessage({
            type: 'SET_BADGE_COUNT',
            data: { count: unreadCount },
          });
          break;

        case 'NOTIFICATION_CLICKED':
          // Handle notification click from service worker
          opts.onNotificationClick(data);
          break;

        case 'NOTIFICATION_ACTION':
          // Handle notification action
          if (data?.action === 'mark-read' && data?.channelId) {
            // Could dispatch action to mark channel as read
            console.log('[useNotifications] Mark read action:', data.channelId);
          }
          break;
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, [unreadCount, opts]);

  // Listen for custom notification navigate event
  useEffect(() => {
    const handleNavigate = (event: CustomEvent<{ channelId: string }>) => {
      const { channelId } = event.detail;
      opts.onNotificationClick({ channelId });
    };

    window.addEventListener('notification-navigate', handleNavigate as EventListener);

    return () => {
      window.removeEventListener('notification-navigate', handleNavigate as EventListener);
    };
  }, [opts]);

  return {
    // Permission state
    permission,
    isGranted,
    isDenied,
    isDefault,

    // Capabilities
    capabilities,
    canNotify,
    isInstalledPWA,
    isIOS,

    // Actions
    requestPermission,
    showNotification,
    clearChannel,
    clearAll,

    // Badge management
    badgeCount,
    setBadge,
    clearBadge,
    syncBadge,

    // Settings
    notificationsEnabled,
    notificationLevel,
    setNotificationLevel,

    // Loading state
    isRequesting,
  };
}

// ============================================================================
// Simplified Hooks
// ============================================================================

/**
 * Hook for just checking notification permission status.
 * Lightweight version when you don't need full functionality.
 */
export function useNotificationPermission(): NotificationPermission {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const service = getNotificationService();
    setPermission(service.getPermission());

    const unsubscribe = service.addEventListener((event) => {
      if (event.type === 'permission-change' && event.permission) {
        setPermission(event.permission);
      }
    });

    return unsubscribe;
  }, []);

  return permission;
}

/**
 * Hook for checking if notifications are supported.
 */
export function useNotificationSupport(): NotificationCapabilities {
  const [capabilities, setCapabilities] = useState<NotificationCapabilities>(() =>
    getNotificationService().getCapabilities()
  );

  useEffect(() => {
    // Re-check capabilities (in case PWA status changed)
    const service = getNotificationService();
    service.resetCapabilities();
    setCapabilities(service.getCapabilities());
  }, []);

  return capabilities;
}

/**
 * Hook for managing just the badge count.
 */
export function useNotificationBadge() {
  const unreadCount = useTotalUnreadCount();
  const [badgeCount, setBadgeCountState] = useState(unreadCount);

  const setBadge = useCallback(async (count: number) => {
    setBadgeCountState(count);
    const service = getNotificationService();
    await service.setBadge(count);
  }, []);

  const clearBadge = useCallback(async () => {
    setBadgeCountState(0);
    const service = getNotificationService();
    await service.clearBadge();
  }, []);

  // Auto-sync badge when unread count changes
  useEffect(() => {
    setBadgeCountState(unreadCount);
    const service = getNotificationService();
    service.setBadge(unreadCount);
  }, [unreadCount]);

  return {
    badgeCount,
    setBadge,
    clearBadge,
  };
}

// ============================================================================
// Export
// ============================================================================

export default useNotifications;
