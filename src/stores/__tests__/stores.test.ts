/**
 * Zustand Store Tests
 *
 * Tests for message, channel, settings, and other Zustand stores.
 * These tests verify state management, persistence, and selectors.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/preact';
import {
  useMessagesStore,
  getMessagesForChannel,
  getUnreadCount,
  getLastMessage,
  searchMessages,
} from '../messages-store';
import {
  useChannelsStore,
  createChannel,
  getActiveChannel,
  getChannelById,
  getChannelsByType,
  getSortedChannels,
  getTotalUnreadCount,
  channelExists,
} from '../channels-store';
import {
  useSettingsStore,
  getEffectiveTheme,
  DEFAULT_SETTINGS,
} from '../settings-store';
import type { Message, Channel, MessageStatus, ChannelType } from '../types';

// Helper to create test messages
function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random().toString(36).substring(7)}`,
    channelId: 'test-channel',
    senderFingerprint: 'test-fingerprint',
    senderNickname: 'TestUser',
    content: 'Test message content',
    timestamp: Date.now(),
    type: 'text',
    status: 'sent',
    isOwn: false,
    isRead: false,
    ...overrides,
  };
}

// Helper to create test channels
function createTestChannel(overrides: Partial<Channel> = {}): Channel {
  return createChannel({
    id: `channel-${Math.random().toString(36).substring(7)}`,
    name: 'Test Channel',
    type: 'location',
    ...overrides,
  });
}

describe('Messages Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMessagesStore.setState({ messages: {}, maxMessagesPerChannel: 1000 });
  });

  describe('addMessage', () => {
    it('should add a message to a channel', () => {
      const message = createTestMessage({ channelId: 'channel1' });

      useMessagesStore.getState().addMessage(message);

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages).toHaveLength(1);
      expect(messages?.[0]).toEqual(message);
    });

    it('should not add duplicate messages', () => {
      const message = createTestMessage({ id: 'unique-id', channelId: 'channel1' });

      useMessagesStore.getState().addMessage(message);
      useMessagesStore.getState().addMessage(message);

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages).toHaveLength(1);
    });

    it('should sort messages by timestamp', () => {
      const msg1 = createTestMessage({ channelId: 'channel1', timestamp: 1000 });
      const msg2 = createTestMessage({ channelId: 'channel1', timestamp: 3000 });
      const msg3 = createTestMessage({ channelId: 'channel1', timestamp: 2000 });

      useMessagesStore.getState().addMessage(msg1);
      useMessagesStore.getState().addMessage(msg2);
      useMessagesStore.getState().addMessage(msg3);

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages?.[0].timestamp).toBe(1000);
      expect(messages?.[1].timestamp).toBe(2000);
      expect(messages?.[2].timestamp).toBe(3000);
    });

    it('should trim messages exceeding max limit', () => {
      useMessagesStore.setState({ maxMessagesPerChannel: 3 });

      for (let i = 0; i < 5; i++) {
        useMessagesStore.getState().addMessage(
          createTestMessage({
            channelId: 'channel1',
            timestamp: i * 1000,
            content: `Message ${i}`,
          })
        );
      }

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages).toHaveLength(3);
      // Should keep the most recent messages
      expect(messages?.[0].content).toBe('Message 2');
      expect(messages?.[2].content).toBe('Message 4');
    });
  });

  describe('removeMessage', () => {
    it('should remove a message from a channel', () => {
      const message = createTestMessage({ id: 'to-remove', channelId: 'channel1' });
      useMessagesStore.getState().addMessage(message);

      useMessagesStore.getState().removeMessage('channel1', 'to-remove');

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages).toHaveLength(0);
    });

    it('should not affect other messages', () => {
      const msg1 = createTestMessage({ id: 'keep', channelId: 'channel1' });
      const msg2 = createTestMessage({ id: 'remove', channelId: 'channel1' });

      useMessagesStore.getState().addMessage(msg1);
      useMessagesStore.getState().addMessage(msg2);
      useMessagesStore.getState().removeMessage('channel1', 'remove');

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages).toHaveLength(1);
      expect(messages?.[0].id).toBe('keep');
    });
  });

  describe('updateMessageStatus', () => {
    it('should update message status', () => {
      const message = createTestMessage({ id: 'status-test', channelId: 'channel1', status: 'pending' });
      useMessagesStore.getState().addMessage(message);

      useMessagesStore.getState().updateMessageStatus('channel1', 'status-test', 'delivered');

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages?.[0].status).toBe('delivered');
    });
  });

  describe('markAsRead', () => {
    it('should mark a message as read', () => {
      const message = createTestMessage({ id: 'read-test', channelId: 'channel1', isRead: false });
      useMessagesStore.getState().addMessage(message);

      useMessagesStore.getState().markAsRead('channel1', 'read-test');

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages?.[0].isRead).toBe(true);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all messages in a channel as read', () => {
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', isRead: false }));
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', isRead: false }));
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', isRead: false }));

      useMessagesStore.getState().markAllAsRead('channel1');

      const messages = useMessagesStore.getState().messages['channel1'];
      expect(messages?.every(m => m.isRead)).toBe(true);
    });
  });

  describe('clearChannel', () => {
    it('should clear all messages in a channel', () => {
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1' }));
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1' }));

      useMessagesStore.getState().clearChannel('channel1');

      expect(useMessagesStore.getState().messages['channel1']).toBeUndefined();
    });

    it('should not affect other channels', () => {
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1' }));
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel2' }));

      useMessagesStore.getState().clearChannel('channel1');

      expect(useMessagesStore.getState().messages['channel1']).toBeUndefined();
      expect(useMessagesStore.getState().messages['channel2']).toHaveLength(1);
    });
  });

  describe('clearAll', () => {
    it('should clear all messages from all channels', () => {
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1' }));
      useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel2' }));

      useMessagesStore.getState().clearAll();

      expect(useMessagesStore.getState().messages).toEqual({});
    });
  });

  describe('Selectors', () => {
    describe('getMessagesForChannel', () => {
      it('should return messages for a channel', () => {
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', content: 'Hello' }));

        const messages = getMessagesForChannel('channel1');
        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe('Hello');
      });

      it('should return empty array for non-existent channel', () => {
        const messages = getMessagesForChannel('nonexistent');
        expect(messages).toEqual([]);
      });
    });

    describe('getUnreadCount', () => {
      it('should count unread messages from others', () => {
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', isRead: false, isOwn: false }));
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', isRead: false, isOwn: false }));
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', isRead: true, isOwn: false }));
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', isRead: false, isOwn: true }));

        const count = getUnreadCount('channel1');
        expect(count).toBe(2);
      });
    });

    describe('getLastMessage', () => {
      it('should return the last message in a channel', () => {
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', timestamp: 1000 }));
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', timestamp: 3000, content: 'Last' }));
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', timestamp: 2000 }));

        const last = getLastMessage('channel1');
        expect(last?.content).toBe('Last');
      });
    });

    describe('searchMessages', () => {
      it('should search messages by content', () => {
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', content: 'Hello world' }));
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', content: 'Goodbye world' }));
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel2', content: 'Hello again' }));

        const results = searchMessages('Hello');
        expect(results).toHaveLength(2);
      });

      it('should search messages by sender nickname', () => {
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', senderNickname: 'Alice' }));
        useMessagesStore.getState().addMessage(createTestMessage({ channelId: 'channel1', senderNickname: 'Bob' }));

        const results = searchMessages('Alice');
        expect(results).toHaveLength(1);
      });
    });
  });
});

describe('Channels Store', () => {
  beforeEach(() => {
    useChannelsStore.setState({ channels: [], activeChannelId: null });
  });

  describe('addChannel', () => {
    it('should add a channel', () => {
      const channel = createTestChannel({ id: 'ch1', name: 'General' });

      useChannelsStore.getState().addChannel(channel);

      const channels = useChannelsStore.getState().channels;
      expect(channels).toHaveLength(1);
      expect(channels[0].name).toBe('General');
    });

    it('should not add duplicate channels', () => {
      const channel = createTestChannel({ id: 'duplicate' });

      useChannelsStore.getState().addChannel(channel);
      useChannelsStore.getState().addChannel(channel);

      const channels = useChannelsStore.getState().channels;
      expect(channels).toHaveLength(1);
    });
  });

  describe('removeChannel', () => {
    it('should remove a channel', () => {
      const channel = createTestChannel({ id: 'to-remove' });
      useChannelsStore.getState().addChannel(channel);

      useChannelsStore.getState().removeChannel('to-remove');

      expect(useChannelsStore.getState().channels).toHaveLength(0);
    });

    it('should update active channel when removing active channel', () => {
      const ch1 = createTestChannel({ id: 'ch1' });
      const ch2 = createTestChannel({ id: 'ch2' });

      useChannelsStore.getState().addChannel(ch1);
      useChannelsStore.getState().addChannel(ch2);
      useChannelsStore.getState().setActiveChannel('ch1');
      useChannelsStore.getState().removeChannel('ch1');

      expect(useChannelsStore.getState().activeChannelId).toBe('ch2');
    });

    it('should set activeChannelId to null when removing last channel', () => {
      const channel = createTestChannel({ id: 'only' });
      useChannelsStore.getState().addChannel(channel);
      useChannelsStore.getState().setActiveChannel('only');

      useChannelsStore.getState().removeChannel('only');

      expect(useChannelsStore.getState().activeChannelId).toBeNull();
    });
  });

  describe('setActiveChannel', () => {
    it('should set the active channel', () => {
      const channel = createTestChannel({ id: 'active' });
      useChannelsStore.getState().addChannel(channel);

      useChannelsStore.getState().setActiveChannel('active');

      expect(useChannelsStore.getState().activeChannelId).toBe('active');
    });

    it('should not set non-existent channel as active', () => {
      useChannelsStore.getState().setActiveChannel('nonexistent');

      expect(useChannelsStore.getState().activeChannelId).toBeNull();
    });
  });

  describe('updateChannel', () => {
    it('should update channel properties', () => {
      const channel = createTestChannel({ id: 'update-test', name: 'Old Name' });
      useChannelsStore.getState().addChannel(channel);

      useChannelsStore.getState().updateChannel('update-test', { name: 'New Name' });

      const updated = useChannelsStore.getState().channels.find(c => c.id === 'update-test');
      expect(updated?.name).toBe('New Name');
    });
  });

  describe('incrementUnread', () => {
    it('should increment unread count', () => {
      const channel = createTestChannel({ id: 'unread-test' });
      useChannelsStore.getState().addChannel(channel);

      useChannelsStore.getState().incrementUnread('unread-test');
      useChannelsStore.getState().incrementUnread('unread-test');

      const updated = useChannelsStore.getState().channels.find(c => c.id === 'unread-test');
      expect(updated?.unreadCount).toBe(2);
    });
  });

  describe('clearUnread', () => {
    it('should clear unread count', () => {
      const channel = createTestChannel({ id: 'clear-unread' });
      useChannelsStore.getState().addChannel(channel);
      useChannelsStore.getState().incrementUnread('clear-unread');
      useChannelsStore.getState().incrementUnread('clear-unread');

      useChannelsStore.getState().clearUnread('clear-unread');

      const updated = useChannelsStore.getState().channels.find(c => c.id === 'clear-unread');
      expect(updated?.unreadCount).toBe(0);
    });
  });

  describe('pinChannel', () => {
    it('should pin a channel', () => {
      const channel = createTestChannel({ id: 'pin-test' });
      useChannelsStore.getState().addChannel(channel);

      useChannelsStore.getState().pinChannel('pin-test', true);

      const updated = useChannelsStore.getState().channels.find(c => c.id === 'pin-test');
      expect(updated?.isPinned).toBe(true);
    });

    it('should unpin a channel', () => {
      const channel = createTestChannel({ id: 'unpin-test' });
      useChannelsStore.getState().addChannel(channel);
      useChannelsStore.getState().pinChannel('unpin-test', true);

      useChannelsStore.getState().pinChannel('unpin-test', false);

      const updated = useChannelsStore.getState().channels.find(c => c.id === 'unpin-test');
      expect(updated?.isPinned).toBe(false);
    });
  });

  describe('muteChannel', () => {
    it('should mute a channel', () => {
      const channel = createTestChannel({ id: 'mute-test' });
      useChannelsStore.getState().addChannel(channel);

      useChannelsStore.getState().muteChannel('mute-test', true);

      const updated = useChannelsStore.getState().channels.find(c => c.id === 'mute-test');
      expect(updated?.isMuted).toBe(true);
    });
  });

  describe('Selectors', () => {
    describe('getActiveChannel', () => {
      it('should return the active channel', () => {
        const channel = createTestChannel({ id: 'active', name: 'Active Channel' });
        useChannelsStore.getState().addChannel(channel);
        useChannelsStore.getState().setActiveChannel('active');

        const active = getActiveChannel();
        expect(active?.name).toBe('Active Channel');
      });

      it('should return undefined when no active channel', () => {
        expect(getActiveChannel()).toBeUndefined();
      });
    });

    describe('getChannelById', () => {
      it('should return channel by ID', () => {
        const channel = createTestChannel({ id: 'find-me' });
        useChannelsStore.getState().addChannel(channel);

        const found = getChannelById('find-me');
        expect(found?.id).toBe('find-me');
      });
    });

    describe('getChannelsByType', () => {
      it('should filter channels by type', () => {
        useChannelsStore.getState().addChannel(createTestChannel({ id: 'loc1', type: 'location' }));
        useChannelsStore.getState().addChannel(createTestChannel({ id: 'dm1', type: 'dm' }));
        useChannelsStore.getState().addChannel(createTestChannel({ id: 'loc2', type: 'location' }));

        const locations = getChannelsByType('location');
        expect(locations).toHaveLength(2);
      });
    });

    describe('getSortedChannels', () => {
      it('should sort pinned channels first', () => {
        useChannelsStore.getState().addChannel(createTestChannel({ id: 'unpinned', lastMessageAt: 3000 }));
        useChannelsStore.getState().addChannel(createTestChannel({ id: 'pinned', lastMessageAt: 1000, isPinned: true } as Partial<Channel>));

        const sorted = getSortedChannels();
        expect(sorted[0].id).toBe('pinned');
      });

      it('should sort by last message time within pinned/unpinned groups', () => {
        useChannelsStore.getState().addChannel(createTestChannel({ id: 'old', lastMessageAt: 1000 }));
        useChannelsStore.getState().addChannel(createTestChannel({ id: 'new', lastMessageAt: 3000 }));

        const sorted = getSortedChannels();
        expect(sorted[0].id).toBe('new');
      });
    });

    describe('getTotalUnreadCount', () => {
      it('should sum unread counts across all channels', () => {
        const ch1 = createTestChannel({ id: 'ch1' });
        const ch2 = createTestChannel({ id: 'ch2' });
        useChannelsStore.getState().addChannel(ch1);
        useChannelsStore.getState().addChannel(ch2);
        useChannelsStore.getState().incrementUnread('ch1');
        useChannelsStore.getState().incrementUnread('ch1');
        useChannelsStore.getState().incrementUnread('ch2');

        const total = getTotalUnreadCount();
        expect(total).toBe(3);
      });
    });

    describe('channelExists', () => {
      it('should return true for existing channel', () => {
        useChannelsStore.getState().addChannel(createTestChannel({ id: 'exists' }));
        expect(channelExists('exists')).toBe(true);
      });

      it('should return false for non-existing channel', () => {
        expect(channelExists('not-exists')).toBe(false);
      });
    });
  });
});

describe('Settings Store', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS } });
  });

  describe('updateSettings', () => {
    it('should update multiple settings at once', () => {
      useSettingsStore.getState().updateSettings({
        nickname: 'NewNick',
        theme: 'light',
      });

      const settings = useSettingsStore.getState().settings;
      expect(settings.nickname).toBe('NewNick');
      expect(settings.theme).toBe('light');
    });

    it('should preserve unchanged settings', () => {
      useSettingsStore.getState().updateSettings({ nickname: 'Test' });

      const settings = useSettingsStore.getState().settings;
      expect(settings.theme).toBe(DEFAULT_SETTINGS.theme);
      expect(settings.notifications).toBe(DEFAULT_SETTINGS.notifications);
    });
  });

  describe('setNickname', () => {
    it('should set nickname', () => {
      useSettingsStore.getState().setNickname('Alice');

      expect(useSettingsStore.getState().settings.nickname).toBe('Alice');
    });

    it('should trim nickname', () => {
      useSettingsStore.getState().setNickname('  Bob  ');

      expect(useSettingsStore.getState().settings.nickname).toBe('Bob');
    });

    it('should truncate nickname to 32 characters', () => {
      useSettingsStore.getState().setNickname('A'.repeat(50));

      expect(useSettingsStore.getState().settings.nickname.length).toBe(32);
    });
  });

  describe('setTheme', () => {
    it('should set theme to dark', () => {
      useSettingsStore.getState().setTheme('dark');

      expect(useSettingsStore.getState().settings.theme).toBe('dark');
    });

    it('should set theme to light', () => {
      useSettingsStore.getState().setTheme('light');

      expect(useSettingsStore.getState().settings.theme).toBe('light');
    });

    it('should set theme to system', () => {
      useSettingsStore.getState().setTheme('system');

      expect(useSettingsStore.getState().settings.theme).toBe('system');
    });
  });

  describe('setNotifications', () => {
    it('should set notification level', () => {
      useSettingsStore.getState().setNotifications('mentions');

      expect(useSettingsStore.getState().settings.notifications).toBe('mentions');
    });
  });

  describe('resetSettings', () => {
    it('should reset all settings to defaults', () => {
      useSettingsStore.getState().updateSettings({
        nickname: 'Changed',
        theme: 'light',
        notifications: 'none',
        soundEnabled: false,
      });

      useSettingsStore.getState().resetSettings();

      const settings = useSettingsStore.getState().settings;
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });
  });

  describe('Selectors', () => {
    describe('getEffectiveTheme', () => {
      it('should return dark for dark theme', () => {
        useSettingsStore.getState().setTheme('dark');
        expect(getEffectiveTheme()).toBe('dark');
      });

      it('should return light for light theme', () => {
        useSettingsStore.getState().setTheme('light');
        expect(getEffectiveTheme()).toBe('light');
      });

      it('should resolve system theme', () => {
        useSettingsStore.getState().setTheme('system');
        // In test environment, matchMedia returns false for dark mode
        const theme = getEffectiveTheme();
        expect(['dark', 'light']).toContain(theme);
      });
    });
  });
});

describe('Channel Helpers', () => {
  describe('createChannel', () => {
    it('should create channel with defaults', () => {
      const channel = createChannel({
        id: 'test',
        name: 'Test',
        type: 'location',
      });

      expect(channel.id).toBe('test');
      expect(channel.name).toBe('Test');
      expect(channel.type).toBe('location');
      expect(channel.unreadCount).toBe(0);
      expect(channel.isPinned).toBe(false);
      expect(channel.isMuted).toBe(false);
      expect(channel.lastMessageAt).toBeTypeOf('number');
      expect(channel.createdAt).toBeTypeOf('number');
    });

    it('should allow overriding defaults', () => {
      const channel = createChannel({
        id: 'test',
        name: 'Test',
        type: 'dm',
        unreadCount: 5,
        isPinned: true,
        dmPeerFingerprint: 'peer123',
      });

      expect(channel.unreadCount).toBe(5);
      expect(channel.isPinned).toBe(true);
      expect(channel.dmPeerFingerprint).toBe('peer123');
    });

    it('should create location channel with geohash', () => {
      const channel = createChannel({
        id: 'loc',
        name: '#9q8yy',
        type: 'location',
        geohash: '9q8yy',
        geohashPrecision: 5,
      });

      expect(channel.geohash).toBe('9q8yy');
      expect(channel.geohashPrecision).toBe(5);
    });
  });
});
