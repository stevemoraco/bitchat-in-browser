/**
 * BitChat In Browser - Update Checker Service
 *
 * Handles detection of service worker updates with IPFS-compatible
 * version checking. Works with decentralized hosting where new versions
 * have new CIDs.
 *
 * Features:
 * - Service worker update detection
 * - Version comparison via version.json
 * - Scheduled update checks
 * - IPFS CID-based version detection
 * - Online/offline awareness
 *
 * @module services/updates/checker
 */

// ============================================================================
// Types
// ============================================================================

export interface VersionInfo {
  version: string;
  buildTime: string;
  cid?: string;
  releaseNotes?: string[];
  features?: string[];
  critical?: boolean;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  newVersion?: string;
  releaseNotes?: string[];
  isCritical: boolean;
  checkTime: number;
}

export interface UpdateCheckerConfig {
  /** Interval between automatic checks in ms (default: 30 min) */
  checkIntervalMs?: number;
  /** URL to version.json file (default: ./version.json) */
  versionUrl?: string;
  /** Whether to check immediately on init (default: true) */
  checkOnInit?: boolean;
  /** Whether to check when page becomes visible (default: true) */
  checkOnVisible?: boolean;
  /** Whether to check when coming online (default: true) */
  checkOnOnline?: boolean;
}

export type UpdateCheckCallback = (result: UpdateCheckResult) => void;

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<UpdateCheckerConfig> = {
  checkIntervalMs: 30 * 60 * 1000, // 30 minutes
  versionUrl: './version.json',
  checkOnInit: true,
  checkOnVisible: true,
  checkOnOnline: true,
};

// Storage key for tracking last check
const LAST_CHECK_KEY = 'bitchat-update-last-check';
const DISMISSED_VERSION_KEY = 'bitchat-update-dismissed';

// ============================================================================
// Update Checker Class
// ============================================================================

/**
 * UpdateChecker - Detects and manages app updates
 *
 * Designed to work with IPFS hosting where:
 * - New deployments get new CIDs
 * - Service worker updates via Workbox
 * - version.json tracks semantic versioning
 */
export class UpdateChecker {
  private static instance: UpdateChecker | null = null;

  private config: Required<UpdateCheckerConfig>;
  private callbacks: Set<UpdateCheckCallback> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private currentVersion: VersionInfo | null = null;
  private latestVersion: VersionInfo | null = null;
  private lastCheckResult: UpdateCheckResult | null = null;
  private isChecking = false;

  private constructor(config: UpdateCheckerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: UpdateCheckerConfig): UpdateChecker {
    if (!UpdateChecker.instance) {
      UpdateChecker.instance = new UpdateChecker(config);
    }
    return UpdateChecker.instance;
  }

  /**
   * Initialize the update checker
   * Sets up periodic checks and event listeners
   */
  async init(): Promise<void> {
    // Load current version from bundled version info
    await this.loadCurrentVersion();

    // Set up event listeners
    this.setupEventListeners();

    // Start periodic checks
    this.startPeriodicChecks();

    // Check immediately if configured
    if (this.config.checkOnInit) {
      // Delay slightly to not block app startup
      setTimeout(() => this.checkForUpdates(), 2000);
    }

    console.log('[UpdateChecker] Initialized with version:', this.currentVersion?.version);
  }

  /**
   * Load current version from version.json or build info
   */
  private async loadCurrentVersion(): Promise<void> {
    try {
      // Try to load from version.json (bundled with the app)
      const response = await fetch(this.config.versionUrl, {
        cache: 'no-store', // Ensure we get the cached version from SW
      });

      if (response.ok) {
        this.currentVersion = await response.json();
      }
    } catch (error) {
      console.warn('[UpdateChecker] Could not load version.json:', error);
    }

    // Fallback to build-time version
    if (!this.currentVersion) {
      this.currentVersion = {
        version: __APP_VERSION__ || '0.0.0',
        buildTime: __BUILD_TIME__ || new Date().toISOString(),
      };
    }
  }

  /**
   * Set up event listeners for visibility and online state
   */
  private setupEventListeners(): void {
    // Check on visibility change
    if (this.config.checkOnVisible) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkForUpdates();
        }
      });
    }

    // Check when coming back online
    if (this.config.checkOnOnline) {
      window.addEventListener('online', () => {
        this.checkForUpdates();
      });
    }

    // Listen for service worker update events
    window.addEventListener('sw-update', (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.status === 'ready') {
        // SW update detected - check version info
        this.checkVersionFromServer();
      }
    });
  }

  /**
   * Start periodic update checks
   */
  private startPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.config.checkIntervalMs);
  }

  /**
   * Stop periodic update checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check for updates
   * Returns true if an update is available
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    // Prevent concurrent checks
    if (this.isChecking) {
      return this.lastCheckResult || this.createNoUpdateResult();
    }

    // Skip if offline
    if (!navigator.onLine) {
      return this.lastCheckResult || this.createNoUpdateResult();
    }

    // Rate limit checks
    const lastCheck = this.getLastCheckTime();
    const minInterval = 60 * 1000; // Minimum 1 minute between checks
    if (lastCheck && Date.now() - lastCheck < minInterval) {
      return this.lastCheckResult || this.createNoUpdateResult();
    }

    this.isChecking = true;

    try {
      // Check service worker for updates first
      await this.checkServiceWorkerUpdate();

      // Then check version.json from server
      const result = await this.checkVersionFromServer();

      this.lastCheckResult = result;
      this.setLastCheckTime(Date.now());

      // Notify callbacks
      this.notifyCallbacks(result);

      return result;
    } catch (error) {
      console.error('[UpdateChecker] Check failed:', error);
      return this.createNoUpdateResult();
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Check service worker for updates
   */
  private async checkServiceWorkerUpdate(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
      }
    } catch (error) {
      console.warn('[UpdateChecker] SW update check failed:', error);
    }
  }

  /**
   * Check version.json from server for new version
   */
  private async checkVersionFromServer(): Promise<UpdateCheckResult> {
    try {
      // Fetch version.json with cache-busting
      const response = await fetch(`${this.config.versionUrl}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.latestVersion = await response.json();

      // Compare versions
      const hasUpdate = this.compareVersions(
        this.currentVersion?.version || '0.0.0',
        this.latestVersion?.version || '0.0.0'
      ) < 0;

      // Check if this version was dismissed
      const isDismissed = this.isVersionDismissed(this.latestVersion?.version);

      return {
        hasUpdate: hasUpdate && !isDismissed,
        currentVersion: this.currentVersion?.version || '0.0.0',
        newVersion: hasUpdate ? this.latestVersion?.version : undefined,
        releaseNotes: this.latestVersion?.releaseNotes,
        isCritical: this.latestVersion?.critical || false,
        checkTime: Date.now(),
      };
    } catch (error) {
      console.warn('[UpdateChecker] Version check failed:', error);
      return this.createNoUpdateResult();
    }
  }

  /**
   * Compare semantic versions
   * Returns: negative if v1 < v2, positive if v1 > v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 !== p2) {
        return p1 - p2;
      }
    }

    return 0;
  }

  /**
   * Create a "no update" result
   */
  private createNoUpdateResult(): UpdateCheckResult {
    return {
      hasUpdate: false,
      currentVersion: this.currentVersion?.version || '0.0.0',
      isCritical: false,
      checkTime: Date.now(),
    };
  }

  /**
   * Subscribe to update check results
   */
  onUpdate(callback: UpdateCheckCallback): () => void {
    this.callbacks.add(callback);

    // Immediately notify with last result if available
    if (this.lastCheckResult) {
      callback(this.lastCheckResult);
    }

    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all callbacks of update check result
   */
  private notifyCallbacks(result: UpdateCheckResult): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(result);
      } catch (error) {
        console.error('[UpdateChecker] Callback error:', error);
      }
    });
  }

  /**
   * Get current version info
   */
  getCurrentVersion(): VersionInfo | null {
    return this.currentVersion;
  }

  /**
   * Get latest detected version info
   */
  getLatestVersion(): VersionInfo | null {
    return this.latestVersion;
  }

  /**
   * Get last check result
   */
  getLastCheckResult(): UpdateCheckResult | null {
    return this.lastCheckResult;
  }

  /**
   * Check if update is available
   */
  hasUpdate(): boolean {
    return this.lastCheckResult?.hasUpdate || false;
  }

  /**
   * Dismiss an update version (user clicked "Later")
   */
  dismissVersion(version: string): void {
    try {
      localStorage.setItem(DISMISSED_VERSION_KEY, version);
    } catch {
      // Storage might be unavailable
    }
  }

  /**
   * Check if a version was dismissed
   */
  private isVersionDismissed(version?: string): boolean {
    if (!version) return false;
    try {
      return localStorage.getItem(DISMISSED_VERSION_KEY) === version;
    } catch {
      return false;
    }
  }

  /**
   * Clear dismissed version (e.g., when user manually checks)
   */
  clearDismissed(): void {
    try {
      localStorage.removeItem(DISMISSED_VERSION_KEY);
    } catch {
      // Storage might be unavailable
    }
  }

  /**
   * Get last check time
   */
  private getLastCheckTime(): number | null {
    try {
      const value = localStorage.getItem(LAST_CHECK_KEY);
      return value ? parseInt(value, 10) : null;
    } catch {
      return null;
    }
  }

  /**
   * Set last check time
   */
  private setLastCheckTime(time: number): void {
    try {
      localStorage.setItem(LAST_CHECK_KEY, String(time));
    } catch {
      // Storage might be unavailable
    }
  }

  /**
   * Force a fresh check (clears dismissed and rate limit)
   */
  async forceCheck(): Promise<UpdateCheckResult> {
    this.clearDismissed();
    try {
      localStorage.removeItem(LAST_CHECK_KEY);
    } catch {
      // Ignore
    }
    return this.checkForUpdates();
  }

  /**
   * Cleanup and destroy the checker
   */
  destroy(): void {
    this.stopPeriodicChecks();
    this.callbacks.clear();
    UpdateChecker.instance = null;
  }
}

// ============================================================================
// Type Declarations for Build-time Variables
// ============================================================================

declare const __APP_VERSION__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

// ============================================================================
// Singleton Export
// ============================================================================

export const updateChecker = UpdateChecker.getInstance();

export default updateChecker;
