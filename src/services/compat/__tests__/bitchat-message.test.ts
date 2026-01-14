/**
 * BitchatMessage Binary Serialization Tests
 *
 * Comprehensive test suite for BitchatMessage binary serialization
 * that ensures compatibility with iOS/Android native implementations.
 *
 * Tests cover:
 * - All 256 flag combinations
 * - Boundary conditions (0, 1, max for each field)
 * - UTF-8 encoding with special characters (emoji, CJK, etc.)
 * - Round-trip: message -> bytes -> message = identical
 * - Big-endian byte order verification
 */

import { describe, it, expect } from 'vitest';
import {
  serializeBitchatMessage,
  deserializeBitchatMessage,
  calculateFlags,
  parseFlags,
  validateMessage,
  messagesEqual,
  createMinimalMessage,
  MessageFlags,
  MessageLimits,
  BitchatMessageData,
} from '../bitchat-message';

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Creates a string of specified byte length (ASCII, 1 byte per char)
 */
function createStringOfByteLength(length: number, char = 'x'): string {
  return char.repeat(length);
}

/**
 * Creates a UTF-8 string that encodes to specified byte length
 * Uses emoji (4 bytes each) and fills remainder with ASCII
 */
function createUtf8StringOfByteLength(length: number): string {
  const encoder = new TextEncoder();
  let result = '';
  let currentLength = 0;

  // Add 4-byte emoji characters
  while (currentLength + 4 <= length) {
    result += '\u{1F600}'; // Grinning face emoji (4 bytes in UTF-8)
    currentLength += 4;
  }

  // Fill remainder with ASCII characters
  while (currentLength < length) {
    result += 'a';
    currentLength += 1;
  }

  // Verify byte length
  const actualLength = encoder.encode(result).length;
  if (actualLength !== length) {
    throw new Error(`Failed to create string of ${length} bytes, got ${actualLength}`);
  }

  return result;
}

/**
 * Helper to generate all messages for a given flag combination
 */
function createMessageForFlags(flags: number): BitchatMessageData {
  const message: BitchatMessageData = {
    id: 'test-id',
    sender: 'test-sender',
    content: 'test-content',
    timestamp: 1704067200000, // Fixed timestamp for reproducibility
  };

  // Set flags based on bit values
  if (flags & MessageFlags.RELAY) {
    message.isRelay = true;
  }
  if (flags & MessageFlags.PRIVATE) {
    message.isPrivate = true;
  }
  if (flags & MessageFlags.HAS_ORIGINAL_SENDER) {
    message.originalSender = 'original-sender';
  }
  if (flags & MessageFlags.HAS_RECIPIENT) {
    message.recipient = 'recipient-name';
  }
  if (flags & MessageFlags.HAS_PEER_ID) {
    message.peerId = 'peer-id-123';
  }
  if (flags & MessageFlags.HAS_MENTIONS) {
    message.mentions = ['mention1', 'mention2'];
  }
  if (flags & MessageFlags.HAS_CHANNEL) {
    message.channel = 'channel-name';
  }
  if (flags & MessageFlags.ENCRYPTED) {
    message.isEncrypted = true;
  }

  return message;
}

// ============================================================================
// Flag Tests
// ============================================================================

describe('MessageFlags Constants', () => {
  it('should have correct flag values', () => {
    expect(MessageFlags.RELAY).toBe(0x01);
    expect(MessageFlags.PRIVATE).toBe(0x02);
    expect(MessageFlags.HAS_ORIGINAL_SENDER).toBe(0x04);
    expect(MessageFlags.HAS_RECIPIENT).toBe(0x08);
    expect(MessageFlags.HAS_PEER_ID).toBe(0x10);
    expect(MessageFlags.HAS_MENTIONS).toBe(0x20);
    expect(MessageFlags.HAS_CHANNEL).toBe(0x40);
    expect(MessageFlags.ENCRYPTED).toBe(0x80);
  });

  it('should have non-overlapping flags', () => {
    const allFlags = [
      MessageFlags.RELAY,
      MessageFlags.PRIVATE,
      MessageFlags.HAS_ORIGINAL_SENDER,
      MessageFlags.HAS_RECIPIENT,
      MessageFlags.HAS_PEER_ID,
      MessageFlags.HAS_MENTIONS,
      MessageFlags.HAS_CHANNEL,
      MessageFlags.ENCRYPTED,
    ];

    // Check that OR-ing all flags together equals 0xFF
    const combined = allFlags.reduce((a, b) => a | b, 0);
    expect(combined).toBe(0xff);

    // Check that each flag is a power of 2
    for (const flag of allFlags) {
      expect(flag & (flag - 1)).toBe(0);
    }
  });
});

describe('calculateFlags', () => {
  it('should return 0 for minimal message', () => {
    const message = createMinimalMessage();
    expect(calculateFlags(message)).toBe(0);
  });

  it('should set RELAY flag when isRelay is true', () => {
    const message = createMinimalMessage({ isRelay: true });
    expect(calculateFlags(message) & MessageFlags.RELAY).toBe(MessageFlags.RELAY);
  });

  it('should set PRIVATE flag when isPrivate is true', () => {
    const message = createMinimalMessage({ isPrivate: true });
    expect(calculateFlags(message) & MessageFlags.PRIVATE).toBe(MessageFlags.PRIVATE);
  });

  it('should set ENCRYPTED flag when isEncrypted is true', () => {
    const message = createMinimalMessage({ isEncrypted: true });
    expect(calculateFlags(message) & MessageFlags.ENCRYPTED).toBe(MessageFlags.ENCRYPTED);
  });

  it('should set HAS_ORIGINAL_SENDER flag when originalSender is present', () => {
    const message = createMinimalMessage({ originalSender: 'sender' });
    expect(calculateFlags(message) & MessageFlags.HAS_ORIGINAL_SENDER).toBe(MessageFlags.HAS_ORIGINAL_SENDER);
  });

  it('should set HAS_RECIPIENT flag when recipient is present', () => {
    const message = createMinimalMessage({ recipient: 'recipient' });
    expect(calculateFlags(message) & MessageFlags.HAS_RECIPIENT).toBe(MessageFlags.HAS_RECIPIENT);
  });

  it('should set HAS_PEER_ID flag when peerId is present', () => {
    const message = createMinimalMessage({ peerId: 'peer-id' });
    expect(calculateFlags(message) & MessageFlags.HAS_PEER_ID).toBe(MessageFlags.HAS_PEER_ID);
  });

  it('should set HAS_MENTIONS flag when mentions array is non-empty', () => {
    const message = createMinimalMessage({ mentions: ['user1', 'user2'] });
    expect(calculateFlags(message) & MessageFlags.HAS_MENTIONS).toBe(MessageFlags.HAS_MENTIONS);
  });

  it('should NOT set HAS_MENTIONS flag when mentions array is empty', () => {
    const message = createMinimalMessage({ mentions: [] });
    expect(calculateFlags(message) & MessageFlags.HAS_MENTIONS).toBe(0);
  });

  it('should set HAS_CHANNEL flag when channel is present', () => {
    const message = createMinimalMessage({ channel: 'channel' });
    expect(calculateFlags(message) & MessageFlags.HAS_CHANNEL).toBe(MessageFlags.HAS_CHANNEL);
  });

  it('should set all flags correctly for fully populated message', () => {
    const message = createMinimalMessage({
      isRelay: true,
      isPrivate: true,
      isEncrypted: true,
      originalSender: 'original',
      recipient: 'recipient',
      peerId: 'peer',
      mentions: ['mention'],
      channel: 'channel',
    });
    expect(calculateFlags(message)).toBe(0xff);
  });
});

describe('parseFlags', () => {
  it('should parse 0 correctly', () => {
    const parsed = parseFlags(0);
    expect(parsed.isRelay).toBe(false);
    expect(parsed.isPrivate).toBe(false);
    expect(parsed.hasOriginalSender).toBe(false);
    expect(parsed.hasRecipient).toBe(false);
    expect(parsed.hasPeerId).toBe(false);
    expect(parsed.hasMentions).toBe(false);
    expect(parsed.hasChannel).toBe(false);
    expect(parsed.isEncrypted).toBe(false);
  });

  it('should parse 0xFF correctly', () => {
    const parsed = parseFlags(0xff);
    expect(parsed.isRelay).toBe(true);
    expect(parsed.isPrivate).toBe(true);
    expect(parsed.hasOriginalSender).toBe(true);
    expect(parsed.hasRecipient).toBe(true);
    expect(parsed.hasPeerId).toBe(true);
    expect(parsed.hasMentions).toBe(true);
    expect(parsed.hasChannel).toBe(true);
    expect(parsed.isEncrypted).toBe(true);
  });

  it('should parse individual flags correctly', () => {
    expect(parseFlags(MessageFlags.RELAY).isRelay).toBe(true);
    expect(parseFlags(MessageFlags.PRIVATE).isPrivate).toBe(true);
    expect(parseFlags(MessageFlags.HAS_ORIGINAL_SENDER).hasOriginalSender).toBe(true);
    expect(parseFlags(MessageFlags.HAS_RECIPIENT).hasRecipient).toBe(true);
    expect(parseFlags(MessageFlags.HAS_PEER_ID).hasPeerId).toBe(true);
    expect(parseFlags(MessageFlags.HAS_MENTIONS).hasMentions).toBe(true);
    expect(parseFlags(MessageFlags.HAS_CHANNEL).hasChannel).toBe(true);
    expect(parseFlags(MessageFlags.ENCRYPTED).isEncrypted).toBe(true);
  });
});

// ============================================================================
// All 256 Flag Combinations Test
// ============================================================================

describe('All 256 Flag Combinations', () => {
  // Test all 256 possible flag combinations (0x00 to 0xFF)
  for (let flags = 0; flags <= 255; flags++) {
    it(`should serialize and deserialize correctly with flags 0x${flags.toString(16).padStart(2, '0').toUpperCase()}`, () => {
      const message = createMessageForFlags(flags);

      // Serialize
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);
      expect(serialized.data).toBeDefined();

      // Verify flags byte
      expect(serialized.data![0]).toBe(flags);

      // Deserialize
      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message).toBeDefined();

      // Verify round-trip equality
      expect(messagesEqual(message, deserialized.message!)).toBe(true);

      // Verify individual flag values match
      expect(Boolean(deserialized.message!.isRelay)).toBe((flags & MessageFlags.RELAY) !== 0);
      expect(Boolean(deserialized.message!.isPrivate)).toBe((flags & MessageFlags.PRIVATE) !== 0);
      expect(Boolean(deserialized.message!.isEncrypted)).toBe((flags & MessageFlags.ENCRYPTED) !== 0);

      // Verify optional fields presence matches flags
      if (flags & MessageFlags.HAS_ORIGINAL_SENDER) {
        expect(deserialized.message!.originalSender).toBe('original-sender');
      } else {
        expect(deserialized.message!.originalSender).toBeUndefined();
      }

      if (flags & MessageFlags.HAS_RECIPIENT) {
        expect(deserialized.message!.recipient).toBe('recipient-name');
      } else {
        expect(deserialized.message!.recipient).toBeUndefined();
      }

      if (flags & MessageFlags.HAS_PEER_ID) {
        expect(deserialized.message!.peerId).toBe('peer-id-123');
      } else {
        expect(deserialized.message!.peerId).toBeUndefined();
      }

      if (flags & MessageFlags.HAS_MENTIONS) {
        expect(deserialized.message!.mentions).toEqual(['mention1', 'mention2']);
      } else {
        expect(deserialized.message!.mentions).toBeUndefined();
      }

      if (flags & MessageFlags.HAS_CHANNEL) {
        expect(deserialized.message!.channel).toBe('channel-name');
      } else {
        expect(deserialized.message!.channel).toBeUndefined();
      }
    });
  }
});

// ============================================================================
// Boundary Condition Tests
// ============================================================================

describe('Boundary Conditions', () => {
  describe('ID Field', () => {
    it('should handle empty ID (0 length)', () => {
      const message = createMinimalMessage({ id: '' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.id).toBe('');
    });

    it('should handle single character ID (1 byte)', () => {
      const message = createMinimalMessage({ id: 'a' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.id).toBe('a');
    });

    it('should handle maximum length ID (255 bytes)', () => {
      const maxId = createStringOfByteLength(MessageLimits.MAX_ID_LENGTH);
      const message = createMinimalMessage({ id: maxId });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.id).toBe(maxId);
    });

    it('should reject ID exceeding maximum length (256 bytes)', () => {
      const tooLong = createStringOfByteLength(MessageLimits.MAX_ID_LENGTH + 1);
      const message = createMinimalMessage({ id: tooLong });
      const result = serializeBitchatMessage(message);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ID exceeds maximum length');
    });
  });

  describe('Sender Field', () => {
    it('should handle empty sender (0 length)', () => {
      const message = createMinimalMessage({ sender: '' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.sender).toBe('');
    });

    it('should handle single character sender (1 byte)', () => {
      const message = createMinimalMessage({ sender: 'x' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.sender).toBe('x');
    });

    it('should handle maximum length sender (255 bytes)', () => {
      const maxSender = createStringOfByteLength(MessageLimits.MAX_SENDER_LENGTH);
      const message = createMinimalMessage({ sender: maxSender });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.sender).toBe(maxSender);
    });

    it('should reject sender exceeding maximum length (256 bytes)', () => {
      const tooLong = createStringOfByteLength(MessageLimits.MAX_SENDER_LENGTH + 1);
      const message = createMinimalMessage({ sender: tooLong });
      const result = serializeBitchatMessage(message);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Sender exceeds maximum length');
    });
  });

  describe('Content Field', () => {
    it('should handle empty content (0 length)', () => {
      const message = createMinimalMessage({ content: '' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe('');
    });

    it('should handle single character content (1 byte)', () => {
      const message = createMinimalMessage({ content: 'c' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe('c');
    });

    it('should handle maximum length content (65535 bytes)', () => {
      const maxContent = createStringOfByteLength(MessageLimits.MAX_CONTENT_LENGTH);
      const message = createMinimalMessage({ content: maxContent });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(maxContent);
    });

    it('should reject content exceeding maximum length (65536 bytes)', () => {
      const tooLong = createStringOfByteLength(MessageLimits.MAX_CONTENT_LENGTH + 1);
      const message = createMinimalMessage({ content: tooLong });
      const result = serializeBitchatMessage(message);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Content exceeds maximum length');
    });
  });

  describe('Timestamp Field', () => {
    it('should handle timestamp of 0', () => {
      const message = createMinimalMessage({ timestamp: 0 });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.timestamp).toBe(0);
    });

    it('should handle timestamp of 1', () => {
      const message = createMinimalMessage({ timestamp: 1 });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.timestamp).toBe(1);
    });

    it('should handle large timestamp (2^53 - 1, max safe integer)', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER;
      const message = createMinimalMessage({ timestamp: maxSafe });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.timestamp).toBe(maxSafe);
    });

    it('should handle typical timestamp (current time in milliseconds)', () => {
      const now = Date.now();
      const message = createMinimalMessage({ timestamp: now });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.timestamp).toBe(now);
    });
  });

  describe('Optional Fields Boundaries', () => {
    it('should handle empty originalSender', () => {
      const message = createMinimalMessage({ originalSender: '' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.originalSender).toBe('');
    });

    it('should handle maximum length originalSender (255 bytes)', () => {
      const maxOriginalSender = createStringOfByteLength(MessageLimits.MAX_ORIGINAL_SENDER_LENGTH);
      const message = createMinimalMessage({ originalSender: maxOriginalSender });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.originalSender).toBe(maxOriginalSender);
    });

    it('should handle empty mentions array', () => {
      const message = createMinimalMessage({ mentions: [] });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      // Empty mentions array should NOT set the flag
      expect(serialized.data![0] & MessageFlags.HAS_MENTIONS).toBe(0);
    });

    it('should handle maximum mentions count (255)', () => {
      const mentions = Array.from({ length: 255 }, (_, i) => `m${i}`);
      const message = createMinimalMessage({ mentions });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.mentions).toEqual(mentions);
    });

    it('should reject mentions count exceeding maximum (256)', () => {
      const mentions = Array.from({ length: 256 }, (_, i) => `m${i}`);
      const message = createMinimalMessage({ mentions });
      const result = serializeBitchatMessage(message);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Mentions count exceeds maximum');
    });

    it('should handle single empty mention', () => {
      const message = createMinimalMessage({ mentions: [''] });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.mentions).toEqual(['']);
    });

    it('should handle maximum length mention (255 bytes)', () => {
      const maxMention = createStringOfByteLength(MessageLimits.MAX_MENTION_LENGTH);
      const message = createMinimalMessage({ mentions: [maxMention] });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.mentions).toEqual([maxMention]);
    });
  });
});

// ============================================================================
// UTF-8 Encoding Tests
// ============================================================================

describe('UTF-8 Encoding', () => {
  describe('Basic UTF-8 Characters', () => {
    it('should handle ASCII characters', () => {
      const message = createMinimalMessage({
        id: 'abc123',
        sender: 'user-xyz',
        content: 'Hello, World!',
      });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(messagesEqual(message, deserialized.message!)).toBe(true);
    });

    it('should handle Latin-1 extended characters', () => {
      const message = createMinimalMessage({
        content: 'cafe with umlauts: cafe, Munchen, Zurich, etc.',
      });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(message.content);
    });
  });

  describe('Emoji Characters (4-byte UTF-8)', () => {
    it('should handle single emoji', () => {
      const message = createMinimalMessage({
        content: '\u{1F600}', // Grinning face
      });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe('\u{1F600}');
    });

    it('should handle multiple emojis', () => {
      const emojis = '\u{1F600}\u{1F601}\u{1F602}\u{1F603}\u{1F604}'; // 5 different emojis
      const message = createMinimalMessage({ content: emojis });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(emojis);
    });

    it('should handle emoji in all string fields', () => {
      const emoji = '\u{1F44D}'; // Thumbs up
      const message = createMinimalMessage({
        id: `id-${emoji}`,
        sender: `sender-${emoji}`,
        content: `Hello ${emoji} World`,
        originalSender: `original-${emoji}`,
        recipient: `recipient-${emoji}`,
        peerId: `peer-${emoji}`,
        mentions: [`mention-${emoji}-1`, `mention-${emoji}-2`],
        channel: `channel-${emoji}`,
      });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(messagesEqual(message, deserialized.message!)).toBe(true);
    });

    it('should handle emoji sequences (ZWJ)', () => {
      // Family emoji: man + ZWJ + woman + ZWJ + girl
      const familyEmoji = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}';
      const message = createMinimalMessage({ content: familyEmoji });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(familyEmoji);
    });

    it('should handle flag emojis', () => {
      // US flag: regional indicator U + regional indicator S
      const usFlag = '\u{1F1FA}\u{1F1F8}';
      const message = createMinimalMessage({ content: usFlag });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(usFlag);
    });
  });

  describe('CJK Characters (3-byte UTF-8)', () => {
    it('should handle Chinese characters', () => {
      const chinese = '\u4E2D\u6587\u6D4B\u8BD5'; // "Chinese test"
      const message = createMinimalMessage({ content: chinese });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(chinese);
    });

    it('should handle Japanese characters (hiragana, katakana, kanji)', () => {
      const japanese = '\u3053\u3093\u306B\u3061\u306F\u4E16\u754C'; // "Hello World" in Japanese
      const message = createMinimalMessage({ content: japanese });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(japanese);
    });

    it('should handle Korean characters', () => {
      const korean = '\uC548\uB155\uD558\uC138\uC694'; // "Hello" in Korean
      const message = createMinimalMessage({ content: korean });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(korean);
    });
  });

  describe('Mixed UTF-8 Content', () => {
    it('should handle mixed ASCII and emoji', () => {
      const mixed = 'Hello \u{1F44B} World \u{1F30D}!';
      const message = createMinimalMessage({ content: mixed });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(mixed);
    });

    it('should handle mixed CJK and emoji', () => {
      const mixed = '\u4F60\u597D \u{1F44B} \u3053\u3093\u306B\u3061\u306F \u{1F30D}';
      const message = createMinimalMessage({ content: mixed });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(mixed);
    });

    it('should handle all UTF-8 byte lengths in one message', () => {
      // ASCII (1 byte) + Latin extended (2 bytes) + CJK (3 bytes) + Emoji (4 bytes)
      const content = 'A \u00E9 \u4E2D \u{1F600}';
      const message = createMinimalMessage({ content });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(content);
    });
  });

  describe('Special and Edge Case Characters', () => {
    it('should handle newlines and tabs', () => {
      const message = createMinimalMessage({
        content: 'Line 1\nLine 2\tTabbed',
      });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe('Line 1\nLine 2\tTabbed');
    });

    it('should handle null character', () => {
      const message = createMinimalMessage({
        content: 'Before\x00After',
      });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe('Before\x00After');
    });

    it('should handle surrogate pairs correctly', () => {
      // Mathematical bold capital A (U+1D400) - requires surrogate pair in JS
      const mathBold = '\u{1D400}\u{1D401}\u{1D402}';
      const message = createMinimalMessage({ content: mathBold });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(mathBold);
    });

    it('should handle right-to-left text (Arabic)', () => {
      const arabic = '\u0645\u0631\u062D\u0628\u0627'; // "Hello" in Arabic
      const message = createMinimalMessage({ content: arabic });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(arabic);
    });

    it('should handle bidirectional text', () => {
      const bidi = 'Hello \u0645\u0631\u062D\u0628\u0627 World';
      const message = createMinimalMessage({ content: bidi });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.content).toBe(bidi);
    });
  });
});

// ============================================================================
// Big-Endian Byte Order Verification
// ============================================================================

describe('Big-Endian Byte Order', () => {
  describe('Timestamp (8 bytes)', () => {
    it('should encode timestamp in big-endian (within safe integer range)', () => {
      // Use a value within MAX_SAFE_INTEGER that shows big-endian byte order
      // 0x0001020304050607 = 283686952306183 (within safe integer range)
      const timestamp = 0x0001020304050607;
      const message = createMinimalMessage({ timestamp });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      // Timestamp bytes start at offset 1 (after flags byte)
      const data = serialized.data!;
      expect(data[1]).toBe(0x00); // Most significant byte first
      expect(data[2]).toBe(0x01);
      expect(data[3]).toBe(0x02);
      expect(data[4]).toBe(0x03);
      expect(data[5]).toBe(0x04);
      expect(data[6]).toBe(0x05);
      expect(data[7]).toBe(0x06);
      expect(data[8]).toBe(0x07); // Least significant byte last
    });

    it('should encode timestamp 0x00000000000000FF correctly', () => {
      const timestamp = 0xff;
      const message = createMinimalMessage({ timestamp });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const data = serialized.data!;
      // Big-endian: all zeros except last byte
      expect(data[1]).toBe(0x00);
      expect(data[2]).toBe(0x00);
      expect(data[3]).toBe(0x00);
      expect(data[4]).toBe(0x00);
      expect(data[5]).toBe(0x00);
      expect(data[6]).toBe(0x00);
      expect(data[7]).toBe(0x00);
      expect(data[8]).toBe(0xff);
    });

    it('should encode timestamp 0x001FFFFFFFFFFFFF (MAX_SAFE_INTEGER) correctly', () => {
      // MAX_SAFE_INTEGER = 9007199254740991 = 0x001FFFFFFFFFFFFF
      const timestamp = Number.MAX_SAFE_INTEGER;
      const message = createMinimalMessage({ timestamp });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const data = serialized.data!;
      // Big-endian: 0x00 0x1F 0xFF 0xFF 0xFF 0xFF 0xFF 0xFF
      expect(data[1]).toBe(0x00);
      expect(data[2]).toBe(0x1f);
      expect(data[3]).toBe(0xff);
      expect(data[4]).toBe(0xff);
      expect(data[5]).toBe(0xff);
      expect(data[6]).toBe(0xff);
      expect(data[7]).toBe(0xff);
      expect(data[8]).toBe(0xff);
    });

    it('should round-trip a typical timestamp correctly', () => {
      const timestamp = 1704067200000; // 2024-01-01 00:00:00 UTC in milliseconds
      const message = createMinimalMessage({ timestamp });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(deserialized.message!.timestamp).toBe(timestamp);
    });
  });

  describe('Content Length (2 bytes)', () => {
    it('should encode content length 0x0102 in big-endian', () => {
      const contentLength = 0x0102; // 258 characters
      const content = createStringOfByteLength(contentLength);
      const message = createMinimalMessage({ id: '', sender: '', content });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      // Content length is at offset: flags(1) + timestamp(8) + idLen(1) + id(0) + senderLen(1) + sender(0) = 11
      const data = serialized.data!;
      expect(data[11]).toBe(0x01); // Most significant byte first
      expect(data[12]).toBe(0x02); // Least significant byte last
    });

    it('should encode content length 0xFF00 in big-endian', () => {
      const contentLength = 0xff00; // 65280 bytes
      const content = createStringOfByteLength(contentLength);
      const message = createMinimalMessage({ id: '', sender: '', content });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const data = serialized.data!;
      expect(data[11]).toBe(0xff); // Most significant byte
      expect(data[12]).toBe(0x00); // Least significant byte
    });

    it('should encode content length 0x00FF in big-endian', () => {
      const contentLength = 0x00ff; // 255 bytes
      const content = createStringOfByteLength(contentLength);
      const message = createMinimalMessage({ id: '', sender: '', content });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const data = serialized.data!;
      expect(data[11]).toBe(0x00); // Most significant byte
      expect(data[12]).toBe(0xff); // Least significant byte
    });

    it('should encode maximum content length 0xFFFF in big-endian', () => {
      const contentLength = 0xffff; // 65535 bytes
      const content = createStringOfByteLength(contentLength);
      const message = createMinimalMessage({ id: '', sender: '', content });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const data = serialized.data!;
      expect(data[11]).toBe(0xff); // Most significant byte
      expect(data[12]).toBe(0xff); // Least significant byte
    });
  });

  describe('Explicit Byte Order Verification', () => {
    it('should produce bytes that a big-endian reader can interpret', () => {
      // Use a safe integer value: 0x0001020304050607 = 283686952306183
      const timestamp = 0x0001020304050607;
      const message = createMinimalMessage({
        id: '',
        sender: '',
        content: '',
        timestamp,
      });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      // Manually read timestamp as big-endian using DataView
      const view = new DataView(serialized.data!.buffer);
      const readTimestamp = view.getBigUint64(1, false); // false = big-endian

      // Should match the original timestamp
      expect(readTimestamp).toBe(BigInt(timestamp));
    });

    it('should verify little-endian would produce different results', () => {
      // Use a safe integer: 0x0001020304050607 (asymmetric to ensure LE != BE)
      const timestamp = 0x0001020304050607;
      const message = createMinimalMessage({ timestamp, id: '', sender: '', content: '' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      // Read as big-endian (correct)
      const viewBE = new DataView(serialized.data!.buffer);
      const readBE = viewBE.getBigUint64(1, false);

      // Read as little-endian (incorrect - would give different value)
      const readLE = viewBE.getBigUint64(1, true);

      // Big-endian read should match original
      expect(Number(readBE)).toBe(timestamp);

      // Little-endian read should NOT match (value is asymmetric)
      expect(Number(readLE)).not.toBe(timestamp);
    });

    it('should demonstrate big-endian byte layout with 0xABCD value', () => {
      // Use a simple value where bytes are clearly ordered
      const timestamp = 0xABCD; // 43981 in decimal
      const message = createMinimalMessage({ timestamp, id: '', sender: '', content: '' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      const data = serialized.data!;
      // Big-endian: 0x00 00 00 00 00 00 AB CD
      expect(data[1]).toBe(0x00);
      expect(data[2]).toBe(0x00);
      expect(data[3]).toBe(0x00);
      expect(data[4]).toBe(0x00);
      expect(data[5]).toBe(0x00);
      expect(data[6]).toBe(0x00);
      expect(data[7]).toBe(0xAB); // High byte of 0xABCD
      expect(data[8]).toBe(0xCD); // Low byte of 0xABCD
    });
  });
});

// ============================================================================
// Round-Trip Tests
// ============================================================================

describe('Round-Trip Serialization', () => {
  it('should round-trip minimal message', () => {
    const original = createMinimalMessage();
    const serialized = serializeBitchatMessage(original);
    expect(serialized.success).toBe(true);

    const deserialized = deserializeBitchatMessage(serialized.data!);
    expect(deserialized.success).toBe(true);
    expect(messagesEqual(original, deserialized.message!)).toBe(true);
  });

  it('should round-trip fully populated message', () => {
    const original: BitchatMessageData = {
      id: 'full-message-id-123',
      sender: 'alice@bitchat.local',
      content: 'Hello, this is a fully populated message with all optional fields!',
      timestamp: 1704067200000,
      isRelay: true,
      isPrivate: true,
      isEncrypted: true,
      originalSender: 'bob@bitchat.local',
      recipient: 'charlie@bitchat.local',
      peerId: 'peer-id-xyz-789',
      mentions: ['@dave', '@eve', '@frank'],
      channel: 'general-chat',
    };

    const serialized = serializeBitchatMessage(original);
    expect(serialized.success).toBe(true);

    const deserialized = deserializeBitchatMessage(serialized.data!);
    expect(deserialized.success).toBe(true);
    expect(messagesEqual(original, deserialized.message!)).toBe(true);
  });

  it('should round-trip message with maximum field lengths', () => {
    const original: BitchatMessageData = {
      id: createStringOfByteLength(255),
      sender: createStringOfByteLength(255),
      content: createStringOfByteLength(65535),
      timestamp: Number.MAX_SAFE_INTEGER,
      isRelay: true,
      isPrivate: true,
      isEncrypted: true,
      originalSender: createStringOfByteLength(255),
      recipient: createStringOfByteLength(255),
      peerId: createStringOfByteLength(255),
      mentions: Array.from({ length: 255 }, () => 'a'),
      channel: createStringOfByteLength(255),
    };

    const serialized = serializeBitchatMessage(original);
    expect(serialized.success).toBe(true);

    const deserialized = deserializeBitchatMessage(serialized.data!);
    expect(deserialized.success).toBe(true);
    expect(messagesEqual(original, deserialized.message!)).toBe(true);
  });

  it('should round-trip message with UTF-8 content', () => {
    const original: BitchatMessageData = {
      id: 'emoji-\u{1F600}-id',
      sender: '\u4E2D\u6587-sender',
      content: 'Mixed: Hello \u{1F44B} \u4E2D\u6587 \u0645\u0631\u062D\u0628\u0627',
      timestamp: 1704067200000,
      originalSender: '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}',
      mentions: ['\u{1F44D}', '\u4E2D\u6587'],
      channel: 'emoji-\u{1F4AC}',
    };

    const serialized = serializeBitchatMessage(original);
    expect(serialized.success).toBe(true);

    const deserialized = deserializeBitchatMessage(serialized.data!);
    expect(deserialized.success).toBe(true);
    expect(messagesEqual(original, deserialized.message!)).toBe(true);
  });

  it('should round-trip many different messages', () => {
    const messages: BitchatMessageData[] = [
      { id: '1', sender: 'a', content: 'x', timestamp: 0 },
      { id: '2', sender: 'b', content: 'y', timestamp: 1, isRelay: true },
      { id: '3', sender: 'c', content: 'z', timestamp: 2, isPrivate: true },
      { id: '4', sender: 'd', content: '', timestamp: 3, mentions: ['m'] },
      { id: '5', sender: '', content: '', timestamp: 4, channel: 'ch' },
    ];

    for (const original of messages) {
      const serialized = serializeBitchatMessage(original);
      expect(serialized.success).toBe(true);

      const deserialized = deserializeBitchatMessage(serialized.data!);
      expect(deserialized.success).toBe(true);
      expect(messagesEqual(original, deserialized.message!)).toBe(true);
    }
  });

  it('should preserve exact byte representation on round-trip', () => {
    const original = createMinimalMessage({
      id: 'test-id',
      sender: 'test-sender',
      content: 'test-content',
      timestamp: 1704067200000,
    });

    const serialized1 = serializeBitchatMessage(original);
    expect(serialized1.success).toBe(true);

    const deserialized = deserializeBitchatMessage(serialized1.data!);
    expect(deserialized.success).toBe(true);

    const serialized2 = serializeBitchatMessage(deserialized.message!);
    expect(serialized2.success).toBe(true);

    // Byte-for-byte comparison
    expect(Array.from(serialized1.data!)).toEqual(Array.from(serialized2.data!));
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  describe('Deserialization Errors', () => {
    it('should reject empty data', () => {
      const result = deserializeBitchatMessage(new Uint8Array(0));
      expect(result.success).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject data shorter than minimum (13 bytes)', () => {
      const result = deserializeBitchatMessage(new Uint8Array(12));
      expect(result.success).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject truncated ID', () => {
      // Create valid header but truncate before ID data
      const buffer = new ArrayBuffer(15);
      const view = new DataView(buffer);
      view.setUint8(0, 0); // flags
      view.setBigUint64(1, BigInt(0), false); // timestamp
      view.setUint8(9, 10); // ID length = 10, but we only have a few bytes
      // Total: 15 bytes, but ID needs 10 more bytes

      const result = deserializeBitchatMessage(new Uint8Array(buffer));
      expect(result.success).toBe(false);
      expect(result.error).toContain('ID');
    });

    it('should reject truncated sender', () => {
      // Create valid header + ID but truncate sender
      const buffer = new ArrayBuffer(16);
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      view.setUint8(0, 0); // flags
      view.setBigUint64(1, BigInt(0), false); // timestamp
      view.setUint8(9, 2); // ID length = 2
      bytes[10] = 65; // 'A'
      bytes[11] = 66; // 'B'
      view.setUint8(12, 10); // Sender length = 10, but only 3 bytes remain

      const result = deserializeBitchatMessage(new Uint8Array(buffer));
      expect(result.success).toBe(false);
      expect(result.error).toContain('sender');
    });

    it('should reject truncated content', () => {
      // Create header + ID + sender but truncate content
      const buffer = new ArrayBuffer(20);
      const view = new DataView(buffer);
      const bytes = new Uint8Array(buffer);
      view.setUint8(0, 0); // flags
      view.setBigUint64(1, BigInt(0), false); // timestamp
      view.setUint8(9, 2); // ID length = 2
      bytes[10] = 65; // 'A'
      bytes[11] = 66; // 'B'
      view.setUint8(12, 2); // Sender length = 2
      bytes[13] = 67; // 'C'
      bytes[14] = 68; // 'D'
      view.setUint16(15, 1000, false); // Content length = 1000, but only ~5 bytes remain

      const result = deserializeBitchatMessage(new Uint8Array(buffer));
      expect(result.success).toBe(false);
      expect(result.error).toContain('content');
    });

    it('should reject truncated optional fields', () => {
      // Create valid base message with HAS_ORIGINAL_SENDER flag but no data for it
      const message = createMinimalMessage({ id: '', sender: '', content: '' });
      const serialized = serializeBitchatMessage(message);
      expect(serialized.success).toBe(true);

      // Modify to set HAS_ORIGINAL_SENDER flag without adding data
      const corrupted = new Uint8Array(serialized.data!);
      corrupted[0] = MessageFlags.HAS_ORIGINAL_SENDER;

      const result = deserializeBitchatMessage(corrupted);
      expect(result.success).toBe(false);
      expect(result.error).toContain('original sender');
    });
  });

  describe('Validation Errors', () => {
    it('should reject negative timestamp in validation', () => {
      const result = validateMessage({
        id: 'id',
        sender: 'sender',
        content: 'content',
        timestamp: -1,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Timestamp');
    });

    it('should reject NaN timestamp in validation', () => {
      const result = validateMessage({
        id: 'id',
        sender: 'sender',
        content: 'content',
        timestamp: NaN,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Timestamp');
    });

    it('should reject Infinity timestamp in validation', () => {
      const result = validateMessage({
        id: 'id',
        sender: 'sender',
        content: 'content',
        timestamp: Infinity,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Timestamp');
    });
  });
});

// ============================================================================
// messagesEqual Tests
// ============================================================================

describe('messagesEqual', () => {
  it('should return true for identical messages', () => {
    const a = createMinimalMessage({ id: 'same', sender: 'same', content: 'same', timestamp: 123 });
    const b = createMinimalMessage({ id: 'same', sender: 'same', content: 'same', timestamp: 123 });
    expect(messagesEqual(a, b)).toBe(true);
  });

  it('should return false for different IDs', () => {
    const a = createMinimalMessage({ id: 'a' });
    const b = createMinimalMessage({ id: 'b' });
    expect(messagesEqual(a, b)).toBe(false);
  });

  it('should return false for different senders', () => {
    const a = createMinimalMessage({ sender: 'a' });
    const b = createMinimalMessage({ sender: 'b' });
    expect(messagesEqual(a, b)).toBe(false);
  });

  it('should return false for different content', () => {
    const a = createMinimalMessage({ content: 'a' });
    const b = createMinimalMessage({ content: 'b' });
    expect(messagesEqual(a, b)).toBe(false);
  });

  it('should return false for different timestamps', () => {
    const a = createMinimalMessage({ timestamp: 1 });
    const b = createMinimalMessage({ timestamp: 2 });
    expect(messagesEqual(a, b)).toBe(false);
  });

  it('should return false for different flags', () => {
    const a = createMinimalMessage({ isRelay: true });
    const b = createMinimalMessage({ isRelay: false });
    expect(messagesEqual(a, b)).toBe(false);
  });

  it('should treat undefined and null optional fields as equal', () => {
    const a = createMinimalMessage({ originalSender: undefined });
    const b = createMinimalMessage();
    expect(messagesEqual(a, b)).toBe(true);
  });

  it('should return false for different mentions arrays', () => {
    const a = createMinimalMessage({ mentions: ['a', 'b'] });
    const b = createMinimalMessage({ mentions: ['a', 'c'] });
    expect(messagesEqual(a, b)).toBe(false);
  });

  it('should return false for different mentions array lengths', () => {
    const a = createMinimalMessage({ mentions: ['a', 'b'] });
    const b = createMinimalMessage({ mentions: ['a'] });
    expect(messagesEqual(a, b)).toBe(false);
  });

  it('should treat empty mentions array and undefined as equal', () => {
    const a = createMinimalMessage({ mentions: [] });
    const b = createMinimalMessage({ mentions: undefined });
    expect(messagesEqual(a, b)).toBe(true);
  });
});

// ============================================================================
// Binary Format Verification Tests
// ============================================================================

describe('Binary Format Specification', () => {
  it('should place flags at byte 0', () => {
    const message = createMinimalMessage({ isRelay: true, isPrivate: true });
    const serialized = serializeBitchatMessage(message);
    expect(serialized.success).toBe(true);
    expect(serialized.data![0]).toBe(MessageFlags.RELAY | MessageFlags.PRIVATE);
  });

  it('should place timestamp at bytes 1-8', () => {
    // Use a safe integer value: 0x0001020304050607 = 283686952306183
    const timestamp = 0x0001020304050607;
    const message = createMinimalMessage({ timestamp, id: '', sender: '', content: '' });
    const serialized = serializeBitchatMessage(message);
    expect(serialized.success).toBe(true);

    // Verify big-endian byte order
    expect(serialized.data![1]).toBe(0x00);
    expect(serialized.data![2]).toBe(0x01);
    expect(serialized.data![3]).toBe(0x02);
    expect(serialized.data![4]).toBe(0x03);
    expect(serialized.data![5]).toBe(0x04);
    expect(serialized.data![6]).toBe(0x05);
    expect(serialized.data![7]).toBe(0x06);
    expect(serialized.data![8]).toBe(0x07);
  });

  it('should place ID length at byte 9', () => {
    const message = createMinimalMessage({ id: 'ABC', sender: '', content: '' });
    const serialized = serializeBitchatMessage(message);
    expect(serialized.success).toBe(true);
    expect(serialized.data![9]).toBe(3); // Length of 'ABC'
  });

  it('should calculate correct total size for minimal message', () => {
    const message = createMinimalMessage({ id: '', sender: '', content: '' });
    const serialized = serializeBitchatMessage(message);
    expect(serialized.success).toBe(true);

    // flags(1) + timestamp(8) + idLen(1) + id(0) + senderLen(1) + sender(0) + contentLen(2) + content(0) = 13
    expect(serialized.data!.length).toBe(13);
  });

  it('should calculate correct total size with all optional fields', () => {
    const message: BitchatMessageData = {
      id: 'A', // 1 byte
      sender: 'B', // 1 byte
      content: 'C', // 1 byte
      timestamp: 0,
      originalSender: 'D', // 1 byte
      recipient: 'E', // 1 byte
      peerId: 'F', // 1 byte
      mentions: ['G', 'H'], // 2 mentions, 1 byte each
      channel: 'I', // 1 byte
    };
    const serialized = serializeBitchatMessage(message);
    expect(serialized.success).toBe(true);

    // Base: flags(1) + timestamp(8) + idLen(1) + id(1) + senderLen(1) + sender(1) + contentLen(2) + content(1) = 16
    // Optional: originalSenderLen(1) + originalSender(1) + recipientLen(1) + recipient(1) +
    //           peerIdLen(1) + peerId(1) + mentionsCount(1) + mention1Len(1) + mention1(1) +
    //           mention2Len(1) + mention2(1) + channelLen(1) + channel(1) = 13
    // Total: 16 + 13 = 29
    expect(serialized.data!.length).toBe(29);
  });

  it('should write optional fields in flag bit order', () => {
    const message: BitchatMessageData = {
      id: '',
      sender: '',
      content: '',
      timestamp: 0,
      originalSender: 'A',
      recipient: 'BB',
      peerId: 'CCC',
      mentions: ['D'],
      channel: 'EEEEE',
    };
    const serialized = serializeBitchatMessage(message);
    expect(serialized.success).toBe(true);

    // After base fields (13 bytes):
    // originalSender: len(1) + data(1) at offset 13-14
    // recipient: len(1) + data(2) at offset 15-17
    // peerId: len(1) + data(3) at offset 18-21
    // mentions: count(1) + len(1) + data(1) at offset 22-24
    // channel: len(1) + data(5) at offset 25-30

    expect(serialized.data![13]).toBe(1); // originalSender length
    expect(String.fromCharCode(serialized.data![14])).toBe('A');

    expect(serialized.data![15]).toBe(2); // recipient length
    expect(String.fromCharCode(serialized.data![16], serialized.data![17])).toBe('BB');

    expect(serialized.data![18]).toBe(3); // peerId length

    expect(serialized.data![22]).toBe(1); // mentions count
    expect(serialized.data![23]).toBe(1); // first mention length

    expect(serialized.data![25]).toBe(5); // channel length
  });
});

// ============================================================================
// Performance and Stress Tests
// ============================================================================

describe('Performance and Stress', () => {
  it('should handle 1000 rapid serializations', () => {
    const message = createMinimalMessage();
    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      const result = serializeBitchatMessage(message);
      expect(result.success).toBe(true);
    }

    const elapsed = performance.now() - startTime;
    // Should complete in reasonable time (less than 1 second for 1000 ops)
    expect(elapsed).toBeLessThan(1000);
  });

  it('should handle 1000 rapid deserializations', () => {
    const message = createMinimalMessage();
    const serialized = serializeBitchatMessage(message);
    expect(serialized.success).toBe(true);

    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      const result = deserializeBitchatMessage(serialized.data!);
      expect(result.success).toBe(true);
    }

    const elapsed = performance.now() - startTime;
    expect(elapsed).toBeLessThan(1000);
  });

  it('should handle large content efficiently', () => {
    const largeContent = createStringOfByteLength(65535);
    const message = createMinimalMessage({ content: largeContent });

    const startTime = performance.now();
    const serialized = serializeBitchatMessage(message);
    expect(serialized.success).toBe(true);

    const deserialized = deserializeBitchatMessage(serialized.data!);
    expect(deserialized.success).toBe(true);

    const elapsed = performance.now() - startTime;
    // Even with max content, should complete quickly (less than 100ms)
    expect(elapsed).toBeLessThan(100);
  });
});
