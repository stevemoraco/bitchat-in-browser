/**
 * Peer List Item
 *
 * Displays a single mesh peer with:
 * - Peer nickname
 * - Connection type icon (relay/direct)
 * - Latency display (e.g., "45ms")
 * - Signal strength bars (based on latency)
 * - Online indicator dot
 */

import type { FunctionComponent } from 'preact';
import type { MeshPeer, ConnectionMethod } from '../../services/mesh/types';

// ============================================================================
// Types
// ============================================================================

export interface PeerListItemProps {
  peer: MeshPeer;
  /** Whether to show detailed info */
  detailed?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Custom class name */
  class?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate signal strength (0-4 bars) based on latency
 */
const getSignalStrength = (latency: number | undefined): number => {
  if (latency === undefined) return 0;
  if (latency < 50) return 4;
  if (latency < 100) return 3;
  if (latency < 200) return 2;
  if (latency < 500) return 1;
  return 0;
};

/**
 * Get connection method display info
 */
const getConnectionMethodInfo = (method: ConnectionMethod): { label: string; color: string } => {
  switch (method) {
    case 'direct':
      return { label: 'Direct', color: 'text-green-400' };
    case 'nostr':
      return { label: 'Relay', color: 'text-blue-400' };
    case 'cached':
      return { label: 'Cached', color: 'text-yellow-400' };
    case 'local':
      return { label: 'Local', color: 'text-purple-400' };
    default:
      return { label: 'Unknown', color: 'text-gray-400' };
  }
};

/**
 * Format latency for display
 */
const formatLatency = (latency: number | undefined): string => {
  if (latency === undefined) return '--';
  if (latency < 1000) return `${Math.round(latency)}ms`;
  return `${(latency / 1000).toFixed(1)}s`;
};

/**
 * Check if peer is online (seen within last 30 seconds)
 */
const isPeerOnline = (lastSeen: number): boolean =>
  Date.now() - lastSeen < 30000;

// ============================================================================
// Icons
// ============================================================================

const RelayIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
    />
  </svg>
);

const DirectIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

// ============================================================================
// Signal Bars Component
// ============================================================================

interface SignalBarsProps {
  strength: number; // 0-4
  class?: string;
}

const SignalBars: FunctionComponent<SignalBarsProps> = ({
  strength,
  class: className = '',
}) => {
  const bars = [1, 2, 3, 4];
  const heights = ['h-1', 'h-2', 'h-3', 'h-4'];

  return (
    <div class={`flex items-end gap-0.5 ${className}`} aria-label={`Signal strength: ${strength} of 4 bars`}>
      {bars.map((bar, index) => (
        <div
          key={bar}
          class={`w-1 rounded-sm ${heights[index]} ${
            bar <= strength
              ? strength >= 3
                ? 'bg-green-400'
                : strength >= 2
                  ? 'bg-yellow-400'
                  : 'bg-red-400'
              : 'bg-gray-600'
          }`}
        />
      ))}
    </div>
  );
};

// ============================================================================
// Component
// ============================================================================

export const PeerListItem: FunctionComponent<PeerListItemProps> = ({
  peer,
  detailed = false,
  onClick,
  class: className = '',
}) => {
  const signalStrength = getSignalStrength(peer.latency);
  const methodInfo = getConnectionMethodInfo(peer.connectionMethod);
  const isOnline = isPeerOnline(peer.lastSeen);
  const displayName = peer.nickname || peer.fingerprint?.slice(0, 8) || peer.peerId.slice(0, 8);

  const ConnectionIcon = peer.connectionMethod === 'direct' ? DirectIcon : RelayIcon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      class={`w-full p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg flex items-center gap-3 transition-colors text-left ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${className}`}
    >
      {/* Online indicator + Avatar */}
      <div class="relative">
        {/* Avatar circle with initial */}
        <div class="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-medium">
          {displayName.charAt(0).toUpperCase()}
        </div>
        {/* Online indicator dot */}
        <div
          class={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-gray-900 ${
            isOnline ? 'bg-green-500' : 'bg-gray-500'
          }`}
        />
      </div>

      {/* Peer info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-white font-medium truncate">{displayName}</span>
          {peer.appVersion && (
            <span class="text-xs text-gray-500 font-mono">v{peer.appVersion}</span>
          )}
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-400">
          <ConnectionIcon class={`w-3.5 h-3.5 ${methodInfo.color}`} />
          <span class={methodInfo.color}>{methodInfo.label}</span>
          {detailed && peer.fingerprint && (
            <>
              <span class="text-gray-600">|</span>
              <span class="font-mono text-gray-500">{peer.fingerprint.slice(0, 8)}</span>
            </>
          )}
        </div>
      </div>

      {/* Right side: Latency + Signal */}
      <div class="flex items-center gap-3">
        <span class="text-xs text-gray-400 font-mono">
          {formatLatency(peer.latency)}
        </span>
        <SignalBars strength={signalStrength} />
      </div>
    </button>
  );
};

export default PeerListItem;
