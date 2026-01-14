/**
 * Header Component - BitChat In Browser
 *
 * iOS-style header with:
 * - Menu button (hamburger) - opens sidebar/menu sheet
 * - Channel badge with dropdown - opens channel selector
 * - Inline editable nickname display
 * - Peer count with icon - opens peer list
 * - Mesh status indicator (colored dot)
 * - Settings gear - opens settings sheet
 *
 * Layout:
 * [Menu] [Channel Badge] [Nickname] [Peer Count] [Status] [Settings]
 */

import type { FunctionComponent } from 'preact';
import { useState, useCallback, useRef, useEffect } from 'preact/hooks';
import { useNavigationStore } from '../../stores/navigation-store';
import { useMeshStore } from '../../stores/mesh-store';
import { useSettingsStore, useNickname } from '../../stores/settings-store';
import { useFingerprint } from '../../stores/identity-store';
import { ChannelBadge } from './ChannelBadge';
import { MeshStatusIndicator } from '../mesh/MeshStatusIndicator';

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 'online' | 'offline' | 'syncing';

interface HeaderProps {
  /** Callback when menu button is clicked */
  onMenuClick?: () => void;
  /** Callback when emergency wipe is triggered */
  onEmergencyWipe?: () => void;
}

// ============================================================================
// Peer Count Button
// ============================================================================

interface PeerCountButtonProps {
  count: number;
  onClick: () => void;
}

const PeerCountButton: FunctionComponent<PeerCountButtonProps> = ({
  count,
  onClick,
}) => (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-terminal-green/10 active:bg-terminal-green/20 transition-colors"
      aria-label={`${count} peer${count !== 1 ? 's' : ''} connected`}
    >
      <span className="text-terminal-green text-sm">{count}</span>
      <span className="text-base" role="img" aria-hidden="true">
        &#x1F464;
      </span>
    </button>
  );

// ============================================================================
// Inline Editable Nickname
// ============================================================================

interface EditableNicknameProps {
  nickname: string;
  fallback: string;
  onSave: (nickname: string) => void;
}

const EditableNickname: FunctionComponent<EditableNicknameProps> = ({
  nickname,
  fallback,
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(nickname);
  const inputRef = useRef<HTMLInputElement>(null);

  // Update edit value when nickname changes externally
  useEffect(() => {
    if (!isEditing) {
      setEditValue(nickname);
    }
  }, [nickname, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== nickname) {
      onSave(trimmed);
    } else {
      setEditValue(nickname);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setEditValue(nickname);
      setIsEditing(false);
    }
  };

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    // Limit to 32 characters
    setEditValue(target.value.slice(0, 32));
  };

  const displayName = nickname || fallback;

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="bg-terminal-green/10 border border-terminal-green/30 rounded px-2 py-1 text-terminal-green text-sm font-medium max-w-[120px] focus:outline-none focus:border-terminal-green/50"
        placeholder="Nickname"
        maxLength={32}
        aria-label="Edit nickname"
      />
    );
  }

  return (
    <button
      onClick={handleClick}
      className="text-terminal-green text-sm font-medium truncate max-w-[120px] hover:text-terminal-green/80 transition-colors cursor-text"
      aria-label="Click to edit nickname"
      title={`${displayName} (click to edit)`}
    >
      {displayName}
    </button>
  );
};

// ============================================================================
// Menu Button (Hamburger)
// ============================================================================

interface MenuButtonProps {
  onClick: () => void;
}

const MenuButton: FunctionComponent<MenuButtonProps> = ({ onClick }) => (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-terminal-green/10 active:bg-terminal-green/20 transition-colors"
      aria-label="Open menu"
    >
      <svg
        className="w-5 h-5 text-terminal-green"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 12h16M4 18h16"
        />
      </svg>
    </button>
  );

// ============================================================================
// Settings Button (Gear)
// ============================================================================

interface SettingsButtonProps {
  onClick: () => void;
}

const SettingsButton: FunctionComponent<SettingsButtonProps> = ({ onClick }) => (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-terminal-green/10 active:bg-terminal-green/20 transition-colors"
      aria-label="Open settings"
    >
      <svg
        className="w-5 h-5 text-terminal-green"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    </button>
  );

// ============================================================================
// Header Component
// ============================================================================

export const Header: FunctionComponent<HeaderProps> = ({
  onMenuClick,
  onEmergencyWipe,
}) => {
  // Navigation store
  const openSettings = useNavigationStore((state) => state.openSettings);
  const openPeers = useNavigationStore((state) => state.openPeers);

  // Mesh store
  const meshPeerCount = useMeshStore((state) => state.peers.length);

  // Settings store
  const nickname = useNickname();
  const setNickname = useSettingsStore((state) => state.setNickname);

  // Identity store for fallback display name
  const fingerprint = useFingerprint();
  const fallbackName = fingerprint
    ? `anon-${fingerprint.slice(0, 6)}`
    : 'Anonymous';

  // Triple-tap detection for emergency wipe (on the nickname)
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TRIPLE_TAP_THRESHOLD = 500;
  const REQUIRED_TAPS = 3;

  const handleTitleTap = useCallback(() => {
    if (!onEmergencyWipe) return;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    const newTapCount = tapCount + 1;

    if (newTapCount >= REQUIRED_TAPS) {
      setTapCount(0);
      const confirmed = confirm(
        'EMERGENCY WIPE: This will delete ALL local data including your keys. Are you absolutely sure?'
      );
      if (confirmed) {
        onEmergencyWipe();
      }
    } else {
      setTapCount(newTapCount);
      tapTimeoutRef.current = setTimeout(() => {
        setTapCount(0);
      }, TRIPLE_TAP_THRESHOLD);
    }
  }, [tapCount, onEmergencyWipe]);

  // Handlers
  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
    }
  };

  const handlePeerClick = () => {
    openPeers();
  };

  const handleSettingsClick = () => {
    openSettings();
  };

  const handleNicknameSave = (newNickname: string) => {
    setNickname(newNickname);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-terminal-bg border-b border-terminal-green/30 safe-top">
      <div className="flex items-center justify-between px-2 py-2 gap-2">
        {/* Left section: Menu + Channel Badge */}
        <div className="flex items-center gap-1 min-w-0 flex-shrink-0">
          <MenuButton onClick={handleMenuClick} />
          <ChannelBadge />
        </div>

        {/* Center section: Nickname (with emergency wipe trigger) */}
        <div
          className="flex items-center justify-center flex-1 min-w-0 cursor-pointer"
          onClick={handleTitleTap}
        >
          <EditableNickname
            nickname={nickname}
            fallback={fallbackName}
            onSave={handleNicknameSave}
          />
          {/* Visual feedback for tap count (subtle) */}
          {tapCount > 0 && tapCount < REQUIRED_TAPS && (
            <div className="flex gap-0.5 ml-1">
              {Array.from({ length: tapCount }).map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-terminal-red"
                />
              ))}
            </div>
          )}
        </div>

        {/* Right section: Peer Count + Status + Settings */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <PeerCountButton count={meshPeerCount} onClick={handlePeerClick} />
          <MeshStatusIndicator showLabel={false} />
          <SettingsButton onClick={handleSettingsClick} />
        </div>
      </div>
    </header>
  );
};

export default Header;
