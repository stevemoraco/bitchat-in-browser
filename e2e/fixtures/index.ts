/**
 * E2E Test Fixtures and Helpers for BitChat In Browser
 *
 * This module provides reusable test fixtures, page objects, and helper utilities
 * for consistent and maintainable E2E testing with Playwright.
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test';

// ============================================================================
// Types
// ============================================================================

export interface TestIdentity {
  publicKey: string;
  fingerprint: string;
  nickname: string;
  npub: string;
}

export interface TestChannel {
  id: string;
  name: string;
  type: 'location' | 'public' | 'dm';
  geohash?: string;
}

export interface TestPeer {
  fingerprint: string;
  publicKey: string;
  nickname: string;
  status: 'online' | 'offline';
}

export interface TestMessage {
  id: string;
  content: string;
  senderNickname: string;
  timestamp: number;
}

// ============================================================================
// Page Object Models
// ============================================================================

/**
 * OnboardingPage - Page object for onboarding flow interactions
 */
export class OnboardingPage {
  constructor(private page: Page) {}

  // Selectors
  readonly welcomeTitle = () => this.page.getByText('BitChat In Browser');
  readonly createIdentityButton = () => this.page.getByRole('button', { name: /create.*identity/i });
  readonly importKeyButton = () => this.page.getByRole('button', { name: /import.*key/i });
  readonly getStartedButton = () => this.page.getByRole('button', { name: /get started/i });
  readonly nicknameInput = () => this.page.getByPlaceholder(/nickname|name/i);
  readonly passwordInput = () => this.page.getByPlaceholder(/password/i);
  readonly confirmPasswordInput = () => this.page.getByPlaceholder(/confirm/i);
  readonly nsecInput = () => this.page.getByPlaceholder(/nsec|private key/i);
  readonly continueButton = () => this.page.getByRole('button', { name: /continue|next/i });
  readonly skipButton = () => this.page.getByRole('button', { name: /skip/i });
  readonly backButton = () => this.page.getByRole('button', { name: /back/i });
  readonly startChattingButton = () => this.page.getByRole('button', { name: /start chatting/i });
  readonly progressBar = () => this.page.locator('.h-1.bg-terminal-green');

  // Actions
  async waitForWelcome() {
    await this.page.waitForSelector('text=/welcome|BitChat/i', { timeout: 10000 });
  }

  async selectCreateIdentity() {
    const btn = this.createIdentityButton();
    if (await btn.isVisible()) {
      await btn.click();
    } else {
      // Fallback to get started button
      await this.getStartedButton().click();
    }
  }

  async selectImportKey() {
    await this.importKeyButton().click();
  }

  async enterNickname(nickname: string) {
    const input = this.nicknameInput();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.fill(nickname);
  }

  async enterPassword(password: string) {
    await this.passwordInput().fill(password);
    const confirmInput = this.confirmPasswordInput();
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(password);
    }
  }

  async enterNsec(nsec: string) {
    await this.nsecInput().fill(nsec);
  }

  async clickContinue() {
    await this.continueButton().click();
  }

  async skipStep() {
    const skipBtn = this.skipButton();
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    }
  }

  async completeOnboarding() {
    const startBtn = this.startChattingButton();
    if (await startBtn.isVisible()) {
      await startBtn.click();
    }
  }

  async isOnWelcomeStep() {
    return this.welcomeTitle().isVisible();
  }
}

/**
 * ChannelsPage - Page object for channels interactions
 */
export class ChannelsPage {
  constructor(private page: Page) {}

  // Selectors
  readonly channelsList = () => this.page.locator('[data-testid="channels-list"]').or(this.page.locator('.channels-list'));
  readonly channelItem = (name: string) => this.page.locator(`text="#${name}"`).or(this.page.locator(`[data-channel-name="${name}"]`));
  readonly activeChannel = () => this.page.locator('[data-active="true"]').or(this.page.locator('.channel-active'));
  readonly createChannelButton = () => this.page.getByRole('button', { name: /create.*channel|new.*channel|\+/i });
  readonly locationChannelButton = () => this.page.getByRole('button', { name: /location|nearby/i });
  readonly channelNameInput = () => this.page.getByPlaceholder(/channel.*name|name/i);
  readonly geohashInput = () => this.page.getByPlaceholder(/geohash|location/i);
  readonly confirmCreateButton = () => this.page.getByRole('button', { name: /create|confirm/i });
  readonly leaveChannelButton = () => this.page.getByRole('button', { name: /leave/i });
  readonly channelInfoButton = () => this.page.getByRole('button', { name: /info/i });
  readonly chatHeader = () => this.page.locator('[data-testid="chat-header"]').or(this.page.locator('header'));
  readonly unreadBadge = () => this.page.locator('.unread-badge, [data-unread]');

  // Actions
  async selectChannel(name: string) {
    await this.channelItem(name).click();
  }

  async createLocationChannel(name?: string, geohash?: string) {
    await this.createChannelButton().click();
    await this.locationChannelButton().click();

    if (name) {
      await this.channelNameInput().fill(name);
    }
    if (geohash) {
      await this.geohashInput().fill(geohash);
    }

    await this.confirmCreateButton().click();
  }

  async leaveChannel() {
    await this.leaveChannelButton().click();
  }

  async waitForChannelsList() {
    await this.page.waitForSelector('[data-testid="channels-list"], .channels-list, #channels', { timeout: 10000 });
  }

  async getChannelCount() {
    const items = await this.page.locator('[data-channel], .channel-item').all();
    return items.length;
  }
}

/**
 * ChatPage - Page object for chat/messaging interactions
 */
export class ChatPage {
  constructor(private page: Page) {}

  // Selectors
  readonly messageInput = () => this.page.locator('textarea, [data-testid="message-input"]');
  readonly sendButton = () => this.page.getByRole('button', { name: /send/i }).or(this.page.locator('[aria-label="Send message"]'));
  readonly messageList = () => this.page.locator('[data-testid="message-list"]').or(this.page.locator('.message-list'));
  readonly messageItem = (content: string) => this.page.locator(`text="${content}"`);
  readonly ownMessage = () => this.page.locator('[data-own="true"], .own-message');
  readonly messageStatus = (status: string) => this.page.locator(`[data-status="${status}"]`);
  readonly typingIndicator = () => this.page.locator('[data-testid="typing-indicator"]').or(this.page.locator('.typing-indicator'));
  readonly offlineIndicator = () => this.page.locator('text=/offline/i');
  readonly replyButton = () => this.page.getByRole('button', { name: /reply/i });
  readonly replyPreview = () => this.page.locator('[data-testid="reply-preview"]').or(this.page.locator('.reply-preview'));
  readonly scrollToBottomButton = () => this.page.locator('[data-testid="scroll-to-bottom"]').or(this.page.locator('.scroll-to-bottom'));

  // Actions
  async sendMessage(content: string) {
    await this.messageInput().fill(content);
    await this.sendButton().click();
  }

  async sendMessageWithEnter(content: string) {
    await this.messageInput().fill(content);
    await this.messageInput().press('Enter');
  }

  async waitForMessage(content: string) {
    await this.page.waitForSelector(`text="${content}"`, { timeout: 10000 });
  }

  async waitForMessageStatus(status: 'pending' | 'sent' | 'delivered' | 'failed') {
    await this.page.waitForSelector(`[data-status="${status}"]`, { timeout: 10000 });
  }

  async replyToMessage(content: string) {
    await this.messageItem(content).hover();
    await this.replyButton().click();
  }

  async getMessageCount() {
    const messages = await this.page.locator('[data-message], .message-bubble').all();
    return messages.length;
  }

  async scrollToBottom() {
    const btn = this.scrollToBottomButton();
    if (await btn.isVisible()) {
      await btn.click();
    }
  }
}

/**
 * PeersPage - Page object for peers interactions
 */
export class PeersPage {
  constructor(private page: Page) {}

  // Selectors
  readonly peersList = () => this.page.locator('[data-testid="peers-list"]').or(this.page.locator('.peers-list'));
  readonly peerItem = (name: string) => this.page.locator(`text="${name}"`).first();
  readonly addPeerButton = () => this.page.getByRole('button', { name: /add.*peer|\+/i });
  readonly peerFingerprintInput = () => this.page.getByPlaceholder(/fingerprint|public.*key|npub/i);
  readonly peerNicknameInput = () => this.page.getByPlaceholder(/nickname|name/i);
  readonly confirmAddButton = () => this.page.getByRole('button', { name: /add|confirm/i });
  readonly peerProfile = () => this.page.locator('[data-testid="peer-profile"]').or(this.page.locator('.peer-profile'));
  readonly trustButton = () => this.page.getByRole('button', { name: /trust|verify/i });
  readonly blockButton = () => this.page.getByRole('button', { name: /block/i });
  readonly messageButton = () => this.page.getByRole('button', { name: /message/i });
  readonly backButton = () => this.page.getByRole('button', { name: /back/i });
  readonly onlineStatus = () => this.page.locator('text=/online/i');
  readonly offlineStatus = () => this.page.locator('text=/offline/i');

  // Actions
  async selectPeer(name: string) {
    await this.peerItem(name).click();
  }

  async addPeer(fingerprint: string, nickname?: string) {
    await this.addPeerButton().click();
    await this.peerFingerprintInput().fill(fingerprint);
    if (nickname) {
      await this.peerNicknameInput().fill(nickname);
    }
    await this.confirmAddButton().click();
  }

  async trustPeer() {
    await this.trustButton().click();
  }

  async blockPeer() {
    await this.blockButton().click();
  }

  async goBack() {
    await this.backButton().click();
  }

  async waitForPeersList() {
    await this.page.waitForSelector('[data-testid="peers-list"], .peers-list, #peers', { timeout: 10000 });
  }

  async getPeerCount() {
    const peers = await this.page.locator('[data-peer], .peer-item').all();
    return peers.length;
  }
}

/**
 * SettingsPage - Page object for settings interactions
 */
export class SettingsPage {
  constructor(private page: Page) {}

  // Selectors
  readonly settingsHeader = () => this.page.getByText(/settings/i);
  readonly identitySection = () => this.page.getByText(/identity/i);
  readonly privacySection = () => this.page.getByText(/privacy/i);
  readonly networkSection = () => this.page.getByText(/network/i);
  readonly storageSection = () => this.page.getByText(/storage/i);
  readonly aboutSection = () => this.page.getByText(/about/i);
  readonly dangerZone = () => this.page.getByText(/danger.*zone/i);
  readonly nicknameInput = () => this.page.getByPlaceholder(/nickname|name/i);
  readonly themeSelect = () => this.page.locator('[data-testid="theme-select"]').or(this.page.locator('select[name="theme"]'));
  readonly exportButton = () => this.page.getByRole('button', { name: /export/i });
  readonly importButton = () => this.page.getByRole('button', { name: /import/i });
  readonly resetButton = () => this.page.getByRole('button', { name: /reset|wipe/i });
  readonly confirmResetButton = () => this.page.getByRole('button', { name: /confirm.*reset|yes.*reset/i });
  readonly saveButton = () => this.page.getByRole('button', { name: /save/i });
  readonly backButton = () => this.page.getByRole('button', { name: /back/i });
  readonly publicKeyDisplay = () => this.page.locator('[data-testid="public-key"]').or(this.page.locator('.public-key'));
  readonly fingerprintDisplay = () => this.page.locator('[data-testid="fingerprint"]').or(this.page.locator('.fingerprint'));
  readonly storageUsage = () => this.page.locator('[data-testid="storage-usage"]').or(this.page.locator('.storage-usage'));

  // Actions
  async expandSection(section: 'identity' | 'privacy' | 'network' | 'storage' | 'about' | 'danger') {
    const sectionMap = {
      identity: this.identitySection,
      privacy: this.privacySection,
      network: this.networkSection,
      storage: this.storageSection,
      about: this.aboutSection,
      danger: this.dangerZone,
    };
    await sectionMap[section]().click();
  }

  async changeNickname(nickname: string) {
    await this.nicknameInput().fill(nickname);
    const saveBtn = this.saveButton();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }
  }

  async exportIdentity() {
    await this.exportButton().click();
  }

  async resetIdentity() {
    await this.resetButton().click();
    await this.confirmResetButton().click();
  }

  async goBack() {
    await this.backButton().click();
  }

  async waitForSettings() {
    await this.page.waitForSelector('text=/settings/i', { timeout: 10000 });
  }
}

/**
 * CommandsHelper - Helper for command interactions
 */
export class CommandsHelper {
  constructor(private page: Page) {}

  // Selectors
  readonly commandInput = () => this.page.locator('textarea, [data-testid="message-input"]');
  readonly autocompleteList = () => this.page.locator('[data-testid="autocomplete-list"]').or(this.page.locator('.autocomplete-list'));
  readonly autocompleteItem = (command: string) => this.page.locator(`[data-command="${command}"]`).or(this.page.locator(`text="${command}"`));
  readonly commandOutput = () => this.page.locator('[data-testid="command-output"]').or(this.page.locator('.command-output, .system-message'));

  // Actions
  async typeCommand(command: string) {
    await this.commandInput().fill(command);
  }

  async executeCommand(command: string) {
    await this.commandInput().fill(command);
    await this.commandInput().press('Enter');
  }

  async selectAutocomplete(command: string) {
    await this.autocompleteItem(command).click();
  }

  async waitForAutocomplete() {
    await this.page.waitForSelector('[data-testid="autocomplete-list"], .autocomplete-list', { timeout: 5000 });
  }

  async waitForOutput() {
    await this.page.waitForSelector('[data-testid="command-output"], .command-output, .system-message', { timeout: 5000 });
  }
}

// ============================================================================
// Extended Test Fixture
// ============================================================================

interface BitChatFixtures {
  onboardingPage: OnboardingPage;
  channelsPage: ChannelsPage;
  chatPage: ChatPage;
  peersPage: PeersPage;
  settingsPage: SettingsPage;
  commandsHelper: CommandsHelper;
  testIdentity: TestIdentity;
  testChannel: TestChannel;
  testPeer: TestPeer;
}

/**
 * Extended test fixture with page objects and test data
 */
export const test = base.extend<BitChatFixtures>({
  onboardingPage: async ({ page }, use) => {
    await use(new OnboardingPage(page));
  },
  channelsPage: async ({ page }, use) => {
    await use(new ChannelsPage(page));
  },
  chatPage: async ({ page }, use) => {
    await use(new ChatPage(page));
  },
  peersPage: async ({ page }, use) => {
    await use(new PeersPage(page));
  },
  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
  commandsHelper: async ({ page }, use) => {
    await use(new CommandsHelper(page));
  },
  testIdentity: async ({}, use) => {
    await use({
      publicKey: 'a'.repeat(64),
      fingerprint: 'ABC123XY',
      nickname: 'TestUser',
      npub: 'npub1' + 'a'.repeat(59),
    });
  },
  testChannel: async ({}, use) => {
    await use({
      id: 'test-channel-1',
      name: 'test-nearby',
      type: 'location',
      geohash: '9q8yyk',
    });
  },
  testPeer: async ({}, use) => {
    await use({
      fingerprint: 'XYZ789AB',
      publicKey: 'b'.repeat(64),
      nickname: 'TestPeer',
      status: 'online',
    });
  },
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Setup storage with identity to skip onboarding
 */
export async function setupWithIdentity(page: Page, identity?: Partial<TestIdentity>) {
  const defaultIdentity: TestIdentity = {
    publicKey: 'a'.repeat(64),
    fingerprint: 'ABC123XY',
    nickname: 'TestUser',
    npub: 'npub1' + 'a'.repeat(59),
  };

  const testIdentity = { ...defaultIdentity, ...identity };

  await page.addInitScript((identity) => {
    // Set up localStorage to simulate logged-in state
    localStorage.setItem(
      'bitchat-identity',
      JSON.stringify({
        state: {
          identity: {
            publicKey: identity.publicKey,
            fingerprint: identity.fingerprint,
            npub: identity.npub,
            isKeyLoaded: true,
            createdAt: Date.now(),
          },
        },
        version: 0,
      })
    );

    // Mark onboarding as complete
    localStorage.setItem(
      'bitchat-settings',
      JSON.stringify({
        state: {
          settings: {
            nickname: identity.nickname,
            theme: 'dark',
            notifications: 'all',
            showTimestamps: true,
            showMessageStatus: true,
            soundEnabled: true,
            autoJoinLocation: true,
            locationPrecision: 6,
            compactMode: false,
            fontSize: 'medium',
            devMode: false,
            onboardingComplete: true,
          },
        },
        version: 0,
      })
    );
  }, testIdentity);

  return testIdentity;
}

/**
 * Setup storage with channels
 */
export async function setupWithChannels(page: Page, channels?: TestChannel[]) {
  const defaultChannels: TestChannel[] = [
    { id: 'channel-nearby', name: 'nearby', type: 'location', geohash: '9q8yyk' },
    { id: 'channel-global', name: 'global', type: 'public' },
  ];

  const testChannels = channels || defaultChannels;

  await page.addInitScript((channels) => {
    const channelsState = {
      channels: channels.map((ch) => ({
        ...ch,
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      })),
      activeChannelId: channels[0]?.id || null,
    };

    localStorage.setItem(
      'bitchat-channels',
      JSON.stringify({
        state: channelsState,
        version: 0,
      })
    );
  }, testChannels);

  return testChannels;
}

/**
 * Setup storage with peers
 */
export async function setupWithPeers(page: Page, peers?: TestPeer[]) {
  const defaultPeers: TestPeer[] = [
    { fingerprint: 'PEER1ABC', publicKey: 'c'.repeat(64), nickname: 'Alice', status: 'online' },
    { fingerprint: 'PEER2DEF', publicKey: 'd'.repeat(64), nickname: 'Bob', status: 'offline' },
  ];

  const testPeers = peers || defaultPeers;

  await page.addInitScript((peers) => {
    const peersState = {
      peers: peers.map((p) => ({
        ...p,
        lastSeenAt: Date.now(),
        source: 'nostr',
        isTrusted: false,
        isBlocked: false,
      })),
    };

    localStorage.setItem(
      'bitchat-peers',
      JSON.stringify({
        state: peersState,
        version: 0,
      })
    );
  }, testPeers);

  return testPeers;
}

/**
 * Clear all storage
 */
export async function clearStorage(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Simulate going offline
 */
export async function goOffline(context: BrowserContext) {
  await context.setOffline(true);
}

/**
 * Simulate going online
 */
export async function goOnline(context: BrowserContext) {
  await context.setOffline(false);
}

/**
 * Wait for app to be fully loaded and ready
 */
export async function waitForAppReady(page: Page) {
  // Wait for the app container to be visible
  await page.waitForSelector('#app, #root, [data-testid="app-root"]', { state: 'visible', timeout: 15000 });

  // Wait for any loading indicators to disappear
  await page.waitForSelector('.loading, [data-loading="true"]', { state: 'hidden', timeout: 10000 }).catch(() => {});

  // Small delay for JavaScript to settle
  await page.waitForTimeout(500);
}

/**
 * Navigate to a specific tab/view
 */
export async function navigateToView(page: Page, view: 'channels' | 'messages' | 'peers' | 'settings') {
  const viewButton = page.getByRole('button', { name: new RegExp(view, 'i') })
    .or(page.locator(`[data-view="${view}"]`))
    .or(page.locator(`[aria-label="${view}"]`));

  await viewButton.click();
  await page.waitForTimeout(300); // Wait for navigation animation
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}

// Re-export expect for convenience
export { expect };
