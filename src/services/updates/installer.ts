/**
 * BitChat In Browser - Update Installer Service
 *
 * Handles the installation of service worker updates with state
 * preservation and graceful app reloading. Designed for IPFS hosting
 * where updates involve new content hashes.
 *
 * Features:
 * - Skip waiting on new Service Worker
 * - Preserve application state during update
 * - Graceful app reload
 * - Update failure handling
 * - Auto-update countdown timer
 *
 * @module services/updates/installer
 */

// ============================================================================
// Types
// ============================================================================

export type InstallStatus =
  | 'idle'
  | 'pending'
  | 'preserving-state'
  | 'activating'
  | 'reloading'
  | 'failed';

export interface InstallProgress {
  status: InstallStatus;
  message: string;
  progress?: number; // 0-100
  error?: Error;
}

export interface StateSnapshot {
  timestamp: number;
  path: string;
  scrollPosition: number;
  formData?: Record<string, string>;
  customState?: Record<string, unknown>;
}

export type InstallProgressCallback = (progress: InstallProgress) => void;

export interface UpdateInstallerConfig {
  /** Whether to auto-reload after skipWaiting (default: true) */
  autoReload?: boolean;
  /** Delay before reload in ms (default: 500) */
  reloadDelay?: number;
  /** Whether to preserve state before reload (default: true) */
  preserveState?: boolean;
  /** Storage key for state snapshot (default: 'bitchat-update-state') */
  stateStorageKey?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: Required<UpdateInstallerConfig> = {
  autoReload: true,
  reloadDelay: 500,
  preserveState: true,
  stateStorageKey: 'bitchat-update-state',
};

// Storage keys
const UPDATE_PENDING_KEY = 'bitchat-update-pending';
const UPDATE_INSTALLED_KEY = 'bitchat-update-installed';

// ============================================================================
// Update Installer Class
// ============================================================================

/**
 * UpdateInstaller - Manages update installation process
 *
 * Handles:
 * - Triggering service worker skipWaiting
 * - Preserving user state before reload
 * - Restoring state after update
 * - Showing progress to user
 */
export class UpdateInstaller {
  private static instance: UpdateInstaller | null = null;

  private config: Required<UpdateInstallerConfig>;
  private callbacks: Set<InstallProgressCallback> = new Set();
  private currentStatus: InstallStatus = 'idle';
  private registration: ServiceWorkerRegistration | null = null;
  private autoUpdateTimer: ReturnType<typeof setTimeout> | null = null;
  private countdownCallback: ((seconds: number) => void) | null = null;

  private constructor(config: UpdateInstallerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: UpdateInstallerConfig): UpdateInstaller {
    if (!UpdateInstaller.instance) {
      UpdateInstaller.instance = new UpdateInstaller(config);
    }
    return UpdateInstaller.instance;
  }

  /**
   * Initialize the installer
   */
  async init(): Promise<void> {
    // Get service worker registration
    if ('serviceWorker' in navigator) {
      this.registration = (await navigator.serviceWorker.getRegistration()) || null;

      // Listen for controller changes (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.handleControllerChange();
      });
    }

    // Check if we just completed an update
    this.checkPostUpdateState();

    console.log('[UpdateInstaller] Initialized');
  }

  /**
   * Set the service worker registration
   */
  setRegistration(registration: ServiceWorkerRegistration): void {
    this.registration = registration;
  }

  /**
   * Apply a pending update
   * This triggers the waiting service worker to activate
   */
  async applyUpdate(): Promise<boolean> {
    if (!this.registration?.waiting) {
      console.warn('[UpdateInstaller] No waiting service worker');
      return false;
    }

    this.updateStatus('pending');
    this.notifyProgress({
      status: 'pending',
      message: 'Preparing update...',
      progress: 0,
    });

    try {
      // Step 1: Preserve state
      if (this.config.preserveState) {
        this.updateStatus('preserving-state');
        this.notifyProgress({
          status: 'preserving-state',
          message: 'Saving your session...',
          progress: 25,
        });

        await this.preserveState();
      }

      // Step 2: Mark update as pending
      this.markUpdatePending();

      // Step 3: Tell waiting SW to skip waiting
      this.updateStatus('activating');
      this.notifyProgress({
        status: 'activating',
        message: 'Installing update...',
        progress: 50,
      });

      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

      // The controllerchange event will trigger the reload
      return true;
    } catch (error) {
      this.updateStatus('failed');
      this.notifyProgress({
        status: 'failed',
        message: 'Update failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Handle controller change (new SW activated)
   */
  private handleControllerChange(): void {
    // Check if we initiated this update
    if (!this.isUpdatePending()) {
      // External update (e.g., from another tab)
      console.log('[UpdateInstaller] External update detected');
    }

    this.updateStatus('reloading');
    this.notifyProgress({
      status: 'reloading',
      message: 'Update installed! Reloading...',
      progress: 100,
    });

    // Mark as installed
    this.markUpdateInstalled();
    this.clearUpdatePending();

    // Reload with delay for user to see the message
    if (this.config.autoReload) {
      setTimeout(() => {
        window.location.reload();
      }, this.config.reloadDelay);
    }
  }

  /**
   * Preserve application state before reload
   */
  private async preserveState(): Promise<void> {
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      path: window.location.pathname + window.location.search + window.location.hash,
      scrollPosition: window.scrollY,
    };

    // Collect form data from focused form
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
      const form = activeElement.closest('form');
      if (form) {
        const formData = new FormData(form);
        snapshot.formData = {};
        formData.forEach((value, key) => {
          if (typeof value === 'string') {
            snapshot.formData![key] = value;
          }
        });
      }
    }

    // Allow custom state preservation
    const customState = await this.collectCustomState();
    if (customState) {
      snapshot.customState = customState;
    }

    // Store snapshot
    try {
      sessionStorage.setItem(this.config.stateStorageKey, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('[UpdateInstaller] Failed to preserve state:', error);
    }
  }

  /**
   * Collect custom state from app
   * Dispatches event for app to provide state
   */
  private async collectCustomState(): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const event = new CustomEvent('update-preserve-state', {
        detail: { resolve },
      });

      window.dispatchEvent(event);

      // Timeout if app doesn't respond
      setTimeout(() => resolve(null), 500);
    });
  }

  /**
   * Restore state after update
   */
  restoreState(): StateSnapshot | null {
    try {
      const data = sessionStorage.getItem(this.config.stateStorageKey);
      if (!data) return null;

      const snapshot: StateSnapshot = JSON.parse(data);

      // Clear stored state
      sessionStorage.removeItem(this.config.stateStorageKey);

      // Check if snapshot is recent (within 30 seconds)
      if (Date.now() - snapshot.timestamp > 30000) {
        return null;
      }

      // Restore scroll position after a short delay
      setTimeout(() => {
        window.scrollTo(0, snapshot.scrollPosition);
      }, 100);

      return snapshot;
    } catch {
      return null;
    }
  }

  /**
   * Check post-update state and show notification if needed
   */
  private checkPostUpdateState(): void {
    const wasInstalled = this.wasJustInstalled();
    if (wasInstalled) {
      this.clearUpdateInstalled();

      // Dispatch event for app to show "update successful" message
      window.dispatchEvent(new CustomEvent('update-completed', {
        detail: { timestamp: Date.now() },
      }));
    }
  }

  /**
   * Start auto-update countdown
   * Automatically applies update after countdown
   */
  startAutoUpdateCountdown(
    seconds: number,
    onTick?: (remaining: number) => void
  ): () => void {
    let remaining = seconds;
    this.countdownCallback = onTick || null;

    // Clear any existing countdown
    this.cancelAutoUpdateCountdown();

    const tick = () => {
      if (this.countdownCallback) {
        this.countdownCallback(remaining);
      }

      if (remaining <= 0) {
        this.applyUpdate();
        return;
      }

      remaining--;
      this.autoUpdateTimer = setTimeout(tick, 1000);
    };

    tick();

    // Return cancel function
    return () => this.cancelAutoUpdateCountdown();
  }

  /**
   * Cancel auto-update countdown
   */
  cancelAutoUpdateCountdown(): void {
    if (this.autoUpdateTimer) {
      clearTimeout(this.autoUpdateTimer);
      this.autoUpdateTimer = null;
    }
    this.countdownCallback = null;
  }

  /**
   * Subscribe to install progress updates
   */
  onProgress(callback: InstallProgressCallback): () => void {
    this.callbacks.add(callback);

    // Immediately notify with current status
    callback({
      status: this.currentStatus,
      message: this.getStatusMessage(this.currentStatus),
    });

    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notify all callbacks of progress
   */
  private notifyProgress(progress: InstallProgress): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(progress);
      } catch (error) {
        console.error('[UpdateInstaller] Callback error:', error);
      }
    });
  }

  /**
   * Update current status
   */
  private updateStatus(status: InstallStatus): void {
    this.currentStatus = status;
  }

  /**
   * Get current status
   */
  getStatus(): InstallStatus {
    return this.currentStatus;
  }

  /**
   * Check if an update is waiting
   */
  hasWaitingUpdate(): boolean {
    return !!this.registration?.waiting;
  }

  /**
   * Get human-readable status message
   */
  private getStatusMessage(status: InstallStatus): string {
    switch (status) {
      case 'idle':
        return 'Ready';
      case 'pending':
        return 'Preparing update...';
      case 'preserving-state':
        return 'Saving your session...';
      case 'activating':
        return 'Installing update...';
      case 'reloading':
        return 'Update installed! Reloading...';
      case 'failed':
        return 'Update failed';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Mark update as pending (for cross-tab coordination)
   */
  private markUpdatePending(): void {
    try {
      localStorage.setItem(UPDATE_PENDING_KEY, String(Date.now()));
    } catch {
      // Storage might be unavailable
    }
  }

  /**
   * Check if update is pending
   */
  private isUpdatePending(): boolean {
    try {
      return !!localStorage.getItem(UPDATE_PENDING_KEY);
    } catch {
      return false;
    }
  }

  /**
   * Clear pending update flag
   */
  private clearUpdatePending(): void {
    try {
      localStorage.removeItem(UPDATE_PENDING_KEY);
    } catch {
      // Ignore
    }
  }

  /**
   * Mark that update was just installed
   */
  private markUpdateInstalled(): void {
    try {
      localStorage.setItem(UPDATE_INSTALLED_KEY, String(Date.now()));
    } catch {
      // Storage might be unavailable
    }
  }

  /**
   * Check if update was just installed
   */
  private wasJustInstalled(): boolean {
    try {
      const installed = localStorage.getItem(UPDATE_INSTALLED_KEY);
      if (!installed) return false;

      // Check if within last 30 seconds
      return Date.now() - parseInt(installed, 10) < 30000;
    } catch {
      return false;
    }
  }

  /**
   * Clear installed flag
   */
  private clearUpdateInstalled(): void {
    try {
      localStorage.removeItem(UPDATE_INSTALLED_KEY);
    } catch {
      // Ignore
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.cancelAutoUpdateCountdown();
    this.callbacks.clear();
    UpdateInstaller.instance = null;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const updateInstaller = UpdateInstaller.getInstance();

export default updateInstaller;
