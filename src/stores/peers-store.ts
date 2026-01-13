/**
 * Peers Store - Peer state management
 *
 * Manages peer/contact information:
 * - Peer discovery and tracking
 * - Online status management
 * - Trust and block lists
 * - Peer metadata (nickname, avatar, etc.)
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { Peer, PeersActions, PeerStatus, PeerSource } from './types';

// ============================================================================
// Types
// ============================================================================

interface PeersState {
  /** Peers indexed by fingerprint */
  peers: Record<string, Peer>;
}

interface PeersStore extends PeersState, PeersActions {}

// ============================================================================
// Initial State
// ============================================================================

const initialState: PeersState = {
  peers: {},
};

// ============================================================================
// Store
// ============================================================================

export const usePeersStore = create<PeersStore>()(
  devtools(
    persist(
      (set, _get) => ({
        ...initialState,

        /**
         * Add a new peer
         */
        addPeer: (peer: Peer) => {
          set(
            (state) => {
              // If peer exists, update instead of overwrite
              const existingPeer = state.peers[peer.fingerprint];
              if (existingPeer) {
                return {
                  peers: {
                    ...state.peers,
                    [peer.fingerprint]: {
                      ...existingPeer,
                      ...peer,
                      // Preserve trust/block status
                      isTrusted: existingPeer.isTrusted,
                      isBlocked: existingPeer.isBlocked,
                    },
                  },
                };
              }

              return {
                peers: {
                  ...state.peers,
                  [peer.fingerprint]: peer,
                },
              };
            },
            false,
            'addPeer'
          );
        },

        /**
         * Update a peer's properties
         */
        updatePeer: (fingerprint: string, updates: Partial<Peer>) => {
          set(
            (state) => {
              if (!state.peers[fingerprint]) {
                console.warn(`Peer ${fingerprint} not found`);
                return state;
              }

              return {
                peers: {
                  ...state.peers,
                  [fingerprint]: {
                    ...state.peers[fingerprint],
                    ...updates,
                  },
                },
              };
            },
            false,
            'updatePeer'
          );
        },

        /**
         * Remove a peer
         */
        removePeer: (fingerprint: string) => {
          set(
            (state) => {
              const { [fingerprint]: _, ...rest } = state.peers;
              return { peers: rest };
            },
            false,
            'removePeer'
          );
        },

        /**
         * Set peer trusted status
         */
        setTrusted: (fingerprint: string, isTrusted: boolean) => {
          set(
            (state) => {
              if (!state.peers[fingerprint]) return state;

              return {
                peers: {
                  ...state.peers,
                  [fingerprint]: {
                    ...state.peers[fingerprint],
                    isTrusted,
                    // Unblock if trusting
                    isBlocked: isTrusted ? false : state.peers[fingerprint].isBlocked,
                  },
                },
              };
            },
            false,
            'setTrusted'
          );
        },

        /**
         * Set peer blocked status
         */
        setBlocked: (fingerprint: string, isBlocked: boolean) => {
          set(
            (state) => {
              if (!state.peers[fingerprint]) return state;

              return {
                peers: {
                  ...state.peers,
                  [fingerprint]: {
                    ...state.peers[fingerprint],
                    isBlocked,
                    // Untrust if blocking
                    isTrusted: isBlocked ? false : state.peers[fingerprint].isTrusted,
                  },
                },
              };
            },
            false,
            'setBlocked'
          );
        },

        /**
         * Update peer's online status
         */
        updateStatus: (fingerprint: string, status: PeerStatus) => {
          set(
            (state) => {
              if (!state.peers[fingerprint]) return state;

              return {
                peers: {
                  ...state.peers,
                  [fingerprint]: {
                    ...state.peers[fingerprint],
                    status,
                    lastSeenAt: status === 'online' ? Date.now() : state.peers[fingerprint].lastSeenAt,
                  },
                },
              };
            },
            false,
            'updateStatus'
          );
        },

        /**
         * Clear all peers
         */
        clearAll: () => {
          set({ peers: {} }, false, 'clearAll');
        },
      }),
      {
        name: 'bitchat-peers',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          peers: state.peers,
        }),
      }
    ),
    {
      name: 'bitchat-peers-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get all peers as an array
 */
export const getAllPeers = (): Peer[] => {
  return Object.values(usePeersStore.getState().peers);
};

/**
 * Hook to get all peers
 */
export const usePeers = (): Peer[] => {
  return usePeersStore((state) => Object.values(state.peers));
};

/**
 * Get a peer by fingerprint
 */
export const getPeer = (fingerprint: string): Peer | undefined => {
  return usePeersStore.getState().peers[fingerprint];
};

/**
 * Hook to get a peer by fingerprint
 */
export const usePeer = (fingerprint: string): Peer | undefined => {
  return usePeersStore((state) => state.peers[fingerprint]);
};

/**
 * Get online peers
 */
export const getOnlinePeers = (): Peer[] => {
  return Object.values(usePeersStore.getState().peers).filter(
    (p) => p.status === 'online'
  );
};

/**
 * Hook to get online peers
 */
export const useOnlinePeers = (): Peer[] => {
  return usePeersStore((state) =>
    Object.values(state.peers).filter((p) => p.status === 'online')
  );
};

/**
 * Get trusted peers
 */
export const getTrustedPeers = (): Peer[] => {
  return Object.values(usePeersStore.getState().peers).filter(
    (p) => p.isTrusted
  );
};

/**
 * Hook to get trusted peers
 */
export const useTrustedPeers = (): Peer[] => {
  return usePeersStore((state) =>
    Object.values(state.peers).filter((p) => p.isTrusted)
  );
};

/**
 * Get blocked peers
 */
export const getBlockedPeers = (): Peer[] => {
  return Object.values(usePeersStore.getState().peers).filter(
    (p) => p.isBlocked
  );
};

/**
 * Hook to get blocked peers
 */
export const useBlockedPeers = (): Peer[] => {
  return usePeersStore((state) =>
    Object.values(state.peers).filter((p) => p.isBlocked)
  );
};

/**
 * Get peers by source
 */
export const getPeersBySource = (source: PeerSource): Peer[] => {
  return Object.values(usePeersStore.getState().peers).filter(
    (p) => p.source === source
  );
};

/**
 * Hook to get peers by source
 */
export const usePeersBySource = (source: PeerSource): Peer[] => {
  return usePeersStore((state) =>
    Object.values(state.peers).filter((p) => p.source === source)
  );
};

/**
 * Check if a peer exists
 */
export const peerExists = (fingerprint: string): boolean => {
  return fingerprint in usePeersStore.getState().peers;
};

/**
 * Check if a peer is blocked
 */
export const isPeerBlocked = (fingerprint: string): boolean => {
  return usePeersStore.getState().peers[fingerprint]?.isBlocked ?? false;
};

/**
 * Get peer count
 */
export const getPeerCount = (): number => {
  return Object.keys(usePeersStore.getState().peers).length;
};

/**
 * Hook to get peer count
 */
export const usePeerCount = (): number => {
  return usePeersStore((state) => Object.keys(state.peers).length);
};

/**
 * Get online peer count
 */
export const getOnlinePeerCount = (): number => {
  return Object.values(usePeersStore.getState().peers).filter(
    (p) => p.status === 'online'
  ).length;
};

/**
 * Hook to get online peer count
 */
export const useOnlinePeerCount = (): number => {
  return usePeersStore((state) =>
    Object.values(state.peers).filter((p) => p.status === 'online').length
  );
};

/**
 * Search peers by nickname
 */
export const searchPeers = (query: string): Peer[] => {
  const lowerQuery = query.toLowerCase();
  return Object.values(usePeersStore.getState().peers).filter(
    (p) =>
      p.nickname.toLowerCase().includes(lowerQuery) ||
      p.fingerprint.toLowerCase().includes(lowerQuery) ||
      p.nip05?.toLowerCase().includes(lowerQuery)
  );
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create a new peer object with defaults
 */
export function createPeer(
  partial: Partial<Peer> & { fingerprint: string; publicKey: string }
): Peer {
  return {
    fingerprint: partial.fingerprint,
    publicKey: partial.publicKey,
    nickname: partial.nickname ?? `anon-${partial.fingerprint.slice(0, 6)}`,
    status: partial.status ?? 'offline',
    lastSeenAt: partial.lastSeenAt ?? Date.now(),
    source: partial.source ?? 'nostr',
    isTrusted: partial.isTrusted ?? false,
    isBlocked: partial.isBlocked ?? false,
    notes: partial.notes,
    avatar: partial.avatar,
    nip05: partial.nip05,
  };
}

/**
 * Update all peers to offline status (e.g., on disconnect)
 */
export function setAllPeersOffline(): void {
  const state = usePeersStore.getState();
  const updates: Record<string, Peer> = {};

  for (const [fingerprint, peer] of Object.entries(state.peers)) {
    if (peer.status === 'online') {
      updates[fingerprint] = { ...peer, status: 'offline' };
    }
  }

  if (Object.keys(updates).length > 0) {
    usePeersStore.setState({
      peers: { ...state.peers, ...updates },
    });
  }
}
