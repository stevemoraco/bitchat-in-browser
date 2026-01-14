/**
 * ChannelItem - Individual channel row component
 *
 * Displays a single channel in the channels list with:
 * - Channel icon (location pin for geo, avatar for DM)
 * - Channel name
 * - Last message preview
 * - Timestamp
 * - Unread count badge
 */

import type { FunctionComponent } from 'preact';
import type { Channel } from '../../stores/types';

// ============================================================================
// Types
// ============================================================================

interface ChannelItemProps {
  /** Channel data */
  channel: Channel;
  /** Whether this channel is currently active/selected */
  isActive?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Last message preview text */
  lastMessagePreview?: string;
}

// ============================================================================
// Icons
// ============================================================================

/** Location pin icon for geo channels */
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

/** User avatar icon for DMs */
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

/** Globe icon for public channels */
const GlobeIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

/** Pin icon for pinned channels */
const PinIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <path d="M16 4V2H8v2H4v2h16V4h-4zM5 6v12c0 1.1.9 2 2 2h2v4l3-3 3 3v-4h2c1.1 0 2-.9 2-2V6H5z" />
  </svg>
);

/** Muted/bell-off icon for muted channels */
const MutedIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
    <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
    <path d="M18 8a6 6 0 0 0-9.33-5" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format timestamp to relative or absolute time
 */
function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'now';
  } else if (minutes < 60) {
    return `${minutes}m`;
  } else if (hours < 24) {
    return `${hours}h`;
  } else if (days < 7) {
    return `${days}d`;
  } 
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
}

/**
 * Truncate text with ellipsis
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)  }...`;
}

/**
 * Get precision label for geohash
 */
function getPrecisionLabel(precision?: number): string {
  if (!precision) return '';
  if (precision <= 3) return 'region';
  if (precision <= 5) return 'city';
  if (precision <= 6) return 'neighborhood';
  return 'local';
}

// ============================================================================
// Component
// ============================================================================

export const ChannelItem: FunctionComponent<ChannelItemProps> = ({
  channel,
  isActive = false,
  onClick,
  lastMessagePreview,
}) => {
  const itemClass = isActive ? 'channel-item-active' : 'channel-item';

  // Select icon based on channel type
  const renderIcon = () => {
    const iconClass = 'channel-icon';

    switch (channel.type) {
      case 'location':
        return <LocationIcon class={iconClass} />;
      case 'dm':
        return <UserIcon class={iconClass} />;
      case 'public':
        return <GlobeIcon class={iconClass} />;
      default:
        return <GlobeIcon class={iconClass} />;
    }
  };

  return (
    <div
      class={itemClass}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      aria-selected={isActive}
      aria-label={`Channel: ${channel.name}${channel.unreadCount > 0 ? `, ${channel.unreadCount} unread messages` : ''}`}
    >
      {/* Channel Icon */}
      <div class="flex-shrink-0">
        {renderIcon()}
      </div>

      {/* Channel Info */}
      <div class="flex-1 min-w-0">
        {/* Channel Name Row */}
        <div class="flex items-center gap-2">
          <span class="channel-name">
            {channel.name}
          </span>

          {/* Status Icons */}
          <div class="flex items-center gap-1 flex-shrink-0">
            {channel.isPinned && (
              <PinIcon class="w-3 h-3 text-terminal-yellow" />
            )}
            {channel.isMuted && (
              <MutedIcon class="w-3 h-3 text-muted" />
            )}
          </div>
        </div>

        {/* Last Message Preview / Location Info */}
        <div class="flex items-center gap-2 mt-0.5">
          {channel.type === 'location' && channel.geohash ? (
            <span class="channel-location">
              [{channel.geohash.slice(0, 6)}] {getPrecisionLabel(channel.geohashPrecision)}
            </span>
          ) : lastMessagePreview ? (
            <span class="text-terminal-xs text-muted truncate">
              {truncate(lastMessagePreview, 40)}
            </span>
          ) : (
            <span class="text-terminal-xs text-muted/50 italic">
              No messages yet
            </span>
          )}
        </div>
      </div>

      {/* Right Side - Time & Badge */}
      <div class="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
        {/* Timestamp */}
        <span class="text-terminal-xs text-muted">
          {formatTimestamp(channel.lastMessageAt)}
        </span>

        {/* Unread Badge */}
        {channel.unreadCount > 0 && !channel.isMuted && (
          <span class="channel-badge">
            {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
          </span>
        )}

        {/* Muted indicator instead of badge */}
        {channel.unreadCount > 0 && channel.isMuted && (
          <span class="w-2 h-2 rounded-full bg-muted" />
        )}
      </div>
    </div>
  );
};

export default ChannelItem;
