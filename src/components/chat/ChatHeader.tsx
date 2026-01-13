/**
 * ChatHeader - Channel/conversation header component
 *
 * Displays:
 * - Channel/peer name
 * - Online status for DMs
 * - Channel info button
 * - Back button for mobile
 */

import { FunctionComponent } from 'preact';
import type { Channel, Peer } from '../../stores/types';

// ============================================================================
// Types
// ============================================================================

export interface ChatHeaderProps {
  /** The current channel */
  channel: Channel;
  /** For DM channels, the peer information */
  peer?: Peer;
  /** Whether user is online (for DMs) */
  isOnline?: boolean;
  /** Callback when back button is pressed (mobile) */
  onBack?: () => void;
  /** Callback when info button is pressed */
  onInfo?: () => void;
  /** Whether to show back button */
  showBack?: boolean;
}

// ============================================================================
// Icons
// ============================================================================

const BackIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
      clip-rule="evenodd"
    />
  </svg>
);

const InfoIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061.75.75 0 011.06 1.06zm.969 6.625a.75.75 0 01-.75-.75v-3.5a.75.75 0 111.5 0v3.5a.75.75 0 01-.75.75zm-.75-7.75a.75.75 0 011.5 0v.25a.75.75 0 01-1.5 0v-.25z"
      clip-rule="evenodd"
    />
  </svg>
);

const LocationIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.018.008.006.003zM10 11.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z"
      clip-rule="evenodd"
    />
  </svg>
);

const HashIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M9.493 2.853a.75.75 0 00-1.486-.205L7.545 6H4.198a.75.75 0 000 1.5h3.14l-.69 5H3.302a.75.75 0 000 1.5h3.14l-.435 3.148a.75.75 0 001.486.205L7.955 14h4.997l-.435 3.148a.75.75 0 001.486.205L14.465 14h3.337a.75.75 0 000-1.5h-3.13l.69-5h3.346a.75.75 0 000-1.5h-3.14l.435-3.147a.75.75 0 00-1.486-.205L14.045 6H9.048l.435-3.147zM8.841 7.5l-.69 5h4.997l.69-5H8.84z"
      clip-rule="evenodd"
    />
  </svg>
);

const UserIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" />
  </svg>
);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the icon for a channel type
 */
const getChannelIcon = (type: Channel['type']) => {
  switch (type) {
    case 'location':
      return LocationIcon;
    case 'dm':
      return UserIcon;
    case 'public':
    default:
      return HashIcon;
  }
};

/**
 * Format channel subtitle/description
 */
const getChannelSubtitle = (channel: Channel, peer?: Peer): string => {
  if (channel.type === 'dm' && peer) {
    return `${peer.fingerprint.slice(0, 8)}...`;
  }

  if (channel.type === 'location' && channel.geohash) {
    return `geohash: ${channel.geohash}`;
  }

  if (channel.description) {
    return channel.description;
  }

  return '';
};

// ============================================================================
// Component
// ============================================================================

export const ChatHeader: FunctionComponent<ChatHeaderProps> = ({
  channel,
  peer,
  isOnline,
  onBack,
  onInfo,
  showBack = false,
}) => {
  const ChannelIcon = getChannelIcon(channel.type);
  const subtitle = getChannelSubtitle(channel, peer);
  const isDM = channel.type === 'dm';

  return (
    <header class="flex items-center gap-3 px-3 py-2 border-b border-muted bg-background safe-top">
      {/* Back button (mobile) */}
      {showBack && (
        <button
          type="button"
          onClick={onBack}
          class="flex-shrink-0 w-8 h-8 flex items-center justify-center text-muted hover:text-primary transition-colors"
          aria-label="Go back"
        >
          <BackIcon class="w-5 h-5" />
        </button>
      )}

      {/* Channel icon with online indicator */}
      <div class="relative flex-shrink-0">
        <div class="w-9 h-9 flex items-center justify-center bg-surface rounded-terminal border border-muted">
          <ChannelIcon class="w-5 h-5 text-primary" />
        </div>

        {/* Online status indicator for DMs */}
        {isDM && (
          <div
            class={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${
              isOnline ? 'bg-primary' : 'bg-muted'
            }`}
            style={isOnline ? { boxShadow: '0 0 6px var(--color-primary)' } : {}}
            title={isOnline ? 'Online' : 'Offline'}
          />
        )}
      </div>

      {/* Channel name and subtitle */}
      <div class="flex-1 min-w-0">
        <h1 class="text-terminal-base font-bold text-primary truncate">
          {isDM && peer ? peer.nickname : channel.name}
        </h1>
        {subtitle && (
          <p class="text-terminal-xs text-muted truncate font-mono">
            {isDM && isOnline !== undefined && (
              <span class={isOnline ? 'text-primary' : 'text-muted'}>
                {isOnline ? 'online' : 'offline'}
                {subtitle && ' | '}
              </span>
            )}
            {subtitle}
          </p>
        )}
      </div>

      {/* Info button */}
      {onInfo && (
        <button
          type="button"
          onClick={onInfo}
          class="flex-shrink-0 w-8 h-8 flex items-center justify-center text-muted hover:text-primary transition-colors"
          aria-label="Channel info"
        >
          <InfoIcon class="w-5 h-5" />
        </button>
      )}
    </header>
  );
};

export default ChatHeader;
