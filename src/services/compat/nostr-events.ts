/**
 * Nostr Event Serialization - iOS/Android Compatible
 *
 * This module provides deterministic Nostr event serialization that exactly
 * matches the iOS and Android BitChat implementations. Event ID calculation
 * follows NIP-01 specification precisely.
 *
 * Event ID Calculation:
 *   id = SHA256(JSON.stringify([0, pubkey, created_at, kind, tags, content]))
 *
 * JSON Serialization Rules:
 *   - NO spaces after colons or commas
 *   - NO HTML escaping (< stays <, NOT &lt;)
 *   - Array order preserved exactly
 *   - Numbers as integers (no decimal points)
 *   - Unicode characters preserved (no \uXXXX escaping unless required)
 *
 * @module compat/nostr-events
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { schnorr } from '@noble/curves/secp256k1';
import type { NostrEvent, UnsignedNostrEvent } from '../nostr/types';

// ============================================================================
// Event Kind Constants (matching iOS/Android)
// ============================================================================

/**
 * Nostr event kinds supported by BitChat
 * These values MUST match iOS and Android implementations exactly
 */
export const NostrEventKind = {
  /** Kind 0: User metadata (profile) - NIP-01 */
  METADATA: 0,

  /** Kind 1: Text note (persistent channel messages) - NIP-01 */
  TEXT_NOTE: 1,

  /** Kind 13: Seal - NIP-17 encrypted rumor wrapper */
  SEAL: 13,

  /** Kind 14: DM rumor - NIP-17 unsigned inner event */
  DM_RUMOR: 14,

  /** Kind 1059: Gift wrap - NIP-59 outer envelope */
  GIFT_WRAP: 1059,

  /** Kind 20000: Ephemeral event (geohash channels) */
  EPHEMERAL_EVENT: 20000,

  /** Ephemeral range end */
  EPHEMERAL_MAX: 29999,
} as const;

export type NostrEventKindValue = (typeof NostrEventKind)[keyof typeof NostrEventKind];

// ============================================================================
// Event Serialization
// ============================================================================

/**
 * Serialize a Nostr event for ID calculation (NIP-01 format)
 *
 * Creates the canonical JSON array format:
 * [0, pubkey, created_at, kind, tags, content]
 *
 * CRITICAL: This serialization must be byte-for-byte identical to iOS/Android
 *
 * @param event - Event to serialize (signed or unsigned)
 * @returns JSON string with no spaces and no HTML escaping
 */
export function serializeEventForId(
  event: NostrEvent | UnsignedNostrEvent | SerializableEvent
): string {
  // Build the canonical array: [0, pubkey, created_at, kind, tags, content]
  const eventArray = [
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ];

  // JSON.stringify with no replacer and no space produces compact JSON
  // This matches the iOS/Android behavior
  return JSON.stringify(eventArray);
}

/**
 * Minimal event structure for serialization
 */
export interface SerializableEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

// ============================================================================
// Event ID Calculation
// ============================================================================

/**
 * Calculate the event ID (SHA256 hash of serialized event)
 *
 * This implements NIP-01 event ID calculation:
 *   id = lowercase_hex(SHA256(serialize(event)))
 *
 * @param event - Event to calculate ID for
 * @returns 64-character lowercase hex string (32 bytes)
 */
export function calculateEventId(event: SerializableEvent): string {
  const serialized = serializeEventForId(event);
  const hash = sha256(utf8ToBytes(serialized));
  return bytesToHex(hash);
}

/**
 * Verify that an event's ID is correct
 *
 * @param event - Event with id field to verify
 * @returns true if the id matches the calculated hash
 */
export function verifyEventId(event: NostrEvent): boolean {
  const expectedId = calculateEventId(event);
  return event.id === expectedId;
}

// ============================================================================
// Event Signing
// ============================================================================

/**
 * Sign an unsigned event with a private key
 *
 * Uses BIP-340 Schnorr signatures over secp256k1
 *
 * @param event - Unsigned event to sign
 * @param privateKey - 32-byte private key as hex string or Uint8Array
 * @returns Signed event with id and sig fields
 */
export function signEvent(
  event: UnsignedNostrEvent,
  privateKey: string | Uint8Array
): NostrEvent {
  const privKeyBytes = typeof privateKey === 'string'
    ? hexToBytes(privateKey)
    : privateKey;

  // Verify private key length
  if (privKeyBytes.length !== 32) {
    throw new Error('Private key must be 32 bytes');
  }

  // Derive public key and verify it matches event pubkey
  const derivedPubkey = bytesToHex(schnorr.getPublicKey(privKeyBytes));
  if (derivedPubkey !== event.pubkey.toLowerCase()) {
    throw new Error(
      `Private key does not match event pubkey. Expected ${event.pubkey}, derived ${derivedPubkey}`
    );
  }

  // Calculate event ID
  const id = calculateEventId(event);

  // Sign the event ID (not the serialized event)
  const signature = schnorr.sign(hexToBytes(id), privKeyBytes);
  const sig = bytesToHex(signature);

  return {
    ...event,
    id,
    sig,
  };
}

/**
 * Create and sign an event in one step
 *
 * @param kind - Event kind
 * @param content - Event content
 * @param privateKey - 32-byte private key
 * @param tags - Event tags (default: empty array)
 * @param timestamp - Unix timestamp (default: current time)
 * @returns Signed event
 */
export function createSignedEvent(
  kind: number,
  content: string,
  privateKey: string | Uint8Array,
  tags: string[][] = [],
  timestamp?: number
): NostrEvent {
  const privKeyBytes = typeof privateKey === 'string'
    ? hexToBytes(privateKey)
    : privateKey;

  const pubkey = bytesToHex(schnorr.getPublicKey(privKeyBytes));
  const created_at = timestamp ?? Math.floor(Date.now() / 1000);

  const unsignedEvent: UnsignedNostrEvent = {
    pubkey,
    created_at,
    kind,
    tags,
    content,
  };

  return signEvent(unsignedEvent, privKeyBytes);
}

// ============================================================================
// Signature Verification
// ============================================================================

/**
 * Verify a Schnorr signature on an event
 *
 * @param event - Signed event to verify
 * @returns true if signature is valid
 */
export function verifyEventSignature(event: NostrEvent): boolean {
  try {
    // First verify the event ID is correct
    if (!verifyEventId(event)) {
      return false;
    }

    // Verify signature
    const sigBytes = hexToBytes(event.sig);
    const pubkeyBytes = hexToBytes(event.pubkey);
    const messageBytes = hexToBytes(event.id);

    return schnorr.verify(sigBytes, messageBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

/**
 * Comprehensive event verification
 *
 * Checks:
 * 1. Event structure is valid
 * 2. Event ID is correctly calculated
 * 3. Signature is valid
 *
 * @param event - Event to verify
 * @returns Verification result with error message if invalid
 */
export function verifyEvent(event: NostrEvent): VerificationResult {
  // Check basic structure
  const structureResult = validateEventStructure(event);
  if (!structureResult.valid) {
    return structureResult;
  }

  // Verify ID
  const expectedId = calculateEventId(event);
  if (event.id !== expectedId) {
    return {
      valid: false,
      error: `Invalid event ID. Expected ${expectedId}, got ${event.id}`,
    };
  }

  // Verify signature
  try {
    const sigBytes = hexToBytes(event.sig);
    const pubkeyBytes = hexToBytes(event.pubkey);
    const messageBytes = hexToBytes(event.id);

    if (!schnorr.verify(sigBytes, messageBytes, pubkeyBytes)) {
      return { valid: false, error: 'Invalid signature' };
    }
  } catch (error) {
    return {
      valid: false,
      error: `Signature verification error: ${error instanceof Error ? error.message : 'unknown'}`,
    };
  }

  return { valid: true };
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
}

// ============================================================================
// Event Structure Validation
// ============================================================================

/**
 * Validate the structure of a Nostr event
 *
 * Checks:
 * - pubkey: 64-character lowercase hex
 * - created_at: positive integer
 * - kind: non-negative integer
 * - tags: array of string arrays
 * - content: string
 * - id: 64-character lowercase hex (if present)
 * - sig: 128-character lowercase hex (if present)
 *
 * @param event - Event to validate
 * @returns Validation result
 */
export function validateEventStructure(
  event: NostrEvent | UnsignedNostrEvent
): VerificationResult {
  // Validate pubkey
  if (typeof event.pubkey !== 'string') {
    return { valid: false, error: 'pubkey must be a string' };
  }
  if (event.pubkey.length !== 64) {
    return { valid: false, error: 'pubkey must be 64 characters' };
  }
  if (!/^[0-9a-f]{64}$/.test(event.pubkey)) {
    return { valid: false, error: 'pubkey must be lowercase hex' };
  }

  // Validate created_at
  if (typeof event.created_at !== 'number') {
    return { valid: false, error: 'created_at must be a number' };
  }
  if (!Number.isInteger(event.created_at)) {
    return { valid: false, error: 'created_at must be an integer' };
  }
  if (event.created_at < 0) {
    return { valid: false, error: 'created_at must be non-negative' };
  }

  // Validate kind
  if (typeof event.kind !== 'number') {
    return { valid: false, error: 'kind must be a number' };
  }
  if (!Number.isInteger(event.kind)) {
    return { valid: false, error: 'kind must be an integer' };
  }
  if (event.kind < 0) {
    return { valid: false, error: 'kind must be non-negative' };
  }

  // Validate tags
  if (!Array.isArray(event.tags)) {
    return { valid: false, error: 'tags must be an array' };
  }
  for (let i = 0; i < event.tags.length; i++) {
    const tag = event.tags[i];
    if (!Array.isArray(tag)) {
      return { valid: false, error: `tags[${i}] must be an array` };
    }
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] !== 'string') {
        return { valid: false, error: `tags[${i}][${j}] must be a string` };
      }
    }
  }

  // Validate content
  if (typeof event.content !== 'string') {
    return { valid: false, error: 'content must be a string' };
  }

  // Validate signed event fields if present
  if ('id' in event && event.id !== undefined) {
    if (typeof event.id !== 'string') {
      return { valid: false, error: 'id must be a string' };
    }
    if (event.id.length !== 64) {
      return { valid: false, error: 'id must be 64 characters' };
    }
    if (!/^[0-9a-f]{64}$/.test(event.id)) {
      return { valid: false, error: 'id must be lowercase hex' };
    }
  }

  if ('sig' in event && event.sig !== undefined) {
    if (typeof event.sig !== 'string') {
      return { valid: false, error: 'sig must be a string' };
    }
    if (event.sig.length !== 128) {
      return { valid: false, error: 'sig must be 128 characters' };
    }
    if (!/^[0-9a-f]{128}$/.test(event.sig)) {
      return { valid: false, error: 'sig must be lowercase hex' };
    }
  }

  return { valid: true };
}

// ============================================================================
// Event Parsing
// ============================================================================

/**
 * Parse a JSON string into a Nostr event
 *
 * @param json - JSON string representing an event
 * @returns Parsed event or null if invalid
 */
export function parseEvent(json: string): NostrEvent | null {
  try {
    const parsed = JSON.parse(json);
    if (!isNostrEvent(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Type guard to check if an object is a valid NostrEvent
 */
export function isNostrEvent(obj: unknown): obj is NostrEvent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const event = obj as Record<string, unknown>;

  return (
    typeof event.id === 'string' &&
    typeof event.pubkey === 'string' &&
    typeof event.created_at === 'number' &&
    typeof event.kind === 'number' &&
    Array.isArray(event.tags) &&
    typeof event.content === 'string' &&
    typeof event.sig === 'string'
  );
}

/**
 * Type guard to check if an object is a valid UnsignedNostrEvent
 */
export function isUnsignedNostrEvent(obj: unknown): obj is UnsignedNostrEvent {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const event = obj as Record<string, unknown>;

  return (
    typeof event.pubkey === 'string' &&
    typeof event.created_at === 'number' &&
    typeof event.kind === 'number' &&
    Array.isArray(event.tags) &&
    typeof event.content === 'string' &&
    !('id' in event) &&
    !('sig' in event)
  );
}

// ============================================================================
// Event Factory Functions
// ============================================================================

/**
 * Create a metadata event (kind 0)
 */
export function createMetadataEvent(
  privateKey: string | Uint8Array,
  metadata: Record<string, unknown>,
  timestamp?: number
): NostrEvent {
  return createSignedEvent(
    NostrEventKind.METADATA,
    JSON.stringify(metadata),
    privateKey,
    [],
    timestamp
  );
}

/**
 * Create a text note event (kind 1)
 */
export function createTextNoteEvent(
  privateKey: string | Uint8Array,
  content: string,
  tags: string[][] = [],
  timestamp?: number
): NostrEvent {
  return createSignedEvent(
    NostrEventKind.TEXT_NOTE,
    content,
    privateKey,
    tags,
    timestamp
  );
}

/**
 * Create a seal event (kind 13, NIP-17)
 * Content should be encrypted rumor JSON
 */
export function createSealEvent(
  privateKey: string | Uint8Array,
  encryptedRumor: string,
  timestamp?: number
): NostrEvent {
  return createSignedEvent(
    NostrEventKind.SEAL,
    encryptedRumor,
    privateKey,
    [],
    timestamp
  );
}

/**
 * Create a DM rumor event (kind 14, NIP-17)
 * This is the inner event that contains the actual message
 * Note: Rumors are typically unsigned - this creates the structure
 */
export function createDMRumorEvent(
  pubkey: string,
  content: string,
  tags: string[][] = [],
  timestamp?: number
): UnsignedNostrEvent {
  return {
    pubkey,
    created_at: timestamp ?? Math.floor(Date.now() / 1000),
    kind: NostrEventKind.DM_RUMOR,
    tags,
    content,
  };
}

/**
 * Create a gift wrap event (kind 1059, NIP-59)
 * Content should be encrypted seal JSON
 * Uses ephemeral key for sender anonymity
 */
export function createGiftWrapEvent(
  ephemeralPrivateKey: string | Uint8Array,
  recipientPubkey: string,
  encryptedSeal: string,
  timestamp?: number
): NostrEvent {
  return createSignedEvent(
    NostrEventKind.GIFT_WRAP,
    encryptedSeal,
    ephemeralPrivateKey,
    [['p', recipientPubkey]],
    timestamp
  );
}

/**
 * Create an ephemeral/location channel event (kind 20000)
 */
export function createEphemeralEvent(
  privateKey: string | Uint8Array,
  content: string,
  geohash: string,
  nickname?: string,
  timestamp?: number
): NostrEvent {
  const tags: string[][] = [['g', geohash]];
  if (nickname) {
    tags.push(['n', nickname]);
  }

  return createSignedEvent(
    NostrEventKind.EPHEMERAL_EVENT,
    content,
    privateKey,
    tags,
    timestamp
  );
}

// ============================================================================
// Key Utilities
// ============================================================================

/**
 * Generate a new random private key
 *
 * @returns 32-byte private key as hex string
 */
export function generatePrivateKey(): string {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  return bytesToHex(privateKey);
}

/**
 * Get public key from private key
 *
 * @param privateKey - 32-byte private key as hex or Uint8Array
 * @returns 32-byte x-only public key as lowercase hex
 */
export function getPublicKey(privateKey: string | Uint8Array): string {
  const privKeyBytes = typeof privateKey === 'string'
    ? hexToBytes(privateKey)
    : privateKey;
  return bytesToHex(schnorr.getPublicKey(privKeyBytes));
}

/**
 * Validate that a string is a valid hex public key
 */
export function isValidPublicKey(pubkey: string): boolean {
  return /^[0-9a-f]{64}$/.test(pubkey);
}

/**
 * Validate that a string is a valid hex private key
 */
export function isValidPrivateKey(privateKey: string): boolean {
  return /^[0-9a-f]{64}$/.test(privateKey);
}

// ============================================================================
// Timestamp Utilities
// ============================================================================

/**
 * Get current Unix timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Generate a randomized timestamp for NIP-17 privacy
 * Within +/- 15 minutes of current time
 */
export function getRandomizedTimestamp(): number {
  const now = getCurrentTimestamp();
  const offset = Math.floor(Math.random() * 1800) - 900; // -900 to +900 seconds
  return now + offset;
}
