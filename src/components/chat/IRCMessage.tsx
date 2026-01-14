/**
 * IRCMessage - IRC-style message display component
 *
 * Features:
 * - Monospace font throughout
 * - No bubbles, no avatars
 * - Timestamp in gray [HH:MM] format (24-hour)
 * - Sender nick in angle brackets <nick> with consistent color per user
 * - System messages (joins, leaves, actions) in yellow/orange
 * - /me actions shown as * nick action
 * - Join messages: --> nick has joined
 * - Leave messages: <-- nick has left
 */

import type { FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import type { Message, MessageStatus } from '../../stores/types';

// ============================================================================
// Types
// ============================================================================

export interface IRCMessageProps {
  /** The message to display */
  message: Message;
  /** Whether to show the timestamp */
  showTimestamp?: boolean;
  /** Whether to show message status */
  showStatus?: boolean;
  /** Callback for message context menu */
  onContextMenu?: (message: Message) => void;
}

// ============================================================================
// Color Generation
// ============================================================================

/**
 * Terminal-friendly colors for nicknames
 * These colors are bright and visible on dark backgrounds
 */
const NICK_COLORS = [
  '#00FF00', // Green (primary)
  '#00FFFF', // Cyan
  '#FF00FF', // Magenta
  '#FFFF00', // Yellow
  '#FF6B6B', // Light Red
  '#6BCB77', // Light Green
  '#4D96FF', // Light Blue
  '#FFD93D', // Gold
  '#C9B1FF', // Lavender
  '#FF9F45', // Orange
  '#6FEDD6', // Mint
  '#FF6B9D', // Pink
];

/**
 * Generate a consistent color for a nickname based on a hash
 * Uses djb2 hash algorithm for string hashing
 */
const hashString = (str: string): number => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) + hash) ^ char; // hash * 33 ^ char
  }
  return Math.abs(hash);
};

/**
 * Get a consistent color for a nickname
 */
export const getNickColor = (nickname: string): string => {
  const hash = hashString(nickname.toLowerCase());
  return NICK_COLORS[hash % NICK_COLORS.length];
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp in 24-hour [HH:MM] format
 */
const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `[${hours}:${minutes}]`;
};

/**
 * Get status indicator character for message status
 */
const getStatusIndicator = (status: MessageStatus): string => {
  switch (status) {
    case 'pending':
      return '...';
    case 'sent':
      return '';
    case 'delivered':
      return '';
    case 'failed':
      return '!';
    default:
      return '';
  }
};

/**
 * Check if a message content is a /me action
 */
const isActionMessage = (content: string): boolean => content.startsWith('/me ') || content.startsWith('/me\n');

/**
 * Get the action text from a /me message
 */
const getActionText = (content: string): string => 
   content.slice(4) // Remove "/me "
;

/**
 * Parse system message content to determine type
 */
interface SystemMessageParts {
  type: 'join' | 'leave' | 'other';
  nickname: string;
  content: string;
}

const parseSystemMessage = (content: string): SystemMessageParts => {
  // Check for join pattern
  const joinMatch = content.match(/^(\S+)\s+has joined/i);
  if (joinMatch) {
    return { type: 'join', nickname: joinMatch[1], content };
  }

  // Check for leave pattern
  const leaveMatch = content.match(/^(\S+)\s+has left/i);
  if (leaveMatch) {
    return { type: 'leave', nickname: leaveMatch[1], content };
  }

  return { type: 'other', nickname: '', content };
};

// ============================================================================
// Components
// ============================================================================

/**
 * IRC-style regular message
 * Format: [HH:MM] <nick> message content
 */
export const IRCMessage: FunctionComponent<IRCMessageProps> = ({
  message,
  showTimestamp = true,
  showStatus = true,
  onContextMenu,
}) => {
  const { type, content, senderNickname, timestamp, status, isOwn } = message;

  // Memoize computed values
  const formattedTime = useMemo(() => formatTime(timestamp), [timestamp]);
  const nickColor = useMemo(() => getNickColor(senderNickname), [senderNickname]);
  const statusIndicator = useMemo(() => getStatusIndicator(status), [status]);
  const isAction = useMemo(() => type === 'action' || isActionMessage(content), [type, content]);
  const actionText = useMemo(
    () => (isAction && isActionMessage(content) ? getActionText(content) : content),
    [isAction, content]
  );

  // Handle context menu
  const handleContextMenu = (e: MouseEvent) => {
    if (onContextMenu) {
      e.preventDefault();
      onContextMenu(message);
    }
  };

  // System messages
  if (type === 'system') {
    const systemParts = parseSystemMessage(content);

    if (systemParts.type === 'join') {
      return (
        <div
          class="irc-message irc-message-system animate-terminal-fade-in"
          onContextMenu={handleContextMenu}
        >
          {showTimestamp && (
            <span class="irc-timestamp">{formattedTime}</span>
          )}
          <span class="irc-system-arrow irc-system-join">--&gt;</span>
          <span class="irc-system-text">
            <span class="irc-system-nick">{systemParts.nickname}</span>
            {' has joined'}
          </span>
        </div>
      );
    }

    if (systemParts.type === 'leave') {
      return (
        <div
          class="irc-message irc-message-system animate-terminal-fade-in"
          onContextMenu={handleContextMenu}
        >
          {showTimestamp && (
            <span class="irc-timestamp">{formattedTime}</span>
          )}
          <span class="irc-system-arrow irc-system-leave">&lt;--</span>
          <span class="irc-system-text">
            <span class="irc-system-nick">{systemParts.nickname}</span>
            {' has left'}
          </span>
        </div>
      );
    }

    // Other system messages
    return (
      <div
        class="irc-message irc-message-system animate-terminal-fade-in"
        onContextMenu={handleContextMenu}
      >
        {showTimestamp && (
          <span class="irc-timestamp">{formattedTime}</span>
        )}
        <span class="irc-system-text">{content}</span>
      </div>
    );
  }

  // Action messages (/me)
  if (isAction || type === 'action') {
    return (
      <div
        class="irc-message irc-message-action animate-terminal-fade-in"
        onContextMenu={handleContextMenu}
      >
        {showTimestamp && (
          <span class="irc-timestamp">{formattedTime}</span>
        )}
        <span class="irc-action-asterisk">*</span>
        <span class="irc-nick" style={{ color: nickColor }}>
          {senderNickname}
        </span>
        <span class="irc-action-text">{actionText}</span>
        {isOwn && showStatus && statusIndicator && (
          <span class={`irc-status ${status === 'failed' ? 'irc-status-failed' : ''}`}>
            {statusIndicator}
          </span>
        )}
      </div>
    );
  }

  // Regular messages
  return (
    <div
      class="irc-message animate-terminal-fade-in"
      onContextMenu={handleContextMenu}
    >
      {showTimestamp && (
        <span class="irc-timestamp">{formattedTime}</span>
      )}
      <span class="irc-nick-wrapper">
        &lt;<span class="irc-nick" style={{ color: nickColor }}>{senderNickname}</span>&gt;
      </span>
      <span class="irc-content selectable">{content}</span>
      {isOwn && showStatus && statusIndicator && (
        <span class={`irc-status ${status === 'failed' ? 'irc-status-failed' : ''}`}>
          {statusIndicator}
        </span>
      )}
    </div>
  );
};

/**
 * IRC-style date separator
 * Format: --- Day, Month Date, Year ---
 */
export const IRCDateSeparator: FunctionComponent<{ date: string }> = ({ date }) => (
  <div class="irc-date-separator">
    <span class="irc-date-line">---</span>
    <span class="irc-date-text">{date}</span>
    <span class="irc-date-line">---</span>
  </div>
);

/**
 * IRC-style typing indicator
 * Format: * nick is typing...
 */
export const IRCTypingIndicator: FunctionComponent<{ nickname: string }> = ({ nickname }) => {
  const nickColor = useMemo(() => getNickColor(nickname), [nickname]);

  return (
    <div class="irc-message irc-message-typing animate-terminal-fade-in">
      <span class="irc-action-asterisk">*</span>
      <span class="irc-nick" style={{ color: nickColor }}>{nickname}</span>
      <span class="irc-typing-text">is typing</span>
      <span class="loading-dots">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
};

export default IRCMessage;
