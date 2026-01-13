/**
 * SQLite Database Schema
 *
 * Defines the complete database schema for BitChat In Browser PWA.
 * Designed for offline-first operation with sync support.
 *
 * Features:
 * - Complete table definitions for all BitChat data
 * - Migration system with version tracking
 * - Indexes for common query patterns
 * - Type-safe column definitions
 *
 * @module storage/schema
 */

// ============================================
// Message Status Enum
// ============================================

/**
 * Status of a message in the send/receive pipeline.
 */
export type MessageStatus =
  | 'pending'     // Created locally, not yet sent
  | 'sending'     // Currently being transmitted
  | 'sent'        // Successfully sent to relay/peer
  | 'delivered'   // Confirmed delivered to recipient
  | 'failed'      // Failed to send (will retry)
  | 'received';   // Received from remote

/**
 * Type of channel.
 */
export type ChannelType =
  | 'location'    // Geohash-based location channel
  | 'dm'          // Direct message (NIP-17)
  | 'group';      // Group channel (future)

/**
 * Trust level for a peer.
 */
export type TrustLevel =
  | 'unknown'     // Never interacted
  | 'seen'        // Have seen messages from
  | 'contacted'   // Have exchanged messages
  | 'trusted'     // Manually marked trusted
  | 'blocked';    // Blocked by user

/**
 * Type of pending action for the outbox.
 */
export type PendingActionType =
  | 'send_message'      // Message to be sent
  | 'publish_event'     // Nostr event to publish
  | 'sync_identity'     // Identity sync to relay
  | 'ack_message';      // Acknowledge receipt

// ============================================
// Table Row Types
// ============================================

/**
 * A chat message.
 */
export interface MessageRow {
  /** Unique message ID (ulid or uuid) */
  id: string;
  /** Plain text content */
  content: string;
  /** Sender public key (hex) */
  sender: string;
  /** Channel this message belongs to */
  channel_id: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** Current status in the pipeline */
  status: MessageStatus;
  /** Encrypted content (for storage) */
  encrypted_content: string | null;
  /** Reply to message ID (if any) */
  reply_to: string | null;
  /** When the message was created locally */
  created_at: number;
  /** When the message was last updated */
  updated_at: number;
}

/**
 * A channel (location-based or DM).
 */
export interface ChannelRow {
  /** Unique channel ID */
  id: string;
  /** Type of channel */
  type: ChannelType;
  /** Display name */
  name: string;
  /** Geohash for location channels (null for DMs) */
  geohash: string | null;
  /** When the channel was created */
  created_at: number;
  /** Timestamp of last message activity */
  last_message_at: number | null;
  /** Unread message count */
  unread_count: number;
  /** Whether notifications are muted */
  is_muted: boolean;
}

/**
 * A known peer/contact.
 */
export interface PeerRow {
  /** Public key (hex) - primary identifier */
  pubkey: string;
  /** User-assigned nickname */
  nickname: string | null;
  /** Fingerprint for verification */
  fingerprint: string | null;
  /** Last time we saw this peer */
  last_seen: number | null;
  /** Trust level */
  trust_level: TrustLevel;
  /** Profile metadata (JSON) */
  metadata: string | null;
  /** When we first learned about this peer */
  created_at: number;
  /** Last update */
  updated_at: number;
}

/**
 * A user identity (keypair).
 */
export interface IdentityRow {
  /** Unique identity ID */
  id: string;
  /** Public key (hex) */
  pubkey: string;
  /** Encrypted private key */
  privkey_encrypted: string;
  /** When the identity was created */
  created_at: number;
  /** Whether this is the primary identity */
  is_primary: boolean;
  /** Human-readable label */
  label: string | null;
  /** Derivation path (if HD) */
  derivation_path: string | null;
}

/**
 * A Nostr event (cached).
 */
export interface NostrEventRow {
  /** Event ID (hex hash) */
  id: string;
  /** Event kind number */
  kind: number;
  /** Author public key (hex) */
  pubkey: string;
  /** Event content */
  content: string;
  /** Tags (JSON array) */
  tags: string;
  /** Signature (hex) */
  sig: string;
  /** Event created_at timestamp (seconds) */
  created_at: number;
  /** When we received this event (milliseconds) */
  received_at: number;
  /** Whether this event has been processed */
  is_processed: boolean;
}

/**
 * Relay connection status.
 */
export interface RelayStatusRow {
  /** Relay URL (primary key) */
  url: string;
  /** Whether currently connected */
  connected: boolean;
  /** Last successful connection time */
  last_connected: number | null;
  /** Number of messages sent through this relay */
  message_count: number;
  /** Number of failed connection attempts */
  failure_count: number;
  /** Last error message */
  last_error: string | null;
  /** Last update */
  updated_at: number;
}

/**
 * A pending action (outbox item).
 */
export interface PendingActionRow {
  /** Unique action ID */
  id: string;
  /** Type of action */
  action_type: PendingActionType;
  /** Action payload (JSON) */
  payload: string;
  /** When the action was created */
  created_at: number;
  /** Number of retry attempts */
  retry_count: number;
  /** Next retry time (null if not scheduled) */
  next_retry_at: number | null;
  /** Last error (if any) */
  last_error: string | null;
  /** Priority (higher = more urgent) */
  priority: number;
}

// ============================================
// SQL Table Definitions
// ============================================

/**
 * SQL statement to create the messages table.
 */
export const CREATE_MESSAGES_TABLE = `
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    content TEXT NOT NULL,
    sender TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    encrypted_content TEXT,
    reply_to TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

/**
 * SQL statement to create the channels table.
 */
export const CREATE_CHANNELS_TABLE = `
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    geohash TEXT,
    created_at INTEGER NOT NULL,
    last_message_at INTEGER,
    unread_count INTEGER NOT NULL DEFAULT 0,
    is_muted INTEGER NOT NULL DEFAULT 0
  )
`;

/**
 * SQL statement to create the peers table.
 */
export const CREATE_PEERS_TABLE = `
  CREATE TABLE IF NOT EXISTS peers (
    pubkey TEXT PRIMARY KEY NOT NULL,
    nickname TEXT,
    fingerprint TEXT,
    last_seen INTEGER,
    trust_level TEXT NOT NULL DEFAULT 'unknown',
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`;

/**
 * SQL statement to create the identities table.
 */
export const CREATE_IDENTITIES_TABLE = `
  CREATE TABLE IF NOT EXISTS identities (
    id TEXT PRIMARY KEY NOT NULL,
    pubkey TEXT NOT NULL UNIQUE,
    privkey_encrypted TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    is_primary INTEGER NOT NULL DEFAULT 0,
    label TEXT,
    derivation_path TEXT
  )
`;

/**
 * SQL statement to create the nostr_events table.
 */
export const CREATE_NOSTR_EVENTS_TABLE = `
  CREATE TABLE IF NOT EXISTS nostr_events (
    id TEXT PRIMARY KEY NOT NULL,
    kind INTEGER NOT NULL,
    pubkey TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT NOT NULL,
    sig TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    received_at INTEGER NOT NULL,
    is_processed INTEGER NOT NULL DEFAULT 0
  )
`;

/**
 * SQL statement to create the relay_status table.
 */
export const CREATE_RELAY_STATUS_TABLE = `
  CREATE TABLE IF NOT EXISTS relay_status (
    url TEXT PRIMARY KEY NOT NULL,
    connected INTEGER NOT NULL DEFAULT 0,
    last_connected INTEGER,
    message_count INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at INTEGER NOT NULL
  )
`;

/**
 * SQL statement to create the pending_actions table.
 */
export const CREATE_PENDING_ACTIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS pending_actions (
    id TEXT PRIMARY KEY NOT NULL,
    action_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at INTEGER,
    last_error TEXT,
    priority INTEGER NOT NULL DEFAULT 0
  )
`;

/**
 * SQL statement to create the schema_migrations table.
 */
export const CREATE_SCHEMA_MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    applied_at INTEGER NOT NULL
  )
`;

// ============================================
// Index Definitions
// ============================================

/**
 * Indexes for the messages table.
 */
export const MESSAGES_INDEXES = [
  // Query messages by channel (most common)
  'CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id)',
  // Query messages by channel sorted by timestamp
  'CREATE INDEX IF NOT EXISTS idx_messages_channel_timestamp ON messages(channel_id, timestamp DESC)',
  // Query messages by timestamp (for recent messages)
  'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC)',
  // Query messages by sender
  'CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender)',
  // Query messages by status (for outbox)
  'CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)',
];

/**
 * Indexes for the channels table.
 */
export const CHANNELS_INDEXES = [
  // Query channels by type
  'CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type)',
  // Query channels by geohash prefix (for location queries)
  'CREATE INDEX IF NOT EXISTS idx_channels_geohash ON channels(geohash)',
  // Query channels sorted by last activity
  'CREATE INDEX IF NOT EXISTS idx_channels_last_message ON channels(last_message_at DESC)',
];

/**
 * Indexes for the peers table.
 */
export const PEERS_INDEXES = [
  // Query peers by trust level
  'CREATE INDEX IF NOT EXISTS idx_peers_trust_level ON peers(trust_level)',
  // Query peers by last seen
  'CREATE INDEX IF NOT EXISTS idx_peers_last_seen ON peers(last_seen DESC)',
];

/**
 * Indexes for the identities table.
 */
export const IDENTITIES_INDEXES = [
  // Query primary identity
  'CREATE INDEX IF NOT EXISTS idx_identities_is_primary ON identities(is_primary)',
];

/**
 * Indexes for the nostr_events table.
 */
export const NOSTR_EVENTS_INDEXES = [
  // Query events by kind (most common)
  'CREATE INDEX IF NOT EXISTS idx_nostr_events_kind ON nostr_events(kind)',
  // Query events by pubkey
  'CREATE INDEX IF NOT EXISTS idx_nostr_events_pubkey ON nostr_events(pubkey)',
  // Query events by kind and pubkey combined
  'CREATE INDEX IF NOT EXISTS idx_nostr_events_kind_pubkey ON nostr_events(kind, pubkey)',
  // Query events by created_at (for ordering)
  'CREATE INDEX IF NOT EXISTS idx_nostr_events_created_at ON nostr_events(created_at DESC)',
  // Query unprocessed events
  'CREATE INDEX IF NOT EXISTS idx_nostr_events_is_processed ON nostr_events(is_processed)',
  // Query recent events by kind
  'CREATE INDEX IF NOT EXISTS idx_nostr_events_kind_created ON nostr_events(kind, created_at DESC)',
];

/**
 * Indexes for the relay_status table.
 */
export const RELAY_STATUS_INDEXES = [
  // Query connected relays
  'CREATE INDEX IF NOT EXISTS idx_relay_status_connected ON relay_status(connected)',
];

/**
 * Indexes for the pending_actions table.
 */
export const PENDING_ACTIONS_INDEXES = [
  // Query actions by type
  'CREATE INDEX IF NOT EXISTS idx_pending_actions_type ON pending_actions(action_type)',
  // Query actions ready for retry
  'CREATE INDEX IF NOT EXISTS idx_pending_actions_next_retry ON pending_actions(next_retry_at)',
  // Query actions by priority
  'CREATE INDEX IF NOT EXISTS idx_pending_actions_priority ON pending_actions(priority DESC, created_at ASC)',
];

// ============================================
// All Tables and Indexes
// ============================================

/**
 * All table creation statements in order.
 */
export const ALL_TABLE_STATEMENTS = [
  CREATE_SCHEMA_MIGRATIONS_TABLE,
  CREATE_MESSAGES_TABLE,
  CREATE_CHANNELS_TABLE,
  CREATE_PEERS_TABLE,
  CREATE_IDENTITIES_TABLE,
  CREATE_NOSTR_EVENTS_TABLE,
  CREATE_RELAY_STATUS_TABLE,
  CREATE_PENDING_ACTIONS_TABLE,
];

/**
 * All index creation statements.
 */
export const ALL_INDEX_STATEMENTS = [
  ...MESSAGES_INDEXES,
  ...CHANNELS_INDEXES,
  ...PEERS_INDEXES,
  ...IDENTITIES_INDEXES,
  ...NOSTR_EVENTS_INDEXES,
  ...RELAY_STATUS_INDEXES,
  ...PENDING_ACTIONS_INDEXES,
];

// ============================================
// Migration Types
// ============================================

/**
 * A database migration.
 */
export interface Migration {
  /** Migration version number (must be unique and sequential) */
  version: number;
  /** Human-readable name */
  name: string;
  /**
   * Apply the migration (upgrade).
   * @param db - Function to execute SQL statements
   */
  up: (exec: (sql: string, params?: unknown[]) => Promise<void>) => Promise<void>;
  /**
   * Revert the migration (downgrade).
   * @param db - Function to execute SQL statements
   */
  down: (exec: (sql: string, params?: unknown[]) => Promise<void>) => Promise<void>;
}

/**
 * Record of an applied migration.
 */
export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: number;
}

/**
 * Result of running migrations.
 */
export interface MigrationResult {
  /** Whether migrations were successful */
  success: boolean;
  /** Migrations that were applied */
  applied: MigrationRecord[];
  /** Current schema version after migrations */
  currentVersion: number;
  /** Any error that occurred */
  error?: string;
}

// ============================================
// Schema Version
// ============================================

/**
 * Current schema version.
 * Increment this when adding new migrations.
 */
export const SCHEMA_VERSION = 1;

/**
 * Database name.
 */
export const DATABASE_NAME = 'bitchat.db';

// ============================================
// Helper Functions
// ============================================

/**
 * Generate a unique ID for new records.
 * Uses timestamp-based ULID format for sortability.
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}${randomPart}`;
}

/**
 * Get current timestamp in milliseconds.
 */
export function now(): number {
  return Date.now();
}

/**
 * Validate a message status value.
 */
export function isValidMessageStatus(status: string): status is MessageStatus {
  return ['pending', 'sending', 'sent', 'delivered', 'failed', 'received'].includes(status);
}

/**
 * Validate a channel type value.
 */
export function isValidChannelType(type: string): type is ChannelType {
  return ['location', 'dm', 'group'].includes(type);
}

/**
 * Validate a trust level value.
 */
export function isValidTrustLevel(level: string): level is TrustLevel {
  return ['unknown', 'seen', 'contacted', 'trusted', 'blocked'].includes(level);
}

/**
 * Validate a pending action type value.
 */
export function isValidPendingActionType(type: string): type is PendingActionType {
  return ['send_message', 'publish_event', 'sync_identity', 'ack_message'].includes(type);
}
