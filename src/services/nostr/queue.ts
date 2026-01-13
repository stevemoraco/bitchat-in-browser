/**
 * OutboxQueue - Offline event queue with persistence
 * Stores events when offline and flushes when online
 */

import type { NostrEvent, PublishResult, QueuedEvent } from './types';

/**
 * Queue options
 */
export interface OutboxQueueOptions {
  /** Storage key for persisting queue */
  storageKey?: string;
  /** Maximum number of events to keep in queue */
  maxQueueSize?: number;
  /** Maximum age of queued events in milliseconds (default: 24 hours) */
  maxEventAge?: number;
  /** Maximum retry attempts per event */
  maxRetries?: number;
  /** Callback to actually send the event */
  onFlush?: (event: NostrEvent, relayUrls: string[]) => Promise<PublishResult>;
}

const DEFAULT_STORAGE_KEY = 'nostr_outbox_queue';
const DEFAULT_MAX_QUEUE_SIZE = 100;
const DEFAULT_MAX_EVENT_AGE = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_MAX_RETRIES = 5;

/**
 * OutboxQueue manages offline event storage and delivery.
 *
 * Features:
 * - Persists queue to localStorage/IndexedDB
 * - Automatic retry with exponential backoff
 * - Queue size and age limits
 * - Flush when online
 *
 * @example
 * ```typescript
 * const queue = new OutboxQueue({
 *   onFlush: async (event, relays) => {
 *     return await client.publish(event, relays);
 *   }
 * });
 *
 * // Queue an event when offline
 * await queue.enqueue(signedEvent, ['wss://relay.example.com']);
 *
 * // Flush when back online
 * await queue.flush();
 * ```
 */
export class OutboxQueue {
  private queue: QueuedEvent[] = [];
  private storageKey: string;
  private maxQueueSize: number;
  private maxEventAge: number;
  private maxRetries: number;
  private onFlush?: (event: NostrEvent, relayUrls: string[]) => Promise<PublishResult>;
  private isFlushing = false;
  private flushPromise: Promise<void> | null = null;

  constructor(options: OutboxQueueOptions = {}) {
    this.storageKey = options.storageKey || DEFAULT_STORAGE_KEY;
    this.maxQueueSize = options.maxQueueSize || DEFAULT_MAX_QUEUE_SIZE;
    this.maxEventAge = options.maxEventAge || DEFAULT_MAX_EVENT_AGE;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.onFlush = options.onFlush;

    this.loadFromStorage();
  }

  /**
   * Add an event to the queue
   */
  async enqueue(event: NostrEvent, relayUrls: string[]): Promise<void> {
    // Check for duplicate
    const existing = this.queue.find(q => q.event.id === event.id);
    if (existing) {
      // Update relay URLs if different
      const newUrls = relayUrls.filter(url => !existing.relayUrls.includes(url));
      if (newUrls.length > 0) {
        existing.relayUrls = [...existing.relayUrls, ...newUrls];
        await this.saveToStorage();
      }
      return;
    }

    // Add to queue
    const queuedEvent: QueuedEvent = {
      event,
      relayUrls,
      queuedAt: Date.now(),
      attempts: 0,
    };

    this.queue.push(queuedEvent);

    // Enforce max queue size (remove oldest events first)
    while (this.queue.length > this.maxQueueSize) {
      this.queue.shift();
    }

    await this.saveToStorage();
    console.log(`[OutboxQueue] Enqueued event ${event.id} (queue size: ${this.queue.length})`);
  }

  /**
   * Flush all queued events
   * @returns Promise that resolves when flush is complete
   */
  async flush(): Promise<void> {
    // If already flushing, wait for that to complete
    if (this.isFlushing && this.flushPromise) {
      return this.flushPromise;
    }

    if (!this.onFlush) {
      console.warn('[OutboxQueue] No flush handler configured');
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.isFlushing = true;
    this.flushPromise = this.doFlush();

    try {
      await this.flushPromise;
    } finally {
      this.isFlushing = false;
      this.flushPromise = null;
    }
  }

  private async doFlush(): Promise<void> {
    console.log(`[OutboxQueue] Flushing ${this.queue.length} queued events...`);

    // Clean up expired events first
    this.pruneExpired();

    const toRemove: string[] = [];
    const toRetry: QueuedEvent[] = [];

    for (const item of this.queue) {
      item.attempts++;
      item.lastAttemptAt = Date.now();

      try {
        const result = await this.onFlush!(item.event, item.relayUrls);

        if (result.success) {
          // Successfully sent - remove from queue
          toRemove.push(item.event.id);
          console.log(`[OutboxQueue] Successfully sent event ${item.event.id}`);
        } else if (item.attempts >= this.maxRetries) {
          // Max retries exceeded - remove from queue
          toRemove.push(item.event.id);
          console.warn(`[OutboxQueue] Max retries exceeded for event ${item.event.id}, dropping`);
        } else {
          // Failed but can retry
          toRetry.push(item);
          console.log(`[OutboxQueue] Event ${item.event.id} failed, will retry (attempt ${item.attempts}/${this.maxRetries})`);
        }
      } catch (error) {
        if (item.attempts >= this.maxRetries) {
          toRemove.push(item.event.id);
          console.error(`[OutboxQueue] Error sending event ${item.event.id}, max retries exceeded:`, error);
        } else {
          toRetry.push(item);
          console.error(`[OutboxQueue] Error sending event ${item.event.id}:`, error);
        }
      }
    }

    // Update queue
    this.queue = this.queue.filter(item => !toRemove.includes(item.event.id));
    await this.saveToStorage();

    console.log(`[OutboxQueue] Flush complete. Remaining: ${this.queue.length} events`);
  }

  /**
   * Remove expired events from queue
   */
  private pruneExpired(): void {
    const now = Date.now();
    const beforeCount = this.queue.length;

    this.queue = this.queue.filter(item => {
      const age = now - item.queuedAt;
      return age < this.maxEventAge;
    });

    const removedCount = beforeCount - this.queue.length;
    if (removedCount > 0) {
      console.log(`[OutboxQueue] Pruned ${removedCount} expired events`);
    }
  }

  /**
   * Get current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get all queued events
   */
  getAll(): QueuedEvent[] {
    return [...this.queue];
  }

  /**
   * Clear the entire queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.saveToStorage();
    console.log('[OutboxQueue] Queue cleared');
  }

  /**
   * Remove a specific event from queue
   */
  async remove(eventId: string): Promise<boolean> {
    const beforeLength = this.queue.length;
    this.queue = this.queue.filter(item => item.event.id !== eventId);

    if (this.queue.length < beforeLength) {
      await this.saveToStorage();
      return true;
    }

    return false;
  }

  /**
   * Check if an event is in the queue
   */
  has(eventId: string): boolean {
    return this.queue.some(item => item.event.id === eventId);
  }

  /**
   * Load queue from storage
   */
  private loadFromStorage(): void {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        this.queue = parsed;
        this.pruneExpired();
        console.log(`[OutboxQueue] Loaded ${this.queue.length} events from storage`);
      }
    } catch (error) {
      console.error('[OutboxQueue] Failed to load from storage:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to storage
   */
  private async saveToStorage(): Promise<void> {
    try {
      if (typeof localStorage === 'undefined') {
        return;
      }

      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[OutboxQueue] Failed to save to storage:', error);

      // If storage is full, try to make room by removing oldest events
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        const halfSize = Math.floor(this.queue.length / 2);
        this.queue = this.queue.slice(-halfSize);

        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
          console.log(`[OutboxQueue] Reduced queue size to ${this.queue.length} due to storage quota`);
        } catch {
          // Give up on localStorage, queue will be in-memory only
          console.error('[OutboxQueue] Unable to save to storage, running in-memory only');
        }
      }
    }
  }

  /**
   * Update the flush handler
   */
  setFlushHandler(handler: (event: NostrEvent, relayUrls: string[]) => Promise<PublishResult>): void {
    this.onFlush = handler;
  }
}
