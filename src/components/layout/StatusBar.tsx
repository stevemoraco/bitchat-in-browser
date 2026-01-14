/**
 * StatusBar Component - BitChat In Browser
 *
 * Bottom status bar showing:
 * - Network status (online/offline)
 * - Relay connection count
 * - WebRTC peer count
 * - Optional sync status
 *
 * Terminal-style status display with minimal footprint.
 */

import type { FunctionComponent } from 'preact';
import { useConnectionStatus } from '../../stores';

// ============================================================================
// Types
// ============================================================================

interface StatusBarProps {
  /** Number of connected Nostr relays */
  relayCount?: number;
  /** Number of active WebRTC peers */
  webrtcPeerCount?: number;
  /** Whether currently syncing */
  isSyncing?: boolean;
  /** Last sync timestamp */
  lastSyncAt?: number;
  /** Optional custom status message */
  statusMessage?: string;
}

// ============================================================================
// Network Status Indicator
// ============================================================================

interface NetworkStatusProps {
  isOnline: boolean;
}

const NetworkStatus: FunctionComponent<NetworkStatusProps> = ({ isOnline }) => (
    <div class="flex items-center gap-1.5">
      <div
        class={`w-1.5 h-1.5 rounded-full ${
          isOnline ? 'bg-terminal-green' : 'bg-terminal-red'
        }`}
      />
      <span
        class={`text-terminal-xs ${
          isOnline ? 'text-terminal-green' : 'text-terminal-red'
        }`}
      >
        {isOnline ? 'NET:OK' : 'NET:OFF'}
      </span>
    </div>
  );

// ============================================================================
// Relay Status
// ============================================================================

interface RelayStatusProps {
  count: number;
}

const RelayStatus: FunctionComponent<RelayStatusProps> = ({ count }) => {
  const status = count > 0 ? 'ok' : 'error';
  const statusColors = {
    ok: 'text-terminal-green',
    error: 'text-terminal-red',
  };

  return (
    <div class="flex items-center gap-1">
      <span class="text-terminal-green/40">RELAY:</span>
      <span class={statusColors[status]}>{count}</span>
    </div>
  );
};

// ============================================================================
// WebRTC Peer Status
// ============================================================================

interface PeerStatusProps {
  count: number;
}

const PeerStatus: FunctionComponent<PeerStatusProps> = ({ count }) => {
  const status = count > 0 ? 'ok' : 'muted';
  const statusColors = {
    ok: 'text-terminal-blue',
    muted: 'text-terminal-green/40',
  };

  return (
    <div class="flex items-center gap-1">
      <span class="text-terminal-green/40">P2P:</span>
      <span class={statusColors[status]}>{count}</span>
    </div>
  );
};

// ============================================================================
// Sync Status
// ============================================================================

interface SyncStatusProps {
  isSyncing: boolean;
  lastSyncAt?: number;
}

const SyncStatus: FunctionComponent<SyncStatusProps> = ({
  isSyncing,
  lastSyncAt,
}) => {
  if (isSyncing) {
    return (
      <div class="flex items-center gap-1">
        <span class="text-terminal-yellow animate-pulse">SYNC</span>
      </div>
    );
  }

  if (lastSyncAt) {
    const now = Date.now();
    const diff = now - lastSyncAt;
    const minutes = Math.floor(diff / 60000);

    let timeStr: string;
    if (minutes < 1) {
      timeStr = 'now';
    } else if (minutes < 60) {
      timeStr = `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      timeStr = `${hours}h`;
    }

    return (
      <div class="flex items-center gap-1">
        <span class="text-terminal-green/40">SYNC:</span>
        <span class="text-terminal-green/60">{timeStr}</span>
      </div>
    );
  }

  return null;
};

// ============================================================================
// StatusBar Component
// ============================================================================

export const StatusBar: FunctionComponent<StatusBarProps> = ({
  relayCount = 0,
  webrtcPeerCount = 0,
  isSyncing = false,
  lastSyncAt,
  statusMessage,
}) => {
  const { isOnline } = useConnectionStatus();

  return (
    <div class="bg-terminal-bg border-t border-terminal-green/20 px-3 py-1.5">
      <div class="flex items-center justify-between text-terminal-xs font-mono">
        {/* Left: Network and connection status */}
        <div class="flex items-center gap-4">
          <NetworkStatus isOnline={isOnline} />
          <RelayStatus count={relayCount} />
          <PeerStatus count={webrtcPeerCount} />
        </div>

        {/* Center: Custom status message (if any) */}
        {statusMessage && (
          <div class="hidden md:block text-terminal-green/60 truncate max-w-xs">
            {statusMessage}
          </div>
        )}

        {/* Right: Sync status */}
        <div class="flex items-center gap-4">
          <SyncStatus isSyncing={isSyncing} lastSyncAt={lastSyncAt} />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Compact Status Bar (for mobile)
// ============================================================================

export const CompactStatusBar: FunctionComponent<StatusBarProps> = ({
  relayCount = 0,
  webrtcPeerCount = 0,
  isSyncing = false,
}) => {
  const { isOnline } = useConnectionStatus();

  return (
    <div class="bg-terminal-bg/80 backdrop-blur-sm border-t border-terminal-green/10 px-2 py-1">
      <div class="flex items-center justify-center gap-3 text-terminal-xs font-mono">
        {/* Network indicator */}
        <div
          class={`w-1.5 h-1.5 rounded-full ${
            isOnline ? 'bg-terminal-green' : 'bg-terminal-red'
          }`}
        />

        {/* Relay count */}
        <span class="text-terminal-green/50">R:{relayCount}</span>

        {/* P2P count */}
        <span class="text-terminal-green/50">P:{webrtcPeerCount}</span>

        {/* Sync indicator */}
        {isSyncing && (
          <span class="text-terminal-yellow animate-pulse">...</span>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
