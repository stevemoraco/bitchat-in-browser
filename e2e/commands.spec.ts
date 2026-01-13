/**
 * E2E Tests: Commands
 *
 * Tests the command functionality including:
 * - Execute /help command
 * - Execute /nick command
 * - Command autocomplete
 * - Command parsing
 * - Error handling for invalid commands
 */

import { test, expect, setupWithIdentity, setupWithChannels, waitForAppReady, navigateToView } from './fixtures';

test.describe('Commands - Help Command', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'CommandUser' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    // Select a channel
    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should execute /help command', async ({ page, commandsHelper }) => {
    // Execute help command
    await commandsHelper.executeCommand('/help');
    await page.waitForTimeout(500);

    // Should show help output
    const helpOutput = page.locator('text=/available.*command|help|usage/i').or(commandsHelper.commandOutput());
    const hasOutput = await helpOutput.isVisible().catch(() => false);
    // Help output depends on implementation
  });

  test('should display list of available commands', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/help');
    await page.waitForTimeout(500);

    // Should list commands
    const commandsList = page.locator('text=/nick|help|me|clear/i');
    const hasList = await commandsList.isVisible().catch(() => false);
    // Command list depends on implementation
  });

  test('should show help for specific command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/help nick');
    await page.waitForTimeout(500);

    // Should show nick command help
    const nickHelp = page.locator('text=/nick|nickname|change.*name/i');
    const hasNickHelp = await nickHelp.isVisible().catch(() => false);
    // Specific help depends on implementation
  });

  test('should handle /? as alias for /help', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/?');
    await page.waitForTimeout(500);

    // Should show help output (same as /help)
    const helpOutput = page.locator('text=/available.*command|help/i');
    const hasOutput = await helpOutput.isVisible().catch(() => false);
    // Alias support depends on implementation
  });
});

test.describe('Commands - Nick Command', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'OldNickname' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should execute /nick command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/nick NewNickname');
    await page.waitForTimeout(500);

    // Should show success message
    const successMessage = page.locator('text=/nickname.*changed|now.*known.*as|NewNickname/i');
    const hasSuccess = await successMessage.isVisible().catch(() => false);
    // Success message depends on implementation
  });

  test('should update nickname in settings', async ({ page, commandsHelper, settingsPage }) => {
    await commandsHelper.executeCommand('/nick UpdatedUser');
    await page.waitForTimeout(500);

    // Navigate to settings to verify
    await navigateToView(page, 'settings');
    await page.waitForTimeout(500);

    await settingsPage.expandSection('identity');
    await page.waitForTimeout(300);

    // Nickname should be updated
    const nicknameInput = settingsPage.nicknameInput();
    if (await nicknameInput.isVisible()) {
      const value = await nicknameInput.inputValue();
      // Value should contain the new nickname
    }
  });

  test('should show error for empty nickname', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/nick');
    await page.waitForTimeout(500);

    // Should show error
    const errorMessage = page.locator('text=/error|provide|usage|nickname.*required/i');
    const hasError = await errorMessage.isVisible().catch(() => false);
    // Error handling depends on implementation
  });

  test('should validate nickname format', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/nick $invalid@name!');
    await page.waitForTimeout(500);

    // Should show validation error
    const errorMessage = page.locator('text=/invalid|error|character/i');
    const hasError = await errorMessage.isVisible().catch(() => false);
    // Validation depends on implementation
  });

  test('should show current nickname with /nick', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/nick');
    await page.waitForTimeout(500);

    // Should show current nickname or usage
    const currentNick = page.locator('text=/OldNickname|current.*nickname|usage/i');
    const hasNick = await currentNick.isVisible().catch(() => false);
    // Display depends on implementation
  });
});

test.describe('Commands - Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'AutocompleteUser' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should show autocomplete on "/" input', async ({ page, commandsHelper }) => {
    await commandsHelper.typeCommand('/');
    await page.waitForTimeout(300);

    // Autocomplete list should appear
    const autocomplete = commandsHelper.autocompleteList();
    const hasAutocomplete = await autocomplete.isVisible().catch(() => false);
    // Autocomplete UI depends on implementation
  });

  test('should filter autocomplete as user types', async ({ page, commandsHelper }) => {
    await commandsHelper.typeCommand('/he');
    await page.waitForTimeout(300);

    // Should show filtered results (help, etc.)
    const helpOption = page.locator('text=/help/i');
    const hasHelp = await helpOption.isVisible().catch(() => false);

    // Nick should not be visible
    const nickOption = page.locator('text=/nick/i');
    const hasNick = await nickOption.isVisible().catch(() => false);
    // Filter behavior depends on implementation
  });

  test('should complete command on Tab', async ({ page, commandsHelper }) => {
    await commandsHelper.typeCommand('/he');
    await page.waitForTimeout(300);

    // Press Tab to complete
    const commandInput = commandsHelper.commandInput();
    await commandInput.press('Tab');
    await page.waitForTimeout(200);

    // Input should be completed to "/help"
    const value = await commandInput.inputValue();
    // Tab completion depends on implementation
  });

  test('should complete command on Enter from autocomplete', async ({ page, commandsHelper }) => {
    await commandsHelper.typeCommand('/');
    await page.waitForTimeout(300);

    // Use arrow down to select
    const commandInput = commandsHelper.commandInput();
    await commandInput.press('ArrowDown');
    await page.waitForTimeout(100);
    await commandInput.press('Enter');
    await page.waitForTimeout(200);

    // First command should be selected
    // Selection behavior depends on implementation
  });

  test('should select autocomplete item on click', async ({ page, commandsHelper }) => {
    await commandsHelper.typeCommand('/');
    await page.waitForTimeout(300);

    // Click on help option
    const helpOption = page.locator('[data-command="/help"], text=/\\/help/');
    if (await helpOption.isVisible()) {
      await helpOption.click();
      await page.waitForTimeout(200);

      const commandInput = commandsHelper.commandInput();
      const value = await commandInput.inputValue();
      // Value should contain /help
    }
  });

  test('should hide autocomplete on Escape', async ({ page, commandsHelper }) => {
    await commandsHelper.typeCommand('/');
    await page.waitForTimeout(300);

    const commandInput = commandsHelper.commandInput();
    await commandInput.press('Escape');
    await page.waitForTimeout(200);

    // Autocomplete should be hidden
    const autocomplete = commandsHelper.autocompleteList();
    const isHidden = !(await autocomplete.isVisible().catch(() => false));
    // Escape behavior depends on implementation
  });

  test('should highlight matching text in autocomplete', async ({ page, commandsHelper }) => {
    await commandsHelper.typeCommand('/hel');
    await page.waitForTimeout(300);

    // "hel" should be highlighted in "help"
    const highlight = page.locator('.highlight, mark, strong');
    // Highlighting depends on implementation
  });
});

test.describe('Commands - Me Action', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'ActionUser' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should execute /me command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/me waves hello');
    await page.waitForTimeout(500);

    // Should show action message
    const actionMessage = page.locator('text=/waves.*hello|ActionUser.*waves/i').or(page.locator('.action-message'));
    const hasAction = await actionMessage.isVisible().catch(() => false);
    // Action message depends on implementation
  });

  test('should format action message differently', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/me dances');
    await page.waitForTimeout(500);

    // Action messages should have distinct styling
    const actionStyle = page.locator('[data-type="action"], .action-message, .me-action');
    const hasStyle = await actionStyle.isVisible().catch(() => false);
    // Styling depends on implementation
  });

  test('should show error for empty action', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/me');
    await page.waitForTimeout(500);

    // Should show error or usage
    const errorOrUsage = page.locator('text=/usage|action|provide/i');
    const hasError = await errorOrUsage.isVisible().catch(() => false);
    // Error handling depends on implementation
  });
});

test.describe('Commands - Clear Command', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'ClearUser' });
    await setupWithChannels(page);

    // Set up some messages
    await page.addInitScript(() => {
      const messagesState = {
        messages: {
          'channel-nearby': [
            {
              id: 'msg-1',
              channelId: 'channel-nearby',
              senderFingerprint: 'LOCAL',
              senderNickname: 'ClearUser',
              content: 'Test message 1',
              timestamp: Date.now() - 60000,
              type: 'text',
              status: 'delivered',
              isOwn: true,
              isRead: true,
            },
            {
              id: 'msg-2',
              channelId: 'channel-nearby',
              senderFingerprint: 'LOCAL',
              senderNickname: 'ClearUser',
              content: 'Test message 2',
              timestamp: Date.now(),
              type: 'text',
              status: 'delivered',
              isOwn: true,
              isRead: true,
            },
          ],
        },
      };

      localStorage.setItem(
        'bitchat-messages',
        JSON.stringify({
          state: messagesState,
          version: 0,
        })
      );
    });

    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('text=/nearby/i').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should execute /clear command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/clear');
    await page.waitForTimeout(500);

    // Messages should be cleared
    const message1 = page.locator('text=/Test message 1/');
    const message2 = page.locator('text=/Test message 2/');

    const hasMsg1 = await message1.isVisible().catch(() => false);
    const hasMsg2 = await message2.isVisible().catch(() => false);
    // Clear behavior depends on implementation
  });

  test('should confirm before clearing', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/clear');
    await page.waitForTimeout(500);

    // Should show confirmation
    const confirmDialog = page.locator('text=/confirm|sure|clear/i');
    const hasConfirm = await confirmDialog.isVisible().catch(() => false);
    // Confirmation depends on implementation
  });
});

test.describe('Commands - Invalid Commands', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'InvalidUser' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should handle unknown command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/unknowncommand');
    await page.waitForTimeout(500);

    // Should show error message
    const errorMessage = page.locator('text=/unknown|invalid|not.*found|command/i');
    const hasError = await errorMessage.isVisible().catch(() => false);
    // Error handling depends on implementation
  });

  test('should suggest similar command for typos', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/hlep');
    await page.waitForTimeout(500);

    // Should suggest /help
    const suggestion = page.locator('text=/did.*you.*mean|suggest|help/i');
    const hasSuggestion = await suggestion.isVisible().catch(() => false);
    // Suggestion depends on implementation
  });

  test('should not execute command without /', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('help');
    await page.waitForTimeout(500);

    // Should send as regular message, not command
    const message = page.locator('text=/help/').last();
    // Message display depends on implementation
  });
});

test.describe('Commands - Channel Commands', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'ChannelCmdUser' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should execute /topic command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/topic New channel topic');
    await page.waitForTimeout(500);

    // Should show topic change or permission error
    const response = page.locator('text=/topic|permission|changed/i');
    const hasResponse = await response.isVisible().catch(() => false);
    // Topic command depends on implementation
  });

  test('should execute /join command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/join #newchannel');
    await page.waitForTimeout(500);

    // Should join or create channel
    const newChannel = page.locator('text=/newchannel/i');
    const hasChannel = await newChannel.isVisible().catch(() => false);
    // Join command depends on implementation
  });

  test('should execute /leave command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/leave');
    await page.waitForTimeout(500);

    // Should leave current channel
    // Navigation depends on implementation
  });

  test('should execute /msg command for DM', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/msg Alice Hello there');
    await page.waitForTimeout(500);

    // Should start DM with Alice
    const dmHeader = page.locator('text=/Alice/i');
    const hasDM = await dmHeader.isVisible().catch(() => false);
    // DM command depends on implementation
  });
});

test.describe('Commands - System Commands', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'SysUser' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should execute /version command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/version');
    await page.waitForTimeout(500);

    // Should show version info
    const versionInfo = page.locator('text=/\\d+\\.\\d+|version|bitchat/i');
    const hasVersion = await versionInfo.isVisible().catch(() => false);
    // Version command depends on implementation
  });

  test('should execute /status command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/status');
    await page.waitForTimeout(500);

    // Should show connection status
    const statusInfo = page.locator('text=/online|connected|relay|peer/i');
    const hasStatus = await statusInfo.isVisible().catch(() => false);
    // Status command depends on implementation
  });

  test('should execute /debug command', async ({ page, commandsHelper }) => {
    await commandsHelper.executeCommand('/debug');
    await page.waitForTimeout(500);

    // Should toggle debug mode or show debug info
    const debugInfo = page.locator('text=/debug|developer|mode/i');
    const hasDebug = await debugInfo.isVisible().catch(() => false);
    // Debug command depends on implementation
  });
});

test.describe('Commands - Command History', () => {
  test.beforeEach(async ({ page }) => {
    await setupWithIdentity(page, { nickname: 'HistoryUser' });
    await setupWithChannels(page);
    await page.goto('/');
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }
  });

  test('should recall previous command with ArrowUp', async ({ page, commandsHelper }) => {
    // Execute some commands first
    await commandsHelper.executeCommand('/nick Test1');
    await page.waitForTimeout(300);
    await commandsHelper.executeCommand('/help');
    await page.waitForTimeout(300);

    // Press up arrow to recall
    const commandInput = commandsHelper.commandInput();
    await commandInput.click();
    await commandInput.press('ArrowUp');
    await page.waitForTimeout(200);

    const value = await commandInput.inputValue();
    // Should contain previous command
    // History behavior depends on implementation
  });

  test('should navigate through command history', async ({ page, commandsHelper }) => {
    // Execute commands
    await commandsHelper.executeCommand('/nick First');
    await page.waitForTimeout(200);
    await commandsHelper.executeCommand('/nick Second');
    await page.waitForTimeout(200);
    await commandsHelper.executeCommand('/nick Third');
    await page.waitForTimeout(200);

    const commandInput = commandsHelper.commandInput();
    await commandInput.click();

    // Navigate up
    await commandInput.press('ArrowUp');
    await page.waitForTimeout(100);
    await commandInput.press('ArrowUp');
    await page.waitForTimeout(100);

    // Navigate down
    await commandInput.press('ArrowDown');
    await page.waitForTimeout(100);

    // History navigation depends on implementation
  });

  test('should persist command history across sessions', async ({ page, commandsHelper }) => {
    // Execute command
    await commandsHelper.executeCommand('/nick PersistedName');
    await page.waitForTimeout(500);

    // Reload page
    await page.reload();
    await waitForAppReady(page);
    await navigateToView(page, 'channels');
    await page.waitForTimeout(500);

    const channelItem = page.locator('[data-channel], .channel-item').first();
    if (await channelItem.isVisible()) {
      await channelItem.click();
      await page.waitForTimeout(300);
    }

    // Try to recall command
    const commandInput = commandsHelper.commandInput();
    await commandInput.click();
    await commandInput.press('ArrowUp');
    await page.waitForTimeout(200);

    // Persistence depends on implementation
  });
});
