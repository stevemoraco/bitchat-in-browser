/**
 * Nostr Protocol Type Definitions
 *
 * Types for the Nostr protocol as used by BitChat PWA.
 * Based on NIP-01 and other relevant NIPs.
 *
 * @see https://github.com/nostr-protocol/nips
 * @module types/nostr
 */

/**
 * Nostr event structure matching NIP-01.
 * Events are the fundamental data structure in Nostr.
 */
export interface NostrEvent {
  /**
   * 32-byte lowercase hex-encoded SHA256 of the serialized event data.
   */
  id: string;

  /**
   * 32-byte lowercase hex-encoded public key of the event creator.
   */
  pubkey: string;

  /**
   * Unix timestamp in seconds.
   */
  created_at: number;

  /**
   * Event kind (determines how the event should be processed).
   */
  kind: number;

  /**
   * Array of arrays containing tag data.
   * Each tag is an array where the first element is the tag type.
   */
  tags: string[][];

  /**
   * Arbitrary string content.
   * May be JSON for certain event kinds.
   */
  content: string;

  /**
   * 64-byte lowercase hex signature of the SHA256 hash of the serialized event data.
   */
  sig: string;
}

/**
 * Unsigned Nostr event (before signing).
 * Used when creating new events.
 */
export interface UnsignedNostrEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

/**
 * Common Nostr event kinds.
 * Includes standard kinds and BitChat-specific kinds.
 */
export enum EventKind {
  /** User metadata (NIP-01) */
  Metadata = 0,
  /** Short text note (NIP-01) */
  TextNote = 1,
  /** Recommend relay (NIP-01, deprecated) */
  RecommendRelay = 2,
  /** Contact list (NIP-02) */
  Contacts = 3,
  /** Encrypted direct message (NIP-04, legacy) */
  EncryptedDirectMessage = 4,
  /** Event deletion (NIP-09) */
  EventDeletion = 5,
  /** Repost (NIP-18) */
  Repost = 6,
  /** Reaction (NIP-25) */
  Reaction = 7,
  /** Badge award (NIP-58) */
  BadgeAward = 8,
  /** Seal for gift wrap (NIP-59) */
  Seal = 13,
  /** Direct message (NIP-17) */
  DirectMessage = 14,
  /** Generic repost (NIP-18) */
  GenericRepost = 16,
  /** Channel creation (NIP-28) */
  ChannelCreation = 40,
  /** Channel metadata (NIP-28) */
  ChannelMetadata = 41,
  /** Channel message (NIP-28) */
  ChannelMessage = 42,
  /** Hide channel message (NIP-28) */
  ChannelHideMessage = 43,
  /** Mute channel user (NIP-28) */
  ChannelMuteUser = 44,
  /** Gift wrap (NIP-59) */
  GiftWrap = 1059,
  /** File metadata (NIP-94) */
  FileMetadata = 1063,
  /** Live chat message (NIP-53) */
  LiveChatMessage = 1311,
  /** Report (NIP-56) */
  Report = 1984,
  /** Label (NIP-32) */
  Label = 1985,
  /** Zap request (NIP-57) */
  ZapRequest = 9734,
  /** Zap receipt (NIP-57) */
  Zap = 9735,
  /** Relay list metadata (NIP-65) */
  RelayList = 10002,
  /** Client authentication (NIP-42) */
  ClientAuthentication = 22242,
  /** Nostr Connect (NIP-46) */
  NostrConnect = 24133,
  /** Profile badges (NIP-58) */
  ProfileBadges = 30008,
  /** Badge definition (NIP-58) */
  BadgeDefinition = 30009,

  // BitChat-specific ephemeral event kinds (20000-29999)
  /** Location channel message (ephemeral) */
  LocationChannelMessage = 20000,
  /** Ephemeral event range start */
  EphemeralEventStart = 20000,
  /** Ephemeral event range end */
  EphemeralEventEnd = 29999,
}

/**
 * Check if an event kind is ephemeral (not stored by relays).
 */
export function isEphemeralKind(kind: number): boolean {
  return kind >= 20000 && kind < 30000;
}

/**
 * Check if an event kind is replaceable.
 */
export function isReplaceableKind(kind: number): boolean {
  return kind === 0 || kind === 3 || (kind >= 10000 && kind < 20000);
}

/**
 * Check if an event kind is parameterized replaceable.
 */
export function isParameterizedReplaceableKind(kind: number): boolean {
  return kind >= 30000 && kind < 40000;
}

/**
 * Nostr filter for subscriptions.
 * Used to request events matching specific criteria.
 */
export interface NostrFilter {
  /** List of event IDs */
  ids?: string[];
  /** List of pubkeys (authors) */
  authors?: string[];
  /** List of event kinds */
  kinds?: number[];
  /** Events created after this timestamp (inclusive) */
  since?: number;
  /** Events created before this timestamp (exclusive) */
  until?: number;
  /** Maximum number of events to return */
  limit?: number;
  /** Tag filters: #e (event refs), #p (pubkey refs), #g (geohash), etc. */
  [key: `#${string}`]: string[] | undefined;
}

/**
 * Relay connection states.
 */
export type RelayConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticating'
  | 'error';

/**
 * Relay status information.
 */
export interface RelayStatus {
  /** The relay URL (wss://) */
  url: string;
  /** Current connection state */
  state: RelayConnectionState;
  /** Whether the relay is currently connected */
  isConnected: boolean;
  /** Last error that occurred */
  lastError?: string;
  /** Timestamp of last successful connection */
  lastConnectedAt?: number;
  /** Timestamp of last disconnection */
  lastDisconnectedAt?: number;
  /** Number of reconnection attempts since last success */
  reconnectAttempts: number;
  /** Next scheduled reconnection time */
  nextReconnectTime?: number;
  /** Number of messages sent to this relay */
  messagesSent: number;
  /** Number of messages received from this relay */
  messagesReceived: number;
  /** Relay latency in milliseconds */
  latencyMs?: number;
  /** Whether the relay supports NIP-42 AUTH */
  supportsAuth?: boolean;
}

/**
 * Relay message types (from relay to client).
 * Per NIP-01 and related NIPs.
 */
export type RelayMessage =
  | ['EVENT', string, NostrEvent] // subscription_id, event
  | ['OK', string, boolean, string] // event_id, success, message
  | ['EOSE', string] // subscription_id (End of Stored Events)
  | ['CLOSED', string, string] // subscription_id, message
  | ['NOTICE', string] // message
  | ['AUTH', string] // challenge (NIP-42)
  | ['COUNT', string, { count: number }]; // subscription_id, count (NIP-45)

/**
 * Client message types (from client to relay).
 */
export type ClientMessage =
  | ['EVENT', NostrEvent]
  | ['REQ', string, ...NostrFilter[]] // subscription_id, filters
  | ['CLOSE', string] // subscription_id
  | ['AUTH', NostrEvent] // signed auth event (NIP-42)
  | ['COUNT', string, ...NostrFilter[]]; // subscription_id, filters (NIP-45)

/**
 * Subscription options.
 */
export interface SubscriptionOptions {
  /** Unique subscription ID (auto-generated if not provided) */
  id?: string;
  /** Specific relay URLs to use */
  relayUrls?: string[];
  /** Callback when EOSE is received from all relays */
  onEose?: () => void;
  /** Callback when subscription is closed */
  onClose?: (reason?: string) => void;
  /** Whether to skip EOSE tracking */
  skipEose?: boolean;
  /** Timeout for waiting for events (ms) */
  timeout?: number;
}

/**
 * Active subscription handle.
 */
export interface Subscription {
  /** Subscription ID */
  id: string;
  /** Filters used in this subscription */
  filters: NostrFilter[];
  /** Relay URLs this subscription is active on */
  relayUrls: string[];
  /** Close this subscription */
  close: () => void;
  /** Whether EOSE has been received */
  eoseReceived: boolean;
}

/**
 * Event publish result.
 */
export interface PublishResult {
  /** The event that was published */
  event: NostrEvent;
  /** Results per relay */
  relayResults: Map<string, RelayPublishResult>;
  /** Whether the event was accepted by at least one relay */
  success: boolean;
  /** Overall error message if all relays rejected */
  error?: string;
}

/**
 * Publish result for a single relay.
 */
export interface RelayPublishResult {
  /** Whether the relay accepted the event */
  success: boolean;
  /** Message from relay */
  message?: string;
  /** Timestamp when result was received */
  timestamp: number;
}

/**
 * Event handler callback type.
 */
export type EventHandler = (event: NostrEvent, relayUrl: string) => void;

/**
 * Queued event for offline outbox.
 */
export interface QueuedEvent {
  /** The event to send */
  event: NostrEvent;
  /** Target relay URLs */
  relayUrls: string[];
  /** When the event was queued */
  queuedAt: number;
  /** Number of send attempts */
  attempts: number;
  /** Last attempt timestamp */
  lastAttemptAt?: number;
  /** Maximum attempts before giving up */
  maxAttempts: number;
  /** Error from last attempt */
  lastError?: string;
}

/**
 * Relay configuration for connection.
 */
export interface RelayConfig {
  /** Relay URL (wss://) */
  url: string;
  /** Whether to read from this relay */
  read: boolean;
  /** Whether to write to this relay */
  write: boolean;
  /** Connection priority (higher = prefer) */
  priority?: number;
  /** Whether this is a paid relay */
  isPaid?: boolean;
}

/**
 * NIP-05 verification result.
 */
export interface Nip05Result {
  /** Whether verification succeeded */
  valid: boolean;
  /** The verified pubkey */
  pubkey?: string;
  /** Recommended relays from the NIP-05 response */
  relays?: string[];
  /** Error message if verification failed */
  error?: string;
}

/**
 * User metadata from kind 0 events.
 */
export interface NostrMetadata {
  /** Display name */
  name?: string;
  /** About/bio text */
  about?: string;
  /** Profile picture URL */
  picture?: string;
  /** NIP-05 identifier */
  nip05?: string;
  /** Lightning address */
  lud16?: string;
  /** Lightning URL */
  lud06?: string;
  /** Banner image URL */
  banner?: string;
  /** Website URL */
  website?: string;
}

/**
 * Contact from kind 3 events.
 */
export interface NostrContact {
  /** Contact's pubkey */
  pubkey: string;
  /** Relay URL hint */
  relay?: string;
  /** Petname for the contact */
  petname?: string;
}

/**
 * Tag types commonly used in Nostr events.
 */
export type NostrTag =
  | ['e', string, string?, string?] // event reference: id, relay?, marker?
  | ['p', string, string?, string?] // pubkey reference: pubkey, relay?, petname?
  | ['g', string] // geohash
  | ['t', string] // hashtag
  | ['r', string, string?] // reference: url, petname?
  | ['a', string, string?] // parameterized replaceable event: kind:pubkey:d-tag, relay?
  | ['d', string] // identifier for replaceable events
  | ['nonce', string, string] // PoW nonce: nonce, target
  | ['expiration', string] // NIP-40 expiration timestamp
  | ['subject', string] // NIP-14 subject
  | ['client', string] // client identifier
  | string[]; // other tags

/**
 * Helper to get tag value by name.
 */
export function getTagValue(tags: string[][], tagName: string): string | undefined {
  const tag = tags.find(t => t[0] === tagName);
  return tag?.[1];
}

/**
 * Helper to get all tag values by name.
 */
export function getTagValues(tags: string[][], tagName: string): string[] {
  return tags
    .filter(t => t[0] === tagName)
    .map(t => t[1])
    .filter((v): v is string => v !== undefined);
}

/**
 * Helper to create a subscription filter for a geohash channel.
 */
export function createGeohashFilter(
  geohash: string,
  options?: { since?: number; limit?: number }
): NostrFilter {
  return {
    kinds: [EventKind.LocationChannelMessage],
    '#g': [geohash],
    since: options?.since,
    limit: options?.limit ?? 100,
  };
}

/**
 * Helper to create a subscription filter for DMs.
 */
export function createDMFilter(
  ourPubkey: string,
  options?: { since?: number; limit?: number }
): NostrFilter[] {
  return [
    // Messages sent to us
    {
      kinds: [EventKind.GiftWrap],
      '#p': [ourPubkey],
      since: options?.since,
      limit: options?.limit ?? 100,
    },
    // Messages we sent (to verify delivery)
    {
      kinds: [EventKind.GiftWrap],
      authors: [ourPubkey],
      since: options?.since,
      limit: options?.limit ?? 100,
    },
  ];
}
