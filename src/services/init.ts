/**
 * Application Initialization Service
 *
 * Orchestrates the startup sequence for BitChat In Browser PWA.
 * This module handles the proper initialization order of all services:
 *
 * 1. Initialize libsodium (crypto)
 * 2. Initialize storage (OPFS/IndexedDB)
 * 3. Load identity (if exists)
 * 4. Connect to Nostr relays
 * 5. Initialize WebRTC service
 * 6. Start sync service
 *
 * @module services/init
 */

import { CryptoService } from './crypto';
import { getStorageManager, type StorageInitResult } from './storage';
import { IdentityService, type StoredIdentity } from './identity';
import { nostrClient, type ConnectionStatus } from './nostr';
import { getTrysteroService, type TrysteroService } from './webrtc';
import {
  initSyncIntegration,
  getSyncIntegration,
  initNetworkStatus,
  type SyncIntegrationStatus,
} from './sync';
import { useAppStore, useIdentityStore } from '../stores';

// ============================================================================
// Types
// ============================================================================

/**
 * Initialization step identifiers
 */
export type InitStep =
  | 'crypto'
  | 'storage'
  | 'identity'
  | 'nostr'
  | 'webrtc'
  | 'sync';

/**
 * Status of a single initialization step
 */
export interface InitStepStatus {
  step: InitStep;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  error?: Error;
  durationMs?: number;
}

/**
 * Overall initialization result
 */
export interface InitResult {
  success: boolean;
  steps: InitStepStatus[];
  totalDurationMs: number;
  hasIdentity: boolean;
  storageType: string;
  relayCount: number;
}

/**
 * Progress callback for initialization
 */
export type InitProgressCallback = (
  step: InitStep,
  status: 'running' | 'success' | 'failed',
  progress: number, // 0-100
  message?: string
) => void;

/**
 * Initialization options
 */
export interface InitOptions {
  /** Skip connecting to Nostr relays */
  skipNostr?: boolean;
  /** Skip WebRTC initialization */
  skipWebRTC?: boolean;
  /** Skip sync service initialization */
  skipSync?: boolean;
  /** Custom relay URLs to connect to */
  relayUrls?: string[];
  /** Progress callback */
  onProgress?: InitProgressCallback;
  /** Maximum time to wait for relay connections (ms) */
  relayTimeoutMs?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_RELAY_TIMEOUT_MS = 10000;
const STEP_WEIGHTS: Record<InitStep, number> = {
  crypto: 15,
  storage: 20,
  identity: 15,
  nostr: 30,
  webrtc: 10,
  sync: 10,
};

// ============================================================================
// Initialization Service
// ============================================================================

/**
 * AppInitializer handles the complete application startup sequence.
 *
 * @example
 * ```typescript
 * const initializer = AppInitializer.getInstance();
 *
 * const result = await initializer.initialize({
 *   onProgress: (step, status, progress, message) => {
 *     console.log(`${step}: ${status} (${progress}%) - ${message}`);
 *   },
 * });
 *
 * if (result.success) {
 *   console.log('App initialized successfully');
 * }
 * ```
 */
export class AppInitializer {
  private static instance: AppInitializer | null = null;
  private initialized = false;
  private initPromise: Promise<InitResult> | null = null;
  private stepStatuses: Map<InitStep, InitStepStatus> = new Map();

  private constructor() {
    // Initialize step statuses
    const steps: InitStep[] = ['crypto', 'storage', 'identity', 'nostr', 'webrtc', 'sync'];
    steps.forEach((step) => {
      this.stepStatuses.set(step, { step, status: 'pending' });
    });
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AppInitializer {
    if (!AppInitializer.instance) {
      AppInitializer.instance = new AppInitializer();
    }
    return AppInitializer.instance;
  }

  /**
   * Reset the singleton (for testing)
   */
  public static _resetForTesting(): void {
    AppInitializer.instance = null;
  }

  /**
   * Check if the app is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the current status of all steps
   */
  public getStepStatuses(): InitStepStatus[] {
    return Array.from(this.stepStatuses.values());
  }

  /**
   * Initialize the application
   *
   * This is the main entry point for app startup. It coordinates
   * all service initialization in the correct order.
   */
  public async initialize(options: InitOptions = {}): Promise<InitResult> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return cached result if already initialized
    if (this.initialized) {
      return this.getInitResult(true);
    }

    this.initPromise = this.runInitialization(options);
    return this.initPromise;
  }

  /**
   * Run the initialization sequence
   */
  private async runInitialization(options: InitOptions): Promise<InitResult> {
    const startTime = performance.now();
    const { onProgress } = options;

    let hasIdentity = false;
    let storageType = 'unknown';
    let relayCount = 0;

    try {
      // Step 1: Initialize crypto (libsodium)
      await this.runStep('crypto', onProgress, async () => {
        const crypto = CryptoService.getInstance();
        await crypto.initialize();
      });

      // Step 2: Initialize storage
      const storageResult = await this.runStep<StorageInitResult>(
        'storage',
        onProgress,
        async () => {
          const storage = getStorageManager();
          return storage.initialize();
        }
      );
      if (storageResult) {
        storageType = storageResult.backendType;
      }

      // Step 3: Load identity
      hasIdentity = await this.runStep<boolean>(
        'identity',
        onProgress,
        async () => {
          const storage = getStorageManager();
          const identityService = IdentityService.getInstance();
          await identityService.initialize({ storage });

          const exists = await identityService.hasIdentity();
          if (exists) {
            // Load identity metadata (not keys - those require password)
            const identity = await identityService.getIdentity();
            if (identity) {
              // Update store with identity info
              useIdentityStore.getState().setIdentity({
                publicKey: identity.publicKey,
                fingerprint: identity.fingerprint,
                npub: identity.npub,
                createdAt: identity.createdAt,
              });
            }
          }
          return exists;
        }
      ) ?? false;

      // Step 4: Connect to Nostr relays
      if (!options.skipNostr) {
        const connectionStatus = await this.runStep<ConnectionStatus | null>(
          'nostr',
          onProgress,
          async () => {
            const relayUrls = options.relayUrls;
            const timeoutMs = options.relayTimeoutMs ?? DEFAULT_RELAY_TIMEOUT_MS;

            // Connect with timeout
            const connectPromise = nostrClient.connect(relayUrls);

            // Don't wait forever for relays
            await Promise.race([
              connectPromise,
              new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
            ]);

            return nostrClient.getConnectionStatus();
          }
        );
        if (connectionStatus) {
          relayCount = connectionStatus.connectedCount;
        }
      } else {
        this.stepStatuses.set('nostr', { step: 'nostr', status: 'skipped' });
      }

      // Step 5: Initialize WebRTC
      if (!options.skipWebRTC) {
        await this.runStep('webrtc', onProgress, async () => {
          // Initialize Trystero service
          const trystero = getTrysteroService();
          // Don't auto-connect to rooms - wait for user action
          void trystero; // Ensure service is instantiated
        });
      } else {
        this.stepStatuses.set('webrtc', { step: 'webrtc', status: 'skipped' });
      }

      // Step 6: Initialize sync service
      if (!options.skipSync) {
        await this.runStep('sync', onProgress, async () => {
          // Initialize network status tracking
          initNetworkStatus();

          // Initialize sync integration
          // TODO: Fix SyncIntegrationConfig interface mismatch
          initSyncIntegration({
            publishEvent: async (event: any, relays: any) => nostrClient.publish(event, relays),
            updateMessageStatus: (_channelId: string, _messageId: string, _status: string) => {
              // Status updates handled by store
            },
            autoSync: true,
            syncOnReconnect: true,
          } as any);
        });
      } else {
        this.stepStatuses.set('sync', { step: 'sync', status: 'skipped' });
      }

      // Mark app as initialized
      this.initialized = true;
      useAppStore.getState().setInitialized(true);

      const totalDurationMs = performance.now() - startTime;
      console.log(
        `[Init] App initialized in ${totalDurationMs.toFixed(0)}ms`,
        `(identity: ${hasIdentity}, storage: ${storageType}, relays: ${relayCount})`
      );

      return this.getInitResult(true, totalDurationMs, {
        hasIdentity,
        storageType,
        relayCount,
      });
    } catch (error) {
      console.error('[Init] Initialization failed:', error);

      const totalDurationMs = performance.now() - startTime;
      return this.getInitResult(false, totalDurationMs, {
        hasIdentity,
        storageType,
        relayCount,
      });
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Run a single initialization step with timing and error handling
   */
  private async runStep<T = void>(
    step: InitStep,
    onProgress: InitProgressCallback | undefined,
    fn: () => Promise<T>
  ): Promise<T | null> {
    const startTime = performance.now();
    const progressBefore = this.calculateProgress();

    this.stepStatuses.set(step, { step, status: 'running' });
    onProgress?.(step, 'running', progressBefore, `Initializing ${step}...`);

    try {
      const result = await fn();
      const durationMs = performance.now() - startTime;

      this.stepStatuses.set(step, { step, status: 'success', durationMs });
      const progressAfter = this.calculateProgress();
      onProgress?.(step, 'success', progressAfter, `${step} initialized`);

      return result;
    } catch (error) {
      const durationMs = performance.now() - startTime;
      const err = error instanceof Error ? error : new Error(String(error));

      this.stepStatuses.set(step, { step, status: 'failed', error: err, durationMs });
      onProgress?.(step, 'failed', this.calculateProgress(), err.message);

      // Rethrow to stop initialization
      throw error;
    }
  }

  /**
   * Calculate overall progress percentage
   */
  private calculateProgress(): number {
    let completed = 0;
    let total = 0;

    for (const [step, status] of this.stepStatuses) {
      const weight = STEP_WEIGHTS[step];
      total += weight;

      if (status.status === 'success' || status.status === 'skipped') {
        completed += weight;
      } else if (status.status === 'running') {
        completed += weight * 0.5; // Halfway through
      }
    }

    return Math.round((completed / total) * 100);
  }

  /**
   * Build the final initialization result
   */
  private getInitResult(
    success: boolean,
    totalDurationMs: number = 0,
    extras: {
      hasIdentity?: boolean;
      storageType?: string;
      relayCount?: number;
    } = {}
  ): InitResult {
    return {
      success,
      steps: this.getStepStatuses(),
      totalDurationMs,
      hasIdentity: extras.hasIdentity ?? false,
      storageType: extras.storageType ?? 'unknown',
      relayCount: extras.relayCount ?? 0,
    };
  }

  /**
   * Shutdown all services (for cleanup or reload)
   */
  public async shutdown(): Promise<void> {
    console.log('[Init] Shutting down services...');

    // Disconnect Nostr
    try {
      nostrClient.disconnect();
    } catch (error) {
      console.error('[Init] Error disconnecting Nostr:', error);
    }

    // Close WebRTC connections
    try {
      const trystero = getTrysteroService();
      // Use leaveRoom method if available
      if (trystero && typeof (trystero as any).leaveRoom === 'function') {
        (trystero as any).leaveRoom?.();
      }
    } catch (error) {
      console.error('[Init] Error closing WebRTC:', error);
    }

    // Reset sync
    try {
      const sync = getSyncIntegration();
      if (sync && typeof (sync as any).stop === 'function') {
        (sync as any).stop();
      }
    } catch (error) {
      console.error('[Init] Error stopping sync:', error);
    }

    // Reset state
    this.initialized = false;
    this.initPromise = null;

    // Reset step statuses
    const steps: InitStep[] = ['crypto', 'storage', 'identity', 'nostr', 'webrtc', 'sync'];
    steps.forEach((step) => {
      this.stepStatuses.set(step, { step, status: 'pending' });
    });

    console.log('[Init] Shutdown complete');
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the singleton app initializer
 */
export function getInitializer(): AppInitializer {
  return AppInitializer.getInstance();
}

/**
 * Initialize the app with default options
 */
export async function initializeApp(options?: InitOptions): Promise<InitResult> {
  return AppInitializer.getInstance().initialize(options);
}

/**
 * Check if the app is initialized
 */
export function isAppInitialized(): boolean {
  return AppInitializer.getInstance().isInitialized();
}

/**
 * Shutdown the app
 */
export async function shutdownApp(): Promise<void> {
  return AppInitializer.getInstance().shutdown();
}

// ============================================================================
// Default Export
// ============================================================================

export default AppInitializer;
