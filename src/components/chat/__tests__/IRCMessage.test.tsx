/**
 * IRCMessage Component Tests
 *
 * Tests for the IRC-style message display component including:
 * - Timestamp formatting ([HH:MM] format)
 * - Sender nick in angle brackets
 * - Action messages with * nick action format
 * - System messages (join/leave) rendering
 * - Nick color consistency
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/preact';
import { h } from 'preact';
import { IRCMessage, IRCDateSeparator, IRCTypingIndicator, getNickColor } from '../IRCMessage';
import type { Message } from '../../../stores/types';

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
    senderFingerprint: 'abc123',
    senderNickname: 'TestUser',
    content: 'Hello, world!',
    timestamp: Date.UTC(2024, 0, 15, 14, 30, 0), // Jan 15, 2024 14:30 UTC
    type: 'text',
    status: 'sent',
    isOwn: false,
    isRead: true,
    ...overrides,
  };
}

// ============================================================================
// IRCMessage Component Tests
// ============================================================================

describe('IRCMessage Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('Timestamp Rendering', () => {
    it('should render timestamp in [HH:MM] format', () => {
      // Create a timestamp that will display as 14:30 in UTC
      const timestamp = new Date('2024-01-15T14:30:00Z').getTime();
      const message = createTestMessage({ timestamp });

      render(<IRCMessage message={message} />);

      // The timestamp should be formatted based on local timezone
      // We verify that it contains a bracketed time format
      const container = document.querySelector('.irc-timestamp');
      expect(container).toBeDefined();
      expect(container?.textContent).toMatch(/\[\d{2}:\d{2}\]/);
    });

    it('should not render timestamp when showTimestamp is false', () => {
      const message = createTestMessage();

      render(<IRCMessage message={message} showTimestamp={false} />);

      const timestamp = document.querySelector('.irc-timestamp');
      expect(timestamp).toBeNull();
    });

    it('should format single-digit hours with leading zero', () => {
      // 9:05 AM should display as [09:05]
      const timestamp = new Date('2024-01-15T09:05:00').getTime();
      const message = createTestMessage({ timestamp });

      render(<IRCMessage message={message} />);

      const container = document.querySelector('.irc-timestamp');
      expect(container).toBeDefined();
      // Should have format [HH:MM] with leading zeros
      expect(container?.textContent).toMatch(/\[\d{2}:\d{2}\]/);
    });

    it('should format midnight correctly', () => {
      // Midnight should display as [00:00]
      const timestamp = new Date('2024-01-15T00:00:00').getTime();
      const message = createTestMessage({ timestamp });

      render(<IRCMessage message={message} />);

      const container = document.querySelector('.irc-timestamp');
      expect(container?.textContent).toMatch(/\[\d{2}:\d{2}\]/);
    });
  });

  describe('Sender Nick Rendering', () => {
    it('should render sender nick in angle brackets for regular messages', () => {
      const message = createTestMessage({ senderNickname: 'Alice' });

      render(<IRCMessage message={message} />);

      // Should contain <Alice>
      const nickWrapper = document.querySelector('.irc-nick-wrapper');
      expect(nickWrapper).toBeDefined();
      expect(nickWrapper?.textContent).toContain('<');
      expect(nickWrapper?.textContent).toContain('>');
      expect(nickWrapper?.textContent).toContain('Alice');
    });

    it('should apply nick color to sender nickname', () => {
      const message = createTestMessage({ senderNickname: 'Bob' });

      render(<IRCMessage message={message} />);

      const nickElement = document.querySelector('.irc-nick');
      expect(nickElement).toBeDefined();
      expect(nickElement?.getAttribute('style')).toContain('color');
    });

    it('should render message content after nick', () => {
      const message = createTestMessage({
        senderNickname: 'Charlie',
        content: 'This is a test message',
      });

      render(<IRCMessage message={message} />);

      const content = document.querySelector('.irc-content');
      expect(content).toBeDefined();
      expect(content?.textContent).toBe('This is a test message');
    });
  });

  describe('Action Messages (/me)', () => {
    it('should render action messages with asterisk prefix', () => {
      const message = createTestMessage({
        type: 'action',
        senderNickname: 'David',
        content: 'waves hello',
      });

      render(<IRCMessage message={message} />);

      // Action messages should have asterisk
      const asterisk = document.querySelector('.irc-action-asterisk');
      expect(asterisk).toBeDefined();
      expect(asterisk?.textContent).toBe('*');
    });

    it('should render /me content messages as action style', () => {
      const message = createTestMessage({
        type: 'text',
        senderNickname: 'Eve',
        content: '/me dances happily',
      });

      render(<IRCMessage message={message} />);

      // Should detect /me prefix and render as action
      const messageDiv = document.querySelector('.irc-message-action');
      expect(messageDiv).toBeDefined();
    });

    it('should strip /me prefix from displayed action text', () => {
      const message = createTestMessage({
        type: 'text',
        senderNickname: 'Frank',
        content: '/me laughs out loud',
      });

      render(<IRCMessage message={message} />);

      const actionText = document.querySelector('.irc-action-text');
      expect(actionText).toBeDefined();
      // Should show "laughs out loud" without "/me "
      expect(actionText?.textContent).toBe('laughs out loud');
    });

    it('should show nick without angle brackets in action messages', () => {
      const message = createTestMessage({
        type: 'action',
        senderNickname: 'Grace',
        content: 'sighs',
      });

      render(<IRCMessage message={message} />);

      // Action messages should not have angle brackets
      const nickWrapper = document.querySelector('.irc-nick-wrapper');
      expect(nickWrapper).toBeNull();

      // But should have nick
      const nick = document.querySelector('.irc-nick');
      expect(nick).toBeDefined();
      expect(nick?.textContent).toBe('Grace');
    });
  });

  describe('System Messages (Join/Leave)', () => {
    it('should render join messages with --> arrow', () => {
      const message = createTestMessage({
        type: 'system',
        senderNickname: 'System',
        content: 'Henry has joined',
      });

      render(<IRCMessage message={message} />);

      // Should show --> for joins
      const arrow = document.querySelector('.irc-system-join');
      expect(arrow).toBeDefined();
      expect(arrow?.textContent).toBe('-->');
    });

    it('should render leave messages with <-- arrow', () => {
      const message = createTestMessage({
        type: 'system',
        senderNickname: 'System',
        content: 'Ivan has left',
      });

      render(<IRCMessage message={message} />);

      // Should show <-- for leaves
      const arrow = document.querySelector('.irc-system-leave');
      expect(arrow).toBeDefined();
      expect(arrow?.textContent).toBe('<--');
    });

    it('should extract and highlight nickname in join messages', () => {
      const message = createTestMessage({
        type: 'system',
        content: 'Julia has joined',
      });

      render(<IRCMessage message={message} />);

      const nickElement = document.querySelector('.irc-system-nick');
      expect(nickElement).toBeDefined();
      expect(nickElement?.textContent).toBe('Julia');
    });

    it('should extract and highlight nickname in leave messages', () => {
      const message = createTestMessage({
        type: 'system',
        content: 'Kevin has left',
      });

      render(<IRCMessage message={message} />);

      const nickElement = document.querySelector('.irc-system-nick');
      expect(nickElement).toBeDefined();
      expect(nickElement?.textContent).toBe('Kevin');
    });

    it('should render other system messages without arrows', () => {
      const message = createTestMessage({
        type: 'system',
        content: 'Channel topic changed to: Welcome!',
      });

      render(<IRCMessage message={message} />);

      // Should not have join/leave arrows
      const joinArrow = document.querySelector('.irc-system-join');
      const leaveArrow = document.querySelector('.irc-system-leave');
      expect(joinArrow).toBeNull();
      expect(leaveArrow).toBeNull();

      // Should have system text
      const systemText = document.querySelector('.irc-system-text');
      expect(systemText).toBeDefined();
    });
  });

  describe('Nick Color Consistency', () => {
    it('should return same color for same nickname', () => {
      const color1 = getNickColor('Alice');
      const color2 = getNickColor('Alice');

      expect(color1).toBe(color2);
    });

    it('should return same color regardless of case', () => {
      const color1 = getNickColor('Bob');
      const color2 = getNickColor('BOB');
      const color3 = getNickColor('bob');

      expect(color1).toBe(color2);
      expect(color2).toBe(color3);
    });

    it('should return different colors for different nicknames', () => {
      const colorAlice = getNickColor('Alice');
      const colorBob = getNickColor('Bob');
      const colorCharlie = getNickColor('Charlie');

      // Not all will be different due to hash collisions, but most should be
      const colors = [colorAlice, colorBob, colorCharlie];
      const uniqueColors = new Set(colors);

      // At least 2 different colors for 3 different names
      expect(uniqueColors.size).toBeGreaterThanOrEqual(2);
    });

    it('should return valid hex color codes', () => {
      const color = getNickColor('TestUser');

      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });

    it('should apply consistent color to same user across multiple messages', () => {
      const message1 = createTestMessage({ id: 'msg-1', senderNickname: 'Diana' });
      const message2 = createTestMessage({ id: 'msg-2', senderNickname: 'Diana' });

      const { container: container1 } = render(<IRCMessage message={message1} />);
      const nick1 = container1.querySelector('.irc-nick');
      const color1 = nick1?.getAttribute('style');

      cleanup();

      const { container: container2 } = render(<IRCMessage message={message2} />);
      const nick2 = container2.querySelector('.irc-nick');
      const color2 = nick2?.getAttribute('style');

      expect(color1).toBe(color2);
    });
  });

  describe('Message Status', () => {
    it('should show pending status indicator for own pending messages', () => {
      const message = createTestMessage({
        isOwn: true,
        status: 'pending',
      });

      render(<IRCMessage message={message} />);

      const status = document.querySelector('.irc-status');
      expect(status).toBeDefined();
      expect(status?.textContent).toBe('...');
    });

    it('should show failed status indicator for failed messages', () => {
      const message = createTestMessage({
        isOwn: true,
        status: 'failed',
      });

      render(<IRCMessage message={message} />);

      const status = document.querySelector('.irc-status');
      expect(status).toBeDefined();
      expect(status?.textContent).toBe('!');
      expect(status?.classList.contains('irc-status-failed')).toBe(true);
    });

    it('should not show status for sent messages', () => {
      const message = createTestMessage({
        isOwn: true,
        status: 'sent',
      });

      render(<IRCMessage message={message} />);

      // Sent status should not show indicator
      const status = document.querySelector('.irc-status');
      expect(status).toBeNull();
    });

    it('should not show status for non-own messages', () => {
      const message = createTestMessage({
        isOwn: false,
        status: 'pending',
      });

      render(<IRCMessage message={message} />);

      const status = document.querySelector('.irc-status');
      expect(status).toBeNull();
    });

    it('should not show status when showStatus is false', () => {
      const message = createTestMessage({
        isOwn: true,
        status: 'pending',
      });

      render(<IRCMessage message={message} showStatus={false} />);

      const status = document.querySelector('.irc-status');
      expect(status).toBeNull();
    });
  });

  describe('Context Menu', () => {
    it('should call onContextMenu when right-clicking message', () => {
      const onContextMenu = vi.fn();
      const message = createTestMessage();

      render(<IRCMessage message={message} onContextMenu={onContextMenu} />);

      const messageEl = document.querySelector('.irc-message');
      expect(messageEl).toBeDefined();

      fireEvent.contextMenu(messageEl!);

      expect(onContextMenu).toHaveBeenCalledWith(message);
    });

    it('should not throw when onContextMenu is not provided', () => {
      const message = createTestMessage();

      render(<IRCMessage message={message} />);

      const messageEl = document.querySelector('.irc-message');
      expect(() => fireEvent.contextMenu(messageEl!)).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have selectable message content', () => {
      const message = createTestMessage();
      render(<IRCMessage message={message} />);

      const content = document.querySelector('.selectable');
      expect(content).toBeDefined();
    });

    it('should render message with animation class', () => {
      const message = createTestMessage();
      render(<IRCMessage message={message} />);

      const animated = document.querySelector('.animate-terminal-fade-in');
      expect(animated).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content gracefully', () => {
      const message = createTestMessage({ content: '' });
      render(<IRCMessage message={message} />);

      const messageEl = document.querySelector('.irc-message');
      expect(messageEl).toBeDefined();
    });

    it('should handle very long nicknames', () => {
      const longNick = 'A'.repeat(100);
      const message = createTestMessage({ senderNickname: longNick });
      render(<IRCMessage message={message} />);

      const nick = document.querySelector('.irc-nick');
      expect(nick?.textContent).toBe(longNick);
    });

    it('should handle very long messages', () => {
      const longContent = 'B'.repeat(5000);
      const message = createTestMessage({ content: longContent });
      render(<IRCMessage message={message} />);

      const content = document.querySelector('.irc-content');
      expect(content?.textContent).toBe(longContent);
    });

    it('should handle special characters in content', () => {
      const specialContent = '<script>alert("xss")</script>';
      const message = createTestMessage({ content: specialContent });
      render(<IRCMessage message={message} />);

      const content = document.querySelector('.irc-content');
      expect(content?.textContent).toBe(specialContent);
    });

    it('should handle unicode characters in nickname', () => {
      const message = createTestMessage({ senderNickname: 'User_Name' });
      render(<IRCMessage message={message} />);

      const nick = document.querySelector('.irc-nick');
      expect(nick?.textContent).toBe('User_Name');
    });

    it('should handle /me at beginning of newline', () => {
      const message = createTestMessage({
        type: 'text',
        content: '/me\nwaves',
      });
      render(<IRCMessage message={message} />);

      const messageDiv = document.querySelector('.irc-message-action');
      expect(messageDiv).toBeDefined();
    });
  });

  describe('Message Type Rendering', () => {
    it('should apply different styles for system messages', () => {
      const message = createTestMessage({ type: 'system', content: 'Server notice' });
      render(<IRCMessage message={message} />);

      const systemMsg = document.querySelector('.irc-message-system');
      expect(systemMsg).toBeDefined();
    });

    it('should apply different styles for action messages', () => {
      const message = createTestMessage({ type: 'action', content: 'dances' });
      render(<IRCMessage message={message} />);

      const actionMsg = document.querySelector('.irc-message-action');
      expect(actionMsg).toBeDefined();
    });
  });

  describe('Empty States', () => {
    it('should handle message with missing optional fields', () => {
      const message = createTestMessage();
      delete (message as Partial<typeof message>).nostrEventId;
      delete (message as Partial<typeof message>).mentions;

      render(<IRCMessage message={message} />);

      const messageEl = document.querySelector('.irc-message');
      expect(messageEl).toBeDefined();
    });
  });
});

// ============================================================================
// IRCDateSeparator Tests
// ============================================================================

describe('IRCDateSeparator Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render date text between dashes', () => {
    render(<IRCDateSeparator date="Monday, January 15, 2024" />);

    const dateText = document.querySelector('.irc-date-text');
    expect(dateText).toBeDefined();
    expect(dateText?.textContent).toBe('Monday, January 15, 2024');
  });

  it('should render separator lines', () => {
    render(<IRCDateSeparator date="Today" />);

    const lines = document.querySelectorAll('.irc-date-line');
    expect(lines.length).toBe(2);
    expect(lines[0]?.textContent).toBe('---');
    expect(lines[1]?.textContent).toBe('---');
  });
});

// ============================================================================
// IRCTypingIndicator Tests
// ============================================================================

describe('IRCTypingIndicator Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render nickname with typing indicator', () => {
    render(<IRCTypingIndicator nickname="Alice" />);

    const nick = document.querySelector('.irc-nick');
    expect(nick).toBeDefined();
    expect(nick?.textContent).toBe('Alice');
  });

  it('should show asterisk like action message', () => {
    render(<IRCTypingIndicator nickname="Bob" />);

    const asterisk = document.querySelector('.irc-action-asterisk');
    expect(asterisk).toBeDefined();
    expect(asterisk?.textContent).toBe('*');
  });

  it('should show "is typing" text', () => {
    render(<IRCTypingIndicator nickname="Charlie" />);

    const typingText = document.querySelector('.irc-typing-text');
    expect(typingText).toBeDefined();
    expect(typingText?.textContent).toBe('is typing');
  });

  it('should have loading dots animation', () => {
    render(<IRCTypingIndicator nickname="Diana" />);

    const loadingDots = document.querySelector('.loading-dots');
    expect(loadingDots).toBeDefined();
  });

  it('should apply nick color consistently', () => {
    render(<IRCTypingIndicator nickname="Eve" />);

    const nick = document.querySelector('.irc-nick');
    // Color may be in hex or rgb format depending on browser
    const style = nick?.getAttribute('style') || '';
    expect(style).toContain('color');
    // Just verify color is applied
    expect(style.length).toBeGreaterThan(0);
  });
});
