/**
 * Relay Pool Unit Tests
 *
 * Comprehensive unit tests for the RelayPool and OutboxQueue classes.
 * Tests cover:
 * 1. Connection Management - connect, disconnect, reconnection with backoff
 * 2. Event Publishing - publish to relays, handle failures, result tracking
 * 3. Event Subscription - subscribe with filters, EOSE, unsubscribe cleanup
 * 4. Offline Queue - enqueue, flush, retry logic, persistence
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';

// =============================================================================
// Mock Setup - Must be at top level before any imports
// =============================================================================

// Track mock instances for verification
const mockPoolInstances: any[] = [];
const mockEnsureRelayResults = new Map<string, { resolve: boolean; delay?: number; error?: Error }>();
const mockPublishResults = new Map<string, { resolve: boolean; delay?: number; error?: Error }>();

// Mock nostr-tools - factory function must not reference external variables directly
vi.mock('nostr-tools', () => {
  // Create mock class inside factory
  class MockSimplePoolInner {
    ensureRelay: any;
    subscribeMany: any;
    publish: any;
    close: any;

    private _connectedRelays: Set<string> = new Set();
    private _subscriptions: Map<string, { filters: any[]; params: any }> = new Map();

    constructor() {
      // Access global mock state through window/globalThis
      const instances = (globalThis as any).__mockPoolInstances || [];
      instances.push(this);
      (globalThis as any).__mockPoolInstances = instances;

      const ensureResults = (globalThis as any).__mockEnsureRelayResults || new Map();
      const publishResults = (globalThis as any).__mockPublishResults || new Map();

      this.ensureRelay = vi.fn().mockImplementation(async (url: string) => {
        const config = ensureResults.get(url) || { resolve: true, delay: 10 };

        if (config.delay) {
          await new Promise(resolve => setTimeout(resolve, config.delay));
        }

        if (config.error) {
          throw config.error;
        }

        if (!config.resolve) {
          throw new Error('Connection failed');
        }

        this._connectedRelays.add(url);
        return { url, connected: true };
      });

      this.subscribeMany = vi.fn().mockImplementation((_relays: string[], filters: any[], params: any) => {
        const subId = `sub-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        this._subscriptions.set(subId, { filters, params });

        // Simulate EOSE after short delay
        setTimeout(() => {
          params?.oneose?.();
        }, 10);

        return {
          close: vi.fn().mockImplementation(() => {
            this._subscriptions.delete(subId);
            params?.onclose?.('closed');
          }),
        };
      });

      this.publish = vi.fn().mockImplementation(async (relays: string[], _event: any) => {
        const results: string[] = [];

        for (const relay of relays) {
          const config = publishResults.get(relay) || { resolve: true, delay: 5 };

          if (config.delay) {
            await new Promise(resolve => setTimeout(resolve, config.delay));
          }

          if (config.error) {
            throw config.error;
          }

          if (!config.resolve) {
            throw new Error('Publish failed');
          }

          results.push(relay);
        }

        return results;
      });

      this.close = vi.fn().mockImplementation((relays: string[]) => {
        for (const relay of relays) {
          this._connectedRelays.delete(relay);
        }
      });
    }

    // Helper methods for testing
    getConnectedRelays(): string[] {
      return [...this._connectedRelays];
    }

    getSubscriptions(): Map<string, { filters: any[]; params: any }> {
      return this._subscriptions;
    }
  }

  return {
    SimplePool: MockSimplePoolInner,
  };
});

// Mock localStorage
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _getStore: () => store,
  };
};

let localStorageMock = createLocalStorageMock();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock crypto.randomUUID
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(7),
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (array === null) return array;
      const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  },
  writable: true,
});

// Now import the actual modules after mocking
import {
  RelayPool,
  getDefaultPool,
  resetDefaultPool,
  DEFAULT_RELAYS,
} from '../relays';
import { OutboxQueue } from '../queue';
import type { NostrEvent, NostrFilter, PublishResult } from '../types';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a test Nostr event
 */
function createTestEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  const created_at = Math.floor(Date.now() / 1000);
  const id = `test-event-${created_at}-${Math.random().toString(36).substring(7)}`;
  return {
    id,
    pubkey: '0'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: 'Test content',
    sig: '0'.repeat(128),
    ...overrides,
  };
}

/**
 * Wait for a condition with timeout
 */
async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 1000,
  interval = 10
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
}

// =============================================================================
// Test Suite: RelayPool - Connection Management
// =============================================================================

describe('RelayPool - Connection Management', () => {
  let pool: RelayPool;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Reset global mock state
    (globalThis as any).__mockPoolInstances = [];
    (globalThis as any).__mockEnsureRelayResults = new Map();
    (globalThis as any).__mockPublishResults = new Map();
    localStorageMock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
    resetDefaultPool();
    pool = new RelayPool();
  });

  afterEach(() => {
    try {
      pool?.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    vi.useRealTimers();
  });

  it('should create a new RelayPool instance', () => {
    expect(pool).toBeDefined();
    expect(pool).toBeInstanceOf(RelayPool);
  });

  it('should connect to specified relay URLs', async () => {
    const relayUrls = ['wss://relay1.test', 'wss://relay2.test', 'wss://relay3.test'];

    const connectPromise = pool.connect(relayUrls);
    await vi.runAllTimersAsync();
    await connectPromise;

    const instances = (globalThis as any).__mockPoolInstances || [];
    const mockPool = instances[0];
    expect(mockPool?.ensureRelay).toHaveBeenCalledTimes(3);
    for (const url of relayUrls) {
      expect(mockPool?.ensureRelay).toHaveBeenCalledWith(url);
    }
  });

  it('should use default relays when no URLs provided', async () => {
    const connectPromise = pool.connect();
    await vi.runAllTimersAsync();
    await connectPromise;

    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    expect(mockPool?.ensureRelay).toHaveBeenCalled();
    // Should have called ensureRelay for default relays
    expect(mockPool?.ensureRelay.mock.calls.length).toBe(DEFAULT_RELAYS.length);
  });

  it('should track connection state correctly', async () => {
    const relayUrls = ['wss://relay1.test', 'wss://relay2.test'];

    // Initially not connected
    expect(pool.isConnected()).toBe(false);
    expect(pool.getConnectedRelays()).toHaveLength(0);

    const connectPromise = pool.connect(relayUrls);
    await vi.runAllTimersAsync();
    await connectPromise;

    // Now should be connected
    expect(pool.isConnected()).toBe(true);
    const connectedRelays = pool.getConnectedRelays();
    expect(connectedRelays).toContain('wss://relay1.test');
    expect(connectedRelays).toContain('wss://relay2.test');
  });

  it('should handle connection failures gracefully', async () => {
    const relayUrls = ['wss://fail-relay.test', 'wss://success-relay.test'];

    // Configure first relay to fail
    ((globalThis as any).__mockEnsureRelayResults || new Map()).set('wss://fail-relay.test', {
      resolve: false,
      error: new Error('Connection refused')
    });
    ((globalThis as any).__mockEnsureRelayResults || new Map()).set('wss://success-relay.test', { resolve: true });

    const connectPromise = pool.connect(relayUrls);
    await vi.runAllTimersAsync();
    await connectPromise;

    // Should still report connected (one relay succeeded)
    const statuses = pool.getRelayStatuses();
    const failedRelay = statuses.find(s => s.url === 'wss://fail-relay.test');
    const successRelay = statuses.find(s => s.url === 'wss://success-relay.test');

    expect(failedRelay?.state).toBe('error');
    expect(successRelay?.state).toBe('connected');
  });

  it('should implement exponential backoff for reconnection', async () => {
    const backoffConfig = {
      initialDelayMs: 100,
      maxDelayMs: 1000,
      multiplier: 2,
      maxAttempts: 5,
    };

    pool = new RelayPool(backoffConfig);

    ((globalThis as any).__mockEnsureRelayResults || new Map()).set('wss://unstable-relay.test', {
      resolve: false,
      error: new Error('Connection failed'),
    });

    const connectPromise = pool.connect(['wss://unstable-relay.test']);
    // Only advance enough for initial connection attempt, not all reconnects
    await vi.advanceTimersByTimeAsync(50);
    await connectPromise;

    // Verify relay is in error state and has scheduled reconnect
    const statuses = pool.getRelayStatuses();
    const relayStatus = statuses.find(s => s.url === 'wss://unstable-relay.test');

    expect(relayStatus?.state).toBe('error');
    // The relay should have at least 1 reconnect attempt scheduled
    expect(relayStatus?.reconnectAttempts).toBeGreaterThanOrEqual(1);
    expect(relayStatus?.nextReconnectTime).toBeDefined();
  });

  it('should disconnect from all relays', async () => {
    const relayUrls = ['wss://relay1.test', 'wss://relay2.test'];

    const connectPromise = pool.connect(relayUrls);
    await vi.runAllTimersAsync();
    await connectPromise;

    expect(pool.isConnected()).toBe(true);

    pool.disconnect();

    expect(pool.isConnected()).toBe(false);
    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    expect(mockPool?.close).toHaveBeenCalled();
  });

  it('should notify state change listeners', async () => {
    const stateChanges: any[] = [];
    const unsubscribe = pool.onStateChange((status) => {
      stateChanges.push(status);
    });

    const connectPromise = pool.connect(['wss://relay1.test']);
    await vi.runAllTimersAsync();
    await connectPromise;

    expect(stateChanges.length).toBeGreaterThan(0);
    // Should have received connecting and connected states
    const states = stateChanges.map(s => s.state);
    expect(states).toContain('connecting');
    expect(states).toContain('connected');

    unsubscribe();
  });

  it('should add relays dynamically', async () => {
    const connectPromise = pool.connect(['wss://relay1.test']);
    await vi.runAllTimersAsync();
    await connectPromise;

    const addPromise = pool.addRelays(['wss://relay2.test', 'wss://relay3.test']);
    await vi.runAllTimersAsync();
    await addPromise;

    const statuses = pool.getRelayStatuses();
    const urls = statuses.map(s => s.url);
    expect(urls).toContain('wss://relay1.test');
    expect(urls).toContain('wss://relay2.test');
    expect(urls).toContain('wss://relay3.test');
  });

  it('should remove relays', async () => {
    const connectPromise = pool.connect(['wss://relay1.test', 'wss://relay2.test']);
    await vi.runAllTimersAsync();
    await connectPromise;

    pool.removeRelays(['wss://relay1.test']);

    const statuses = pool.getRelayStatuses();
    const urls = statuses.map(s => s.url);
    expect(urls).not.toContain('wss://relay1.test');
    expect(urls).toContain('wss://relay2.test');
  });

  it('should manually retry connection to a relay', async () => {
    ((globalThis as any).__mockEnsureRelayResults || new Map()).set('wss://retry-relay.test', {
      resolve: false,
      error: new Error('First attempt failed'),
    });

    const connectPromise = pool.connect(['wss://retry-relay.test']);
    await vi.runAllTimersAsync();
    await connectPromise;

    // Now configure it to succeed
    ((globalThis as any).__mockEnsureRelayResults || new Map()).set('wss://retry-relay.test', { resolve: true });

    const retryPromise = pool.retryConnection('wss://retry-relay.test');
    await vi.runAllTimersAsync();
    await retryPromise;

    const status = pool.getRelayStatus('wss://retry-relay.test');
    expect(status?.state).toBe('connected');
  });

  it('should reset all connections', async () => {
    const connectPromise = pool.connect(['wss://relay1.test', 'wss://relay2.test']);
    await vi.runAllTimersAsync();
    await connectPromise;

    const resetPromise = pool.resetConnections();
    await vi.runAllTimersAsync();
    await resetPromise;

    // Should still be connected after reset
    expect(pool.isConnected()).toBe(true);
    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    // Close should have been called during reset
    expect(mockPool?.close).toHaveBeenCalled();
  });

  it('should return singleton from getDefaultPool', () => {
    const pool1 = getDefaultPool();
    const pool2 = getDefaultPool();
    expect(pool1).toBe(pool2);
  });
});

// =============================================================================
// Test Suite: RelayPool - Event Publishing
// =============================================================================

describe('RelayPool - Event Publishing', () => {
  let pool: RelayPool;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (globalThis as any).__mockPoolInstances = [];
    (globalThis as any).__mockEnsureRelayResults = new Map();
    (globalThis as any).__mockPublishResults = new Map();
    resetDefaultPool();

    pool = new RelayPool();
    const connectPromise = pool.connect(['wss://relay1.test', 'wss://relay2.test', 'wss://relay3.test']);
    await vi.runAllTimersAsync();
    await connectPromise;
  });

  afterEach(() => {
    try {
      pool?.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    vi.useRealTimers();
  });

  it('should publish event to connected relays', async () => {
    const event = createTestEvent();

    const publishPromise = pool.publish(event);
    await vi.runAllTimersAsync();
    const result = await publishPromise;

    expect(result.event).toBe(event);
    expect(result.success).toBe(true);
    expect(result.relayResults.size).toBeGreaterThan(0);
  });

  it('should publish to specific relay URLs', async () => {
    const event = createTestEvent();
    const targetRelays = ['wss://relay1.test'];

    const publishPromise = pool.publish(event, targetRelays);
    await vi.runAllTimersAsync();
    const result = await publishPromise;

    expect(result.success).toBe(true);
    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    expect(mockPool?.publish).toHaveBeenCalledWith(targetRelays, event);
  });

  it('should handle partial relay failures during publish', async () => {
    const event = createTestEvent();

    // Configure one relay to fail
    ((globalThis as any).__mockPublishResults || new Map()).set('wss://relay2.test', {
      resolve: false,
      error: new Error('Publish failed'),
    });

    const publishPromise = pool.publish(event, ['wss://relay1.test', 'wss://relay2.test']);
    await vi.runAllTimersAsync();
    const result = await publishPromise;

    // Should still succeed overall (at least one relay worked)
    expect(result.success).toBe(true);

    const relay1Result = result.relayResults.get('wss://relay1.test');
    expect(relay1Result?.success).toBe(true);
  });

  it('should track messages sent per relay', async () => {
    const event = createTestEvent();

    const publishPromise = pool.publish(event, ['wss://relay1.test']);
    await vi.runAllTimersAsync();
    await publishPromise;

    const status = pool.getRelayStatus('wss://relay1.test');
    expect(status?.messagesSent).toBeGreaterThan(0);
  });

  it('should return failure when no relays available', async () => {
    pool.disconnect();

    const event = createTestEvent();
    const result = await pool.publish(event);

    expect(result.success).toBe(false);
    expect(result.relayResults.size).toBe(0);
  });

  it('should publish different event kinds', async () => {
    const textNote = createTestEvent({ kind: 1, content: 'Text note' });
    const metadata = createTestEvent({ kind: 0, content: '{"name":"test"}' });
    const dm = createTestEvent({ kind: 4, content: 'encrypted content' });

    const results = await Promise.all([
      pool.publish(textNote).then(async r => { await vi.runAllTimersAsync(); return r; }),
      pool.publish(metadata).then(async r => { await vi.runAllTimersAsync(); return r; }),
      pool.publish(dm).then(async r => { await vi.runAllTimersAsync(); return r; }),
    ]);

    await vi.runAllTimersAsync();

    for (const result of results) {
      expect(result.success).toBe(true);
    }
  });
});

// =============================================================================
// Test Suite: RelayPool - Event Subscription
// =============================================================================

describe('RelayPool - Event Subscription', () => {
  let pool: RelayPool;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (globalThis as any).__mockPoolInstances = [];
    (globalThis as any).__mockEnsureRelayResults = new Map();
    (globalThis as any).__mockPublishResults = new Map();
    resetDefaultPool();

    pool = new RelayPool();
    const connectPromise = pool.connect(['wss://relay1.test', 'wss://relay2.test']);
    await vi.runAllTimersAsync();
    await connectPromise;
  });

  afterEach(() => {
    try {
      pool?.disconnect();
    } catch {
      // Ignore cleanup errors
    }
    vi.useRealTimers();
  });

  it('should subscribe with kind filter', async () => {
    const filters: NostrFilter[] = [{ kinds: [1], limit: 10 }];
    const events: NostrEvent[] = [];

    const sub = pool.subscribe(
      ['wss://relay1.test'],
      filters,
      (event) => events.push(event)
    );

    await vi.runAllTimersAsync();

    expect(sub.id).toBeDefined();
    expect(sub.close).toBeDefined();

    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    expect(mockPool?.subscribeMany).toHaveBeenCalledWith(
      expect.any(Array),
      filters,
      expect.any(Object)
    );

    sub.close();
  });

  it('should subscribe with author filter', async () => {
    const testPubkey = 'a'.repeat(64);
    const filters: NostrFilter[] = [{ authors: [testPubkey] }];

    const sub = pool.subscribe(
      ['wss://relay1.test'],
      filters,
      () => {}
    );

    await vi.runAllTimersAsync();

    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    const callArgs = mockPool?.subscribeMany.mock.calls[0];
    expect(callArgs?.[1]).toEqual(filters);

    sub.close();
  });

  it('should subscribe with tag filter', async () => {
    const filters: NostrFilter[] = [{ '#d': ['test-channel'] }];

    const sub = pool.subscribe(
      ['wss://relay1.test'],
      filters,
      () => {}
    );

    await vi.runAllTimersAsync();

    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    const callArgs = mockPool?.subscribeMany.mock.calls[0];
    expect(callArgs?.[1]).toEqual(filters);

    sub.close();
  });

  it('should call onEvent callback when receiving events', async () => {
    const receivedEvents: NostrEvent[] = [];
    const receivedRelays: string[] = [];

    const sub = pool.subscribe(
      ['wss://relay1.test'],
      [{ kinds: [1] }],
      (event, relayUrl) => {
        receivedEvents.push(event);
        receivedRelays.push(relayUrl);
      }
    );

    // Simulate receiving an event by calling the onevent callback
    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    const subParams = mockPool?.subscribeMany.mock.calls[0]?.[2];
    const testEvent = createTestEvent();
    subParams?.onevent?.(testEvent);

    await vi.runAllTimersAsync();

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0]).toEqual(testEvent);

    sub.close();
  });

  it('should handle EOSE correctly', async () => {
    let eoseReceived = false;

    const sub = pool.subscribe(
      ['wss://relay1.test'],
      [{ kinds: [1] }],
      () => {},
      { onEose: () => { eoseReceived = true; } }
    );

    await vi.runAllTimersAsync();

    // EOSE should be called by the mock after delay
    expect(eoseReceived).toBe(true);

    sub.close();
  });

  it('should unsubscribe and clean up properly', async () => {
    let closeReceived = false;

    const sub = pool.subscribe(
      ['wss://relay1.test'],
      [{ kinds: [1] }],
      () => {},
      { onClose: () => { closeReceived = true; } }
    );

    await vi.runAllTimersAsync();

    sub.close();

    expect(closeReceived).toBe(true);
  });

  it('should handle multiple concurrent subscriptions', async () => {
    const sub1Events: NostrEvent[] = [];
    const sub2Events: NostrEvent[] = [];
    const sub3Events: NostrEvent[] = [];

    const sub1 = pool.subscribe(['wss://relay1.test'], [{ kinds: [1] }], (e) => sub1Events.push(e));
    const sub2 = pool.subscribe(['wss://relay1.test'], [{ kinds: [0] }], (e) => sub2Events.push(e));
    const sub3 = pool.subscribe(['wss://relay1.test'], [{ kinds: [4] }], (e) => sub3Events.push(e));

    await vi.runAllTimersAsync();

    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    expect(mockPool?.subscribeMany).toHaveBeenCalledTimes(3);

    sub1.close();
    sub2.close();
    sub3.close();
  });

  it('should generate unique subscription IDs', async () => {
    const sub1 = pool.subscribe(['wss://relay1.test'], [{ kinds: [1] }], () => {});
    const sub2 = pool.subscribe(['wss://relay1.test'], [{ kinds: [1] }], () => {});
    const sub3 = pool.subscribe(['wss://relay1.test'], [{ kinds: [1] }], () => {});

    await vi.runAllTimersAsync();

    expect(sub1.id).not.toBe(sub2.id);
    expect(sub2.id).not.toBe(sub3.id);
    expect(sub1.id).not.toBe(sub3.id);

    sub1.close();
    sub2.close();
    sub3.close();
  });

  it('should support custom subscription IDs', async () => {
    const customId = 'my-custom-subscription-id';

    const sub = pool.subscribe(
      ['wss://relay1.test'],
      [{ kinds: [1] }],
      () => {},
      { id: customId }
    );

    await vi.runAllTimersAsync();

    expect(sub.id).toBe(customId);

    sub.close();
  });
});

// =============================================================================
// Test Suite: OutboxQueue
// =============================================================================

describe('OutboxQueue', () => {
  let queue: OutboxQueue;
  let flushHandler: Mock<[NostrEvent, string[]], Promise<PublishResult>>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock = createLocalStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    flushHandler = vi.fn().mockResolvedValue({
      event: {} as NostrEvent,
      relayResults: new Map(),
      success: true,
    });

    queue = new OutboxQueue({
      storageKey: 'test_outbox_queue',
      maxQueueSize: 10,
      maxRetries: 3,
      onFlush: flushHandler,
    });
  });

  afterEach(() => {
    queue.clear();
  });

  it('should enqueue events', async () => {
    const event = createTestEvent();
    const relayUrls = ['wss://relay1.test', 'wss://relay2.test'];

    await queue.enqueue(event, relayUrls);

    expect(queue.size()).toBe(1);
    expect(queue.has(event.id)).toBe(true);
  });

  it('should prevent duplicate events in queue', async () => {
    const event = createTestEvent();
    const relayUrls = ['wss://relay1.test'];

    await queue.enqueue(event, relayUrls);
    await queue.enqueue(event, relayUrls);
    await queue.enqueue(event, relayUrls);

    expect(queue.size()).toBe(1);
  });

  it('should merge relay URLs for duplicate events', async () => {
    const event = createTestEvent();

    await queue.enqueue(event, ['wss://relay1.test']);
    await queue.enqueue(event, ['wss://relay2.test']);

    const queued = queue.getAll();
    expect(queued[0].relayUrls).toContain('wss://relay1.test');
    expect(queued[0].relayUrls).toContain('wss://relay2.test');
  });

  it('should respect max queue size', async () => {
    // Create queue with small max size
    queue = new OutboxQueue({
      storageKey: 'test_small_queue',
      maxQueueSize: 3,
      onFlush: flushHandler,
    });

    // Add more events than max size
    for (let i = 0; i < 5; i++) {
      const event = createTestEvent({ id: `event-${i}` });
      await queue.enqueue(event, ['wss://relay1.test']);
    }

    expect(queue.size()).toBe(3);

    // Oldest events should be removed
    expect(queue.has('event-0')).toBe(false);
    expect(queue.has('event-1')).toBe(false);
    expect(queue.has('event-4')).toBe(true);
  });

  it('should flush queued events', async () => {
    const events = [
      createTestEvent({ id: 'flush-1' }),
      createTestEvent({ id: 'flush-2' }),
      createTestEvent({ id: 'flush-3' }),
    ];

    for (const event of events) {
      await queue.enqueue(event, ['wss://relay1.test']);
    }

    expect(queue.size()).toBe(3);

    await queue.flush();

    expect(flushHandler).toHaveBeenCalledTimes(3);
    expect(queue.size()).toBe(0);
  });

  it('should retry failed events up to max retries', async () => {
    const event = createTestEvent({ id: 'retry-test' });
    await queue.enqueue(event, ['wss://relay1.test']);

    // First two flushes fail, third succeeds
    let flushCount = 0;
    flushHandler.mockImplementation(async () => {
      flushCount++;
      if (flushCount < 3) {
        return { event, relayResults: new Map(), success: false };
      }
      return { event, relayResults: new Map(), success: true };
    });

    // Each flush should keep the event if failed
    await queue.flush();
    expect(queue.size()).toBe(1);

    await queue.flush();
    expect(queue.size()).toBe(1);

    await queue.flush();
    expect(queue.size()).toBe(0);
  });

  it('should drop events after max retries', async () => {
    queue = new OutboxQueue({
      storageKey: 'test_retry_queue',
      maxRetries: 2,
      onFlush: vi.fn().mockResolvedValue({
        event: {} as NostrEvent,
        relayResults: new Map(),
        success: false,
      }),
    });

    const event = createTestEvent({ id: 'drop-test' });
    await queue.enqueue(event, ['wss://relay1.test']);

    // Flush twice (max retries = 2)
    await queue.flush();
    expect(queue.size()).toBe(1); // Still in queue after first attempt

    await queue.flush();
    expect(queue.size()).toBe(0); // Dropped after max retries
  });

  it('should persist queue to localStorage', async () => {
    const event = createTestEvent();
    await queue.enqueue(event, ['wss://relay1.test']);

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test_outbox_queue',
      expect.any(String)
    );
  });

  it('should load queue from localStorage on init', () => {
    const persistedQueue = JSON.stringify([
      {
        event: createTestEvent({ id: 'persisted-1' }),
        relayUrls: ['wss://relay1.test'],
        queuedAt: Date.now(),
        attempts: 0,
      },
    ]);

    localStorageMock.getItem = vi.fn().mockReturnValue(persistedQueue);

    const newQueue = new OutboxQueue({
      storageKey: 'test_persisted_queue',
    });

    expect(newQueue.size()).toBe(1);
    expect(newQueue.has('persisted-1')).toBe(true);
  });

  it('should clear the queue', async () => {
    const event = createTestEvent();
    await queue.enqueue(event, ['wss://relay1.test']);

    expect(queue.size()).toBe(1);

    await queue.clear();

    expect(queue.size()).toBe(0);
  });

  it('should remove specific event from queue', async () => {
    const event1 = createTestEvent({ id: 'remove-1' });
    const event2 = createTestEvent({ id: 'remove-2' });

    await queue.enqueue(event1, ['wss://relay1.test']);
    await queue.enqueue(event2, ['wss://relay1.test']);

    expect(queue.size()).toBe(2);

    const removed = await queue.remove('remove-1');

    expect(removed).toBe(true);
    expect(queue.size()).toBe(1);
    expect(queue.has('remove-1')).toBe(false);
    expect(queue.has('remove-2')).toBe(true);
  });

  it('should return false when removing non-existent event', async () => {
    const removed = await queue.remove('non-existent');
    expect(removed).toBe(false);
  });

  it('should get all queued events', async () => {
    const events = [
      createTestEvent({ id: 'get-all-1' }),
      createTestEvent({ id: 'get-all-2' }),
    ];

    for (const event of events) {
      await queue.enqueue(event, ['wss://relay1.test']);
    }

    const allEvents = queue.getAll();

    expect(allEvents).toHaveLength(2);
    expect(allEvents.map(e => e.event.id)).toContain('get-all-1');
    expect(allEvents.map(e => e.event.id)).toContain('get-all-2');
  });

  it('should update flush handler', async () => {
    const newHandler: (event: NostrEvent, relayUrls: string[]) => Promise<PublishResult> = vi.fn().mockResolvedValue({
      event: {} as NostrEvent,
      relayResults: new Map(),
      success: true,
    });

    queue.setFlushHandler(newHandler);

    const event = createTestEvent();
    await queue.enqueue(event, ['wss://relay1.test']);
    await queue.flush();

    expect(newHandler).toHaveBeenCalled();
  });

  it('should handle concurrent flushes', async () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      createTestEvent({ id: `concurrent-${i}` })
    );

    for (const event of events) {
      await queue.enqueue(event, ['wss://relay1.test']);
    }

    // Start multiple flushes concurrently
    const flushPromises = [
      queue.flush(),
      queue.flush(),
      queue.flush(),
    ];

    await Promise.all(flushPromises);

    // Each event should only be flushed once
    expect(flushHandler).toHaveBeenCalledTimes(5);
  });

  it('should prune expired events', async () => {
    queue = new OutboxQueue({
      storageKey: 'test_expire_queue',
      maxEventAge: 100, // 100ms expiration
      onFlush: flushHandler,
    });

    const event = createTestEvent();
    await queue.enqueue(event, ['wss://relay1.test']);

    expect(queue.size()).toBe(1);

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 150));

    // Flush should prune expired events
    await queue.flush();

    // Event should not have been sent (pruned before flush)
    expect(flushHandler).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Test Suite: Integration - RelayPool with OutboxQueue
// =============================================================================

describe('Integration - RelayPool with OutboxQueue', () => {
  let pool: RelayPool;
  let queue: OutboxQueue;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    (globalThis as any).__mockPoolInstances = [];
    (globalThis as any).__mockEnsureRelayResults = new Map();
    (globalThis as any).__mockPublishResults = new Map();
    localStorageMock = createLocalStorageMock();
    resetDefaultPool();

    pool = new RelayPool();
    const connectPromise = pool.connect(['wss://relay1.test', 'wss://relay2.test']);
    await vi.runAllTimersAsync();
    await connectPromise;

    queue = new OutboxQueue({
      storageKey: 'test_integration_queue',
      onFlush: async (event, relayUrls) => pool.publish(event, relayUrls),
    });
  });

  afterEach(() => {
    try {
      pool?.disconnect();
      queue?.clear();
    } catch {
      // Ignore cleanup errors
    }
    vi.useRealTimers();
  });

  it('should queue events when offline and flush when online', async () => {
    // Disconnect to simulate offline
    pool.disconnect();

    // Queue some events while offline
    const events = [
      createTestEvent({ id: 'offline-1' }),
      createTestEvent({ id: 'offline-2' }),
    ];

    for (const event of events) {
      await queue.enqueue(event, ['wss://relay1.test']);
    }

    expect(queue.size()).toBe(2);

    // Reconnect (simulate coming back online)
    const connectPromise = pool.connect(['wss://relay1.test']);
    await vi.runAllTimersAsync();
    await connectPromise;

    // Flush the queue
    await queue.flush();
    await vi.runAllTimersAsync();

    // Queue should be empty after successful flush
    expect(queue.size()).toBe(0);
  });

  it('should handle publish through queue correctly', async () => {
    const event = createTestEvent();
    await queue.enqueue(event, ['wss://relay1.test', 'wss://relay2.test']);

    await queue.flush();
    await vi.runAllTimersAsync();

    const mockPool = ((globalThis as any).__mockPoolInstances || [])[0];
    expect(mockPool?.publish).toHaveBeenCalled();
    expect(queue.size()).toBe(0);
  });
});
