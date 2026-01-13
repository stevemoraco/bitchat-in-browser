/**
 * MentionLink Component
 *
 * Displays a clickable mention link that shows the peer's name if known,
 * or a shortened pubkey if not. Navigates to peer profile on click.
 */

import { FunctionComponent } from 'preact';
import { useMemo, useCallback } from 'preact/hooks';
import { usePeersStore, usePeer } from '../../stores/peers-store';

// ============================================================================
// Types
// ============================================================================

export interface MentionLinkProps {
  /** Public key (hex or npub format) */
  pubkey: string;
  /** Click handler - if not provided, uses default navigation */
  onClick?: (pubkey: string) => void;
  /** Whether the mention is for the current user */
  isOwnMention?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Show full pubkey on hover */
  showTooltip?: boolean;
  /** Compact mode (shorter display) */
  compact?: boolean;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Shorten a pubkey for display
 */
function shortenPubkey(pubkey: string, length: number = 8): string {
  if (pubkey.startsWith('npub1')) {
    // npub format
    return `${pubkey.slice(0, length)}...${pubkey.slice(-4)}`;
  }
  // Hex format
  return `${pubkey.slice(0, length)}...`;
}

/**
 * Get a color based on pubkey (for visual distinction)
 */
function getPubkeyColor(pubkey: string): string {
  // Generate a consistent color from pubkey
  let hash = 0;
  for (let i = 0; i < pubkey.length; i++) {
    hash = (hash << 5) - hash + pubkey.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }

  // Map to a set of terminal-friendly colors
  const colors = [
    'text-terminal-yellow',
    'text-terminal-cyan',
    'text-terminal-magenta',
    'text-terminal-blue',
    'text-terminal-green',
  ];

  return colors[Math.abs(hash) % colors.length] ?? 'text-terminal-yellow';
}

// ============================================================================
// Component
// ============================================================================

export const MentionLink: FunctionComponent<MentionLinkProps> = ({
  pubkey,
  onClick,
  isOwnMention = false,
  className = '',
  showTooltip = true,
  compact = false,
}) => {
  // Try to find peer in store
  const peers = usePeersStore((state) => state.peers);

  // Find peer by fingerprint or publicKey
  const peerInfo = useMemo(() => {
    // Direct fingerprint lookup
    if (peers[pubkey]) {
      return peers[pubkey];
    }

    // Search by publicKey
    for (const peer of Object.values(peers)) {
      if (peer.publicKey === pubkey) {
        return peer;
      }
    }

    // Handle npub format - would need bech32 decode in production
    if (pubkey.startsWith('npub1')) {
      // For now, just check if any peer has matching npub prefix in their data
      // In production, decode npub to hex and compare
    }

    return null;
  }, [peers, pubkey]);

  // Display name
  const displayName = useMemo(() => {
    if (peerInfo?.nickname) {
      if (compact && peerInfo.nickname.length > 15) {
        return peerInfo.nickname.slice(0, 12) + '...';
      }
      return peerInfo.nickname;
    }
    return shortenPubkey(pubkey, compact ? 6 : 8);
  }, [peerInfo, pubkey, compact]);

  // Click handler
  const handleClick = useCallback(
    (e: Event) => {
      e.preventDefault();
      e.stopPropagation();

      if (onClick) {
        onClick(pubkey);
      }
    },
    [onClick, pubkey]
  );

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick(e);
      }
    },
    [handleClick]
  );

  // Determine styling based on state
  const colorClass = isOwnMention
    ? 'text-terminal-green'
    : peerInfo
      ? 'text-terminal-yellow'
      : getPubkeyColor(pubkey);

  const containerClass = [
    'mention-link',
    'inline-flex items-center gap-1',
    colorClass,
    'hover:opacity-80 transition-opacity',
    'cursor-pointer font-semibold',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Tooltip content
  const tooltipContent = useMemo(() => {
    if (!showTooltip) return undefined;

    const parts: string[] = [];
    if (peerInfo?.nickname) {
      parts.push(peerInfo.nickname);
    }
    parts.push(pubkey);
    if (peerInfo?.nip05) {
      parts.push(peerInfo.nip05);
    }

    return parts.join('\n');
  }, [showTooltip, peerInfo, pubkey]);

  return (
    <span
      class={containerClass}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      title={tooltipContent}
      data-pubkey={pubkey}
    >
      <span class="mention-prefix opacity-70">@</span>
      <span class="mention-name">{displayName}</span>
      {peerInfo?.isTrusted && <VerifiedBadge />}
      {peerInfo?.status === 'online' && <OnlineIndicator />}
    </span>
  );
};

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Verified/trusted badge
 */
const VerifiedBadge: FunctionComponent = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    class="text-terminal-green ml-0.5"
    title="Trusted"
  >
    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1 14.59L7 12.59l1.41-1.41L11 13.76l5.59-5.59L18 9.59l-7 7z" />
  </svg>
);

/**
 * Online status indicator
 */
const OnlineIndicator: FunctionComponent = () => (
  <span
    class="w-1.5 h-1.5 bg-terminal-green rounded-full ml-1 animate-pulse"
    title="Online"
  />
);

// ============================================================================
// Specialized Components
// ============================================================================

/**
 * Mention link that auto-loads peer data
 */
export const MentionLinkWithPeer: FunctionComponent<{
  fingerprint: string;
  onClick?: (pubkey: string) => void;
  className?: string;
}> = ({ fingerprint, onClick, className }) => {
  const peer = usePeer(fingerprint);

  return (
    <MentionLink
      pubkey={peer?.publicKey || fingerprint}
      onClick={onClick}
      className={className}
    />
  );
};

/**
 * Self-mention (current user)
 */
export const SelfMention: FunctionComponent<{
  pubkey: string;
  nickname?: string;
  onClick?: (pubkey: string) => void;
  className?: string;
}> = ({ pubkey, nickname, onClick, className }) => {
  const displayName = nickname || 'you';

  const handleClick = useCallback(
    (e: Event) => {
      e.preventDefault();
      onClick?.(pubkey);
    },
    [onClick, pubkey]
  );

  return (
    <span
      class={`inline-flex items-center gap-1 text-terminal-green font-semibold cursor-pointer hover:opacity-80 ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
    >
      <span class="opacity-70">@</span>
      <span>{displayName}</span>
    </span>
  );
};

/**
 * Mention input autocomplete item
 */
export const MentionAutocompleteItem: FunctionComponent<{
  pubkey: string;
  nickname?: string;
  nip05?: string;
  isOnline?: boolean;
  isTrusted?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}> = ({
  pubkey,
  nickname,
  nip05,
  isOnline,
  isTrusted,
  isSelected,
  onClick,
}) => {
  const displayName = nickname || shortenPubkey(pubkey);

  return (
    <div
      class={[
        'flex items-center gap-2 px-3 py-2 cursor-pointer',
        'hover:bg-terminal-green/10',
        isSelected ? 'bg-terminal-green/20' : '',
      ].join(' ')}
      onClick={onClick}
      role="option"
      aria-selected={isSelected}
    >
      {/* Avatar placeholder */}
      <div class="w-6 h-6 rounded-full bg-terminal-green/20 flex items-center justify-center text-xs">
        {displayName.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1">
          <span class="text-terminal-green font-medium truncate">
            {displayName}
          </span>
          {isTrusted && <VerifiedBadge />}
          {isOnline && <OnlineIndicator />}
        </div>
        {nip05 && (
          <div class="text-terminal-green/50 text-xs truncate">{nip05}</div>
        )}
      </div>

      {/* Shortened pubkey */}
      <div class="text-terminal-green/30 text-xs font-mono">
        {shortenPubkey(pubkey, 6)}
      </div>
    </div>
  );
};

/**
 * Mention list for message info
 */
export const MentionList: FunctionComponent<{
  pubkeys: string[];
  onClick?: (pubkey: string) => void;
  className?: string;
}> = ({ pubkeys, onClick, className = '' }) => {
  if (pubkeys.length === 0) {
    return null;
  }

  return (
    <div class={`mention-list flex flex-wrap gap-1 ${className}`}>
      {pubkeys.map((pubkey) => (
        <MentionLink key={pubkey} pubkey={pubkey} onClick={onClick} compact />
      ))}
    </div>
  );
};

export default MentionLink;
