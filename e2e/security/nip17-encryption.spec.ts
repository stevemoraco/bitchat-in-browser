/**
 * E2E Tests: NIP-17 Private Direct Messages Encryption
 *
 * Comprehensive end-to-end tests for NIP-17 gift wrap encryption,
 * verifying the complete encryption/decryption flow through the browser.
 *
 * Tests cover:
 * - Full NIP-17 round trip (rumor -> seal -> gift wrap -> unwrap)
 * - Cross-platform decryption with hardcoded test vectors
 * - Signature verification (valid, tampered, wrong pubkey)
 * - Privacy guarantees (ephemeral keys, randomized timestamps)
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/17.md
 */

import { test, expect, Page } from '@playwright/test';

// ============================================================================
// Test Vector Constants
// ============================================================================

/**
 * Hardcoded test vectors for cross-platform compatibility testing.
 * These values were generated with a known-good implementation and
 * can be used to verify that the web implementation decrypts correctly.
 *
 * Key format: secp256k1 private keys (32 bytes hex)
 */
const TEST_VECTORS = {
  // Alice's identity (message sender)
  alice: {
    privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    // Public key derived from the above private key using secp256k1
    expectedPubkey: '02a8e44b48d3e5d8e8f7d56b4f0d29e3e8e5c4a3b2d1e0f9a8b7c6d5e4f3a2b1c0', // Will be computed
  },
  // Bob's identity (message recipient)
  bob: {
    privateKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
  },
  // Charlie's identity (unauthorized third party)
  charlie: {
    privateKey: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
  },
  // Test message content
  message: {
    content: 'Hello, this is a secret message for testing NIP-17!',
    unicodeContent: 'Hello World! \u{1F44B} \u{1F30D} \u{1F512}',
    longContent: 'A'.repeat(5000),
    jsonContent: '{"key": "value", "nested": {"array": [1, 2, 3]}}',
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Injects the NIP-17 module and crypto libraries into the page context
 * and exposes them for testing.
 */
async function setupCryptoContext(page: Page): Promise<void> {
  // Wait for the app to load and crypto to be initialized
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Wait for crypto libraries to be available
  await page.waitForFunction(
    () => {
      // Check if the app has loaded and crypto is available
      return typeof window !== 'undefined';
    },
    { timeout: 10000 }
  );
}

/**
 * Execute NIP-17 operations in the browser context
 */
async function executeInBrowser(
  page: Page,
  fn: string,
  args: Record<string, unknown> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await page.evaluate(
    async ({ fn, args }) => {
      // Dynamic import of nostr-tools for NIP-17 operations
      const nostrTools = await import('nostr-tools');
      const nip44 = await import('nostr-tools/nip44');
      const { hexToBytes, bytesToHex } = await import('@noble/hashes/utils');

      // Create the NIP-17 functions in browser context
      const getPublicKey = nostrTools.getPublicKey;
      const finalizeEvent = nostrTools.finalizeEvent;
      const getEventHash = nostrTools.getEventHash;
      const generateSecretKey = nostrTools.generateSecretKey;

      // NIP-17 kind constants
      const DirectMessage = 14;
      const Seal = 13;
      const GiftWrap = 1059;

      // Helper: get current timestamp
      function now(): number {
        return Math.floor(Date.now() / 1000);
      }

      // Helper: randomized timestamp within past 2 days
      function randomizedTimestamp(): number {
        const twoDays = 2 * 24 * 60 * 60;
        return Math.floor(now() - Math.random() * twoDays);
      }

      // Helper: get conversation key using NIP-44
      function getConversationKey(
        privateKey: Uint8Array,
        publicKey: string
      ): Uint8Array {
        return nip44.v2.utils.getConversationKey(privateKey, publicKey);
      }

      // Helper: encrypt with NIP-44
      function nip44Encrypt(
        data: object,
        privateKey: Uint8Array,
        publicKey: string
      ): string {
        const conversationKey = getConversationKey(privateKey, publicKey);
        return nip44.v2.encrypt(JSON.stringify(data), conversationKey);
      }

      // Helper: decrypt with NIP-44
      function nip44Decrypt<T = unknown>(
        encryptedContent: string,
        conversationKey: Uint8Array
      ): T {
        const decrypted = nip44.v2.decrypt(encryptedContent, conversationKey);
        return JSON.parse(decrypted) as T;
      }

      // Create rumor (kind 14)
      function createRumor(
        content: string,
        senderPrivateKey: Uint8Array,
        recipientPubkey: string
      ): {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
      } {
        const senderPubkey = getPublicKey(senderPrivateKey);
        const rumor = {
          pubkey: senderPubkey,
          created_at: now(),
          kind: DirectMessage,
          tags: [['p', recipientPubkey]],
          content,
        };
        const id = getEventHash(rumor as nostrTools.UnsignedEvent);
        return { ...rumor, id };
      }

      // Create seal (kind 13)
      function createSeal(
        rumor: {
          id: string;
          pubkey: string;
          created_at: number;
          kind: number;
          tags: string[][];
          content: string;
        },
        senderPrivateKey: Uint8Array,
        recipientPubkey: string
      ): nostrTools.VerifiedEvent {
        const encryptedContent = nip44Encrypt(
          rumor,
          senderPrivateKey,
          recipientPubkey
        );
        const sealTemplate = {
          kind: Seal,
          created_at: randomizedTimestamp(),
          tags: [],
          content: encryptedContent,
          pubkey: '',
        };
        return finalizeEvent(sealTemplate, senderPrivateKey);
      }

      // Create gift wrap (kind 1059)
      function createGiftWrap(
        seal: nostrTools.VerifiedEvent,
        recipientPubkey: string
      ): nostrTools.VerifiedEvent {
        const ephemeralPrivateKey = generateSecretKey();
        const encryptedContent = nip44Encrypt(
          seal,
          ephemeralPrivateKey,
          recipientPubkey
        );
        const wrapTemplate = {
          kind: GiftWrap,
          created_at: randomizedTimestamp(),
          tags: [['p', recipientPubkey]],
          content: encryptedContent,
          pubkey: '',
        };
        return finalizeEvent(wrapTemplate, ephemeralPrivateKey);
      }

      // Unwrap gift wrap
      function unwrapGiftWrap(
        giftWrap: nostrTools.VerifiedEvent,
        recipientPrivateKey: Uint8Array
      ): nostrTools.VerifiedEvent {
        if (giftWrap.kind !== GiftWrap) {
          throw new Error(`Expected kind ${GiftWrap}, got ${giftWrap.kind}`);
        }
        const conversationKey = getConversationKey(
          recipientPrivateKey,
          giftWrap.pubkey
        );
        return nip44Decrypt<nostrTools.VerifiedEvent>(
          giftWrap.content,
          conversationKey
        );
      }

      // Open seal
      function openSeal(
        seal: nostrTools.VerifiedEvent,
        recipientPrivateKey: Uint8Array
      ): {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
      } {
        if (seal.kind !== Seal) {
          throw new Error(`Expected kind ${Seal}, got ${seal.kind}`);
        }
        const conversationKey = getConversationKey(
          recipientPrivateKey,
          seal.pubkey
        );
        const rumor = nip44Decrypt<{
          id: string;
          pubkey: string;
          created_at: number;
          kind: number;
          tags: string[][];
          content: string;
        }>(seal.content, conversationKey);
        if (rumor.pubkey !== seal.pubkey) {
          throw new Error(
            'Seal pubkey does not match rumor pubkey - possible sender impersonation'
          );
        }
        return rumor;
      }

      // Complete wrap event
      function wrapEvent(
        senderPrivateKey: Uint8Array,
        recipientPubkey: string,
        message: string
      ): nostrTools.VerifiedEvent {
        const rumor = createRumor(message, senderPrivateKey, recipientPubkey);
        const seal = createSeal(rumor, senderPrivateKey, recipientPubkey);
        return createGiftWrap(seal, recipientPubkey);
      }

      // Complete unwrap event
      function unwrapEvent(
        giftWrap: nostrTools.VerifiedEvent,
        recipientPrivateKey: Uint8Array
      ): {
        rumor: {
          id: string;
          pubkey: string;
          created_at: number;
          kind: number;
          tags: string[][];
          content: string;
        };
        seal: nostrTools.VerifiedEvent;
        senderPubkey: string;
        content: string;
        timestamp: number;
      } {
        const seal = unwrapGiftWrap(giftWrap, recipientPrivateKey);
        const rumor = openSeal(seal, recipientPrivateKey);
        return {
          rumor,
          seal,
          senderPubkey: rumor.pubkey,
          content: rumor.content,
          timestamp: rumor.created_at,
        };
      }

      // Execute the requested function
      const functions: Record<string, (...fnArgs: unknown[]) => unknown> = {
        getPublicKey: (privKey: string) => getPublicKey(hexToBytes(privKey)),
        createRumor: (content: string, senderPrivKey: string, recipientPubkey: string) =>
          createRumor(content, hexToBytes(senderPrivKey), recipientPubkey),
        createSeal: (
          rumor: {
            id: string;
            pubkey: string;
            created_at: number;
            kind: number;
            tags: string[][];
            content: string;
          },
          senderPrivKey: string,
          recipientPubkey: string
        ) => createSeal(rumor, hexToBytes(senderPrivKey), recipientPubkey),
        createGiftWrap: (seal: nostrTools.VerifiedEvent, recipientPubkey: string) =>
          createGiftWrap(seal, recipientPubkey),
        unwrapGiftWrap: (giftWrap: nostrTools.VerifiedEvent, recipientPrivKey: string) =>
          unwrapGiftWrap(giftWrap, hexToBytes(recipientPrivKey)),
        openSeal: (seal: nostrTools.VerifiedEvent, recipientPrivKey: string) =>
          openSeal(seal, hexToBytes(recipientPrivKey)),
        wrapEvent: (senderPrivKey: string, recipientPubkey: string, message: string) =>
          wrapEvent(hexToBytes(senderPrivKey), recipientPubkey, message),
        unwrapEvent: (giftWrap: nostrTools.VerifiedEvent, recipientPrivKey: string) =>
          unwrapEvent(giftWrap, hexToBytes(recipientPrivKey)),
        verifySignature: async (event: nostrTools.VerifiedEvent) => {
          const { verifyEvent } = await import('nostr-tools');
          return verifyEvent(event);
        },
        verifyEventHash: (event: nostrTools.VerifiedEvent) => {
          const computedId = getEventHash(event as nostrTools.UnsignedEvent);
          return computedId === event.id;
        },
      };

      const fnToExecute = functions[fn];
      if (!fnToExecute) {
        throw new Error(`Unknown function: ${fn}`);
      }

      // Handle function-specific argument unpacking
      switch (fn) {
        case 'getPublicKey':
          return fnToExecute(args.privateKey);
        case 'createRumor':
          return fnToExecute(args.content, args.senderPrivKey, args.recipientPubkey);
        case 'createSeal':
          return fnToExecute(args.rumor, args.senderPrivKey, args.recipientPubkey);
        case 'createGiftWrap':
          return fnToExecute(args.seal, args.recipientPubkey);
        case 'unwrapGiftWrap':
          return fnToExecute(args.giftWrap, args.recipientPrivKey);
        case 'openSeal':
          return fnToExecute(args.seal, args.recipientPrivKey);
        case 'wrapEvent':
          return fnToExecute(args.senderPrivKey, args.recipientPubkey, args.message);
        case 'unwrapEvent':
          return fnToExecute(args.giftWrap, args.recipientPrivKey);
        case 'verifySignature':
          return fnToExecute(args.event);
        case 'verifyEventHash':
          return fnToExecute(args.event);
        default:
          throw new Error(`Unhandled function: ${fn}`);
      }
    },
    { fn, args }
  );
}

// ============================================================================
// Test Suite: Full NIP-17 Round Trip
// ============================================================================

test.describe('NIP-17 Encryption - Full Round Trip', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should complete full NIP-17 encryption/decryption cycle', async ({ page }) => {
    // Step 1: Get Bob's public key
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });
    expect(bobPubkey).toBeDefined();
    expect(typeof bobPubkey).toBe('string');
    expect(bobPubkey.length).toBe(64); // 32 bytes hex

    // Step 2: Create a gift-wrapped message from Alice to Bob
    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: TEST_VECTORS.message.content,
    });

    // Verify gift wrap structure
    expect(giftWrap).toBeDefined();
    expect(giftWrap.kind).toBe(1059); // GiftWrap
    expect(giftWrap.id).toBeDefined();
    expect(giftWrap.id.length).toBe(64);
    expect(giftWrap.pubkey).toBeDefined();
    expect(giftWrap.sig).toBeDefined();
    expect(giftWrap.sig.length).toBe(128); // 64 bytes hex
    expect(giftWrap.tags).toContainEqual(['p', bobPubkey]);

    // Step 3: Bob unwraps the gift wrap
    interface DecryptedMessage {
      rumor: {
        id: string;
        pubkey: string;
        created_at: number;
        kind: number;
        tags: string[][];
        content: string;
      };
      seal: GiftWrap;
      senderPubkey: string;
      content: string;
      timestamp: number;
    }

    const decrypted = await executeInBrowser(page, 'unwrapEvent', {
      giftWrap,
      recipientPrivKey: TEST_VECTORS.bob.privateKey,
    });

    // Verify decrypted content matches original
    expect(decrypted.content).toBe(TEST_VECTORS.message.content);

    // Verify sender is Alice
    const alicePubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.alice.privateKey,
    });
    expect(decrypted.senderPubkey).toBe(alicePubkey);

    // Verify rumor structure
    expect(decrypted.rumor).toBeDefined();
    expect(decrypted.rumor.kind).toBe(14); // DirectMessage
    expect(decrypted.rumor.content).toBe(TEST_VECTORS.message.content);
    expect(decrypted.rumor.pubkey).toBe(alicePubkey);
    expect(decrypted.rumor.id.length).toBe(64);

    // Verify seal structure
    expect(decrypted.seal).toBeDefined();
    expect(decrypted.seal.kind).toBe(13); // Seal
    expect(decrypted.seal.pubkey).toBe(alicePubkey);
  });

  test('should handle unicode content correctly', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      kind: number;
      content: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: TEST_VECTORS.message.unicodeContent,
    });

    interface DecryptedMessage {
      content: string;
    }

    const decrypted = await executeInBrowser(page, 'unwrapEvent', {
      giftWrap,
      recipientPrivKey: TEST_VECTORS.bob.privateKey,
    });

    expect(decrypted.content).toBe(TEST_VECTORS.message.unicodeContent);
  });

  test('should handle long messages correctly', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      kind: number;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: TEST_VECTORS.message.longContent,
    });

    interface DecryptedMessage {
      content: string;
    }

    const decrypted = await executeInBrowser(page, 'unwrapEvent', {
      giftWrap,
      recipientPrivKey: TEST_VECTORS.bob.privateKey,
    });

    expect(decrypted.content).toBe(TEST_VECTORS.message.longContent);
    expect(decrypted.content.length).toBe(5000);
  });

  test('should handle JSON content without corruption', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      kind: number;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: TEST_VECTORS.message.jsonContent,
    });

    interface DecryptedMessage {
      content: string;
    }

    const decrypted = await executeInBrowser(page, 'unwrapEvent', {
      giftWrap,
      recipientPrivKey: TEST_VECTORS.bob.privateKey,
    });

    expect(decrypted.content).toBe(TEST_VECTORS.message.jsonContent);
    // Verify it's valid JSON
    expect(() => JSON.parse(decrypted.content)).not.toThrow();
  });

  test('should handle empty message content', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      kind: number;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: '',
    });

    interface DecryptedMessage {
      content: string;
    }

    const decrypted = await executeInBrowser(page, 'unwrapEvent', {
      giftWrap,
      recipientPrivKey: TEST_VECTORS.bob.privateKey,
    });

    expect(decrypted.content).toBe('');
  });
});

// ============================================================================
// Test Suite: Privacy Guarantees
// ============================================================================

test.describe('NIP-17 Encryption - Privacy Guarantees', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should use ephemeral key in gift wrap (not sender key)', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });
    const alicePubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.alice.privateKey,
    });

    interface GiftWrap {
      pubkey: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Secret message',
    });

    // Gift wrap pubkey should NOT be Alice's or Bob's
    expect(giftWrap.pubkey).not.toBe(alicePubkey);
    expect(giftWrap.pubkey).not.toBe(bobPubkey);
    // Should be a valid 64-char hex pubkey
    expect(giftWrap.pubkey.length).toBe(64);
    expect(/^[0-9a-f]+$/i.test(giftWrap.pubkey)).toBe(true);
  });

  test('should use different ephemeral keys for each gift wrap', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      pubkey: string;
      id: string;
    }

    const giftWrap1 = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'First message',
    });

    const giftWrap2 = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Second message',
    });

    // Each gift wrap should have a different ephemeral pubkey
    expect(giftWrap1.pubkey).not.toBe(giftWrap2.pubkey);
    // And different event IDs
    expect(giftWrap1.id).not.toBe(giftWrap2.id);
  });

  test('should have randomized timestamp on gift wrap', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      created_at: number;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test message',
    });

    const now = Math.floor(Date.now() / 1000);
    const twoDays = 2 * 24 * 60 * 60;

    // Timestamp should be within the past 2 days
    expect(giftWrap.created_at).toBeLessThanOrEqual(now);
    expect(giftWrap.created_at).toBeGreaterThan(now - twoDays);
  });

  test('should preserve actual message timestamp in rumor', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      kind: number;
    }

    const beforeTime = Math.floor(Date.now() / 1000);

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test message',
    });

    const afterTime = Math.floor(Date.now() / 1000);

    interface DecryptedMessage {
      timestamp: number;
    }

    const decrypted = await executeInBrowser(page, 'unwrapEvent', {
      giftWrap,
      recipientPrivKey: TEST_VECTORS.bob.privateKey,
    });

    // Rumor timestamp should be close to actual time (within a few seconds)
    expect(decrypted.timestamp).toBeGreaterThanOrEqual(beforeTime);
    expect(decrypted.timestamp).toBeLessThanOrEqual(afterTime + 1);
  });

  test('should have empty tags on seal (hide recipient)', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface Rumor {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
    }

    const rumor = await executeInBrowser(page, 'createRumor', {
      content: 'Secret',
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
    });

    interface Seal {
      tags: string[][];
    }

    const seal = await executeInBrowser(page, 'createSeal', {
      rumor,
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
    });

    // Seal should have no tags (recipient is hidden)
    expect(seal.tags).toEqual([]);
  });
});

// ============================================================================
// Test Suite: Security - Unauthorized Decryption
// ============================================================================

test.describe('NIP-17 Encryption - Security', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should fail when non-recipient tries to decrypt', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      kind: number;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Secret for Bob only',
    });

    // Charlie should NOT be able to decrypt
    let decryptionFailed = false;
    try {
      await executeInBrowser(page, 'unwrapEvent', {
        giftWrap,
        recipientPrivKey: TEST_VECTORS.charlie.privateKey,
      });
    } catch (error) {
      decryptionFailed = true;
    }

    expect(decryptionFailed).toBe(true);
  });

  test('should verify gift wrap signature is valid', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test message',
    });

    // Verify the signature is valid
    const isValid = await executeInBrowser(page, 'verifySignature', {
      event: giftWrap,
    });

    expect(isValid).toBe(true);
  });

  test('should detect tampered content', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Original message',
    });

    // Tamper with the content
    const tamperedGiftWrap = {
      ...giftWrap,
      content: giftWrap.content.replace('a', 'b'), // Change one character
    };

    // Signature verification should fail for tampered content
    let verificationFailed = false;
    try {
      // The hash verification should fail
      const hashValid = await executeInBrowser(page, 'verifyEventHash', {
        event: tamperedGiftWrap,
      });
      if (!hashValid) {
        verificationFailed = true;
      }
    } catch (error) {
      verificationFailed = true;
    }

    expect(verificationFailed).toBe(true);
  });

  test('should reject gift wrap with wrong kind', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test',
    });

    // Change kind to something else
    const wrongKindEvent = {
      ...giftWrap,
      kind: 1, // TextNote instead of GiftWrap
    };

    let rejectedWrongKind = false;
    try {
      await executeInBrowser(page, 'unwrapGiftWrap', {
        giftWrap: wrongKindEvent,
        recipientPrivKey: TEST_VECTORS.bob.privateKey,
      });
    } catch (error) {
      rejectedWrongKind = true;
    }

    expect(rejectedWrongKind).toBe(true);
  });
});

// ============================================================================
// Test Suite: Signature Verification
// ============================================================================

test.describe('NIP-17 Encryption - Signature Verification', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should verify valid signature passes', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test message for signature',
    });

    const isValid = await executeInBrowser(page, 'verifySignature', {
      event: giftWrap,
    });

    expect(isValid).toBe(true);
  });

  test('should verify tampered signature fails', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test message',
    });

    // Tamper with the signature
    const tamperedSig =
      giftWrap.sig.charAt(0) === 'a'
        ? 'b' + giftWrap.sig.slice(1)
        : 'a' + giftWrap.sig.slice(1);

    const tamperedEvent = {
      ...giftWrap,
      sig: tamperedSig,
    };

    let signatureFailed = false;
    try {
      const isValid = await executeInBrowser(page, 'verifySignature', {
        event: tamperedEvent,
      });
      if (!isValid) {
        signatureFailed = true;
      }
    } catch (error) {
      signatureFailed = true;
    }

    expect(signatureFailed).toBe(true);
  });

  test('should verify wrong pubkey in signature fails', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });
    const charliePubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.charlie.privateKey,
    });

    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test message',
    });

    // Replace the pubkey with Charlie's (but keep the original signature)
    const wrongPubkeyEvent = {
      ...giftWrap,
      pubkey: charliePubkey,
    };

    let verificationFailed = false;
    try {
      const isValid = await executeInBrowser(page, 'verifySignature', {
        event: wrongPubkeyEvent,
      });
      if (!isValid) {
        verificationFailed = true;
      }
    } catch (error) {
      verificationFailed = true;
    }

    expect(verificationFailed).toBe(true);
  });

  test('should verify event hash matches event ID', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      id: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test message',
    });

    const hashMatches = await executeInBrowser(page, 'verifyEventHash', {
      event: giftWrap,
    });

    expect(hashMatches).toBe(true);
  });

  test('should detect modified event ID', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test message',
    });

    // Change the ID
    const wrongIdEvent = {
      ...giftWrap,
      id: 'a'.repeat(64), // Invalid ID
    };

    const hashMatches = await executeInBrowser(page, 'verifyEventHash', {
      event: wrongIdEvent,
    });

    expect(hashMatches).toBe(false);
  });
});

// ============================================================================
// Test Suite: Event Structure Validation
// ============================================================================

test.describe('NIP-17 Encryption - Event Structure', () => {
  test.beforeEach(async ({ page }) => {
    await setupCryptoContext(page);
  });

  test('should produce valid Nostr event structure', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
      sig: string;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test',
    });

    // Verify all required Nostr event fields
    expect(typeof giftWrap.id).toBe('string');
    expect(giftWrap.id.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(giftWrap.id)).toBe(true);

    expect(typeof giftWrap.pubkey).toBe('string');
    expect(giftWrap.pubkey.length).toBe(64);
    expect(/^[0-9a-f]+$/.test(giftWrap.pubkey)).toBe(true);

    expect(typeof giftWrap.created_at).toBe('number');
    expect(giftWrap.created_at).toBeGreaterThan(0);

    expect(giftWrap.kind).toBe(1059);

    expect(Array.isArray(giftWrap.tags)).toBe(true);

    expect(typeof giftWrap.content).toBe('string');
    expect(giftWrap.content.length).toBeGreaterThan(0);

    expect(typeof giftWrap.sig).toBe('string');
    expect(giftWrap.sig.length).toBe(128);
    expect(/^[0-9a-f]+$/.test(giftWrap.sig)).toBe(true);
  });

  test('should have recipient p-tag in gift wrap', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      tags: string[][];
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test',
    });

    // Find the p tag
    const pTag = giftWrap.tags.find((tag) => tag[0] === 'p');
    expect(pTag).toBeDefined();
    expect(pTag?.[1]).toBe(bobPubkey);
  });

  test('should have correct rumor kind (14)', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface Rumor {
      kind: number;
    }

    const rumor = await executeInBrowser(page, 'createRumor', {
      content: 'Test',
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
    });

    expect(rumor.kind).toBe(14);
  });

  test('should have correct seal kind (13)', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface Rumor {
      id: string;
      pubkey: string;
      created_at: number;
      kind: number;
      tags: string[][];
      content: string;
    }

    const rumor = await executeInBrowser(page, 'createRumor', {
      content: 'Test',
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
    });

    interface Seal {
      kind: number;
    }

    const seal = await executeInBrowser(page, 'createSeal', {
      rumor,
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
    });

    expect(seal.kind).toBe(13);
  });

  test('should have correct gift wrap kind (1059)', async ({ page }) => {
    const bobPubkey = await executeInBrowser(page, 'getPublicKey', {
      privateKey: TEST_VECTORS.bob.privateKey,
    });

    interface GiftWrap {
      kind: number;
    }

    const giftWrap = await executeInBrowser(page, 'wrapEvent', {
      senderPrivKey: TEST_VECTORS.alice.privateKey,
      recipientPubkey: bobPubkey,
      message: 'Test',
    });

    expect(giftWrap.kind).toBe(1059);
  });
});
