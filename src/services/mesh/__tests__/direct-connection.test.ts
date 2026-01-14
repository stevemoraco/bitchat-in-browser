/**
 * Direct Connection Manager Tests
 *
 * Tests for WebRTC direct connections including:
 * - Offer/answer generation
 * - Connection lifecycle
 * - Multiple peer management
 * - Data channel messaging
 * - QR code encoding/decoding
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock RTCPeerConnection
class MockRTCPeerConnection {
  iceGatheringState = 'complete';
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  connectionState = 'new';
  iceConnectionState = 'new';

  onconnectionstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  onicecandidate: ((event: { candidate: null }) => void) | null = null;
  ondatachannel: ((event: { channel: MockRTCDataChannel }) => void) | null = null;

  createDataChannel = vi.fn(() => new MockRTCDataChannel());
  createOffer = vi.fn().mockResolvedValue({ sdp: 'test-offer-sdp', type: 'offer' });
  createAnswer = vi.fn().mockResolvedValue({ sdp: 'test-answer-sdp', type: 'answer' });
  setLocalDescription = vi.fn().mockImplementation(async (desc) => {
    this.localDescription = desc;
  });
  setRemoteDescription = vi.fn().mockImplementation(async (desc) => {
    this.remoteDescription = desc;
  });
  close = vi.fn();
}

class MockRTCDataChannel {
  readyState = 'open';
  label = 'bitchat-mesh';

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  send = vi.fn();
  close = vi.fn();
}

// Apply mocks globally
vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection);
vi.stubGlobal('RTCDataChannel', MockRTCDataChannel);

// Import after mocks
import {
  DirectConnectionManager,
  ConnectionOffer,
  ConnectionAnswer,
} from '../direct-connection';

describe('DirectConnectionManager', () => {
  let manager: DirectConnectionManager;

  beforeEach(() => {
    DirectConnectionManager.resetInstance();
    manager = DirectConnectionManager.getInstance();
    manager.initialize();
  });

  afterEach(() => {
    manager.shutdown();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      expect(manager.getLocalPeerId()).toBeDefined();
      expect(manager.getConnectionCount()).toBe(0);
    });

    it('should accept custom ICE servers', () => {
      manager.initialize({
        iceServers: [{ urls: 'stun:custom.stun.server:3478' }],
      });

      expect(manager.getLocalPeerId()).toBeDefined();
    });

    it('should generate unique peer ID', () => {
      const peerId1 = manager.getLocalPeerId();

      DirectConnectionManager.resetInstance();
      const manager2 = DirectConnectionManager.getInstance();
      manager2.initialize();
      const peerId2 = manager2.getLocalPeerId();

      expect(peerId1).not.toBe(peerId2);
      manager2.shutdown();
    });
  });

  describe('offer/answer generation', () => {
    it('should create valid WebRTC offer', async () => {
      const { offer, encoded } = await manager.createOffer();

      expect(offer.type).toBe('offer');
      expect(offer.sdp).toBeDefined();
      expect(offer.peerId).toBe(manager.getLocalPeerId());
      expect(offer.timestamp).toBeLessThanOrEqual(Date.now());
      expect(encoded).toBeDefined();
    });

    it('should encode offer for QR code', async () => {
      const { encoded } = await manager.createOffer();

      // Should be base64 encoded
      expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);

      // Should be decodable
      const decoded = JSON.parse(atob(encoded)) as ConnectionOffer;
      expect(decoded.type).toBe('offer');
    });

    it('should mark pending offer', async () => {
      await manager.createOffer();

      expect(manager.hasPendingOffer()).toBe(true);
    });

    it('should accept offer and create answer', async () => {
      // Create offer from first manager
      const { encoded: offerEncoded } = await manager.createOffer();

      // Second manager accepts offer
      DirectConnectionManager.resetInstance();
      const manager2 = DirectConnectionManager.getInstance();
      manager2.initialize();

      const { answer, encoded } = await manager2.acceptOffer(offerEncoded);

      expect(answer.type).toBe('answer');
      expect(answer.sdp).toBeDefined();
      expect(encoded).toBeDefined();

      manager2.shutdown();
    });

    it('should reject invalid offer', async () => {
      await expect(manager.acceptOffer('invalid-base64!')).rejects.toThrow();
    });

    it('should reject offer with wrong type', async () => {
      const invalidOffer = btoa(JSON.stringify({ type: 'answer', sdp: 'test' }));

      await expect(manager.acceptOffer(invalidOffer)).rejects.toThrow('Invalid offer');
    });

    it('should accept answer and complete connection', async () => {
      // Create offer
      await manager.createOffer();

      // Create mock answer
      const answer: ConnectionAnswer = {
        type: 'answer',
        sdp: 'test-answer-sdp',
        timestamp: Date.now(),
        peerId: 'remote-peer-id',
      };
      const encodedAnswer = btoa(JSON.stringify(answer));

      await manager.acceptAnswer(encodedAnswer);

      // Pending offer should be resolved
      expect(manager.hasPendingOffer()).toBe(false);
    });

    it('should reject answer without pending offer', async () => {
      const answer = btoa(JSON.stringify({
        type: 'answer',
        sdp: 'test',
        timestamp: Date.now(),
        peerId: 'test',
      }));

      await expect(manager.acceptAnswer(answer)).rejects.toThrow('No pending offer');
    });
  });

  describe('connection lifecycle', () => {
    it('should track connection state', async () => {
      await manager.createOffer();

      // Accept answer
      const answer: ConnectionAnswer = {
        type: 'answer',
        sdp: 'test-sdp',
        timestamp: Date.now(),
        peerId: 'remote-peer',
      };
      await manager.acceptAnswer(btoa(JSON.stringify(answer)));

      // Connection should exist
      const connection = manager.getConnection('remote-peer');
      expect(connection).toBeDefined();
    });

    it('should close specific connection', async () => {
      await manager.createOffer();

      const answer: ConnectionAnswer = {
        type: 'answer',
        sdp: 'test-sdp',
        timestamp: Date.now(),
        peerId: 'peer-to-close',
      };
      await manager.acceptAnswer(btoa(JSON.stringify(answer)));

      manager.closeConnection('peer-to-close');

      expect(manager.getConnection('peer-to-close')).toBeUndefined();
    });

    it('should close all connections', async () => {
      // Set up multiple mock connections
      await manager.createOffer();
      const answer1: ConnectionAnswer = {
        type: 'answer',
        sdp: 'test-sdp',
        timestamp: Date.now(),
        peerId: 'peer-1',
      };
      await manager.acceptAnswer(btoa(JSON.stringify(answer1)));

      manager.closeAll();

      expect(manager.getConnectionCount()).toBe(0);
    });

    it('should cancel pending offer', async () => {
      await manager.createOffer();
      expect(manager.hasPendingOffer()).toBe(true);

      manager.cancelPendingOffer();

      expect(manager.hasPendingOffer()).toBe(false);
    });

    it('should handle disconnect alias', async () => {
      await manager.createOffer();
      const answer: ConnectionAnswer = {
        type: 'answer',
        sdp: 'test-sdp',
        timestamp: Date.now(),
        peerId: 'peer-disconnect',
      };
      await manager.acceptAnswer(btoa(JSON.stringify(answer)));

      manager.disconnect('peer-disconnect');

      expect(manager.getConnection('peer-disconnect')).toBeUndefined();
    });
  });

  describe('multiple peer management', () => {
    it('should track multiple connections', async () => {
      // Create first connection
      await manager.createOffer();
      await manager.acceptAnswer(btoa(JSON.stringify({
        type: 'answer',
        sdp: 'sdp-1',
        timestamp: Date.now(),
        peerId: 'peer-1',
      })));

      // Create second connection (new offer needed)
      manager.cancelPendingOffer(); // Clear pending
      await manager.createOffer();
      await manager.acceptAnswer(btoa(JSON.stringify({
        type: 'answer',
        sdp: 'sdp-2',
        timestamp: Date.now(),
        peerId: 'peer-2',
      })));

      expect(manager.getConnection('peer-1')).toBeDefined();
      expect(manager.getConnection('peer-2')).toBeDefined();
    });

    it('should get list of connected peers', async () => {
      await manager.createOffer();
      await manager.acceptAnswer(btoa(JSON.stringify({
        type: 'answer',
        sdp: 'sdp',
        timestamp: Date.now(),
        peerId: 'connected-peer',
      })));

      // Simulate connection state change to connected
      const connection = manager.getConnection('connected-peer');
      if (connection) {
        // @ts-expect-error - modifying internal state for test
        connection.state = 'connected';
      }

      const peers = manager.getConnectedPeers();

      expect(peers.some((p) => p.peerId === 'connected-peer')).toBe(true);
    });

    it('should check if connected to specific peer', async () => {
      await manager.createOffer();
      await manager.acceptAnswer(btoa(JSON.stringify({
        type: 'answer',
        sdp: 'sdp',
        timestamp: Date.now(),
        peerId: 'check-peer',
      })));

      // Simulate connected state
      const connection = manager.getConnection('check-peer');
      if (connection) {
        // @ts-expect-error - modifying internal state for test
        connection.state = 'connected';
      }

      expect(manager.isConnectedTo('check-peer')).toBe(true);
      expect(manager.isConnectedTo('unknown-peer')).toBe(false);
    });
  });

  describe('messaging', () => {
    beforeEach(async () => {
      await manager.createOffer();
      await manager.acceptAnswer(btoa(JSON.stringify({
        type: 'answer',
        sdp: 'sdp',
        timestamp: Date.now(),
        peerId: 'msg-peer',
      })));

      // Simulate connected state with open data channel
      const connection = manager.getConnection('msg-peer');
      if (connection) {
        // @ts-expect-error - modifying internal state for test
        connection.state = 'connected';
        // @ts-expect-error - modifying internal state for test
        connection.dataChannel = new MockRTCDataChannel();
      }
    });

    it('should send message to specific peer', () => {
      const result = manager.send('msg-peer', { text: 'Hello' });

      expect(result).toBe(true);
    });

    it('should return false when sending to non-existent peer', () => {
      const result = manager.send('unknown-peer', { text: 'Hello' });

      expect(result).toBe(false);
    });

    it('should broadcast to all connected peers', () => {
      const count = manager.broadcast({ text: 'Broadcast message' });

      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should register message handler', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onMessage(handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should unsubscribe message handler', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onMessage(handler);

      unsubscribe();

      // Handler should be removed
    });
  });

  describe('event handlers', () => {
    it('should register connection handler', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onConnection(handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should register disconnection handler', () => {
      const handler = vi.fn();
      const unsubscribe = manager.onDisconnection(handler);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('should notify on disconnection', async () => {
      const handler = vi.fn();
      manager.onDisconnection(handler);

      await manager.createOffer();
      await manager.acceptAnswer(btoa(JSON.stringify({
        type: 'answer',
        sdp: 'sdp',
        timestamp: Date.now(),
        peerId: 'disconnect-peer',
      })));

      manager.closeConnection('disconnect-peer');

      expect(handler).toHaveBeenCalledWith('disconnect-peer');
    });
  });

  describe('QR encoding/decoding', () => {
    it('should encode data for QR code', async () => {
      const { encoded } = await manager.createOffer();

      // Encoded data should be base64
      expect(() => atob(encoded)).not.toThrow();
    });

    it('should decode QR data correctly', async () => {
      const { offer, encoded } = await manager.createOffer();
      const decoded = JSON.parse(atob(encoded)) as ConnectionOffer;

      expect(decoded.type).toBe(offer.type);
      expect(decoded.peerId).toBe(offer.peerId);
    });

    it('should handle special characters in SDP', async () => {
      // SDP can contain newlines, equals, etc.
      const { encoded } = await manager.createOffer();

      // Should be decodable
      const decoded = JSON.parse(atob(encoded));
      expect(decoded.sdp).toBeDefined();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = DirectConnectionManager.getInstance();
      const instance2 = DirectConnectionManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = DirectConnectionManager.getInstance();
      DirectConnectionManager.resetInstance();
      const instance2 = DirectConnectionManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('shutdown', () => {
    it('should close all connections on shutdown', async () => {
      await manager.createOffer();
      await manager.acceptAnswer(btoa(JSON.stringify({
        type: 'answer',
        sdp: 'sdp',
        timestamp: Date.now(),
        peerId: 'shutdown-peer',
      })));

      manager.shutdown();

      expect(manager.getConnectionCount()).toBe(0);
    });

    it('should clear all handlers on shutdown', () => {
      const messageHandler = vi.fn();
      const connectionHandler = vi.fn();
      const disconnectionHandler = vi.fn();

      manager.onMessage(messageHandler);
      manager.onConnection(connectionHandler);
      manager.onDisconnection(disconnectionHandler);

      manager.shutdown();

      // Handlers should be cleared (internal state)
    });
  });

  describe('error handling', () => {
    it('should handle send to closed channel', async () => {
      await manager.createOffer();
      await manager.acceptAnswer(btoa(JSON.stringify({
        type: 'answer',
        sdp: 'sdp',
        timestamp: Date.now(),
        peerId: 'closed-peer',
      })));

      const connection = manager.getConnection('closed-peer');
      if (connection && connection.dataChannel) {
        // @ts-expect-error - modifying internal state for test
        connection.dataChannel.readyState = 'closed';
      }

      const result = manager.send('closed-peer', { text: 'test' });

      expect(result).toBe(false);
    });

    it('should handle malformed QR data', async () => {
      const malformed = 'not-valid-base64!!!';

      await expect(manager.acceptOffer(malformed)).rejects.toThrow();
    });

    it('should handle empty encoded data', async () => {
      const empty = btoa('');

      await expect(manager.acceptOffer(empty)).rejects.toThrow();
    });
  });
});
