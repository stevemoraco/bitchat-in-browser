/**
 * Messages Store - Message state management
 *
 * Manages chat messages organized by channel:
 * - Message storage in Map structure
 * - CRUD operations for messages
 * - Read status tracking
 * - Channel-specific selectors
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { Message, MessagesActions, MessageStatus } from './types';

// ============================================================================
// Types
// ============================================================================

interface MessagesState {
  /** Messages organized by channel ID */
  messages: Record<string, Message[]>;
  /** Maximum messages to keep per channel */
  maxMessagesPerChannel: number;
}

interface MessagesStore extends MessagesState, MessagesActions {}

// ============================================================================
// Initial State
// ============================================================================

const initialState: MessagesState = {
  messages: {},
  maxMessagesPerChannel: 1000,
};

// ============================================================================
// Store
// ============================================================================

export const useMessagesStore = create<MessagesStore>()(
  devtools(
    persist(
      (set, _get) => ({
        ...initialState,

        /**
         * Add a message to a channel
         */
        addMessage: (message: Message) => {
          set(
            (state) => {
              const channelMessages = state.messages[message.channelId] || [];

              // Check for duplicate
              if (channelMessages.some((m) => m.id === message.id)) {
                return state;
              }

              // Add message and sort by timestamp
              const newMessages = [...channelMessages, message].sort(
                (a, b) => a.timestamp - b.timestamp
              );

              // Trim to max messages
              const trimmed =
                newMessages.length > state.maxMessagesPerChannel
                  ? newMessages.slice(-state.maxMessagesPerChannel)
                  : newMessages;

              return {
                messages: {
                  ...state.messages,
                  [message.channelId]: trimmed,
                },
              };
            },
            false,
            'addMessage'
          );
        },

        /**
         * Remove a message from a channel
         */
        removeMessage: (channelId: string, messageId: string) => {
          set(
            (state) => {
              const channelMessages = state.messages[channelId];
              if (!channelMessages) return state;

              return {
                messages: {
                  ...state.messages,
                  [channelId]: channelMessages.filter((m) => m.id !== messageId),
                },
              };
            },
            false,
            'removeMessage'
          );
        },

        /**
         * Update a message's status
         */
        updateMessageStatus: (
          channelId: string,
          messageId: string,
          status: MessageStatus
        ) => {
          set(
            (state) => {
              const channelMessages = state.messages[channelId];
              if (!channelMessages) return state;

              return {
                messages: {
                  ...state.messages,
                  [channelId]: channelMessages.map((m) =>
                    m.id === messageId ? { ...m, status } : m
                  ),
                },
              };
            },
            false,
            'updateMessageStatus'
          );
        },

        /**
         * Mark a message as read
         */
        markAsRead: (channelId: string, messageId: string) => {
          set(
            (state) => {
              const channelMessages = state.messages[channelId];
              if (!channelMessages) return state;

              return {
                messages: {
                  ...state.messages,
                  [channelId]: channelMessages.map((m) =>
                    m.id === messageId ? { ...m, isRead: true } : m
                  ),
                },
              };
            },
            false,
            'markAsRead'
          );
        },

        /**
         * Mark all messages in a channel as read
         */
        markAllAsRead: (channelId: string) => {
          set(
            (state) => {
              const channelMessages = state.messages[channelId];
              if (!channelMessages) return state;

              return {
                messages: {
                  ...state.messages,
                  [channelId]: channelMessages.map((m) => ({ ...m, isRead: true })),
                },
              };
            },
            false,
            'markAllAsRead'
          );
        },

        /**
         * Clear all messages in a channel
         */
        clearChannel: (channelId: string) => {
          set(
            (state) => {
              const { [channelId]: _, ...rest } = state.messages;
              return { messages: rest };
            },
            false,
            'clearChannel'
          );
        },

        /**
         * Clear all messages from all channels
         */
        clearAll: () => {
          set({ messages: {} }, false, 'clearAll');
        },
      }),
      {
        name: 'bitchat-messages',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          messages: state.messages,
        }),
      }
    ),
    {
      name: 'bitchat-messages-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get messages for a specific channel
 */
export const getMessagesForChannel = (channelId: string): Message[] => {
  return useMessagesStore.getState().messages[channelId] || [];
};

/**
 * Hook to get messages for a channel
 */
export const useChannelMessages = (channelId: string): Message[] => {
  return useMessagesStore((state) => state.messages[channelId] || []);
};

/**
 * Get unread count for a channel
 */
export const getUnreadCount = (channelId: string): number => {
  const messages = useMessagesStore.getState().messages[channelId] || [];
  return messages.filter((m) => !m.isRead && !m.isOwn).length;
};

/**
 * Hook to get unread count for a channel
 */
export const useUnreadCount = (channelId: string): number => {
  return useMessagesStore((state) => {
    const messages = state.messages[channelId] || [];
    return messages.filter((m) => !m.isRead && !m.isOwn).length;
  });
};

/**
 * Get the last message for a channel
 */
export const getLastMessage = (channelId: string): Message | undefined => {
  const messages = useMessagesStore.getState().messages[channelId] || [];
  return messages[messages.length - 1];
};

/**
 * Hook to get the last message for a channel
 */
export const useLastMessage = (channelId: string): Message | undefined => {
  return useMessagesStore((state) => {
    const messages = state.messages[channelId] || [];
    return messages[messages.length - 1];
  });
};

/**
 * Get all channel IDs that have messages
 */
export const getChannelIdsWithMessages = (): string[] => {
  return Object.keys(useMessagesStore.getState().messages);
};

/**
 * Get total unread count across all channels
 */
export const getTotalUnreadCount = (): number => {
  const allMessages = useMessagesStore.getState().messages;
  return Object.values(allMessages).reduce((total, messages) => {
    return total + messages.filter((m) => !m.isRead && !m.isOwn).length;
  }, 0);
};

/**
 * Hook to get total unread count
 */
export const useTotalUnreadCount = (): number => {
  return useMessagesStore((state) => {
    return Object.values(state.messages).reduce((total, messages) => {
      return total + messages.filter((m) => !m.isRead && !m.isOwn).length;
    }, 0);
  });
};

/**
 * Search messages across all channels
 */
export const searchMessages = (query: string): Message[] => {
  const allMessages = useMessagesStore.getState().messages;
  const lowerQuery = query.toLowerCase();

  return Object.values(allMessages)
    .flat()
    .filter(
      (m) =>
        m.content.toLowerCase().includes(lowerQuery) ||
        m.senderNickname.toLowerCase().includes(lowerQuery)
    )
    .sort((a, b) => b.timestamp - a.timestamp);
};

/**
 * Get messages mentioning a specific fingerprint
 */
export const getMessagesWithMention = (fingerprint: string): Message[] => {
  const allMessages = useMessagesStore.getState().messages;

  return Object.values(allMessages)
    .flat()
    .filter((m) => m.mentions?.includes(fingerprint))
    .sort((a, b) => b.timestamp - a.timestamp);
};
