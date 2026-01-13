/**
 * WebRTC P2P Module
 * Provides Trystero-based WebRTC peer-to-peer messaging
 */

// Types
export type {
  // Connection types
  ConnectionState,
  IceConnectionState,
  SignalingStrategy,
  IceServer,
  // Room types
  RoomConfig,
  RoomState,
  RoomEventType,
  RoomEvent,
  // Message types
  P2PMessage,
  BinaryMessage,
  SendOptions,
  MessageAck,
  // Peer types
  P2PPeer,
  PeerStats,
  // Event handler types
  PeerJoinHandler,
  PeerLeaveHandler,
  DataHandler,
  BinaryHandler,
  ErrorHandler,
  StateChangeHandler,
  // Service types
  WebRTCServiceConfig,
  WebRTCServiceState,
  ActionPair,
  ChannelName,
  // Routing types
  DeliveryRoute,
  RoutingDecision,
  HybridRoutingConfig,
} from './types';

// Constants
export { DEFAULT_ICE_SERVERS, CHANNELS } from './types';

// Peer connection management
export {
  PeerConnectionManager,
  PeerConnectionPool,
  type PeerConnectionConfig,
  type PeerConnectionEvents,
} from './peer-connection';

// Trystero service
export {
  TrysteroService,
  HybridMessageRouter,
  getTrysteroService,
  resetTrysteroService,
  createTrysteroService,
} from './trystero';
