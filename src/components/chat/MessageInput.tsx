/**
 * MessageInput - Text input component for composing messages
 *
 * Features:
 * - Text input with auto-resize
 * - Send button
 * - Character counter
 * - Reply preview when replying
 * - Offline indicator
 * - Responsive: sticky bottom on mobile with safe area
 * - Keyboard-aware height adjustment
 */

import { FunctionComponent } from 'preact';
import { useState, useRef, useEffect, useCallback } from 'preact/hooks';
import type { ReplyMessage } from './MessageBubble';
import { useIsMobile, useIsKeyboardOpen, useSafeAreaInsets, useIsLandscape } from '../../hooks/useMediaQuery';

// ============================================================================
// Types
// ============================================================================

export interface MessageInputProps {
  /** Callback when a message is sent */
  onSend: (content: string) => void;
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

// ============================================================================
// Icons
// ============================================================================

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
const MIN_HEIGHT = 40;
const MAX_HEIGHT = 150;

// ============================================================================
// Component
// ============================================================================

export const MessageInput: FunctionComponent<MessageInputProps> = ({
  onSend,
  isOffline = false,
  replyTo = null,
  onCancelReply,
  placeholder = 'Type a message...',
  maxLength = DEFAULT_MAX_LENGTH,
  disabled = false,
  isSending = false,
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Responsive hooks
  const isMobile = useIsMobile();
  const isKeyboardOpen = useIsKeyboardOpen();
  const safeAreaInsets = useSafeAreaInsets();
  const isLandscape = useIsLandscape();

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate scroll height
    textarea.style.height = `${MIN_HEIGHT}px`;

    // Set new height based on content
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
    }
  };

  // Handle send
  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled || isSending) return;

    onSend(trimmed);
    setContent('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_HEIGHT}px`;
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Cancel reply on Escape
    if (e.key === 'Escape' && replyTo && onCancelReply) {
      onCancelReply();
    }
  };

  const canSend = content.trim().length > 0 && !disabled && !isSending;
  const characterCount = content.length;
  const showCharacterWarning = characterCount > maxLength * 0.9;

  // Adjust max height based on orientation and keyboard state
  const effectiveMaxHeight = isLandscape && isMobile ? 60 : MAX_HEIGHT;

  // Container classes for mobile/desktop
  const containerClasses = `
    border-t border-muted bg-background
    ${isMobile && !isKeyboardOpen ? 'safe-bottom' : ''}
    ${isKeyboardOpen ? 'keyboard-open' : ''}
  `;

  // Calculate bottom padding for safe area
  const bottomPadding = isMobile && !isKeyboardOpen ? safeAreaInsets.bottom : 0;

  return (
    <div class={containerClasses} style={{ paddingBottom: bottomPadding > 0 ? `${bottomPadding}px` : undefined }}>
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

      {/* Input area */}
      <div class={`flex items-end gap-2 ${isLandscape && isMobile ? 'p-1.5' : 'p-2'}`}>
        {/* Text input */}
        <div class="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onInput={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            class="w-full bg-surface text-text font-mono text-terminal-sm border border-muted rounded-terminal px-3 py-2 resize-none focus:border-primary focus:outline-none transition-colors placeholder:text-muted disabled:opacity-50 disabled:cursor-not-allowed message-input-landscape"
            style={{
              minHeight: `${MIN_HEIGHT}px`,
              maxHeight: `${effectiveMaxHeight}px`,
            }}
            rows={1}
          />

          {/* Character counter - hide on small screens when not needed */}
          {showCharacterWarning && !isLandscape && (
            <div
              class={`absolute bottom-1 right-2 text-terminal-xs font-mono ${
                characterCount >= maxLength ? 'text-error' : 'text-muted'
              }`}
            >
              {characterCount}/{maxLength}
            </div>
          )}
        </div>

        {/* Send button - larger touch target on mobile */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          class={`flex-shrink-0 ${isMobile ? 'w-11 h-11' : 'w-10 h-10'} flex items-center justify-center rounded-terminal border transition-all touch-target ${
            canSend
              ? 'bg-primary border-primary text-background hover:bg-primary/80 active:bg-primary/60'
              : 'bg-surface border-muted text-muted cursor-not-allowed'
          }`}
          aria-label="Send message"
        >
          {isSending ? (
            <span class="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </span>
          ) : (
            <SendIcon class="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Keyboard hint - only on desktop */}
      <div class="hidden lg:block px-3 pb-2">
        <span class="text-terminal-xs text-muted font-mono">
          Press Enter to send, Shift+Enter for new line
        </span>
      </div>
    </div>
  );
};

export default MessageInput;
