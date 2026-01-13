/**
 * Nostr Mock - Mock relay connections and nostr-tools
 *
 * This mock provides fake relay connections for testing Nostr functionality
 * without making actual network connections.
 */

import { vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

export interface MockEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export interface MockRelay {
  url: string;
  connected: boolean;
  connect: () => Promise<void>;
  close: () => void;
  publish: (event: MockEvent) => Promise<string>;
  subscribe: (filters: MockFilter[], callbacks: MockSubCallbacks) => MockSubscription;
}

export interface MockFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  since?: number;
  until?: number;
  limit?: number;
  '#e'?: string[];
  '#p'?: string[];
  [key: string]: unknown;
}

export interface MockSubCallbacks {
  onevent?: (event: MockEvent) => void;
  oneose?: () => void;
  onclose?: (reason: string) => void;
}

export interface MockSubscription {
  close: () => void;
  events: () => AsyncIterable<MockEvent>;
}

// ============================================================================
// Mock Event Generation
// ============================================================================

let eventCounter = 0;

export function createMockEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  const id = overrides.id ?? `event-${++eventCounter}-${Date.now().toString(16)}`;
  return {
    id,
    pubkey: overrides.pubkey ?? 'mock-pubkey-' + Math.random().toString(16).slice(2),
    created_at: overrides.created_at ?? Math.floor(Date.now() / 1000),
    kind: overrides.kind ?? 1,
    tags: overrides.tags ?? [],
    content: overrides.content ?? 'Mock event content',
    sig: overrides.sig ?? 'mock-signature-' + id,
  };
}

export function createMockChannelEvent(
  channelId: string,
  content: string,
  pubkey?: string
): MockEvent {
  return createMockEvent({
    kind: 20000, // Location channel kind
    content,
    pubkey,
    tags: [['d', channelId]],
  });
}

export function createMockDMEvent(
  recipientPubkey: string,
  content: string,
  senderPubkey?: string
): MockEvent {
  return createMockEvent({
    kind: 4, // NIP-04 DM
    content,
    pubkey: senderPubkey,
    tags: [['p', recipientPubkey]],
  });
}

export function createMockGiftWrapEvent(
  innerEvent: MockEvent,
  recipientPubkey: string
): MockEvent {
  return createMockEvent({
    kind: 1059, // Gift wrap kind (NIP-17)
    content: JSON.stringify(innerEvent), // In reality this would be encrypted
    tags: [['p', recipientPubkey]],
  });
}

// ============================================================================
// Mock Relay
// ============================================================================

export function createMockRelay(url: string): MockRelay {
  const events: MockEvent[] = [];
  const subscriptions = new Map<string, MockSubCallbacks>();

  return {
    url,
    connected: false,

    connect: vi.fn().mockImplementation(async () => {
      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 10));
      (createMockRelay as unknown as MockRelay).connected = true;
    }),

    close: vi.fn().mockImplementation(() => {
      (createMockRelay as unknown as MockRelay).connected = false;
      subscriptions.forEach((callbacks) => {
        callbacks.onclose?.('connection closed');
      });
      subscriptions.clear();
    }),

    publish: vi.fn().mockImplementation(async (event: MockEvent) => {
      events.push(event);
      // Notify subscribers
      subscriptions.forEach((callbacks, _subId) => {
        callbacks.onevent?.(event);
      });
      return event.id;
    }),

    subscribe: vi.fn().mockImplementation(
      (filters: MockFilter[], callbacks: MockSubCallbacks): MockSubscription => {
        const subId = `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        subscriptions.set(subId, callbacks);

        // Send matching events
        setTimeout(() => {
          events.forEach((event) => {
            if (matchesFilters(event, filters)) {
              callbacks.onevent?.(event);
            }
          });
          callbacks.oneose?.();
        }, 0);

        return {
          close: () => {
            subscriptions.delete(subId);
            callbacks.onclose?.('subscription closed');
          },
          events: async function* () {
            // This would yield events as they arrive
          },
        };
      }
    ),
  };
}

function matchesFilters(event: MockEvent, filters: MockFilter[]): boolean {
  return filters.some((filter) => {
    if (filter.ids && !filter.ids.includes(event.id)) return false;
    if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
    if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
    if (filter.since && event.created_at < filter.since) return false;
    if (filter.until && event.created_at > filter.until) return false;
    return true;
  });
}

// ============================================================================
// Mock Relay Pool
// ============================================================================

export interface MockRelayPool {
  relays: Map<string, MockRelay>;
  addRelay: (url: string) => MockRelay;
  removeRelay: (url: string) => void;
  publish: (event: MockEvent) => Promise<Map<string, string>>;
  subscribe: (filters: MockFilter[], callbacks: MockSubCallbacks) => MockPoolSubscription;
  close: () => void;
}

export interface MockPoolSubscription {
  close: () => void;
}

export function createMockRelayPool(relayUrls: string[] = []): MockRelayPool {
  const relays = new Map<string, MockRelay>();

  // Initialize relays
  relayUrls.forEach((url) => {
    relays.set(url, createMockRelay(url));
  });

  return {
    relays,

    addRelay: (url: string) => {
      const relay = createMockRelay(url);
      relays.set(url, relay);
      return relay;
    },

    removeRelay: (url: string) => {
      const relay = relays.get(url);
      if (relay) {
        relay.close();
        relays.delete(url);
      }
    },

    publish: async (event: MockEvent) => {
      const results = new Map<string, string>();
      for (const [url, relay] of relays) {
        try {
          const id = await relay.publish(event);
          results.set(url, id);
        } catch {
          // Ignore publish errors
        }
      }
      return results;
    },

    subscribe: (filters: MockFilter[], callbacks: MockSubCallbacks) => {
      const subs: MockSubscription[] = [];

      relays.forEach((relay) => {
        subs.push(relay.subscribe(filters, callbacks));
      });

      return {
        close: () => {
          subs.forEach((sub) => sub.close());
        },
      };
    },

    close: () => {
      relays.forEach((relay) => relay.close());
      relays.clear();
    },
  };
}

// ============================================================================
// Mock nostr-tools functions
// ============================================================================

export const mockNostrTools = {
  generateSecretKey: vi.fn().mockReturnValue(new Uint8Array(32).fill(1)),

  getPublicKey: vi.fn().mockImplementation((privateKey: Uint8Array) => {
    // Return a deterministic mock public key based on private key
    const hash = privateKey.reduce((acc, byte) => acc + byte, 0);
    return 'pubkey-' + hash.toString(16).padStart(64, '0');
  }),

  finalizeEvent: vi.fn().mockImplementation((event: Partial<MockEvent>, privateKey: Uint8Array) => {
    const pubkey = mockNostrTools.getPublicKey(privateKey);
    return {
      ...event,
      id: 'event-' + Date.now().toString(16),
      pubkey,
      sig: 'sig-' + Date.now().toString(16),
      created_at: event.created_at ?? Math.floor(Date.now() / 1000),
    };
  }),

  verifyEvent: vi.fn().mockReturnValue(true),

  nip04: {
    encrypt: vi.fn().mockImplementation(async (_privateKey, _pubkey, content) => {
      return 'encrypted:' + Buffer.from(content).toString('base64');
    }),
    decrypt: vi.fn().mockImplementation(async (_privateKey, _pubkey, content) => {
      if (content.startsWith('encrypted:')) {
        return Buffer.from(content.replace('encrypted:', ''), 'base64').toString();
      }
      return content;
    }),
  },

  nip19: {
    npubEncode: vi.fn().mockImplementation((pubkey: string) => 'npub1' + pubkey.slice(0, 58)),
    nsecEncode: vi.fn().mockImplementation((seckey: Uint8Array) => {
      const hex = Array.from(seckey)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return 'nsec1' + hex.slice(0, 58);
    }),
    decode: vi.fn().mockImplementation((str: string) => {
      if (str.startsWith('npub1')) {
        return { type: 'npub', data: str.slice(5).padEnd(64, '0') };
      }
      if (str.startsWith('nsec1')) {
        return { type: 'nsec', data: str.slice(5).padEnd(64, '0') };
      }
      throw new Error('Invalid bech32 string');
    }),
  },
};

// ============================================================================
// Default relay list for testing
// ============================================================================

export const DEFAULT_TEST_RELAYS = [
  'wss://relay.test.local:8080',
  'wss://relay2.test.local:8080',
  'wss://relay3.test.local:8080',
];

// ============================================================================
// Installation helper
// ============================================================================

export function installNostrMocks(): void {
  vi.mock('nostr-tools', () => mockNostrTools);
}

export function resetNostrMocks(): void {
  Object.values(mockNostrTools).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      fn.mockClear();
    }
  });
}
