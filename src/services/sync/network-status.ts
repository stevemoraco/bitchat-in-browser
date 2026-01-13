/**
 * Network Status Service
 *
 * Provides reliable online/offline detection with:
 * - Browser navigator.onLine API
 * - Periodic connectivity checks via fetch
 * - Event-based status updates
 * - Connection quality estimation
 *
 * @module services/sync/network-status
 */

/**
 * Network connection status
 */
export type NetworkStatus = 'online' | 'offline' | 'unstable';

/**
 * Connection quality levels
 */
export type ConnectionQuality = 'good' | 'fair' | 'poor' | 'none';

/**
 * Network status change event
 */
export interface NetworkStatusEvent {
  /** Current network status */
  status: NetworkStatus;
  /** Estimated connection quality */
  quality: ConnectionQuality;
  /** Whether navigator reports online */
  navigatorOnline: boolean;
  /** Whether connectivity check passed */
  connectivityCheckPassed: boolean;
  /** Timestamp of status change */
  timestamp: number;
  /** Latency from last check in ms (if available) */
  latencyMs?: number;
}

/**
 * Options for NetworkStatusService
 */
export interface NetworkStatusOptions {
  /** Interval for connectivity checks in ms (default: 30000) */
  checkInterval?: number;
  /** URL to use for connectivity checks */
  checkUrl?: string;
  /** Timeout for connectivity check requests in ms (default: 5000) */
  checkTimeout?: number;
  /** Number of consecutive failures before marking as offline (default: 2) */
  failureThreshold?: number;
  /** Whether to enable periodic checks (default: true) */
  enablePeriodicChecks?: boolean;
}

/** Default check interval: 30 seconds */
const DEFAULT_CHECK_INTERVAL = 30000;

/** Default timeout for connectivity checks: 5 seconds */
const DEFAULT_CHECK_TIMEOUT = 5000;

/** Default failure threshold */
const DEFAULT_FAILURE_THRESHOLD = 2;

/**
 * URLs to try for connectivity checks
 * Using multiple URLs increases reliability
 */
const DEFAULT_CHECK_URLS = [
  // Cloudflare DNS - fast, global
  'https://1.1.1.1/cdn-cgi/trace',
  // Google generate_204 - designed for connectivity checks
  'https://www.google.com/generate_204',
];

/**
 * Type for status change listeners
 */
export type NetworkStatusListener = (event: NetworkStatusEvent) => void;

/**
 * NetworkStatusService provides reliable network status detection.
 *
 * It combines the browser's navigator.onLine API with active connectivity
 * checks to provide accurate online/offline detection. This is important
 * because navigator.onLine can report false positives (e.g., connected
 * to a captive portal or local network without internet access).
 *
 * @example
 * ```typescript
 * const networkStatus = new NetworkStatusService();
 *
 * // Listen for status changes
 * networkStatus.onStatusChange((event) => {
 *   console.log(`Network is ${event.status}`);
 * });
 *
 * // Start monitoring
 * networkStatus.start();
 *
 * // Check current status
 * if (networkStatus.isOnline()) {
 *   await syncData();
 * }
 *
 * // Clean up
 * networkStatus.stop();
 * ```
 */
export class NetworkStatusService {
  private status: NetworkStatus = 'online';
  private quality: ConnectionQuality = 'good';
  private lastLatency?: number;
  private consecutiveFailures = 0;
  private checkInterval: number;
  private checkUrls: string[];
  private checkTimeout: number;
  private failureThreshold: number;
  private enablePeriodicChecks: boolean;
  private listeners: Set<NetworkStatusListener> = new Set();
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private isStarted = false;

  constructor(options: NetworkStatusOptions = {}) {
    this.checkInterval = options.checkInterval ?? DEFAULT_CHECK_INTERVAL;
    this.checkUrls = options.checkUrl ? [options.checkUrl] : DEFAULT_CHECK_URLS;
    this.checkTimeout = options.checkTimeout ?? DEFAULT_CHECK_TIMEOUT;
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.enablePeriodicChecks = options.enablePeriodicChecks ?? true;

    // Initialize status from navigator
    if (typeof navigator !== 'undefined') {
      this.status = navigator.onLine ? 'online' : 'offline';
      this.quality = navigator.onLine ? 'good' : 'none';
    }
  }

  /**
   * Start network monitoring
   */
  start(): void {
    if (this.isStarted) return;
    this.isStarted = true;

    this.setupBrowserListeners();

    if (this.enablePeriodicChecks) {
      // Perform initial check
      this.performConnectivityCheck();

      // Start periodic checks
      this.checkTimer = setInterval(() => {
        this.performConnectivityCheck();
      }, this.checkInterval);
    }

    console.log('[NetworkStatus] Monitoring started');
  }

  /**
   * Stop network monitoring
   */
  stop(): void {
    if (!this.isStarted) return;
    this.isStarted = false;

    this.removeBrowserListeners();

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    console.log('[NetworkStatus] Monitoring stopped');
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.status === 'online' || this.status === 'unstable';
  }

  /**
   * Check if definitely offline
   */
  isOffline(): boolean {
    return this.status === 'offline';
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return this.status;
  }

  /**
   * Get current connection quality
   */
  getQuality(): ConnectionQuality {
    return this.quality;
  }

  /**
   * Get last measured latency
   */
  getLatency(): number | undefined {
    return this.lastLatency;
  }

  /**
   * Get full status event
   */
  getStatusEvent(): NetworkStatusEvent {
    return {
      status: this.status,
      quality: this.quality,
      navigatorOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      connectivityCheckPassed: this.consecutiveFailures === 0,
      timestamp: Date.now(),
      latencyMs: this.lastLatency,
    };
  }

  /**
   * Add a status change listener
   * @returns Unsubscribe function
   */
  onStatusChange(listener: NetworkStatusListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Manually trigger a connectivity check
   */
  async checkNow(): Promise<NetworkStatusEvent> {
    await this.performConnectivityCheck();
    return this.getStatusEvent();
  }

  /**
   * Wait until online (or timeout)
   * @param timeoutMs Maximum time to wait (default: 30000)
   */
  waitForOnline(timeoutMs = 30000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isOnline()) {
        resolve(true);
        return;
      }

      const timeout = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeoutMs);

      const unsubscribe = this.onStatusChange((event) => {
        if (event.status === 'online') {
          clearTimeout(timeout);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private setupBrowserListeners(): void {
    if (typeof window === 'undefined') return;

    this.onlineHandler = () => {
      console.log('[NetworkStatus] Browser reports online');
      // When browser goes online, verify with connectivity check
      this.performConnectivityCheck();
    };

    this.offlineHandler = () => {
      console.log('[NetworkStatus] Browser reports offline');
      this.updateStatus('offline', 'none');
    };

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  private removeBrowserListeners(): void {
    if (typeof window === 'undefined') return;

    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }

    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
      this.offlineHandler = null;
    }
  }

  private async performConnectivityCheck(): Promise<void> {
    // If navigator says offline, don't bother checking
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateStatus('offline', 'none');
      return;
    }

    const startTime = performance.now();
    let success = false;

    // Try each check URL until one succeeds
    for (const url of this.checkUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.checkTimeout);

        await fetch(url, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // In no-cors mode, we can't read the response but if we got here,
        // the request succeeded
        success = true;
        break;
      } catch (error) {
        // Try next URL
        continue;
      }
    }

    const latency = performance.now() - startTime;
    this.lastLatency = Math.round(latency);

    if (success) {
      this.consecutiveFailures = 0;
      const quality = this.calculateQuality(latency);
      this.updateStatus('online', quality);
    } else {
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= this.failureThreshold) {
        this.updateStatus('offline', 'none');
      } else {
        this.updateStatus('unstable', 'poor');
      }
    }
  }

  private calculateQuality(latencyMs: number): ConnectionQuality {
    if (latencyMs < 100) return 'good';
    if (latencyMs < 300) return 'fair';
    if (latencyMs < 1000) return 'poor';
    return 'poor';
  }

  private updateStatus(newStatus: NetworkStatus, newQuality: ConnectionQuality): void {
    const previousStatus = this.status;
    const previousQuality = this.quality;

    this.status = newStatus;
    this.quality = newQuality;

    // Only notify if status actually changed
    if (previousStatus !== newStatus || previousQuality !== newQuality) {
      const event = this.getStatusEvent();

      console.log(
        `[NetworkStatus] Status changed: ${previousStatus} -> ${newStatus} (quality: ${newQuality})`
      );

      // Notify all listeners
      for (const listener of this.listeners) {
        try {
          listener(event);
        } catch (error) {
          console.error('[NetworkStatus] Error in status change listener:', error);
        }
      }
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let defaultInstance: NetworkStatusService | null = null;

/**
 * Get the default NetworkStatusService instance
 */
export function getNetworkStatus(): NetworkStatusService {
  if (!defaultInstance) {
    defaultInstance = new NetworkStatusService();
  }
  return defaultInstance;
}

/**
 * Initialize and start the default network status service
 */
export function initNetworkStatus(options?: NetworkStatusOptions): NetworkStatusService {
  if (defaultInstance) {
    defaultInstance.stop();
  }
  defaultInstance = new NetworkStatusService(options);
  defaultInstance.start();
  return defaultInstance;
}

/**
 * Stop and reset the default network status service
 */
export function resetNetworkStatus(): void {
  if (defaultInstance) {
    defaultInstance.stop();
    defaultInstance = null;
  }
}
