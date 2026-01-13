/**
 * MessageBubble - Individual message display component
 *
 * Features:
 * - Different styles for sent/received messages
 * - Timestamp display
 * - Delivery status indicator (pending/sent/delivered/read/failed)
 * - Sender fingerprint/name
 * - Reply preview if replying to message
 */

import { FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import type { Message, MessageStatus } from '../../stores/types';

// ============================================================================
// Types
// ============================================================================

export interface ReplyMessage {
  id: string;
  senderNickname: string;
  content: string;
}

export interface MessageBubbleProps {
  /** The message to display */
  message: Message;
  /** Reply message preview (if replying) */
  replyTo?: ReplyMessage;
  /** Whether to show the sender name (for group chats) */
  showSender?: boolean;
  /** Whether to show the timestamp */
  showTimestamp?: boolean;
  /** Whether to show message status */
  showStatus?: boolean;
  /** Callback when clicking the reply preview */
  onReplyClick?: (messageId: string) => void;
  /** Callback for long press/right click (context menu) */
  onContextMenu?: (message: Message) => void;
}

// ============================================================================
// Status Icons
// ============================================================================

const PendingIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M8 15A7 7 0 108 1a7 7 0 000 14zm.75-10.25a.75.75 0 00-1.5 0v4c0 .414.336.75.75.75h3a.75.75 0 000-1.5H8.75v-3.25z"
      clip-rule="evenodd"
    />
  </svg>
);

const SentIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z"
      clip-rule="evenodd"
    />
  </svg>
);

const DeliveredIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M12.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-3-3a.75.75 0 011.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 011.04-.207z"
      clip-rule="evenodd"
    />
    <path
      fill-rule="evenodd"
      d="M15.416 3.376a.75.75 0 01.208 1.04l-5 7.5a.75.75 0 01-1.154.114l-.5-.5a.75.75 0 011.06-1.06l.03.03 4.316-6.47a.75.75 0 011.04-.207z"
      clip-rule="evenodd"
      opacity="0.6"
    />
  </svg>
);

const FailedIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 16 16"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M8 15A7 7 0 108 1a7 7 0 000 14zM8 4a.75.75 0 01.75.75v3a.75.75 0 01-1.5 0v-3A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z"
      clip-rule="evenodd"
    />
  </svg>
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp for display
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase();
};

/**
 * Get status icon and styling
 */
const getStatusDisplay = (status: MessageStatus) => {
  switch (status) {
    case 'pending':
      return {
        Icon: PendingIcon,
        className: 'text-muted',
        label: 'Sending...',
      };
    case 'sent':
      return {
        Icon: SentIcon,
        className: 'text-muted',
        label: 'Sent',
      };
    case 'delivered':
      return {
        Icon: DeliveredIcon,
        className: 'text-primary',
        label: 'Delivered',
      };
    case 'failed':
      return {
        Icon: FailedIcon,
        className: 'text-error',
        label: 'Failed to send',
      };
    default:
      return null;
  }
};

/**
 * Truncate content for reply preview
 */
const truncateContent = (content: string, maxLength: number = 50): string => {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength) + '...';
};

// ============================================================================
// Component
// ============================================================================

export const MessageBubble: FunctionComponent<MessageBubbleProps> = ({
  message,
  replyTo,
  showSender = true,
  showTimestamp = true,
  showStatus = true,
  onReplyClick,
  onContextMenu,
}) => {
  const { isOwn, type, content, senderNickname, senderFingerprint, timestamp, status } = message;

  // Memoize computed values
  const formattedTime = useMemo(() => formatTime(timestamp), [timestamp]);
  const statusDisplay = useMemo(() => getStatusDisplay(status), [status]);
  const shortFingerprint = useMemo(
    () => senderFingerprint.slice(0, 8),
    [senderFingerprint]
  );

  // Handle system messages
  if (type === 'system') {
    return (
      <div class="flex justify-center py-2 animate-terminal-fade-in">
        <div class="message-bubble-system">
          <span class="font-mono">{content}</span>
        </div>
      </div>
    );
  }

  // Handle context menu
  const handleContextMenu = (e: MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(message);
    }
  };

  return (
    <div
      class={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} py-1 animate-terminal-fade-in`}
      onContextMenu={handleContextMenu}
    >
      {/* Sender name (for received messages in group chats) */}
      {!isOwn && showSender && (
        <div class="flex items-center gap-1.5 mb-0.5 px-1">
          <span class="text-terminal-xs font-medium text-primary">
            {senderNickname}
          </span>
          <span class="text-terminal-xs text-muted font-mono">
            [{shortFingerprint}]
          </span>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <button
          type="button"
          onClick={() => onReplyClick?.(replyTo.id)}
          class={`mb-1 px-2 py-1 max-w-[80%] bg-surface/50 border-l-2 ${
            isOwn ? 'border-primary/50' : 'border-muted/50'
          } rounded-terminal text-left hover:bg-surface transition-colors`}
        >
          <div class="text-terminal-xs text-primary font-medium">
            {replyTo.senderNickname}
          </div>
          <div class="text-terminal-xs text-muted truncate">
            {truncateContent(replyTo.content)}
          </div>
        </button>
      )}

      {/* Message bubble */}
      <div
        class={isOwn ? 'message-bubble-outgoing' : 'message-bubble-incoming'}
      >
        {/* Message content */}
        <div class="break-words whitespace-pre-wrap selectable">
          {content}
        </div>

        {/* Timestamp and status row */}
        {(showTimestamp || (showStatus && isOwn)) && (
          <div class="flex items-center justify-end gap-1.5 mt-1">
            {showTimestamp && (
              <span class="text-terminal-xs text-muted">
                {formattedTime}
              </span>
            )}

            {/* Status indicator (only for own messages) */}
            {isOwn && showStatus && statusDisplay && (
              <span
                class={`flex items-center ${statusDisplay.className}`}
                title={statusDisplay.label}
              >
                <statusDisplay.Icon class="w-3.5 h-3.5" />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Failed message retry hint */}
      {isOwn && status === 'failed' && (
        <div class="mt-1 text-terminal-xs text-error px-1">
          Tap to retry
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Specialized Variants
// ============================================================================

/**
 * System message bubble (centered, muted)
 */
export const SystemMessage: FunctionComponent<{ content: string }> = ({ content }) => (
  <div class="flex justify-center py-2">
    <div class="message-bubble-system">
      <span class="font-mono">{content}</span>
    </div>
  </div>
);

/**
 * Date separator between message groups
 */
export const DateSeparator: FunctionComponent<{ date: string }> = ({ date }) => (
  <div class="divider-terminal-label py-3">
    <span class="font-mono">{date}</span>
  </div>
);

/**
 * Typing indicator bubble
 */
export const TypingIndicator: FunctionComponent<{ nickname: string }> = ({ nickname }) => (
  <div class="flex items-start py-1 animate-terminal-fade-in">
    <div class="message-bubble-incoming flex items-center gap-2">
      <span class="text-terminal-xs text-muted">{nickname} is typing</span>
      <span class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </span>
    </div>
  </div>
);

export default MessageBubble;
