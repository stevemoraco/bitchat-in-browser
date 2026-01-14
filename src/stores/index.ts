/**
 * Zustand Stores - Central export for all state management
 *
 * BitChat In Browser uses Zustand for state management with:
 * - TypeScript types for all state
 * - localStorage persistence for appropriate stores
 * - DevTools integration in development
 * - Selective persistence (never persist sensitive data)
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Message types
  Message,
  MessageStatus,
  MessageType,

  // Channel types
  Channel,
  ChannelType,

  // Peer types
  Peer,
  PeerStatus,
  PeerSource,

  // Settings types
  Settings,
  Theme,
  NotificationLevel,

  // Identity types
  Identity,

  // App types
  AppState,
  ViewType,

  // Action types
  AppActions,
  MessagesActions,
  ChannelsActions,
  PeersActions,
  SettingsActions,
  IdentityActions,
} from './types';

export { DEFAULT_SETTINGS } from './types';

// ============================================================================
// App Store
// ============================================================================

export {
  useAppStore,
  selectIsOnline,
  selectIsInitialized,
  selectCurrentView,
  selectError,
  selectIsBackground,
  selectVersion,
  useIsAppReady,
  useConnectionStatus,
} from './app-store';

// ============================================================================
// Messages Store
// ============================================================================

export {
  useMessagesStore,
  getMessagesForChannel,
  useChannelMessages,
  getUnreadCount,
  useUnreadCount,
  getLastMessage,
  useLastMessage,
  getChannelIdsWithMessages,
  getTotalUnreadCount,
  useTotalUnreadCount,
  searchMessages,
  getMessagesWithMention,
} from './messages-store';

// ============================================================================
// Channels Store
// ============================================================================

export {
  useChannelsStore,
  selectChannels,
  selectActiveChannelId,
  getActiveChannel,
  useActiveChannel,
  getChannelById,
  useChannel,
  getChannelsByType,
  useChannelsByType,
  getSortedChannels,
  useSortedChannels,
  getTotalUnreadCount as getChannelsTotalUnreadCount,
  useTotalUnreadCount as useChannelsTotalUnreadCount,
  getUnreadChannels,
  useUnreadChannels,
  getDMChannel,
  useDMChannel,
  channelExists,
  createChannel,
} from './channels-store';

// ============================================================================
// Peers Store
// ============================================================================

export {
  usePeersStore,
  getAllPeers,
  usePeers,
  getPeer,
  usePeer,
  getOnlinePeers,
  useOnlinePeers,
  getTrustedPeers,
  useTrustedPeers,
  getBlockedPeers,
  useBlockedPeers,
  getPeersBySource,
  usePeersBySource,
  peerExists,
  isPeerBlocked,
  getPeerCount,
  usePeerCount,
  getOnlinePeerCount,
  useOnlinePeerCount,
  searchPeers,
  createPeer,
  setAllPeersOffline,
} from './peers-store';

// ============================================================================
// Settings Store
// ============================================================================

export {
  useSettingsStore,
  DEFAULT_SETTINGS as SETTINGS_DEFAULTS,
  getEffectiveTheme,
  selectSettings,
  selectNickname,
  selectTheme,
  selectNotifications,
  useSettings,
  useNickname,
  useTheme,
  useEffectiveTheme,
  useNotificationLevel,
  useCanNotify,
  useSoundEnabled,
  useFontSizeClass,
  useCompactMode,
  useDevMode,
} from './settings-store';

// ============================================================================
// Identity Store
// ============================================================================

export {
  useIdentityStore,
  selectIdentity,
  selectPublicKey,
  selectFingerprint,
  selectIsKeyLoaded,
  useIdentity,
  usePublicKey,
  useFingerprint,
  useIsKeyLoaded,
  useHasIdentity,
  useNpub,
  useNip05,
  useDisplayId,
  getIdentity,
  getPublicKey,
  getFingerprint,
  hasIdentity,
  isKeyLoaded,
  createIdentityFromPublicKey,
} from './identity-store';

// ============================================================================
// Mesh Store
// ============================================================================

export {
  useMeshStore,
  useMeshStatus,
  useMeshPeers,
  useMeshPeerCount,
  useMeshConfig,
  useMeshTopology,
  useMeshActions,
  getMeshStatus,
  getMeshPeers,
  getMeshPeerCount,
  getMeshPeer,
  isMeshConnected,
} from './mesh-store';

export type { TopologyMode, MeshTopologyStats, MeshState } from './mesh-store';

// ============================================================================
// Navigation Store
// ============================================================================

export {
  useNavigationStore,
  useCurrentSheet,
  useIsSheetOpen,
  useSheetStack,
  useNavigationActions,
  getNavigationState,
  isAnySheetOpen,
  getCurrentSheetType,
} from './navigation-store';

export type {
  SheetType,
  SheetHeight,
  SheetState,
  NavigationState,
} from './navigation-store';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Clear all persisted state (for emergency wipe)
 */
export function clearAllStores(): void {
  // Clear in-memory state
  const { useAppStore } = require('./app-store');
  const { useMessagesStore } = require('./messages-store');
  const { useChannelsStore } = require('./channels-store');
  const { usePeersStore } = require('./peers-store');
  const { useSettingsStore } = require('./settings-store');
  const { useIdentityStore } = require('./identity-store');
  const { useMeshStore } = require('./mesh-store');

  useAppStore.getState().reset();
  useMessagesStore.getState().clearAll();
  useChannelsStore.setState({ channels: [], activeChannelId: null });
  usePeersStore.getState().clearAll();
  useSettingsStore.getState().resetSettings();
  useIdentityStore.getState().clearIdentity();
  useMeshStore.getState().reset();

  // Clear localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('bitchat-messages');
    localStorage.removeItem('bitchat-channels');
    localStorage.removeItem('bitchat-peers');
    localStorage.removeItem('bitchat-settings');
    localStorage.removeItem('bitchat-identity');
    localStorage.removeItem('bitchat-mesh-store');
  }
}

/**
 * Check if any stores have data (for detecting existing user)
 */
export function hasExistingData(): boolean {
  const { hasIdentity } = require('./identity-store');
  return hasIdentity();
}

/**
 * Get initialization status of all stores
 */
export function getStoreStatus(): {
  hasIdentity: boolean;
  hasSettings: boolean;
  channelCount: number;
  peerCount: number;
  messageCount: number;
} {
  const { hasIdentity } = require('./identity-store');
  const { useSettingsStore } = require('./settings-store');
  const { useChannelsStore } = require('./channels-store');
  const { usePeersStore } = require('./peers-store');
  const { useMessagesStore } = require('./messages-store');

  const settings = useSettingsStore.getState().settings;
  const channels = useChannelsStore.getState().channels;
  const peers = usePeersStore.getState().peers;
  const messages = useMessagesStore.getState().messages;

  return {
    hasIdentity: hasIdentity(),
    hasSettings: settings.nickname !== '',
    channelCount: channels.length,
    peerCount: Object.keys(peers).length,
    messageCount: Object.values(messages as Record<string, Array<unknown>>).reduce(
      (total: number, msgs: Array<unknown>) => total + msgs.length,
      0
    ),
  };
}
