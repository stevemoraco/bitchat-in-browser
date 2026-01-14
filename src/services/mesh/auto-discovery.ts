/**
 * Mesh Auto-Discovery Service
 *
 * Automatically discovers and connects to mesh peers on app launch.
 * No manual action required - mesh forms automatically when possible.
 */

import { getTrysteroService } from '../webrtc/trystero';
import type {
  MeshConfig,
  MeshStatus,
  MeshPeer,
  DiscoveryResult,
  CachedPeerInfo,
  ConnectionMethod,
} from './types';
import { DEFAULT_MESH_CONFIG } from './types';

// Storage key for cached peers
const CACHED_PEERS_KEY = 'bitchat_mesh_cached_peers';

export class MeshAutoDiscovery {
  private static instance: MeshAutoDiscovery | null = null;

  private config: MeshConfig;
  private status: MeshStatus = 'disconnected';
  private peers: Map<string, MeshPeer> = new Map();
  private discoveryInProgress = false;
  private statusListeners: Set<(status: MeshStatus) => void> = new Set();
  private peerListeners: Set<(peers: MeshPeer[]) => void> = new Set();

  private constructor() {
    this.config = { ...DEFAULT_MESH_CONFIG };
  }

  static getInstance(): MeshAutoDiscovery {
    if (!MeshAutoDiscovery.instance) {
      MeshAutoDiscovery.instance = new MeshAutoDiscovery();
    }
    return MeshAutoDiscovery.instance;
  }

  /**
   * Initialize and start auto-discovery
   * Called on app launch
   */
  async initialize(config?: Partial<MeshConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    console.log('[MeshDiscovery] Initializing auto-discovery');

    if (this.config.autoConnect) {
      await this.startDiscovery();
    }
  }

  /**
   * Start mesh discovery - tries all methods in parallel
   */
  async startDiscovery(): Promise<DiscoveryResult[]> {
    if (this.discoveryInProgress) {
      console.log('[MeshDiscovery] Discovery already in progress');
      return [];
    }

    this.discoveryInProgress = true;
    this.setStatus('discovering');

    console.log('[MeshDiscovery] Starting parallel discovery');

    // Try all discovery methods in parallel
    const results = await Promise.allSettled([
      this.discoverViaNostr(),
      this.discoverViaCachedPeers(),
      this.discoverViaLocalNetwork(),
    ]);

    const successfulResults: DiscoveryResult[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        successfulResults.push(result.value);
      }
    }

    this.discoveryInProgress = false;

    if (this.peers.size > 0) {
      this.setStatus('connected');
    } else {
      this.setStatus('disconnected');
    }

    console.log(`[MeshDiscovery] Discovery complete: ${this.peers.size} peers connected`);

    return successfulResults;
  }

  /**
   * Discover peers via Nostr relays (requires internet)
   */
  private async discoverViaNostr(): Promise<DiscoveryResult> {
    try {
      console.log('[MeshDiscovery] Trying Nostr relay discovery');

      const trystero = getTrysteroService();
      await trystero.initialize();

      // Join the default location room
      // The room ID would come from the channel store
      const roomId = this.getDefaultRoomId();

      await trystero.joinRoom(roomId);

      // Set up peer handlers
      trystero.onPeerJoin((peerId, _roomId) => {
        this.addPeer({
          peerId,
          connectionMethod: 'nostr',
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      });

      trystero.onPeerLeave((peerId) => {
        this.removePeer(peerId);
      });

      return { method: 'nostr', success: true };
    } catch (error) {
      console.log('[MeshDiscovery] Nostr discovery failed:', error);
      return {
        method: 'nostr',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Try to reconnect to previously known peers
   */
  private async discoverViaCachedPeers(): Promise<DiscoveryResult> {
    try {
      console.log('[MeshDiscovery] Trying cached peer discovery');

      const cachedPeers = this.getCachedPeers();

      if (cachedPeers.length === 0) {
        return { method: 'cached', success: false, error: 'No cached peers' };
      }

      // Sort by most recently seen
      cachedPeers.sort((a, b) => b.lastSeen - a.lastSeen);

      // Try to connect to recent peers
      const recentPeers = cachedPeers.slice(0, 10);

      for (const peer of recentPeers) {
        // TODO: Implement direct reconnection using stored peer info
        // This would use stored WebRTC offers/ICE candidates
        console.log(`[MeshDiscovery] Would reconnect to cached peer: ${peer.peerId}`);
      }

      return { method: 'cached', success: false, error: 'Not yet implemented' };
    } catch (error) {
      return {
        method: 'cached',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Discover peers on local network via mDNS (same WiFi)
   */
  private async discoverViaLocalNetwork(): Promise<DiscoveryResult> {
    try {
      console.log('[MeshDiscovery] Trying local network discovery');

      // mDNS discovery happens automatically via WebRTC ICE
      // When on same network, mDNS candidates enable direct connection
      // This is handled by Trystero's WebRTC layer

      // For now, this is a placeholder - local discovery is enhanced
      // when we add direct WebRTC connections in Agent 2.2

      return { method: 'local', success: false, error: 'Handled by WebRTC ICE' };
    } catch (error) {
      return {
        method: 'local',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get default room ID (from geolocation or global)
   */
  private getDefaultRoomId(): string {
    // TODO: Get from channels store based on user location
    // For now, use a global room
    return 'bitchat-global';
  }

  /**
   * Add a peer to the mesh
   */
  addPeer(peer: MeshPeer): void {
    this.peers.set(peer.peerId, peer);
    this.cachePeer(peer);
    this.notifyPeerListeners();

    if (this.status !== 'connected') {
      this.setStatus('connected');
    }

    console.log(`[MeshDiscovery] Peer added: ${peer.peerId} via ${peer.connectionMethod}`);
  }

  /**
   * Remove a peer from the mesh
   */
  removePeer(peerId: string): void {
    this.peers.delete(peerId);
    this.notifyPeerListeners();

    if (this.peers.size === 0) {
      this.setStatus('disconnected');
    }

    console.log(`[MeshDiscovery] Peer removed: ${peerId}`);
  }

  /**
   * Get all connected peers
   */
  getPeers(): MeshPeer[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get peer count
   */
  getPeerCount(): number {
    return this.peers.size;
  }

  /**
   * Get current status
   */
  getStatus(): MeshStatus {
    return this.status;
  }

  /**
   * Check if we should use hub-spoke topology
   */
  shouldUseHubSpoke(): boolean {
    return this.peers.size > this.config.fullMeshThreshold;
  }

  /**
   * Set mesh config (e.g., from user slider)
   */
  setConfig(config: Partial<MeshConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[MeshDiscovery] Config updated:', this.config);
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: (status: MeshStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Subscribe to peer list changes
   */
  onPeersChange(listener: (peers: MeshPeer[]) => void): () => void {
    this.peerListeners.add(listener);
    return () => this.peerListeners.delete(listener);
  }

  // === Private Helpers ===

  private setStatus(status: MeshStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach((l) => l(status));
    }
  }

  private notifyPeerListeners(): void {
    const peers = this.getPeers();
    this.peerListeners.forEach((l) => l(peers));
  }

  private getCachedPeers(): CachedPeerInfo[] {
    try {
      const cached = localStorage.getItem(CACHED_PEERS_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  private cachePeer(peer: MeshPeer): void {
    try {
      const cached = this.getCachedPeers();
      const existing = cached.findIndex((p) => p.peerId === peer.peerId);

      const info: CachedPeerInfo = {
        peerId: peer.peerId,
        fingerprint: peer.fingerprint || '',
        lastSeen: Date.now(),
        connectionMethods: [peer.connectionMethod],
      };

      if (existing >= 0) {
        // Update existing
        const methods = new Set([...cached[existing].connectionMethods, peer.connectionMethod]);
        info.connectionMethods = Array.from(methods);
        cached[existing] = info;
      } else {
        // Add new
        cached.push(info);
      }

      // Keep only last 100 peers
      const trimmed = cached.slice(-100);
      localStorage.setItem(CACHED_PEERS_KEY, JSON.stringify(trimmed));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    this.peers.clear();
    this.statusListeners.clear();
    this.peerListeners.clear();
    this.status = 'disconnected';
    console.log('[MeshDiscovery] Shutdown complete');
  }
}

// Export singleton
export const meshDiscovery = MeshAutoDiscovery.getInstance();
export default meshDiscovery;
