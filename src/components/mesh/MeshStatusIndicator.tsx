/**
 * Mesh Status Indicator
 *
 * Small colored dot indicating mesh network status.
 * Placed in the header to show connection state at a glance.
 *
 * Colors:
 * - Green: Connected to mesh, peers available
 * - Yellow: Connecting or reconnecting (with pulse animation)
 * - Gray: Disconnected, no peers
 */

import type { FunctionComponent } from 'preact';
import { useCallback } from 'preact/hooks';
import { useMeshStatus, useMeshPeerCount } from '../../stores/mesh-store';
import { useNavigationStore } from '../../stores/navigation-store';
import type { MeshStatus } from '../../services/mesh/types';

// ============================================================================
// Types
// ============================================================================

interface MeshStatusIndicatorProps {
  /** Whether to show the label text on larger screens */
  showLabel?: boolean;
  /** Custom class name */
  class?: string;
}

// ============================================================================
// Status Configuration
// ============================================================================

interface StatusConfig {
  color: string;
  bgColor: string;
  label: string;
  pulse: boolean;
}

const getStatusConfig = (status: MeshStatus, peerCount: number): StatusConfig => {
  switch (status) {
    case 'connected':
      return peerCount > 0
        ? {
            color: 'bg-terminal-green',
            bgColor: 'bg-terminal-green/20',
            label: `MESH (${peerCount})`,
            pulse: false,
          }
        : {
            color: 'bg-gray-500',
            bgColor: 'bg-gray-500/20',
            label: 'NO PEERS',
            pulse: false,
          };

    case 'connecting':
    case 'discovering':
      return {
        color: 'bg-yellow-500',
        bgColor: 'bg-yellow-500/20',
        label: status === 'connecting' ? 'CONNECTING' : 'DISCOVERING',
        pulse: true,
      };

    case 'disconnected':
    default:
      return {
        color: 'bg-gray-500',
        bgColor: 'bg-gray-500/20',
        label: 'OFFLINE',
        pulse: false,
      };
  }
};

// ============================================================================
// Component
// ============================================================================

export const MeshStatusIndicator: FunctionComponent<MeshStatusIndicatorProps> = ({
  showLabel = true,
  class: className = '',
}) => {
  const status = useMeshStatus();
  const peerCount = useMeshPeerCount();
  const openSheet = useNavigationStore((state) => state.openSheet);

  const config = getStatusConfig(status, peerCount);

  const handleClick = useCallback(() => {
    openSheet('mesh-status', {
      title: 'Mesh Network',
      height: 'full',
    });
  }, [openSheet]);

  return (
    <button
      type="button"
      onClick={handleClick}
      class={`flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800/50 transition-colors ${className}`}
      aria-label={`Mesh status: ${config.label}. Tap to view details.`}
    >
      {/* Status dot with optional pulse */}
      <div class="relative flex items-center justify-center">
        <div
          class={`w-2.5 h-2.5 rounded-full ${config.color} ${
            config.pulse ? 'animate-pulse' : ''
          }`}
        />
        {config.pulse && (
          <div
            class={`absolute w-2.5 h-2.5 rounded-full ${config.color} animate-ping opacity-75`}
          />
        )}
      </div>

      {/* Label (hidden on small screens) */}
      {showLabel && (
        <span class="text-xs text-gray-400 hidden sm:inline font-mono">
          {config.label}
        </span>
      )}
    </button>
  );
};

export default MeshStatusIndicator;
