/**
 * Relay Pool Management
 * Handles connections to multiple Nostr relays with automatic reconnection
 */

import { SimplePool } from 'nostr-tools';

// SubCloser type from nostr-tools
type SubCloser = { close: () => void };

// Types from nostr-tools that may vary by version
type SubscriptionParams = {
  skipVerification?: boolean;
  onevent?: (event: any) => void;
  oneose?: () => void;
  onclose?: (reason?: string) => void;
};
import type {
  NostrEvent,
  NostrFilter,
  RelayStatus,
  RelayConnectionState,
  EventHandler,
  PublishResult,
  RelayPublishResult,
} from './types';

/**
 * Default relay list for BitChat
 * Same as native BitChat iOS/Android apps for interoperability
 */
export const DEFAULT_RELAYS: readonly string[] = [
  // Primary relays (most reliable)
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://offchain.pub',
  'wss://nostr21.com',
  // Additional reliable relays
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://relay.snort.social',
  'wss://nostr-pub.wellorder.net',
  'wss://nostr.fmt.wiz.biz',
  'wss://relay.nostr.bg',
  'wss://nostr.mom',
  'wss://nostr.oxtr.dev',
  'wss://relay.nostr.info',
  'wss://nostr-relay.nokotaro.com',
  'wss://relay.current.fyi',
  'wss://relay.nostr.wirednet.jp',
  'wss://nostr.bitcoiner.social',
  'wss://nostr.inosta.cc',
  'wss://relay.nostrich.de',
] as const;

/**
 * Backoff configuration for reconnection
 */
interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  maxAttempts: number;
}

const DEFAULT_BACKOFF: BackoffConfig = {
  initialDelayMs: 1000,
  maxDelayMs: 300000, // 5 minutes
  multiplier: 2,
  maxAttempts: 20,
};

/**
 * Internal relay state tracking
 */
interface RelayState {
  url: string;
  state: RelayConnectionState;
  lastError?: Error | string;
  lastConnectedAt?: number;
  lastDisconnectedAt?: number;
  reconnectAttempts: number;
  nextReconnectTime?: number;
  messagesSent: number;
  messagesReceived: number;
  reconnectTimeout?: ReturnType<typeof setTimeout>;
}

/**
 * RelayPool wraps nostr-tools SimplePool with enhanced features:
 * - Connection state tracking
 * - Exponential backoff reconnection
 * - Event counting and statistics
 */
export class RelayPool {
  private pool: SimplePool;
  private relayStates: Map<string, RelayState> = new Map();
  private backoffConfig: BackoffConfig;
  private connectionGeneration = 0;
  private stateChangeListeners: Set<(status: RelayStatus) => void> = new Set();
  private activeSubscriptions: Map<string, SubCloser> = new Map();

  constructor(backoffConfig: Partial<BackoffConfig> = {}) {
    this.pool = new SimplePool();
    this.backoffConfig = { ...DEFAULT_BACKOFF, ...backoffConfig };
  }

  /**
   * Connect to a list of relays
   */
  async connect(relayUrls: string[] = [...DEFAULT_RELAYS]): Promise<void> {
    const uniqueUrls = [...new Set(relayUrls)];

    for (const url of uniqueUrls) {
      if (!this.relayStates.has(url)) {
        this.relayStates.set(url, this.createInitialState(url));
      }
      await this.connectToRelay(url);
    }
  }

  /**
   * Disconnect from all relays
   */
  disconnect(): void {
    this.connectionGeneration++;

    // Clear all reconnection timeouts
    for (const state of this.relayStates.values()) {
      if (state.reconnectTimeout) {
        clearTimeout(state.reconnectTimeout);
        state.reconnectTimeout = undefined;
      }
    }

    // Close all active subscriptions
    for (const [id, sub] of this.activeSubscriptions) {
      sub.close();
      this.activeSubscriptions.delete(id);
    }

    // Close pool connections
    this.pool.close([...this.relayStates.keys()]);

    // Update all states to disconnected
    for (const [url, state] of this.relayStates) {
      state.state = 'disconnected';
      state.lastDisconnectedAt = Date.now();
      state.nextReconnectTime = undefined;
      this.notifyStateChange(url);
    }
  }

  /**
   * Disconnect from a specific relay
   */
  disconnectRelay(url: string): void {
    const state = this.relayStates.get(url);
    if (!state) return;

    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
      state.reconnectTimeout = undefined;
    }

    this.pool.close([url]);
    state.state = 'disconnected';
    state.lastDisconnectedAt = Date.now();
    state.nextReconnectTime = undefined;
    this.notifyStateChange(url);
  }

  /**
   * Subscribe to events matching filters
   */
  subscribe(
    relayUrls: string[],
    filters: NostrFilter[],
    onEvent: EventHandler,
    options: { id?: string; onEose?: () => void; onClose?: (reason?: string) => void } = {}
  ): { id: string; close: () => void } {
    const id = options.id || crypto.randomUUID();
    const connectedRelays = relayUrls.filter(url =>
      this.relayStates.get(url)?.state === 'connected'
    );

    if (connectedRelays.length === 0) {
      // No connected relays, but still set up subscription for when they connect
      console.warn('[RelayPool] No connected relays for subscription, waiting for connections...');
    }

    const subParams: SubscriptionParams = {
      onevent: (event: NostrEvent) => {
        // Find which relay sent this event
        const relayUrl = connectedRelays[0] || 'unknown';
        this.incrementMessagesReceived(relayUrl);
        onEvent(event, relayUrl);
      },
      oneose: () => {
        options.onEose?.();
      },
      onclose: (reason?: string) => {
        this.activeSubscriptions.delete(id);
        options.onClose?.(reason);
      },
    };

    const sub = this.pool.subscribeMany(
      connectedRelays.length > 0 ? connectedRelays : relayUrls,
      filters as any,
      subParams as any
    );

    this.activeSubscriptions.set(id, sub);

    return {
      id,
      close: () => {
        sub.close();
        this.activeSubscriptions.delete(id);
      },
    };
  }

  /**
   * Publish an event to relays
   */
  async publish(event: NostrEvent, relayUrls?: string[]): Promise<PublishResult> {
    const targetRelays = relayUrls || this.getConnectedRelays();
    const relayResults = new Map<string, RelayPublishResult>();

    if (targetRelays.length === 0) {
      return { event, relayResults, success: false };
    }

    const publishPromises = targetRelays.map(async (url) => {
      try {
        await this.pool.publish([url], event);
        this.incrementMessagesSent(url);
        relayResults.set(url, { success: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        relayResults.set(url, { success: false, message });
      }
    });

    await Promise.allSettled(publishPromises);

    const success = [...relayResults.values()].some(r => r.success);
    return { event, relayResults, success };
  }

  /**
   * Get status of all relays
   */
  getRelayStatuses(): RelayStatus[] {
    return [...this.relayStates.values()].map(state => ({
      url: state.url,
      state: state.state,
      isConnected: state.state === 'connected',
      lastError: state.lastError,
      lastConnectedAt: state.lastConnectedAt,
      lastDisconnectedAt: state.lastDisconnectedAt,
      reconnectAttempts: state.reconnectAttempts,
      nextReconnectTime: state.nextReconnectTime,
      messagesSent: state.messagesSent,
      messagesReceived: state.messagesReceived,
    }));
  }

  /**
   * Get status of a specific relay
   */
  getRelayStatus(url: string): RelayStatus | undefined {
    const state = this.relayStates.get(url);
    if (!state) return undefined;

    return {
      url: state.url,
      state: state.state,
      isConnected: state.state === 'connected',
      lastError: state.lastError,
      lastConnectedAt: state.lastConnectedAt,
      lastDisconnectedAt: state.lastDisconnectedAt,
      reconnectAttempts: state.reconnectAttempts,
      nextReconnectTime: state.nextReconnectTime,
      messagesSent: state.messagesSent,
      messagesReceived: state.messagesReceived,
    };
  }

  /**
   * Get list of connected relay URLs
   */
  getConnectedRelays(): string[] {
    return [...this.relayStates.entries()]
      .filter(([_, state]) => state.state === 'connected')
      .map(([url]) => url);
  }

  /**
   * Check if at least one relay is connected
   */
  isConnected(): boolean {
    return this.getConnectedRelays().length > 0;
  }

  /**
   * Add a listener for relay state changes
   */
  onStateChange(listener: (status: RelayStatus) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  /**
   * Manually retry connection to a relay
   */
  async retryConnection(url: string): Promise<void> {
    const state = this.relayStates.get(url);
    if (!state) return;

    // Reset backoff state
    state.reconnectAttempts = 0;
    state.nextReconnectTime = undefined;
    if (state.reconnectTimeout) {
      clearTimeout(state.reconnectTimeout);
      state.reconnectTimeout = undefined;
    }

    // Disconnect if connected
    if (state.state === 'connected' || state.state === 'connecting') {
      this.pool.close([url]);
    }

    // Reconnect
    await this.connectToRelay(url);
  }

  /**
   * Reset all connections
   */
  async resetConnections(): Promise<void> {
    const urls = [...this.relayStates.keys()];
    this.disconnect();

    // Reset all states
    for (const url of urls) {
      this.relayStates.set(url, this.createInitialState(url));
    }

    // Reconnect
    await this.connect(urls);
  }

  /**
   * Add relays to the pool
   */
  async addRelays(urls: string[]): Promise<void> {
    for (const url of urls) {
      if (!this.relayStates.has(url)) {
        this.relayStates.set(url, this.createInitialState(url));
        await this.connectToRelay(url);
      }
    }
  }

  /**
   * Remove relays from the pool
   */
  removeRelays(urls: string[]): void {
    for (const url of urls) {
      this.disconnectRelay(url);
      this.relayStates.delete(url);
    }
  }

  // Private methods

  private createInitialState(url: string): RelayState {
    return {
      url,
      state: 'disconnected',
      reconnectAttempts: 0,
      messagesSent: 0,
      messagesReceived: 0,
    };
  }

  private async connectToRelay(url: string): Promise<void> {
    const state = this.relayStates.get(url);
    if (!state) return;

    if (state.state === 'connected' || state.state === 'connecting') {
      return;
    }

    state.state = 'connecting';
    this.notifyStateChange(url);

    try {
      // nostr-tools SimplePool handles connection automatically on first use
      // We'll verify connection by trying to connect explicitly
      await this.pool.ensureRelay(url);

      state.state = 'connected';
      state.lastConnectedAt = Date.now();
      state.reconnectAttempts = 0;
      state.lastError = undefined;
      state.nextReconnectTime = undefined;

      console.log(`[RelayPool] Connected to relay: ${url}`);
      this.notifyStateChange(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[RelayPool] Failed to connect to relay ${url}:`, errorMessage);

      state.state = 'error';
      state.lastError = error instanceof Error ? error : new Error(errorMessage);
      state.lastDisconnectedAt = Date.now();

      this.notifyStateChange(url);
      this.scheduleReconnect(url);
    }
  }

  private scheduleReconnect(url: string): void {
    const state = this.relayStates.get(url);
    if (!state) return;

    const generation = this.connectionGeneration;

    // Check if we've exceeded max attempts
    if (state.reconnectAttempts >= this.backoffConfig.maxAttempts) {
      console.warn(`[RelayPool] Max reconnection attempts reached for ${url}`);
      return;
    }

    state.reconnectAttempts++;

    // Calculate backoff delay
    const delay = Math.min(
      this.backoffConfig.initialDelayMs *
        Math.pow(this.backoffConfig.multiplier, state.reconnectAttempts - 1),
      this.backoffConfig.maxDelayMs
    );

    state.nextReconnectTime = Date.now() + delay;
    this.notifyStateChange(url);

    console.log(`[RelayPool] Scheduling reconnect to ${url} in ${delay}ms (attempt ${state.reconnectAttempts})`);

    state.reconnectTimeout = setTimeout(() => {
      // Check if connection was reset
      if (generation !== this.connectionGeneration) return;

      // Check if relay still exists
      if (!this.relayStates.has(url)) return;

      this.connectToRelay(url);
    }, delay);
  }

  private notifyStateChange(url: string): void {
    const status = this.getRelayStatus(url);
    if (!status) return;

    for (const listener of this.stateChangeListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('[RelayPool] State change listener error:', error);
      }
    }
  }

  private incrementMessagesSent(url: string): void {
    const state = this.relayStates.get(url);
    if (state) {
      state.messagesSent++;
    }
  }

  private incrementMessagesReceived(url: string): void {
    const state = this.relayStates.get(url);
    if (state) {
      state.messagesReceived++;
    }
  }
}

/**
 * Singleton relay pool instance
 */
let defaultPool: RelayPool | null = null;

/**
 * Get the default relay pool instance
 */
export function getDefaultPool(): RelayPool {
  if (!defaultPool) {
    defaultPool = new RelayPool();
  }
  return defaultPool;
}

/**
 * Reset the default pool (useful for testing)
 */
export function resetDefaultPool(): void {
  if (defaultPool) {
    defaultPool.disconnect();
    defaultPool = null;
  }
}
