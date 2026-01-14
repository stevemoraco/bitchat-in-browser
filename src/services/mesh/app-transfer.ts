/**
 * App Transfer Protocol
 *
 * Handles version negotiation and app bundle transfer between mesh peers.
 * Enables P2P app updates without internet access.
 */

import { directConnection } from './direct-connection';
import { appPackager, type TransferChunk } from './app-packager';
import { appBundleStore, AppBundle, type AppBundleMetadata } from '../storage/app-bundle-store';

// Protocol message types
export type TransferMessageType =
  | 'version-info'
  | 'version-request'
  | 'bundle-request'
  | 'bundle-metadata'
  | 'bundle-chunk'
  | 'bundle-complete'
  | 'transfer-ack';

export interface TransferMessage {
  type: TransferMessageType;
  payload: unknown;
  timestamp: number;
}

export interface VersionInfo {
  version: string;
  hash: string;
  timestamp: number;
}

export interface TransferProgress {
  peerId: string;
  direction: 'sending' | 'receiving';
  phase: 'negotiating' | 'transferring' | 'complete' | 'failed';
  chunksTotal: number;
  chunksReceived: number;
  bytesTotal: number;
  bytesReceived: number;
}

type TransferProgressHandler = (progress: TransferProgress) => void;

export class AppTransferService {
  private static instance: AppTransferService | null = null;

  private localVersionInfo: VersionInfo | null = null;
  private activeTransfers: Map<string, TransferProgress> = new Map();
  private receivedChunks: Map<string, TransferChunk[]> = new Map();
  private pendingMetadata: Map<string, AppBundleMetadata> = new Map();

  private progressHandlers: Set<TransferProgressHandler> = new Set();

  private constructor() {
    this.setupMessageHandling();
  }

  static getInstance(): AppTransferService {
    if (!AppTransferService.instance) {
      AppTransferService.instance = new AppTransferService();
    }
    return AppTransferService.instance;
  }

  /**
   * Initialize and broadcast version info
   */
  async initialize(): Promise<void> {
    // Get local version info
    const versionInfo = await appPackager.getVersionInfo();
    this.localVersionInfo = {
      ...versionInfo,
      timestamp: Date.now(),
    };
    console.log('[AppTransfer] Initialized with version:', this.localVersionInfo.version);
  }

  /**
   * Send version info to a peer
   */
  sendVersionInfo(peerId: string): void {
    if (!this.localVersionInfo) {
      console.warn('[AppTransfer] Not initialized');
      return;
    }

    const message: TransferMessage = {
      type: 'version-info',
      payload: this.localVersionInfo,
      timestamp: Date.now(),
    };

    directConnection.send(peerId, { transfer: message });
    console.log(`[AppTransfer] Sent version info to ${peerId}`);
  }

  /**
   * Request version info from a peer
   */
  requestVersionInfo(peerId: string): void {
    const message: TransferMessage = {
      type: 'version-request',
      payload: null,
      timestamp: Date.now(),
    };

    directConnection.send(peerId, { transfer: message });
  }

  /**
   * Request app bundle from a peer
   */
  requestBundle(peerId: string): void {
    console.log(`[AppTransfer] Requesting bundle from ${peerId}`);

    this.activeTransfers.set(peerId, {
      peerId,
      direction: 'receiving',
      phase: 'negotiating',
      chunksTotal: 0,
      chunksReceived: 0,
      bytesTotal: 0,
      bytesReceived: 0,
    });

    const message: TransferMessage = {
      type: 'bundle-request',
      payload: null,
      timestamp: Date.now(),
    };

    directConnection.send(peerId, { transfer: message });
    this.notifyProgress(this.activeTransfers.get(peerId)!);
  }

  /**
   * Send app bundle to a peer
   */
  async sendBundle(peerId: string): Promise<void> {
    console.log(`[AppTransfer] Sending bundle to ${peerId}`);

    try {
      // Package the app
      const bundle = await appPackager.packageApp();
      const chunks = await appPackager.bundleToChunks(bundle);

      // Initialize transfer progress
      const progress: TransferProgress = {
        peerId,
        direction: 'sending',
        phase: 'transferring',
        chunksTotal: chunks.length,
        chunksReceived: 0,
        bytesTotal: bundle.metadata.totalSize,
        bytesReceived: 0,
      };
      this.activeTransfers.set(peerId, progress);

      // Send metadata first
      const metaMessage: TransferMessage = {
        type: 'bundle-metadata',
        payload: bundle.metadata,
        timestamp: Date.now(),
      };
      directConnection.send(peerId, { transfer: metaMessage });

      // Send chunks with small delay between each
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        const chunkMessage: TransferMessage = {
          type: 'bundle-chunk',
          payload: chunk,
          timestamp: Date.now(),
        };

        directConnection.send(peerId, { transfer: chunkMessage });

        // Update progress
        progress.chunksReceived = i + 1;
        progress.bytesReceived += chunk.data.length;
        this.notifyProgress(progress);

        // Small delay to prevent overwhelming the data channel
        if (i % 10 === 0) {
          await this.delay(10);
        }
      }

      // Send completion message
      const completeMessage: TransferMessage = {
        type: 'bundle-complete',
        payload: { hash: bundle.metadata.hash, chunks: chunks.length },
        timestamp: Date.now(),
      };
      directConnection.send(peerId, { transfer: completeMessage });

      progress.phase = 'complete';
      this.notifyProgress(progress);

      console.log(`[AppTransfer] Sent ${chunks.length} chunks to ${peerId}`);
    } catch (error) {
      console.error(`[AppTransfer] Failed to send bundle:`, error);
      const progress = this.activeTransfers.get(peerId);
      if (progress) {
        progress.phase = 'failed';
        this.notifyProgress(progress);
      }
    }
  }

  /**
   * Check if we should request update from a peer
   */
  async shouldRequestUpdate(peerVersion: VersionInfo): Promise<boolean> {
    if (!this.localVersionInfo) {
      await this.initialize();
    }

    // Compare versions
    const isNewer = await appBundleStore.isNewerVersion(peerVersion.version);
    const isDifferentHash = peerVersion.hash !== this.localVersionInfo?.hash;

    return isNewer || isDifferentHash;
  }

  /**
   * Get active transfers
   */
  getActiveTransfers(): TransferProgress[] {
    return Array.from(this.activeTransfers.values());
  }

  /**
   * Register progress handler
   */
  onProgress(handler: TransferProgressHandler): () => void {
    this.progressHandlers.add(handler);
    return () => this.progressHandlers.delete(handler);
  }

  // === Private Methods ===

  private setupMessageHandling(): void {
    directConnection.onMessage((data, fromPeerId) => {
      if (this.isTransferMessage(data)) {
        const message = (data as { transfer: TransferMessage }).transfer;
        this.handleTransferMessage(message, fromPeerId);
      }
    });

    // When a new peer connects, exchange version info
    directConnection.onConnection((peerId) => {
      setTimeout(() => {
        this.sendVersionInfo(peerId);
      }, 500);
    });
  }

  private isTransferMessage(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'transfer' in data &&
      typeof (data as { transfer: unknown }).transfer === 'object'
    );
  }

  private async handleTransferMessage(
    message: TransferMessage,
    fromPeerId: string
  ): Promise<void> {
    switch (message.type) {
      case 'version-info':
        await this.handleVersionInfo(message.payload as VersionInfo, fromPeerId);
        break;

      case 'version-request':
        this.sendVersionInfo(fromPeerId);
        break;

      case 'bundle-request':
        await this.sendBundle(fromPeerId);
        break;

      case 'bundle-metadata':
        this.handleBundleMetadata(message.payload as AppBundleMetadata, fromPeerId);
        break;

      case 'bundle-chunk':
        this.handleBundleChunk(message.payload as TransferChunk, fromPeerId);
        break;

      case 'bundle-complete':
        await this.handleBundleComplete(fromPeerId);
        break;
    }
  }

  private async handleVersionInfo(
    versionInfo: VersionInfo,
    fromPeerId: string
  ): Promise<void> {
    console.log(`[AppTransfer] Received version info from ${fromPeerId}:`, versionInfo.version);

    // Check if we should request an update
    const shouldUpdate = await this.shouldRequestUpdate(versionInfo);

    if (shouldUpdate) {
      console.log(`[AppTransfer] Peer ${fromPeerId} has newer version, requesting bundle`);
      this.requestBundle(fromPeerId);
    }
  }

  private handleBundleMetadata(
    metadata: AppBundleMetadata,
    fromPeerId: string
  ): void {
    console.log(`[AppTransfer] Receiving bundle v${metadata.version} from ${fromPeerId}`);

    this.pendingMetadata.set(fromPeerId, metadata);
    this.receivedChunks.set(fromPeerId, []);

    const progress = this.activeTransfers.get(fromPeerId);
    if (progress) {
      progress.phase = 'transferring';
      progress.bytesTotal = metadata.totalSize;
      progress.chunksTotal = metadata.assetCount;
      this.notifyProgress(progress);
    }
  }

  private handleBundleChunk(chunk: TransferChunk, fromPeerId: string): void {
    const chunks = this.receivedChunks.get(fromPeerId);
    if (!chunks) {
      console.warn(`[AppTransfer] Received chunk without metadata from ${fromPeerId}`);
      return;
    }

    chunks.push(chunk);

    const progress = this.activeTransfers.get(fromPeerId);
    if (progress) {
      progress.chunksReceived = chunks.length;
      progress.chunksTotal = chunk.total;
      progress.bytesReceived += chunk.data.length;
      this.notifyProgress(progress);
    }
  }

  private async handleBundleComplete(fromPeerId: string): Promise<void> {
    const chunks = this.receivedChunks.get(fromPeerId);
    const metadata = this.pendingMetadata.get(fromPeerId);

    if (!chunks || !metadata) {
      console.error(`[AppTransfer] Missing chunks or metadata for ${fromPeerId}`);
      return;
    }

    console.log(`[AppTransfer] Received complete bundle from ${fromPeerId}: ${chunks.length} chunks`);

    try {
      // Reconstruct bundle
      const bundle = appPackager.chunksToBundle(chunks, metadata);

      // Store in IndexedDB
      await appBundleStore.store(bundle);

      // Update progress
      const progress = this.activeTransfers.get(fromPeerId);
      if (progress) {
        progress.phase = 'complete';
        this.notifyProgress(progress);
      }

      // Cleanup
      this.receivedChunks.delete(fromPeerId);
      this.pendingMetadata.delete(fromPeerId);

      // Update local version info
      this.localVersionInfo = {
        version: metadata.version,
        hash: metadata.hash,
        timestamp: Date.now(),
      };

      console.log(`[AppTransfer] Bundle stored successfully, version ${metadata.version}`);

      // Notify user that update is ready
      this.notifyUpdateReady(metadata);
    } catch (error) {
      console.error(`[AppTransfer] Failed to process bundle:`, error);
      const progress = this.activeTransfers.get(fromPeerId);
      if (progress) {
        progress.phase = 'failed';
        this.notifyProgress(progress);
      }
    }
  }

  private notifyUpdateReady(metadata: AppBundleMetadata): void {
    // Post message to main thread
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app-update-ready', {
          detail: { version: metadata.version, hash: metadata.hash },
        })
      );
    }
  }

  private notifyProgress(progress: TransferProgress): void {
    this.progressHandlers.forEach((h) => h(progress));
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton
export const appTransfer = AppTransferService.getInstance();
export default appTransfer;
