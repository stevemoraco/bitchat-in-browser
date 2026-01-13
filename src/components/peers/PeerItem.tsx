/**
 * PeerItem - Individual peer display component
 *
 * Displays a single peer with:
 * - Visual fingerprint icon (colored blocks)
 * - Nickname or short fingerprint
 * - Trust level indicator
 * - Online status dot
 * - Last seen timestamp
 */

import { FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import type { Peer, PeerStatus } from '../../stores/types';

// ============================================================================
// Types
// ============================================================================

interface PeerItemProps {
  /** Peer data */
  peer: Peer;
  /** Whether this peer is selected */
  isSelected?: boolean;
  /** Click handler */
  onClick?: (peer: Peer) => void;
  /** Whether to show compact view */
  compact?: boolean;
}

// ============================================================================
// Visual Fingerprint Generator
// ============================================================================

/**
 * Generate a visual fingerprint from a hex string
 * Returns an array of colors for rendering colored blocks
 */
function generateVisualFingerprint(fingerprint: string): string[] {
  const colors = [
    '#ff4444', // red
    '#ff6600', // orange
    '#ffff00', // yellow
    '#00ff00', // green
    '#00d4ff', // cyan
    '#0066ff', // blue
    '#9900ff', // purple
    '#ff00ff', // magenta
  ];

  // Take first 8 characters of fingerprint for 4 blocks (2 chars each)
  const blocks: string[] = [];
  const normalizedFingerprint = (fingerprint || '00000000').padEnd(8, '0');
  for (let i = 0; i < 8; i += 2) {
    const hex = normalizedFingerprint.slice(i, i + 2);
    const value = parseInt(hex, 16) || 0;
    const colorIndex = value % colors.length;
    const color = colors[colorIndex] || '#00ff00';
    blocks.push(color);
  }

  return blocks;
}

/**
 * Get status dot color based on peer status
 */
function getStatusColor(status: PeerStatus): string {
  switch (status) {
    case 'online':
      return 'bg-terminal-green';
    case 'away':
      return 'bg-terminal-yellow';
    case 'offline':
    default:
      return 'bg-muted';
  }
}

/**
 * Get status glow effect
 */
function getStatusGlow(status: PeerStatus): string {
  if (status === 'online') {
    return 'shadow-[0_0_6px_theme(colors.terminal-green)]';
  }
  return '';
}

/**
 * Format last seen timestamp
 */
function formatLastSeen(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  } else if (minutes < 60) {
    return `${minutes}m ago`;
  } else if (hours < 24) {
    return `${hours}h ago`;
  } else if (days < 7) {
    return `${days}d ago`;
  } else {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Get trust level indicator
 */
function getTrustIndicator(peer: Peer): { icon: string; color: string; label: string } | null {
  if (peer.isBlocked) {
    return { icon: '[X]', color: 'text-terminal-red', label: 'blocked' };
  }
  if (peer.isTrusted) {
    return { icon: '[V]', color: 'text-terminal-green', label: 'verified' };
  }
  return null;
}

// ============================================================================
// Visual Fingerprint Component
// ============================================================================

interface VisualFingerprintProps {
  fingerprint: string;
  size?: 'sm' | 'md' | 'lg';
}

const VisualFingerprint: FunctionComponent<VisualFingerprintProps> = ({
  fingerprint,
  size = 'md',
}) => {
  const colors = useMemo(() => generateVisualFingerprint(fingerprint), [fingerprint]);

  const blockSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  const containerSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div
      class={`${containerSizes[size]} grid grid-cols-2 gap-0.5 p-1 bg-surface rounded-terminal border border-muted`}
    >
      {colors.map((color, index) => (
        <div
          key={index}
          class={`${blockSizes[size]} rounded-terminal-sm`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
};

// ============================================================================
// PeerItem Component
// ============================================================================

export const PeerItem: FunctionComponent<PeerItemProps> = ({
  peer,
  isSelected = false,
  onClick,
  compact = false,
}) => {
  const trustIndicator = getTrustIndicator(peer);
  const displayName = peer.nickname || `anon-${peer.fingerprint.slice(0, 6)}`;
  const shortFingerprint = `${peer.fingerprint.slice(0, 6)}...${peer.fingerprint.slice(-4)}`;

  const handleClick = () => {
    if (onClick) {
      onClick(peer);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  if (compact) {
    return (
      <div
        class={`peer-item ${isSelected ? 'peer-item-selected' : ''} ${peer.isBlocked ? 'opacity-50' : ''}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-pressed={isSelected}
      >
        {/* Status dot */}
        <div
          class={`peer-status ${getStatusColor(peer.status)} ${getStatusGlow(peer.status)}`}
          aria-label={`Status: ${peer.status}`}
        />

        {/* Name */}
        <span class="flex-1 truncate text-terminal-sm">{displayName}</span>

        {/* Trust indicator */}
        {trustIndicator && (
          <span class={`${trustIndicator.color} text-terminal-xs`} title={trustIndicator.label}>
            {trustIndicator.icon}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      class={`peer-item ${isSelected ? 'peer-item-selected' : ''} ${peer.isBlocked ? 'opacity-50' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
    >
      {/* Visual fingerprint */}
      <VisualFingerprint fingerprint={peer.fingerprint} size="md" />

      {/* Peer info */}
      <div class="peer-info">
        <div class="flex items-center gap-2">
          <span class="peer-name">{displayName}</span>
          {trustIndicator && (
            <span class={`${trustIndicator.color} text-terminal-xs`} title={trustIndicator.label}>
              {trustIndicator.icon}
            </span>
          )}
        </div>
        <div class="flex items-center gap-2">
          <span class="peer-pubkey">{shortFingerprint}</span>
          {peer.nip05 && (
            <span class="text-terminal-xs text-terminal-blue truncate">{peer.nip05}</span>
          )}
        </div>
      </div>

      {/* Right side: status and last seen */}
      <div class="flex flex-col items-end gap-1">
        {/* Status dot */}
        <div class="flex items-center gap-1.5">
          <span class="text-terminal-xs text-muted">
            {peer.status === 'online' ? 'online' : formatLastSeen(peer.lastSeenAt)}
          </span>
          <div
            class={`peer-status ${getStatusColor(peer.status)} ${getStatusGlow(peer.status)}`}
            aria-label={`Status: ${peer.status}`}
          />
        </div>

        {/* Source badge */}
        {peer.source === 'webrtc' && (
          <span class="peer-connection-badge peer-connection-p2p">P2P</span>
        )}
        {peer.source === 'nostr' && (
          <span class="peer-connection-badge peer-connection-relay">RELAY</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export { VisualFingerprint, generateVisualFingerprint, formatLastSeen };
export type { PeerItemProps };
