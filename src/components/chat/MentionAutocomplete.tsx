/**
 * MentionAutocomplete - Handles autocomplete for @ mentions
 *
 * Features:
 * - Typing @ shows list of peers in current channel
 * - Filter as you type (e.g., @ali filters to "alice", "alison")
 * - Tab or tap to complete the mention
 * - Completed mention highlighted in message
 */

import type { FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import { AutocompletePopup, type AutocompleteItem } from './AutocompletePopup';
import type { Peer } from '../../stores/types';

// ============================================================================
// Types
// ============================================================================

export interface MentionAutocompleteProps {
  /** Current mention query (everything after @) */
  query: string;
  /** List of available peers to mention */
  peers: Peer[];
  /** Currently selected index */
  selectedIndex: number;
  /** Callback when a peer is selected */
  onSelect: (peer: Peer) => void;
  /** Callback when selection index changes */
  onIndexChange: (index: number) => void;
  /** Callback to dismiss the popup */
  onDismiss: () => void;
  /** Whether the popup is visible */
  isVisible: boolean;
}

// ============================================================================
// Icons
// ============================================================================

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

const OnlineIndicator: FunctionComponent<{ status: 'online' | 'offline' | 'away' }> = ({
  status,
}) => {
  const colorClass =
    status === 'online'
      ? 'bg-success'
      : status === 'away'
        ? 'bg-warning'
        : 'bg-muted';

  return <span class={`w-2 h-2 rounded-full ${colorClass}`} />;
};

// ============================================================================
// Component
// ============================================================================

export const MentionAutocomplete: FunctionComponent<MentionAutocompleteProps> = ({
  query,
  peers,
  selectedIndex,
  onSelect,
  onIndexChange,
  onDismiss,
  isVisible,
}) => {
  // Filter peers based on query
  const filteredPeers = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      // Show all peers if no query, sorted by status (online first) then by name
      return [...peers].sort((a, b) => {
        // Online first
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;
        // Then alphabetically
        return a.nickname.localeCompare(b.nickname);
      });
    }

    return peers
      .filter(
        (peer) =>
          peer.nickname.toLowerCase().includes(lowerQuery) ||
          peer.fingerprint.toLowerCase().includes(lowerQuery) ||
          peer.nip05?.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        const aStartsWith = a.nickname.toLowerCase().startsWith(lowerQuery);
        const bStartsWith = b.nickname.toLowerCase().startsWith(lowerQuery);

        // Prefer matches that start with query
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;

        // Online first
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (a.status !== 'online' && b.status === 'online') return 1;

        // Then alphabetically
        return a.nickname.localeCompare(b.nickname);
      });
  }, [query, peers]);

  // Convert peers to autocomplete items
  const items: AutocompleteItem[] = useMemo(() => filteredPeers.map((peer) => ({
      id: peer.fingerprint,
      label: `@${peer.nickname}`,
      description: peer.nip05 || `${peer.fingerprint.slice(0, 8)}...`,
      icon: (
        <div class="relative">
          <UserIcon class="w-4 h-4" />
          <span class="absolute -bottom-0.5 -right-0.5">
            <OnlineIndicator status={peer.status} />
          </span>
        </div>
      ),
      data: peer,
    })), [filteredPeers]);

  // Handle selection
  const handleSelect = (item: AutocompleteItem) => {
    const peer = item.data as Peer;
    onSelect(peer);
  };

  return (
    <AutocompletePopup
      items={items}
      selectedIndex={selectedIndex}
      onSelect={handleSelect}
      onIndexChange={onIndexChange}
      onDismiss={onDismiss}
      isVisible={isVisible}
      title="Mention a peer"
      emptyMessage="No matching peers"
    />
  );
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Find mention trigger position in input
 * Returns the index of @ that triggers mention autocomplete, or -1 if not found
 */
export function findMentionTrigger(input: string, cursorPosition: number): number {
  // Look backwards from cursor to find @
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const char = input[i];

    // Found @
    if (char === '@') {
      // Make sure it's at start or after whitespace
      if (i === 0 || /\s/.test(input[i - 1])) {
        return i;
      }
      return -1;
    }

    // Stop at whitespace (no @ found in this word)
    if (/\s/.test(char)) {
      return -1;
    }
  }

  return -1;
}

/**
 * Extract mention query from input at cursor position
 */
export function extractMentionQuery(input: string, cursorPosition: number): string {
  const triggerIndex = findMentionTrigger(input, cursorPosition);
  if (triggerIndex === -1) return '';

  // Get text from @ to cursor (excluding @)
  return input.slice(triggerIndex + 1, cursorPosition);
}

/**
 * Check if we should show mention autocomplete
 */
export function shouldShowMentionAutocomplete(
  input: string,
  cursorPosition: number
): boolean {
  return findMentionTrigger(input, cursorPosition) !== -1;
}

/**
 * Complete a mention in the input
 * Replaces @query with @nickname and adds a space
 */
export function completeMention(
  input: string,
  cursorPosition: number,
  nickname: string
): { text: string; cursorPosition: number } {
  const triggerIndex = findMentionTrigger(input, cursorPosition);
  if (triggerIndex === -1) {
    return { text: input, cursorPosition };
  }

  const beforeMention = input.slice(0, triggerIndex);
  const afterCursor = input.slice(cursorPosition);
  const completedMention = `@${nickname} `;

  return {
    text: beforeMention + completedMention + afterCursor,
    cursorPosition: triggerIndex + completedMention.length,
  };
}

/**
 * Extract all mentions from a message content
 */
export function extractMentions(content: string, peers: Peer[]): string[] {
  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const nickname = match[1].toLowerCase();
    const peer = peers.find((p) => p.nickname.toLowerCase() === nickname);
    if (peer) {
      mentions.push(peer.fingerprint);
    }
  }

  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Check if a message mentions a specific fingerprint
 */
export function messageContainsMention(
  content: string,
  fingerprint: string,
  peers: Peer[]
): boolean {
  const mentions = extractMentions(content, peers);
  return mentions.includes(fingerprint);
}

export default MentionAutocomplete;
