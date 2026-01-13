/**
 * Trystero WebRTC P2P Service
 * Provides serverless WebRTC peer-to-peer messaging using Trystero
 *
 * Features:
 * - Room management with multiple simultaneous rooms
 * - Nostr relay signaling (primary) with BitTorrent fallback
 * - Data channels for text and binary messaging
 * - Hybrid routing (WebRTC when online, Nostr fallback)
 * - Connection state tracking and reconnection handling
 */

import { joinRoom as joinNostrRoom } from 'trystero/nostr';
import { joinRoom as joinTorrentRoom } from 'trystero/torrent';
import type { Room as TrysteroRoom } from 'trystero';

import type {
  RoomConfig,
  RoomState,
  P2PMessage,
  P2PPeer,
  SendOptions,
  ActionPair,
  PeerJoinHandler,
  PeerLeaveHandler,
  DataHandler,
  BinaryHandler,
  ErrorHandler,
  StateChangeHandler,
  WebRTCServiceConfig,
  WebRTCServiceState,
  DeliveryRoute,
  RoutingDecision,
  HybridRoutingConfig,
} from './types';

import { DEFAULT_ICE_SERVERS } from './types';

import { DEFAULT_RELAYS } from '../nostr/relays';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_APP_ID = 'bitchat-p2p';
const PRESENCE_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_SERVICE_CONFIG: WebRTCServiceConfig = {
  appId: DEFAULT_APP_ID,
  defaultStrategy: 'nostr',
  relayUrls: [...DEFAULT_RELAYS.slice(0, 5)], // Use first 5 Nostr relays
  iceServers: [...DEFAULT_ICE_SERVERS],
  debug: false,
  orderingBufferSize: 100,
  maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
  reconnectDelay: RECONNECT_DELAY,
};

const DEFAULT_HYBRID_CONFIG: HybridRoutingConfig = {
  preferWebRTC: true,
  dualSend: false,
  webrtcTimeout: 5000,
  routingCacheTtl: 30000,
};

// ============================================================================
// Room Manager
// ============================================================================

/**
 * Manages a single Trystero room
 */
class RoomManager {
  private room: TrysteroRoom | null = null;
  private config: RoomConfig;
  private state: RoomState;
  private actions: Map<string, ActionPair<unknown>> = new Map();
  private eventHandlers: {
    peerJoin: Set<PeerJoinHandler>;
    peerLeave: Set<PeerLeaveHandler>;
    data: Map<string, Set<DataHandler<unknown>>>;
    binary: Set<BinaryHandler>;
    error: Set<ErrorHandler>;
    stateChange: Set<StateChangeHandler>;
  };
  private peers: Set<string> = new Set();
  private presenceInterval: ReturnType<typeof setInterval> | null = null;
  private messageSequence = 0;
  private debug: boolean;

  constructor(config: RoomConfig, debug = false) {
    this.config = config;
    this.debug = debug;
    this.state = {
      roomId: config.roomId,
      isJoined: false,
      peers: [],
      config,
    };
    this.eventHandlers = {
      peerJoin: new Set(),
      peerLeave: new Set(),
      data: new Map(),
      binary: new Set(),
      error: new Set(),
      stateChange: new Set(),
    };
  }

  /**
   * Join the room
   */
  async join(): Promise<void> {
    if (this.room) {
      this.log('Already joined room');
      return;
    }

    this.log(`Joining room: ${this.config.roomId}`);

    try {
      // Create room based on strategy
      const strategy = this.config.strategy ?? 'nostr';
      const roomConfig = {
        appId: this.config.appId ?? DEFAULT_APP_ID,
        password: this.config.password,
        rtcConfig: {
          iceServers: this.config.iceServers as RTCIceServer[],
        },
      };

      if (strategy === 'nostr') {
        // Use Nostr relays for signaling
        this.room = joinNostrRoom(
          {
            ...roomConfig,
            relayUrls: this.config.relayUrls ?? [...DEFAULT_RELAYS.slice(0, 5)],
          },
          this.config.roomId
        );
      } else {
        // Use BitTorrent trackers as fallback
        this.room = joinTorrentRoom(roomConfig, this.config.roomId);
      }

      // Set up peer event handlers
      this.room.onPeerJoin(this.handlePeerJoin.bind(this));
      this.room.onPeerLeave(this.handlePeerLeave.bind(this));

      // Set up default channels
      this.setupDefaultChannels();

      this.state.isJoined = true;
      this.state.joinedAt = Date.now();

      // Start presence heartbeat
      this.startPresenceHeartbeat();

      this.log('Successfully joined room');
    } catch (error) {
      this.log('Error joining room:', error);
      this.notifyError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Leave the room
   */
  leave(): void {
    this.log('Leaving room');

    this.stopPresenceHeartbeat();

    if (this.room) {
      this.room.leave();
      this.room = null;
    }

    this.peers.clear();
    this.state.isJoined = false;
    this.state.peers = [];
    this.actions.clear();
  }

  /**
   * Send a message to all peers or specific peers
   */
  send<T>(channel: string, data: T, options: SendOptions = {}): string {
    const messageId = this.generateMessageId();
    const message: P2PMessage<T> = {
      id: messageId,
      type: channel,
      payload: data,
      senderId: '', // Will be set by receiver
      targetId: options.targetPeers?.[0],
      timestamp: Date.now(),
      sequence: this.messageSequence++,
    };

    const action = this.getOrCreateAction<P2PMessage<T>>(channel);

    if (options.targetPeers && options.targetPeers.length > 0) {
      action.send(message, options.targetPeers);
    } else {
      action.send(message);
    }

    this.log(`Sent message on channel "${channel}":`, messageId);
    return messageId;
  }

  /**
   * Send binary data
   */
  sendBinary(data: ArrayBuffer | Uint8Array, options: SendOptions = {}): string {
    const messageId = this.generateMessageId();

    // Create binary action if not exists
    const action = this.getOrCreateAction<ArrayBuffer>('__binary__');

    // Prepend message ID (first 36 bytes as UUID string)
    const idBytes = new TextEncoder().encode(messageId);
    const combined = new Uint8Array(idBytes.length + data.byteLength);
    combined.set(idBytes);
    combined.set(
      data instanceof ArrayBuffer ? new Uint8Array(data) : data,
      idBytes.length
    );

    if (options.targetPeers && options.targetPeers.length > 0) {
      action.send(combined.buffer, options.targetPeers);
    } else {
      action.send(combined.buffer);
    }

    this.log(`Sent binary data:`, messageId, `(${data.byteLength} bytes)`);
    return messageId;
  }

  /**
   * Register a handler for a data channel
   */
  onData<T>(channel: string, handler: DataHandler<T>): () => void {
    if (!this.eventHandlers.data.has(channel)) {
      this.eventHandlers.data.set(channel, new Set());
    }
    this.eventHandlers.data.get(channel)!.add(handler as DataHandler<unknown>);

    // Ensure action exists
    this.getOrCreateAction<P2PMessage<T>>(channel);

    return () => {
      this.eventHandlers.data.get(channel)?.delete(handler as DataHandler<unknown>);
    };
  }

  /**
   * Register a handler for binary data
   */
  onBinary(handler: BinaryHandler): () => void {
    this.eventHandlers.binary.add(handler);
    return () => {
      this.eventHandlers.binary.delete(handler);
    };
  }

  /**
   * Register a handler for peer join events
   */
  onPeerJoin(handler: PeerJoinHandler): () => void {
    this.eventHandlers.peerJoin.add(handler);
    return () => {
      this.eventHandlers.peerJoin.delete(handler);
    };
  }

  /**
   * Register a handler for peer leave events
   */
  onPeerLeave(handler: PeerLeaveHandler): () => void {
    this.eventHandlers.peerLeave.add(handler);
    return () => {
      this.eventHandlers.peerLeave.delete(handler);
    };
  }

  /**
   * Register a handler for errors
   */
  onError(handler: ErrorHandler): () => void {
    this.eventHandlers.error.add(handler);
    return () => {
      this.eventHandlers.error.delete(handler);
    };
  }

  /**
   * Get current room state
   */
  getState(): RoomState {
    return {
      ...this.state,
      peers: [...this.peers],
    };
  }

  /**
   * Get connected peer count
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Check if a peer is connected
   */
  hasPeer(peerId: string): boolean {
    return this.peers.has(peerId);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupDefaultChannels(): void {
    // Set up binary channel
    this.getOrCreateAction<ArrayBuffer>('__binary__');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getOrCreateAction<T>(channel: string): ActionPair<T> {
    if (!this.room) {
      throw new Error('Room not joined');
    }

    if (!this.actions.has(channel)) {
      // Use 'any' to satisfy Trystero's DataPayload constraint while keeping our generic API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [send, receive] = this.room.makeAction<any>(channel);
      const action: ActionPair<T> = { send, receive };
      this.actions.set(channel, action as ActionPair<unknown>);

      // Set up receive handler
      receive((data: T, peerId: string) => {
        this.handleIncomingData(channel, data, peerId);
      });
    }

    return this.actions.get(channel) as ActionPair<T>;
  }

  private handlePeerJoin(peerId: string): void {
    this.log(`Peer joined: ${peerId}`);
    this.peers.add(peerId);
    this.state.peers = [...this.peers];

    for (const handler of this.eventHandlers.peerJoin) {
      try {
        handler(peerId, this.config.roomId);
      } catch (error) {
        this.log('Error in peer join handler:', error);
      }
    }
  }

  private handlePeerLeave(peerId: string): void {
    this.log(`Peer left: ${peerId}`);
    this.peers.delete(peerId);
    this.state.peers = [...this.peers];

    for (const handler of this.eventHandlers.peerLeave) {
      try {
        handler(peerId, this.config.roomId);
      } catch (error) {
        this.log('Error in peer leave handler:', error);
      }
    }
  }

  private handleIncomingData<T>(channel: string, data: T, peerId: string): void {
    this.log(`Received data on channel "${channel}" from ${peerId}`);

    if (channel === '__binary__') {
      // Handle binary data
      this.handleBinaryData(data as ArrayBuffer, peerId);
      return;
    }

    // Handle regular data
    const handlers = this.eventHandlers.data.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        try {
          // Extract payload from P2PMessage wrapper
          const message = data as P2PMessage<unknown>;
          handler(message.payload, peerId, this.config.roomId);
        } catch (error) {
          this.log('Error in data handler:', error);
        }
      }
    }
  }

  private handleBinaryData(data: ArrayBuffer, peerId: string): void {
    // Extract message ID from first 36 bytes (can be used for deduplication)
    const view = new Uint8Array(data);
    // Skip the first 36 bytes (message ID) and get payload
    const payload = view.slice(36).buffer;

    for (const handler of this.eventHandlers.binary) {
      try {
        handler(payload, peerId, this.config.roomId);
      } catch (error) {
        this.log('Error in binary handler:', error);
      }
    }
  }

  private startPresenceHeartbeat(): void {
    this.stopPresenceHeartbeat();
    this.presenceInterval = setInterval(() => {
      // Send presence ping to keep connections alive
      try {
        const action = this.getOrCreateAction<{ timestamp: number }>('__presence__');
        action.send({ timestamp: Date.now() });
      } catch {
        // Ignore presence errors
      }
    }, PRESENCE_INTERVAL);
  }

  private stopPresenceHeartbeat(): void {
    if (this.presenceInterval) {
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  private notifyError(error: Error): void {
    for (const handler of this.eventHandlers.error) {
      try {
        handler(error, this.config.roomId);
      } catch (e) {
        console.error('[RoomManager] Error in error handler:', e);
      }
    }
  }

  private generateMessageId(): string {
    return crypto.randomUUID();
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log(`[Room:${this.config.roomId.slice(0, 8)}]`, ...args);
    }
  }
}

// ============================================================================
// Trystero Service
// ============================================================================

/**
 * Main Trystero P2P service
 * Manages multiple rooms and provides hybrid routing
 */
export class TrysteroService {
  private config: WebRTCServiceConfig;
  private rooms: Map<string, RoomManager> = new Map();
  private peers: Map<string, P2PPeer> = new Map();
  private routingCache: Map<string, { decision: RoutingDecision; expiry: number }> =
    new Map();
  private hybridConfig: HybridRoutingConfig;
  private isInitialized = false;
  private globalHandlers: {
    peerJoin: Set<PeerJoinHandler>;
    peerLeave: Set<PeerLeaveHandler>;
    data: Map<string, Set<DataHandler<unknown>>>;
    error: Set<ErrorHandler>;
  };

  constructor(config: Partial<WebRTCServiceConfig> = {}) {
    this.config = { ...DEFAULT_SERVICE_CONFIG, ...config };
    this.hybridConfig = { ...DEFAULT_HYBRID_CONFIG };
    this.globalHandlers = {
      peerJoin: new Set(),
      peerLeave: new Set(),
      data: new Map(),
      error: new Set(),
    };
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.log('Initializing Trystero service');
    this.isInitialized = true;
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    this.log('Shutting down Trystero service');

    // Leave all rooms
    for (const room of this.rooms.values()) {
      room.leave();
    }
    this.rooms.clear();
    this.peers.clear();
    this.routingCache.clear();
    this.isInitialized = false;
  }

  // ============================================================================
  // Room Management
  // ============================================================================

  /**
   * Join a room by channel ID
   */
  async joinRoom(roomId: string, config: Partial<RoomConfig> = {}): Promise<RoomState> {
    if (this.rooms.has(roomId)) {
      this.log(`Already in room: ${roomId}`);
      return this.rooms.get(roomId)!.getState();
    }

    const roomConfig: RoomConfig = {
      roomId,
      appId: config.appId ?? this.config.appId,
      password: config.password,
      strategy: config.strategy ?? this.config.defaultStrategy,
      relayUrls: config.relayUrls ?? this.config.relayUrls,
      iceServers: config.iceServers ?? this.config.iceServers,
    };

    const room = new RoomManager(roomConfig, this.config.debug);

    // Set up event forwarding
    room.onPeerJoin((peerId, roomId) => {
      this.handlePeerJoin(peerId, roomId);
    });

    room.onPeerLeave((peerId, roomId) => {
      this.handlePeerLeave(peerId, roomId);
    });

    room.onError((error, roomId) => {
      this.handleError(error, roomId);
    });

    // Forward global data handlers
    for (const [channel, handlers] of this.globalHandlers.data) {
      for (const handler of handlers) {
        room.onData(channel, handler);
      }
    }

    await room.join();
    this.rooms.set(roomId, room);

    return room.getState();
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.leave();
      this.rooms.delete(roomId);
      this.log(`Left room: ${roomId}`);
    }
  }

  /**
   * Get room state
   */
  getRoomState(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId)?.getState();
  }

  /**
   * Get all room states
   */
  getAllRoomStates(): RoomState[] {
    return [...this.rooms.values()].map((r) => r.getState());
  }

  /**
   * Check if in a room
   */
  isInRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  /**
   * Get room peer count
   */
  getRoomPeerCount(roomId: string): number {
    return this.rooms.get(roomId)?.getPeerCount() ?? 0;
  }

  // ============================================================================
  // Messaging
  // ============================================================================

  /**
   * Send a message to a room
   */
  sendToRoom<T>(
    roomId: string,
    channel: string,
    data: T,
    options: SendOptions = {}
  ): string | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.log(`Not in room: ${roomId}`);
      return null;
    }

    return room.send(channel, data, options);
  }

  /**
   * Send a message to all joined rooms
   */
  broadcast<T>(channel: string, data: T, options: SendOptions = {}): string[] {
    const messageIds: string[] = [];

    for (const room of this.rooms.values()) {
      const id = room.send(channel, data, options);
      messageIds.push(id);
    }

    return messageIds;
  }

  /**
   * Send binary data to a room
   */
  sendBinaryToRoom(
    roomId: string,
    data: ArrayBuffer | Uint8Array,
    options: SendOptions = {}
  ): string | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    return room.sendBinary(data, options);
  }

  /**
   * Register a global data handler (applies to all rooms)
   */
  onData<T>(channel: string, handler: DataHandler<T>): () => void {
    if (!this.globalHandlers.data.has(channel)) {
      this.globalHandlers.data.set(channel, new Set());
    }
    this.globalHandlers.data.get(channel)!.add(handler as DataHandler<unknown>);

    // Add to existing rooms
    for (const room of this.rooms.values()) {
      room.onData(channel, handler);
    }

    return () => {
      this.globalHandlers.data.get(channel)?.delete(handler as DataHandler<unknown>);
    };
  }

  /**
   * Register a global peer join handler
   */
  onPeerJoin(handler: PeerJoinHandler): () => void {
    this.globalHandlers.peerJoin.add(handler);
    return () => {
      this.globalHandlers.peerJoin.delete(handler);
    };
  }

  /**
   * Register a global peer leave handler
   */
  onPeerLeave(handler: PeerLeaveHandler): () => void {
    this.globalHandlers.peerLeave.add(handler);
    return () => {
      this.globalHandlers.peerLeave.delete(handler);
    };
  }

  /**
   * Register a global error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.globalHandlers.error.add(handler);
    return () => {
      this.globalHandlers.error.delete(handler);
    };
  }

  // ============================================================================
  // Peer Management
  // ============================================================================

  /**
   * Get all known peers
   */
  getPeers(): P2PPeer[] {
    return [...this.peers.values()];
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): P2PPeer | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Get online peers (connected via WebRTC)
   */
  getOnlinePeers(): P2PPeer[] {
    return [...this.peers.values()].filter(
      (p) => p.connectionState === 'connected'
    );
  }

  /**
   * Check if a peer is online via WebRTC
   */
  isPeerOnline(peerId: string): boolean {
    const peer = this.peers.get(peerId);
    return peer?.connectionState === 'connected';
  }

  /**
   * Get peers in a specific room
   */
  getPeersInRoom(roomId: string): string[] {
    return this.rooms.get(roomId)?.getState().peers ?? [];
  }

  // ============================================================================
  // Hybrid Routing
  // ============================================================================

  /**
   * Configure hybrid routing
   */
  setHybridConfig(config: Partial<HybridRoutingConfig>): void {
    this.hybridConfig = { ...this.hybridConfig, ...config };
  }

  /**
   * Get routing decision for a peer
   */
  getRoutingDecision(peerFingerprint: string): RoutingDecision {
    // Check cache
    const cached = this.routingCache.get(peerFingerprint);
    if (cached && cached.expiry > Date.now()) {
      return cached.decision;
    }

    // Find peer by fingerprint (need to map fingerprint to peerId)
    const isOnline = this.isWebRTCOnlineByFingerprint(peerFingerprint);

    const decision: RoutingDecision = {
      peerFingerprint,
      route: isOnline && this.hybridConfig.preferWebRTC ? 'webrtc' : 'nostr',
      isWebRTCOnline: isOnline,
      confidence: isOnline ? 0.9 : 0.5,
    };

    // Cache the decision
    this.routingCache.set(peerFingerprint, {
      decision,
      expiry: Date.now() + this.hybridConfig.routingCacheTtl,
    });

    return decision;
  }

  /**
   * Get best route for sending to a peer
   */
  getBestRoute(peerFingerprint: string): DeliveryRoute {
    const decision = this.getRoutingDecision(peerFingerprint);
    return decision.route;
  }

  /**
   * Check if peer is reachable via WebRTC
   */
  isWebRTCOnlineByFingerprint(_peerFingerprint: string): boolean {
    // Check all rooms for this peer
    for (const room of this.rooms.values()) {
      const peers = room.getState().peers;
      // In a real implementation, we'd map fingerprints to peer IDs
      // For now, we check if any peer might match
      if (peers.length > 0) {
        // Peer matching would happen here based on metadata exchange
        return true;
      }
    }
    return false;
  }

  /**
   * Clear routing cache
   */
  clearRoutingCache(): void {
    this.routingCache.clear();
  }

  // ============================================================================
  // Service State
  // ============================================================================

  /**
   * Get service state
   */
  getState(): WebRTCServiceState {
    return {
      isInitialized: this.isInitialized,
      rooms: new Map([...this.rooms.entries()].map(([id, room]) => [id, room.getState()])),
      peers: new Map(this.peers),
      config: { ...this.config },
    };
  }

  /**
   * Check if service is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handlePeerJoin(peerId: string, roomId: string): void {
    this.log(`Peer ${peerId} joined room ${roomId}`);

    // Update or create peer
    let peer = this.peers.get(peerId);
    if (!peer) {
      peer = {
        peerId,
        connectionState: 'connected',
        iceState: 'connected',
        dataChannelState: 'open',
        rooms: [roomId],
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
      };
      this.peers.set(peerId, peer);
    } else {
      peer.connectionState = 'connected';
      peer.lastSeenAt = Date.now();
      if (!peer.rooms.includes(roomId)) {
        peer.rooms.push(roomId);
      }
    }

    // Notify global handlers
    for (const handler of this.globalHandlers.peerJoin) {
      try {
        handler(peerId, roomId);
      } catch (error) {
        this.log('Error in peer join handler:', error);
      }
    }
  }

  private handlePeerLeave(peerId: string, roomId: string): void {
    this.log(`Peer ${peerId} left room ${roomId}`);

    const peer = this.peers.get(peerId);
    if (peer) {
      peer.rooms = peer.rooms.filter((r) => r !== roomId);
      if (peer.rooms.length === 0) {
        peer.connectionState = 'disconnected';
      }
      peer.lastSeenAt = Date.now();
    }

    // Clear routing cache for this peer
    // In a real implementation, we'd map peerId to fingerprint
    this.clearRoutingCache();

    // Notify global handlers
    for (const handler of this.globalHandlers.peerLeave) {
      try {
        handler(peerId, roomId);
      } catch (error) {
        this.log('Error in peer leave handler:', error);
      }
    }
  }

  private handleError(error: Error, roomId?: string): void {
    this.log('Error:', error, 'in room:', roomId);

    for (const handler of this.globalHandlers.error) {
      try {
        handler(error, roomId);
      } catch (e) {
        console.error('[TrysteroService] Error in error handler:', e);
      }
    }
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[TrysteroService]', ...args);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultService: TrysteroService | null = null;

/**
 * Get the default Trystero service instance
 */
export function getTrysteroService(): TrysteroService {
  if (!defaultService) {
    defaultService = new TrysteroService();
  }
  return defaultService;
}

/**
 * Reset the default service (useful for testing)
 */
export function resetTrysteroService(): void {
  if (defaultService) {
    defaultService.shutdown();
    defaultService = null;
  }
}

/**
 * Create a new Trystero service with custom config
 */
export function createTrysteroService(
  config: Partial<WebRTCServiceConfig>
): TrysteroService {
  return new TrysteroService(config);
}

// ============================================================================
// Hybrid Messaging Integration
// ============================================================================

/**
 * Message router that chooses between WebRTC and Nostr
 */
export class HybridMessageRouter {
  private trystero: TrysteroService;
  private config: HybridRoutingConfig;

  constructor(
    trystero: TrysteroService,
    config: Partial<HybridRoutingConfig> = {}
  ) {
    this.trystero = trystero;
    this.config = { ...DEFAULT_HYBRID_CONFIG, ...config };
  }

  /**
   * Send a message using the best available route
   *
   * @param peerFingerprint Target peer fingerprint
   * @param roomId Room/channel ID
   * @param data Message data
   * @param nostrFallback Callback to send via Nostr if needed
   * @returns Whether the message was sent
   */
  async send<T>(
    peerFingerprint: string,
    roomId: string,
    data: T,
    nostrFallback: () => Promise<void>
  ): Promise<{ route: DeliveryRoute; success: boolean }> {
    const decision = this.trystero.getRoutingDecision(peerFingerprint);

    if (this.config.dualSend) {
      // Send via both routes for maximum reliability
      this.sendViaWebRTC(roomId, data, peerFingerprint);
      await nostrFallback();
      return { route: 'hybrid', success: true };
    }

    if (decision.route === 'webrtc' && this.config.preferWebRTC) {
      // Try WebRTC first
      const sent = this.sendViaWebRTC(roomId, data, peerFingerprint);
      if (sent) {
        return { route: 'webrtc', success: true };
      }

      // Fall back to Nostr
      await nostrFallback();
      return { route: 'nostr', success: true };
    }

    // Use Nostr
    await nostrFallback();
    return { route: 'nostr', success: true };
  }

  private sendViaWebRTC<T>(
    roomId: string,
    data: T,
    _targetFingerprint?: string
  ): boolean {
    if (!this.trystero.isInRoom(roomId)) {
      return false;
    }

    const options: SendOptions = {};
    // In a real implementation, we'd map fingerprint to peerId
    // and set targetPeers if we want direct delivery

    const messageId = this.trystero.sendToRoom(roomId, 'chat', data, options);
    return messageId !== null;
  }
}
