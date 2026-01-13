/**
 * Test Utilities - Helper functions for testing BitChat components
 *
 * Provides utilities for:
 * - Rendering components with providers
 * - Creating mock data
 * - Async test helpers
 * - Custom matchers
 */

import { ComponentChildren, VNode, render } from 'preact';
import { h as _h } from 'preact';
import { vi } from 'vitest';

// Re-export h for JSX usage
export { _h as h };

// ============================================================================
// Types
// ============================================================================

export interface MockMessage {
  id: string;
  channelId: string;
  senderId: string;
  senderNickname: string;
  content: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  type: 'text' | 'action' | 'system';
  mentions?: string[];
  replyTo?: string;
  isEncrypted?: boolean;
}

export interface MockChannel {
  id: string;
  name: string;
  type: 'location' | 'dm' | 'group';
  geohash?: string;
  latitude?: number;
  longitude?: number;
  unreadCount: number;
  lastMessage?: MockMessage;
  participants: string[];
  createdAt: number;
  updatedAt: number;
}

export interface MockPeer {
  id: string;
  publicKey: string;
  nickname: string;
  fingerprint: string;
  isOnline: boolean;
  lastSeen: number;
  channels: string[];
}

export interface MockIdentity {
  publicKey: string;
  privateKey: Uint8Array;
  nickname: string;
  fingerprint: string;
  createdAt: number;
}

export interface RenderOptions {
  initialState?: Record<string, unknown>;
  wrappers?: Array<(children: ComponentChildren) => VNode>;
}

export interface RenderResult {
  container: HTMLElement;
  rerender: (component: VNode) => void;
  unmount: () => void;
  getByText: (text: string | RegExp) => HTMLElement | null;
  getByTestId: (testId: string) => HTMLElement | null;
  getAllByRole: (role: string) => HTMLElement[];
  queryByText: (text: string | RegExp) => HTMLElement | null;
  queryByTestId: (testId: string) => HTMLElement | null;
}

// ============================================================================
// ID Generation
// ============================================================================

let idCounter = 0;

function generateId(prefix: string = ''): string {
  return `${prefix}${++idCounter}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================================
// Mock Data Factories
// ============================================================================

export function createMockMessage(overrides: Partial<MockMessage> = {}): MockMessage {
  const id = overrides.id ?? generateId('msg-');
  return {
    id,
    channelId: overrides.channelId ?? 'channel-1',
    senderId: overrides.senderId ?? 'user-1',
    senderNickname: overrides.senderNickname ?? 'TestUser',
    content: overrides.content ?? 'This is a test message',
    timestamp: overrides.timestamp ?? Date.now(),
    status: overrides.status ?? 'sent',
    type: overrides.type ?? 'text',
    mentions: overrides.mentions,
    replyTo: overrides.replyTo,
    isEncrypted: overrides.isEncrypted ?? false,
  };
}

export function createMockChannel(overrides: Partial<MockChannel> = {}): MockChannel {
  const id = overrides.id ?? generateId('channel-');
  const now = Date.now();

  return {
    id,
    name: overrides.name ?? `Channel ${id}`,
    type: overrides.type ?? 'location',
    geohash: overrides.geohash ?? 'dr5regw',
    latitude: overrides.latitude ?? 40.7128,
    longitude: overrides.longitude ?? -74.006,
    unreadCount: overrides.unreadCount ?? 0,
    lastMessage: overrides.lastMessage,
    participants: overrides.participants ?? [],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

export function createMockPeer(overrides: Partial<MockPeer> = {}): MockPeer {
  const id = overrides.id ?? generateId('peer-');

  return {
    id,
    publicKey: overrides.publicKey ?? `pubkey-${id}`,
    nickname: overrides.nickname ?? `Peer ${id}`,
    fingerprint: overrides.fingerprint ?? generateFingerprint(),
    isOnline: overrides.isOnline ?? true,
    lastSeen: overrides.lastSeen ?? Date.now(),
    channels: overrides.channels ?? [],
  };
}

export function createMockIdentity(overrides: Partial<MockIdentity> = {}): MockIdentity {
  const now = Date.now();

  return {
    publicKey: overrides.publicKey ?? `pubkey-${generateId('id-')}`,
    privateKey: overrides.privateKey ?? new Uint8Array(32).fill(1),
    nickname: overrides.nickname ?? 'TestUser',
    fingerprint: overrides.fingerprint ?? generateFingerprint(),
    createdAt: overrides.createdAt ?? now,
  };
}

function generateFingerprint(): string {
  const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
  return words
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .join('-');
}

// ============================================================================
// Create Multiple Mock Items
// ============================================================================

export function createMockMessages(count: number, channelId?: string): MockMessage[] {
  return Array.from({ length: count }, (_, i) =>
    createMockMessage({
      channelId,
      content: `Test message ${i + 1}`,
      timestamp: Date.now() - (count - i) * 1000,
    })
  );
}

export function createMockChannels(count: number): MockChannel[] {
  return Array.from({ length: count }, (_, i) =>
    createMockChannel({
      name: `Channel ${i + 1}`,
    })
  );
}

export function createMockPeers(count: number): MockPeer[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPeer({
      nickname: `Peer ${i + 1}`,
      isOnline: i % 2 === 0,
    })
  );
}

// ============================================================================
// Render Helpers
// ============================================================================

/**
 * Renders a component with optional providers/wrappers
 */
export function renderWithProviders(
  component: VNode,
  options: RenderOptions = {}
): RenderResult {
  const container = document.createElement('div');
  container.id = 'test-root';
  document.body.appendChild(container);

  // Wrap component with any provided wrappers
  let wrapped = component;
  if (options.wrappers) {
    wrapped = options.wrappers.reduceRight((acc, wrapper) => wrapper(acc), component);
  }

  // Render the component
  render(wrapped, container);

  const result: RenderResult = {
    container,

    rerender: (newComponent: VNode) => {
      let rewrapped = newComponent;
      if (options.wrappers) {
        rewrapped = options.wrappers.reduceRight((acc, wrapper) => wrapper(acc), newComponent);
      }
      render(rewrapped, container);
    },

    unmount: () => {
      render(null, container);
      container.remove();
    },

    getByText: (text: string | RegExp) => {
      const elements = container.querySelectorAll('*');
      for (const el of elements) {
        const textContent = el.textContent ?? '';
        if (typeof text === 'string' ? textContent.includes(text) : text.test(textContent)) {
          return el as HTMLElement;
        }
      }
      return null;
    },

    getByTestId: (testId: string) => {
      return container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
    },

    getAllByRole: (role: string) => {
      return Array.from(container.querySelectorAll(`[role="${role}"]`)) as HTMLElement[];
    },

    queryByText: (text: string | RegExp) => result.getByText(text),

    queryByTestId: (testId: string) => result.getByTestId(testId),
  };

  return result;
}

/**
 * Simple render without providers
 */
export function renderComponent(component: VNode): RenderResult {
  return renderWithProviders(component);
}

// ============================================================================
// Async Helpers
// ============================================================================

/**
 * Waits for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

/**
 * Waits for an element to appear in the DOM
 */
export async function waitForElement(
  selector: string,
  container: HTMLElement = document.body,
  options: { timeout?: number } = {}
): Promise<HTMLElement> {
  const { timeout = 5000 } = options;

  await waitFor(
    () => container.querySelector(selector) !== null,
    { timeout }
  );

  const element = container.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  return element as HTMLElement;
}

/**
 * Waits for an async callback to complete
 */
export async function waitForAsync<T>(
  callback: () => Promise<T>,
  options: { timeout?: number } = {}
): Promise<T> {
  const { timeout = 5000 } = options;

  return Promise.race([
    callback(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`waitForAsync timed out after ${timeout}ms`)), timeout)
    ),
  ]);
}

/**
 * Flushes pending microtasks and timers
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await vi.runAllTimersAsync?.() ?? Promise.resolve();
}

/**
 * Advances fake timers by the specified amount
 */
export async function advanceTimers(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await flushPromises();
}

// ============================================================================
// Event Helpers
// ============================================================================

/**
 * Creates and dispatches a DOM event
 */
export function fireEvent(
  element: HTMLElement,
  eventType: string,
  eventInit: EventInit = {}
): boolean {
  const event = new Event(eventType, { bubbles: true, cancelable: true, ...eventInit });
  return element.dispatchEvent(event);
}

/**
 * Simulates a click event
 */
export function click(element: HTMLElement): boolean {
  return fireEvent(element, 'click');
}

/**
 * Simulates keyboard input
 */
export function type(element: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  element.focus();
  element.value = text;
  fireEvent(element, 'input');
  fireEvent(element, 'change');
}

/**
 * Simulates pressing Enter key
 */
export function pressEnter(element: HTMLElement): boolean {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    bubbles: true,
    cancelable: true,
  });
  return element.dispatchEvent(event);
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Asserts that an element is visible
 */
export function assertVisible(element: HTMLElement | null): asserts element is HTMLElement {
  if (!element) {
    throw new Error('Element is null');
  }
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    throw new Error('Element is not visible');
  }
}

/**
 * Asserts that an element has specific text content
 */
export function assertTextContent(element: HTMLElement | null, expected: string): void {
  if (!element) {
    throw new Error('Element is null');
  }
  if (!element.textContent?.includes(expected)) {
    throw new Error(`Expected text "${expected}" not found. Got: "${element.textContent}"`);
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Cleans up rendered components
 */
export function cleanup(): void {
  const testRoot = document.getElementById('test-root');
  if (testRoot) {
    render(null, testRoot);
    testRoot.remove();
  }

  // Clear any remaining elements
  document.body.innerHTML = '';
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { render } from 'preact';
export { vi } from 'vitest';
