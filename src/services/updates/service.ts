/**
 * BitChat In Browser - Update Service
 *
 * Manages service worker registration, update detection, and update application.
 * Provides a clean API for the app to interact with the service worker lifecycle.
 */

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';

export interface UpdateInfo {
  status: UpdateStatus;
  timestamp?: number;
  error?: Error;
}

export type UpdateCallback = (info: UpdateInfo) => void;

/**
 * UpdateService Class
 *
 * Singleton service that manages:
 * - Service worker registration
 * - Update detection and notification
 * - Update application (page reload)
 */
export class UpdateService {
  private static instance: UpdateService | null = null;

  private registration: ServiceWorkerRegistration | null = null;
  private updateCallback: UpdateCallback | null = null;
  private status: UpdateStatus = 'idle';
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  // Check for updates every 30 minutes
  private readonly CHECK_INTERVAL_MS = 30 * 60 * 1000;

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * Check if service workers are supported
   */
  static isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Register the service worker and set up update handlers
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!UpdateService.isSupported()) {
      console.warn('[UpdateService] Service workers not supported');
      return null;
    }

    try {
      // Register the service worker
      // Note: The actual SW path will be configured by vite-plugin-pwa
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        type: 'module',
      });

      console.log('[UpdateService] Service worker registered:', this.registration.scope);

      // Set up event listeners
      this.setupEventListeners();

      // Start periodic update checks
      this.startPeriodicChecks();

      return this.registration;
    } catch (error) {
      console.error('[UpdateService] Registration failed:', error);
      this.notifyUpdate({
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return null;
    }
  }

  /**
   * Set up event listeners for service worker updates
   */
  private setupEventListeners(): void {
    if (!this.registration) return;

    // Handle updates found during registration
    if (this.registration.waiting) {
      this.handleUpdateFound();
    }

    // Handle new service worker installing
    this.registration.addEventListener('updatefound', () => {
      this.handleUpdateFound();
    });

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[UpdateService] Controller changed, reloading...');
      // Reload to ensure we're using the new version
      window.location.reload();
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      this.handleServiceWorkerMessage(event);
    });
  }

  /**
   * Handle when a new service worker is found
   */
  private handleUpdateFound(): void {
    if (!this.registration) return;

    const newWorker = this.registration.installing;
    if (!newWorker) {
      // Worker already waiting
      this.notifyUpdate({ status: 'ready', timestamp: Date.now() });
      return;
    }

    this.notifyUpdate({ status: 'downloading' });

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed') {
        if (navigator.serviceWorker.controller) {
          // New version available
          this.notifyUpdate({ status: 'ready', timestamp: Date.now() });
          console.log('[UpdateService] New version available');
        } else {
          // First install, no update needed
          this.notifyUpdate({ status: 'idle' });
          console.log('[UpdateService] Service worker installed for first time');
        }
      }
    });
  }

  /**
   * Handle messages from the service worker
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, ...data } = event.data || {};

    switch (type) {
      case 'SYNC_REQUESTED':
        // Emit event for offline queue to handle
        window.dispatchEvent(new CustomEvent('sw-sync-requested', { detail: data }));
        break;

      case 'UPDATE_AVAILABLE':
        this.notifyUpdate({ status: 'available', timestamp: Date.now() });
        break;

      default:
        // Unknown message type
        break;
    }
  }

  /**
   * Check for updates manually
   */
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) {
      console.warn('[UpdateService] Cannot check updates: not registered');
      return false;
    }

    this.notifyUpdate({ status: 'checking' });

    try {
      await this.registration.update();

      // Check if there's a waiting worker
      if (this.registration.waiting) {
        this.notifyUpdate({ status: 'ready', timestamp: Date.now() });
        return true;
      }

      this.notifyUpdate({ status: 'idle' });
      return false;
    } catch (error) {
      console.error('[UpdateService] Update check failed:', error);
      this.notifyUpdate({
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Apply the pending update
   * This will trigger a page reload
   */
  applyUpdate(): void {
    if (!this.registration?.waiting) {
      console.warn('[UpdateService] No update waiting to be applied');
      return;
    }

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  /**
   * Start periodic update checks
   */
  private startPeriodicChecks(): void {
    // Clear any existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Check periodically
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, this.CHECK_INTERVAL_MS);

    // Also check when coming back online
    window.addEventListener('online', () => {
      this.checkForUpdates();
    });

    // Check when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForUpdates();
      }
    });
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
   * Set callback for update notifications
   */
  onUpdate(callback: UpdateCallback): () => void {
    this.updateCallback = callback;

    // Immediately notify with current status
    callback({ status: this.status });

    // Return unsubscribe function
    return () => {
      this.updateCallback = null;
    };
  }

  /**
   * Notify the app of an update status change
   */
  private notifyUpdate(info: UpdateInfo): void {
    this.status = info.status;

    if (this.updateCallback) {
      this.updateCallback(info);
    }

    // Also dispatch a custom event for components that aren't using the callback
    window.dispatchEvent(new CustomEvent('sw-update', { detail: info }));
  }

  /**
   * Get current update status
   */
  getStatus(): UpdateStatus {
    return this.status;
  }

  /**
   * Check if an update is ready to be applied
   */
  hasUpdateReady(): boolean {
    return this.status === 'ready' && !!this.registration?.waiting;
  }

  /**
   * Get the service worker registration
   */
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  /**
   * Unregister the service worker
   * Use with caution - typically only for debugging/testing
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    this.stopPeriodicChecks();

    const result = await this.registration.unregister();
    if (result) {
      this.registration = null;
      console.log('[UpdateService] Service worker unregistered');
    }

    return result;
  }

  /**
   * Clear all caches
   * Use with caution - forces re-download of all assets
   */
  async clearCaches(): Promise<void> {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map((cacheName) => caches.delete(cacheName))
    );
    console.log('[UpdateService] All caches cleared');
  }
}

// Export singleton instance
export const updateService = UpdateService.getInstance();

// Export default for convenience
export default updateService;
