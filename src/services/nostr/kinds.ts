/**
 * Nostr Event Kinds for BitChat
 *
 * Defines all event kinds used by BitChat and provides validation
 * functions for each kind. Compatible with native BitChat iOS/Android apps.
 *
 * @see https://github.com/nostr-protocol/nips
 */

import type { NostrEvent, UnsignedNostrEvent } from './types';

// ============================================================================
// Event Kind Constants
// ============================================================================

/**
 * Standard Nostr event kinds used by BitChat
 */
export const EventKinds = {
  /** NIP-01: User metadata (profile) */
  METADATA: 0,

  /** NIP-01: Text note (short text post) */
  TEXT_NOTE: 1,

  /** NIP-02: Relay list metadata */
  RECOMMEND_RELAY: 2,

  /** NIP-02: Contact list / follow list */
  CONTACTS: 3,

  /** NIP-04: Encrypted direct message (legacy) */
  ENCRYPTED_DM: 4,

  /** NIP-09: Event deletion request */
  EVENT_DELETION: 5,

  /** NIP-18: Repost */
  REPOST: 6,

  /** NIP-25: Reaction */
  REACTION: 7,

  /** NIP-58: Badge award */
  BADGE_AWARD: 8,

  /** NIP-59: Seal (encrypted event wrapper) */
  SEAL: 13,

  /** NIP-17: Chat message (modern DM) */
  CHAT_MESSAGE: 14,

  /** NIP-18: Generic repost */
  GENERIC_REPOST: 16,

  /** NIP-28: Channel creation */
  CHANNEL_CREATION: 40,

  /** NIP-28: Channel metadata */
  CHANNEL_METADATA: 41,

  /** NIP-28: Channel message */
  CHANNEL_MESSAGE: 42,

  /** NIP-28: Hide channel message */
  CHANNEL_HIDE_MESSAGE: 43,

  /** NIP-28: Mute user in channel */
  CHANNEL_MUTE_USER: 44,

  /** NIP-59: Gift wrap (encrypted event container) */
  GIFT_WRAP: 1059,

  /** NIP-94: File metadata */
  FILE_METADATA: 1063,

  /** NIP-53: Live chat message */
  LIVE_CHAT_MESSAGE: 1311,

  /** NIP-56: Report */
  REPORT: 1984,

  /** NIP-32: Label */
  LABEL: 1985,

  /** NIP-57: Zap request */
  ZAP_REQUEST: 9734,

  /** NIP-57: Zap receipt */
  ZAP: 9735,

  /** NIP-65: Relay list */
  RELAY_LIST: 10002,

  /**
   * BitChat Location Channel Message
   *
   * Ephemeral event (kind 20000-29999) used for location-based channels.
   * Messages are not stored permanently by relays.
   * Uses geohash tags (#g) for location filtering.
   */
  LOCATION_CHANNEL_MESSAGE: 20000,

  /** NIP-42: Client authentication */
  CLIENT_AUTH: 22242,

  /** NIP-46: Nostr Connect */
  NOSTR_CONNECT: 24133,

  /** NIP-58: Profile badges */
  PROFILE_BADGES: 30008,

  /** NIP-58: Badge definition */
  BADGE_DEFINITION: 30009,
} as const;

export type EventKind = (typeof EventKinds)[keyof typeof EventKinds];

// ============================================================================
// Event Kind Ranges
// ============================================================================

/**
 * Event kind range definitions per NIP-01
 */
export const EventKindRanges = {
  /** Regular events (stored by relays, not replaced) */
  REGULAR_MIN: 1000,
  REGULAR_MAX: 9999,

  /** Replaceable events (latest replaces older) */
  REPLACEABLE_MIN: 10000,
  REPLACEABLE_MAX: 19999,

  /** Ephemeral events (not stored by relays) */
  EPHEMERAL_MIN: 20000,
  EPHEMERAL_MAX: 29999,

  /** Parameterized replaceable events (replaced by kind+pubkey+d-tag) */
  PARAMETERIZED_MIN: 30000,
  PARAMETERIZED_MAX: 39999,
} as const;

// ============================================================================
// Event Kind Classification
// ============================================================================

/**
 * Check if an event kind is ephemeral (not stored by relays)
 */
export function isEphemeralKind(kind: number): boolean {
  return kind >= EventKindRanges.EPHEMERAL_MIN && kind < EventKindRanges.EPHEMERAL_MAX + 1;
}

/**
 * Check if an event kind is replaceable
 */
export function isReplaceableKind(kind: number): boolean {
  // Standard replaceable kinds
  if (kind === EventKinds.METADATA || kind === EventKinds.CONTACTS) {
    return true;
  }
  // Range-based replaceable kinds
  return kind >= EventKindRanges.REPLACEABLE_MIN && kind < EventKindRanges.REPLACEABLE_MAX + 1;
}

/**
 * Check if an event kind is parameterized replaceable
 */
export function isParameterizedReplaceableKind(kind: number): boolean {
  return kind >= EventKindRanges.PARAMETERIZED_MIN && kind < EventKindRanges.PARAMETERIZED_MAX + 1;
}

/**
 * Check if an event kind is a location channel message
 */
export function isLocationChannelKind(kind: number): boolean {
  return kind === EventKinds.LOCATION_CHANNEL_MESSAGE;
}

/**
 * Check if an event kind is a direct message (legacy or modern)
 */
export function isDirectMessageKind(kind: number): boolean {
  return kind === EventKinds.ENCRYPTED_DM || kind === EventKinds.CHAT_MESSAGE;
}

/**
 * Check if an event kind is a gift wrap event
 */
export function isGiftWrapKind(kind: number): boolean {
  return kind === EventKinds.GIFT_WRAP;
}

// ============================================================================
// Event Validation
// ============================================================================

/**
 * Validation result with optional error message
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate basic event structure
 */
export function validateEventStructure(
  event: NostrEvent | UnsignedNostrEvent
): ValidationResult {
  // Check required fields
  if (typeof event.pubkey !== 'string' || event.pubkey.length !== 64) {
    return { valid: false, error: 'Invalid pubkey: must be 64 hex characters' };
  }

  if (!/^[0-9a-f]{64}$/i.test(event.pubkey)) {
    return { valid: false, error: 'Invalid pubkey: must be lowercase hex' };
  }

  if (typeof event.created_at !== 'number' || event.created_at < 0) {
    return { valid: false, error: 'Invalid created_at: must be positive Unix timestamp' };
  }

  if (typeof event.kind !== 'number' || event.kind < 0 || !Number.isInteger(event.kind)) {
    return { valid: false, error: 'Invalid kind: must be non-negative integer' };
  }

  if (!Array.isArray(event.tags)) {
    return { valid: false, error: 'Invalid tags: must be an array' };
  }

  for (let i = 0; i < event.tags.length; i++) {
    const tag = event.tags[i];
    if (!Array.isArray(tag)) {
      return { valid: false, error: `Invalid tag at index ${i}: must be an array` };
    }
    for (let j = 0; j < tag.length; j++) {
      if (typeof tag[j] !== 'string') {
        return { valid: false, error: `Invalid tag value at [${i}][${j}]: must be a string` };
      }
    }
  }

  if (typeof event.content !== 'string') {
    return { valid: false, error: 'Invalid content: must be a string' };
  }

  // Validate signed event fields
  if ('id' in event && 'sig' in event) {
    const signedEvent = event as NostrEvent;

    if (typeof signedEvent.id !== 'string' || signedEvent.id.length !== 64) {
      return { valid: false, error: 'Invalid id: must be 64 hex characters' };
    }

    if (!/^[0-9a-f]{64}$/i.test(signedEvent.id)) {
      return { valid: false, error: 'Invalid id: must be lowercase hex' };
    }

    if (typeof signedEvent.sig !== 'string' || signedEvent.sig.length !== 128) {
      return { valid: false, error: 'Invalid sig: must be 128 hex characters' };
    }

    if (!/^[0-9a-f]{128}$/i.test(signedEvent.sig)) {
      return { valid: false, error: 'Invalid sig: must be lowercase hex' };
    }
  }

  return { valid: true };
}

/**
 * Validate a metadata event (kind 0)
 */
export function validateMetadataEvent(event: NostrEvent | UnsignedNostrEvent): ValidationResult {
  const structureResult = validateEventStructure(event);
  if (!structureResult.valid) return structureResult;

  if (event.kind !== EventKinds.METADATA) {
    return { valid: false, error: `Expected kind ${EventKinds.METADATA}, got ${event.kind}` };
  }

  // Content must be valid JSON
  try {
    const metadata = JSON.parse(event.content);
    if (typeof metadata !== 'object' || metadata === null) {
      return { valid: false, error: 'Metadata content must be a JSON object' };
    }

    // Validate common metadata fields if present
    if (metadata.name !== undefined && typeof metadata.name !== 'string') {
      return { valid: false, error: 'Metadata name must be a string' };
    }
    if (metadata.about !== undefined && typeof metadata.about !== 'string') {
      return { valid: false, error: 'Metadata about must be a string' };
    }
    if (metadata.picture !== undefined && typeof metadata.picture !== 'string') {
      return { valid: false, error: 'Metadata picture must be a string' };
    }
  } catch {
    return { valid: false, error: 'Metadata content must be valid JSON' };
  }

  return { valid: true };
}

/**
 * Validate a text note event (kind 1)
 */
export function validateTextNoteEvent(event: NostrEvent | UnsignedNostrEvent): ValidationResult {
  const structureResult = validateEventStructure(event);
  if (!structureResult.valid) return structureResult;

  if (event.kind !== EventKinds.TEXT_NOTE) {
    return { valid: false, error: `Expected kind ${EventKinds.TEXT_NOTE}, got ${event.kind}` };
  }

  // Content should not be empty for text notes
  if (event.content.length === 0) {
    return { valid: false, error: 'Text note content cannot be empty' };
  }

  return { valid: true };
}

/**
 * Validate an encrypted DM event (kind 4, legacy NIP-04)
 */
export function validateEncryptedDMEvent(event: NostrEvent | UnsignedNostrEvent): ValidationResult {
  const structureResult = validateEventStructure(event);
  if (!structureResult.valid) return structureResult;

  if (event.kind !== EventKinds.ENCRYPTED_DM) {
    return { valid: false, error: `Expected kind ${EventKinds.ENCRYPTED_DM}, got ${event.kind}` };
  }

  // Must have exactly one 'p' tag for recipient
  const pTags = event.tags.filter((tag) => tag[0] === 'p');
  if (pTags.length !== 1) {
    return { valid: false, error: 'Encrypted DM must have exactly one p tag for recipient' };
  }

  // Validate recipient pubkey
  const recipientPubkey = pTags[0][1];
  if (!recipientPubkey || !/^[0-9a-f]{64}$/i.test(recipientPubkey)) {
    return { valid: false, error: 'Invalid recipient pubkey in p tag' };
  }

  // Content must be NIP-04 encrypted format
  if (!event.content.includes('?iv=')) {
    return { valid: false, error: 'Content must be NIP-04 encrypted format' };
  }

  return { valid: true };
}

/**
 * Validate a chat message event (kind 14, NIP-17)
 */
export function validateChatMessageEvent(event: NostrEvent | UnsignedNostrEvent): ValidationResult {
  const structureResult = validateEventStructure(event);
  if (!structureResult.valid) return structureResult;

  if (event.kind !== EventKinds.CHAT_MESSAGE) {
    return { valid: false, error: `Expected kind ${EventKinds.CHAT_MESSAGE}, got ${event.kind}` };
  }

  // Must have at least one 'p' tag for recipient(s)
  const pTags = event.tags.filter((tag) => tag[0] === 'p');
  if (pTags.length === 0) {
    return { valid: false, error: 'Chat message must have at least one p tag' };
  }

  // Validate all recipient pubkeys
  for (const pTag of pTags) {
    if (!pTag[1] || !/^[0-9a-f]{64}$/i.test(pTag[1])) {
      return { valid: false, error: 'Invalid recipient pubkey in p tag' };
    }
  }

  return { valid: true };
}

/**
 * Validate a gift wrap event (kind 1059, NIP-17/59)
 */
export function validateGiftWrapEvent(event: NostrEvent | UnsignedNostrEvent): ValidationResult {
  const structureResult = validateEventStructure(event);
  if (!structureResult.valid) return structureResult;

  if (event.kind !== EventKinds.GIFT_WRAP) {
    return { valid: false, error: `Expected kind ${EventKinds.GIFT_WRAP}, got ${event.kind}` };
  }

  // Must have exactly one 'p' tag for recipient
  const pTags = event.tags.filter((tag) => tag[0] === 'p');
  if (pTags.length !== 1) {
    return { valid: false, error: 'Gift wrap must have exactly one p tag for recipient' };
  }

  // Validate recipient pubkey
  const recipientPubkey = pTags[0][1];
  if (!recipientPubkey || !/^[0-9a-f]{64}$/i.test(recipientPubkey)) {
    return { valid: false, error: 'Invalid recipient pubkey in p tag' };
  }

  // Content must not be empty (contains encrypted seal)
  if (event.content.length === 0) {
    return { valid: false, error: 'Gift wrap content cannot be empty' };
  }

  return { valid: true };
}

/**
 * Validate a location channel message event (kind 20000)
 */
export function validateLocationChannelEvent(
  event: NostrEvent | UnsignedNostrEvent
): ValidationResult {
  const structureResult = validateEventStructure(event);
  if (!structureResult.valid) return structureResult;

  if (event.kind !== EventKinds.LOCATION_CHANNEL_MESSAGE) {
    return {
      valid: false,
      error: `Expected kind ${EventKinds.LOCATION_CHANNEL_MESSAGE}, got ${event.kind}`,
    };
  }

  // Must have at least one 'g' tag for geohash
  const gTags = event.tags.filter((tag) => tag[0] === 'g');
  if (gTags.length === 0) {
    return { valid: false, error: 'Location channel message must have at least one g tag' };
  }

  // Validate geohash format (alphanumeric, 1-12 characters)
  for (const gTag of gTags) {
    const geohash = gTag[1];
    if (!geohash || !/^[0-9a-z]{1,12}$/i.test(geohash)) {
      return { valid: false, error: 'Invalid geohash in g tag' };
    }
  }

  return { valid: true };
}

/**
 * Validate any event based on its kind
 */
export function validateEvent(event: NostrEvent | UnsignedNostrEvent): ValidationResult {
  switch (event.kind) {
    case EventKinds.METADATA:
      return validateMetadataEvent(event);
    case EventKinds.TEXT_NOTE:
      return validateTextNoteEvent(event);
    case EventKinds.ENCRYPTED_DM:
      return validateEncryptedDMEvent(event);
    case EventKinds.CHAT_MESSAGE:
      return validateChatMessageEvent(event);
    case EventKinds.GIFT_WRAP:
      return validateGiftWrapEvent(event);
    case EventKinds.LOCATION_CHANNEL_MESSAGE:
      return validateLocationChannelEvent(event);
    default:
      // For other kinds, just validate structure
      return validateEventStructure(event);
  }
}

// ============================================================================
// Event Kind Metadata
// ============================================================================

/**
 * Human-readable information about event kinds
 */
export const EventKindInfo: Record<
  number,
  { name: string; description: string; nip?: string }
> = {
  [EventKinds.METADATA]: {
    name: 'Metadata',
    description: 'User profile information',
    nip: 'NIP-01',
  },
  [EventKinds.TEXT_NOTE]: {
    name: 'Text Note',
    description: 'Short text post',
    nip: 'NIP-01',
  },
  [EventKinds.RECOMMEND_RELAY]: {
    name: 'Recommend Relay',
    description: 'Relay recommendation',
    nip: 'NIP-02',
  },
  [EventKinds.CONTACTS]: {
    name: 'Contacts',
    description: 'Follow list',
    nip: 'NIP-02',
  },
  [EventKinds.ENCRYPTED_DM]: {
    name: 'Encrypted DM',
    description: 'Legacy encrypted direct message',
    nip: 'NIP-04',
  },
  [EventKinds.EVENT_DELETION]: {
    name: 'Event Deletion',
    description: 'Request to delete events',
    nip: 'NIP-09',
  },
  [EventKinds.REPOST]: {
    name: 'Repost',
    description: 'Repost of another event',
    nip: 'NIP-18',
  },
  [EventKinds.REACTION]: {
    name: 'Reaction',
    description: 'Reaction to another event',
    nip: 'NIP-25',
  },
  [EventKinds.SEAL]: {
    name: 'Seal',
    description: 'Encrypted event wrapper',
    nip: 'NIP-59',
  },
  [EventKinds.CHAT_MESSAGE]: {
    name: 'Chat Message',
    description: 'Modern direct message',
    nip: 'NIP-17',
  },
  [EventKinds.GIFT_WRAP]: {
    name: 'Gift Wrap',
    description: 'Encrypted event container',
    nip: 'NIP-17/59',
  },
  [EventKinds.LOCATION_CHANNEL_MESSAGE]: {
    name: 'Location Channel Message',
    description: 'BitChat location-based channel message',
    nip: 'Custom (Ephemeral)',
  },
  [EventKinds.RELAY_LIST]: {
    name: 'Relay List',
    description: 'User relay preferences',
    nip: 'NIP-65',
  },
};

/**
 * Get human-readable name for an event kind
 */
export function getEventKindName(kind: number): string {
  return EventKindInfo[kind]?.name ?? `Kind ${kind}`;
}

/**
 * Get description for an event kind
 */
export function getEventKindDescription(kind: number): string {
  return EventKindInfo[kind]?.description ?? 'Unknown event kind';
}
