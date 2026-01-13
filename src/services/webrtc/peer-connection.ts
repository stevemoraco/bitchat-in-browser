/**
 * Peer Connection Manager
 * Low-level WebRTC wrapper for managing individual peer connections
 */

import type {
  ConnectionState,
  IceConnectionState,
  P2PPeer,
  PeerStats,
  IceServer,
} from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Peer connection configuration
 */
export interface PeerConnectionConfig {
  /** ICE servers for NAT traversal */
  iceServers: IceServer[];
  /** Data channel label */
  dataChannelLabel?: string;
  /** Ordered delivery */
  ordered?: boolean;
  /** Maximum retransmits (for unreliable mode) */
  maxRetransmits?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Peer connection events
 */
export interface PeerConnectionEvents {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onIceStateChange?: (state: IceConnectionState) => void;
  onDataChannelOpen?: () => void;
  onDataChannelClose?: () => void;
  onDataChannelError?: (error: Event) => void;
  onMessage?: (data: string | ArrayBuffer) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: PeerConnectionConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
  dataChannelLabel: 'bitchat',
  ordered: true,
  maxRetransmits: undefined, // undefined = reliable
  debug: false,
};

// ============================================================================
// Peer Connection Manager
// ============================================================================

/**
 * Manages a single WebRTC peer connection with data channel
 */
export class PeerConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private config: PeerConnectionConfig;
  private events: PeerConnectionEvents;
  private peerId: string;
  private isInitiator: boolean;
  private connectionState: ConnectionState = 'new';
  private iceState: IceConnectionState = 'new';
  private stats: PeerStats;

  constructor(
    peerId: string,
    isInitiator: boolean,
    config: Partial<PeerConnectionConfig> = {},
    events: PeerConnectionEvents = {}
  ) {
    this.peerId = peerId;
    this.isInitiator = isInitiator;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.events = events;
    this.stats = this.createInitialStats();
  }

  /**
   * Initialize the peer connection
   */
  async initialize(): Promise<void> {
    if (this.peerConnection) {
      this.log('Connection already initialized');
      return;
    }

    this.log('Initializing peer connection');

    // Create RTCPeerConnection
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.config.iceServers as RTCIceServer[],
    });

    // Set up event handlers
    this.setupConnectionHandlers();

    // Create data channel if initiator
    if (this.isInitiator) {
      this.createDataChannel();
    } else {
      // Wait for data channel from remote peer
      this.peerConnection.ondatachannel = (event) => {
        this.log('Received data channel');
        this.dataChannel = event.channel;
        this.setupDataChannelHandlers();
      };
    }

    this.updateConnectionState('connecting');
  }

  /**
   * Create an SDP offer (for initiator)
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.log('Creating offer');
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Create an SDP answer (for non-initiator)
   */
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.log('Creating answer');
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Set remote SDP description
   */
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.log(`Setting remote description (${description.type})`);
    await this.peerConnection.setRemoteDescription(description);
  }

  /**
   * Add an ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection not initialized');
    }

    this.log('Adding ICE candidate');
    await this.peerConnection.addIceCandidate(candidate);
  }

  /**
   * Send data through the data channel
   */
  send(data: string | ArrayBuffer | Uint8Array): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      this.log('Data channel not ready, cannot send');
      return false;
    }

    try {
      if (typeof data === 'string') {
        this.dataChannel.send(data);
        this.stats.bytesSent += data.length;
      } else if (data instanceof ArrayBuffer) {
        this.dataChannel.send(data);
        this.stats.bytesSent += data.byteLength;
      } else {
        // Uint8Array - convert to ArrayBuffer slice
        const buffer = data.buffer.slice(
          data.byteOffset,
          data.byteOffset + data.byteLength
        ) as ArrayBuffer;
        this.dataChannel.send(buffer);
        this.stats.bytesSent += data.byteLength;
      }

      this.stats.messagesSent++;
      return true;
    } catch (error) {
      this.log('Error sending data:', error);
      return false;
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get current ICE state
   */
  getIceState(): IceConnectionState {
    return this.iceState;
  }

  /**
   * Get data channel state
   */
  getDataChannelState(): RTCDataChannelState {
    return this.dataChannel?.readyState ?? 'closed';
  }

  /**
   * Check if connection is ready to send data
   */
  isReady(): boolean {
    return (
      this.dataChannel?.readyState === 'open' &&
      this.connectionState === 'connected'
    );
  }

  /**
   * Get connection statistics
   */
  getStats(): PeerStats {
    return { ...this.stats };
  }

  /**
   * Get peer information
   */
  getPeerInfo(): P2PPeer {
    return {
      peerId: this.peerId,
      connectionState: this.connectionState,
      iceState: this.iceState,
      dataChannelState: this.getDataChannelState(),
      rooms: [],
      firstSeenAt: this.stats.connectedAt ?? Date.now(),
      lastSeenAt: Date.now(),
      rtt: this.stats.currentRtt,
    };
  }

  /**
   * Close the connection
   */
  close(): void {
    this.log('Closing connection');

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.updateConnectionState('closed');
  }

  /**
   * Restart ICE connection
   */
  async restartIce(): Promise<RTCSessionDescriptionInit | null> {
    if (!this.peerConnection) {
      return null;
    }

    this.log('Restarting ICE');
    const offer = await this.peerConnection.createOffer({ iceRestart: true });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private createDataChannel(): void {
    if (!this.peerConnection) return;

    this.log('Creating data channel');
    this.dataChannel = this.peerConnection.createDataChannel(
      this.config.dataChannelLabel!,
      {
        ordered: this.config.ordered,
        maxRetransmits: this.config.maxRetransmits,
      }
    );

    this.setupDataChannelHandlers();
  }

  private setupConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // Connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      this.log(`Connection state: ${state}`);

      switch (state) {
        case 'new':
          this.updateConnectionState('new');
          break;
        case 'connecting':
          this.updateConnectionState('connecting');
          break;
        case 'connected':
          this.updateConnectionState('connected');
          this.stats.connectedAt = Date.now();
          break;
        case 'disconnected':
          this.updateConnectionState('disconnected');
          break;
        case 'failed':
          this.updateConnectionState('failed');
          break;
        case 'closed':
          this.updateConnectionState('closed');
          break;
      }
    };

    // ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      this.log(`ICE state: ${state}`);
      this.iceState = state as IceConnectionState;
      this.events.onIceStateChange?.(this.iceState);
    };

    // ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.log('Generated ICE candidate');
        this.events.onIceCandidate?.(event.candidate);
      }
    };

    // ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      this.log(`ICE gathering state: ${this.peerConnection?.iceGatheringState}`);
    };
  }

  private setupDataChannelHandlers(): void {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this.log('Data channel opened');
      this.events.onDataChannelOpen?.();
    };

    this.dataChannel.onclose = () => {
      this.log('Data channel closed');
      this.events.onDataChannelClose?.();
    };

    this.dataChannel.onerror = (event) => {
      this.log('Data channel error:', event);
      this.events.onDataChannelError?.(event);
    };

    this.dataChannel.onmessage = (event) => {
      this.stats.messagesReceived++;
      if (typeof event.data === 'string') {
        this.stats.bytesReceived += event.data.length;
      } else if (event.data instanceof ArrayBuffer) {
        this.stats.bytesReceived += event.data.byteLength;
      }
      this.events.onMessage?.(event.data);
    };
  }

  private updateConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.events.onConnectionStateChange?.(state);
    }
  }

  private createInitialStats(): PeerStats {
    return {
      peerId: this.peerId,
      bytesSent: 0,
      bytesReceived: 0,
      messagesSent: 0,
      messagesReceived: 0,
    };
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log(`[PeerConnection:${this.peerId.slice(0, 8)}]`, ...args);
    }
  }
}

// ============================================================================
// Connection Pool
// ============================================================================

/**
 * Manages multiple peer connections
 */
export class PeerConnectionPool {
  private connections: Map<string, PeerConnectionManager> = new Map();
  private config: PeerConnectionConfig;
  private debug: boolean;

  constructor(config: Partial<PeerConnectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.debug = config.debug ?? false;
  }

  /**
   * Get or create a connection for a peer
   */
  getOrCreate(
    peerId: string,
    isInitiator: boolean,
    events?: PeerConnectionEvents
  ): PeerConnectionManager {
    let connection = this.connections.get(peerId);

    if (!connection) {
      this.log(`Creating new connection for peer: ${peerId}`);
      connection = new PeerConnectionManager(
        peerId,
        isInitiator,
        this.config,
        events
      );
      this.connections.set(peerId, connection);
    }

    return connection;
  }

  /**
   * Get an existing connection
   */
  get(peerId: string): PeerConnectionManager | undefined {
    return this.connections.get(peerId);
  }

  /**
   * Check if a connection exists
   */
  has(peerId: string): boolean {
    return this.connections.has(peerId);
  }

  /**
   * Remove and close a connection
   */
  remove(peerId: string): boolean {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
      this.log(`Removed connection for peer: ${peerId}`);
      return true;
    }
    return false;
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): string[] {
    return [...this.connections.entries()]
      .filter(([_, conn]) => conn.isReady())
      .map(([peerId]) => peerId);
  }

  /**
   * Get all peer IDs
   */
  getAllPeers(): string[] {
    return [...this.connections.keys()];
  }

  /**
   * Get connection count
   */
  get size(): number {
    return this.connections.size;
  }

  /**
   * Broadcast data to all connected peers
   */
  broadcast(data: string | ArrayBuffer | Uint8Array, excludePeers?: string[]): number {
    const excludeSet = new Set(excludePeers ?? []);
    let sentCount = 0;

    for (const [peerId, connection] of this.connections) {
      if (!excludeSet.has(peerId) && connection.send(data)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Send data to specific peers
   */
  sendTo(
    peerIds: string[],
    data: string | ArrayBuffer | Uint8Array
  ): Map<string, boolean> {
    const results = new Map<string, boolean>();

    for (const peerId of peerIds) {
      const connection = this.connections.get(peerId);
      results.set(peerId, connection?.send(data) ?? false);
    }

    return results;
  }

  /**
   * Get statistics for all connections
   */
  getAllStats(): Map<string, PeerStats> {
    const stats = new Map<string, PeerStats>();
    for (const [peerId, connection] of this.connections) {
      stats.set(peerId, connection.getStats());
    }
    return stats;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    this.log(`Closing all ${this.connections.size} connections`);
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();
  }

  /**
   * Clean up disconnected/failed connections
   */
  cleanup(): number {
    const toRemove: string[] = [];

    for (const [peerId, connection] of this.connections) {
      const state = connection.getConnectionState();
      if (state === 'failed' || state === 'closed') {
        toRemove.push(peerId);
      }
    }

    for (const peerId of toRemove) {
      this.remove(peerId);
    }

    return toRemove.length;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[PeerConnectionPool]', ...args);
    }
  }
}
