/**
 * Chat Components - Barrel Export
 *
 * Export all chat-related components for easy importing:
 * import { ChatView, MessageList, MessageBubble, MessageInput, ChatHeader } from '@/components/chat';
 */

// Main chat view container
export { ChatView, StandaloneChatView } from './ChatView';
export type { ChatViewProps, StandaloneChatViewProps } from './ChatView';

// Chat header
export { ChatHeader } from './ChatHeader';
export type { ChatHeaderProps } from './ChatHeader';

// Message list with virtualization
export { MessageList, ScrollToBottomButton } from './MessageList';
export type { MessageListProps, ScrollToBottomButtonProps } from './MessageList';

// Individual message bubble
export {
  MessageBubble,
  SystemMessage,
  DateSeparator,
  TypingIndicator,
} from './MessageBubble';
export type { MessageBubbleProps, ReplyMessage } from './MessageBubble';

// Message input
export { MessageInput } from './MessageInput';
export type { MessageInputProps } from './MessageInput';
