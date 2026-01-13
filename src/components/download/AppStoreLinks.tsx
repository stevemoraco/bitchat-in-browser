/**
 * BitChat In Browser - App Store Links Component
 *
 * Displays app store links organized by region with:
 * - Search/filter by country
 * - Auto-detected user country highlight
 * - One-click copy functionality
 * - QR code generation for links
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  regionData,
  searchCountries,
  getAllRegions,
  getRegionDisplayNames,
  type CountryStoreLinks,
  type Region,
} from '../../data/app-store-links';
import {
  detectCountry,
  getPlatformInfo,
  type DetectionResult,
  type PlatformInfo,
} from '../../services/geo/country-detect';

// ============================================================================
// Types
// ============================================================================

interface AppStoreLinksProps {
  /** Optional callback when a link is clicked */
  onLinkClick?: (country: CountryStoreLinks, platform: 'ios' | 'android') => void;
  /** Show only iOS or Android links */
  platformFilter?: 'ios' | 'android' | 'both';
  /** Initial expanded regions */
  initialExpandedRegions?: Region[];
  /** Show QR codes */
  showQRCodes?: boolean;
  /** Compact mode */
  compact?: boolean;
}

// ============================================================================
// QR Code Component (simple SVG-based)
// ============================================================================

interface QRCodeDisplayProps {
  url: string;
  size?: number;
}

/**
 * Simple QR code display using a third-party service
 * In production, consider using a library like qrcode or qr.js
 */
const QRCodeDisplay: FunctionComponent<QRCodeDisplayProps> = ({
  url,
  size = 128,
}) => {
  // Using Google Charts API for QR generation (free, no API key needed)
  // In production, consider using a local library for privacy
  const qrUrl = `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encodeURIComponent(url)}&choe=UTF-8`;

  return (
    <div class="qr-code-container bg-white p-2 rounded inline-block">
      <img
        src={qrUrl}
        alt="QR Code"
        width={size}
        height={size}
        class="block"
        loading="lazy"
      />
    </div>
  );
};

// ============================================================================
// Country Row Component
// ============================================================================

interface CountryRowProps {
  country: CountryStoreLinks;
  isDetectedCountry: boolean;
  showQRCodes: boolean;
  platformFilter: 'ios' | 'android' | 'both';
  onLinkClick?: (country: CountryStoreLinks, platform: 'ios' | 'android') => void;
  compact: boolean;
}

const CountryRow: FunctionComponent<CountryRowProps> = ({
  country,
  isDetectedCountry,
  showQRCodes,
  platformFilter,
  onLinkClick,
  compact,
}) => {
  const [copiedLink, setCopiedLink] = useState<'ios' | 'android' | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [qrPlatform, setQRPlatform] = useState<'ios' | 'android'>('ios');

  const handleCopy = useCallback(
    async (url: string, platform: 'ios' | 'android') => {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedLink(platform);
        setTimeout(() => setCopiedLink(null), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    },
    []
  );

  const handleShowQR = useCallback((platform: 'ios' | 'android') => {
    setQRPlatform(platform);
    setShowQR(true);
  }, []);

  const handleLinkClick = useCallback(
    (platform: 'ios' | 'android') => {
      if (onLinkClick) {
        onLinkClick(country, platform);
      }
    },
    [country, onLinkClick]
  );

  const showIOS = platformFilter !== 'android' && country.hasIOS;
  const showAndroid = platformFilter !== 'ios' && country.hasAndroid;

  // Highlight if this is the detected country
  const rowClass = isDetectedCountry
    ? 'bg-terminal-green/10 border-l-2 border-terminal-green'
    : 'hover:bg-terminal-green/5';

  if (compact) {
    return (
      <div
        class={`flex items-center justify-between py-2 px-3 ${rowClass} text-sm`}
      >
        <div class="flex items-center gap-2">
          <span class="text-terminal-green/50 uppercase text-xs w-6">
            {country.code}
          </span>
          <span>{country.name}</span>
          {isDetectedCountry && (
            <span class="text-xs text-terminal-green bg-terminal-green/20 px-1 rounded">
              YOUR LOCATION
            </span>
          )}
        </div>
        <div class="flex items-center gap-2">
          {showIOS && (
            <a
              href={country.ios}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLinkClick('ios')}
              class="text-terminal-green hover:underline text-xs"
            >
              iOS
            </a>
          )}
          {showAndroid && (
            <a
              href={country.android}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLinkClick('android')}
              class="text-terminal-green hover:underline text-xs"
            >
              Android
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class={`py-3 px-4 ${rowClass}`}>
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-medium">{country.name}</span>
            <span class="text-terminal-green/50 text-sm uppercase">
              ({country.code})
            </span>
            {isDetectedCountry && (
              <span class="text-xs text-terminal-green bg-terminal-green/20 px-2 py-0.5 rounded">
                YOUR LOCATION
              </span>
            )}
          </div>

          {/* Store availability */}
          <div class="text-xs text-terminal-green/50 mt-1">
            {country.hasIOS && country.hasAndroid
              ? 'Available on iOS & Android'
              : country.hasIOS
                ? 'iOS only'
                : country.hasAndroid
                  ? 'Android only'
                  : 'Not available'}
          </div>
        </div>

        <div class="flex items-center gap-2">
          {!country.hasIOS && !country.hasAndroid && (
            <span class="text-terminal-green/30 text-sm">Unavailable</span>
          )}
        </div>
      </div>

      {/* Links row */}
      {(showIOS || showAndroid) && (
        <div class="flex flex-wrap gap-4 mt-3">
          {showIOS && (
            <div class="flex items-center gap-2">
              <a
                href={country.ios}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleLinkClick('ios')}
                class="inline-flex items-center gap-1 px-3 py-1.5 border border-terminal-green/50 hover:border-terminal-green text-terminal-green text-sm transition-colors"
              >
                <AppleIcon class="w-4 h-4" />
                App Store
              </a>
              <button
                onClick={() => handleCopy(country.ios, 'ios')}
                class="p-1.5 text-terminal-green/50 hover:text-terminal-green transition-colors"
                title="Copy link"
              >
                {copiedLink === 'ios' ? (
                  <CheckIcon class="w-4 h-4" />
                ) : (
                  <CopyIcon class="w-4 h-4" />
                )}
              </button>
              {showQRCodes && (
                <button
                  onClick={() => handleShowQR('ios')}
                  class="p-1.5 text-terminal-green/50 hover:text-terminal-green transition-colors"
                  title="Show QR code"
                >
                  <QRIcon class="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {showAndroid && (
            <div class="flex items-center gap-2">
              <a
                href={country.android}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleLinkClick('android')}
                class="inline-flex items-center gap-1 px-3 py-1.5 border border-terminal-green/50 hover:border-terminal-green text-terminal-green text-sm transition-colors"
              >
                <AndroidIcon class="w-4 h-4" />
                Play Store
              </a>
              <button
                onClick={() => handleCopy(country.android, 'android')}
                class="p-1.5 text-terminal-green/50 hover:text-terminal-green transition-colors"
                title="Copy link"
              >
                {copiedLink === 'android' ? (
                  <CheckIcon class="w-4 h-4" />
                ) : (
                  <CopyIcon class="w-4 h-4" />
                )}
              </button>
              {showQRCodes && (
                <button
                  onClick={() => handleShowQR('android')}
                  class="p-1.5 text-terminal-green/50 hover:text-terminal-green transition-colors"
                  title="Show QR code"
                >
                  <QRIcon class="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      {showQR && (
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div class="bg-terminal-bg border border-terminal-green rounded-lg p-6 max-w-sm w-full">
            <div class="flex justify-between items-center mb-4">
              <h3 class="font-bold">
                Scan QR Code - {qrPlatform === 'ios' ? 'App Store' : 'Play Store'}
              </h3>
              <button
                onClick={() => setShowQR(false)}
                class="text-terminal-green/50 hover:text-terminal-green"
              >
                <CloseIcon class="w-5 h-5" />
              </button>
            </div>
            <div class="flex justify-center">
              <QRCodeDisplay
                url={qrPlatform === 'ios' ? country.ios : country.android}
                size={200}
              />
            </div>
            <p class="text-center text-sm text-terminal-green/70 mt-4">
              {country.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Region Section Component
// ============================================================================

interface RegionSectionProps {
  regionName: string;
  countries: CountryStoreLinks[];
  isExpanded: boolean;
  onToggle: () => void;
  detectedCountryCode: string;
  showQRCodes: boolean;
  platformFilter: 'ios' | 'android' | 'both';
  onLinkClick?: (country: CountryStoreLinks, platform: 'ios' | 'android') => void;
  compact: boolean;
}

const RegionSection: FunctionComponent<RegionSectionProps> = ({
  regionName,
  countries,
  isExpanded,
  onToggle,
  detectedCountryCode,
  showQRCodes,
  platformFilter,
  onLinkClick,
  compact,
}) => {
  const hasDetectedCountry = countries.some(
    (c) => c.code === detectedCountryCode
  );

  const filteredCountries = useMemo(() => {
    if (platformFilter === 'both') return countries;
    if (platformFilter === 'ios') return countries.filter((c) => c.hasIOS);
    return countries.filter((c) => c.hasAndroid);
  }, [countries, platformFilter]);

  return (
    <div class="border border-terminal-green/30 rounded mb-4">
      <button
        onClick={onToggle}
        class="w-full flex items-center justify-between p-4 hover:bg-terminal-green/5 transition-colors"
      >
        <div class="flex items-center gap-3">
          <ChevronIcon
            class={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
          />
          <span class="font-bold">{regionName}</span>
          <span class="text-terminal-green/50 text-sm">
            ({filteredCountries.length} countries)
          </span>
          {hasDetectedCountry && (
            <span class="text-xs text-terminal-green bg-terminal-green/20 px-2 py-0.5 rounded">
              YOUR REGION
            </span>
          )}
        </div>
      </button>

      {isExpanded && (
        <div class="border-t border-terminal-green/20">
          {filteredCountries.length === 0 ? (
            <p class="p-4 text-terminal-green/50 text-sm">
              No countries available for this platform filter.
            </p>
          ) : (
            filteredCountries.map((country) => (
              <CountryRow
                key={country.code}
                country={country}
                isDetectedCountry={country.code === detectedCountryCode}
                showQRCodes={showQRCodes}
                platformFilter={platformFilter}
                onLinkClick={onLinkClick}
                compact={compact}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const AppStoreLinks: FunctionComponent<AppStoreLinksProps> = ({
  onLinkClick,
  platformFilter = 'both',
  initialExpandedRegions,
  showQRCodes = true,
  compact = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRegions, setExpandedRegions] = useState<Set<Region>>(
    new Set(initialExpandedRegions || [])
  );
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);

  // Detect user's country and platform on mount
  useEffect(() => {
    const detected = detectCountry();
    const platform = getPlatformInfo();
    setDetection(detected);
    setPlatformInfo(platform);

    // Auto-expand the region containing user's country
    if (detected.country) {
      const region = Object.entries(regionData).find(([_, data]) =>
        data.countries.some((c) => c.code === detected.countryCode)
      );
      if (region) {
        setExpandedRegions((prev) => new Set([...prev, region[0] as Region]));
      }
    }
  }, []);

  const handleRegionToggle = useCallback((region: Region) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedRegions(new Set(getAllRegions()));
  }, []);

  const handleCollapseAll = useCallback(() => {
    setExpandedRegions(new Set());
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchCountries(searchQuery);
  }, [searchQuery]);

  const regionDisplayNames = getRegionDisplayNames();

  if (!platformInfo) {
    return (
      <div class="p-4 text-center text-terminal-green/50">
        Loading...
      </div>
    );
  }

  return (
    <div class="app-store-links">
      {/* Header with detected info */}
      {detection && (
        <div class="mb-6 p-4 border border-terminal-green/30 rounded bg-terminal-green/5">
          <div class="flex items-center gap-2 text-sm">
            <LocationIcon class="w-4 h-4 text-terminal-green" />
            <span>
              Detected location:{' '}
              <strong>{detection.country?.name || 'Unknown'}</strong>
            </span>
            <span class="text-terminal-green/50">
              (via {detection.method}, {Math.round(detection.confidence * 100)}%
              confidence)
            </span>
          </div>
          <div class="flex items-center gap-2 text-sm mt-2">
            <DeviceIcon class="w-4 h-4 text-terminal-green" />
            <span>
              Your device: <strong>{platformInfo.os.toUpperCase()}</strong>{' '}
              {platformInfo.isMobile ? '(Mobile)' : platformInfo.isTablet ? '(Tablet)' : '(Desktop)'}
            </span>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div class="mb-4">
        <div class="relative">
          <SearchIcon class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-terminal-green/50" />
          <input
            type="text"
            placeholder="Search countries..."
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            class="w-full pl-10 pr-4 py-2 bg-transparent border border-terminal-green/30 rounded focus:border-terminal-green outline-none text-terminal-green placeholder:text-terminal-green/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              class="absolute right-3 top-1/2 -translate-y-1/2 text-terminal-green/50 hover:text-terminal-green"
            >
              <CloseIcon class="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expand/Collapse controls */}
      {!searchQuery && (
        <div class="flex gap-4 mb-4 text-sm">
          <button
            onClick={handleExpandAll}
            class="text-terminal-green/70 hover:text-terminal-green"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            class="text-terminal-green/70 hover:text-terminal-green"
          >
            Collapse All
          </button>
        </div>
      )}

      {/* Search results */}
      {searchResults !== null ? (
        <div class="search-results">
          <h3 class="font-bold mb-3">
            Search Results ({searchResults.length})
          </h3>
          {searchResults.length === 0 ? (
            <p class="text-terminal-green/50">
              No countries found matching "{searchQuery}"
            </p>
          ) : (
            <div class="border border-terminal-green/30 rounded">
              {searchResults.map((country) => (
                <CountryRow
                  key={country.code}
                  country={country}
                  isDetectedCountry={country.code === detection?.countryCode}
                  showQRCodes={showQRCodes}
                  platformFilter={platformFilter}
                  onLinkClick={onLinkClick}
                  compact={compact}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Region sections */
        <div class="regions">
          {getAllRegions().map((region) => (
            <RegionSection
              key={region}
              regionName={regionDisplayNames[region]}
              countries={regionData[region].countries}
              isExpanded={expandedRegions.has(region)}
              onToggle={() => handleRegionToggle(region)}
              detectedCountryCode={detection?.countryCode || ''}
              showQRCodes={showQRCodes}
              platformFilter={platformFilter}
              onLinkClick={onLinkClick}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Icons
// ============================================================================

const SearchIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const CloseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const ChevronIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M9 5l7 7-7 7"
    />
  </svg>
);

const CopyIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
    />
  </svg>
);

const CheckIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const QRIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
    />
  </svg>
);

const AppleIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
);

const AndroidIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85a.637.637 0 00-.83.22l-1.88 3.24a11.463 11.463 0 00-8.94 0L5.65 5.67a.643.643 0 00-.87-.2c-.28.18-.37.54-.22.83L6.4 9.48A10.78 10.78 0 001 18h22a10.78 10.78 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
  </svg>
);

const LocationIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const DeviceIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
    />
  </svg>
);

// ============================================================================
// Exports
// ============================================================================

export default AppStoreLinks;
