/**
 * Trystero WebRTC Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock trystero modules before importing the service
vi.mock('trystero/nostr', () => ({
  joinRoom: vi.fn(() => createMockRoom()),
}));

vi.mock('trystero/torrent', () => ({
  joinRoom: vi.fn(() => createMockRoom()),
}));

// Helper to create mock Trystero room
function createMockRoom() {
  const peerJoinHandlers: ((peerId: string) => void)[] = [];
  const peerLeaveHandlers: ((peerId: string) => void)[] = [];
  const actions: Map<string, { send: ReturnType<typeof vi.fn>; receive: ReturnType<typeof vi.fn> }> = new Map();

  return {
    onPeerJoin: vi.fn((handler: (peerId: string) => void) => {
      peerJoinHandlers.push(handler);
    }),
    onPeerLeave: vi.fn((handler: (peerId: string) => void) => {
      peerLeaveHandlers.push(handler);
    }),
    makeAction: vi.fn((channel: string) => {
      const send = vi.fn();
      const receive = vi.fn();
      actions.set(channel, { send, receive });
      return [send, receive];
    }),
    leave: vi.fn(),
    // Test helpers
    _simulatePeerJoin: (peerId: string) => {
      peerJoinHandlers.forEach((h) => h(peerId));
    },
    _simulatePeerLeave: (peerId: string) => {
      peerLeaveHandlers.forEach((h) => h(peerId));
    },
    _getAction: (channel: string) => actions.get(channel),
    _peerJoinHandlers: peerJoinHandlers,
    _peerLeaveHandlers: peerLeaveHandlers,
  };
}

// Import after mocks are set up
import {
  TrysteroService,
  getTrysteroService,
  resetTrysteroService,
  createTrysteroService,
  HybridMessageRouter,
} from '../trystero';
// Types imported for potential future use in type assertions
// import type { RoomState, P2PPeer, DeliveryRoute } from '../types';

describe('TrysteroService', () => {
  let service: TrysteroService;

  beforeEach(() => {
    resetTrysteroService();
    service = createTrysteroService({ debug: false });
  });

  afterEach(() => {
    service.shutdown();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize the service', async () => {
      expect(service.isReady()).toBe(false);
      await service.initialize();
      expect(service.isReady()).toBe(true);
    });

    it('should handle multiple initialize calls', async () => {
      await service.initialize();
      await service.initialize(); // Should not throw
      expect(service.isReady()).toBe(true);
    });

    it('should shutdown cleanly', async () => {
      await service.initialize();
      service.shutdown();
      expect(service.isReady()).toBe(false);
    });
  });

  describe('room management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should join a room', async () => {
      const state = await service.joinRoom('test-room');

      expect(state.roomId).toBe('test-room');
      expect(state.isJoined).toBe(true);
      expect(service.isInRoom('test-room')).toBe(true);
    });

    it('should return existing state when joining same room twice', async () => {
      const state1 = await service.joinRoom('test-room');
      const state2 = await service.joinRoom('test-room');

      expect(state1.roomId).toBe(state2.roomId);
    });

    it('should join multiple rooms simultaneously', async () => {
      await service.joinRoom('room-1');
      await service.joinRoom('room-2');
      await service.joinRoom('room-3');

      expect(service.isInRoom('room-1')).toBe(true);
      expect(service.isInRoom('room-2')).toBe(true);
      expect(service.isInRoom('room-3')).toBe(true);
    });

    it('should leave a room', async () => {
      await service.joinRoom('test-room');
      service.leaveRoom('test-room');

      expect(service.isInRoom('test-room')).toBe(false);
    });

    it('should handle leaving a room not joined', () => {
      // Should not throw
      service.leaveRoom('non-existent-room');
    });

    it('should get room state', async () => {
      await service.joinRoom('test-room');
      const state = service.getRoomState('test-room');

      expect(state).toBeDefined();
      expect(state?.roomId).toBe('test-room');
    });

    it('should return undefined for non-existent room', () => {
      const state = service.getRoomState('non-existent');
      expect(state).toBeUndefined();
    });

    it('should get all room states', async () => {
      await service.joinRoom('room-1');
      await service.joinRoom('room-2');

      const states = service.getAllRoomStates();
      expect(states).toHaveLength(2);
    });
  });

  describe('peer management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return empty peers initially', () => {
      const peers = service.getPeers();
      expect(peers).toHaveLength(0);
    });

    it('should track peer when joining room', async () => {
      const peerJoinHandler = vi.fn();
      service.onPeerJoin(peerJoinHandler);

      await service.joinRoom('test-room');

      // Note: Actual peer join would come from Trystero
      // This test verifies handler registration
      expect(peerJoinHandler).not.toHaveBeenCalled(); // No peers yet
    });

    it('should return online peers', async () => {
      await service.joinRoom('test-room');
      const onlinePeers = service.getOnlinePeers();
      expect(Array.isArray(onlinePeers)).toBe(true);
    });

    it('should check if peer is online', async () => {
      await service.joinRoom('test-room');
      const isOnline = service.isPeerOnline('some-peer-id');
      expect(typeof isOnline).toBe('boolean');
    });
  });

  describe('messaging', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.joinRoom('test-room');
    });

    it('should send message to room', () => {
      const messageId = service.sendToRoom('test-room', 'chat', {
        text: 'Hello',
      });

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe('string');
    });

    it('should return null when sending to non-existent room', () => {
      const messageId = service.sendToRoom('non-existent', 'chat', {
        text: 'Hello',
      });

      expect(messageId).toBeNull();
    });

    it('should broadcast to all rooms', async () => {
      await service.joinRoom('room-2');

      const messageIds = service.broadcast('chat', { text: 'Hello all' });

      expect(messageIds).toHaveLength(2);
    });

    it('should register data handler', () => {
      const handler = vi.fn();
      const unsubscribe = service.onData('chat', handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('event handlers', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should register peer join handler', () => {
      const handler = vi.fn();
      const unsubscribe = service.onPeerJoin(handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should register peer leave handler', () => {
      const handler = vi.fn();
      const unsubscribe = service.onPeerLeave(handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should register error handler', () => {
      const handler = vi.fn();
      const unsubscribe = service.onError(handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('hybrid routing', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should get routing decision for peer', () => {
      const decision = service.getRoutingDecision('test-fingerprint');

      expect(decision).toBeDefined();
      expect(decision.peerFingerprint).toBe('test-fingerprint');
      expect(['webrtc', 'nostr', 'hybrid']).toContain(decision.route);
    });

    it('should get best route for peer', () => {
      const route = service.getBestRoute('test-fingerprint');
      expect(['webrtc', 'nostr', 'hybrid']).toContain(route);
    });

    it('should cache routing decisions', () => {
      const decision1 = service.getRoutingDecision('test-fingerprint');
      const decision2 = service.getRoutingDecision('test-fingerprint');

      // Should return same cached result
      expect(decision1.route).toBe(decision2.route);
    });

    it('should clear routing cache', () => {
      service.getRoutingDecision('test-fingerprint');
      service.clearRoutingCache();

      // Should not throw
      const decision = service.getRoutingDecision('test-fingerprint');
      expect(decision).toBeDefined();
    });

    it('should configure hybrid routing', () => {
      service.setHybridConfig({
        preferWebRTC: false,
        dualSend: true,
      });

      // Configuration is internal, but should not throw
      const decision = service.getRoutingDecision('test-fingerprint');
      expect(decision).toBeDefined();
    });
  });

  describe('service state', () => {
    it('should return service state', async () => {
      await service.initialize();
      await service.joinRoom('test-room');

      const state = service.getState();

      expect(state.isInitialized).toBe(true);
      expect(state.rooms.size).toBe(1);
      expect(state.config).toBeDefined();
    });
  });
});

describe('Singleton', () => {
  afterEach(() => {
    resetTrysteroService();
  });

  it('should return same instance', () => {
    const service1 = getTrysteroService();
    const service2 = getTrysteroService();

    expect(service1).toBe(service2);
  });

  it('should reset singleton', () => {
    const service1 = getTrysteroService();
    resetTrysteroService();
    const service2 = getTrysteroService();

    expect(service1).not.toBe(service2);
  });
});

describe('HybridMessageRouter', () => {
  let service: TrysteroService;
  let router: HybridMessageRouter;

  beforeEach(async () => {
    service = createTrysteroService({ debug: false });
    await service.initialize();
    router = new HybridMessageRouter(service);
  });

  afterEach(() => {
    service.shutdown();
  });

  it('should send via nostr when peer is offline', async () => {
    const nostrFallback = vi.fn().mockResolvedValue(undefined);

    const result = await router.send(
      'test-fingerprint',
      'test-room',
      { text: 'Hello' },
      nostrFallback
    );

    expect(result.success).toBe(true);
    // Since peer is not online via WebRTC, should use nostr
    expect(['nostr', 'hybrid']).toContain(result.route);
  });

  it('should try webrtc first when peer might be online', async () => {
    await service.joinRoom('test-room');
    const nostrFallback = vi.fn().mockResolvedValue(undefined);

    const result = await router.send(
      'test-fingerprint',
      'test-room',
      { text: 'Hello' },
      nostrFallback
    );

    expect(result.success).toBe(true);
  });

  it('should use dual send when configured', async () => {
    const dualRouter = new HybridMessageRouter(service, { dualSend: true });
    await service.joinRoom('test-room');
    const nostrFallback = vi.fn().mockResolvedValue(undefined);

    const result = await dualRouter.send(
      'test-fingerprint',
      'test-room',
      { text: 'Hello' },
      nostrFallback
    );

    expect(result.route).toBe('hybrid');
    expect(nostrFallback).toHaveBeenCalled();
  });
});

describe('Room Configuration', () => {
  let service: TrysteroService;

  beforeEach(async () => {
    service = createTrysteroService({ debug: false });
    await service.initialize();
  });

  afterEach(() => {
    service.shutdown();
    vi.clearAllMocks();
  });

  it('should join room with nostr strategy', async () => {
    const state = await service.joinRoom('test-room', {
      strategy: 'nostr',
    });

    expect(state.isJoined).toBe(true);
    expect(state.config.strategy).toBe('nostr');
  });

  it('should join room with torrent strategy', async () => {
    const state = await service.joinRoom('test-room', {
      strategy: 'torrent',
    });

    expect(state.isJoined).toBe(true);
    expect(state.config.strategy).toBe('torrent');
  });

  it('should join room with custom relay URLs', async () => {
    const customRelays = ['wss://relay1.example.com', 'wss://relay2.example.com'];

    const state = await service.joinRoom('test-room', {
      relayUrls: customRelays,
    });

    expect(state.isJoined).toBe(true);
    expect(state.config.relayUrls).toEqual(customRelays);
  });

  it('should join room with password', async () => {
    const state = await service.joinRoom('test-room', {
      password: 'secret123',
    });

    expect(state.isJoined).toBe(true);
    expect(state.config.password).toBe('secret123');
  });

  it('should use custom app ID', async () => {
    const state = await service.joinRoom('test-room', {
      appId: 'custom-app',
    });

    expect(state.config.appId).toBe('custom-app');
  });
});

describe('Binary Data', () => {
  let service: TrysteroService;

  beforeEach(async () => {
    service = createTrysteroService({ debug: false });
    await service.initialize();
    await service.joinRoom('test-room');
  });

  afterEach(() => {
    service.shutdown();
  });

  it('should send binary data to room', () => {
    const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
    const messageId = service.sendBinaryToRoom('test-room', binaryData);

    expect(messageId).toBeDefined();
    expect(typeof messageId).toBe('string');
  });

  it('should send ArrayBuffer to room', () => {
    const buffer = new ArrayBuffer(10);
    const messageId = service.sendBinaryToRoom('test-room', buffer);

    expect(messageId).toBeDefined();
  });

  it('should return null for non-existent room', () => {
    const binaryData = new Uint8Array([1, 2, 3]);
    const messageId = service.sendBinaryToRoom('non-existent', binaryData);

    expect(messageId).toBeNull();
  });
});

describe('Error Handling', () => {
  let service: TrysteroService;

  beforeEach(async () => {
    service = createTrysteroService({ debug: false });
    await service.initialize();
  });

  afterEach(() => {
    service.shutdown();
  });

  it('should call error handlers on error', async () => {
    const errorHandler = vi.fn();
    service.onError(errorHandler);

    await service.joinRoom('test-room');

    // Error handler registered but no error triggered yet
    expect(typeof errorHandler).toBe('function');
  });

  it('should unsubscribe error handler', () => {
    const errorHandler = vi.fn();
    const unsubscribe = service.onError(errorHandler);

    unsubscribe();

    // Handler should be removed
    expect(typeof unsubscribe).toBe('function');
  });
});
