/**
 * ChannelBadge Component - BitChat In Browser
 *
 * Displays the current channel name/geohash with a dropdown indicator.
 * Tap opens the channel selector sheet.
 */

import type { FunctionComponent } from 'preact';
import { useActiveChannel } from '../../stores/channels-store';
import { useNavigationStore } from '../../stores/navigation-store';

// ============================================================================
// Types
// ============================================================================

interface ChannelBadgeProps {
  /** Optional class name for styling */
  className?: string;
}

// ============================================================================
// ChannelBadge Component
// ============================================================================

export const ChannelBadge: FunctionComponent<ChannelBadgeProps> = ({
  className = '',
}) => {
  const activeChannel = useActiveChannel();
  const openChannels = useNavigationStore((state) => state.openChannels);

  // Determine display name
  const getDisplayName = (): string => {
    if (!activeChannel) {
      return 'No Channel';
    }

    // For location channels, show geohash
    if (activeChannel.type === 'location' && activeChannel.geohash) {
      return activeChannel.geohash;
    }

    // For DM channels, show "DM" or peer name
    if (activeChannel.type === 'dm') {
      return 'DM';
    }

    // For other channels, show name (truncated if needed)
    const name = activeChannel.name || 'Channel';
    return name.length > 12 ? `${name.slice(0, 10)}...` : name;
  };

  const handleClick = () => {
    openChannels();
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-terminal-green/10 hover:bg-terminal-green/20 active:bg-terminal-green/30 transition-colors ${className}`}
      aria-label="Select channel"
      aria-haspopup="dialog"
    >
      <span className="text-terminal-green font-medium text-sm">
        {getDisplayName()}
      </span>
      {/* Dropdown arrow */}
      <svg
        className="w-3 h-3 text-terminal-green/70"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );
};

export default ChannelBadge;
