/**
 * Geohash Utilities
 *
 * Pure geohash encoding/decoding functions for location-based channels.
 * Compatible with iOS/Android BitChat geohash format.
 *
 * Geohash is a hierarchical spatial data structure that subdivides space into
 * buckets of grid shape. Each character added to a geohash increases precision.
 *
 * @see https://en.wikipedia.org/wiki/Geohash
 */

// ============================================================================
// Constants
// ============================================================================

/**
 * Base32 alphabet used for geohash encoding
 * Note: This is NOT standard Base32 (RFC 4648), it's geohash-specific
 */
const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Decode lookup table for O(1) character to value conversion
 */
const GEOHASH_DECODE: Record<string, number> = {};
for (let i = 0; i < GEOHASH_ALPHABET.length; i++) {
  const char = GEOHASH_ALPHABET[i];
  if (char !== undefined) {
    GEOHASH_DECODE[char] = i;
  }
}

/**
 * Neighbor lookup tables for geohash adjacency calculations
 * Maps the last character to its replacement for each direction/parity
 * Source: https://www.movable-type.co.uk/scripts/geohash.html
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
 * Precision levels and their approximate sizes
 * These match the iOS/Android BitChat precision conventions
 */
export const PRECISION_LEVELS = {
  /** ~5000km - Continental scale */
  CONTINENT: 1,
  /** ~1250km - Country scale */
  COUNTRY: 2,
  /** ~156km - State/Province scale */
  REGION: 3,
  /** ~39km - Metro area scale */
  METRO: 4,
  /** ~5km - City district scale */
  CITY: 5,
  /** ~1.2km - Neighborhood scale (default for BitChat) */
  NEIGHBORHOOD: 6,
  /** ~153m - Block scale */
  BLOCK: 7,
  /** ~38m - Building scale */
  BUILDING: 8,
  /** ~5m - Room scale */
  ROOM: 9,
  /** ~1.2m - Precise location */
  PRECISE: 10,
  /** ~15cm - Very precise */
  VERY_PRECISE: 11,
  /** ~4cm - Maximum precision */
  MAX: 12,
} as const;

export type PrecisionLevel = typeof PRECISION_LEVELS[keyof typeof PRECISION_LEVELS];

/**
 * Approximate size in meters for each precision level
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

// ============================================================================
// Types
// ============================================================================

/**
 * Geographic coordinates
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Bounding box for a geohash cell
 */
export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

/**
 * Decoded geohash information
 */
export interface DecodedGeohash {
  /** Center latitude */
  latitude: number;
  /** Center longitude */
  longitude: number;
  /** Latitude error (+/-) */
  latitudeError: number;
  /** Longitude error (+/-) */
  longitudeError: number;
  /** Bounding box */
  bounds: BoundingBox;
}

/**
 * Direction for neighbor calculation
 */
export type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * All 8 neighbors of a geohash cell
 */
export interface Neighbors {
  n: string;
  ne: string;
  e: string;
  se: string;
  s: string;
  sw: string;
  w: string;
  nw: string;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Encode coordinates to a geohash string
 *
 * @param latitude - Latitude in degrees (-90 to 90)
 * @param longitude - Longitude in degrees (-180 to 180)
 * @param precision - Number of characters in output (1-12)
 * @returns Geohash string
 * @throws Error if coordinates are out of range
 *
 * @example
 * ```typescript
 * encode(40.7128, -74.0060, 6); // "dr5regw" (NYC)
 * encode(37.7749, -122.4194, 6); // "9q8yyk" (SF)
 * ```
 */
export function encode(
  latitude: number,
  longitude: number,
  precision: number = PRECISION_LEVELS.NEIGHBORHOOD
): string {
  // Validate inputs
  if (latitude < -90 || latitude > 90) {
    throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90.`);
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180.`);
  }
  if (precision < 1 || precision > 12) {
    throw new Error(`Invalid precision: ${precision}. Must be between 1 and 12.`);
  }

  let minLat = -90;
  let maxLat = 90;
  let minLon = -180;
  let maxLon = 180;

  let geohash = '';
  let bit = 0;
  let ch = 0;
  let isLon = true; // Start with longitude

  while (geohash.length < precision) {
    if (isLon) {
      const mid = (minLon + maxLon) / 2;
      if (longitude >= mid) {
        ch |= (1 << (4 - bit));
        minLon = mid;
      } else {
        maxLon = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (latitude >= mid) {
        ch |= (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isLon = !isLon;
    bit++;

    if (bit === 5) {
      geohash += GEOHASH_ALPHABET[ch];
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

/**
 * Decode a geohash to coordinates and bounds
 *
 * @param geohash - Geohash string to decode
 * @returns Decoded geohash with center point and bounds
 * @throws Error if geohash contains invalid characters
 *
 * @example
 * ```typescript
 * const result = decode('dr5regw');
 * // { latitude: 40.71..., longitude: -74.00..., ... }
 * ```
 */
export function decode(geohash: string): DecodedGeohash {
  if (!geohash || geohash.length === 0) {
    throw new Error('Geohash cannot be empty');
  }

  const normalizedHash = geohash.toLowerCase();

  // Validate characters
  for (const char of normalizedHash) {
    if (GEOHASH_DECODE[char] === undefined) {
      throw new Error(`Invalid geohash character: ${char}`);
    }
  }

  let minLat = -90;
  let maxLat = 90;
  let minLon = -180;
  let maxLon = 180;
  let isLon = true;

  for (const char of normalizedHash) {
    const value = GEOHASH_DECODE[char]; // Validated above

    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (value >> bit) & 1;

      if (isLon) {
        const mid = (minLon + maxLon) / 2;
        if (bitValue === 1) {
          minLon = mid;
        } else {
          maxLon = mid;
        }
      } else {
        const mid = (minLat + maxLat) / 2;
        if (bitValue === 1) {
          minLat = mid;
        } else {
          maxLat = mid;
        }
      }

      isLon = !isLon;
    }
  }

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLon + maxLon) / 2;
  const latitudeError = (maxLat - minLat) / 2;
  const longitudeError = (maxLon - minLon) / 2;

  return {
    latitude,
    longitude,
    latitudeError,
    longitudeError,
    bounds: { minLat, maxLat, minLon, maxLon },
  };
}

/**
 * Get the bounding box for a geohash
 *
 * @param geohash - Geohash string
 * @returns Bounding box coordinates
 */
export function getBoundingBox(geohash: string): BoundingBox {
  return decode(geohash).bounds;
}

/**
 * Get the center coordinates of a geohash
 *
 * @param geohash - Geohash string
 * @returns Center coordinates
 */
export function getCenter(geohash: string): Coordinates {
  const decoded = decode(geohash);
  return {
    latitude: decoded.latitude,
    longitude: decoded.longitude,
  };
}

// ============================================================================
// Neighbor Functions
// ============================================================================

/**
 * Calculate the adjacent geohash in a given direction
 *
 * @param geohash - Original geohash
 * @param direction - Cardinal direction (n, s, e, w)
 * @returns Adjacent geohash in that direction
 *
 * @example
 * ```typescript
 * getNeighbor('dr5regw', 'n'); // Geohash to the north
 * ```
 */
export function getNeighbor(geohash: string, direction: 'n' | 's' | 'e' | 'w'): string {
  if (!geohash || geohash.length === 0) {
    throw new Error('Geohash cannot be empty');
  }

  const normalizedHash = geohash.toLowerCase();
  const lastChar = normalizedHash.charAt(normalizedHash.length - 1);
  const parent = normalizedHash.substring(0, normalizedHash.length - 1);
  const type: 'even' | 'odd' = normalizedHash.length % 2 === 0 ? 'even' : 'odd';

  const borderChars = BORDER_CHARS[direction][type];
  const neighborChars = NEIGHBOR_ENCODE[direction][type];

  // If on border, need to get neighbor of parent first
  if (borderChars.indexOf(lastChar) !== -1 && parent.length > 0) {
    const parentNeighbor = getNeighbor(parent, direction);
    const neighborIndex = neighborChars.indexOf(lastChar);
    return parentNeighbor + GEOHASH_ALPHABET[neighborIndex];
  }

  const neighborIndex = neighborChars.indexOf(lastChar);
  return parent + GEOHASH_ALPHABET[neighborIndex];
}

/**
 * Get all 8 neighbors of a geohash
 *
 * @param geohash - Center geohash
 * @returns Object with all 8 adjacent geohashes
 *
 * @example
 * ```typescript
 * const neighbors = getAllNeighbors('dr5regw');
 * // { n: '...', ne: '...', e: '...', ... }
 * ```
 */
export function getAllNeighbors(geohash: string): Neighbors {
  const n = getNeighbor(geohash, 'n');
  const s = getNeighbor(geohash, 's');
  const e = getNeighbor(geohash, 'e');
  const w = getNeighbor(geohash, 'w');

  return {
    n,
    ne: getNeighbor(n, 'e'),
    e,
    se: getNeighbor(s, 'e'),
    s,
    sw: getNeighbor(s, 'w'),
    w,
    nw: getNeighbor(n, 'w'),
  };
}

/**
 * Get a specific neighbor (including diagonal directions)
 *
 * @param geohash - Center geohash
 * @param direction - Any direction including diagonals
 * @returns Neighbor geohash
 */
export function getNeighborInDirection(geohash: string, direction: Direction): string {
  switch (direction) {
    case 'n':
    case 's':
    case 'e':
    case 'w':
      return getNeighbor(geohash, direction);
    case 'ne':
      return getNeighbor(getNeighbor(geohash, 'n'), 'e');
    case 'nw':
      return getNeighbor(getNeighbor(geohash, 'n'), 'w');
    case 'se':
      return getNeighbor(getNeighbor(geohash, 's'), 'e');
    case 'sw':
      return getNeighbor(getNeighbor(geohash, 's'), 'w');
  }
}

/**
 * Get all geohashes within a radius of the center
 * Returns the center geohash and all neighbors (9 total)
 *
 * @param geohash - Center geohash
 * @returns Array of geohashes including center and all neighbors
 */
export function getGeohashesInRadius(geohash: string): string[] {
  const neighbors = getAllNeighbors(geohash);
  return [
    geohash,
    neighbors.n,
    neighbors.ne,
    neighbors.e,
    neighbors.se,
    neighbors.s,
    neighbors.sw,
    neighbors.w,
    neighbors.nw,
  ];
}

// ============================================================================
// Precision Utilities
// ============================================================================

/**
 * Reduce geohash precision (truncate)
 *
 * @param geohash - Original geohash
 * @param precision - Target precision (must be <= original length)
 * @returns Truncated geohash
 *
 * @example
 * ```typescript
 * reducePrecision('dr5regw', 4); // 'dr5r'
 * ```
 */
export function reducePrecision(geohash: string, precision: number): string {
  if (precision < 1) {
    throw new Error('Precision must be at least 1');
  }
  if (precision > geohash.length) {
    return geohash;
  }
  return geohash.substring(0, precision);
}

/**
 * Get the precision level of a geohash
 *
 * @param geohash - Geohash string
 * @returns Precision (string length)
 */
export function getPrecision(geohash: string): number {
  return geohash.length;
}

/**
 * Get the approximate cell size in meters for a precision level
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

/**
 * Get a human-readable description of a precision level
 *
 * @param precision - Precision level
 * @returns Human-readable description
 */
export function getPrecisionDescription(precision: number): string {
  const sizes = getCellSize(precision);
  const avgSize = (sizes.width + sizes.height) / 2;

  if (avgSize > 1000) {
    return `~${Math.round(avgSize / 1000)}km`;
  }
  if (avgSize >= 1) {
    return `~${Math.round(avgSize)}m`;
  }
  return `~${Math.round(avgSize * 100)}cm`;
}

/**
 * Find the appropriate precision for a desired cell size in meters
 *
 * @param targetMeters - Desired cell size in meters
 * @returns Recommended precision level
 */
export function getPrecisionForSize(targetMeters: number): number {
  for (let p = 1; p <= 12; p++) {
    const size = PRECISION_METERS[p];
    if (size) {
      const avgSize = (size.width + size.height) / 2;
      if (avgSize <= targetMeters) {
        return p;
      }
    }
  }
  return 12;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a geohash string
 *
 * @param geohash - String to validate
 * @returns True if valid geohash
 */
export function isValidGeohash(geohash: string): boolean {
  if (!geohash || typeof geohash !== 'string' || geohash.length === 0) {
    return false;
  }

  const normalized = geohash.toLowerCase();

  for (const char of normalized) {
    if (GEOHASH_DECODE[char] === undefined) {
      return false;
    }
  }

  return normalized.length <= 12;
}

/**
 * Check if one geohash contains another (is a prefix)
 *
 * @param parent - Potential parent/container geohash
 * @param child - Potential child/contained geohash
 * @returns True if parent contains child
 */
export function contains(parent: string, child: string): boolean {
  return child.toLowerCase().startsWith(parent.toLowerCase());
}

/**
 * Check if two geohashes overlap (one contains the other)
 *
 * @param geohash1 - First geohash
 * @param geohash2 - Second geohash
 * @returns True if they overlap
 */
export function overlaps(geohash1: string, geohash2: string): boolean {
  const g1 = geohash1.toLowerCase();
  const g2 = geohash2.toLowerCase();
  return g1.startsWith(g2) || g2.startsWith(g1);
}

// ============================================================================
// Distance Utilities
// ============================================================================

/**
 * Calculate approximate distance between two coordinates using Haversine formula
 *
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371000; // Earth's radius in meters

  const lat1Rad = (coord1.latitude * Math.PI) / 180;
  const lat2Rad = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate distance between two geohash centers
 *
 * @param geohash1 - First geohash
 * @param geohash2 - Second geohash
 * @returns Distance in meters
 */
export function distanceBetweenGeohashes(geohash1: string, geohash2: string): number {
  const center1 = getCenter(geohash1);
  const center2 = getCenter(geohash2);
  return calculateDistance(center1, center2);
}

/**
 * Check if a coordinate is within a geohash cell
 *
 * @param coords - Coordinates to check
 * @param geohash - Geohash cell
 * @returns True if coordinate is within the cell
 */
export function isWithinGeohash(coords: Coordinates, geohash: string): boolean {
  const bounds = getBoundingBox(geohash);
  return (
    coords.latitude >= bounds.minLat &&
    coords.latitude <= bounds.maxLat &&
    coords.longitude >= bounds.minLon &&
    coords.longitude <= bounds.maxLon
  );
}
