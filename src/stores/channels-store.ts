/**
 * Channels Store - Channel state management
 *
 * Manages chat channels:
 * - Channel list and active channel
 * - Unread counts per channel
 * - Channel CRUD operations
 * - Pinned/muted status
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { Channel, ChannelsActions, ChannelType } from './types';

// ============================================================================
// Types
// ============================================================================

interface ChannelsState {
  /** List of all channels */
  channels: Channel[];
  /** Currently active channel ID */
  activeChannelId: string | null;
}

interface ChannelsStore extends ChannelsState, ChannelsActions {}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ChannelsState = {
  channels: [],
  activeChannelId: null,
};

// ============================================================================
// Store
// ============================================================================

export const useChannelsStore = create<ChannelsStore>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        /**
         * Add a new channel
         */
        addChannel: (channel: Channel) => {
          set(
            (state) => {
              // Check for duplicate
              if (state.channels.some((c) => c.id === channel.id)) {
                return state;
              }

              return {
                channels: [...state.channels, channel],
              };
            },
            false,
            'addChannel'
          );
        },

        /**
         * Remove a channel
         */
        removeChannel: (channelId: string) => {
          set(
            (state) => {
              const newChannels = state.channels.filter((c) => c.id !== channelId);

              // If we removed the active channel, clear it
              const firstChannel = newChannels[0];
              const newActiveId =
                state.activeChannelId === channelId
                  ? firstChannel
                    ? firstChannel.id
                    : null
                  : state.activeChannelId;

              return {
                channels: newChannels,
                activeChannelId: newActiveId,
              };
            },
            false,
            'removeChannel'
          );
        },

        /**
         * Set the active channel
         */
        setActiveChannel: (channelId: string) => {
          const channel = get().channels.find((c) => c.id === channelId);
          if (!channel) {
            console.warn(`Channel ${channelId} not found`);
            return;
          }

          set({ activeChannelId: channelId }, false, 'setActiveChannel');
        },

        /**
         * Update a channel's properties
         */
        updateChannel: (channelId: string, updates: Partial<Channel>) => {
          set(
            (state) => ({
              channels: state.channels.map((c) =>
                c.id === channelId ? { ...c, ...updates } : c
              ),
            }),
            false,
            'updateChannel'
          );
        },

        /**
         * Increment unread count for a channel
         */
        incrementUnread: (channelId: string) => {
          set(
            (state) => ({
              channels: state.channels.map((c) =>
                c.id === channelId
                  ? { ...c, unreadCount: c.unreadCount + 1 }
                  : c
              ),
            }),
            false,
            'incrementUnread'
          );
        },

        /**
         * Clear unread count for a channel
         */
        clearUnread: (channelId: string) => {
          set(
            (state) => ({
              channels: state.channels.map((c) =>
                c.id === channelId ? { ...c, unreadCount: 0 } : c
              ),
            }),
            false,
            'clearUnread'
          );
        },

        /**
         * Pin or unpin a channel
         */
        pinChannel: (channelId: string, isPinned: boolean) => {
          set(
            (state) => ({
              channels: state.channels.map((c) =>
                c.id === channelId ? { ...c, isPinned } : c
              ),
            }),
            false,
            'pinChannel'
          );
        },

        /**
         * Mute or unmute a channel
         */
        muteChannel: (channelId: string, isMuted: boolean) => {
          set(
            (state) => ({
              channels: state.channels.map((c) =>
                c.id === channelId ? { ...c, isMuted } : c
              ),
            }),
            false,
            'muteChannel'
          );
        },
      }),
      {
        name: 'bitchat-channels',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          channels: state.channels,
          activeChannelId: state.activeChannelId,
        }),
      }
    ),
    {
      name: 'bitchat-channels-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get all channels
 */
export const selectChannels = (state: ChannelsStore) => state.channels;

/**
 * Get active channel ID
 */
export const selectActiveChannelId = (state: ChannelsStore) => state.activeChannelId;

/**
 * Get the active channel
 */
export const getActiveChannel = (): Channel | undefined => {
  const state = useChannelsStore.getState();
  return state.channels.find((c) => c.id === state.activeChannelId);
};

/**
 * Hook to get the active channel
 */
export const useActiveChannel = (): Channel | undefined => useChannelsStore((state) =>
    state.channels.find((c) => c.id === state.activeChannelId)
  );

/**
 * Get a channel by ID
 */
export const getChannelById = (channelId: string): Channel | undefined => useChannelsStore.getState().channels.find((c) => c.id === channelId);

/**
 * Hook to get a channel by ID
 */
export const useChannel = (channelId: string): Channel | undefined => useChannelsStore((state) =>
    state.channels.find((c) => c.id === channelId)
  );

/**
 * Get channels by type
 */
export const getChannelsByType = (type: ChannelType): Channel[] => useChannelsStore.getState().channels.filter((c) => c.type === type);

/**
 * Hook to get channels by type
 */
export const useChannelsByType = (type: ChannelType): Channel[] => useChannelsStore((state) =>
    state.channels.filter((c) => c.type === type)
  );

/**
 * Get sorted channels (pinned first, then by last message)
 */
export const getSortedChannels = (): Channel[] => {
  const channels = useChannelsStore.getState().channels;
  return [...channels].sort((a, b) => {
    // Pinned channels first
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;

    // Then by last message timestamp
    return b.lastMessageAt - a.lastMessageAt;
  });
};

/**
 * Hook to get sorted channels
 */
export const useSortedChannels = (): Channel[] => useChannelsStore((state) =>
    [...state.channels].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.lastMessageAt - a.lastMessageAt;
    })
  );

/**
 * Get total unread count across all channels
 */
export const getTotalUnreadCount = (): number => useChannelsStore
    .getState()
    .channels.reduce((total, c) => total + c.unreadCount, 0);

/**
 * Hook to get total unread count
 */
export const useTotalUnreadCount = (): number => useChannelsStore((state) =>
    state.channels.reduce((total, c) => total + c.unreadCount, 0)
  );

/**
 * Get channels with unread messages
 */
export const getUnreadChannels = (): Channel[] => useChannelsStore
    .getState()
    .channels.filter((c) => c.unreadCount > 0);

/**
 * Hook to get channels with unread messages
 */
export const useUnreadChannels = (): Channel[] => useChannelsStore((state) =>
    state.channels.filter((c) => c.unreadCount > 0)
  );

/**
 * Get DM channel by peer fingerprint
 */
export const getDMChannel = (peerFingerprint: string): Channel | undefined => useChannelsStore
    .getState()
    .channels.find(
      (c) => c.type === 'dm' && c.dmPeerFingerprint === peerFingerprint
    );

/**
 * Hook to get DM channel by peer fingerprint
 */
export const useDMChannel = (peerFingerprint: string): Channel | undefined => useChannelsStore((state) =>
    state.channels.find(
      (c) => c.type === 'dm' && c.dmPeerFingerprint === peerFingerprint
    )
  );

/**
 * Check if a channel exists
 */
export const channelExists = (channelId: string): boolean => useChannelsStore.getState().channels.some((c) => c.id === channelId);

// ============================================================================
// Utilities
// ============================================================================

/**
 * Create a new channel object with defaults
 */
export function createChannel(
  partial: Partial<Channel> & { id: string; name: string; type: ChannelType }
): Channel {
  return {
    id: partial.id,
    name: partial.name,
    type: partial.type,
    geohash: partial.geohash,
    geohashPrecision: partial.geohashPrecision,
    lastMessageAt: partial.lastMessageAt ?? Date.now(),
    unreadCount: partial.unreadCount ?? 0,
    isPinned: partial.isPinned ?? false,
    isMuted: partial.isMuted ?? false,
    dmPeerFingerprint: partial.dmPeerFingerprint,
    description: partial.description,
    createdAt: partial.createdAt ?? Date.now(),
  };
}
