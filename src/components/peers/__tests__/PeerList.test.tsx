/**
 * PeersList Component Tests
 *
 * Tests for the main peers view component including:
 * - List rendering with various peer states
 * - Filter tabs (All, Online, Trusted, Blocked)
 * - Search functionality
 * - Peer selection behavior
 * - Empty states for each filter
 * - Sorting (online first, then by last seen)
 * - Footer statistics
 * - Add peer button
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { PeersList } from '../PeersList';
import type { Peer, PeerStatus, PeerSource } from '../../../stores/types';

// ============================================================================
// Mock Data Factories
// ============================================================================

function createMockPeer(overrides: Partial<Peer> = {}): Peer {
  const fingerprint =
    overrides.fingerprint ?? `fp-${Math.random().toString(36).slice(2, 10)}`;
  return {
    fingerprint,
    publicKey: overrides.publicKey ?? `pubkey-${fingerprint}`,
    nickname: overrides.nickname ?? `Peer ${fingerprint.slice(0, 6)}`,
    status: overrides.status ?? 'offline',
    lastSeenAt: overrides.lastSeenAt ?? Date.now(),
    source: overrides.source ?? 'nostr',
    isTrusted: overrides.isTrusted ?? false,
    isBlocked: overrides.isBlocked ?? false,
    notes: overrides.notes,
    avatar: overrides.avatar,
    nip05: overrides.nip05,
  };
}

function createOnlinePeer(overrides: Partial<Peer> = {}): Peer {
  return createMockPeer({
    status: 'online',
    lastSeenAt: Date.now(),
    ...overrides,
  });
}

function createTrustedPeer(overrides: Partial<Peer> = {}): Peer {
  return createMockPeer({
    isTrusted: true,
    ...overrides,
  });
}

function createBlockedPeer(overrides: Partial<Peer> = {}): Peer {
  return createMockPeer({
    isBlocked: true,
    ...overrides,
  });
}

// ============================================================================
// Mock Store Setup
// ============================================================================

let mockPeers: Peer[] = [];

vi.mock('../../../stores/peers-store', () => ({
  usePeers: () => mockPeers,
  usePeerCount: () => mockPeers.length,
  useOnlinePeerCount: () => mockPeers.filter((p) => p.status === 'online').length,
}));

// Mock PeerItem to simplify testing
vi.mock('../PeerItem', () => ({
  PeerItem: ({
    peer,
    isSelected,
    onClick,
  }: {
    peer: Peer;
    isSelected: boolean;
    onClick: (peer: Peer) => void;
  }) =>
    h(
      'div',
      {
        'data-testid': `peer-item-${peer.fingerprint}`,
        'data-selected': isSelected,
        'data-status': peer.status,
        'data-trusted': peer.isTrusted,
        'data-blocked': peer.isBlocked,
        onClick: () => onClick(peer),
        role: 'button',
      },
      peer.nickname
    ),
}));

// ============================================================================
// Tests
// ============================================================================

describe('PeersList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPeers = [];
  });

  afterEach(() => {
    cleanup();
  });

  describe('basic rendering', () => {
    it('should render the header with title', () => {
      render(<PeersList />);

      expect(screen.getByText('> Peers')).toBeDefined();
    });

    it('should render search input', () => {
      render(<PeersList />);

      expect(screen.getByLabelText('Search peers')).toBeDefined();
    });

    it('should render filter tabs', () => {
      render(<PeersList />);

      expect(screen.getByText('ALL')).toBeDefined();
      expect(screen.getByText('ONLINE')).toBeDefined();
      expect(screen.getByText('TRUSTED')).toBeDefined();
      expect(screen.getByText('BLOCKED')).toBeDefined();
    });

    it('should render add peer button when onAddPeer is provided', () => {
      render(<PeersList onAddPeer={() => {}} />);

      expect(screen.getByLabelText('Add peer')).toBeDefined();
      expect(screen.getByText('+ ADD')).toBeDefined();
    });

    it('should not render add peer button when onAddPeer is not provided', () => {
      render(<PeersList />);

      expect(screen.queryByLabelText('Add peer')).toBeNull();
    });
  });

  describe('list rendering', () => {
    it('should render all peers', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', nickname: 'Alice' }),
        createMockPeer({ fingerprint: 'fp-2', nickname: 'Bob' }),
        createMockPeer({ fingerprint: 'fp-3', nickname: 'Charlie' }),
      ];

      render(<PeersList />);

      expect(screen.getByTestId('peer-item-fp-1')).toBeDefined();
      expect(screen.getByTestId('peer-item-fp-2')).toBeDefined();
      expect(screen.getByTestId('peer-item-fp-3')).toBeDefined();
    });

    it('should render peers with different statuses', () => {
      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-online', nickname: 'Online User' }),
        createMockPeer({
          fingerprint: 'fp-offline',
          nickname: 'Offline User',
          status: 'offline',
        }),
        createMockPeer({
          fingerprint: 'fp-away',
          nickname: 'Away User',
          status: 'away',
        }),
      ];

      render(<PeersList />);

      const onlineItem = screen.getByTestId('peer-item-fp-online');
      const offlineItem = screen.getByTestId('peer-item-fp-offline');
      const awayItem = screen.getByTestId('peer-item-fp-away');

      expect(onlineItem.getAttribute('data-status')).toBe('online');
      expect(offlineItem.getAttribute('data-status')).toBe('offline');
      expect(awayItem.getAttribute('data-status')).toBe('away');
    });
  });

  describe('peer selection', () => {
    it('should call onPeerSelect when a peer is clicked', () => {
      const onPeerSelect = vi.fn();
      const peer = createMockPeer({ fingerprint: 'fp-1', nickname: 'Alice' });
      mockPeers = [peer];

      render(<PeersList onPeerSelect={onPeerSelect} />);

      const peerItem = screen.getByTestId('peer-item-fp-1');
      fireEvent.click(peerItem);

      expect(onPeerSelect).toHaveBeenCalledWith(peer);
    });

    it('should mark the selected peer correctly', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1' }),
        createMockPeer({ fingerprint: 'fp-2' }),
      ];

      render(<PeersList selectedFingerprint="fp-1" />);

      const selectedItem = screen.getByTestId('peer-item-fp-1');
      const unselectedItem = screen.getByTestId('peer-item-fp-2');

      expect(selectedItem.getAttribute('data-selected')).toBe('true');
      expect(unselectedItem.getAttribute('data-selected')).toBe('false');
    });

    it('should handle null selectedFingerprint', () => {
      mockPeers = [createMockPeer({ fingerprint: 'fp-1' })];

      render(<PeersList selectedFingerprint={null} />);

      const item = screen.getByTestId('peer-item-fp-1');
      expect(item.getAttribute('data-selected')).toBe('false');
    });
  });

  describe('filter tabs', () => {
    it('should show all peers by default (ALL filter)', () => {
      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-online' }),
        createMockPeer({ fingerprint: 'fp-offline', status: 'offline' }),
        createTrustedPeer({ fingerprint: 'fp-trusted' }),
        createBlockedPeer({ fingerprint: 'fp-blocked' }),
      ];

      render(<PeersList />);

      expect(screen.getByTestId('peer-item-fp-online')).toBeDefined();
      expect(screen.getByTestId('peer-item-fp-offline')).toBeDefined();
      expect(screen.getByTestId('peer-item-fp-trusted')).toBeDefined();
      expect(screen.getByTestId('peer-item-fp-blocked')).toBeDefined();
    });

    it('should filter to only online peers when ONLINE tab is clicked', () => {
      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-online', nickname: 'Online User' }),
        createMockPeer({
          fingerprint: 'fp-offline',
          nickname: 'Offline User',
          status: 'offline',
        }),
      ];

      render(<PeersList />);

      const onlineTab = screen.getByText('ONLINE');
      fireEvent.click(onlineTab);

      expect(screen.queryByTestId('peer-item-fp-online')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-offline')).toBeNull();
    });

    it('should filter to only trusted peers when TRUSTED tab is clicked', () => {
      mockPeers = [
        createTrustedPeer({ fingerprint: 'fp-trusted' }),
        createMockPeer({ fingerprint: 'fp-untrusted', isTrusted: false }),
      ];

      render(<PeersList />);

      const trustedTab = screen.getByText('TRUSTED');
      fireEvent.click(trustedTab);

      expect(screen.queryByTestId('peer-item-fp-trusted')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-untrusted')).toBeNull();
    });

    it('should filter to only blocked peers when BLOCKED tab is clicked', () => {
      mockPeers = [
        createBlockedPeer({ fingerprint: 'fp-blocked' }),
        createMockPeer({ fingerprint: 'fp-unblocked', isBlocked: false }),
      ];

      render(<PeersList />);

      const blockedTab = screen.getByText('BLOCKED');
      fireEvent.click(blockedTab);

      expect(screen.queryByTestId('peer-item-fp-blocked')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-unblocked')).toBeNull();
    });

    it('should switch back to ALL filter', () => {
      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-online' }),
        createMockPeer({ fingerprint: 'fp-offline', status: 'offline' }),
      ];

      render(<PeersList />);

      // Switch to ONLINE
      fireEvent.click(screen.getByText('ONLINE'));
      expect(screen.queryByTestId('peer-item-fp-offline')).toBeNull();

      // Switch back to ALL
      fireEvent.click(screen.getByText('ALL'));
      expect(screen.queryByTestId('peer-item-fp-offline')).not.toBeNull();
    });

    it('should show correct counts in filter tabs', () => {
      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-1' }),
        createOnlinePeer({ fingerprint: 'fp-2' }),
        createMockPeer({ fingerprint: 'fp-3', status: 'offline' }),
        createTrustedPeer({ fingerprint: 'fp-4' }),
        createBlockedPeer({ fingerprint: 'fp-5' }),
      ];

      render(<PeersList />);

      // ALL should show (5)
      expect(screen.getByText('(5)')).toBeDefined();
      // ONLINE should show (2)
      expect(screen.getByText('(2)')).toBeDefined();
      // TRUSTED should show (1)
      // BLOCKED should show (1)
      const oneCountElements = screen.getAllByText('(1)');
      expect(oneCountElements.length).toBe(2); // trusted and blocked
    });
  });

  describe('search functionality', () => {
    it('should filter peers by nickname', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', nickname: 'Alice' }),
        createMockPeer({ fingerprint: 'fp-2', nickname: 'Bob' }),
        createMockPeer({ fingerprint: 'fp-3', nickname: 'Charlie' }),
      ];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'Alice' } });

      expect(screen.queryByTestId('peer-item-fp-1')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-2')).toBeNull();
      expect(screen.queryByTestId('peer-item-fp-3')).toBeNull();
    });

    it('should filter peers by fingerprint', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'abc123def456', nickname: 'Peer 1' }),
        createMockPeer({ fingerprint: 'xyz789ghi012', nickname: 'Peer 2' }),
      ];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'abc123' } });

      expect(screen.queryByTestId('peer-item-abc123def456')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-xyz789ghi012')).toBeNull();
    });

    it('should filter peers by NIP-05 identifier', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', nip05: 'alice@example.com' }),
        createMockPeer({ fingerprint: 'fp-2', nip05: 'bob@different.org' }),
      ];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'example.com' } });

      expect(screen.queryByTestId('peer-item-fp-1')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-2')).toBeNull();
    });

    it('should be case-insensitive', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', nickname: 'ALICE' }),
        createMockPeer({ fingerprint: 'fp-2', nickname: 'bob' }),
      ];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'alice' } });

      expect(screen.queryByTestId('peer-item-fp-1')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-2')).toBeNull();
    });

    it('should show clear button when search has text', () => {
      mockPeers = [createMockPeer()];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'test' } });

      expect(screen.getByLabelText('Clear search')).toBeDefined();
    });

    it('should clear search when clear button is clicked', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', nickname: 'Alice' }),
        createMockPeer({ fingerprint: 'fp-2', nickname: 'Bob' }),
      ];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'Alice' } });

      // Only Alice should be visible
      expect(screen.queryByTestId('peer-item-fp-2')).toBeNull();

      // Click clear
      const clearButton = screen.getByLabelText('Clear search');
      fireEvent.click(clearButton);

      // Both should be visible again
      expect(screen.queryByTestId('peer-item-fp-1')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-2')).not.toBeNull();
    });

    it('should combine search with filter tabs', () => {
      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-1', nickname: 'Alice Online' }),
        createOnlinePeer({ fingerprint: 'fp-2', nickname: 'Bob Online' }),
        createMockPeer({
          fingerprint: 'fp-3',
          nickname: 'Alice Offline',
          status: 'offline',
        }),
      ];

      render(<PeersList />);

      // First filter to online
      fireEvent.click(screen.getByText('ONLINE'));

      // Then search for Alice
      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'Alice' } });

      // Only Alice Online should be visible
      expect(screen.queryByTestId('peer-item-fp-1')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-2')).toBeNull(); // Bob filtered
      expect(screen.queryByTestId('peer-item-fp-3')).toBeNull(); // Alice Offline filtered
    });
  });

  describe('empty states', () => {
    it('should show empty state when no peers exist', () => {
      mockPeers = [];

      render(<PeersList />);

      expect(screen.getByText('No peers yet')).toBeDefined();
      expect(
        screen.getByText('Add your first peer to start messaging securely.')
      ).toBeDefined();
    });

    it('should show Add Peer button in empty state when onAddPeer is provided', () => {
      const onAddPeer = vi.fn();
      mockPeers = [];

      render(<PeersList onAddPeer={onAddPeer} />);

      const addButton = screen.getByText('+ Add Peer');
      expect(addButton).toBeDefined();

      fireEvent.click(addButton);
      expect(onAddPeer).toHaveBeenCalledTimes(1);
    });

    it('should show empty state for ONLINE filter with no online peers', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', status: 'offline' }),
        createMockPeer({ fingerprint: 'fp-2', status: 'offline' }),
      ];

      render(<PeersList />);

      fireEvent.click(screen.getByText('ONLINE'));

      expect(screen.getByText('No peers online')).toBeDefined();
      expect(
        screen.getByText('None of your peers are currently online.')
      ).toBeDefined();
    });

    it('should show empty state for TRUSTED filter with no trusted peers', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', isTrusted: false }),
        createMockPeer({ fingerprint: 'fp-2', isTrusted: false }),
      ];

      render(<PeersList />);

      fireEvent.click(screen.getByText('TRUSTED'));

      expect(screen.getByText('No trusted peers')).toBeDefined();
      expect(
        screen.getByText('Verify peers to mark them as trusted.')
      ).toBeDefined();
    });

    it('should show empty state for BLOCKED filter with no blocked peers', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', isBlocked: false }),
        createMockPeer({ fingerprint: 'fp-2', isBlocked: false }),
      ];

      render(<PeersList />);

      fireEvent.click(screen.getByText('BLOCKED'));

      expect(screen.getByText('No blocked peers')).toBeDefined();
      expect(screen.getByText('You have not blocked any peers.')).toBeDefined();
    });

    it('should show no matches message when search has no results', () => {
      mockPeers = [createMockPeer({ fingerprint: 'fp-1', nickname: 'Alice' })];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No matches found')).toBeDefined();
      expect(
        screen.getByText(/No peers match "nonexistent"/)
      ).toBeDefined();
    });
  });

  describe('sorting', () => {
    it('should sort online peers first', () => {
      const now = Date.now();
      mockPeers = [
        createMockPeer({
          fingerprint: 'fp-offline-1',
          nickname: 'Offline User',
          status: 'offline',
          lastSeenAt: now - 1000, // More recent but offline
        }),
        createOnlinePeer({
          fingerprint: 'fp-online-1',
          nickname: 'Online User',
          lastSeenAt: now - 10000, // Less recent but online
        }),
      ];

      const { container } = render(<PeersList />);

      const peerItems = container.querySelectorAll('[data-testid^="peer-item-"]');
      expect(peerItems.length).toBe(2);

      // Online should be first
      expect(peerItems[0].getAttribute('data-testid')).toBe('peer-item-fp-online-1');
      expect(peerItems[1].getAttribute('data-testid')).toBe('peer-item-fp-offline-1');
    });

    it('should sort by lastSeenAt within same status', () => {
      const now = Date.now();
      mockPeers = [
        createMockPeer({
          fingerprint: 'fp-older',
          nickname: 'Older',
          status: 'offline',
          lastSeenAt: now - 100000,
        }),
        createMockPeer({
          fingerprint: 'fp-newer',
          nickname: 'Newer',
          status: 'offline',
          lastSeenAt: now - 1000,
        }),
      ];

      const { container } = render(<PeersList />);

      const peerItems = container.querySelectorAll('[data-testid^="peer-item-"]');

      // More recently seen should be first
      expect(peerItems[0].getAttribute('data-testid')).toBe('peer-item-fp-newer');
      expect(peerItems[1].getAttribute('data-testid')).toBe('peer-item-fp-older');
    });
  });

  describe('footer statistics', () => {
    it('should show online and total peer counts', () => {
      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-1' }),
        createOnlinePeer({ fingerprint: 'fp-2' }),
        createMockPeer({ fingerprint: 'fp-3', status: 'offline' }),
        createMockPeer({ fingerprint: 'fp-4', status: 'offline' }),
        createMockPeer({ fingerprint: 'fp-5', status: 'offline' }),
      ];

      render(<PeersList />);

      expect(screen.getByText('2 online / 5 total')).toBeDefined();
    });

    it('should show trusted peer count', () => {
      mockPeers = [
        createTrustedPeer({ fingerprint: 'fp-1' }),
        createTrustedPeer({ fingerprint: 'fp-2' }),
        createTrustedPeer({ fingerprint: 'fp-3' }),
        createMockPeer({ fingerprint: 'fp-4', isTrusted: false }),
      ];

      render(<PeersList />);

      expect(screen.getByText('3 trusted')).toBeDefined();
    });

    it('should update stats with correct counts when peers change', () => {
      mockPeers = [];

      const { rerender } = render(<PeersList />);

      expect(screen.getByText('0 online / 0 total')).toBeDefined();

      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-1' }),
        createMockPeer({ fingerprint: 'fp-2', status: 'offline' }),
      ];

      rerender(<PeersList />);

      expect(screen.getByText('1 online / 2 total')).toBeDefined();
    });
  });

  describe('add peer button', () => {
    it('should call onAddPeer when header add button is clicked', () => {
      const onAddPeer = vi.fn();
      mockPeers = [];

      render(<PeersList onAddPeer={onAddPeer} />);

      const addButton = screen.getByLabelText('Add peer');
      fireEvent.click(addButton);

      expect(onAddPeer).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should have accessible search input', () => {
      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      expect(searchInput).toBeDefined();
      expect(searchInput.getAttribute('type')).toBe('text');
    });

    it('should have accessible clear search button', () => {
      mockPeers = [createMockPeer()];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: 'test' } });

      const clearButton = screen.getByLabelText('Clear search');
      expect(clearButton).toBeDefined();
    });

    it('should have accessible add peer button', () => {
      render(<PeersList onAddPeer={() => {}} />);

      expect(screen.getByLabelText('Add peer')).toBeDefined();
    });

    it('should use semantic list structure', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1' }),
        createMockPeer({ fingerprint: 'fp-2' }),
      ];

      const { container } = render(<PeersList />);

      // Should have a container div with divide classes for visual separation
      const listContainer = container.querySelector('.divide-y');
      expect(listContainer).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle peer with no NIP-05 in search', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', nickname: 'Alice', nip05: undefined }),
      ];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      // Searching for a domain should not crash
      expect(() => {
        fireEvent.input(searchInput, { target: { value: '@example.com' } });
      }).not.toThrow();
    });

    it('should handle rapid filter switching', () => {
      mockPeers = [
        createOnlinePeer({ fingerprint: 'fp-1' }),
        createTrustedPeer({ fingerprint: 'fp-2' }),
        createBlockedPeer({ fingerprint: 'fp-3' }),
      ];

      render(<PeersList />);

      // Rapidly switch filters
      fireEvent.click(screen.getByText('ONLINE'));
      fireEvent.click(screen.getByText('TRUSTED'));
      fireEvent.click(screen.getByText('BLOCKED'));
      fireEvent.click(screen.getByText('ALL'));

      // Should settle on ALL filter showing all peers
      expect(screen.queryByTestId('peer-item-fp-1')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-2')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-3')).not.toBeNull();
    });

    it('should handle empty search string', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', nickname: 'Alice' }),
        createMockPeer({ fingerprint: 'fp-2', nickname: 'Bob' }),
      ];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');

      // Type and clear
      fireEvent.input(searchInput, { target: { value: 'Alice' } });
      fireEvent.input(searchInput, { target: { value: '' } });

      // Both should be visible
      expect(screen.queryByTestId('peer-item-fp-1')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-2')).not.toBeNull();
    });

    it('should handle whitespace-only search', () => {
      mockPeers = [
        createMockPeer({ fingerprint: 'fp-1', nickname: 'Alice' }),
        createMockPeer({ fingerprint: 'fp-2', nickname: 'Bob' }),
      ];

      render(<PeersList />);

      const searchInput = screen.getByLabelText('Search peers');
      fireEvent.input(searchInput, { target: { value: '   ' } });

      // Both should still be visible (whitespace is trimmed)
      expect(screen.queryByTestId('peer-item-fp-1')).not.toBeNull();
      expect(screen.queryByTestId('peer-item-fp-2')).not.toBeNull();
    });
  });
});
