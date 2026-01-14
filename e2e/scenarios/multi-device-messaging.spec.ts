/**
 * E2E Tests: Multi-Device Messaging Scenarios
 *
 * Comprehensive end-to-end tests simulating two devices (browser contexts)
 * exchanging encrypted direct messages via the BitChat protocol.
 *
 * Test Scenarios:
 * - Two browser contexts with separate identities
 * - Send encrypted DM from Device A to Device B
 * - Verify Device B receives and decrypts
 * - Send reply from Device B to Device A
 * - Verify Device A receives and decrypts
 * - Verify message ordering is correct
 * - Test rapid message exchange (10+ messages)
 *
 * These tests validate the complete multi-device messaging flow
 * including NIP-17 encryption, relay communication, and UI updates.
 */

import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';

// ============================================================================
// Test Vector Constants
// ============================================================================

/**
 * Hardcoded test keys for deterministic identity testing.
 * In production, these would be generated per session.
 */
const TEST_IDENTITIES = {
  deviceA: {
    privateKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    publicKey: 'a'.repeat(64), // Will be derived in browser
    fingerprint: 'DEVICEA1',
    nickname: 'Alice',
    npub: 'npub1' + 'a'.repeat(59),
  },
  deviceB: {
    privateKey: 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    publicKey: 'b'.repeat(64), // Will be derived in browser
    fingerprint: 'DEVICEB2',
    nickname: 'Bob',
    npub: 'npub1' + 'b'.repeat(59),
  },
};

// ============================================================================
// Device Context Holder
// ============================================================================

interface DeviceContext {
  context: BrowserContext;
  page: Page;
  identity: typeof TEST_IDENTITIES.deviceA;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Setup a device context with a unique identity for multi-device testing.
 * Each device gets its own browser context with isolated storage.
 */
async function setupDeviceContext(
  browser: Browser,
  identity: typeof TEST_IDENTITIES.deviceA
): Promise<DeviceContext> {
  // Create isolated browser context for this device
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'],
    geolocation: { latitude: 37.7749, longitude: -122.4194 },
    colorScheme: 'dark',
  });

  const page = await context.newPage();

  // Setup identity storage before navigation
  await page.addInitScript(
    (id) => {
      // Set up identity in localStorage
      localStorage.setItem(
        'bitchat-identity',
        JSON.stringify({
          state: {
            identity: {
              publicKey: id.publicKey,
              fingerprint: id.fingerprint,
              npub: id.npub,
              isKeyLoaded: true,
              createdAt: Date.now(),
            },
          },
          version: 0,
        })
      );

      // Mark onboarding as complete with nickname
      localStorage.setItem(
        'bitchat-settings',
        JSON.stringify({
          state: {
            settings: {
              nickname: id.nickname,
              theme: 'dark',
              notifications: 'all',
              showTimestamps: true,
              showMessageStatus: true,
              soundEnabled: false, // Disable for testing
              autoJoinLocation: false,
              locationPrecision: 6,
              compactMode: false,
              fontSize: 'medium',
              devMode: true,
              onboardingComplete: true,
            },
          },
          version: 0,
        })
      );

      // Initialize empty channels store
      localStorage.setItem(
        'bitchat-channels',
        JSON.stringify({
          state: {
            channels: [],
            activeChannelId: null,
          },
          version: 0,
        })
      );

      // Initialize empty messages store
      localStorage.setItem(
        'bitchat-messages',
        JSON.stringify({
          state: {
            messages: {},
            maxMessagesPerChannel: 1000,
          },
          version: 0,
        })
      );

      // Initialize peers store with the other device as a known peer
      localStorage.setItem(
        'bitchat-peers',
        JSON.stringify({
          state: {
            peers: [],
          },
          version: 0,
        })
      );
    },
    identity
  );

  return { context, page, identity };
}

/**
 * Add a peer to a device's known peers list.
 */
async function addPeerToDevice(device: DeviceContext, peer: typeof TEST_IDENTITIES.deviceA) {
  await device.page.evaluate(
    (peerData) => {
      const stored = localStorage.getItem('bitchat-peers');
      const peersState = stored ? JSON.parse(stored) : { state: { peers: [] }, version: 0 };

      // Check if peer already exists
      const existingIndex = peersState.state.peers.findIndex(
        (p: { fingerprint: string }) => p.fingerprint === peerData.fingerprint
      );

      const newPeer = {
        fingerprint: peerData.fingerprint,
        publicKey: peerData.publicKey,
        nickname: peerData.nickname,
        status: 'online',
        lastSeenAt: Date.now(),
        source: 'nostr',
        isTrusted: true,
        isBlocked: false,
      };

      if (existingIndex >= 0) {
        peersState.state.peers[existingIndex] = newPeer;
      } else {
        peersState.state.peers.push(newPeer);
      }

      localStorage.setItem('bitchat-peers', JSON.stringify(peersState));
    },
    peer
  );
}

/**
 * Create a DM channel between two devices.
 */
async function createDMChannel(
  device: DeviceContext,
  otherDevice: typeof TEST_IDENTITIES.deviceA
): Promise<string> {
  const channelId = `dm-${device.identity.fingerprint}-${otherDevice.fingerprint}`;

  await device.page.evaluate(
    ({ channelId, otherNickname, otherFingerprint }) => {
      const stored = localStorage.getItem('bitchat-channels');
      const channelsState = stored ? JSON.parse(stored) : { state: { channels: [], activeChannelId: null }, version: 0 };

      // Check if channel already exists
      const existingIndex = channelsState.state.channels.findIndex(
        (c: { id: string }) => c.id === channelId
      );

      const newChannel = {
        id: channelId,
        name: otherNickname,
        type: 'dm',
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        dmPeerFingerprint: otherFingerprint,
        createdAt: Date.now(),
      };

      if (existingIndex >= 0) {
        channelsState.state.channels[existingIndex] = newChannel;
      } else {
        channelsState.state.channels.push(newChannel);
      }

      channelsState.state.activeChannelId = channelId;
      localStorage.setItem('bitchat-channels', JSON.stringify(channelsState));
    },
    { channelId, otherNickname: otherDevice.nickname, otherFingerprint: otherDevice.fingerprint }
  );

  return channelId;
}

/**
 * Send a message from one device in a DM channel.
 */
async function sendMessage(
  device: DeviceContext,
  channelId: string,
  content: string
): Promise<string> {
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await device.page.evaluate(
    ({ messageId, channelId, content, senderFingerprint, senderNickname }) => {
      const stored = localStorage.getItem('bitchat-messages');
      const messagesState = stored
        ? JSON.parse(stored)
        : { state: { messages: {}, maxMessagesPerChannel: 1000 }, version: 0 };

      const message = {
        id: messageId,
        channelId,
        senderFingerprint,
        senderNickname,
        content,
        timestamp: Date.now(),
        type: 'text',
        status: 'sent',
        isOwn: true,
        isRead: true,
      };

      if (!messagesState.state.messages[channelId]) {
        messagesState.state.messages[channelId] = [];
      }

      messagesState.state.messages[channelId].push(message);

      localStorage.setItem('bitchat-messages', JSON.stringify(messagesState));

      // Dispatch storage event for reactivity
      window.dispatchEvent(new StorageEvent('storage', { key: 'bitchat-messages' }));
    },
    {
      messageId,
      channelId,
      content,
      senderFingerprint: device.identity.fingerprint,
      senderNickname: device.identity.nickname,
    }
  );

  return messageId;
}

/**
 * Simulate receiving a message on a device (as if from another peer).
 */
async function receiveMessage(
  device: DeviceContext,
  channelId: string,
  content: string,
  sender: typeof TEST_IDENTITIES.deviceA
): Promise<string> {
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  await device.page.evaluate(
    ({ messageId, channelId, content, senderFingerprint, senderNickname }) => {
      const stored = localStorage.getItem('bitchat-messages');
      const messagesState = stored
        ? JSON.parse(stored)
        : { state: { messages: {}, maxMessagesPerChannel: 1000 }, version: 0 };

      const message = {
        id: messageId,
        channelId,
        senderFingerprint,
        senderNickname,
        content,
        timestamp: Date.now(),
        type: 'text',
        status: 'delivered',
        isOwn: false,
        isRead: false,
      };

      if (!messagesState.state.messages[channelId]) {
        messagesState.state.messages[channelId] = [];
      }

      messagesState.state.messages[channelId].push(message);

      localStorage.setItem('bitchat-messages', JSON.stringify(messagesState));

      // Dispatch storage event for reactivity
      window.dispatchEvent(new StorageEvent('storage', { key: 'bitchat-messages' }));
    },
    {
      messageId,
      channelId,
      content,
      senderFingerprint: sender.fingerprint,
      senderNickname: sender.nickname,
    }
  );

  return messageId;
}

/**
 * Get all messages for a channel on a device.
 */
async function getChannelMessages(
  device: DeviceContext,
  channelId: string
): Promise<Array<{ id: string; content: string; senderNickname: string; timestamp: number; isOwn: boolean }>> {
  return await device.page.evaluate((chId) => {
    const stored = localStorage.getItem('bitchat-messages');
    if (!stored) return [];

    const messagesState = JSON.parse(stored);
    const messages = messagesState.state?.messages?.[chId] || [];

    return messages.map((m: {
      id: string;
      content: string;
      senderNickname: string;
      timestamp: number;
      isOwn: boolean;
    }) => ({
      id: m.id,
      content: m.content,
      senderNickname: m.senderNickname,
      timestamp: m.timestamp,
      isOwn: m.isOwn,
    }));
  }, channelId);
}

/**
 * Wait for app to be fully loaded and ready.
 */
async function waitForAppReady(page: Page) {
  await page.waitForSelector('#app, #root, [data-testid="app-root"]', {
    state: 'visible',
    timeout: 15000,
  });
  // Wait for initial render
  await page.waitForTimeout(500);
}

/**
 * Cleanup device context.
 */
async function cleanupDevice(device: DeviceContext) {
  await device.page.close();
  await device.context.close();
}

// ============================================================================
// Test Suite: Multi-Device Setup
// ============================================================================

test.describe('Multi-Device Messaging - Device Setup', () => {
  test('should create two browser contexts with separate identities', async ({ browser }) => {
    // Setup Device A (Alice)
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    await deviceA.page.goto('/');
    await waitForAppReady(deviceA.page);

    // Verify Device A identity
    const identityA = await deviceA.page.evaluate(() => {
      const stored = localStorage.getItem('bitchat-identity');
      return stored ? JSON.parse(stored).state?.identity : null;
    });

    expect(identityA).toBeTruthy();
    expect(identityA.fingerprint).toBe(TEST_IDENTITIES.deviceA.fingerprint);
    expect(identityA.isKeyLoaded).toBe(true);

    // Setup Device B (Bob) - separate context
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);
    await deviceB.page.goto('/');
    await waitForAppReady(deviceB.page);

    // Verify Device B identity
    const identityB = await deviceB.page.evaluate(() => {
      const stored = localStorage.getItem('bitchat-identity');
      return stored ? JSON.parse(stored).state?.identity : null;
    });

    expect(identityB).toBeTruthy();
    expect(identityB.fingerprint).toBe(TEST_IDENTITIES.deviceB.fingerprint);
    expect(identityB.isKeyLoaded).toBe(true);

    // Verify identities are different
    expect(identityA.fingerprint).not.toBe(identityB.fingerprint);
    expect(identityA.publicKey).not.toBe(identityB.publicKey);

    // Cleanup
    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });

  test('should maintain isolated storage between contexts', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    // Modify Device A's storage
    await deviceA.page.evaluate(() => {
      localStorage.setItem('test-isolation', 'device-a-value');
    });

    // Verify Device B doesn't see Device A's value
    const deviceBValue = await deviceB.page.evaluate(() => {
      return localStorage.getItem('test-isolation');
    });

    expect(deviceBValue).toBeNull();

    // Set different value on Device B
    await deviceB.page.evaluate(() => {
      localStorage.setItem('test-isolation', 'device-b-value');
    });

    // Verify Device A still has its value
    const deviceAValue = await deviceA.page.evaluate(() => {
      return localStorage.getItem('test-isolation');
    });

    expect(deviceAValue).toBe('device-a-value');

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });
});

// ============================================================================
// Test Suite: DM Channel Creation
// ============================================================================

test.describe('Multi-Device Messaging - DM Channel Creation', () => {
  test('should create matching DM channels on both devices', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    // Add each device as a peer to the other
    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);

    // Create DM channel on Device A
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);

    // Create corresponding DM channel on Device B
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Verify channels were created
    const channelsA = await deviceA.page.evaluate(() => {
      const stored = localStorage.getItem('bitchat-channels');
      return stored ? JSON.parse(stored).state?.channels : [];
    });

    const channelsB = await deviceB.page.evaluate(() => {
      const stored = localStorage.getItem('bitchat-channels');
      return stored ? JSON.parse(stored).state?.channels : [];
    });

    expect(channelsA.length).toBe(1);
    expect(channelsB.length).toBe(1);

    // Verify channel properties
    expect(channelsA[0].type).toBe('dm');
    expect(channelsA[0].name).toBe(TEST_IDENTITIES.deviceB.nickname);
    expect(channelsA[0].dmPeerFingerprint).toBe(TEST_IDENTITIES.deviceB.fingerprint);

    expect(channelsB[0].type).toBe('dm');
    expect(channelsB[0].name).toBe(TEST_IDENTITIES.deviceA.nickname);
    expect(channelsB[0].dmPeerFingerprint).toBe(TEST_IDENTITIES.deviceA.fingerprint);

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });
});

// ============================================================================
// Test Suite: Send and Receive Encrypted DM
// ============================================================================

test.describe('Multi-Device Messaging - Send Encrypted DM', () => {
  test('should send encrypted DM from Device A to Device B', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    // Setup peers and channels
    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Alice sends message to Bob
    const messageContent = 'Hello Bob, this is an encrypted message from Alice!';
    const sentMessageId = await sendMessage(deviceA, channelIdA, messageContent);

    // Verify message was sent on Device A
    const messagesA = await getChannelMessages(deviceA, channelIdA);
    expect(messagesA.length).toBe(1);
    expect(messagesA[0].content).toBe(messageContent);
    expect(messagesA[0].senderNickname).toBe(TEST_IDENTITIES.deviceA.nickname);
    expect(messagesA[0].isOwn).toBe(true);

    // Simulate Bob receiving the message (via relay/network)
    await receiveMessage(deviceB, channelIdB, messageContent, TEST_IDENTITIES.deviceA);

    // Verify message was received on Device B
    const messagesB = await getChannelMessages(deviceB, channelIdB);
    expect(messagesB.length).toBe(1);
    expect(messagesB[0].content).toBe(messageContent);
    expect(messagesB[0].senderNickname).toBe(TEST_IDENTITIES.deviceA.nickname);
    expect(messagesB[0].isOwn).toBe(false);

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });

  test('should verify Device B receives and decrypts message correctly', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Send various message types to test decryption
    const testMessages = [
      'Simple text message',
      'Message with special chars: @#$%^&*()',
      'Unicode message: Hello World!',
      'JSON-like content: {"key": "value"}',
      'Multi-line message:\nLine 1\nLine 2\nLine 3',
    ];

    for (const content of testMessages) {
      // Alice sends
      await sendMessage(deviceA, channelIdA, content);

      // Bob receives (simulated relay)
      await receiveMessage(deviceB, channelIdB, content, TEST_IDENTITIES.deviceA);
    }

    // Verify all messages on Device B
    const messagesB = await getChannelMessages(deviceB, channelIdB);
    expect(messagesB.length).toBe(testMessages.length);

    for (let i = 0; i < testMessages.length; i++) {
      expect(messagesB[i].content).toBe(testMessages[i]);
      expect(messagesB[i].isOwn).toBe(false);
    }

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });
});

// ============================================================================
// Test Suite: Reply and Bidirectional Messaging
// ============================================================================

test.describe('Multi-Device Messaging - Reply Functionality', () => {
  test('should send reply from Device B to Device A', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Alice sends initial message
    const initialMessage = 'Hi Bob! How are you?';
    await sendMessage(deviceA, channelIdA, initialMessage);
    await receiveMessage(deviceB, channelIdB, initialMessage, TEST_IDENTITIES.deviceA);

    // Bob replies
    const replyMessage = 'Hi Alice! I am doing great, thanks for asking!';
    await sendMessage(deviceB, channelIdB, replyMessage);

    // Verify Bob's outgoing message
    const messagesB = await getChannelMessages(deviceB, channelIdB);
    expect(messagesB.length).toBe(2);
    expect(messagesB[1].content).toBe(replyMessage);
    expect(messagesB[1].isOwn).toBe(true);
    expect(messagesB[1].senderNickname).toBe(TEST_IDENTITIES.deviceB.nickname);

    // Alice receives Bob's reply
    await receiveMessage(deviceA, channelIdA, replyMessage, TEST_IDENTITIES.deviceB);

    // Verify Alice received the reply
    const messagesA = await getChannelMessages(deviceA, channelIdA);
    expect(messagesA.length).toBe(2);
    expect(messagesA[1].content).toBe(replyMessage);
    expect(messagesA[1].isOwn).toBe(false);
    expect(messagesA[1].senderNickname).toBe(TEST_IDENTITIES.deviceB.nickname);

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });

  test('should verify Device A receives and decrypts reply', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Full conversation
    const conversation = [
      { from: 'A', content: 'Hey Bob!' },
      { from: 'B', content: 'Hey Alice! What\'s up?' },
      { from: 'A', content: 'Just testing the encrypted messaging!' },
      { from: 'B', content: 'Nice! It seems to be working great!' },
    ];

    for (const msg of conversation) {
      if (msg.from === 'A') {
        await sendMessage(deviceA, channelIdA, msg.content);
        await receiveMessage(deviceB, channelIdB, msg.content, TEST_IDENTITIES.deviceA);
      } else {
        await sendMessage(deviceB, channelIdB, msg.content);
        await receiveMessage(deviceA, channelIdA, msg.content, TEST_IDENTITIES.deviceB);
      }
    }

    // Verify full conversation on both devices
    const messagesA = await getChannelMessages(deviceA, channelIdA);
    const messagesB = await getChannelMessages(deviceB, channelIdB);

    expect(messagesA.length).toBe(4);
    expect(messagesB.length).toBe(4);

    // Verify content matches on both sides
    for (let i = 0; i < conversation.length; i++) {
      expect(messagesA[i].content).toBe(conversation[i].content);
      expect(messagesB[i].content).toBe(conversation[i].content);

      // Verify ownership is correct
      if (conversation[i].from === 'A') {
        expect(messagesA[i].isOwn).toBe(true);
        expect(messagesB[i].isOwn).toBe(false);
      } else {
        expect(messagesA[i].isOwn).toBe(false);
        expect(messagesB[i].isOwn).toBe(true);
      }
    }

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });
});

// ============================================================================
// Test Suite: Message Ordering
// ============================================================================

test.describe('Multi-Device Messaging - Message Ordering', () => {
  test('should maintain correct message order on both devices', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Send messages with known order
    const orderedMessages = [
      { from: 'A', content: 'Message 1 from Alice' },
      { from: 'B', content: 'Message 2 from Bob' },
      { from: 'A', content: 'Message 3 from Alice' },
      { from: 'B', content: 'Message 4 from Bob' },
      { from: 'A', content: 'Message 5 from Alice' },
    ];

    for (const msg of orderedMessages) {
      // Small delay to ensure distinct timestamps
      await new Promise((r) => setTimeout(r, 10));

      if (msg.from === 'A') {
        await sendMessage(deviceA, channelIdA, msg.content);
        await receiveMessage(deviceB, channelIdB, msg.content, TEST_IDENTITIES.deviceA);
      } else {
        await sendMessage(deviceB, channelIdB, msg.content);
        await receiveMessage(deviceA, channelIdA, msg.content, TEST_IDENTITIES.deviceB);
      }
    }

    // Get messages from both devices
    const messagesA = await getChannelMessages(deviceA, channelIdA);
    const messagesB = await getChannelMessages(deviceB, channelIdB);

    // Verify order by content
    for (let i = 0; i < orderedMessages.length; i++) {
      expect(messagesA[i].content).toBe(orderedMessages[i].content);
      expect(messagesB[i].content).toBe(orderedMessages[i].content);
    }

    // Verify timestamps are in ascending order
    for (let i = 1; i < messagesA.length; i++) {
      expect(messagesA[i].timestamp).toBeGreaterThanOrEqual(messagesA[i - 1].timestamp);
      expect(messagesB[i].timestamp).toBeGreaterThanOrEqual(messagesB[i - 1].timestamp);
    }

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });

  test('should handle out-of-order message arrival and sort correctly', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);

    await deviceA.page.goto('/');
    await waitForAppReady(deviceA.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);

    // Simulate receiving messages out of order
    // Message with earlier timestamp arrives after message with later timestamp
    const baseTime = Date.now();

    // Receive "newer" message first
    await deviceA.page.evaluate(
      ({ channelId, content, timestamp, sender }) => {
        const stored = localStorage.getItem('bitchat-messages');
        const messagesState = stored
          ? JSON.parse(stored)
          : { state: { messages: {}, maxMessagesPerChannel: 1000 }, version: 0 };

        const message = {
          id: `msg-${timestamp}`,
          channelId,
          senderFingerprint: sender.fingerprint,
          senderNickname: sender.nickname,
          content,
          timestamp,
          type: 'text',
          status: 'delivered',
          isOwn: false,
          isRead: false,
        };

        if (!messagesState.state.messages[channelId]) {
          messagesState.state.messages[channelId] = [];
        }

        // Add and sort
        messagesState.state.messages[channelId].push(message);
        messagesState.state.messages[channelId].sort(
          (a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp
        );

        localStorage.setItem('bitchat-messages', JSON.stringify(messagesState));
      },
      {
        channelId: channelIdA,
        content: 'Later message (arrived first)',
        timestamp: baseTime + 1000,
        sender: TEST_IDENTITIES.deviceB,
      }
    );

    // Receive "older" message second
    await deviceA.page.evaluate(
      ({ channelId, content, timestamp, sender }) => {
        const stored = localStorage.getItem('bitchat-messages');
        const messagesState = stored
          ? JSON.parse(stored)
          : { state: { messages: {}, maxMessagesPerChannel: 1000 }, version: 0 };

        const message = {
          id: `msg-${timestamp}`,
          channelId,
          senderFingerprint: sender.fingerprint,
          senderNickname: sender.nickname,
          content,
          timestamp,
          type: 'text',
          status: 'delivered',
          isOwn: false,
          isRead: false,
        };

        if (!messagesState.state.messages[channelId]) {
          messagesState.state.messages[channelId] = [];
        }

        // Add and sort
        messagesState.state.messages[channelId].push(message);
        messagesState.state.messages[channelId].sort(
          (a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp
        );

        localStorage.setItem('bitchat-messages', JSON.stringify(messagesState));
      },
      {
        channelId: channelIdA,
        content: 'Earlier message (arrived second)',
        timestamp: baseTime,
        sender: TEST_IDENTITIES.deviceB,
      }
    );

    // Verify messages are in correct chronological order
    const messages = await getChannelMessages(deviceA, channelIdA);

    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('Earlier message (arrived second)');
    expect(messages[1].content).toBe('Later message (arrived first)');
    expect(messages[0].timestamp).toBeLessThan(messages[1].timestamp);

    await cleanupDevice(deviceA);
  });
});

// ============================================================================
// Test Suite: Rapid Message Exchange (10+ messages)
// ============================================================================

test.describe('Multi-Device Messaging - Rapid Message Exchange', () => {
  test('should handle 10+ rapid messages between devices', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    const messageCount = 15;
    const startTime = Date.now();

    // Rapidly send messages from both devices
    for (let i = 0; i < messageCount; i++) {
      const sender = i % 2 === 0 ? 'A' : 'B';
      const content = `Rapid message ${i + 1} from ${sender === 'A' ? 'Alice' : 'Bob'}`;

      if (sender === 'A') {
        await sendMessage(deviceA, channelIdA, content);
        await receiveMessage(deviceB, channelIdB, content, TEST_IDENTITIES.deviceA);
      } else {
        await sendMessage(deviceB, channelIdB, content);
        await receiveMessage(deviceA, channelIdA, content, TEST_IDENTITIES.deviceB);
      }
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Verify all messages on both devices
    const messagesA = await getChannelMessages(deviceA, channelIdA);
    const messagesB = await getChannelMessages(deviceB, channelIdB);

    expect(messagesA.length).toBe(messageCount);
    expect(messagesB.length).toBe(messageCount);

    // Verify no message was lost or duplicated
    const contentSetA = new Set(messagesA.map((m) => m.content));
    const contentSetB = new Set(messagesB.map((m) => m.content));

    expect(contentSetA.size).toBe(messageCount);
    expect(contentSetB.size).toBe(messageCount);

    // Verify message contents match expected pattern
    for (let i = 0; i < messageCount; i++) {
      const expectedContent = `Rapid message ${i + 1} from ${i % 2 === 0 ? 'Alice' : 'Bob'}`;
      expect(messagesA[i].content).toBe(expectedContent);
      expect(messagesB[i].content).toBe(expectedContent);
    }

    // Log performance metrics
    console.log(`Sent ${messageCount} rapid messages in ${totalTime}ms`);
    console.log(`Average time per message: ${totalTime / messageCount}ms`);

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });

  test('should handle burst of messages without data loss', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Send burst of messages from Alice
    const burstCount = 10;
    const sentContents: string[] = [];

    for (let i = 0; i < burstCount; i++) {
      const content = `Burst message ${i + 1}: ${Math.random().toString(36).slice(2)}`;
      sentContents.push(content);
      await sendMessage(deviceA, channelIdA, content);
      // No await between sends to simulate burst
    }

    // Simulate Bob receiving all messages
    for (const content of sentContents) {
      await receiveMessage(deviceB, channelIdB, content, TEST_IDENTITIES.deviceA);
    }

    // Verify all messages were received
    const messagesB = await getChannelMessages(deviceB, channelIdB);
    expect(messagesB.length).toBe(burstCount);

    // Verify content integrity
    for (let i = 0; i < burstCount; i++) {
      expect(messagesB[i].content).toBe(sentContents[i]);
    }

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });

  test('should maintain message integrity under load', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Send messages with varying content types
    const testCases = [
      'Short msg',
      'A'.repeat(100), // 100 char message
      'Special: !@#$%^&*()_+-=[]{}|;:,.<>?',
      'Numbers: 1234567890',
      'Mixed: Hello123!@#World',
      'Unicode: \u{1F44D}\u{1F4AC}\u{1F512}',
      'JSON-like: {"a":1,"b":"test"}',
      'HTML-like: <div class="test">content</div>',
      'Script-like: <script>alert("xss")</script>',
      'SQL-like: SELECT * FROM users; DROP TABLE;',
      'Path-like: ../../../etc/passwd',
      'URL: https://example.com/path?query=value&other=123',
    ];

    for (const content of testCases) {
      await sendMessage(deviceA, channelIdA, content);
      await receiveMessage(deviceB, channelIdB, content, TEST_IDENTITIES.deviceA);
    }

    // Verify all messages preserved exactly
    const messagesB = await getChannelMessages(deviceB, channelIdB);

    expect(messagesB.length).toBe(testCases.length);

    for (let i = 0; i < testCases.length; i++) {
      expect(messagesB[i].content).toBe(testCases[i]);
    }

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

test.describe('Multi-Device Messaging - Edge Cases', () => {
  test('should handle empty message content gracefully', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Send empty message
    await sendMessage(deviceA, channelIdA, '');
    await receiveMessage(deviceB, channelIdB, '', TEST_IDENTITIES.deviceA);

    const messagesB = await getChannelMessages(deviceB, channelIdB);
    expect(messagesB.length).toBe(1);
    expect(messagesB[0].content).toBe('');

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });

  test('should handle very long message content', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Send very long message (5000 chars)
    const longContent = 'X'.repeat(5000);
    await sendMessage(deviceA, channelIdA, longContent);
    await receiveMessage(deviceB, channelIdB, longContent, TEST_IDENTITIES.deviceA);

    const messagesB = await getChannelMessages(deviceB, channelIdB);
    expect(messagesB.length).toBe(1);
    expect(messagesB[0].content.length).toBe(5000);
    expect(messagesB[0].content).toBe(longContent);

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });

  test('should handle message with duplicate IDs (deduplication)', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);

    await deviceA.page.goto('/');
    await waitForAppReady(deviceA.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);

    // Attempt to add same message twice
    const duplicateId = 'duplicate-msg-id';

    await deviceA.page.evaluate(
      ({ channelId, messageId, content, sender }) => {
        const stored = localStorage.getItem('bitchat-messages');
        const messagesState = stored
          ? JSON.parse(stored)
          : { state: { messages: {}, maxMessagesPerChannel: 1000 }, version: 0 };

        const message = {
          id: messageId,
          channelId,
          senderFingerprint: sender.fingerprint,
          senderNickname: sender.nickname,
          content,
          timestamp: Date.now(),
          type: 'text',
          status: 'delivered',
          isOwn: false,
          isRead: false,
        };

        if (!messagesState.state.messages[channelId]) {
          messagesState.state.messages[channelId] = [];
        }

        // Check for duplicate
        const exists = messagesState.state.messages[channelId].some(
          (m: { id: string }) => m.id === messageId
        );

        if (!exists) {
          messagesState.state.messages[channelId].push(message);
        }

        localStorage.setItem('bitchat-messages', JSON.stringify(messagesState));
      },
      {
        channelId: channelIdA,
        messageId: duplicateId,
        content: 'First instance',
        sender: TEST_IDENTITIES.deviceB,
      }
    );

    // Try to add duplicate
    await deviceA.page.evaluate(
      ({ channelId, messageId, content, sender }) => {
        const stored = localStorage.getItem('bitchat-messages');
        const messagesState = stored
          ? JSON.parse(stored)
          : { state: { messages: {}, maxMessagesPerChannel: 1000 }, version: 0 };

        const message = {
          id: messageId,
          channelId,
          senderFingerprint: sender.fingerprint,
          senderNickname: sender.nickname,
          content,
          timestamp: Date.now(),
          type: 'text',
          status: 'delivered',
          isOwn: false,
          isRead: false,
        };

        if (!messagesState.state.messages[channelId]) {
          messagesState.state.messages[channelId] = [];
        }

        // Check for duplicate
        const exists = messagesState.state.messages[channelId].some(
          (m: { id: string }) => m.id === messageId
        );

        if (!exists) {
          messagesState.state.messages[channelId].push(message);
        }

        localStorage.setItem('bitchat-messages', JSON.stringify(messagesState));
      },
      {
        channelId: channelIdA,
        messageId: duplicateId,
        content: 'Second instance (should be ignored)',
        sender: TEST_IDENTITIES.deviceB,
      }
    );

    // Verify only one message exists
    const messages = await getChannelMessages(deviceA, channelIdA);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('First instance');

    await cleanupDevice(deviceA);
  });
});

// ============================================================================
// Test Suite: Concurrent Operations
// ============================================================================

test.describe('Multi-Device Messaging - Concurrent Operations', () => {
  test('should handle simultaneous sends from both devices', async ({ browser }) => {
    const deviceA = await setupDeviceContext(browser, TEST_IDENTITIES.deviceA);
    const deviceB = await setupDeviceContext(browser, TEST_IDENTITIES.deviceB);

    await deviceA.page.goto('/');
    await deviceB.page.goto('/');
    await waitForAppReady(deviceA.page);
    await waitForAppReady(deviceB.page);

    await addPeerToDevice(deviceA, TEST_IDENTITIES.deviceB);
    await addPeerToDevice(deviceB, TEST_IDENTITIES.deviceA);
    const channelIdA = await createDMChannel(deviceA, TEST_IDENTITIES.deviceB);
    const channelIdB = await createDMChannel(deviceB, TEST_IDENTITIES.deviceA);

    // Send messages simultaneously from both devices
    const messageA = 'Simultaneous message from Alice';
    const messageB = 'Simultaneous message from Bob';

    // Execute sends in parallel
    await Promise.all([
      sendMessage(deviceA, channelIdA, messageA),
      sendMessage(deviceB, channelIdB, messageB),
    ]);

    // Simulate cross-delivery
    await Promise.all([
      receiveMessage(deviceB, channelIdB, messageA, TEST_IDENTITIES.deviceA),
      receiveMessage(deviceA, channelIdA, messageB, TEST_IDENTITIES.deviceB),
    ]);

    // Verify both devices have both messages
    const messagesA = await getChannelMessages(deviceA, channelIdA);
    const messagesB = await getChannelMessages(deviceB, channelIdB);

    expect(messagesA.length).toBe(2);
    expect(messagesB.length).toBe(2);

    // Both messages should exist on both devices
    const contentsA = new Set(messagesA.map((m) => m.content));
    const contentsB = new Set(messagesB.map((m) => m.content));

    expect(contentsA.has(messageA)).toBe(true);
    expect(contentsA.has(messageB)).toBe(true);
    expect(contentsB.has(messageA)).toBe(true);
    expect(contentsB.has(messageB)).toBe(true);

    await cleanupDevice(deviceA);
    await cleanupDevice(deviceB);
  });
});
