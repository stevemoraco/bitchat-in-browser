/**
 * Channels Service Module
 *
 * Provides channel management services including location-based channels.
 */

// Geohash utilities
export {
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
  PRECISION_METERS,
} from './geohash';

export type {
  Coordinates,
  BoundingBox,
  DecodedGeohash,
  Direction,
  Neighbors,
  PrecisionLevel,
} from './geohash';

// Location channel management
export {
  // Constants
  LOCATION_EVENT_KIND,
  DEFAULT_LOCATION_PRECISION,
  LOCATION_UPDATE_THROTTLE,
  LOCATION_CACHE_MAX_AGE,
  GEOLOCATION_TIMEOUT,
  GEOLOCATION_MAX_ATTEMPTS,
  // Geolocation API
  isGeolocationAvailable,
  checkLocationPermission,
  requestLocationPermission,
  getCurrentLocation,
  watchLocation,
  stopWatchingLocation,
  // State management
  getLocationState,
  onLocationStateChange,
  setLocationPrecision,
  // Privacy
  reduceLocationPrecision,
  getAnonymousGeohash,
  isPrivacySafePrecision,
  // Filters
  createLocationFilter,
  createMultiPrecisionFilter,
  // Subscriptions
  subscribeToLocationChannel,
  subscribeToMultiplePrecisions,
  // Events
  createLocationEvent,
  publishLocationMessage,
  parseLocationEvent,
  filterEventsByGeohash,
  // Channel utilities
  generateLocationChannelId,
  generateLocationChannelName,
  createLocationChannelData,
  // Cleanup
  cleanupLocationServices,
} from './location';

export type {
  LocationPermission,
  LocationChannelOptions,
  LocationEventContent,
  LocationMessage,
  LocationState,
  CreateLocationEventOptions,
  GeolocationWatcherOptions,
} from './location';
