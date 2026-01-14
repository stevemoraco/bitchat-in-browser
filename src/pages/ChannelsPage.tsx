/**
 * ChannelsPage - Main channels page component
 *
 * Combines ChannelsList with page chrome:
 * - Header with app branding
 * - Channels list
 * - Modal management for channel creation and info
 * - Route handling
 */

import type { FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useActiveChannel, useChannelsStore } from '../stores/channels-store';
import type { Channel } from '../stores/types';
import { ChannelsList } from '../components/channels/ChannelsList';
import { LocationChannelCreate } from '../components/channels/LocationChannelCreate';
import { ChannelInfo } from '../components/channels/ChannelInfo';

// ============================================================================
// Types
// ============================================================================

interface ChannelsPageProps {
  /** Optional route channel ID from URL params */
  channelId?: string;
  /** Callback when navigating to a channel (for routing) */
  onNavigateToChannel?: (channelId: string) => void;
  /** Callback when starting a new DM */
  onStartDM?: () => void;
}

// ============================================================================
// Icons
// ============================================================================

/** Settings gear icon */
const SettingsIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/** Info icon */
const InfoIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/** Signal/connection icon */
const SignalIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M5 12.55a11 11 0 0 1 14.08 0" />
    <path d="M1.42 9a16 16 0 0 1 21.16 0" />
    <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

// ============================================================================
// Sub-Components
// ============================================================================

interface HeaderProps {
  onSettingsClick?: () => void;
  isOnline?: boolean;
}

const Header: FunctionComponent<HeaderProps> = ({
  onSettingsClick,
  isOnline = true,
}) => (
  <header class="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-muted/30 bg-surface/50">
    <div class="flex items-center gap-3">
      <h1 class="text-lg font-bold text-primary">&gt; BitChat</h1>
      <div class="flex items-center gap-1">
        <SignalIcon
          class={`w-4 h-4 ${isOnline ? 'text-primary' : 'text-muted'}`}
        />
        <span class={`text-terminal-xs ${isOnline ? 'text-primary' : 'text-muted'}`}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>
    </div>
    <button
      type="button"
      onClick={onSettingsClick}
      class="p-2 text-muted hover:text-primary transition-colors rounded-terminal"
      aria-label="Settings"
    >
      <SettingsIcon class="w-5 h-5" />
    </button>
  </header>
);

interface ActiveChannelBarProps {
  channel: Channel;
  onInfoClick: () => void;
}

const ActiveChannelBar: FunctionComponent<ActiveChannelBarProps> = ({
  channel,
  onInfoClick,
}) => (
  <div class="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-muted/30 bg-primary/5">
    <div class="flex items-center gap-2 min-w-0">
      <span class="text-terminal-sm text-primary font-bold truncate">
        #{channel.name}
      </span>
      {channel.geohash && (
        <span class="text-terminal-xs text-muted font-mono hidden sm:inline">
          [{channel.geohash.slice(0, 6)}]
        </span>
      )}
    </div>
    <button
      type="button"
      onClick={onInfoClick}
      class="p-1.5 text-muted hover:text-primary transition-colors rounded-terminal flex-shrink-0"
      aria-label="Channel info"
    >
      <InfoIcon class="w-4 h-4" />
    </button>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const ChannelsPage: FunctionComponent<ChannelsPageProps> = ({
  channelId: _channelId, // Reserved for routing integration
  onNavigateToChannel,
  onStartDM,
}) => {
  // Modal state
  const [showLocationCreate, setShowLocationCreate] = useState(false);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [infoChannelId, setInfoChannelId] = useState<string | null>(null);

  // Store hooks
  const activeChannel = useActiveChannel();
  const setActiveChannel = useChannelsStore((state) => state.setActiveChannel);

  // Handle channel selection
  const handleChannelSelect = useCallback(
    (channel: Channel) => {
      setActiveChannel(channel.id);
      onNavigateToChannel?.(channel.id);
    },
    [setActiveChannel, onNavigateToChannel]
  );

  // Handle create location channel
  const handleCreateLocationChannel = useCallback(() => {
    setShowLocationCreate(true);
  }, []);

  // Handle channel created
  const handleChannelCreated = useCallback(
    (newChannelId: string) => {
      setShowLocationCreate(false);
      setActiveChannel(newChannelId);
      onNavigateToChannel?.(newChannelId);
    },
    [setActiveChannel, onNavigateToChannel]
  );

  // Handle start DM
  const handleStartDM = useCallback(() => {
    // In a full implementation, this would open a peer selector
    // For now, we'll just call the parent callback if provided
    onStartDM?.();
  }, [onStartDM]);

  // Handle show channel info
  const handleShowChannelInfo = useCallback(() => {
    if (activeChannel) {
      setInfoChannelId(activeChannel.id);
      setShowChannelInfo(true);
    }
  }, [activeChannel]);

  // Handle close channel info
  const handleCloseChannelInfo = useCallback(() => {
    setShowChannelInfo(false);
    setInfoChannelId(null);
  }, []);

  // Handle settings click
  const handleSettingsClick = useCallback(() => {
    // In a full implementation, this would navigate to settings
    console.log('Settings clicked');
  }, []);

  // Sync active channel with route param
  // In a full implementation, this would use a router
  // useEffect(() => {
  //   if (channelId && channelId !== activeChannel?.id) {
  //     setActiveChannel(channelId);
  //   }
  // }, [channelId, activeChannel?.id, setActiveChannel]);

  return (
    <div class="flex flex-col h-screen bg-background text-text font-mono">
      {/* App Header */}
      <Header onSettingsClick={handleSettingsClick} isOnline />

      {/* Active Channel Bar (when a channel is selected) */}
      {activeChannel && (
        <ActiveChannelBar
          channel={activeChannel}
          onInfoClick={handleShowChannelInfo}
        />
      )}

      {/* Main Content Area */}
      <div class="flex-1 flex overflow-hidden">
        {/* Channels List Sidebar */}
        <div class="w-full sm:w-80 lg:w-96 flex-shrink-0 border-r border-muted/30 overflow-hidden">
          <ChannelsList
            onChannelSelect={handleChannelSelect}
            onCreateLocationChannel={handleCreateLocationChannel}
            onStartDM={handleStartDM}
            class="h-full"
          />
        </div>

        {/* Chat Area Placeholder */}
        <div class="hidden sm:flex flex-1 flex-col items-center justify-center bg-surface/30">
          {activeChannel ? (
            <div class="text-center p-8">
              <div class="text-terminal-xl text-primary mb-2">
                #{activeChannel.name}
              </div>
              <p class="text-terminal-sm text-muted">
                Chat interface will be rendered here
              </p>
              {activeChannel.type === 'location' && activeChannel.geohash && (
                <p class="text-terminal-xs text-muted font-mono mt-2">
                  Geohash: {activeChannel.geohash}
                </p>
              )}
            </div>
          ) : (
            <div class="text-center p-8">
              <div class="text-6xl mb-4 opacity-20">&gt;_</div>
              <h2 class="text-terminal-lg text-muted mb-2">
                Select a Channel
              </h2>
              <p class="text-terminal-sm text-muted/70 max-w-sm">
                Choose a location channel or direct message from the list to start chatting
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Location Channel Create Modal */}
      <LocationChannelCreate
        isOpen={showLocationCreate}
        onClose={() => setShowLocationCreate(false)}
        onCreated={handleChannelCreated}
      />

      {/* Channel Info Modal */}
      {infoChannelId && (
        <ChannelInfo
          channelId={infoChannelId}
          isOpen={showChannelInfo}
          onClose={handleCloseChannelInfo}
        />
      )}
    </div>
  );
};

export default ChannelsPage;
