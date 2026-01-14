/**
 * Visual Regression Tests
 *
 * Screenshot-based visual regression tests for all major views in BitChat In Browser.
 * These tests capture screenshots and compare against baseline images to detect
 * unintended visual changes.
 *
 * ## Features
 * - Screenshots of all major views (onboarding, chat, channels, peers, settings)
 * - Multiple viewport sizes (desktop, tablet, mobile)
 * - Dark/light theme testing
 * - Component-level screenshots
 * - Comparison against baseline with configurable threshold
 *
 * ## Configuration
 * - maxDiffPixelRatio: 0.01 (1% pixel difference threshold)
 * - threshold: 0.2 (per-pixel color difference threshold)
 *
 * ## Running Tests
 * ```bash
 * # Run visual tests only
 * npx playwright test --project=visual
 *
 * # Update baseline screenshots
 * npx playwright test --project=visual --update-snapshots
 *
 * # Run specific view test
 * npx playwright test e2e/visual/screenshots.spec.ts -g "onboarding"
 * ```
 *
 * @module e2e/visual/screenshots.spec
 */

import { test, expect, Page } from '@playwright/test';
import { setupWithIdentity, setupWithChannels, setupWithPeers, waitForAppReady } from '../fixtures';

// Visual regression test configuration
const VISUAL_THRESHOLD = {
  maxDiffPixelRatio: 0.01, // 1% pixel difference allowed
  threshold: 0.2, // Per-pixel color difference threshold
};

// Screenshot options
const SCREENSHOT_OPTIONS = {
  fullPage: true,
  animations: 'disabled' as const,
  mask: [] as any[], // Elements to mask (dynamic content)
};

// Viewport configurations for responsive testing
const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1366, height: 768 },
  tablet: { width: 768, height: 1024 },
  tabletLandscape: { width: 1024, height: 768 },
  mobile: { width: 375, height: 812 },
  mobileLandscape: { width: 812, height: 375 },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Wait for page to be visually stable (no animations, images loaded)
 */
async function waitForVisualStability(page: Page): Promise<void> {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle');

  // Wait for any CSS animations to complete
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      // Check if all animations have completed
      const animations = document.getAnimations();
      if (animations.length === 0) {
        resolve();
        return;
      }

      Promise.all(animations.map((a) => a.finished)).then(() => resolve());

      // Timeout fallback
      setTimeout(resolve, 2000);
    });
  });

  // Wait for images to load
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      const images = Array.from(document.querySelectorAll('img'));
      if (images.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      const checkComplete = () => {
        loadedCount++;
        if (loadedCount >= images.length) {
          resolve();
        }
      };

      images.forEach((img) => {
        if (img.complete) {
          checkComplete();
        } else {
          img.addEventListener('load', checkComplete);
          img.addEventListener('error', checkComplete);
        }
      });

      // Timeout fallback
      setTimeout(resolve, 3000);
    });
  });

  // Small delay for final render
  await page.waitForTimeout(500);
}

/**
 * Mask dynamic content elements that change between runs
 */
async function maskDynamicContent(page: Page): Promise<void> {
  // Mask timestamps
  await page.evaluate(() => {
    document.querySelectorAll('[data-timestamp], .timestamp, time').forEach((el) => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  });

  // Mask randomly generated content
  await page.evaluate(() => {
    document.querySelectorAll('[data-dynamic], .dynamic-content').forEach((el) => {
      (el as HTMLElement).style.visibility = 'hidden';
    });
  });
}

/**
 * Disable animations for consistent screenshots
 */
async function disableAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

// ============================================================================
// Onboarding Flow Screenshots
// ============================================================================

test.describe('Onboarding Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage for fresh onboarding
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('welcome screen - desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('onboarding-welcome-desktop.png', VISUAL_THRESHOLD);
  });

  test('welcome screen - mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('onboarding-welcome-mobile.png', VISUAL_THRESHOLD);
  });

  test('welcome screen - tablet', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('onboarding-welcome-tablet.png', VISUAL_THRESHOLD);
  });
});

// ============================================================================
// Main App Screenshots
// ============================================================================

test.describe('Main App Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithChannels(page);
    await setupWithPeers(page);
  });

  test('chat view - desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('chat-view-desktop.png', VISUAL_THRESHOLD);
  });

  test('chat view - mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('chat-view-mobile.png', VISUAL_THRESHOLD);
  });

  test('chat view - tablet landscape', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tabletLandscape);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('chat-view-tablet-landscape.png', VISUAL_THRESHOLD);
  });

  test('chat view - laptop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.laptop);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('chat-view-laptop.png', VISUAL_THRESHOLD);
  });
});

// ============================================================================
// Channel List Screenshots
// ============================================================================

test.describe('Channel List Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithChannels(page, [
      { id: 'ch-1', name: 'nearby', type: 'location', geohash: '9q8yyk' },
      { id: 'ch-2', name: 'global', type: 'public' },
      { id: 'ch-3', name: 'dm-alice', type: 'dm' },
      { id: 'ch-4', name: 'local-sf', type: 'location', geohash: '9q8yy' },
      { id: 'ch-5', name: 'developers', type: 'public' },
    ]);
  });

  test('channel list - desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    // Navigate to channels view if needed
    const channelsTab = page.locator('[data-view="channels"], [aria-label*="channel" i]');
    if (await channelsTab.isVisible()) {
      await channelsTab.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('channel-list-desktop.png', VISUAL_THRESHOLD);
  });

  test('channel list - mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('channel-list-mobile.png', VISUAL_THRESHOLD);
  });
});

// ============================================================================
// Peers List Screenshots
// ============================================================================

test.describe('Peers List Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithPeers(page, [
      { fingerprint: 'ABCD1234', publicKey: 'a'.repeat(64), nickname: 'Alice', status: 'online' },
      { fingerprint: 'EFGH5678', publicKey: 'b'.repeat(64), nickname: 'Bob', status: 'offline' },
      { fingerprint: 'IJKL9012', publicKey: 'c'.repeat(64), nickname: 'Charlie', status: 'online' },
      { fingerprint: 'MNOP3456', publicKey: 'd'.repeat(64), nickname: 'Diana', status: 'offline' },
    ]);
  });

  test('peers list - desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to peers view
    const peersTab = page.locator('[data-view="peers"], [aria-label*="peer" i]');
    if (await peersTab.isVisible()) {
      await peersTab.click();
      await page.waitForTimeout(300);
    }

    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('peers-list-desktop.png', VISUAL_THRESHOLD);
  });

  test('peers list - mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to peers view
    const peersTab = page.locator('[data-view="peers"], [aria-label*="peer" i]');
    if (await peersTab.isVisible()) {
      await peersTab.click();
      await page.waitForTimeout(300);
    }

    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('peers-list-mobile.png', VISUAL_THRESHOLD);
  });
});

// ============================================================================
// Settings Screenshots
// ============================================================================

test.describe('Settings Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
  });

  test('settings view - desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to settings
    const settingsButton = page.locator('[data-view="settings"], [aria-label*="setting" i], button:has-text("Settings")');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(300);
    }

    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('settings-desktop.png', VISUAL_THRESHOLD);
  });

  test('settings view - mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to settings
    const settingsButton = page.locator('[data-view="settings"], [aria-label*="setting" i], button:has-text("Settings")');
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(300);
    }

    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('settings-mobile.png', VISUAL_THRESHOLD);
  });
});

// ============================================================================
// Component Screenshots
// ============================================================================

test.describe('Component Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithChannels(page);
  });

  test('message input component', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await waitForVisualStability(page);

    // Screenshot just the message input area
    const messageInput = page.locator('textarea, [data-testid="message-input"]').first();
    if (await messageInput.isVisible()) {
      await expect(messageInput).toHaveScreenshot('message-input.png', VISUAL_THRESHOLD);
    }
  });

  test('header component', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    // Screenshot just the header
    const header = page.locator('header, [data-testid="header"], .app-header').first();
    if (await header.isVisible()) {
      await expect(header).toHaveScreenshot('header.png', VISUAL_THRESHOLD);
    }
  });

  test('navigation component - mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await waitForVisualStability(page);

    // Screenshot the bottom navigation
    const nav = page.locator('nav, [data-testid="navigation"], .bottom-nav').first();
    if (await nav.isVisible()) {
      await expect(nav).toHaveScreenshot('navigation-mobile.png', VISUAL_THRESHOLD);
    }
  });
});

// ============================================================================
// Theme Screenshots
// ============================================================================

test.describe('Theme Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithChannels(page);
  });

  test('dark theme - desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    // Force dark mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('dark-theme-desktop.png', VISUAL_THRESHOLD);
  });

  test('light theme - desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    // Force light mode
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('light-theme-desktop.png', VISUAL_THRESHOLD);
  });

  test('high contrast - desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('high-contrast-desktop.png', VISUAL_THRESHOLD);
  });
});

// ============================================================================
// Empty State Screenshots
// ============================================================================

test.describe('Empty State Visual Regression', () => {
  test('empty channel list', async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    // Setup with no channels
    await page.addInitScript(() => {
      localStorage.setItem(
        'bitchat-channels',
        JSON.stringify({
          state: { channels: [], activeChannelId: null },
          version: 0,
        })
      );
    });

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('empty-channels.png', VISUAL_THRESHOLD);
  });

  test('empty peers list', async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    // Setup with no peers
    await page.addInitScript(() => {
      localStorage.setItem(
        'bitchat-peers',
        JSON.stringify({
          state: { peers: [] },
          version: 0,
        })
      );
    });

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);

    // Navigate to peers
    const peersTab = page.locator('[data-view="peers"], [aria-label*="peer" i]');
    if (await peersTab.isVisible()) {
      await peersTab.click();
      await page.waitForTimeout(300);
    }

    await disableAnimations(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('empty-peers.png', VISUAL_THRESHOLD);
  });
});

// ============================================================================
// Error State Screenshots
// ============================================================================

test.describe('Error State Visual Regression', () => {
  test('offline indicator', async ({ page, context }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });

    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/');
    await waitForAppReady(page);

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(1000);

    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('offline-state.png', VISUAL_THRESHOLD);

    // Restore online
    await context.setOffline(false);
  });
});

// ============================================================================
// Responsive Breakpoint Screenshots
// ============================================================================

test.describe('Responsive Breakpoints', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithChannels(page);
  });

  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    test(`full app at ${name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await waitForAppReady(page);
      await disableAnimations(page);
      await maskDynamicContent(page);
      await waitForVisualStability(page);

      await expect(page).toHaveScreenshot(`responsive-${name}.png`, VISUAL_THRESHOLD);
    });
  }
});

// ============================================================================
// Accessibility Visual Tests
// ============================================================================

test.describe('Accessibility Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'TestUser' });
    await setupWithChannels(page);
  });

  test('reduced motion', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await waitForAppReady(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('reduced-motion.png', VISUAL_THRESHOLD);
  });

  test('large text scale', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    // Simulate larger text
    await page.addStyleTag({
      content: `
        html { font-size: 24px !important; }
      `,
    });
    await page.goto('/');
    await waitForAppReady(page);
    await disableAnimations(page);
    await maskDynamicContent(page);
    await waitForVisualStability(page);

    await expect(page).toHaveScreenshot('large-text.png', VISUAL_THRESHOLD);
  });
});
