/**
 * Update Checker Service Tests
 *
 * Tests for the UpdateChecker class including:
 * - Initialization and configuration
 * - Version loading and comparison
 * - Update checking logic
 * - Service worker update detection
 * - Periodic checks
 * - Version dismissal
 * - Event listeners and callbacks
 * - Cleanup and destruction
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UpdateChecker, type UpdateCheckerConfig } from '../checker';

// ============================================================================
// Test Setup
// ============================================================================

// Mock build-time variables
vi.stubGlobal('__APP_VERSION__', '1.0.0');
vi.stubGlobal('__BUILD_TIME__', '2024-01-01T00:00:00Z');

// Mock localStorage
let localStorageData: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageData[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageData[key];
  }),
  clear: vi.fn(() => {
    localStorageData = {};
  }),
};

// Helper to clear rate limit in tests
function clearRateLimit() {
  delete localStorageData['bitchat-update-last-check'];
  delete localStorageData['bitchat-update-dismissed'];
}

// Mock fetch
const mockFetch = vi.fn();

// Mock service worker
const mockServiceWorkerRegistration = {
  update: vi.fn().mockResolvedValue(undefined),
};

const mockServiceWorker = {
  getRegistration: vi.fn().mockResolvedValue(mockServiceWorkerRegistration),
  ready: Promise.resolve(mockServiceWorkerRegistration),
};

describe('UpdateChecker', () => {
  let checker: UpdateChecker;

  // Helper to set up default fetch mock for version.json
  function setupDefaultFetchMock(version = '1.0.0') {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          version,
          buildTime: '2024-01-01T00:00:00Z',
        }),
      })
    );
  }

  // Helper to set up fetch for specific version response
  function setupVersionFetch(version: string, options: { releaseNotes?: string[]; critical?: boolean } = {}) {
    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          version,
          buildTime: '2024-01-01T00:00:00Z',
          ...options,
        }),
      })
    );
  }

  beforeEach(() => {
    // Reset mocks
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    localStorageData = {};

    // Setup global mocks
    globalThis.fetch = mockFetch;
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        onLine: true,
        serviceWorker: mockServiceWorker,
        userAgent: 'Mozilla/5.0',
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        visibilityState: 'visible',
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      },
      writable: true,
      configurable: true,
    });

    // Setup default fetch mock
    setupDefaultFetchMock();

    // Destroy any existing instance
    try {
      UpdateChecker.getInstance().destroy();
    } catch {
      // Ignore if no instance exists
    }

    checker = UpdateChecker.getInstance();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();

    // Destroy checker
    try {
      checker.destroy();
    } catch {
      // Ignore
    }
  });

  // ============================================================================
  // Initialization
  // ============================================================================

  describe('Initialization', () => {
    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = UpdateChecker.getInstance();
        const instance2 = UpdateChecker.getInstance();

        expect(instance1).toBe(instance2);
      });

      it('should accept configuration', () => {
        checker.destroy();

        const config: UpdateCheckerConfig = {
          checkIntervalMs: 60000,
          versionUrl: '/custom-version.json',
          checkOnInit: false,
        };

        const instance = UpdateChecker.getInstance(config);
        expect(instance).toBeInstanceOf(UpdateChecker);
      });
    });

    describe('init', () => {
      it('should load current version', async () => {
        setupVersionFetch('1.2.3');

        await checker.init();

        expect(checker.getCurrentVersion()?.version).toBe('1.2.3');
      });

      it('should fallback to build-time version if fetch fails', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        await checker.init();

        expect(checker.getCurrentVersion()?.version).toBe('1.0.0');
      });

      it('should setup event listeners for visibility', async () => {
        await checker.init();

        expect(document.addEventListener).toHaveBeenCalledWith(
          'visibilitychange',
          expect.any(Function)
        );
      });

      it('should setup event listeners for online status', async () => {
        await checker.init();

        expect(window.addEventListener).toHaveBeenCalledWith(
          'online',
          expect.any(Function)
        );
      });

      it('should setup event listener for service worker updates', async () => {
        await checker.init();

        expect(window.addEventListener).toHaveBeenCalledWith(
          'sw-update',
          expect.any(Function)
        );
      });

      it('should skip initial check if checkOnInit is false', async () => {
        checker.destroy();
        const newChecker = UpdateChecker.getInstance({ checkOnInit: false });

        await newChecker.init();

        // Only version load, no additional check scheduled
        const initialCalls = mockFetch.mock.calls.length;

        vi.advanceTimersByTime(3000);

        // No new fetches from initial check
        expect(mockFetch.mock.calls.length).toBe(initialCalls);

        newChecker.destroy();
      });
    });
  });

  // ============================================================================
  // Version Comparison
  // ============================================================================

  describe('Version Comparison', () => {
    describe('checkForUpdates', () => {
      it('should detect when new version is available', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('2.0.0');
        const result = await checker.forceCheck();

        expect(result.hasUpdate).toBe(true);
        expect(result.newVersion).toBe('2.0.0');
      });

      it('should detect no update when version is same', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('1.0.0');
        const result = await checker.forceCheck();

        expect(result.hasUpdate).toBe(false);
        expect(result.newVersion).toBeUndefined();
      });

      it('should compare patch versions correctly', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('1.0.1');
        const result = await checker.forceCheck();

        expect(result.hasUpdate).toBe(true);
        expect(result.newVersion).toBe('1.0.1');
      });

      it('should compare minor versions correctly', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('1.1.0');
        const result = await checker.forceCheck();

        expect(result.hasUpdate).toBe(true);
      });

      it('should handle version with different segment counts', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('1.0.0.1');
        const result = await checker.forceCheck();

        expect(result.hasUpdate).toBe(true);
      });

      it('should include release notes from new version', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('2.0.0', { releaseNotes: ['New feature 1', 'Bug fix 2'] });
        const result = await checker.forceCheck();

        expect(result.releaseNotes).toEqual(['New feature 1', 'Bug fix 2']);
      });

      it('should indicate critical updates', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('2.0.0', { critical: true });
        const result = await checker.forceCheck();

        expect(result.isCritical).toBe(true);
      });

      it('should not report update when new version is lower', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('0.9.0');
        const result = await checker.forceCheck();

        expect(result.hasUpdate).toBe(false);
      });
    });

    describe('Rate limiting', () => {
      it('should rate limit checks to minimum 1 minute', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        // First check using forceCheck (clears rate limit)
        const result1 = await checker.forceCheck();

        // Immediate second check should return cached result (not using forceCheck)
        setupVersionFetch('2.0.0');
        const result2 = await checker.checkForUpdates();

        // hasUpdate should be false because rate limited
        expect(result2.hasUpdate).toBe(false);
      });

      it('should allow check after rate limit expires', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        await checker.forceCheck();

        // Advance past rate limit
        vi.advanceTimersByTime(2 * 60 * 1000);
        clearRateLimit();

        setupVersionFetch('2.0.0');
        const result = await checker.checkForUpdates();

        expect(result.hasUpdate).toBe(true);
      });
    });

    describe('Offline handling', () => {
      it('should skip check when offline', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        Object.defineProperty(globalThis.navigator, 'onLine', {
          value: false,
          writable: true,
          configurable: true,
        });

        clearRateLimit();
        const fetchCallsBefore = mockFetch.mock.calls.length;

        const result = await checker.checkForUpdates();

        // No new fetches
        expect(mockFetch.mock.calls.length).toBe(fetchCallsBefore);
        expect(result.hasUpdate).toBe(false);
      });
    });

    describe('Concurrent check prevention', () => {
      it('should prevent concurrent checks', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        clearRateLimit();

        let resolveFirst: (value: unknown) => void;
        const slowFetch = new Promise((resolve) => {
          resolveFirst = resolve;
        });

        mockFetch.mockImplementationOnce(() => slowFetch);

        // Start first check
        const check1Promise = checker.forceCheck();

        // Try second check while first is pending
        const check2Promise = checker.checkForUpdates();

        // Resolve first check
        resolveFirst!({
          ok: true,
          json: () => Promise.resolve({ version: '2.0.0' }),
        });

        const [result1, result2] = await Promise.all([check1Promise, check2Promise]);

        // Both should complete (second returns cached/default)
        expect(result1).toBeDefined();
        expect(result2).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Service Worker Updates
  // ============================================================================

  describe('Service Worker Updates', () => {
    it('should call service worker update check', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      await checker.forceCheck();

      expect(mockServiceWorker.getRegistration).toHaveBeenCalled();
    });

    it('should handle missing service worker gracefully', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      Object.defineProperty(globalThis.navigator, 'serviceWorker', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      // Should not throw
      const result = await checker.forceCheck();

      expect(result).toBeDefined();
    });

    it('should handle service worker update errors', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      mockServiceWorkerRegistration.update.mockRejectedValueOnce(
        new Error('SW update failed')
      );

      // Should not throw
      const result = await checker.forceCheck();

      expect(result).toBeDefined();
    });
  });

  // ============================================================================
  // Version Dismissal
  // ============================================================================

  describe('Version Dismissal', () => {
    it('should dismiss a version', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      checker.dismissVersion('2.0.0');

      expect(localStorageData['bitchat-update-dismissed']).toBe('2.0.0');
    });

    it('should not report update for dismissed version', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      // Dismiss version 2.0.0
      checker.dismissVersion('2.0.0');

      // Try to check for updates with version 2.0.0
      setupVersionFetch('2.0.0');
      const result = await checker.checkForUpdates();

      expect(result.hasUpdate).toBe(false);
    });

    it('should clear dismissed version', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      localStorageData['bitchat-update-dismissed'] = '2.0.0';

      checker.clearDismissed();

      expect(localStorageData['bitchat-update-dismissed']).toBeUndefined();
    });

    it('should handle localStorage errors gracefully', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage full');
      });

      // Should not throw
      expect(() => checker.dismissVersion('2.0.0')).not.toThrow();

      mockLocalStorage.setItem = originalSetItem;
    });
  });

  // ============================================================================
  // Callbacks and Event Handling
  // ============================================================================

  describe('Callbacks', () => {
    describe('onUpdate', () => {
      it('should register callback and receive update results', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        const callback = vi.fn();
        checker.onUpdate(callback);

        setupVersionFetch('2.0.0');
        await checker.forceCheck();

        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            hasUpdate: true,
            newVersion: '2.0.0',
          })
        );
      });

      it('should immediately call with last result if available', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('2.0.0');
        await checker.forceCheck();

        const callback = vi.fn();
        checker.onUpdate(callback);

        // Should be called immediately with last result
        expect(callback).toHaveBeenCalledWith(
          expect.objectContaining({
            hasUpdate: true,
          })
        );
      });

      it('should return unsubscribe function', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        const callback = vi.fn();
        const unsubscribe = checker.onUpdate(callback);

        // Clear callback from any initial call
        callback.mockClear();
        unsubscribe();

        setupVersionFetch('3.0.0');
        await checker.forceCheck();

        // Callback should not be called after unsubscribe
        expect(callback).not.toHaveBeenCalled();
      });

      it('should handle callback errors gracefully', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        const badCallback = vi.fn().mockImplementation(() => {
          throw new Error('Callback error');
        });
        const goodCallback = vi.fn();

        checker.onUpdate(badCallback);
        checker.onUpdate(goodCallback);

        // Clear initial calls
        badCallback.mockClear();
        goodCallback.mockClear();

        setupVersionFetch('2.0.0');

        // Should not throw
        await checker.forceCheck();

        // Good callback should still be called despite bad callback throwing
        expect(goodCallback).toHaveBeenCalled();
      });
    });
  });

  // ============================================================================
  // Periodic Checks
  // ============================================================================

  describe('Periodic Checks', () => {
    it('should stop periodic checks when requested', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      checker.stopPeriodicChecks();

      const fetchCallsBefore = mockFetch.mock.calls.length;

      // Advance time past multiple intervals
      vi.advanceTimersByTime(120 * 60 * 1000);

      // No additional fetches from periodic checks
      expect(mockFetch.mock.calls.length).toBe(fetchCallsBefore);
    });
  });

  // ============================================================================
  // Force Check
  // ============================================================================

  describe('forceCheck', () => {
    it('should clear dismissed version and force check', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      localStorageData['bitchat-update-dismissed'] = '2.0.0';
      setupVersionFetch('2.0.0');

      const result = await checker.forceCheck();

      expect(localStorageData['bitchat-update-dismissed']).toBeUndefined();
      expect(result.hasUpdate).toBe(true);
    });

    it('should bypass rate limiting', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      // Do initial check
      await checker.forceCheck();

      // Immediate force check should work despite rate limit
      setupVersionFetch('3.0.0');
      const result = await checker.forceCheck();

      expect(result.hasUpdate).toBe(true);
      expect(result.newVersion).toBe('3.0.0');
    });
  });

  // ============================================================================
  // Getters
  // ============================================================================

  describe('Getters', () => {
    describe('getCurrentVersion', () => {
      it('should return current version info after init', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        const version = checker.getCurrentVersion();

        expect(version).toBeDefined();
        expect(version?.version).toBe('1.0.0');
      });
    });

    describe('getLatestVersion', () => {
      it('should return null before any check completes', async () => {
        // Initialize without triggering the delayed check
        checker.destroy();
        const newChecker = UpdateChecker.getInstance({ checkOnInit: false });
        setupVersionFetch('1.0.0');
        await newChecker.init();

        const version = newChecker.getLatestVersion();

        expect(version).toBeNull();

        newChecker.destroy();
      });

      it('should return latest version after check', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        // Clear any previous check results
        clearRateLimit();
        setupVersionFetch('2.0.0');

        await checker.forceCheck(); // Use forceCheck to bypass rate limiting

        const version = checker.getLatestVersion();

        expect(version?.version).toBe('2.0.0');
      });
    });

    describe('getLastCheckResult', () => {
      it('should return null before any check completes', async () => {
        // Initialize without triggering the delayed check
        checker.destroy();
        const newChecker = UpdateChecker.getInstance({ checkOnInit: false });
        setupVersionFetch('1.0.0');
        await newChecker.init();

        const result = newChecker.getLastCheckResult();

        expect(result).toBeNull();

        newChecker.destroy();
      });

      it('should return last check result', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('2.0.0');
        const checkResult = await checker.forceCheck();

        const result = checker.getLastCheckResult();

        expect(result).toBeDefined();
        expect(result?.hasUpdate).toBe(true);
        expect(result?.checkTime).toBeGreaterThan(0);
      });
    });

    describe('hasUpdate', () => {
      it('should return false before any check', async () => {
        // Initialize without triggering the delayed check
        checker.destroy();
        const newChecker = UpdateChecker.getInstance({ checkOnInit: false });
        setupVersionFetch('1.0.0');
        await newChecker.init();

        expect(newChecker.hasUpdate()).toBe(false);

        newChecker.destroy();
      });

      it('should return true when update is available', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('2.0.0');
        await checker.forceCheck();

        expect(checker.hasUpdate()).toBe(true);
      });

      it('should return false when no update', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        setupVersionFetch('1.0.0');
        await checker.forceCheck();

        expect(checker.hasUpdate()).toBe(false);
      });
    });
  });

  // ============================================================================
  // Error Handling
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await checker.forceCheck();

      expect(result.hasUpdate).toBe(false);
    });

    it('should handle invalid JSON gracefully', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      const result = await checker.forceCheck();

      expect(result.hasUpdate).toBe(false);
    });

    it('should handle HTTP errors gracefully', async () => {
      setupVersionFetch('1.0.0');
      await checker.init();

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });

      const result = await checker.forceCheck();

      expect(result.hasUpdate).toBe(false);
    });
  });

  // ============================================================================
  // Cleanup
  // ============================================================================

  describe('Cleanup', () => {
    describe('destroy', () => {
      it('should stop periodic checks', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        const fetchCallsBefore = mockFetch.mock.calls.length;

        checker.destroy();

        vi.advanceTimersByTime(60 * 60 * 1000);

        expect(mockFetch.mock.calls.length).toBe(fetchCallsBefore);
      });

      it('should clear callbacks', async () => {
        setupVersionFetch('1.0.0');
        await checker.init();

        const callback = vi.fn();
        checker.onUpdate(callback);
        callback.mockClear();

        checker.destroy();

        // Re-create instance and check
        const newChecker = UpdateChecker.getInstance();
        await newChecker.init();

        clearRateLimit();
        setupVersionFetch('3.0.0');

        await newChecker.checkForUpdates();

        // Old callback should not be called
        expect(callback).not.toHaveBeenCalled();

        newChecker.destroy();
      });

      it('should reset singleton instance', () => {
        const oldChecker = checker;
        checker.destroy();

        const newChecker = UpdateChecker.getInstance();

        expect(newChecker).not.toBe(oldChecker);
      });
    });
  });
});
