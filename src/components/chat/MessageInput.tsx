/**
 * MessageInput - iOS-style text input component for composing messages
 *
 * Layout:
 * ┌──────────────────────────────────────────────────────────────┐
 * │ [+] │ Type a message...                       │ [mic] [send]│
 * └──────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Plus button opens attachment picker
 * - Text input with auto-resize (up to 4 lines)
 * - Voice button when input is empty
 * - Send button when input has content (animated transition)
 * - Reply preview when replying
 * - Offline indicator
 * - Responsive: sticky bottom on mobile with safe area
 * - Keyboard-aware height adjustment
 * - Command autocomplete (/ prefix)
 * - Mention autocomplete (@ prefix)
 */

import type { FunctionComponent } from 'preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import type { ReplyMessage } from './MessageBubble';
import { useIsMobile, useIsKeyboardOpen, useSafeAreaInsets, useIsLandscape } from '../../hooks/useMediaQuery';
import { usePeers } from '../../stores/peers-store';
import { CommandAutocomplete, isCommandInput, extractCommandQuery, isCommandComplete, type Command } from './CommandAutocomplete';
import { MentionAutocomplete, shouldShowMentionAutocomplete, extractMentionQuery, completeMention, extractMentions } from './MentionAutocomplete';
import { VoiceRecorder } from './VoiceRecorder';
import { VoiceRecorderService } from '../../services/media/voice-recorder';
import { ImagePicker } from './ImagePicker';
import type { ImageMessageContent } from '../../services/media/image-handler';
import type { Peer } from '../../stores/types';

// ============================================================================
// Types
// ============================================================================

export interface MessageInputProps {
  /** Callback when a message is sent */
  onSend: (content: string, mentions?: string[]) => void;
  /** Callback when a voice message is recorded */
  onVoiceSend?: (blob: Blob, duration: number, waveform: number[]) => void;
  /** Callback when an image is selected and ready to send */
  onImageSend?: (content: ImageMessageContent) => void;
  /** Callback when a command is executed */
  onCommand?: (command: string, args: string) => void;
  /** Whether the user is currently offline */
  isOffline?: boolean;
  /** Reply message being composed */
  replyTo?: ReplyMessage | null;
  /** Callback to cancel reply */
  onCancelReply?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Maximum character limit */
  maxLength?: number;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the send operation is in progress */
  isSending?: boolean;
}

/** Autocomplete mode */
type AutocompleteMode = 'none' | 'command' | 'mention';

// ============================================================================
// Icons
// ============================================================================

const PlusIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
  </svg>
);

const SendIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
  </svg>
);

const MicrophoneIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
    <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-1.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
  </svg>
);

const CloseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);

const OfflineIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38 1.651 1.651 0 000-1.185A10.004 10.004 0 009.999 3a9.956 9.956 0 00-4.744 1.194L3.28 2.22zM7.752 6.69l1.092 1.092a2.5 2.5 0 013.374 3.373l1.091 1.092a4 4 0 00-5.557-5.557z"
      clip-rule="evenodd"
    />
    <path d="M10.748 13.93l2.523 2.523a9.987 9.987 0 01-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 010-1.186A10.007 10.007 0 012.839 6.02L6.07 9.252a4 4 0 004.678 4.678z" />
  </svg>
);

const ReplyIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M7.793 2.232a.75.75 0 01-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 010 10.75H10.75a.75.75 0 010-1.5h2.875a3.875 3.875 0 000-7.75H3.622l4.146 3.957a.75.75 0 01-1.036 1.085l-5.5-5.25a.75.75 0 010-1.085l5.5-5.25a.75.75 0 011.06.025z"
      clip-rule="evenodd"
    />
  </svg>
);

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_LENGTH = 2000;
const MIN_HEIGHT = 36; // Slightly smaller for iOS-style
const MAX_LINES = 4;
const LINE_HEIGHT = 22; // Approximate line height
const MAX_HEIGHT = MIN_HEIGHT + (MAX_LINES - 1) * LINE_HEIGHT; // ~102px for 4 lines

// ============================================================================
// Component
// ============================================================================

export const MessageInput: FunctionComponent<MessageInputProps> = ({
  onSend,
  onVoiceSend,
  onImageSend,
  onCommand,
  isOffline = false,
  replyTo = null,
  onCancelReply,
  placeholder = 'Type a message...',
  maxLength = DEFAULT_MAX_LENGTH,
  disabled = false,
  isSending = false,
}) => {
  const [content, setContent] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [autocompleteMode, setAutocompleteMode] = useState<AutocompleteMode>('none');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if voice recording is supported
  const voiceSupported = VoiceRecorderService.isSupported();

  // Get peers for mention autocomplete
  const peers = usePeers();

  // Responsive hooks
  const isMobile = useIsMobile();
  const isKeyboardOpen = useIsKeyboardOpen();
  const safeAreaInsets = useSafeAreaInsets();
  const isLandscape = useIsLandscape();

  // Determine autocomplete mode based on input
  useEffect(() => {
    // Check for command input (/ at start)
    if (isCommandInput(content) && !isCommandComplete(content)) {
      setAutocompleteMode('command');
      setSelectedIndex(0);
      return;
    }

    // Check for mention input (@ trigger)
    if (shouldShowMentionAutocomplete(content, cursorPosition)) {
      setAutocompleteMode('mention');
      setSelectedIndex(0);
      return;
    }

    setAutocompleteMode('none');
  }, [content, cursorPosition]);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate scroll height
    textarea.style.height = `${MIN_HEIGHT}px`;

    // Set new height based on content (max 4 lines)
    const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust height when content changes
  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

  // Focus textarea when replying
  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus();
    }
  }, [replyTo]);

  // Handle input change
  const handleChange = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    if (target.value.length <= maxLength) {
      setContent(target.value);
      setCursorPosition(target.selectionStart || 0);
    }
  };

  // Track cursor position on selection change
  const handleSelect = (e: Event) => {
    const target = e.target as HTMLTextAreaElement;
    setCursorPosition(target.selectionStart || 0);
  };

  // Handle send
  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled || isSending) return;

    // Check if this is a command
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      const spaceIndex = trimmed.indexOf(' ');
      const commandName = spaceIndex === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIndex);
      const args = spaceIndex === -1 ? '' : trimmed.slice(spaceIndex + 1);

      if (onCommand) {
        onCommand(commandName, args);
      }

      setContent('');
      setAutocompleteMode('none');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`;
      }
      return;
    }

    // Extract mentions from content
    const mentions = extractMentions(trimmed, peers);

    onSend(trimmed, mentions.length > 0 ? mentions : undefined);
    setContent('');
    setAutocompleteMode('none');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  // Handle command selection from autocomplete
  const handleCommandSelect = (command: Command) => {
    if (command.requiresArg) {
      // Insert command with space for argument
      setContent(`/${command.name} `);
      setCursorPosition(`/${command.name} `.length);
    } else {
      // Execute command immediately
      setContent(`/${command.name}`);
    }
    setAutocompleteMode('none');

    // Focus back to input
    textareaRef.current?.focus();
  };

  // Handle mention selection from autocomplete
  const handleMentionSelect = (peer: Peer) => {
    const result = completeMention(content, cursorPosition, peer.nickname);
    setContent(result.text);
    setCursorPosition(result.cursorPosition);
    setAutocompleteMode('none');

    // Set cursor position after React updates
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = result.cursorPosition;
        textareaRef.current.selectionEnd = result.cursorPosition;
        textareaRef.current.focus();
      }
    }, 0);
  };

  // Dismiss autocomplete
  const dismissAutocomplete = () => {
    setAutocompleteMode('none');
    textareaRef.current?.focus();
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // If autocomplete is active, let it handle navigation keys
    if (autocompleteMode !== 'none') {
      if (['ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(e.key)) {
        // These are handled by the AutocompletePopup component
        return;
      }
      // Enter sends/selects when autocomplete is active
      if (e.key === 'Enter' && !e.shiftKey) {
        // Let AutocompletePopup handle Enter for selection
        return;
      }
    }

    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Cancel reply on Escape
    if (e.key === 'Escape') {
      if (autocompleteMode !== 'none') {
        dismissAutocomplete();
      } else if (replyTo && onCancelReply) {
        onCancelReply();
      }
    }
  };

  // Handle plus button click - opens image picker
  const handlePlusClick = () => {
    setIsImagePickerOpen(true);
  };

  // Handle image selection from picker
  const handleImageSelected = (content: ImageMessageContent) => {
    if (onImageSend) {
      onImageSend(content);
    }
  };

  // Handle voice button click - start recording
  const handleVoiceClick = () => {
    if (!voiceSupported || disabled) return;
    setIsRecordingVoice(true);
  };

  // Handle voice recording complete
  const handleVoiceRecordingComplete = (blob: Blob, duration: number, waveform: number[]) => {
    setIsRecordingVoice(false);
    if (onVoiceSend) {
      onVoiceSend(blob, duration, waveform);
    }
  };

  // Handle voice recording cancel
  const handleVoiceRecordingCancel = () => {
    setIsRecordingVoice(false);
  };

  const hasContent = content.trim().length > 0;
  const canSend = hasContent && !disabled && !isSending;

  // Adjust max height based on orientation and keyboard state
  const effectiveMaxHeight = isLandscape && isMobile ? 60 : MAX_HEIGHT;

  // Calculate bottom padding for safe area
  const bottomPadding = isMobile && !isKeyboardOpen ? safeAreaInsets.bottom : 0;

  // Show voice recorder when recording
  if (isRecordingVoice) {
    return (
      <div style={{ paddingBottom: bottomPadding > 0 ? `${bottomPadding}px` : undefined }}>
        <VoiceRecorder
          onRecordingComplete={handleVoiceRecordingComplete}
          onCancel={handleVoiceRecordingCancel}
          disabled={disabled}
        />
      </div>
    );
  }

  return (
    <div
      class="border-t border-muted bg-background"
      style={{ paddingBottom: bottomPadding > 0 ? `${bottomPadding}px` : undefined }}
    >
      {/* Offline indicator */}
      {isOffline && (
        <div class="flex items-center gap-2 px-3 py-1.5 bg-error/10 border-b border-error/30">
          <OfflineIcon class="w-4 h-4 text-error flex-shrink-0" />
          <span class={`text-terminal-xs text-error font-mono ${isLandscape && isMobile ? 'hide-landscape-mobile' : ''}`}>
            {isLandscape && isMobile ? 'Offline' : 'You are offline. Messages will be sent when you reconnect.'}
          </span>
        </div>
      )}

      {/* Reply preview - more compact on landscape mobile */}
      {replyTo && (
        <div class={`flex items-center gap-2 px-3 ${isLandscape && isMobile ? 'py-1' : 'py-2'} bg-surface/50 border-b border-muted`}>
          <ReplyIcon class="w-4 h-4 text-primary flex-shrink-0" />
          <div class="flex-1 min-w-0">
            <div class="text-terminal-xs text-primary font-medium">
              Replying to {replyTo.senderNickname}
            </div>
            {/* Hide content preview in landscape mode to save space */}
            {!(isLandscape && isMobile) && (
              <div class="text-terminal-xs text-muted truncate">
                {replyTo.content}
              </div>
            )}
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              class="flex-shrink-0 w-6 h-6 flex items-center justify-center text-muted hover:text-text transition-colors touch-target"
              aria-label="Cancel reply"
            >
              <CloseIcon class="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Input area - iOS style layout */}
      <div class={`flex items-end gap-2 ${isLandscape && isMobile ? 'p-1.5' : 'p-2'}`}>
        {/* Plus button - attachment picker */}
        <button
          type="button"
          onClick={handlePlusClick}
          disabled={disabled}
          class={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full transition-all touch-target ${
            disabled
              ? 'bg-surface text-muted cursor-not-allowed'
              : 'bg-surface text-muted hover:text-text hover:bg-terminal-gray active:bg-terminal-gray'
          }`}
          aria-label="Add attachment"
        >
          <PlusIcon class="w-5 h-5" />
        </button>

        {/* Text input with autocomplete */}
        <div class="flex-1 relative">
          {/* Command Autocomplete Popup */}
          <CommandAutocomplete
            query={extractCommandQuery(content)}
            selectedIndex={selectedIndex}
            onSelect={handleCommandSelect}
            onIndexChange={setSelectedIndex}
            onDismiss={dismissAutocomplete}
            isVisible={autocompleteMode === 'command'}
          />

          {/* Mention Autocomplete Popup */}
          <MentionAutocomplete
            query={extractMentionQuery(content, cursorPosition)}
            peers={peers}
            selectedIndex={selectedIndex}
            onSelect={handleMentionSelect}
            onIndexChange={setSelectedIndex}
            onDismiss={dismissAutocomplete}
            isVisible={autocompleteMode === 'mention'}
          />

          <textarea
            ref={textareaRef}
            value={content}
            onInput={handleChange}
            onKeyDown={handleKeyDown}
            onSelect={handleSelect}
            onClick={handleSelect}
            placeholder={placeholder}
            disabled={disabled}
            class="w-full bg-surface text-text font-mono text-terminal-sm rounded-2xl px-4 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-muted disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              minHeight: `${MIN_HEIGHT}px`,
              maxHeight: `${effectiveMaxHeight}px`,
            }}
            rows={1}
          />
        </div>

        {/* Right side buttons container */}
        <div class="flex items-center gap-1 flex-shrink-0">
          {/* Voice button - visible when input is empty and voice is supported */}
          {voiceSupported && (
            <button
              type="button"
              onClick={handleVoiceClick}
              disabled={disabled}
              class={`w-9 h-9 flex items-center justify-center rounded-full transition-all touch-target ${
                hasContent ? 'hidden' : ''
              } ${
                disabled
                  ? 'bg-surface text-muted cursor-not-allowed'
                  : 'bg-surface text-muted hover:text-text hover:bg-terminal-gray active:bg-terminal-gray'
              }`}
              aria-label="Record voice message"
              style={{
                opacity: hasContent ? 0 : 1,
                pointerEvents: hasContent ? 'none' : 'auto',
              }}
            >
              <MicrophoneIcon class="w-5 h-5" />
            </button>
          )}

          {/* Send button - visible when input has content */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            class={`w-9 h-9 flex items-center justify-center rounded-full transition-all touch-target ${
              hasContent ? '' : 'hidden'
            } ${
              canSend
                ? 'bg-primary text-background hover:bg-primary/80 active:bg-primary/60'
                : 'bg-surface text-muted cursor-not-allowed'
            }`}
            aria-label="Send message"
            style={{
              opacity: hasContent ? 1 : 0,
              pointerEvents: hasContent ? 'auto' : 'none',
            }}
          >
            {isSending ? (
              <span class="loading-dots">
                <span />
                <span />
                <span />
              </span>
            ) : (
              <SendIcon class="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Keyboard hint - only on desktop */}
      <div class="hidden lg:block px-3 pb-2">
        <span class="text-terminal-xs text-muted font-mono">
          Press Enter to send, Shift+Enter for new line
        </span>
      </div>

      {/* Image Picker Modal */}
      <ImagePicker
        isOpen={isImagePickerOpen}
        onClose={() => setIsImagePickerOpen(false)}
        onImageSelected={handleImageSelected}
      />
    </div>
  );
};

export default MessageInput;
