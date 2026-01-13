/**
 * Nostr Event Creation and Signing for BitChat
 *
 * Provides comprehensive event creation, signing, and verification utilities.
 * Uses nostr-tools which internally uses @noble/curves for Schnorr signatures.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/01.md
 */

import {
  getPublicKey,
  nip19,
  verifyEvent as nostrToolsVerifyEvent,
  finalizeEvent,
  getEventHash,
  type VerifiedEvent,
  type UnsignedEvent,
} from 'nostr-tools';
// Use @noble/hashes utils for proper Uint8Array handling that works with noble libraries
import {
  hexToBytes as nobleHexToBytes,
  bytesToHex as nobleBytesToHex,
} from '@noble/hashes/utils';
import type { NostrEvent, UnsignedNostrEvent } from './types';
import { EventKinds, validateEvent, type ValidationResult } from './kinds';
import {
  createGeohashTag,
  createPubkeyTag,
  createClientTag,
  createReplyTags,
  buildGeohashTags,
  BITCHAT_GEOHASH_PRECISION,
} from './tags';

// ============================================================================
// Hex/Bytes Conversion Utilities
// ============================================================================

/**
 * Convert hex string to Uint8Array
 * Uses @noble/hashes for proper Uint8Array instances that work with crypto libraries
 *
 * @param hex Hex string to convert
 * @returns Uint8Array of bytes
 * @throws Error if hex string is invalid
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  if (!/^[0-9a-f]*$/i.test(hex)) {
    throw new Error('Invalid hex string: contains non-hex characters');
  }
  return nobleHexToBytes(hex);
}

/**
 * Convert Uint8Array to hex string
 *
 * @param bytes Uint8Array to convert
 * @returns Lowercase hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return nobleBytesToHex(bytes);
}

// ============================================================================
// Key Management
// ============================================================================

/**
 * Generate a new random private key
 *
 * @returns 32-byte private key as Uint8Array
 */
export function generatePrivateKey(): Uint8Array {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  return privateKey;
}

/**
 * Generate a new key pair
 *
 * @returns Object with privateKey (Uint8Array) and publicKey (hex string)
 */
export function generateKeyPair(): { privateKey: Uint8Array; publicKey: string } {
  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Get public key from private key
 *
 * @param privateKey Private key as hex string, nsec, or Uint8Array
 * @returns 32-byte hex-encoded public key
 */
export function getPublicKeyFromPrivate(privateKey: string | Uint8Array): string {
  const privKeyBytes = normalizePrivateKey(privateKey);
  return getPublicKey(privKeyBytes);
}

/**
 * Normalize private key to Uint8Array
 *
 * @param privateKey Private key as hex string, nsec, or Uint8Array
 * @returns Private key as Uint8Array
 */
export function normalizePrivateKey(privateKey: string | Uint8Array): Uint8Array {
  if (privateKey instanceof Uint8Array) {
    return privateKey;
  }

  if (privateKey.startsWith('nsec')) {
    const decoded = nip19.decode(privateKey);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format');
    }
    return decoded.data;
  }

  return hexToBytes(privateKey);
}

/**
 * Convert public key to npub format (Bech32)
 *
 * @param pubkey 32-byte hex public key
 * @returns npub-encoded public key
 */
export function pubkeyToNpub(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}

/**
 * Convert npub to hex public key
 *
 * @param npub npub-encoded public key
 * @returns 32-byte hex public key
 */
export function npubToPubkey(npub: string): string {
  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub') {
    throw new Error('Invalid npub format');
  }
  return decoded.data;
}

/**
 * Convert private key to nsec format (Bech32)
 *
 * @param privateKey Private key as hex string or Uint8Array
 * @returns nsec-encoded private key
 */
export function privateKeyToNsec(privateKey: string | Uint8Array): string {
  if (typeof privateKey === 'string') {
    return nip19.nsecEncode(hexToBytes(privateKey));
  }
  return nip19.nsecEncode(privateKey);
}

/**
 * Convert nsec to hex private key
 *
 * @param nsec nsec-encoded private key
 * @returns 32-byte hex private key
 */
export function nsecToPrivateKey(nsec: string): string {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec format');
  }
  return bytesToHex(decoded.data);
}

/**
 * Validate public key format
 *
 * @param pubkey Public key to validate
 * @returns True if valid hex public key
 */
export function isValidPubkey(pubkey: string): boolean {
  return /^[0-9a-f]{64}$/i.test(pubkey);
}

/**
 * Validate private key format
 *
 * @param privateKey Private key to validate (hex format)
 * @returns True if valid hex private key
 */
export function isValidPrivateKey(privateKey: string): boolean {
  return /^[0-9a-f]{64}$/i.test(privateKey);
}

// ============================================================================
// Timestamp Management
// ============================================================================

/**
 * Get current Unix timestamp in seconds
 *
 * @returns Current Unix timestamp
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Create a randomized timestamp within a time window
 * Used for NIP-17 gift wrap to hide exact timing
 *
 * @param windowSeconds Time window in seconds (default: 2 days)
 * @returns Randomized timestamp within window of current time
 */
export function getRandomizedTimestamp(windowSeconds: number = 172800): number {
  const now = getCurrentTimestamp();
  const randomOffset = Math.floor(Math.random() * windowSeconds) - windowSeconds / 2;
  return now + randomOffset;
}

/**
 * Check if a timestamp is in the future
 *
 * @param timestamp Unix timestamp to check
 * @param toleranceSeconds Tolerance for clock skew (default: 60)
 * @returns True if timestamp is in the future beyond tolerance
 */
export function isFutureTimestamp(timestamp: number, toleranceSeconds: number = 60): boolean {
  return timestamp > getCurrentTimestamp() + toleranceSeconds;
}

/**
 * Check if a timestamp is too old
 *
 * @param timestamp Unix timestamp to check
 * @param maxAgeSeconds Maximum age in seconds (default: 1 year)
 * @returns True if timestamp is too old
 */
export function isExpiredTimestamp(
  timestamp: number,
  maxAgeSeconds: number = 31536000
): boolean {
  return timestamp < getCurrentTimestamp() - maxAgeSeconds;
}

// ============================================================================
// Event ID Calculation
// ============================================================================

/**
 * Serialize an event for hashing (NIP-01 format)
 * JSON array: [0, pubkey, created_at, kind, tags, content]
 *
 * @param event Event to serialize
 * @returns JSON string for hashing
 */
export function serializeEvent(event: UnsignedNostrEvent | NostrEvent): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

/**
 * Calculate event ID (SHA256 hash of serialized event)
 *
 * @param event Event to calculate ID for
 * @returns 32-byte hex-encoded event ID
 */
export function calculateEventId(event: UnsignedNostrEvent | NostrEvent): string {
  return getEventHash(event as UnsignedEvent);
}

// ============================================================================
// Event Creation
// ============================================================================

/**
 * Options for creating unsigned events
 */
export interface CreateEventOptions {
  /** Optional explicit timestamp (defaults to current time) */
  timestamp?: number;
  /** Whether to add client tag */
  addClientTag?: boolean;
}

/**
 * Create an unsigned Nostr event
 *
 * @param kind Event kind
 * @param content Event content
 * @param pubkey Author's public key
 * @param tags Event tags
 * @param options Optional configuration
 * @returns Unsigned event ready for signing
 */
export function createUnsignedEvent(
  kind: number,
  content: string,
  pubkey: string,
  tags: string[][] = [],
  options: CreateEventOptions = {}
): UnsignedNostrEvent {
  const finalTags = options.addClientTag
    ? [...tags, createClientTag()]
    : [...tags];

  return {
    pubkey,
    created_at: options.timestamp ?? getCurrentTimestamp(),
    kind,
    tags: finalTags,
    content,
  };
}

/**
 * Create a metadata event (kind 0)
 *
 * @param pubkey Author's public key
 * @param metadata Profile metadata object
 * @returns Unsigned metadata event
 */
export function createMetadataEvent(
  pubkey: string,
  metadata: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
    banner?: string;
    website?: string;
    display_name?: string;
    [key: string]: unknown;
  }
): UnsignedNostrEvent {
  return createUnsignedEvent(
    EventKinds.METADATA,
    JSON.stringify(metadata),
    pubkey
  );
}

/**
 * Create a text note event (kind 1)
 *
 * @param pubkey Author's public key
 * @param content Note content
 * @param tags Optional additional tags
 * @returns Unsigned text note event
 */
export function createTextNoteEvent(
  pubkey: string,
  content: string,
  tags: string[][] = []
): UnsignedNostrEvent {
  return createUnsignedEvent(
    EventKinds.TEXT_NOTE,
    content,
    pubkey,
    tags,
    { addClientTag: true }
  );
}

/**
 * Create a reply to another event (kind 1)
 *
 * @param pubkey Author's public key
 * @param content Reply content
 * @param replyToEvent Event being replied to
 * @param rootEvent Optional root event of thread
 * @returns Unsigned reply event
 */
export function createReplyEvent(
  pubkey: string,
  content: string,
  replyToEvent: NostrEvent,
  rootEvent?: NostrEvent
): UnsignedNostrEvent {
  const replyTags = createReplyTags(replyToEvent, rootEvent);

  return createUnsignedEvent(
    EventKinds.TEXT_NOTE,
    content,
    pubkey,
    replyTags,
    { addClientTag: true }
  );
}

/**
 * Create an encrypted DM event (kind 4, legacy NIP-04)
 * Note: NIP-04 is deprecated, use NIP-17 gift wrap for new implementations
 *
 * @param pubkey Author's public key
 * @param recipientPubkey Recipient's public key
 * @param encryptedContent NIP-04 encrypted content
 * @returns Unsigned encrypted DM event
 */
export function createEncryptedDMEvent(
  pubkey: string,
  recipientPubkey: string,
  encryptedContent: string
): UnsignedNostrEvent {
  return createUnsignedEvent(
    EventKinds.ENCRYPTED_DM,
    encryptedContent,
    pubkey,
    [createPubkeyTag(recipientPubkey)]
  );
}

/**
 * Create a chat message event (kind 14, NIP-17)
 *
 * @param pubkey Author's public key
 * @param recipients Array of recipient public keys
 * @param content Message content
 * @param replyTo Optional event being replied to
 * @returns Unsigned chat message event
 */
export function createChatMessageEvent(
  pubkey: string,
  recipients: string[],
  content: string,
  replyTo?: NostrEvent
): UnsignedNostrEvent {
  const tags: string[][] = recipients.map((pk) => createPubkeyTag(pk));

  if (replyTo) {
    tags.push(['e', replyTo.id, '', 'reply']);
  }

  return createUnsignedEvent(EventKinds.CHAT_MESSAGE, content, pubkey, tags);
}

/**
 * Create a seal event (kind 13, NIP-59)
 * Used internally for gift wrap encryption
 *
 * @param pubkey Author's public key
 * @param encryptedRumor Encrypted rumor event JSON
 * @returns Unsigned seal event
 */
export function createSealEvent(
  pubkey: string,
  encryptedRumor: string
): UnsignedNostrEvent {
  // Seal uses randomized timestamp
  return createUnsignedEvent(
    EventKinds.SEAL,
    encryptedRumor,
    pubkey,
    [],
    { timestamp: getRandomizedTimestamp() }
  );
}

/**
 * Create a gift wrap event (kind 1059, NIP-17/59)
 *
 * @param wrapperPubkey Ephemeral wrapper public key
 * @param recipientPubkey Recipient's public key
 * @param encryptedSeal Encrypted seal event JSON
 * @returns Unsigned gift wrap event
 */
export function createGiftWrapEvent(
  wrapperPubkey: string,
  recipientPubkey: string,
  encryptedSeal: string
): UnsignedNostrEvent {
  // Gift wrap uses randomized timestamp
  return createUnsignedEvent(
    EventKinds.GIFT_WRAP,
    encryptedSeal,
    wrapperPubkey,
    [createPubkeyTag(recipientPubkey)],
    { timestamp: getRandomizedTimestamp() }
  );
}

/**
 * Create a location channel message event (kind 20000)
 *
 * @param pubkey Author's public key
 * @param content Message content
 * @param geohash Location geohash
 * @param replyTo Optional event being replied to
 * @param mentions Optional pubkeys to mention
 * @returns Unsigned location channel message event
 */
export function createLocationChannelEvent(
  pubkey: string,
  content: string,
  geohash: string,
  replyTo?: NostrEvent,
  mentions?: string[]
): UnsignedNostrEvent {
  const tags: string[][] = [];

  // Add geohash tags (primary and ancestors for discoverability)
  tags.push(...buildGeohashTags(geohash, true, BITCHAT_GEOHASH_PRECISION - 2));

  // Add reply threading
  if (replyTo) {
    tags.push(['e', replyTo.id, '', 'reply']);
    tags.push(createPubkeyTag(replyTo.pubkey));
  }

  // Add mentions
  if (mentions) {
    for (const pk of mentions) {
      if (!tags.some((t) => t[0] === 'p' && t[1] === pk)) {
        tags.push(createPubkeyTag(pk));
      }
    }
  }

  // Add client tag
  tags.push(createClientTag());

  return createUnsignedEvent(
    EventKinds.LOCATION_CHANNEL_MESSAGE,
    content,
    pubkey,
    tags
  );
}

/**
 * Create an event deletion request (kind 5)
 *
 * @param pubkey Author's public key
 * @param eventIds IDs of events to delete
 * @param reason Optional reason for deletion
 * @returns Unsigned event deletion request
 */
export function createEventDeletionEvent(
  pubkey: string,
  eventIds: string[],
  reason?: string
): UnsignedNostrEvent {
  const tags = eventIds.map((id) => ['e', id]);

  return createUnsignedEvent(
    EventKinds.EVENT_DELETION,
    reason || '',
    pubkey,
    tags
  );
}

/**
 * Create a reaction event (kind 7)
 *
 * @param pubkey Author's public key
 * @param targetEvent Event to react to
 * @param reaction Reaction content (e.g., '+', '-', emoji)
 * @returns Unsigned reaction event
 */
export function createReactionEvent(
  pubkey: string,
  targetEvent: NostrEvent,
  reaction: string = '+'
): UnsignedNostrEvent {
  const tags = [
    ['e', targetEvent.id],
    createPubkeyTag(targetEvent.pubkey),
  ];

  return createUnsignedEvent(EventKinds.REACTION, reaction, pubkey, tags);
}

// ============================================================================
// Event Signing
// ============================================================================

/**
 * Sign an unsigned event
 *
 * @param event Unsigned event to sign
 * @param privateKey Private key (hex, nsec, or Uint8Array)
 * @returns Signed event with id and sig
 * @throws Error if private key doesn't match event pubkey
 */
export function signEvent(
  event: UnsignedNostrEvent,
  privateKey: string | Uint8Array
): NostrEvent {
  const privKeyBytes = normalizePrivateKey(privateKey);

  // Verify the pubkey matches
  const derivedPubkey = getPublicKey(privKeyBytes);
  if (derivedPubkey !== event.pubkey) {
    throw new Error(
      'Private key does not match event pubkey. ' +
        `Expected ${event.pubkey}, derived ${derivedPubkey}`
    );
  }

  // Use nostr-tools finalizeEvent which handles ID calculation and signing
  const signedEvent = finalizeEvent(
    {
      kind: event.kind,
      created_at: event.created_at,
      tags: event.tags,
      content: event.content,
    },
    privKeyBytes
  ) as VerifiedEvent;

  return signedEvent as NostrEvent;
}

/**
 * Create and sign an event in one step
 *
 * @param kind Event kind
 * @param content Event content
 * @param privateKey Private key (hex, nsec, or Uint8Array)
 * @param tags Event tags
 * @param options Optional configuration
 * @returns Signed event
 */
export function createAndSignEvent(
  kind: number,
  content: string,
  privateKey: string | Uint8Array,
  tags: string[][] = [],
  options: CreateEventOptions = {}
): NostrEvent {
  const pubkey = getPublicKeyFromPrivate(privateKey);
  const unsignedEvent = createUnsignedEvent(kind, content, pubkey, tags, options);
  return signEvent(unsignedEvent, privateKey);
}

// ============================================================================
// Event Verification
// ============================================================================

/**
 * Verify an event's signature and structure
 *
 * @param event Event to verify
 * @returns True if event signature is valid
 */
export function verifyEventSignature(event: NostrEvent): boolean {
  try {
    // First verify the event ID is correct
    const expectedId = calculateEventId(event);
    if (expectedId !== event.id) {
      return false;
    }

    // Use nostr-tools verification (uses schnorr internally)
    return nostrToolsVerifyEvent(event as VerifiedEvent);
  } catch {
    return false;
  }
}

/**
 * Comprehensive event verification
 *
 * @param event Event to verify
 * @returns Validation result with error message if invalid
 */
export function verifyEvent(event: NostrEvent): ValidationResult {
  // Validate structure
  const structureResult = validateEvent(event);
  if (!structureResult.valid) {
    return structureResult;
  }

  // Verify ID
  const expectedId = calculateEventId(event);
  if (expectedId !== event.id) {
    return {
      valid: false,
      error: `Invalid event ID. Expected ${expectedId}, got ${event.id}`,
    };
  }

  // Verify signature
  try {
    if (!nostrToolsVerifyEvent(event as VerifiedEvent)) {
      return { valid: false, error: 'Invalid signature' };
    }
  } catch (error) {
    return {
      valid: false,
      error: `Signature verification failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }

  // Check timestamp validity
  if (isFutureTimestamp(event.created_at)) {
    return { valid: false, error: 'Event timestamp is in the future' };
  }

  return { valid: true };
}

// ============================================================================
// Event Utilities
// ============================================================================

/**
 * Check if an event is ephemeral (kind 20000-29999)
 *
 * @param event Event to check
 * @returns True if ephemeral
 */
export function isEphemeralEvent(event: NostrEvent | UnsignedNostrEvent): boolean {
  return event.kind >= 20000 && event.kind < 30000;
}

/**
 * Check if an event is replaceable
 *
 * @param event Event to check
 * @returns True if replaceable
 */
export function isReplaceableEvent(event: NostrEvent | UnsignedNostrEvent): boolean {
  // Standard replaceable kinds
  if (event.kind === 0 || event.kind === 3) {
    return true;
  }
  // Range-based replaceable kinds
  return event.kind >= 10000 && event.kind < 20000;
}

/**
 * Check if an event is parameterized replaceable
 *
 * @param event Event to check
 * @returns True if parameterized replaceable
 */
export function isParameterizedReplaceableEvent(
  event: NostrEvent | UnsignedNostrEvent
): boolean {
  return event.kind >= 30000 && event.kind < 40000;
}

/**
 * Get the unique identifier for a replaceable event
 * For regular replaceable: kind:pubkey
 * For parameterized replaceable: kind:pubkey:d-tag
 *
 * @param event Event to get identifier for
 * @returns Unique identifier string
 */
export function getReplaceableEventId(event: NostrEvent | UnsignedNostrEvent): string {
  if (isParameterizedReplaceableEvent(event)) {
    const dTag = event.tags.find((t) => t[0] === 'd')?.[1] || '';
    return `${event.kind}:${event.pubkey}:${dTag}`;
  }

  if (isReplaceableEvent(event)) {
    return `${event.kind}:${event.pubkey}`;
  }

  // For non-replaceable events, use the event ID
  if ('id' in event) {
    return (event as NostrEvent).id;
  }

  // For unsigned events, calculate the would-be ID
  return calculateEventId(event);
}

/**
 * Clone an event with optional modifications
 *
 * @param event Event to clone
 * @param modifications Optional field modifications
 * @returns New event object
 */
export function cloneEvent<T extends NostrEvent | UnsignedNostrEvent>(
  event: T,
  modifications?: Partial<UnsignedNostrEvent>
): T {
  return {
    ...event,
    ...modifications,
    tags: modifications?.tags ? [...modifications.tags] : [...event.tags],
  } as T;
}

/**
 * Convert a signed event to unsigned (remove id and sig)
 *
 * @param event Signed event
 * @returns Unsigned event
 */
export function toUnsignedEvent(event: NostrEvent): UnsignedNostrEvent {
  return {
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: [...event.tags],
    content: event.content,
  };
}
