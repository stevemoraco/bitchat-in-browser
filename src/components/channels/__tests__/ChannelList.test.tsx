/**
 * ChannelsList Component Tests
 *
 * Tests for the main channels view component including:
 * - List rendering with various channel types
 * - Channel selection behavior
 * - Search/filter functionality
 * - Empty states
 * - Section headers and grouping
 * - Quick action buttons
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { ChannelsList } from '../ChannelsList';
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

function createLocationChannel(overrides: Partial<Channel> = {}): Channel {
  return createMockChannel({
    type: 'location',
    geohash: 'dr5regw',
    geohashPrecision: 6,
    name: 'Downtown SF',
    ...overrides,
  });
}

function createDMChannel(overrides: Partial<Channel> = {}): Channel {
  return createMockChannel({
    type: 'dm',
    dmPeerFingerprint: 'abc123def456',
    name: 'Alice',
    ...overrides,
  });
}

function createPublicChannel(overrides: Partial<Channel> = {}): Channel {
  return createMockChannel({
    type: 'public',
    name: 'Global Chat',
    ...overrides,
  });
}

// ============================================================================
// Mock Store Setup
// ============================================================================

const mockSetActiveChannel = vi.fn();
let mockChannels: Channel[] = [];
let mockActiveChannel: Channel | undefined = undefined;

vi.mock('../../../stores/channels-store', () => ({
  useChannelsStore: (selector: (state: any) => any) => {
    const state = {
      setActiveChannel: mockSetActiveChannel,
    };
    return selector(state);
  },
  useSortedChannels: () => {
    // Sort channels: pinned first, then by last message timestamp
    return [...mockChannels].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.lastMessageAt - a.lastMessageAt;
    });
  },
  useActiveChannel: () => mockActiveChannel,
}));

// Mock ChannelItem to simplify testing
vi.mock('../ChannelItem', () => ({
  ChannelItem: ({
    channel,
    isActive,
    onClick,
  }: {
    channel: Channel;
    isActive: boolean;
    onClick: () => void;
  }) =>
    h(
      'div',
      {
        'data-testid': `channel-item-${channel.id}`,
        'data-active': isActive,
        'data-type': channel.type,
        onClick,
        role: 'button',
      },
      channel.name
    ),
}));

// ============================================================================
// Tests
// ============================================================================

describe('ChannelsList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChannels = [];
    mockActiveChannel = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  describe('list rendering', () => {
    it('should render location channels in the location section', () => {
      const locationChannel = createLocationChannel({ id: 'loc-1', name: 'Downtown' });
      mockChannels = [locationChannel];

      render(<ChannelsList />);

      expect(screen.getByText('Location Channels')).toBeDefined();
      expect(screen.getByTestId('channel-item-loc-1')).toBeDefined();
      expect(screen.getByText('Downtown')).toBeDefined();
    });

    it('should render DM channels in the direct messages section', () => {
      const dmChannel = createDMChannel({ id: 'dm-1', name: 'Alice' });
      mockChannels = [dmChannel];

      render(<ChannelsList />);

      expect(screen.getByText('Direct Messages')).toBeDefined();
      expect(screen.getByTestId('channel-item-dm-1')).toBeDefined();
      expect(screen.getByText('Alice')).toBeDefined();
    });

    it('should render public channels in the public channels section', () => {
      const publicChannel = createPublicChannel({ id: 'pub-1', name: 'Global' });
      mockChannels = [publicChannel];

      render(<ChannelsList />);

      expect(screen.getByText('Public Channels')).toBeDefined();
      expect(screen.getByTestId('channel-item-pub-1')).toBeDefined();
    });

    it('should render multiple channels grouped by type', () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1', name: 'Neighborhood' }),
        createLocationChannel({ id: 'loc-2', name: 'City Center' }),
        createDMChannel({ id: 'dm-1', name: 'Bob' }),
        createDMChannel({ id: 'dm-2', name: 'Charlie' }),
      ];

      render(<ChannelsList />);

      // Verify location channels are grouped
      expect(screen.getByTestId('channel-item-loc-1')).toBeDefined();
      expect(screen.getByTestId('channel-item-loc-2')).toBeDefined();

      // Verify DM channels are grouped
      expect(screen.getByTestId('channel-item-dm-1')).toBeDefined();
      expect(screen.getByTestId('channel-item-dm-2')).toBeDefined();
    });

    it('should show correct count in section headers', () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1' }),
        createLocationChannel({ id: 'loc-2' }),
        createLocationChannel({ id: 'loc-3' }),
        createDMChannel({ id: 'dm-1' }),
      ];

      render(<ChannelsList />);

      // Location section should show (3)
      expect(screen.getByText('(3)')).toBeDefined();
      // DM section should show (1)
      expect(screen.getByText('(1)')).toBeDefined();
    });

    it('should handle channels with unread counts', () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1', unreadCount: 5 }),
        createDMChannel({ id: 'dm-1', unreadCount: 12 }),
      ];

      render(<ChannelsList />);

      // Both channels should render
      expect(screen.getByTestId('channel-item-loc-1')).toBeDefined();
      expect(screen.getByTestId('channel-item-dm-1')).toBeDefined();
    });
  });

  describe('channel selection', () => {
    it('should call onChannelSelect when a channel is clicked', () => {
      const onChannelSelect = vi.fn();
      const channel = createLocationChannel({ id: 'loc-1', name: 'Test Location' });
      mockChannels = [channel];

      render(<ChannelsList onChannelSelect={onChannelSelect} />);

      const channelItem = screen.getByTestId('channel-item-loc-1');
      fireEvent.click(channelItem);

      expect(onChannelSelect).toHaveBeenCalledWith(channel);
    });

    it('should call setActiveChannel when a channel is clicked', () => {
      const channel = createLocationChannel({ id: 'loc-1' });
      mockChannels = [channel];

      render(<ChannelsList />);

      const channelItem = screen.getByTestId('channel-item-loc-1');
      fireEvent.click(channelItem);

      expect(mockSetActiveChannel).toHaveBeenCalledWith('loc-1');
    });

    it('should mark the active channel correctly', () => {
      const channel1 = createLocationChannel({ id: 'loc-1' });
      const channel2 = createLocationChannel({ id: 'loc-2' });
      mockChannels = [channel1, channel2];
      mockActiveChannel = channel1;

      render(<ChannelsList />);

      const activeItem = screen.getByTestId('channel-item-loc-1');
      const inactiveItem = screen.getByTestId('channel-item-loc-2');

      expect(activeItem.getAttribute('data-active')).toBe('true');
      expect(inactiveItem.getAttribute('data-active')).toBe('false');
    });

    it('should handle selecting different channel types', () => {
      const onChannelSelect = vi.fn();
      mockChannels = [
        createLocationChannel({ id: 'loc-1' }),
        createDMChannel({ id: 'dm-1' }),
      ];

      render(<ChannelsList onChannelSelect={onChannelSelect} />);

      // Click location channel
      fireEvent.click(screen.getByTestId('channel-item-loc-1'));
      expect(mockSetActiveChannel).toHaveBeenCalledWith('loc-1');

      // Click DM channel
      fireEvent.click(screen.getByTestId('channel-item-dm-1'));
      expect(mockSetActiveChannel).toHaveBeenCalledWith('dm-1');
    });
  });

  describe('search functionality', () => {
    it('should render search input', () => {
      mockChannels = [createLocationChannel()];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      expect(searchInput).toBeDefined();
    });

    it('should filter channels by name when searching', async () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1', name: 'Downtown SF' }),
        createLocationChannel({ id: 'loc-2', name: 'Marina District' }),
        createDMChannel({ id: 'dm-1', name: 'Alice' }),
      ];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      fireEvent.input(searchInput, { target: { value: 'Downtown' } });

      // Downtown SF should be visible
      expect(screen.queryByTestId('channel-item-loc-1')).not.toBeNull();
      // Marina District and Alice should be hidden
      expect(screen.queryByTestId('channel-item-loc-2')).toBeNull();
      expect(screen.queryByTestId('channel-item-dm-1')).toBeNull();
    });

    it('should filter channels by geohash', () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1', name: 'Area 1', geohash: 'dr5regw' }),
        createLocationChannel({ id: 'loc-2', name: 'Area 2', geohash: 'u4pruydqqvj' }),
      ];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      fireEvent.input(searchInput, { target: { value: 'dr5' } });

      expect(screen.queryByTestId('channel-item-loc-1')).not.toBeNull();
      expect(screen.queryByTestId('channel-item-loc-2')).toBeNull();
    });

    it('should filter channels by description', () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1', name: 'Area 1', description: 'Near the coffee shop' }),
        createLocationChannel({ id: 'loc-2', name: 'Area 2', description: 'By the park' }),
      ];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      fireEvent.input(searchInput, { target: { value: 'coffee' } });

      expect(screen.queryByTestId('channel-item-loc-1')).not.toBeNull();
      expect(screen.queryByTestId('channel-item-loc-2')).toBeNull();
    });

    it('should be case-insensitive when searching', () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1', name: 'DOWNTOWN' }),
        createLocationChannel({ id: 'loc-2', name: 'Uptown' }),
      ];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      fireEvent.input(searchInput, { target: { value: 'downtown' } });

      expect(screen.queryByTestId('channel-item-loc-1')).not.toBeNull();
      expect(screen.queryByTestId('channel-item-loc-2')).toBeNull();
    });

    it('should show clear button when search has text', () => {
      mockChannels = [createLocationChannel()];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      fireEvent.input(searchInput, { target: { value: 'test' } });

      const clearButton = screen.getByLabelText('Clear search');
      expect(clearButton).toBeDefined();
    });

    it('should clear search when clear button is clicked', () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1', name: 'Downtown' }),
        createLocationChannel({ id: 'loc-2', name: 'Uptown' }),
      ];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels') as HTMLInputElement;
      fireEvent.input(searchInput, { target: { value: 'Downtown' } });

      // Only Downtown should be visible
      expect(screen.queryByTestId('channel-item-loc-2')).toBeNull();

      // Click clear
      const clearButton = screen.getByLabelText('Clear search');
      fireEvent.click(clearButton);

      // Both should be visible again
      expect(screen.queryByTestId('channel-item-loc-1')).not.toBeNull();
      expect(screen.queryByTestId('channel-item-loc-2')).not.toBeNull();
    });
  });

  describe('empty states', () => {
    it('should show empty state when no channels exist', () => {
      mockChannels = [];

      render(<ChannelsList />);

      expect(screen.getByText('No Channels')).toBeDefined();
      expect(
        screen.getByText('Join a location-based channel or start a conversation.')
      ).toBeDefined();
    });

    it('should show action button in empty state', () => {
      mockChannels = [];
      const onCreateLocationChannel = vi.fn();

      render(<ChannelsList onCreateLocationChannel={onCreateLocationChannel} />);

      const createButton = screen.getByText('Create Location Channel');
      expect(createButton).toBeDefined();

      fireEvent.click(createButton);
      expect(onCreateLocationChannel).toHaveBeenCalledTimes(1);
    });

    it('should show no results message when search has no matches', () => {
      mockChannels = [
        createLocationChannel({ id: 'loc-1', name: 'Downtown' }),
      ];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      fireEvent.input(searchInput, { target: { value: 'xyz123nonexistent' } });

      expect(screen.getByText('No Results')).toBeDefined();
      expect(screen.getByText(/No channels match "xyz123nonexistent"/)).toBeDefined();
    });

    it('should show placeholder text for empty location section', () => {
      mockChannels = [createDMChannel({ id: 'dm-1' })];

      render(<ChannelsList />);

      expect(screen.getByText('No location channels yet')).toBeDefined();
    });

    it('should show placeholder text for empty DM section', () => {
      mockChannels = [createLocationChannel({ id: 'loc-1' })];

      render(<ChannelsList />);

      expect(screen.getByText('No direct messages yet')).toBeDefined();
    });
  });

  describe('section headers', () => {
    it('should render add button in location channels header', () => {
      mockChannels = [createLocationChannel()];
      const onCreateLocationChannel = vi.fn();

      render(<ChannelsList onCreateLocationChannel={onCreateLocationChannel} />);

      // Find the add button in the location header
      const addButtons = screen.getAllByText('Add');
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('should call onCreateLocationChannel when add button is clicked in location section', () => {
      mockChannels = [createLocationChannel()];
      const onCreateLocationChannel = vi.fn();

      render(<ChannelsList onCreateLocationChannel={onCreateLocationChannel} />);

      // Find the first Add button (location channels)
      const addButtons = screen.getAllByLabelText(/Add|Create location channel/);
      fireEvent.click(addButtons[0]);

      expect(onCreateLocationChannel).toHaveBeenCalledTimes(1);
    });

    it('should call onStartDM when add button is clicked in DM section', () => {
      mockChannels = [createDMChannel()];
      const onStartDM = vi.fn();

      render(<ChannelsList onStartDM={onStartDM} />);

      // Find the Add button with Start new DM label
      const addButton = screen.getByLabelText('Start new DM');
      fireEvent.click(addButton);

      expect(onStartDM).toHaveBeenCalledTimes(1);
    });
  });

  describe('quick action footer', () => {
    it('should render location and DM buttons in footer', () => {
      mockChannels = [];

      render(<ChannelsList />);

      expect(screen.getByText('Location')).toBeDefined();
      expect(screen.getByText('New DM')).toBeDefined();
    });

    it('should call onCreateLocationChannel when location button is clicked', () => {
      const onCreateLocationChannel = vi.fn();
      mockChannels = [];

      render(<ChannelsList onCreateLocationChannel={onCreateLocationChannel} />);

      const locationButton = screen.getByText('Location');
      fireEvent.click(locationButton);

      expect(onCreateLocationChannel).toHaveBeenCalledTimes(1);
    });

    it('should call onStartDM when new DM button is clicked', () => {
      const onStartDM = vi.fn();
      mockChannels = [];

      render(<ChannelsList onStartDM={onStartDM} />);

      const dmButton = screen.getByText('New DM');
      fireEvent.click(dmButton);

      expect(onStartDM).toHaveBeenCalledTimes(1);
    });
  });

  describe('sorting behavior', () => {
    it('should sort pinned channels first', () => {
      const unpinned = createLocationChannel({
        id: 'loc-unpinned',
        name: 'Unpinned',
        isPinned: false,
        lastMessageAt: Date.now(),
      });
      const pinned = createLocationChannel({
        id: 'loc-pinned',
        name: 'Pinned',
        isPinned: true,
        lastMessageAt: Date.now() - 100000,
      });
      mockChannels = [unpinned, pinned];

      const { container } = render(<ChannelsList />);

      const channelItems = container.querySelectorAll('[data-testid^="channel-item-loc"]');
      expect(channelItems.length).toBe(2);

      // Pinned should come first even though it has older lastMessageAt
      expect(channelItems[0].getAttribute('data-testid')).toBe('channel-item-loc-pinned');
      expect(channelItems[1].getAttribute('data-testid')).toBe('channel-item-loc-unpinned');
    });

    it('should sort by last message timestamp within unpinned channels', () => {
      const older = createLocationChannel({
        id: 'loc-older',
        name: 'Older',
        isPinned: false,
        lastMessageAt: Date.now() - 100000,
      });
      const newer = createLocationChannel({
        id: 'loc-newer',
        name: 'Newer',
        isPinned: false,
        lastMessageAt: Date.now(),
      });
      mockChannels = [older, newer];

      const { container } = render(<ChannelsList />);

      const channelItems = container.querySelectorAll('[data-testid^="channel-item-loc"]');

      // Newer should come first
      expect(channelItems[0].getAttribute('data-testid')).toBe('channel-item-loc-newer');
      expect(channelItems[1].getAttribute('data-testid')).toBe('channel-item-loc-older');
    });
  });

  describe('custom className', () => {
    it('should apply custom className to root element', () => {
      mockChannels = [];

      const { container } = render(<ChannelsList class="custom-class" />);

      const root = container.firstElementChild;
      expect(root?.className).toContain('custom-class');
    });
  });

  describe('accessibility', () => {
    it('should have accessible search input', () => {
      mockChannels = [];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      expect(searchInput).toBeDefined();
      expect(searchInput.getAttribute('type')).toBe('text');
    });

    it('should have accessible clear search button', () => {
      mockChannels = [createLocationChannel()];

      render(<ChannelsList />);

      const searchInput = screen.getByLabelText('Search channels');
      fireEvent.input(searchInput, { target: { value: 'test' } });

      const clearButton = screen.getByLabelText('Clear search');
      expect(clearButton).toBeDefined();
    });

    it('should have accessible add buttons', () => {
      mockChannels = [createLocationChannel(), createDMChannel()];

      render(
        <ChannelsList
          onCreateLocationChannel={() => {}}
          onStartDM={() => {}}
        />
      );

      expect(screen.getByLabelText('Create location channel')).toBeDefined();
      expect(screen.getByLabelText('Start new DM')).toBeDefined();
    });
  });
});
