/**
 * NostrClient - Main Nostr protocol client
 * Provides a high-level interface for Nostr operations
 */

import type {
  NostrEvent,
  NostrFilter,
  RelayStatus,
  Subscription,
  SubscriptionOptions,
  PublishResult,
  EventHandler,
} from './types';
import type { RelayPool} from './relays';
import { DEFAULT_RELAYS, getDefaultPool } from './relays';
import { OutboxQueue } from './queue';

/**
 * Connection options for NostrClient
 */
export interface NostrClientOptions {
  /** Relay URLs to connect to (defaults to DEFAULT_RELAYS) */
  relays?: string[];
  /** Whether to automatically reconnect on disconnect */
  autoReconnect?: boolean;
  /** Enable offline queue for storing events when offline */
  enableQueue?: boolean;
  /** Storage key prefix for persisting queue */
  storageKeyPrefix?: string;
}

/**
 * Connection status for the client
 */
export interface ConnectionStatus {
  /** Whether at least one relay is connected */
  isConnected: boolean;
  /** Number of connected relays */
  connectedCount: number;
  /** Total number of relays */
  totalCount: number;
  /** Status of each relay */
  relays: RelayStatus[];
}

/**
 * NostrClient provides a unified interface for interacting with the Nostr network.
 *
 * Features:
 * - Connects to multiple relays via RelayPool
 * - Publishes events with automatic offline queuing
 * - Subscribes to events with filter support
 * - Tracks connection status
 *
 * @example
 * ```typescript
 * const client = new NostrClient();
 * await client.connect();
 *
 * // Subscribe to events
 * const sub = client.subscribe(
 *   [{ kinds: [1], limit: 10 }],
 *   (event) => console.log('Received:', event)
 * );
 *
 * // Publish an event
 * const result = await client.publish(signedEvent);
 *
 * // Clean up
 * sub.close();
 * client.disconnect();
 * ```
 */
export class NostrClient {
  private pool: RelayPool;
  private outboxQueue: OutboxQueue | null = null;
  private relayUrls: string[];
  private autoReconnect: boolean;
  private isInitialized = false;
  private connectionListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private onlineHandler: (() => void) | null = null;

  constructor(options: NostrClientOptions = {}) {
    this.pool = getDefaultPool();
    this.relayUrls = options.relays || [...DEFAULT_RELAYS];
    this.autoReconnect = options.autoReconnect ?? true;

    if (options.enableQueue !== false) {
      this.outboxQueue = new OutboxQueue({
        storageKey: options.storageKeyPrefix
          ? `${options.storageKeyPrefix}_outbox_queue`
          : 'nostr_outbox_queue',
        onFlush: async (event, relayUrls) => this.publishDirect(event, relayUrls),
      });
    }

    // Listen for relay state changes
    this.pool.onStateChange(() => {
      this.notifyConnectionChange();
    });
  }

  /**
   * Connect to relay pool
   * @param relayUrls Optional relay URLs to connect to (uses defaults if not specified)
   */
  async connect(relayUrls?: string[]): Promise<void> {
    if (relayUrls) {
      this.relayUrls = relayUrls;
    }

    console.log(`[NostrClient] Connecting to ${this.relayUrls.length} relays...`);

    await this.pool.connect(this.relayUrls);
    this.isInitialized = true;

    // Set up online/offline handlers
    this.setupNetworkListeners();

    // Flush any queued events
    if (this.outboxQueue && this.pool.isConnected()) {
      await this.outboxQueue.flush();
    }

    this.notifyConnectionChange();
    console.log('[NostrClient] Connection initiated');
  }

  /**
   * Disconnect from all relays
   */
  disconnect(): void {
    console.log('[NostrClient] Disconnecting...');

    this.removeNetworkListeners();
    this.pool.disconnect();
    this.isInitialized = false;

    this.notifyConnectionChange();
  }

  /**
   * Subscribe to events matching filters
   *
   * @param filters Array of filters to match events against
   * @param onEvent Callback when an event is received
   * @param options Subscription options
   * @returns Subscription handle with close() method
   */
  subscribe(
    filters: NostrFilter[],
    onEvent: EventHandler,
    options: SubscriptionOptions = {}
  ): Subscription {
    const targetRelays = options.relayUrls || this.relayUrls;

    const sub = this.pool.subscribe(
      targetRelays,
      filters,
      onEvent,
      {
        id: options.id,
        onEose: options.onEose,
        onClose: options.onClose,
      }
    );

    return {
      id: sub.id,
      filters,
      relayUrls: targetRelays,
      close: sub.close,
    };
  }

  /**
   * Publish an event to relays
   * If offline, the event is queued for later sending
   *
   * @param event Signed event to publish
   * @param relayUrls Optional specific relays to publish to
   * @returns Publish result with per-relay status
   */
  async publish(event: NostrEvent, relayUrls?: string[]): Promise<PublishResult> {
    const targetRelays = relayUrls || this.relayUrls;

    // Check if we're online and have connections
    if (!this.pool.isConnected()) {
      console.log('[NostrClient] Offline - queueing event for later');

      if (this.outboxQueue) {
        await this.outboxQueue.enqueue(event, targetRelays);
        return {
          event,
          relayResults: new Map(),
          success: false, // Not sent yet, but queued
        };
      }

      // No queue, return failure
      return {
        event,
        relayResults: new Map(),
        success: false,
      };
    }

    return this.publishDirect(event, targetRelays);
  }

  /**
   * Publish directly without queuing (internal use)
   */
  private async publishDirect(event: NostrEvent, relayUrls: string[]): Promise<PublishResult> {
    return this.pool.publish(event, relayUrls);
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    const relays = this.pool.getRelayStatuses();
    const connectedCount = relays.filter(r => r.isConnected).length;

    return {
      isConnected: connectedCount > 0,
      connectedCount,
      totalCount: relays.length,
      relays,
    };
  }

  /**
   * Check if connected to at least one relay
   */
  isConnected(): boolean {
    return this.pool.isConnected();
  }

  /**
   * Add relays to the connection pool
   */
  async addRelays(urls: string[]): Promise<void> {
    this.relayUrls = [...new Set([...this.relayUrls, ...urls])];

    if (this.isInitialized) {
      await this.pool.addRelays(urls);
    }
  }

  /**
   * Remove relays from the connection pool
   */
  removeRelays(urls: string[]): void {
    this.relayUrls = this.relayUrls.filter(url => !urls.includes(url));
    this.pool.removeRelays(urls);
  }

  /**
   * Get current relay URLs
   */
  getRelayUrls(): string[] {
    return [...this.relayUrls];
  }

  /**
   * Get connected relay URLs
   */
  getConnectedRelays(): string[] {
    return this.pool.getConnectedRelays();
  }

  /**
   * Retry connection to a specific relay
   */
  async retryRelay(url: string): Promise<void> {
    await this.pool.retryConnection(url);
  }

  /**
   * Reset all connections
   */
  async resetConnections(): Promise<void> {
    await this.pool.resetConnections();
  }

  /**
   * Add listener for connection status changes
   * @returns Unsubscribe function
   */
  onConnectionChange(listener: (status: ConnectionStatus) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  /**
   * Get pending queue size (events waiting to be sent)
   */
  getQueueSize(): number {
    return this.outboxQueue?.size() ?? 0;
  }

  /**
   * Manually flush the outbox queue
   */
  async flushQueue(): Promise<void> {
    if (this.outboxQueue && this.pool.isConnected()) {
      await this.outboxQueue.flush();
    }
  }

  /**
   * Clear the outbox queue
   */
  async clearQueue(): Promise<void> {
    await this.outboxQueue?.clear();
  }

  // Private methods

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    this.onlineHandler = () => {
      console.log('[NostrClient] Network online - attempting reconnection');
      if (this.autoReconnect && this.isInitialized) {
        this.pool.connect(this.relayUrls).then(() => {
          this.flushQueue();
        });
      }
    };

    window.addEventListener('online', this.onlineHandler);
  }

  private removeNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  private notifyConnectionChange(): void {
    const status = this.getConnectionStatus();

    for (const listener of this.connectionListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('[NostrClient] Connection change listener error:', error);
      }
    }
  }
}

/**
 * Singleton NostrClient instance
 */
let defaultClient: NostrClient | null = null;

/**
 * Get the default NostrClient instance
 */
export function getDefaultClient(): NostrClient {
  if (!defaultClient) {
    defaultClient = new NostrClient();
  }
  return defaultClient;
}

/**
 * Reset the default client (useful for testing)
 */
export function resetDefaultClient(): void {
  if (defaultClient) {
    defaultClient.disconnect();
    defaultClient = null;
  }
}
