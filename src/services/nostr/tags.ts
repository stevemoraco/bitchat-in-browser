/**
 * Nostr Tag Utilities for BitChat
 *
 * Provides tag parsing, building, and manipulation utilities for Nostr events.
 * Includes specialized support for geohash tags used in location channels.
 *
 * @see https://github.com/nostr-protocol/nips
 */

import type { NostrEvent, UnsignedNostrEvent } from './types';

// ============================================================================
// Tag Type Definitions
// ============================================================================

/**
 * Common tag types used in Nostr events
 */
export const TagTypes = {
  /** Event reference */
  EVENT: 'e',
  /** Pubkey reference */
  PUBKEY: 'p',
  /** Geohash (location) */
  GEOHASH: 'g',
  /** Identifier (for replaceable events) */
  IDENTIFIER: 'd',
  /** Reference/link */
  REFERENCE: 'r',
  /** Hashtag */
  HASHTAG: 't',
  /** Amount (for zaps) */
  AMOUNT: 'amount',
  /** Relay URL */
  RELAY: 'relay',
  /** Subject/title */
  SUBJECT: 'subject',
  /** Content warning */
  CONTENT_WARNING: 'content-warning',
  /** Expiration timestamp */
  EXPIRATION: 'expiration',
  /** Image URL */
  IMAGE: 'image',
  /** Thumb URL */
  THUMB: 'thumb',
  /** Summary */
  SUMMARY: 'summary',
  /** Title */
  TITLE: 'title',
  /** Published timestamp */
  PUBLISHED_AT: 'published_at',
  /** Alt text */
  ALT: 'alt',
  /** Client tag */
  CLIENT: 'client',
  /** Proxy */
  PROXY: 'proxy',
  /** Emoji */
  EMOJI: 'emoji',
  /** NIP-10 marker for root event */
  ROOT_MARKER: 'root',
  /** NIP-10 marker for reply event */
  REPLY_MARKER: 'reply',
  /** NIP-10 marker for mention */
  MENTION_MARKER: 'mention',
} as const;

/**
 * NIP-10 reply markers for threading
 */
export type ReplyMarker = 'root' | 'reply' | 'mention';

// ============================================================================
// Tag Parsing
// ============================================================================

/**
 * Get all values for a specific tag type
 *
 * @param event Event to extract tags from
 * @param tagType Tag type to filter (e.g., 'e', 'p', 'g')
 * @returns Array of tag values (first element after tag type)
 */
export function getTagValues(
  event: NostrEvent | UnsignedNostrEvent,
  tagType: string
): string[] {
  return event.tags
    .filter((tag) => tag[0] === tagType)
    .map((tag) => tag[1])
    .filter((value): value is string => value !== undefined);
}

/**
 * Get the first value for a specific tag type
 *
 * @param event Event to extract tag from
 * @param tagType Tag type to find (e.g., 'e', 'p', 'g')
 * @returns First tag value or undefined
 */
export function getTagValue(
  event: NostrEvent | UnsignedNostrEvent,
  tagType: string
): string | undefined {
  const tag = event.tags.find((t) => t[0] === tagType);
  return tag?.[1];
}

/**
 * Get all tags of a specific type with full data
 *
 * @param event Event to extract tags from
 * @param tagType Tag type to filter
 * @returns Array of complete tag arrays
 */
export function getTags(
  event: NostrEvent | UnsignedNostrEvent,
  tagType: string
): string[][] {
  return event.tags.filter((tag) => tag[0] === tagType);
}

/**
 * Check if event has a specific tag
 *
 * @param event Event to check
 * @param tagType Tag type to look for
 * @param value Optional specific value to match
 * @returns True if tag exists (with optional value match)
 */
export function hasTag(
  event: NostrEvent | UnsignedNostrEvent,
  tagType: string,
  value?: string
): boolean {
  return event.tags.some((tag) => {
    if (tag[0] !== tagType) return false;
    if (value !== undefined && tag[1] !== value) return false;
    return true;
  });
}

/**
 * Parse event references with NIP-10 markers
 *
 * @param event Event to parse
 * @returns Object with root, reply, and mention references
 */
export function parseEventReferences(event: NostrEvent | UnsignedNostrEvent): {
  root?: { id: string; relay?: string };
  reply?: { id: string; relay?: string };
  mentions: Array<{ id: string; relay?: string }>;
} {
  const eTags = getTags(event, TagTypes.EVENT);
  const result: {
    root?: { id: string; relay?: string };
    reply?: { id: string; relay?: string };
    mentions: Array<{ id: string; relay?: string }>;
  } = { mentions: [] };

  // NIP-10 parsing with markers
  for (const tag of eTags) {
    const [, eventId, relay, marker] = tag;
    if (!eventId) continue;

    const ref = { id: eventId, relay: relay || undefined };

    if (marker === 'root') {
      result.root = ref;
    } else if (marker === 'reply') {
      result.reply = ref;
    } else if (marker === 'mention') {
      result.mentions.push(ref);
    }
  }

  // If no markers, use positional parsing (deprecated but still common)
  if (!result.root && !result.reply && eTags.length > 0) {
    // First e tag without marker is root
    const firstTag = eTags[0];
    if (firstTag && firstTag.length >= 2 && !firstTag[3]) {
      result.root = { id: firstTag[1], relay: firstTag[2] || undefined };
    }

    // Last e tag without marker is reply (if different from first)
    if (eTags.length > 1) {
      const lastTag = eTags[eTags.length - 1];
      if (lastTag && lastTag.length >= 2 && !lastTag[3]) {
        result.reply = { id: lastTag[1], relay: lastTag[2] || undefined };
      }
    }
  }

  return result;
}

/**
 * Parse pubkey references from event
 *
 * @param event Event to parse
 * @returns Array of pubkeys referenced
 */
export function parsePubkeyReferences(event: NostrEvent | UnsignedNostrEvent): string[] {
  return getTagValues(event, TagTypes.PUBKEY);
}

/**
 * Get the 'd' tag value (identifier for replaceable events)
 *
 * @param event Event to get identifier from
 * @returns Identifier value or undefined
 */
export function getIdentifier(event: NostrEvent | UnsignedNostrEvent): string | undefined {
  return getTagValue(event, TagTypes.IDENTIFIER);
}

// ============================================================================
// Geohash Tag Utilities
// ============================================================================

/**
 * Geohash precision levels and their approximate dimensions
 */
export const GeohashPrecision = {
  /** ~5000km x 5000km */
  PRECISION_1: 1,
  /** ~1250km x 625km */
  PRECISION_2: 2,
  /** ~156km x 156km */
  PRECISION_3: 3,
  /** ~39km x 19.5km */
  PRECISION_4: 4,
  /** ~4.9km x 4.9km */
  PRECISION_5: 5,
  /** ~1.2km x 0.6km */
  PRECISION_6: 6,
  /** ~153m x 153m */
  PRECISION_7: 7,
  /** ~38m x 19m */
  PRECISION_8: 8,
} as const;

/**
 * BitChat default geohash precision for location channels
 * Approximately 1.2km x 0.6km area
 */
export const BITCHAT_GEOHASH_PRECISION = GeohashPrecision.PRECISION_6;

/**
 * Get all geohash tags from an event
 *
 * @param event Event to extract geohashes from
 * @returns Array of geohash strings
 */
export function getGeohashes(event: NostrEvent | UnsignedNostrEvent): string[] {
  return getTagValues(event, TagTypes.GEOHASH);
}

/**
 * Get the primary (first) geohash from an event
 *
 * @param event Event to get geohash from
 * @returns Primary geohash or undefined
 */
export function getPrimaryGeohash(event: NostrEvent | UnsignedNostrEvent): string | undefined {
  return getTagValue(event, TagTypes.GEOHASH);
}

/**
 * Check if a geohash is valid format
 *
 * @param geohash Geohash string to validate
 * @returns True if valid geohash format
 */
export function isValidGeohash(geohash: string): boolean {
  // Geohash uses base32 (0-9, b-h, j-n, p, q-z - excludes a, i, l, o)
  // Length is typically 1-12 characters
  return /^[0-9b-hjkmnp-z]{1,12}$/i.test(geohash);
}

/**
 * Get parent geohash (less precise)
 *
 * @param geohash Geohash to get parent of
 * @returns Parent geohash or undefined if already at root
 */
export function getParentGeohash(geohash: string): string | undefined {
  if (geohash.length <= 1) return undefined;
  return geohash.slice(0, -1);
}

/**
 * Get all ancestor geohashes (progressively less precise)
 *
 * @param geohash Geohash to get ancestors of
 * @returns Array of ancestor geohashes from most precise to least
 */
export function getGeohashAncestors(geohash: string): string[] {
  const ancestors: string[] = [];
  let current = getParentGeohash(geohash);

  while (current) {
    ancestors.push(current);
    current = getParentGeohash(current);
  }

  return ancestors;
}

/**
 * Build geohash tags with parent prefixes for broader discoverability
 *
 * @param geohash Primary geohash
 * @param includeAncestors Whether to include ancestor geohashes
 * @param minPrecision Minimum precision level to include
 * @returns Array of geohash tags
 */
export function buildGeohashTags(
  geohash: string,
  includeAncestors: boolean = true,
  minPrecision: number = GeohashPrecision.PRECISION_4
): string[][] {
  const tags: string[][] = [[TagTypes.GEOHASH, geohash]];

  if (includeAncestors) {
    const ancestors = getGeohashAncestors(geohash);
    for (const ancestor of ancestors) {
      if (ancestor.length >= minPrecision) {
        tags.push([TagTypes.GEOHASH, ancestor]);
      }
    }
  }

  return tags;
}

// ============================================================================
// Tag Building
// ============================================================================

/**
 * Create an event reference tag
 *
 * @param eventId Event ID to reference
 * @param relay Optional relay URL hint
 * @param marker Optional NIP-10 marker (root, reply, mention)
 * @returns Event reference tag
 */
export function createEventTag(
  eventId: string,
  relay?: string,
  marker?: ReplyMarker
): string[] {
  const tag = [TagTypes.EVENT, eventId];
  if (relay || marker) {
    tag.push(relay || '');
  }
  if (marker) {
    tag.push(marker);
  }
  return tag;
}

/**
 * Create a pubkey reference tag
 *
 * @param pubkey Pubkey to reference
 * @param relay Optional relay URL hint
 * @returns Pubkey reference tag
 */
export function createPubkeyTag(pubkey: string, relay?: string): string[] {
  const tag = [TagTypes.PUBKEY, pubkey];
  if (relay) {
    tag.push(relay);
  }
  return tag;
}

/**
 * Create a geohash tag
 *
 * @param geohash Geohash value
 * @returns Geohash tag
 */
export function createGeohashTag(geohash: string): string[] {
  return [TagTypes.GEOHASH, geohash];
}

/**
 * Create a hashtag tag
 *
 * @param hashtag Hashtag (without #)
 * @returns Hashtag tag
 */
export function createHashtagTag(hashtag: string): string[] {
  // Remove # if present
  const cleanHashtag = hashtag.replace(/^#/, '').toLowerCase();
  return [TagTypes.HASHTAG, cleanHashtag];
}

/**
 * Create an identifier tag (for replaceable events)
 *
 * @param identifier Identifier value
 * @returns Identifier tag
 */
export function createIdentifierTag(identifier: string): string[] {
  return [TagTypes.IDENTIFIER, identifier];
}

/**
 * Create a subject tag
 *
 * @param subject Subject/title text
 * @returns Subject tag
 */
export function createSubjectTag(subject: string): string[] {
  return [TagTypes.SUBJECT, subject];
}

/**
 * Create an expiration tag
 *
 * @param timestamp Unix timestamp when event expires
 * @returns Expiration tag
 */
export function createExpirationTag(timestamp: number): string[] {
  return [TagTypes.EXPIRATION, timestamp.toString()];
}

/**
 * Create a client tag (identifies the client software)
 *
 * @param clientName Client name and version
 * @returns Client tag
 */
export function createClientTag(clientName: string = 'BitChat Web'): string[] {
  return [TagTypes.CLIENT, clientName];
}

// ============================================================================
// Reply Threading Utilities
// ============================================================================

/**
 * Create reply tags for threading (NIP-10 compliant)
 *
 * @param replyToEvent Event being replied to
 * @param rootEvent Optional root event of thread (if different from replyTo)
 * @returns Array of tags for proper threading
 */
export function createReplyTags(
  replyToEvent: NostrEvent,
  rootEvent?: NostrEvent
): string[][] {
  const tags: string[][] = [];

  // If we have a root event different from reply, include it
  if (rootEvent && rootEvent.id !== replyToEvent.id) {
    tags.push(createEventTag(rootEvent.id, undefined, 'root'));
    tags.push(createEventTag(replyToEvent.id, undefined, 'reply'));
  } else {
    // The event we're replying to is the root
    tags.push(createEventTag(replyToEvent.id, undefined, 'root'));
  }

  // Include author of reply target as p tag
  tags.push(createPubkeyTag(replyToEvent.pubkey));

  // Include any other mentioned pubkeys from the parent event
  const parentPubkeys = parsePubkeyReferences(replyToEvent);
  for (const pubkey of parentPubkeys) {
    if (pubkey !== replyToEvent.pubkey) {
      tags.push(createPubkeyTag(pubkey));
    }
  }

  return tags;
}

/**
 * Create mention tag for referencing another event inline
 *
 * @param event Event to mention
 * @returns Mention tag
 */
export function createMentionTag(event: NostrEvent): string[] {
  return createEventTag(event.id, undefined, 'mention');
}

// ============================================================================
// Channel Tag Utilities
// ============================================================================

/**
 * Create tags for a location channel message
 *
 * @param geohash Location geohash
 * @param replyTo Optional event being replied to
 * @param mentions Optional pubkeys to mention
 * @returns Array of tags for location channel message
 */
export function createLocationChannelTags(
  geohash: string,
  replyTo?: NostrEvent,
  mentions?: string[]
): string[][] {
  const tags: string[][] = [];

  // Add geohash tags (primary and ancestors for discoverability)
  tags.push(...buildGeohashTags(geohash, true));

  // Add reply threading if replying to another message
  if (replyTo) {
    // Get the root of the thread if it exists
    const refs = parseEventReferences(replyTo);
    if (refs.root) {
      tags.push(createEventTag(refs.root.id, refs.root.relay, 'root'));
      tags.push(createEventTag(replyTo.id, undefined, 'reply'));
    } else {
      tags.push(createEventTag(replyTo.id, undefined, 'root'));
    }
    tags.push(createPubkeyTag(replyTo.pubkey));
  }

  // Add mentions
  if (mentions) {
    for (const pubkey of mentions) {
      if (!tags.some((t) => t[0] === TagTypes.PUBKEY && t[1] === pubkey)) {
        tags.push(createPubkeyTag(pubkey));
      }
    }
  }

  // Add client identifier
  tags.push(createClientTag());

  return tags;
}

/**
 * Create tags for a NIP-28 channel message
 *
 * @param channelId Channel event ID
 * @param replyTo Optional event being replied to within the channel
 * @returns Array of tags for channel message
 */
export function createChannelMessageTags(
  channelId: string,
  replyTo?: NostrEvent
): string[][] {
  const tags: string[][] = [];

  // Root reference to channel
  tags.push(createEventTag(channelId, undefined, 'root'));

  // Add reply threading if replying
  if (replyTo) {
    tags.push(createEventTag(replyTo.id, undefined, 'reply'));
    tags.push(createPubkeyTag(replyTo.pubkey));
  }

  return tags;
}

// ============================================================================
// Tag Manipulation
// ============================================================================

/**
 * Add a tag to an event's tags array (immutably)
 *
 * @param event Event to add tag to
 * @param tag Tag to add
 * @returns New event with added tag
 */
export function addTag<T extends NostrEvent | UnsignedNostrEvent>(
  event: T,
  tag: string[]
): T {
  return {
    ...event,
    tags: [...event.tags, tag],
  };
}

/**
 * Remove tags by type from an event (immutably)
 *
 * @param event Event to remove tags from
 * @param tagType Tag type to remove
 * @returns New event with tags removed
 */
export function removeTagsByType<T extends NostrEvent | UnsignedNostrEvent>(
  event: T,
  tagType: string
): T {
  return {
    ...event,
    tags: event.tags.filter((tag) => tag[0] !== tagType),
  };
}

/**
 * Replace all tags of a type (immutably)
 *
 * @param event Event to modify
 * @param tagType Tag type to replace
 * @param newTags New tags to add
 * @returns New event with replaced tags
 */
export function replaceTagsByType<T extends NostrEvent | UnsignedNostrEvent>(
  event: T,
  tagType: string,
  newTags: string[][]
): T {
  const filteredTags = event.tags.filter((tag) => tag[0] !== tagType);
  return {
    ...event,
    tags: [...filteredTags, ...newTags],
  };
}

/**
 * Deduplicate tags (remove duplicates)
 *
 * @param tags Tags array to deduplicate
 * @returns Deduplicated tags array
 */
export function deduplicateTags(tags: string[][]): string[][] {
  const seen = new Set<string>();
  const result: string[][] = [];

  for (const tag of tags) {
    const key = JSON.stringify(tag);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(tag);
    }
  }

  return result;
}

/**
 * Extract hashtags from text content
 *
 * @param content Text content to extract hashtags from
 * @returns Array of hashtag tags
 */
export function extractHashtags(content: string): string[][] {
  const hashtagRegex = /#(\w+)/g;
  const matches = content.matchAll(hashtagRegex);
  const tags: string[][] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const hashtag = match[1].toLowerCase();
    if (!seen.has(hashtag)) {
      seen.add(hashtag);
      tags.push(createHashtagTag(hashtag));
    }
  }

  return tags;
}

/**
 * Extract mentioned pubkeys from content (nostr:npub... format)
 *
 * @param content Text content to extract mentions from
 * @returns Array of pubkey strings (hex)
 */
export function extractMentions(content: string): string[] {
  // Match nostr:npub1... format
  const npubRegex = /nostr:(npub1[a-z0-9]+)/gi;
  const matches = content.matchAll(npubRegex);
  const pubkeys: string[] = [];

  for (const match of matches) {
    // Note: Would need nip19 decode to convert npub to hex
    // For now, just extract the npub format
    pubkeys.push(match[1]);
  }

  return pubkeys;
}
