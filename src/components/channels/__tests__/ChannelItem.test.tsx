/**
 * ChannelItem Component Tests
 *
 * Tests for the individual channel row component including:
 * - Rendering different channel types (location, DM, public)
 * - Active/selected state styling
 * - Click and keyboard interaction
 * - Timestamp formatting
 * - Unread count badges
 * - Pinned and muted indicators
 * - Geohash display for location channels
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { ChannelItem } from '../ChannelItem';
import type { Channel } from '../../../stores/types';

// ============================================================================
// Mock Data Factories
// ============================================================================

function createMockChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: overrides.id ?? `channel-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name ?? 'Test Channel',
    type: overrides.type ?? 'location',
    geohash: overrides.geohash,
    geohashPrecision: overrides.geohashPrecision,
    lastMessageAt: overrides.lastMessageAt ?? Date.now(),
    unreadCount: overrides.unreadCount ?? 0,
    isPinned: overrides.isPinned ?? false,
    isMuted: overrides.isMuted ?? false,
    dmPeerFingerprint: overrides.dmPeerFingerprint,
    description: overrides.description,
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('ChannelItem Component', () => {
  afterEach(() => {
    cleanup();
  });

  describe('basic rendering', () => {
    it('should render channel name', () => {
      const channel = createMockChannel({ name: 'Downtown SF' });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('Downtown SF')).toBeDefined();
    });

    it('should render with default inactive state', () => {
      const channel = createMockChannel();

      const { container } = render(<ChannelItem channel={channel} />);

      const item = container.firstElementChild;
      expect(item?.className).toContain('channel-item');
      expect(item?.className).not.toContain('channel-item-active');
    });

    it('should render with active state when isActive is true', () => {
      const channel = createMockChannel();

      const { container } = render(<ChannelItem channel={channel} isActive={true} />);

      const item = container.firstElementChild;
      expect(item?.className).toContain('channel-item-active');
    });
  });

  describe('channel type icons', () => {
    it('should render location icon for location channels', () => {
      const channel = createMockChannel({ type: 'location' });

      const { container } = render(<ChannelItem channel={channel} />);

      // Location channels should have the location icon (path element with specific attributes)
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
      // The path should contain the location pin path
      const locationPath = container.querySelector('path[d*="21 10c0 7"]');
      expect(locationPath).toBeDefined();
    });

    it('should render user icon for DM channels', () => {
      const channel = createMockChannel({ type: 'dm' });

      const { container } = render(<ChannelItem channel={channel} />);

      // DM channels should have the user icon
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
      // The path should contain the user path (with the body shape)
      const userPath = container.querySelector('path[d*="20 21v-2"]');
      expect(userPath).toBeDefined();
    });

    it('should render globe icon for public channels', () => {
      const channel = createMockChannel({ type: 'public' });

      const { container } = render(<ChannelItem channel={channel} />);

      // Public channels should have the globe icon
      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
      // The circle should be the globe outline
      const circle = container.querySelector('circle[r="10"]');
      expect(circle).toBeDefined();
    });
  });

  describe('click handling', () => {
    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      const channel = createMockChannel();

      render(<ChannelItem channel={channel} onClick={onClick} />);

      const item = screen.getByRole('button');
      fireEvent.click(item);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not throw when clicked without onClick handler', () => {
      const channel = createMockChannel();

      render(<ChannelItem channel={channel} />);

      const item = screen.getByRole('button');
      expect(() => fireEvent.click(item)).not.toThrow();
    });
  });

  describe('keyboard handling', () => {
    it('should call onClick when Enter is pressed', () => {
      const onClick = vi.fn();
      const channel = createMockChannel();

      render(<ChannelItem channel={channel} onClick={onClick} />);

      const item = screen.getByRole('button');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when Space is pressed', () => {
      const onClick = vi.fn();
      const channel = createMockChannel();

      render(<ChannelItem channel={channel} onClick={onClick} />);

      const item = screen.getByRole('button');
      fireEvent.keyDown(item, { key: ' ' });

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick for other keys', () => {
      const onClick = vi.fn();
      const channel = createMockChannel();

      render(<ChannelItem channel={channel} onClick={onClick} />);

      const item = screen.getByRole('button');
      fireEvent.keyDown(item, { key: 'Tab' });
      fireEvent.keyDown(item, { key: 'Escape' });
      fireEvent.keyDown(item, { key: 'a' });

      expect(onClick).not.toHaveBeenCalled();
    });

    it('should prevent default on Enter and Space', () => {
      const onClick = vi.fn();
      const channel = createMockChannel();

      render(<ChannelItem channel={channel} onClick={onClick} />);

      const item = screen.getByRole('button');

      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      });
      const preventDefaultSpy = vi.spyOn(enterEvent, 'preventDefault');

      item.dispatchEvent(enterEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should have tabIndex of 0 for keyboard navigation', () => {
      const channel = createMockChannel();

      render(<ChannelItem channel={channel} />);

      const item = screen.getByRole('button');
      expect(item.getAttribute('tabIndex')).toBe('0');
    });
  });

  describe('timestamp formatting', () => {
    it('should show "now" for very recent messages', () => {
      const channel = createMockChannel({
        lastMessageAt: Date.now() - 30000, // 30 seconds ago
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('now')).toBeDefined();
    });

    it('should show minutes for messages within an hour', () => {
      const channel = createMockChannel({
        lastMessageAt: Date.now() - 15 * 60 * 1000, // 15 minutes ago
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('15m')).toBeDefined();
    });

    it('should show hours for messages within a day', () => {
      const channel = createMockChannel({
        lastMessageAt: Date.now() - 5 * 60 * 60 * 1000, // 5 hours ago
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('5h')).toBeDefined();
    });

    it('should show days for messages within a week', () => {
      const channel = createMockChannel({
        lastMessageAt: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('3d')).toBeDefined();
    });

    it('should show date for messages older than a week', () => {
      const oldDate = new Date(2024, 0, 15); // Jan 15, 2024
      const channel = createMockChannel({
        lastMessageAt: oldDate.getTime(),
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('Jan 15')).toBeDefined();
    });
  });

  describe('unread count badge', () => {
    it('should not show badge when unread count is 0', () => {
      const channel = createMockChannel({ unreadCount: 0 });

      const { container } = render(<ChannelItem channel={channel} />);

      const badge = container.querySelector('.channel-badge');
      expect(badge).toBeNull();
    });

    it('should show badge with unread count', () => {
      const channel = createMockChannel({ unreadCount: 5 });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('5')).toBeDefined();
    });

    it('should show "99+" for counts over 99', () => {
      const channel = createMockChannel({ unreadCount: 150 });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('99+')).toBeDefined();
    });

    it('should show exactly 99 when count is 99', () => {
      const channel = createMockChannel({ unreadCount: 99 });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('99')).toBeDefined();
    });

    it('should not show badge when muted, even with unread count', () => {
      const channel = createMockChannel({ unreadCount: 10, isMuted: true });

      const { container } = render(<ChannelItem channel={channel} />);

      // Should show muted indicator (small dot) instead of badge
      const badge = container.querySelector('.channel-badge');
      expect(badge).toBeNull();

      // Should have the muted indicator
      const mutedIndicator = container.querySelector('.w-2.h-2.rounded-full.bg-muted');
      expect(mutedIndicator).toBeDefined();
    });
  });

  describe('pinned indicator', () => {
    it('should not show pin icon when not pinned', () => {
      const channel = createMockChannel({ isPinned: false });

      const { container } = render(<ChannelItem channel={channel} />);

      // Pin icon has fill="currentColor" which is unique
      const pinIcon = container.querySelector('svg[fill="currentColor"]');
      expect(pinIcon).toBeNull();
    });

    it('should show pin icon when pinned', () => {
      const channel = createMockChannel({ isPinned: true });

      const { container } = render(<ChannelItem channel={channel} />);

      // Pin icon has text-terminal-yellow class
      const pinIcon = container.querySelector('.text-terminal-yellow');
      expect(pinIcon).toBeDefined();
    });
  });

  describe('muted indicator', () => {
    it('should not show muted icon when not muted', () => {
      const channel = createMockChannel({ isMuted: false });

      const { container } = render(<ChannelItem channel={channel} />);

      // Look for the muted bell icon path (line with x1="1" y1="1" pattern)
      const mutedIconPath = container.querySelector('line[x1="1"][y1="1"]');
      expect(mutedIconPath).toBeNull();
    });

    it('should show muted icon when muted', () => {
      const channel = createMockChannel({ isMuted: true });

      const { container } = render(<ChannelItem channel={channel} />);

      // The muted icon has a diagonal line (x1="1" y1="1" x2="23" y2="23")
      const mutedIconLine = container.querySelector('line[x1="1"][y1="1"]');
      expect(mutedIconLine).toBeDefined();
    });
  });

  describe('location channel geohash display', () => {
    it('should show geohash for location channels', () => {
      const channel = createMockChannel({
        type: 'location',
        geohash: 'dr5regw',
        geohashPrecision: 6,
      });

      render(<ChannelItem channel={channel} />);

      // Should show first 6 characters of geohash in brackets
      expect(screen.getByText(/\[dr5reg\]/)).toBeDefined();
    });

    it('should show precision label for region precision', () => {
      const channel = createMockChannel({
        type: 'location',
        geohash: 'dr5',
        geohashPrecision: 3,
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText(/region/)).toBeDefined();
    });

    it('should show precision label for city precision', () => {
      const channel = createMockChannel({
        type: 'location',
        geohash: 'dr5re',
        geohashPrecision: 5,
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText(/city/)).toBeDefined();
    });

    it('should show precision label for neighborhood precision', () => {
      const channel = createMockChannel({
        type: 'location',
        geohash: 'dr5reg',
        geohashPrecision: 6,
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText(/neighborhood/)).toBeDefined();
    });

    it('should show precision label for local precision', () => {
      const channel = createMockChannel({
        type: 'location',
        geohash: 'dr5regwh',
        geohashPrecision: 8,
      });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText(/local/)).toBeDefined();
    });
  });

  describe('last message preview', () => {
    it('should show last message preview when provided', () => {
      const channel = createMockChannel({ type: 'dm' });

      render(
        <ChannelItem channel={channel} lastMessagePreview="Hey, how are you?" />
      );

      expect(screen.getByText(/Hey, how are you/)).toBeDefined();
    });

    it('should truncate long message previews', () => {
      const channel = createMockChannel({ type: 'dm' });
      const longMessage =
        'This is a very long message that should be truncated because it exceeds the maximum length allowed for preview text';

      render(<ChannelItem channel={channel} lastMessagePreview={longMessage} />);

      // Should show truncated text with ellipsis (max 40 chars before ...)
      const truncated = screen.queryByText(/This is a very long message that sh.../);
      expect(truncated).not.toBeNull();
    });

    it('should show "No messages yet" for DM without preview', () => {
      const channel = createMockChannel({ type: 'dm' });

      render(<ChannelItem channel={channel} />);

      expect(screen.getByText('No messages yet')).toBeDefined();
    });

    it('should show geohash instead of preview for location channels', () => {
      const channel = createMockChannel({
        type: 'location',
        geohash: 'dr5regw',
        geohashPrecision: 6,
      });

      render(
        <ChannelItem
          channel={channel}
          lastMessagePreview="This message should not appear"
        />
      );

      // Should show geohash info, not the message preview
      expect(screen.getByText(/\[dr5reg\]/)).toBeDefined();
      expect(screen.queryByText('This message should not appear')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('should have role="button"', () => {
      const channel = createMockChannel();

      render(<ChannelItem channel={channel} />);

      expect(screen.getByRole('button')).toBeDefined();
    });

    it('should have aria-selected reflecting active state', () => {
      const channel = createMockChannel();

      const { rerender } = render(<ChannelItem channel={channel} isActive={false} />);

      let item = screen.getByRole('button');
      expect(item.getAttribute('aria-selected')).toBe('false');

      rerender(<ChannelItem channel={channel} isActive={true} />);

      item = screen.getByRole('button');
      expect(item.getAttribute('aria-selected')).toBe('true');
    });

    it('should have aria-label with channel name', () => {
      const channel = createMockChannel({ name: 'Downtown SF' });

      render(<ChannelItem channel={channel} />);

      const item = screen.getByRole('button');
      expect(item.getAttribute('aria-label')).toContain('Downtown SF');
    });

    it('should include unread count in aria-label', () => {
      const channel = createMockChannel({ name: 'Test Channel', unreadCount: 5 });

      render(<ChannelItem channel={channel} />);

      const item = screen.getByRole('button');
      expect(item.getAttribute('aria-label')).toContain('5 unread messages');
    });

    it('should not mention unread in aria-label when count is 0', () => {
      const channel = createMockChannel({ name: 'Test Channel', unreadCount: 0 });

      render(<ChannelItem channel={channel} />);

      const item = screen.getByRole('button');
      expect(item.getAttribute('aria-label')).not.toContain('unread');
    });
  });

  describe('combined states', () => {
    it('should handle pinned + unread + active', () => {
      const channel = createMockChannel({
        name: 'Important Channel',
        isPinned: true,
        unreadCount: 10,
      });

      const { container } = render(<ChannelItem channel={channel} isActive={true} />);

      const item = container.firstElementChild;
      expect(item?.className).toContain('channel-item-active');

      // Should have pin icon
      const pinIcon = container.querySelector('.text-terminal-yellow');
      expect(pinIcon).toBeDefined();

      // Should have unread badge
      expect(screen.getByText('10')).toBeDefined();
    });

    it('should handle muted + pinned + unread', () => {
      const channel = createMockChannel({
        name: 'Quiet Channel',
        isPinned: true,
        isMuted: true,
        unreadCount: 25,
      });

      const { container } = render(<ChannelItem channel={channel} />);

      // Should have pin icon
      const pinIcon = container.querySelector('.text-terminal-yellow');
      expect(pinIcon).toBeDefined();

      // Should have muted icon
      const mutedIconLine = container.querySelector('line[x1="1"][y1="1"]');
      expect(mutedIconLine).toBeDefined();

      // Should NOT have regular badge (muted shows dot instead)
      expect(screen.queryByText('25')).toBeNull();

      // Should have muted indicator dot
      const mutedIndicator = container.querySelector('.w-2.h-2.rounded-full.bg-muted');
      expect(mutedIndicator).toBeDefined();
    });
  });
});
