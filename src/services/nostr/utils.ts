/**
 * Nostr Event Utilities
 * Helper functions for creating, signing, and verifying Nostr events
 *
 * Uses nostr-tools 2.x which bundles @noble/curves and @noble/hashes internally
 * @see https://github.com/nbd-wtf/nostr-tools
 */

import {
  getPublicKey,
  nip19,
  verifyEvent as nostrToolsVerifyEvent,
  finalizeEvent,
  getEventHash as nostrToolsGetEventHash,
  type VerifiedEvent,
  type UnsignedEvent,
} from 'nostr-tools';
import type { NostrEvent, UnsignedNostrEvent, NostrEventKind } from './types';

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Create an unsigned Nostr event
 *
 * @param kind Event kind
 * @param content Event content
 * @param tags Event tags
 * @param pubkey Public key (required for unsigned events)
 * @returns Unsigned event ready for signing
 */
export function createEvent(
  kind: number | NostrEventKind,
  content: string,
  tags: string[][] = [],
  pubkey: string
): UnsignedNostrEvent {
  return {
    pubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: typeof kind === 'number' ? kind : kind,
    tags,
    content,
  };
}

/**
 * Calculate the event ID (hash of serialized event)
 *
 * @param event Unsigned or signed event
 * @returns 32-byte hex-encoded event ID
 */
export function getEventId(event: UnsignedNostrEvent | NostrEvent): string {
  // Use nostr-tools getEventHash which handles serialization
  return nostrToolsGetEventHash(event as UnsignedEvent);
}

/**
 * Serialize an event for hashing (NIP-01 format)
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
 * Sign an event with a private key
 * Uses nostr-tools finalizeEvent internally
 *
 * @param event Unsigned event to sign
 * @param privateKey 32-byte hex-encoded private key or nsec
 * @returns Signed event with id and sig
 */
export function signEvent(
  event: UnsignedNostrEvent,
  privateKey: string | Uint8Array
): NostrEvent {
  let privKeyBytes: Uint8Array;

  if (typeof privateKey === 'string') {
    if (privateKey.startsWith('nsec')) {
      const decoded = nip19.decode(privateKey);
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec format');
      }
      privKeyBytes = decoded.data;
    } else {
      privKeyBytes = hexToBytes(privateKey);
    }
  } else {
    privKeyBytes = privateKey;
  }

  // Verify the pubkey matches
  const derivedPubkey = getPublicKey(privKeyBytes);
  if (derivedPubkey !== event.pubkey) {
    throw new Error('Private key does not match event pubkey');
  }

  // Use nostr-tools finalizeEvent which handles hashing and signing
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
 * Sign an event using nostr-tools finalizeEvent
 * Alternative signing method that uses nostr-tools directly
 */
export function signEventWithNostrTools(
  event: UnsignedNostrEvent,
  privateKey: string | Uint8Array
): NostrEvent {
  let privKeyBytes: Uint8Array;

  if (typeof privateKey === 'string') {
    if (privateKey.startsWith('nsec')) {
      const decoded = nip19.decode(privateKey);
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec format');
      }
      privKeyBytes = decoded.data;
    } else {
      privKeyBytes = hexToBytes(privateKey);
    }
  } else {
    privKeyBytes = privateKey;
  }

  const nostrToolsEvent = finalizeEvent(
    {
      kind: event.kind,
      created_at: event.created_at,
      tags: event.tags,
      content: event.content,
    },
    privKeyBytes
  );

  return nostrToolsEvent as NostrEvent;
}

/**
 * Verify an event's signature
 *
 * @param event Signed event to verify
 * @returns True if the signature is valid
 */
export function verifyEvent(event: NostrEvent): boolean {
  try {
    // First verify the event ID is correct
    const expectedId = getEventId(event);
    if (expectedId !== event.id) {
      return false;
    }

    // Use nostr-tools verification which uses schnorr internally
    return nostrToolsVerifyEvent(event as VerifiedEvent);
  } catch {
    return false;
  }
}

/**
 * Verify event signature
 * Alias for verifyEvent for backwards compatibility
 */
export function verifyEventSignature(event: NostrEvent): boolean {
  return verifyEvent(event);
}

/**
 * Get public key from private key
 *
 * @param privateKey Private key as hex string, nsec, or bytes
 * @returns 32-byte hex-encoded public key
 */
export function getPublicKeyFromPrivate(privateKey: string | Uint8Array): string {
  if (typeof privateKey === 'string') {
    if (privateKey.startsWith('nsec')) {
      const decoded = nip19.decode(privateKey);
      if (decoded.type !== 'nsec') {
        throw new Error('Invalid nsec format');
      }
      return getPublicKey(decoded.data);
    }
    return getPublicKey(hexToBytes(privateKey));
  }
  return getPublicKey(privateKey);
}

/**
 * Convert public key to npub format
 */
export function pubkeyToNpub(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}

/**
 * Convert npub to public key hex
 */
export function npubToPubkey(npub: string): string {
  const decoded = nip19.decode(npub);
  if (decoded.type !== 'npub') {
    throw new Error('Invalid npub format');
  }
  return decoded.data;
}

/**
 * Convert private key to nsec format
 */
export function privateKeyToNsec(privateKey: string | Uint8Array): string {
  if (typeof privateKey === 'string') {
    return nip19.nsecEncode(hexToBytes(privateKey));
  }
  return nip19.nsecEncode(privateKey);
}

/**
 * Convert nsec to private key hex
 */
export function nsecToPrivateKey(nsec: string): string {
  const decoded = nip19.decode(nsec);
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec format');
  }
  return bytesToHex(decoded.data);
}

/**
 * Generate a random private key
 */
export function generatePrivateKey(): Uint8Array {
  const privateKey = new Uint8Array(32);
  crypto.getRandomValues(privateKey);
  return privateKey;
}

/**
 * Generate a new key pair
 */
export function generateKeyPair(): { privateKey: Uint8Array; publicKey: string } {
  const privateKey = generatePrivateKey();
  const publicKey = getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Validate a public key format
 */
export function isValidPubkey(pubkey: string): boolean {
  // Must be 64 hex characters (32 bytes)
  if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
    return false;
  }
  return true;
}

/**
 * Validate a private key format
 */
export function isValidPrivateKey(privateKey: string): boolean {
  // Must be 64 hex characters (32 bytes)
  if (!/^[0-9a-f]{64}$/i.test(privateKey)) {
    return false;
  }
  return true;
}

/**
 * Extract specific tags from an event
 */
export function getTagValues(event: NostrEvent, tagName: string): string[] {
  return event.tags
    .filter(tag => tag[0] === tagName)
    .map(tag => tag[1])
    .filter((value): value is string => value !== undefined);
}

/**
 * Get the first value of a specific tag
 */
export function getTagValue(event: NostrEvent, tagName: string): string | undefined {
  const tag = event.tags.find(t => t[0] === tagName);
  return tag?.[1];
}

/**
 * Check if an event is ephemeral (kind 20000-29999)
 */
export function isEphemeralEvent(event: NostrEvent): boolean {
  return event.kind >= 20000 && event.kind < 30000;
}

/**
 * Check if an event is replaceable (kind 10000-19999)
 */
export function isReplaceableEvent(event: NostrEvent): boolean {
  return event.kind >= 10000 && event.kind < 20000;
}

/**
 * Check if an event is parameterized replaceable (kind 30000-39999)
 */
export function isParameterizedReplaceableEvent(event: NostrEvent): boolean {
  return event.kind >= 30000 && event.kind < 40000;
}

/**
 * Get the 'd' tag value for parameterized replaceable events
 */
export function getDTag(event: NostrEvent): string | undefined {
  return getTagValue(event, 'd');
}

/**
 * Create a reply reference tag
 */
export function createReplyTag(replyToEvent: NostrEvent): string[] {
  return ['e', replyToEvent.id, '', 'reply'];
}

/**
 * Create a mention tag
 */
export function createMentionTag(pubkey: string): string[] {
  return ['p', pubkey];
}

/**
 * Create a geohash tag (used for location channels)
 */
export function createGeohashTag(geohash: string): string[] {
  return ['g', geohash];
}
