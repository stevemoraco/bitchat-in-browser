/**
 * Notification Service
 *
 * Manages push notifications for the BitChat PWA:
 * - Check and request notification permissions
 * - Show local notifications
 * - Handle notification clicks
 * - Badge management (unread count)
 *
 * Platform support:
 * - Android Chrome: Full support
 * - iOS Safari 16.4+: Home Screen PWA only
 * - Desktop browsers: Full support
 *
 * @module services/notifications
 */

import { getTotalUnreadCount } from '../../stores/messages-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Notification permission status
 */
export type NotificationPermission = 'default' | 'granted' | 'denied';

/**
 * Notification data passed to the service worker
 */
export interface NotificationData {
  /** Type of notification */
  type: 'message' | 'connection' | 'sync' | 'system';
  /** Channel ID for message notifications */
  channelId?: string;
  /** Sender fingerprint for message notifications */
  senderFingerprint?: string;
  /** URL to open when notification is clicked */
  url?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for showing a notification
 */
export interface ShowNotificationOptions {
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** Icon URL (defaults to app icon) */
  icon?: string;
  /** Badge icon URL (small icon for status bar) */
  badge?: string;
  /** Tag for notification grouping/replacement */
  tag?: string;
  /** Data to pass to click handler */
  data?: NotificationData;
  /** Whether notification requires user interaction to dismiss */
  requireInteraction?: boolean;
  /** Whether to play sound (respects user settings) */
  silent?: boolean;
  /** Vibration pattern for mobile */
  vibrate?: number[];
  /** Timestamp for notification */
  timestamp?: number;
  /** Actions for the notification */
  actions?: NotificationAction[];
  /** Image to display in notification */
  image?: string;
  /** Renotify even if same tag exists */
  renotify?: boolean;
}

/**
 * Notification action button
 */
export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

/**
 * Platform capabilities for notifications
 */
export interface NotificationCapabilities {
  /** Whether notifications are supported at all */
  supported: boolean;
  /** Whether push notifications are supported */
  pushSupported: boolean;
  /** Whether the Badge API is supported */
  badgeSupported: boolean;
  /** Whether running as installed PWA */
  isInstalledPWA: boolean;
  /** Whether on iOS (special handling needed) */
  isIOS: boolean;
  /** iOS version if applicable */
  iOSVersion?: number;
  /** Whether notifications can work */
  canNotify: boolean;
  /** Reason if notifications cannot work */
  reason?: string;
}

/**
 * Notification service event
 */
export interface NotificationEvent {
  type: 'permission-change' | 'notification-shown' | 'notification-clicked' | 'badge-updated';
  permission?: NotificationPermission;
  notificationData?: NotificationData;
  badgeCount?: number;
}

export type NotificationEventListener = (event: NotificationEvent) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_ICON = '/icons/icon-192x192.png';
const DEFAULT_BADGE = '/icons/badge-72x72.png';

// Extended notification options type for service worker
interface ExtendedNotificationOptions extends NotificationOptions {
  timestamp?: number;
  vibrate?: number[];
  actions?: NotificationAction[];
  image?: string;
  renotify?: boolean;
}

// ============================================================================
// NotificationService Class
// ============================================================================

/**
 * NotificationService manages all notification functionality for the PWA.
 *
 * @example
 * ```typescript
 * const notifications = new NotificationService();
 *
 * // Check capabilities
 * const caps = notifications.getCapabilities();
 * if (!caps.canNotify) {
 *   console.log('Cannot notify:', caps.reason);
 * }
 *
 * // Request permission
 * const granted = await notifications.requestPermission();
 *
 * // Show notification
 * if (granted) {
 *   await notifications.show({
 *     title: 'New Message',
 *     body: 'You have a new message from Alice',
 *     data: { type: 'message', channelId: 'abc123' }
 *   });
 * }
 *
 * // Update badge
 * await notifications.updateBadge(5);
 * ```
 */
export class NotificationService {
  private listeners: Set<NotificationEventListener> = new Set();
  private capabilities: NotificationCapabilities | null = null;

  constructor() {
    this.setupMessageListener();
  }

  // ============================================================================
  // Permission Management
  // ============================================================================

  /**
   * Get current notification permission
   */
  getPermission(): NotificationPermission {
    if (typeof Notification === 'undefined') {
      return 'denied';
    }
    return Notification.permission as NotificationPermission;
  }

  /**
   * Check if notifications are granted
   */
  isGranted(): boolean {
    return this.getPermission() === 'granted';
  }

  /**
   * Check if permission has been denied
   */
  isDenied(): boolean {
    return this.getPermission() === 'denied';
  }

  /**
   * Check if permission hasn't been requested yet
   */
  isDefault(): boolean {
    return this.getPermission() === 'default';
  }

  /**
   * Request notification permission from the user.
   * Should be called in response to user action (button click).
   *
   * @returns true if permission was granted
   */
  async requestPermission(): Promise<boolean> {
    if (typeof Notification === 'undefined') {
      console.warn('[Notifications] Notification API not available');
      return false;
    }

    // Already granted
    if (this.isGranted()) {
      return true;
    }

    // Already denied - can't ask again
    if (this.isDenied()) {
      console.warn('[Notifications] Permission was previously denied');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      const granted = result === 'granted';

      this.notifyListeners({
        type: 'permission-change',
        permission: result as NotificationPermission,
      });

      if (granted) {
        console.log('[Notifications] Permission granted');
        // Update badge to current count when permission granted
        await this.syncBadgeWithUnreadCount();
      } else {
        console.log('[Notifications] Permission denied');
      }

      return granted;
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error);
      return false;
    }
  }

  // ============================================================================
  // Capability Detection
  // ============================================================================

  /**
   * Detect notification capabilities for the current platform
   */
  getCapabilities(): NotificationCapabilities {
    if (this.capabilities) {
      return this.capabilities;
    }

    const capabilities: NotificationCapabilities = {
      supported: false,
      pushSupported: false,
      badgeSupported: false,
      isInstalledPWA: false,
      isIOS: false,
      canNotify: false,
    };

    // Check if in browser environment
    if (typeof window === 'undefined') {
      capabilities.reason = 'Not in browser environment';
      this.capabilities = capabilities;
      return capabilities;
    }

    // Detect iOS
    const userAgent = navigator.userAgent;
    capabilities.isIOS = /iPad|iPhone|iPod/.test(userAgent);

    // Get iOS version if applicable
    if (capabilities.isIOS) {
      const match = userAgent.match(/OS (\d+)_/);
      if (match && match[1]) {
        capabilities.iOSVersion = parseInt(match[1], 10);
      }
    }

    // Check if installed as PWA
    capabilities.isInstalledPWA = this.detectInstalledPWA();

    // Check basic notification support
    capabilities.supported = 'Notification' in window;

    // Check push support
    capabilities.pushSupported =
      'PushManager' in window && 'serviceWorker' in navigator;

    // Check Badge API support
    capabilities.badgeSupported = 'setAppBadge' in navigator;

    // Determine if notifications can work
    if (!capabilities.supported) {
      capabilities.reason = 'Notifications not supported in this browser';
    } else if (capabilities.isIOS) {
      // iOS requires:
      // 1. iOS 16.4+
      // 2. Installed as PWA (Home Screen)
      if (capabilities.iOSVersion && capabilities.iOSVersion < 16) {
        capabilities.reason = 'iOS 16.4+ required for notifications';
      } else if (!capabilities.isInstalledPWA) {
        capabilities.reason =
          'Add to Home Screen required for notifications on iOS';
      } else {
        capabilities.canNotify = true;
      }
    } else {
      // Non-iOS - generally works
      capabilities.canNotify = true;
    }

    this.capabilities = capabilities;
    return capabilities;
  }

  /**
   * Detect if the app is installed as a PWA
   */
  private detectInstalledPWA(): boolean {
    // Check display-mode media query
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return true;
    }

    // Check iOS standalone mode
    if ('standalone' in navigator && (navigator as any).standalone === true) {
      return true;
    }

    // Check for TWA (Trusted Web Activity on Android)
    if (document.referrer.includes('android-app://')) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // Show Notifications
  // ============================================================================

  /**
   * Show a notification via the service worker.
   * Falls back to local Notification API if SW not available.
   */
  async show(options: ShowNotificationOptions): Promise<boolean> {
    const caps = this.getCapabilities();

    if (!caps.canNotify) {
      console.warn('[Notifications] Cannot show notification:', caps.reason);
      return false;
    }

    if (!this.isGranted()) {
      console.warn('[Notifications] Permission not granted');
      return false;
    }

    // Use extended type for service worker notification options
    const notificationOptions: ExtendedNotificationOptions = {
      body: options.body,
      icon: options.icon || DEFAULT_ICON,
      badge: options.badge || DEFAULT_BADGE,
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction ?? false,
      silent: options.silent ?? false,
      timestamp: options.timestamp || Date.now(),
      renotify: options.renotify ?? false,
    };

    // Add vibration for mobile
    if (options.vibrate && !options.silent) {
      notificationOptions.vibrate = options.vibrate;
    }

    // Add actions if supported
    if (options.actions && options.actions.length > 0) {
      notificationOptions.actions = options.actions;
    }

    // Add image if provided
    if (options.image) {
      notificationOptions.image = options.image;
    }

    try {
      // Try service worker first for better background support
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(options.title, notificationOptions);
      } else {
        // Fallback to direct Notification API
        new Notification(options.title, notificationOptions);
      }

      this.notifyListeners({
        type: 'notification-shown',
        notificationData: options.data,
      });

      console.log('[Notifications] Notification shown:', options.title);
      return true;
    } catch (error) {
      console.error('[Notifications] Error showing notification:', error);
      return false;
    }
  }

  /**
   * Close notifications by tag
   */
  async closeByTag(tag: string): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications({ tag });
      notifications.forEach((notification) => notification.close());
    } catch (error) {
      console.error('[Notifications] Error closing notifications:', error);
    }
  }

  /**
   * Close all notifications
   */
  async closeAll(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const notifications = await registration.getNotifications();
      notifications.forEach((notification) => notification.close());
    } catch (error) {
      console.error('[Notifications] Error closing all notifications:', error);
    }
  }

  // ============================================================================
  // Badge Management
  // ============================================================================

  /**
   * Set the app badge count (shows on app icon)
   */
  async setBadge(count: number): Promise<boolean> {
    const caps = this.getCapabilities();

    if (!caps.badgeSupported) {
      console.log('[Notifications] Badge API not supported');
      return false;
    }

    try {
      if (count > 0) {
        await (navigator as any).setAppBadge(count);
      } else {
        await (navigator as any).clearAppBadge();
      }

      this.notifyListeners({
        type: 'badge-updated',
        badgeCount: count,
      });

      console.log('[Notifications] Badge updated:', count);
      return true;
    } catch (error) {
      console.error('[Notifications] Error setting badge:', error);
      return false;
    }
  }

  /**
   * Clear the app badge
   */
  async clearBadge(): Promise<boolean> {
    return this.setBadge(0);
  }

  /**
   * Sync badge count with current unread message count
   */
  async syncBadgeWithUnreadCount(): Promise<void> {
    const unreadCount = getTotalUnreadCount();
    await this.setBadge(unreadCount);
  }

  /**
   * Update badge by incrementing current count
   */
  async incrementBadge(): Promise<boolean> {
    const unreadCount = getTotalUnreadCount();
    return this.setBadge(unreadCount);
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add event listener
   */
  addEventListener(listener: NotificationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Setup listener for messages from service worker
   */
  private setupMessageListener(): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'NOTIFICATION_CLICKED') {
        this.handleNotificationClick(event.data.data);
      }
    });
  }

  /**
   * Handle notification click from service worker
   */
  private handleNotificationClick(data?: NotificationData): void {
    this.notifyListeners({
      type: 'notification-clicked',
      notificationData: data,
    });

    // Navigate to appropriate location based on data
    if (data?.channelId) {
      // Dispatch custom event for app to handle navigation
      window.dispatchEvent(
        new CustomEvent('notification-navigate', {
          detail: { channelId: data.channelId },
        })
      );
    }
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(event: NotificationEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[Notifications] Error in event listener:', error);
      }
    }
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Reset cached capabilities (useful for testing)
   */
  resetCapabilities(): void {
    this.capabilities = null;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultInstance: NotificationService | null = null;

/**
 * Get the default NotificationService instance
 */
export function getNotificationService(): NotificationService {
  if (!defaultInstance) {
    defaultInstance = new NotificationService();
  }
  return defaultInstance;
}

/**
 * Reset the default instance (for testing)
 */
export function resetNotificationService(): void {
  defaultInstance = null;
}

// Export local notifications
export * from './local';
