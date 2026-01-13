/**
 * ChatView - Main chat container component
 *
 * Orchestrates all chat components:
 * - Message list with virtualized scrolling
 * - Message input area
 * - Channel/conversation header
 * - Scroll to bottom button
 *
 * Responsive behavior:
 * - Mobile: Full screen overlay with swipe-back
 * - Tablet: Constrained width, split view
 * - Desktop: Three-column layout integration
 */

import { FunctionComponent } from 'preact';
import { useState, useCallback, useRef, useMemo } from 'preact/hooks';
import type { Message, Channel, Peer } from '../../stores/types';
import { useChannelMessages, useMessagesStore } from '../../stores/messages-store';
import { useChannel, useChannelsStore } from '../../stores/channels-store';
import { usePeer } from '../../stores/peers-store';
import { useAppStore } from '../../stores/app-store';
import { ChatHeader } from './ChatHeader';
import { MessageList, ScrollToBottomButton } from './MessageList';
import { MessageInput } from './MessageInput';
import type { ReplyMessage } from './MessageBubble';
import { useIsMobile, useChatLayout } from '../../hooks/useMediaQuery';
import { useSwipeBack } from '../../hooks/useTouchGestures';

// ============================================================================
// Types
// ============================================================================

export interface ChatViewProps {
  /** Channel ID to display */
  channelId: string;
  /** Callback when back button is pressed (mobile) */
  onBack?: () => void;
  /** Callback when info button is pressed */
  onInfo?: () => void;
  /** Whether to show the back button */
  showBack?: boolean;
  /** Custom send handler (for testing or custom logic) */
  onSendMessage?: (content: string, replyTo?: string) => void;
  /** Custom load more handler */
  onLoadMore?: () => void;
  /** Whether more messages are available */
  hasMoreMessages?: boolean;
  /** Whether more messages are loading */
  isLoadingMore?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const ChatView: FunctionComponent<ChatViewProps> = ({
  channelId,
  onBack,
  onInfo,
  showBack = false,
  onSendMessage,
  onLoadMore,
  hasMoreMessages = false,
  isLoadingMore = false,
}) => {
  // Store hooks
  const channel = useChannel(channelId);
  const messages = useChannelMessages(channelId);
  const isOnline = useAppStore((state) => state.isOnline);

  // Responsive hooks
  const isMobile = useIsMobile();
  const chatLayout = useChatLayout();

  // Swipe back gesture for mobile
  const { ref: swipeRef, state: swipeState, canSwipeBack } = useSwipeBack(
    () => onBack?.(),
    { enabled: isMobile && !!onBack }
  );

  // Get peer for DM channels
  const peer = usePeer(channel?.dmPeerFingerprint ?? '');
  const isPeerOnline = peer?.status === 'online';

  // Local state
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // typingPeer would be set via WebSocket/Nostr events in production
  const typingPeer: string | null = null;
  const messageListRef = useRef<HTMLDivElement>(null);

  // Convert Message to ReplyMessage for MessageInput
  const replyMessage: ReplyMessage | null = replyTo
    ? {
        id: replyTo.id,
        senderNickname: replyTo.senderNickname,
        content: replyTo.content,
      }
    : null;

  // Find message by ID (for reply previews)
  const findMessageById = useCallback(
    (id: string): Message | undefined => {
      return messages.find((m) => m.id === id);
    },
    [messages]
  );

  // Count unread messages
  const unreadCount = useMemo(() => {
    return messages.filter((m) => !m.isRead && !m.isOwn).length;
  }, [messages]);

  // Handle reply click
  const handleReplyClick = useCallback((message: Message) => {
    setReplyTo(message);
  }, []);

  // Handle cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // Handle send message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!channel) return;

      setIsSending(true);

      try {
        if (onSendMessage) {
          // Use custom handler
          onSendMessage(content, replyTo?.id);
        } else {
          // Default behavior - add to store
          const addMessage = useMessagesStore.getState().addMessage;
          const newMessage: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            channelId,
            senderFingerprint: 'local', // Would be actual fingerprint
            senderNickname: 'You', // Would be from identity store
            content,
            timestamp: Date.now(),
            type: 'text',
            status: 'pending',
            isOwn: true,
            isRead: true,
            mentions: replyTo ? [replyTo.id] : undefined,
          };
          addMessage(newMessage);

          // Update channel's last message timestamp
          const updateChannel = useChannelsStore.getState().updateChannel;
          updateChannel(channelId, { lastMessageAt: Date.now() });

          // Simulate sending (in real app, this would be Nostr publish)
          setTimeout(() => {
            const updateStatus = useMessagesStore.getState().updateMessageStatus;
            updateStatus(channelId, newMessage.id, 'sent');
          }, 500);
        }

        // Clear reply after sending
        setReplyTo(null);
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setIsSending(false);
      }
    },
    [channel, channelId, replyTo, onSendMessage]
  );

  // Handle scroll to bottom
  const handleScrollToBottom = useCallback(() => {
    const container = messageListRef.current?.querySelector('[data-message-list]');
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
    setShowScrollButton(false);
  }, []);

  // Handle message context menu
  const handleMessageContextMenu = useCallback((message: Message) => {
    // TODO: Implement context menu with options like reply, copy, delete
    console.log('Context menu for message:', message.id);
    setReplyTo(message);
  }, []);

  // No channel state
  if (!channel) {
    return (
      <div class="flex flex-col h-full bg-background">
        <div class="flex-1 flex items-center justify-center">
          <div class="empty-state">
            <h3 class="empty-state-title">No channel selected</h3>
            <p class="empty-state-description">
              Select a channel from the sidebar to start chatting.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Determine container classes based on layout
  const containerClasses = useMemo(() => {
    if (chatLayout === 'mobile') {
      return 'chat-view-mobile';
    }
    if (chatLayout === 'split') {
      return 'chat-view-tablet';
    }
    return 'chat-view-desktop';
  }, [chatLayout]);

  // Calculate transform for swipe gesture
  const swipeTransform = useMemo(() => {
    if (!swipeState.isSwiping || !canSwipeBack) return undefined;
    return `translateX(${swipeState.distance * 0.3}px)`;
  }, [swipeState.isSwiping, swipeState.distance, canSwipeBack]);

  return (
    <div
      ref={isMobile ? swipeRef : undefined}
      class={`flex flex-col h-full bg-background ${containerClasses} ${canSwipeBack ? 'can-swipe-back' : ''}`}
      style={{
        transform: swipeTransform,
        transition: swipeState.isSwiping ? 'none' : 'transform 0.2s ease-out',
      }}
    >
      {/* Swipe indicator */}
      {canSwipeBack && <div class="swipe-indicator" />}

      {/* Header */}
      <ChatHeader
        channel={channel}
        peer={peer}
        isOnline={channel.type === 'dm' ? isPeerOnline : undefined}
        onBack={onBack}
        onInfo={onInfo}
        showBack={showBack || isMobile}
      />

      {/* Message list container */}
      <div ref={messageListRef} class="flex-1 relative min-h-0 overflow-hidden">
        <MessageList
          messages={messages}
          isLoadingMore={isLoadingMore}
          hasMore={hasMoreMessages}
          onLoadMore={onLoadMore}
          typingPeer={typingPeer}
          onReplyClick={handleReplyClick}
          onMessageContextMenu={handleMessageContextMenu}
          findMessageById={findMessageById}
          showSenders={channel.type !== 'dm'}
          showTimestamps={true}
          showStatus={true}
        />

        {/* Scroll to bottom button */}
        <ScrollToBottomButton
          visible={showScrollButton}
          onClick={handleScrollToBottom}
          unreadCount={unreadCount}
        />
      </div>

      {/* Message input - sticky bottom on mobile */}
      <div class={isMobile ? 'message-input-container' : 'message-input-desktop'}>
        <MessageInput
          onSend={handleSendMessage}
          isOffline={!isOnline}
          replyTo={replyMessage}
          onCancelReply={handleCancelReply}
          isSending={isSending}
          placeholder={
            channel.type === 'dm' && peer
              ? `Message ${peer.nickname}...`
              : `Message #${channel.name}...`
          }
        />
      </div>
    </div>
  );
};

// ============================================================================
// Standalone Chat View (without stores)
// ============================================================================

export interface StandaloneChatViewProps {
  /** Channel data */
  channel: Channel;
  /** Messages to display */
  messages: Message[];
  /** Peer data for DM channels */
  peer?: Peer;
  /** Whether the peer is online */
  isPeerOnline?: boolean;
  /** Whether the user is online */
  isOnline?: boolean;
  /** Callback when back button is pressed */
  onBack?: () => void;
  /** Callback when info button is pressed */
  onInfo?: () => void;
  /** Whether to show the back button */
  showBack?: boolean;
  /** Callback when a message is sent */
  onSendMessage: (content: string, replyToId?: string) => void;
  /** Callback to load more messages */
  onLoadMore?: () => void;
  /** Whether more messages are available */
  hasMoreMessages?: boolean;
  /** Whether more messages are loading */
  isLoadingMore?: boolean;
  /** Typing indicator peer name */
  typingPeer?: string | null;
}

/**
 * Standalone ChatView that doesn't depend on stores
 * Useful for testing and isolated usage
 */
export const StandaloneChatView: FunctionComponent<StandaloneChatViewProps> = ({
  channel,
  messages,
  peer,
  isPeerOnline = false,
  isOnline = true,
  onBack,
  onInfo,
  showBack = false,
  onSendMessage,
  onLoadMore,
  hasMoreMessages = false,
  isLoadingMore = false,
  typingPeer = null,
}) => {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  const replyMessage: ReplyMessage | null = replyTo
    ? {
        id: replyTo.id,
        senderNickname: replyTo.senderNickname,
        content: replyTo.content,
      }
    : null;

  const findMessageById = useCallback(
    (id: string): Message | undefined => {
      return messages.find((m) => m.id === id);
    },
    [messages]
  );

  const unreadCount = useMemo(() => {
    return messages.filter((m) => !m.isRead && !m.isOwn).length;
  }, [messages]);

  const handleReplyClick = useCallback((message: Message) => {
    setReplyTo(message);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string) => {
      setIsSending(true);
      try {
        onSendMessage(content, replyTo?.id);
        setReplyTo(null);
      } finally {
        setIsSending(false);
      }
    },
    [onSendMessage, replyTo]
  );

  const handleScrollToBottom = useCallback(() => {
    const container = messageListRef.current?.querySelector('.overflow-y-auto');
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
    setShowScrollButton(false);
  }, []);

  const handleMessageContextMenu = useCallback((message: Message) => {
    setReplyTo(message);
  }, []);

  return (
    <div class="flex flex-col h-full bg-background">
      <ChatHeader
        channel={channel}
        peer={peer}
        isOnline={channel.type === 'dm' ? isPeerOnline : undefined}
        onBack={onBack}
        onInfo={onInfo}
        showBack={showBack}
      />

      <div ref={messageListRef} class="flex-1 relative min-h-0 overflow-hidden">
        <MessageList
          messages={messages}
          isLoadingMore={isLoadingMore}
          hasMore={hasMoreMessages}
          onLoadMore={onLoadMore}
          typingPeer={typingPeer}
          onReplyClick={handleReplyClick}
          onMessageContextMenu={handleMessageContextMenu}
          findMessageById={findMessageById}
          showSenders={channel.type !== 'dm'}
          showTimestamps={true}
          showStatus={true}
        />

        <ScrollToBottomButton
          visible={showScrollButton}
          onClick={handleScrollToBottom}
          unreadCount={unreadCount}
        />
      </div>

      <MessageInput
        onSend={handleSendMessage}
        isOffline={!isOnline}
        replyTo={replyMessage}
        onCancelReply={handleCancelReply}
        isSending={isSending}
        placeholder={
          channel.type === 'dm' && peer
            ? `Message ${peer.nickname}...`
            : `Message #${channel.name}...`
        }
      />
    </div>
  );
};

export default ChatView;
