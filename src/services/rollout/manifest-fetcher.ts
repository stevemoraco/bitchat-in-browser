/**
 * Manifest Fetcher for IPFS with Failover
 *
 * Fetches version manifests from IPFS gateways with automatic
 * failover between multiple gateways. Includes caching and
 * timeout handling.
 *
 * @module services/rollout/manifest-fetcher
 */

import {
  type VersionManifest,
  parseManifest,
  verifyManifestSignature,
  selectVersion,
  getOrCreateClientSeed,
  type VersionEntry,
  type VersionSelectionConfig,
} from './version-manifest';

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the manifest fetcher.
 */
export interface ManifestFetcherConfig {
  /** IPFS gateways to try in order */
  gateways?: string[];
  /** Timeout for each gateway request in ms */
  timeoutMs?: number;
  /** Cache TTL in ms */
  cacheTtlMs?: number;
  /** Public key for signature verification (hex) */
  publicKey?: string;
  /** Current app version for version selection */
  currentVersion?: string;
}

/**
 * Result of a manifest fetch operation.
 */
export interface ManifestFetchResult {
  /** Whether fetch succeeded */
  success: boolean;
  /** The fetched manifest (if successful) */
  manifest?: VersionManifest;
  /** Selected version for this client (if successful) */
  selectedVersion?: VersionEntry;
  /** Error message (if failed) */
  error?: string;
  /** Gateway that succeeded */
  gateway?: string;
  /** Whether result came from cache */
  fromCache?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Default IPFS gateways in priority order */
const DEFAULT_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://w3s.link/ipfs/',
];

/** Default timeout per gateway */
const DEFAULT_TIMEOUT_MS = 10000;

/** Default cache TTL */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Storage key for cached manifest */
const CACHE_KEY = 'bitchat-version-manifest-cache';

// ============================================================================
// Cache Management
// ============================================================================

interface CachedManifest {
  manifest: VersionManifest;
  fetchedAt: number;
  gateway: string;
}

/**
 * Get cached manifest if still valid.
 *
 * @param cacheTtlMs - Cache TTL in milliseconds
 * @returns Cached manifest or null
 */
function getCachedManifest(cacheTtlMs: number): CachedManifest | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return null;
    }

    const data = JSON.parse(cached) as CachedManifest;

    // Check if cache is still valid
    if (Date.now() - data.fetchedAt > cacheTtlMs) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Save manifest to cache.
 *
 * @param manifest - Manifest to cache
 * @param gateway - Gateway it was fetched from
 */
function setCachedManifest(manifest: VersionManifest, gateway: string): void {
  try {
    const data: CachedManifest = {
      manifest,
      fetchedAt: Date.now(),
      gateway,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore cache errors
  }
}

/**
 * Clear the manifest cache.
 */
export function clearManifestCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore
  }
}

// ============================================================================
// Fetch Implementation
// ============================================================================

/**
 * Fetch with timeout wrapper.
 *
 * @param url - URL to fetch
 * @param timeoutMs - Timeout in milliseconds
 * @returns Response or throws on timeout
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch manifest from a single gateway.
 *
 * @param gateway - Gateway base URL
 * @param cid - IPFS CID of the manifest
 * @param timeoutMs - Request timeout
 * @returns Manifest or null on failure
 */
async function fetchFromGateway(
  gateway: string,
  cid: string,
  timeoutMs: number
): Promise<VersionManifest | null> {
  const url = `${gateway}${cid}`;

  try {
    const response = await fetchWithTimeout(url, timeoutMs);

    if (!response.ok) {
      console.warn(
        `[ManifestFetcher] Gateway ${gateway} returned ${response.status}`
      );
      return null;
    }

    const json = await response.json();
    return parseManifest(json);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`[ManifestFetcher] Gateway ${gateway} timed out`);
    } else {
      console.warn(`[ManifestFetcher] Gateway ${gateway} failed:`, error);
    }
    return null;
  }
}

/**
 * Fetch version manifest from IPFS with automatic failover.
 *
 * Tries each configured gateway in order until one succeeds.
 * Verifies signature if public key is provided.
 * Returns cached result if available and valid.
 *
 * @param manifestCid - IPFS CID of the version manifest
 * @param config - Fetcher configuration
 * @returns Fetch result with manifest and selected version
 */
export async function fetchManifest(
  manifestCid: string,
  config: ManifestFetcherConfig = {}
): Promise<ManifestFetchResult> {
  const gateways = config.gateways || DEFAULT_GATEWAYS;
  const timeoutMs = config.timeoutMs || DEFAULT_TIMEOUT_MS;
  const cacheTtlMs = config.cacheTtlMs || DEFAULT_CACHE_TTL_MS;

  // Check cache first
  const cached = getCachedManifest(cacheTtlMs);
  if (cached && cached.manifest) {
    // Get client selection config
    const selectionConfig: VersionSelectionConfig = {
      clientSeed: getOrCreateClientSeed(),
      currentVersion: config.currentVersion,
    };

    const selectedVersion = selectVersion(cached.manifest, selectionConfig);

    return {
      success: true,
      manifest: cached.manifest,
      selectedVersion: selectedVersion || undefined,
      gateway: cached.gateway,
      fromCache: true,
    };
  }

  // Try each gateway in order
  let lastError: string | undefined;

  for (const gateway of gateways) {
    const manifest = await fetchFromGateway(gateway, manifestCid, timeoutMs);

    if (manifest) {
      // Verify signature if public key provided
      if (config.publicKey) {
        const isValid = await verifyManifestSignature(
          manifest,
          config.publicKey
        );
        if (!isValid) {
          console.warn(
            `[ManifestFetcher] Invalid signature from gateway ${gateway}`
          );
          lastError = 'Invalid manifest signature';
          continue;
        }
      }

      // Cache the result
      setCachedManifest(manifest, gateway);

      // Select version for this client
      const selectionConfig: VersionSelectionConfig = {
        clientSeed: getOrCreateClientSeed(),
        currentVersion: config.currentVersion,
      };

      const selectedVersion = selectVersion(manifest, selectionConfig);

      return {
        success: true,
        manifest,
        selectedVersion: selectedVersion || undefined,
        gateway,
        fromCache: false,
      };
    }

    lastError = `Gateway ${gateway} failed`;
  }

  // All gateways failed
  return {
    success: false,
    error: lastError || 'All gateways failed',
  };
}

/**
 * Fetch manifest with fallback to current version.
 *
 * If fetch fails, returns a result indicating to use current version.
 * This ensures the app can always make a decision even when offline.
 *
 * @param manifestCid - IPFS CID of the version manifest
 * @param currentVersionCid - CID of current version (fallback)
 * @param config - Fetcher configuration
 * @returns Fetch result, with fallback version if fetch fails
 */
export async function fetchManifestWithFallback(
  manifestCid: string,
  currentVersionCid: string,
  config: ManifestFetcherConfig = {}
): Promise<ManifestFetchResult> {
  const result = await fetchManifest(manifestCid, config);

  if (result.success) {
    return result;
  }

  // Return fallback version
  const fallbackVersion: VersionEntry = {
    cid: currentVersionCid,
    percentage: 100,
    releaseNotes: 'Current version (offline fallback)',
  };

  return {
    success: true,
    manifest: undefined,
    selectedVersion: fallbackVersion,
    error: result.error,
    fromCache: false,
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  type VersionManifest,
  type VersionEntry,
  type VersionSelectionConfig,
};

export default {
  fetchManifest,
  fetchManifestWithFallback,
  clearManifestCache,
};
