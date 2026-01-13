/**
 * Crypto Initialization Module
 *
 * Handles initialization of libsodium-wrappers-sumo for cryptographic operations.
 * Must be called before using any crypto functions.
 */

import sodium from 'libsodium-wrappers-sumo';

/** Ready state for sodium library */
let isReady = false;

/** Initialization promise for deduplication */
let initPromise: Promise<void> | null = null;

/** Error that occurred during initialization */
let initError: Error | null = null;

/**
 * Initialize the libsodium library.
 * This function is idempotent - calling it multiple times will only initialize once.
 *
 * @returns Promise that resolves when sodium is ready
 * @throws Error if WASM loading fails
 */
export async function loadSodium(): Promise<void> {
  // Already initialized
  if (isReady) {
    return;
  }

  // Already failed - throw cached error
  if (initError) {
    throw initError;
  }

  // Initialization in progress - wait for it
  if (initPromise) {
    return initPromise;
  }

  // Start initialization
  initPromise = (async () => {
    try {
      await sodium.ready;
      isReady = true;
    } catch (error) {
      initError =
        error instanceof Error
          ? error
          : new Error(`Failed to load libsodium WASM: ${String(error)}`);
      throw initError;
    }
  })();

  return initPromise;
}

/**
 * Check if sodium is ready for use.
 *
 * @returns True if sodium has been initialized and is ready
 */
export function isSodiumReady(): boolean {
  return isReady;
}

/**
 * Ensure sodium is ready, throwing an error if not.
 * Use this at the start of crypto functions to fail fast.
 *
 * @throws Error if sodium has not been initialized
 */
export function ensureSodiumReady(): void {
  if (!isReady) {
    throw new Error(
      'Sodium not initialized. Call loadSodium() before using crypto functions.'
    );
  }
}

/**
 * Get the sodium library instance.
 * Only use after ensuring sodium is ready.
 *
 * @returns The initialized sodium library
 * @throws Error if sodium has not been initialized
 */
export function getSodium(): typeof sodium {
  ensureSodiumReady();
  return sodium;
}

/**
 * Reset initialization state.
 * Only for testing purposes.
 */
export function _resetForTesting(): void {
  isReady = false;
  initPromise = null;
  initError = null;
}
