/**
 * App Bundle Storage Service
 *
 * Stores and retrieves PWA app bundles in IndexedDB for:
 * - P2P app distribution over WebRTC mesh
 * - Service Worker serving from IndexedDB
 * - Offline app updates
 */

// Database configuration
const DB_NAME = 'bitchat-app-bundle';
const DB_VERSION = 1;
const ASSETS_STORE = 'assets';
const META_STORE = 'metadata';

export interface AppAsset {
  path: string;
  content: Uint8Array;
  mimeType: string;
  size: number;
}

export interface AppBundleMetadata {
  version: string;
  hash: string;
  timestamp: number;
  totalSize: number;
  assetCount: number;
  trustedHash?: string; // First hash becomes trusted (trust-on-first-use)
}

export interface AppBundle {
  metadata: AppBundleMetadata;
  assets: AppAsset[];
}

/**
 * Open the IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store for individual assets (keyed by path)
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        db.createObjectStore(ASSETS_STORE, { keyPath: 'path' });
      }

      // Store for bundle metadata
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Store an app bundle in IndexedDB
 */
export async function storeAppBundle(bundle: AppBundle): Promise<void> {
  const db = await openDB();

  // Check trust-on-first-use
  const existingMeta = await getBundleMetadata();
  if (existingMeta?.trustedHash && existingMeta.trustedHash !== bundle.metadata.hash) {
    console.warn('[AppBundleStore] Hash mismatch with trusted bundle!');
    // Still store but mark as untrusted
    bundle.metadata.trustedHash = existingMeta.trustedHash;
  } else if (!existingMeta?.trustedHash) {
    // First bundle - set trusted hash
    bundle.metadata.trustedHash = bundle.metadata.hash;
  }

  const tx = db.transaction([ASSETS_STORE, META_STORE], 'readwrite');
  const assetsStore = tx.objectStore(ASSETS_STORE);
  const metaStore = tx.objectStore(META_STORE);

  // Store each asset
  for (const asset of bundle.assets) {
    assetsStore.put(asset);
  }

  // Store metadata
  metaStore.put({ key: 'current', ...bundle.metadata });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log(`[AppBundleStore] Stored bundle v${bundle.metadata.version} (${bundle.assets.length} assets)`);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get an asset by path (for Service Worker)
 */
export async function getAsset(path: string): Promise<AppAsset | null> {
  const db = await openDB();
  const tx = db.transaction(ASSETS_STORE, 'readonly');
  const store = tx.objectStore(ASSETS_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get(path);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get bundle metadata
 */
export async function getBundleMetadata(): Promise<AppBundleMetadata | null> {
  const db = await openDB();
  const tx = db.transaction(META_STORE, 'readonly');
  const store = tx.objectStore(META_STORE);

  return new Promise((resolve, reject) => {
    const request = store.get('current');
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { key, ...metadata } = result;
        resolve(metadata as AppBundleMetadata);
      } else {
        resolve(null);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all stored assets
 */
export async function getAllAssets(): Promise<AppAsset[]> {
  const db = await openDB();
  const tx = db.transaction(ASSETS_STORE, 'readonly');
  const store = tx.objectStore(ASSETS_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get current bundle version
 */
export async function getCurrentVersion(): Promise<string | null> {
  const meta = await getBundleMetadata();
  return meta?.version || null;
}

/**
 * Check if a newer version is available
 */
export async function isNewerVersion(version: string): Promise<boolean> {
  const currentVersion = await getCurrentVersion();
  if (!currentVersion) return true; // No version stored, any version is newer

  // Simple semver comparison (assumes format: major.minor.patch)
  const current = currentVersion.split('.').map(Number);
  const incoming = version.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if ((incoming[i] || 0) > (current[i] || 0)) return true;
    if ((incoming[i] || 0) < (current[i] || 0)) return false;
  }

  return false; // Same version
}

/**
 * Clear the bundle store
 */
export async function clearBundleStore(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([ASSETS_STORE, META_STORE], 'readwrite');

  tx.objectStore(ASSETS_STORE).clear();
  tx.objectStore(META_STORE).clear();

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      console.log('[AppBundleStore] Cleared bundle store');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Check if bundle is trusted (hash matches first-seen hash)
 */
export async function isBundleTrusted(): Promise<boolean> {
  const meta = await getBundleMetadata();
  if (!meta) return true; // No bundle stored
  return meta.hash === meta.trustedHash;
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  assetCount: number;
  totalSize: number;
  version: string | null;
  trusted: boolean;
}> {
  const meta = await getBundleMetadata();
  const assets = await getAllAssets();

  return {
    assetCount: assets.length,
    totalSize: assets.reduce((sum, a) => sum + a.size, 0),
    version: meta?.version || null,
    trusted: meta ? meta.hash === meta.trustedHash : true,
  };
}

// Export singleton-style functions
export const appBundleStore = {
  store: storeAppBundle,
  getAsset,
  getMetadata: getBundleMetadata,
  getAllAssets,
  getCurrentVersion,
  isNewerVersion,
  clear: clearBundleStore,
  isTrusted: isBundleTrusted,
  getStats: getStorageStats,
};

export default appBundleStore;
