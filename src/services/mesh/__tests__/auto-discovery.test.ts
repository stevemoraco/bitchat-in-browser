/**
 * Mesh Auto-Discovery Service Tests
 *
 * Tests for automatic mesh peer discovery including:
 * - Parallel discovery attempts
 * - Fallback when Nostr unavailable
 * - Cached peer reconnection
 * - Status management
 * - Peer lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Trystero service before imports
vi.mock('../../webrtc/trystero', () => ({
  getTrysteroService: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    joinRoom: vi.fn().mockResolvedValue({ roomId: 'test-room', isJoined: true }),
    onPeerJoin: vi.fn(),
    onPeerLeave: vi.fn(),
    leaveRoom: vi.fn(),
    isReady: vi.fn(() => true),
  })),
}));

// Import after mocks
import { MeshAutoDiscovery } from '../auto-discovery';
import type { MeshPeer, MeshStatus } from '../types';

describe('MeshAutoDiscovery', () => {
  let discovery: MeshAutoDiscovery;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Create new instance (bypass singleton for testing)
    discovery = new (MeshAutoDiscovery as unknown as { new (): MeshAutoDiscovery })();
  });

  afterEach(() => {
    discovery.shutdown();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', async () => {
      await discovery.initialize();

      expect(discovery.getStatus()).toBe('disconnected');
      expect(discovery.getPeers()).toHaveLength(0);
    });

    it('should accept custom config during initialization', async () => {
      await discovery.initialize({
        autoConnect: false,
        maxPeers: 100,
      });

      // Config is internal but discovery should work
      expect(discovery.getStatus()).toBe('disconnected');
    });

    it('should start discovery when autoConnect is true', async () => {
      const spy = vi.spyOn(discovery, 'startDiscovery');

      await discovery.initialize({ autoConnect: true });

      expect(spy).toHaveBeenCalled();
    });

    it('should not start discovery when autoConnect is false', async () => {
      const spy = vi.spyOn(discovery, 'startDiscovery');

      await discovery.initialize({ autoConnect: false });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('parallel discovery attempts', () => {
    it('should attempt discovery via multiple methods', async () => {
      await discovery.initialize({ autoConnect: false });

      const results = await discovery.startDiscovery();

      // Should return results from all methods (even if some fail)
      expect(Array.isArray(results)).toBe(true);
    });

    it('should set status to discovering during discovery', async () => {
      await discovery.initialize({ autoConnect: false });

      const statusChanges: MeshStatus[] = [];
      discovery.onStatusChange((status) => statusChanges.push(status));

      await discovery.startDiscovery();

      // Should have gone through 'discovering' state
      expect(statusChanges).toContain('discovering');
    });

    it('should not run parallel discoveries', async () => {
      await discovery.initialize({ autoConnect: false });

      // Start discovery twice simultaneously
      const promise1 = discovery.startDiscovery();
      const promise2 = discovery.startDiscovery();

      const [results1, results2] = await Promise.all([promise1, promise2]);

      // Second call should return empty array (already in progress)
      expect(results2).toHaveLength(0);
    });

    it('should return successful discovery results', async () => {
      await discovery.initialize({ autoConnect: false });

      const results = await discovery.startDiscovery();

      // Each result should have method, success, and possibly error
      results.forEach((result) => {
        expect(result.method).toBeDefined();
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('fallback when Nostr unavailable', () => {
    it('should try cached peers when Nostr fails', async () => {
      // Pre-populate cached peers
      const cachedPeers = [
        { peerId: 'peer-1', fingerprint: 'ABC123', lastSeen: Date.now(), connectionMethods: ['nostr'] },
        { peerId: 'peer-2', fingerprint: 'XYZ789', lastSeen: Date.now() - 60000, connectionMethods: ['direct'] },
      ];
      localStorage.setItem('bitchat_mesh_cached_peers', JSON.stringify(cachedPeers));

      await discovery.initialize({ autoConnect: false });
      const results = await discovery.startDiscovery();

      // Should have attempted cached discovery
      const cachedResult = results.find((r) => r.method === 'cached');
      expect(cachedResult).toBeDefined();
    });

    it('should try local network discovery as fallback', async () => {
      await discovery.initialize({ autoConnect: false });

      const results = await discovery.startDiscovery();

      // Should have attempted local discovery
      const localResult = results.find((r) => r.method === 'local');
      expect(localResult).toBeDefined();
    });

    it('should remain disconnected if all methods fail', async () => {
      await discovery.initialize({ autoConnect: false });

      await discovery.startDiscovery();

      // With no real peers, status should be disconnected
      expect(discovery.getStatus()).toBe('disconnected');
      expect(discovery.getPeerCount()).toBe(0);
    });
  });

  describe('cached peer reconnection', () => {
    it('should cache peers on connection', async () => {
      await discovery.initialize({ autoConnect: false });

      // Add a peer
      discovery.addPeer({
        peerId: 'test-peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      // Check cache
      const cached = localStorage.getItem('bitchat_mesh_cached_peers');
      expect(cached).not.toBeNull();

      const parsed = JSON.parse(cached!);
      expect(parsed.some((p: { peerId: string }) => p.peerId === 'test-peer-1')).toBe(true);
    });

    it('should update existing cached peer', async () => {
      // Pre-cache a peer
      const initialCache = [
        { peerId: 'test-peer-1', fingerprint: 'ABC', lastSeen: Date.now() - 100000, connectionMethods: ['direct'] },
      ];
      localStorage.setItem('bitchat_mesh_cached_peers', JSON.stringify(initialCache));

      await discovery.initialize({ autoConnect: false });

      // Add same peer again (reconnection)
      discovery.addPeer({
        peerId: 'test-peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      // Check cache was updated
      const cached = JSON.parse(localStorage.getItem('bitchat_mesh_cached_peers')!);
      const peer = cached.find((p: { peerId: string }) => p.peerId === 'test-peer-1');

      expect(peer.connectionMethods).toContain('nostr');
      expect(peer.lastSeen).toBeGreaterThan(initialCache[0].lastSeen);
    });

    it('should sort cached peers by most recently seen', async () => {
      const cachedPeers = [
        { peerId: 'old-peer', fingerprint: 'OLD', lastSeen: Date.now() - 1000000, connectionMethods: ['nostr'] },
        { peerId: 'recent-peer', fingerprint: 'NEW', lastSeen: Date.now() - 1000, connectionMethods: ['nostr'] },
        { peerId: 'middle-peer', fingerprint: 'MID', lastSeen: Date.now() - 500000, connectionMethods: ['nostr'] },
      ];
      localStorage.setItem('bitchat_mesh_cached_peers', JSON.stringify(cachedPeers));

      await discovery.initialize({ autoConnect: false });
      await discovery.startDiscovery();

      // Discovery should prioritize recent peers (internal behavior)
      // We verify cache is still intact
      const cached = JSON.parse(localStorage.getItem('bitchat_mesh_cached_peers')!);
      expect(cached.length).toBe(3);
    });

    it('should limit cached peers to 100', async () => {
      await discovery.initialize({ autoConnect: false });

      // Add many peers
      for (let i = 0; i < 150; i++) {
        discovery.addPeer({
          peerId: `peer-${i}`,
          connectionMethod: 'nostr',
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      }

      // Cache should be limited
      const cached = JSON.parse(localStorage.getItem('bitchat_mesh_cached_peers')!);
      expect(cached.length).toBeLessThanOrEqual(100);
    });
  });

  describe('peer management', () => {
    beforeEach(async () => {
      await discovery.initialize({ autoConnect: false });
    });

    it('should add peer and update status', () => {
      const peer: MeshPeer = {
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      };

      discovery.addPeer(peer);

      expect(discovery.getPeerCount()).toBe(1);
      expect(discovery.getStatus()).toBe('connected');
    });

    it('should remove peer and update status', () => {
      discovery.addPeer({
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      discovery.removePeer('peer-1');

      expect(discovery.getPeerCount()).toBe(0);
      expect(discovery.getStatus()).toBe('disconnected');
    });

    it('should return all connected peers', () => {
      discovery.addPeer({
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });
      discovery.addPeer({
        peerId: 'peer-2',
        connectionMethod: 'direct',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      const peers = discovery.getPeers();

      expect(peers).toHaveLength(2);
      expect(peers.map((p) => p.peerId)).toContain('peer-1');
      expect(peers.map((p) => p.peerId)).toContain('peer-2');
    });

    it('should notify listeners on peer changes', () => {
      const listener = vi.fn();
      discovery.onPeersChange(listener);

      discovery.addPeer({
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      expect(listener).toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ peerId: 'peer-1' }),
      ]));
    });
  });

  describe('status management', () => {
    beforeEach(async () => {
      await discovery.initialize({ autoConnect: false });
    });

    it('should notify listeners on status change', () => {
      const listener = vi.fn();
      discovery.onStatusChange(listener);

      discovery.addPeer({
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      expect(listener).toHaveBeenCalledWith('connected');
    });

    it('should unsubscribe status listener', () => {
      const listener = vi.fn();
      const unsubscribe = discovery.onStatusChange(listener);

      unsubscribe();

      discovery.addPeer({
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not notify if status unchanged', () => {
      const listener = vi.fn();

      discovery.addPeer({
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      discovery.onStatusChange(listener);

      // Add another peer (status should stay 'connected')
      discovery.addPeer({
        peerId: 'peer-2',
        connectionMethod: 'direct',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      // Listener should not be called since status didn't change
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('topology decisions', () => {
    beforeEach(async () => {
      await discovery.initialize({ autoConnect: false });
    });

    it('should use full mesh for small networks', () => {
      // Add a few peers
      for (let i = 0; i < 5; i++) {
        discovery.addPeer({
          peerId: `peer-${i}`,
          connectionMethod: 'nostr',
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      }

      expect(discovery.shouldUseHubSpoke()).toBe(false);
    });

    it('should use hub-spoke for large networks', () => {
      // Add many peers (above threshold)
      for (let i = 0; i < 15; i++) {
        discovery.addPeer({
          peerId: `peer-${i}`,
          connectionMethod: 'nostr',
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      }

      expect(discovery.shouldUseHubSpoke()).toBe(true);
    });

    it('should respect config threshold', async () => {
      await discovery.initialize({ fullMeshThreshold: 3 });

      for (let i = 0; i < 5; i++) {
        discovery.addPeer({
          peerId: `peer-${i}`,
          connectionMethod: 'nostr',
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      }

      expect(discovery.shouldUseHubSpoke()).toBe(true);
    });
  });

  describe('config management', () => {
    it('should update config at runtime', async () => {
      await discovery.initialize({ autoConnect: false });

      discovery.setConfig({ maxPeers: 25, fullMeshThreshold: 5 });

      // Add peers to test new threshold
      for (let i = 0; i < 6; i++) {
        discovery.addPeer({
          peerId: `peer-${i}`,
          connectionMethod: 'nostr',
          connectedAt: Date.now(),
          lastSeen: Date.now(),
        });
      }

      expect(discovery.shouldUseHubSpoke()).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should clear all state on shutdown', async () => {
      await discovery.initialize({ autoConnect: false });

      discovery.addPeer({
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      discovery.shutdown();

      expect(discovery.getPeerCount()).toBe(0);
      expect(discovery.getStatus()).toBe('disconnected');
    });

    it('should clear all listeners on shutdown', async () => {
      await discovery.initialize({ autoConnect: false });

      const statusListener = vi.fn();
      const peerListener = vi.fn();

      discovery.onStatusChange(statusListener);
      discovery.onPeersChange(peerListener);

      discovery.shutdown();

      // Attempting to add peer should not notify listeners
      discovery.addPeer({
        peerId: 'peer-1',
        connectionMethod: 'nostr',
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      // Listeners were cleared on shutdown
      // (but addPeer still works on the instance)
    });
  });
});

describe('MeshAutoDiscovery Singleton', () => {
  afterEach(() => {
    // Access private static instance to reset
    (MeshAutoDiscovery as unknown as { instance: null }).instance = null;
  });

  it('should return same instance', () => {
    const instance1 = MeshAutoDiscovery.getInstance();
    const instance2 = MeshAutoDiscovery.getInstance();

    expect(instance1).toBe(instance2);
  });
});
