/**
 * LocationChannelCreate - Create location-based channel component
 *
 * Features:
 * - Current location detection
 * - Precision selector (neighborhood, city, region)
 * - Preview of channel coverage (text-based)
 * - Create button
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { useChannelsStore, createChannel } from '../../stores/channels-store';

// ============================================================================
// Types
// ============================================================================

interface LocationChannelCreateProps {
  /** Callback when channel is created */
  onCreated?: (channelId: string) => void;
  /** Callback when modal is closed */
  onClose?: () => void;
  /** Whether the modal is visible */
  isOpen?: boolean;
}

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  error: string | null;
  loading: boolean;
}

interface PrecisionOption {
  value: number;
  label: string;
  description: string;
  coverage: string;
}

// ============================================================================
// Constants
// ============================================================================

const PRECISION_OPTIONS: PrecisionOption[] = [
  {
    value: 3,
    label: 'Region',
    description: 'Large area coverage',
    coverage: '~156km x 156km',
  },
  {
    value: 4,
    label: 'Area',
    description: 'City/metropolitan area',
    coverage: '~39km x 19km',
  },
  {
    value: 5,
    label: 'City',
    description: 'City-level coverage',
    coverage: '~4.9km x 4.9km',
  },
  {
    value: 6,
    label: 'Neighborhood',
    description: 'Local neighborhood',
    coverage: '~1.2km x 0.6km',
  },
  {
    value: 7,
    label: 'Block',
    description: 'City block area',
    coverage: '~153m x 153m',
  },
  {
    value: 8,
    label: 'Building',
    description: 'Building/venue level',
    coverage: '~38m x 19m',
  },
];

// ============================================================================
// Geohash Encoding
// ============================================================================

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode latitude and longitude to geohash
 */
function encodeGeohash(lat: number, lon: number, precision: number): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';
  let latMin = -90;
  let latMax = 90;
  let lonMin = -180;
  let lonMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      const lonMid = (lonMin + lonMax) / 2;
      if (lon >= lonMid) {
        idx = idx * 2 + 1;
        lonMin = lonMid;
      } else {
        idx = idx * 2;
        lonMax = lonMid;
      }
    } else {
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

/**
 * Get human-readable location name based on precision
 */
function getLocationName(geohash: string, precision: number): string {
  const precisionOption = PRECISION_OPTIONS.find((p) => p.value === precision);
  const label = precisionOption?.label || 'Area';
  // In production, this would reverse geocode to get actual location names
  return `${label} ${geohash.slice(0, Math.min(precision, 4)).toUpperCase()}`;
}

// ============================================================================
// Icons
// ============================================================================

/** Location/crosshairs icon */
const CrosshairsIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="22" y1="12" x2="18" y2="12" />
    <line x1="6" y1="12" x2="2" y2="12" />
    <line x1="12" y1="6" x2="12" y2="2" />
    <line x1="12" y1="22" x2="12" y2="18" />
  </svg>
);

/** Close/X icon */
const CloseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/** Refresh icon */
const RefreshIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="23,4 23,10 17,10" />
    <polyline points="1,20 1,14 7,14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

/** Map pin icon */
const MapPinIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

export const LocationChannelCreate: FunctionComponent<LocationChannelCreateProps> = ({
  onCreated,
  onClose,
  isOpen = true,
}) => {
  const [precision, setPrecision] = useState(6); // Default to neighborhood
  const [geolocation, setGeolocation] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    error: null,
    loading: false,
  });
  const [isCreating, setIsCreating] = useState(false);

  const addChannel = useChannelsStore((state) => state.addChannel);

  // Request geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeolocation({
        latitude: null,
        longitude: null,
        error: 'Geolocation not supported by your browser',
        loading: false,
      });
      return;
    }

    setGeolocation((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeolocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (error) => {
        let errorMessage = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }
        setGeolocation({
          latitude: null,
          longitude: null,
          error: errorMessage,
          loading: false,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, []);

  // Request location on mount
  useEffect(() => {
    if (isOpen) {
      requestLocation();
    }
  }, [isOpen, requestLocation]);

  // Computed geohash
  const geohash =
    geolocation.latitude !== null && geolocation.longitude !== null
      ? encodeGeohash(geolocation.latitude, geolocation.longitude, precision)
      : null;

  // Handle channel creation
  const handleCreate = useCallback(async () => {
    if (!geohash) return;

    setIsCreating(true);

    try {
      const channelId = `loc-${geohash}`;
      const channelName = getLocationName(geohash, precision);

      const channel = createChannel({
        id: channelId,
        name: channelName,
        type: 'location',
        geohash,
        geohashPrecision: precision,
        description: `Location channel for ${channelName}`,
      });

      addChannel(channel);
      onCreated?.(channelId);
      onClose?.();
    } catch (error) {
      console.error('Failed to create channel:', error);
    } finally {
      setIsCreating(false);
    }
  }, [geohash, precision, addChannel, onCreated, onClose]);

  // Handle precision change
  const handlePrecisionChange = useCallback((value: number) => {
    setPrecision(value);
  }, []);

  if (!isOpen) return null;

  const selectedPrecision = PRECISION_OPTIONS.find((p) => p.value === precision);

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div
        class="modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-channel-title"
      >
        {/* Header */}
        <div class="modal-header">
          <h2 id="create-channel-title" class="modal-title">
            &gt; Create Location Channel
          </h2>
          <button
            type="button"
            onClick={onClose}
            class="modal-close"
            aria-label="Close"
          >
            <CloseIcon class="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div class="modal-body space-y-6">
          {/* Location Status */}
          <div class="card-terminal">
            <div class="flex items-start gap-3">
              <div class="flex-shrink-0 mt-0.5">
                <CrosshairsIcon class="w-5 h-5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-terminal-sm font-bold text-text mb-1">
                  Current Location
                </h3>

                {geolocation.loading ? (
                  <div class="flex items-center gap-2 text-terminal-sm text-muted">
                    <span class="loading-dots">
                      <span />
                      <span />
                      <span />
                    </span>
                    <span>Detecting location...</span>
                  </div>
                ) : geolocation.error ? (
                  <div class="space-y-2">
                    <p class="text-terminal-sm text-error">
                      {geolocation.error}
                    </p>
                    <button
                      type="button"
                      onClick={requestLocation}
                      class="btn-terminal btn-terminal-sm"
                    >
                      <RefreshIcon class="w-4 h-4" />
                      <span>Retry</span>
                    </button>
                  </div>
                ) : (
                  <div class="space-y-1">
                    <p class="text-terminal-xs text-muted font-mono">
                      {geolocation.latitude?.toFixed(6)},{' '}
                      {geolocation.longitude?.toFixed(6)}
                    </p>
                    {geohash && (
                      <p class="text-terminal-sm text-primary font-mono">
                        Geohash: {geohash}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {!geolocation.loading && !geolocation.error && (
                <button
                  type="button"
                  onClick={requestLocation}
                  class="p-2 text-muted hover:text-primary transition-colors"
                  aria-label="Refresh location"
                >
                  <RefreshIcon class="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Precision Selector */}
          <div>
            <label class="form-label">Channel Coverage</label>
            <div class="grid grid-cols-2 gap-2 mt-2">
              {PRECISION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePrecisionChange(option.value)}
                  class={`p-3 text-left border rounded-terminal transition-all ${
                    precision === option.value
                      ? 'border-primary bg-primary/10'
                      : 'border-muted hover:border-muted/80 bg-transparent'
                  }`}
                >
                  <span
                    class={`block text-terminal-sm font-bold ${
                      precision === option.value ? 'text-primary' : 'text-text'
                    }`}
                  >
                    {option.label}
                  </span>
                  <span class="block text-terminal-xs text-muted mt-0.5">
                    {option.coverage}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {geohash && selectedPrecision && (
            <div class="card-terminal-highlight">
              <div class="flex items-center gap-2 mb-2">
                <MapPinIcon class="w-4 h-4 text-primary" />
                <span class="text-terminal-sm font-bold text-primary">
                  Channel Preview
                </span>
              </div>
              <div class="space-y-2 text-terminal-sm">
                <div class="flex justify-between">
                  <span class="text-muted">Name:</span>
                  <span class="text-text font-mono">
                    {getLocationName(geohash, precision)}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted">Coverage:</span>
                  <span class="text-text">
                    {selectedPrecision.description}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted">Area:</span>
                  <span class="text-text font-mono">
                    {selectedPrecision.coverage}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-muted">Geohash:</span>
                  <span class="text-primary font-mono">{geohash}</span>
                </div>
              </div>

              {/* Visual Coverage Indicator */}
              <div class="mt-4 pt-4 border-t border-muted/30">
                <div class="text-terminal-xs text-muted mb-2">
                  Coverage Visualization
                </div>
                <div class="relative h-16 bg-surface border border-muted/30 rounded-terminal overflow-hidden">
                  {/* Grid lines */}
                  <div class="absolute inset-0 grid grid-cols-8 grid-rows-4">
                    {Array.from({ length: 32 }).map((_, i) => (
                      <div
                        key={i}
                        class="border border-muted/10"
                      />
                    ))}
                  </div>
                  {/* Center point */}
                  <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div class="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  </div>
                  {/* Coverage area - scales with precision */}
                  <div
                    class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 border-primary/50 bg-primary/10 rounded"
                    style={{
                      width: `${Math.max(10, 100 - (precision - 3) * 15)}%`,
                      height: `${Math.max(20, 100 - (precision - 3) * 12)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div class="modal-footer">
          <button
            type="button"
            onClick={onClose}
            class="btn-terminal-ghost"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!geohash || isCreating}
            class="btn-terminal"
          >
            {isCreating ? (
              <>
                <span class="loading-dots">
                  <span />
                  <span />
                  <span />
                </span>
                <span>Creating...</span>
              </>
            ) : (
              <>
                <MapPinIcon class="w-4 h-4" />
                <span>Create Channel</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationChannelCreate;
