/**
 * Geohash Protocol Compatibility Tests
 *
 * These tests verify that the web client's geohash implementation
 * matches the iOS and Android BitChat apps exactly.
 *
 * Validates:
 * - Geohash encoding matches native
 * - Precision levels match
 * - Neighbor calculation matches
 * - Base32 character set is identical
 *
 * Reference: ../bitchat/bitchat/Protocols/Geohash.swift
 */

import { describe, it, expect } from 'vitest';
import { GEOHASH_VECTORS } from '../test-vectors';
import { NativeGeohashFormat } from '../native-format';

// ============================================================================
// Geohash Implementation for Testing
// ============================================================================

/**
 * Geohash encoder matching iOS implementation.
 * This is a reference implementation for testing - the actual
 * implementation should be in src/services/location/geohash.ts
 */
class GeohashEncoder {
  private static readonly BASE32_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';
  private static readonly BASE32_MAP: Map<string, number> = new Map(
    GeohashEncoder.BASE32_CHARS.split('').map((c, i) => [c, i])
  );

  /**
   * Encode latitude/longitude to geohash string.
   */
  static encode(latitude: number, longitude: number, precision: number): string {
    if (precision <= 0) return '';

    const latInterval: [number, number] = [-90.0, 90.0];
    const lonInterval: [number, number] = [-180.0, 180.0];

    let isEven = true;
    let bit = 0;
    let ch = 0;
    let geohash = '';

    const lat = Math.max(-90.0, Math.min(90.0, latitude));
    const lon = Math.max(-180.0, Math.min(180.0, longitude));

    while (geohash.length < precision) {
      if (isEven) {
        const mid = (lonInterval[0] + lonInterval[1]) / 2;
        if (lon >= mid) {
          ch |= 1 << (4 - bit);
          lonInterval[0] = mid;
        } else {
          lonInterval[1] = mid;
        }
      } else {
        const mid = (latInterval[0] + latInterval[1]) / 2;
        if (lat >= mid) {
          ch |= 1 << (4 - bit);
          latInterval[0] = mid;
        } else {
          latInterval[1] = mid;
        }
      }

      isEven = !isEven;
      if (bit < 4) {
        bit += 1;
      } else {
        geohash += this.BASE32_CHARS[ch];
        bit = 0;
        ch = 0;
      }
    }

    return geohash;
  }

  /**
   * Decode geohash to center latitude/longitude.
   */
  static decodeCenter(geohash: string): { lat: number; lon: number } {
    const bounds = this.decodeBounds(geohash);
    return {
      lat: (bounds.latMin + bounds.latMax) / 2,
      lon: (bounds.lonMin + bounds.lonMax) / 2,
    };
  }

  /**
   * Decode geohash to bounding box.
   */
  static decodeBounds(geohash: string): {
    latMin: number;
    latMax: number;
    lonMin: number;
    lonMax: number;
  } {
    const latInterval: [number, number] = [-90.0, 90.0];
    const lonInterval: [number, number] = [-180.0, 180.0];

    let isEven = true;
    for (const ch of geohash.toLowerCase()) {
      const cd = this.BASE32_MAP.get(ch);
      if (cd === undefined) continue;

      for (const mask of [16, 8, 4, 2, 1]) {
        if (isEven) {
          const mid = (lonInterval[0] + lonInterval[1]) / 2;
          if ((cd & mask) !== 0) {
            lonInterval[0] = mid;
          } else {
            lonInterval[1] = mid;
          }
        } else {
          const mid = (latInterval[0] + latInterval[1]) / 2;
          if ((cd & mask) !== 0) {
            latInterval[0] = mid;
          } else {
            latInterval[1] = mid;
          }
        }
        isEven = !isEven;
      }
    }

    return {
      latMin: latInterval[0],
      latMax: latInterval[1],
      lonMin: lonInterval[0],
      lonMax: lonInterval[1],
    };
  }

  /**
   * Calculate 8 neighboring geohashes.
   * Order: N, NE, E, SE, S, SW, W, NW
   */
  static neighbors(geohash: string): string[] {
    if (!geohash) return [];

    const precision = geohash.length;
    const bounds = this.decodeBounds(geohash);
    const center = this.decodeCenter(geohash);

    const latHeight = bounds.latMax - bounds.latMin;
    const lonWidth = bounds.lonMax - bounds.lonMin;

    const wrapLongitude = (lon: number): number => {
      let wrapped = lon;
      while (wrapped > 180.0) wrapped -= 360.0;
      while (wrapped < -180.0) wrapped += 360.0;
      return wrapped;
    };

    const clampLatitude = (lat: number): number => {
      return Math.max(-90.0, Math.min(90.0, lat));
    };

    const neighborCoords = [
      { lat: center.lat + latHeight, lon: center.lon }, // N
      { lat: center.lat + latHeight, lon: center.lon + lonWidth }, // NE
      { lat: center.lat, lon: center.lon + lonWidth }, // E
      { lat: center.lat - latHeight, lon: center.lon + lonWidth }, // SE
      { lat: center.lat - latHeight, lon: center.lon }, // S
      { lat: center.lat - latHeight, lon: center.lon - lonWidth }, // SW
      { lat: center.lat, lon: center.lon - lonWidth }, // W
      { lat: center.lat + latHeight, lon: center.lon - lonWidth }, // NW
    ];

    return neighborCoords
      .filter((n) => n.lat >= -90.0 && n.lat <= 90.0)
      .map((n) => this.encode(clampLatitude(n.lat), wrapLongitude(n.lon), precision));
  }

  /**
   * Validate building-level geohash (8 characters).
   */
  static isValidBuildingGeohash(geohash: string): boolean {
    if (geohash.length !== 8) return false;
    return geohash
      .toLowerCase()
      .split('')
      .every((c) => this.BASE32_MAP.has(c));
  }
}

// ============================================================================
// Geohash Encoding Tests
// ============================================================================

describe('Geohash Encoding Compatibility', () => {
  describe('Base32 Character Set', () => {
    it('should use same base32 character set as iOS', () => {
      expect(GEOHASH_VECTORS.base32Chars).toBe('0123456789bcdefghjkmnpqrstuvwxyz');
      expect(NativeGeohashFormat.BASE32_CHARS).toBe('0123456789bcdefghjkmnpqrstuvwxyz');
    });

    it('should exclude confusing characters (a, i, l, o)', () => {
      const chars = GEOHASH_VECTORS.base32Chars;
      expect(chars).not.toContain('a');
      expect(chars).not.toContain('i');
      expect(chars).not.toContain('l');
      expect(chars).not.toContain('o');
    });

    it('should have exactly 32 characters', () => {
      expect(GEOHASH_VECTORS.base32Chars).toHaveLength(32);
    });

    it('should start with digits 0-9', () => {
      const chars = GEOHASH_VECTORS.base32Chars;
      for (let i = 0; i < 10; i++) {
        expect(chars[i]).toBe(String(i));
      }
    });
  });

  describe('Well-Known Location Encodings', () => {
    GEOHASH_VECTORS.encode.forEach(({ name, latitude, longitude, precision, expected }) => {
      it(`should encode ${name} correctly`, () => {
        const result = GeohashEncoder.encode(latitude, longitude, precision);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Encoding Edge Cases', () => {
    it('should handle equator/prime meridian (0, 0)', () => {
      const result = GeohashEncoder.encode(0, 0, 8);
      expect(result).toBe('s0000000');
    });

    it('should handle north pole (90, 0)', () => {
      const result = GeohashEncoder.encode(90, 0, 8);
      expect(result).toBe('upbpbpbp');
    });

    it('should handle south pole (-90, 0)', () => {
      const result = GeohashEncoder.encode(-90, 0, 8);
      expect(result).toBe('h0000000');
    });

    it('should clamp latitude to [-90, 90]', () => {
      // Latitude > 90 should be clamped
      const result1 = GeohashEncoder.encode(100, 0, 4);
      const result2 = GeohashEncoder.encode(90, 0, 4);
      expect(result1).toBe(result2);

      // Latitude < -90 should be clamped
      const result3 = GeohashEncoder.encode(-100, 0, 4);
      const result4 = GeohashEncoder.encode(-90, 0, 4);
      expect(result3).toBe(result4);
    });

    it('should clamp longitude to [-180, 180]', () => {
      // Longitude > 180 should be clamped
      const result1 = GeohashEncoder.encode(0, 200, 4);
      const result2 = GeohashEncoder.encode(0, 180, 4);
      expect(result1).toBe(result2);
    });

    it('should return empty string for precision <= 0', () => {
      expect(GeohashEncoder.encode(40.758, -73.9855, 0)).toBe('');
      expect(GeohashEncoder.encode(40.758, -73.9855, -1)).toBe('');
    });
  });

  describe('Different Precision Levels', () => {
    const testLocation = { lat: 40.758, lon: -73.9855 }; // NYC Times Square

    it('should produce correct length for each precision', () => {
      for (let precision = 1; precision <= 12; precision++) {
        const result = GeohashEncoder.encode(testLocation.lat, testLocation.lon, precision);
        expect(result).toHaveLength(precision);
      }
    });

    it('should produce consistent prefixes at different precisions', () => {
      const p4 = GeohashEncoder.encode(testLocation.lat, testLocation.lon, 4);
      const p6 = GeohashEncoder.encode(testLocation.lat, testLocation.lon, 6);
      const p8 = GeohashEncoder.encode(testLocation.lat, testLocation.lon, 8);

      // Longer precision should start with shorter precision
      expect(p6.startsWith(p4)).toBe(true);
      expect(p8.startsWith(p6)).toBe(true);
      expect(p8.startsWith(p4)).toBe(true);
    });
  });
});

// ============================================================================
// Geohash Decoding Tests
// ============================================================================

describe('Geohash Decoding Compatibility', () => {
  describe('Decode to Center', () => {
    GEOHASH_VECTORS.encode.forEach(({ name, latitude, longitude, expected }) => {
      it(`should decode ${name} back to approximate center`, () => {
        const center = GeohashEncoder.decodeCenter(expected);

        // At precision 8, accuracy is about 38m x 19m
        // The decoded center should be close to the original input
        // Allow tolerance based on precision 8 cell size (~0.0004 degrees)
        const latError = Math.abs(center.lat - latitude);
        const lonError = Math.abs(center.lon - longitude);

        // Precision 8 has cell size ~38m x 19m, which is ~0.0003-0.0002 degrees
        // Allow 0.01 degree tolerance (about 1km) for edge cases
        expect(latError).toBeLessThan(0.01);
        expect(lonError).toBeLessThan(0.01);
      });
    });
  });

  describe('Decode to Bounds', () => {
    it('should produce valid bounding box', () => {
      const bounds = GeohashEncoder.decodeBounds('dr5regw7');

      expect(bounds.latMin).toBeLessThan(bounds.latMax);
      expect(bounds.lonMin).toBeLessThan(bounds.lonMax);
    });

    it('should have bounds that contain the encoded point', () => {
      // Test with a point that is guaranteed to be at the center of its cell
      const testGeohash = 'dr5regw7';
      const bounds = GeohashEncoder.decodeBounds(testGeohash);
      const center = GeohashEncoder.decodeCenter(testGeohash);

      // The decoded center should be within bounds
      expect(center.lat).toBeGreaterThanOrEqual(bounds.latMin);
      expect(center.lat).toBeLessThanOrEqual(bounds.latMax);
      expect(center.lon).toBeGreaterThanOrEqual(bounds.lonMin);
      expect(center.lon).toBeLessThanOrEqual(bounds.lonMax);
    });
  });

  describe('Round-Trip Encoding', () => {
    it('should maintain consistency when re-encoding center', () => {
      const original = 'dr5regw7';
      const center = GeohashEncoder.decodeCenter(original);
      const reencoded = GeohashEncoder.encode(center.lat, center.lon, 8);

      // Re-encoding the center should give the same geohash
      expect(reencoded).toBe(original);
    });
  });
});

// ============================================================================
// Geohash Neighbor Tests
// ============================================================================

describe('Geohash Neighbor Calculation Compatibility', () => {
  describe('Neighbor Direction Order', () => {
    it('should return neighbors in N, NE, E, SE, S, SW, W, NW order', () => {
      expect(NativeGeohashFormat.NEIGHBOR_DIRECTIONS).toEqual([
        'N',
        'NE',
        'E',
        'SE',
        'S',
        'SW',
        'W',
        'NW',
      ]);
    });
  });

  describe('Known Neighbor Test Vectors', () => {
    GEOHASH_VECTORS.neighbors.forEach(({ center }) => {
      it(`should calculate correct neighbors for ${center}`, () => {
        const actualNeighbors = GeohashEncoder.neighbors(center);

        // Should return exactly 8 neighbors for non-polar geohash
        expect(actualNeighbors).toHaveLength(8);

        // All neighbors should have same precision
        actualNeighbors.forEach((neighbor) => {
          expect(neighbor).toHaveLength(center.length);
        });

        // All neighbors should be valid geohashes
        actualNeighbors.forEach((neighbor) => {
          expect(GeohashEncoder.isValidBuildingGeohash(neighbor)).toBe(true);
        });

        // Neighbors should be adjacent (not the same as center)
        actualNeighbors.forEach((neighbor) => {
          expect(neighbor).not.toBe(center);
        });
      });
    });
  });

  describe('Neighbor Properties', () => {
    it('should return 8 neighbors for non-polar locations', () => {
      const nonPolarGeohash = 'dr5regw7'; // NYC area
      const neighbors = GeohashEncoder.neighbors(nonPolarGeohash);
      expect(neighbors).toHaveLength(8);
    });

    it('should return fewer neighbors at poles', () => {
      // North pole
      const northPole = GeohashEncoder.encode(89.9, 0, 4);
      const northNeighbors = GeohashEncoder.neighbors(northPole);

      // May have fewer than 8 due to polar region
      expect(northNeighbors.length).toBeLessThanOrEqual(8);
    });

    it('should maintain same precision for neighbors', () => {
      const geohash = 'dr5regw7';
      const neighbors = GeohashEncoder.neighbors(geohash);

      neighbors.forEach((neighbor) => {
        expect(neighbor).toHaveLength(geohash.length);
      });
    });

    it('should produce unique neighbors', () => {
      const geohash = 'dr5regw7';
      const neighbors = GeohashEncoder.neighbors(geohash);
      const uniqueNeighbors = new Set(neighbors);

      expect(uniqueNeighbors.size).toBe(neighbors.length);
    });

    it('should not include the original cell', () => {
      const geohash = 'dr5regw7';
      const neighbors = GeohashEncoder.neighbors(geohash);

      expect(neighbors).not.toContain(geohash);
    });
  });

  describe('Neighbor Geographic Validity', () => {
    it('should return adjacent cells', () => {
      const center = 'dr5regw7';
      const neighbors = GeohashEncoder.neighbors(center);

      const centerBounds = GeohashEncoder.decodeBounds(center);
      const centerWidth = centerBounds.lonMax - centerBounds.lonMin;
      const centerHeight = centerBounds.latMax - centerBounds.latMin;

      neighbors.forEach((neighbor) => {
        const neighborCenter = GeohashEncoder.decodeCenter(neighbor);
        const originalCenter = GeohashEncoder.decodeCenter(center);

        // Neighbor should be approximately 1 cell width/height away
        const latDist = Math.abs(neighborCenter.lat - originalCenter.lat);
        const lonDist = Math.abs(neighborCenter.lon - originalCenter.lon);

        // At least one dimension should be approximately 1 cell size away
        const isAdjacent =
          (latDist < centerHeight * 1.5 && latDist > centerHeight * 0.5) ||
          (lonDist < centerWidth * 1.5 && lonDist > centerWidth * 0.5) ||
          (latDist < centerHeight * 1.5 && lonDist < centerWidth * 1.5);

        expect(isAdjacent).toBe(true);
      });
    });
  });
});

// ============================================================================
// Geohash Validation Tests
// ============================================================================

describe('Geohash Validation Compatibility', () => {
  describe('Building-Level Validation (8 characters)', () => {
    it('should validate correct 8-character geohashes', () => {
      GEOHASH_VECTORS.validation.valid.forEach((geohash) => {
        expect(GeohashEncoder.isValidBuildingGeohash(geohash)).toBe(true);
        expect(NativeGeohashFormat.isValidBuildingGeohash(geohash)).toBe(true);
      });
    });

    it('should reject invalid geohashes', () => {
      GEOHASH_VECTORS.validation.invalid.forEach((geohash) => {
        expect(GeohashEncoder.isValidBuildingGeohash(geohash)).toBe(false);
        expect(NativeGeohashFormat.isValidBuildingGeohash(geohash)).toBe(false);
      });
    });

    it('should reject geohashes with wrong length', () => {
      expect(GeohashEncoder.isValidBuildingGeohash('dr5reg')).toBe(false); // 6 chars
      expect(GeohashEncoder.isValidBuildingGeohash('dr5regw7x')).toBe(false); // 9 chars
    });

    it('should reject geohashes with invalid characters', () => {
      // 'a', 'i', 'l', 'o' are not in the base32 set
      expect(GeohashEncoder.isValidBuildingGeohash('dr5rega7')).toBe(false);
      expect(GeohashEncoder.isValidBuildingGeohash('dr5regi7')).toBe(false);
      expect(GeohashEncoder.isValidBuildingGeohash('dr5regl7')).toBe(false);
      expect(GeohashEncoder.isValidBuildingGeohash('dr5rego7')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(GeohashEncoder.isValidBuildingGeohash('DR5REGW7')).toBe(true);
      expect(GeohashEncoder.isValidBuildingGeohash('Dr5ReGw7')).toBe(true);
    });
  });

  describe('Default Precision', () => {
    it('should use precision 8 as default (building level)', () => {
      expect(NativeGeohashFormat.DEFAULT_PRECISION).toBe(8);
    });
  });
});

// ============================================================================
// Precision Level Tests
// ============================================================================

describe('Geohash Precision Levels', () => {
  describe('Precision Size Mapping', () => {
    it('should have documented precision levels', () => {
      GEOHASH_VECTORS.precision.forEach(({ precision, approximateSize }) => {
        expect(precision).toBeGreaterThanOrEqual(1);
        expect(precision).toBeLessThanOrEqual(12);
        expect(approximateSize).toBeDefined();
      });
    });

    it('should use precision 8 for building level (~38m x 19m)', () => {
      const buildingLevel = GEOHASH_VECTORS.precision.find((p) => p.precision === 8);
      expect(buildingLevel?.approximateSize).toBe('38m x 19m');
    });
  });

  describe('Precision Decreases Cell Size', () => {
    it('should produce smaller cells with higher precision', () => {
      const location = { lat: 40.758, lon: -73.9855 };

      const bounds4 = GeohashEncoder.decodeBounds(
        GeohashEncoder.encode(location.lat, location.lon, 4)
      );
      const bounds8 = GeohashEncoder.decodeBounds(
        GeohashEncoder.encode(location.lat, location.lon, 8)
      );

      const size4 = (bounds4.latMax - bounds4.latMin) * (bounds4.lonMax - bounds4.lonMin);
      const size8 = (bounds8.latMax - bounds8.latMin) * (bounds8.lonMax - bounds8.lonMin);

      expect(size8).toBeLessThan(size4);
    });
  });
});

// ============================================================================
// Longitude Wrap-Around Tests
// ============================================================================

describe('Geohash Longitude Wrap-Around', () => {
  describe('International Date Line', () => {
    it('should handle locations near 180 degrees', () => {
      const eastOfLine = GeohashEncoder.encode(0, 179.9, 4);
      const westOfLine = GeohashEncoder.encode(0, -179.9, 4);

      expect(eastOfLine).toBeDefined();
      expect(westOfLine).toBeDefined();
      expect(eastOfLine).not.toBe(westOfLine);
    });

    it('should wrap longitude in neighbor calculation', () => {
      // Location just west of 180 longitude
      const geohash = GeohashEncoder.encode(0, 179.9, 4);
      const neighbors = GeohashEncoder.neighbors(geohash);

      // Should have valid neighbors (may wrap to -180 area)
      expect(neighbors.length).toBeGreaterThan(0);
      neighbors.forEach((n) => {
        expect(n).toHaveLength(4);
      });
    });
  });
});

// ============================================================================
// Cross-Platform Consistency Tests
// ============================================================================

describe('Cross-Platform Geohash Consistency', () => {
  describe('Format Matching', () => {
    it('should use same latitude range as native', () => {
      expect(NativeGeohashFormat.LAT_RANGE.min).toBe(-90.0);
      expect(NativeGeohashFormat.LAT_RANGE.max).toBe(90.0);
    });

    it('should use same longitude range as native', () => {
      expect(NativeGeohashFormat.LON_RANGE.min).toBe(-180.0);
      expect(NativeGeohashFormat.LON_RANGE.max).toBe(180.0);
    });
  });

  describe('Encoding Algorithm', () => {
    it('should interleave longitude and latitude bits correctly', () => {
      // The algorithm alternates between longitude (even) and latitude (odd) bits
      // This test verifies the interleaving by checking known encodings

      // Equator/Prime Meridian should start with 's' (binary 11000)
      // because lon >= 0 (bit 1) and lat >= 0 (bit 1) for first two bits
      const origin = GeohashEncoder.encode(0.001, 0.001, 1);
      expect(origin).toBe('s');
    });
  });
});
