/**
 * MessageList - Virtualized message list component
 *
 * Features:
 * - Virtualized list for performance
 * - Group messages by date
 * - Load more on scroll up
 * - Empty state
 * - Auto-scroll to bottom on new messages
 */

import { FunctionComponent } from 'preact';
import { useState, useRef, useEffect, useMemo, useCallback } from 'preact/hooks';
import type { Message } from '../../stores/types';
import { MessageBubble, DateSeparator, TypingIndicator, ReplyMessage } from './MessageBubble';

// ============================================================================
// Types
// ============================================================================

export interface MessageListProps {
  /** Messages to display */
  messages: Message[];
  /** Whether more messages are being loaded */
  isLoadingMore?: boolean;
  /** Whether there are more messages to load */
  hasMore?: boolean;
  /** Callback when user scrolls to top to load more */
  onLoadMore?: () => void;
  /** Typing indicator for a peer */
  typingPeer?: string | null;
  /** Callback when clicking reply on a message */
  onReplyClick?: (message: Message) => void;
  /** Callback for message context menu */
  onMessageContextMenu?: (message: Message) => void;
  /** Function to find a message by ID (for reply previews) */
  findMessageById?: (id: string) => Message | undefined;
  /** Whether to show sender names (for group chats) */
  showSenders?: boolean;
  /** Whether to show timestamps */
  showTimestamps?: boolean;
  /** Whether to show message status */
  showStatus?: boolean;
}

// ============================================================================
// Icons
// ============================================================================

const ChatBubbleIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.5"
    stroke="currentColor"
    class={className}
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
    />
  </svg>
);

const LoadingSpinner: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      class="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="4"
    />
    <path
      class="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format date for grouping
 */
const formatDateGroup = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  // Same day
  if (date.toDateString() === now.toDateString()) {
    return 'Today';
  }

  // Yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  // This year
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  // Different year
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

/**
 * Group messages by date
 */
interface MessageGroup {
  date: string;
  messages: Message[];
}

const groupMessagesByDate = (messages: Message[]): MessageGroup[] => {
  const groups: MessageGroup[] = [];
  let currentGroup: MessageGroup | null = null;

  for (const message of messages) {
    const dateStr = formatDateGroup(message.timestamp);

    if (!currentGroup || currentGroup.date !== dateStr) {
      currentGroup = { date: dateStr, messages: [] };
      groups.push(currentGroup);
    }

    currentGroup.messages.push(message);
  }

  return groups;
};

// ============================================================================
// Constants
// ============================================================================

const SCROLL_THRESHOLD = 100; // px from bottom to consider "at bottom"
const LOAD_MORE_THRESHOLD = 50; // px from top to trigger load more

// ============================================================================
// Component
// ============================================================================

export const MessageList: FunctionComponent<MessageListProps> = ({
  messages,
  isLoadingMore = false,
  hasMore = false,
  onLoadMore,
  typingPeer = null,
  onReplyClick,
  onMessageContextMenu,
  findMessageById,
  showSenders = true,
  showTimestamps = true,
  showStatus = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [userScrolled, setUserScrolled] = useState(false);
  const prevMessageCountRef = useRef(messages.length);

  // Group messages by date
  const groupedMessages = useMemo(
    () => groupMessagesByDate(messages),
    [messages]
  );

  // Check if at bottom
  const checkIfAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollHeight, scrollTop, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const atBottom = checkIfAtBottom();
    setIsAtBottom(atBottom);

    // Detect user scrolling up
    if (!atBottom) {
      setUserScrolled(true);
    } else {
      setUserScrolled(false);
    }

    // Load more when near top
    if (hasMore && onLoadMore && !isLoadingMore) {
      if (container.scrollTop < LOAD_MORE_THRESHOLD) {
        onLoadMore();
      }
    }
  }, [checkIfAtBottom, hasMore, onLoadMore, isLoadingMore]);

  // Auto-scroll on new messages (only if user was at bottom)
  useEffect(() => {
    const newMessageCount = messages.length;
    const prevCount = prevMessageCountRef.current;

    if (newMessageCount > prevCount) {
      // New messages arrived
      if (!userScrolled || isAtBottom) {
        // Auto-scroll for new messages
        scrollToBottom();
      }
    }

    prevMessageCountRef.current = newMessageCount;
  }, [messages.length, userScrolled, isAtBottom, scrollToBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    scrollToBottom('auto');
  }, [scrollToBottom]);

  // Get reply message for a message
  const getReplyTo = useCallback(
    (message: Message): ReplyMessage | undefined => {
      if (!message.mentions?.length || !findMessageById) return undefined;

      // Check if this message is replying to another
      // This is a simplified approach - in real app, would need proper reply tracking
      const replyToId = message.mentions[0];
      if (!replyToId) return undefined;

      const replyToMessage = findMessageById(replyToId);

      if (replyToMessage) {
        return {
          id: replyToMessage.id,
          senderNickname: replyToMessage.senderNickname,
          content: replyToMessage.content,
        };
      }

      return undefined;
    },
    [findMessageById]
  );

  // Empty state
  if (messages.length === 0) {
    return (
      <div class="flex-1 flex items-center justify-center p-4">
        <div class="empty-state">
          <ChatBubbleIcon class="empty-state-icon" />
          <h3 class="empty-state-title">No messages yet</h3>
          <p class="empty-state-description">
            Start the conversation by sending a message below.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      class="flex-1 overflow-y-auto px-3 py-2"
      onScroll={handleScroll}
    >
      {/* Loading more indicator */}
      {isLoadingMore && (
        <div class="flex justify-center py-4">
          <LoadingSpinner class="w-5 h-5 text-primary" />
        </div>
      )}

      {/* Load more hint */}
      {hasMore && !isLoadingMore && (
        <div class="flex justify-center py-2">
          <button
            type="button"
            onClick={onLoadMore}
            class="text-terminal-xs text-muted hover:text-primary transition-colors font-mono"
          >
            Load earlier messages
          </button>
        </div>
      )}

      {/* Message groups */}
      {groupedMessages.map((group) => (
        <div key={group.date}>
          {/* Date separator */}
          <DateSeparator date={group.date} />

          {/* Messages in group */}
          {group.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              replyTo={getReplyTo(message)}
              showSender={showSenders && !message.isOwn}
              showTimestamp={showTimestamps}
              showStatus={showStatus}
              onReplyClick={
                onReplyClick
                  ? () => onReplyClick(message)
                  : undefined
              }
              onContextMenu={onMessageContextMenu}
            />
          ))}
        </div>
      ))}

      {/* Typing indicator */}
      {typingPeer && (
        <TypingIndicator nickname={typingPeer} />
      )}
    </div>
  );
};

// ============================================================================
// Scroll to Bottom Button
// ============================================================================

export interface ScrollToBottomButtonProps {
  /** Whether the button should be visible */
  visible: boolean;
  /** Callback when clicked */
  onClick: () => void;
  /** Number of unread messages */
  unreadCount?: number;
}

const ArrowDownIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
      clip-rule="evenodd"
    />
  </svg>
);

export const ScrollToBottomButton: FunctionComponent<ScrollToBottomButtonProps> = ({
  visible,
  onClick,
  unreadCount = 0,
}) => {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      class="absolute bottom-4 right-4 w-10 h-10 flex items-center justify-center bg-surface border border-primary rounded-full shadow-terminal hover:bg-primary hover:text-background transition-all animate-terminal-fade-in"
      aria-label={
        unreadCount > 0
          ? `Scroll to bottom (${unreadCount} new messages)`
          : 'Scroll to bottom'
      }
    >
      <ArrowDownIcon class="w-5 h-5" />

      {/* Unread count badge */}
      {unreadCount > 0 && (
        <span class="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-primary text-background text-terminal-xs font-bold rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

export default MessageList;
