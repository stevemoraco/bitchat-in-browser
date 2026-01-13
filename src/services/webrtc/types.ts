/**
 * WebRTC P2P Types
 * Type definitions for Trystero-based WebRTC P2P messaging
 */

// ============================================================================
// Connection Types
// ============================================================================

/**
 * WebRTC connection state
 */
export type ConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

/**
 * ICE connection state
 */
export type IceConnectionState =
  | 'new'
  | 'checking'
  | 'connected'
  | 'completed'
  | 'disconnected'
  | 'failed'
  | 'closed';

/**
 * Signaling strategy for peer discovery
 */
export type SignalingStrategy = 'nostr' | 'torrent' | 'firebase' | 'ipfs';

/**
 * STUN/TURN server configuration
 */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * Default STUN servers for NAT traversal
 */
export const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

// ============================================================================
// Room Types
// ============================================================================

/**
 * Room configuration
 */
export interface RoomConfig {
  /** Unique room identifier (e.g., channel ID) */
  roomId: string;
  /** Application namespace to prevent room collisions */
  appId?: string;
  /** Password for encrypted rooms (optional) */
  password?: string;
  /** Signaling strategy to use */
  strategy?: SignalingStrategy;
  /** Nostr relays for signaling (if using nostr strategy) */
  relayUrls?: string[];
  /** Custom ICE servers */
  iceServers?: IceServer[];
}

/**
 * Room state information
 */
export interface RoomState {
  /** Room ID */
  roomId: string;
  /** Whether currently in the room */
  isJoined: boolean;
  /** Connected peer IDs */
  peers: string[];
  /** Timestamp when joined */
  joinedAt?: number;
  /** Room configuration */
  config: RoomConfig;
}

/**
 * Room event types
 */
export type RoomEventType =
  | 'peer-join'
  | 'peer-leave'
  | 'data'
  | 'binary-data'
  | 'error'
  | 'state-change';

/**
 * Room event payload
 */
export interface RoomEvent<T = unknown> {
  type: RoomEventType;
  roomId: string;
  peerId?: string;
  data?: T;
  error?: Error;
  timestamp: number;
}

// ============================================================================
// Message Types
// ============================================================================

/**
 * P2P message wrapper
 */
export interface P2PMessage<T = unknown> {
  /** Message ID */
  id: string;
  /** Message type/channel name */
  type: string;
  /** Message payload */
  payload: T;
  /** Sender peer ID */
  senderId: string;
  /** Target peer ID (undefined = broadcast) */
  targetId?: string;
  /** Timestamp when sent */
  timestamp: number;
  /** Message sequence number for ordering */
  sequence?: number;
}

/**
 * Binary data message
 */
export interface BinaryMessage {
  /** Message ID */
  id: string;
  /** Data type indicator */
  type: string;
  /** Binary payload */
  data: ArrayBuffer | Uint8Array;
  /** Sender peer ID */
  senderId: string;
  /** Target peer ID (undefined = broadcast) */
  targetId?: string;
  /** Timestamp */
  timestamp: number;
}

/**
 * Message delivery options
 */
export interface SendOptions {
  /** Target specific peer(s), undefined = broadcast */
  targetPeers?: string[];
  /** Whether to require acknowledgment */
  reliable?: boolean;
  /** Message priority (lower = higher priority) */
  priority?: number;
  /** Timeout for reliable delivery (ms) */
  timeout?: number;
}

/**
 * Message acknowledgment
 */
export interface MessageAck {
  messageId: string;
  peerId: string;
  received: boolean;
  timestamp: number;
}

// ============================================================================
// Peer Types
// ============================================================================

/**
 * P2P peer information
 */
export interface P2PPeer {
  /** Unique peer ID (assigned by Trystero) */
  peerId: string;
  /** Nostr public key (if known) */
  publicKey?: string;
  /** Connection state */
  connectionState: ConnectionState;
  /** ICE connection state */
  iceState: IceConnectionState;
  /** RTCDataChannel ready state */
  dataChannelState: RTCDataChannelState;
  /** Rooms this peer is in */
  rooms: string[];
  /** When this peer was first seen */
  firstSeenAt: number;
  /** Last activity timestamp */
  lastSeenAt: number;
  /** Round-trip time estimate (ms) */
  rtt?: number;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Peer connection statistics
 */
export interface PeerStats {
  peerId: string;
  /** Bytes sent */
  bytesSent: number;
  /** Bytes received */
  bytesReceived: number;
  /** Messages sent */
  messagesSent: number;
  /** Messages received */
  messagesReceived: number;
  /** Current round-trip time (ms) */
  currentRtt?: number;
  /** Available outgoing bitrate */
  availableOutgoingBitrate?: number;
  /** Connection timestamp */
  connectedAt?: number;
}

// ============================================================================
// Event Handler Types
// ============================================================================

/**
 * Handler for peer join events
 */
export type PeerJoinHandler = (peerId: string, roomId: string) => void;

/**
 * Handler for peer leave events
 */
export type PeerLeaveHandler = (peerId: string, roomId: string) => void;

/**
 * Handler for data messages
 */
export type DataHandler<T = unknown> = (
  data: T,
  peerId: string,
  roomId: string
) => void;

/**
 * Handler for binary data
 */
export type BinaryHandler = (
  data: ArrayBuffer,
  peerId: string,
  roomId: string
) => void;

/**
 * Handler for errors
 */
export type ErrorHandler = (error: Error, roomId?: string, peerId?: string) => void;

/**
 * Handler for connection state changes
 */
export type StateChangeHandler = (
  state: ConnectionState,
  peerId: string,
  roomId: string
) => void;

// ============================================================================
// Service Types
// ============================================================================

/**
 * WebRTC service configuration
 */
export interface WebRTCServiceConfig {
  /** Application namespace */
  appId: string;
  /** Default signaling strategy */
  defaultStrategy: SignalingStrategy;
  /** Default Nostr relays for signaling */
  relayUrls?: string[];
  /** Default ICE servers */
  iceServers?: IceServer[];
  /** Enable debug logging */
  debug?: boolean;
  /** Message ordering buffer size */
  orderingBufferSize?: number;
  /** Reconnection attempts */
  maxReconnectAttempts?: number;
  /** Reconnection delay (ms) */
  reconnectDelay?: number;
}

/**
 * Service state
 */
export interface WebRTCServiceState {
  /** Whether the service is initialized */
  isInitialized: boolean;
  /** Active rooms */
  rooms: Map<string, RoomState>;
  /** Known peers */
  peers: Map<string, P2PPeer>;
  /** Local peer ID */
  localPeerId?: string;
  /** Service configuration */
  config: WebRTCServiceConfig;
}

// ============================================================================
// Channel Types for Trystero
// ============================================================================

/**
 * Trystero action pair (send/receive functions)
 */
export interface ActionPair<T = unknown> {
  /** Send function */
  send: (data: T, targetPeers?: string[]) => void;
  /** Receive handler setter */
  receive: (handler: (data: T, peerId: string) => void) => void;
}

/**
 * Predefined channel names
 */
export const CHANNELS = {
  /** Chat messages */
  CHAT: 'chat',
  /** Presence/heartbeat */
  PRESENCE: 'presence',
  /** Peer metadata exchange */
  METADATA: 'metadata',
  /** File transfer */
  FILE: 'file',
  /** Typing indicators */
  TYPING: 'typing',
  /** Read receipts */
  READ_RECEIPT: 'read',
  /** Binary data */
  BINARY: 'binary',
} as const;

export type ChannelName = (typeof CHANNELS)[keyof typeof CHANNELS];

// ============================================================================
// Routing Types
// ============================================================================

/**
 * Message delivery route
 */
export type DeliveryRoute = 'webrtc' | 'nostr' | 'hybrid';

/**
 * Routing decision for a peer
 */
export interface RoutingDecision {
  /** Peer fingerprint */
  peerFingerprint: string;
  /** Recommended route */
  route: DeliveryRoute;
  /** Whether peer is online via WebRTC */
  isWebRTCOnline: boolean;
  /** Latency estimate (ms) */
  latencyEstimate?: number;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Hybrid routing configuration
 */
export interface HybridRoutingConfig {
  /** Prefer WebRTC when available */
  preferWebRTC: boolean;
  /** Send via both routes for reliability */
  dualSend: boolean;
  /** Timeout before falling back to Nostr (ms) */
  webrtcTimeout: number;
  /** Cache routing decisions for this duration (ms) */
  routingCacheTtl: number;
}
