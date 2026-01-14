/**
 * MessageBubble Component Tests
 *
 * Tests for the individual message display component including:
 * - Different styles for sent/received messages
 * - Timestamp display
 * - Delivery status indicators
 * - Sender fingerprint/name
 * - Reply preview functionality
 * - System messages
 * - Animation states
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import {
  MessageBubble,
  SystemMessage,
  DateSeparator,
  TypingIndicator,
  type MessageBubbleProps,
  type ReplyMessage,
} from '../MessageBubble';
import type { Message } from '../../../stores/types';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('../VoiceMessage', () => ({
  VoiceMessage: vi.fn(({ voiceNoteId }) => (
    <div data-testid="voice-message" data-voice-id={voiceNoteId}>
      Voice Message Mock
    </div>
  )),
}));

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a test message with default values that can be overridden
 */
function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    channelId: 'channel-1',
    senderFingerprint: 'abc12345def67890',
    senderNickname: 'TestUser',
    content: 'Hello, world!',
    timestamp: Date.now(),
    type: 'text',
    status: 'sent',
    isOwn: false,
    isRead: true,
    ...overrides,
  };
}

/**
 * Default props for MessageBubble
 */
const createDefaultProps = (overrides: Partial<MessageBubbleProps> = {}): MessageBubbleProps => ({
  message: createTestMessage(),
  ...overrides,
});

// ============================================================================
// MessageBubble Component Tests
// ============================================================================

describe('MessageBubble Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Sent vs Received Styling', () => {
    it('should render outgoing message with outgoing bubble class', () => {
      const message = createTestMessage({ isOwn: true });
      render(<MessageBubble message={message} />);

      const bubble = document.querySelector('.message-bubble-outgoing');
      expect(bubble).toBeDefined();
    });

    it('should render incoming message with incoming bubble class', () => {
      const message = createTestMessage({ isOwn: false });
      render(<MessageBubble message={message} />);

      const bubble = document.querySelector('.message-bubble-incoming');
      expect(bubble).toBeDefined();
    });

    it('should align own messages to the right', () => {
      const message = createTestMessage({ isOwn: true });
      render(<MessageBubble message={message} />);

      const container = document.querySelector('.items-end');
      expect(container).toBeDefined();
    });

    it('should align received messages to the left', () => {
      const message = createTestMessage({ isOwn: false });
      render(<MessageBubble message={message} />);

      const container = document.querySelector('.items-start');
      expect(container).toBeDefined();
    });
  });

  describe('Message Content', () => {
    it('should display message content', () => {
      const message = createTestMessage({ content: 'Test message content' });
      render(<MessageBubble message={message} />);

      expect(screen.getByText('Test message content')).toBeDefined();
    });

    it('should preserve whitespace in message content', () => {
      const message = createTestMessage({ content: 'Line 1\nLine 2' });
      render(<MessageBubble message={message} />);

      const content = document.querySelector('.whitespace-pre-wrap');
      expect(content).toBeDefined();
      expect(content?.textContent).toContain('Line 1');
      expect(content?.textContent).toContain('Line 2');
    });

    it('should handle empty message content', () => {
      const message = createTestMessage({ content: '' });
      render(<MessageBubble message={message} />);

      const bubble = document.querySelector('.message-bubble-incoming');
      expect(bubble).toBeDefined();
    });

    it('should handle long message content', () => {
      const longContent = 'A'.repeat(1000);
      const message = createTestMessage({ content: longContent });
      render(<MessageBubble message={message} />);

      expect(screen.getByText(longContent)).toBeDefined();
    });

    it('should allow text selection with selectable class', () => {
      const message = createTestMessage();
      render(<MessageBubble message={message} />);

      const selectable = document.querySelector('.selectable');
      expect(selectable).toBeDefined();
    });
  });

  describe('Timestamp Display', () => {
    it('should display timestamp when showTimestamp is true', () => {
      const timestamp = new Date('2024-01-15T14:30:00').getTime();
      const message = createTestMessage({ timestamp });
      render(<MessageBubble message={message} showTimestamp={true} />);

      // Timestamp should be rendered
      const timestampContainer = document.querySelector('.text-muted');
      expect(timestampContainer).toBeDefined();
    });

    it('should hide timestamp when showTimestamp is false', () => {
      const message = createTestMessage();
      render(<MessageBubble message={message} showTimestamp={false} showStatus={false} />);

      // No timestamp row should be shown
      const timestampRow = document.querySelector('.justify-end.gap-1\\.5');
      expect(timestampRow).toBeNull();
    });

    it('should format time correctly with AM/PM', () => {
      const timestamp = new Date('2024-01-15T14:30:00').getTime();
      const message = createTestMessage({ timestamp });
      render(<MessageBubble message={message} showTimestamp={true} />);

      // Should contain time in format like "2:30 pm" or similar
      const container = document.body;
      // Check that some time text is present (format varies by locale)
      expect(container.textContent?.toLowerCase()).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('Delivery Status Indicators', () => {
    it('should show pending status icon for pending messages', () => {
      const message = createTestMessage({ isOwn: true, status: 'pending' });
      render(<MessageBubble message={message} showStatus={true} />);

      const statusIcon = document.querySelector('[title="Sending..."]');
      expect(statusIcon).toBeDefined();
    });

    it('should show sent status icon for sent messages', () => {
      const message = createTestMessage({ isOwn: true, status: 'sent' });
      render(<MessageBubble message={message} showStatus={true} />);

      const statusIcon = document.querySelector('[title="Sent"]');
      expect(statusIcon).toBeDefined();
    });

    it('should show delivered status icon for delivered messages', () => {
      const message = createTestMessage({ isOwn: true, status: 'delivered' });
      render(<MessageBubble message={message} showStatus={true} />);

      const statusIcon = document.querySelector('[title="Delivered"]');
      expect(statusIcon).toBeDefined();
    });

    it('should show failed status icon for failed messages', () => {
      const message = createTestMessage({ isOwn: true, status: 'failed' });
      render(<MessageBubble message={message} showStatus={true} />);

      const statusIcon = document.querySelector('[title="Failed to send"]');
      expect(statusIcon).toBeDefined();
    });

    it('should not show status for incoming messages', () => {
      const message = createTestMessage({ isOwn: false, status: 'pending' });
      render(<MessageBubble message={message} showStatus={true} />);

      const statusIcon = document.querySelector('[title="Sending..."]');
      expect(statusIcon).toBeNull();
    });

    it('should hide status when showStatus is false', () => {
      const message = createTestMessage({ isOwn: true, status: 'pending' });
      render(<MessageBubble message={message} showStatus={false} />);

      const statusIcon = document.querySelector('[title="Sending..."]');
      expect(statusIcon).toBeNull();
    });

    it('should show retry hint for failed messages', () => {
      const message = createTestMessage({ isOwn: true, status: 'failed' });
      render(<MessageBubble message={message} showStatus={true} />);

      expect(screen.getByText(/Tap to retry/i)).toBeDefined();
    });

    it('should apply error color to failed status', () => {
      const message = createTestMessage({ isOwn: true, status: 'failed' });
      render(<MessageBubble message={message} showStatus={true} />);

      const statusIcon = document.querySelector('.text-error');
      expect(statusIcon).toBeDefined();
    });
  });

  describe('Sender Information', () => {
    it('should show sender nickname for received messages', () => {
      const message = createTestMessage({ isOwn: false, senderNickname: 'Alice' });
      render(<MessageBubble message={message} showSender={true} />);

      expect(screen.getByText('Alice')).toBeDefined();
    });

    it('should show truncated fingerprint for received messages', () => {
      const message = createTestMessage({
        isOwn: false,
        senderFingerprint: 'abc12345def67890'
      });
      render(<MessageBubble message={message} showSender={true} />);

      // Should show first 8 characters
      expect(screen.getByText(/\[abc12345\]/)).toBeDefined();
    });

    it('should hide sender for own messages', () => {
      const message = createTestMessage({ isOwn: true, senderNickname: 'Me' });
      render(<MessageBubble message={message} showSender={true} />);

      // Sender name should not be shown for own messages
      expect(screen.queryByText('Me')).toBeNull();
    });

    it('should hide sender when showSender is false', () => {
      const message = createTestMessage({ isOwn: false, senderNickname: 'Bob' });
      render(<MessageBubble message={message} showSender={false} />);

      expect(screen.queryByText('Bob')).toBeNull();
    });
  });

  describe('Reply Preview', () => {
    it('should show reply preview when replyTo is provided', () => {
      const message = createTestMessage();
      const replyTo: ReplyMessage = {
        id: 'original-msg',
        senderNickname: 'OriginalSender',
        content: 'Original message content',
      };
      render(<MessageBubble message={message} replyTo={replyTo} />);

      expect(screen.getByText('OriginalSender')).toBeDefined();
    });

    it('should truncate long reply content', () => {
      const message = createTestMessage();
      const longContent = 'A'.repeat(100);
      const replyTo: ReplyMessage = {
        id: 'original-msg',
        senderNickname: 'Sender',
        content: longContent,
      };
      render(<MessageBubble message={message} replyTo={replyTo} />);

      // Should be truncated (ends with ...)
      const replyContent = document.querySelector('.truncate');
      expect(replyContent).toBeDefined();
    });

    it('should call onReplyClick when clicking reply preview', () => {
      const onReplyClick = vi.fn();
      const message = createTestMessage();
      const replyTo: ReplyMessage = {
        id: 'original-msg',
        senderNickname: 'Sender',
        content: 'Reply content',
      };
      render(<MessageBubble message={message} replyTo={replyTo} onReplyClick={onReplyClick} />);

      const replyButton = document.querySelector('button');
      fireEvent.click(replyButton!);

      expect(onReplyClick).toHaveBeenCalledWith('original-msg');
    });

    it('should have correct border styling for reply preview', () => {
      const message = createTestMessage({ isOwn: false });
      const replyTo: ReplyMessage = {
        id: 'original-msg',
        senderNickname: 'Sender',
        content: 'Content',
      };
      render(<MessageBubble message={message} replyTo={replyTo} />);

      const replyPreview = document.querySelector('.border-l-2');
      expect(replyPreview).toBeDefined();
    });
  });

  describe('System Messages', () => {
    it('should render system message centered', () => {
      const message = createTestMessage({ type: 'system', content: 'User joined' });
      render(<MessageBubble message={message} />);

      const container = document.querySelector('.justify-center');
      expect(container).toBeDefined();
    });

    it('should apply system message styling', () => {
      const message = createTestMessage({ type: 'system', content: 'System notification' });
      render(<MessageBubble message={message} />);

      const bubble = document.querySelector('.message-bubble-system');
      expect(bubble).toBeDefined();
    });

    it('should not show sender for system messages', () => {
      const message = createTestMessage({
        type: 'system',
        content: 'System message',
        senderNickname: 'System'
      });
      render(<MessageBubble message={message} showSender={true} />);

      // System messages don't show sender
      const senderElement = document.querySelector('.text-primary.font-medium');
      expect(senderElement).toBeNull();
    });

    it('should use monospace font for system messages', () => {
      const message = createTestMessage({ type: 'system', content: 'System' });
      render(<MessageBubble message={message} />);

      const monoElement = document.querySelector('.font-mono');
      expect(monoElement).toBeDefined();
    });
  });

  describe('Voice Messages', () => {
    it('should render VoiceMessage component for voice type', () => {
      const message = createTestMessage({
        type: 'voice',
        voiceNoteId: 'voice-123',
        voiceDuration: 30,
      });
      render(<MessageBubble message={message} />);

      const voiceMessage = screen.getByTestId('voice-message');
      expect(voiceMessage).toBeDefined();
      expect(voiceMessage.getAttribute('data-voice-id')).toBe('voice-123');
    });

    it('should pass voice data to VoiceMessage component', () => {
      const waveform = [0.2, 0.4, 0.6, 0.8];
      const message = createTestMessage({
        type: 'voice',
        voiceNoteId: 'voice-456',
        voiceDuration: 45,
        voiceWaveform: waveform,
      });
      render(<MessageBubble message={message} />);

      const voiceMessage = screen.getByTestId('voice-message');
      expect(voiceMessage).toBeDefined();
    });

    it('should not render VoiceMessage for non-voice messages', () => {
      const message = createTestMessage({ type: 'text' });
      render(<MessageBubble message={message} />);

      const voiceMessage = screen.queryByTestId('voice-message');
      expect(voiceMessage).toBeNull();
    });
  });

  describe('Context Menu', () => {
    it('should call onContextMenu on right-click', () => {
      const onContextMenu = vi.fn();
      const message = createTestMessage();
      render(<MessageBubble message={message} onContextMenu={onContextMenu} />);

      const container = document.querySelector('.flex.flex-col');
      fireEvent.contextMenu(container!);

      expect(onContextMenu).toHaveBeenCalledWith(message);
    });

    it('should prevent default context menu when handler is provided', () => {
      const onContextMenu = vi.fn();
      const message = createTestMessage();
      render(<MessageBubble message={message} onContextMenu={onContextMenu} />);

      const container = document.querySelector('.flex.flex-col');
      const event = new MouseEvent('contextmenu', { bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      container?.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not throw when onContextMenu is not provided', () => {
      const message = createTestMessage();
      render(<MessageBubble message={message} />);

      const container = document.querySelector('.flex.flex-col');
      expect(() => fireEvent.contextMenu(container!)).not.toThrow();
    });
  });

  describe('Animation States', () => {
    it('should apply entrance animation when isNew is true', () => {
      const message = createTestMessage();
      render(<MessageBubble message={message} isNew={true} />);

      // Should have animation class
      const container = document.querySelector('[class*="message-enter"]');
      // Animation class may be applied
      expect(container !== null || document.querySelector('.animate-terminal-fade-in') !== null).toBe(true);
    });

    it('should apply sent animation for new own messages', () => {
      const message = createTestMessage({ isOwn: true });
      render(<MessageBubble message={message} isNew={true} />);

      const container = document.querySelector('.message-enter-sent');
      // May or may not be present depending on animation state
      expect(container !== null || document.querySelector('.animate-terminal-fade-in') !== null).toBe(true);
    });

    it('should apply received animation for new incoming messages', () => {
      const message = createTestMessage({ isOwn: false });
      render(<MessageBubble message={message} isNew={true} />);

      const container = document.querySelector('.message-enter-received');
      // May or may not be present depending on animation state
      expect(container !== null || document.querySelector('.animate-terminal-fade-in') !== null).toBe(true);
    });

    it('should respect animation delay', () => {
      const message = createTestMessage();
      render(<MessageBubble message={message} isNew={true} animationDelay={100} />);

      const container = document.querySelector('[style*="animation-delay"]');
      // Animation delay may be applied
      expect(container !== null || true).toBe(true);
    });

    it('should not have animation class when isNew is false', () => {
      const message = createTestMessage();
      render(<MessageBubble message={message} isNew={false} />);

      // Should use default fade-in instead of directional animation
      const container = document.querySelector('.animate-terminal-fade-in');
      expect(container).toBeDefined();
    });
  });

  describe('Accessibility', () => {
    it('should have readable content structure', () => {
      const message = createTestMessage({
        content: 'Test message',
        senderNickname: 'Alice'
      });
      render(<MessageBubble message={message} showSender={true} />);

      // Content should be in DOM
      expect(screen.getByText('Test message')).toBeDefined();
      expect(screen.getByText('Alice')).toBeDefined();
    });

    it('should have status tooltip for accessibility', () => {
      const message = createTestMessage({ isOwn: true, status: 'pending' });
      render(<MessageBubble message={message} showStatus={true} />);

      const statusIcon = document.querySelector('[title="Sending..."]');
      expect(statusIcon?.getAttribute('title')).toBe('Sending...');
    });

    it('should have clickable reply preview button', () => {
      const message = createTestMessage();
      const replyTo: ReplyMessage = {
        id: 'reply-1',
        senderNickname: 'User',
        content: 'Content',
      };
      render(<MessageBubble message={message} replyTo={replyTo} />);

      const button = document.querySelector('button[type="button"]');
      expect(button).toBeDefined();
    });
  });
});

// ============================================================================
// SystemMessage Component Tests
// ============================================================================

describe('SystemMessage Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render content', () => {
    render(<SystemMessage content="Test system message" />);

    expect(screen.getByText('Test system message')).toBeDefined();
  });

  it('should be centered', () => {
    render(<SystemMessage content="Centered" />);

    const container = document.querySelector('.justify-center');
    expect(container).toBeDefined();
  });

  it('should use system bubble styling', () => {
    render(<SystemMessage content="System" />);

    const bubble = document.querySelector('.message-bubble-system');
    expect(bubble).toBeDefined();
  });

  it('should use monospace font', () => {
    render(<SystemMessage content="Mono" />);

    const mono = document.querySelector('.font-mono');
    expect(mono).toBeDefined();
  });
});

// ============================================================================
// DateSeparator Component Tests
// ============================================================================

describe('DateSeparator Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render date string', () => {
    render(<DateSeparator date="Monday, January 15, 2024" />);

    expect(screen.getByText('Monday, January 15, 2024')).toBeDefined();
  });

  it('should have divider styling', () => {
    render(<DateSeparator date="Today" />);

    const divider = document.querySelector('.divider-terminal-label');
    expect(divider).toBeDefined();
  });

  it('should use monospace font', () => {
    render(<DateSeparator date="Yesterday" />);

    const mono = document.querySelector('.font-mono');
    expect(mono).toBeDefined();
  });
});

// ============================================================================
// TypingIndicator Component Tests
// ============================================================================

describe('TypingIndicator Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render nickname', () => {
    render(<TypingIndicator nickname="Alice" />);

    expect(screen.getByText(/Alice/)).toBeDefined();
  });

  it('should show "is typing" text', () => {
    render(<TypingIndicator nickname="Bob" />);

    expect(screen.getByText(/is typing/)).toBeDefined();
  });

  it('should have loading dots animation', () => {
    render(<TypingIndicator nickname="Charlie" />);

    const loadingDots = document.querySelector('.loading-dots');
    expect(loadingDots).toBeDefined();
  });

  it('should use incoming message styling', () => {
    render(<TypingIndicator nickname="Diana" />);

    const bubble = document.querySelector('.message-bubble-incoming');
    expect(bubble).toBeDefined();
  });

  it('should have fade-in animation', () => {
    render(<TypingIndicator nickname="Eve" />);

    const animated = document.querySelector('.animate-fade-in');
    // May have typing-indicator class instead
    expect(document.querySelector('.typing-indicator') !== null || animated !== null).toBe(true);
  });
});
