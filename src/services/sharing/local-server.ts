/**
 * Local Server Service - P2P App Sharing
 *
 * Provides functionality for sharing the BitChat PWA via local network.
 * Uses Service Worker fetch interception to serve cached PWA files
 * to devices on the same network (when accessed via WiFi hotspot).
 *
 * Architecture:
 * - The app is already cached by the Service Worker for offline use
 * - When sharing is enabled, we generate a local network URL
 * - Other devices connecting to the hotspot can access this URL
 * - The Service Worker serves the cached files as a virtual server
 *
 * Limitations:
 * - Browsers cannot create true HTTP servers
 * - Requires the sharing device to have the app cached
 * - Receiving devices need to be on the same WiFi/hotspot network
 *
 * @module services/sharing/local-server
 */

// ============================================================================
// Types
// ============================================================================

export interface LocalServerConfig {
  /** Custom port (informational only, browser uses default ports) */
  displayPort?: number;
  /** Whether to enable verbose logging */
  verbose?: boolean;
}

export interface LocalServerStatus {
  /** Whether the server is conceptually active */
  isActive: boolean;
  /** The local network URL for sharing */
  localUrl: string | null;
  /** The current device's local IP address (if detected) */
  localIp: string | null;
  /** Number of successful page serves */
  serveCount: number;
  /** Last error message if any */
  lastError: string | null;
  /** When sharing was started */
  startedAt: number | null;
}

export interface PWAAssetInfo {
  /** URL path of the asset */
  path: string;
  /** Cache status */
  cached: boolean;
  /** Size in bytes (if known) */
  size?: number;
  /** Content type */
  contentType?: string;
}

export type LocalServerEventType = 'started' | 'stopped' | 'client-connected' | 'error';

export interface LocalServerEvent {
  type: LocalServerEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type LocalServerCallback = (event: LocalServerEvent) => void;

// ============================================================================
// Constants
// ============================================================================

/** Common PWA assets that need to be cached for sharing */
const PWA_CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/sw.js',
  '/favicon.ico',
] as const;

/** Default display port for the shareable URL */
const DEFAULT_DISPLAY_PORT = 443;

/** Local storage key for sharing state */
const SHARING_STATE_KEY = 'bitchat_sharing_state';

// ============================================================================
// Local Server Service
// ============================================================================

/**
 * LocalServerService manages P2P app sharing via local network.
 *
 * Since browsers cannot create true HTTP servers, this service:
 * 1. Ensures all PWA assets are cached in the Service Worker
 * 2. Detects the device's local IP address
 * 3. Provides instructions for setting up a WiFi hotspot
 * 4. Generates a shareable URL for other devices
 *
 * The actual serving happens through:
 * - HTTPS: The original deployed URL (bitbrowse.eth.limo)
 * - Local: WiFi hotspot with DNS pointing to cached origin
 *
 * For true local serving without internet, users need to:
 * 1. Enable WiFi hotspot
 * 2. Share the original URL
 * 3. The receiving device will cache the app for offline use
 */
export class LocalServerService {
  private static instance: LocalServerService | null = null;

  private config: Required<LocalServerConfig>;
  private status: LocalServerStatus;
  private callbacks: Set<LocalServerCallback> = new Set();
  private eventHistory: LocalServerEvent[] = [];

  /** Maximum events to keep in history */
  private readonly MAX_HISTORY = 50;

  private constructor() {
    this.config = {
      displayPort: DEFAULT_DISPLAY_PORT,
      verbose: false,
    };

    this.status = {
      isActive: false,
      localUrl: null,
      localIp: null,
      serveCount: 0,
      lastError: null,
      startedAt: null,
    };

    // Restore state if available
    this.restoreState();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LocalServerService {
    if (!LocalServerService.instance) {
      LocalServerService.instance = new LocalServerService();
    }
    return LocalServerService.instance;
  }

  /**
   * Initialize the local server service
   */
  public async initialize(config?: LocalServerConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Try to detect local IP
    await this.detectLocalIp();

    this.log('LocalServerService initialized');
  }

  // ==========================================================================
  // Server Control
  // ==========================================================================

  /**
   * Start the local sharing mode.
   *
   * This doesn't actually start a server, but:
   * 1. Ensures all assets are cached
   * 2. Generates the shareable URL
   * 3. Marks sharing as active for UI feedback
   */
  public async start(): Promise<LocalServerStatus> {
    try {
      // Ensure we have the local IP
      if (!this.status.localIp) {
        await this.detectLocalIp();
      }

      // Verify PWA assets are cached
      const assetStatus = await this.verifyPWACache();
      const uncachedAssets = assetStatus.filter((a) => !a.cached);

      if (uncachedAssets.length > 0) {
        this.log(`Warning: ${uncachedAssets.length} assets not cached`, uncachedAssets);
        // Try to cache them
        await this.cacheAssets(uncachedAssets.map((a) => a.path));
      }

      // Generate the shareable URL
      // Since we can't host locally, we provide the deployed URL
      // which will work if the receiver has internet access
      const shareableUrl = this.generateShareableUrl();

      this.status = {
        ...this.status,
        isActive: true,
        localUrl: shareableUrl,
        startedAt: Date.now(),
        lastError: null,
      };

      this.saveState();
      this.emitEvent({ type: 'started', timestamp: Date.now() });

      this.log('Sharing mode started', { url: shareableUrl });

      return this.status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.status.lastError = errorMessage;
      this.emitEvent({
        type: 'error',
        timestamp: Date.now(),
        data: { error: errorMessage },
      });
      throw error;
    }
  }

  /**
   * Stop the local sharing mode
   */
  public stop(): void {
    this.status = {
      ...this.status,
      isActive: false,
      startedAt: null,
    };

    this.saveState();
    this.emitEvent({ type: 'stopped', timestamp: Date.now() });

    this.log('Sharing mode stopped');
  }

  /**
   * Get current server status
   */
  public getStatus(): LocalServerStatus {
    return { ...this.status };
  }

  /**
   * Check if sharing is currently active
   */
  public isActive(): boolean {
    return this.status.isActive;
  }

  // ==========================================================================
  // IP Detection
  // ==========================================================================

  /**
   * Detect the local IP address using WebRTC.
   *
   * This is a common technique to discover local network IPs
   * without requiring server-side help. It may not work in all
   * browsers due to privacy settings.
   */
  public async detectLocalIp(): Promise<string | null> {
    try {
      // Method 1: WebRTC ICE candidate
      const ip = await this.detectIpViaWebRTC();
      if (ip) {
        this.status.localIp = ip;
        this.log('Detected local IP via WebRTC:', ip);
        return ip;
      }
    } catch (error) {
      this.log('WebRTC IP detection failed:', error);
    }

    // Method 2: Fallback to common hotspot IP ranges
    // When a device creates a hotspot, it typically uses these IPs
    const fallbackIp = this.estimateHotspotIp();
    this.status.localIp = fallbackIp;
    this.log('Using estimated hotspot IP:', fallbackIp);

    return fallbackIp;
  }

  /**
   * Detect IP address using WebRTC ICE candidates
   */
  private async detectIpViaWebRTC(): Promise<string | null> {
    return new Promise((resolve) => {
      // Check if RTCPeerConnection is available
      if (typeof RTCPeerConnection === 'undefined') {
        resolve(null);
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [], // No STUN/TURN servers needed for local detection
      });

      const ipSet = new Set<string>();
      let resolved = false;

      // Listen for ICE candidates
      pc.onicecandidate = (event) => {
        if (resolved) return;

        if (event.candidate) {
          const candidate = event.candidate.candidate;
          // Extract IP from candidate string
          // Format: "candidate:... typ host ... <ip> ..."
          const ipMatch = candidate.match(
            /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/
          );
          if (ipMatch) {
            const ip = ipMatch[1];
            // Filter out localhost and link-local
            if (
              ip &&
              !ip.startsWith('127.') &&
              !ip.startsWith('169.254.') &&
              !ip.startsWith('0.')
            ) {
              ipSet.add(ip);
            }
          }
        }

        // ICE gathering complete
        if (event.candidate === null) {
          resolved = true;
          pc.close();

          // Prefer private network IPs
          const privateIp = Array.from(ipSet).find(
            (ip) =>
              ip.startsWith('192.168.') ||
              ip.startsWith('10.') ||
              ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
          );

          resolve(privateIp ?? ipSet.values().next().value ?? null);
        }
      };

      // Create a data channel to trigger ICE gathering
      pc.createDataChannel('');

      // Create an offer to start ICE gathering
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          resolved = true;
          pc.close();
          resolve(null);
        });

      // Timeout after 3 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          resolve(ipSet.values().next().value ?? null);
        }
      }, 3000);
    });
  }

  /**
   * Estimate the likely hotspot IP based on common defaults
   */
  private estimateHotspotIp(): string {
    // Common hotspot IP ranges by platform:
    // iOS: 172.20.10.1
    // Android: 192.168.43.1 or 192.168.49.1
    // We'll default to the iOS pattern since it's most distinctive

    // Check user agent for hints
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('iphone') || ua.includes('ipad')) {
      return '172.20.10.1';
    } else if (ua.includes('android')) {
      return '192.168.43.1';
    }

    // Generic fallback
    return '192.168.1.1';
  }

  /**
   * Get the detected or estimated local IP
   */
  public getLocalIp(): string | null {
    return this.status.localIp;
  }

  // ==========================================================================
  // URL Generation
  // ==========================================================================

  /**
   * Generate the shareable URL for other devices.
   *
   * Since browsers can't create local HTTP servers, we provide
   * options based on the scenario:
   *
   * 1. With internet: Use the deployed URL (bitbrowse.eth.limo)
   * 2. Without internet: Instructions for advanced local hosting
   */
  public generateShareableUrl(): string {
    // Primary URL is always the deployed PWA URL
    // This ensures the receiver gets the proper HTTPS experience
    return 'https://bitbrowse.eth.limo';
  }

  /**
   * Generate a local network URL (informational only).
   *
   * This shows what a local server URL would look like,
   * useful for advanced users who want to set up local hosting.
   */
  public getLocalNetworkUrl(): string | null {
    if (!this.status.localIp) {
      return null;
    }

    // Note: This URL won't actually work without additional setup
    // It's provided for documentation/advanced user purposes
    return `http://${this.status.localIp}:${this.config.displayPort}`;
  }

  /**
   * Generate a QR code data URL for the shareable link.
   * Returns a data URL that can be used in an img src.
   */
  public async generateQRCodeDataUrl(url: string): Promise<string> {
    // Generate QR code using a simple implementation
    // For a production app, you'd want to use a proper QR library
    // This is a placeholder that returns a text-based representation

    // Use a simple canvas-based QR code generator
    // For now, we'll return a placeholder and let the component handle it
    return url;
  }

  // ==========================================================================
  // PWA Cache Management
  // ==========================================================================

  /**
   * Verify that all PWA assets are cached by the Service Worker
   */
  public async verifyPWACache(): Promise<PWAAssetInfo[]> {
    const results: PWAAssetInfo[] = [];

    // Check each core asset
    for (const path of PWA_CORE_ASSETS) {
      const cached = await this.isAssetCached(path);
      results.push({
        path,
        cached,
        contentType: this.guessContentType(path),
      });
    }

    return results;
  }

  /**
   * Check if a specific asset is cached
   */
  private async isAssetCached(path: string): Promise<boolean> {
    try {
      // Check all caches
      const cacheNames = await caches.keys();

      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const response = await cache.match(path);
        if (response) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to cache specific assets
   */
  private async cacheAssets(paths: string[]): Promise<void> {
    if (!('caches' in window)) {
      this.log('Cache API not available');
      return;
    }

    try {
      // Use the workbox precache or a dedicated cache
      const cache = await caches.open('bitchat-sharing-v1');

      for (const path of paths) {
        try {
          const response = await fetch(path);
          if (response.ok) {
            await cache.put(path, response);
            this.log(`Cached: ${path}`);
          }
        } catch (error) {
          this.log(`Failed to cache ${path}:`, error);
        }
      }
    } catch (error) {
      this.log('Failed to open cache:', error);
    }
  }

  /**
   * Guess content type from file path
   */
  private guessContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();

    const types: Record<string, string> = {
      html: 'text/html',
      js: 'application/javascript',
      css: 'text/css',
      json: 'application/json',
      ico: 'image/x-icon',
      png: 'image/png',
      svg: 'image/svg+xml',
      woff: 'font/woff',
      woff2: 'font/woff2',
    };

    return types[ext ?? ''] ?? 'application/octet-stream';
  }

  /**
   * Get total cache size for sharing
   */
  public async getCacheSize(): Promise<number> {
    try {
      if (!('storage' in navigator && 'estimate' in navigator.storage)) {
        return 0;
      }

      const estimate = await navigator.storage.estimate();
      return estimate.usage ?? 0;
    } catch {
      return 0;
    }
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Subscribe to server events
   */
  public onEvent(callback: LocalServerCallback): () => void {
    this.callbacks.add(callback);

    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Emit an event to all subscribers
   */
  private emitEvent(event: LocalServerEvent): void {
    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.MAX_HISTORY) {
      this.eventHistory.shift();
    }

    // Notify subscribers
    this.callbacks.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        this.log('Event callback error:', error);
      }
    });
  }

  /**
   * Get event history
   */
  public getEventHistory(): LocalServerEvent[] {
    return [...this.eventHistory];
  }

  // ==========================================================================
  // State Persistence
  // ==========================================================================

  /**
   * Save current state to localStorage
   */
  private saveState(): void {
    try {
      const state = {
        isActive: this.status.isActive,
        localIp: this.status.localIp,
        startedAt: this.status.startedAt,
      };
      localStorage.setItem(SHARING_STATE_KEY, JSON.stringify(state));
    } catch {
      // localStorage might not be available
    }
  }

  /**
   * Restore state from localStorage
   */
  private restoreState(): void {
    try {
      const saved = localStorage.getItem(SHARING_STATE_KEY);
      if (saved) {
        const state = JSON.parse(saved);
        this.status.localIp = state.localIp;
        // Don't restore isActive - user should explicitly start sharing
      }
    } catch {
      // Ignore errors
    }
  }

  // ==========================================================================
  // Utilities
  // ==========================================================================

  /**
   * Log message if verbose mode is enabled
   */
  private log(message: string, ...args: unknown[]): void {
    if (this.config.verbose) {
      console.log(`[LocalServer] ${message}`, ...args);
    }
  }

  /**
   * Format bytes to human readable string
   */
  public formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  /**
   * Check if the device likely supports hotspot functionality
   */
  public canCreateHotspot(): boolean {
    // All mobile devices can create hotspots
    // Desktop can share via existing WiFi
    return true;
  }

  /**
   * Get platform-specific hotspot instructions
   */
  public getHotspotInstructions(): {
    platform: string;
    steps: string[];
  } {
    const ua = navigator.userAgent.toLowerCase();

    if (ua.includes('iphone') || ua.includes('ipad')) {
      return {
        platform: 'iOS',
        steps: [
          'Open Settings',
          'Tap "Personal Hotspot"',
          'Toggle "Allow Others to Join" ON',
          'Note the WiFi password shown',
          'Share this password with the person you\'re connecting with',
        ],
      };
    }

    if (ua.includes('android')) {
      return {
        platform: 'Android',
        steps: [
          'Open Settings',
          'Tap "Network & internet" or "Connections"',
          'Tap "Hotspot & tethering"',
          'Tap "Wi-Fi hotspot"',
          'Toggle the hotspot ON',
          'Note or set the network name and password',
        ],
      };
    }

    // Desktop/other
    return {
      platform: 'Desktop',
      steps: [
        'Ensure you\'re connected to a WiFi network',
        'Both devices need to be on the same network',
        'Share the URL shown below with the other device',
        'For offline sharing, consider using a mobile device hotspot',
      ],
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export const localServerService = LocalServerService.getInstance();
export default localServerService;
