/**
 * BitChat In Browser PWA - Type Definitions
 *
 * Central export point for all TypeScript types used in the BitChat PWA.
 * Types are designed to be compatible with native BitChat iOS/Android apps.
 *
 * @module types
 */

// ============================================================================
// Message Types
// ============================================================================

export {
  MessageStatus,
  MessageType,
  type DeliveryStatusInfo,
  type Message,
  type EncryptedMessage,
  type MessageMetadata,
  type CreateMessageInput,
  type ReadReceipt,
  type MessageBatch,
} from './message';

// ============================================================================
// Channel Types
// ============================================================================

export {
  ChannelType,
  GeohashPrecision,
  GEOHASH_PRECISION_NAMES,
  type Channel,
  type LocationChannel,
  type DirectChannel,
  type GroupChannel,
  type MeshChannel,
  type AnyChannel,
  type ChannelId,
  type CreateLocationChannelInput,
  type CreateDirectChannelInput,
  type CreateChannelInput,
  type ChannelListItem,
  type GeohashChannelOption,
  createGeohashChannelOption,
  channelIdToString,
  parseChannelId,
} from './channel';

// ============================================================================
// Peer Types
// ============================================================================

export {
  TrustLevel,
  PeerStatus,
  PeerSource,
  PeerConnectionState,
  type FavoriteRelationship,
  type Peer,
  type CryptographicIdentity,
  type SocialIdentity,
  type PeerConnectionEvent,
  type PeerListItem,
  type PeerInput,
  type PeerUpdate,
  type IdentityCache,
  getPeerDisplayName,
  isPeerActive,
  getPeerStatusIcon,
} from './peer';

// ============================================================================
// Identity Types
// ============================================================================

export {
  KeyType,
  type NostrIdentity,
  type KeyPair,
  type HexKeyPair,
  type Identity,
  type StoredIdentity,
  type CreateIdentityOptions,
  type IdentityImportResult,
  type IdentityExport,
  type Fingerprint,
  type IdentitySession,
  type KeyMetadata,
  type VerificationChallenge,
  type VerificationResponse,
  formatFingerprint,
  shortFingerprint,
  isValidNostrPublicKey,
  isValidNostrPrivateKey,
} from './identity';

// ============================================================================
// Nostr Protocol Types
// ============================================================================

export {
  EventKind,
  isEphemeralKind,
  isReplaceableKind,
  isParameterizedReplaceableKind,
  type NostrEvent,
  type UnsignedNostrEvent,
  type NostrFilter,
  type RelayConnectionState,
  type RelayStatus,
  type RelayMessage,
  type ClientMessage,
  type SubscriptionOptions,
  type Subscription,
  type PublishResult,
  type RelayPublishResult,
  type EventHandler,
  type QueuedEvent,
  type RelayConfig,
  type Nip05Result,
  type NostrMetadata,
  type NostrContact,
  type NostrTag,
  getTagValue,
  getTagValues,
  createGeohashFilter,
  createDMFilter,
} from './nostr';

// ============================================================================
// Crypto Types
// ============================================================================

export {
  HandshakeState,
  LazyHandshakeState,
  EncryptionAlgorithm,
  NoisePattern,
  NoisePayloadType,
  CryptoConstants,
  type HandshakeStateInfo,
  type SessionKeys,
  type EncryptedPayload,
  type NoiseHandshakeMessage,
  type NoiseSessionState,
  type NoisePayload,
  type KdfParams,
  type SharedSecret,
  type SignatureResult,
  type EncryptionSession,
  encodeNoisePayload,
  decodeNoisePayload,
  areSessionKeysValid,
} from './crypto';

// ============================================================================
// Re-export existing service types for convenience
// ============================================================================

// These are re-exported from their original locations for backward compatibility
// with existing code that imports from services directly.

// Note: The following types are also available from their respective service modules:
// - src/services/crypto/types.ts - Low-level crypto types
// - src/services/nostr/types.ts - Nostr client types
// - src/services/storage/types.ts - Storage adapter types
// - src/stores/types.ts - Store state types
