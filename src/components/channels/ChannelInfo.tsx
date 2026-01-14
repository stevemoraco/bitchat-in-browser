/**
 * ChannelInfo - Channel details modal/page component
 *
 * Displays detailed information about a channel:
 * - Channel name and type
 * - Member count for location channels
 * - Geohash display and coverage info
 * - Pin/mute toggles
 * - Leave channel option
 */

import type { FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useChannelsStore, useChannel } from '../../stores/channels-store';
import type { Channel } from '../../stores/types';

// ============================================================================
// Types
// ============================================================================

interface ChannelInfoProps {
  /** Channel ID to display */
  channelId: string;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Whether the modal is visible */
  isOpen?: boolean;
  /** Optional member count (would come from relay/network) */
  memberCount?: number;
}

// ============================================================================
// Icons
// ============================================================================

/** Close/X icon */
const CloseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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

/** User icon */
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

/** Globe icon */
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

/** Users/members icon */
const UsersIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/** Pin icon */
const PinIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z" />
  </svg>
);

/** Bell/notification icon */
const BellIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

/** Bell off/muted icon */
const BellOffIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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

/** Trash/leave icon */
const TrashIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="3,6 5,6 21,6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

/** Hash icon for geohash */
const HashIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="4" y1="9" x2="20" y2="9" />
    <line x1="4" y1="15" x2="20" y2="15" />
    <line x1="10" y1="3" x2="8" y2="21" />
    <line x1="16" y1="3" x2="14" y2="21" />
  </svg>
);

/** Calendar icon */
const CalendarIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get precision label for geohash
 */
function getPrecisionInfo(precision?: number): { label: string; coverage: string } {
  if (!precision) return { label: 'Unknown', coverage: '' };

  const precisionMap: Record<number, { label: string; coverage: string }> = {
    3: { label: 'Region', coverage: '~156km x 156km' },
    4: { label: 'Area', coverage: '~39km x 19km' },
    5: { label: 'City', coverage: '~4.9km x 4.9km' },
    6: { label: 'Neighborhood', coverage: '~1.2km x 0.6km' },
    7: { label: 'Block', coverage: '~153m x 153m' },
    8: { label: 'Building', coverage: '~38m x 19m' },
  };

  return precisionMap[precision] || { label: `Precision ${precision}`, coverage: '' };
}

/**
 * Format date
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get channel type label
 */
function getChannelTypeLabel(type: Channel['type']): string {
  switch (type) {
    case 'location':
      return 'Location Channel';
    case 'dm':
      return 'Direct Message';
    case 'public':
      return 'Public Channel';
    default:
      return 'Channel';
  }
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ToggleRowProps {
  icon: FunctionComponent<{ class?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleRow: FunctionComponent<ToggleRowProps> = ({
  icon: Icon,
  label,
  description,
  checked,
  onChange,
}) => (
  <div class="flex items-center justify-between py-3 border-b border-muted/20 last:border-0">
    <div class="flex items-center gap-3">
      <Icon class="w-5 h-5 text-muted" />
      <div>
        <span class="block text-terminal-sm text-text">{label}</span>
        <span class="block text-terminal-xs text-muted">{description}</span>
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      class={`toggle ${checked ? 'toggle-checked' : ''}`}
    >
      <span class="toggle-thumb" />
    </button>
  </div>
);

interface InfoRowProps {
  icon: FunctionComponent<{ class?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}

const InfoRow: FunctionComponent<InfoRowProps> = ({
  icon: Icon,
  label,
  value,
  mono = false,
}) => (
  <div class="flex items-center justify-between py-3 border-b border-muted/20 last:border-0">
    <div class="flex items-center gap-3">
      <Icon class="w-5 h-5 text-muted" />
      <span class="text-terminal-sm text-muted">{label}</span>
    </div>
    <span class={`text-terminal-sm text-text ${mono ? 'font-mono' : ''}`}>
      {value}
    </span>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const ChannelInfo: FunctionComponent<ChannelInfoProps> = ({
  channelId,
  onClose,
  isOpen = true,
  memberCount,
}) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const channel = useChannel(channelId);
  const { pinChannel, muteChannel, removeChannel } = useChannelsStore();

  // Handle pin toggle
  const handlePinToggle = useCallback(
    (isPinned: boolean) => {
      pinChannel(channelId, isPinned);
    },
    [channelId, pinChannel]
  );

  // Handle mute toggle
  const handleMuteToggle = useCallback(
    (isMuted: boolean) => {
      muteChannel(channelId, isMuted);
    },
    [channelId, muteChannel]
  );

  // Handle leave channel
  const handleLeave = useCallback(async () => {
    setIsLeaving(true);
    try {
      removeChannel(channelId);
      onClose?.();
    } catch (error) {
      console.error('Failed to leave channel:', error);
    } finally {
      setIsLeaving(false);
      setShowLeaveConfirm(false);
    }
  }, [channelId, removeChannel, onClose]);

  if (!isOpen || !channel) return null;

  // Get channel icon
  const ChannelIcon =
    channel.type === 'location'
      ? LocationIcon
      : channel.type === 'dm'
      ? UserIcon
      : GlobeIcon;

  const precisionInfo = getPrecisionInfo(channel.geohashPrecision);

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div
        class="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-info-title"
      >
        {/* Header */}
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <ChannelIcon class="w-5 h-5 text-primary" />
            <div>
              <h2 id="channel-info-title" class="modal-title">
                {channel.name}
              </h2>
              <p class="text-terminal-xs text-muted">
                {getChannelTypeLabel(channel.type)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            class="modal-close"
            aria-label="Close"
          >
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div class="modal-body">
          {/* Description */}
          {channel.description && (
            <div class="mb-6 p-3 bg-surface rounded-terminal border border-muted/20">
              <p class="text-terminal-sm text-muted">{channel.description}</p>
            </div>
          )}

          {/* Channel Info Section */}
          <div class="mb-6">
            <h3 class="text-terminal-xs text-muted uppercase tracking-wider mb-2">
              Channel Information
            </h3>
            <div class="card-terminal">
              {/* Member count for location channels */}
              {channel.type === 'location' && (
                <InfoRow
                  icon={UsersIcon}
                  label="Active Members"
                  value={memberCount !== undefined ? memberCount.toString() : 'Unknown'}
                />
              )}

              {/* Geohash for location channels */}
              {channel.type === 'location' && channel.geohash && (
                <>
                  <InfoRow
                    icon={HashIcon}
                    label="Geohash"
                    value={channel.geohash}
                    mono
                  />
                  <InfoRow
                    icon={LocationIcon}
                    label="Coverage"
                    value={`${precisionInfo.label} (${precisionInfo.coverage})`}
                  />
                </>
              )}

              {/* Created date */}
              <InfoRow
                icon={CalendarIcon}
                label="Joined"
                value={formatDate(channel.createdAt)}
              />
            </div>
          </div>

          {/* Settings Section */}
          <div class="mb-6">
            <h3 class="text-terminal-xs text-muted uppercase tracking-wider mb-2">
              Settings
            </h3>
            <div class="card-terminal">
              <ToggleRow
                icon={PinIcon}
                label="Pin Channel"
                description="Keep this channel at the top of your list"
                checked={channel.isPinned}
                onChange={handlePinToggle}
              />
              <ToggleRow
                icon={channel.isMuted ? BellOffIcon : BellIcon}
                label="Mute Notifications"
                description="Don't receive notifications from this channel"
                checked={channel.isMuted}
                onChange={handleMuteToggle}
              />
            </div>
          </div>

          {/* Danger Zone */}
          <div>
            <h3 class="text-terminal-xs text-error uppercase tracking-wider mb-2">
              Danger Zone
            </h3>
            <div class="card-terminal border-error/30">
              {showLeaveConfirm ? (
                <div class="py-3">
                  <p class="text-terminal-sm text-text mb-3">
                    Are you sure you want to leave this channel? This action cannot be undone.
                  </p>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowLeaveConfirm(false)}
                      class="btn-terminal-ghost btn-terminal-sm flex-1"
                      disabled={isLeaving}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleLeave}
                      class="btn-terminal-danger btn-terminal-sm flex-1"
                      disabled={isLeaving}
                    >
                      {isLeaving ? (
                        <>
                          <span class="loading-dots">
                            <span />
                            <span />
                            <span />
                          </span>
                          <span>Leaving...</span>
                        </>
                      ) : (
                        <>
                          <TrashIcon class="w-4 h-4" />
                          <span>Leave Channel</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(true)}
                  class="w-full flex items-center justify-between py-3 text-error hover:bg-error/10 transition-colors rounded-terminal px-2 -mx-2"
                >
                  <div class="flex items-center gap-3">
                    <TrashIcon class="w-5 h-5" />
                    <div class="text-left">
                      <span class="block text-terminal-sm">Leave Channel</span>
                      <span class="block text-terminal-xs text-muted">
                        Remove this channel from your list
                      </span>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div class="modal-footer">
          <button
            type="button"
            onClick={onClose}
            class="btn-terminal"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChannelInfo;
