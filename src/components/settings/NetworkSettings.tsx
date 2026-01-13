/**
 * Network Settings Component
 *
 * Manages network connectivity settings:
 * - Relay list management (add/remove relays)
 * - Relay health status display
 * - WebRTC settings
 * - Connection timeout configuration
 *
 * @module components/settings/NetworkSettings
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import {
  getDefaultRelayManager,
  type RelayStats,
} from '../../services/nostr/relay-manager';
import { PRIMARY_RELAY_URLS } from '../../services/nostr/relay-list';

// ============================================================================
// Types
// ============================================================================

interface RelayDisplayInfo {
  url: string;
  state: 'connected' | 'connecting' | 'disconnected' | 'error';
  isPrimary: boolean;
  isWhitelisted: boolean;
  isBlacklisted: boolean;
  latencyMs?: number;
  reliabilityScore: number;
  messagesSent: number;
  messagesReceived: number;
  lastError?: string;
}

type RelayFilter = 'all' | 'connected' | 'disconnected' | 'primary' | 'custom';

// ============================================================================
// Component
// ============================================================================

export const NetworkSettings: FunctionComponent = () => {
  // State
  const [relays, setRelays] = useState<RelayDisplayInfo[]>([]);
  const [connectionSummary, setConnectionSummary] = useState({
    connected: 0,
    connecting: 0,
    disconnected: 0,
    error: 0,
    total: 0,
  });
  const [filter, setFilter] = useState<RelayFilter>('connected');
  const [newRelayUrl, setNewRelayUrl] = useState('');
  const [addRelayError, setAddRelayError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // WebRTC settings (placeholder - would be stored in settings store)
  const [webrtcEnabled, setWebrtcEnabled] = useState(true);
  const [connectionTimeout, setConnectionTimeout] = useState(10000);

  // Load relay data
  const loadRelayData = useCallback(async () => {
    try {
      const relayManager = getDefaultRelayManager();
      const statuses = relayManager.getRelayStatuses();
      const stats = relayManager.getRelayStats();
      const whitelist = new Set(relayManager.getWhitelist());
      const blacklist = new Set(relayManager.getBlacklist());

      const relayInfo: RelayDisplayInfo[] = statuses.map((status) => {
        const relayStats = stats.get(status.url) || {
          reliabilityScore: 50,
          messagesSent: 0,
          messagesReceived: 0,
        } as RelayStats;

        return {
          url: status.url,
          state: status.state,
          isPrimary: PRIMARY_RELAY_URLS.includes(status.url),
          isWhitelisted: whitelist.has(status.url),
          isBlacklisted: blacklist.has(status.url),
          latencyMs: status.state === 'connected' ? Math.round(Math.random() * 200 + 50) : undefined, // Placeholder
          reliabilityScore: relayStats.reliabilityScore,
          messagesSent: status.messagesSent ?? 0,
          messagesReceived: status.messagesReceived ?? 0,
          lastError: typeof status.lastError === 'string'
            ? status.lastError
            : status.lastError?.message,
        };
      });

      setRelays(relayInfo);
      setConnectionSummary(relayManager.getConnectionSummary());
    } catch (error) {
      console.error('Failed to load relay data:', error);
    }
  }, []);

  // Initial load and periodic refresh
  useEffect(() => {
    loadRelayData();
    const interval = setInterval(loadRelayData, 5000);
    return () => clearInterval(interval);
  }, [loadRelayData]);

  // Filter relays
  const filteredRelays = relays.filter((relay) => {
    switch (filter) {
      case 'connected':
        return relay.state === 'connected';
      case 'disconnected':
        return relay.state === 'disconnected' || relay.state === 'error';
      case 'primary':
        return relay.isPrimary;
      case 'custom':
        return relay.isWhitelisted && !relay.isPrimary;
      default:
        return true;
    }
  });

  // Add new relay
  const handleAddRelay = useCallback(async () => {
    setAddRelayError(null);

    if (!newRelayUrl.trim()) {
      setAddRelayError('Please enter a relay URL');
      return;
    }

    // Validate URL format
    try {
      const url = new URL(newRelayUrl.trim());
      if (url.protocol !== 'wss:' && url.protocol !== 'ws:') {
        setAddRelayError('Relay URL must use wss:// or ws:// protocol');
        return;
      }
    } catch {
      setAddRelayError('Invalid URL format');
      return;
    }

    try {
      const relayManager = getDefaultRelayManager();
      relayManager.addToWhitelist([newRelayUrl.trim()]);
      await relayManager.addRelays([newRelayUrl.trim()]);
      setNewRelayUrl('');
      loadRelayData();
    } catch (error) {
      setAddRelayError(
        error instanceof Error ? error.message : 'Failed to add relay'
      );
    }
  }, [newRelayUrl, loadRelayData]);

  // Remove relay
  const handleRemoveRelay = useCallback(
    (url: string) => {
      const relayManager = getDefaultRelayManager();
      relayManager.removeFromWhitelist([url]);
      relayManager.removeRelays([url]);
      loadRelayData();
    },
    [loadRelayData]
  );

  // Toggle blacklist
  const handleToggleBlacklist = useCallback(
    (url: string, isBlacklisted: boolean) => {
      const relayManager = getDefaultRelayManager();
      if (isBlacklisted) {
        relayManager.removeFromBlacklist([url]);
      } else {
        relayManager.addToBlacklist([url]);
      }
      loadRelayData();
    },
    [loadRelayData]
  );

  // Retry connection
  const handleRetryConnection = useCallback(
    async (url: string) => {
      const relayManager = getDefaultRelayManager();
      await relayManager.retryConnection(url);
      loadRelayData();
    },
    [loadRelayData]
  );

  // Refresh all connections
  const handleRefreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const relayManager = getDefaultRelayManager();
      await relayManager.resetConnections();
      loadRelayData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadRelayData]);

  // Get state indicator
  const getStateIndicator = (state: string) => {
    switch (state) {
      case 'connected':
        return <span class="text-terminal-green">[OK]</span>;
      case 'connecting':
        return <span class="text-terminal-yellow">[..]</span>;
      case 'error':
        return <span class="text-terminal-red">[!!]</span>;
      default:
        return <span class="text-terminal-green/50">[--]</span>;
    }
  };

  return (
    <div class="space-y-6">
      {/* Connection Summary */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; Connection Status</h4>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span class="text-terminal-green/60">Connected:</span>
            <span class="ml-2 text-terminal-green font-bold">
              {connectionSummary.connected}
            </span>
          </div>
          <div>
            <span class="text-terminal-green/60">Connecting:</span>
            <span class="ml-2 text-terminal-yellow font-bold">
              {connectionSummary.connecting}
            </span>
          </div>
          <div>
            <span class="text-terminal-green/60">Disconnected:</span>
            <span class="ml-2 text-terminal-green/50">
              {connectionSummary.disconnected}
            </span>
          </div>
          <div>
            <span class="text-terminal-green/60">Error:</span>
            <span class="ml-2 text-terminal-red">
              {connectionSummary.error}
            </span>
          </div>
        </div>
        <div class="mt-3 pt-3 border-t border-terminal-green/20">
          <span class="text-terminal-green/60 text-sm">Total Relays:</span>
          <span class="ml-2 text-terminal-green">
            {connectionSummary.total}
          </span>
        </div>
      </div>

      {/* Add Relay */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; Add Custom Relay</h4>
        <div class="flex gap-2">
          <input
            type="text"
            value={newRelayUrl}
            onInput={(e) => setNewRelayUrl((e.target as HTMLInputElement).value)}
            placeholder="wss://relay.example.com"
            class="input-terminal flex-1"
          />
          <button onClick={handleAddRelay} class="btn-terminal">
            Add
          </button>
        </div>
        {addRelayError && (
          <div class="text-terminal-red text-xs mt-2">[!] {addRelayError}</div>
        )}
      </div>

      {/* Filter Tabs */}
      <div class="flex flex-wrap gap-2">
        {(['all', 'connected', 'disconnected', 'primary', 'custom'] as RelayFilter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              class={`px-3 py-1 text-xs border ${
                filter === f
                  ? 'bg-terminal-green text-terminal-bg border-terminal-green'
                  : 'border-terminal-green/30 text-terminal-green hover:border-terminal-green/50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span class="ml-1 opacity-60">
                (
                {f === 'all'
                  ? relays.length
                  : f === 'connected'
                    ? connectionSummary.connected
                    : f === 'disconnected'
                      ? connectionSummary.disconnected + connectionSummary.error
                      : f === 'primary'
                        ? relays.filter((r) => r.isPrimary).length
                        : relays.filter((r) => r.isWhitelisted && !r.isPrimary).length}
                )
              </span>
            </button>
          )
        )}
        <button
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          class="ml-auto px-3 py-1 text-xs border border-terminal-green/30 text-terminal-green hover:border-terminal-green/50"
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      {/* Relay List */}
      <div class="border border-terminal-green/30 max-h-80 overflow-y-auto">
        {filteredRelays.length === 0 ? (
          <div class="p-4 text-center text-terminal-green/50">
            No relays match the current filter
          </div>
        ) : (
          <div class="divide-y divide-terminal-green/10">
            {filteredRelays.map((relay) => (
              <div
                key={relay.url}
                class={`p-3 text-sm ${
                  relay.isBlacklisted ? 'opacity-50' : ''
                }`}
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      {getStateIndicator(relay.state)}
                      <span class="truncate text-terminal-green">
                        {relay.url.replace('wss://', '')}
                      </span>
                      {relay.isPrimary && (
                        <span class="text-xs text-terminal-yellow">[P]</span>
                      )}
                      {relay.isWhitelisted && !relay.isPrimary && (
                        <span class="text-xs text-terminal-blue">[W]</span>
                      )}
                      {relay.isBlacklisted && (
                        <span class="text-xs text-terminal-red">[B]</span>
                      )}
                    </div>
                    <div class="flex items-center gap-4 mt-1 text-xs text-terminal-green/50">
                      {relay.latencyMs !== undefined && (
                        <span>{relay.latencyMs}ms</span>
                      )}
                      <span>Score: {relay.reliabilityScore}</span>
                      <span>TX: {relay.messagesSent}</span>
                      <span>RX: {relay.messagesReceived}</span>
                    </div>
                    {relay.lastError && (
                      <div class="text-xs text-terminal-red/70 mt-1 truncate">
                        {relay.lastError}
                      </div>
                    )}
                  </div>
                  <div class="flex gap-1 flex-shrink-0">
                    {relay.state !== 'connected' && !relay.isBlacklisted && (
                      <button
                        onClick={() => handleRetryConnection(relay.url)}
                        class="px-2 py-1 text-xs border border-terminal-green/30 hover:border-terminal-green"
                        title="Retry connection"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      onClick={() =>
                        handleToggleBlacklist(relay.url, relay.isBlacklisted)
                      }
                      class={`px-2 py-1 text-xs border ${
                        relay.isBlacklisted
                          ? 'border-terminal-green/30 text-terminal-green'
                          : 'border-terminal-red/30 text-terminal-red'
                      }`}
                      title={relay.isBlacklisted ? 'Unblock' : 'Block'}
                    >
                      {relay.isBlacklisted ? 'Unblock' : 'Block'}
                    </button>
                    {relay.isWhitelisted && !relay.isPrimary && (
                      <button
                        onClick={() => handleRemoveRelay(relay.url)}
                        class="px-2 py-1 text-xs border border-terminal-red/30 text-terminal-red"
                        title="Remove custom relay"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WebRTC Settings */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; WebRTC Settings</h4>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-terminal-green">Enable WebRTC P2P</span>
              <p class="text-xs text-terminal-green/60 mt-1">
                Direct peer-to-peer connections for faster messaging
              </p>
            </div>
            <button
              onClick={() => setWebrtcEnabled(!webrtcEnabled)}
              class={`w-16 h-8 border ${
                webrtcEnabled
                  ? 'bg-terminal-green border-terminal-green'
                  : 'border-terminal-green/50'
              } flex items-center justify-center transition-colors`}
            >
              <span
                class={`text-xs font-bold ${
                  webrtcEnabled ? 'text-terminal-bg' : 'text-terminal-green/50'
                }`}
              >
                {webrtcEnabled ? '[ON]' : '[OFF]'}
              </span>
            </button>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <span class="text-terminal-green">Connection Timeout</span>
              <span class="text-terminal-green font-mono">
                {connectionTimeout / 1000}s
              </span>
            </div>
            <p class="text-xs text-terminal-green/60 mt-1 mb-2">
              Maximum time to wait for relay connections
            </p>
            <input
              type="range"
              min="5000"
              max="30000"
              step="1000"
              value={connectionTimeout}
              onChange={(e) =>
                setConnectionTimeout(
                  parseInt((e.target as HTMLInputElement).value, 10)
                )
              }
              class="w-full h-2 appearance-none bg-terminal-green/20 cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:h-4
                     [&::-webkit-slider-thumb]:bg-terminal-green
                     [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div class="flex justify-between text-xs text-terminal-green/50 mt-1">
              <span>5s</span>
              <span>30s</span>
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div class="text-xs text-terminal-green/50 p-3 border border-terminal-green/10">
        <span class="font-bold">Legend:</span>
        <span class="ml-3">[P] Primary relay</span>
        <span class="ml-3">[W] Whitelisted</span>
        <span class="ml-3">[B] Blacklisted</span>
        <span class="ml-3">TX: Messages sent</span>
        <span class="ml-3">RX: Messages received</span>
      </div>
    </div>
  );
};

export default NetworkSettings;
