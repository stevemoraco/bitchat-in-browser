/**
 * BitchatMessage Binary Serialization Service
 *
 * Provides binary serialization and deserialization for BitChat messages
 * that is compatible with iOS and Android native implementations.
 *
 * Binary Format:
 * - Flags:           1 byte (bit flags)
 * - Timestamp:       8 bytes (milliseconds since epoch, BIG-ENDIAN)
 * - ID length:       1 byte
 * - ID:              variable (max 255 bytes, UTF-8)
 * - Sender length:   1 byte
 * - Sender:          variable (max 255 bytes, UTF-8)
 * - Content length:  2 bytes (BIG-ENDIAN)
 * - Content:         variable (max 65535 bytes, UTF-8)
 * - Optional fields: based on flags
 *
 * Flag Bits:
 * - 0x01: relay flag
 * - 0x02: private message
 * - 0x04: has original sender (1 byte length + data)
 * - 0x08: has recipient (1 byte length + data)
 * - 0x10: has peer ID (1 byte length + data)
 * - 0x20: has mentions (1 byte count + (1 byte length + data) per mention)
 * - 0x40: has channel (1 byte length + data)
 * - 0x80: encrypted
 *
 * @module services/compat/bitchat-message
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Flag bit constants for message flags byte
 */
export const MessageFlags = {
  /** 0x01: Message is relayed through another peer */
  RELAY: 0x01,
  /** 0x02: Message is a private/direct message */
  PRIVATE: 0x02,
  /** 0x04: Message has original sender field */
  HAS_ORIGINAL_SENDER: 0x04,
  /** 0x08: Message has recipient field */
  HAS_RECIPIENT: 0x08,
  /** 0x10: Message has peer ID field */
  HAS_PEER_ID: 0x10,
  /** 0x20: Message has mentions array */
  HAS_MENTIONS: 0x20,
  /** 0x40: Message has channel field */
  HAS_CHANNEL: 0x40,
  /** 0x80: Message content is encrypted */
  ENCRYPTED: 0x80,
} as const;

/**
 * Maximum lengths for variable-length fields
 */
export const MessageLimits = {
  /** Maximum ID length (1 byte length field = 255) */
  MAX_ID_LENGTH: 255,
  /** Maximum sender length (1 byte length field = 255) */
  MAX_SENDER_LENGTH: 255,
  /** Maximum content length (2 byte length field = 65535) */
  MAX_CONTENT_LENGTH: 65535,
  /** Maximum original sender length (1 byte length field = 255) */
  MAX_ORIGINAL_SENDER_LENGTH: 255,
  /** Maximum recipient length (1 byte length field = 255) */
  MAX_RECIPIENT_LENGTH: 255,
  /** Maximum peer ID length (1 byte length field = 255) */
  MAX_PEER_ID_LENGTH: 255,
  /** Maximum mentions count (1 byte count field = 255) */
  MAX_MENTIONS_COUNT: 255,
  /** Maximum mention length (1 byte length field = 255) */
  MAX_MENTION_LENGTH: 255,
  /** Maximum channel length (1 byte length field = 255) */
  MAX_CHANNEL_LENGTH: 255,
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * BitchatMessage structure for binary serialization.
 * This interface represents the message data that can be serialized.
 */
export interface BitchatMessageData {
  /** Unique message identifier (max 255 bytes UTF-8) */
  id: string;
  /** Sender identifier (max 255 bytes UTF-8) */
  sender: string;
  /** Message content (max 65535 bytes UTF-8) */
  content: string;
  /** Timestamp in milliseconds since Unix epoch */
  timestamp: number;
  /** Whether this is a relay message */
  isRelay?: boolean;
  /** Whether this is a private message */
  isPrivate?: boolean;
  /** Whether the content is encrypted */
  isEncrypted?: boolean;
  /** Original sender for relayed messages (max 255 bytes UTF-8) */
  originalSender?: string;
  /** Recipient for private messages (max 255 bytes UTF-8) */
  recipient?: string;
  /** Peer ID for routing (max 255 bytes UTF-8) */
  peerId?: string;
  /** Array of mentioned user identifiers (each max 255 bytes UTF-8) */
  mentions?: string[];
  /** Channel identifier (max 255 bytes UTF-8) */
  channel?: string;
}

/**
 * Result of serialization operation
 */
export interface SerializationResult {
  success: boolean;
  data?: Uint8Array;
  error?: string;
}

/**
 * Result of deserialization operation
 */
export interface DeserializationResult {
  success: boolean;
  message?: BitchatMessageData;
  error?: string;
  bytesRead?: number;
}

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serializes a BitchatMessage to binary format.
 *
 * @param message - The message to serialize
 * @returns SerializationResult with binary data or error
 */
export function serializeBitchatMessage(message: BitchatMessageData): SerializationResult {
  try {
    // Encode strings to UTF-8
    const encoder = new TextEncoder();
    const idBytes = encoder.encode(message.id);
    const senderBytes = encoder.encode(message.sender);
    const contentBytes = encoder.encode(message.content);

    // Validate lengths
    if (idBytes.length > MessageLimits.MAX_ID_LENGTH) {
      return { success: false, error: `ID exceeds maximum length of ${MessageLimits.MAX_ID_LENGTH} bytes` };
    }
    if (senderBytes.length > MessageLimits.MAX_SENDER_LENGTH) {
      return { success: false, error: `Sender exceeds maximum length of ${MessageLimits.MAX_SENDER_LENGTH} bytes` };
    }
    if (contentBytes.length > MessageLimits.MAX_CONTENT_LENGTH) {
      return { success: false, error: `Content exceeds maximum length of ${MessageLimits.MAX_CONTENT_LENGTH} bytes` };
    }

    // Build flags byte
    let flags = 0;
    if (message.isRelay) flags |= MessageFlags.RELAY;
    if (message.isPrivate) flags |= MessageFlags.PRIVATE;
    if (message.isEncrypted) flags |= MessageFlags.ENCRYPTED;

    // Encode optional fields and set flags
    let originalSenderBytes: Uint8Array | null = null;
    if (message.originalSender !== undefined && message.originalSender !== null) {
      originalSenderBytes = encoder.encode(message.originalSender);
      if (originalSenderBytes.length > MessageLimits.MAX_ORIGINAL_SENDER_LENGTH) {
        return { success: false, error: `Original sender exceeds maximum length of ${MessageLimits.MAX_ORIGINAL_SENDER_LENGTH} bytes` };
      }
      flags |= MessageFlags.HAS_ORIGINAL_SENDER;
    }

    let recipientBytes: Uint8Array | null = null;
    if (message.recipient !== undefined && message.recipient !== null) {
      recipientBytes = encoder.encode(message.recipient);
      if (recipientBytes.length > MessageLimits.MAX_RECIPIENT_LENGTH) {
        return { success: false, error: `Recipient exceeds maximum length of ${MessageLimits.MAX_RECIPIENT_LENGTH} bytes` };
      }
      flags |= MessageFlags.HAS_RECIPIENT;
    }

    let peerIdBytes: Uint8Array | null = null;
    if (message.peerId !== undefined && message.peerId !== null) {
      peerIdBytes = encoder.encode(message.peerId);
      if (peerIdBytes.length > MessageLimits.MAX_PEER_ID_LENGTH) {
        return { success: false, error: `Peer ID exceeds maximum length of ${MessageLimits.MAX_PEER_ID_LENGTH} bytes` };
      }
      flags |= MessageFlags.HAS_PEER_ID;
    }

    let mentionsData: { count: number; bytes: Uint8Array[] } | null = null;
    if (message.mentions !== undefined && message.mentions !== null && message.mentions.length > 0) {
      if (message.mentions.length > MessageLimits.MAX_MENTIONS_COUNT) {
        return { success: false, error: `Mentions count exceeds maximum of ${MessageLimits.MAX_MENTIONS_COUNT}` };
      }
      const mentionBytes: Uint8Array[] = [];
      for (const mention of message.mentions) {
        const encoded = encoder.encode(mention);
        if (encoded.length > MessageLimits.MAX_MENTION_LENGTH) {
          return { success: false, error: `Mention exceeds maximum length of ${MessageLimits.MAX_MENTION_LENGTH} bytes` };
        }
        mentionBytes.push(encoded);
      }
      mentionsData = { count: message.mentions.length, bytes: mentionBytes };
      flags |= MessageFlags.HAS_MENTIONS;
    }

    let channelBytes: Uint8Array | null = null;
    if (message.channel !== undefined && message.channel !== null) {
      channelBytes = encoder.encode(message.channel);
      if (channelBytes.length > MessageLimits.MAX_CHANNEL_LENGTH) {
        return { success: false, error: `Channel exceeds maximum length of ${MessageLimits.MAX_CHANNEL_LENGTH} bytes` };
      }
      flags |= MessageFlags.HAS_CHANNEL;
    }

    // Calculate total size
    let totalSize = 0;
    totalSize += 1; // flags
    totalSize += 8; // timestamp
    totalSize += 1 + idBytes.length; // id length + id
    totalSize += 1 + senderBytes.length; // sender length + sender
    totalSize += 2 + contentBytes.length; // content length (2 bytes) + content

    if (originalSenderBytes) {
      totalSize += 1 + originalSenderBytes.length;
    }
    if (recipientBytes) {
      totalSize += 1 + recipientBytes.length;
    }
    if (peerIdBytes) {
      totalSize += 1 + peerIdBytes.length;
    }
    if (mentionsData) {
      totalSize += 1; // count byte
      for (const mentionByteArray of mentionsData.bytes) {
        totalSize += 1 + mentionByteArray.length;
      }
    }
    if (channelBytes) {
      totalSize += 1 + channelBytes.length;
    }

    // Allocate buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);
    let offset = 0;

    // Write flags (1 byte)
    view.setUint8(offset, flags);
    offset += 1;

    // Write timestamp (8 bytes, BIG-ENDIAN)
    // JavaScript numbers are safe up to 2^53-1, but we need to handle as 64-bit
    // Use BigInt for proper 64-bit handling
    const timestampBigInt = BigInt(Math.floor(message.timestamp));
    view.setBigUint64(offset, timestampBigInt, false); // false = big-endian
    offset += 8;

    // Write ID (1 byte length + data)
    view.setUint8(offset, idBytes.length);
    offset += 1;
    bytes.set(idBytes, offset);
    offset += idBytes.length;

    // Write sender (1 byte length + data)
    view.setUint8(offset, senderBytes.length);
    offset += 1;
    bytes.set(senderBytes, offset);
    offset += senderBytes.length;

    // Write content (2 bytes length, BIG-ENDIAN + data)
    view.setUint16(offset, contentBytes.length, false); // false = big-endian
    offset += 2;
    bytes.set(contentBytes, offset);
    offset += contentBytes.length;

    // Write optional fields in flag order

    // Original sender (0x04)
    if (originalSenderBytes) {
      view.setUint8(offset, originalSenderBytes.length);
      offset += 1;
      bytes.set(originalSenderBytes, offset);
      offset += originalSenderBytes.length;
    }

    // Recipient (0x08)
    if (recipientBytes) {
      view.setUint8(offset, recipientBytes.length);
      offset += 1;
      bytes.set(recipientBytes, offset);
      offset += recipientBytes.length;
    }

    // Peer ID (0x10)
    if (peerIdBytes) {
      view.setUint8(offset, peerIdBytes.length);
      offset += 1;
      bytes.set(peerIdBytes, offset);
      offset += peerIdBytes.length;
    }

    // Mentions (0x20)
    if (mentionsData) {
      view.setUint8(offset, mentionsData.count);
      offset += 1;
      for (const mentionByteArray of mentionsData.bytes) {
        view.setUint8(offset, mentionByteArray.length);
        offset += 1;
        bytes.set(mentionByteArray, offset);
        offset += mentionByteArray.length;
      }
    }

    // Channel (0x40)
    if (channelBytes) {
      view.setUint8(offset, channelBytes.length);
      offset += 1;
      bytes.set(channelBytes, offset);
      offset += channelBytes.length;
    }

    return { success: true, data: bytes };
  } catch (err) {
    return { success: false, error: `Serialization failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ============================================================================
// Deserialization
// ============================================================================

/**
 * Deserializes binary data to a BitchatMessage.
 *
 * @param data - The binary data to deserialize
 * @returns DeserializationResult with message data or error
 */
export function deserializeBitchatMessage(data: Uint8Array): DeserializationResult {
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let offset = 0;

    // Minimum size: flags(1) + timestamp(8) + idLen(1) + senderLen(1) + contentLen(2) = 13 bytes
    if (data.length < 13) {
      return { success: false, error: 'Data too short for minimum message size (13 bytes)' };
    }

    // Read flags (1 byte)
    const flags = view.getUint8(offset);
    offset += 1;

    // Read timestamp (8 bytes, BIG-ENDIAN)
    const timestampBigInt = view.getBigUint64(offset, false); // false = big-endian
    const timestamp = Number(timestampBigInt);
    offset += 8;

    // Read ID (1 byte length + data)
    const idLength = view.getUint8(offset);
    offset += 1;
    if (offset + idLength > data.length) {
      return { success: false, error: 'Unexpected end of data while reading ID' };
    }
    const idBytes = data.slice(offset, offset + idLength);
    const id = decoder.decode(idBytes);
    offset += idLength;

    // Read sender (1 byte length + data)
    if (offset >= data.length) {
      return { success: false, error: 'Unexpected end of data while reading sender length' };
    }
    const senderLength = view.getUint8(offset);
    offset += 1;
    if (offset + senderLength > data.length) {
      return { success: false, error: 'Unexpected end of data while reading sender' };
    }
    const senderBytes = data.slice(offset, offset + senderLength);
    const sender = decoder.decode(senderBytes);
    offset += senderLength;

    // Read content (2 bytes length, BIG-ENDIAN + data)
    if (offset + 2 > data.length) {
      return { success: false, error: 'Unexpected end of data while reading content length' };
    }
    const contentLength = view.getUint16(offset, false); // false = big-endian
    offset += 2;
    if (offset + contentLength > data.length) {
      return { success: false, error: 'Unexpected end of data while reading content' };
    }
    const contentBytes = data.slice(offset, offset + contentLength);
    const content = decoder.decode(contentBytes);
    offset += contentLength;

    // Build message object
    const message: BitchatMessageData = {
      id,
      sender,
      content,
      timestamp,
      isRelay: (flags & MessageFlags.RELAY) !== 0,
      isPrivate: (flags & MessageFlags.PRIVATE) !== 0,
      isEncrypted: (flags & MessageFlags.ENCRYPTED) !== 0,
    };

    // Read optional fields in flag order

    // Original sender (0x04)
    if (flags & MessageFlags.HAS_ORIGINAL_SENDER) {
      if (offset >= data.length) {
        return { success: false, error: 'Unexpected end of data while reading original sender length' };
      }
      const originalSenderLength = view.getUint8(offset);
      offset += 1;
      if (offset + originalSenderLength > data.length) {
        return { success: false, error: 'Unexpected end of data while reading original sender' };
      }
      const originalSenderBytes = data.slice(offset, offset + originalSenderLength);
      message.originalSender = decoder.decode(originalSenderBytes);
      offset += originalSenderLength;
    }

    // Recipient (0x08)
    if (flags & MessageFlags.HAS_RECIPIENT) {
      if (offset >= data.length) {
        return { success: false, error: 'Unexpected end of data while reading recipient length' };
      }
      const recipientLength = view.getUint8(offset);
      offset += 1;
      if (offset + recipientLength > data.length) {
        return { success: false, error: 'Unexpected end of data while reading recipient' };
      }
      const recipientBytes = data.slice(offset, offset + recipientLength);
      message.recipient = decoder.decode(recipientBytes);
      offset += recipientLength;
    }

    // Peer ID (0x10)
    if (flags & MessageFlags.HAS_PEER_ID) {
      if (offset >= data.length) {
        return { success: false, error: 'Unexpected end of data while reading peer ID length' };
      }
      const peerIdLength = view.getUint8(offset);
      offset += 1;
      if (offset + peerIdLength > data.length) {
        return { success: false, error: 'Unexpected end of data while reading peer ID' };
      }
      const peerIdBytes = data.slice(offset, offset + peerIdLength);
      message.peerId = decoder.decode(peerIdBytes);
      offset += peerIdLength;
    }

    // Mentions (0x20)
    if (flags & MessageFlags.HAS_MENTIONS) {
      if (offset >= data.length) {
        return { success: false, error: 'Unexpected end of data while reading mentions count' };
      }
      const mentionsCount = view.getUint8(offset);
      offset += 1;
      const mentions: string[] = [];
      for (let i = 0; i < mentionsCount; i++) {
        if (offset >= data.length) {
          return { success: false, error: `Unexpected end of data while reading mention ${i} length` };
        }
        const mentionLength = view.getUint8(offset);
        offset += 1;
        if (offset + mentionLength > data.length) {
          return { success: false, error: `Unexpected end of data while reading mention ${i}` };
        }
        const mentionBytes = data.slice(offset, offset + mentionLength);
        mentions.push(decoder.decode(mentionBytes));
        offset += mentionLength;
      }
      message.mentions = mentions;
    }

    // Channel (0x40)
    if (flags & MessageFlags.HAS_CHANNEL) {
      if (offset >= data.length) {
        return { success: false, error: 'Unexpected end of data while reading channel length' };
      }
      const channelLength = view.getUint8(offset);
      offset += 1;
      if (offset + channelLength > data.length) {
        return { success: false, error: 'Unexpected end of data while reading channel' };
      }
      const channelBytes = data.slice(offset, offset + channelLength);
      message.channel = decoder.decode(channelBytes);
      offset += channelLength;
    }

    return { success: true, message, bytesRead: offset };
  } catch (err) {
    return { success: false, error: `Deserialization failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculates the flags byte for a message without serializing.
 *
 * @param message - The message to calculate flags for
 * @returns The flags byte value
 */
export function calculateFlags(message: BitchatMessageData): number {
  let flags = 0;
  if (message.isRelay) flags |= MessageFlags.RELAY;
  if (message.isPrivate) flags |= MessageFlags.PRIVATE;
  if (message.originalSender !== undefined && message.originalSender !== null) {
    flags |= MessageFlags.HAS_ORIGINAL_SENDER;
  }
  if (message.recipient !== undefined && message.recipient !== null) {
    flags |= MessageFlags.HAS_RECIPIENT;
  }
  if (message.peerId !== undefined && message.peerId !== null) {
    flags |= MessageFlags.HAS_PEER_ID;
  }
  if (message.mentions !== undefined && message.mentions !== null && message.mentions.length > 0) {
    flags |= MessageFlags.HAS_MENTIONS;
  }
  if (message.channel !== undefined && message.channel !== null) {
    flags |= MessageFlags.HAS_CHANNEL;
  }
  if (message.isEncrypted) flags |= MessageFlags.ENCRYPTED;
  return flags;
}

/**
 * Parses flags byte into boolean properties.
 *
 * @param flags - The flags byte
 * @returns Object with flag properties
 */
export function parseFlags(flags: number): {
  isRelay: boolean;
  isPrivate: boolean;
  hasOriginalSender: boolean;
  hasRecipient: boolean;
  hasPeerId: boolean;
  hasMentions: boolean;
  hasChannel: boolean;
  isEncrypted: boolean;
} {
  return {
    isRelay: (flags & MessageFlags.RELAY) !== 0,
    isPrivate: (flags & MessageFlags.PRIVATE) !== 0,
    hasOriginalSender: (flags & MessageFlags.HAS_ORIGINAL_SENDER) !== 0,
    hasRecipient: (flags & MessageFlags.HAS_RECIPIENT) !== 0,
    hasPeerId: (flags & MessageFlags.HAS_PEER_ID) !== 0,
    hasMentions: (flags & MessageFlags.HAS_MENTIONS) !== 0,
    hasChannel: (flags & MessageFlags.HAS_CHANNEL) !== 0,
    isEncrypted: (flags & MessageFlags.ENCRYPTED) !== 0,
  };
}

/**
 * Validates a message can be serialized without actually serializing.
 *
 * @param message - The message to validate
 * @returns Object with valid boolean and optional error message
 */
export function validateMessage(message: BitchatMessageData): { valid: boolean; error?: string } {
  const encoder = new TextEncoder();

  // Check required fields
  if (message.id === undefined || message.id === null) {
    return { valid: false, error: 'ID is required' };
  }
  if (message.sender === undefined || message.sender === null) {
    return { valid: false, error: 'Sender is required' };
  }
  if (message.content === undefined || message.content === null) {
    return { valid: false, error: 'Content is required' };
  }
  if (message.timestamp === undefined || message.timestamp === null) {
    return { valid: false, error: 'Timestamp is required' };
  }

  // Validate timestamp is a valid number
  if (!Number.isFinite(message.timestamp) || message.timestamp < 0) {
    return { valid: false, error: 'Timestamp must be a non-negative finite number' };
  }

  // Check field lengths
  const idBytes = encoder.encode(message.id);
  if (idBytes.length > MessageLimits.MAX_ID_LENGTH) {
    return { valid: false, error: `ID exceeds maximum length of ${MessageLimits.MAX_ID_LENGTH} bytes` };
  }

  const senderBytes = encoder.encode(message.sender);
  if (senderBytes.length > MessageLimits.MAX_SENDER_LENGTH) {
    return { valid: false, error: `Sender exceeds maximum length of ${MessageLimits.MAX_SENDER_LENGTH} bytes` };
  }

  const contentBytes = encoder.encode(message.content);
  if (contentBytes.length > MessageLimits.MAX_CONTENT_LENGTH) {
    return { valid: false, error: `Content exceeds maximum length of ${MessageLimits.MAX_CONTENT_LENGTH} bytes` };
  }

  // Check optional field lengths
  if (message.originalSender !== undefined && message.originalSender !== null) {
    const bytes = encoder.encode(message.originalSender);
    if (bytes.length > MessageLimits.MAX_ORIGINAL_SENDER_LENGTH) {
      return { valid: false, error: `Original sender exceeds maximum length of ${MessageLimits.MAX_ORIGINAL_SENDER_LENGTH} bytes` };
    }
  }

  if (message.recipient !== undefined && message.recipient !== null) {
    const bytes = encoder.encode(message.recipient);
    if (bytes.length > MessageLimits.MAX_RECIPIENT_LENGTH) {
      return { valid: false, error: `Recipient exceeds maximum length of ${MessageLimits.MAX_RECIPIENT_LENGTH} bytes` };
    }
  }

  if (message.peerId !== undefined && message.peerId !== null) {
    const bytes = encoder.encode(message.peerId);
    if (bytes.length > MessageLimits.MAX_PEER_ID_LENGTH) {
      return { valid: false, error: `Peer ID exceeds maximum length of ${MessageLimits.MAX_PEER_ID_LENGTH} bytes` };
    }
  }

  if (message.mentions !== undefined && message.mentions !== null) {
    if (message.mentions.length > MessageLimits.MAX_MENTIONS_COUNT) {
      return { valid: false, error: `Mentions count exceeds maximum of ${MessageLimits.MAX_MENTIONS_COUNT}` };
    }
    for (let i = 0; i < message.mentions.length; i++) {
      const bytes = encoder.encode(message.mentions[i]);
      if (bytes.length > MessageLimits.MAX_MENTION_LENGTH) {
        return { valid: false, error: `Mention ${i} exceeds maximum length of ${MessageLimits.MAX_MENTION_LENGTH} bytes` };
      }
    }
  }

  if (message.channel !== undefined && message.channel !== null) {
    const bytes = encoder.encode(message.channel);
    if (bytes.length > MessageLimits.MAX_CHANNEL_LENGTH) {
      return { valid: false, error: `Channel exceeds maximum length of ${MessageLimits.MAX_CHANNEL_LENGTH} bytes` };
    }
  }

  return { valid: true };
}

/**
 * Compares two messages for equality (useful for round-trip testing).
 *
 * @param a - First message
 * @param b - Second message
 * @returns True if messages are equal
 */
export function messagesEqual(a: BitchatMessageData, b: BitchatMessageData): boolean {
  // Compare required fields
  if (a.id !== b.id) return false;
  if (a.sender !== b.sender) return false;
  if (a.content !== b.content) return false;
  if (a.timestamp !== b.timestamp) return false;

  // Compare boolean flags
  if (Boolean(a.isRelay) !== Boolean(b.isRelay)) return false;
  if (Boolean(a.isPrivate) !== Boolean(b.isPrivate)) return false;
  if (Boolean(a.isEncrypted) !== Boolean(b.isEncrypted)) return false;

  // Compare optional string fields (treat undefined/null as equivalent)
  const normalizeOptional = (v: string | undefined | null): string | undefined => {
    if (v === undefined || v === null) return undefined;
    return v;
  };

  if (normalizeOptional(a.originalSender) !== normalizeOptional(b.originalSender)) return false;
  if (normalizeOptional(a.recipient) !== normalizeOptional(b.recipient)) return false;
  if (normalizeOptional(a.peerId) !== normalizeOptional(b.peerId)) return false;
  if (normalizeOptional(a.channel) !== normalizeOptional(b.channel)) return false;

  // Compare mentions arrays
  const aMentions = a.mentions ?? [];
  const bMentions = b.mentions ?? [];
  if (aMentions.length !== bMentions.length) return false;
  for (let i = 0; i < aMentions.length; i++) {
    if (aMentions[i] !== bMentions[i]) return false;
  }

  return true;
}

/**
 * Creates a minimal valid message for testing.
 *
 * @param overrides - Optional field overrides
 * @returns A valid BitchatMessageData object
 */
export function createMinimalMessage(overrides?: Partial<BitchatMessageData>): BitchatMessageData {
  return {
    id: 'test-id',
    sender: 'test-sender',
    content: 'test-content',
    timestamp: Date.now(),
    ...overrides,
  };
}
