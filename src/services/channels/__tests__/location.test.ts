/**
 * Location Channel Tests
 *
 * Unit tests for geohash utilities and location channel management.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  // Geohash utilities
  encode,
  decode,
  getBoundingBox,
  getCenter,
  getNeighbor,
  getAllNeighbors,
  getNeighborInDirection,
  getGeohashesInRadius,
  reducePrecision,
  getPrecision,
  getCellSize,
  getPrecisionDescription,
  getPrecisionForSize,
  isValidGeohash,
  contains,
  overlaps,
  calculateDistance,
  distanceBetweenGeohashes,
  isWithinGeohash,
  PRECISION_LEVELS,
  type Coordinates,
} from '../geohash';

import {
  // Location channel utilities
  LOCATION_EVENT_KIND,
  DEFAULT_LOCATION_PRECISION,
  isGeolocationAvailable,
  getLocationState,
  setLocationPrecision,
  reduceLocationPrecision,
  getAnonymousGeohash,
  isPrivacySafePrecision,
  createLocationFilter,
  createMultiPrecisionFilter,
  parseLocationEvent,
  filterEventsByGeohash,
  generateLocationChannelId,
  generateLocationChannelName,
  createLocationChannelData,
  cleanupLocationServices,
} from '../location';

import type { NostrEvent } from '../../nostr/types';

// ============================================================================
// Geohash Encoding Tests
// ============================================================================

describe('Geohash Encoding', () => {
  describe('encode', () => {
    it('should encode NYC coordinates correctly', () => {
      const geohash = encode(40.7128, -74.0060, 6);
      expect(geohash).toHaveLength(6);
      expect(geohash.startsWith('dr5r')).toBe(true);
    });

    it('should encode San Francisco coordinates correctly', () => {
      const geohash = encode(37.7749, -122.4194, 6);
      expect(geohash).toHaveLength(6);
      expect(geohash.startsWith('9q8y')).toBe(true);
    });

    it('should encode London coordinates correctly', () => {
      const geohash = encode(51.5074, -0.1278, 6);
      expect(geohash).toHaveLength(6);
      expect(geohash.startsWith('gcpv')).toBe(true);
    });

    it('should handle different precision levels', () => {
      const lat = 40.7128;
      const lon = -74.0060;

      for (let precision = 1; precision <= 12; precision++) {
        const geohash = encode(lat, lon, precision);
        expect(geohash).toHaveLength(precision);
      }
    });

    it('should throw error for invalid latitude', () => {
      expect(() => encode(91, 0, 6)).toThrow('Invalid latitude');
      expect(() => encode(-91, 0, 6)).toThrow('Invalid latitude');
    });

    it('should throw error for invalid longitude', () => {
      expect(() => encode(0, 181, 6)).toThrow('Invalid longitude');
      expect(() => encode(0, -181, 6)).toThrow('Invalid longitude');
    });

    it('should throw error for invalid precision', () => {
      expect(() => encode(0, 0, 0)).toThrow('Invalid precision');
      expect(() => encode(0, 0, 13)).toThrow('Invalid precision');
    });

    it('should handle edge case coordinates', () => {
      // North pole
      expect(() => encode(90, 0, 6)).not.toThrow();
      // South pole
      expect(() => encode(-90, 0, 6)).not.toThrow();
      // International date line
      expect(() => encode(0, 180, 6)).not.toThrow();
      expect(() => encode(0, -180, 6)).not.toThrow();
    });

    it('should use default precision if not specified', () => {
      const geohash = encode(40.7128, -74.0060);
      expect(geohash).toHaveLength(PRECISION_LEVELS.NEIGHBORHOOD);
    });
  });

  describe('decode', () => {
    it('should decode geohash to approximate coordinates', () => {
      const originalLat = 40.7128;
      const originalLon = -74.0060;
      const geohash = encode(originalLat, originalLon, 9);

      const decoded = decode(geohash);

      // Should be very close to original at precision 9
      expect(Math.abs(decoded.latitude - originalLat)).toBeLessThan(0.0001);
      expect(Math.abs(decoded.longitude - originalLon)).toBeLessThan(0.0001);
    });

    it('should include bounding box', () => {
      const decoded = decode('dr5regw');

      expect(decoded.bounds).toBeDefined();
      expect(decoded.bounds.minLat).toBeLessThan(decoded.bounds.maxLat);
      expect(decoded.bounds.minLon).toBeLessThan(decoded.bounds.maxLon);
    });

    it('should include error margins', () => {
      const decoded = decode('dr5regw');

      expect(decoded.latitudeError).toBeGreaterThan(0);
      expect(decoded.longitudeError).toBeGreaterThan(0);
    });

    it('should handle lowercase and uppercase', () => {
      const lower = decode('dr5regw');
      const upper = decode('DR5REGW');

      expect(lower.latitude).toEqual(upper.latitude);
      expect(lower.longitude).toEqual(upper.longitude);
    });

    it('should throw error for empty geohash', () => {
      expect(() => decode('')).toThrow('cannot be empty');
    });

    it('should throw error for invalid characters', () => {
      expect(() => decode('dr5ra')).toThrow('Invalid geohash character');
      expect(() => decode('dr5ri')).toThrow('Invalid geohash character');
      expect(() => decode('dr5rl')).toThrow('Invalid geohash character');
      expect(() => decode('dr5ro')).toThrow('Invalid geohash character');
    });
  });

  describe('getBoundingBox', () => {
    it('should return valid bounding box', () => {
      const bbox = getBoundingBox('dr5r');

      expect(bbox.minLat).toBeLessThan(bbox.maxLat);
      expect(bbox.minLon).toBeLessThan(bbox.maxLon);
    });
  });

  describe('getCenter', () => {
    it('should return center coordinates', () => {
      const center = getCenter('dr5r');

      expect(center.latitude).toBeGreaterThan(-90);
      expect(center.latitude).toBeLessThan(90);
      expect(center.longitude).toBeGreaterThan(-180);
      expect(center.longitude).toBeLessThan(180);
    });
  });
});

// ============================================================================
// Neighbor Tests
// ============================================================================

describe('Geohash Neighbors', () => {
  describe('getNeighbor', () => {
    it('should get north neighbor', () => {
      const north = getNeighbor('dr5regw', 'n');
      expect(north).toHaveLength(7);
      expect(north).not.toBe('dr5regw');
    });

    it('should get south neighbor', () => {
      const south = getNeighbor('dr5regw', 's');
      expect(south).toHaveLength(7);
      expect(south).not.toBe('dr5regw');
    });

    it('should get east neighbor', () => {
      const east = getNeighbor('dr5regw', 'e');
      expect(east).toHaveLength(7);
      expect(east).not.toBe('dr5regw');
    });

    it('should get west neighbor', () => {
      const west = getNeighbor('dr5regw', 'w');
      expect(west).toHaveLength(7);
      expect(west).not.toBe('dr5regw');
    });

    it('should throw error for empty geohash', () => {
      expect(() => getNeighbor('', 'n')).toThrow('cannot be empty');
    });
  });

  describe('getAllNeighbors', () => {
    it('should return all 8 neighbors', () => {
      const neighbors = getAllNeighbors('dr5regw');

      expect(neighbors.n).toBeDefined();
      expect(neighbors.ne).toBeDefined();
      expect(neighbors.e).toBeDefined();
      expect(neighbors.se).toBeDefined();
      expect(neighbors.s).toBeDefined();
      expect(neighbors.sw).toBeDefined();
      expect(neighbors.w).toBeDefined();
      expect(neighbors.nw).toBeDefined();

      // All should be different
      const values = Object.values(neighbors);
      const unique = new Set(values);
      expect(unique.size).toBe(8);
    });
  });

  describe('getNeighborInDirection', () => {
    it('should get diagonal neighbors', () => {
      const ne = getNeighborInDirection('dr5regw', 'ne');
      const nw = getNeighborInDirection('dr5regw', 'nw');
      const se = getNeighborInDirection('dr5regw', 'se');
      const sw = getNeighborInDirection('dr5regw', 'sw');

      expect(ne).not.toBe('dr5regw');
      expect(nw).not.toBe('dr5regw');
      expect(se).not.toBe('dr5regw');
      expect(sw).not.toBe('dr5regw');
    });
  });

  describe('getGeohashesInRadius', () => {
    it('should return 9 geohashes (center + 8 neighbors)', () => {
      const geohashes = getGeohashesInRadius('dr5regw');

      expect(geohashes).toHaveLength(9);
      expect(geohashes).toContain('dr5regw');
    });

    it('should return unique geohashes', () => {
      const geohashes = getGeohashesInRadius('dr5regw');
      const unique = new Set(geohashes);
      expect(unique.size).toBe(9);
    });
  });
});

// ============================================================================
// Precision Tests
// ============================================================================

describe('Geohash Precision', () => {
  describe('reducePrecision', () => {
    it('should truncate geohash to target precision', () => {
      const reduced = reducePrecision('dr5regw', 4);
      expect(reduced).toBe('dr5r');
    });

    it('should return original if precision is higher than length', () => {
      const reduced = reducePrecision('dr5r', 6);
      expect(reduced).toBe('dr5r');
    });

    it('should throw error for precision less than 1', () => {
      expect(() => reducePrecision('dr5regw', 0)).toThrow('at least 1');
    });
  });

  describe('getPrecision', () => {
    it('should return string length', () => {
      expect(getPrecision('dr5regw')).toBe(7);
      expect(getPrecision('dr5r')).toBe(4);
      expect(getPrecision('d')).toBe(1);
    });
  });

  describe('getCellSize', () => {
    it('should return size for valid precision', () => {
      const size = getCellSize(6);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });

    it('should return decreasing sizes for increasing precision', () => {
      const size4 = getCellSize(4);
      const size6 = getCellSize(6);
      const size8 = getCellSize(8);

      expect(size4.width).toBeGreaterThan(size6.width);
      expect(size6.width).toBeGreaterThan(size8.width);
    });
  });

  describe('getPrecisionDescription', () => {
    it('should return human-readable description', () => {
      const desc = getPrecisionDescription(6);
      expect(desc).toContain('~');
    });
  });

  describe('getPrecisionForSize', () => {
    it('should return appropriate precision for target size', () => {
      const precision = getPrecisionForSize(1000);
      expect(precision).toBeGreaterThanOrEqual(1);
      expect(precision).toBeLessThanOrEqual(12);
    });
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Geohash Validation', () => {
  describe('isValidGeohash', () => {
    it('should return true for valid geohashes', () => {
      expect(isValidGeohash('dr5regw')).toBe(true);
      expect(isValidGeohash('9q8yyk')).toBe(true);
      expect(isValidGeohash('u4pruy')).toBe(true);
    });

    it('should return false for invalid geohashes', () => {
      expect(isValidGeohash('')).toBe(false);
      expect(isValidGeohash('dr5ra')).toBe(false); // 'a' is invalid
      expect(isValidGeohash('dr5ri')).toBe(false); // 'i' is invalid
      expect(isValidGeohash('dr5rl')).toBe(false); // 'l' is invalid
      expect(isValidGeohash('dr5ro')).toBe(false); // 'o' is invalid
    });

    it('should handle uppercase', () => {
      expect(isValidGeohash('DR5REGW')).toBe(true);
    });

    it('should reject geohashes longer than 12', () => {
      expect(isValidGeohash('dr5regwdr5regw')).toBe(false);
    });
  });

  describe('contains', () => {
    it('should return true when parent contains child', () => {
      expect(contains('dr5r', 'dr5regw')).toBe(true);
      expect(contains('dr5', 'dr5regw')).toBe(true);
      expect(contains('d', 'dr5regw')).toBe(true);
    });

    it('should return false when parent does not contain child', () => {
      expect(contains('9q8y', 'dr5regw')).toBe(false);
    });

    it('should handle same geohash', () => {
      expect(contains('dr5regw', 'dr5regw')).toBe(true);
    });
  });

  describe('overlaps', () => {
    it('should return true for overlapping geohashes', () => {
      expect(overlaps('dr5r', 'dr5regw')).toBe(true);
      expect(overlaps('dr5regw', 'dr5r')).toBe(true);
    });

    it('should return false for non-overlapping geohashes', () => {
      expect(overlaps('9q8y', 'dr5r')).toBe(false);
    });
  });
});

// ============================================================================
// Distance Tests
// ============================================================================

describe('Distance Calculations', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points', () => {
      const nyc: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
      const sf: Coordinates = { latitude: 37.7749, longitude: -122.4194 };

      const distance = calculateDistance(nyc, sf);

      // NYC to SF is approximately 4130km
      expect(distance).toBeGreaterThan(4000000);
      expect(distance).toBeLessThan(4500000);
    });

    it('should return 0 for same point', () => {
      const point: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
      const distance = calculateDistance(point, point);
      expect(distance).toBe(0);
    });
  });

  describe('distanceBetweenGeohashes', () => {
    it('should calculate distance between geohash centers', () => {
      const distance = distanceBetweenGeohashes('dr5r', '9q8y');
      expect(distance).toBeGreaterThan(0);
    });
  });

  describe('isWithinGeohash', () => {
    it('should return true for point inside geohash', () => {
      const geohash = encode(40.7128, -74.0060, 6);
      const coords: Coordinates = { latitude: 40.7128, longitude: -74.0060 };

      expect(isWithinGeohash(coords, geohash)).toBe(true);
    });

    it('should return false for point outside geohash', () => {
      const geohash = encode(40.7128, -74.0060, 6);
      const coords: Coordinates = { latitude: 37.7749, longitude: -122.4194 };

      expect(isWithinGeohash(coords, geohash)).toBe(false);
    });
  });
});

// ============================================================================
// Location Channel Tests
// ============================================================================

describe('Location Channel Management', () => {
  beforeEach(() => {
    cleanupLocationServices();
  });

  afterEach(() => {
    cleanupLocationServices();
  });

  describe('Constants', () => {
    it('should use event kind 20000', () => {
      expect(LOCATION_EVENT_KIND).toBe(20000);
    });

    it('should use precision 6 as default', () => {
      expect(DEFAULT_LOCATION_PRECISION).toBe(6);
    });
  });

  describe('isGeolocationAvailable', () => {
    it('should return true in test environment (mocked)', () => {
      // Our test setup mocks navigator.geolocation
      expect(isGeolocationAvailable()).toBe(true);
    });
  });

  describe('getLocationState', () => {
    it('should return initial state', () => {
      const state = getLocationState();

      expect(state.coordinates).toBeNull();
      expect(state.geohash).toBeNull();
      expect(state.precision).toBe(DEFAULT_LOCATION_PRECISION);
      expect(state.isWatching).toBe(false);
    });
  });

  describe('setLocationPrecision', () => {
    it('should update precision', () => {
      setLocationPrecision(8);
      expect(getLocationState().precision).toBe(8);
    });

    it('should throw error for invalid precision', () => {
      expect(() => setLocationPrecision(0)).toThrow();
      expect(() => setLocationPrecision(13)).toThrow();
    });
  });
});

// ============================================================================
// Privacy Tests
// ============================================================================

describe('Privacy Utilities', () => {
  describe('reduceLocationPrecision', () => {
    it('should reduce precision for privacy', () => {
      const coords: Coordinates = { latitude: 40.7128, longitude: -74.0060 };
      const reduced = reduceLocationPrecision(coords, 5);

      expect(reduced).toHaveLength(5);
    });
  });

  describe('getAnonymousGeohash', () => {
    it('should reduce to city precision', () => {
      const anonymous = getAnonymousGeohash('dr5regw');
      expect(anonymous).toHaveLength(PRECISION_LEVELS.CITY);
    });
  });

  describe('isPrivacySafePrecision', () => {
    it('should return true for low precision', () => {
      expect(isPrivacySafePrecision('dr5r', 5)).toBe(true);
      expect(isPrivacySafePrecision('dr5', 5)).toBe(true);
    });

    it('should return false for high precision', () => {
      expect(isPrivacySafePrecision('dr5regwx', 5)).toBe(false);
    });
  });
});

// ============================================================================
// Filter Tests
// ============================================================================

describe('Location Filters', () => {
  describe('createLocationFilter', () => {
    it('should create filter with geohash tag', () => {
      const filters = createLocationFilter('dr5regw');

      expect(filters).toHaveLength(1);
      const filter = filters[0];
      expect(filter).toBeDefined();
      expect(filter!.kinds).toContain(LOCATION_EVENT_KIND);
      expect(filter!['#g']).toContain('dr5regw');
    });

    it('should include neighbors when option is set', () => {
      const filters = createLocationFilter('dr5regw', { includeNeighbors: true });

      const filter = filters[0];
      expect(filter).toBeDefined();
      expect(filter!['#g']).toHaveLength(9);
      expect(filter!['#g']).toContain('dr5regw');
    });
  });

  describe('createMultiPrecisionFilter', () => {
    it('should create filter with multiple precisions', () => {
      const filters = createMultiPrecisionFilter('dr5regw', [4, 5, 6]);

      expect(filters).toHaveLength(1);
      const filter = filters[0];
      expect(filter).toBeDefined();
      expect(filter!['#g']).toHaveLength(3);
    });
  });
});

// ============================================================================
// Event Tests
// ============================================================================

describe('Location Events', () => {
  // Mock pubkey for testing
  const mockPubkey = '79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';

  /**
   * Create a mock location event without actual signing
   * This avoids the nostr-tools dependency in tests
   */
  function createMockLocationEvent(options: {
    text: string;
    displayName?: string;
    geohash: string;
    pubkey: string;
    anonymousMode?: boolean;
  }): NostrEvent {
    const finalGeohash = options.anonymousMode
      ? options.geohash.substring(0, PRECISION_LEVELS.CITY)
      : options.geohash;

    const content = {
      text: options.text,
      displayName: options.displayName,
      timestamp: Date.now(),
      client: 'bitchat-web',
    };

    return {
      id: 'mock_event_id_' + Math.random().toString(36).substring(7),
      pubkey: options.pubkey,
      created_at: Math.floor(Date.now() / 1000),
      kind: LOCATION_EVENT_KIND,
      tags: [['g', finalGeohash]],
      content: JSON.stringify(content),
      sig: 'mock_signature',
    };
  }

  describe('parseLocationEvent', () => {
    it('should parse valid location event', () => {
      const event = createMockLocationEvent({
        text: 'Test message',
        displayName: 'Tester',
        geohash: 'dr5regw',
        pubkey: mockPubkey,
      });

      const message = parseLocationEvent(event);

      expect(message).not.toBeNull();
      expect(message!.text).toBe('Test message');
      expect(message!.displayName).toBe('Tester');
      expect(message!.geohash).toBe('dr5regw');
    });

    it('should return null for wrong event kind', () => {
      const event: NostrEvent = {
        id: 'test',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 1, // Wrong kind
        tags: [['g', 'dr5regw']],
        content: '{}',
        sig: 'test',
      };

      const message = parseLocationEvent(event);
      expect(message).toBeNull();
    });

    it('should return null for event without geohash tag', () => {
      const event: NostrEvent = {
        id: 'test',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: LOCATION_EVENT_KIND,
        tags: [], // No geohash tag
        content: '{}',
        sig: 'test',
      };

      const message = parseLocationEvent(event);
      expect(message).toBeNull();
    });

    it('should detect own messages', () => {
      const event = createMockLocationEvent({
        text: 'My message',
        geohash: 'dr5regw',
        pubkey: mockPubkey,
      });

      const message = parseLocationEvent(event, mockPubkey);
      expect(message!.isOwn).toBe(true);
    });

    it('should handle plain text content', () => {
      const event: NostrEvent = {
        id: 'test',
        pubkey: mockPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: LOCATION_EVENT_KIND,
        tags: [['g', 'dr5regw']],
        content: 'Plain text message',
        sig: 'test',
      };

      const message = parseLocationEvent(event);
      expect(message!.text).toBe('Plain text message');
      expect(message!.displayName).toBe('Anonymous');
    });
  });

  describe('filterEventsByGeohash', () => {
    it('should filter events by geohash prefix', () => {
      const events: NostrEvent[] = [
        createMockLocationEvent({
          text: 'NYC',
          geohash: 'dr5regw',
          pubkey: mockPubkey,
        }),
        createMockLocationEvent({
          text: 'SF',
          geohash: '9q8yyk',
          pubkey: mockPubkey,
        }),
      ];

      const filtered = filterEventsByGeohash(events, 'dr5');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('mock event geohash handling', () => {
    it('should create event with correct geohash', () => {
      const event = createMockLocationEvent({
        text: 'Hello!',
        geohash: 'dr5regw',
        pubkey: mockPubkey,
      });

      expect(event.kind).toBe(LOCATION_EVENT_KIND);
      const gTag = event.tags.find((t) => t[0] === 'g');
      expect(gTag).toBeDefined();
      expect(gTag![1]).toBe('dr5regw');
    });

    it('should reduce precision in anonymous mode', () => {
      const event = createMockLocationEvent({
        text: 'Hello!',
        geohash: 'dr5regw',
        pubkey: mockPubkey,
        anonymousMode: true,
      });

      const gTag = event.tags.find((t) => t[0] === 'g');
      expect(gTag![1]).toHaveLength(PRECISION_LEVELS.CITY);
    });

    it('should include display name in content', () => {
      const event = createMockLocationEvent({
        text: 'Hello!',
        displayName: 'TestUser',
        geohash: 'dr5regw',
        pubkey: mockPubkey,
      });

      const content = JSON.parse(event.content);
      expect(content.displayName).toBe('TestUser');
    });
  });
});

// ============================================================================
// Channel Data Tests
// ============================================================================

describe('Channel Data Generation', () => {
  describe('generateLocationChannelId', () => {
    it('should generate prefixed ID', () => {
      const id = generateLocationChannelId('dr5regw');
      expect(id).toBe('location:dr5regw');
    });
  });

  describe('generateLocationChannelName', () => {
    it('should generate readable name', () => {
      const name = generateLocationChannelName('dr5regw');
      expect(name).toContain('DR5REGW');
    });
  });

  describe('createLocationChannelData', () => {
    it('should create channel object', () => {
      const data = createLocationChannelData('dr5regw');

      expect(data.id).toBe('location:dr5regw');
      expect(data.type).toBe('location');
      expect(data.geohash).toBe('dr5regw');
      expect(data.geohashPrecision).toBe(7);
    });
  });
});

// ============================================================================
// Precision Level Constants Tests
// ============================================================================

describe('Precision Level Constants', () => {
  it('should have correct values', () => {
    expect(PRECISION_LEVELS.CONTINENT).toBe(1);
    expect(PRECISION_LEVELS.COUNTRY).toBe(2);
    expect(PRECISION_LEVELS.REGION).toBe(3);
    expect(PRECISION_LEVELS.METRO).toBe(4);
    expect(PRECISION_LEVELS.CITY).toBe(5);
    expect(PRECISION_LEVELS.NEIGHBORHOOD).toBe(6);
    expect(PRECISION_LEVELS.BLOCK).toBe(7);
    expect(PRECISION_LEVELS.BUILDING).toBe(8);
    expect(PRECISION_LEVELS.ROOM).toBe(9);
    expect(PRECISION_LEVELS.PRECISE).toBe(10);
    expect(PRECISION_LEVELS.VERY_PRECISE).toBe(11);
    expect(PRECISION_LEVELS.MAX).toBe(12);
  });
});
