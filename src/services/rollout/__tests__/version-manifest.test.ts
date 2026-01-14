/**
 * Version Manifest System Tests
 *
 * Tests for the staged rollout version manifest system.
 * Covers manifest fetching, parsing, signature verification,
 * and version selection.
 *
 * Required tests:
 * 1. Fetch manifest from IPFS
 * 2. Parse manifest correctly
 * 3. Verify valid signature passes
 * 4. Invalid signature rejected
 * 5. Version selection is deterministic
 * 6. Version selection respects percentages
 * 7. Fallback to current version if fetch fails
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import sodium from 'libsodium-wrappers-sumo';
import {
  loadSodium,
  bytesToHex,
} from '../../crypto';
import {
  type VersionManifest,
  type VersionEntry,
  parseManifest,
  verifyManifestSignature,
  selectVersion,
  calculateClientBucket,
  getOrCreateClientSeed,
  compareVersions,
  meetsMinVersion,
} from '../version-manifest';
import {
  fetchManifest,
  fetchManifestWithFallback,
  clearManifestCache,
  type ManifestFetcherConfig,
} from '../manifest-fetcher';

// ============================================================================
// Test Setup
// ============================================================================

describe('Version Manifest System', () => {
  // Initialize sodium before all tests
  beforeAll(async () => {
    await loadSodium();
  });

  // Clear localStorage and caches before each test
  beforeEach(() => {
    localStorage.clear();
    clearManifestCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Test Helpers
  // ============================================================================

  /**
   * Generate an Ed25519 key pair for tests.
   */
  function generateTestKeyPair(): { publicKey: Uint8Array; privateKey: Uint8Array } {
    const keyPair = sodium.crypto_sign_keypair();
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };
  }

  /**
   * Create a valid signed manifest for testing.
   */
  function createSignedManifest(
    versions: VersionEntry[],
    keyPair: { publicKey: Uint8Array; privateKey: Uint8Array }
  ): VersionManifest {
    const timestamp = Date.now();

    // Create the data to sign (as string)
    const dataToSign = JSON.stringify({ versions, timestamp });

    // Convert string to Uint8Array using TextEncoder
    // then copy to a new Uint8Array to ensure libsodium compatibility
    const encoded = new TextEncoder().encode(dataToSign);
    const messageBytes = new Uint8Array(encoded.length);
    messageBytes.set(encoded);

    // Sign directly with sodium
    const signature = sodium.crypto_sign_detached(messageBytes, keyPair.privateKey);

    return {
      versions,
      timestamp,
      signature: bytesToHex(signature),
    };
  }

  /**
   * Create a mock fetch that returns the given manifest.
   */
  function mockFetchSuccess(manifest: VersionManifest): void {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => manifest,
    } as Response);
  }

  /**
   * Create a mock fetch that fails.
   */
  function mockFetchFailure(): void {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
  }

  // ============================================================================
  // Test 1: Fetch manifest from IPFS
  // ============================================================================

  describe('Test 1: Fetch manifest from IPFS', () => {
    it('should fetch manifest from IPFS gateway', async () => {
      const keyPair = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmTestCid1', percentage: 100 },
      ];
      const manifest = createSignedManifest(versions, keyPair);

      mockFetchSuccess(manifest);

      const result = await fetchManifest('QmManifestCid', {
        publicKey: bytesToHex(keyPair.publicKey),
      });

      expect(result.success).toBe(true);
      expect(result.manifest).toBeDefined();
      expect(result.manifest?.versions).toHaveLength(1);
      expect(result.manifest?.versions[0].cid).toBe('QmTestCid1');
    });

    it('should try multiple gateways on failure', async () => {
      const keyPair = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmTestCid1', percentage: 100 },
      ];
      const manifest = createSignedManifest(versions, keyPair);

      // First call fails, second succeeds
      let callCount = 0;
      vi.spyOn(global, 'fetch').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First gateway failed');
        }
        return {
          ok: true,
          json: async () => manifest,
        } as Response;
      });

      const result = await fetchManifest('QmManifestCid', {
        gateways: ['https://gateway1.com/ipfs/', 'https://gateway2.com/ipfs/'],
        publicKey: bytesToHex(keyPair.publicKey),
      });

      expect(result.success).toBe(true);
      expect(callCount).toBe(2);
    });
  });

  // ============================================================================
  // Test 2: Parse manifest correctly
  // ============================================================================

  describe('Test 2: Parse manifest correctly', () => {
    it('should parse valid manifest JSON', () => {
      const manifestData = {
        versions: [
          { cid: 'QmVersion1', percentage: 50 },
          { cid: 'QmVersion2', percentage: 50, minVersion: '1.0.0' },
        ],
        timestamp: Date.now(),
        signature: 'abc123',
      };

      const manifest = parseManifest(manifestData);

      expect(manifest).not.toBeNull();
      expect(manifest?.versions).toHaveLength(2);
      expect(manifest?.versions[0].cid).toBe('QmVersion1');
      expect(manifest?.versions[0].percentage).toBe(50);
      expect(manifest?.versions[1].minVersion).toBe('1.0.0');
    });

    it('should parse manifest with optional fields', () => {
      const manifestData = {
        versions: [
          {
            cid: 'QmVersion1',
            percentage: 100,
            minVersion: '1.0.0',
            features: ['feature1', 'feature2'],
            releaseNotes: 'Bug fixes and improvements',
          },
        ],
        timestamp: Date.now(),
        signature: 'abc123',
      };

      const manifest = parseManifest(manifestData);

      expect(manifest).not.toBeNull();
      expect(manifest?.versions[0].features).toEqual(['feature1', 'feature2']);
      expect(manifest?.versions[0].releaseNotes).toBe('Bug fixes and improvements');
    });

    it('should parse manifest from JSON string', () => {
      const manifestJson = JSON.stringify({
        versions: [{ cid: 'QmVersion1', percentage: 100 }],
        timestamp: Date.now(),
        signature: 'abc123',
      });

      const manifest = parseManifest(manifestJson);

      expect(manifest).not.toBeNull();
      expect(manifest?.versions[0].cid).toBe('QmVersion1');
    });

    it('should reject manifest with missing versions', () => {
      const invalid = {
        timestamp: Date.now(),
        signature: 'abc123',
      };

      const manifest = parseManifest(invalid);
      expect(manifest).toBeNull();
    });

    it('should reject manifest with missing timestamp', () => {
      const invalid = {
        versions: [{ cid: 'QmVersion1', percentage: 100 }],
        signature: 'abc123',
      };

      const manifest = parseManifest(invalid as Record<string, unknown>);
      expect(manifest).toBeNull();
    });

    it('should reject manifest with invalid percentage', () => {
      const manifestData = {
        versions: [
          { cid: 'QmVersion1', percentage: 150 }, // Invalid: > 100
        ],
        timestamp: Date.now(),
        signature: 'abc123',
      };

      const manifest = parseManifest(manifestData);
      // Invalid entries are skipped
      expect(manifest?.versions).toHaveLength(0);
    });
  });

  // ============================================================================
  // Test 3: Verify valid signature passes
  // ============================================================================

  describe('Test 3: Verify valid signature passes', () => {
    it('should verify a correctly signed manifest', async () => {
      const keyPair = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmTestCid', percentage: 100 },
      ];
      const manifest = createSignedManifest(versions, keyPair);

      const isValid = await verifyManifestSignature(
        manifest,
        bytesToHex(keyPair.publicKey)
      );

      expect(isValid).toBe(true);
    });

    it('should verify manifest with multiple versions', async () => {
      const keyPair = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmCid1', percentage: 10 },
        { cid: 'QmCid2', percentage: 30, minVersion: '1.0.0' },
        { cid: 'QmCid3', percentage: 60, features: ['newUI'] },
      ];
      const manifest = createSignedManifest(versions, keyPair);

      const isValid = await verifyManifestSignature(
        manifest,
        bytesToHex(keyPair.publicKey)
      );

      expect(isValid).toBe(true);
    });
  });

  // ============================================================================
  // Test 4: Invalid signature rejected
  // ============================================================================

  describe('Test 4: Invalid signature rejected', () => {
    it('should reject manifest with wrong public key', async () => {
      const keyPair1 = generateTestKeyPair();
      const keyPair2 = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmTestCid', percentage: 100 },
      ];

      // Sign with keyPair1
      const manifest = createSignedManifest(versions, keyPair1);

      // Verify with keyPair2 (should fail)
      const isValid = await verifyManifestSignature(
        manifest,
        bytesToHex(keyPair2.publicKey)
      );

      expect(isValid).toBe(false);
    });

    it('should reject manifest with tampered versions', async () => {
      const keyPair = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmTestCid', percentage: 100 },
      ];
      const manifest = createSignedManifest(versions, keyPair);

      // Tamper with the manifest
      manifest.versions[0].cid = 'QmTamperedCid';

      const isValid = await verifyManifestSignature(
        manifest,
        bytesToHex(keyPair.publicKey)
      );

      expect(isValid).toBe(false);
    });

    it('should reject manifest with tampered timestamp', async () => {
      const keyPair = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmTestCid', percentage: 100 },
      ];
      const manifest = createSignedManifest(versions, keyPair);

      // Tamper with timestamp
      manifest.timestamp = Date.now() + 1000;

      const isValid = await verifyManifestSignature(
        manifest,
        bytesToHex(keyPair.publicKey)
      );

      expect(isValid).toBe(false);
    });

    it('should reject manifest with invalid signature format', async () => {
      const keyPair = generateTestKeyPair();
      const manifest: VersionManifest = {
        versions: [{ cid: 'QmTestCid', percentage: 100 }],
        timestamp: Date.now(),
        signature: 'invalid-not-hex',
      };

      const isValid = await verifyManifestSignature(
        manifest,
        bytesToHex(keyPair.publicKey)
      );

      expect(isValid).toBe(false);
    });

    it('should reject fetch result with invalid signature', async () => {
      const keyPair1 = generateTestKeyPair();
      const keyPair2 = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmTestCid', percentage: 100 },
      ];

      // Sign with keyPair1
      const manifest = createSignedManifest(versions, keyPair1);

      mockFetchSuccess(manifest);

      // Try to verify with keyPair2
      const result = await fetchManifest('QmManifestCid', {
        publicKey: bytesToHex(keyPair2.publicKey),
        gateways: ['https://test.com/ipfs/'],
      });

      // Should fail because signature doesn't match
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid manifest signature');
    });
  });

  // ============================================================================
  // Test 5: Version selection is deterministic
  // ============================================================================

  describe('Test 5: Version selection is deterministic', () => {
    it('should return same version for same client seed', () => {
      const manifest: VersionManifest = {
        versions: [
          { cid: 'QmVersion1', percentage: 50 },
          { cid: 'QmVersion2', percentage: 50 },
        ],
        timestamp: Date.now(),
        signature: 'test',
      };

      const clientSeed = 'abcdef0123456789abcdef0123456789';

      // Select multiple times with same seed
      const result1 = selectVersion(manifest, { clientSeed });
      const result2 = selectVersion(manifest, { clientSeed });
      const result3 = selectVersion(manifest, { clientSeed });

      expect(result1?.cid).toBe(result2?.cid);
      expect(result2?.cid).toBe(result3?.cid);
    });

    it('should calculate same bucket for same seed', () => {
      const seed = 'deadbeef12345678deadbeef12345678';

      const bucket1 = calculateClientBucket(seed);
      const bucket2 = calculateClientBucket(seed);
      const bucket3 = calculateClientBucket(seed);

      expect(bucket1).toBe(bucket2);
      expect(bucket2).toBe(bucket3);
      expect(bucket1).toBeGreaterThanOrEqual(0);
      expect(bucket1).toBeLessThan(100);
    });

    it('should persist client seed across calls', () => {
      const seed1 = getOrCreateClientSeed();
      const seed2 = getOrCreateClientSeed();
      const seed3 = getOrCreateClientSeed();

      expect(seed1).toBe(seed2);
      expect(seed2).toBe(seed3);
    });

    it('should produce different buckets for different seeds', () => {
      const buckets = new Set<number>();

      // Test many different seeds
      for (let i = 0; i < 100; i++) {
        const seed = i.toString(16).padStart(32, '0');
        const bucket = calculateClientBucket(seed);
        buckets.add(bucket);
      }

      // With 100 random seeds, we should see multiple different buckets
      expect(buckets.size).toBeGreaterThan(10);
    });
  });

  // ============================================================================
  // Test 6: Version selection respects percentages
  // ============================================================================

  describe('Test 6: Version selection respects percentages', () => {
    it('should select 100% version for all clients', () => {
      const manifest: VersionManifest = {
        versions: [{ cid: 'QmVersion100', percentage: 100 }],
        timestamp: Date.now(),
        signature: 'test',
      };

      // Try many different seeds - all should get same version
      for (let i = 0; i < 50; i++) {
        const seed = i.toString(16).padStart(32, '0');
        const result = selectVersion(manifest, { clientSeed: seed });
        expect(result?.cid).toBe('QmVersion100');
      }
    });

    it('should distribute clients across versions by percentage', () => {
      const manifest: VersionManifest = {
        versions: [
          { cid: 'QmVersion10', percentage: 10 },
          { cid: 'QmVersion90', percentage: 90 },
        ],
        timestamp: Date.now(),
        signature: 'test',
      };

      const counts: Record<string, number> = {
        QmVersion10: 0,
        QmVersion90: 0,
      };

      // Test with many seeds to see distribution
      for (let i = 0; i < 1000; i++) {
        // Generate a pseudo-random seed
        const seed = (i * 7 + 13).toString(16).padStart(32, '0');
        const result = selectVersion(manifest, { clientSeed: seed });
        if (result) {
          counts[result.cid]++;
        }
      }

      // 90% version should have roughly 9x more selections than 10%
      // Allow for statistical variance
      expect(counts.QmVersion90).toBeGreaterThan(counts.QmVersion10 * 3);
    });

    it('should respect minVersion constraint', () => {
      const manifest: VersionManifest = {
        versions: [
          { cid: 'QmOldVersion', percentage: 100 },
          { cid: 'QmNewVersion', percentage: 100, minVersion: '2.0.0' },
        ],
        timestamp: Date.now(),
        signature: 'test',
      };

      // Client on version 1.0.0 can only get old version
      const result1 = selectVersion(manifest, {
        clientSeed: 'abcd12345678901234567890123456',
        currentVersion: '1.0.0',
      });
      expect(result1?.cid).toBe('QmOldVersion');

      // Client on version 2.0.0 should get new version (higher percentage preferred)
      const result2 = selectVersion(manifest, {
        clientSeed: 'abcd12345678901234567890123456',
        currentVersion: '2.0.0',
      });
      // Both are eligible, selection depends on bucket
      expect(['QmOldVersion', 'QmNewVersion']).toContain(result2?.cid);
    });

    it('should return null for empty manifest', () => {
      const manifest: VersionManifest = {
        versions: [],
        timestamp: Date.now(),
        signature: 'test',
      };

      const result = selectVersion(manifest, {
        clientSeed: 'abcd12345678901234567890123456',
      });

      expect(result).toBeNull();
    });

    it('should compare versions correctly', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
      expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareVersions('1.1.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareVersions('1.0.1', '1.0.0')).toBeGreaterThan(0);
      expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
    });

    it('should check minVersion correctly', () => {
      expect(meetsMinVersion('1.0.0', undefined)).toBe(true);
      expect(meetsMinVersion('1.0.0', '1.0.0')).toBe(true);
      expect(meetsMinVersion('2.0.0', '1.0.0')).toBe(true);
      expect(meetsMinVersion('1.0.0', '2.0.0')).toBe(false);
    });
  });

  // ============================================================================
  // Test 7: Fallback to current version if fetch fails
  // ============================================================================

  describe('Test 7: Fallback to current version if fetch fails', () => {
    it('should return fallback version when all gateways fail', async () => {
      mockFetchFailure();

      const result = await fetchManifestWithFallback(
        'QmManifestCid',
        'QmCurrentVersionCid',
        {
          gateways: ['https://gateway1.com/ipfs/', 'https://gateway2.com/ipfs/'],
        }
      );

      expect(result.success).toBe(true);
      expect(result.selectedVersion?.cid).toBe('QmCurrentVersionCid');
      expect(result.selectedVersion?.percentage).toBe(100);
      expect(result.error).toBeDefined(); // Original error is preserved
    });

    it('should return fallback when fetch times out', async () => {
      // Mock fetch that never resolves (simulating timeout)
      vi.spyOn(global, 'fetch').mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await fetchManifestWithFallback(
        'QmManifestCid',
        'QmFallbackCid',
        {
          gateways: ['https://test.com/ipfs/'],
          timeoutMs: 50, // Short timeout
        }
      );

      expect(result.success).toBe(true);
      expect(result.selectedVersion?.cid).toBe('QmFallbackCid');
    });

    it('should use cache when available', async () => {
      const keyPair = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmCachedVersion', percentage: 100 },
      ];
      const manifest = createSignedManifest(versions, keyPair);

      // First fetch populates cache
      mockFetchSuccess(manifest);

      const config: ManifestFetcherConfig = {
        publicKey: bytesToHex(keyPair.publicKey),
        gateways: ['https://test.com/ipfs/'],
      };

      await fetchManifest('QmManifestCid', config);

      // Now make fetch fail
      mockFetchFailure();

      // Second fetch should use cache
      const result = await fetchManifest('QmManifestCid', config);

      expect(result.success).toBe(true);
      expect(result.fromCache).toBe(true);
      expect(result.manifest?.versions[0].cid).toBe('QmCachedVersion');
    });

    it('should not use expired cache', async () => {
      // This test verifies cache expiration behavior
      const keyPair = generateTestKeyPair();
      const versions: VersionEntry[] = [
        { cid: 'QmCachedVersion', percentage: 100 },
      ];
      const manifest = createSignedManifest(versions, keyPair);

      mockFetchSuccess(manifest);

      // Fetch with very short cache TTL
      const config: ManifestFetcherConfig = {
        publicKey: bytesToHex(keyPair.publicKey),
        gateways: ['https://test.com/ipfs/'],
        cacheTtlMs: 1, // 1ms TTL
      };

      await fetchManifest('QmManifestCid', config);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Clear the mock and make it fail
      vi.restoreAllMocks();
      mockFetchFailure();

      // Should try to fetch again since cache expired
      const result = await fetchManifest('QmManifestCid', {
        ...config,
        gateways: ['https://failing.com/ipfs/'],
      });

      // Fetch failed and cache expired, so this should fail
      expect(result.success).toBe(false);
    });

    it('should include error details in fallback result', async () => {
      mockFetchFailure();

      const result = await fetchManifestWithFallback(
        'QmManifestCid',
        'QmFallbackCid',
        {
          gateways: ['https://test.com/ipfs/'],
        }
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeDefined();
      expect(result.selectedVersion?.releaseNotes).toContain('fallback');
    });
  });

  // ============================================================================
  // Additional Edge Cases
  // ============================================================================

  describe('Edge cases', () => {
    it('should handle manifest with 0% version', () => {
      const manifest: VersionManifest = {
        versions: [
          { cid: 'QmVersion0', percentage: 0 },
          { cid: 'QmVersion100', percentage: 100 },
        ],
        timestamp: Date.now(),
        signature: 'test',
      };

      // No one should get the 0% version
      for (let i = 0; i < 50; i++) {
        const seed = i.toString(16).padStart(32, '0');
        const result = selectVersion(manifest, { clientSeed: seed });
        expect(result?.cid).toBe('QmVersion100');
      }
    });

    it('should handle manifest with only ineligible versions', () => {
      const manifest: VersionManifest = {
        versions: [
          { cid: 'QmVersion', percentage: 100, minVersion: '99.0.0' },
        ],
        timestamp: Date.now(),
        signature: 'test',
      };

      const result = selectVersion(manifest, {
        clientSeed: 'abcd12345678901234567890123456',
        currentVersion: '1.0.0',
      });

      expect(result).toBeNull();
    });

    it('should handle malformed JSON in parseManifest', () => {
      const result = parseManifest('not valid json {{{');
      expect(result).toBeNull();
    });
  });
});
