/**
 * useApp Hook - App-Level State Management
 *
 * Provides a unified interface for accessing app-level state and actions:
 * - Initialization status and progress
 * - Online/offline status
 * - Error state
 * - Connection status (Nostr relays, WebRTC peers)
 * - App lifecycle management
 *
 * @module hooks/useApp
 */

import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  useAppStore,
  useHasIdentity,
  useIsKeyLoaded,
  clearAllStores,
} from '../stores';
import {
  initializeApp,
  isAppInitialized,
  shutdownApp,
  getInitializer,
  type InitResult,
  type InitStep,
  type InitProgressCallback,
} from '../services/init';
import { nostrClient, type ConnectionStatus } from '../services/nostr';
import { getTrysteroService } from '../services/webrtc';

// ============================================================================
// Types
// ============================================================================

/**
 * Initialization state
 */
export interface InitState {
  /** Whether initialization has started */
  started: boolean;
  /** Whether initialization is complete */
  complete: boolean;
  /** Whether initialization failed */
  failed: boolean;
  /** Current initialization step */
  currentStep: InitStep | null;
  /** Progress percentage (0-100) */
  progress: number;
  /** Status message */
  message: string;
  /** Error if initialization failed */
  error: Error | null;
  /** Full initialization result */
  result: InitResult | null;
}

/**
 * Connection state
 */
export interface ConnectionState {
  /** Online/offline status */
  isOnline: boolean;
  /** Whether connected to at least one relay */
  hasRelayConnection: boolean;
  /** Number of connected relays */
  relayCount: number;
  /** Total number of relays */
  totalRelays: number;
  /** Number of connected WebRTC peers */
  webrtcPeerCount: number;
  /** Connection quality indicator */
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
}

/**
 * App state
 */
export interface AppState {
  /** Whether the app is ready for use */
  isReady: boolean;
  /** Whether user has an identity */
  hasIdentity: boolean;
  /** Whether identity keys are unlocked */
  isUnlocked: boolean;
  /** Whether the app is in background */
  isBackground: boolean;
  /** App version */
  version: string;
}

/**
 * App actions
 */
export interface AppActions {
  /** Initialize the app */
  initialize: () => Promise<InitResult>;
  /** Shutdown and cleanup */
  shutdown: () => Promise<void>;
  /** Reset all data (emergency wipe) */
  wipeAll: () => Promise<void>;
  /** Reconnect to relays */
  reconnectRelays: () => Promise<void>;
  /** Set app as ready */
  setReady: () => void;
}

/**
 * Return type for useApp hook
 */
export interface UseAppReturn {
  /** Initialization state */
  init: InitState;
  /** Connection state */
  connection: ConnectionState;
  /** App state */
  app: AppState;
  /** App actions */
  actions: AppActions;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Main app-level hook
 *
 * Provides access to all app-level state and actions in one place.
 *
 * @example
 * ```typescript
 * const { init, connection, app, actions } = useApp();
 *
 * useEffect(() => {
 *   if (!init.complete) {
 *     actions.initialize();
 *   }
 * }, []);
 *
 * if (!init.complete) {
 *   return <Loading progress={init.progress} />;
 * }
 *
 * if (!app.hasIdentity) {
 *   return <Onboarding />;
 * }
 *
 * return <MainApp />;
 * ```
 */
export function useApp(): UseAppReturn {
  // Store hooks
  const isInitialized = useAppStore((s) => s.isInitialized);
  const isOnline = useAppStore((s) => s.isOnline);
  const setIsOnline = useAppStore((s) => s.setOnline);
  const setInitialized = useAppStore((s) => s.setInitialized);
  const isBackground = useAppStore((s) => s.isBackground);
  const version = useAppStore((s) => s.version);
  const hasIdentity = useHasIdentity();
  const isKeyLoaded = useIsKeyLoaded();

  // Local state for initialization
  const [initState, setInitState] = useState<InitState>({
    started: false,
    complete: isAppInitialized(),
    failed: false,
    currentStep: null,
    progress: 0,
    message: '',
    error: null,
    result: null,
  });

  // Connection state
  const [relayStatus, setRelayStatus] = useState<ConnectionStatus | null>(null);
  const [webrtcPeerCount, setWebrtcPeerCount] = useState(0);

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setIsOnline]);

  // Track relay connection status
  useEffect(() => {
    const unsubscribe = nostrClient.onConnectionChange((status) => {
      setRelayStatus(status);
    });

    // Get initial status
    if (nostrClient.isConnected()) {
      setRelayStatus(nostrClient.getConnectionStatus());
    }

    return unsubscribe;
  }, []);

  // Track WebRTC peer count
  useEffect(() => {
    const checkPeers = () => {
      try {
        const trystero = getTrysteroService();
        const state = trystero.getState();
        // state.peers is a Map, use .size instead of .length
        setWebrtcPeerCount(state.peers.size);
      } catch {
        // Service not initialized yet
        setWebrtcPeerCount(0);
      }
    };

    // Check periodically
    const interval = setInterval(checkPeers, 5000);
    checkPeers();

    return () => clearInterval(interval);
  }, []);

  // Progress callback for initialization
  const onProgress: InitProgressCallback = useCallback(
    (step, status, progress, message) => {
      setInitState((prev) => ({
        ...prev,
        currentStep: step,
        progress,
        message: message ?? `${step}: ${status}`,
        failed: status === 'failed',
      }));
    },
    []
  );

  // Initialize app
  const initialize = useCallback(async (): Promise<InitResult> => {
    if (initState.started && !initState.failed) {
      // Already initializing, wait for completion
      const initializer = getInitializer();
      return initializer.initialize();
    }

    setInitState((prev) => ({
      ...prev,
      started: true,
      failed: false,
      error: null,
    }));

    try {
      const result = await initializeApp({ onProgress });

      setInitState((prev) => ({
        ...prev,
        complete: result.success,
        failed: !result.success,
        progress: 100,
        result,
        message: result.success ? 'Initialization complete' : 'Initialization failed',
      }));

      if (result.success) {
        setInitialized(true);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setInitState((prev) => ({
        ...prev,
        failed: true,
        error: err,
        message: err.message,
      }));
      throw error;
    }
  }, [initState.started, initState.failed, onProgress, setInitialized]);

  // Shutdown app
  const shutdown = useCallback(async () => {
    await shutdownApp();
    setInitState({
      started: false,
      complete: false,
      failed: false,
      currentStep: null,
      progress: 0,
      message: '',
      error: null,
      result: null,
    });
  }, []);

  // Emergency wipe
  const wipeAll = useCallback(async () => {
    // Shutdown services first
    await shutdown();

    // Clear all stores
    clearAllStores();

    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // Clear sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }

    // Reload the page to ensure clean state
    window.location.reload();
  }, [shutdown]);

  // Reconnect to relays
  const reconnectRelays = useCallback(async () => {
    if (nostrClient.isConnected()) {
      await nostrClient.resetConnections();
    } else {
      await nostrClient.connect();
    }
  }, []);

  // Set ready
  const setReady = useCallback(() => {
    setInitialized(true);
    setInitState((prev) => ({
      ...prev,
      complete: true,
    }));
  }, [setInitialized]);

  // Calculate connection quality
  const connectionQuality = useMemo((): ConnectionState['quality'] => {
    if (!isOnline) return 'offline';
    if (!relayStatus) return 'poor';

    const relayPercent = relayStatus.connectedCount / Math.max(relayStatus.totalCount, 1);

    if (relayPercent >= 0.8 && webrtcPeerCount > 0) return 'excellent';
    if (relayPercent >= 0.5 || webrtcPeerCount > 0) return 'good';
    if (relayPercent >= 0.2) return 'fair';
    if (relayStatus.connectedCount > 0) return 'poor';
    return 'offline';
  }, [isOnline, relayStatus, webrtcPeerCount]);

  // Build return value
  return {
    init: initState,
    connection: {
      isOnline,
      hasRelayConnection: relayStatus?.isConnected ?? false,
      relayCount: relayStatus?.connectedCount ?? 0,
      totalRelays: relayStatus?.totalCount ?? 0,
      webrtcPeerCount,
      quality: connectionQuality,
    },
    app: {
      isReady: isInitialized && initState.complete,
      hasIdentity,
      isUnlocked: isKeyLoaded,
      isBackground,
      version,
    },
    actions: {
      initialize,
      shutdown,
      wipeAll,
      reconnectRelays,
      setReady,
    },
  };
}

// ============================================================================
// Convenience Hooks
// ============================================================================

/**
 * Hook for initialization state only
 */
export function useAppInit(): InitState {
  const { init } = useApp();
  return init;
}

/**
 * Hook for connection state only
 */
export function useAppConnection(): ConnectionState {
  const { connection } = useApp();
  return connection;
}

/**
 * Hook for checking if app is ready
 */
export function useAppReady(): boolean {
  const { app } = useApp();
  return app.isReady;
}

/**
 * Hook for online status
 */
export function useOnlineStatus(): boolean {
  const { connection } = useApp();
  return connection.isOnline;
}

/**
 * Hook for relay connection count
 */
export function useRelayCount(): number {
  const { connection } = useApp();
  return connection.relayCount;
}

/**
 * Hook for WebRTC peer count
 */
export function useWebRTCPeerCount(): number {
  const { connection } = useApp();
  return connection.webrtcPeerCount;
}

// ============================================================================
// Default Export
// ============================================================================

export default useApp;
