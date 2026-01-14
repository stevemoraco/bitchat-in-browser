/**
 * Offline Action Queue
 *
 * Provides a robust offline-first action queue for the BitChat PWA:
 * - Queue actions when offline (messages, events, subscriptions)
 * - Persist queue to IndexedDB
 * - Priority ordering (user messages first)
 * - Deduplication of redundant actions
 * - Sync on reconnect with exponential backoff
 * - Conflict resolution
 * - Progress tracking and notifications
 *
 * @module services/sync/offline-queue
 */

import Dexie, { type Table } from 'dexie';
import type { NetworkStatusService} from './network-status';
import { getNetworkStatus, type NetworkStatusEvent } from './network-status';

// ============================================================================
// Types
// ============================================================================

/**
 * Action types that can be queued
 */
export enum ActionType {
  /** Send a chat message */
  SEND_MESSAGE = 'SEND_MESSAGE',
  /** Publish a Nostr event */
  PUBLISH_EVENT = 'PUBLISH_EVENT',
  /** Subscribe to a channel */
  SUBSCRIBE_CHANNEL = 'SUBSCRIBE_CHANNEL',
  /** Update user profile */
  UPDATE_PROFILE = 'UPDATE_PROFILE',
  /** Sync messages from relays */
  SYNC_MESSAGES = 'SYNC_MESSAGES',
}

/**
 * Priority levels for queued actions
 * Lower number = higher priority
 */
export enum ActionPriority {
  /** Critical - user-initiated messages */
  CRITICAL = 0,
  /** High - profile updates, channel joins */
  HIGH = 1,
  /** Normal - background sync operations */
  NORMAL = 2,
  /** Low - non-essential operations */
  LOW = 3,
}

/**
 * Action status in the queue
 */
export enum ActionStatus {
  /** Pending - not yet attempted */
  PENDING = 'pending',
  /** Processing - currently being executed */
  PROCESSING = 'processing',
  /** Completed - successfully processed */
  COMPLETED = 'completed',
  /** Failed - failed after all retries */
  FAILED = 'failed',
  /** Conflict - action conflicted with server state */
  CONFLICT = 'conflict',
}

/**
 * Base payload for all actions
 */
export interface BaseActionPayload {
  /** Unique identifier for deduplication */
  dedupeKey?: string;
}

/**
 * Payload for SEND_MESSAGE action
 */
export interface SendMessagePayload extends BaseActionPayload {
  /** Channel to send message to */
  channelId: string;
  /** Message content */
  content: string;
  /** Local message ID */
  localMessageId: string;
  /** Nostr event data (if pre-created) */
  nostrEvent?: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  };
}

/**
 * Payload for PUBLISH_EVENT action
 */
export interface PublishEventPayload extends BaseActionPayload {
  /** The Nostr event to publish */
  event: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig: string;
  };
  /** Target relay URLs */
  relayUrls?: string[];
}

/**
 * Payload for SUBSCRIBE_CHANNEL action
 */
export interface SubscribeChannelPayload extends BaseActionPayload {
  /** Channel ID to subscribe to */
  channelId: string;
  /** Channel type */
  channelType: 'location' | 'public' | 'dm';
  /** Geohash for location channels */
  geohash?: string;
}

/**
 * Payload for UPDATE_PROFILE action
 */
export interface UpdateProfilePayload extends BaseActionPayload {
  /** New nickname */
  nickname?: string;
  /** Profile metadata */
  metadata?: Record<string, string>;
}

/**
 * Payload for SYNC_MESSAGES action
 */
export interface SyncMessagesPayload extends BaseActionPayload {
  /** Channel to sync */
  channelId: string;
  /** Sync from this timestamp */
  since?: number;
  /** Sync until this timestamp */
  until?: number;
}

/**
 * Union type for all action payloads
 */
export type ActionPayload =
  | SendMessagePayload
  | PublishEventPayload
  | SubscribeChannelPayload
  | UpdateProfilePayload
  | SyncMessagesPayload;

/**
 * A queued action
 */
export interface QueuedAction<T extends ActionPayload = ActionPayload> {
  /** Unique action ID */
  id: string;
  /** Action type */
  type: ActionType;
  /** Action payload */
  payload: T;
  /** Priority level */
  priority: ActionPriority;
  /** Current status */
  status: ActionStatus;
  /** When the action was queued */
  createdAt: number;
  /** When the action was last updated */
  updatedAt: number;
  /** Number of retry attempts */
  retryCount: number;
  /** Next retry time (for exponential backoff) */
  nextRetryAt?: number;
  /** Error message if failed */
  error?: string;
  /** Result data if completed */
  result?: unknown;
}

/**
 * Sync progress event
 */
export interface SyncProgressEvent {
  /** Total actions in queue */
  total: number;
  /** Actions completed */
  completed: number;
  /** Actions failed */
  failed: number;
  /** Currently processing action */
  current?: QueuedAction;
  /** Whether sync is in progress */
  isSyncing: boolean;
  /** Timestamp of event */
  timestamp: number;
}

/**
 * Action result returned from handlers
 */
export interface ActionResult {
  /** Whether action succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Whether this is a conflict (action already processed) */
  isConflict?: boolean;
  /** Result data */
  data?: unknown;
}

/**
 * Handler function for processing actions
 */
export type ActionHandler<T extends ActionPayload = ActionPayload> = (
  action: QueuedAction<T>
) => Promise<ActionResult>;

/**
 * Options for OfflineQueue
 */
export interface OfflineQueueOptions {
  /** Database name (default: 'bitchat_offline_queue') */
  dbName?: string;
  /** Maximum queue size (default: 1000) */
  maxQueueSize?: number;
  /** Maximum retry attempts (default: 5) */
  maxRetries?: number;
  /** Base delay for exponential backoff in ms (default: 1000) */
  baseRetryDelay?: number;
  /** Maximum retry delay in ms (default: 60000) */
  maxRetryDelay?: number;
  /** Maximum age for queued actions in ms (default: 24 hours) */
  maxActionAge?: number;
  /** Network status service instance */
  networkStatus?: NetworkStatusService;
  /** Whether to auto-start on creation (default: true) */
  autoStart?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_DB_NAME = 'bitchat_offline_queue';
const DEFAULT_MAX_QUEUE_SIZE = 1000;
const DEFAULT_MAX_RETRIES = 5;
const DEFAULT_BASE_RETRY_DELAY = 1000;
const DEFAULT_MAX_RETRY_DELAY = 60000;
const DEFAULT_MAX_ACTION_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Priority mapping for action types
 */
const ACTION_TYPE_PRIORITY: Record<ActionType, ActionPriority> = {
  [ActionType.SEND_MESSAGE]: ActionPriority.CRITICAL,
  [ActionType.PUBLISH_EVENT]: ActionPriority.HIGH,
  [ActionType.UPDATE_PROFILE]: ActionPriority.HIGH,
  [ActionType.SUBSCRIBE_CHANNEL]: ActionPriority.NORMAL,
  [ActionType.SYNC_MESSAGES]: ActionPriority.LOW,
};

// ============================================================================
// Database Schema
// ============================================================================

/**
 * Dexie database for offline queue
 */
class OfflineQueueDB extends Dexie {
  actions!: Table<QueuedAction, string>;

  constructor(dbName: string) {
    super(dbName);
    this.version(1).stores({
      actions: 'id, type, status, priority, createdAt, nextRetryAt, [status+priority+createdAt]',
    });
  }
}

// ============================================================================
// Progress Listener Type
// ============================================================================

export type SyncProgressListener = (event: SyncProgressEvent) => void;

// ============================================================================
// OfflineQueue Class
// ============================================================================

/**
 * OfflineQueue manages offline actions with persistence and automatic sync.
 *
 * Features:
 * - Persists actions to IndexedDB for durability
 * - Priority-based processing (user messages first)
 * - Deduplication of redundant actions
 * - Exponential backoff on failures
 * - Conflict detection and handling
 * - Progress tracking for UI updates
 *
 * @example
 * ```typescript
 * const queue = new OfflineQueue();
 *
 * // Register action handlers
 * queue.registerHandler(ActionType.SEND_MESSAGE, async (action) => {
 *   const result = await nostrClient.publish(action.payload.nostrEvent);
 *   return { success: result.success };
 * });
 *
 * // Queue an action
 * await queue.enqueue({
 *   type: ActionType.SEND_MESSAGE,
 *   payload: {
 *     channelId: 'channel_123',
 *     content: 'Hello!',
 *     localMessageId: 'local_msg_123',
 *   },
 * });
 *
 * // Listen for sync progress
 * queue.onProgress((event) => {
 *   console.log(`Sync: ${event.completed}/${event.total}`);
 * });
 * ```
 */
export class OfflineQueue {
  private db: OfflineQueueDB;
  private handlers: Map<ActionType, ActionHandler> = new Map();
  private progressListeners: Set<SyncProgressListener> = new Set();
  private networkStatus: NetworkStatusService;
  private options: Required<OfflineQueueOptions>;
  private isProcessing = false;
  private processingPromise: Promise<void> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private isStarted = false;

  constructor(options: OfflineQueueOptions = {}) {
    this.options = {
      dbName: options.dbName ?? DEFAULT_DB_NAME,
      maxQueueSize: options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      baseRetryDelay: options.baseRetryDelay ?? DEFAULT_BASE_RETRY_DELAY,
      maxRetryDelay: options.maxRetryDelay ?? DEFAULT_MAX_RETRY_DELAY,
      maxActionAge: options.maxActionAge ?? DEFAULT_MAX_ACTION_AGE,
      networkStatus: options.networkStatus ?? getNetworkStatus(),
      autoStart: options.autoStart ?? true,
    };

    this.db = new OfflineQueueDB(this.options.dbName);
    this.networkStatus = this.options.networkStatus;

    if (this.options.autoStart) {
      this.start();
    }
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  /**
   * Start the queue processing
   */
  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    // Listen for network status changes
    this.networkUnsubscribe = this.networkStatus.onStatusChange(
      this.handleNetworkChange.bind(this)
    );

    // If already online, start processing
    if (this.networkStatus.isOnline()) {
      this.processQueue();
    }

    console.log('[OfflineQueue] Started');
  }

  /**
   * Stop the queue processing
   */
  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;

    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    console.log('[OfflineQueue] Stopped');
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    this.stop();

    // Wait for any in-progress processing to complete
    if (this.processingPromise) {
      try {
        await this.processingPromise;
      } catch {
        // Ignore errors during shutdown
      }
    }

    this.db.close();
  }

  // ============================================================================
  // Handler Registration
  // ============================================================================

  /**
   * Register a handler for an action type
   */
  registerHandler<T extends ActionPayload>(
    type: ActionType,
    handler: ActionHandler<T>
  ): void {
    this.handlers.set(type, handler as ActionHandler);
    console.log(`[OfflineQueue] Registered handler for ${type}`);
  }

  /**
   * Unregister a handler for an action type
   */
  unregisterHandler(type: ActionType): void {
    this.handlers.delete(type);
  }

  // ============================================================================
  // Queue Operations
  // ============================================================================

  /**
   * Add an action to the queue
   *
   * @param options Action options
   * @returns The queued action
   */
  async enqueue<T extends ActionPayload>(options: {
    type: ActionType;
    payload: T;
    priority?: ActionPriority;
  }): Promise<QueuedAction<T>> {
    const { type, payload, priority = ACTION_TYPE_PRIORITY[type] } = options;

    // Check for duplicates if dedupeKey is provided
    if (payload.dedupeKey) {
      const existing = await this.findByDedupeKey(payload.dedupeKey);
      if (existing) {
        console.log(`[OfflineQueue] Deduped action with key: ${payload.dedupeKey}`);
        return existing as QueuedAction<T>;
      }
    }

    const action: QueuedAction<T> = {
      id: this.generateId(),
      type,
      payload,
      priority,
      status: ActionStatus.PENDING,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
    };

    // Enforce max queue size
    await this.enforceQueueSize();

    // Add to database
    await this.db.actions.add(action as QueuedAction);

    console.log(`[OfflineQueue] Enqueued action: ${type} (${action.id})`);

    // Emit progress update
    this.emitProgress();

    // Try to process immediately if online
    if (this.networkStatus.isOnline()) {
      this.processQueue();
    }

    return action;
  }

  /**
   * Get an action by ID
   */
  async get(id: string): Promise<QueuedAction | undefined> {
    return this.db.actions.get(id);
  }

  /**
   * Get all pending actions
   */
  async getPending(): Promise<QueuedAction[]> {
    return this.db.actions
      .where('status')
      .equals(ActionStatus.PENDING)
      .sortBy('createdAt');
  }

  /**
   * Get all failed actions
   */
  async getFailed(): Promise<QueuedAction[]> {
    return this.db.actions
      .where('status')
      .equals(ActionStatus.FAILED)
      .toArray();
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    conflict: number;
  }> {
    const actions = await this.db.actions.toArray();

    return {
      total: actions.length,
      pending: actions.filter((a) => a.status === ActionStatus.PENDING).length,
      processing: actions.filter((a) => a.status === ActionStatus.PROCESSING).length,
      completed: actions.filter((a) => a.status === ActionStatus.COMPLETED).length,
      failed: actions.filter((a) => a.status === ActionStatus.FAILED).length,
      conflict: actions.filter((a) => a.status === ActionStatus.CONFLICT).length,
    };
  }

  /**
   * Remove a specific action
   */
  async remove(id: string): Promise<boolean> {
    const existing = await this.db.actions.get(id);
    if (!existing) return false;

    await this.db.actions.delete(id);
    this.emitProgress();
    return true;
  }

  /**
   * Clear all completed actions
   */
  async clearCompleted(): Promise<number> {
    const completed = await this.db.actions
      .where('status')
      .equals(ActionStatus.COMPLETED)
      .toArray();

    await this.db.actions.bulkDelete(completed.map((a) => a.id));
    this.emitProgress();
    return completed.length;
  }

  /**
   * Clear all actions
   */
  async clearAll(): Promise<void> {
    await this.db.actions.clear();
    this.emitProgress();
  }

  /**
   * Retry a failed action
   */
  async retry(id: string): Promise<boolean> {
    const action = await this.db.actions.get(id);
    if (!action || action.status !== ActionStatus.FAILED) {
      return false;
    }

    await this.db.actions.update(id, {
      status: ActionStatus.PENDING,
      retryCount: 0,
      error: undefined,
      updatedAt: Date.now(),
    });

    this.emitProgress();

    if (this.networkStatus.isOnline()) {
      this.processQueue();
    }

    return true;
  }

  /**
   * Retry all failed actions
   */
  async retryAll(): Promise<number> {
    const failed = await this.getFailed();

    for (const action of failed) {
      await this.db.actions.update(action.id, {
        status: ActionStatus.PENDING,
        retryCount: 0,
        error: undefined,
        updatedAt: Date.now(),
      });
    }

    this.emitProgress();

    if (this.networkStatus.isOnline() && failed.length > 0) {
      this.processQueue();
    }

    return failed.length;
  }

  // ============================================================================
  // Progress Listeners
  // ============================================================================

  /**
   * Add a progress listener
   * @returns Unsubscribe function
   */
  onProgress(listener: SyncProgressListener): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  // ============================================================================
  // Processing
  // ============================================================================

  /**
   * Process the queue
   */
  async processQueue(): Promise<void> {
    // Don't process if stopped
    if (!this.isStarted) {
      return;
    }

    // Prevent concurrent processing
    if (this.isProcessing) {
      return this.processingPromise ?? Promise.resolve();
    }

    if (!this.networkStatus.isOnline()) {
      console.log('[OfflineQueue] Not online, skipping queue processing');
      return;
    }

    this.isProcessing = true;
    this.processingPromise = this.doProcessQueue();

    try {
      await this.processingPromise;
    } finally {
      this.isProcessing = false;
      this.processingPromise = null;
    }
  }

  private async doProcessQueue(): Promise<void> {
    // Check if stopped before starting
    if (!this.isStarted) {
      return;
    }

    console.log('[OfflineQueue] Starting queue processing');

    // Prune expired actions first
    await this.pruneExpired();

    // Check again after prune
    if (!this.isStarted) {
      return;
    }

    // Get actions that are ready to process
    const now = Date.now();
    const actions = await this.db.actions
      .where('status')
      .equals(ActionStatus.PENDING)
      .filter((a) => !a.nextRetryAt || a.nextRetryAt <= now)
      .sortBy('priority');

    // Sort by priority then by createdAt
    actions.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.createdAt - b.createdAt;
    });

    console.log(`[OfflineQueue] ${actions.length} actions to process`);

    for (const action of actions) {
      // Check if stopped
      if (!this.isStarted) {
        break;
      }

      // Check network status before each action
      if (!this.networkStatus.isOnline()) {
        console.log('[OfflineQueue] Network went offline, pausing processing');
        break;
      }

      await this.processAction(action);
    }

    // Only emit progress if still started
    if (this.isStarted) {
      this.emitProgress();
    }
    console.log('[OfflineQueue] Queue processing complete');
  }

  private async processAction(action: QueuedAction): Promise<void> {
    const handler = this.handlers.get(action.type);
    if (!handler) {
      console.warn(`[OfflineQueue] No handler registered for ${action.type}`);
      return;
    }

    // Mark as processing
    await this.db.actions.update(action.id, {
      status: ActionStatus.PROCESSING,
      updatedAt: Date.now(),
    });

    this.emitProgress(action);

    try {
      console.log(`[OfflineQueue] Processing action: ${action.type} (${action.id})`);
      const result = await handler(action);

      if (result.success) {
        // Success - mark as completed
        await this.db.actions.update(action.id, {
          status: ActionStatus.COMPLETED,
          result: result.data,
          updatedAt: Date.now(),
        });
        console.log(`[OfflineQueue] Action completed: ${action.id}`);
      } else if (result.isConflict) {
        // Conflict - mark as conflict (don't retry)
        await this.db.actions.update(action.id, {
          status: ActionStatus.CONFLICT,
          error: result.error ?? 'Action conflicted with server state',
          updatedAt: Date.now(),
        });
        console.log(`[OfflineQueue] Action conflict: ${action.id}`);
      } else {
        // Failed - handle retry
        await this.handleFailure(action, result.error ?? 'Unknown error');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.handleFailure(action, errorMessage);
    }
  }

  private async handleFailure(action: QueuedAction, error: string): Promise<void> {
    const newRetryCount = action.retryCount + 1;

    if (newRetryCount >= this.options.maxRetries) {
      // Max retries exceeded - mark as failed
      await this.db.actions.update(action.id, {
        status: ActionStatus.FAILED,
        retryCount: newRetryCount,
        error,
        updatedAt: Date.now(),
      });
      console.warn(`[OfflineQueue] Action failed after ${newRetryCount} retries: ${action.id}`);
    } else {
      // Calculate next retry time with exponential backoff
      const delay = Math.min(
        this.options.baseRetryDelay * Math.pow(2, newRetryCount),
        this.options.maxRetryDelay
      );
      const nextRetryAt = Date.now() + delay;

      await this.db.actions.update(action.id, {
        status: ActionStatus.PENDING,
        retryCount: newRetryCount,
        nextRetryAt,
        error,
        updatedAt: Date.now(),
      });
      console.log(
        `[OfflineQueue] Action failed, will retry in ${delay}ms (attempt ${newRetryCount}/${this.options.maxRetries}): ${action.id}`
      );
    }
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private handleNetworkChange(event: NetworkStatusEvent): void {
    if (event.status === 'online') {
      console.log('[OfflineQueue] Network online, processing queue');
      this.processQueue();
    }
  }

  private async findByDedupeKey(dedupeKey: string): Promise<QueuedAction | undefined> {
    const actions = await this.db.actions
      .filter((a) => {
        const payload = a.payload as BaseActionPayload;
        return payload.dedupeKey === dedupeKey && a.status !== ActionStatus.COMPLETED;
      })
      .first();
    return actions;
  }

  private async enforceQueueSize(): Promise<void> {
    const count = await this.db.actions.count();
    if (count >= this.options.maxQueueSize) {
      // Remove oldest completed actions first
      const toRemove = count - this.options.maxQueueSize + 1;
      const oldest = await this.db.actions
        .orderBy('createdAt')
        .filter((a) => a.status === ActionStatus.COMPLETED)
        .limit(toRemove)
        .toArray();

      if (oldest.length > 0) {
        await this.db.actions.bulkDelete(oldest.map((a) => a.id));
      }

      // If still over limit, remove oldest failed actions
      const newCount = await this.db.actions.count();
      if (newCount >= this.options.maxQueueSize) {
        const oldestFailed = await this.db.actions
          .orderBy('createdAt')
          .filter((a) => a.status === ActionStatus.FAILED)
          .limit(newCount - this.options.maxQueueSize + 1)
          .toArray();

        if (oldestFailed.length > 0) {
          await this.db.actions.bulkDelete(oldestFailed.map((a) => a.id));
        }
      }
    }
  }

  private async pruneExpired(): Promise<void> {
    const cutoff = Date.now() - this.options.maxActionAge;
    const expired = await this.db.actions
      .where('createdAt')
      .below(cutoff)
      .toArray();

    if (expired.length > 0) {
      await this.db.actions.bulkDelete(expired.map((a) => a.id));
      console.log(`[OfflineQueue] Pruned ${expired.length} expired actions`);
    }
  }

  private async emitProgress(current?: QueuedAction): Promise<void> {
    // Don't emit if database is closed
    if (!this.isStarted && !this.db.isOpen()) {
      return;
    }

    try {
      const stats = await this.getStats();

      const event: SyncProgressEvent = {
        total: stats.pending + stats.processing,
        completed: stats.completed,
        failed: stats.failed,
        current,
        isSyncing: this.isProcessing,
        timestamp: Date.now(),
      };

      for (const listener of this.progressListeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('[OfflineQueue] Error in progress listener:', error);
        }
      }
    } catch {
      // Database may have been closed, ignore error
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultQueue: OfflineQueue | null = null;

/**
 * Get the default OfflineQueue instance
 */
export function getOfflineQueue(): OfflineQueue {
  if (!defaultQueue) {
    defaultQueue = new OfflineQueue();
  }
  return defaultQueue;
}

/**
 * Initialize the default offline queue with options
 */
export function initOfflineQueue(options?: OfflineQueueOptions): OfflineQueue {
  if (defaultQueue) {
    defaultQueue.stop();
  }
  defaultQueue = new OfflineQueue(options);
  return defaultQueue;
}

/**
 * Reset the default offline queue
 */
export async function resetOfflineQueue(): Promise<void> {
  if (defaultQueue) {
    await defaultQueue.close();
    defaultQueue = null;
  }
}

// ============================================================================
// Integration Helpers
// ============================================================================

/**
 * Helper to create a SEND_MESSAGE action
 */
export function createSendMessageAction(
  channelId: string,
  content: string,
  localMessageId: string,
  nostrEvent?: PublishEventPayload['event']
): { type: ActionType; payload: SendMessagePayload; priority: ActionPriority } {
  return {
    type: ActionType.SEND_MESSAGE,
    payload: {
      channelId,
      content,
      localMessageId,
      nostrEvent,
      dedupeKey: `msg_${localMessageId}`,
    },
    priority: ActionPriority.CRITICAL,
  };
}

/**
 * Helper to create a PUBLISH_EVENT action
 */
export function createPublishEventAction(
  event: PublishEventPayload['event'],
  relayUrls?: string[]
): { type: ActionType; payload: PublishEventPayload; priority: ActionPriority } {
  return {
    type: ActionType.PUBLISH_EVENT,
    payload: {
      event,
      relayUrls,
      dedupeKey: `event_${event.id}`,
    },
    priority: ActionPriority.HIGH,
  };
}

/**
 * Helper to create a SUBSCRIBE_CHANNEL action
 */
export function createSubscribeChannelAction(
  channelId: string,
  channelType: 'location' | 'public' | 'dm',
  geohash?: string
): { type: ActionType; payload: SubscribeChannelPayload; priority: ActionPriority } {
  return {
    type: ActionType.SUBSCRIBE_CHANNEL,
    payload: {
      channelId,
      channelType,
      geohash,
      dedupeKey: `sub_${channelId}`,
    },
    priority: ActionPriority.NORMAL,
  };
}

/**
 * Helper to create an UPDATE_PROFILE action
 */
export function createUpdateProfileAction(
  nickname?: string,
  metadata?: Record<string, string>
): { type: ActionType; payload: UpdateProfilePayload; priority: ActionPriority } {
  return {
    type: ActionType.UPDATE_PROFILE,
    payload: {
      nickname,
      metadata,
      dedupeKey: `profile_${Date.now()}`,
    },
    priority: ActionPriority.HIGH,
  };
}

/**
 * Helper to create a SYNC_MESSAGES action
 */
export function createSyncMessagesAction(
  channelId: string,
  since?: number,
  until?: number
): { type: ActionType; payload: SyncMessagesPayload; priority: ActionPriority } {
  return {
    type: ActionType.SYNC_MESSAGES,
    payload: {
      channelId,
      since,
      until,
      dedupeKey: `sync_${channelId}_${since ?? 0}_${until ?? 'now'}`,
    },
    priority: ActionPriority.LOW,
  };
}
