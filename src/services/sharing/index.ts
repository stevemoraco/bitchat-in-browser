/**
 * Sharing Services - P2P App Distribution
 *
 * This module provides functionality for sharing the BitChat PWA
 * with other devices via WiFi hotspot, without requiring internet.
 *
 * Architecture Overview:
 * =====================
 *
 * Since browsers cannot create true HTTP servers, P2P app sharing
 * works through a combination of:
 *
 * 1. Service Worker Caching:
 *    - The PWA is fully cached for offline use
 *    - All assets are available locally after first load
 *
 * 2. WiFi Hotspot:
 *    - Host device creates a WiFi hotspot
 *    - Receiving device connects to the hotspot
 *    - Receiving device accesses the deployed URL
 *
 * 3. URL Sharing:
 *    - QR code or direct URL sharing
 *    - URL includes share parameters for detection
 *    - Receiving device caches app on first visit
 *
 * Usage Flow:
 * ===========
 *
 * Host Device (Sharing):
 * 1. User opens Share App modal
 * 2. Follows instructions to enable hotspot
 * 3. QR code / URL is displayed
 * 4. Waits for receiver to connect
 *
 * Receiving Device:
 * 1. Connects to host's WiFi hotspot
 * 2. Scans QR code or enters URL
 * 3. Receives app landing page
 * 4. Follows PWA install prompts
 * 5. App is cached for offline use
 *
 * Limitations:
 * ============
 *
 * - True offline P2P requires internet for first load
 * - Browser security prevents local HTTP servers
 * - QR code scanning requires camera permission
 * - PWA install UX varies by browser/platform
 *
 * For advanced users (requires technical setup):
 * - mDNS/Bonjour for local discovery
 * - Local DNS server pointing to cached origin
 * - Proxy server on host device
 *
 * @module services/sharing
 */

// ============================================================================
// Service Exports
// ============================================================================

export {
  LocalServerService,
  localServerService,
  type LocalServerConfig,
  type LocalServerStatus,
  type PWAAssetInfo,
  type LocalServerEvent,
  type LocalServerEventType,
  type LocalServerCallback,
} from './local-server';

export {
  HotspotBridgeService,
  hotspotBridge,
  type DevicePlatform,
  type HotspotState,
  type ConnectionRole,
  type HotspotConfig,
  type HotspotStatus,
  type HotspotInstructions,
  type HotspotStep,
  type ConnectionInfo,
} from './hotspot-bridge';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the device supports P2P app sharing
 */
export function canShareApp(): boolean {
  // Need Service Worker support for caching
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  // Need Cache API for offline storage
  if (!('caches' in window)) {
    return false;
  }

  return true;
}

/**
 * Get the shareable URL with tracking parameter
 */
export function getShareUrl(): string {
  const baseUrl = 'https://bitbrowse.eth.limo';
  return `${baseUrl}?share=1`;
}

/**
 * Check if this page load came from a share
 */
export function isFromShare(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);
  return params.get('share') === '1';
}

/**
 * Mark that the user has completed the share flow
 */
export function markShareComplete(): void {
  if (typeof localStorage === 'undefined') return;

  localStorage.setItem('bitchat_has_visited', '1');

  // Clean up URL
  const url = new URL(window.location.href);
  url.searchParams.delete('share');
  window.history.replaceState({}, '', url.toString());
}

/**
 * Check if this is a first-time visitor
 */
export function isFirstVisit(): boolean {
  if (typeof localStorage === 'undefined') return true;

  return localStorage.getItem('bitchat_has_visited') !== '1';
}

/**
 * Generate a simple share code for verification
 * This allows sender and receiver to verify they're connected
 */
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusable chars
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Format share instructions for display
 */
export function formatShareInstructions(_platform: string): string[] {
  const baseSteps = [
    'Enable WiFi hotspot on your device',
    'Share your hotspot password with your friend',
    'Have them connect to your hotspot',
    'Share the QR code or URL',
    'They\'ll receive BitChat automatically',
  ];

  return baseSteps;
}

// ============================================================================
// Types for External Use
// ============================================================================

/**
 * Combined sharing state for UI components
 */
export interface SharingState {
  /** Whether sharing services are available */
  available: boolean;
  /** Whether sharing is currently active */
  isSharing: boolean;
  /** The URL to share */
  shareUrl: string;
  /** Local IP if detected */
  localIp: string | null;
  /** Hotspot state */
  hotspotState: string;
  /** Platform identifier */
  platform: string;
}

// Import services for use in utility functions
import { localServerService as localServer } from './local-server';
import { hotspotBridge as hotspot } from './hotspot-bridge';

/**
 * Get the current sharing state
 */
export function getSharingState(): SharingState {
  const available = canShareApp();
  const server = localServer.getStatus();
  const hotspotStatus = hotspot.getStatus();

  return {
    available,
    isSharing: server.isActive,
    shareUrl: getShareUrl(),
    localIp: server.localIp,
    hotspotState: hotspotStatus.state,
    platform: hotspotStatus.platform,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  localServerService: localServer,
  hotspotBridge: hotspot,
  canShareApp,
  getShareUrl,
  isFromShare,
  markShareComplete,
  isFirstVisit,
  generateShareCode,
  formatShareInstructions,
  getSharingState,
};
