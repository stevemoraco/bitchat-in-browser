/**
 * BitChat In Browser - Application Entry Point
 *
 * Initializes the PWA with:
 * - Service worker registration
 * - Update detection and management
 * - Crypto initialization
 * - Storage initialization
 * - Nostr connection setup
 * - Main app rendering
 *
 * @module main
 */

import { render } from 'preact';
import { App } from './App';
import './styles/index.css';
import { registerSW, type RegisterSWResult } from './workers/sw-registration';
import { updateChecker, updateInstaller } from './services/updates';
import { initializeApp, type InitResult } from './services/init';

// ============================================================================
// Global State
// ============================================================================

/** Service worker registration result */
let swResult: RegisterSWResult | null = null;

/** App initialization result */
let appInitResult: InitResult | null = null;

// ============================================================================
// Service Worker Registration
// ============================================================================

/**
 * Initialize the service worker and update system
 */
async function initServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.log('[Main] Service workers not supported');
    return;
  }

  try {
    // Register service worker with update handling
    swResult = await registerSW({
      // Handle update detection
      onUpdate: (info) => {
        console.log('[Main] Update status:', info.status);

        if (info.status === 'ready') {
          // Update is ready to be applied
          // Dispatch custom event for UI components to handle
          window.dispatchEvent(
            new CustomEvent('sw-update-ready', {
              detail: { timestamp: info.timestamp },
            })
          );
        }
      },

      // Handle offline ready
      onOfflineReady: () => {
        console.log('[Main] App is ready to work offline');
        window.dispatchEvent(new CustomEvent('sw-offline-ready'));
      },

      // Handle errors
      onError: (error) => {
        console.error('[Main] Service worker error:', error);
      },

      // Don't auto-reload - let user decide
      autoReload: false,
    });

    // Initialize update checker
    await updateChecker.init();

    // Initialize update installer
    await updateInstaller.init();

    // Make SW controls available globally for debugging
    if (import.meta.env.DEV) {
      (window as any).__bitchat_sw = {
        checkForUpdates: () => swResult?.checkForUpdates(),
        applyUpdate: () => swResult?.applyUpdate(),
        getStatus: () => swResult?.getStatus(),
        hasUpdate: () => swResult?.hasUpdate(),
        clearCaches: () => swResult?.clearCaches(),
        unregister: () => swResult?.unregister(),
      };
      console.log('[Main] SW debug controls available at window.__bitchat_sw');
    }
  } catch (error) {
    console.error('[Main] Failed to initialize service worker:', error);
  }
}

// ============================================================================
// App Initialization
// ============================================================================

/**
 * Pre-initialize critical services before rendering
 *
 * This runs the initialization sequence for services that must be ready
 * before the app can meaningfully render. The App component will handle
 * showing loading states while this completes.
 */
async function preInitialize(): Promise<void> {
  try {
    // Initialize app services (crypto, storage, identity, nostr, etc.)
    // Progress will be shown by the App component
    appInitResult = await initializeApp({
      // Don't skip any services - we want full initialization
      skipNostr: false,
      skipWebRTC: false,
      skipSync: false,
      // Set a reasonable timeout for relay connections
      relayTimeoutMs: 10000,
      // Progress callback for debugging
      onProgress: (step, status, progress, message) => {
        console.log(`[Main] Init: ${step} ${status} (${progress}%) - ${message}`);

        // Dispatch progress event for any interested listeners
        window.dispatchEvent(
          new CustomEvent('app-init-progress', {
            detail: { step, status, progress, message },
          })
        );
      },
    });

    if (appInitResult.success) {
      console.log('[Main] App initialized successfully:', {
        hasIdentity: appInitResult.hasIdentity,
        storageType: appInitResult.storageType,
        relayCount: appInitResult.relayCount,
        durationMs: appInitResult.totalDurationMs.toFixed(0),
      });

      // Dispatch success event
      window.dispatchEvent(
        new CustomEvent('app-init-complete', {
          detail: appInitResult,
        })
      );
    } else {
      console.warn('[Main] App initialization had issues:', appInitResult.steps);
    }
  } catch (error) {
    console.error('[Main] App initialization failed:', error);

    // Dispatch failure event
    window.dispatchEvent(
      new CustomEvent('app-init-failed', {
        detail: { error },
      })
    );

    // Don't throw - let the App component handle showing error state
  }
}

// ============================================================================
// Application Mount
// ============================================================================

/**
 * Initialize and mount the application
 */
async function initApp(): Promise<void> {
  const startTime = performance.now();

  console.log('[Main] BitChat In Browser starting...');

  // Start service worker registration (don't block app rendering)
  // This runs in parallel with the main initialization
  initServiceWorker().catch((error) => {
    console.error('[Main] Service worker init error:', error);
  });

  // Start pre-initialization (crypto, storage, identity)
  // This also runs in parallel - the App component will show loading state
  preInitialize().catch((error) => {
    console.error('[Main] Pre-init error:', error);
  });

  // Mount the app immediately - it will handle showing loading states
  const container = document.getElementById('app');

  if (container) {
    render(<App />, container);

    const mountTime = performance.now() - startTime;
    console.log(`[Main] App mounted in ${mountTime.toFixed(0)}ms`);
  } else {
    console.error('[Main] Could not find #app container');
  }
}

// ============================================================================
// Global Error Handling
// ============================================================================

/**
 * Global error handler for uncaught errors
 */
window.addEventListener('error', (event) => {
  console.error('[Main] Uncaught error:', event.error);

  // Report to error tracking service in production
  // TODO: Add error reporting service integration
});

/**
 * Global handler for unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Main] Unhandled promise rejection:', event.reason);

  // Report to error tracking service in production
  // TODO: Add error reporting service integration
});

// ============================================================================
// Visibility Change Handling
// ============================================================================

/**
 * Handle app visibility changes for power management
 */
document.addEventListener('visibilitychange', () => {
  const isHidden = document.hidden;

  // Dispatch event for app components to handle
  window.dispatchEvent(
    new CustomEvent('app-visibility-change', {
      detail: { isHidden },
    })
  );

  if (isHidden) {
    console.log('[Main] App moved to background');
  } else {
    console.log('[Main] App returned to foreground');
  }
});

// ============================================================================
// Network Status Handling
// ============================================================================

/**
 * Handle online/offline events
 */
window.addEventListener('online', () => {
  console.log('[Main] Network online');
  window.dispatchEvent(new CustomEvent('app-online'));
});

window.addEventListener('offline', () => {
  console.log('[Main] Network offline');
  window.dispatchEvent(new CustomEvent('app-offline'));
});

// ============================================================================
// Start the App
// ============================================================================

initApp();

// ============================================================================
// Hot Module Replacement (Development)
// ============================================================================

if (import.meta.hot) {
  import.meta.hot.accept();
}

// ============================================================================
// Exports for Testing
// ============================================================================

export { swResult, appInitResult };
