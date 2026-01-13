/**
 * Test Module - Central export for all test utilities
 *
 * Import from '@test' or './test' in test files:
 *
 * ```ts
 * import {
 *   createMockMessage,
 *   createMockChannel,
 *   renderWithProviders,
 *   waitFor,
 * } from '@test';
 * ```
 */

// Test utilities
export {
  // Mock data factories
  createMockMessage,
  createMockChannel,
  createMockPeer,
  createMockIdentity,
  createMockMessages,
  createMockChannels,
  createMockPeers,
  resetIdCounter,

  // Render helpers
  renderWithProviders,
  renderComponent,

  // Async helpers
  waitFor,
  waitForElement,
  waitForAsync,
  flushPromises,
  advanceTimers,

  // Event helpers
  fireEvent,
  click,
  type,
  pressEnter,

  // Assertion helpers
  assertVisible,
  assertTextContent,

  // Cleanup
  cleanup,

  // Re-exports
  h,
  render,
  vi,
} from './utils';

export type {
  MockMessage,
  MockChannel,
  MockPeer,
  MockIdentity,
  RenderOptions,
  RenderResult,
} from './utils';

// Mocks
export * from './mocks';
