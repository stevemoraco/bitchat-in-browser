/**
 * Header Component - BitChat In Browser
 *
 * Top navigation bar with:
 * - App title "BitChat In Browser"
 * - Connection status indicator (online/offline/syncing)
 * - Sync progress indicator
 * - Emergency wipe trigger (triple-tap on title)
 */

import { FunctionComponent } from 'preact';
import { useState, useCallback, useRef } from 'preact/hooks';
import { useAppStore, useConnectionStatus } from '../../stores';

// ============================================================================
// Types
// ============================================================================

export type ConnectionState = 'online' | 'offline' | 'syncing';

interface HeaderProps {
  /** Current sync progress (0-100), undefined if not syncing */
  syncProgress?: number;
  /** Number of connected relays */
  relayCount?: number;
  /** Callback when emergency wipe is triggered */
  onEmergencyWipe?: () => void;
}

// ============================================================================
// Connection Status Indicator
// ============================================================================

interface StatusIndicatorProps {
  state: ConnectionState;
}

const StatusIndicator: FunctionComponent<StatusIndicatorProps> = ({ state }) => {
  const statusConfig = {
    online: {
      color: 'bg-terminal-green',
      label: 'ONLINE',
      pulse: false,
    },
    offline: {
      color: 'bg-terminal-red',
      label: 'OFFLINE',
      pulse: false,
    },
    syncing: {
      color: 'bg-terminal-yellow',
      label: 'SYNCING',
      pulse: true,
    },
  };

  const config = statusConfig[state];

  return (
    <div class="flex items-center gap-2">
      <div class="relative flex items-center">
        <div
          class={`w-2 h-2 rounded-full ${config.color} ${
            config.pulse ? 'animate-pulse' : ''
          }`}
        />
        {config.pulse && (
          <div
            class={`absolute w-2 h-2 rounded-full ${config.color} animate-ping opacity-75`}
          />
        )}
      </div>
      <span class="text-terminal-xs text-terminal-green/70 hidden sm:inline">
        [{config.label}]
      </span>
    </div>
  );
};

// ============================================================================
// Sync Progress Bar
// ============================================================================

interface SyncProgressProps {
  progress: number;
}

const SyncProgress: FunctionComponent<SyncProgressProps> = ({ progress }) => {
  if (progress >= 100) return null;

  return (
    <div class="flex items-center gap-2">
      <div class="w-16 sm:w-24 h-1 bg-terminal-green/20 rounded-full overflow-hidden">
        <div
          class="h-full bg-terminal-green transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <span class="text-terminal-xs text-terminal-green/50 hidden sm:inline">
        {Math.round(progress)}%
      </span>
    </div>
  );
};

// ============================================================================
// Header Component
// ============================================================================

export const Header: FunctionComponent<HeaderProps> = ({
  syncProgress,
  relayCount = 0,
  onEmergencyWipe,
}) => {
  const { isOnline } = useConnectionStatus();
  const error = useAppStore((state) => state.error);

  // Triple-tap detection for emergency wipe
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TRIPLE_TAP_THRESHOLD = 500; // ms between taps
  const REQUIRED_TAPS = 3;

  const handleTitleTap = useCallback(() => {
    // Clear previous timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    const newTapCount = tapCount + 1;

    if (newTapCount >= REQUIRED_TAPS) {
      // Triple tap detected - trigger emergency wipe
      setTapCount(0);
      if (onEmergencyWipe) {
        // Confirm before wiping
        const confirmed = confirm(
          'EMERGENCY WIPE: This will delete ALL local data including your keys. Are you absolutely sure?'
        );
        if (confirmed) {
          onEmergencyWipe();
        }
      }
    } else {
      setTapCount(newTapCount);
      // Reset tap count after threshold
      tapTimeoutRef.current = setTimeout(() => {
        setTapCount(0);
      }, TRIPLE_TAP_THRESHOLD);
    }
  }, [tapCount, onEmergencyWipe]);

  // Determine connection state
  const connectionState: ConnectionState =
    syncProgress !== undefined && syncProgress < 100
      ? 'syncing'
      : isOnline
        ? 'online'
        : 'offline';

  return (
    <header class="sticky top-0 z-50 bg-terminal-bg border-b border-terminal-green/30 safe-top">
      <div class="flex items-center justify-between px-4 py-3">
        {/* Left: App title with emergency wipe trigger */}
        <div class="flex items-center gap-3">
          <button
            onClick={handleTitleTap}
            class="text-terminal-green font-bold text-lg select-none focus:outline-none active:opacity-80"
            aria-label="BitChat In Browser"
          >
            <span class="hidden sm:inline">BitChat In Browser</span>
            <span class="sm:hidden">BitChat</span>
          </button>

          {/* Visual feedback for tap count (subtle) */}
          {tapCount > 0 && tapCount < REQUIRED_TAPS && (
            <div class="flex gap-0.5">
              {Array.from({ length: tapCount }).map((_, i) => (
                <div key={i} class="w-1.5 h-1.5 rounded-full bg-terminal-red" />
              ))}
            </div>
          )}
        </div>

        {/* Right: Status indicators */}
        <div class="flex items-center gap-4">
          {/* Sync progress */}
          {syncProgress !== undefined && syncProgress < 100 && (
            <SyncProgress progress={syncProgress} />
          )}

          {/* Relay count (when online) */}
          {isOnline && relayCount > 0 && (
            <span class="text-terminal-xs text-terminal-green/50 hidden md:inline">
              {relayCount} relay{relayCount !== 1 ? 's' : ''}
            </span>
          )}

          {/* Connection status */}
          <StatusIndicator state={connectionState} />
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div class="px-4 py-2 bg-terminal-red/10 border-t border-terminal-red/30">
          <p class="text-terminal-xs text-terminal-red truncate">
            [ERROR] {error}
          </p>
        </div>
      )}
    </header>
  );
};

export default Header;
