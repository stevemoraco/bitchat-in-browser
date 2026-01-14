/**
 * Vitest Global Test Setup
 *
 * This file runs before each test file and sets up the testing environment
 * with necessary mocks for browser APIs that don't exist in jsdom.
 */

import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import { expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import 'fake-indexeddb/auto';

// Extend Vitest expect with jest-dom matchers
expect.extend(matchers);

// ============================================================================
// Mock localStorage
// ============================================================================

class MockLocalStorage implements Storage {
  private store: Map<string, string> = new Map();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

const mockLocalStorage = new MockLocalStorage();
const mockSessionStorage = new MockLocalStorage();

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});

// ============================================================================
// Mock crypto.getRandomValues
// ============================================================================

const mockGetRandomValues = <T extends ArrayBufferView | null>(array: T): T => {
  if (array === null) return array;

  const bytes = new Uint8Array(
    array.buffer,
    array.byteOffset,
    array.byteLength
  );

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  return array;
};

const mockSubtleCrypto: SubtleCrypto = {
  decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  deriveBits: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  deriveKey: vi.fn().mockResolvedValue({}),
  digest: vi.fn().mockImplementation(async (_algorithm, data: ArrayBuffer) => {
    // Simple mock hash - returns data length as first 4 bytes
    const result = new Uint8Array(32);
    const view = new DataView(result.buffer);
    view.setUint32(0, data.byteLength);
    return result.buffer;
  }),
  encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
  generateKey: vi.fn().mockResolvedValue({
    privateKey: {},
    publicKey: {},
  }),
  importKey: vi.fn().mockResolvedValue({}),
  sign: vi.fn().mockResolvedValue(new ArrayBuffer(64)),
  unwrapKey: vi.fn().mockResolvedValue({}),
  verify: vi.fn().mockResolvedValue(true),
  wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
};

Object.defineProperty(globalThis, 'crypto', {
  value: {
    getRandomValues: mockGetRandomValues,
    randomUUID: () =>
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }),
    subtle: mockSubtleCrypto,
  },
  writable: true,
});

// ============================================================================
// Mock Web APIs not available in jsdom
// ============================================================================

// Mock matchMedia
Object.defineProperty(globalThis, 'matchMedia', {
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
  writable: true,
});

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: MockResizeObserver,
  writable: true,
});

// Mock IntersectionObserver
class MockIntersectionObserver {
  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {}
  root = null;
  rootMargin = '0px';
  thresholds: readonly number[] = [0];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn().mockReturnValue([]);
}

Object.defineProperty(globalThis, 'IntersectionObserver', {
  value: MockIntersectionObserver,
  writable: true,
});

// Mock Navigator.serviceWorker
Object.defineProperty(navigator, 'serviceWorker', {
  value: {
    ready: Promise.resolve({
      active: null,
      installing: null,
      waiting: null,
      scope: '/',
      updateViaCache: 'none',
      update: vi.fn(),
      unregister: vi.fn().mockResolvedValue(true),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      navigationPreload: {
        disable: vi.fn(),
        enable: vi.fn(),
        getState: vi.fn(),
        setHeaderValue: vi.fn(),
      },
    }),
    controller: null,
    register: vi.fn().mockResolvedValue({}),
    getRegistrations: vi.fn().mockResolvedValue([]),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  },
  writable: true,
});

// Mock Navigator.geolocation
Object.defineProperty(navigator, 'geolocation', {
  value: {
    getCurrentPosition: vi.fn().mockImplementation((success) => {
      success({
        coords: {
          latitude: 40.7128,
          longitude: -74.006,
          accuracy: 100,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    }),
    watchPosition: vi.fn().mockReturnValue(1),
    clearWatch: vi.fn(),
  },
  writable: true,
});

// Mock Notification API
Object.defineProperty(globalThis, 'Notification', {
  value: class MockNotification {
    static permission = 'default';
    static requestPermission = vi.fn().mockResolvedValue('granted');
    constructor(
      public title: string,
      public options?: NotificationOptions
    ) {}
    close = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
    dispatchEvent = vi.fn();
  },
  writable: true,
});

// Mock Performance API
Object.defineProperty(globalThis, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByName: vi.fn().mockReturnValue([]),
    getEntriesByType: vi.fn().mockReturnValue([]),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    timeOrigin: Date.now(),
    timing: {},
    navigation: {},
  },
  writable: true,
});

// Mock fetch
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: vi.fn().mockResolvedValue({}),
  text: vi.fn().mockResolvedValue(''),
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  blob: vi.fn().mockResolvedValue(new Blob()),
  headers: new Headers(),
  clone: vi.fn(),
});

// Mock WebSocket
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

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    if (protocols) {
      this.protocol = Array.isArray(protocols) ? (protocols[0] ?? '') : protocols;
    }
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  send = vi.fn();
  close = vi.fn().mockImplementation(() => {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  });
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
}

Object.defineProperty(globalThis, 'WebSocket', {
  value: MockWebSocket,
  writable: true,
});

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeAll(() => {
  // Any one-time setup
  console.log('[Test Setup] Vitest environment initialized');
});

afterEach(() => {
  // Clear storage between tests
  mockLocalStorage.clear();
  mockSessionStorage.clear();

  // Clear all mocks
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup
  vi.restoreAllMocks();
});

// ============================================================================
// Type Declarations for TypeScript
// ============================================================================

declare global {
  namespace Vi {
    interface JestAssertion<T = unknown> {
      toBeInTheDocument(): T;
      toHaveTextContent(text: string): T;
      toBeVisible(): T;
      toHaveAttribute(attr: string, value?: string): T;
      toHaveClass(className: string): T;
    }
  }
}

export { mockLocalStorage, mockSessionStorage, mockGetRandomValues };
