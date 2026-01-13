/**
 * ChannelsList - Main channels view component
 *
 * Displays all channels organized by type:
 * - Location Channels
 * - Direct Messages
 *
 * Features:
 * - Search/filter channels
 * - Add new channel button
 * - Section headers
 */

import { FunctionComponent } from 'preact';
import { useState, useMemo, useCallback } from 'preact/hooks';
import {
  useChannelsStore,
  useSortedChannels,
  useActiveChannel,
} from '../../stores/channels-store';
import type { Channel } from '../../stores/types';
import { ChannelItem } from './ChannelItem';

// ============================================================================
// Types
// ============================================================================

interface ChannelsListProps {
  /** Callback when a channel is selected */
  onChannelSelect?: (channel: Channel) => void;
  /** Callback to create a new location channel */
  onCreateLocationChannel?: () => void;
  /** Callback to start a new DM */
  onStartDM?: () => void;
  /** Optional className for styling */
  class?: string;
}

// ============================================================================
// Icons
// ============================================================================

/** Search icon */
const SearchIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/** Plus icon */
const PlusIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/** Location pin icon */
const LocationIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

/** User icon for DMs */
const UserIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/** Clear/X icon */
const ClearIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ============================================================================
// Sub-Components
// ============================================================================

interface SectionHeaderProps {
  title: string;
  icon: FunctionComponent<{ class?: string }>;
  count: number;
  onAdd?: () => void;
  addLabel?: string;
}

const SectionHeader: FunctionComponent<SectionHeaderProps> = ({
  title,
  icon: Icon,
  count,
  onAdd,
  addLabel,
}) => (
  <div class="flex items-center justify-between px-3 py-2 bg-surface/50 border-y border-muted/30">
    <div class="flex items-center gap-2">
      <Icon class="w-4 h-4 text-primary" />
      <span class="text-terminal-sm font-bold text-primary uppercase tracking-wider">
        {title}
      </span>
      <span class="text-terminal-xs text-muted">
        ({count})
      </span>
    </div>
    {onAdd && (
      <button
        type="button"
        onClick={onAdd}
        class="flex items-center gap-1 px-2 py-1 text-terminal-xs text-muted hover:text-primary transition-colors"
        aria-label={addLabel || `Add ${title.toLowerCase()}`}
      >
        <PlusIcon class="w-3 h-3" />
        <span>Add</span>
      </button>
    )}
  </div>
);

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: FunctionComponent<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <div class="empty-state py-8">
    <div class="empty-state-icon">
      <SearchIcon class="w-full h-full" />
    </div>
    <h3 class="empty-state-title">{title}</h3>
    <p class="empty-state-description">{description}</p>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        class="btn-terminal btn-terminal-sm mt-4"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const ChannelsList: FunctionComponent<ChannelsListProps> = ({
  onChannelSelect,
  onCreateLocationChannel,
  onStartDM,
  class: className = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const channels = useSortedChannels();
  const activeChannel = useActiveChannel();
  const setActiveChannel = useChannelsStore((state) => state.setActiveChannel);

  // Filter channels based on search query
  const filteredChannels = useMemo(() => {
    if (!searchQuery.trim()) return channels;

    const query = searchQuery.toLowerCase();
    return channels.filter((channel) => {
      return (
        channel.name.toLowerCase().includes(query) ||
        channel.geohash?.toLowerCase().includes(query) ||
        channel.description?.toLowerCase().includes(query)
      );
    });
  }, [channels, searchQuery]);

  // Group channels by type
  const groupedChannels = useMemo(() => {
    const locationChannels: Channel[] = [];
    const dmChannels: Channel[] = [];
    const publicChannels: Channel[] = [];

    filteredChannels.forEach((channel) => {
      switch (channel.type) {
        case 'location':
          locationChannels.push(channel);
          break;
        case 'dm':
          dmChannels.push(channel);
          break;
        case 'public':
          publicChannels.push(channel);
          break;
      }
    });

    return { locationChannels, dmChannels, publicChannels };
  }, [filteredChannels]);

  // Handle channel selection
  const handleChannelClick = useCallback(
    (channel: Channel) => {
      setActiveChannel(channel.id);
      onChannelSelect?.(channel);
    },
    [setActiveChannel, onChannelSelect]
  );

  // Handle search input
  const handleSearchChange = useCallback((e: Event) => {
    const target = e.target as HTMLInputElement;
    setSearchQuery(target.value);
  }, []);

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  const hasChannels = channels.length > 0;
  const hasFilteredResults = filteredChannels.length > 0;
  const isSearching = searchQuery.trim().length > 0;

  return (
    <div class={`flex flex-col h-full bg-background ${className}`}>
      {/* Search Header */}
      <div class="flex-shrink-0 p-3 border-b border-muted/30">
        <div
          class={`terminal-input-wrapper ${
            isSearchFocused ? 'border-primary' : ''
          }`}
        >
          <SearchIcon class="w-4 h-4 text-muted ml-3" />
          <input
            type="text"
            value={searchQuery}
            onInput={handleSearchChange}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            placeholder="Search channels..."
            class="terminal-input-field"
            aria-label="Search channels"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              class="p-2 text-muted hover:text-primary transition-colors"
              aria-label="Clear search"
            >
              <ClearIcon class="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Channel List */}
      <div class="flex-1 overflow-y-auto">
        {!hasChannels ? (
          // No channels at all
          <EmptyState
            title="No Channels"
            description="Join a location-based channel or start a conversation."
            actionLabel="Create Location Channel"
            onAction={onCreateLocationChannel}
          />
        ) : !hasFilteredResults && isSearching ? (
          // No search results
          <EmptyState
            title="No Results"
            description={`No channels match "${searchQuery}"`}
          />
        ) : (
          // Channel sections
          <div class="pb-4">
            {/* Location Channels Section */}
            {(groupedChannels.locationChannels.length > 0 || !isSearching) && (
              <>
                <SectionHeader
                  title="Location Channels"
                  icon={LocationIcon}
                  count={groupedChannels.locationChannels.length}
                  onAdd={onCreateLocationChannel}
                  addLabel="Create location channel"
                />
                {groupedChannels.locationChannels.length > 0 ? (
                  groupedChannels.locationChannels.map((channel) => (
                    <ChannelItem
                      key={channel.id}
                      channel={channel}
                      isActive={activeChannel?.id === channel.id}
                      onClick={() => handleChannelClick(channel)}
                    />
                  ))
                ) : (
                  <div class="px-3 py-4 text-terminal-sm text-muted/70 text-center">
                    No location channels yet
                  </div>
                )}
              </>
            )}

            {/* Direct Messages Section */}
            {(groupedChannels.dmChannels.length > 0 || !isSearching) && (
              <>
                <SectionHeader
                  title="Direct Messages"
                  icon={UserIcon}
                  count={groupedChannels.dmChannels.length}
                  onAdd={onStartDM}
                  addLabel="Start new DM"
                />
                {groupedChannels.dmChannels.length > 0 ? (
                  groupedChannels.dmChannels.map((channel) => (
                    <ChannelItem
                      key={channel.id}
                      channel={channel}
                      isActive={activeChannel?.id === channel.id}
                      onClick={() => handleChannelClick(channel)}
                    />
                  ))
                ) : (
                  <div class="px-3 py-4 text-terminal-sm text-muted/70 text-center">
                    No direct messages yet
                  </div>
                )}
              </>
            )}

            {/* Public Channels Section (if any exist) */}
            {groupedChannels.publicChannels.length > 0 && (
              <>
                <SectionHeader
                  title="Public Channels"
                  icon={LocationIcon}
                  count={groupedChannels.publicChannels.length}
                />
                {groupedChannels.publicChannels.map((channel) => (
                  <ChannelItem
                    key={channel.id}
                    channel={channel}
                    isActive={activeChannel?.id === channel.id}
                    onClick={() => handleChannelClick(channel)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions Footer */}
      <div class="flex-shrink-0 p-3 border-t border-muted/30 bg-surface/30">
        <div class="flex gap-2">
          <button
            type="button"
            onClick={onCreateLocationChannel}
            class="btn-terminal btn-terminal-sm flex-1"
          >
            <LocationIcon class="w-4 h-4" />
            <span>Location</span>
          </button>
          <button
            type="button"
            onClick={onStartDM}
            class="btn-terminal btn-terminal-sm flex-1"
          >
            <UserIcon class="w-4 h-4" />
            <span>New DM</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelsList;
