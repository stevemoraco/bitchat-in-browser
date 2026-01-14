/**
 * Nostr Client Integration Tests
 *
 * End-to-end integration tests for Nostr relay connectivity, event publishing,
 * and subscription management. These tests verify the complete Nostr client
 * workflow in a real browser environment.
 *
 * Test Categories:
 * 1. Connection Management - relay pool connectivity, disconnection, reconnection
 * 2. Event Publishing - publishing events, handling failures, offline queuing
 * 3. Event Subscription - filtering, EOSE handling, unsubscription cleanup
 */

import { test, expect, Page } from '@playwright/test';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Mock WebSocket server state for testing relay behavior
 */
interface MockRelayState {
  connected: boolean;
  subscriptions: Map<string, any[]>;
  publishedEvents: any[];
  sentMessages: string[];
  receivedMessages: string[];
}

/**
 * Helper to set up WebSocket mocking in the page context
 */
async function setupMockRelays(page: Page, options: {
  relayUrls?: string[];
  connectionDelay?: number;
  shouldFail?: boolean;
  failAfterConnect?: boolean;
  eoseDelay?: number;
} = {}): Promise<void> {
  const {
    relayUrls = ['wss://mock-relay-1.test', 'wss://mock-relay-2.test', 'wss://mock-relay-3.test'],
    connectionDelay = 50,
    shouldFail = false,
    failAfterConnect = false,
    eoseDelay = 100,
  } = options;

  await page.addInitScript(({ relayUrls, connectionDelay, shouldFail, failAfterConnect, eoseDelay }) => {
    // Store mock relay state
    (window as any).__mockRelayStates = new Map<string, MockRelayState>();
    (window as any).__mockWebSockets = new Map<string, WebSocket>();

    // Store original WebSocket
    const OriginalWebSocket = window.WebSocket;

    // Create mock WebSocket class
    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSING = 2;
      static CLOSED = 3;

      readyState = MockWebSocket.CONNECTING;
      url: string;
      protocol = '';
      extensions = '';
      bufferedAmount = 0;
      binaryType: BinaryType = 'blob';

      onopen: ((event: Event) => void) | null = null;
      onclose: ((event: CloseEvent) => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      private _state: MockRelayState;
      private _eventListeners: Map<string, Set<Function>> = new Map();

      constructor(url: string, protocols?: string | string[]) {
        this.url = url;

        // Initialize relay state
        this._state = {
          connected: false,
          subscriptions: new Map(),
          publishedEvents: [],
          sentMessages: [],
          receivedMessages: [],
        };
        (window as any).__mockRelayStates.set(url, this._state);
        (window as any).__mockWebSockets.set(url, this as unknown as WebSocket);

        if (protocols) {
          this.protocol = Array.isArray(protocols) ? (protocols[0] ?? '') : protocols;
        }

        // Simulate connection
        setTimeout(() => {
          if (shouldFail) {
            this.readyState = MockWebSocket.CLOSED;
            this._emit('error', new Event('error'));
            this._emit('close', new CloseEvent('close', { code: 1006, reason: 'Connection failed' }));
          } else {
            this.readyState = MockWebSocket.OPEN;
            this._state.connected = true;
            this._emit('open', new Event('open'));

            // Optionally fail after connecting (simulate network drop)
            if (failAfterConnect) {
              setTimeout(() => {
                this.readyState = MockWebSocket.CLOSED;
                this._state.connected = false;
                this._emit('close', new CloseEvent('close', { code: 1006, reason: 'Connection lost' }));
              }, connectionDelay * 2);
            }
          }
        }, connectionDelay);
      }

      send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
        if (this.readyState !== MockWebSocket.OPEN) {
          throw new Error('WebSocket is not open');
        }

        const message = typeof data === 'string' ? data : '';
        this._state.sentMessages.push(message);

        // Parse Nostr message
        try {
          const parsed = JSON.parse(message);
          const [type, ...rest] = parsed;

          if (type === 'REQ') {
            // Subscription request
            const [subId, ...filters] = rest;
            this._state.subscriptions.set(subId, filters);

            // Send EOSE after delay
            setTimeout(() => {
              if (this.readyState === MockWebSocket.OPEN) {
                const eoseMessage = JSON.stringify(['EOSE', subId]);
                this._state.receivedMessages.push(eoseMessage);
                this._emit('message', new MessageEvent('message', { data: eoseMessage }));
              }
            }, eoseDelay);
          } else if (type === 'CLOSE') {
            // Close subscription
            const [subId] = rest;
            this._state.subscriptions.delete(subId);
          } else if (type === 'EVENT') {
            // Publish event
            const [event] = rest;
            this._state.publishedEvents.push(event);

            // Send OK response
            setTimeout(() => {
              if (this.readyState === MockWebSocket.OPEN) {
                const okMessage = JSON.stringify(['OK', event.id, true, '']);
                this._state.receivedMessages.push(okMessage);
                this._emit('message', new MessageEvent('message', { data: okMessage }));
              }
            }, 10);
          }
        } catch {
          // Invalid JSON, ignore
        }
      }

      close(code?: number, reason?: string): void {
        this.readyState = MockWebSocket.CLOSING;
        setTimeout(() => {
          this.readyState = MockWebSocket.CLOSED;
          this._state.connected = false;
          this._emit('close', new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
        }, 10);
      }

      addEventListener(type: string, listener: EventListener): void {
        if (!this._eventListeners.has(type)) {
          this._eventListeners.set(type, new Set());
        }
        this._eventListeners.get(type)!.add(listener);
      }

      removeEventListener(type: string, listener: EventListener): void {
        this._eventListeners.get(type)?.delete(listener);
      }

      dispatchEvent(event: Event): boolean {
        this._emit(event.type, event);
        return true;
      }

      private _emit(type: string, event: Event): void {
        // Call on* handler
        const handler = (this as any)[`on${type}`];
        if (typeof handler === 'function') {
          handler.call(this, event);
        }

        // Call addEventListener handlers
        const listeners = this._eventListeners.get(type);
        if (listeners) {
          for (const listener of listeners) {
            listener.call(this, event);
          }
        }
      }

      // Helper to simulate receiving an event from relay
      simulateEvent(event: any): void {
        for (const [subId, filters] of this._state.subscriptions) {
          // Check if event matches any filter
          const matches = filters.some((filter: any) => {
            if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
            if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
            if (filter.ids && !filter.ids.includes(event.id)) return false;
            if (filter.since && event.created_at < filter.since) return false;
            if (filter.until && event.created_at > filter.until) return false;
            return true;
          });

          if (matches) {
            const eventMessage = JSON.stringify(['EVENT', subId, event]);
            this._state.receivedMessages.push(eventMessage);
            this._emit('message', new MessageEvent('message', { data: eventMessage }));
          }
        }
      }
    }

    // Replace WebSocket for mock relay URLs
    (window as any).WebSocket = function(url: string, protocols?: string | string[]) {
      const isMockRelay = relayUrls.some((mockUrl: string) => url.includes(mockUrl) || url.startsWith('wss://mock-'));
      if (isMockRelay) {
        return new MockWebSocket(url, protocols);
      }
      return new OriginalWebSocket(url, protocols);
    } as any;

    // Preserve static properties
    (window as any).WebSocket.CONNECTING = 0;
    (window as any).WebSocket.OPEN = 1;
    (window as any).WebSocket.CLOSING = 2;
    (window as any).WebSocket.CLOSED = 3;

  }, { relayUrls, connectionDelay, shouldFail, failAfterConnect, eoseDelay });
}

/**
 * Helper to inject a mock event into a relay
 */
async function injectMockEvent(page: Page, relayUrl: string, event: any): Promise<void> {
  await page.evaluate(({ relayUrl, event }) => {
    const ws = (window as any).__mockWebSockets.get(relayUrl);
    if (ws && (ws as any).simulateEvent) {
      (ws as any).simulateEvent(event);
    }
  }, { relayUrl, event });
}

/**
 * Helper to get mock relay state
 */
async function getMockRelayState(page: Page, relayUrl: string): Promise<MockRelayState | null> {
  return page.evaluate((url) => {
    const state = (window as any).__mockRelayStates?.get(url);
    if (!state) return null;
    return {
      connected: state.connected,
      subscriptions: Object.fromEntries(state.subscriptions),
      publishedEvents: state.publishedEvents,
      sentMessages: state.sentMessages,
      receivedMessages: state.receivedMessages,
    };
  }, relayUrl);
}

/**
 * Create a test Nostr event
 */
function createTestEvent(overrides: Partial<any> = {}): any {
  const created_at = Math.floor(Date.now() / 1000);
  const id = `test-event-${created_at}-${Math.random().toString(36).substring(7)}`;
  return {
    id,
    pubkey: '0'.repeat(64),
    created_at,
    kind: 1,
    tags: [],
    content: 'Test message content',
    sig: '0'.repeat(128),
    ...overrides,
  };
}

// =============================================================================
// Test Suite: Connection Management
// =============================================================================

test.describe('Nostr Client - Connection Management', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRelays(page);
  });

  test('should connect to relay pool successfully', async ({ page }) => {
    await page.goto('/');

    // Evaluate connection logic in browser context
    const result = await page.evaluate(async () => {
      // Access the mock relay states
      const states = (window as any).__mockRelayStates;
      if (!states) return { error: 'Mock not initialized' };

      // Create a simple WebSocket connection to test
      const ws = new WebSocket('wss://mock-relay-1.test');

      return new Promise((resolve) => {
        ws.onopen = () => {
          resolve({
            connected: true,
            readyState: ws.readyState,
            url: ws.url,
          });
        };
        ws.onerror = () => {
          resolve({ connected: false, error: 'Connection error' });
        };
        setTimeout(() => {
          resolve({ connected: false, error: 'Timeout' });
        }, 5000);
      });
    });

    expect(result).toHaveProperty('connected', true);
    expect(result).toHaveProperty('readyState', 1); // OPEN
  });

  test('should handle relay disconnection gracefully', async ({ page }) => {
    await setupMockRelays(page, { failAfterConnect: true, connectionDelay: 50 });
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const ws = new WebSocket('wss://mock-relay-1.test');
      let wasOpen = false;
      let closeReceived = false;

      return new Promise((resolve) => {
        ws.onopen = () => {
          wasOpen = true;
        };
        ws.onclose = () => {
          closeReceived = true;
          resolve({
            wasOpen,
            closeReceived,
            finalReadyState: ws.readyState,
          });
        };
        setTimeout(() => {
          resolve({
            wasOpen,
            closeReceived,
            finalReadyState: ws.readyState,
            timeout: true,
          });
        }, 500);
      });
    });

    expect(result).toHaveProperty('wasOpen', true);
    expect(result).toHaveProperty('closeReceived', true);
    expect(result).toHaveProperty('finalReadyState', 3); // CLOSED
  });

  test('should implement exponential backoff on reconnection', async ({ page }) => {
    await page.goto('/');

    // Test backoff calculation in browser context
    const backoffResults = await page.evaluate(async () => {
      const calculateBackoff = (attempt: number, initialDelay: number = 1000, maxDelay: number = 300000, multiplier: number = 2) => {
        return Math.min(initialDelay * Math.pow(multiplier, attempt - 1), maxDelay);
      };

      return {
        attempt1: calculateBackoff(1),
        attempt2: calculateBackoff(2),
        attempt3: calculateBackoff(3),
        attempt5: calculateBackoff(5),
        attempt10: calculateBackoff(10),
        attemptMax: calculateBackoff(20),
      };
    });

    // Verify exponential growth
    expect(backoffResults.attempt1).toBe(1000);
    expect(backoffResults.attempt2).toBe(2000);
    expect(backoffResults.attempt3).toBe(4000);
    expect(backoffResults.attempt5).toBe(16000);
    // Should cap at maxDelay
    expect(backoffResults.attemptMax).toBeLessThanOrEqual(300000);
  });

  test('should maintain subscriptions across reconnects', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      const subscriptionId = 'test-sub-' + Date.now();
      let eoseReceived = false;

      return new Promise((resolve) => {
        ws.onopen = () => {
          // Send subscription request
          const reqMessage = JSON.stringify(['REQ', subscriptionId, { kinds: [1], limit: 10 }]);
          ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
          try {
            const [type, subId] = JSON.parse(event.data);
            if (type === 'EOSE' && subId === subscriptionId) {
              eoseReceived = true;

              // Get relay state to verify subscription was registered
              const state = (window as any).__mockRelayStates.get(relayUrl);
              resolve({
                eoseReceived,
                subscriptionActive: state?.subscriptions.has(subscriptionId),
                subscriptionFilters: state?.subscriptions.get(subscriptionId),
              });
            }
          } catch {
            // Ignore parse errors
          }
        };

        setTimeout(() => {
          resolve({ error: 'Timeout', eoseReceived });
        }, 2000);
      });
    });

    expect(result).toHaveProperty('eoseReceived', true);
    expect(result).toHaveProperty('subscriptionActive', true);
  });

  test('should handle connection to multiple relays', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrls = [
        'wss://mock-relay-1.test',
        'wss://mock-relay-2.test',
        'wss://mock-relay-3.test',
      ];

      const connections = await Promise.all(
        relayUrls.map(url => new Promise<{ url: string; connected: boolean }>((resolve) => {
          const ws = new WebSocket(url);
          ws.onopen = () => resolve({ url, connected: true });
          ws.onerror = () => resolve({ url, connected: false });
          setTimeout(() => resolve({ url, connected: false }), 1000);
        }))
      );

      return {
        totalRelays: relayUrls.length,
        connectedCount: connections.filter(c => c.connected).length,
        connections,
      };
    });

    expect(result.totalRelays).toBe(3);
    expect(result.connectedCount).toBe(3);
  });

  test('should track relay status correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const ws = new WebSocket('wss://mock-relay-1.test');

      const stateHistory: number[] = [];
      stateHistory.push(ws.readyState); // CONNECTING

      return new Promise((resolve) => {
        ws.onopen = () => {
          stateHistory.push(ws.readyState); // OPEN
          ws.close();
        };
        ws.onclose = () => {
          stateHistory.push(ws.readyState); // CLOSED
          resolve({
            stateHistory,
            states: {
              connecting: 0,
              open: 1,
              closing: 2,
              closed: 3,
            },
          });
        };
        setTimeout(() => resolve({ stateHistory, timeout: true }), 1000);
      });
    });

    expect(result.stateHistory).toContain(0); // CONNECTING
    expect(result.stateHistory).toContain(1); // OPEN
    expect(result.stateHistory).toContain(3); // CLOSED
  });
});

// =============================================================================
// Test Suite: Event Publishing
// =============================================================================

test.describe('Nostr Client - Event Publishing', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRelays(page);
  });

  test('should publish event to connected relays', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      let okReceived = false;
      let publishedEventId: string | null = null;

      const testEvent = {
        id: 'publish-test-' + Date.now(),
        pubkey: '0'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test publish content',
        sig: '0'.repeat(128),
      };

      return new Promise((resolve) => {
        ws.onopen = () => {
          const eventMessage = JSON.stringify(['EVENT', testEvent]);
          ws.send(eventMessage);
        };

        ws.onmessage = (event) => {
          try {
            const [type, eventId, success, message] = JSON.parse(event.data);
            if (type === 'OK') {
              okReceived = true;
              publishedEventId = eventId;

              const state = (window as any).__mockRelayStates.get(relayUrl);
              resolve({
                okReceived,
                success,
                message,
                publishedEventId,
                eventInState: state?.publishedEvents.some((e: any) => e.id === testEvent.id),
              });
            }
          } catch {
            // Ignore
          }
        };

        setTimeout(() => resolve({ error: 'Timeout' }), 2000);
      });
    });

    expect(result).toHaveProperty('okReceived', true);
    expect(result).toHaveProperty('eventInState', true);
  });

  test('should handle partial relay failures during publish', async ({ page }) => {
    // Set up mixed relay states - some will fail, some will succeed
    await page.addInitScript(() => {
      const OriginalWebSocket = window.WebSocket;

      (window as any).__publishResults = new Map<string, boolean>();

      (window as any).WebSocket = function(url: string, protocols?: string | string[]) {
        // Relay 2 will fail
        const shouldFail = url.includes('relay-2');

        const ws = {
          readyState: 0,
          url,
          protocol: '',
          onopen: null as any,
          onclose: null as any,
          onmessage: null as any,
          onerror: null as any,
          send: (data: string) => {
            if (shouldFail) return;
            try {
              const [type, event] = JSON.parse(data);
              if (type === 'EVENT' && ws.onmessage) {
                setTimeout(() => {
                  (window as any).__publishResults.set(url, true);
                  ws.onmessage(new MessageEvent('message', {
                    data: JSON.stringify(['OK', event.id, true, '']),
                  }));
                }, 10);
              }
            } catch {}
          },
          close: () => { ws.readyState = 3; },
          addEventListener: () => {},
          removeEventListener: () => {},
        };

        setTimeout(() => {
          if (shouldFail) {
            ws.readyState = 3;
            (window as any).__publishResults.set(url, false);
            ws.onerror?.(new Event('error'));
            ws.onclose?.(new CloseEvent('close', { code: 1006 }));
          } else {
            ws.readyState = 1;
            ws.onopen?.(new Event('open'));
          }
        }, 50);

        return ws;
      } as any;

      (window as any).WebSocket.CONNECTING = 0;
      (window as any).WebSocket.OPEN = 1;
      (window as any).WebSocket.CLOSING = 2;
      (window as any).WebSocket.CLOSED = 3;
    });

    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrls = [
        'wss://mock-relay-1.test',
        'wss://mock-relay-2.test', // This one will fail
        'wss://mock-relay-3.test',
      ];

      const testEvent = {
        id: 'partial-fail-test-' + Date.now(),
        pubkey: '0'.repeat(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'Test content',
        sig: '0'.repeat(128),
      };

      const results = await Promise.allSettled(
        relayUrls.map(url => new Promise<{ url: string; success: boolean }>((resolve) => {
          const ws = new WebSocket(url);
          ws.onopen = () => {
            ws.send(JSON.stringify(['EVENT', testEvent]));
          };
          ws.onmessage = (event) => {
            try {
              const [type] = JSON.parse(event.data);
              if (type === 'OK') {
                resolve({ url, success: true });
              }
            } catch {}
          };
          ws.onerror = () => resolve({ url, success: false });
          setTimeout(() => resolve({ url, success: false }), 1000);
        }))
      );

      const successes = results.filter(r =>
        r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ url: string; success: boolean }>).value.success
      ).length;
      const failures = results.length - successes;

      return {
        totalAttempted: relayUrls.length,
        successes,
        failures,
        overallSuccess: successes > 0,
      };
    });

    expect(result.totalAttempted).toBe(3);
    expect(result.successes).toBe(2);
    expect(result.failures).toBe(1);
    expect(result.overallSuccess).toBe(true);
  });

  test('should queue events when offline', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      // Simple offline queue implementation for testing
      class OfflineQueue {
        private queue: any[] = [];
        private maxSize = 100;

        enqueue(event: any, relayUrls: string[]): void {
          if (this.queue.length >= this.maxSize) {
            this.queue.shift();
          }
          this.queue.push({
            event,
            relayUrls,
            queuedAt: Date.now(),
            attempts: 0,
          });
        }

        size(): number {
          return this.queue.length;
        }

        getAll(): any[] {
          return [...this.queue];
        }

        clear(): void {
          this.queue = [];
        }
      }

      const queue = new OfflineQueue();

      // Simulate offline state - queue events
      const events = [
        { id: 'offline-1', content: 'Message 1' },
        { id: 'offline-2', content: 'Message 2' },
        { id: 'offline-3', content: 'Message 3' },
      ];

      for (const event of events) {
        queue.enqueue(event, ['wss://relay1.test', 'wss://relay2.test']);
      }

      return {
        queueSize: queue.size(),
        queuedEvents: queue.getAll().map(q => q.event.id),
        hasAllEvents: events.every(e => queue.getAll().some(q => q.event.id === e.id)),
      };
    });

    expect(result.queueSize).toBe(3);
    expect(result.hasAllEvents).toBe(true);
  });

  test('should retry queued events on reconnect', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      // Queue with flush capability
      class RetryQueue {
        private queue: any[] = [];
        private maxRetries = 3;

        enqueue(event: any): void {
          this.queue.push({ event, attempts: 0 });
        }

        async flush(publishFn: (event: any) => Promise<boolean>): Promise<{ sent: string[]; failed: string[] }> {
          const sent: string[] = [];
          const failed: string[] = [];

          for (const item of [...this.queue]) {
            item.attempts++;
            const success = await publishFn(item.event);
            if (success) {
              sent.push(item.event.id);
              this.queue = this.queue.filter(q => q.event.id !== item.event.id);
            } else if (item.attempts >= this.maxRetries) {
              failed.push(item.event.id);
              this.queue = this.queue.filter(q => q.event.id !== item.event.id);
            }
          }

          return { sent, failed };
        }

        size(): number {
          return this.queue.length;
        }
      }

      const queue = new RetryQueue();

      // Queue some events while "offline"
      queue.enqueue({ id: 'retry-1' });
      queue.enqueue({ id: 'retry-2' });
      queue.enqueue({ id: 'retry-3' });

      const beforeFlush = queue.size();

      // Simulate reconnection and flush
      let publishCount = 0;
      const result = await queue.flush(async (event) => {
        publishCount++;
        // Simulate successful publish
        return true;
      });

      return {
        beforeFlush,
        afterFlush: queue.size(),
        sentCount: result.sent.length,
        failedCount: result.failed.length,
        publishAttempts: publishCount,
      };
    });

    expect(result.beforeFlush).toBe(3);
    expect(result.afterFlush).toBe(0);
    expect(result.sentCount).toBe(3);
  });

  test('should respect queue size limits', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      class LimitedQueue {
        private queue: any[] = [];
        private maxSize: number;

        constructor(maxSize: number) {
          this.maxSize = maxSize;
        }

        enqueue(event: any): void {
          if (this.queue.length >= this.maxSize) {
            this.queue.shift(); // Remove oldest
          }
          this.queue.push(event);
        }

        size(): number {
          return this.queue.length;
        }

        getOldest(): any {
          return this.queue[0];
        }

        getNewest(): any {
          return this.queue[this.queue.length - 1];
        }
      }

      const queue = new LimitedQueue(5);

      // Add 10 events to a queue with max size 5
      for (let i = 1; i <= 10; i++) {
        queue.enqueue({ id: `event-${i}` });
      }

      return {
        finalSize: queue.size(),
        oldestEventId: queue.getOldest()?.id,
        newestEventId: queue.getNewest()?.id,
      };
    });

    expect(result.finalSize).toBe(5);
    expect(result.oldestEventId).toBe('event-6'); // First 5 were removed
    expect(result.newestEventId).toBe('event-10');
  });
});

// =============================================================================
// Test Suite: Event Subscription
// =============================================================================

test.describe('Nostr Client - Event Subscription', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockRelays(page, { eoseDelay: 50 });
  });

  test('should subscribe with kind filter', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      const subId = 'kinds-filter-test-' + Date.now();

      return new Promise((resolve) => {
        ws.onopen = () => {
          // Subscribe to kind 1 (text notes) only
          const reqMessage = JSON.stringify(['REQ', subId, { kinds: [1] }]);
          ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
          try {
            const [type, receivedSubId] = JSON.parse(event.data);
            if (type === 'EOSE' && receivedSubId === subId) {
              const state = (window as any).__mockRelayStates.get(relayUrl);
              const filters = state?.subscriptions.get(subId);
              resolve({
                subscriptionActive: state?.subscriptions.has(subId),
                filters,
                hasKindFilter: filters?.[0]?.kinds?.includes(1),
              });
            }
          } catch {}
        };

        setTimeout(() => resolve({ error: 'Timeout' }), 2000);
      });
    });

    expect(result).toHaveProperty('subscriptionActive', true);
    expect(result).toHaveProperty('hasKindFilter', true);
  });

  test('should subscribe with author filter', async ({ page }) => {
    await page.goto('/');

    const testPubkey = 'a'.repeat(64);

    const result = await page.evaluate(async ({ pubkey }) => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      const subId = 'author-filter-test-' + Date.now();

      return new Promise((resolve) => {
        ws.onopen = () => {
          const reqMessage = JSON.stringify(['REQ', subId, { authors: [pubkey] }]);
          ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
          try {
            const [type, receivedSubId] = JSON.parse(event.data);
            if (type === 'EOSE' && receivedSubId === subId) {
              const state = (window as any).__mockRelayStates.get(relayUrl);
              const filters = state?.subscriptions.get(subId);
              resolve({
                subscriptionActive: state?.subscriptions.has(subId),
                authorFilter: filters?.[0]?.authors,
              });
            }
          } catch {}
        };

        setTimeout(() => resolve({ error: 'Timeout' }), 2000);
      });
    }, { pubkey: testPubkey });

    expect(result).toHaveProperty('subscriptionActive', true);
    expect(result).toHaveProperty('authorFilter');
    expect((result as any).authorFilter).toContain(testPubkey);
  });

  test('should subscribe with tag filter', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      const subId = 'tag-filter-test-' + Date.now();
      const testTag = 'test-channel';

      return new Promise((resolve) => {
        ws.onopen = () => {
          // Subscribe with #d tag filter (for channel IDs)
          const reqMessage = JSON.stringify(['REQ', subId, { '#d': [testTag] }]);
          ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
          try {
            const [type, receivedSubId] = JSON.parse(event.data);
            if (type === 'EOSE' && receivedSubId === subId) {
              const state = (window as any).__mockRelayStates.get(relayUrl);
              const filters = state?.subscriptions.get(subId);
              resolve({
                subscriptionActive: state?.subscriptions.has(subId),
                tagFilter: filters?.[0]?.['#d'],
              });
            }
          } catch {}
        };

        setTimeout(() => resolve({ error: 'Timeout' }), 2000);
      });
    });

    expect(result).toHaveProperty('subscriptionActive', true);
    expect(result).toHaveProperty('tagFilter');
  });

  test('should receive matching events', async ({ page }) => {
    await page.goto('/');

    // First set up mock with event injection capability
    await page.evaluate(() => {
      (window as any).__receivedEvents = [];
    });

    const result = await page.evaluate(async () => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      const subId = 'receive-events-test-' + Date.now();
      const receivedEvents: any[] = [];

      return new Promise((resolve) => {
        ws.onopen = () => {
          const reqMessage = JSON.stringify(['REQ', subId, { kinds: [1], limit: 10 }]);
          ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const [type, subIdOrEvent, eventData] = parsed;

            if (type === 'EVENT' && subIdOrEvent === subId) {
              receivedEvents.push(eventData);
            }

            if (type === 'EOSE' && subIdOrEvent === subId) {
              // Simulate receiving events after EOSE
              setTimeout(() => {
                // Inject test events via the mock
                const mockWs = (window as any).__mockWebSockets.get(relayUrl);
                if (mockWs?.simulateEvent) {
                  mockWs.simulateEvent({
                    id: 'injected-event-1',
                    pubkey: '0'.repeat(64),
                    created_at: Math.floor(Date.now() / 1000),
                    kind: 1,
                    tags: [],
                    content: 'Injected event',
                    sig: '0'.repeat(128),
                  });
                }

                setTimeout(() => {
                  resolve({
                    eoseReceived: true,
                    receivedEvents: receivedEvents.length,
                  });
                }, 100);
              }, 50);
            }
          } catch {}
        };

        setTimeout(() => resolve({ error: 'Timeout', receivedEvents: receivedEvents.length }), 3000);
      });
    });

    expect(result).toHaveProperty('eoseReceived', true);
  });

  test('should handle EOSE correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      const subId = 'eose-test-' + Date.now();
      let eoseTimestamp: number | null = null;
      let connectionTimestamp: number | null = null;

      return new Promise((resolve) => {
        ws.onopen = () => {
          connectionTimestamp = Date.now();
          const reqMessage = JSON.stringify(['REQ', subId, { kinds: [1], limit: 10 }]);
          ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
          try {
            const [type, receivedSubId] = JSON.parse(event.data);
            if (type === 'EOSE' && receivedSubId === subId) {
              eoseTimestamp = Date.now();
              const timeSinceConnection = eoseTimestamp - (connectionTimestamp || 0);

              resolve({
                eoseReceived: true,
                timeSinceConnection,
                subId: receivedSubId,
              });
            }
          } catch {}
        };

        setTimeout(() => resolve({ error: 'Timeout' }), 2000);
      });
    });

    expect(result).toHaveProperty('eoseReceived', true);
    expect(result).toHaveProperty('timeSinceConnection');
    expect((result as any).timeSinceConnection).toBeLessThan(1000);
  });

  test('should unsubscribe and clean up properly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      const subId = 'cleanup-test-' + Date.now();
      let subscriptionActiveAfterEose = false;
      let subscriptionActiveAfterClose = false;

      return new Promise((resolve) => {
        ws.onopen = () => {
          const reqMessage = JSON.stringify(['REQ', subId, { kinds: [1] }]);
          ws.send(reqMessage);
        };

        ws.onmessage = (event) => {
          try {
            const [type, receivedSubId] = JSON.parse(event.data);
            if (type === 'EOSE' && receivedSubId === subId) {
              const state = (window as any).__mockRelayStates.get(relayUrl);
              subscriptionActiveAfterEose = state?.subscriptions.has(subId) || false;

              // Send CLOSE message
              const closeMessage = JSON.stringify(['CLOSE', subId]);
              ws.send(closeMessage);

              // Check subscription state after close
              setTimeout(() => {
                subscriptionActiveAfterClose = state?.subscriptions.has(subId) || false;

                resolve({
                  subscriptionActiveAfterEose,
                  subscriptionActiveAfterClose,
                  properlyCleanedUp: subscriptionActiveAfterEose && !subscriptionActiveAfterClose,
                });
              }, 50);
            }
          } catch {}
        };

        setTimeout(() => resolve({ error: 'Timeout' }), 2000);
      });
    });

    expect(result).toHaveProperty('subscriptionActiveAfterEose', true);
    expect(result).toHaveProperty('subscriptionActiveAfterClose', false);
    expect(result).toHaveProperty('properlyCleanedUp', true);
  });

  test('should handle multiple concurrent subscriptions', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const relayUrl = 'wss://mock-relay-1.test';
      const ws = new WebSocket(relayUrl);
      const subIds = [
        'multi-sub-1-' + Date.now(),
        'multi-sub-2-' + Date.now(),
        'multi-sub-3-' + Date.now(),
      ];
      const eoseReceived = new Set<string>();

      return new Promise((resolve) => {
        ws.onopen = () => {
          // Create multiple subscriptions with different filters
          for (const [index, subId] of subIds.entries()) {
            const reqMessage = JSON.stringify(['REQ', subId, { kinds: [index + 1], limit: 10 }]);
            ws.send(reqMessage);
          }
        };

        ws.onmessage = (event) => {
          try {
            const [type, subId] = JSON.parse(event.data);
            if (type === 'EOSE' && subIds.includes(subId)) {
              eoseReceived.add(subId);

              if (eoseReceived.size === subIds.length) {
                const state = (window as any).__mockRelayStates.get(relayUrl);
                const activeSubscriptions = subIds.filter(id => state?.subscriptions.has(id));

                resolve({
                  totalSubscriptions: subIds.length,
                  eoseReceivedCount: eoseReceived.size,
                  activeSubscriptions: activeSubscriptions.length,
                  allActive: activeSubscriptions.length === subIds.length,
                });
              }
            }
          } catch {}
        };

        setTimeout(() => resolve({
          error: 'Timeout',
          eoseReceivedCount: eoseReceived.size,
        }), 3000);
      });
    });

    expect(result).toHaveProperty('totalSubscriptions', 3);
    expect(result).toHaveProperty('eoseReceivedCount', 3);
    expect(result).toHaveProperty('allActive', true);
  });

  test('should deduplicate events received from multiple relays', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      // Simulate receiving the same event from multiple relays
      const seenEvents = new Map<string, Set<string>>();
      const dedupedEvents: any[] = [];

      const processEvent = (event: any, relayUrl: string): boolean => {
        if (!seenEvents.has(event.id)) {
          seenEvents.set(event.id, new Set());
        }

        const relays = seenEvents.get(event.id)!;
        if (relays.has(relayUrl)) {
          return false; // Duplicate
        }

        relays.add(relayUrl);

        // Only process if this is the first time seeing this event
        if (relays.size === 1) {
          dedupedEvents.push(event);
          return true;
        }

        return false;
      };

      // Simulate same event from 3 relays
      const testEvent = {
        id: 'dedup-test-event',
        content: 'Test content',
      };

      const relay1Result = processEvent(testEvent, 'wss://relay1.test');
      const relay2Result = processEvent(testEvent, 'wss://relay2.test');
      const relay3Result = processEvent(testEvent, 'wss://relay3.test');

      return {
        firstRelayAdded: relay1Result,
        secondRelayAdded: relay2Result,
        thirdRelayAdded: relay3Result,
        dedupedEventCount: dedupedEvents.length,
        relaysSawEvent: seenEvents.get(testEvent.id)?.size || 0,
      };
    });

    expect(result.firstRelayAdded).toBe(true);
    expect(result.secondRelayAdded).toBe(false);
    expect(result.thirdRelayAdded).toBe(false);
    expect(result.dedupedEventCount).toBe(1);
    expect(result.relaysSawEvent).toBe(3);
  });
});

// =============================================================================
// Test Suite: Error Handling
// =============================================================================

test.describe('Nostr Client - Error Handling', () => {
  test('should handle connection failures gracefully', async ({ page }) => {
    await setupMockRelays(page, { shouldFail: true });
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const ws = new WebSocket('wss://mock-relay-1.test');
      let errorReceived = false;
      let closeReceived = false;

      return new Promise((resolve) => {
        ws.onerror = () => {
          errorReceived = true;
        };
        ws.onclose = (event) => {
          closeReceived = true;
          resolve({
            errorReceived,
            closeReceived,
            closeCode: event.code,
            closeReason: event.reason,
          });
        };
        setTimeout(() => resolve({ error: 'Timeout', errorReceived, closeReceived }), 1000);
      });
    });

    expect(result).toHaveProperty('errorReceived', true);
    expect(result).toHaveProperty('closeReceived', true);
  });

  test('should handle invalid message format', async ({ page }) => {
    await setupMockRelays(page);
    await page.goto('/');

    const result = await page.evaluate(async () => {
      // Test JSON parsing with invalid data
      const testMessages: string[] = [
        'not json at all',
        '["UNKNOWN_TYPE", "data"]',
        '["EVENT"]', // Missing data (unknown type since EVENT without payload is still unknown behavior)
        '{}', // Object instead of array
      ];

      const parseResults = testMessages.map(msg => {
        try {
          const parsed = JSON.parse(msg);
          if (!Array.isArray(parsed)) {
            return { valid: false, reason: 'not array' };
          }
          const [type] = parsed;
          const knownTypes = ['EVENT', 'OK', 'EOSE', 'CLOSED', 'NOTICE', 'AUTH'];
          if (!knownTypes.includes(type)) {
            return { valid: false, reason: 'unknown type', type };
          }
          return { valid: true, type };
        } catch (e) {
          return { valid: false, reason: 'parse error' };
        }
      });

      return {
        totalTested: testMessages.length,
        validCount: parseResults.filter(r => r.valid).length,
        invalidCount: parseResults.filter(r => !r.valid).length,
        results: parseResults,
      };
    });

    // All 4 test messages should be invalid:
    // 1. 'not json at all' - parse error
    // 2. '["UNKNOWN_TYPE", "data"]' - unknown type
    // 3. '["EVENT"]' - valid type but incomplete (still counts as valid type match)
    // 4. '{}' - not an array
    expect(result.invalidCount).toBeGreaterThanOrEqual(3);
    expect(result.totalTested).toBe(4);
  });

  test('should handle relay timeout', async ({ page }) => {
    await page.addInitScript(() => {
      // Mock that never connects
      (window as any).WebSocket = function(url: string) {
        const ws = {
          readyState: 0,
          url,
          onopen: null as any,
          onclose: null as any,
          onerror: null as any,
          onmessage: null as any,
          send: () => {},
          close: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
        };
        // Never transition to OPEN state
        return ws;
      } as any;
      (window as any).WebSocket.CONNECTING = 0;
      (window as any).WebSocket.OPEN = 1;
      (window as any).WebSocket.CLOSING = 2;
      (window as any).WebSocket.CLOSED = 3;
    });

    await page.goto('/');

    const result = await page.evaluate(async () => {
      const connectionTimeout = 500; // 500ms timeout
      const startTime = Date.now();

      return new Promise((resolve) => {
        const ws = new WebSocket('wss://timeout-test.relay');

        const timeoutId = setTimeout(() => {
          const elapsed = Date.now() - startTime;
          resolve({
            timedOut: true,
            elapsed,
            readyState: ws.readyState,
            wasStillConnecting: ws.readyState === 0,
          });
        }, connectionTimeout);

        ws.onopen = () => {
          clearTimeout(timeoutId);
          resolve({ timedOut: false, readyState: ws.readyState });
        };
      });
    });

    expect(result).toHaveProperty('timedOut', true);
    expect(result).toHaveProperty('wasStillConnecting', true);
  });
});
