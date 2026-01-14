/**
 * PeerProfile - Peer details view component
 *
 * Displays:
 * - Full fingerprint display (grid format)
 * - Nickname editing
 * - Trust level selector
 * - Verification status
 * - Message button
 * - Block/unblock functionality
 */

import type { FunctionComponent } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import { usePeersStore, usePeer } from '../../stores/peers-store';
import type { Peer } from '../../stores/types';
import { formatLastSeen, generateVisualFingerprint } from './PeerItem';

// ============================================================================
// Types
// ============================================================================

interface PeerProfileProps {
  /** Peer fingerprint to display */
  fingerprint: string;
  /** Callback when back is clicked */
  onBack?: () => void;
  /** Callback when message button is clicked */
  onMessage?: (peer: Peer) => void;
  /** Callback when verify button is clicked */
  onVerify?: (peer: Peer) => void;
}

// ============================================================================
// Fingerprint Grid Component
// ============================================================================

interface FingerprintGridProps {
  fingerprint: string;
}

const FingerprintGrid: FunctionComponent<FingerprintGridProps> = ({ fingerprint }) => {
  const [copied, setCopied] = useState(false);

  // Split fingerprint into 4-character chunks for grid display
  const chunks = useMemo(() => {
    const result: string[] = [];
    for (let i = 0; i < fingerprint.length; i += 4) {
      result.push(fingerprint.slice(i, i + 4));
    }
    return result;
  }, [fingerprint]);

  // Generate colors for visual representation
  const colors = useMemo(() => generateVisualFingerprint(fingerprint), [fingerprint]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fingerprint);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy fingerprint:', err);
    }
  };

  return (
    <div class="card-terminal">
      <div class="flex items-center justify-between mb-3">
        <span class="text-terminal-xs text-muted uppercase tracking-wider">
          Fingerprint
        </span>
        <button
          class="btn-terminal-ghost btn-terminal-sm text-terminal-xs"
          onClick={handleCopy}
        >
          {copied ? '[COPIED]' : '[COPY]'}
        </button>
      </div>

      {/* Visual fingerprint large */}
      <div class="flex justify-center mb-4">
        <div class="w-16 h-16 grid grid-cols-2 gap-1 p-2 bg-background rounded-terminal border border-muted">
          {colors.map((color, index) => (
            <div
              key={index}
              class="w-full h-full rounded-terminal-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Fingerprint grid */}
      <div class="grid grid-cols-4 gap-1 font-mono text-terminal-xs">
        {chunks.map((chunk, index) => (
          <div
            key={index}
            class="bg-background px-2 py-1 text-center text-primary rounded-terminal-sm"
          >
            {chunk}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Trust Level Selector Component
// ============================================================================

interface TrustLevelSelectorProps {
  isTrusted: boolean;
  isBlocked: boolean;
  onChange: (trusted: boolean, blocked: boolean) => void;
}

const TrustLevelSelector: FunctionComponent<TrustLevelSelectorProps> = ({
  isTrusted,
  isBlocked,
  onChange,
}) => {
  const levels = [
    { id: 'blocked', label: 'BLOCKED', color: 'text-terminal-red', icon: '[X]' },
    { id: 'unknown', label: 'UNKNOWN', color: 'text-muted', icon: '[?]' },
    { id: 'trusted', label: 'TRUSTED', color: 'text-terminal-green', icon: '[V]' },
  ];

  const currentLevel = isBlocked ? 'blocked' : isTrusted ? 'trusted' : 'unknown';

  const handleSelect = (level: string) => {
    switch (level) {
      case 'blocked':
        onChange(false, true);
        break;
      case 'trusted':
        onChange(true, false);
        break;
      default:
        onChange(false, false);
    }
  };

  return (
    <div class="card-terminal">
      <span class="text-terminal-xs text-muted uppercase tracking-wider block mb-3">
        Trust Level
      </span>
      <div class="flex gap-2">
        {levels.map((level) => (
          <button
            key={level.id}
            class={`flex-1 px-3 py-2 rounded-terminal border transition-all text-terminal-sm ${
              currentLevel === level.id
                ? `border-current ${level.color} bg-current/10`
                : 'border-muted text-muted hover:border-text hover:text-text'
            }`}
            onClick={() => handleSelect(level.id)}
          >
            <span class="block text-center">{level.icon}</span>
            <span class="block text-terminal-xs mt-1">{level.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// Nickname Editor Component
// ============================================================================

interface NicknameEditorProps {
  nickname: string;
  onSave: (nickname: string) => void;
}

const NicknameEditor: FunctionComponent<NicknameEditorProps> = ({
  nickname: initialNickname,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState(initialNickname);

  const handleSave = () => {
    const trimmed = nickname.trim();
    if (trimmed && trimmed !== initialNickname) {
      onSave(trimmed);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setNickname(initialNickname);
    setIsEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div class="flex items-center gap-2">
        <input
          type="text"
          class="terminal-input flex-1"
          value={nickname}
          onInput={(e) => setNickname((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          autoFocus
          maxLength={32}
        />
        <button class="btn-terminal btn-terminal-sm" onClick={handleSave}>
          [OK]
        </button>
        <button class="btn-terminal-ghost btn-terminal-sm" onClick={handleCancel}>
          [X]
        </button>
      </div>
    );
  }

  return (
    <div class="flex items-center justify-between">
      <h2 class="text-terminal-xl font-bold text-primary truncate">{nickname}</h2>
      <button
        class="btn-terminal-ghost btn-terminal-sm text-terminal-xs"
        onClick={() => setIsEditing(true)}
      >
        [EDIT]
      </button>
    </div>
  );
};

// ============================================================================
// Notes Editor Component
// ============================================================================

interface NotesEditorProps {
  notes: string | undefined;
  onSave: (notes: string | undefined) => void;
}

const NotesEditor: FunctionComponent<NotesEditorProps> = ({ notes: initialNotes, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState(initialNotes || '');

  const handleSave = () => {
    const trimmed = notes.trim();
    onSave(trimmed || undefined);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div class="card-terminal">
        <span class="text-terminal-xs text-muted uppercase tracking-wider block mb-2">
          Notes
        </span>
        <textarea
          class="terminal-textarea w-full"
          value={notes}
          onInput={(e) => setNotes((e.target as HTMLTextAreaElement).value)}
          placeholder="Add private notes about this peer..."
          rows={3}
          maxLength={500}
        />
        <div class="flex justify-end gap-2 mt-2">
          <button class="btn-terminal-ghost btn-terminal-sm" onClick={() => setIsEditing(false)}>
            Cancel
          </button>
          <button class="btn-terminal btn-terminal-sm" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="card-terminal">
      <div class="flex items-center justify-between mb-2">
        <span class="text-terminal-xs text-muted uppercase tracking-wider">Notes</span>
        <button
          class="btn-terminal-ghost btn-terminal-sm text-terminal-xs"
          onClick={() => setIsEditing(true)}
        >
          [EDIT]
        </button>
      </div>
      <p class="text-terminal-sm text-text/70 italic">
        {initialNotes || 'No notes added.'}
      </p>
    </div>
  );
};

// ============================================================================
// PeerProfile Component
// ============================================================================

export const PeerProfile: FunctionComponent<PeerProfileProps> = ({
  fingerprint,
  onBack,
  onMessage,
  onVerify,
}) => {
  const peer = usePeer(fingerprint);
  const { updatePeer, setTrusted, setBlocked, removePeer } = usePeersStore();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleNicknameSave = useCallback(
    (nickname: string) => {
      updatePeer(fingerprint, { nickname });
    },
    [fingerprint, updatePeer]
  );

  const handleTrustChange = useCallback(
    (trusted: boolean, blocked: boolean) => {
      if (blocked) {
        setBlocked(fingerprint, true);
      } else if (trusted) {
        setTrusted(fingerprint, true);
      } else {
        setBlocked(fingerprint, false);
        setTrusted(fingerprint, false);
      }
    },
    [fingerprint, setTrusted, setBlocked]
  );

  const handleNotesSave = useCallback(
    (notes: string | undefined) => {
      updatePeer(fingerprint, { notes });
    },
    [fingerprint, updatePeer]
  );

  const handleDelete = useCallback(() => {
    removePeer(fingerprint);
    if (onBack) {
      onBack();
    }
  }, [fingerprint, removePeer, onBack]);

  if (!peer) {
    return (
      <div class="flex flex-col h-full bg-background p-4">
        <div class="empty-state">
          <div class="empty-state-icon text-2xl">[!]</div>
          <h3 class="empty-state-title">Peer not found</h3>
          <p class="empty-state-description">This peer may have been removed.</p>
          {onBack && (
            <button class="btn-terminal mt-4" onClick={onBack}>
              Back to Peers
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="flex flex-col h-full bg-background">
      {/* Header */}
      <div class="px-4 py-3 border-b border-muted flex items-center gap-3">
        {onBack && (
          <button
            class="btn-terminal-ghost btn-terminal-sm"
            onClick={onBack}
            aria-label="Go back"
          >
            &lt;
          </button>
        )}
        <div class="flex-1 min-w-0">
          <NicknameEditor nickname={peer.nickname} onSave={handleNicknameSave} />
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status bar */}
        <div class="flex items-center justify-between text-terminal-sm">
          <div class="flex items-center gap-2">
            <div
              class={`w-2 h-2 rounded-full ${
                peer.status === 'online'
                  ? 'bg-terminal-green shadow-[0_0_6px_theme(colors.terminal-green)]'
                  : peer.status === 'away'
                  ? 'bg-terminal-yellow'
                  : 'bg-muted'
              }`}
            />
            <span class="text-muted">
              {peer.status === 'online' ? 'Online now' : `Last seen ${formatLastSeen(peer.lastSeenAt)}`}
            </span>
          </div>
          <span class="text-terminal-xs text-muted uppercase">
            via {peer.source}
          </span>
        </div>

        {/* NIP-05 identifier */}
        {peer.nip05 && (
          <div class="flex items-center gap-2 text-terminal-sm">
            <span class="text-terminal-blue">{peer.nip05}</span>
            <span class="text-terminal-xs text-terminal-green">[NIP-05]</span>
          </div>
        )}

        {/* Fingerprint grid */}
        <FingerprintGrid fingerprint={peer.fingerprint} />

        {/* Trust level */}
        <TrustLevelSelector
          isTrusted={peer.isTrusted}
          isBlocked={peer.isBlocked}
          onChange={handleTrustChange}
        />

        {/* Notes */}
        <NotesEditor notes={peer.notes} onSave={handleNotesSave} />

        {/* Danger zone */}
        <div class="card-terminal border-terminal-red/30">
          <span class="text-terminal-xs text-terminal-red uppercase tracking-wider block mb-3">
            Danger Zone
          </span>
          {showDeleteConfirm ? (
            <div class="space-y-3">
              <p class="text-terminal-sm text-text">
                Are you sure you want to remove this peer? This cannot be undone.
              </p>
              <div class="flex gap-2">
                <button
                  class="btn-terminal-ghost btn-terminal-sm flex-1"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  class="btn-terminal-danger btn-terminal-sm flex-1"
                  onClick={handleDelete}
                >
                  Remove Peer
                </button>
              </div>
            </div>
          ) : (
            <button
              class="btn-terminal-danger w-full"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Remove Peer
            </button>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div class="px-4 py-3 border-t border-muted flex gap-3">
        {onVerify && !peer.isTrusted && !peer.isBlocked && (
          <button
            class="btn-terminal-secondary flex-1"
            onClick={() => onVerify(peer)}
          >
            Verify
          </button>
        )}
        {onMessage && !peer.isBlocked && (
          <button
            class="btn-terminal flex-1"
            onClick={() => onMessage(peer)}
          >
            Message
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export { FingerprintGrid, TrustLevelSelector };
export type { PeerProfileProps };
