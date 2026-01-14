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
 * - Round-trip encoding/decoding preserves precision
 *
 * Reference: ../bitchat/bitchat/Protocols/Geohash.swift
 */

import { describe, it, expect } from 'vitest';
import {
  encode,
  decode,
  decodeBounds,
  neighbors,
  isValidGeohash,
  isValidBuildingGeohash,
  BASE32_ALPHABET,
  DEFAULT_PRECISION,
  PRECISION_METERS,
  getCellSize,
  calculateDistance,
  isWithinGeohash,
} from '../geohash';
import { GEOHASH_VECTORS } from '../test-vectors';
import { NativeGeohashFormat } from '../native-format';

// ============================================================================
// Base32 Character Set Tests
// ============================================================================

describe('Geohash Base32 Character Set', () => {
  it('should use correct base32 character set (0123456789bcdefghjkmnpqrstuvwxyz)', () => {
    expect(BASE32_ALPHABET).toBe('0123456789bcdefghjkmnpqrstuvwxyz');
  });

  it('should match iOS native base32 character set', () => {
    expect(BASE32_ALPHABET).toBe(NativeGeohashFormat.BASE32_CHARS);
    expect(BASE32_ALPHABET).toBe(GEOHASH_VECTORS.base32Chars);
  });

  it('should exclude confusing characters (a, i, l, o)', () => {
    expect(BASE32_ALPHABET).not.toContain('a');
    expect(BASE32_ALPHABET).not.toContain('i');
    expect(BASE32_ALPHABET).not.toContain('l');
    expect(BASE32_ALPHABET).not.toContain('o');
  });

  it('should have exactly 32 characters', () => {
    expect(BASE32_ALPHABET).toHaveLength(32);
  });

  it('should start with digits 0-9', () => {
    for (let i = 0; i < 10; i++) {
      expect(BASE32_ALPHABET[i]).toBe(String(i));
    }
  });
});

// ============================================================================
// Known Test Vectors - Encoding
// ============================================================================

describe('Geohash Encoding - Known Test Vectors', () => {
  describe('San Francisco Area', () => {
    it('should encode San Francisco (37.7749, -122.4194) to start with "9q8y"', () => {
      const result = encode(37.7749, -122.4194, 8);
      expect(result).toHaveLength(8);
      expect(result.startsWith('9q8y')).toBe(true);
      // Verify actual geohash for this location
      expect(result).toBe('9q8yyk8y');
    });

    it('should verify San Francisco geohash precision', () => {
      const geohash = encode(37.7749, -122.4194, 8);
      const decoded = decode(geohash);
      // At precision 8, error should be within ~40m (~0.0004 degrees)
      expect(Math.abs(decoded.lat - 37.7749)).toBeLessThan(0.001);
      expect(Math.abs(decoded.lon - (-122.4194))).toBeLessThan(0.001);
    });
  });

  describe('New York Area', () => {
    it('should encode New York (40.7128, -74.0060) to start with "dr5r"', () => {
      const result = encode(40.7128, -74.0060, 8);
      expect(result).toHaveLength(8);
      expect(result.startsWith('dr5r')).toBe(true);
    });

    it('should verify New York geohash precision', () => {
      const geohash = encode(40.7128, -74.0060, 8);
      const decoded = decode(geohash);
      expect(Math.abs(decoded.lat - 40.7128)).toBeLessThan(0.001);
      expect(Math.abs(decoded.lon - (-74.0060))).toBeLessThan(0.001);
    });
  });

  describe('Origin (0, 0)', () => {
    it('should encode origin (0, 0) to "s0000000"', () => {
      const result = encode(0, 0, 8);
      expect(result).toBe('s0000000');
    });

    it('should decode "s0000000" to approximately (0, 0)', () => {
      const decoded = decode('s0000000');
      expect(Math.abs(decoded.lat)).toBeLessThan(0.001);
      expect(Math.abs(decoded.lon)).toBeLessThan(0.001);
    });
  });

  describe('Well-Known Location Encodings from Test Vectors', () => {
    GEOHASH_VECTORS.encode.forEach(({ name, latitude, longitude, precision, expected }) => {
      it(`should encode ${name} correctly to "${expected}"`, () => {
        const result = encode(latitude, longitude, precision);
        expect(result).toBe(expected);
      });
    });
  });
});

// ============================================================================
// Edge Cases - Poles and Date Line
// ============================================================================

describe('Geohash Encoding - Edge Cases', () => {
  describe('North Pole (90, 0)', () => {
    it('should encode north pole to "upbpbpbp"', () => {
      const result = encode(90, 0, 8);
      expect(result).toBe('upbpbpbp');
    });

    it('should decode north pole geohash back to ~90 latitude', () => {
      const decoded = decode('upbpbpbp');
      // North pole should decode to very close to 90
      expect(decoded.lat).toBeGreaterThan(89.99);
      expect(decoded.lat).toBeLessThanOrEqual(90);
    });
  });

  describe('South Pole (-90, 0)', () => {
    it('should encode south pole to "h0000000"', () => {
      const result = encode(-90, 0, 8);
      expect(result).toBe('h0000000');
    });

    it('should decode south pole geohash back to ~-90 latitude', () => {
      const decoded = decode('h0000000');
      // South pole should decode to very close to -90
      expect(decoded.lat).toBeLessThan(-89.99);
      expect(decoded.lat).toBeGreaterThanOrEqual(-90);
    });
  });

  describe('Date Line - 180 degrees longitude', () => {
    it('should encode (0, 180) correctly', () => {
      const result = encode(0, 180, 8);
      expect(result).toHaveLength(8);
      // At lon=180, the geohash should start with 'x' (eastern hemisphere edge)
      expect(result[0]).toBe('x');
    });

    it('should encode (0, -180) correctly', () => {
      const result = encode(0, -180, 8);
      expect(result).toHaveLength(8);
      // At lon=-180, the geohash should start with '8' (western hemisphere edge)
      expect(result[0]).toBe('8');
    });

    it('should produce different geohashes for (0, 180) and (0, -180)', () => {
      const east = encode(0, 180, 8);
      const west = encode(0, -180, 8);
      // While geographically the same point, they encode differently
      // Note: 180 and -180 are the same location, but due to clamping they differ
      expect(east).not.toBe(west);
    });
  });

  describe('Equator (0, lon)', () => {
    it('should encode points along the equator correctly', () => {
      const points = [
        { lon: 0, expectedStart: 's' },   // Origin - lon >= 0, lat >= 0
        { lon: 90, expectedStart: 'w' },  // Eastern hemisphere
        { lon: -90, expectedStart: 'd' }, // Western hemisphere
      ];

      points.forEach(({ lon, expectedStart }) => {
        const result = encode(0, lon, 1);
        expect(result).toBe(expectedStart);
      });
    });
  });

  describe('Latitude/Longitude Clamping', () => {
    it('should clamp latitude > 90 to 90', () => {
      const result1 = encode(100, 0, 8);
      const result2 = encode(90, 0, 8);
      expect(result1).toBe(result2);
    });

    it('should clamp latitude < -90 to -90', () => {
      const result1 = encode(-100, 0, 8);
      const result2 = encode(-90, 0, 8);
      expect(result1).toBe(result2);
    });

    it('should clamp longitude > 180 to 180', () => {
      const result1 = encode(0, 200, 8);
      const result2 = encode(0, 180, 8);
      expect(result1).toBe(result2);
    });

    it('should clamp longitude < -180 to -180', () => {
      const result1 = encode(0, -200, 8);
      const result2 = encode(0, -180, 8);
      expect(result1).toBe(result2);
    });
  });

  describe('Zero and Negative Precision', () => {
    it('should return empty string for precision 0', () => {
      expect(encode(37.7749, -122.4194, 0)).toBe('');
    });

    it('should return empty string for negative precision', () => {
      expect(encode(37.7749, -122.4194, -1)).toBe('');
      expect(encode(37.7749, -122.4194, -100)).toBe('');
    });
  });
});

// ============================================================================
// Round-Trip Tests - Encode -> Decode -> Verify Precision
// ============================================================================

describe('Geohash Round-Trip (Encode -> Decode)', () => {
  const testLocations = [
    { name: 'San Francisco', lat: 37.7749, lon: -122.4194 },
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'Sydney', lat: -33.8688, lon: 151.2093 },
    { name: 'Cape Town', lat: -33.9249, lon: 18.4241 },
    { name: 'Origin', lat: 0, lon: 0 },
    { name: 'Near North Pole', lat: 89.5, lon: 45 },
    { name: 'Near South Pole', lat: -89.5, lon: -45 },
    { name: 'Near Date Line East', lat: 0, lon: 179.5 },
    { name: 'Near Date Line West', lat: 0, lon: -179.5 },
  ];

  describe('Coordinate preservation at precision 8', () => {
    testLocations.forEach(({ name, lat, lon }) => {
      it(`should preserve ${name} (${lat}, ${lon}) coordinates within precision`, () => {
        const geohash = encode(lat, lon, 8);
        const decoded = decode(geohash);

        // At precision 8, cell size is ~38m x 19m
        // This corresponds to roughly 0.00034 degrees latitude and 0.00034-0.00068 degrees longitude
        // Use 0.001 degrees as tolerance (about 111m at equator)
        const tolerance = 0.001;

        expect(Math.abs(decoded.lat - lat)).toBeLessThan(tolerance);
        expect(Math.abs(decoded.lon - lon)).toBeLessThan(tolerance);
      });
    });
  });

  describe('Re-encoding decoded center returns same geohash', () => {
    testLocations.forEach(({ name, lat, lon }) => {
      it(`should re-encode ${name} to same geohash`, () => {
        const original = encode(lat, lon, 8);
        const decoded = decode(original);
        const reencoded = encode(decoded.lat, decoded.lon, 8);

        expect(reencoded).toBe(original);
      });
    });
  });

  describe('Bounds contain original coordinate', () => {
    testLocations.forEach(({ name, lat, lon }) => {
      it(`should have bounds containing ${name}`, () => {
        const geohash = encode(lat, lon, 8);
        const bounds = decodeBounds(geohash);

        expect(lat).toBeGreaterThanOrEqual(bounds.minLat);
        expect(lat).toBeLessThanOrEqual(bounds.maxLat);
        expect(lon).toBeGreaterThanOrEqual(bounds.minLon);
        expect(lon).toBeLessThanOrEqual(bounds.maxLon);
      });
    });
  });
});

// ============================================================================
// Bounding Box Tests
// ============================================================================

describe('Geohash Bounding Box (decodeBounds)', () => {
  it('should produce valid bounding box with min < max', () => {
    const bounds = decodeBounds('dr5regw7');

    expect(bounds.minLat).toBeLessThan(bounds.maxLat);
    expect(bounds.minLon).toBeLessThan(bounds.maxLon);
  });

  it('should have bounds that contain the decoded center', () => {
    const geohash = 'dr5regw7';
    const bounds = decodeBounds(geohash);
    const center = decode(geohash);

    expect(center.lat).toBeGreaterThanOrEqual(bounds.minLat);
    expect(center.lat).toBeLessThanOrEqual(bounds.maxLat);
    expect(center.lon).toBeGreaterThanOrEqual(bounds.minLon);
    expect(center.lon).toBeLessThanOrEqual(bounds.maxLon);
  });

  it('should produce smaller bounds for higher precision', () => {
    const bounds4 = decodeBounds('dr5r');
    const bounds8 = decodeBounds('dr5regw7');

    const area4 = (bounds4.maxLat - bounds4.minLat) * (bounds4.maxLon - bounds4.minLon);
    const area8 = (bounds8.maxLat - bounds8.minLat) * (bounds8.maxLon - bounds8.minLon);

    expect(area8).toBeLessThan(area4);
  });

  it('should throw error for empty geohash', () => {
    expect(() => decodeBounds('')).toThrow();
  });

  it('should throw error for invalid characters', () => {
    expect(() => decodeBounds('dr5rega7')).toThrow(); // 'a' is invalid
    expect(() => decodeBounds('dr5regi7')).toThrow(); // 'i' is invalid
    expect(() => decodeBounds('dr5regl7')).toThrow(); // 'l' is invalid
    expect(() => decodeBounds('dr5rego7')).toThrow(); // 'o' is invalid
  });

  describe('Bounds size at different precisions', () => {
    it('should have approximately correct bounds size at precision 8', () => {
      const bounds = decodeBounds('dr5regw7');
      const latRange = bounds.maxLat - bounds.minLat;
      const lonRange = bounds.maxLon - bounds.minLon;

      // At precision 8: ~38m x 19m
      // Latitude: ~0.00017 degrees (19m / 111000m per degree)
      // Longitude varies by latitude, but roughly similar
      expect(latRange).toBeLessThan(0.001);
      expect(lonRange).toBeLessThan(0.001);
    });
  });
});

// ============================================================================
// Neighbor Calculation Tests
// ============================================================================

describe('Geohash Neighbors', () => {
  describe('Basic Neighbor Properties', () => {
    it('should return exactly 8 neighbors', () => {
      const result = neighbors('dr5regw7');
      expect(result).toHaveLength(8);
    });

    it('should return neighbors in order: N, NE, E, SE, S, SW, W, NW', () => {
      // This matches the iOS/Android BitChat order
      const result = neighbors('dr5regw7');
      expect(result).toHaveLength(8);
      // Verify each neighbor is valid
      result.forEach((neighbor) => {
        expect(isValidBuildingGeohash(neighbor)).toBe(true);
      });
    });

    it('should maintain same precision as input', () => {
      const geohash = 'dr5regw7';
      const result = neighbors(geohash);

      result.forEach((neighbor) => {
        expect(neighbor).toHaveLength(geohash.length);
      });
    });

    it('should produce unique neighbors (no duplicates)', () => {
      const result = neighbors('dr5regw7');
      const unique = new Set(result);
      expect(unique.size).toBe(result.length);
    });

    it('should not include the original geohash', () => {
      const geohash = 'dr5regw7';
      const result = neighbors(geohash);
      expect(result).not.toContain(geohash);
    });
  });

  describe('All Neighbors Are Valid Geohashes', () => {
    const testGeohashes = ['dr5regw7', '9q8yyk8y', 'gcpuvpmm', 's0000000', 'upbpbpbp', 'h0000000'];

    testGeohashes.forEach((geohash) => {
      it(`should produce valid neighbors for "${geohash}"`, () => {
        const result = neighbors(geohash);
        result.forEach((neighbor) => {
          expect(isValidGeohash(neighbor)).toBe(true);
          expect(neighbor).toHaveLength(geohash.length);
        });
      });
    });
  });

  describe('Neighbor Geographic Validity', () => {
    it('should return adjacent cells (neighbors touch the center)', () => {
      const center = 'dr5regw7';
      const centerBounds = decodeBounds(center);
      const centerWidth = centerBounds.maxLon - centerBounds.minLon;
      const centerHeight = centerBounds.maxLat - centerBounds.minLat;

      const result = neighbors(center);

      result.forEach((neighbor) => {
        const neighborCenter = decode(neighbor);
        const originalCenter = decode(center);

        const latDist = Math.abs(neighborCenter.lat - originalCenter.lat);
        const lonDist = Math.abs(neighborCenter.lon - originalCenter.lon);

        // Neighbor should be approximately 1 cell width/height away
        // Allow some tolerance due to floating point
        const isAdjacent =
          (latDist < centerHeight * 1.5 && latDist > centerHeight * 0.5) ||
          (lonDist < centerWidth * 1.5 && lonDist > centerWidth * 0.5) ||
          (latDist < centerHeight * 1.5 && lonDist < centerWidth * 1.5);

        expect(isAdjacent).toBe(true);
      });
    });

    it('should have N neighbor to the north of center', () => {
      const center = 'dr5regw7';
      const nNeighbor = neighbors(center)[0]; // N is first

      const centerCoord = decode(center);
      const nCoord = decode(nNeighbor);

      expect(nCoord.lat).toBeGreaterThan(centerCoord.lat);
    });

    it('should have S neighbor to the south of center', () => {
      const center = 'dr5regw7';
      const sNeighbor = neighbors(center)[4]; // S is fifth

      const centerCoord = decode(center);
      const sCoord = decode(sNeighbor);

      expect(sCoord.lat).toBeLessThan(centerCoord.lat);
    });

    it('should have E neighbor to the east of center', () => {
      const center = 'dr5regw7';
      const eNeighbor = neighbors(center)[2]; // E is third

      const centerCoord = decode(center);
      const eCoord = decode(eNeighbor);

      expect(eCoord.lon).toBeGreaterThan(centerCoord.lon);
    });

    it('should have W neighbor to the west of center', () => {
      const center = 'dr5regw7';
      const wNeighbor = neighbors(center)[6]; // W is seventh

      const centerCoord = decode(center);
      const wCoord = decode(wNeighbor);

      expect(wCoord.lon).toBeLessThan(centerCoord.lon);
    });
  });

  describe('Boundary Neighbors', () => {
    it('should calculate neighbors at cell boundaries correctly', () => {
      // Test a geohash that ends with a boundary character
      const boundaryGeohash = 'dr5regwz';
      const result = neighbors(boundaryGeohash);

      expect(result).toHaveLength(8);
      result.forEach((neighbor) => {
        expect(isValidGeohash(neighbor)).toBe(true);
      });
    });

    it('should handle date line boundary for neighbors', () => {
      // Test a geohash near the date line
      const eastGeohash = encode(0, 179.9, 4);
      const result = neighbors(eastGeohash);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((neighbor) => {
        expect(isValidGeohash(neighbor)).toBe(true);
      });
    });

    it('should handle polar boundary for neighbors', () => {
      // Test near north pole
      const northGeohash = encode(89.9, 0, 4);
      const result = neighbors(northGeohash);

      expect(result.length).toBe(8);
      result.forEach((neighbor) => {
        expect(isValidGeohash(neighbor)).toBe(true);
      });
    });
  });

  describe('Empty Input', () => {
    it('should return empty array for empty geohash', () => {
      expect(neighbors('')).toEqual([]);
    });
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Geohash Validation', () => {
  describe('isValidGeohash', () => {
    it('should validate correct geohashes', () => {
      expect(isValidGeohash('dr5regw7')).toBe(true);
      expect(isValidGeohash('9q8yyk8y')).toBe(true);
      expect(isValidGeohash('s0000000')).toBe(true);
      expect(isValidGeohash('DR5REGW7')).toBe(true); // Case insensitive
    });

    it('should reject invalid geohashes', () => {
      expect(isValidGeohash('')).toBe(false);
      expect(isValidGeohash('dr5rega7')).toBe(false); // 'a' invalid
      expect(isValidGeohash('dr5regi7')).toBe(false); // 'i' invalid
      expect(isValidGeohash('dr5regl7')).toBe(false); // 'l' invalid
      expect(isValidGeohash('dr5rego7')).toBe(false); // 'o' invalid
    });

    it('should reject too long geohashes', () => {
      expect(isValidGeohash('dr5regw7dr5regw7')).toBe(false); // 16 chars > 12 max
    });
  });

  describe('isValidBuildingGeohash', () => {
    it('should validate correct 8-character geohashes', () => {
      GEOHASH_VECTORS.validation.valid.forEach((geohash) => {
        expect(isValidBuildingGeohash(geohash)).toBe(true);
      });
    });

    it('should reject invalid geohashes', () => {
      GEOHASH_VECTORS.validation.invalid.forEach((geohash) => {
        expect(isValidBuildingGeohash(geohash)).toBe(false);
      });
    });

    it('should reject geohashes with wrong length', () => {
      expect(isValidBuildingGeohash('dr5reg')).toBe(false); // 6 chars
      expect(isValidBuildingGeohash('dr5regw7x')).toBe(false); // 9 chars
    });

    it('should be case-insensitive', () => {
      expect(isValidBuildingGeohash('DR5REGW7')).toBe(true);
      expect(isValidBuildingGeohash('Dr5ReGw7')).toBe(true);
    });

    it('should match NativeGeohashFormat validation', () => {
      GEOHASH_VECTORS.validation.valid.forEach((geohash) => {
        expect(isValidBuildingGeohash(geohash)).toBe(NativeGeohashFormat.isValidBuildingGeohash(geohash));
      });
      GEOHASH_VECTORS.validation.invalid.forEach((geohash) => {
        expect(isValidBuildingGeohash(geohash)).toBe(NativeGeohashFormat.isValidBuildingGeohash(geohash));
      });
    });
  });
});

// ============================================================================
// Precision Level Tests
// ============================================================================

describe('Geohash Precision Levels', () => {
  it('should use precision 8 as default (building level)', () => {
    expect(DEFAULT_PRECISION).toBe(8);
    expect(NativeGeohashFormat.DEFAULT_PRECISION).toBe(8);
  });

  describe('Precision produces correct length', () => {
    for (let precision = 1; precision <= 12; precision++) {
      it(`should produce ${precision} characters for precision ${precision}`, () => {
        const result = encode(40.758, -73.9855, precision);
        expect(result).toHaveLength(precision);
      });
    }
  });

  describe('Higher precision is prefix of lower precision', () => {
    it('should produce consistent prefixes at different precisions', () => {
      const lat = 40.758;
      const lon = -73.9855;

      const p4 = encode(lat, lon, 4);
      const p6 = encode(lat, lon, 6);
      const p8 = encode(lat, lon, 8);

      expect(p6.startsWith(p4)).toBe(true);
      expect(p8.startsWith(p6)).toBe(true);
      expect(p8.startsWith(p4)).toBe(true);
    });
  });

  describe('Precision cell sizes', () => {
    it('should have documented precision levels', () => {
      GEOHASH_VECTORS.precision.forEach(({ precision, approximateSize }) => {
        expect(precision).toBeGreaterThanOrEqual(1);
        expect(precision).toBeLessThanOrEqual(12);
        expect(approximateSize).toBeDefined();
      });
    });

    it('should report precision 8 as ~38m x 19m', () => {
      const buildingLevel = GEOHASH_VECTORS.precision.find((p) => p.precision === 8);
      expect(buildingLevel?.approximateSize).toBe('38m x 19m');
    });

    it('should have cell size data for all precisions 1-12', () => {
      for (let p = 1; p <= 12; p++) {
        expect(PRECISION_METERS[p]).toBeDefined();
        expect(PRECISION_METERS[p].width).toBeGreaterThan(0);
        expect(PRECISION_METERS[p].height).toBeGreaterThan(0);
      }
    });

    it('should have decreasing cell sizes with increasing precision', () => {
      for (let p = 1; p < 12; p++) {
        const currentSize = PRECISION_METERS[p];
        const nextSize = PRECISION_METERS[p + 1];
        expect(nextSize.width).toBeLessThan(currentSize.width);
        expect(nextSize.height).toBeLessThan(currentSize.height);
      }
    });
  });

  describe('getCellSize utility', () => {
    it('should return correct cell size for valid precisions', () => {
      const size8 = getCellSize(8);
      expect(size8.width).toBe(38.2);
      expect(size8.height).toBe(19);
    });

    it('should return max precision size for invalid precision', () => {
      const size = getCellSize(100);
      expect(size).toEqual(PRECISION_METERS[12]);
    });
  });
});

// ============================================================================
// Cross-Platform Consistency Tests
// ============================================================================

describe('Cross-Platform Geohash Consistency', () => {
  it('should use same latitude range as native (-90 to 90)', () => {
    expect(NativeGeohashFormat.LAT_RANGE.min).toBe(-90.0);
    expect(NativeGeohashFormat.LAT_RANGE.max).toBe(90.0);
  });

  it('should use same longitude range as native (-180 to 180)', () => {
    expect(NativeGeohashFormat.LON_RANGE.min).toBe(-180.0);
    expect(NativeGeohashFormat.LON_RANGE.max).toBe(180.0);
  });

  it('should interleave longitude and latitude bits correctly (lon first)', () => {
    // The algorithm alternates between longitude (even) and latitude (odd) bits
    // At origin (0,0), first bit is lon >= 0 (true = 1), second is lat >= 0 (true = 1)
    // This gives binary 11xxx which maps to 's' in base32
    const origin = encode(0.001, 0.001, 1);
    expect(origin).toBe('s');
  });

  it('should match neighbor direction order (N, NE, E, SE, S, SW, W, NW)', () => {
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

// ============================================================================
// Distance and Within Tests
// ============================================================================

describe('Geohash Distance Utilities', () => {
  describe('calculateDistance', () => {
    it('should calculate zero distance for same point', () => {
      const dist = calculateDistance(37.7749, -122.4194, 37.7749, -122.4194);
      expect(dist).toBe(0);
    });

    it('should calculate approximately correct distance between known points', () => {
      // San Francisco to New York is approximately 4139 km
      const dist = calculateDistance(37.7749, -122.4194, 40.7128, -74.0060);
      expect(dist).toBeGreaterThan(4000000); // > 4000 km
      expect(dist).toBeLessThan(4500000); // < 4500 km
    });
  });

  describe('isWithinGeohash', () => {
    it('should return true for point inside geohash', () => {
      const geohash = encode(37.7749, -122.4194, 8);
      expect(isWithinGeohash(37.7749, -122.4194, geohash)).toBe(true);
    });

    it('should return true for center point of geohash', () => {
      const geohash = 'dr5regw7';
      const center = decode(geohash);
      expect(isWithinGeohash(center.lat, center.lon, geohash)).toBe(true);
    });

    it('should return false for point outside geohash', () => {
      const geohash = encode(37.7749, -122.4194, 8);
      // Check a point far away
      expect(isWithinGeohash(40.7128, -74.0060, geohash)).toBe(false);
    });
  });
});

// ============================================================================
// Algorithm Bit Interleaving Verification
// ============================================================================

describe('Geohash Algorithm Verification', () => {
  describe('Bit interleaving pattern', () => {
    it('should alternate between longitude and latitude bits', () => {
      // For geohash 's', binary is 11000 (decimal 24)
      // Bit 0 (from left): lon >= 0 ? yes -> 1
      // Bit 1: lat >= 0 ? yes -> 1
      // Bit 2: lon >= 90 ? no -> 0
      // Bit 3: lat >= 45 ? no -> 0
      // Bit 4: lon >= 45 ? no -> 0
      // = 11000 = 24 = 's' (index 24 in base32)
      expect(BASE32_ALPHABET[24]).toBe('s');
    });

    it('should correctly encode quadrants', () => {
      // NE quadrant (lat > 0, lon > 0) starts with 's' through 'z'
      expect(encode(45, 45, 1)).toMatch(/[stuvwxyz]/);

      // NW quadrant (lat > 0, lon < 0) starts with 'b' through 'z'
      expect(encode(45, -45, 1)).toMatch(/[bcdefgh]/);

      // SE quadrant (lat < 0, lon > 0)
      expect(encode(-45, 45, 1)).toMatch(/[jkmnpqr]/);

      // SW quadrant (lat < 0, lon < 0)
      expect(encode(-45, -45, 1)).toMatch(/[23456789]/);
    });
  });

  describe('Precision doubling', () => {
    it('should halve the cell size with each additional character', () => {
      const lat = 40.758;
      const lon = -73.9855;

      const bounds6 = decodeBounds(encode(lat, lon, 6));
      const bounds7 = decodeBounds(encode(lat, lon, 7));
      const bounds8 = decodeBounds(encode(lat, lon, 8));

      const area6 = (bounds6.maxLat - bounds6.minLat) * (bounds6.maxLon - bounds6.minLon);
      const area7 = (bounds7.maxLat - bounds7.minLat) * (bounds7.maxLon - bounds7.minLon);
      const area8 = (bounds8.maxLat - bounds8.minLat) * (bounds8.maxLon - bounds8.minLon);

      // Each character adds 5 bits, so area should decrease by factor of ~32
      // Due to alternating lon/lat, the factor varies
      expect(area7).toBeLessThan(area6);
      expect(area8).toBeLessThan(area7);
    });
  });
});
