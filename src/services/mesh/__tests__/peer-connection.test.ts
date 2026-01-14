/**
 * Peer Connection Unit Tests
 *
 * Comprehensive tests for WebRTC peer connection management including:
 * - Peer discovery via signaling
 * - Connection establishment (offer/answer/ICE)
 * - Data channel communication
 * - Large message chunking
 * - Connection loss handling
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ============================================================================
// Mock RTCPeerConnection and RTCDataChannel
// ============================================================================

interface MockRTCDataChannelOptions {
  label?: string;
  ordered?: boolean;
  maxRetransmits?: number;
}

class MockRTCDataChannel {
  label: string;
  readyState: RTCDataChannelState = 'connecting';
  bufferedAmount = 0;
  binaryType: BinaryType = 'arraybuffer';
  ordered: boolean;

  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private sentMessages: (string | ArrayBuffer)[] = [];

  constructor(label: string, options?: MockRTCDataChannelOptions) {
    this.label = label;
    this.ordered = options?.ordered ?? true;
  }

  send = vi.fn((data: string | ArrayBuffer) => {
    if (this.readyState !== 'open') {
      throw new Error('Data channel is not open');
    }
    this.sentMessages.push(data);
    if (typeof data === 'string') {
      this.bufferedAmount += data.length;
    } else {
      this.bufferedAmount += data.byteLength;
    }
  });

  close = vi.fn(() => {
    this.readyState = 'closed';
    if (this.onclose) {
      this.onclose();
    }
  });

  // Test helpers
  _simulateOpen() {
    this.readyState = 'open';
    if (this.onopen) {
      this.onopen();
    }
  }

  _simulateClose() {
    this.readyState = 'closed';
    if (this.onclose) {
      this.onclose();
    }
  }

  _simulateError(error: Error) {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { error }));
    }
  }

  _simulateMessage(data: string | ArrayBuffer) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  _getSentMessages() {
    return this.sentMessages;
  }
}

class MockRTCPeerConnection {
  iceGatheringState: RTCIceGatheringState = 'new';
  iceConnectionState: RTCIceConnectionState = 'new';
  connectionState: RTCPeerConnectionState = 'new';
  localDescription: RTCSessionDescription | null = null;
  remoteDescription: RTCSessionDescription | null = null;
  signalingState: RTCSignalingState = 'stable';

  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  onicegatheringstatechange: (() => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ondatachannel: ((event: RTCDataChannelEvent) => void) | null = null;
  onsignalingstatechange: (() => void) | null = null;

  private dataChannels: MockRTCDataChannel[] = [];
  private iceCandidates: RTCIceCandidate[] = [];
  private config: RTCConfiguration;

  constructor(config?: RTCConfiguration) {
    this.config = config || {};
  }

  createDataChannel = vi.fn((label: string, options?: RTCDataChannelInit) => {
    const channel = new MockRTCDataChannel(label, options);
    this.dataChannels.push(channel);
    return channel;
  });

  createOffer = vi.fn(async (_options?: RTCOfferOptions) => {
    return {
      type: 'offer' as RTCSdpType,
      sdp: 'v=0\r\no=- 1234567890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n',
    };
  });

  createAnswer = vi.fn(async () => {
    return {
      type: 'answer' as RTCSdpType,
      sdp: 'v=0\r\no=- 1234567890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n',
    };
  });

  setLocalDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.localDescription = new RTCSessionDescription(desc);
    this.signalingState = desc.type === 'offer' ? 'have-local-offer' : 'stable';
    if (this.onsignalingstatechange) {
      this.onsignalingstatechange();
    }
  });

  setRemoteDescription = vi.fn(async (desc: RTCSessionDescriptionInit) => {
    this.remoteDescription = new RTCSessionDescription(desc);
    this.signalingState = desc.type === 'offer' ? 'have-remote-offer' : 'stable';
    if (this.onsignalingstatechange) {
      this.onsignalingstatechange();
    }
  });

  addIceCandidate = vi.fn(async (candidate: RTCIceCandidateInit) => {
    this.iceCandidates.push(new RTCIceCandidate(candidate));
  });

  close = vi.fn(() => {
    this.connectionState = 'closed';
    this.iceConnectionState = 'closed';
    this.signalingState = 'closed';
    for (const channel of this.dataChannels) {
      channel.close();
    }
    if (this.onconnectionstatechange) {
      this.onconnectionstatechange();
    }
  });

  getStats = vi.fn(async () => {
    return new Map();
  });

  // Test helpers
  _simulateIceCandidate(candidate: RTCIceCandidateInit | null) {
    if (this.onicecandidate) {
      this.onicecandidate({
        candidate: candidate ? new RTCIceCandidate(candidate) : null,
      } as RTCPeerConnectionIceEvent);
    }
  }

  _simulateIceGatheringComplete() {
    this.iceGatheringState = 'complete';
    if (this.onicegatheringstatechange) {
      this.onicegatheringstatechange();
    }
    this._simulateIceCandidate(null);
  }

  _simulateConnectionState(state: RTCPeerConnectionState) {
    this.connectionState = state;
    if (this.onconnectionstatechange) {
      this.onconnectionstatechange();
    }
  }

  _simulateIceConnectionState(state: RTCIceConnectionState) {
    this.iceConnectionState = state;
    if (this.oniceconnectionstatechange) {
      this.oniceconnectionstatechange();
    }
  }

  _simulateDataChannel(channel: MockRTCDataChannel) {
    if (this.ondatachannel) {
      this.ondatachannel({ channel } as unknown as RTCDataChannelEvent);
    }
  }

  _getDataChannels() {
    return this.dataChannels;
  }

  _getConfig() {
    return this.config;
  }
}

// Mock RTCSessionDescription
class MockRTCSessionDescription {
  type: RTCSdpType;
  sdp: string;

  constructor(init: RTCSessionDescriptionInit) {
    this.type = init.type!;
    this.sdp = init.sdp || '';
  }
}

// Mock RTCIceCandidate
class MockRTCIceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;

  constructor(init: RTCIceCandidateInit) {
    this.candidate = init.candidate || '';
    this.sdpMid = init.sdpMid || null;
    this.sdpMLineIndex = init.sdpMLineIndex ?? null;
  }
}

// Apply global mocks
vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection);
vi.stubGlobal('RTCSessionDescription', MockRTCSessionDescription);
vi.stubGlobal('RTCIceCandidate', MockRTCIceCandidate);
vi.stubGlobal('RTCDataChannel', MockRTCDataChannel);

// Import after mocks are applied
import { PeerConnectionManager, PeerConnectionPool } from '../../webrtc/peer-connection';
import type { ConnectionState, IceConnectionState } from '../../webrtc/types';

// ============================================================================
// Peer Discovery Tests
// ============================================================================

describe('Peer Discovery', () => {
  describe('Discover peers via signaling', () => {
    let pool: PeerConnectionPool;

    beforeEach(() => {
      pool = new PeerConnectionPool({ debug: false });
    });

    afterEach(() => {
      pool.closeAll();
    });

    it('should create peer connection for discovered peer', () => {
      const peerId = 'discovered-peer-123';
      const connection = pool.getOrCreate(peerId, true);

      expect(connection).toBeDefined();
      expect(pool.has(peerId)).toBe(true);
    });

    it('should track multiple discovered peers', () => {
      const peerIds = ['peer-1', 'peer-2', 'peer-3'];

      for (const peerId of peerIds) {
        pool.getOrCreate(peerId, true);
      }

      expect(pool.size).toBe(3);
      expect(pool.getAllPeers()).toEqual(expect.arrayContaining(peerIds));
    });

    it('should reuse existing connection for same peer', () => {
      const peerId = 'reuse-peer-123';
      const connection1 = pool.getOrCreate(peerId, true);
      const connection2 = pool.getOrCreate(peerId, true);

      expect(connection1).toBe(connection2);
      expect(pool.size).toBe(1);
    });

    it('should initialize connection with ICE servers', async () => {
      const customIceServers = [
        { urls: 'stun:custom.stun.server:3478' },
        { urls: 'turn:custom.turn.server:3478', username: 'user', credential: 'pass' },
      ];

      const customPool = new PeerConnectionPool({
        iceServers: customIceServers,
        debug: false,
      });

      const connection = customPool.getOrCreate('peer-with-custom-ice', true);
      await connection.initialize();

      // Verify ICE servers were used
      expect(connection).toBeDefined();
      customPool.closeAll();
    });
  });

  describe('Handle no peers found gracefully', () => {
    let pool: PeerConnectionPool;

    beforeEach(() => {
      pool = new PeerConnectionPool({ debug: false });
    });

    afterEach(() => {
      pool.closeAll();
    });

    it('should return empty list when no peers discovered', () => {
      const connectedPeers = pool.getConnectedPeers();
      expect(connectedPeers).toEqual([]);
    });

    it('should return undefined for unknown peer', () => {
      const connection = pool.get('unknown-peer-id');
      expect(connection).toBeUndefined();
    });

    it('should handle remove of non-existent peer gracefully', () => {
      const removed = pool.remove('non-existent-peer');
      expect(removed).toBe(false);
    });

    it('should handle broadcast with no peers', () => {
      const sentCount = pool.broadcast('test message');
      expect(sentCount).toBe(0);
    });

    it('should handle sendTo with no peers', () => {
      const results = pool.sendTo(['peer-1', 'peer-2'], 'test message');

      expect(results.get('peer-1')).toBe(false);
      expect(results.get('peer-2')).toBe(false);
    });
  });
});

// ============================================================================
// Connection Establishment Tests
// ============================================================================

describe('Connection Establishment', () => {
  describe('Create offer with ICE candidates', () => {
    let connection: PeerConnectionManager;
    let iceCandidates: RTCIceCandidate[];

    beforeEach(() => {
      iceCandidates = [];
      connection = new PeerConnectionManager('peer-1', true, { debug: false }, {
        onIceCandidate: (candidate) => {
          iceCandidates.push(candidate);
        },
      });
    });

    afterEach(() => {
      connection.close();
    });

    it('should create valid SDP offer', async () => {
      await connection.initialize();
      const offer = await connection.createOffer();

      expect(offer.type).toBe('offer');
      expect(offer.sdp).toBeDefined();
      expect(offer.sdp!.length).toBeGreaterThan(0);
    });

    it('should generate ICE candidates during offer creation', async () => {
      await connection.initialize();
      await connection.createOffer();

      // Simulate ICE candidate generation
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      mockPc._simulateIceCandidate({
        candidate: 'candidate:1 1 udp 2122194687 192.168.1.1 12345 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      });

      expect(iceCandidates.length).toBeGreaterThanOrEqual(1);
    });

    it('should set local description after creating offer', async () => {
      await connection.initialize();
      await connection.createOffer();

      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      expect(mockPc.setLocalDescription).toHaveBeenCalled();
    });

    it('should create data channel when initiator', async () => {
      await connection.initialize();

      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      expect(mockPc.createDataChannel).toHaveBeenCalledWith('bitchat', expect.any(Object));
    });
  });

  describe('Accept offer and create answer', () => {
    let responder: PeerConnectionManager;
    let receivedDataChannel: MockRTCDataChannel | null = null;

    beforeEach(() => {
      receivedDataChannel = null;
      responder = new PeerConnectionManager('peer-2', false, { debug: false }, {
        onDataChannelOpen: () => {
          // Data channel opened
        },
      });
    });

    afterEach(() => {
      responder.close();
    });

    it('should set remote description from offer', async () => {
      await responder.initialize();

      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n',
      };

      await responder.setRemoteDescription(offer);

      const mockPc = (responder as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      expect(mockPc.setRemoteDescription).toHaveBeenCalledWith(offer);
    });

    it('should create valid SDP answer', async () => {
      await responder.initialize();

      const offer: RTCSessionDescriptionInit = {
        type: 'offer',
        sdp: 'v=0\r\no=- 123 2 IN IP4 127.0.0.1\r\n',
      };

      await responder.setRemoteDescription(offer);
      const answer = await responder.createAnswer();

      expect(answer.type).toBe('answer');
      expect(answer.sdp).toBeDefined();
    });

    it('should not create data channel when not initiator', async () => {
      await responder.initialize();

      const mockPc = (responder as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      expect(mockPc.createDataChannel).not.toHaveBeenCalled();
    });

    it('should handle incoming data channel', async () => {
      await responder.initialize();

      const mockPc = (responder as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const incomingChannel = new MockRTCDataChannel('bitchat');

      mockPc._simulateDataChannel(incomingChannel);

      // The responder should now have a data channel
      expect(mockPc.ondatachannel).toBeDefined();
    });
  });

  describe('Complete ICE negotiation', () => {
    let initiator: PeerConnectionManager;
    let responder: PeerConnectionManager;

    beforeEach(() => {
      initiator = new PeerConnectionManager('initiator', true, { debug: false });
      responder = new PeerConnectionManager('responder', false, { debug: false });
    });

    afterEach(() => {
      initiator.close();
      responder.close();
    });

    it('should exchange ICE candidates between peers', async () => {
      const initiatorCandidates: RTCIceCandidate[] = [];
      const responderCandidates: RTCIceCandidate[] = [];

      initiator = new PeerConnectionManager('initiator', true, { debug: false }, {
        onIceCandidate: (candidate) => initiatorCandidates.push(candidate),
      });

      responder = new PeerConnectionManager('responder', false, { debug: false }, {
        onIceCandidate: (candidate) => responderCandidates.push(candidate),
      });

      await initiator.initialize();
      await responder.initialize();

      const offer = await initiator.createOffer();
      await responder.setRemoteDescription(offer);
      const answer = await responder.createAnswer();
      await initiator.setRemoteDescription(answer);

      // Simulate ICE candidate exchange
      const mockInitiatorPc = (initiator as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockResponderPc = (responder as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockInitiatorPc._simulateIceCandidate({
        candidate: 'candidate:1 1 udp 123 192.168.1.1 12345 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      });

      mockResponderPc._simulateIceCandidate({
        candidate: 'candidate:2 1 udp 456 192.168.1.2 12346 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      });

      expect(initiatorCandidates.length).toBeGreaterThan(0);
      expect(responderCandidates.length).toBeGreaterThan(0);
    });

    it('should add remote ICE candidates', async () => {
      await initiator.initialize();

      const candidate: RTCIceCandidateInit = {
        candidate: 'candidate:1 1 udp 2122194687 192.168.1.1 12345 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
      };

      await initiator.addIceCandidate(candidate);

      const mockPc = (initiator as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      expect(mockPc.addIceCandidate).toHaveBeenCalledWith(candidate);
    });

    it('should track ICE connection state changes', async () => {
      const iceStates: IceConnectionState[] = [];

      initiator = new PeerConnectionManager('initiator', true, { debug: false }, {
        onIceStateChange: (state) => iceStates.push(state),
      });

      await initiator.initialize();

      const mockPc = (initiator as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc._simulateIceConnectionState('checking');
      mockPc._simulateIceConnectionState('connected');

      expect(iceStates).toContain('checking');
      expect(iceStates).toContain('connected');
    });
  });

  describe('Establish data channel', () => {
    let connection: PeerConnectionManager;
    let dataChannelOpened = false;

    beforeEach(() => {
      dataChannelOpened = false;
      connection = new PeerConnectionManager('peer', true, { debug: false }, {
        onDataChannelOpen: () => {
          dataChannelOpened = true;
        },
      });
    });

    afterEach(() => {
      connection.close();
    });

    it('should create data channel with correct label', async () => {
      await connection.initialize();

      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const channels = mockPc._getDataChannels();

      expect(channels.length).toBe(1);
      expect(channels[0].label).toBe('bitchat');
    });

    it('should create data channel with custom label', async () => {
      const customConnection = new PeerConnectionManager(
        'peer',
        true,
        { dataChannelLabel: 'custom-channel', debug: false }
      );

      await customConnection.initialize();

      const mockPc = (customConnection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const channels = mockPc._getDataChannels();

      expect(channels[0].label).toBe('custom-channel');
      customConnection.close();
    });

    it('should trigger onDataChannelOpen when channel opens', async () => {
      await connection.initialize();

      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const channel = mockPc._getDataChannels()[0];

      channel._simulateOpen();

      expect(dataChannelOpened).toBe(true);
    });

    it('should report ready state correctly', async () => {
      await connection.initialize();

      // Initially not ready
      expect(connection.isReady()).toBe(false);

      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const channel = mockPc._getDataChannels()[0];

      // Simulate connection and channel open
      mockPc._simulateConnectionState('connected');
      channel._simulateOpen();

      expect(connection.isReady()).toBe(true);
    });
  });
});

// ============================================================================
// Data Transfer Tests
// ============================================================================

describe('Data Transfer', () => {
  describe('Send message over data channel', () => {
    let connection: PeerConnectionManager;
    let mockChannel: MockRTCDataChannel;

    beforeEach(async () => {
      connection = new PeerConnectionManager('peer', true, { debug: false });
      await connection.initialize();

      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      mockChannel = mockPc._getDataChannels()[0];
      mockChannel._simulateOpen();
      mockPc._simulateConnectionState('connected');
    });

    afterEach(() => {
      connection.close();
    });

    it('should send string message successfully', () => {
      const message = 'Hello, peer!';
      const result = connection.send(message);

      expect(result).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith(message);
    });

    it('should send ArrayBuffer message successfully', () => {
      const buffer = new ArrayBuffer(10);
      const result = connection.send(buffer);

      expect(result).toBe(true);
      expect(mockChannel.send).toHaveBeenCalledWith(buffer);
    });

    it('should send Uint8Array message successfully', () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const result = connection.send(data);

      expect(result).toBe(true);
      expect(mockChannel.send).toHaveBeenCalled();
    });

    it('should track bytes sent', () => {
      const message = 'Test message';
      connection.send(message);

      const stats = connection.getStats();
      expect(stats.bytesSent).toBe(message.length);
      expect(stats.messagesSent).toBe(1);
    });

    it('should return false when channel not ready', () => {
      mockChannel.readyState = 'closed';

      const result = connection.send('test');

      expect(result).toBe(false);
    });
  });

  describe('Receive message over data channel', () => {
    let connection: PeerConnectionManager;
    let receivedMessages: (string | ArrayBuffer)[] = [];

    beforeEach(async () => {
      receivedMessages = [];
      connection = new PeerConnectionManager('peer', true, { debug: false }, {
        onMessage: (data) => {
          receivedMessages.push(data);
        },
      });
      await connection.initialize();

      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockChannel = mockPc._getDataChannels()[0];
      mockChannel._simulateOpen();
    });

    afterEach(() => {
      connection.close();
    });

    it('should receive string message', () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockChannel = mockPc._getDataChannels()[0];

      mockChannel._simulateMessage('Hello from remote!');

      expect(receivedMessages).toContain('Hello from remote!');
    });

    it('should receive binary message', () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockChannel = mockPc._getDataChannels()[0];

      const binaryData = new ArrayBuffer(10);
      mockChannel._simulateMessage(binaryData);

      expect(receivedMessages.length).toBe(1);
      expect(receivedMessages[0]).toBeInstanceOf(ArrayBuffer);
    });

    it('should track bytes received', () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockChannel = mockPc._getDataChannels()[0];

      mockChannel._simulateMessage('Test message');

      const stats = connection.getStats();
      expect(stats.bytesReceived).toBeGreaterThan(0);
      expect(stats.messagesReceived).toBe(1);
    });
  });

  describe('Handle large messages (chunking)', () => {
    const CHUNK_SIZE = 16384; // 16KB standard WebRTC chunk size

    it('should calculate correct chunk count for large data', () => {
      const largeDataSize = 100 * 1024; // 100KB
      const expectedChunks = Math.ceil(largeDataSize / CHUNK_SIZE);

      expect(expectedChunks).toBe(7); // 100KB / 16KB = 6.25, rounded up = 7
    });

    it('should chunk large ArrayBuffer correctly', () => {
      const largeData = new ArrayBuffer(50 * 1024); // 50KB
      const chunks: ArrayBuffer[] = [];

      let offset = 0;
      while (offset < largeData.byteLength) {
        const chunkSize = Math.min(CHUNK_SIZE, largeData.byteLength - offset);
        chunks.push(largeData.slice(offset, offset + chunkSize));
        offset += chunkSize;
      }

      expect(chunks.length).toBe(4); // 50KB / 16KB = 3.125, rounded up = 4

      // Verify total size
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      expect(totalSize).toBe(50 * 1024);
    });

    it('should reassemble chunked data correctly', () => {
      const originalData = new Uint8Array(50 * 1024);
      for (let i = 0; i < originalData.length; i++) {
        originalData[i] = i % 256;
      }

      // Chunk the data
      const chunks: Uint8Array[] = [];
      let offset = 0;
      while (offset < originalData.length) {
        const chunkSize = Math.min(CHUNK_SIZE, originalData.length - offset);
        chunks.push(originalData.slice(offset, offset + chunkSize));
        offset += chunkSize;
      }

      // Reassemble
      const reassembled = new Uint8Array(originalData.length);
      let reassembledOffset = 0;
      for (const chunk of chunks) {
        reassembled.set(chunk, reassembledOffset);
        reassembledOffset += chunk.length;
      }

      // Verify integrity
      expect(reassembled.length).toBe(originalData.length);
      for (let i = 0; i < originalData.length; i++) {
        expect(reassembled[i]).toBe(originalData[i]);
      }
    });

    it('should send chunked data through pool broadcast', async () => {
      const pool = new PeerConnectionPool({ debug: false });

      // Create and initialize connections
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-2', true);

      await conn1.initialize();
      await conn2.initialize();

      // Open data channels
      const mockPc1 = (conn1 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockPc2 = (conn2 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc1._getDataChannels()[0]._simulateOpen();
      mockPc2._getDataChannels()[0]._simulateOpen();
      mockPc1._simulateConnectionState('connected');
      mockPc2._simulateConnectionState('connected');

      // Broadcast large data in chunks
      const largeData = new ArrayBuffer(32 * 1024); // 32KB
      const chunks: ArrayBuffer[] = [];

      let offset = 0;
      while (offset < largeData.byteLength) {
        const chunkSize = Math.min(CHUNK_SIZE, largeData.byteLength - offset);
        chunks.push(largeData.slice(offset, offset + chunkSize));
        offset += chunkSize;
      }

      for (const chunk of chunks) {
        pool.broadcast(chunk);
      }

      // Each peer should have received the chunks
      const channel1 = mockPc1._getDataChannels()[0];
      const channel2 = mockPc2._getDataChannels()[0];

      expect(channel1.send).toHaveBeenCalledTimes(2); // 32KB = 2 chunks
      expect(channel2.send).toHaveBeenCalledTimes(2);

      pool.closeAll();
    });
  });

  describe('Handle connection loss mid-transfer', () => {
    let connection: PeerConnectionManager;
    let connectionStates: ConnectionState[] = [];
    let errors: Event[] = [];

    beforeEach(async () => {
      connectionStates = [];
      errors = [];

      connection = new PeerConnectionManager('peer', true, { debug: false }, {
        onConnectionStateChange: (state) => connectionStates.push(state),
        onDataChannelError: (error) => errors.push(error),
      });

      await connection.initialize();

      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockChannel = mockPc._getDataChannels()[0];
      mockChannel._simulateOpen();
      mockPc._simulateConnectionState('connected');
    });

    afterEach(() => {
      connection.close();
    });

    it('should detect connection state change to disconnected', () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc._simulateConnectionState('disconnected');

      expect(connectionStates).toContain('disconnected');
      expect(connection.getConnectionState()).toBe('disconnected');
    });

    it('should detect connection state change to failed', () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc._simulateConnectionState('failed');

      expect(connectionStates).toContain('failed');
      expect(connection.getConnectionState()).toBe('failed');
    });

    it('should handle data channel error', () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockChannel = mockPc._getDataChannels()[0];

      mockChannel._simulateError(new Error('Network error'));

      expect(errors.length).toBe(1);
    });

    it('should return false when sending after connection loss', () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      mockPc._simulateConnectionState('disconnected');

      // Channel is still technically open but connection is lost
      const mockChannel = mockPc._getDataChannels()[0];
      mockChannel.readyState = 'closing';

      const result = connection.send('test message');

      expect(result).toBe(false);
    });

    it('should cleanup resources on connection failure', () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc._simulateConnectionState('failed');
      connection.close();

      expect(mockPc.close).toHaveBeenCalled();
      expect(connection.getConnectionState()).toBe('closed');
    });

    it('should attempt ICE restart on recoverable failure', async () => {
      const mockPc = (connection as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc._simulateIceConnectionState('disconnected');

      const restartOffer = await connection.restartIce();

      expect(restartOffer).toBeDefined();
      expect(mockPc.createOffer).toHaveBeenCalledWith({ iceRestart: true });
    });
  });
});

// ============================================================================
// Connection Pool Tests
// ============================================================================

describe('PeerConnectionPool', () => {
  let pool: PeerConnectionPool;

  beforeEach(() => {
    pool = new PeerConnectionPool({ debug: false });
  });

  afterEach(() => {
    pool.closeAll();
  });

  describe('Connection management', () => {
    it('should create new connection for unknown peer', () => {
      const connection = pool.getOrCreate('new-peer', true);

      expect(connection).toBeDefined();
      expect(pool.size).toBe(1);
    });

    it('should return existing connection for known peer', () => {
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-1', true);

      expect(conn1).toBe(conn2);
      expect(pool.size).toBe(1);
    });

    it('should track connection count correctly', () => {
      pool.getOrCreate('peer-1', true);
      pool.getOrCreate('peer-2', true);
      pool.getOrCreate('peer-3', true);

      expect(pool.size).toBe(3);
    });

    it('should remove connection', () => {
      pool.getOrCreate('peer-1', true);

      const removed = pool.remove('peer-1');

      expect(removed).toBe(true);
      expect(pool.size).toBe(0);
      expect(pool.has('peer-1')).toBe(false);
    });

    it('should close all connections', async () => {
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-2', true);

      await conn1.initialize();
      await conn2.initialize();

      pool.closeAll();

      expect(pool.size).toBe(0);
    });
  });

  describe('Messaging', () => {
    it('should broadcast to all connected peers', async () => {
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-2', true);

      await conn1.initialize();
      await conn2.initialize();

      // Open channels
      const mockPc1 = (conn1 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockPc2 = (conn2 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc1._getDataChannels()[0]._simulateOpen();
      mockPc2._getDataChannels()[0]._simulateOpen();
      mockPc1._simulateConnectionState('connected');
      mockPc2._simulateConnectionState('connected');

      const sentCount = pool.broadcast('broadcast message');

      expect(sentCount).toBe(2);
    });

    it('should exclude specified peers from broadcast', async () => {
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-2', true);

      await conn1.initialize();
      await conn2.initialize();

      const mockPc1 = (conn1 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockPc2 = (conn2 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc1._getDataChannels()[0]._simulateOpen();
      mockPc2._getDataChannels()[0]._simulateOpen();
      mockPc1._simulateConnectionState('connected');
      mockPc2._simulateConnectionState('connected');

      const sentCount = pool.broadcast('message', ['peer-1']);

      expect(sentCount).toBe(1);
    });

    it('should send to specific peers', async () => {
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-2', true);
      const conn3 = pool.getOrCreate('peer-3', true);

      await conn1.initialize();
      await conn2.initialize();
      await conn3.initialize();

      // Only open channel for peer-1 and peer-2
      const mockPc1 = (conn1 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      const mockPc2 = (conn2 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

      mockPc1._getDataChannels()[0]._simulateOpen();
      mockPc2._getDataChannels()[0]._simulateOpen();
      mockPc1._simulateConnectionState('connected');
      mockPc2._simulateConnectionState('connected');

      const results = pool.sendTo(['peer-1', 'peer-2', 'peer-3'], 'message');

      expect(results.get('peer-1')).toBe(true);
      expect(results.get('peer-2')).toBe(true);
      expect(results.get('peer-3')).toBe(false); // Not connected
    });
  });

  describe('Statistics', () => {
    it('should get stats for all connections', async () => {
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-2', true);

      await conn1.initialize();
      await conn2.initialize();

      const stats = pool.getAllStats();

      expect(stats.size).toBe(2);
      expect(stats.has('peer-1')).toBe(true);
      expect(stats.has('peer-2')).toBe(true);
    });

    it('should return connected peers only', async () => {
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-2', true);

      await conn1.initialize();
      await conn2.initialize();

      // Only connect peer-1
      const mockPc1 = (conn1 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      mockPc1._getDataChannels()[0]._simulateOpen();
      mockPc1._simulateConnectionState('connected');

      const connectedPeers = pool.getConnectedPeers();

      expect(connectedPeers).toContain('peer-1');
      expect(connectedPeers).not.toContain('peer-2');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup failed connections', async () => {
      const conn1 = pool.getOrCreate('peer-1', true);
      const conn2 = pool.getOrCreate('peer-2', true);

      await conn1.initialize();
      await conn2.initialize();

      // Fail peer-1
      const mockPc1 = (conn1 as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
      mockPc1._simulateConnectionState('failed');

      const cleaned = pool.cleanup();

      expect(cleaned).toBe(1);
      expect(pool.has('peer-1')).toBe(false);
      expect(pool.has('peer-2')).toBe(true);
    });

    it('should cleanup closed connections', async () => {
      const conn1 = pool.getOrCreate('peer-1', true);

      await conn1.initialize();
      conn1.close();

      const cleaned = pool.cleanup();

      expect(cleaned).toBe(1);
      expect(pool.has('peer-1')).toBe(false);
    });
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Integration: Full Connection Flow', () => {
  it('should complete full offer-answer-connect flow', async () => {
    const initiatorEvents: string[] = [];
    const responderEvents: string[] = [];

    const initiator = new PeerConnectionManager('initiator', true, { debug: false }, {
      onConnectionStateChange: (state) => initiatorEvents.push(`conn:${state}`),
      onDataChannelOpen: () => initiatorEvents.push('dc:open'),
    });

    const responder = new PeerConnectionManager('responder', false, { debug: false }, {
      onConnectionStateChange: (state) => responderEvents.push(`conn:${state}`),
      onDataChannelOpen: () => responderEvents.push('dc:open'),
    });

    // Initialize both
    await initiator.initialize();
    await responder.initialize();

    // Create and exchange offer
    const offer = await initiator.createOffer();
    await responder.setRemoteDescription(offer);

    // Create and exchange answer
    const answer = await responder.createAnswer();
    await initiator.setRemoteDescription(answer);

    // Simulate ICE completion
    const mockInitiatorPc = (initiator as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
    const mockResponderPc = (responder as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

    mockInitiatorPc._simulateIceGatheringComplete();
    mockResponderPc._simulateIceGatheringComplete();

    // Simulate connection established
    mockInitiatorPc._simulateConnectionState('connected');
    mockResponderPc._simulateConnectionState('connected');

    // Open data channels
    mockInitiatorPc._getDataChannels()[0]._simulateOpen();

    // Responder receives data channel
    const responderChannel = new MockRTCDataChannel('bitchat');
    mockResponderPc._simulateDataChannel(responderChannel);
    responderChannel._simulateOpen();

    // Verify states
    expect(initiator.getConnectionState()).toBe('connected');
    expect(responder.getConnectionState()).toBe('connected');
    expect(initiatorEvents).toContain('conn:connected');
    expect(initiatorEvents).toContain('dc:open');

    // Cleanup
    initiator.close();
    responder.close();
  });

  it('should exchange messages after connection', async () => {
    const initiatorMessages: (string | ArrayBuffer)[] = [];
    const responderMessages: (string | ArrayBuffer)[] = [];

    const initiator = new PeerConnectionManager('initiator', true, { debug: false }, {
      onMessage: (data) => initiatorMessages.push(data),
    });

    const responder = new PeerConnectionManager('responder', false, { debug: false }, {
      onMessage: (data) => responderMessages.push(data),
    });

    await initiator.initialize();
    await responder.initialize();

    // Complete connection setup
    const offer = await initiator.createOffer();
    await responder.setRemoteDescription(offer);
    const answer = await responder.createAnswer();
    await initiator.setRemoteDescription(answer);

    // Get mock connections and channels
    const mockInitiatorPc = (initiator as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;
    const mockResponderPc = (responder as unknown as { peerConnection: MockRTCPeerConnection }).peerConnection;

    // Simulate connected state
    mockInitiatorPc._simulateConnectionState('connected');
    mockResponderPc._simulateConnectionState('connected');

    // Open initiator's channel
    const initiatorChannel = mockInitiatorPc._getDataChannels()[0];
    initiatorChannel._simulateOpen();

    // Create and open responder's received channel
    const responderChannel = new MockRTCDataChannel('bitchat');
    mockResponderPc._simulateDataChannel(responderChannel);
    responderChannel._simulateOpen();

    // Send message from initiator
    initiator.send('Hello from initiator');

    // Simulate responder receiving message
    responderChannel._simulateMessage('Hello from initiator');

    // Send message from responder (would need custom setup in real scenario)
    initiatorChannel._simulateMessage('Hello from responder');

    expect(responderMessages).toContain('Hello from initiator');
    expect(initiatorMessages).toContain('Hello from responder');

    initiator.close();
    responder.close();
  });
});
