/**
 * Geohash Encoding/Decoding for iOS/Android Compatibility
 *
 * This module provides geohash encoding and decoding functions that match
 * the iOS and Android BitChat implementations exactly.
 *
 * Geohash Specification:
 * - Base32 alphabet: 0123456789bcdefghjkmnpqrstuvwxyz
 *   - Note: NO 'a', 'i', 'l', 'o' (to avoid confusion with digits)
 * - Precision: 8 characters = ~19m x 18m cell (building level)
 * - Bit interleaving: alternates longitude/latitude bits (lon first)
 *
 * Reference: ../bitchat/bitchat/Protocols/Geohash.swift
 * @module compat/geohash
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Base32 character set for geohash encoding.
 * Characters 'a', 'i', 'l', 'o' are excluded to avoid confusion with digits.
 */
const BASE32_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Lookup table for O(1) character to value conversion
 */
const BASE32_DECODE: Map<string, number> = new Map(
  BASE32_CHARS.split('').map((char, index) => [char, index])
);

/**
 * Neighbor encoding lookup tables for efficient neighbor calculation
 * Maps the last character to its replacement for each direction/parity
 */
const NEIGHBOR_ENCODE: Record<string, Record<string, string>> = {
  n: {
    even: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy',
    odd: 'bc01fg45238967deuvhjyznpkmstqrwx',
  },
  s: {
    even: '14365h7k9dcfesgujnmqp0r2twvyx8zb',
    odd: '238967debc01fg45kmstqrwxuvhjyznp',
  },
  e: {
    even: 'bc01fg45238967deuvhjyznpkmstqrwx',
    odd: 'p0r21436x8zb9dcf5h7kjnmqesgutwvy',
  },
  w: {
    even: '238967debc01fg45kmstqrwxuvhjyznp',
    odd: '14365h7k9dcfesgujnmqp0r2twvyx8zb',
  },
};

/**
 * Border characters for determining when to adjust parent
 * These indicate when a geohash cell is on the edge of its parent cell
 */
const BORDER_CHARS: Record<string, Record<string, string>> = {
  n: { even: 'prxz', odd: 'bcfguvyz' },
  s: { even: '028b', odd: '0145hjnp' },
  e: { even: 'bcfguvyz', odd: 'prxz' },
  w: { even: '0145hjnp', odd: '028b' },
};

/**
 * Default precision for BitChat (building level, ~38m x 19m)
 */
export const DEFAULT_PRECISION = 8;

// ============================================================================
// Types
// ============================================================================

/**
 * Decoded geohash center point
 */
export interface GeohashCenter {
  lat: number;
  lon: number;
}

/**
 * Bounding box for a geohash cell
 */
export interface GeohashBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Encode latitude/longitude coordinates to a geohash string.
 *
 * The algorithm interleaves longitude and latitude bits, starting with longitude.
 * Each character represents 5 bits of precision.
 *
 * @param lat - Latitude in degrees (-90 to 90)
 * @param lon - Longitude in degrees (-180 to 180)
 * @param precision - Number of characters in output (1-12), defaults to 8
 * @returns Geohash string of specified precision
 *
 * @example
 * ```typescript
 * encode(37.7749, -122.4194, 8); // "9q8yyk8y" (San Francisco)
 * encode(40.7128, -74.0060, 8);  // "dr5regw3" (New York)
 * encode(0, 0, 8);               // "s0000000" (Origin)
 * ```
 */
export function encode(lat: number, lon: number, precision: number = DEFAULT_PRECISION): string {
  if (precision <= 0) {
    return '';
  }

  // Clamp coordinates to valid ranges
  const clampedLat = Math.max(-90.0, Math.min(90.0, lat));
  const clampedLon = Math.max(-180.0, Math.min(180.0, lon));

  // Initialize intervals
  const latInterval: [number, number] = [-90.0, 90.0];
  const lonInterval: [number, number] = [-180.0, 180.0];

  let geohash = '';
  let bit = 0;
  let ch = 0;
  let isLon = true; // Start with longitude (even bits)

  while (geohash.length < precision) {
    if (isLon) {
      // Process longitude bit
      const mid = (lonInterval[0] + lonInterval[1]) / 2;
      if (clampedLon >= mid) {
        ch |= 1 << (4 - bit);
        lonInterval[0] = mid;
      } else {
        lonInterval[1] = mid;
      }
    } else {
      // Process latitude bit
      const mid = (latInterval[0] + latInterval[1]) / 2;
      if (clampedLat >= mid) {
        ch |= 1 << (4 - bit);
        latInterval[0] = mid;
      } else {
        latInterval[1] = mid;
      }
    }

    isLon = !isLon;

    if (bit < 4) {
      bit += 1;
    } else {
      // We have 5 bits, emit a character
      geohash += BASE32_CHARS[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Decode a geohash string to its center point coordinates.
 *
 * @param geohash - Geohash string to decode
 * @returns Center point coordinates { lat, lon }
 * @throws Error if geohash is empty or contains invalid characters
 *
 * @example
 * ```typescript
 * decode("9q8yyk8y"); // { lat: 37.7749..., lon: -122.4194... }
 * decode("s0000000"); // { lat: 0, lon: 0 } (approximately)
 * ```
 */
export function decode(geohash: string): GeohashCenter {
  const bounds = decodeBounds(geohash);
  return {
    lat: (bounds.minLat + bounds.maxLat) / 2,
    lon: (bounds.minLon + bounds.maxLon) / 2,
  };
}

/**
 * Decode a geohash string to its bounding box.
 *
 * @param geohash - Geohash string to decode
 * @returns Bounding box { minLat, maxLat, minLon, maxLon }
 * @throws Error if geohash is empty or contains invalid characters
 *
 * @example
 * ```typescript
 * decodeBounds("9q8yyk8y");
 * // { minLat: 37.774..., maxLat: 37.775..., minLon: -122.420..., maxLon: -122.419... }
 * ```
 */
export function decodeBounds(geohash: string): GeohashBounds {
  if (!geohash || geohash.length === 0) {
    throw new Error('Geohash cannot be empty');
  }

  const normalizedHash = geohash.toLowerCase();

  // Initialize intervals
  const latInterval: [number, number] = [-90.0, 90.0];
  const lonInterval: [number, number] = [-180.0, 180.0];

  let isLon = true; // Start with longitude

  for (const char of normalizedHash) {
    const charValue = BASE32_DECODE.get(char);
    if (charValue === undefined) {
      throw new Error(`Invalid geohash character: '${char}'`);
    }

    // Process each of the 5 bits in this character
    for (const mask of [16, 8, 4, 2, 1]) {
      if (isLon) {
        const mid = (lonInterval[0] + lonInterval[1]) / 2;
        if ((charValue & mask) !== 0) {
          lonInterval[0] = mid;
        } else {
          lonInterval[1] = mid;
        }
      } else {
        const mid = (latInterval[0] + latInterval[1]) / 2;
        if ((charValue & mask) !== 0) {
          latInterval[0] = mid;
        } else {
          latInterval[1] = mid;
        }
      }
      isLon = !isLon;
    }
  }

  return {
    minLat: latInterval[0],
    maxLat: latInterval[1],
    minLon: lonInterval[0],
    maxLon: lonInterval[1],
  };
}

/**
 * Calculate the adjacent geohash in a cardinal direction.
 *
 * @param geohash - Original geohash
 * @param direction - Cardinal direction ('n', 's', 'e', 'w')
 * @returns Adjacent geohash in that direction
 * @throws Error if geohash is empty
 *
 * @example
 * ```typescript
 * getNeighborCardinal("dr5regw7", "n"); // Geohash to the north
 * ```
 */
function getNeighborCardinal(geohash: string, direction: 'n' | 's' | 'e' | 'w'): string {
  if (!geohash || geohash.length === 0) {
    throw new Error('Geohash cannot be empty');
  }

  const normalizedHash = geohash.toLowerCase();
  const lastChar = normalizedHash.charAt(normalizedHash.length - 1);
  const parent = normalizedHash.substring(0, normalizedHash.length - 1);
  const parity: 'even' | 'odd' = normalizedHash.length % 2 === 0 ? 'even' : 'odd';

  const borderChars = BORDER_CHARS[direction][parity];
  const neighborChars = NEIGHBOR_ENCODE[direction][parity];

  // If on border, need to get neighbor of parent first
  if (borderChars.indexOf(lastChar) !== -1 && parent.length > 0) {
    const parentNeighbor = getNeighborCardinal(parent, direction);
    const neighborIndex = neighborChars.indexOf(lastChar);
    return parentNeighbor + BASE32_CHARS[neighborIndex];
  }

  const neighborIndex = neighborChars.indexOf(lastChar);
  return parent + BASE32_CHARS[neighborIndex];
}

/**
 * Get all 8 neighboring geohashes in order: N, NE, E, SE, S, SW, W, NW.
 *
 * This matches the iOS/Android BitChat neighbor order exactly.
 *
 * @param geohash - Center geohash
 * @returns Array of 8 neighboring geohashes
 * @throws Error if geohash is empty
 *
 * @example
 * ```typescript
 * neighbors("dr5regw7");
 * // Returns [N, NE, E, SE, S, SW, W, NW] neighbors
 * ```
 */
export function neighbors(geohash: string): string[] {
  if (!geohash || geohash.length === 0) {
    return [];
  }

  const n = getNeighborCardinal(geohash, 'n');
  const s = getNeighborCardinal(geohash, 's');
  const e = getNeighborCardinal(geohash, 'e');
  const w = getNeighborCardinal(geohash, 'w');

  // Calculate diagonal neighbors by combining cardinal directions
  const ne = getNeighborCardinal(n, 'e');
  const nw = getNeighborCardinal(n, 'w');
  const se = getNeighborCardinal(s, 'e');
  const sw = getNeighborCardinal(s, 'w');

  // Return in order: N, NE, E, SE, S, SW, W, NW
  return [n, ne, e, se, s, sw, w, nw];
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a geohash string.
 *
 * @param geohash - String to validate
 * @returns true if valid geohash
 *
 * @example
 * ```typescript
 * isValidGeohash("dr5regw7"); // true
 * isValidGeohash("dr5rega7"); // false ('a' not in base32)
 * isValidGeohash("");         // false (empty)
 * ```
 */
export function isValidGeohash(geohash: string): boolean {
  if (!geohash || typeof geohash !== 'string' || geohash.length === 0) {
    return false;
  }

  const normalized = geohash.toLowerCase();

  for (const char of normalized) {
    if (!BASE32_DECODE.has(char)) {
      return false;
    }
  }

  return normalized.length <= 12;
}

/**
 * Validate a building-level geohash (exactly 8 characters).
 *
 * BitChat uses 8-character precision for location channels.
 *
 * @param geohash - String to validate
 * @returns true if valid 8-character geohash
 *
 * @example
 * ```typescript
 * isValidBuildingGeohash("dr5regw7"); // true
 * isValidBuildingGeohash("dr5reg");   // false (wrong length)
 * ```
 */
export function isValidBuildingGeohash(geohash: string): boolean {
  if (!geohash || geohash.length !== 8) {
    return false;
  }
  return geohash
    .toLowerCase()
    .split('')
    .every((char) => BASE32_DECODE.has(char));
}

// ============================================================================
// Precision Utilities
// ============================================================================

/**
 * Approximate cell dimensions in meters for each precision level.
 * These are approximate values at the equator; actual size varies by latitude.
 */
export const PRECISION_METERS: Record<number, { width: number; height: number }> = {
  1: { width: 5009400, height: 4992600 },
  2: { width: 1252300, height: 624100 },
  3: { width: 156500, height: 156000 },
  4: { width: 39100, height: 19500 },
  5: { width: 4900, height: 4900 },
  6: { width: 1200, height: 609.4 },
  7: { width: 152.9, height: 152.4 },
  8: { width: 38.2, height: 19 },
  9: { width: 4.8, height: 4.8 },
  10: { width: 1.2, height: 0.595 },
  11: { width: 0.149, height: 0.149 },
  12: { width: 0.037, height: 0.019 },
};

/**
 * Get the approximate cell size in meters for a precision level.
 *
 * @param precision - Precision level (1-12)
 * @returns Width and height in meters
 */
export function getCellSize(precision: number): { width: number; height: number } {
  const size = PRECISION_METERS[precision];
  if (size) {
    return size;
  }
  // Default to max precision if out of range
  return PRECISION_METERS[12];
}

// ============================================================================
// Distance Utilities
// ============================================================================

/**
 * Calculate approximate distance between two coordinates using Haversine formula.
 *
 * @param lat1 - First point latitude
 * @param lon1 - First point longitude
 * @param lat2 - Second point latitude
 * @param lon2 - Second point longitude
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters

  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if a coordinate is within a geohash cell.
 *
 * @param lat - Latitude to check
 * @param lon - Longitude to check
 * @param geohash - Geohash cell
 * @returns true if coordinate is within the cell
 */
export function isWithinGeohash(lat: number, lon: number, geohash: string): boolean {
  const bounds = decodeBounds(geohash);
  return (
    lat >= bounds.minLat &&
    lat <= bounds.maxLat &&
    lon >= bounds.minLon &&
    lon <= bounds.maxLon
  );
}

// ============================================================================
// Exports for External Access
// ============================================================================

/**
 * Base32 character set (for testing compatibility)
 */
export const BASE32_ALPHABET = BASE32_CHARS;
