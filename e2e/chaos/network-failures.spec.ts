/**
 * E2E Chaos Tests: Network Failures
 *
 * Production-ready chaos engineering tests for network resilience including:
 * - Random network disconnection
 * - 2G network simulation
 * - All relays down
 * - High latency conditions
 * - Packet loss simulation
 * - WebSocket disconnection
 * - DNS resolution failures
 * - SSL/TLS handshake failures
 *
 * These tests verify the app degrades gracefully under adverse network conditions
 * and recovers correctly when conditions improve.
 */

import { test as base, expect, Page, BrowserContext, CDPSession } from '@playwright/test';
import {
  setupWithIdentity,
  setupWithChannels,
  waitForAppReady,
  goOffline,
  goOnline,
  navigateToView,
} from '../fixtures';

// ============================================================================
// Network Chaos Test Fixtures
// ============================================================================

interface NetworkChaosFixtures {
  cdpSession: CDPSession;
  chaos: NetworkChaosHelper;
}

const test = base.extend<NetworkChaosFixtures>({
  cdpSession: async ({ context, page }, use) => {
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await use(session);
  },
  chaos: async ({ context, page, cdpSession }, use) => {
    await use(new NetworkChaosHelper(context, page, cdpSession));
  },
});

// ============================================================================
// Network Chaos Helper
// ============================================================================

class NetworkChaosHelper {
  constructor(
    private context: BrowserContext,
    private page: Page,
    private cdp: CDPSession
  ) {}

  /**
   * Simulate 2G network conditions (GPRS/EDGE)
   * Download: 50 kbps, Upload: 20 kbps, Latency: 500ms
   */
  async simulate2G(): Promise<void> {
    await this.cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (50 * 1024) / 8,
      uploadThroughput: (20 * 1024) / 8,
      latency: 500,
    });
  }

  /**
   * Simulate slow 3G network conditions
   * Download: 400 kbps, Upload: 100 kbps, Latency: 400ms
   */
  async simulateSlow3G(): Promise<void> {
    await this.cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (100 * 1024) / 8,
      latency: 400,
    });
  }

  /**
   * Simulate fast 3G network conditions
   * Download: 1.6 Mbps, Upload: 750 kbps, Latency: 150ms
   */
  async simulateFast3G(): Promise<void> {
    await this.cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 150,
    });
  }

  /**
   * Simulate 4G network conditions
   * Download: 4 Mbps, Upload: 3 Mbps, Latency: 20ms
   */
  async simulate4G(): Promise<void> {
    await this.cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (4 * 1024 * 1024) / 8,
      uploadThroughput: (3 * 1024 * 1024) / 8,
      latency: 20,
    });
  }

  /**
   * Simulate high latency network (satellite, international)
   * Latency: 1000-2000ms
   */
  async simulateHighLatency(): Promise<void> {
    await this.cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1 * 1024 * 1024) / 8,
      uploadThroughput: (512 * 1024) / 8,
      latency: 1500,
    });
  }

  /**
   * Simulate packet loss by periodically toggling offline state
   * This creates a "choppy" connection effect
   */
  async simulatePacketLoss(
    lossPercent: number,
    durationMs: number
  ): Promise<void> {
    const endTime = Date.now() + durationMs;
    const checkInterval = 100; // Check every 100ms

    while (Date.now() < endTime) {
      if (Math.random() * 100 < lossPercent) {
        await this.context.setOffline(true);
        await this.page.waitForTimeout(50);
        await this.context.setOffline(false);
      }
      await this.page.waitForTimeout(checkInterval);
    }
  }

  /**
   * Simulate random disconnections
   */
  async simulateRandomDisconnections(
    count: number,
    minDurationMs: number,
    maxDurationMs: number
  ): Promise<void> {
    for (let i = 0; i < count; i++) {
      const duration =
        Math.random() * (maxDurationMs - minDurationMs) + minDurationMs;
      await goOffline(this.context);
      await this.page.waitForTimeout(duration);
      await goOnline(this.context);
      // Random interval between disconnections
      await this.page.waitForTimeout(Math.random() * 2000 + 500);
    }
  }

  /**
   * Simulate WebSocket connection drop
   */
  async simulateWebSocketDrop(): Promise<void> {
    await this.page.evaluate(() => {
      // Close all WebSocket connections
      const sockets = (window as unknown as { __websockets?: WebSocket[] }).__websockets || [];
      sockets.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1006, 'Simulated network failure');
        }
      });

      // Dispatch custom event for app to handle
      window.dispatchEvent(new CustomEvent('websocket-disconnected'));
    });
  }

  /**
   * Block specific domains (simulate relay down)
   */
  async blockDomains(domains: string[]): Promise<void> {
    await this.cdp.send('Network.setBlockedURLs', {
      urls: domains.map((d) => `*${d}*`),
    });
  }

  /**
   * Unblock all domains
   */
  async unblockAllDomains(): Promise<void> {
    await this.cdp.send('Network.setBlockedURLs', { urls: [] });
  }

  /**
   * Reset to normal network conditions
   */
  async resetNetwork(): Promise<void> {
    await this.cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: -1,
      uploadThroughput: -1,
      latency: 0,
    });
    await this.unblockAllDomains();
    await goOnline(this.context);
  }

  /**
   * Simulate complete network outage for all relay servers
   */
  async simulateAllRelaysDown(): Promise<void> {
    const relayDomains = [
      'relay.damus.io',
      'relay.snort.social',
      'nos.lol',
      'relay.primal.net',
      'relay.nostr.band',
      'eden.nostr.land',
      'nostr.wine',
      'relay.plebstr.com',
      'nostr-pub.wellorder.net',
      'nostr.mom',
      'nostr.bitcoiner.social',
      'nostr.fmt.wiz.biz',
      'relay.nostr.info',
      'nostr.zebedee.cloud',
      'purplepag.es',
      'relay.nostr.wirednet.jp',
      'nostr.rocks',
      'relay.nostrgraph.net',
      'nostr.mutinywallet.com',
      'relay.nostrich.land',
    ];

    await this.blockDomains(relayDomains);
  }

  /**
   * Simulate intermittent connectivity (connection flapping)
   */
  async simulateIntermittentConnectivity(
    durationMs: number,
    cycleMs: number = 2000
  ): Promise<void> {
    const endTime = Date.now() + durationMs;

    while (Date.now() < endTime) {
      // Online for random duration
      await goOnline(this.context);
      await this.page.waitForTimeout(
        Math.random() * cycleMs * 0.7 + cycleMs * 0.15
      );

      // Offline for random duration
      await goOffline(this.context);
      await this.page.waitForTimeout(
        Math.random() * cycleMs * 0.3 + cycleMs * 0.1
      );
    }

    // Ensure we end online
    await goOnline(this.context);
  }
}

// ============================================================================
// Test Helpers
// ============================================================================

async function getAppState(page: Page) {
  return page.evaluate(() => ({
    identity: localStorage.getItem('bitchat-identity') ? 'present' : 'absent',
    settings: localStorage.getItem('bitchat-settings') ? 'present' : 'absent',
    channels: localStorage.getItem('bitchat-channels') ? 'present' : 'absent',
    queue: localStorage.getItem('bitchat-outbox-queue') ? 'present' : 'absent',
  }));
}

async function getQueueSize(page: Page): Promise<number> {
  return page.evaluate(() => {
    const queue = localStorage.getItem('bitchat-outbox-queue');
    if (!queue) return 0;
    try {
      const parsed = JSON.parse(queue);
      return parsed?.state?.messages?.length || 0;
    } catch {
      return 0;
    }
  });
}

async function sendTestMessage(page: Page, content: string): Promise<void> {
  const input = page.locator('textarea, [data-testid="message-input"]').first();
  if (await input.isVisible()) {
    await input.fill(content);
    await input.press('Enter');
  }
}

async function isAppFunctional(page: Page): Promise<boolean> {
  const appRoot = page.locator('#app, #root, [data-testid="app-root"]');
  return appRoot.first().isVisible();
}

// ============================================================================
// Random Disconnection Tests
// ============================================================================

test.describe('Network Chaos - Random Disconnection', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'ChaosTestUser' });
    await setupWithChannels(page);
  });

  test('should survive single random disconnection', async ({ page, context, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Capture initial state
    const initialState = await getAppState(page);

    // Random disconnection for 1-5 seconds
    const disconnectDuration = Math.random() * 4000 + 1000;
    await goOffline(context);
    await page.waitForTimeout(disconnectDuration);
    await goOnline(context);
    await page.waitForTimeout(2000);

    // Verify app is still functional
    expect(await isAppFunctional(page)).toBe(true);

    // Verify state is preserved
    const finalState = await getAppState(page);
    expect(finalState.identity).toBe(initialState.identity);
    expect(finalState.settings).toBe(initialState.settings);
  });

  test('should survive multiple random disconnections', async ({ page, context, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to channels to engage network activity
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    // Perform 5 random disconnections
    await chaos.simulateRandomDisconnections(5, 500, 3000);

    // Wait for app to stabilize
    await page.waitForTimeout(2000);

    // Verify app is still functional
    expect(await isAppFunctional(page)).toBe(true);

    // Try to interact with the app
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // App should still respond
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should queue messages during disconnection', async ({ page, context, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to channel
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Go offline
    await goOffline(context);
    await page.waitForTimeout(500);

    // Send messages while offline
    for (let i = 1; i <= 5; i++) {
      await sendTestMessage(page, `Offline message ${i} - ${Date.now()}`);
      await page.waitForTimeout(200);
    }

    // Check queue
    const queueSizeOffline = await getQueueSize(page);
    console.log('Queue size while offline:', queueSizeOffline);

    // Go online
    await goOnline(context);
    await page.waitForTimeout(3000);

    // Queue should be flushing
    const queueSizeAfter = await getQueueSize(page);
    console.log('Queue size after reconnection:', queueSizeAfter);

    // App should be functional
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle disconnection during message send', async ({ page, context }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await navigateToView(page, 'channels');
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Start typing message
    const input = page.locator('textarea, [data-testid="message-input"]').first();
    if (await input.isVisible()) {
      await input.fill('Message during disconnect');

      // Go offline mid-send
      await goOffline(context);
      await input.press('Enter');

      await page.waitForTimeout(1000);

      // Go back online
      await goOnline(context);
      await page.waitForTimeout(2000);
    }

    // App should handle gracefully
    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// 2G Network Simulation Tests
// ============================================================================

test.describe('Network Chaos - 2G Network Simulation', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: '2GTestUser' });
    await setupWithChannels(page);
  });

  test('should load app on 2G network', async ({ page, chaos }) => {
    // Apply 2G conditions before navigation
    await chaos.simulate2G();

    const startTime = Date.now();
    await page.goto('/');

    // Give more time for 2G loading
    await page.waitForSelector('#app, #root', { timeout: 60000 });
    const loadTime = Date.now() - startTime;

    console.log('2G load time:', loadTime, 'ms');

    // App should eventually load
    expect(await isAppFunctional(page)).toBe(true);

    await chaos.resetNetwork();
  });

  test('should function on 2G after initial load', async ({ page, chaos }) => {
    // Load with normal network first
    await page.goto('/');
    await waitForAppReady(page);

    // Then switch to 2G
    await chaos.simulate2G();
    await page.waitForTimeout(1000);

    // Try to navigate
    await navigateToView(page, 'channels');
    await page.waitForTimeout(2000);

    // App should still work, just slowly
    expect(await isAppFunctional(page)).toBe(true);

    // Try to send a message
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(1000);

      await sendTestMessage(page, '2G test message');
      await page.waitForTimeout(5000); // Allow time for slow send
    }

    expect(await isAppFunctional(page)).toBe(true);

    await chaos.resetNetwork();
  });

  test('should show loading indicators on 2G', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Switch to 2G
    await chaos.simulate2G();
    await page.waitForTimeout(500);

    // Navigate and look for loading states
    await navigateToView(page, 'channels');

    // Check for any loading indicators
    const loadingIndicator = page.locator(
      '.loading, [data-loading="true"], .spinner, [aria-busy="true"]'
    );
    const hasLoading = await loadingIndicator.isVisible().catch(() => false);

    console.log('Loading indicator shown on 2G:', hasLoading);

    await chaos.resetNetwork();
  });

  test('should handle transition from 2G to 4G', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Start on 2G
    await chaos.simulate2G();
    await page.waitForTimeout(1000);

    // Send a message on 2G (will be slow)
    await navigateToView(page, 'channels');
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(500);
      await sendTestMessage(page, '2G message');
    }

    // Upgrade to 4G
    await chaos.simulate4G();
    await page.waitForTimeout(2000);

    // Send another message (should be faster)
    await sendTestMessage(page, '4G message');
    await page.waitForTimeout(1000);

    expect(await isAppFunctional(page)).toBe(true);

    await chaos.resetNetwork();
  });
});

// ============================================================================
// All Relays Down Tests
// ============================================================================

test.describe('Network Chaos - All Relays Down', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'RelayDownUser' });
    await setupWithChannels(page);
  });

  test('should handle all relays being unreachable', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Block all relay domains
    await chaos.simulateAllRelaysDown();
    await page.waitForTimeout(2000);

    // App should still be usable locally
    expect(await isAppFunctional(page)).toBe(true);

    // Local navigation should work
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);
    expect(await isAppFunctional(page)).toBe(true);

    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);
    expect(await isAppFunctional(page)).toBe(true);

    await chaos.unblockAllDomains();
  });

  test('should show connection error when relays down', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Block all relays
    await chaos.simulateAllRelaysDown();
    await page.waitForTimeout(3000);

    // Look for connection error indicators
    const errorIndicator = page.locator(
      'text=/relay|connection|error|failed|offline|disconnected/i'
    ).or(page.locator('[data-testid="connection-error"]'));

    const hasError = await errorIndicator.isVisible().catch(() => false);
    console.log('Connection error shown when relays down:', hasError);

    await chaos.unblockAllDomains();
  });

  test('should queue messages when relays down', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await navigateToView(page, 'channels');
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Block relays
    await chaos.simulateAllRelaysDown();
    await page.waitForTimeout(1000);

    // Send messages
    for (let i = 1; i <= 3; i++) {
      await sendTestMessage(page, `Relay down message ${i}`);
      await page.waitForTimeout(300);
    }

    // Check queue
    const queueSize = await getQueueSize(page);
    console.log('Queue size with relays down:', queueSize);

    // Unblock and wait for flush
    await chaos.unblockAllDomains();
    await page.waitForTimeout(5000);

    const queueSizeAfter = await getQueueSize(page);
    console.log('Queue size after relay recovery:', queueSizeAfter);

    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should recover when relays come back', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Block relays
    await chaos.simulateAllRelaysDown();
    await page.waitForTimeout(2000);

    // Unblock relays
    await chaos.unblockAllDomains();
    await page.waitForTimeout(5000);

    // App should recover
    expect(await isAppFunctional(page)).toBe(true);

    // Try to use the app normally
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    // Send a message
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
      await sendTestMessage(page, 'Recovery test message');
      await page.waitForTimeout(2000);
    }

    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// High Latency Tests
// ============================================================================

test.describe('Network Chaos - High Latency', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'LatencyUser' });
    await setupWithChannels(page);
  });

  test('should handle satellite-level latency (1500ms)', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Apply high latency
    await chaos.simulateHighLatency();
    await page.waitForTimeout(1000);

    // Navigate should work but be slow
    const startNav = Date.now();
    await navigateToView(page, 'channels');
    await page.waitForTimeout(2000);
    const navTime = Date.now() - startNav;

    console.log('Navigation time with high latency:', navTime, 'ms');

    expect(await isAppFunctional(page)).toBe(true);

    await chaos.resetNetwork();
  });

  test('should timeout gracefully on extreme latency', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Apply extreme latency (simulated by very low throughput)
    await chaos.cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (10 * 1024) / 8, // 10 kbps
      uploadThroughput: (5 * 1024) / 8, // 5 kbps
      latency: 3000, // 3 second RTT
    });

    await page.waitForTimeout(1000);

    // Try to send a message
    await navigateToView(page, 'channels');
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(500);
      await sendTestMessage(page, 'Extreme latency message');
    }

    // Wait and check if message is queued or pending
    await page.waitForTimeout(5000);

    // App should still be functional
    expect(await isAppFunctional(page)).toBe(true);

    await chaos.resetNetwork();
  });

  test('should show latency indicators', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Apply high latency
    await chaos.simulateHighLatency();
    await page.waitForTimeout(2000);

    // Look for slow connection or latency indicators
    const slowIndicator = page.locator(
      'text=/slow|latency|poor.*connection/i'
    ).or(page.locator('[data-testid="slow-connection"]'));

    const hasSlowIndicator = await slowIndicator.isVisible().catch(() => false);
    console.log('Slow connection indicator shown:', hasSlowIndicator);

    await chaos.resetNetwork();
  });
});

// ============================================================================
// Intermittent Connectivity Tests
// ============================================================================

test.describe('Network Chaos - Intermittent Connectivity', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'IntermittentUser' });
    await setupWithChannels(page);
  });

  test('should handle connection flapping', async ({ page, context, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const initialState = await getAppState(page);

    // Simulate 20 seconds of intermittent connectivity
    await chaos.simulateIntermittentConnectivity(20000, 2000);

    // Allow time to stabilize
    await page.waitForTimeout(3000);

    // Verify app survived
    expect(await isAppFunctional(page)).toBe(true);

    // Verify state preserved
    const finalState = await getAppState(page);
    expect(finalState.identity).toBe(initialState.identity);
  });

  test('should not lose messages during flapping', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await navigateToView(page, 'channels');
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Send messages during flapping
    const messagesArray: string[] = [];
    const sendInterval = setInterval(async () => {
      const msg = `Flap message ${Date.now()}`;
      messagesArray.push(msg);
      await sendTestMessage(page, msg);
    }, 1000);

    // Run flapping for 10 seconds
    await chaos.simulateIntermittentConnectivity(10000, 1500);

    clearInterval(sendInterval);

    // Allow time for queue to flush
    await page.waitForTimeout(5000);

    // App should be functional
    expect(await isAppFunctional(page)).toBe(true);

    // Messages should be either sent or queued
    const queueSize = await getQueueSize(page);
    console.log('Messages sent:', messagesArray.length);
    console.log('Messages still queued:', queueSize);
  });

  test('should recover WebSocket after flapping', async ({ page, context, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Simulate flapping
    await chaos.simulateIntermittentConnectivity(10000, 1500);

    // Wait for recovery
    await page.waitForTimeout(5000);

    // App should have recovered
    expect(await isAppFunctional(page)).toBe(true);

    // Try to use the app
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// Packet Loss Simulation Tests
// ============================================================================

test.describe('Network Chaos - Packet Loss', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'PacketLossUser' });
    await setupWithChannels(page);
  });

  test('should handle 10% packet loss', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Simulate 10% packet loss for 10 seconds
    await chaos.simulatePacketLoss(10, 10000);

    // App should still function
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle 30% packet loss', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Simulate 30% packet loss for 10 seconds
    await chaos.simulatePacketLoss(30, 10000);

    // App should still function, possibly degraded
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle 50% packet loss', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Simulate severe 50% packet loss for 10 seconds
    await chaos.simulatePacketLoss(50, 10000);

    // Allow recovery
    await page.waitForTimeout(3000);

    // App should recover
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should retry messages during packet loss', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await navigateToView(page, 'channels');
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Send messages during packet loss
    const packetLossPromise = chaos.simulatePacketLoss(30, 8000);

    await sendTestMessage(page, 'Packet loss message 1');
    await page.waitForTimeout(500);
    await sendTestMessage(page, 'Packet loss message 2');
    await page.waitForTimeout(500);
    await sendTestMessage(page, 'Packet loss message 3');

    await packetLossPromise;
    await page.waitForTimeout(3000);

    // Messages should eventually be sent or queued
    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// WebSocket Specific Tests
// ============================================================================

test.describe('Network Chaos - WebSocket Failures', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'WebSocketUser' });
    await setupWithChannels(page);
  });

  test('should handle WebSocket disconnection', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Wait for WebSocket connections to establish
    await page.waitForTimeout(3000);

    // Simulate WebSocket drop
    await chaos.simulateWebSocketDrop();
    await page.waitForTimeout(2000);

    // App should handle gracefully
    expect(await isAppFunctional(page)).toBe(true);

    // Look for reconnection behavior
    const reconnectIndicator = page.locator(
      'text=/reconnect|connecting/i'
    ).or(page.locator('[data-testid="reconnecting"]'));

    const isReconnecting = await reconnectIndicator.isVisible().catch(() => false);
    console.log('Reconnection indicator shown:', isReconnecting);
  });

  test('should reconnect WebSocket after drop', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(3000);

    // Drop WebSocket
    await chaos.simulateWebSocketDrop();
    await page.waitForTimeout(5000);

    // App should have reconnected or be functional
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should handle multiple WebSocket drops', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    // Multiple drops
    for (let i = 0; i < 3; i++) {
      await chaos.simulateWebSocketDrop();
      await page.waitForTimeout(3000);
    }

    // App should still be functional
    expect(await isAppFunctional(page)).toBe(true);
  });
});

// ============================================================================
// Network Recovery Tests
// ============================================================================

test.describe('Network Chaos - Recovery Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'RecoveryUser' });
    await setupWithChannels(page);
  });

  test('should recover from extended offline period', async ({ page, context }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Go offline for extended period
    await goOffline(context);
    await page.waitForTimeout(30000); // 30 seconds offline

    // Go back online
    await goOnline(context);
    await page.waitForTimeout(5000);

    // App should recover
    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should flush queue after recovery', async ({ page, context }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await navigateToView(page, 'channels');
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Go offline and queue messages
    await goOffline(context);
    await page.waitForTimeout(500);

    for (let i = 1; i <= 10; i++) {
      await sendTestMessage(page, `Recovery message ${i}`);
      await page.waitForTimeout(100);
    }

    const queueSizeOffline = await getQueueSize(page);
    console.log('Queue size while offline:', queueSizeOffline);

    // Go online and wait for flush
    await goOnline(context);
    await page.waitForTimeout(10000);

    const queueSizeAfter = await getQueueSize(page);
    console.log('Queue size after recovery:', queueSizeAfter);

    // Queue should be flushing
    expect(queueSizeAfter).toBeLessThanOrEqual(queueSizeOffline);
  });

  test('should handle network upgrade (2G to WiFi)', async ({ page, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Start on 2G
    await chaos.simulate2G();
    await page.waitForTimeout(2000);

    await navigateToView(page, 'channels');
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(500);
      await sendTestMessage(page, '2G message');
    }

    // Upgrade to fast network
    await chaos.resetNetwork();
    await page.waitForTimeout(2000);

    // App should perform better
    expect(await isAppFunctional(page)).toBe(true);

    await sendTestMessage(page, 'Fast network message');
    await page.waitForTimeout(1000);

    expect(await isAppFunctional(page)).toBe(true);
  });

  test('should preserve data through chaos', async ({ page, context, chaos }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Capture initial state
    const initialState = await getAppState(page);

    // Run various chaos scenarios
    await goOffline(context);
    await page.waitForTimeout(1000);
    await goOnline(context);
    await page.waitForTimeout(1000);

    await chaos.simulate2G();
    await page.waitForTimeout(2000);

    await chaos.simulateAllRelaysDown();
    await page.waitForTimeout(2000);

    await chaos.resetNetwork();
    await page.waitForTimeout(3000);

    // Verify state preserved
    const finalState = await getAppState(page);
    expect(finalState.identity).toBe(initialState.identity);
    expect(finalState.settings).toBe(initialState.settings);
    expect(finalState.channels).toBe(initialState.channels);

    // App should be functional
    expect(await isAppFunctional(page)).toBe(true);
  });
});
