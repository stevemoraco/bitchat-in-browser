/**
 * BitChat In Browser - Download Page Component
 *
 * Full page for app downloads featuring:
 * - Platform detection (show iOS links on iPhone, Android on Android)
 * - Native app benefits explanation
 * - PWA vs Native comparison
 * - All country store links
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import {
  detectCountry,
  getPlatformInfo,
  type DetectionResult,
  type PlatformInfo,
} from '../../services/geo/country-detect';
import {
  getStoreStats,
  APP_STORE_APP_NAME,
  PLAY_STORE_PACKAGE_ID,
} from '../../data/app-store-links';
import { AppStoreLinks } from './AppStoreLinks';

// ============================================================================
// Types
// ============================================================================

type TabType = 'recommended' | 'all-countries' | 'comparison';

interface DownloadPageProps {
  /** Optional callback when navigating back */
  onBack?: () => void;
  /** Show back button */
  showBackButton?: boolean;
}

// ============================================================================
// Recommended Download Section
// ============================================================================

interface RecommendedSectionProps {
  detection: DetectionResult;
  platformInfo: PlatformInfo;
}

const RecommendedSection: FunctionComponent<RecommendedSectionProps> = ({
  detection,
  platformInfo,
}) => {
  const country = detection.country;

  // Determine what to show based on platform
  const isIOS = platformInfo.os === 'ios';
  const isAndroid = platformInfo.os === 'android';
  const isMobile = platformInfo.isMobile || platformInfo.isTablet;

  return (
    <div class="recommended-section">
      {/* Hero section */}
      <div class="text-center mb-8">
        <div class="text-6xl mb-4">&gt;_</div>
        <h1 class="text-2xl font-bold mb-2">Get BitChat</h1>
        <p class="text-terminal-green/70">
          Encrypted mesh messaging for everyone
        </p>
      </div>

      {/* Platform-specific recommendation */}
      {isMobile && country && (
        <div class="bg-terminal-green/10 border border-terminal-green/30 rounded-lg p-6 mb-8">
          <div class="flex items-center gap-3 mb-4">
            {isIOS ? (
              <AppleIcon class="w-8 h-8 text-terminal-green" />
            ) : isAndroid ? (
              <AndroidIcon class="w-8 h-8 text-terminal-green" />
            ) : (
              <DeviceIcon class="w-8 h-8 text-terminal-green" />
            )}
            <div>
              <h2 class="font-bold">
                Recommended for {platformInfo.os.toUpperCase()}
              </h2>
              <p class="text-sm text-terminal-green/70">
                Based on your device and location ({country.name})
              </p>
            </div>
          </div>

          {/* Primary download button */}
          {isIOS && country.hasIOS && (
            <a
              href={country.ios}
              target="_blank"
              rel="noopener noreferrer"
              class="block w-full"
            >
              <button class="w-full py-4 px-6 bg-terminal-green text-terminal-bg font-bold rounded-lg hover:bg-terminal-green/90 transition-colors flex items-center justify-center gap-3">
                <AppleIcon class="w-6 h-6" />
                Download on the App Store
              </button>
            </a>
          )}

          {isAndroid && country.hasAndroid && (
            <a
              href={country.android}
              target="_blank"
              rel="noopener noreferrer"
              class="block w-full"
            >
              <button class="w-full py-4 px-6 bg-terminal-green text-terminal-bg font-bold rounded-lg hover:bg-terminal-green/90 transition-colors flex items-center justify-center gap-3">
                <AndroidIcon class="w-6 h-6" />
                Get it on Google Play
              </button>
            </a>
          )}

          {/* Show both options if on unknown mobile */}
          {!isIOS && !isAndroid && (
            <div class="space-y-3">
              {country.hasIOS && (
                <a
                  href={country.ios}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block"
                >
                  <button class="w-full py-3 px-6 border-2 border-terminal-green text-terminal-green font-bold rounded-lg hover:bg-terminal-green/10 transition-colors flex items-center justify-center gap-3">
                    <AppleIcon class="w-5 h-5" />
                    App Store (iOS)
                  </button>
                </a>
              )}
              {country.hasAndroid && (
                <a
                  href={country.android}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block"
                >
                  <button class="w-full py-3 px-6 border-2 border-terminal-green text-terminal-green font-bold rounded-lg hover:bg-terminal-green/10 transition-colors flex items-center justify-center gap-3">
                    <AndroidIcon class="w-5 h-5" />
                    Google Play (Android)
                  </button>
                </a>
              )}
            </div>
          )}

          {/* Unavailable notice */}
          {((isIOS && !country.hasIOS) || (isAndroid && !country.hasAndroid)) && (
            <div class="text-center py-4 text-terminal-green/50">
              <p>
                Native app not available for {platformInfo.os.toUpperCase()} in{' '}
                {country.name}.
              </p>
              <p class="mt-2">
                You can continue using the PWA (this web app) instead.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Desktop users see PWA option prominently */}
      {platformInfo.isDesktop && (
        <div class="bg-terminal-green/10 border border-terminal-green/30 rounded-lg p-6 mb-8">
          <div class="flex items-center gap-3 mb-4">
            <DesktopIcon class="w-8 h-8 text-terminal-green" />
            <div>
              <h2 class="font-bold">BitChat PWA</h2>
              <p class="text-sm text-terminal-green/70">
                Install the web app on your desktop
              </p>
            </div>
          </div>

          <p class="text-sm text-terminal-green/70 mb-4">
            You're viewing BitChat as a web app. For the best desktop experience,
            install it as a PWA:
          </p>

          <div class="bg-terminal-bg/50 rounded p-4 text-sm">
            <p class="font-bold mb-2">To install:</p>
            <ol class="list-decimal list-inside space-y-1 text-terminal-green/80">
              <li>Click the install icon in your browser's address bar</li>
              <li>Or open the browser menu and select "Install BitChat"</li>
              <li>The app will appear in your applications</li>
            </ol>
          </div>

          {country && (country.hasIOS || country.hasAndroid) && (
            <div class="mt-6 pt-6 border-t border-terminal-green/20">
              <p class="text-sm text-terminal-green/70 mb-4">
                For mobile devices, download the native app:
              </p>
              <div class="flex flex-wrap gap-4">
                {country.hasIOS && (
                  <a
                    href={country.ios}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 px-4 py-2 border border-terminal-green/50 rounded hover:border-terminal-green transition-colors"
                  >
                    <AppleIcon class="w-5 h-5" />
                    App Store
                  </a>
                )}
                {country.hasAndroid && (
                  <a
                    href={country.android}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 px-4 py-2 border border-terminal-green/50 rounded hover:border-terminal-green transition-colors"
                  >
                    <AndroidIcon class="w-5 h-5" />
                    Google Play
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PWA benefits for everyone */}
      <div class="border border-terminal-green/30 rounded-lg p-6 mb-8">
        <h3 class="font-bold mb-4 flex items-center gap-2">
          <GlobeIcon class="w-5 h-5" />
          Already Using the PWA?
        </h3>
        <p class="text-sm text-terminal-green/70 mb-4">
          You're currently using BitChat as a Progressive Web App. This works great
          and offers:
        </p>
        <ul class="text-sm space-y-2 text-terminal-green/80">
          <li class="flex items-start gap-2">
            <CheckIcon class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Works offline after first load</span>
          </li>
          <li class="flex items-start gap-2">
            <CheckIcon class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>No app store required</span>
          </li>
          <li class="flex items-start gap-2">
            <CheckIcon class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Always up to date</span>
          </li>
          <li class="flex items-start gap-2">
            <CheckIcon class="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Cross-platform compatible</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

// ============================================================================
// PWA vs Native Comparison
// ============================================================================

const ComparisonSection: FunctionComponent = () => (
    <div class="comparison-section">
      <h2 class="text-xl font-bold mb-6 text-center">PWA vs Native App</h2>

      <div class="grid md:grid-cols-2 gap-6 mb-8">
        {/* PWA Column */}
        <div class="border border-terminal-green/30 rounded-lg overflow-hidden">
          <div class="bg-terminal-green/10 p-4 border-b border-terminal-green/30">
            <h3 class="font-bold flex items-center gap-2">
              <GlobeIcon class="w-5 h-5" />
              PWA (Web App)
            </h3>
            <p class="text-sm text-terminal-green/70">
              What you're using now
            </p>
          </div>
          <div class="p-4">
            <ul class="space-y-3 text-sm">
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Works on any device with a browser</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>No app store required</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Automatic updates</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Offline support</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Can be installed to home screen</span>
              </li>
              <li class="flex items-start gap-2">
                <XIcon class="w-4 h-4 mt-0.5 text-red-400 flex-shrink-0" />
                <span>No Bluetooth mesh networking</span>
              </li>
              <li class="flex items-start gap-2">
                <XIcon class="w-4 h-4 mt-0.5 text-red-400 flex-shrink-0" />
                <span>Limited background sync</span>
              </li>
              <li class="flex items-start gap-2">
                <PartialIcon class="w-4 h-4 mt-0.5 text-yellow-400 flex-shrink-0" />
                <span>Push notifications (varies by browser)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Native Column */}
        <div class="border border-terminal-green/30 rounded-lg overflow-hidden">
          <div class="bg-terminal-green/10 p-4 border-b border-terminal-green/30">
            <h3 class="font-bold flex items-center gap-2">
              <PhoneIcon class="w-5 h-5" />
              Native App
            </h3>
            <p class="text-sm text-terminal-green/70">
              iOS & Android
            </p>
          </div>
          <div class="p-4">
            <ul class="space-y-3 text-sm">
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Full device integration</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Bluetooth Low Energy mesh networking</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Background sync & messaging</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Full push notifications</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Share extension integration</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Siri/Assistant shortcuts</span>
              </li>
              <li class="flex items-start gap-2">
                <CheckIcon class="w-4 h-4 mt-0.5 text-terminal-green flex-shrink-0" />
                <span>Widget support</span>
              </li>
              <li class="flex items-start gap-2">
                <XIcon class="w-4 h-4 mt-0.5 text-red-400 flex-shrink-0" />
                <span>Requires app store download</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Feature comparison table */}
      <div class="border border-terminal-green/30 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-terminal-green/10">
            <tr>
              <th class="p-3 text-left font-bold">Feature</th>
              <th class="p-3 text-center font-bold">PWA</th>
              <th class="p-3 text-center font-bold">Native</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-terminal-green/20">
            <tr>
              <td class="p-3">End-to-end encryption</td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">Nostr protocol</td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">WebRTC P2P</td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">Bluetooth mesh</td>
              <td class="p-3 text-center">
                <XIcon class="w-4 h-4 text-red-400 inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">Location channels</td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">Offline messaging</td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">Background sync</td>
              <td class="p-3 text-center">
                <PartialIcon class="w-4 h-4 text-yellow-400 inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">Push notifications</td>
              <td class="p-3 text-center">
                <PartialIcon class="w-4 h-4 text-yellow-400 inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">Share extension</td>
              <td class="p-3 text-center">
                <XIcon class="w-4 h-4 text-red-400 inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
            <tr>
              <td class="p-3">Voice assistant</td>
              <td class="p-3 text-center">
                <XIcon class="w-4 h-4 text-red-400 inline" />
              </td>
              <td class="p-3 text-center">
                <CheckIcon class="w-4 h-4 text-terminal-green inline" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="mt-6 p-4 bg-terminal-green/5 border border-terminal-green/20 rounded text-sm text-terminal-green/70">
        <p>
          <strong>Note:</strong> PWA and native apps are fully interoperable. You
          can message users on either platform seamlessly using the same Nostr
          protocol and encryption.
        </p>
      </div>
    </div>
  );

// ============================================================================
// Main Download Page
// ============================================================================

export const DownloadPage: FunctionComponent<DownloadPageProps> = ({
  onBack,
  showBackButton = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('recommended');
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);

  useEffect(() => {
    setDetection(detectCountry());
    setPlatformInfo(getPlatformInfo());
  }, []);

  const stats = getStoreStats();

  if (!detection || !platformInfo) {
    return (
      <div class="min-h-screen bg-terminal-bg text-terminal-green flex items-center justify-center">
        <div class="text-center">
          <div class="animate-pulse text-4xl mb-4">&gt;_</div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen bg-terminal-bg text-terminal-green">
      {/* Header */}
      <header class="border-b border-terminal-green/30 sticky top-0 bg-terminal-bg z-10">
        <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div class="flex items-center gap-4">
            {showBackButton && onBack && (
              <button
                onClick={onBack}
                class="p-2 hover:bg-terminal-green/10 rounded transition-colors"
              >
                <BackIcon class="w-5 h-5" />
              </button>
            )}
            <h1 class="text-lg font-bold">&gt; Download BitChat</h1>
          </div>
          <div class="text-sm text-terminal-green/50">
            Available in {stats.totalCountries} countries
          </div>
        </div>
      </header>

      {/* Tab navigation */}
      <nav class="border-b border-terminal-green/30 bg-terminal-bg/50">
        <div class="max-w-4xl mx-auto px-4">
          <div class="flex gap-1">
            <button
              onClick={() => setActiveTab('recommended')}
              class={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'recommended'
                  ? 'text-terminal-green border-b-2 border-terminal-green'
                  : 'text-terminal-green/50 hover:text-terminal-green'
              }`}
            >
              Recommended
            </button>
            <button
              onClick={() => setActiveTab('all-countries')}
              class={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'all-countries'
                  ? 'text-terminal-green border-b-2 border-terminal-green'
                  : 'text-terminal-green/50 hover:text-terminal-green'
              }`}
            >
              All Countries
            </button>
            <button
              onClick={() => setActiveTab('comparison')}
              class={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'comparison'
                  ? 'text-terminal-green border-b-2 border-terminal-green'
                  : 'text-terminal-green/50 hover:text-terminal-green'
              }`}
            >
              PWA vs Native
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main class="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'recommended' && (
          <RecommendedSection detection={detection} platformInfo={platformInfo} />
        )}

        {activeTab === 'all-countries' && (
          <div>
            <h2 class="text-xl font-bold mb-6">All App Store Links</h2>
            <p class="text-sm text-terminal-green/70 mb-6">
              Find BitChat in the App Store or Google Play for your country.
              Links are provided for {stats.iosCountries} iOS countries and{' '}
              {stats.androidCountries} Android countries.
            </p>
            <AppStoreLinks showQRCodes compact={false} />
          </div>
        )}

        {activeTab === 'comparison' && <ComparisonSection />}
      </main>

      {/* Footer */}
      <footer class="border-t border-terminal-green/30 mt-12">
        <div class="max-w-4xl mx-auto px-4 py-6 text-center text-sm text-terminal-green/50">
          <p class="mb-2">
            BitChat - Encrypted mesh messaging
          </p>
          <p class="text-xs">
            iOS App ID: {APP_STORE_APP_NAME} | Android Package: {PLAY_STORE_PACKAGE_ID}
          </p>
          <p class="text-xs mt-2">
            PWA hosted on IPFS via bitbrowse.eth.limo
          </p>
        </div>
      </footer>
    </div>
  );
};

// ============================================================================
// Icons
// ============================================================================

const BackIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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
      d="M15 19l-7-7 7-7"
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

const DesktopIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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
      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
    />
  </svg>
);

const GlobeIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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
      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const PhoneIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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

const XIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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

const PartialIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
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
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

// ============================================================================
// Exports
// ============================================================================

export default DownloadPage;
