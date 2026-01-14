/**
 * NIP-17 Private Direct Messages Implementation
 *
 * Implements the NIP-17 specification for encrypted direct messages using:
 * - Kind 14: Direct message rumor (unsigned)
 * - Kind 13: Seal (encrypted rumor)
 * - Kind 1059: Gift wrap (encrypted seal)
 *
 * Uses NIP-44 encryption (via nostr-tools) for all encryption operations.
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/17.md
 * @see https://github.com/nostr-protocol/nips/blob/master/44.md
 * @see https://github.com/nostr-protocol/nips/blob/master/59.md
 */

import {
  getPublicKey,
  finalizeEvent,
  getEventHash,
  generateSecretKey,
  type UnsignedEvent,
  type VerifiedEvent,
} from 'nostr-tools';
import * as nip44 from 'nostr-tools/nip44';
// Use @noble/hashes utils for proper Uint8Array handling with noble libraries
import { hexToBytes } from '@noble/hashes/utils';
import type { NostrEvent, UnsignedNostrEvent } from './types';
import { NostrEventKind } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * A rumor is an unsigned event used in NIP-17 DMs.
 * It contains the actual message content before encryption.
 */
export interface Rumor {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

/**
 * Recipient information for NIP-17 messages
 */
export interface Recipient {
  /** Recipient's public key (hex) */
  publicKey: string;
  /** Optional relay URL hint */
  relayUrl?: string;
}

/**
 * Reply reference for threaded conversations
 */
export interface ReplyTo {
  /** Event ID being replied to */
  eventId: string;
  /** Optional relay URL where the referenced event can be found */
  relayUrl?: string;
}

/**
 * Decrypted message result from unwrapping a gift wrap
 */
export interface DecryptedMessage {
  /** The decrypted rumor event */
  rumor: Rumor;
  /** The seal event that was inside the gift wrap */
  seal: NostrEvent;
  /** Sender's public key (from the rumor) */
  senderPubkey: string;
  /** Message content */
  content: string;
  /** Original message timestamp (from rumor, not randomized) */
  timestamp: number;
  /** Conversation ID for grouping messages */
  conversationId: string;
}

/**
 * Conversation metadata
 */
export interface Conversation {
  /** Unique conversation ID (sorted pubkeys joined) */
  id: string;
  /** All participant public keys */
  participants: string[];
  /** Optional conversation title (from subject tag) */
  title?: string;
  /** Most recent message timestamp */
  lastMessageAt: number;
  /** Number of messages in conversation */
  messageCount: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Maximum timestamp randomization range (2 days in seconds) */
const TWO_DAYS_SECONDS = 2 * 24 * 60 * 60;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Get current timestamp in seconds
 */
function now(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Generate a randomized timestamp within the past 2 days.
 * This prevents timing correlation attacks while preserving
 * the actual message timestamp in the encrypted rumor.
 */
function randomizedTimestamp(): number {
  return Math.floor(now() - Math.random() * TWO_DAYS_SECONDS);
}

/**
 * Compute a conversation key using NIP-44.
 * The conversation key is used for encrypting messages between two parties.
 */
function getConversationKey(
  privateKey: Uint8Array,
  publicKey: string
): Uint8Array {
  return nip44.v2.utils.getConversationKey(privateKey, publicKey);
}

/**
 * Encrypt data using NIP-44 v2 encryption
 */
function nip44Encrypt(
  data: object,
  privateKey: Uint8Array,
  publicKey: string
): string {
  const conversationKey = getConversationKey(privateKey, publicKey);
  return nip44.v2.encrypt(JSON.stringify(data), conversationKey);
}

/**
 * Decrypt data using NIP-44 v2 decryption
 */
function nip44Decrypt<T = unknown>(
  encryptedContent: string,
  conversationKey: Uint8Array
): T {
  const decrypted = nip44.v2.decrypt(encryptedContent, conversationKey);
  return JSON.parse(decrypted) as T;
}

// ============================================================================
// Rumor Functions
// ============================================================================

/**
 * Create a rumor (unsigned kind 14 event) for a direct message.
 *
 * @param content - Message content
 * @param senderPrivateKey - Sender's private key (hex or bytes)
 * @param recipients - Array of recipient information
 * @param options - Optional conversation title and reply reference
 * @returns Rumor with computed ID
 */
export function createRumor(
  content: string,
  senderPrivateKey: string | Uint8Array,
  recipients: Recipient[],
  options?: {
    conversationTitle?: string;
    replyTo?: ReplyTo;
  }
): Rumor {
  const privateKeyBytes =
    typeof senderPrivateKey === 'string'
      ? hexToBytes(senderPrivateKey)
      : senderPrivateKey;
  const senderPubkey = getPublicKey(privateKeyBytes);

  // Build tags
  const tags: string[][] = [];

  // Add recipient p tags
  for (const recipient of recipients) {
    if (recipient.relayUrl) {
      tags.push(['p', recipient.publicKey, recipient.relayUrl]);
    } else {
      tags.push(['p', recipient.publicKey]);
    }
  }

  // Add reply tag if specified
  if (options?.replyTo) {
    tags.push([
      'e',
      options.replyTo.eventId,
      options.replyTo.relayUrl ?? '',
      'reply',
    ]);
  }

  // Add subject tag for conversation title
  if (options?.conversationTitle) {
    tags.push(['subject', options.conversationTitle]);
  }

  const rumor: UnsignedNostrEvent & { id?: string } = {
    pubkey: senderPubkey,
    created_at: now(),
    kind: NostrEventKind.DirectMessage, // kind 14
    tags,
    content,
  };

  // Compute the event ID (hash of serialized event)
  rumor.id = getEventHash(rumor as UnsignedEvent);

  return rumor as Rumor;
}

// ============================================================================
// Seal Functions
// ============================================================================

/**
 * Create a seal (kind 13) by encrypting a rumor to a recipient.
 *
 * The seal:
 * - Contains the NIP-44 encrypted rumor in its content
 * - Has a randomized timestamp for privacy
 * - Has empty tags (recipient is hidden)
 * - Is signed by the sender
 *
 * @param rumor - The rumor to seal
 * @param senderPrivateKey - Sender's private key
 * @param recipientPubkey - Recipient's public key
 * @returns Signed seal event
 */
export function createSeal(
  rumor: Rumor,
  senderPrivateKey: string | Uint8Array,
  recipientPubkey: string
): NostrEvent {
  const privateKeyBytes =
    typeof senderPrivateKey === 'string'
      ? hexToBytes(senderPrivateKey)
      : senderPrivateKey;

  // Encrypt the rumor to the recipient using NIP-44
  const encryptedContent = nip44Encrypt(rumor, privateKeyBytes, recipientPubkey);

  // Create and sign the seal
  const sealTemplate: UnsignedEvent = {
    kind: NostrEventKind.Seal, // kind 13
    created_at: randomizedTimestamp(),
    tags: [], // No tags - recipient is hidden
    content: encryptedContent,
    pubkey: '', // Will be set by finalizeEvent
  };

  const signedSeal = finalizeEvent(sealTemplate, privateKeyBytes);

  return signedSeal as NostrEvent;
}

// ============================================================================
// Gift Wrap Functions
// ============================================================================

/**
 * Create a gift wrap (kind 1059) by encrypting a seal.
 *
 * The gift wrap:
 * - Is signed by a random ephemeral key
 * - Contains the NIP-44 encrypted seal in its content
 * - Has a p tag with the recipient (for relay routing)
 * - Has a randomized timestamp for privacy
 *
 * @param seal - The seal to wrap
 * @param recipientPubkey - Recipient's public key
 * @returns Signed gift wrap event
 */
export function createGiftWrap(
  seal: NostrEvent,
  recipientPubkey: string
): NostrEvent {
  // Generate ephemeral keypair for this gift wrap using nostr-tools
  const ephemeralPrivateKey = generateSecretKey();

  // Encrypt the seal to the recipient
  const encryptedContent = nip44Encrypt(
    seal,
    ephemeralPrivateKey,
    recipientPubkey
  );

  // Create and sign the gift wrap with ephemeral key
  const wrapTemplate: UnsignedEvent = {
    kind: NostrEventKind.GiftWrap, // kind 1059
    created_at: randomizedTimestamp(),
    tags: [['p', recipientPubkey]], // Tag recipient for relay routing
    content: encryptedContent,
    pubkey: '', // Will be set by finalizeEvent
  };

  const signedWrap = finalizeEvent(
    wrapTemplate,
    ephemeralPrivateKey
  );

  return signedWrap as NostrEvent;
}

// ============================================================================
// Complete Wrapping Functions
// ============================================================================

/**
 * Create a complete NIP-17 gift-wrapped message for a single recipient.
 *
 * This creates:
 * 1. A rumor (unsigned kind 14 DM)
 * 2. A seal (encrypted rumor, kind 13)
 * 3. A gift wrap (encrypted seal, kind 1059)
 *
 * @param senderPrivateKey - Sender's private key
 * @param recipient - Recipient information
 * @param message - Message content
 * @param conversationTitle - Optional conversation title
 * @param replyTo - Optional reference to a message being replied to
 * @returns Gift-wrapped event ready for publishing
 */
export function wrapEvent(
  senderPrivateKey: string | Uint8Array,
  recipient: Recipient,
  message: string,
  conversationTitle?: string,
  replyTo?: ReplyTo
): NostrEvent {
  const privateKeyBytes =
    typeof senderPrivateKey === 'string'
      ? hexToBytes(senderPrivateKey)
      : senderPrivateKey;

  // 1. Create the rumor
  const rumor = createRumor(message, privateKeyBytes, [recipient], {
    conversationTitle,
    replyTo,
  });

  // 2. Create the seal (encrypt rumor to recipient)
  const seal = createSeal(rumor, privateKeyBytes, recipient.publicKey);

  // 3. Create the gift wrap (encrypt seal to recipient)
  return createGiftWrap(seal, recipient.publicKey);
}

/**
 * Create gift-wrapped messages for multiple recipients (group DM).
 * Also creates a copy for the sender to store their own messages.
 *
 * @param senderPrivateKey - Sender's private key
 * @param recipients - Array of recipients
 * @param message - Message content
 * @param conversationTitle - Optional conversation title
 * @param replyTo - Optional reference to a message being replied to
 * @returns Array of gift-wrapped events (one per recipient + one for sender)
 */
export function wrapManyEvents(
  senderPrivateKey: string | Uint8Array,
  recipients: Recipient[],
  message: string,
  conversationTitle?: string,
  replyTo?: ReplyTo
): NostrEvent[] {
  if (!recipients || recipients.length === 0) {
    throw new Error('At least one recipient is required');
  }

  const privateKeyBytes =
    typeof senderPrivateKey === 'string'
      ? hexToBytes(senderPrivateKey)
      : senderPrivateKey;
  const senderPubkey = getPublicKey(privateKeyBytes);

  // Include sender as a recipient so they can store their own copy
  const allRecipients: Recipient[] = [
    { publicKey: senderPubkey },
    ...recipients,
  ];

  return allRecipients.map((recipient) =>
    wrapEvent(privateKeyBytes, recipient, message, conversationTitle, replyTo)
  );
}

// ============================================================================
// Unwrapping Functions
// ============================================================================

/**
 * Unwrap a gift wrap to extract the seal.
 *
 * @param giftWrap - The gift-wrapped event (kind 1059)
 * @param recipientPrivateKey - Recipient's private key
 * @returns The decrypted seal event
 */
export function unwrapGiftWrap(
  giftWrap: NostrEvent,
  recipientPrivateKey: string | Uint8Array
): NostrEvent {
  if (giftWrap.kind !== NostrEventKind.GiftWrap) {
    throw new Error(`Expected kind ${NostrEventKind.GiftWrap}, got ${giftWrap.kind}`);
  }

  const privateKeyBytes =
    typeof recipientPrivateKey === 'string'
      ? hexToBytes(recipientPrivateKey)
      : recipientPrivateKey;

  // Decrypt the gift wrap content using the ephemeral pubkey
  const conversationKey = getConversationKey(privateKeyBytes, giftWrap.pubkey);
  const seal = nip44Decrypt<NostrEvent>(giftWrap.content, conversationKey);

  return seal;
}

/**
 * Open a seal to extract the rumor.
 *
 * @param seal - The seal event (kind 13)
 * @param recipientPrivateKey - Recipient's private key
 * @returns The decrypted rumor
 */
export function openSeal(
  seal: NostrEvent,
  recipientPrivateKey: string | Uint8Array
): Rumor {
  if (seal.kind !== NostrEventKind.Seal) {
    throw new Error(`Expected kind ${NostrEventKind.Seal}, got ${seal.kind}`);
  }

  const privateKeyBytes =
    typeof recipientPrivateKey === 'string'
      ? hexToBytes(recipientPrivateKey)
      : recipientPrivateKey;

  // Decrypt the seal content using the seal's pubkey (sender)
  const conversationKey = getConversationKey(privateKeyBytes, seal.pubkey);
  const rumor = nip44Decrypt<Rumor>(seal.content, conversationKey);

  // Verify the rumor's pubkey matches the seal's pubkey (prevents sender impersonation)
  if (rumor.pubkey !== seal.pubkey) {
    throw new Error(
      'Seal pubkey does not match rumor pubkey - possible sender impersonation'
    );
  }

  return rumor;
}

/**
 * Completely unwrap a gift wrap to get the decrypted message.
 *
 * This performs the full decryption:
 * 1. Unwrap the gift wrap to get the seal
 * 2. Open the seal to get the rumor
 * 3. Extract message content and metadata
 *
 * @param giftWrap - The gift-wrapped event
 * @param recipientPrivateKey - Recipient's private key
 * @returns Decrypted message with all metadata
 */
export function unwrapEvent(
  giftWrap: NostrEvent,
  recipientPrivateKey: string | Uint8Array
): DecryptedMessage {
  // 1. Unwrap gift wrap to get seal
  const seal = unwrapGiftWrap(giftWrap, recipientPrivateKey);

  // 2. Open seal to get rumor
  const rumor = openSeal(seal, recipientPrivateKey);

  // 3. Extract conversation ID from participants
  const conversationId = getConversationId(rumor);

  return {
    rumor,
    seal,
    senderPubkey: rumor.pubkey,
    content: rumor.content,
    timestamp: rumor.created_at,
    conversationId,
  };
}

/**
 * Unwrap multiple gift-wrapped events.
 *
 * @param wrappedEvents - Array of gift-wrapped events
 * @param recipientPrivateKey - Recipient's private key
 * @returns Array of decrypted messages, sorted by timestamp
 */
export function unwrapManyEvents(
  wrappedEvents: NostrEvent[],
  recipientPrivateKey: string | Uint8Array
): DecryptedMessage[] {
  const decrypted: DecryptedMessage[] = [];

  for (const giftWrap of wrappedEvents) {
    try {
      const message = unwrapEvent(giftWrap, recipientPrivateKey);
      decrypted.push(message);
    } catch (error) {
      // Skip events that fail to decrypt (may not be for us)
      console.warn('[NIP-17] Failed to decrypt event:', error);
    }
  }

  // Sort by timestamp (ascending)
  return decrypted.sort((a, b) => a.timestamp - b.timestamp);
}

// ============================================================================
// Conversation Management
// ============================================================================

/**
 * Get a unique conversation ID from a rumor's participants.
 * The ID is created by sorting all participant pubkeys and joining them.
 *
 * @param rumor - The rumor event
 * @returns Conversation ID
 */
export function getConversationId(rumor: Rumor): string {
  const participants = getParticipants(rumor);
  // Sort pubkeys to ensure consistent ID regardless of order
  return participants.sort().join(':');
}

/**
 * Extract all participants from a rumor (sender + all p-tagged recipients).
 *
 * @param rumor - The rumor event
 * @returns Array of participant public keys
 */
export function getParticipants(rumor: Rumor): string[] {
  const participants = new Set<string>();

  // Add sender
  participants.add(rumor.pubkey);

  // Add all p-tagged recipients
  for (const tag of rumor.tags) {
    if (tag[0] === 'p' && tag[1]) {
      participants.add(tag[1]);
    }
  }

  return Array.from(participants);
}

/**
 * Extract the conversation title (subject) from a rumor.
 *
 * @param rumor - The rumor event
 * @returns Conversation title or undefined
 */
export function getConversationTitle(rumor: Rumor): string | undefined {
  const subjectTag = rumor.tags.find((tag) => tag[0] === 'subject');
  return subjectTag?.[1];
}

/**
 * Get the reply-to event ID from a rumor.
 *
 * @param rumor - The rumor event
 * @returns Reply-to event ID or undefined
 */
export function getReplyToId(rumor: Rumor): string | undefined {
  const replyTag = rumor.tags.find(
    (tag) => tag[0] === 'e' && tag[3] === 'reply'
  );
  return replyTag?.[1];
}

/**
 * Group decrypted messages by conversation.
 *
 * @param messages - Array of decrypted messages
 * @returns Map of conversation ID to messages
 */
export function groupByConversation(
  messages: DecryptedMessage[]
): Map<string, DecryptedMessage[]> {
  const conversations = new Map<string, DecryptedMessage[]>();

  for (const message of messages) {
    const existing = conversations.get(message.conversationId) || [];
    existing.push(message);
    conversations.set(message.conversationId, existing);
  }

  // Sort messages within each conversation by timestamp
  for (const [id, msgs] of conversations) {
    msgs.sort((a, b) => a.timestamp - b.timestamp);
    conversations.set(id, msgs);
  }

  return conversations;
}

/**
 * Build conversation metadata from decrypted messages.
 *
 * @param messages - Array of decrypted messages
 * @returns Array of conversation metadata
 */
export function buildConversations(messages: DecryptedMessage[]): Conversation[] {
  const grouped = groupByConversation(messages);
  const conversations: Conversation[] = [];

  for (const [id, msgs] of grouped) {
    if (msgs.length === 0) continue;

    const firstMessage = msgs[0];
    const lastMessage = msgs[msgs.length - 1];

    conversations.push({
      id,
      participants: getParticipants(firstMessage.rumor),
      title: getConversationTitle(firstMessage.rumor),
      lastMessageAt: lastMessage.timestamp,
      messageCount: msgs.length,
    });
  }

  // Sort by most recent activity
  return conversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
}

// ============================================================================
// Message Deduplication
// ============================================================================

/**
 * Deduplicate messages by rumor ID.
 * Since the same rumor can be wrapped multiple times (for sender backup),
 * we should only keep one copy of each message.
 *
 * @param messages - Array of decrypted messages
 * @returns Deduplicated array of messages
 */
export function deduplicateMessages(
  messages: DecryptedMessage[]
): DecryptedMessage[] {
  const seen = new Set<string>();
  const unique: DecryptedMessage[] = [];

  for (const message of messages) {
    if (!seen.has(message.rumor.id)) {
      seen.add(message.rumor.id);
      unique.push(message);
    }
  }

  return unique;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if an event is a valid gift wrap (kind 1059).
 *
 * @param event - Event to check
 * @returns True if the event is a valid gift wrap
 */
export function isGiftWrap(event: NostrEvent): boolean {
  return (
    event.kind === NostrEventKind.GiftWrap &&
    typeof event.content === 'string' &&
    event.content.length > 0 &&
    Array.isArray(event.tags)
  );
}

/**
 * Check if a gift wrap is addressed to a specific pubkey.
 *
 * @param giftWrap - Gift wrap event
 * @param pubkey - Public key to check
 * @returns True if the gift wrap is addressed to the pubkey
 */
export function isAddressedTo(giftWrap: NostrEvent, pubkey: string): boolean {
  return giftWrap.tags.some(
    (tag) => tag[0] === 'p' && tag[1] === pubkey
  );
}

// ============================================================================
// Subscription Filter Helpers
// ============================================================================

/**
 * Create a filter for subscribing to gift-wrapped messages.
 *
 * @param recipientPubkey - Recipient's public key
 * @param since - Optional timestamp to filter from
 * @param limit - Optional maximum number of events
 * @returns Nostr filter for gift wraps
 */
export function createGiftWrapFilter(
  recipientPubkey: string,
  since?: number,
  limit?: number
): {
  kinds: number[];
  '#p': string[];
  since?: number;
  limit?: number;
} {
  const filter: {
    kinds: number[];
    '#p': string[];
    since?: number;
    limit?: number;
  } = {
    kinds: [NostrEventKind.GiftWrap],
    '#p': [recipientPubkey],
  };

  if (since !== undefined) {
    filter.since = since;
  }

  if (limit !== undefined) {
    filter.limit = limit;
  }

  return filter;
}

// ============================================================================
// Export nostr-tools NIP-17 functions for compatibility
// ============================================================================

// Re-export key internal utilities for testing and advanced usage
export {
  getConversationKey,
  randomizedTimestamp,
  now,
};
