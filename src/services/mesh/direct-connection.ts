/**
 * Direct WebRTC Connection Manager
 *
 * Manages WebRTC connections without centralized signaling.
 * Used for QR-based offline mesh and direct peer reconnection.
 */

import type { MeshPeer, ConnectionMethod } from './types';

// ============================================================================
// Configuration Types
// ============================================================================

export interface DirectConnectionConfig {
  iceServers?: RTCIceServer[];
  dataChannelLabel?: string;
  connectionTimeout?: number;
}

// ============================================================================
// Connection Types
// ============================================================================

export interface ConnectionOffer {
  sdp: string;
  type: 'offer';
  timestamp: number;
  peerId: string;
  appVersion: string;
}

export interface ConnectionAnswer {
  sdp: string;
  type: 'answer';
  timestamp: number;
  peerId: string;
}

export interface DirectConnection {
  peerId: string;
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  createdAt: number;
  connectedAt?: number;
}

// ============================================================================
// Handler Types
// ============================================================================

type MessageHandler = (data: unknown, peerId: string) => void;
type ConnectionHandler = (peerId: string, connection: DirectConnection) => void;

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: Required<DirectConnectionConfig> = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  dataChannelLabel: 'bitchat-mesh',
  connectionTimeout: 30000,
};

// ============================================================================
// Direct Connection Manager
// ============================================================================

export class DirectConnectionManager {
  private static instance: DirectConnectionManager | null = null;

  private config: Required<DirectConnectionConfig>;
  private connections: Map<string, DirectConnection> = new Map();
  private localPeerId: string;
  private appVersion: string;

  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private disconnectionHandlers: Set<(peerId: string) => void> = new Set();

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.localPeerId = this.generatePeerId();
    this.appVersion = '__APP_VERSION__'; // Replaced at build time
  }

  static getInstance(): DirectConnectionManager {
    if (!DirectConnectionManager.instance) {
      DirectConnectionManager.instance = new DirectConnectionManager();
    }
    return DirectConnectionManager.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    if (DirectConnectionManager.instance) {
      DirectConnectionManager.instance.closeAll();
      DirectConnectionManager.instance = null;
    }
  }

  /**
   * Initialize with custom config
   */
  initialize(config?: DirectConnectionConfig): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    console.log('[DirectConnection] Initialized with peer ID:', this.localPeerId);
  }

  /**
   * Create an offer for QR code display
   * Returns serialized offer that can be put in QR code
   */
  async createOffer(): Promise<{ offer: ConnectionOffer; encoded: string }> {
    const pc = new RTCPeerConnection({ iceServers: this.config.iceServers });
    const peerId = this.localPeerId;

    // Create data channel BEFORE creating offer
    const dataChannel = pc.createDataChannel(this.config.dataChannelLabel, {
      ordered: true,
    });

    // Store connection
    const connection: DirectConnection = {
      peerId: 'pending',
      peerConnection: pc,
      dataChannel,
      state: 'new',
      createdAt: Date.now(),
    };

    // Set up data channel handlers
    this.setupDataChannel(dataChannel, connection);

    // Create offer
    const offerSdp = await pc.createOffer();
    await pc.setLocalDescription(offerSdp);

    // Wait for ICE gathering to complete
    await this.waitForIceGathering(pc);

    const offer: ConnectionOffer = {
      sdp: pc.localDescription!.sdp,
      type: 'offer',
      timestamp: Date.now(),
      peerId,
      appVersion: this.appVersion,
    };

    // Encode for QR (base64 compressed)
    const encoded = this.encodeForQR(offer);

    // Store pending connection (will be finalized when answer received)
    this.connections.set('pending-offer', connection);

    console.log('[DirectConnection] Created offer, waiting for answer');

    return { offer, encoded };
  }

  /**
   * Accept an offer and create an answer
   * Used by device scanning the QR code
   */
  async acceptOffer(
    encodedOffer: string
  ): Promise<{ answer: ConnectionAnswer; encoded: string }> {
    const offer = this.decodeFromQR(encodedOffer) as ConnectionOffer;

    if (!offer || offer.type !== 'offer') {
      throw new Error('Invalid offer');
    }

    const pc = new RTCPeerConnection({ iceServers: this.config.iceServers });

    // Store connection
    const connection: DirectConnection = {
      peerId: offer.peerId,
      peerConnection: pc,
      dataChannel: null,
      state: 'connecting',
      createdAt: Date.now(),
    };

    // Handle incoming data channel
    pc.ondatachannel = (event) => {
      connection.dataChannel = event.channel;
      this.setupDataChannel(event.channel, connection);
    };

    // Set remote description (the offer)
    await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp });

    // Create answer
    const answerSdp = await pc.createAnswer();
    await pc.setLocalDescription(answerSdp);

    // Wait for ICE gathering
    await this.waitForIceGathering(pc);

    const answer: ConnectionAnswer = {
      sdp: pc.localDescription!.sdp,
      type: 'answer',
      timestamp: Date.now(),
      peerId: this.localPeerId,
    };

    const encoded = this.encodeForQR(answer);

    // Store connection
    this.connections.set(offer.peerId, connection);

    // Set up connection state monitoring
    this.monitorConnection(connection);

    console.log('[DirectConnection] Accepted offer, created answer');

    return { answer, encoded };
  }

  /**
   * Complete connection by accepting an answer
   * Used by original offer creator after scanning answer QR
   */
  async acceptAnswer(encodedAnswer: string): Promise<void> {
    const answer = this.decodeFromQR(encodedAnswer) as ConnectionAnswer;

    if (!answer || answer.type !== 'answer') {
      throw new Error('Invalid answer');
    }

    // Get pending connection
    const connection = this.connections.get('pending-offer');
    if (!connection) {
      throw new Error('No pending offer found');
    }

    // Update peer ID
    connection.peerId = answer.peerId;
    this.connections.delete('pending-offer');
    this.connections.set(answer.peerId, connection);

    // Set remote description (the answer)
    await connection.peerConnection.setRemoteDescription({
      type: 'answer',
      sdp: answer.sdp,
    });

    // Monitor connection
    this.monitorConnection(connection);

    console.log('[DirectConnection] Accepted answer, connection completing');
  }

  /**
   * Send data to a specific peer
   */
  send(peerId: string, data: unknown): boolean {
    const connection = this.connections.get(peerId);

    if (!connection || !connection.dataChannel) {
      console.warn('[DirectConnection] Cannot send - no connection to peer:', peerId);
      return false;
    }

    if (connection.dataChannel.readyState !== 'open') {
      console.warn(
        '[DirectConnection] Cannot send - channel not open:',
        connection.dataChannel.readyState
      );
      return false;
    }

    try {
      const message = JSON.stringify({
        from: this.localPeerId,
        data,
        timestamp: Date.now(),
      });
      connection.dataChannel.send(message);
      return true;
    } catch (error) {
      console.error('[DirectConnection] Send error:', error);
      return false;
    }
  }

  /**
   * Broadcast data to all connected peers
   */
  broadcast(data: unknown): number {
    let sent = 0;
    const peerIds = Array.from(this.connections.keys());
    for (const peerId of peerIds) {
      if (peerId !== 'pending-offer' && this.send(peerId, data)) {
        sent++;
      }
    }
    return sent;
  }

  /**
   * Get all connected peers
   */
  getConnectedPeers(): MeshPeer[] {
    const peers: MeshPeer[] = [];
    const entries = Array.from(this.connections.entries());

    for (const [peerId, conn] of entries) {
      if (peerId !== 'pending-offer' && conn.state === 'connected') {
        peers.push({
          peerId,
          connectionMethod: 'direct' as ConnectionMethod,
          connectedAt: conn.connectedAt || conn.createdAt,
          lastSeen: Date.now(),
        });
      }
    }

    return peers;
  }

  /**
   * Close a specific connection
   */
  closeConnection(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.dataChannel?.close();
      connection.peerConnection.close();
      this.connections.delete(peerId);
      this.disconnectionHandlers.forEach((h) => h(peerId));
      console.log('[DirectConnection] Closed connection to:', peerId);
    }
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    const peerIds = Array.from(this.connections.keys());
    for (const peerId of peerIds) {
      this.closeConnection(peerId);
    }
  }

  /**
   * Register message handler
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Register connection handler
   */
  onConnection(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  /**
   * Register disconnection handler
   */
  onDisconnection(handler: (peerId: string) => void): () => void {
    this.disconnectionHandlers.add(handler);
    return () => this.disconnectionHandlers.delete(handler);
  }

  /**
   * Get local peer ID
   */
  getLocalPeerId(): string {
    return this.localPeerId;
  }

  /**
   * Check if we have a pending offer waiting for an answer
   */
  hasPendingOffer(): boolean {
    return this.connections.has('pending-offer');
  }

  /**
   * Cancel pending offer
   */
  cancelPendingOffer(): void {
    const connection = this.connections.get('pending-offer');
    if (connection) {
      connection.dataChannel?.close();
      connection.peerConnection.close();
      this.connections.delete('pending-offer');
      console.log('[DirectConnection] Cancelled pending offer');
    }
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    let count = 0;
    const entries = Array.from(this.connections.entries());
    for (const [peerId, conn] of entries) {
      if (peerId !== 'pending-offer' && conn.state === 'connected') {
        count++;
      }
    }
    return count;
  }

  /**
   * Get connection by peer ID
   */
  getConnection(peerId: string): DirectConnection | undefined {
    return this.connections.get(peerId);
  }

  /**
   * Check if connected to a specific peer
   */
  isConnectedTo(peerId: string): boolean {
    const connection = this.connections.get(peerId);
    return connection?.state === 'connected' && connection.dataChannel?.readyState === 'open';
  }

  /**
   * Disconnect from a peer (alias for closeConnection)
   */
  disconnect(peerId: string): void {
    this.closeConnection(peerId);
  }

  /**
   * Shutdown the manager and cleanup all connections
   */
  shutdown(): void {
    this.closeAll();
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
    this.disconnectionHandlers.clear();
    console.log('[DirectConnection] Shutdown complete');
  }

  // === Private Helpers ===

  private setupDataChannel(channel: RTCDataChannel, connection: DirectConnection): void {
    channel.onopen = () => {
      console.log('[DirectConnection] Data channel opened with:', connection.peerId);
      connection.state = 'connected';
      connection.connectedAt = Date.now();
      this.connectionHandlers.forEach((h) => h(connection.peerId, connection));
    };

    channel.onclose = () => {
      console.log('[DirectConnection] Data channel closed with:', connection.peerId);
      connection.state = 'disconnected';
      this.disconnectionHandlers.forEach((h) => h(connection.peerId));
    };

    channel.onerror = (error) => {
      console.error('[DirectConnection] Data channel error:', error);
      connection.state = 'failed';
    };

    channel.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data as string) as {
          data: unknown;
          from: string;
        };
        this.messageHandlers.forEach((h) => h(parsed.data, parsed.from));
      } catch {
        // Handle non-JSON messages
        this.messageHandlers.forEach((h) => h(event.data as unknown, connection.peerId));
      }
    };
  }

  private monitorConnection(connection: DirectConnection): void {
    const pc = connection.peerConnection;

    pc.onconnectionstatechange = () => {
      console.log('[DirectConnection] Connection state:', pc.connectionState);

      switch (pc.connectionState) {
        case 'connected':
          connection.state = 'connected';
          connection.connectedAt = Date.now();
          break;
        case 'disconnected':
        case 'closed':
          connection.state = 'disconnected';
          this.disconnectionHandlers.forEach((h) => h(connection.peerId));
          break;
        case 'failed':
          connection.state = 'failed';
          this.disconnectionHandlers.forEach((h) => h(connection.peerId));
          break;
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[DirectConnection] ICE state:', pc.iceConnectionState);
    };
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        }
      };

      pc.onicegatheringstatechange = checkState;

      // Also listen for null candidate which indicates completion
      pc.onicecandidate = (event) => {
        if (event.candidate === null) {
          resolve();
        }
      };

      // Timeout after 5 seconds
      setTimeout(resolve, 5000);
    });
  }

  private encodeForQR(data: unknown): string {
    const json = JSON.stringify(data);
    // Use base64 encoding for QR compatibility
    return btoa(json);
  }

  private decodeFromQR(encoded: string): unknown {
    try {
      const json = atob(encoded);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private generatePeerId(): string {
    return crypto.randomUUID();
  }
}

// Export singleton
export const directConnection = DirectConnectionManager.getInstance();
export default directConnection;
