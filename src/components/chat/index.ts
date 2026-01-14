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

// IRC-style message components (primary)
export {
  IRCMessage,
  IRCDateSeparator,
  IRCTypingIndicator,
  getNickColor,
} from './IRCMessage';
export type { IRCMessageProps } from './IRCMessage';

// Legacy message bubble (kept for compatibility)
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

// Voice recording and playback
export { VoiceRecorder } from './VoiceRecorder';
export type { VoiceRecorderProps } from './VoiceRecorder';
export { VoiceMessage } from './VoiceMessage';
export type { VoiceMessageProps } from './VoiceMessage';

// Payment chip for Lightning invoices
export {
  PaymentChip,
  MessageWithPayments,
  detectLightningInvoices,
  hasLightningInvoice,
  tokenizeLightningInvoices,
} from './PaymentChip';
export type {
  PaymentChipProps,
  MessageWithPaymentsProps,
} from './PaymentChip';

// Image message components
export { ImageMessage, ImageMessageBubble } from './ImageMessage';
export type { ImageMessageProps, ImageMessageBubbleProps } from './ImageMessage';

// Image picker for selecting/capturing images
export { ImagePicker, ImagePickerButton } from './ImagePicker';
export type { ImagePickerProps, ImagePickerButtonProps } from './ImagePicker';
