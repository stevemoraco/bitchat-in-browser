/**
 * BitChat In Browser - Service Worker Registration
 *
 * Provides a streamlined API for registering and managing the service worker.
 * This module can be used directly in main.tsx for app initialization.
 */

import { updateService, UpdateService, type UpdateInfo, type UpdateCallback } from '../services/updates';

export interface RegisterSWOptions {
  /**
   * Callback when an update is available
   */
  onUpdate?: UpdateCallback;

  /**
   * Callback when the app is ready to work offline
   */
  onOfflineReady?: () => void;

  /**
   * Callback when registration fails
   */
  onError?: (error: Error) => void;

  /**
   * Whether to reload automatically on update (default: false)
   */
  autoReload?: boolean;

  /**
   * Whether to register immediately or wait for page load (default: true)
   */
  immediate?: boolean;
}

export interface RegisterSWResult {
  /**
   * Check for updates manually
   */
  checkForUpdates: () => Promise<boolean>;

  /**
   * Apply pending update (triggers reload)
   */
  applyUpdate: () => void;

  /**
   * Get current update status
   */
  getStatus: () => UpdateInfo['status'];

  /**
   * Check if update is ready
   */
  hasUpdate: () => boolean;

  /**
   * Unregister service worker
   */
  unregister: () => Promise<boolean>;

  /**
   * Clear all caches
   */
  clearCaches: () => Promise<void>;
}

/**
 * Register the service worker with the given options
 *
 * @param options - Configuration options
 * @returns Control functions for the service worker
 *
 * @example
 * ```ts
 * const sw = await registerSW({
 *   onUpdate: (info) => {
 *     if (info.status === 'ready') {
 *       showUpdateBanner();
 *     }
 *   },
 *   onOfflineReady: () => {
 *     showToast('App ready to work offline');
 *   },
 * });
 *
 * // Later, to apply update:
 * sw.applyUpdate();
 * ```
 */
export async function registerSW(options: RegisterSWOptions = {}): Promise<RegisterSWResult> {
  const {
    onUpdate,
    onOfflineReady,
    onError,
    autoReload = false,
    immediate = true,
  } = options;

  // Check for support
  if (!UpdateService.isSupported()) {
    console.warn('[SW Registration] Service workers not supported in this browser');
    return createNoopResult();
  }

  // Set up update callback
  if (onUpdate) {
    updateService.onUpdate((info) => {
      onUpdate(info);

      // Auto reload if configured
      if (autoReload && info.status === 'ready') {
        updateService.applyUpdate();
      }
    });
  }

  // Register handler
  const doRegister = async () => {
    try {
      const registration = await updateService.register();

      if (registration) {
        // Check if already activated (offline ready)
        if (registration.active && !navigator.serviceWorker.controller) {
          // First visit, SW just activated
          onOfflineReady?.();
        } else if (registration.active && navigator.serviceWorker.controller) {
          // Already had SW, still offline ready
          onOfflineReady?.();
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('[SW Registration] Failed:', err);
      onError?.(err);
    }
  };

  // Register immediately or wait for load
  if (immediate) {
    await doRegister();
  } else if (document.readyState === 'complete') {
      await doRegister();
    } else {
      window.addEventListener('load', doRegister);
    }

  return createResult();
}

/**
 * Create the result object with control functions
 */
function createResult(): RegisterSWResult {
  return {
    checkForUpdates: () => updateService.checkForUpdates(),
    applyUpdate: () => updateService.applyUpdate(),
    getStatus: () => updateService.getStatus(),
    hasUpdate: () => updateService.hasUpdateReady(),
    unregister: () => updateService.unregister(),
    clearCaches: () => updateService.clearCaches(),
  };
}

/**
 * Create a no-op result for browsers without SW support
 */
function createNoopResult(): RegisterSWResult {
  return {
    checkForUpdates: async () => false,
    applyUpdate: () => {},
    getStatus: () => 'idle',
    hasUpdate: () => false,
    unregister: async () => false,
    clearCaches: async () => {},
  };
}

/**
 * Simple registration for basic use cases
 * Just registers SW and logs update status
 */
export async function registerSWSimple(): Promise<void> {
  await registerSW({
    onUpdate: (info) => {
      if (info.status === 'ready') {
        console.log('[BitChat] Update available. Refresh to update.');
      }
    },
    onOfflineReady: () => {
      console.log('[BitChat] App ready to work offline.');
    },
    onError: (error) => {
      console.error('[BitChat] Service worker error:', error);
    },
  });
}

/**
 * Wait for service worker to be ready
 * Useful for ensuring SW is available before app initialization
 */
export async function waitForSWReady(): Promise<ServiceWorkerRegistration | undefined> {
  if (!UpdateService.isSupported()) {
    return undefined;
  }

  return navigator.serviceWorker.ready;
}

/**
 * Send a message to the service worker
 */
export function sendMessageToSW(message: unknown): void {
  if (!UpdateService.isSupported()) {
    return;
  }

  navigator.serviceWorker.controller?.postMessage(message);
}

/**
 * Request background sync
 * Used for syncing offline messages when back online
 */
export async function requestSync(tag: string = 'sync-messages'): Promise<boolean> {
  if (!UpdateService.isSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if sync is supported
    if ('sync' in registration) {
      // @ts-expect-error - sync API types not always available
      await registration.sync.register(tag);
      console.log('[SW Registration] Background sync registered:', tag);
      return true;
    }

    console.warn('[SW Registration] Background sync not supported');
    return false;
  } catch (error) {
    console.error('[SW Registration] Background sync failed:', error);
    return false;
  }
}

// Re-export types
export type { UpdateInfo, UpdateCallback } from '../services/updates';
