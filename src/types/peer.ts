/**
 * Peer Type Definitions
 *
 * Core types for representing peers (other users) in BitChat PWA.
 * Peers are identified by their cryptographic fingerprint and can be
 * discovered via Nostr, WebRTC, or local BLE mesh.
 *
 * @module types/peer
 */

/**
 * Trust level enumeration for peers.
 * Determines the level of verification and trust for a peer.
 * Matches native BitChat's TrustLevel enum.
 */
export enum TrustLevel {
  /** New or unverified peer */
  Unknown = 'unknown',
  /** Basic interaction history */
  Casual = 'casual',
  /** User has explicitly trusted this peer */
  Trusted = 'trusted',
  /** Cryptographic verification completed (e.g., QR code exchange) */
  Verified = 'verified',
}

/**
 * Peer online/connection status.
 */
export enum PeerStatus {
  /** Peer is currently online and active */
  Online = 'online',
  /** Peer is not connected */
  Offline = 'offline',
  /** Peer is connected but idle */
  Away = 'away',
}

/**
 * Source of peer discovery.
 * Indicates how we learned about this peer.
 */
export enum PeerSource {
  /** Discovered via Nostr protocol */
  Nostr = 'nostr',
  /** Discovered via WebRTC/Trystero */
  WebRTC = 'webrtc',
  /** Manually added or local peer */
  Local = 'local',
  /** Discovered via BLE mesh (native apps only, not applicable for PWA) */
  Bluetooth = 'bluetooth',
}

/**
 * Connection state for a peer.
 * More granular than PeerStatus, includes transport information.
 * Matches native BitChat's BitchatPeer.ConnectionState.
 */
export enum PeerConnectionState {
  /** Connected via Bluetooth (native app only) */
  BluetoothConnected = 'bluetoothConnected',
  /** Reachable via mesh relay */
  MeshReachable = 'meshReachable',
  /** Reachable via Nostr (mutual favorites) */
  NostrAvailable = 'nostrAvailable',
  /** Not connected via any transport */
  Offline = 'offline',
  /** Connected via WebRTC (PWA specific) */
  WebRTCConnected = 'webrtcConnected',
}

/**
 * Favorite relationship status.
 * Tracks mutual favorite status between peers.
 */
export interface FavoriteRelationship {
  /** Whether we have favorited this peer */
  isFavorite: boolean;
  /** Whether this peer has favorited us */
  theyFavoritedUs: boolean;
  /** Whether the favorite is mutual */
  isMutual: boolean;
  /** Timestamp when we favorited them (if applicable) */
  favoritedAt?: number;
}

/**
 * Core peer interface representing another user.
 * Compatible with BitchatPeer from native iOS/Android apps.
 */
export interface Peer {
  /**
   * Public key fingerprint (first 8 characters of SHA-256 hash).
   * Primary identifier for the peer.
   */
  fingerprint: string;

  /**
   * Full Nostr public key (64-character hex string).
   */
  publicKey: string;

  /**
   * Peer's self-assigned display nickname.
   * This is what the peer calls themselves.
   */
  nickname: string;

  /**
   * Current online/connection status.
   */
  status: PeerStatus;

  /**
   * Unix timestamp when the peer was last seen active.
   */
  lastSeenAt: number;

  /**
   * How we discovered or connected to this peer.
   */
  source: PeerSource;

  /**
   * Trust level assigned by the local user.
   */
  trustLevel: TrustLevel;

  /**
   * Whether this peer is blocked.
   * Blocked peers' messages are hidden.
   */
  isBlocked: boolean;

  /**
   * User's local nickname for this peer (petname).
   * Overrides the peer's self-assigned nickname in UI.
   */
  localNickname?: string;

  /**
   * User's private notes about this peer.
   */
  notes?: string;

  /**
   * Avatar URL or data URI.
   */
  avatar?: string;

  /**
   * NIP-05 identifier if verified.
   * Format: user@domain.com
   */
  nip05?: string;

  /**
   * Whether NIP-05 has been verified.
   */
  nip05Verified?: boolean;

  /**
   * Favorite relationship status.
   */
  favoriteStatus?: FavoriteRelationship;

  /**
   * Nostr public key in npub format.
   */
  npub?: string;

  /**
   * Unix timestamp when this peer was first seen.
   */
  firstSeenAt: number;

  /**
   * Noise protocol static public key (for E2E encryption).
   * Hex-encoded 32-byte X25519 public key.
   */
  noisePublicKey?: string;

  /**
   * Connection state with additional transport info.
   */
  connectionState?: PeerConnectionState;
}

/**
 * Cryptographic identity of a peer.
 * Matches native BitChat's CryptographicIdentity struct.
 */
export interface CryptographicIdentity {
  /**
   * SHA-256 fingerprint of the public key.
   */
  fingerprint: string;

  /**
   * Noise static public key (hex-encoded).
   */
  publicKey: string;

  /**
   * Ed25519 signing public key for verifying public messages (hex-encoded).
   */
  signingPublicKey?: string;

  /**
   * Unix timestamp when this identity was first seen.
   */
  firstSeen: number;

  /**
   * Unix timestamp of the last successful handshake.
   */
  lastHandshake?: number;
}

/**
 * Social identity of a peer.
 * Local-only data for managing relationships.
 * Matches native BitChat's SocialIdentity struct.
 */
export interface SocialIdentity {
  /**
   * Fingerprint reference.
   */
  fingerprint: string;

  /**
   * User's local name for this peer.
   */
  localPetname?: string;

  /**
   * What the peer calls themselves.
   */
  claimedNickname: string;

  /**
   * Trust level assigned by user.
   */
  trustLevel: TrustLevel;

  /**
   * Whether this peer is a favorite.
   */
  isFavorite: boolean;

  /**
   * Whether this peer is blocked.
   */
  isBlocked: boolean;

  /**
   * Private notes about the peer.
   */
  notes?: string;
}

/**
 * Peer connection event for tracking connection changes.
 */
export interface PeerConnectionEvent {
  /**
   * Peer fingerprint.
   */
  fingerprint: string;

  /**
   * Event type.
   */
  event: 'connected' | 'disconnected' | 'statusChanged';

  /**
   * New connection state.
   */
  connectionState: PeerConnectionState;

  /**
   * Unix timestamp of the event.
   */
  timestamp: number;

  /**
   * Transport used for connection.
   */
  transport?: 'nostr' | 'webrtc' | 'bluetooth';
}

/**
 * Peer list item for display in UI.
 */
export interface PeerListItem {
  /**
   * Peer fingerprint.
   */
  fingerprint: string;

  /**
   * Display name (local nickname or claimed nickname).
   */
  displayName: string;

  /**
   * Current status.
   */
  status: PeerStatus;

  /**
   * Whether this peer is a favorite.
   */
  isFavorite: boolean;

  /**
   * Whether this peer is a mutual favorite.
   */
  isMutual: boolean;

  /**
   * Trust level.
   */
  trustLevel: TrustLevel;

  /**
   * Avatar URL.
   */
  avatar?: string;

  /**
   * Last seen timestamp.
   */
  lastSeenAt: number;

  /**
   * Connection state indicator.
   */
  connectionState: PeerConnectionState;
}

/**
 * Input for creating or updating a peer.
 */
export interface PeerInput {
  /**
   * Public key (hex-encoded).
   */
  publicKey: string;

  /**
   * Peer's nickname.
   */
  nickname: string;

  /**
   * Discovery source.
   */
  source?: PeerSource;

  /**
   * Noise public key (hex-encoded).
   */
  noisePublicKey?: string;

  /**
   * NIP-05 identifier.
   */
  nip05?: string;
}

/**
 * Peer update payload.
 */
export interface PeerUpdate {
  /**
   * Local nickname to set.
   */
  localNickname?: string;

  /**
   * Trust level to set.
   */
  trustLevel?: TrustLevel;

  /**
   * Blocked status.
   */
  isBlocked?: boolean;

  /**
   * Notes to set.
   */
  notes?: string;

  /**
   * Favorite status.
   */
  isFavorite?: boolean;
}

/**
 * Identity cache for storing peer relationships.
 * Matches native BitChat's IdentityCache struct.
 */
export interface IdentityCache {
  /**
   * Fingerprint -> Social identity mapping.
   */
  socialIdentities: Record<string, SocialIdentity>;

  /**
   * Nickname -> Fingerprints reverse index.
   * Multiple peers can claim the same nickname.
   */
  nicknameIndex: Record<string, string[]>;

  /**
   * Set of verified fingerprints.
   */
  verifiedFingerprints: string[];

  /**
   * Last interaction timestamps by fingerprint.
   */
  lastInteractions: Record<string, number>;

  /**
   * Blocked Nostr pubkeys (lowercase hex).
   */
  blockedNostrPubkeys: string[];

  /**
   * Schema version for migrations.
   */
  version: number;
}

/**
 * Get display name for a peer, preferring local nickname.
 */
export function getPeerDisplayName(peer: Peer): string {
  return peer.localNickname || peer.nickname || peer.fingerprint.slice(0, 8);
}

/**
 * Check if a peer is online or recently active.
 */
export function isPeerActive(peer: Peer, thresholdMs: number = 5 * 60 * 1000): boolean {
  if (peer.status === PeerStatus.Online) return true;
  return Date.now() - peer.lastSeenAt < thresholdMs;
}

/**
 * Get status icon for a peer's connection state.
 * Matches native BitChat's statusIcon property.
 */
export function getPeerStatusIcon(peer: Peer): string {
  switch (peer.connectionState) {
    case PeerConnectionState.BluetoothConnected:
      return '📻'; // Radio icon for mesh
    case PeerConnectionState.MeshReachable:
      return '📡'; // Antenna for mesh reachable
    case PeerConnectionState.NostrAvailable:
      return '🌐'; // Globe for Nostr
    case PeerConnectionState.WebRTCConnected:
      return '🔗'; // Link for WebRTC
    case PeerConnectionState.Offline:
    default:
      if (peer.favoriteStatus?.theyFavoritedUs && !peer.favoriteStatus?.isFavorite) {
        return '🌙'; // Crescent moon - they favorited us but we didn't reciprocate
      }
      return '';
  }
}
