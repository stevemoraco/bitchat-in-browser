/**
 * Relay Manager - Advanced Nostr Relay Pool Management
 *
 * This module provides comprehensive relay pool management for BitChat In Browser,
 * compatible with native BitChat iOS and Android apps.
 *
 * Features:
 * - Connection to 290+ relays (same as native apps)
 * - Connection health monitoring
 * - Automatic reconnection with exponential backoff
 * - Load balancing across relays
 * - Geographic proximity-based relay selection
 * - Latency-based relay ranking
 * - Reliability scoring
 * - Message routing with deduplication
 * - Relay status persistence
 * - User-configurable relay lists (whitelist/blacklist)
 */

import { SimplePool } from 'nostr-tools';
import type {
  NostrEvent,
  NostrFilter,
  RelayStatus,
  RelayConnectionState,
  EventHandler,
  PublishResult,
  RelayPublishResult,
} from './types';
import {
  ALL_RELAYS,
  PRIMARY_RELAYS,
  PRIMARY_RELAY_URLS,
  getRelaysByProximity,
  calculateDistance,
  type RelayInfo,
} from './relay-list';

// Type aliases for nostr-tools internals
type Sub = ReturnType<SimplePool['subscribeMany']>;
interface SubscriptionParams {
  onevent?: (event: NostrEvent) => void;
  oneose?: () => void;
  onclose?: (reason?: string) => void;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Backoff configuration for reconnection
 */
export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  maxAttempts: number;
  jitterMs: number;
}

/**
 * Relay statistics for reliability scoring
 */
export interface RelayStats {
  /** Total successful message deliveries */
  successCount: number;
  /** Total failed message deliveries */
  failureCount: number;
  /** Total messages received */
  messagesReceived: number;
  /** Total messages sent */
  messagesSent: number;
  /** Average latency in milliseconds */
  avgLatencyMs: number;
  /** Number of latency samples */
  latencySamples: number;
  /** Total connection attempts */
  connectionAttempts: number;
  /** Successful connections */
  successfulConnections: number;
  /** Last successful connection timestamp */
  lastSuccessfulConnection?: number;
  /** Last error message */
  lastError?: string;
  /** Reliability score (0-100) */
  reliabilityScore: number;
}

/**
 * Extended relay state with statistics
 */
export interface ExtendedRelayState {
  url: string;
  state: RelayConnectionState;
  lastError?: Error | string;
  lastConnectedAt?: number;
  lastDisconnectedAt?: number;
  reconnectAttempts: number;
  nextReconnectTime?: number;
  reconnectTimeout?: ReturnType<typeof setTimeout>;
  stats: RelayStats;
  latencyMs?: number;
  geolocation?: {
    latitude: number;
    longitude: number;
    distanceKm?: number;
  };
  isPrimary: boolean;
  isBlacklisted: boolean;
  isWhitelisted: boolean;
}

/**
 * Relay configuration options
 */
export interface RelayManagerConfig {
  /** Maximum number of concurrent connections */
  maxConnections: number;
  /** Minimum number of connections to maintain */
  minConnections: number;
  /** Number of primary relays to always connect */
  primaryRelayCount: number;
  /** Whether to use geographic proximity for relay selection */
  useGeographicProximity: boolean;
  /** User's latitude (for proximity calculation) */
  userLatitude?: number;
  /** User's longitude (for proximity calculation) */
  userLongitude?: number;
  /** Backoff configuration */
  backoff: BackoffConfig;
  /** Minimum reliability score to consider a relay (0-100) */
  minReliabilityScore: number;
  /** Storage key for persisting relay stats */
  storageKey: string;
  /** Interval for health checks in milliseconds */
  healthCheckIntervalMs: number;
  /** Timeout for publish operations in milliseconds */
  publishTimeoutMs: number;
  /** Number of relays to publish to for redundancy */
  publishRedundancy: number;
}

/**
 * Message routing result
 */
export interface MessageRoutingResult {
  eventId: string;
  relaysAttempted: string[];
  relaysSucceeded: string[];
  relaysFailed: Map<string, string>;
  timestamp: number;
}

/**
 * Relay manager events
 */
export type RelayManagerEvent =
  | { type: 'relay_connected'; url: string }
  | { type: 'relay_disconnected'; url: string; reason?: string }
  | { type: 'relay_error'; url: string; error: Error | string }
  | { type: 'connection_status_changed'; connected: number; total: number }
  | { type: 'message_received'; eventId: string; relayUrl: string }
  | { type: 'message_published'; eventId: string; relayUrl: string }
  | { type: 'stats_updated'; url: string; stats: RelayStats };

export type RelayManagerEventHandler = (event: RelayManagerEvent) => void;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: RelayManagerConfig = {
  maxConnections: 50,
  minConnections: 5,
  primaryRelayCount: 8,
  useGeographicProximity: true,
  backoff: {
    initialDelayMs: 1000,
    maxDelayMs: 300000, // 5 minutes
    multiplier: 2,
    maxAttempts: 20,
    jitterMs: 500,
  },
  minReliabilityScore: 30,
  storageKey: 'bitchat_relay_stats',
  healthCheckIntervalMs: 60000, // 1 minute
  publishTimeoutMs: 10000,
  publishRedundancy: 5,
};

// ============================================================================
// RelayManager Class
// ============================================================================

/**
 * RelayManager provides comprehensive relay pool management for BitChat.
 *
 * Features:
 * - Manages connections to 290+ Nostr relays
 * - Automatic reconnection with exponential backoff
 * - Geographic proximity-based relay selection
 * - Latency-based relay ranking
 * - Reliability scoring and tracking
 * - Message deduplication
 * - Persistent statistics
 * - Whitelist/blacklist support
 */
export class RelayManager {
  private pool: SimplePool;
  private relayStates: Map<string, ExtendedRelayState> = new Map();
  private config: RelayManagerConfig;
  private connectionGeneration = 0;
  private eventListeners: Set<RelayManagerEventHandler> = new Set();
  private stateChangeListeners: Set<(status: RelayStatus) => void> = new Set();
  private activeSubscriptions: Map<string, Sub> = new Map();
  private seenEvents: Map<string, Set<string>> = new Map(); // eventId -> Set of relay URLs
  private messageRoutingHistory: Map<string, MessageRoutingResult> = new Map();
  private healthCheckInterval?: ReturnType<typeof setInterval>;
  private whitelist: Set<string> = new Set();
  private blacklist: Set<string> = new Set();
  private isInitialized = false;

  constructor(config: Partial<RelayManagerConfig> = {}) {
    this.pool = new SimplePool();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadPersistedState();
  }

  // ==========================================================================
  // Initialization and Connection Management
  // ==========================================================================

  /**
   * Initialize the relay manager and connect to relays
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[RelayManager] Already initialized');
      return;
    }

    console.log('[RelayManager] Initializing...');

    // Initialize relay states from the relay list
    this.initializeRelayStates();

    // Start health check interval
    this.startHealthCheck();

    this.isInitialized = true;
    console.log(`[RelayManager] Initialized with ${this.relayStates.size} relay configurations`);
  }

  /**
   * Connect to relays using smart selection
   */
  async connect(options: {
    maxConnections?: number;
    prioritizeProximity?: boolean;
    customRelays?: string[];
  } = {}): Promise<void> {
    const maxConnections = options.maxConnections || this.config.maxConnections;

    // Select relays to connect to
    const relaysToConnect = this.selectRelaysForConnection(maxConnections, options);

    console.log(`[RelayManager] Connecting to ${relaysToConnect.length} relays...`);

    // Connect to selected relays
    const connectionPromises = relaysToConnect.map(url => this.connectToRelay(url));
    await Promise.allSettled(connectionPromises);

    this.emitConnectionStatusChanged();
    console.log(`[RelayManager] Connection attempt complete. Connected: ${this.getConnectedRelays().length}`);
  }

  /**
   * Disconnect from all relays
   */
  disconnect(): void {
    this.connectionGeneration++;

    // Stop health check
    this.stopHealthCheck();

    // Clear all reconnection timeouts
    for (const state of this.relayStates.values()) {
      if (state.reconnectTimeout) {
        clearTimeout(state.reconnectTimeout);
        state.reconnectTimeout = undefined;
      }
    }

    // Close all active subscriptions
    for (const [id, sub] of this.activeSubscriptions) {
      try {
        sub.close();
      } catch (e) {
        console.error(`[RelayManager] Error closing subscription ${id}:`, e);
      }
    }
    this.activeSubscriptions.clear();

    // Close pool connections
    this.pool.close([...this.relayStates.keys()]);

    // Update all states to disconnected
    for (const [url, state] of this.relayStates) {
      if (state.state !== 'disconnected') {
        state.state = 'disconnected';
        state.lastDisconnectedAt = Date.now();
        state.nextReconnectTime = undefined;
        this.notifyStateChange(url);
        this.emitEvent({ type: 'relay_disconnected', url });
      }
    }

    this.emitConnectionStatusChanged();
    console.log('[RelayManager] Disconnected from all relays');
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
    this.emitEvent({ type: 'relay_disconnected', url });
    this.emitConnectionStatusChanged();
  }

  // ==========================================================================
  // Subscription Management
  // ==========================================================================

  /**
   * Subscribe to events matching filters with deduplication
   */
  subscribe(
    relayUrls: string[],
    filters: NostrFilter[],
    onEvent: EventHandler,
    options: {
      id?: string;
      onEose?: () => void;
      onClose?: (reason?: string) => void;
      deduplicate?: boolean;
    } = {}
  ): { id: string; close: () => void } {
    const id = options.id || crypto.randomUUID();
    const deduplicate = options.deduplicate !== false;
    const connectedRelays = relayUrls.filter(url => {
      const state = this.relayStates.get(url);
      return state?.state === 'connected';
    });

    if (connectedRelays.length === 0) {
      console.warn('[RelayManager] No connected relays for subscription, using all specified relays...');
    }

    // Track which events we've seen for this subscription
    const seenInSub = new Set<string>();

    const subParams: SubscriptionParams = {
      onevent: (event: NostrEvent) => {
        // Deduplicate events
        if (deduplicate) {
          if (seenInSub.has(event.id)) {
            return;
          }
          seenInSub.add(event.id);
        }

        // Track which relay sent this event
        const relayUrl = this.findRelayForEvent(event, connectedRelays);
        this.trackReceivedEvent(event.id, relayUrl);
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

    // Note: nostr-tools types expect single Filter but runtime accepts array
    const sub = this.pool.subscribeMany(
      connectedRelays.length > 0 ? connectedRelays : relayUrls,
      filters as unknown as Parameters<SimplePool['subscribeMany']>[1],
      subParams as Parameters<SimplePool['subscribeMany']>[2]
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

  // ==========================================================================
  // Publishing
  // ==========================================================================

  /**
   * Publish an event to multiple relays with redundancy
   */
  async publish(event: NostrEvent, relayUrls?: string[]): Promise<PublishResult> {
    const startTime = Date.now();
    const targetRelays = relayUrls || this.selectRelaysForPublishing();
    const relayResults = new Map<string, RelayPublishResult>();

    if (targetRelays.length === 0) {
      console.warn('[RelayManager] No relays available for publishing');
      return { event, relayResults, success: false };
    }

    console.log(`[RelayManager] Publishing event ${event.id} to ${targetRelays.length} relays`);

    // Track this publish attempt
    const routingResult: MessageRoutingResult = {
      eventId: event.id,
      relaysAttempted: [...targetRelays],
      relaysSucceeded: [],
      relaysFailed: new Map(),
      timestamp: startTime,
    };

    // Publish to all target relays in parallel with timeout
    const publishPromises = targetRelays.map(async (url) => {
      const relayStartTime = Date.now();
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Publish timeout')), this.config.publishTimeoutMs);
        });

        const publishPromise = this.pool.publish([url], event);
        await Promise.race([publishPromise, timeoutPromise]);

        const latency = Date.now() - relayStartTime;
        this.updateRelayLatency(url, latency);
        this.incrementMessagesSent(url);
        this.incrementSuccessCount(url);
        relayResults.set(url, { success: true });
        routingResult.relaysSucceeded.push(url);

        this.emitEvent({ type: 'message_published', eventId: event.id, relayUrl: url });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.incrementFailureCount(url);
        this.updateRelayError(url, message);
        relayResults.set(url, { success: false, message });
        routingResult.relaysFailed.set(url, message);
      }
    });

    await Promise.allSettled(publishPromises);

    // Store routing result
    this.messageRoutingHistory.set(event.id, routingResult);

    // Limit routing history size
    if (this.messageRoutingHistory.size > 1000) {
      const oldestKey = this.messageRoutingHistory.keys().next().value;
      if (oldestKey) {
        this.messageRoutingHistory.delete(oldestKey);
      }
    }

    const success = routingResult.relaysSucceeded.length > 0;
    const totalTime = Date.now() - startTime;

    console.log(`[RelayManager] Published to ${routingResult.relaysSucceeded.length}/${targetRelays.length} relays in ${totalTime}ms`);

    return { event, relayResults, success };
  }

  // ==========================================================================
  // Relay Selection
  // ==========================================================================

  /**
   * Select relays for publishing based on reliability and latency
   */
  selectRelaysForPublishing(): string[] {
    const connectedRelays = this.getConnectedRelays();

    if (connectedRelays.length === 0) {
      return [];
    }

    // Sort by reliability score and latency
    const sortedRelays = connectedRelays
      .map(url => ({
        url,
        state: this.relayStates.get(url)!,
      }))
      .filter(r => !r.state.isBlacklisted)
      .sort((a, b) => {
        // Primary relays first
        if (a.state.isPrimary && !b.state.isPrimary) return -1;
        if (!a.state.isPrimary && b.state.isPrimary) return 1;

        // Then by reliability score
        const scoreA = a.state.stats.reliabilityScore;
        const scoreB = b.state.stats.reliabilityScore;
        if (scoreA !== scoreB) return scoreB - scoreA;

        // Then by latency
        const latencyA = a.state.latencyMs ?? 10000;
        const latencyB = b.state.latencyMs ?? 10000;
        return latencyA - latencyB;
      });

    // Return top N relays for redundancy
    return sortedRelays.slice(0, this.config.publishRedundancy).map(r => r.url);
  }

  /**
   * Select relays for connection based on various criteria
   */
  private selectRelaysForConnection(
    maxConnections: number,
    options: {
      prioritizeProximity?: boolean;
      customRelays?: string[];
    } = {}
  ): string[] {
    const selected: string[] = [];
    const selectedSet = new Set<string>();

    // If custom relays provided, use those
    if (options.customRelays && options.customRelays.length > 0) {
      return options.customRelays.filter(url => !this.blacklist.has(url)).slice(0, maxConnections);
    }

    // Always include whitelisted relays first
    for (const url of this.whitelist) {
      if (selected.length >= maxConnections) break;
      if (!this.blacklist.has(url) && !selectedSet.has(url)) {
        selected.push(url);
        selectedSet.add(url);
      }
    }

    // Include primary relays
    for (const relay of PRIMARY_RELAYS) {
      if (selected.length >= maxConnections) break;
      if (!this.blacklist.has(relay.url) && !selectedSet.has(relay.url)) {
        selected.push(relay.url);
        selectedSet.add(relay.url);
      }
    }

    // Get remaining relays sorted by criteria
    const remainingCount = maxConnections - selected.length;
    if (remainingCount > 0) {
      let candidates: RelayInfo[];

      if (options.prioritizeProximity && this.config.userLatitude && this.config.userLongitude) {
        // Sort by proximity
        candidates = getRelaysByProximity(
          this.config.userLatitude,
          this.config.userLongitude
        ).filter(r => !selectedSet.has(r.url) && !this.blacklist.has(r.url));
      } else {
        // Sort by reliability score
        candidates = [...ALL_RELAYS]
          .filter(r => !selectedSet.has(r.url) && !this.blacklist.has(r.url))
          .sort((a, b) => {
            const stateA = this.relayStates.get(a.url);
            const stateB = this.relayStates.get(b.url);
            const scoreA = stateA?.stats.reliabilityScore ?? 50;
            const scoreB = stateB?.stats.reliabilityScore ?? 50;
            return scoreB - scoreA;
          });
      }

      for (const relay of candidates) {
        if (selected.length >= maxConnections) break;
        selected.push(relay.url);
      }
    }

    return selected;
  }

  // ==========================================================================
  // Status and Statistics
  // ==========================================================================

  /**
   * Get all relay statuses
   */
  getRelayStatuses(): RelayStatus[] {
    return [...this.relayStates.values()].map(state => this.stateToStatus(state));
  }

  /**
   * Get status of a specific relay
   */
  getRelayStatus(url: string): RelayStatus | undefined {
    const state = this.relayStates.get(url);
    if (!state) return undefined;
    return this.stateToStatus(state);
  }

  /**
   * Get extended statistics for all relays
   */
  getRelayStats(): Map<string, RelayStats> {
    const stats = new Map<string, RelayStats>();
    for (const [url, state] of this.relayStates) {
      stats.set(url, { ...state.stats });
    }
    return stats;
  }

  /**
   * Get connected relay URLs
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
   * Get connection summary
   */
  getConnectionSummary(): {
    connected: number;
    connecting: number;
    disconnected: number;
    error: number;
    total: number;
  } {
    let connected = 0;
    let connecting = 0;
    let disconnected = 0;
    let error = 0;

    for (const state of this.relayStates.values()) {
      switch (state.state) {
        case 'connected':
          connected++;
          break;
        case 'connecting':
          connecting++;
          break;
        case 'disconnected':
          disconnected++;
          break;
        case 'error':
          error++;
          break;
      }
    }

    return {
      connected,
      connecting,
      disconnected,
      error,
      total: this.relayStates.size,
    };
  }

  /**
   * Get message routing history for an event
   */
  getMessageRoutingResult(eventId: string): MessageRoutingResult | undefined {
    return this.messageRoutingHistory.get(eventId);
  }

  /**
   * Get which relays have a specific event
   */
  getEventRelays(eventId: string): string[] {
    return [...(this.seenEvents.get(eventId) ?? [])];
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Add relays to whitelist
   */
  addToWhitelist(urls: string[]): void {
    for (const url of urls) {
      this.whitelist.add(url);
      const state = this.relayStates.get(url);
      if (state) {
        state.isWhitelisted = true;
      }
    }
    this.persistState();
  }

  /**
   * Remove relays from whitelist
   */
  removeFromWhitelist(urls: string[]): void {
    for (const url of urls) {
      this.whitelist.delete(url);
      const state = this.relayStates.get(url);
      if (state) {
        state.isWhitelisted = false;
      }
    }
    this.persistState();
  }

  /**
   * Add relays to blacklist
   */
  addToBlacklist(urls: string[]): void {
    for (const url of urls) {
      this.blacklist.add(url);
      const state = this.relayStates.get(url);
      if (state) {
        state.isBlacklisted = true;
        // Disconnect if connected
        if (state.state === 'connected' || state.state === 'connecting') {
          this.disconnectRelay(url);
        }
      }
    }
    this.persistState();
  }

  /**
   * Remove relays from blacklist
   */
  removeFromBlacklist(urls: string[]): void {
    for (const url of urls) {
      this.blacklist.delete(url);
      const state = this.relayStates.get(url);
      if (state) {
        state.isBlacklisted = false;
      }
    }
    this.persistState();
  }

  /**
   * Get whitelist
   */
  getWhitelist(): string[] {
    return [...this.whitelist];
  }

  /**
   * Get blacklist
   */
  getBlacklist(): string[] {
    return [...this.blacklist];
  }

  /**
   * Set user location for proximity-based relay selection
   */
  setUserLocation(latitude: number, longitude: number): void {
    this.config.userLatitude = latitude;
    this.config.userLongitude = longitude;

    // Update distance for all relays
    for (const [_url, state] of this.relayStates) {
      if (state.geolocation) {
        state.geolocation.distanceKm = calculateDistance(
          latitude,
          longitude,
          state.geolocation.latitude,
          state.geolocation.longitude
        );
      }
    }

    this.persistState();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RelayManagerConfig>): void {
    this.config = { ...this.config, ...config };
    this.persistState();
  }

  // ==========================================================================
  // Event Listeners
  // ==========================================================================

  /**
   * Add event listener
   */
  addEventListener(handler: RelayManagerEventHandler): () => void {
    this.eventListeners.add(handler);
    return () => this.eventListeners.delete(handler);
  }

  /**
   * Add state change listener (for backward compatibility)
   */
  onStateChange(listener: (status: RelayStatus) => void): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  // ==========================================================================
  // Manual Controls
  // ==========================================================================

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
      const state = this.relayStates.get(url);
      if (state) {
        state.state = 'disconnected';
        state.reconnectAttempts = 0;
        state.nextReconnectTime = undefined;
      }
    }

    // Reconnect
    await this.connect();
  }

  /**
   * Add new relays dynamically
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
   * Remove relays
   */
  removeRelays(urls: string[]): void {
    for (const url of urls) {
      this.disconnectRelay(url);
      this.relayStates.delete(url);
    }
  }

  /**
   * Perform latency measurement for a relay
   */
  async measureLatency(url: string): Promise<number | null> {
    const state = this.relayStates.get(url);
    if (!state || state.state !== 'connected') {
      return null;
    }

    const startTime = Date.now();
    try {
      // Create a simple filter that should return quickly
      const filter: NostrFilter = { kinds: [0], limit: 1 };

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);

        // Note: nostr-tools types expect single Filter but runtime accepts array
        const sub = this.pool.subscribeMany(
          [url],
          [filter] as unknown as Parameters<SimplePool['subscribeMany']>[1],
          {
            onevent: () => {
              // Got an event
            },
            oneose: () => {
              clearTimeout(timeout);
              sub.close();
              resolve();
            },
            onclose: () => {
              clearTimeout(timeout);
              resolve();
            },
          } as Parameters<SimplePool['subscribeMany']>[2]
        );
      });

      const latency = Date.now() - startTime;
      this.updateRelayLatency(url, latency);
      return latency;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Private Methods - Connection
  // ==========================================================================

  private initializeRelayStates(): void {
    // Create states for all known relays
    for (const relay of ALL_RELAYS) {
      if (!this.relayStates.has(relay.url)) {
        this.relayStates.set(relay.url, this.createInitialState(relay.url, relay));
      }
    }
  }

  private createInitialState(url: string, relayInfo?: RelayInfo): ExtendedRelayState {
    const isPrimary = PRIMARY_RELAY_URLS.includes(url);

    return {
      url,
      state: 'disconnected',
      reconnectAttempts: 0,
      stats: {
        successCount: 0,
        failureCount: 0,
        messagesReceived: 0,
        messagesSent: 0,
        avgLatencyMs: 0,
        latencySamples: 0,
        connectionAttempts: 0,
        successfulConnections: 0,
        reliabilityScore: 50, // Start with neutral score
      },
      geolocation: relayInfo
        ? {
            latitude: relayInfo.latitude,
            longitude: relayInfo.longitude,
            distanceKm: this.config.userLatitude && this.config.userLongitude
              ? calculateDistance(
                  this.config.userLatitude,
                  this.config.userLongitude,
                  relayInfo.latitude,
                  relayInfo.longitude
                )
              : undefined,
          }
        : undefined,
      isPrimary,
      isBlacklisted: this.blacklist.has(url),
      isWhitelisted: this.whitelist.has(url),
    };
  }

  private async connectToRelay(url: string): Promise<void> {
    const state = this.relayStates.get(url);
    if (!state) return;

    if (state.isBlacklisted) {
      console.log(`[RelayManager] Skipping blacklisted relay: ${url}`);
      return;
    }

    if (state.state === 'connected' || state.state === 'connecting') {
      return;
    }

    state.state = 'connecting';
    state.stats.connectionAttempts++;
    this.notifyStateChange(url);

    const startTime = Date.now();

    try {
      await this.pool.ensureRelay(url);

      const latency = Date.now() - startTime;
      state.state = 'connected';
      state.lastConnectedAt = Date.now();
      state.reconnectAttempts = 0;
      state.lastError = undefined;
      state.nextReconnectTime = undefined;
      state.latencyMs = latency;
      state.stats.successfulConnections++;
      state.stats.lastSuccessfulConnection = Date.now();

      this.updateRelayLatency(url, latency);
      this.updateReliabilityScore(url);

      console.log(`[RelayManager] Connected to relay: ${url} (${latency}ms)`);
      this.notifyStateChange(url);
      this.emitEvent({ type: 'relay_connected', url });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[RelayManager] Failed to connect to relay ${url}:`, errorMessage);

      state.state = 'error';
      state.lastError = error instanceof Error ? error : new Error(errorMessage);
      state.lastDisconnectedAt = Date.now();
      state.stats.lastError = errorMessage;

      this.updateReliabilityScore(url);
      this.notifyStateChange(url);
      this.emitEvent({ type: 'relay_error', url, error: state.lastError });
      this.scheduleReconnect(url);
    }
  }

  private scheduleReconnect(url: string): void {
    const state = this.relayStates.get(url);
    if (!state) return;

    const generation = this.connectionGeneration;

    // Check if we've exceeded max attempts
    if (state.reconnectAttempts >= this.config.backoff.maxAttempts) {
      console.warn(`[RelayManager] Max reconnection attempts reached for ${url}`);
      return;
    }

    state.reconnectAttempts++;

    // Calculate backoff delay with jitter
    const baseDelay = Math.min(
      this.config.backoff.initialDelayMs *
        Math.pow(this.config.backoff.multiplier, state.reconnectAttempts - 1),
      this.config.backoff.maxDelayMs
    );
    const jitter = Math.random() * this.config.backoff.jitterMs;
    const delay = baseDelay + jitter;

    state.nextReconnectTime = Date.now() + delay;
    this.notifyStateChange(url);

    console.log(`[RelayManager] Scheduling reconnect to ${url} in ${Math.round(delay)}ms (attempt ${state.reconnectAttempts})`);

    state.reconnectTimeout = setTimeout(() => {
      // Check if connection was reset
      if (generation !== this.connectionGeneration) return;

      // Check if relay still exists and isn't blacklisted
      const currentState = this.relayStates.get(url);
      if (!currentState || currentState.isBlacklisted) return;

      this.connectToRelay(url);
    }, delay);
  }

  // ==========================================================================
  // Private Methods - Statistics
  // ==========================================================================

  private updateRelayLatency(url: string, latencyMs: number): void {
    const state = this.relayStates.get(url);
    if (!state) return;

    state.latencyMs = latencyMs;

    // Update rolling average
    const samples = state.stats.latencySamples;
    state.stats.avgLatencyMs =
      (state.stats.avgLatencyMs * samples + latencyMs) / (samples + 1);
    state.stats.latencySamples++;

    this.updateReliabilityScore(url);
  }

  private updateRelayError(url: string, error: string): void {
    const state = this.relayStates.get(url);
    if (!state) return;

    state.stats.lastError = error;
    this.updateReliabilityScore(url);
  }

  private incrementSuccessCount(url: string): void {
    const state = this.relayStates.get(url);
    if (state) {
      state.stats.successCount++;
      this.updateReliabilityScore(url);
    }
  }

  private incrementFailureCount(url: string): void {
    const state = this.relayStates.get(url);
    if (state) {
      state.stats.failureCount++;
      this.updateReliabilityScore(url);
    }
  }

  private incrementMessagesSent(url: string): void {
    const state = this.relayStates.get(url);
    if (state) {
      state.stats.messagesSent++;
    }
  }

  private incrementMessagesReceived(url: string): void {
    const state = this.relayStates.get(url);
    if (state) {
      state.stats.messagesReceived++;
    }
  }

  private updateReliabilityScore(url: string): void {
    const state = this.relayStates.get(url);
    if (!state) return;

    const stats = state.stats;

    // Calculate reliability score (0-100)
    let score = 50; // Start neutral

    // Success rate factor (0-40 points)
    const totalAttempts = stats.successCount + stats.failureCount;
    if (totalAttempts > 0) {
      const successRate = stats.successCount / totalAttempts;
      score += (successRate - 0.5) * 80; // -40 to +40
    }

    // Connection success factor (0-20 points)
    if (stats.connectionAttempts > 0) {
      const connectionSuccessRate = stats.successfulConnections / stats.connectionAttempts;
      score += (connectionSuccessRate - 0.5) * 40; // -20 to +20
    }

    // Latency factor (0-20 points)
    if (stats.avgLatencyMs > 0) {
      // Penalize high latency (>2000ms is bad, <100ms is great)
      const latencyFactor = Math.max(0, Math.min(1, (2000 - stats.avgLatencyMs) / 1900));
      score += (latencyFactor - 0.5) * 40; // -20 to +20
    }

    // Recent activity bonus (0-10 points)
    if (stats.lastSuccessfulConnection) {
      const timeSinceSuccess = Date.now() - stats.lastSuccessfulConnection;
      if (timeSinceSuccess < 60000) { // Last minute
        score += 10;
      } else if (timeSinceSuccess < 300000) { // Last 5 minutes
        score += 5;
      }
    }

    // Primary relay bonus
    if (state.isPrimary) {
      score += 10;
    }

    // Clamp to 0-100
    state.stats.reliabilityScore = Math.max(0, Math.min(100, Math.round(score)));

    this.emitEvent({ type: 'stats_updated', url, stats: state.stats });
  }

  private trackReceivedEvent(eventId: string, relayUrl: string): void {
    if (!this.seenEvents.has(eventId)) {
      this.seenEvents.set(eventId, new Set());
    }
    this.seenEvents.get(eventId)!.add(relayUrl);

    // Limit seen events cache
    if (this.seenEvents.size > 10000) {
      const oldestKey = this.seenEvents.keys().next().value;
      if (oldestKey) {
        this.seenEvents.delete(oldestKey);
      }
    }

    this.emitEvent({ type: 'message_received', eventId, relayUrl });
  }

  private findRelayForEvent(event: NostrEvent, relayUrls: string[]): string {
    // Try to find which relay sent this event
    const relaysWithEvent = this.seenEvents.get(event.id);
    if (relaysWithEvent) {
      for (const url of relayUrls) {
        if (relaysWithEvent.has(url)) {
          return url;
        }
      }
    }
    // Default to first relay
    return relayUrls[0] || 'unknown';
  }

  // ==========================================================================
  // Private Methods - Health Check
  // ==========================================================================

  private startHealthCheck(): void {
    this.stopHealthCheck();

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  private async performHealthCheck(): Promise<void> {
    const connectedRelays = this.getConnectedRelays();
    const summary = this.getConnectionSummary();

    console.log(`[RelayManager] Health check: ${summary.connected}/${summary.total} relays connected`);

    // Check if we need more connections
    if (connectedRelays.length < this.config.minConnections) {
      console.log(`[RelayManager] Below minimum connections, attempting to connect more relays...`);

      const disconnectedRelays = [...this.relayStates.entries()]
        .filter(([_, state]) =>
          state.state === 'disconnected' &&
          !state.isBlacklisted &&
          state.stats.reliabilityScore >= this.config.minReliabilityScore
        )
        .sort((a, b) => b[1].stats.reliabilityScore - a[1].stats.reliabilityScore)
        .slice(0, this.config.minConnections - connectedRelays.length);

      for (const [url] of disconnectedRelays) {
        await this.connectToRelay(url);
      }
    }

    // Persist stats periodically
    this.persistState();
  }

  // ==========================================================================
  // Private Methods - Persistence
  // ==========================================================================

  private persistState(): void {
    try {
      if (typeof localStorage === 'undefined') return;

      const data = {
        stats: Object.fromEntries(
          [...this.relayStates.entries()].map(([url, state]) => [url, state.stats])
        ),
        whitelist: [...this.whitelist],
        blacklist: [...this.blacklist],
        userLocation: this.config.userLatitude && this.config.userLongitude
          ? { latitude: this.config.userLatitude, longitude: this.config.userLongitude }
          : null,
      };

      localStorage.setItem(this.config.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('[RelayManager] Failed to persist state:', error);
    }
  }

  private loadPersistedState(): void {
    try {
      if (typeof localStorage === 'undefined') return;

      const stored = localStorage.getItem(this.config.storageKey);
      if (!stored) return;

      const data = JSON.parse(stored);

      // Restore whitelist and blacklist
      if (Array.isArray(data.whitelist)) {
        this.whitelist = new Set(data.whitelist);
      }
      if (Array.isArray(data.blacklist)) {
        this.blacklist = new Set(data.blacklist);
      }

      // Restore user location
      if (data.userLocation) {
        this.config.userLatitude = data.userLocation.latitude;
        this.config.userLongitude = data.userLocation.longitude;
      }

      // Restore stats for known relays
      if (data.stats) {
        for (const [url, stats] of Object.entries(data.stats)) {
          const state = this.relayStates.get(url);
          if (state) {
            state.stats = stats as RelayStats;
          }
        }
      }

      console.log('[RelayManager] Restored persisted state');
    } catch (error) {
      console.error('[RelayManager] Failed to load persisted state:', error);
    }
  }

  // ==========================================================================
  // Private Methods - Event Emission
  // ==========================================================================

  private emitEvent(event: RelayManagerEvent): void {
    for (const handler of this.eventListeners) {
      try {
        handler(event);
      } catch (error) {
        console.error('[RelayManager] Event handler error:', error);
      }
    }
  }

  private emitConnectionStatusChanged(): void {
    const summary = this.getConnectionSummary();
    this.emitEvent({
      type: 'connection_status_changed',
      connected: summary.connected,
      total: summary.total,
    });
  }

  private notifyStateChange(url: string): void {
    const state = this.relayStates.get(url);
    if (!state) return;

    const status = this.stateToStatus(state);

    for (const listener of this.stateChangeListeners) {
      try {
        listener(status);
      } catch (error) {
        console.error('[RelayManager] State change listener error:', error);
      }
    }
  }

  private stateToStatus(state: ExtendedRelayState): RelayStatus {
    return {
      url: state.url,
      state: state.state,
      isConnected: state.state === 'connected',
      lastError: state.lastError,
      lastConnectedAt: state.lastConnectedAt,
      lastDisconnectedAt: state.lastDisconnectedAt,
      reconnectAttempts: state.reconnectAttempts,
      nextReconnectTime: state.nextReconnectTime,
      messagesSent: state.stats.messagesSent,
      messagesReceived: state.stats.messagesReceived,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultRelayManager: RelayManager | null = null;

/**
 * Get the default RelayManager instance
 */
export function getDefaultRelayManager(): RelayManager {
  if (!defaultRelayManager) {
    defaultRelayManager = new RelayManager();
  }
  return defaultRelayManager;
}

/**
 * Reset the default RelayManager (useful for testing)
 */
export function resetDefaultRelayManager(): void {
  if (defaultRelayManager) {
    defaultRelayManager.disconnect();
    defaultRelayManager = null;
  }
}
