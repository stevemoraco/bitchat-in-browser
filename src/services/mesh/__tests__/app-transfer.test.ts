/**
 * App Transfer Service Tests
 *
 * Tests for P2P app bundle transfer including:
 * - Version comparison
 * - Chunked transfer
 * - Hash verification
 * - Progress tracking
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock direct connection
vi.mock('../direct-connection', () => ({
  directConnection: {
    send: vi.fn().mockReturnValue(true),
    onMessage: vi.fn((handler) => {
      // Store handler for testing
      (globalThis as unknown as { __messageHandler: typeof handler }).__messageHandler = handler;
      return () => {};
    }),
    onConnection: vi.fn((handler) => {
      (globalThis as unknown as { __connectionHandler: typeof handler }).__connectionHandler = handler;
      return () => {};
    }),
  },
}));

// Mock app packager
vi.mock('../app-packager', () => ({
  appPackager: {
    getVersionInfo: vi.fn().mockResolvedValue({
      version: '1.0.0',
      hash: 'abc123',
      timestamp: Date.now(),
    }),
    packageApp: vi.fn().mockResolvedValue({
      metadata: {
        version: '1.0.0',
        hash: 'abc123',
        totalSize: 1000000,
        assetCount: 10,
        createdAt: Date.now(),
      },
      assets: [],
    }),
    bundleToChunks: vi.fn().mockResolvedValue([
      { index: 0, total: 3, data: 'chunk0', hash: 'hash0' },
      { index: 1, total: 3, data: 'chunk1', hash: 'hash1' },
      { index: 2, total: 3, data: 'chunk2', hash: 'hash2' },
    ]),
    chunksToBundle: vi.fn().mockReturnValue({
      metadata: { version: '2.0.0', hash: 'def456' },
      assets: [],
    }),
  },
  TransferChunk: {},
}));

// Mock app bundle store
vi.mock('../../storage/app-bundle-store', () => ({
  appBundleStore: {
    isNewerVersion: vi.fn().mockResolvedValue(false),
    store: vi.fn().mockResolvedValue(undefined),
  },
  AppBundle: {},
  AppBundleMetadata: {},
}));

// Import after mocks
import { AppTransferService, TransferProgress, VersionInfo } from '../app-transfer';
import { directConnection } from '../direct-connection';
import { appBundleStore } from '../../storage/app-bundle-store';

describe('AppTransferService', () => {
  let service: AppTransferService;

  beforeEach(() => {
    // Reset singleton
    (AppTransferService as unknown as { instance: null }).instance = null;
    service = AppTransferService.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize and get version info', async () => {
      await service.initialize();

      // Version info should be loaded
      // Internal state, but we can verify by testing version comparison
    });

    it('should be singleton', () => {
      const instance1 = AppTransferService.getInstance();
      const instance2 = AppTransferService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('version comparison', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should request update when peer has newer version', async () => {
      vi.mocked(appBundleStore.isNewerVersion).mockResolvedValue(true);

      const peerVersion: VersionInfo = {
        version: '2.0.0',
        hash: 'newer-hash',
        timestamp: Date.now(),
      };

      const shouldUpdate = await service.shouldRequestUpdate(peerVersion);

      expect(shouldUpdate).toBe(true);
    });

    it('should not request update when local version is same', async () => {
      vi.mocked(appBundleStore.isNewerVersion).mockResolvedValue(false);

      const peerVersion: VersionInfo = {
        version: '1.0.0',
        hash: 'abc123', // Same as mock local version
        timestamp: Date.now(),
      };

      const shouldUpdate = await service.shouldRequestUpdate(peerVersion);

      expect(shouldUpdate).toBe(false);
    });

    it('should request update when hash is different', async () => {
      vi.mocked(appBundleStore.isNewerVersion).mockResolvedValue(false);

      const peerVersion: VersionInfo = {
        version: '1.0.0',
        hash: 'different-hash', // Different hash
        timestamp: Date.now(),
      };

      const shouldUpdate = await service.shouldRequestUpdate(peerVersion);

      expect(shouldUpdate).toBe(true);
    });
  });

  describe('version info exchange', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should send version info to peer', () => {
      service.sendVersionInfo('peer-123');

      expect(directConnection.send).toHaveBeenCalledWith(
        'peer-123',
        expect.objectContaining({
          transfer: expect.objectContaining({
            type: 'version-info',
          }),
        })
      );
    });

    it('should request version info from peer', () => {
      service.requestVersionInfo('peer-123');

      expect(directConnection.send).toHaveBeenCalledWith(
        'peer-123',
        expect.objectContaining({
          transfer: expect.objectContaining({
            type: 'version-request',
          }),
        })
      );
    });
  });

  describe('chunked transfer', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should request bundle from peer', () => {
      service.requestBundle('peer-123');

      expect(directConnection.send).toHaveBeenCalledWith(
        'peer-123',
        expect.objectContaining({
          transfer: expect.objectContaining({
            type: 'bundle-request',
          }),
        })
      );
    });

    it('should track active transfer on bundle request', () => {
      service.requestBundle('peer-123');

      const transfers = service.getActiveTransfers();
      expect(transfers.some((t) => t.peerId === 'peer-123')).toBe(true);
    });

    it('should send bundle to peer in chunks', async () => {
      await service.sendBundle('peer-456');

      // Should have sent metadata first
      expect(directConnection.send).toHaveBeenCalledWith(
        'peer-456',
        expect.objectContaining({
          transfer: expect.objectContaining({
            type: 'bundle-metadata',
          }),
        })
      );

      // Should have sent chunks
      expect(directConnection.send).toHaveBeenCalledWith(
        'peer-456',
        expect.objectContaining({
          transfer: expect.objectContaining({
            type: 'bundle-chunk',
          }),
        })
      );

      // Should have sent completion
      expect(directConnection.send).toHaveBeenCalledWith(
        'peer-456',
        expect.objectContaining({
          transfer: expect.objectContaining({
            type: 'bundle-complete',
          }),
        })
      );
    });
  });

  describe('progress tracking', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should register progress handler', () => {
      const handler = vi.fn();
      const unsubscribe = service.onProgress(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should notify progress during send', async () => {
      const handler = vi.fn();
      service.onProgress(handler);

      await service.sendBundle('peer-789');

      expect(handler).toHaveBeenCalled();
    });

    it('should track transfer phases', async () => {
      const progressUpdates: TransferProgress[] = [];
      service.onProgress((progress) => progressUpdates.push({ ...progress }));

      await service.sendBundle('peer-phases');

      // Should have gone through phases
      const phases = progressUpdates.map((p) => p.phase);
      expect(phases).toContain('transferring');
      expect(phases).toContain('complete');
    });

    it('should track chunk counts', async () => {
      const progressUpdates: TransferProgress[] = [];
      service.onProgress((progress) => progressUpdates.push({ ...progress }));

      await service.sendBundle('peer-chunks');

      // Find the last progress update
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.chunksReceived).toBeGreaterThan(0);
    });

    it('should get active transfers', () => {
      service.requestBundle('peer-active');

      const transfers = service.getActiveTransfers();

      expect(transfers.length).toBeGreaterThanOrEqual(1);
      expect(transfers.some((t) => t.peerId === 'peer-active')).toBe(true);
    });
  });

  describe('hash verification', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should include hash in bundle metadata', async () => {
      await service.sendBundle('peer-hash');

      // Check that metadata includes hash
      expect(directConnection.send).toHaveBeenCalledWith(
        'peer-hash',
        expect.objectContaining({
          transfer: expect.objectContaining({
            type: 'bundle-metadata',
            payload: expect.objectContaining({
              hash: expect.any(String),
            }),
          }),
        })
      );
    });

    it('should include hash in completion message', async () => {
      await service.sendBundle('peer-complete');

      expect(directConnection.send).toHaveBeenCalledWith(
        'peer-complete',
        expect.objectContaining({
          transfer: expect.objectContaining({
            type: 'bundle-complete',
            payload: expect.objectContaining({
              hash: expect.any(String),
            }),
          }),
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should mark transfer as failed on error', async () => {
      const progressUpdates: TransferProgress[] = [];
      service.onProgress((progress) => progressUpdates.push({ ...progress }));

      // Mock packager to throw
      const { appPackager } = await import('../app-packager');
      vi.mocked(appPackager.packageApp).mockRejectedValueOnce(new Error('Pack failed'));

      await service.sendBundle('peer-error');

      const hasFailedPhase = progressUpdates.some((p) => p.phase === 'failed');
      expect(hasFailedPhase).toBe(true);
    });

    it('should handle not initialized state', () => {
      // Reset to uninitialized state
      (AppTransferService as unknown as { instance: null }).instance = null;
      const uninitService = AppTransferService.getInstance();

      // Should not throw, just warn
      expect(() => uninitService.sendVersionInfo('peer')).not.toThrow();
    });
  });

  describe('message handling', () => {
    it('should set up message handler on construction', () => {
      expect(directConnection.onMessage).toHaveBeenCalled();
    });

    it('should set up connection handler on construction', () => {
      expect(directConnection.onConnection).toHaveBeenCalled();
    });
  });
});

describe('Transfer Protocol Messages', () => {
  let service: AppTransferService;

  beforeEach(async () => {
    (AppTransferService as unknown as { instance: null }).instance = null;
    service = AppTransferService.getInstance();
    await service.initialize();
    vi.clearAllMocks();
  });

  it('should create correctly structured version-info message', () => {
    service.sendVersionInfo('peer-1');

    expect(directConnection.send).toHaveBeenCalledWith(
      'peer-1',
      {
        transfer: {
          type: 'version-info',
          payload: expect.objectContaining({
            version: expect.any(String),
            hash: expect.any(String),
            timestamp: expect.any(Number),
          }),
          timestamp: expect.any(Number),
        },
      }
    );
  });

  it('should create correctly structured version-request message', () => {
    service.requestVersionInfo('peer-2');

    expect(directConnection.send).toHaveBeenCalledWith(
      'peer-2',
      {
        transfer: {
          type: 'version-request',
          payload: null,
          timestamp: expect.any(Number),
        },
      }
    );
  });

  it('should create correctly structured bundle-request message', () => {
    service.requestBundle('peer-3');

    expect(directConnection.send).toHaveBeenCalledWith(
      'peer-3',
      {
        transfer: {
          type: 'bundle-request',
          payload: null,
          timestamp: expect.any(Number),
        },
      }
    );
  });
});

describe('Transfer Progress States', () => {
  let service: AppTransferService;

  beforeEach(async () => {
    (AppTransferService as unknown as { instance: null }).instance = null;
    service = AppTransferService.getInstance();
    await service.initialize();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should start in negotiating phase when requesting', () => {
    const progressUpdates: TransferProgress[] = [];
    service.onProgress((p) => progressUpdates.push({ ...p }));

    service.requestBundle('peer-negotiate');

    expect(progressUpdates[0].phase).toBe('negotiating');
  });

  it('should include direction in progress', () => {
    const progressUpdates: TransferProgress[] = [];
    service.onProgress((p) => progressUpdates.push({ ...p }));

    service.requestBundle('peer-direction');

    expect(progressUpdates[0].direction).toBe('receiving');
  });

  it('should track bytes transferred', async () => {
    const progressUpdates: TransferProgress[] = [];
    service.onProgress((p) => progressUpdates.push({ ...p }));

    await service.sendBundle('peer-bytes');

    // Should have byte counts
    const lastProgress = progressUpdates[progressUpdates.length - 1];
    expect(lastProgress.bytesTotal).toBeGreaterThan(0);
  });
});
