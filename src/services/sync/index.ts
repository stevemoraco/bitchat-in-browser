/**
 * Sync Services
 *
 * Provides offline-first synchronization capabilities:
 * - Network status detection
 * - Offline action queue with persistence
 * - Automatic sync on reconnection
 * - Integration with Nostr client and message store
 *
 * @module services/sync
 */

// Network Status
export {
  NetworkStatusService,
  getNetworkStatus,
  initNetworkStatus,
  resetNetworkStatus,
  type NetworkStatus,
  type ConnectionQuality,
  type NetworkStatusEvent,
  type NetworkStatusOptions,
  type NetworkStatusListener,
} from './network-status';

// Offline Queue
export {
  OfflineQueue,
  getOfflineQueue,
  initOfflineQueue,
  resetOfflineQueue,
  ActionType,
  ActionPriority,
  ActionStatus,
  // Action creators
  createSendMessageAction,
  createPublishEventAction,
  createSubscribeChannelAction,
  createUpdateProfileAction,
  createSyncMessagesAction,
  // Types
  type QueuedAction,
  type ActionPayload,
  type SendMessagePayload,
  type PublishEventPayload,
  type SubscribeChannelPayload,
  type UpdateProfilePayload,
  type SyncMessagesPayload,
  type ActionResult,
  type ActionHandler,
  type SyncProgressEvent,
  type SyncProgressListener,
  type OfflineQueueOptions,
} from './offline-queue';

// Integration
export {
  SyncIntegration,
  initSyncIntegration,
  getSyncIntegration,
  resetSyncIntegration,
  type SyncIntegrationConfig,
  type SyncIntegrationStatus,
} from './integration';
