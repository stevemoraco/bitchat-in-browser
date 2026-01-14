/**
 * Mesh State Store
 *
 * Manages mesh network state including peers, connection status,
 * and user-configurable topology settings.
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type {
  MeshPeer,
  MeshStatus,
  MeshConfig,
  ConnectionMethod,
} from '../services/mesh/types';
import { DEFAULT_MESH_CONFIG } from '../services/mesh/types';

// ============================================================================
// Types
// ============================================================================

/** Topology modes for mesh network */
export type TopologyMode = 'full-mesh' | 'hub-spoke' | 'auto';

/** Statistics about current mesh topology */
export interface MeshTopologyStats {
  currentConnections: number;
  maxConnections: number;
  estimatedLatency: number;
  batteryImpact: 'low' | 'medium' | 'high';
}

export interface MeshState {
  // Connection Status
  status: MeshStatus;
  connectionMethod: ConnectionMethod | null;
  connectedAt: number | null;

  // Peers
  peers: MeshPeer[];
  localPeerId: string | null;

  // Configuration (user adjustable)
  config: MeshConfig;
  topologyMode: TopologyMode;

  // Statistics
  messagesRelayed: number;
  bytesTransferred: number;

  // Actions
  setStatus: (status: MeshStatus) => void;
  setConnectionMethod: (method: ConnectionMethod | null) => void;
  setLocalPeerId: (peerId: string) => void;

  // Peer management
  addPeer: (peer: MeshPeer) => void;
  removePeer: (peerId: string) => void;
  updatePeer: (peerId: string, updates: Partial<MeshPeer>) => void;
  clearPeers: () => void;

  // Configuration
  setConfig: (config: Partial<MeshConfig>) => void;
  setTopologyMode: (mode: TopologyMode) => void;
  setFullMeshThreshold: (threshold: number) => void;

  // Statistics
  incrementMessagesRelayed: () => void;
  addBytesTransferred: (bytes: number) => void;

  // Computed helpers
  getPeerCount: () => number;
  getTopologyStats: () => MeshTopologyStats;
  shouldUseHubSpoke: () => boolean;

  // Reset
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState = {
  status: 'disconnected' as MeshStatus,
  connectionMethod: null,
  connectedAt: null,
  peers: [] as MeshPeer[],
  localPeerId: null,
  config: DEFAULT_MESH_CONFIG,
  topologyMode: 'auto' as TopologyMode,
  messagesRelayed: 0,
  bytesTransferred: 0,
};

// ============================================================================
// Store
// ============================================================================

export const useMeshStore = create<MeshState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // === Status Actions ===

        setStatus: (status) =>
          set(
            (state) => ({
              status,
              connectedAt:
                status === 'connected' ? Date.now() : state.connectedAt,
            }),
            false,
            'setStatus'
          ),

        setConnectionMethod: (method) =>
          set({ connectionMethod: method }, false, 'setConnectionMethod'),

        setLocalPeerId: (peerId) =>
          set({ localPeerId: peerId }, false, 'setLocalPeerId'),

        // === Peer Management ===

        addPeer: (peer) =>
          set(
            (state) => {
              // Avoid duplicates
              const exists = state.peers.some((p) => p.peerId === peer.peerId);
              if (exists) {
                return {
                  peers: state.peers.map((p) =>
                    p.peerId === peer.peerId
                      ? { ...p, ...peer, lastSeen: Date.now() }
                      : p
                  ),
                };
              }
              return {
                peers: [...state.peers, { ...peer, lastSeen: Date.now() }],
                status: 'connected',
              };
            },
            false,
            'addPeer'
          ),

        removePeer: (peerId) =>
          set(
            (state) => {
              const newPeers = state.peers.filter((p) => p.peerId !== peerId);
              return {
                peers: newPeers,
                status: newPeers.length === 0 ? 'disconnected' : state.status,
              };
            },
            false,
            'removePeer'
          ),

        updatePeer: (peerId, updates) =>
          set(
            (state) => ({
              peers: state.peers.map((p) =>
                p.peerId === peerId
                  ? { ...p, ...updates, lastSeen: Date.now() }
                  : p
              ),
            }),
            false,
            'updatePeer'
          ),

        clearPeers: () =>
          set(
            {
              peers: [],
              status: 'disconnected',
              connectedAt: null,
            },
            false,
            'clearPeers'
          ),

        // === Configuration ===

        setConfig: (config) =>
          set(
            (state) => ({
              config: { ...state.config, ...config },
            }),
            false,
            'setConfig'
          ),

        setTopologyMode: (mode) =>
          set({ topologyMode: mode }, false, 'setTopologyMode'),

        setFullMeshThreshold: (threshold) =>
          set(
            (state) => ({
              config: { ...state.config, fullMeshThreshold: threshold },
            }),
            false,
            'setFullMeshThreshold'
          ),

        // === Statistics ===

        incrementMessagesRelayed: () =>
          set(
            (state) => ({
              messagesRelayed: state.messagesRelayed + 1,
            }),
            false,
            'incrementMessagesRelayed'
          ),

        addBytesTransferred: (bytes) =>
          set(
            (state) => ({
              bytesTransferred: state.bytesTransferred + bytes,
            }),
            false,
            'addBytesTransferred'
          ),

        // === Computed Helpers ===

        getPeerCount: () => get().peers.length,

        getTopologyStats: () => {
          const state = get();
          const peerCount = state.peers.length;
          const threshold = state.config.fullMeshThreshold;

          // Full mesh: n*(n-1)/2 connections
          // Hub-spoke: n connections (you to hub, or hub to all)
          const fullMeshConnections = (peerCount * (peerCount - 1)) / 2;
          const hubSpokeConnections = peerCount;

          const useHubSpoke =
            state.topologyMode === 'hub-spoke' ||
            (state.topologyMode === 'auto' && peerCount > threshold);

          const currentConnections = useHubSpoke
            ? hubSpokeConnections
            : fullMeshConnections;

          return {
            currentConnections,
            maxConnections: fullMeshConnections,
            estimatedLatency: useHubSpoke ? 100 : 50, // ms
            batteryImpact:
              currentConnections > 50
                ? 'high'
                : currentConnections > 20
                  ? 'medium'
                  : 'low',
          };
        },

        shouldUseHubSpoke: () => {
          const state = get();
          if (state.topologyMode === 'full-mesh') return false;
          if (state.topologyMode === 'hub-spoke') return true;
          // Auto mode
          return state.peers.length > state.config.fullMeshThreshold;
        },

        // === Reset ===

        reset: () => set(initialState, false, 'reset'),
      }),
      {
        name: 'bitchat-mesh-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist configuration, not runtime state
          config: state.config,
          topologyMode: state.topologyMode,
          // Persist stats
          messagesRelayed: state.messagesRelayed,
          bytesTransferred: state.bytesTransferred,
        }),
      }
    ),
    {
      name: 'bitchat-mesh-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/** Hook to get mesh connection status */
export const useMeshStatus = () => useMeshStore((state) => state.status);

/** Hook to get all mesh peers */
export const useMeshPeers = () => useMeshStore((state) => state.peers);

/** Hook to get mesh peer count */
export const useMeshPeerCount = () => useMeshStore((state) => state.peers.length);

/** Hook to get mesh configuration */
export const useMeshConfig = () => useMeshStore((state) => state.config);

/** Hook to get mesh topology information */
export const useMeshTopology = () =>
  useMeshStore((state) => ({
    mode: state.topologyMode,
    threshold: state.config.fullMeshThreshold,
    shouldUseHubSpoke: state.shouldUseHubSpoke(),
    stats: state.getTopologyStats(),
  }));

// ============================================================================
// Action Hooks
// ============================================================================

/** Hook to get mesh store actions */
export const useMeshActions = () =>
  useMeshStore((state) => ({
    setStatus: state.setStatus,
    addPeer: state.addPeer,
    removePeer: state.removePeer,
    setTopologyMode: state.setTopologyMode,
    setFullMeshThreshold: state.setFullMeshThreshold,
    reset: state.reset,
  }));

// ============================================================================
// Standalone Selectors
// ============================================================================

/** Get current mesh status (non-reactive) */
export const getMeshStatus = (): MeshStatus => useMeshStore.getState().status;

/** Get all mesh peers (non-reactive) */
export const getMeshPeers = (): MeshPeer[] => useMeshStore.getState().peers;

/** Get mesh peer count (non-reactive) */
export const getMeshPeerCount = (): number => useMeshStore.getState().peers.length;

/** Get a specific peer by ID (non-reactive) */
export const getMeshPeer = (peerId: string): MeshPeer | undefined =>
  useMeshStore.getState().peers.find((p) => p.peerId === peerId);

/** Check if connected to mesh (non-reactive) */
export const isMeshConnected = (): boolean =>
  useMeshStore.getState().status === 'connected';

export default useMeshStore;
