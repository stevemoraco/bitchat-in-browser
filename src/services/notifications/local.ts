/**
 * Local Notifications Module
 *
 * Provides formatted notifications for various app events:
 * - New message notifications
 * - Connection status changes
 * - Sync complete notifications
 *
 * Uses the notification service to show notifications with
 * properly formatted content and appropriate settings.
 *
 * @module services/notifications/local
 */

import type {
  NotificationService,
  ShowNotificationOptions,
  NotificationData} from './index';
import {
  getNotificationService
} from './index';
import type { Message, Peer, Channel } from '../../stores/types';
import { useSettingsStore } from '../../stores/settings-store';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for message notifications
 */
export interface MessageNotificationOptions {
  /** The message that triggered the notification */
  message: Message;
  /** The channel the message belongs to */
  channel: Channel;
  /** The sender peer info (if available) */
  sender?: Peer;
  /** Whether this is a mention of the current user */
  isMention?: boolean;
}

/**
 * Options for connection notifications
 */
export interface ConnectionNotificationOptions {
  /** The peer that connected/disconnected */
  peer: Peer;
  /** Connection event type */
  eventType: 'connected' | 'disconnected';
  /** The channel where connection occurred */
  channel?: Channel;
}

/**
 * Options for sync notifications
 */
export interface SyncNotificationOptions {
  /** Number of messages synced */
  messageCount: number;
  /** Number of channels affected */
  channelCount: number;
  /** Duration of sync in milliseconds */
  durationMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const NOTIFICATION_TAGS = {
  MESSAGE: 'bitchat-message',
  CONNECTION: 'bitchat-connection',
  SYNC: 'bitchat-sync',
  SYSTEM: 'bitchat-system',
} as const;

const MAX_BODY_LENGTH = 200;
const MAX_TITLE_LENGTH = 50;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Truncate text to max length with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 3)  }...`;
}

/**
 * Format sender name for display
 */
function formatSenderName(
  message: Message,
  sender?: Peer
): string {
  if (sender?.nickname) {
    return sender.nickname;
  }
  if (message.senderNickname) {
    return message.senderNickname;
  }
  // Show truncated fingerprint as fallback
  return message.senderFingerprint.substring(0, 8);
}

/**
 * Format channel name for display
 */
function formatChannelName(channel: Channel): string {
  if (channel.type === 'dm') {
    return 'Direct Message';
  }
  return channel.name || 'Unknown Channel';
}

/**
 * Check if notifications should be shown based on settings
 */
function shouldNotify(isMention: boolean = false): boolean {
  const settings = useSettingsStore.getState().settings;

  if (settings.notifications === 'none') {
    return false;
  }

  if (settings.notifications === 'mentions') {
    return isMention;
  }

  return true; // 'all'
}

/**
 * Check if notification should be silent based on settings
 */
function shouldBeSilent(): boolean {
  const settings = useSettingsStore.getState().settings;
  return !settings.soundEnabled;
}

// ============================================================================
// Local Notification Functions
// ============================================================================

/**
 * Show a notification for a new message.
 *
 * @example
 * ```typescript
 * await showMessageNotification({
 *   message: newMessage,
 *   channel: currentChannel,
 *   sender: senderPeer,
 *   isMention: true,
 * });
 * ```
 */
export async function showMessageNotification(
  options: MessageNotificationOptions
): Promise<boolean> {
  const { message, channel, sender, isMention = false } = options;

  // Check if notifications should be shown
  if (!shouldNotify(isMention)) {
    return false;
  }

  // Don't notify for own messages
  if (message.isOwn) {
    return false;
  }

  // Don't notify for system messages
  if (message.type === 'system') {
    return false;
  }

  // Check if channel is muted
  if (channel.isMuted) {
    return false;
  }

  const service = getNotificationService();
  const senderName = formatSenderName(message, sender);
  const channelName = formatChannelName(channel);

  // Format title
  let title: string;
  if (channel.type === 'dm') {
    title = senderName;
  } else {
    title = `${senderName} in ${channelName}`;
  }
  title = truncate(title, MAX_TITLE_LENGTH);

  // Format body
  const body = truncate(message.content, MAX_BODY_LENGTH);

  // Create notification data
  const data: NotificationData = {
    type: 'message',
    channelId: channel.id,
    senderFingerprint: message.senderFingerprint,
    url: `/?channel=${channel.id}`,
  };

  // Build notification options
  const notificationOptions: ShowNotificationOptions = {
    title,
    body,
    tag: `${NOTIFICATION_TAGS.MESSAGE}-${channel.id}`,
    data,
    silent: shouldBeSilent(),
    renotify: true, // Always renotify for new messages
    timestamp: message.timestamp,
    vibrate: [200, 100, 200],
  };

  // Add mention styling if applicable
  if (isMention) {
    notificationOptions.requireInteraction = true;
  }

  return service.show(notificationOptions);
}

/**
 * Show a notification for connection status change.
 *
 * @example
 * ```typescript
 * await showConnectionNotification({
 *   peer: connectedPeer,
 *   eventType: 'connected',
 *   channel: currentChannel,
 * });
 * ```
 */
export async function showConnectionNotification(
  options: ConnectionNotificationOptions
): Promise<boolean> {
  const { peer, eventType, channel } = options;

  // Connection notifications only for mentions level or higher
  if (!shouldNotify(true)) {
    return false;
  }

  const service = getNotificationService();
  const peerName = peer.nickname || peer.fingerprint.substring(0, 8);

  // Format title and body
  let title: string;
  let body: string;

  if (eventType === 'connected') {
    title = 'Peer Connected';
    body = channel
      ? `${peerName} joined ${formatChannelName(channel)}`
      : `${peerName} is now online`;
  } else {
    title = 'Peer Disconnected';
    body = channel
      ? `${peerName} left ${formatChannelName(channel)}`
      : `${peerName} went offline`;
  }

  const data: NotificationData = {
    type: 'connection',
    channelId: channel?.id,
    senderFingerprint: peer.fingerprint,
  };

  const notificationOptions: ShowNotificationOptions = {
    title,
    body,
    tag: NOTIFICATION_TAGS.CONNECTION,
    data,
    silent: true, // Connection notifications are always silent
    renotify: false, // Don't stack connection notifications
  };

  return service.show(notificationOptions);
}

/**
 * Show a notification when sync is complete.
 *
 * @example
 * ```typescript
 * await showSyncCompleteNotification({
 *   messageCount: 42,
 *   channelCount: 3,
 *   durationMs: 5000,
 * });
 * ```
 */
export async function showSyncCompleteNotification(
  options: SyncNotificationOptions
): Promise<boolean> {
  const { messageCount, channelCount, durationMs } = options;

  // Only show if there were actually messages synced
  if (messageCount === 0) {
    return false;
  }

  // Only notify if notifications are enabled
  if (!shouldNotify()) {
    return false;
  }

  const service = getNotificationService();

  const title = 'Sync Complete';
  const body = formatSyncBody(messageCount, channelCount, durationMs);

  const data: NotificationData = {
    type: 'sync',
  };

  const notificationOptions: ShowNotificationOptions = {
    title,
    body,
    tag: NOTIFICATION_TAGS.SYNC,
    data,
    silent: true,
    renotify: false,
  };

  return service.show(notificationOptions);
}

/**
 * Format the sync notification body
 */
function formatSyncBody(
  messageCount: number,
  channelCount: number,
  durationMs: number
): string {
  const messages = messageCount === 1 ? 'message' : 'messages';
  const channels = channelCount === 1 ? 'channel' : 'channels';
  const seconds = (durationMs / 1000).toFixed(1);

  return `Synced ${messageCount} new ${messages} across ${channelCount} ${channels} in ${seconds}s`;
}

/**
 * Show a system notification (e.g., app updates, errors).
 *
 * @example
 * ```typescript
 * await showSystemNotification('Update Available', 'A new version is ready to install.');
 * ```
 */
export async function showSystemNotification(
  title: string,
  body: string,
  options?: Partial<ShowNotificationOptions>
): Promise<boolean> {
  const service = getNotificationService();

  const data: NotificationData = {
    type: 'system',
    ...options?.data,
  };

  const notificationOptions: ShowNotificationOptions = {
    title: truncate(title, MAX_TITLE_LENGTH),
    body: truncate(body, MAX_BODY_LENGTH),
    tag: NOTIFICATION_TAGS.SYSTEM,
    data,
    silent: shouldBeSilent(),
    ...options,
  };

  return service.show(notificationOptions);
}

/**
 * Show an offline notification when app goes offline.
 */
export async function showOfflineNotification(): Promise<boolean> {
  return showSystemNotification(
    'You are offline',
    'Messages will be sent when connection is restored.',
    { silent: true }
  );
}

/**
 * Show an online notification when app comes back online.
 */
export async function showOnlineNotification(): Promise<boolean> {
  return showSystemNotification(
    'Back online',
    'Your connection has been restored.',
    { silent: true }
  );
}

/**
 * Close all message notifications for a channel.
 * Call this when user opens a channel to clear pending notifications.
 */
export async function clearChannelNotifications(channelId: string): Promise<void> {
  const service = getNotificationService();
  await service.closeByTag(`${NOTIFICATION_TAGS.MESSAGE}-${channelId}`);
}

/**
 * Close all notifications.
 * Call this when user focuses the app.
 */
export async function clearAllNotifications(): Promise<void> {
  const service = getNotificationService();
  await service.closeAll();
}

// ============================================================================
// Notification Manager Class
// ============================================================================

/**
 * LocalNotificationManager provides a class-based interface for managing
 * local notifications. Useful when you need to track state or customize behavior.
 */
export class LocalNotificationManager {
  private enabled: boolean = true;

  constructor(_service?: NotificationService) {
    // Service parameter kept for API compatibility but delegated to singleton
  }

  /**
   * Enable or disable notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Show a message notification
   */
  async notifyMessage(options: MessageNotificationOptions): Promise<boolean> {
    if (!this.enabled) return false;
    return showMessageNotification(options);
  }

  /**
   * Show a connection notification
   */
  async notifyConnection(
    options: ConnectionNotificationOptions
  ): Promise<boolean> {
    if (!this.enabled) return false;
    return showConnectionNotification(options);
  }

  /**
   * Show a sync complete notification
   */
  async notifySyncComplete(options: SyncNotificationOptions): Promise<boolean> {
    if (!this.enabled) return false;
    return showSyncCompleteNotification(options);
  }

  /**
   * Show a system notification
   */
  async notifySystem(
    title: string,
    body: string,
    options?: Partial<ShowNotificationOptions>
  ): Promise<boolean> {
    if (!this.enabled) return false;
    return showSystemNotification(title, body, options);
  }

  /**
   * Clear notifications for a channel
   */
  async clearChannel(channelId: string): Promise<void> {
    return clearChannelNotifications(channelId);
  }

  /**
   * Clear all notifications
   */
  async clearAll(): Promise<void> {
    return clearAllNotifications();
  }
}

// ============================================================================
// Default Instance
// ============================================================================

let defaultManager: LocalNotificationManager | null = null;

/**
 * Get the default LocalNotificationManager instance
 */
export function getLocalNotificationManager(): LocalNotificationManager {
  if (!defaultManager) {
    defaultManager = new LocalNotificationManager();
  }
  return defaultManager;
}

/**
 * Reset the default manager (for testing)
 */
export function resetLocalNotificationManager(): void {
  defaultManager = null;
}
