/**
 * Formatting Components
 *
 * Exports all message formatting UI components.
 */

// Main formatted message component
export {
  FormattedMessage,
  SimpleFormattedMessage,
  CodeFormattedMessage,
  useFormattedMessage,
  useHasFormattableContent,
  type FormattedMessageProps,
} from './FormattedMessage';

// Link preview component
export {
  LinkPreview,
  SimpleLinkPreview,
  LinkPreviewList,
  type LinkPreviewProps,
} from './LinkPreview';

// Mention link component
export {
  MentionLink,
  MentionLinkWithPeer,
  SelfMention,
  MentionAutocompleteItem,
  MentionList,
  type MentionLinkProps,
} from './MentionLink';

// Code block components
export {
  CodeBlock,
  InlineCode,
  TerminalOutput,
  DiffBlock,
  JsonBlock,
  type CodeBlockProps,
  type InlineCodeProps,
} from './CodeBlock';

// Emoji picker components
export {
  EmojiPicker,
  EmojiButton,
  EmojiPickerWithButton,
  EmojiAutocomplete,
  type EmojiPickerProps,
  type EmojiButtonProps,
  type EmojiAutocompleteProps,
} from './EmojiPicker';
