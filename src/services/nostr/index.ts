/**
 * Nostr Client Module
 *
 * This module provides the complete Nostr protocol implementation for BitChat In Browser.
 * It handles relay connections, event publishing, subscriptions, event creation,
 * signing, validation, and offline queuing.
 *
 * @example
 * ```typescript
 * import {
 *   nostrClient,
 *   createLocationChannelEvent,
 *   signEvent,
 *   EventKinds,
 * } from '@/services/nostr';
 *
 * // Connect to relays
 * await nostrClient.connect();
 *
 * // Create and sign a location channel message
 * const unsignedEvent = createLocationChannelEvent(
 *   myPubkey,
 *   'Hello from my location!',
 *   'u4pruy' // geohash
 * );
 * const signedEvent = signEvent(unsignedEvent, myPrivateKey);
 *
 * // Publish the event
 * await nostrClient.publish(signedEvent);
 *
 * // Subscribe to location channel
 * const sub = nostrClient.subscribe(
 *   [{ kinds: [EventKinds.LOCATION_CHANNEL_MESSAGE], '#g': ['u4pruy'] }],
 *   (event) => console.log('Received:', event)
 * );
 *
 * // Clean up
 * sub.close();
 * nostrClient.disconnect();
 * ```
 */

// ============================================================================
// Types
// ============================================================================

export type {
  NostrEvent,
  UnsignedNostrEvent,
  NostrFilter,
  RelayStatus,
  RelayConnectionState,
  Subscription,
  SubscriptionOptions,
  PublishResult,
  RelayPublishResult,
  EventHandler,
  QueuedEvent,
  RelayMessage,
  ClientMessage,
} from './types';

export { NostrEventKind } from './types';

// ============================================================================
// Event Kinds (kinds.ts)
// ============================================================================

export {
  EventKinds,
  EventKindRanges,
  EventKindInfo,
  // Kind classification
  isEphemeralKind,
  isReplaceableKind,
  isParameterizedReplaceableKind,
  isLocationChannelKind,
  isDirectMessageKind,
  isGiftWrapKind,
  // Validation
  validateEventStructure,
  validateMetadataEvent,
  validateTextNoteEvent,
  validateEncryptedDMEvent,
  validateChatMessageEvent,
  validateGiftWrapEvent,
  validateLocationChannelEvent,
  validateEvent,
  // Info helpers
  getEventKindName,
  getEventKindDescription,
} from './kinds';

export type { EventKind, ValidationResult } from './kinds';

// ============================================================================
// Tags (tags.ts)
// ============================================================================

export {
  TagTypes,
  GeohashPrecision,
  BITCHAT_GEOHASH_PRECISION,
  // Tag parsing
  getTagValues,
  getTagValue,
  getTags,
  hasTag,
  parseEventReferences,
  parsePubkeyReferences,
  getIdentifier,
  // Geohash utilities
  getGeohashes,
  getPrimaryGeohash,
  isValidGeohash,
  getParentGeohash,
  getGeohashAncestors,
  buildGeohashTags,
  // Tag building
  createEventTag,
  createPubkeyTag,
  createGeohashTag,
  createHashtagTag,
  createIdentifierTag,
  createSubjectTag,
  createExpirationTag,
  createClientTag,
  // Reply threading
  createReplyTags,
  createMentionTag,
  // Channel utilities
  createLocationChannelTags,
  createChannelMessageTags,
  // Tag manipulation
  addTag,
  removeTagsByType,
  replaceTagsByType,
  deduplicateTags,
  extractHashtags,
  extractMentions,
} from './tags';

export type { ReplyMarker } from './tags';

// ============================================================================
// Events (events.ts)
// ============================================================================

export {
  // Hex/bytes conversion
  hexToBytes,
  bytesToHex,
  // Key management
  generatePrivateKey,
  generateKeyPair,
  getPublicKeyFromPrivate,
  normalizePrivateKey,
  pubkeyToNpub,
  npubToPubkey,
  privateKeyToNsec,
  nsecToPrivateKey,
  isValidPubkey,
  isValidPrivateKey,
  // Timestamp utilities
  getCurrentTimestamp,
  getRandomizedTimestamp,
  isFutureTimestamp,
  isExpiredTimestamp,
  // Event ID calculation
  serializeEvent,
  calculateEventId,
  // Event creation
  createUnsignedEvent,
  createMetadataEvent,
  createTextNoteEvent,
  createReplyEvent,
  createEncryptedDMEvent,
  createChatMessageEvent,
  createSealEvent,
  createGiftWrapEvent,
  createLocationChannelEvent,
  createEventDeletionEvent,
  createReactionEvent,
  // Signing
  signEvent,
  createAndSignEvent,
  // Verification
  verifyEventSignature,
  verifyEvent,
  // Utilities
  isEphemeralEvent,
  isReplaceableEvent,
  isParameterizedReplaceableEvent,
  getReplaceableEventId,
  cloneEvent,
  toUnsignedEvent,
} from './events';

export type { CreateEventOptions } from './events';

// ============================================================================
// Relay Pool
// ============================================================================

export {
  RelayPool,
  DEFAULT_RELAYS,
  getDefaultPool,
  resetDefaultPool,
} from './relays';

// ============================================================================
// Relay Manager (Advanced)
// ============================================================================

export {
  RelayManager,
  getDefaultRelayManager,
  resetDefaultRelayManager,
} from './relay-manager';

export type {
  BackoffConfig,
  RelayStats,
  ExtendedRelayState,
  RelayManagerConfig,
  MessageRoutingResult,
  RelayManagerEvent,
  RelayManagerEventHandler,
} from './relay-manager';

// ============================================================================
// Relay List (290+ relays with geographic data)
// ============================================================================

export {
  PRIMARY_RELAYS,
  PRIMARY_RELAY_URLS,
  ALL_RELAYS,
  DEFAULT_RELAY_URLS,
  getRelaysByRegion,
  calculateDistance,
  getRelaysByProximity,
  getBalancedRelaySelection,
  getRegionName,
} from './relay-list';

export type {
  RelayInfo,
  RelayRegion,
} from './relay-list';

// ============================================================================
// Client
// ============================================================================

export {
  NostrClient,
  getDefaultClient,
  resetDefaultClient,
} from './client';

export type { NostrClientOptions, ConnectionStatus } from './client';

// ============================================================================
// Queue
// ============================================================================

export { OutboxQueue } from './queue';
export type { OutboxQueueOptions } from './queue';

// ============================================================================
// NIP-17 Private Direct Messages
// ============================================================================

export {
  // Core wrapping functions
  createRumor,
  createSeal,
  createGiftWrap,
  wrapEvent,
  wrapManyEvents,
  // Unwrapping functions
  unwrapGiftWrap,
  openSeal,
  unwrapEvent,
  unwrapManyEvents,
  // Conversation management
  getConversationId,
  getParticipants,
  getConversationTitle,
  getReplyToId,
  groupByConversation,
  buildConversations,
  // Deduplication
  deduplicateMessages,
  // Validation helpers
  isGiftWrap,
  isAddressedTo,
  // Subscription helpers
  createGiftWrapFilter,
} from './nip17';

export type {
  Rumor,
  Recipient,
  ReplyTo,
  DecryptedMessage,
  Conversation,
} from './nip17';

// ============================================================================
// Legacy Utils Exports (backwards compatibility with utils.ts)
// ============================================================================

export {
  createEvent,
  signEventWithNostrTools,
  getEventId,
  getDTag,
  createReplyTag,
} from './utils';

// ============================================================================
// Default Client Instance
// ============================================================================

/**
 * Default NostrClient singleton instance
 *
 * Use this for most applications. For testing or special cases,
 * create a new NostrClient instance directly.
 */
import { getDefaultClient } from './client';
export const nostrClient = getDefaultClient();
