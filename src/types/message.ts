/**
 * Message Type Definitions
 *
 * Core types for chat messages in BitChat PWA.
 * These types are designed to be compatible with the native BitChat iOS/Android apps.
 *
 * @module types/message
 */

/**
 * Message delivery/read status enumeration.
 * Tracks the lifecycle of a message from creation to read confirmation.
 */
export enum MessageStatus {
  /** Message is being prepared or queued locally */
  Pending = 'pending',
  /** Message has been sent but not yet confirmed by recipient */
  Sent = 'sent',
  /** Message has been delivered to the recipient's device */
  Delivered = 'delivered',
  /** Message has been read by the recipient */
  Read = 'read',
  /** Message failed to send */
  Failed = 'failed',
}

/**
 * Message type classification.
 * Determines how the message content should be displayed.
 */
export enum MessageType {
  /** Standard text message */
  Text = 'text',
  /** System-generated message (join/leave notifications, etc.) */
  System = 'system',
  /** Action message (e.g., /me commands) */
  Action = 'action',
}

/**
 * Delivery status details with additional context.
 * Provides rich information about message delivery state.
 * Matches native BitChat's DeliveryStatus enum.
 */
export type DeliveryStatusInfo =
  | { status: MessageStatus.Pending }
  | { status: MessageStatus.Sent }
  | { status: MessageStatus.Delivered; to: string; at: number }
  | { status: MessageStatus.Read; by: string; at: number }
  | { status: MessageStatus.Failed; reason: string }
  | { status: 'partiallyDelivered'; reached: number; total: number };

/**
 * Core message interface representing a chat message.
 * Compatible with BitchatMessage from native iOS/Android apps.
 */
export interface Message {
  /**
   * Unique message identifier.
   * Either a Nostr event ID (for synced messages) or a local UUID.
   */
  id: string;

  /**
   * Channel ID this message belongs to.
   * Can be a location channel geohash, DM identifier, or special channel ID.
   */
  channelId: string;

  /**
   * Message content/body.
   * Plain text content of the message.
   */
  content: string;

  /**
   * Sender's public key fingerprint.
   * SHA-256 hash of the sender's Noise static public key (first 8 chars).
   */
  senderFingerprint: string;

  /**
   * Sender's display nickname at the time of sending.
   * This is cached to preserve historical accuracy.
   */
  senderNickname: string;

  /**
   * Unix timestamp in milliseconds when the message was created.
   */
  timestamp: number;

  /**
   * Message type classification.
   */
  type: MessageType;

  /**
   * Current delivery/read status.
   */
  status: MessageStatus;

  /**
   * Whether this message was sent by the local user.
   */
  isOwn: boolean;

  /**
   * Whether this message has been read by the local user.
   */
  isRead: boolean;

  /**
   * Whether this is a relayed message (forwarded by another peer).
   * Used in mesh network scenarios.
   */
  isRelay?: boolean;

  /**
   * Original sender's nickname if this message was relayed.
   */
  originalSender?: string;

  /**
   * Whether this is a private/encrypted message.
   */
  isPrivate?: boolean;

  /**
   * Recipient's nickname for private messages.
   */
  recipientNickname?: string;

  /**
   * Nostr event ID if the message has been synced to relays.
   */
  nostrEventId?: string;

  /**
   * Array of mentioned user fingerprints.
   * Used for @mention notifications and highlighting.
   */
  mentions?: string[];

  /**
   * Detailed delivery status with context.
   */
  deliveryInfo?: DeliveryStatusInfo;
}

/**
 * Encrypted message payload.
 * Contains the encrypted content and metadata needed for decryption.
 */
export interface EncryptedMessage {
  /**
   * Unique identifier for the encrypted message.
   */
  id: string;

  /**
   * Encrypted ciphertext as base64 or hex string.
   */
  ciphertext: string;

  /**
   * Nonce/IV used for encryption (base64 or hex).
   */
  nonce: string;

  /**
   * Sender's public key (hex-encoded).
   */
  senderPubkey: string;

  /**
   * Recipient's public key (hex-encoded).
   * Used for DM routing.
   */
  recipientPubkey?: string;

  /**
   * Encryption algorithm identifier.
   */
  algorithm: 'xchacha20-poly1305' | 'chacha20-poly1305' | 'nip04' | 'nip44';

  /**
   * Unix timestamp in seconds.
   */
  timestamp: number;

  /**
   * Additional authenticated data (if any).
   */
  aad?: string;
}

/**
 * Message metadata for indexing and searching.
 */
export interface MessageMetadata {
  /**
   * Message ID reference.
   */
  messageId: string;

  /**
   * Channel ID for grouping.
   */
  channelId: string;

  /**
   * Unix timestamp for sorting.
   */
  timestamp: number;

  /**
   * Sender's fingerprint for filtering.
   */
  senderFingerprint: string;

  /**
   * Whether the message contains mentions.
   */
  hasMentions: boolean;

  /**
   * Whether the message is from the local user.
   */
  isOwn: boolean;

  /**
   * Whether the message has been read.
   */
  isRead: boolean;

  /**
   * Full-text search tokens (normalized).
   */
  searchTokens?: string[];

  /**
   * Nostr event ID if synced.
   */
  nostrEventId?: string;

  /**
   * Message hash for deduplication.
   */
  contentHash?: string;
}

/**
 * Input type for creating new messages.
 * Used when composing and sending messages.
 */
export interface CreateMessageInput {
  /**
   * Channel to send the message to.
   */
  channelId: string;

  /**
   * Message content.
   */
  content: string;

  /**
   * Message type (defaults to Text).
   */
  type?: MessageType;

  /**
   * Whether this is a private message.
   */
  isPrivate?: boolean;

  /**
   * Recipient fingerprint for private messages.
   */
  recipientFingerprint?: string;

  /**
   * Mentioned user fingerprints.
   */
  mentions?: string[];
}

/**
 * Read receipt for acknowledging message read status.
 * Matches native BitChat's ReadReceipt structure.
 */
export interface ReadReceipt {
  /**
   * ID of the original message being acknowledged.
   */
  originalMessageId: string;

  /**
   * Nickname of the reader.
   */
  readerNickname: string;

  /**
   * Fingerprint of the reader.
   */
  readerFingerprint: string;

  /**
   * Unix timestamp when the message was read.
   */
  timestamp: number;
}

/**
 * Message batch for bulk operations.
 */
export interface MessageBatch {
  /**
   * Channel ID for the batch.
   */
  channelId: string;

  /**
   * Array of messages in the batch.
   */
  messages: Message[];

  /**
   * Whether there are more messages available.
   */
  hasMore: boolean;

  /**
   * Cursor for pagination (oldest message timestamp).
   */
  cursor?: number;
}
