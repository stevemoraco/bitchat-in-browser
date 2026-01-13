/**
 * Channel Type Definitions
 *
 * Core types for chat channels in BitChat PWA.
 * Channels represent different conversation contexts: location-based,
 * direct messages, and group chats.
 *
 * @module types/channel
 */

/**
 * Channel type enumeration.
 * Determines the behavior and display of the channel.
 */
export enum ChannelType {
  /** Location-based channel using geohash */
  Location = 'location',
  /** Direct message channel between two peers */
  Direct = 'direct',
  /** Group channel (future feature) */
  Group = 'group',
  /** Local BLE mesh channel */
  Mesh = 'mesh',
}

/**
 * Geohash channel precision levels.
 * Maps to different geographic scales for location channels.
 * Matches native BitChat's GeohashChannelLevel enum.
 */
export enum GeohashPrecision {
  /** Building level (~20m) - precision 8 */
  Building = 8,
  /** Block level (~150m) - precision 7 */
  Block = 7,
  /** Neighborhood level (~1.2km) - precision 6 */
  Neighborhood = 6,
  /** City level (~5km) - precision 5 */
  City = 5,
  /** Province level (~40km) - precision 4 */
  Province = 4,
  /** Region level (~600km) - precision 2 */
  Region = 2,
}

/**
 * Human-readable names for geohash precision levels.
 */
export const GEOHASH_PRECISION_NAMES: Record<GeohashPrecision, string> = {
  [GeohashPrecision.Building]: 'Building',
  [GeohashPrecision.Block]: 'Block',
  [GeohashPrecision.Neighborhood]: 'Neighborhood',
  [GeohashPrecision.City]: 'City',
  [GeohashPrecision.Province]: 'Province',
  [GeohashPrecision.Region]: 'Region',
};

/**
 * Base channel interface with common properties.
 */
export interface Channel {
  /**
   * Unique channel identifier.
   * For location channels: geohash string.
   * For DM channels: combined fingerprint hash.
   * For mesh: "mesh".
   */
  id: string;

  /**
   * Display name of the channel.
   * For location channels: area name or geohash.
   * For DM channels: peer's nickname.
   */
  name: string;

  /**
   * Channel type classification.
   */
  type: ChannelType;

  /**
   * Optional channel description or subtitle.
   */
  description?: string;

  /**
   * Unix timestamp of the last message in this channel.
   * Used for sorting channels by recency.
   */
  lastMessageAt: number;

  /**
   * Number of unread messages in this channel.
   */
  unreadCount: number;

  /**
   * Whether this channel is pinned to the top.
   */
  isPinned: boolean;

  /**
   * Whether notifications are muted for this channel.
   */
  isMuted: boolean;

  /**
   * Unix timestamp when the channel was created or joined.
   */
  createdAt: number;

  /**
   * Last activity timestamp (message sent or received).
   */
  lastActivityAt?: number;
}

/**
 * Location-based channel using geohash.
 * Extends the base Channel interface with location-specific properties.
 * Matches native BitChat's GeohashChannel structure.
 */
export interface LocationChannel extends Channel {
  type: ChannelType.Location;

  /**
   * Geohash string identifying the location.
   * Length determines the precision (1-12 characters).
   */
  geohash: string;

  /**
   * Precision level of the geohash.
   */
  precision: GeohashPrecision;

  /**
   * Human-readable location name if reverse geocoded.
   */
  locationName?: string;

  /**
   * Latitude of the channel's center point.
   */
  latitude?: number;

  /**
   * Longitude of the channel's center point.
   */
  longitude?: number;

  /**
   * Number of active participants in the last hour.
   */
  activeParticipants?: number;

  /**
   * Whether this is the user's current location channel.
   */
  isCurrent?: boolean;
}

/**
 * Direct message channel between two peers.
 * Extends the base Channel interface with DM-specific properties.
 */
export interface DirectChannel extends Channel {
  type: ChannelType.Direct;

  /**
   * Fingerprint of the other participant.
   */
  peerFingerprint: string;

  /**
   * Public key of the other participant (hex-encoded).
   */
  peerPublicKey: string;

  /**
   * Whether the peer is currently online.
   */
  isPeerOnline?: boolean;

  /**
   * Peer's last seen timestamp.
   */
  peerLastSeen?: number;

  /**
   * Whether this is a mutual favorite connection.
   */
  isMutualFavorite?: boolean;

  /**
   * Whether end-to-end encryption is established.
   */
  isEncrypted: boolean;
}

/**
 * Group channel for multi-party conversations.
 * Future feature - placeholder for extensibility.
 */
export interface GroupChannel extends Channel {
  type: ChannelType.Group;

  /**
   * Array of participant fingerprints.
   */
  memberFingerprints: string[];

  /**
   * Fingerprint of the channel creator/admin.
   */
  adminFingerprint: string;

  /**
   * Maximum number of members allowed.
   */
  maxMembers?: number;

  /**
   * Whether the channel is invite-only.
   */
  isPrivate: boolean;

  /**
   * Invite code for joining (if applicable).
   */
  inviteCode?: string;
}

/**
 * Mesh channel for local BLE communication.
 * Represents the local peer-to-peer mesh network.
 */
export interface MeshChannel extends Channel {
  type: ChannelType.Mesh;

  /**
   * Number of connected peers in the mesh.
   */
  connectedPeers: number;

  /**
   * Number of reachable peers (multi-hop).
   */
  reachablePeers: number;

  /**
   * Whether BLE is currently active.
   */
  isBleActive: boolean;
}

/**
 * Union type for all channel types.
 */
export type AnyChannel = LocationChannel | DirectChannel | GroupChannel | MeshChannel;

/**
 * Channel identifier type matching native BitChat's ChannelID.
 */
export type ChannelId =
  | { type: 'mesh' }
  | { type: 'location'; geohash: string; precision: GeohashPrecision }
  | { type: 'direct'; fingerprint: string }
  | { type: 'group'; groupId: string };

/**
 * Channel creation input for location channels.
 */
export interface CreateLocationChannelInput {
  type: ChannelType.Location;
  geohash: string;
  precision: GeohashPrecision;
  name?: string;
}

/**
 * Channel creation input for direct channels.
 */
export interface CreateDirectChannelInput {
  type: ChannelType.Direct;
  peerFingerprint: string;
  peerPublicKey: string;
  peerNickname?: string;
}

/**
 * Union type for channel creation inputs.
 */
export type CreateChannelInput = CreateLocationChannelInput | CreateDirectChannelInput;

/**
 * Channel list item for display in UI.
 */
export interface ChannelListItem {
  /**
   * Channel ID.
   */
  id: string;

  /**
   * Display name.
   */
  name: string;

  /**
   * Channel type.
   */
  type: ChannelType;

  /**
   * Preview of the last message.
   */
  lastMessagePreview?: string;

  /**
   * Timestamp of the last message.
   */
  lastMessageAt: number;

  /**
   * Unread message count.
   */
  unreadCount: number;

  /**
   * Whether the channel is pinned.
   */
  isPinned: boolean;

  /**
   * Whether the channel is muted.
   */
  isMuted: boolean;

  /**
   * Avatar URL or identifier.
   */
  avatar?: string;

  /**
   * Online status indicator (for DM channels).
   */
  isOnline?: boolean;
}

/**
 * Geohash channel option for location picker.
 * Matches native BitChat's GeohashChannel structure.
 */
export interface GeohashChannelOption {
  /**
   * Precision level.
   */
  level: GeohashPrecision;

  /**
   * Geohash string.
   */
  geohash: string;

  /**
   * Display name combining level and geohash.
   */
  displayName: string;

  /**
   * Unique identifier.
   */
  id: string;
}

/**
 * Helper function to create a geohash channel option.
 */
export function createGeohashChannelOption(
  level: GeohashPrecision,
  geohash: string
): GeohashChannelOption {
  const levelName = GEOHASH_PRECISION_NAMES[level];
  return {
    level,
    geohash,
    displayName: `${levelName} - ${geohash}`,
    id: `${level}-${geohash}`,
  };
}

/**
 * Generate channel ID from a ChannelId object.
 */
export function channelIdToString(channelId: ChannelId): string {
  switch (channelId.type) {
    case 'mesh':
      return 'mesh';
    case 'location':
      return `location:${channelId.geohash}`;
    case 'direct':
      return `dm:${channelId.fingerprint}`;
    case 'group':
      return `group:${channelId.groupId}`;
  }
}

/**
 * Parse a channel ID string back to a ChannelId object.
 */
export function parseChannelId(id: string): ChannelId | null {
  if (id === 'mesh') {
    return { type: 'mesh' };
  }

  const [prefix, value] = id.split(':');
  if (!value) return null;

  switch (prefix) {
    case 'location':
      // Infer precision from geohash length
      const precision = value.length as GeohashPrecision;
      return { type: 'location', geohash: value, precision };
    case 'dm':
      return { type: 'direct', fingerprint: value };
    case 'group':
      return { type: 'group', groupId: value };
    default:
      return null;
  }
}
