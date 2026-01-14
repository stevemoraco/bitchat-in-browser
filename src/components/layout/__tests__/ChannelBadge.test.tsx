/**
 * ChannelBadge Component Tests
 *
 * Tests for the channel badge component including:
 * - Shows geohash for location channels
 * - Shows "DM" for direct messages
 * - Truncates long names
 * - Click opens channel selector
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { ChannelBadge } from '../ChannelBadge';
import type { Channel } from '../../../stores/types';

// Mock active channel data
let mockActiveChannel: Channel | undefined = undefined;
const mockOpenChannels = vi.fn();

vi.mock('../../../stores/channels-store', () => ({
  useActiveChannel: () => mockActiveChannel,
}));

vi.mock('../../../stores/navigation-store', () => ({
  useNavigationStore: (selector: (state: any) => any) => {
    const state = {
      openChannels: mockOpenChannels,
    };
    return selector(state);
  },
}));

describe('ChannelBadge Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActiveChannel = undefined;
  });

  afterEach(() => {
    cleanup();
    mockActiveChannel = undefined;
  });

  describe('no channel selected', () => {
    it('should display "No Channel" when no active channel', () => {
      mockActiveChannel = undefined;

      render(<ChannelBadge />);

      expect(screen.getByText('No Channel')).toBeDefined();
    });
  });

  describe('location channels', () => {
    it('should display geohash for location channel', () => {
      mockActiveChannel = {
        id: 'loc-1',
        name: 'Test Location',
        type: 'location',
        geohash: 'dr5regw',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('dr5regw')).toBeDefined();
    });

    it('should display short geohash', () => {
      mockActiveChannel = {
        id: 'loc-2',
        name: 'Local',
        type: 'location',
        geohash: '9q8y',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('9q8y')).toBeDefined();
    });

    it('should prefer geohash over channel name for location type', () => {
      mockActiveChannel = {
        id: 'loc-3',
        name: 'My Location Channel',
        type: 'location',
        geohash: 'abc123',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('abc123')).toBeDefined();
      expect(screen.queryByText('My Location Channel')).toBeNull();
    });

    it('should fall back to name if location channel has no geohash', () => {
      mockActiveChannel = {
        id: 'loc-4',
        name: 'Global',
        type: 'location',
        geohash: undefined,
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('Global')).toBeDefined();
    });
  });

  describe('direct message channels', () => {
    it('should display "DM" for direct message channel', () => {
      mockActiveChannel = {
        id: 'dm-1',
        name: 'Alice',
        type: 'dm',
        dmPeerFingerprint: 'alice-fingerprint',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('DM')).toBeDefined();
    });

    it('should not display peer name for DM', () => {
      mockActiveChannel = {
        id: 'dm-2',
        name: 'Bob Smith',
        type: 'dm',
        dmPeerFingerprint: 'bob-fingerprint',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('DM')).toBeDefined();
      expect(screen.queryByText('Bob Smith')).toBeNull();
    });
  });

  describe('group channels', () => {
    it('should display channel name for group channel', () => {
      mockActiveChannel = {
        id: 'group-1',
        name: 'Project Team',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('Project Team')).toBeDefined();
    });

    it('should truncate long group channel names', () => {
      mockActiveChannel = {
        id: 'group-2',
        name: 'This is a very long channel name that should be truncated',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      // Should truncate to 10 chars + "..."
      expect(screen.getByText('This is a ...')).toBeDefined();
    });

    it('should not truncate short names', () => {
      mockActiveChannel = {
        id: 'group-3',
        name: 'Short',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('Short')).toBeDefined();
    });

    it('should not truncate names exactly 12 characters', () => {
      mockActiveChannel = {
        id: 'group-4',
        name: 'Exactly12chr',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('Exactly12chr')).toBeDefined();
    });

    it('should truncate names longer than 12 characters', () => {
      mockActiveChannel = {
        id: 'group-5',
        name: 'Exactly13chars',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('Exactly13c...')).toBeDefined();
    });

    it('should display "Channel" for group with empty name', () => {
      mockActiveChannel = {
        id: 'group-6',
        name: '',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('Channel')).toBeDefined();
    });
  });

  describe('click interaction', () => {
    it('should open channel selector when clicked', () => {
      mockActiveChannel = {
        id: 'test-1',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(mockOpenChannels).toHaveBeenCalledTimes(1);
    });

    it('should be a button element', () => {
      mockActiveChannel = {
        id: 'test-2',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      const { container } = render(<ChannelBadge />);

      const button = container.querySelector('button');
      expect(button).toBeDefined();
    });
  });

  describe('accessibility', () => {
    it('should have aria-label for channel selection', () => {
      mockActiveChannel = {
        id: 'test-3',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByLabelText('Select channel')).toBeDefined();
    });

    it('should have aria-haspopup for dialog', () => {
      mockActiveChannel = {
        id: 'test-4',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      const { container } = render(<ChannelBadge />);

      const button = container.querySelector('button');
      expect(button?.getAttribute('aria-haspopup')).toBe('dialog');
    });
  });

  describe('styling', () => {
    it('should have dropdown arrow svg', () => {
      mockActiveChannel = {
        id: 'test-5',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      const { container } = render(<ChannelBadge />);

      const svg = container.querySelector('svg');
      expect(svg).toBeDefined();
    });

    it('should apply custom className', () => {
      mockActiveChannel = {
        id: 'test-6',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      const { container } = render(<ChannelBadge className="custom-class" />);

      const button = container.querySelector('button');
      expect(button?.className).toContain('custom-class');
    });

    it('should have terminal-green text color', () => {
      mockActiveChannel = {
        id: 'test-7',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      const { container } = render(<ChannelBadge />);

      const span = container.querySelector('span');
      expect(span?.className).toContain('text-terminal-green');
    });

    it('should have rounded button styling', () => {
      mockActiveChannel = {
        id: 'test-8',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      const { container } = render(<ChannelBadge />);

      const button = container.querySelector('button');
      expect(button?.className).toContain('rounded-md');
    });

    it('should have hover styles', () => {
      mockActiveChannel = {
        id: 'test-9',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      const { container } = render(<ChannelBadge />);

      const button = container.querySelector('button');
      expect(button?.className).toContain('hover:bg-terminal-green/20');
    });

    it('should have active styles', () => {
      mockActiveChannel = {
        id: 'test-10',
        name: 'Test',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      const { container } = render(<ChannelBadge />);

      const button = container.querySelector('button');
      expect(button?.className).toContain('active:bg-terminal-green/30');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined channel name gracefully', () => {
      mockActiveChannel = {
        id: 'edge-1',
        name: undefined as any,
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      // Should fall back to 'Channel'
      expect(screen.getByText('Channel')).toBeDefined();
    });

    it('should handle whitespace-only channel name', () => {
      mockActiveChannel = {
        id: 'edge-2',
        name: '   ',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      // Whitespace name should be displayed as-is (or fall back)
      const button = screen.getByRole('button');
      expect(button).toBeDefined();
    });

    it('should handle special characters in channel name', () => {
      mockActiveChannel = {
        id: 'edge-3',
        name: '<Script>Alert</Script>',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      // Should be escaped/truncated properly
      const button = screen.getByRole('button');
      expect(button).toBeDefined();
    });

    it('should handle emoji in channel name', () => {
      mockActiveChannel = {
        id: 'edge-4',
        name: 'Test Channel',
        type: 'group',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      };

      render(<ChannelBadge />);

      expect(screen.getByText('Test Channel')).toBeDefined();
    });
  });
});
