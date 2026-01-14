/**
 * Mesh Debug Panel
 *
 * Full sheet panel showing detailed mesh network information:
 * - Connection status and method
 * - Topology mode and settings
 * - Connected peers list
 * - App version comparison
 * - Quick actions (Share QR, Join Mesh, Disconnect)
 */

import type { FunctionComponent, ComponentChildren } from 'preact';
import { useMemo, useCallback } from 'preact/hooks';
import {
  useMeshStore,
  useMeshStatus,
  useMeshPeers,
  useMeshTopology,
  type TopologyMode,
} from '../../stores/mesh-store';
import { useAppStore } from '../../stores/app-store';
import { useNavigationStore } from '../../stores/navigation-store';
import type { MeshStatus, ConnectionMethod } from '../../services/mesh/types';
import { PeerListItem } from './PeerListItem';

// ============================================================================
// Types
// ============================================================================

export interface MeshDebugPanelProps {
  /** Callback when closing the panel */
  onClose?: () => void;
}

// ============================================================================
// Status Badge Component
// ============================================================================

interface StatusBadgeProps {
  status: MeshStatus;
}

const StatusBadge: FunctionComponent<StatusBadgeProps> = ({ status }) => {
  const config = {
    connected: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Connected' },
    connecting: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Connecting' },
    discovering: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Discovering' },
    disconnected: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Disconnected' },
  }[status];

  return (
    <span class={`px-2 py-1 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
};

// ============================================================================
// Section Components
// ============================================================================

interface SectionProps {
  title: string;
  children: ComponentChildren;
}

const Section: FunctionComponent<SectionProps> = ({ title, children }) => (
  <div class="mb-6">
    <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
      {title}
    </h3>
    {children}
  </div>
);

interface InfoRowProps {
  label: string;
  value: string | ComponentChildren;
  valueClass?: string;
}

const InfoRow: FunctionComponent<InfoRowProps> = ({ label, value, valueClass = '' }) => (
  <div class="flex justify-between items-center py-2 border-b border-gray-800 last:border-b-0">
    <span class="text-gray-400">{label}</span>
    <span class={`text-white font-mono ${valueClass}`}>{value}</span>
  </div>
);

// ============================================================================
// Topology Slider Component
// ============================================================================

interface TopologySliderProps {
  peerCount: number;
  threshold: number;
  mode: TopologyMode;
  onThresholdChange: (threshold: number) => void;
  onModeChange: (mode: TopologyMode) => void;
}

const TopologySlider: FunctionComponent<TopologySliderProps> = ({
  peerCount,
  threshold,
  mode,
  onThresholdChange,
  onModeChange,
}) => {
  const maxPeers = 50;
  const progressPercent = Math.min(100, (peerCount / maxPeers) * 100);

  // Calculate topology stats
  const fullMeshConnections = (peerCount * (peerCount - 1)) / 2;
  const hubSpokeConnections = peerCount;
  const isHubSpoke = mode === 'hub-spoke' || (mode === 'auto' && peerCount > threshold);
  const currentConnections = isHubSpoke ? hubSpokeConnections : fullMeshConnections;
  const estimatedLatency = isHubSpoke ? 100 : 50;
  const batteryImpact = currentConnections > 50 ? 'Higher' : currentConnections > 20 ? 'Medium' : 'Low';

  return (
    <div class="space-y-4">
      {/* Progress bar */}
      <div>
        <div class="flex justify-between text-xs text-gray-400 mb-1">
          <span>Connections</span>
          <span>{peerCount} peers</span>
        </div>
        <div class="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            class={`h-full transition-all duration-300 ${
              isHubSpoke ? 'bg-blue-500' : 'bg-green-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div class="flex justify-between text-xs text-gray-500 mt-1">
          <span>Full Mesh</span>
          <span>Hub-Spoke</span>
        </div>
      </div>

      {/* Threshold slider */}
      <div>
        <label class="block text-xs text-gray-400 mb-2">
          Auto-switch threshold: {threshold} peers
        </label>
        <input
          type="range"
          min="5"
          max="30"
          value={threshold}
          onInput={(e) => onThresholdChange(parseInt((e.target as HTMLInputElement).value, 10))}
          class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
        />
      </div>

      {/* Mode selector */}
      <div class="flex gap-2">
        {(['auto', 'full-mesh', 'hub-spoke'] as TopologyMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            class={`flex-1 px-3 py-2 rounded text-xs font-medium transition-colors ${
              mode === m
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {m === 'auto' ? 'Auto' : m === 'full-mesh' ? 'Full Mesh' : 'Hub-Spoke'}
          </button>
        ))}
      </div>

      {/* Current stats */}
      <div class="p-3 bg-gray-800/50 rounded-lg space-y-1 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-400">Current Mode</span>
          <span class={`font-medium ${isHubSpoke ? 'text-blue-400' : 'text-green-400'}`}>
            {isHubSpoke ? 'Hub-Spoke' : 'Full Mesh'}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Connections</span>
          <span class="text-white font-mono">{currentConnections}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Est. Latency</span>
          <span class="text-white font-mono">~{estimatedLatency}ms</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-400">Battery Impact</span>
          <span class={`font-medium ${
            batteryImpact === 'Higher' ? 'text-red-400' :
            batteryImpact === 'Medium' ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {batteryImpact}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Version Section Component
// ============================================================================

interface VersionSectionProps {
  localVersion: string;
  peers: Array<{ peerId: string; nickname?: string; appVersion?: string }>;
}

const VersionSection: FunctionComponent<VersionSectionProps> = ({ localVersion, peers }) => {
  const peersWithVersions = peers.filter((p) => p.appVersion);
  const newerPeers = peersWithVersions.filter((p) => {
    if (!p.appVersion) return false;
    return compareVersions(p.appVersion, localVersion) > 0;
  });

  return (
    <div class="space-y-3">
      <InfoRow
        label="Your Version"
        value={
          <span class="flex items-center gap-2">
            <span>{localVersion}</span>
            {newerPeers.length > 0 && (
              <span class="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                Update Available
              </span>
            )}
          </span>
        }
      />

      {peersWithVersions.length > 0 && (
        <div class="space-y-2">
          <span class="text-xs text-gray-500">Peer Versions</span>
          <div class="space-y-1">
            {peersWithVersions.map((peer) => {
              const isNewer = peer.appVersion && compareVersions(peer.appVersion, localVersion) > 0;
              return (
                <div
                  key={peer.peerId}
                  class="flex justify-between text-sm py-1 px-2 bg-gray-800/30 rounded"
                >
                  <span class="text-gray-400 truncate mr-2">
                    {peer.nickname || peer.peerId.slice(0, 8)}
                  </span>
                  <span class={`font-mono ${isNewer ? 'text-yellow-400' : 'text-gray-300'}`}>
                    v{peer.appVersion}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Compare semantic versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA > numB) return 1;
    if (numA < numB) return -1;
  }
  return 0;
}

// ============================================================================
// Action Button Component
// ============================================================================

interface ActionButtonProps {
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  children: ComponentChildren;
}

const ActionButton: FunctionComponent<ActionButtonProps> = ({
  onClick,
  variant = 'secondary',
  disabled = false,
  children,
}) => {
  const variantClasses = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
    danger: 'bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      class={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${variantClasses[variant]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {children}
    </button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const MeshDebugPanel: FunctionComponent<MeshDebugPanelProps> = ({ onClose: _onClose }) => {
  const status = useMeshStatus();
  const peers = useMeshPeers();
  const topology = useMeshTopology();
  const connectionMethod = useMeshStore((state) => state.connectionMethod);
  const localPeerId = useMeshStore((state) => state.localPeerId);
  const messagesRelayed = useMeshStore((state) => state.messagesRelayed);
  const bytesTransferred = useMeshStore((state) => state.bytesTransferred);
  const setTopologyMode = useMeshStore((state) => state.setTopologyMode);
  const setFullMeshThreshold = useMeshStore((state) => state.setFullMeshThreshold);
  const clearPeers = useMeshStore((state) => state.clearPeers);

  const appVersion = useAppStore((state) => state.version);
  const openSheet = useNavigationStore((state) => state.openSheet);

  // Sort peers by latency
  const sortedPeers = useMemo(() =>
    [...peers].sort((a, b) => {
      const latencyA = a.latency ?? Infinity;
      const latencyB = b.latency ?? Infinity;
      return latencyA - latencyB;
    })
  , [peers]);

  const getConnectionMethodLabel = (method: ConnectionMethod | null): string => {
    switch (method) {
      case 'nostr':
        return 'Nostr Relays';
      case 'direct':
        return 'Direct WebRTC';
      case 'cached':
        return 'Cached Peers';
      case 'local':
        return 'Local Network';
      default:
        return 'None';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleShareQR = useCallback(() => {
    openSheet('mesh-join', { title: 'Share via QR' });
  }, [openSheet]);

  const handleJoinMesh = useCallback(() => {
    openSheet('mesh-join', { title: 'Join Mesh' });
  }, [openSheet]);

  const handleDisconnect = useCallback(() => {
    // eslint-disable-next-line no-alert
    if (confirm('Disconnect from mesh network? You will lose connection to all peers.')) {
      clearPeers();
    }
  }, [clearPeers]);

  return (
    <div class="p-4 space-y-6">
      {/* Header with status */}
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold text-white">Mesh Network</h2>
          {localPeerId && (
            <p class="text-xs text-gray-500 font-mono mt-1">
              Your ID: {localPeerId.slice(0, 12)}...
            </p>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Connection Info */}
      <Section title="Connection">
        <div class="bg-gray-800/50 rounded-lg p-3 space-y-0">
          <InfoRow label="Method" value={getConnectionMethodLabel(connectionMethod)} />
          <InfoRow
            label="Topology"
            value={
              <span class="flex items-center gap-2">
                {topology.shouldUseHubSpoke ? 'Hub-Spoke' : 'Full Mesh'}
                <span class="text-gray-500">({peers.length} peers)</span>
              </span>
            }
          />
          <InfoRow label="Messages Relayed" value={messagesRelayed.toLocaleString()} />
          <InfoRow label="Data Transferred" value={formatBytes(bytesTransferred)} />
        </div>
      </Section>

      {/* Topology Settings */}
      <Section title="Topology Settings">
        <TopologySlider
          peerCount={peers.length}
          threshold={topology.threshold}
          mode={topology.mode}
          onThresholdChange={setFullMeshThreshold}
          onModeChange={setTopologyMode}
        />
      </Section>

      {/* Peer List */}
      <Section title={`Connected Peers (${peers.length})`}>
        {sortedPeers.length === 0 ? (
          <div class="text-center py-8 text-gray-500">
            <p>No peers connected</p>
            <p class="text-sm mt-1">Use Share or Join to connect</p>
          </div>
        ) : (
          <div class="space-y-2 max-h-64 overflow-y-auto">
            {sortedPeers.map((peer) => (
              <PeerListItem key={peer.peerId} peer={peer} detailed />
            ))}
          </div>
        )}
      </Section>

      {/* App Version */}
      <Section title="App Version">
        <VersionSection localVersion={appVersion} peers={peers} />
      </Section>

      {/* Actions */}
      <Section title="Actions">
        <div class="space-y-3">
          <ActionButton onClick={handleShareQR} variant="primary">
            Share via QR
          </ActionButton>
          <ActionButton onClick={handleJoinMesh} variant="secondary">
            Join Mesh
          </ActionButton>
          {status === 'connected' && peers.length > 0 && (
            <ActionButton onClick={handleDisconnect} variant="danger">
              Disconnect
            </ActionButton>
          )}
        </div>
      </Section>
    </div>
  );
};

export default MeshDebugPanel;
