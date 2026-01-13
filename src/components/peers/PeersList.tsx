/**
 * PeersList - Main peers view component
 *
 * Displays:
 * - List of known peers
 * - Online/offline status filtering
 * - Search peers functionality
 * - Add peer button
 */

import { FunctionComponent } from 'preact';
import { useState, useMemo, useCallback } from 'preact/hooks';
import {
  usePeers,
  useOnlinePeerCount,
  usePeerCount,
} from '../../stores/peers-store';
import type { Peer } from '../../stores/types';
import { PeerItem } from './PeerItem';

// ============================================================================
// Types
// ============================================================================

type FilterMode = 'all' | 'online' | 'trusted' | 'blocked';

interface PeersListProps {
  /** Callback when a peer is selected */
  onPeerSelect?: (peer: Peer) => void;
  /** Callback when add peer is clicked */
  onAddPeer?: () => void;
  /** Currently selected peer fingerprint */
  selectedFingerprint?: string | null;
}

// ============================================================================
// Filter Tabs Component
// ============================================================================

interface FilterTabsProps {
  activeFilter: FilterMode;
  onFilterChange: (filter: FilterMode) => void;
  counts: {
    all: number;
    online: number;
    trusted: number;
    blocked: number;
  };
}

const FilterTabs: FunctionComponent<FilterTabsProps> = ({
  activeFilter,
  onFilterChange,
  counts,
}) => {
  const tabs: { key: FilterMode; label: string; count: number }[] = [
    { key: 'all', label: 'ALL', count: counts.all },
    { key: 'online', label: 'ONLINE', count: counts.online },
    { key: 'trusted', label: 'TRUSTED', count: counts.trusted },
    { key: 'blocked', label: 'BLOCKED', count: counts.blocked },
  ];

  return (
    <div class="flex border-b border-muted">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          class={`flex-1 px-2 py-2 text-terminal-xs font-mono transition-colors ${
            activeFilter === tab.key
              ? 'text-primary border-b-2 border-primary bg-primary/5'
              : 'text-muted hover:text-text hover:bg-surface'
          }`}
          onClick={() => onFilterChange(tab.key)}
        >
          {tab.label}
          <span class="ml-1 opacity-60">({tab.count})</span>
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// Search Input Component
// ============================================================================

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchInput: FunctionComponent<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search peers...',
}) => {
  return (
    <div class="terminal-input-wrapper">
      <span class="terminal-input-prefix">&gt;</span>
      <input
        type="text"
        class="terminal-input-field"
        placeholder={placeholder}
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        aria-label="Search peers"
      />
      {value && (
        <button
          class="px-2 text-muted hover:text-text"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          [x]
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  filter: FilterMode;
  searchQuery: string;
  onAddPeer?: () => void;
}

const EmptyState: FunctionComponent<EmptyStateProps> = ({
  filter,
  searchQuery,
  onAddPeer,
}) => {
  if (searchQuery) {
    return (
      <div class="empty-state">
        <div class="empty-state-icon text-2xl">[?]</div>
        <h3 class="empty-state-title">No matches found</h3>
        <p class="empty-state-description">
          No peers match "{searchQuery}". Try a different search term.
        </p>
      </div>
    );
  }

  const messages: Record<FilterMode, { title: string; desc: string }> = {
    all: {
      title: 'No peers yet',
      desc: 'Add your first peer to start messaging securely.',
    },
    online: {
      title: 'No peers online',
      desc: 'None of your peers are currently online.',
    },
    trusted: {
      title: 'No trusted peers',
      desc: 'Verify peers to mark them as trusted.',
    },
    blocked: {
      title: 'No blocked peers',
      desc: 'You have not blocked any peers.',
    },
  };

  const { title, desc } = messages[filter];

  return (
    <div class="empty-state">
      <div class="empty-state-icon text-2xl">[ ]</div>
      <h3 class="empty-state-title">{title}</h3>
      <p class="empty-state-description">{desc}</p>
      {filter === 'all' && onAddPeer && (
        <button class="btn-terminal mt-4" onClick={onAddPeer}>
          + Add Peer
        </button>
      )}
    </div>
  );
};

// ============================================================================
// PeersList Component
// ============================================================================

export const PeersList: FunctionComponent<PeersListProps> = ({
  onPeerSelect,
  onAddPeer,
  selectedFingerprint = null,
}) => {
  const [filter, setFilter] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get peers from store
  const allPeers = usePeers();
  const peerCount = usePeerCount();
  const onlineCount = useOnlinePeerCount();

  // Calculate filter counts
  const counts = useMemo(() => {
    const trusted = allPeers.filter((p) => p.isTrusted).length;
    const blocked = allPeers.filter((p) => p.isBlocked).length;
    return {
      all: peerCount,
      online: onlineCount,
      trusted,
      blocked,
    };
  }, [allPeers, peerCount, onlineCount]);

  // Filter and search peers
  const filteredPeers = useMemo(() => {
    let peers = allPeers;

    // Apply filter
    switch (filter) {
      case 'online':
        peers = peers.filter((p) => p.status === 'online');
        break;
      case 'trusted':
        peers = peers.filter((p) => p.isTrusted);
        break;
      case 'blocked':
        peers = peers.filter((p) => p.isBlocked);
        break;
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      peers = peers.filter(
        (p) =>
          p.nickname.toLowerCase().includes(query) ||
          p.fingerprint.toLowerCase().includes(query) ||
          p.nip05?.toLowerCase().includes(query)
      );
    }

    // Sort: online first, then by last seen
    return peers.sort((a, b) => {
      // Online peers first
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (b.status === 'online' && a.status !== 'online') return 1;
      // Then by last seen (most recent first)
      return b.lastSeenAt - a.lastSeenAt;
    });
  }, [allPeers, filter, searchQuery]);

  const handlePeerClick = useCallback(
    (peer: Peer) => {
      if (onPeerSelect) {
        onPeerSelect(peer);
      }
    },
    [onPeerSelect]
  );

  return (
    <div class="flex flex-col h-full bg-background">
      {/* Header */}
      <div class="px-4 py-3 border-b border-muted">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-terminal-lg font-bold text-primary">
            &gt; Peers
          </h2>
          {onAddPeer && (
            <button
              class="btn-terminal btn-terminal-sm"
              onClick={onAddPeer}
              aria-label="Add peer"
            >
              + ADD
            </button>
          )}
        </div>

        {/* Search */}
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by name or fingerprint..."
        />
      </div>

      {/* Filter tabs */}
      <FilterTabs
        activeFilter={filter}
        onFilterChange={setFilter}
        counts={counts}
      />

      {/* Peers list */}
      <div class="flex-1 overflow-y-auto">
        {filteredPeers.length === 0 ? (
          <EmptyState filter={filter} searchQuery={searchQuery} onAddPeer={onAddPeer} />
        ) : (
          <div class="divide-y divide-muted/20">
            {filteredPeers.map((peer) => (
              <PeerItem
                key={peer.fingerprint}
                peer={peer}
                isSelected={peer.fingerprint === selectedFingerprint}
                onClick={handlePeerClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div class="px-4 py-2 border-t border-muted bg-surface">
        <div class="flex items-center justify-between text-terminal-xs text-muted">
          <span>
            {counts.online} online / {counts.all} total
          </span>
          <span>
            {counts.trusted} trusted
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export type { PeersListProps, FilterMode };
