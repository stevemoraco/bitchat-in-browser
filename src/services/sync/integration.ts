/**
 * Sync Integration
 *
 * Bridges the offline queue with the Nostr client and message store.
 * Provides handlers for each action type and integrates with the app state.
 *
 * @module services/sync/integration
 */

import {
  OfflineQueue,
  ActionType,
  getOfflineQueue,
  type ActionResult,
  type QueuedAction,
  type SendMessagePayload,
  type PublishEventPayload,
  type SubscribeChannelPayload,
  type UpdateProfilePayload,
  type SyncMessagesPayload,
  type SyncProgressEvent,
} from './offline-queue';
import { getNetworkStatus, initNetworkStatus } from './network-status';
import type { NostrEvent, PublishResult } from '../nostr/types';

// ============================================================================
// Types
// ============================================================================

/**
 * Integration configuration
 */
export interface SyncIntegrationConfig {
  /** Nostr client publish function */
  publishEvent: (event: NostrEvent, relayUrls?: string[]) => Promise<PublishResult>;
  /** Function to update message status in store */
  updateMessageStatus: (
    channelId: string,
    messageId: string,
    status: 'pending' | 'sent' | 'delivered' | 'failed'
  ) => void;
  /** Function to check if message exists (for conflict detection) */
  messageExists?: (messageId: string) => boolean;
  /** Function to subscribe to a channel */
  subscribeChannel?: (channelId: string, type: 'location' | 'public' | 'dm', geohash?: string) => Promise<void>;
  /** Function to update user profile */
  updateProfile?: (nickname?: string, metadata?: Record<string, string>) => Promise<PublishResult>;
  /** Function to sync messages from relays */
  syncMessages?: (channelId: string, since?: number, until?: number) => Promise<void>;
  /** Callback when sync progress changes */
  onSyncProgress?: (event: SyncProgressEvent) => void;
  /** Callback when action fails after all retries */
  onActionFailed?: (action: QueuedAction, error: string) => void;
}

/**
 * Sync integration status
 */
export interface SyncIntegrationStatus {
  /** Whether integration is initialized */
  isInitialized: boolean;
  /** Whether network is online */
  isOnline: boolean;
  /** Number of pending actions */
  pendingCount: number;
  /** Number of failed actions */
  failedCount: number;
  /** Whether sync is in progress */
  isSyncing: boolean;
}

// ============================================================================
// SyncIntegration Class
// ============================================================================

/**
 * SyncIntegration connects the offline queue to the rest of the application.
 *
 * It:
 * - Registers handlers for each action type
 * - Updates message store status based on action results
 * - Handles conflict detection (e.g., message already sent)
 * - Emits progress events for UI updates
 *
 * @example
 * ```typescript
 * import { SyncIntegration } from '@/services/sync/integration';
 * import { nostrClient } from '@/services/nostr';
 * import { useMessagesStore } from '@/stores';
 *
 * const syncIntegration = new SyncIntegration({
 *   publishEvent: (event, relays) => nostrClient.publish(event, relays),
 *   updateMessageStatus: (channelId, messageId, status) => {
 *     useMessagesStore.getState().updateMessageStatus(channelId, messageId, status);
 *   },
 *   onSyncProgress: (event) => {
 *     console.log(`Sync: ${event.completed}/${event.total}`);
 *   },
 * });
 *
 * await syncIntegration.initialize();
 *
 * // Queue a message to be sent
 * await syncIntegration.queueMessage({
 *   channelId: 'channel_123',
 *   content: 'Hello!',
 *   localMessageId: 'local_msg_123',
 *   nostrEvent: signedEvent,
 * });
 * ```
 */
export class SyncIntegration {
  private queue: OfflineQueue;
  private config: SyncIntegrationConfig;
  private isInitialized = false;
  private progressUnsubscribe: (() => void) | null = null;

  constructor(config: SyncIntegrationConfig) {
    this.config = config;
    this.queue = getOfflineQueue();
  }

  /**
   * Initialize the sync integration
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Initialize network status monitoring
    initNetworkStatus();

    // Register action handlers
    this.registerHandlers();

    // Listen for progress events
    if (this.config.onSyncProgress) {
      this.progressUnsubscribe = this.queue.onProgress(this.config.onSyncProgress);
    }

    // Start the queue
    this.queue.start();

    this.isInitialized = true;
    console.log('[SyncIntegration] Initialized');
  }

  /**
   * Shutdown the sync integration
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) return;

    if (this.progressUnsubscribe) {
      this.progressUnsubscribe();
      this.progressUnsubscribe = null;
    }

    this.queue.stop();
    this.isInitialized = false;
    console.log('[SyncIntegration] Shutdown');
  }

  /**
   * Get current status
   */
  async getStatus(): Promise<SyncIntegrationStatus> {
    const stats = await this.queue.getStats();
    const networkStatus = getNetworkStatus();

    return {
      isInitialized: this.isInitialized,
      isOnline: networkStatus.isOnline(),
      pendingCount: stats.pending,
      failedCount: stats.failed,
      isSyncing: stats.processing > 0,
    };
  }

  // ==========================================================================
  // Action Queueing Methods
  // ==========================================================================

  /**
   * Queue a message to be sent
   */
  async queueMessage(payload: SendMessagePayload): Promise<void> {
    // Mark message as pending in store
    this.config.updateMessageStatus(
      payload.channelId,
      payload.localMessageId,
      'pending'
    );

    await this.queue.enqueue({
      type: ActionType.SEND_MESSAGE,
      payload: {
        ...payload,
        dedupeKey: `msg_${payload.localMessageId}`,
      },
    });
  }

  /**
   * Queue a Nostr event to be published
   */
  async queueEvent(event: NostrEvent, relayUrls?: string[]): Promise<void> {
    await this.queue.enqueue({
      type: ActionType.PUBLISH_EVENT,
      payload: {
        event,
        relayUrls,
        dedupeKey: `event_${event.id}`,
      },
    });
  }

  /**
   * Queue a channel subscription
   */
  async queueSubscription(
    channelId: string,
    channelType: 'location' | 'public' | 'dm',
    geohash?: string
  ): Promise<void> {
    await this.queue.enqueue({
      type: ActionType.SUBSCRIBE_CHANNEL,
      payload: {
        channelId,
        channelType,
        geohash,
        dedupeKey: `sub_${channelId}`,
      },
    });
  }

  /**
   * Queue a profile update
   */
  async queueProfileUpdate(
    nickname?: string,
    metadata?: Record<string, string>
  ): Promise<void> {
    await this.queue.enqueue({
      type: ActionType.UPDATE_PROFILE,
      payload: {
        nickname,
        metadata,
        dedupeKey: `profile_${Date.now()}`,
      },
    });
  }

  /**
   * Queue a message sync operation
   */
  async queueMessageSync(
    channelId: string,
    since?: number,
    until?: number
  ): Promise<void> {
    await this.queue.enqueue({
      type: ActionType.SYNC_MESSAGES,
      payload: {
        channelId,
        since,
        until,
        dedupeKey: `sync_${channelId}_${since ?? 0}_${until ?? 'now'}`,
      },
    });
  }

  // ==========================================================================
  // Queue Management Methods
  // ==========================================================================

  /**
   * Retry all failed actions
   */
  async retryFailed(): Promise<number> {
    return this.queue.retryAll();
  }

  /**
   * Clear all completed actions
   */
  async clearCompleted(): Promise<number> {
    return this.queue.clearCompleted();
  }

  /**
   * Get pending action count
   */
  async getPendingCount(): Promise<number> {
    const stats = await this.queue.getStats();
    return stats.pending;
  }

  /**
   * Get failed actions
   */
  async getFailedActions(): Promise<QueuedAction[]> {
    return this.queue.getFailed();
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private registerHandlers(): void {
    // SEND_MESSAGE handler
    this.queue.registerHandler<SendMessagePayload>(
      ActionType.SEND_MESSAGE,
      async (action) => {
        return this.handleSendMessage(action);
      }
    );

    // PUBLISH_EVENT handler
    this.queue.registerHandler<PublishEventPayload>(
      ActionType.PUBLISH_EVENT,
      async (action) => {
        return this.handlePublishEvent(action);
      }
    );

    // SUBSCRIBE_CHANNEL handler
    this.queue.registerHandler<SubscribeChannelPayload>(
      ActionType.SUBSCRIBE_CHANNEL,
      async (action) => {
        return this.handleSubscribeChannel(action);
      }
    );

    // UPDATE_PROFILE handler
    this.queue.registerHandler<UpdateProfilePayload>(
      ActionType.UPDATE_PROFILE,
      async (action) => {
        return this.handleUpdateProfile(action);
      }
    );

    // SYNC_MESSAGES handler
    this.queue.registerHandler<SyncMessagesPayload>(
      ActionType.SYNC_MESSAGES,
      async (action) => {
        return this.handleSyncMessages(action);
      }
    );
  }

  private async handleSendMessage(
    action: QueuedAction<SendMessagePayload>
  ): Promise<ActionResult> {
    const { channelId, localMessageId, nostrEvent } = action.payload;

    // Check for conflict (message already exists on server)
    if (this.config.messageExists?.(localMessageId)) {
      this.config.updateMessageStatus(channelId, localMessageId, 'delivered');
      return {
        success: false,
        isConflict: true,
        error: 'Message already exists',
      };
    }

    // If no Nostr event, we can't send
    if (!nostrEvent) {
      this.config.updateMessageStatus(channelId, localMessageId, 'failed');
      return {
        success: false,
        error: 'No Nostr event to publish',
      };
    }

    try {
      const result = await this.config.publishEvent(nostrEvent);

      if (result.success) {
        this.config.updateMessageStatus(channelId, localMessageId, 'sent');
        return {
          success: true,
          data: { eventId: nostrEvent.id },
        };
      } else {
        // Check if any relay accepted it
        const acceptedRelays = Array.from(result.relayResults.entries())
          .filter(([_, r]) => r.success)
          .map(([url]) => url);

        if (acceptedRelays.length > 0) {
          // At least one relay accepted it
          this.config.updateMessageStatus(channelId, localMessageId, 'sent');
          return {
            success: true,
            data: { eventId: nostrEvent.id, relays: acceptedRelays },
          };
        }

        // No relays accepted it
        return {
          success: false,
          error: 'No relays accepted the message',
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private async handlePublishEvent(
    action: QueuedAction<PublishEventPayload>
  ): Promise<ActionResult> {
    const { event, relayUrls } = action.payload;

    try {
      const result = await this.config.publishEvent(event, relayUrls);

      if (result.success) {
        return {
          success: true,
          data: { eventId: event.id },
        };
      }

      // Check if any relay accepted it
      const acceptedCount = Array.from(result.relayResults.values())
        .filter((r) => r.success).length;

      if (acceptedCount > 0) {
        return {
          success: true,
          data: { eventId: event.id, acceptedCount },
        };
      }

      return {
        success: false,
        error: 'No relays accepted the event',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleSubscribeChannel(
    action: QueuedAction<SubscribeChannelPayload>
  ): Promise<ActionResult> {
    const { channelId, channelType, geohash } = action.payload;

    if (!this.config.subscribeChannel) {
      return {
        success: true,
        data: { message: 'No subscribe handler configured' },
      };
    }

    try {
      await this.config.subscribeChannel(channelId, channelType, geohash);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleUpdateProfile(
    action: QueuedAction<UpdateProfilePayload>
  ): Promise<ActionResult> {
    const { nickname, metadata } = action.payload;

    if (!this.config.updateProfile) {
      return {
        success: true,
        data: { message: 'No profile update handler configured' },
      };
    }

    try {
      const result = await this.config.updateProfile(nickname, metadata);

      if (result.success) {
        return { success: true };
      }

      return {
        success: false,
        error: 'Profile update failed',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleSyncMessages(
    action: QueuedAction<SyncMessagesPayload>
  ): Promise<ActionResult> {
    const { channelId, since, until } = action.payload;

    if (!this.config.syncMessages) {
      return {
        success: true,
        data: { message: 'No sync handler configured' },
      };
    }

    try {
      await this.config.syncMessages(channelId, since, until);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultIntegration: SyncIntegration | null = null;

/**
 * Initialize the default sync integration
 */
export function initSyncIntegration(config: SyncIntegrationConfig): SyncIntegration {
  if (defaultIntegration) {
    defaultIntegration.shutdown();
  }
  defaultIntegration = new SyncIntegration(config);
  return defaultIntegration;
}

/**
 * Get the default sync integration
 */
export function getSyncIntegration(): SyncIntegration | null {
  return defaultIntegration;
}

/**
 * Reset the default sync integration
 */
export async function resetSyncIntegration(): Promise<void> {
  if (defaultIntegration) {
    await defaultIntegration.shutdown();
    defaultIntegration = null;
  }
}
