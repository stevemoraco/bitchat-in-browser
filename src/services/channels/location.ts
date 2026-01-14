/**
 * Location-Based Channels Service
 *
 * Provides location-based channel management for BitChat In Browser PWA.
 * Compatible with iOS/Android BitChat location channels using the same
 * geohash format and event structure (kind 20000).
 *
 * Features:
 * - Geolocation API integration with privacy controls
 * - Multi-precision location channels
 * - Anonymous mode support (no pubkey linking)
 * - Event creation and subscription for location channels
 *
 * @see CLAUDE.md for compatibility requirements with native apps
 */

import { NostrEventKind, type NostrEvent, type NostrFilter, type Subscription, type EventHandler } from '../nostr/types';
import { nostrClient, createEvent, signEvent, getTagValue } from '../nostr';
import {
  encode,
  decode,
  getGeohashesInRadius,
  reducePrecision,
  getPrecision,
  getPrecisionDescription,
  contains,
  PRECISION_LEVELS,
  type Coordinates,
} from './geohash';

// Re-export geohash utilities for convenience
export * from './geohash';

// ============================================================================
// Constants
// ============================================================================

/**
 * Event kind for location-based ephemeral messages
 * Must match iOS/Android BitChat for interoperability
 */
export const LOCATION_EVENT_KIND = NostrEventKind.EphemeralEvent; // 20000

/**
 * Default precision for location channels (neighborhood level ~1.2km)
 * Matches BitChat iOS/Android default
 */
export const DEFAULT_LOCATION_PRECISION = PRECISION_LEVELS.NEIGHBORHOOD; // 6

/**
 * Minimum time between location updates (ms)
 * Prevents excessive API calls and battery drain
 */
export const LOCATION_UPDATE_THROTTLE = 30000; // 30 seconds

/**
 * Maximum age for cached location (ms)
 */
export const LOCATION_CACHE_MAX_AGE = 60000; // 1 minute

/**
 * Geolocation API timeout (ms)
 */
export const GEOLOCATION_TIMEOUT = 10000; // 10 seconds

/**
 * Maximum attempts for location fetch
 */
export const GEOLOCATION_MAX_ATTEMPTS = 3;

// ============================================================================
// Types
// ============================================================================

/**
 * Location permission status
 */
export type LocationPermission = 'granted' | 'denied' | 'prompt' | 'unavailable';

/**
 * Location channel subscription options
 */
export interface LocationChannelOptions {
  /** Geohash precision (1-12) */
  precision?: number;
  /** Whether to include neighboring cells */
  includeNeighbors?: boolean;
  /** Specific relay URLs to use */
  relayUrls?: string[];
  /** Callback when EOSE is received */
  onEose?: () => void;
}

/**
 * Location event content structure
 * Compatible with BitChat iOS/Android
 */
export interface LocationEventContent {
  /** Message text */
  text: string;
  /** Optional display name (anonymous if not provided) */
  displayName?: string;
  /** Timestamp when message was created */
  timestamp: number;
  /** Client identifier */
  client?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Parsed location event
 */
export interface LocationMessage {
  /** Nostr event ID */
  id: string;
  /** Message text */
  text: string;
  /** Display name (or "Anonymous") */
  displayName: string;
  /** Sender's pubkey */
  pubkey: string;
  /** Geohash from event */
  geohash: string;
  /** Event timestamp */
  timestamp: number;
  /** Is from the current user */
  isOwn: boolean;
  /** Original Nostr event */
  event: NostrEvent;
}

/**
 * Current location state
 */
export interface LocationState {
  /** Current coordinates */
  coordinates: Coordinates | null;
  /** Current geohash at active precision */
  geohash: string | null;
  /** Current precision level */
  precision: number;
  /** Permission status */
  permission: LocationPermission;
  /** Whether location is being watched */
  isWatching: boolean;
  /** Last update timestamp */
  lastUpdated: number | null;
  /** Last error */
  error: GeolocationPositionError | null;
}

/**
 * Options for creating a location event
 */
export interface CreateLocationEventOptions {
  /** Message content */
  text: string;
  /** Display name (anonymous if not provided) */
  displayName?: string;
  /** Geohash for the message */
  geohash: string;
  /** Private key for signing (required) */
  privateKey: string | Uint8Array;
  /** Public key of the sender */
  pubkey: string;
  /** Whether to use anonymous mode (reduces precision for privacy) */
  anonymousMode?: boolean;
  /** Additional tags */
  additionalTags?: string[][];
}

/**
 * Geolocation watcher configuration
 */
export interface GeolocationWatcherOptions {
  /** Enable high accuracy mode (uses GPS on mobile) */
  enableHighAccuracy?: boolean;
  /** Maximum age of cached position (ms) */
  maximumAge?: number;
  /** Timeout for position requests (ms) */
  timeout?: number;
  /** Callback when position changes */
  onPositionChange?: (coords: Coordinates, geohash: string) => void;
  /** Callback on error */
  onError?: (error: GeolocationPositionError) => void;
  /** Precision for geohash encoding */
  precision?: number;
  /** Throttle interval (ms) */
  throttleMs?: number;
}

// ============================================================================
// Location State Management
// ============================================================================

/**
 * Current location state
 */
let locationState: LocationState = {
  coordinates: null,
  geohash: null,
  precision: DEFAULT_LOCATION_PRECISION,
  permission: 'prompt',
  isWatching: false,
  lastUpdated: null,
  error: null,
};

/**
 * Active geolocation watcher ID
 */
let watcherId: number | null = null;

/**
 * Last position update timestamp (for throttling)
 */
let lastPositionTime = 0;

/**
 * Location state change listeners
 */
const locationListeners = new Set<(state: LocationState) => void>();

/**
 * Get the current location state
 */
export function getLocationState(): LocationState {
  return { ...locationState };
}

/**
 * Subscribe to location state changes
 *
 * @param listener - Callback when state changes
 * @returns Unsubscribe function
 */
export function onLocationStateChange(listener: (state: LocationState) => void): () => void {
  locationListeners.add(listener);
  return () => locationListeners.delete(listener);
}

/**
 * Notify all listeners of state change
 */
function notifyLocationChange(): void {
  const state = getLocationState();
  const listeners = Array.from(locationListeners);
  for (let i = 0; i < listeners.length; i++) {
    try {
      const listener = listeners[i];
      if (listener) {
        listener(state);
      }
    } catch (error) {
      console.error('[Location] State listener error:', error);
    }
  }
}

/**
 * Update location state
 */
function updateLocationState(updates: Partial<LocationState>): void {
  locationState = { ...locationState, ...updates };
  notifyLocationChange();
}

// ============================================================================
// Geolocation API Integration
// ============================================================================

/**
 * Check if geolocation is available in the browser
 */
export function isGeolocationAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

/**
 * Check and request geolocation permission
 *
 * @returns Current permission status
 */
export async function checkLocationPermission(): Promise<LocationPermission> {
  if (!isGeolocationAvailable()) {
    updateLocationState({ permission: 'unavailable' });
    return 'unavailable';
  }

  // Try to use Permissions API if available
  if ('permissions' in navigator) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      const permission = result.state as LocationPermission;
      updateLocationState({ permission });
      return permission;
    } catch {
      // Permissions API not supported for geolocation
    }
  }

  // Fallback: try to get position to determine permission
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => {
        updateLocationState({ permission: 'granted' });
        resolve('granted');
      },
      (error) => {
        const permission = error.code === error.PERMISSION_DENIED ? 'denied' : 'prompt';
        updateLocationState({ permission, error });
        resolve(permission);
      },
      { timeout: 1000, maximumAge: Infinity }
    );
  });
}

/**
 * Request location permission by attempting to get current position
 *
 * @returns True if permission was granted
 */
export async function requestLocationPermission(): Promise<boolean> {
  if (!isGeolocationAvailable()) {
    updateLocationState({ permission: 'unavailable' });
    return false;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const geohash = encode(coordinates.latitude, coordinates.longitude, locationState.precision);

        updateLocationState({
          permission: 'granted',
          coordinates,
          geohash,
          lastUpdated: Date.now(),
          error: null,
        });

        resolve(true);
      },
      (error) => {
        updateLocationState({
          permission: error.code === error.PERMISSION_DENIED ? 'denied' : 'prompt',
          error,
        });
        resolve(false);
      },
      {
        enableHighAccuracy: false,
        timeout: GEOLOCATION_TIMEOUT,
        maximumAge: LOCATION_CACHE_MAX_AGE,
      }
    );
  });
}

/**
 * Get current position (one-time)
 *
 * @param options - Geolocation options
 * @returns Current coordinates and geohash
 */
export async function getCurrentLocation(
  options: {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
    precision?: number;
  } = {}
): Promise<{ coordinates: Coordinates; geohash: string }> {
  if (!isGeolocationAvailable()) {
    throw new Error('Geolocation is not available in this browser');
  }

  const precision = options.precision ?? locationState.precision;

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        const geohash = encode(coordinates.latitude, coordinates.longitude, precision);

        updateLocationState({
          permission: 'granted',
          coordinates,
          geohash,
          lastUpdated: Date.now(),
          error: null,
        });

        resolve({ coordinates, geohash });
      },
      (error) => {
        updateLocationState({ error });
        reject(error);
      },
      {
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? GEOLOCATION_TIMEOUT,
        maximumAge: options.maximumAge ?? LOCATION_CACHE_MAX_AGE,
      }
    );
  });
}

/**
 * Start watching location with throttling
 *
 * @param options - Watcher configuration
 * @returns Stop watching function
 */
export function watchLocation(options: GeolocationWatcherOptions = {}): () => void {
  if (!isGeolocationAvailable()) {
    console.error('[Location] Geolocation not available');
    return () => {};
  }

  // Stop existing watcher
  if (watcherId !== null) {
    stopWatchingLocation();
  }

  const precision = options.precision ?? locationState.precision;
  const throttleMs = options.throttleMs ?? LOCATION_UPDATE_THROTTLE;

  updateLocationState({ isWatching: true, precision });

  watcherId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now();

      // Throttle updates
      if (now - lastPositionTime < throttleMs) {
        return;
      }
      lastPositionTime = now;

      const coordinates: Coordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      const geohash = encode(coordinates.latitude, coordinates.longitude, precision);

      // Check if geohash changed (moved to different cell)
      const geohashChanged = geohash !== locationState.geohash;

      updateLocationState({
        permission: 'granted',
        coordinates,
        geohash,
        lastUpdated: now,
        error: null,
      });

      if (geohashChanged && options.onPositionChange) {
        options.onPositionChange(coordinates, geohash);
      }
    },
    (error) => {
      updateLocationState({ error });
      if (options.onError) {
        options.onError(error);
      }
    },
    {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? GEOLOCATION_TIMEOUT,
      maximumAge: options.maximumAge ?? LOCATION_CACHE_MAX_AGE,
    }
  );

  return stopWatchingLocation;
}

/**
 * Stop watching location
 */
export function stopWatchingLocation(): void {
  if (watcherId !== null) {
    navigator.geolocation.clearWatch(watcherId);
    watcherId = null;
    updateLocationState({ isWatching: false });
  }
}

/**
 * Set the active precision level
 *
 * @param precision - New precision level (1-12)
 */
export function setLocationPrecision(precision: number): void {
  if (precision < 1 || precision > 12) {
    throw new Error('Precision must be between 1 and 12');
  }

  const newGeohash = locationState.coordinates
    ? encode(locationState.coordinates.latitude, locationState.coordinates.longitude, precision)
    : null;

  updateLocationState({ precision, geohash: newGeohash });
}

// ============================================================================
// Privacy Utilities
// ============================================================================

/**
 * Reduce location precision for privacy
 *
 * @param coordinates - Original coordinates
 * @param targetPrecision - Reduced precision level
 * @returns Geohash at reduced precision
 */
export function reduceLocationPrecision(
  coordinates: Coordinates,
  targetPrecision: number = PRECISION_LEVELS.CITY
): string {
  return encode(coordinates.latitude, coordinates.longitude, targetPrecision);
}

/**
 * Get a privacy-safe geohash for anonymous mode
 * Reduces precision to city level to prevent tracking
 *
 * @param geohash - Original geohash
 * @returns Reduced precision geohash
 */
export function getAnonymousGeohash(geohash: string): string {
  return reducePrecision(geohash, PRECISION_LEVELS.CITY);
}

/**
 * Check if a geohash is at a privacy-safe precision
 *
 * @param geohash - Geohash to check
 * @param minPrecision - Minimum precision considered safe (default: CITY = 5)
 * @returns True if precision is safe
 */
export function isPrivacySafePrecision(
  geohash: string,
  minPrecision: number = PRECISION_LEVELS.CITY
): boolean {
  return getPrecision(geohash) <= minPrecision;
}

// ============================================================================
// Location Channel Management
// ============================================================================

/**
 * Create a filter for subscribing to a location channel
 *
 * @param geohash - Geohash for the location
 * @param options - Subscription options
 * @returns NostrFilter array for subscription
 */
export function createLocationFilter(
  geohash: string,
  options: LocationChannelOptions = {}
): NostrFilter[] {
  const { includeNeighbors = false } = options;

  // Get all geohashes to subscribe to
  const geohashes = includeNeighbors
    ? getGeohashesInRadius(geohash)
    : [geohash];

  // Create filter with '#g' tag for geohash matching
  // This matches the iOS/Android BitChat implementation
  return [{
    kinds: [LOCATION_EVENT_KIND],
    '#g': geohashes,
  }];
}

/**
 * Create a filter for multiple precision levels
 *
 * @param geohash - Base geohash
 * @param precisions - Array of precision levels to include
 * @returns NostrFilter array
 */
export function createMultiPrecisionFilter(
  geohash: string,
  precisions: number[]
): NostrFilter[] {
  const geohashes: string[] = [];

  for (const precision of precisions) {
    const reducedHash = reducePrecision(geohash, precision);
    geohashes.push(reducedHash);
  }

  return [{
    kinds: [LOCATION_EVENT_KIND],
    '#g': geohashes,
  }];
}

/**
 * Subscribe to a location channel
 *
 * @param geohash - Geohash for the location
 * @param onMessage - Callback when a message is received
 * @param options - Subscription options
 * @returns Subscription handle
 */
export function subscribeToLocationChannel(
  geohash: string,
  onMessage: (message: LocationMessage) => void,
  options: LocationChannelOptions = {}
): Subscription {
  const filters = createLocationFilter(geohash, options);

  const eventHandler: EventHandler = (event, _relayUrl) => {
    try {
      const message = parseLocationEvent(event);
      if (message) {
        onMessage(message);
      }
    } catch (error) {
      console.error('[Location] Failed to parse event:', error);
    }
  };

  return nostrClient.subscribe(filters, eventHandler, {
    relayUrls: options.relayUrls,
    onEose: options.onEose,
  });
}

/**
 * Subscribe to multiple precision levels simultaneously
 *
 * @param geohash - Base geohash
 * @param precisions - Precision levels to subscribe to
 * @param onMessage - Callback when a message is received
 * @param options - Subscription options
 * @returns Subscription handle
 */
export function subscribeToMultiplePrecisions(
  geohash: string,
  precisions: number[],
  onMessage: (message: LocationMessage) => void,
  options: Omit<LocationChannelOptions, 'precision'> = {}
): Subscription {
  const filters = createMultiPrecisionFilter(geohash, precisions);

  const eventHandler: EventHandler = (event, _relayUrl) => {
    try {
      const message = parseLocationEvent(event);
      if (message) {
        onMessage(message);
      }
    } catch (error) {
      console.error('[Location] Failed to parse event:', error);
    }
  };

  return nostrClient.subscribe(filters, eventHandler, {
    relayUrls: options.relayUrls,
    onEose: options.onEose,
  });
}

// ============================================================================
// Event Creation
// ============================================================================

/**
 * Create a location channel event (kind 20000)
 *
 * @param options - Event creation options
 * @returns Signed Nostr event
 */
export function createLocationEvent(options: CreateLocationEventOptions): NostrEvent {
  const {
    text,
    displayName,
    geohash,
    privateKey,
    pubkey,
    anonymousMode = false,
    additionalTags = [],
  } = options;

  // Apply privacy reduction if in anonymous mode
  const finalGeohash = anonymousMode
    ? getAnonymousGeohash(geohash)
    : geohash;

  // Create event content (JSON format for compatibility)
  const content: LocationEventContent = {
    text,
    timestamp: Date.now(),
    client: 'bitchat-web',
  };

  if (displayName) {
    content.displayName = displayName;
  }

  // Build tags array
  const tags: string[][] = [
    ['g', finalGeohash],
    ...additionalTags,
  ];

  // Create and sign the event
  const unsignedEvent = createEvent(
    LOCATION_EVENT_KIND,
    JSON.stringify(content),
    tags,
    pubkey
  );

  return signEvent(unsignedEvent, privateKey);
}

/**
 * Publish a message to a location channel
 *
 * @param options - Message options
 * @returns Publish result
 */
export async function publishLocationMessage(
  options: CreateLocationEventOptions & { relayUrls?: string[] }
): Promise<{ success: boolean; event: NostrEvent }> {
  const event = createLocationEvent(options);
  const result = await nostrClient.publish(event, options.relayUrls);

  return {
    success: result.success,
    event,
  };
}

// ============================================================================
// Event Parsing
// ============================================================================

/**
 * Parse a location event into a structured message
 *
 * @param event - Nostr event to parse
 * @param currentPubkey - Current user's pubkey (for isOwn detection)
 * @returns Parsed location message or null if invalid
 */
export function parseLocationEvent(
  event: NostrEvent,
  currentPubkey?: string
): LocationMessage | null {
  if (event.kind !== LOCATION_EVENT_KIND) {
    return null;
  }

  // Extract geohash from 'g' tag
  const geohash = getTagValue(event, 'g');
  if (!geohash) {
    return null;
  }

  // Parse content
  let content: LocationEventContent;
  try {
    content = JSON.parse(event.content);
  } catch {
    // Fallback: treat content as plain text
    content = {
      text: event.content,
      timestamp: event.created_at * 1000,
    };
  }

  return {
    id: event.id,
    text: content.text || event.content,
    displayName: content.displayName || 'Anonymous',
    pubkey: event.pubkey,
    geohash,
    timestamp: event.created_at * 1000,
    isOwn: currentPubkey ? event.pubkey === currentPubkey : false,
    event,
  };
}

/**
 * Filter location events by geohash prefix
 *
 * @param events - Events to filter
 * @param geohashPrefix - Geohash prefix to match
 * @returns Filtered events
 */
export function filterEventsByGeohash(
  events: NostrEvent[],
  geohashPrefix: string
): NostrEvent[] {
  return events.filter((event) => {
    const eventGeohash = getTagValue(event, 'g');
    return eventGeohash && contains(geohashPrefix, eventGeohash);
  });
}

// ============================================================================
// Channel Creation Utilities
// ============================================================================

/**
 * Generate a channel ID for a location channel
 *
 * @param geohash - Geohash for the channel
 * @returns Unique channel ID
 */
export function generateLocationChannelId(geohash: string): string {
  return `location:${geohash}`;
}

/**
 * Generate a display name for a location channel
 *
 * @param geohash - Geohash for the channel
 * @returns Human-readable channel name
 */
export function generateLocationChannelName(geohash: string): string {
  const precision = getPrecision(geohash);
  const sizeDescription = getPrecisionDescription(precision);

  // Get approximate center for display
  try {
    const decoded = decode(geohash);
    const lat = decoded.latitude.toFixed(2);
    const lon = decoded.longitude.toFixed(2);
    return `${geohash.toUpperCase()} (${lat}, ${lon}) ${sizeDescription}`;
  } catch {
    return `${geohash.toUpperCase()} ${sizeDescription}`;
  }
}

/**
 * Create a channel object for a location
 *
 * @param geohash - Geohash for the channel
 * @returns Channel object ready for store
 */
export function createLocationChannelData(geohash: string): {
  id: string;
  name: string;
  type: 'location';
  geohash: string;
  geohashPrecision: number;
} {
  return {
    id: generateLocationChannelId(geohash),
    name: generateLocationChannelName(geohash),
    type: 'location',
    geohash,
    geohashPrecision: getPrecision(geohash),
  };
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up all location services
 */
export function cleanupLocationServices(): void {
  stopWatchingLocation();
  locationListeners.clear();

  // Reset state
  locationState = {
    coordinates: null,
    geohash: null,
    precision: DEFAULT_LOCATION_PRECISION,
    permission: 'prompt',
    isWatching: false,
    lastUpdated: null,
    error: null,
  };
}
