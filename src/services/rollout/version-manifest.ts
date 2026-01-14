/**
 * Version Manifest System for Staged Rollouts
 *
 * Handles version manifests with Ed25519 signatures for secure,
 * privacy-preserving staged rollouts. The server never knows
 * the client version - all selection is done locally using
 * a deterministic client seed.
 *
 * @module services/rollout/version-manifest
 */

import {
  loadSodium,
  isSodiumReady,
  verify,
  hexToBytes,
  sha256,
  bytesToHex,
} from '../crypto';

// ============================================================================
// Types
// ============================================================================

/**
 * Version manifest containing all available versions for staged rollout.
 * Fetched from IPFS and verified via Ed25519 signature.
 */
export interface VersionManifest {
  /** Available versions in this manifest */
  versions: VersionEntry[];
  /** Unix timestamp when manifest was created (milliseconds) */
  timestamp: number;
  /** Ed25519 signature over versions + timestamp (hex-encoded) */
  signature: string;
}

/**
 * A single version entry in the manifest.
 */
export interface VersionEntry {
  /** IPFS CID for this version */
  cid: string;
  /** Rollout percentage (0-100) */
  percentage: number;
  /** Minimum required version to update from (semver) */
  minVersion?: string;
  /** Feature flags enabled in this version */
  features?: string[];
  /** Human-readable release notes */
  releaseNotes?: string;
}

/**
 * Configuration for version selection.
 */
export interface VersionSelectionConfig {
  /** Local client seed for deterministic selection (hex string) */
  clientSeed: string;
  /** Current version for minVersion check (semver) */
  currentVersion?: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Storage key for client rollout seed */
const CLIENT_SEED_KEY = 'bitchat-rollout-seed';

/** Length of client seed in bytes */
const SEED_LENGTH = 16;

// ============================================================================
// Client Seed Management
// ============================================================================

/**
 * Get or create the client's rollout seed.
 * This seed is persistent and deterministically maps the client
 * to a rollout bucket (0-99).
 *
 * @returns Hex-encoded 16-byte seed
 */
export function getOrCreateClientSeed(): string {
  // Try to load existing seed
  try {
    const existingSeed = localStorage.getItem(CLIENT_SEED_KEY);
    if (existingSeed && existingSeed.length === SEED_LENGTH * 2) {
      // Validate it's valid hex
      if (/^[0-9a-f]+$/i.test(existingSeed)) {
        return existingSeed.toLowerCase();
      }
    }
  } catch {
    // localStorage might be unavailable
  }

  // Generate new seed
  const seedBytes = new Uint8Array(SEED_LENGTH);
  crypto.getRandomValues(seedBytes);
  const seed = bytesToHex(seedBytes);

  // Persist
  try {
    localStorage.setItem(CLIENT_SEED_KEY, seed);
  } catch {
    // Continue without persistence
  }

  return seed;
}

/**
 * Calculate the client's rollout bucket (0-99) from their seed.
 * This is deterministic - same seed always maps to same bucket.
 *
 * @param clientSeed - Hex-encoded client seed
 * @returns Bucket number 0-99
 */
export function calculateClientBucket(clientSeed: string): number {
  // Hash the seed to ensure uniform distribution
  const seedBytes = hexToBytes(clientSeed);
  const hash = sha256(seedBytes);

  // Use first 4 bytes as a 32-bit number, mod 100
  const value =
    (hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3];
  // Make unsigned and mod 100
  return Math.abs(value) % 100;
}

// ============================================================================
// Manifest Verification
// ============================================================================

/**
 * Verify the Ed25519 signature on a version manifest.
 *
 * @param manifest - The manifest to verify
 * @param publicKeyHex - Hex-encoded Ed25519 public key (32 bytes = 64 hex chars)
 * @returns True if signature is valid
 */
export async function verifyManifestSignature(
  manifest: VersionManifest,
  publicKeyHex: string
): Promise<boolean> {
  // Ensure sodium is loaded
  if (!isSodiumReady()) {
    await loadSodium();
  }

  try {
    // Reconstruct the signed data: versions JSON + timestamp
    const dataToVerify = JSON.stringify({
      versions: manifest.versions,
      timestamp: manifest.timestamp,
    });

    // Convert to bytes (copy to ensure proper Uint8Array for libsodium)
    const encoded = new TextEncoder().encode(dataToVerify);
    const messageBytes = new Uint8Array(encoded.length);
    messageBytes.set(encoded);

    // Decode signature and public key from hex
    const signatureBytes = hexToBytes(manifest.signature);
    const publicKeyBytes = hexToBytes(publicKeyHex);

    // Verify
    return verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('[VersionManifest] Signature verification error:', error);
    return false;
  }
}

// ============================================================================
// Version Selection
// ============================================================================

/**
 * Parse a semver version string into components.
 *
 * @param version - Semver string (e.g., "1.2.3")
 * @returns Array of version numbers [major, minor, patch]
 */
function parseVersion(version: string): number[] {
  return version.split('.').map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/**
 * Compare two semver version strings.
 *
 * @param v1 - First version
 * @param v2 - Second version
 * @returns Negative if v1 < v2, positive if v1 > v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = parseVersion(v1);
  const parts2 = parseVersion(v2);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) {
      return p1 - p2;
    }
  }

  return 0;
}

/**
 * Check if current version meets the minimum version requirement.
 *
 * @param currentVersion - Current version
 * @param minVersion - Minimum required version
 * @returns True if currentVersion >= minVersion
 */
export function meetsMinVersion(
  currentVersion: string,
  minVersion?: string
): boolean {
  if (!minVersion) {
    return true; // No minimum requirement
  }
  return compareVersions(currentVersion, minVersion) >= 0;
}

/**
 * Select a version from the manifest based on client seed and current version.
 *
 * The selection algorithm:
 * 1. Sort versions by percentage (highest first for accumulation)
 * 2. Calculate client's bucket from their seed
 * 3. Filter versions client is eligible for (meets minVersion)
 * 4. Walk through accumulated percentages to find matching version
 *
 * @param manifest - Version manifest with entries
 * @param config - Selection configuration
 * @returns The selected version entry, or null if no eligible version
 */
export function selectVersion(
  manifest: VersionManifest,
  config: VersionSelectionConfig
): VersionEntry | null {
  if (!manifest.versions || manifest.versions.length === 0) {
    return null;
  }

  // Calculate client's bucket (0-99)
  const bucket = calculateClientBucket(config.clientSeed);

  // Filter versions the client is eligible for based on minVersion
  const eligibleVersions = manifest.versions.filter((v) =>
    meetsMinVersion(config.currentVersion || '0.0.0', v.minVersion)
  );

  if (eligibleVersions.length === 0) {
    return null;
  }

  // Sort by percentage descending (highest rollout first)
  const sortedVersions = [...eligibleVersions].sort(
    (a, b) => b.percentage - a.percentage
  );

  // Walk through accumulated percentages
  let accumulated = 0;
  for (const version of sortedVersions) {
    accumulated += version.percentage;
    if (bucket < accumulated) {
      return version;
    }
  }

  // If we get here, client falls outside all rollout percentages
  // Return the version with highest percentage as fallback
  return sortedVersions[0];
}

// ============================================================================
// Manifest Parsing
// ============================================================================

/**
 * Parse and validate a manifest from JSON.
 *
 * @param json - Raw JSON string or object
 * @returns Parsed manifest or null if invalid
 */
export function parseManifest(
  json: string | Record<string, unknown>
): VersionManifest | null {
  try {
    const data =
      typeof json === 'string'
        ? (JSON.parse(json) as Record<string, unknown>)
        : json;

    // Validate required fields
    if (!Array.isArray(data.versions)) {
      console.error('[VersionManifest] Missing or invalid versions array');
      return null;
    }

    if (typeof data.timestamp !== 'number') {
      console.error('[VersionManifest] Missing or invalid timestamp');
      return null;
    }

    if (typeof data.signature !== 'string') {
      console.error('[VersionManifest] Missing or invalid signature');
      return null;
    }

    // Validate version entries
    const versions: VersionEntry[] = [];
    for (const entry of data.versions) {
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }

      const versionEntry = entry as Record<string, unknown>;

      if (typeof versionEntry.cid !== 'string') {
        console.warn('[VersionManifest] Version entry missing cid');
        continue;
      }

      if (
        typeof versionEntry.percentage !== 'number' ||
        versionEntry.percentage < 0 ||
        versionEntry.percentage > 100
      ) {
        console.warn('[VersionManifest] Version entry invalid percentage');
        continue;
      }

      versions.push({
        cid: versionEntry.cid,
        percentage: versionEntry.percentage,
        minVersion:
          typeof versionEntry.minVersion === 'string'
            ? versionEntry.minVersion
            : undefined,
        features: Array.isArray(versionEntry.features)
          ? versionEntry.features.filter(
              (f): f is string => typeof f === 'string'
            )
          : undefined,
        releaseNotes:
          typeof versionEntry.releaseNotes === 'string'
            ? versionEntry.releaseNotes
            : undefined,
      });
    }

    return {
      versions,
      timestamp: data.timestamp,
      signature: data.signature,
    };
  } catch (error) {
    console.error('[VersionManifest] Parse error:', error);
    return null;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  getOrCreateClientSeed,
  calculateClientBucket,
  verifyManifestSignature,
  selectVersion,
  parseManifest,
  compareVersions,
  meetsMinVersion,
};
