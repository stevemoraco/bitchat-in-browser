/**
 * Nostr Protocol Types
 * Based on NIP-01 specification
 * @see https://github.com/nostr-protocol/nips/blob/master/01.md
 */

/**
 * Nostr Event structure matching NIP-01
 * Events are the fundamental building block of Nostr
 */
export interface NostrEvent {
  /** 32-bytes lowercase hex-encoded sha256 of the serialized event data */
  id: string;
  /** 32-bytes lowercase hex-encoded public key of the event creator */
  pubkey: string;
  /** Unix timestamp in seconds */
  created_at: number;
  /** Event kind (determines how the event should be processed) */
  kind: number;
  /** Array of arrays containing tag data */
  tags: string[][];
  /** Arbitrary string content */
  content: string;
  /** 64-bytes lowercase hex of the signature of the sha256 hash of the serialized event data */
  sig: string;
}

/**
 * Unsigned Nostr Event (before signing)
 * Used when creating new events before the id and sig are computed
 */
export interface UnsignedNostrEvent {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}

/**
 * Nostr Filter for subscriptions
 * Used to request events matching specific criteria
 */
export interface NostrFilter {
  /** List of event ids */
  ids?: string[];
  /** List of pubkeys (authors) */
  authors?: string[];
  /** List of event kinds */
  kinds?: number[];
  /** Events created after this timestamp */
  since?: number;
  /** Events created before this timestamp */
  until?: number;
  /** Maximum number of events to return */
  limit?: number;
  /** Tag filters: #e, #p, #g, etc. */
  [key: `#${string}`]: string[] | undefined;
}

/**
 * Common Nostr event kinds
 */
export enum NostrEventKind {
  Metadata = 0,
  TextNote = 1,
  RecommendRelay = 2,
  Contacts = 3,
  EncryptedDirectMessage = 4,
  EventDeletion = 5,
  Repost = 6,
  Reaction = 7,
  BadgeAward = 8,
  Seal = 13,
  DirectMessage = 14,
  GenericRepost = 16,
  ChannelCreation = 40,
  ChannelMetadata = 41,
  ChannelMessage = 42,
  ChannelHideMessage = 43,
  ChannelMuteUser = 44,
  GiftWrap = 1059,
  FileMetadata = 1063,
  LiveChatMessage = 1311,
  Report = 1984,
  Label = 1985,
  ZapRequest = 9734,
  Zap = 9735,
  RelayList = 10002,
  ClientAuthentication = 22242,
  NostrConnect = 24133,
  ProfileBadges = 30008,
  BadgeDefinition = 30009,
  EphemeralEvent = 20000, // Used for location channels
  EphemeralEventMax = 29999,
}

/**
 * Connection status for a relay
 */
export type RelayConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Detailed relay status information
 */
export interface RelayStatus {
  /** The relay URL */
  url: string;
  /** Current connection state */
  state: RelayConnectionState;
  /** Whether the relay is currently connected */
  isConnected: boolean;
  /** Last error that occurred */
  lastError?: Error | string;
  /** Timestamp of last successful connection */
  lastConnectedAt?: number;
  /** Timestamp of last disconnection */
  lastDisconnectedAt?: number;
  /** Number of reconnection attempts since last successful connection */
  reconnectAttempts: number;
  /** Next scheduled reconnection time (Unix timestamp) */
  nextReconnectTime?: number;
  /** Number of messages sent to this relay */
  messagesSent: number;
  /** Number of messages received from this relay */
  messagesReceived: number;
}

/**
 * Options for creating a subscription
 */
export interface SubscriptionOptions {
  /** Unique identifier for the subscription */
  id?: string;
  /** Specific relay URLs to subscribe to (uses all connected relays if not specified) */
  relayUrls?: string[];
  /** Callback when End of Stored Events is received from all relays */
  onEose?: () => void;
  /** Callback when subscription is closed */
  onClose?: (reason?: string) => void;
  /** Whether to skip EOSE tracking */
  skipEose?: boolean;
}

/**
 * Active subscription handle
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
}

/**
 * Relay message types (from relay to client)
 */
export type RelayMessage =
  | ['EVENT', string, NostrEvent]
  | ['OK', string, boolean, string]
  | ['EOSE', string]
  | ['CLOSED', string, string]
  | ['NOTICE', string]
  | ['AUTH', string];

/**
 * Client message types (from client to relay)
 */
export type ClientMessage =
  | ['EVENT', NostrEvent]
  | ['REQ', string, ...NostrFilter[]]
  | ['CLOSE', string]
  | ['AUTH', NostrEvent];

/**
 * Publish result for an event
 */
export interface PublishResult {
  /** The event that was published */
  event: NostrEvent;
  /** Results per relay */
  relayResults: Map<string, RelayPublishResult>;
  /** Whether the event was accepted by at least one relay */
  success: boolean;
}

/**
 * Publish result for a single relay
 */
export interface RelayPublishResult {
  /** Whether the relay accepted the event */
  success: boolean;
  /** Message from relay (reason for rejection if failed) */
  message?: string;
}

/**
 * Event handler callback type
 */
export type EventHandler = (event: NostrEvent, relayUrl: string) => void;

/**
 * Queued event for offline outbox
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
}
