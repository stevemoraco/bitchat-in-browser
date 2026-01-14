/**
 * Mesh Network Types
 */

export type ConnectionMethod = 'nostr' | 'direct' | 'cached' | 'local';

export type MeshStatus = 'disconnected' | 'discovering' | 'connecting' | 'connected';

export interface MeshPeer {
  peerId: string;
  fingerprint?: string;
  nickname?: string;
  connectionMethod: ConnectionMethod;
  connectedAt: number;
  lastSeen: number;
  latency?: number;
  appVersion?: string;
}

export interface DiscoveryResult {
  method: ConnectionMethod;
  success: boolean;
  peerId?: string;
  error?: string;
}

export interface CachedPeerInfo {
  peerId: string;
  fingerprint: string;
  lastSeen: number;
  connectionMethods: ConnectionMethod[];
}

export interface MeshConfig {
  autoConnect: boolean;
  maxPeers: number;
  fullMeshThreshold: number; // Above this, use hub-spoke
  discoveryTimeout: number;
  reconnectInterval: number;
}

export const DEFAULT_MESH_CONFIG: MeshConfig = {
  autoConnect: true,
  maxPeers: 50,
  fullMeshThreshold: 10,
  discoveryTimeout: 10000,
  reconnectInterval: 30000,
};
