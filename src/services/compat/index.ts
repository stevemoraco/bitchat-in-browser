/**
 * Protocol Compatibility Module
 *
 * This module provides test vectors, format documentation, and utilities
 * for ensuring cross-platform compatibility between BitChat web, iOS, and Android clients.
 *
 * @module compat
 */

export * from './test-vectors';
export * from './native-format';
export * from './geohash';

// Re-export nostr-events with explicit handling for getPublicKey conflict
export {
  // Event Kind Constants
  NostrEventKind,
  type NostrEventKindValue,

  // Serialization
  serializeEventForId,
  type SerializableEvent,

  // Event ID Calculation
  calculateEventId,
  verifyEventId,

  // Signing
  signEvent,
  createSignedEvent,

  // Verification
  verifyEventSignature,
  verifyEvent,
  validateEventStructure,
  type VerificationResult,

  // Parsing
  parseEvent,
  isNostrEvent,
  isUnsignedNostrEvent,

  // Factory Functions
  createMetadataEvent,
  createTextNoteEvent,
  createSealEvent,
  createDMRumorEvent,
  createGiftWrapEvent,
  createEphemeralEvent,

  // Key Utilities - renamed to avoid conflict with nip44-compat
  generatePrivateKey,
  getPublicKey as getNostrPublicKey,
  isValidPublicKey,
  isValidPrivateKey,

  // Timestamp Utilities
  getCurrentTimestamp,
  getRandomizedTimestamp,
} from './nostr-events';

export * from './nip44-compat';
export * from './bitchat-message';
