/**
 * Example Unit Test
 *
 * This file demonstrates how to write unit tests for BitChat
 * using the testing infrastructure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockMessage,
  createMockChannel,
  createMockPeer,
  createMockMessages,
  waitFor,
} from './utils';
import {
  createMockEvent,
  createMockRelay,
  mockSodium,
  createMockStorageAdapter,
} from './mocks';

describe('Test Utilities', () => {
  describe('createMockMessage', () => {
    it('should create a message with default values', () => {
      const message = createMockMessage();

      expect(message).toBeDefined();
      expect(message.id).toBeTruthy();
      expect(message.content).toBe('This is a test message');
      expect(message.status).toBe('sent');
      expect(message.type).toBe('text');
    });

    it('should allow overriding default values', () => {
      const message = createMockMessage({
        content: 'Custom content',
        status: 'sending',
        senderId: 'custom-sender',
      });

      expect(message.content).toBe('Custom content');
      expect(message.status).toBe('sending');
      expect(message.senderId).toBe('custom-sender');
    });
  });

  describe('createMockChannel', () => {
    it('should create a channel with default values', () => {
      const channel = createMockChannel();

      expect(channel).toBeDefined();
      expect(channel.id).toBeTruthy();
      expect(channel.type).toBe('location');
      expect(channel.geohash).toBeTruthy();
    });

    it('should support DM channels', () => {
      const channel = createMockChannel({
        type: 'dm',
        name: 'DM with Alice',
      });

      expect(channel.type).toBe('dm');
      expect(channel.name).toBe('DM with Alice');
    });
  });

  describe('createMockMessages', () => {
    it('should create multiple messages', () => {
      const messages = createMockMessages(5);

      expect(messages).toHaveLength(5);
      messages.forEach((msg, i) => {
        expect(msg.content).toBe(`Test message ${i + 1}`);
      });
    });

    it('should set all messages to same channel', () => {
      const messages = createMockMessages(3, 'channel-abc');

      messages.forEach((msg) => {
        expect(msg.channelId).toBe('channel-abc');
      });
    });
  });

  describe('createMockPeer', () => {
    it('should create a peer with default values', () => {
      const peer = createMockPeer();

      expect(peer).toBeDefined();
      expect(peer.id).toBeTruthy();
      expect(peer.nickname).toBeTruthy();
      expect(peer.fingerprint).toBeTruthy();
    });
  });
});

describe('Async Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('waitFor', () => {
    it('should resolve when condition becomes true', async () => {
      let flag = false;

      // Set flag after 100ms
      setTimeout(() => {
        flag = true;
      }, 100);

      const promise = waitFor(() => flag, { timeout: 1000 });

      // Advance timers
      await vi.advanceTimersByTimeAsync(100);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should timeout when condition never becomes true', async () => {
      const promise = waitFor(() => false, { timeout: 100 });

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(150);

      await expect(promise).rejects.toThrow('timed out');
    });
  });
});

describe('Nostr Mocks', () => {
  describe('createMockEvent', () => {
    it('should create a valid event structure', () => {
      const event = createMockEvent();

      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('pubkey');
      expect(event).toHaveProperty('created_at');
      expect(event).toHaveProperty('kind');
      expect(event).toHaveProperty('tags');
      expect(event).toHaveProperty('content');
      expect(event).toHaveProperty('sig');
    });

    it('should allow custom content', () => {
      const event = createMockEvent({
        content: 'Hello, Nostr!',
        kind: 20000,
      });

      expect(event.content).toBe('Hello, Nostr!');
      expect(event.kind).toBe(20000);
    });
  });

  describe('createMockRelay', () => {
    it('should create a relay with expected methods', () => {
      const relay = createMockRelay('wss://test.relay.local');

      expect(relay.url).toBe('wss://test.relay.local');
      expect(relay.connect).toBeDefined();
      expect(relay.close).toBeDefined();
      expect(relay.publish).toBeDefined();
      expect(relay.subscribe).toBeDefined();
    });

    it('should handle event publishing', async () => {
      const relay = createMockRelay('wss://test.relay.local');
      const event = createMockEvent({ content: 'Test message' });

      const result = await relay.publish(event);

      expect(result).toBe(event.id);
      expect(relay.publish).toHaveBeenCalledWith(event);
    });
  });
});

describe('Crypto Mocks', () => {
  describe('mockSodium', () => {
    it('should provide randombytes_buf', () => {
      const bytes = mockSodium.randombytes_buf(32);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
    });

    it('should provide crypto_box_keypair', () => {
      const keypair = mockSodium.crypto_box_keypair();

      expect(keypair).toHaveProperty('publicKey');
      expect(keypair).toHaveProperty('privateKey');
      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
    });

    it('should provide hex encoding', () => {
      const bytes = new Uint8Array([0x12, 0x34, 0xab, 0xcd]);
      const hex = mockSodium.to_hex(bytes);

      expect(hex).toBe('1234abcd');
    });

    it('should provide hex decoding', () => {
      const bytes = mockSodium.from_hex('1234abcd');

      expect(bytes).toEqual(new Uint8Array([0x12, 0x34, 0xab, 0xcd]));
    });
  });
});

describe('Storage Mocks', () => {
  describe('createMockStorageAdapter', () => {
    it('should create a storage adapter', () => {
      const storage = createMockStorageAdapter('test');

      expect(storage.name).toBe('test');
      expect(storage.get).toBeDefined();
      expect(storage.set).toBeDefined();
      expect(storage.delete).toBeDefined();
      expect(storage.clear).toBeDefined();
    });

    it('should store and retrieve values', async () => {
      const storage = createMockStorageAdapter('test');

      await storage.set('key1', { foo: 'bar' });
      const value = await storage.get<{ foo: string }>('key1');

      expect(value).toEqual({ foo: 'bar' });
    });

    it('should return null for missing keys', async () => {
      const storage = createMockStorageAdapter('test');
      const value = await storage.get('nonexistent');

      expect(value).toBeNull();
    });

    it('should clear all values', async () => {
      const storage = createMockStorageAdapter('test');

      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.clear();

      const keys = await storage.keys();
      expect(keys).toHaveLength(0);
    });
  });
});

describe('Browser API Mocks', () => {
  it('should mock localStorage', () => {
    localStorage.setItem('test', 'value');
    expect(localStorage.getItem('test')).toBe('value');

    localStorage.removeItem('test');
    expect(localStorage.getItem('test')).toBeNull();
  });

  it('should mock crypto.getRandomValues', () => {
    const buffer = new Uint8Array(16);
    crypto.getRandomValues(buffer);

    // Buffer should be filled with non-zero values (mostly)
    const hasNonZero = buffer.some((v) => v !== 0);
    expect(hasNonZero).toBe(true);
  });

  it('should mock matchMedia', () => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    expect(mql).toBeDefined();
    expect(mql.matches).toBe(false);
    expect(mql.addEventListener).toBeDefined();
  });

  it('should mock ResizeObserver', () => {
    const observer = new ResizeObserver(() => {});

    expect(observer.observe).toBeDefined();
    expect(observer.disconnect).toBeDefined();
  });

  it('should mock IntersectionObserver', () => {
    const observer = new IntersectionObserver(() => {});

    expect(observer.observe).toBeDefined();
    expect(observer.disconnect).toBeDefined();
  });
});
