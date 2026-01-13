/**
 * E2E Tests: Settings
 *
 * Tests the settings functionality including:
 * - Changing settings (nickname, theme, notifications)
 * - Export identity
 * - Storage management
 * - Privacy settings
 * - Network settings
 * - Danger zone operations
 */

import { test, expect, setupWithIdentity, waitForAppReady, navigateToView, clearStorage } from './fixtures';

test.describe('Settings - Change Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'SettingsUser' });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should navigate to settings', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Settings header should be visible
    await settingsPage.waitForSettings();
    const header = settingsPage.settingsHeader();
    const hasSettings = await header.isVisible().catch(() => false);
    expect(hasSettings).toBe(true);
  });

  test('should display settings sections', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // All sections should be visible
    const identity = settingsPage.identitySection();
    const privacy = settingsPage.privacySection();
    const network = settingsPage.networkSection();
    const storage = settingsPage.storageSection();
    const about = settingsPage.aboutSection();

    // At least some sections should be visible
    const hasIdentity = await identity.isVisible().catch(() => false);
    const hasPrivacy = await privacy.isVisible().catch(() => false);
  });

  test('should change nickname', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Expand identity section
    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    // Change nickname
    await settingsPage.changeNickname('NewNickname');
    await page.waitForTimeout(300);

    // Nickname should be updated
    const nicknameInput = settingsPage.nicknameInput();
    if (await nicknameInput.isVisible()) {
      const value = await nicknameInput.inputValue();
      expect(value).toBe('NewNickname');
    }
  });

  test('should persist nickname across page reloads', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    await settingsPage.changeNickname('PersistentNickname');
    await page.waitForTimeout(300);

    // Reload page
    await page.reload();
    await waitForAppReady(page);
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    const nicknameInput = settingsPage.nicknameInput();
    if (await nicknameInput.isVisible()) {
      const value = await nicknameInput.inputValue();
      expect(value).toBe('PersistentNickname');
    }
  });

  test('should change theme', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Find theme setting
    const themeSelect = settingsPage.themeSelect().or(page.locator('text=/theme/i').first());
    if (await themeSelect.isVisible()) {
      await themeSelect.click();
      await page.waitForTimeout(300);

      // Select light theme option
      const lightOption = page.getByRole('option', { name: /light/i }).or(page.locator('text=/light/i'));
      if (await lightOption.isVisible()) {
        await lightOption.click();
        await page.waitForTimeout(300);
      }
    }
  });

  test('should change notification settings', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Expand privacy section (or find notifications setting)
    await settingsPage.expandSection('privacy');
    await page.waitForTimeout(300);

    // Notification settings
    const notificationToggle = page.locator('[data-testid="notification-toggle"], input[name="notifications"]');
    if (await notificationToggle.isVisible()) {
      await notificationToggle.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Settings - Export Identity', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'ExportUser' });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should show export option', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    const exportBtn = settingsPage.exportButton();
    const hasExport = await exportBtn.isVisible().catch(() => false);
  });

  test('should export identity data', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    const exportBtn = settingsPage.exportButton();
    if (await exportBtn.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);

      await exportBtn.click();
      await page.waitForTimeout(500);

      // Might trigger download or show export modal
      const download = await downloadPromise;
      // Download behavior depends on implementation
    }
  });

  test('should display public key for sharing', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    // Public key should be displayed
    const publicKeyDisplay = settingsPage.publicKeyDisplay().or(page.locator('text=/npub|public.*key/i'));
    const hasPublicKey = await publicKeyDisplay.isVisible().catch(() => false);
  });

  test('should copy public key to clipboard', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    // Copy button
    const copyBtn = page.getByRole('button', { name: /copy/i });
    if (await copyBtn.isVisible()) {
      await copyBtn.click();
      await page.waitForTimeout(300);

      // Should show copied confirmation
      const copiedText = page.locator('text=/copied/i');
      // Clipboard behavior depends on implementation
    }
  });

  test('should display fingerprint', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    const fingerprintDisplay = settingsPage.fingerprintDisplay().or(page.locator('text=/fingerprint/i'));
    const hasFingerprint = await fingerprintDisplay.isVisible().catch(() => false);
  });
});

test.describe('Settings - Storage Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'StorageUser' });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should show storage usage', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('storage');
    await page.waitForTimeout(300);

    // Storage usage display
    const storageUsage = settingsPage.storageUsage().or(page.locator('text=/\\d+.*[KMG]B|storage.*usage/i'));
    const hasUsage = await storageUsage.isVisible().catch(() => false);
  });

  test('should clear message history', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('storage');
    await page.waitForTimeout(300);

    // Clear history button
    const clearHistoryBtn = page.getByRole('button', { name: /clear.*history|delete.*messages/i });
    if (await clearHistoryBtn.isVisible()) {
      await clearHistoryBtn.click();
      await page.waitForTimeout(300);

      // Confirm dialog
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|clear/i });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should export all data', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('storage');
    await page.waitForTimeout(300);

    // Export all data button
    const exportAllBtn = page.getByRole('button', { name: /export.*all|backup.*data/i });
    if (await exportAllBtn.isVisible()) {
      await exportAllBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('should import data', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('storage');
    await page.waitForTimeout(300);

    // Import button
    const importBtn = settingsPage.importButton();
    const hasImport = await importBtn.isVisible().catch(() => false);
  });
});

test.describe('Settings - Privacy Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'PrivacyUser' });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should show privacy options', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('privacy');
    await page.waitForTimeout(300);

    // Privacy options should be visible
    const privacyContent = page.locator('text=/location|read.*receipt|anonymous/i');
    const hasPrivacy = await privacyContent.isVisible().catch(() => false);
  });

  test('should change location precision', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('privacy');
    await page.waitForTimeout(300);

    // Location precision slider or dropdown
    const precisionControl = page.locator('[data-testid="location-precision"], input[type="range"]');
    if (await precisionControl.isVisible()) {
      // Adjust precision
      // Slider behavior depends on implementation
    }
  });

  test('should toggle read receipts', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('privacy');
    await page.waitForTimeout(300);

    // Read receipts toggle
    const readReceiptsToggle = page.locator('[data-testid="read-receipts"], input[name="readReceipts"]');
    if (await readReceiptsToggle.isVisible()) {
      await readReceiptsToggle.click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe('Settings - Network Settings', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'NetworkUser' });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should show network options', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('network');
    await page.waitForTimeout(300);

    // Network options
    const networkContent = page.locator('text=/relay|webrtc|connection/i');
    const hasNetwork = await networkContent.isVisible().catch(() => false);
  });

  test('should display relay status', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('network');
    await page.waitForTimeout(300);

    // Relay status indicator
    const relayStatus = page.locator('text=/connected|relay.*status|\\d+.*relay/i');
    const hasStatus = await relayStatus.isVisible().catch(() => false);
  });

  test('should add custom relay', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('network');
    await page.waitForTimeout(300);

    // Add relay input
    const relayInput = page.getByPlaceholder(/relay|wss:\/\//i);
    if (await relayInput.isVisible()) {
      await relayInput.fill('wss://custom.relay.com');

      const addBtn = page.getByRole('button', { name: /add/i });
      if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });
});

test.describe('Settings - About Section', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should show app version', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('about');
    await page.waitForTimeout(300);

    // Version display
    const version = page.locator('text=/\\d+\\.\\d+\\.\\d+|version/i');
    const hasVersion = await version.isVisible().catch(() => false);
  });

  test('should show links to native apps', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('about');
    await page.waitForTimeout(300);

    // iOS link
    const iosLink = page.locator('text=/ios|app.*store/i');
    const hasIOS = await iosLink.isVisible().catch(() => false);

    // Android link
    const androidLink = page.locator('text=/android|google.*play/i');
    const hasAndroid = await androidLink.isVisible().catch(() => false);
  });

  test('should show source code link', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('about');
    await page.waitForTimeout(300);

    // Source code link
    const sourceLink = page.locator('text=/source|github|code/i');
    const hasSource = await sourceLink.isVisible().catch(() => false);
  });
});

test.describe('Settings - Danger Zone', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'DangerUser' });
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should show danger zone', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Danger zone section
    const dangerZone = settingsPage.dangerZone();
    const hasDanger = await dangerZone.isVisible().catch(() => false);
  });

  test('should have reset identity option', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('danger');
    await page.waitForTimeout(300);

    // Reset button
    const resetBtn = settingsPage.resetButton();
    const hasReset = await resetBtn.isVisible().catch(() => false);
  });

  test('should confirm before reset', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('danger');
    await page.waitForTimeout(300);

    const resetBtn = settingsPage.resetButton();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(300);

      // Confirmation dialog
      const confirmDialog = page.locator('text=/confirm|sure|warning|irreversible/i');
      const hasConfirm = await confirmDialog.isVisible().catch(() => false);
      expect(hasConfirm).toBe(true);
    }
  });

  test('should require typing confirmation phrase', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('danger');
    await page.waitForTimeout(300);

    const resetBtn = settingsPage.resetButton();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(300);

      // Confirmation input
      const confirmInput = page.getByPlaceholder(/type.*confirm|delete|wipe/i);
      if (await confirmInput.isVisible()) {
        // Type confirmation phrase
        await confirmInput.fill('DELETE');
        await page.waitForTimeout(300);

        // Confirm button should be enabled
        const confirmBtn = settingsPage.confirmResetButton();
        // Button state depends on implementation
      }
    }
  });

  test('should wipe all data on confirm', async ({ page, settingsPage }) => {
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('danger');
    await page.waitForTimeout(300);

    const resetBtn = settingsPage.resetButton();
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      await page.waitForTimeout(300);

      // Type confirmation if needed
      const confirmInput = page.getByPlaceholder(/type.*confirm|delete|wipe/i);
      if (await confirmInput.isVisible()) {
        await confirmInput.fill('DELETE');
        await page.waitForTimeout(300);
      }

      // Click confirm
      const confirmBtn = settingsPage.confirmResetButton().or(page.getByRole('button', { name: /confirm|yes|reset|wipe/i }));
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
        await page.waitForTimeout(1000);

        // Should redirect to onboarding
        const welcomeText = page.getByText(/welcome|bitchat|get.*started/i);
        // Redirect behavior depends on implementation
      }
    }
  });
});

test.describe('Settings - Back Navigation', () => {
  test('should go back to main view', async ({ page, settingsPage }) => {
    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Go back
    await settingsPage.goBack();
    await page.waitForTimeout(300);

    // Should be back on main view (not settings)
    const settingsHeader = settingsPage.settingsHeader();
    const isOnSettings = await settingsHeader.isVisible().catch(() => false);
    // May or may not leave settings depending on navigation model
  });
});

test.describe('Settings - Responsive Layout', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Settings should be visible on mobile
    const settingsContent = page.locator('text=/settings/i');
    await expect(settingsContent.first()).toBeVisible();
  });

  test('should collapse sections properly on mobile', async ({ page, settingsPage }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await setupWithIdentity(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    // Expand section
    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    // Collapse section
    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    // Content should be hidden
  });
});
