/**
 * Client-Side Rollout Selector
 *
 * Determines if this client should use a feature based on rollout percentage.
 *
 * PRIVACY GUARANTEE: The server NEVER knows which bucket a client is in.
 * The local seed is generated on first run and NEVER transmitted.
 *
 * How it works:
 * 1. On first run, a cryptographically random 32-byte seed is generated
 * 2. This seed is stored locally and NEVER sent to any server
 * 3. For each feature, we hash (seed + featureId) to get a deterministic bucket
 * 4. The bucket (0-9999) determines if the feature is enabled based on percentage
 *
 * This ensures:
 * - Consistent behavior: Same device always gets same bucket for a feature
 * - Different features: Different features can have independent rollouts
 * - Privacy: Server cannot infer bucket from any network traffic
 * - Uniform distribution: Buckets are uniformly distributed across clients
 */

import { loadSodium } from '../crypto';

// Storage key for the local rollout seed
const ROLLOUT_SEED_KEY = 'bitchat_rollout_seed';

// Total number of buckets (0-9999 = 10000 buckets for 0.01% granularity)
const TOTAL_BUCKETS = 10000;

// Cache for synchronous hash results (computed async, cached for sync access)
const hashCache = new Map<string, string>();

/**
 * Get or create the local rollout seed.
 * This seed is generated once and stored in localStorage.
 * It is NEVER transmitted to any server.
 *
 * @returns The local seed as a hex string
 */
export function getOrCreateLocalSeed(): string {
  // Try to get existing seed
  let seed = localStorage.getItem(ROLLOUT_SEED_KEY);

  if (!seed) {
    // Generate a new cryptographically random seed
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    seed = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(ROLLOUT_SEED_KEY, seed);
  }

  return seed;
}

/**
 * Clear the local seed. Used for testing or when user wants to reset rollout buckets.
 */
export function clearLocalSeed(): void {
  localStorage.removeItem(ROLLOUT_SEED_KEY);
  hashCache.clear();
}

/**
 * Set the local seed to a specific value. Used for testing only.
 *
 * @param seed - The seed to set
 */
export function setLocalSeedForTesting(seed: string): void {
  localStorage.setItem(ROLLOUT_SEED_KEY, seed);
  hashCache.clear();
}

/**
 * Compute SHA-256 hash of a string and return as hex.
 * Uses pure JS implementation for consistency across all environments.
 *
 * @param data - String to hash
 * @returns 64-character hex-encoded hash
 */
async function sha256Async(data: string): Promise<string> {
  // Use the same pure JS implementation as sync version for consistency
  return simpleSha256(data);
}

/**
 * Simple synchronous hash function using a basic implementation.
 * This is used for the sync API when Web Crypto is not available synchronously.
 *
 * Note: This uses a simplified approach that's still cryptographically
 * sufficient for bucket assignment (we just need uniform distribution).
 *
 * @param data - String to hash
 * @returns 64-character hex-encoded hash
 */
function sha256Sync(data: string): string {
  // Check cache first
  const cached = hashCache.get(data);
  if (cached) {
    return cached;
  }

  // Use a simple but sufficient hash for bucket assignment
  // This is a JS implementation of SHA-256
  const hash = simpleSha256(data);
  hashCache.set(data, hash);
  return hash;
}

/**
 * Simple SHA-256 implementation in pure JavaScript.
 * Based on the specification but optimized for our use case.
 */
function simpleSha256(message: string): string {
  // SHA-256 constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  // Initial hash values
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  // Convert string to bytes
  const encoder = new TextEncoder();
  const msgBytes = encoder.encode(message);
  const msgLen = msgBytes.length;

  // Pre-processing: adding padding bits
  const bitLen = msgLen * 8;
  const padLen = ((msgLen + 8) % 64 < 56)
    ? 56 - (msgLen + 8) % 64 + 8
    : 120 - (msgLen + 8) % 64 + 8;

  const paddedLen = msgLen + padLen + 8;
  const padded = new Uint8Array(paddedLen);
  padded.set(msgBytes);
  padded[msgLen] = 0x80;

  // Append length in bits as 64-bit big-endian
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 4, bitLen, false);

  // Process each 64-byte chunk
  for (let i = 0; i < paddedLen; i += 64) {
    const w = new Array(64);

    // Copy chunk into first 16 words
    for (let j = 0; j < 16; j++) {
      w[j] = view.getUint32(i + j * 4, false);
    }

    // Extend the first 16 words into the remaining 48 words
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j-15], 7) ^ rotr(w[j-15], 18) ^ (w[j-15] >>> 3);
      const s1 = rotr(w[j-2], 17) ^ rotr(w[j-2], 19) ^ (w[j-2] >>> 10);
      w[j] = (w[j-16] + s0 + w[j-7] + s1) >>> 0;
    }

    // Initialize working variables
    let a = h0, b = h1, c = h2, d = h3;
    let e = h4, f = h5, g = h6, h = h7;

    // Main loop
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    // Add compressed chunk to current hash value
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  // Produce the final hash value (big-endian)
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(n => n.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Right rotate a 32-bit integer.
 */
function rotr(n: number, bits: number): number {
  return ((n >>> bits) | (n << (32 - bits))) >>> 0;
}

/**
 * Get the rollout bucket for a feature (0-9999).
 * Uses first 8 hex chars of hash, interpreted as unsigned 32-bit integer mod 10000.
 *
 * ASYNC VERSION: Uses Web Crypto API if libsodium is not loaded.
 *
 * @param featureId - Unique identifier for the feature
 * @returns Bucket number (0-9999)
 */
export async function getRolloutBucketAsync(featureId: string): Promise<number> {
  const localSeed = getOrCreateLocalSeed();
  const hash = await sha256Async(localSeed + featureId);
  // Take first 8 hex chars (32 bits), parse as unsigned integer, mod 10000
  return parseInt(hash.substring(0, 8), 16) % TOTAL_BUCKETS;
}

/**
 * Get the rollout bucket for a feature (0-9999).
 * Uses first 8 hex chars of hash, interpreted as unsigned 32-bit integer mod 10000.
 *
 * SYNC VERSION: Requires libsodium to be loaded.
 *
 * @param featureId - Unique identifier for the feature
 * @returns Bucket number (0-9999)
 */
export function getRolloutBucket(featureId: string): number {
  const localSeed = getOrCreateLocalSeed();
  const hash = sha256Sync(localSeed + featureId);
  // Take first 8 hex chars (32 bits), parse as unsigned integer, mod 10000
  return parseInt(hash.substring(0, 8), 16) % TOTAL_BUCKETS;
}

/**
 * Determines if this client should use a feature based on rollout percentage.
 *
 * ASYNC VERSION: Uses Web Crypto API if libsodium is not loaded.
 *
 * PRIVACY GUARANTEE: The server NEVER knows which bucket a client is in.
 * The local seed is generated on first run and NEVER transmitted.
 *
 * @param featureId - Unique identifier for the feature
 * @param percentage - Rollout percentage (0-100). E.g., 50 means 50% of clients.
 * @returns True if this client should have the feature enabled
 */
export async function shouldEnableFeatureAsync(
  featureId: string,
  percentage: number
): Promise<boolean> {
  // Handle edge cases
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;

  const bucket = await getRolloutBucketAsync(featureId);
  // percentage * 100 converts to bucket threshold (e.g., 50% -> bucket < 5000)
  return bucket < percentage * 100;
}

/**
 * Determines if this client should use a feature based on rollout percentage.
 *
 * SYNC VERSION: Requires libsodium to be loaded.
 *
 * PRIVACY GUARANTEE: The server NEVER knows which bucket a client is in.
 * The local seed is generated on first run and NEVER transmitted.
 *
 * @param featureId - Unique identifier for the feature
 * @param percentage - Rollout percentage (0-100). E.g., 50 means 50% of clients.
 * @returns True if this client should have the feature enabled
 */
export function shouldEnableFeature(
  featureId: string,
  percentage: number
): boolean {
  // Handle edge cases
  if (percentage <= 0) return false;
  if (percentage >= 100) return true;

  const bucket = getRolloutBucket(featureId);
  // percentage * 100 converts to bucket threshold (e.g., 50% -> bucket < 5000)
  return bucket < percentage * 100;
}

/**
 * Ensure libsodium is loaded for synchronous operations.
 * Call this once at app startup if you want to use synchronous methods.
 */
export async function initializeRolloutService(): Promise<void> {
  await loadSodium();
}

// Export constants for testing
export const ROLLOUT_CONSTANTS = {
  SEED_KEY: ROLLOUT_SEED_KEY,
  TOTAL_BUCKETS,
};
