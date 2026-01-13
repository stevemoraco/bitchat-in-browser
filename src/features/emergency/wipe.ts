/**
 * Emergency Wipe Service
 *
 * Provides thorough data destruction for emergency situations.
 * Clears all storage, unregisters service workers, and reloads the app.
 *
 * Security requirements:
 * - Must be thorough (no recoverable data)
 * - Must be fast (under 2 seconds)
 * - Must work offline
 * - Should show minimal indication during process (covert)
 *
 * @module features/emergency/wipe
 */

import { clearAllStores } from '../../stores';
import { secureWipe } from '../../services/crypto/keys';

// ============================================================================
// Types
// ============================================================================

export interface WipeProgress {
  step: WipeStep;
  progress: number; // 0-100
  message: string;
}

export type WipeStep =
  | 'preparing'
  | 'clearing-memory'
  | 'clearing-indexeddb'
  | 'clearing-localstorage'
  | 'clearing-sessionstorage'
  | 'clearing-opfs'
  | 'clearing-caches'
  | 'unregistering-sw'
  | 'complete';

export type WipeProgressCallback = (progress: WipeProgress) => void;

export interface WipeResult {
  success: boolean;
  duration: number;
  errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

/** Known IndexedDB database names used by BitChat */
const KNOWN_DB_NAMES = [
  'bitchat',
  'bitchat-storage',
  'bitchat-keys',
  'bitchat-messages',
  'workbox-expiration',
];

/** LocalStorage keys used by BitChat */
const KNOWN_LOCALSTORAGE_KEYS = [
  'bitchat-identity',
  'bitchat-settings',
  'bitchat-messages',
  'bitchat-channels',
  'bitchat-peers',
  'bitchat-app',
];

// ============================================================================
// In-Memory Key References
// ============================================================================

/** Registry of sensitive byte arrays that need secure wiping */
const sensitiveArrayRegistry: Set<Uint8Array> = new Set();

/**
 * Register a sensitive byte array for secure wiping during emergency wipe.
 * Call this when loading private keys into memory.
 */
export function registerSensitiveData(data: Uint8Array): void {
  sensitiveArrayRegistry.add(data);
}

/**
 * Unregister a sensitive byte array.
 * Call this when a key is no longer needed.
 */
export function unregisterSensitiveData(data: Uint8Array): void {
  sensitiveArrayRegistry.delete(data);
}

// ============================================================================
// Wipe Functions
// ============================================================================

/**
 * Clear all crypto keys from memory.
 * Uses libsodium's secure memory zeroing.
 */
async function clearMemoryKeys(): Promise<void> {
  // Wipe all registered sensitive data
  for (const data of sensitiveArrayRegistry) {
    try {
      secureWipe(data);
    } catch {
      // Continue even if individual wipe fails
      // Fill with zeros as fallback
      data.fill(0);
    }
  }
  sensitiveArrayRegistry.clear();

  // Force garbage collection hint (not guaranteed but helps)
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
}

/**
 * Delete all IndexedDB databases.
 */
async function clearIndexedDB(): Promise<string[]> {
  const errors: string[] = [];

  // Try to get all databases if the API is available
  const dbNames = new Set<string>(KNOWN_DB_NAMES);

  try {
    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases();
      databases.forEach((db) => {
        if (db.name) {
          dbNames.add(db.name);
        }
      });
    }
  } catch {
    // databases() not supported, use known names only
  }

  // Delete each database
  const deletePromises = Array.from(dbNames).map(async (dbName) => {
    try {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to delete ${dbName}`));
        request.onblocked = () => {
          // Database is blocked, try to force close
          console.warn(`Database ${dbName} blocked during deletion`);
          resolve(); // Continue anyway
        };
      });
    } catch (error) {
      errors.push(`IndexedDB ${dbName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await Promise.all(deletePromises);
  return errors;
}

/**
 * Clear all localStorage data.
 */
function clearLocalStorage(): string[] {
  const errors: string[] = [];

  try {
    // First clear known keys
    for (const key of KNOWN_LOCALSTORAGE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Continue
      }
    }

    // Then clear everything else
    localStorage.clear();
  } catch (error) {
    errors.push(`localStorage: ${error instanceof Error ? error.message : String(error)}`);
  }

  return errors;
}

/**
 * Clear all sessionStorage data.
 */
function clearSessionStorage(): string[] {
  const errors: string[] = [];

  try {
    sessionStorage.clear();
  } catch (error) {
    errors.push(`sessionStorage: ${error instanceof Error ? error.message : String(error)}`);
  }

  return errors;
}

/**
 * Clear all OPFS (Origin Private File System) storage.
 */
async function clearOPFS(): Promise<string[]> {
  const errors: string[] = [];

  try {
    // Check if OPFS is available
    if (typeof navigator === 'undefined' || !navigator.storage?.getDirectory) {
      return errors; // OPFS not available, skip
    }

    const root = await navigator.storage.getDirectory();

    // Get all entries and delete them
    const entries: string[] = [];
    // Use entries() and iterate with for-await
    // @ts-expect-error - values() exists on FileSystemDirectoryHandle but TypeScript doesn't know about it
    for await (const entry of root.values() as AsyncIterable<FileSystemHandle>) {
      entries.push(entry.name);
    }

    // Delete all entries recursively
    for (const name of entries) {
      try {
        await root.removeEntry(name, { recursive: true });
      } catch (error) {
        errors.push(`OPFS ${name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    errors.push(`OPFS: ${error instanceof Error ? error.message : String(error)}`);
  }

  return errors;
}

/**
 * Clear all browser caches.
 */
async function clearCaches(): Promise<string[]> {
  const errors: string[] = [];

  try {
    if (typeof caches === 'undefined') {
      return errors; // Cache API not available
    }

    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(async (cacheName) => {
        try {
          await caches.delete(cacheName);
        } catch (error) {
          errors.push(`Cache ${cacheName}: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );
  } catch (error) {
    errors.push(`Caches: ${error instanceof Error ? error.message : String(error)}`);
  }

  return errors;
}

/**
 * Unregister all service workers.
 */
async function unregisterServiceWorkers(): Promise<string[]> {
  const errors: string[] = [];

  try {
    if (!('serviceWorker' in navigator)) {
      return errors; // Service workers not supported
    }

    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (registration) => {
        try {
          await registration.unregister();
        } catch (error) {
          errors.push(`SW: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );
  } catch (error) {
    errors.push(`Service Worker: ${error instanceof Error ? error.message : String(error)}`);
  }

  return errors;
}

/**
 * Clear Zustand stores (in-memory state).
 */
function clearStores(): string[] {
  const errors: string[] = [];

  try {
    clearAllStores();
  } catch (error) {
    errors.push(`Stores: ${error instanceof Error ? error.message : String(error)}`);
  }

  return errors;
}

// ============================================================================
// Main Wipe Function
// ============================================================================

/**
 * Perform emergency wipe of all data.
 *
 * This function will:
 * 1. Clear all crypto keys from memory
 * 2. Clear all IndexedDB databases
 * 3. Clear localStorage
 * 4. Clear sessionStorage
 * 5. Clear OPFS storage
 * 6. Clear browser caches
 * 7. Unregister service workers
 * 8. Reload the app
 *
 * @param onProgress - Optional callback for progress updates
 * @param reload - Whether to reload the page after wipe (default: true)
 * @returns WipeResult with success status and any errors
 */
export async function performEmergencyWipe(
  onProgress?: WipeProgressCallback,
  reload: boolean = true
): Promise<WipeResult> {
  const startTime = performance.now();
  const allErrors: string[] = [];

  const reportProgress = (step: WipeStep, progress: number, message: string) => {
    onProgress?.({ step, progress, message });
  };

  try {
    // Step 1: Preparing
    reportProgress('preparing', 0, 'Initiating wipe...');

    // Step 2: Clear memory (crypto keys)
    reportProgress('clearing-memory', 10, 'Clearing keys...');
    await clearMemoryKeys();

    // Step 3: Clear Zustand stores
    const storeErrors = clearStores();
    allErrors.push(...storeErrors);

    // Step 4: Clear IndexedDB
    reportProgress('clearing-indexeddb', 25, 'Clearing database...');
    const idbErrors = await clearIndexedDB();
    allErrors.push(...idbErrors);

    // Step 5: Clear localStorage
    reportProgress('clearing-localstorage', 45, 'Clearing local data...');
    const lsErrors = clearLocalStorage();
    allErrors.push(...lsErrors);

    // Step 6: Clear sessionStorage
    reportProgress('clearing-sessionstorage', 55, 'Clearing session...');
    const ssErrors = clearSessionStorage();
    allErrors.push(...ssErrors);

    // Step 7: Clear OPFS
    reportProgress('clearing-opfs', 65, 'Clearing files...');
    const opfsErrors = await clearOPFS();
    allErrors.push(...opfsErrors);

    // Step 8: Clear caches
    reportProgress('clearing-caches', 80, 'Clearing cache...');
    const cacheErrors = await clearCaches();
    allErrors.push(...cacheErrors);

    // Step 9: Unregister service workers
    reportProgress('unregistering-sw', 90, 'Cleanup...');
    const swErrors = await unregisterServiceWorkers();
    allErrors.push(...swErrors);

    // Complete
    reportProgress('complete', 100, 'Complete');

    const duration = performance.now() - startTime;

    const result: WipeResult = {
      success: allErrors.length === 0,
      duration,
      errors: allErrors,
    };

    // Reload if requested
    if (reload) {
      // Small delay to allow UI to update
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    allErrors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);

    return {
      success: false,
      duration,
      errors: allErrors,
    };
  }
}

/**
 * Quick wipe without progress callbacks.
 * Use for immediate emergency situations.
 */
export async function quickWipe(): Promise<void> {
  // Run all wipe operations in parallel for speed
  await Promise.all([
    clearMemoryKeys(),
    clearIndexedDB(),
    clearOPFS(),
    clearCaches(),
    unregisterServiceWorkers(),
  ]);

  // Synchronous operations
  clearStores();
  clearLocalStorage();
  clearSessionStorage();

  // Reload immediately
  window.location.href = '/';
}

/**
 * Silent wipe - no progress, no reload.
 * Use for testing or programmatic cleanup.
 */
export async function silentWipe(): Promise<WipeResult> {
  return performEmergencyWipe(undefined, false);
}
