/**
 * useServiceWorker Hook
 *
 * React/Preact hook for service worker registration state with:
 * - Update available detection
 * - Registration error handling
 * - Manual update trigger
 * - Auto-update countdown
 *
 * @module hooks/useServiceWorker
 */

import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import {
  updateService,
  updateChecker,
  updateInstaller,
  type UpdateStatus,
  type UpdateCheckResult,
  type InstallProgress,
} from '../services/updates';

// ============================================================================
// Types
// ============================================================================

export interface ServiceWorkerState {
  /** Whether service workers are supported */
  isSupported: boolean;
  /** Whether the SW is registered and active */
  isRegistered: boolean;
  /** Whether the app is ready to work offline */
  isOfflineReady: boolean;
  /** Whether an update is available and waiting */
  hasUpdate: boolean;
  /** Whether this is a critical security update */
  isCriticalUpdate: boolean;
  /** Current update status */
  status: UpdateStatus;
  /** Current version string */
  currentVersion: string;
  /** New version string (if update available) */
  newVersion?: string;
  /** Release notes for new version */
  releaseNotes?: string[];
  /** Installation progress (when updating) */
  installProgress?: InstallProgress;
  /** Any error that occurred */
  error?: Error;
}

export interface ServiceWorkerActions {
  /** Check for updates manually */
  checkForUpdates: () => Promise<boolean>;
  /** Apply pending update (triggers reload) */
  applyUpdate: () => void;
  /** Dismiss the update notification */
  dismissUpdate: () => void;
  /** Start auto-update countdown */
  startAutoUpdate: (seconds: number) => void;
  /** Cancel auto-update countdown */
  cancelAutoUpdate: () => void;
  /** Clear all caches */
  clearCaches: () => Promise<void>;
  /** Unregister service worker */
  unregister: () => Promise<boolean>;
}

export interface UseServiceWorkerOptions {
  /** Whether to check for updates on mount (default: true) */
  checkOnMount?: boolean;
  /** Whether to show update prompt automatically (default: true) */
  autoShowPrompt?: boolean;
  /** Callback when update is available */
  onUpdateAvailable?: (version: string) => void;
  /** Callback when offline ready */
  onOfflineReady?: () => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export type UseServiceWorkerReturn = [ServiceWorkerState, ServiceWorkerActions];

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing service worker registration and updates
 *
 * @example
 * ```tsx
 * const [sw, actions] = useServiceWorker({
 *   onUpdateAvailable: (version) => {
 *     console.log(`Update available: ${version}`);
 *   },
 * });
 *
 * if (sw.hasUpdate) {
 *   return (
 *     <UpdatePrompt
 *       currentVersion={sw.currentVersion}
 *       newVersion={sw.newVersion!}
 *       onUpdate={actions.applyUpdate}
 *       onDismiss={actions.dismissUpdate}
 *     />
 *   );
 * }
 * ```
 */
export function useServiceWorker(
  options: UseServiceWorkerOptions = {}
): UseServiceWorkerReturn {
  const {
    checkOnMount = true,
    autoShowPrompt = true,
    onUpdateAvailable,
    onOfflineReady,
    onError,
  } = options;

  // State
  const [state, setState] = useState<ServiceWorkerState>(() => ({
    isSupported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    isRegistered: false,
    isOfflineReady: false,
    hasUpdate: false,
    isCriticalUpdate: false,
    status: 'idle',
    currentVersion: '0.0.0',
  }));

  // Refs for callbacks
  const onUpdateAvailableRef = useRef(onUpdateAvailable);
  const onOfflineReadyRef = useRef(onOfflineReady);
  const onErrorRef = useRef(onError);

  // Keep refs updated
  useEffect(() => {
    onUpdateAvailableRef.current = onUpdateAvailable;
    onOfflineReadyRef.current = onOfflineReady;
    onErrorRef.current = onError;
  }, [onUpdateAvailable, onOfflineReady, onError]);

  // Auto-update countdown ref
  const autoUpdateCancelRef = useRef<(() => void) | null>(null);

  // Initialize on mount
  useEffect(() => {
    if (!state.isSupported) {
      return;
    }

    // Initialize services
    const initServices = async () => {
      try {
        // Initialize update checker
        await updateChecker.init();

        // Initialize installer
        await updateInstaller.init();

        // Register service worker
        const registration = await updateService.register();

        if (registration) {
          updateInstaller.setRegistration(registration);

          setState((prev) => ({
            ...prev,
            isRegistered: true,
            isOfflineReady: !!registration.active,
            currentVersion: updateChecker.getCurrentVersion()?.version || '0.0.0',
          }));

          // Notify offline ready
          if (registration.active) {
            onOfflineReadyRef.current?.();
          }
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState((prev) => ({ ...prev, error: err }));
        onErrorRef.current?.(err);
      }
    };

    initServices();

    // Set up update service listener
    const unsubscribeUpdate = updateService.onUpdate((info) => {
      setState((prev) => ({
        ...prev,
        status: info.status,
        error: info.error,
      }));
    });

    // Set up update checker listener
    const unsubscribeChecker = updateChecker.onUpdate((result: UpdateCheckResult) => {
      if (result.hasUpdate && autoShowPrompt) {
        setState((prev) => ({
          ...prev,
          hasUpdate: true,
          newVersion: result.newVersion,
          isCriticalUpdate: result.isCritical,
          releaseNotes: result.releaseNotes,
        }));

        // Notify callback
        if (result.newVersion) {
          onUpdateAvailableRef.current?.(result.newVersion);
        }
      }
    });

    // Set up installer progress listener
    const unsubscribeInstaller = updateInstaller.onProgress((progress) => {
      setState((prev) => ({
        ...prev,
        installProgress: progress,
      }));
    });

    // Initial check
    if (checkOnMount) {
      // Delay to not block app startup
      setTimeout(() => {
        updateChecker.checkForUpdates();
      }, 3000);
    }

    // Cleanup
    return () => {
      unsubscribeUpdate();
      unsubscribeChecker();
      unsubscribeInstaller();
      autoUpdateCancelRef.current?.();
    };
  }, [state.isSupported, checkOnMount, autoShowPrompt]);

  // Actions
  const checkForUpdates = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    // Clear dismissed version to show update even if previously dismissed
    updateChecker.clearDismissed();

    const result = await updateChecker.forceCheck();
    return result.hasUpdate;
  }, [state.isSupported]);

  const applyUpdate = useCallback(() => {
    // Cancel any auto-update countdown
    autoUpdateCancelRef.current?.();

    // Apply the update
    updateInstaller.applyUpdate();
  }, []);

  const dismissUpdate = useCallback(() => {
    // Cancel any auto-update countdown
    autoUpdateCancelRef.current?.();

    // Dismiss the current version
    if (state.newVersion) {
      updateChecker.dismissVersion(state.newVersion);
    }

    setState((prev) => ({
      ...prev,
      hasUpdate: false,
      newVersion: undefined,
    }));
  }, [state.newVersion]);

  const startAutoUpdate = useCallback((seconds: number) => {
    autoUpdateCancelRef.current = updateInstaller.startAutoUpdateCountdown(
      seconds,
      (remaining) => {
        // Could update state to show countdown in UI
        console.log(`[SW] Auto-update in ${remaining}s`);
      }
    );
  }, []);

  const cancelAutoUpdate = useCallback(() => {
    updateInstaller.cancelAutoUpdateCountdown();
    autoUpdateCancelRef.current = null;
  }, []);

  const clearCaches = useCallback(async () => {
    await updateService.clearCaches();
  }, []);

  const unregister = useCallback(async (): Promise<boolean> => {
    const result = await updateService.unregister();
    if (result) {
      setState((prev) => ({
        ...prev,
        isRegistered: false,
        isOfflineReady: false,
      }));
    }
    return result;
  }, []);

  // Actions object
  const actions: ServiceWorkerActions = {
    checkForUpdates,
    applyUpdate,
    dismissUpdate,
    startAutoUpdate,
    cancelAutoUpdate,
    clearCaches,
    unregister,
  };

  return [state, actions];
}

// ============================================================================
// Simplified Hooks
// ============================================================================

/**
 * Simple hook to check if an update is available
 */
export function useUpdateAvailable(): boolean {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const unsubscribe = updateChecker.onUpdate((result) => {
      setHasUpdate(result.hasUpdate);
    });

    return unsubscribe;
  }, []);

  return hasUpdate;
}

/**
 * Simple hook to get current update status
 */
export function useUpdateStatus(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>('idle');

  useEffect(() => {
    const unsubscribe = updateService.onUpdate((info) => {
      setStatus(info.status);
    });

    return unsubscribe;
  }, []);

  return status;
}

/**
 * Hook to get current app version
 */
export function useAppVersion(): string {
  const [version, setVersion] = useState('0.0.0');

  useEffect(() => {
    const currentVersion = updateChecker.getCurrentVersion();
    if (currentVersion) {
      setVersion(currentVersion.version);
    }
  }, []);

  return version;
}

// ============================================================================
// Exports
// ============================================================================

export default useServiceWorker;
