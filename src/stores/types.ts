/**
 * Type definitions for BitChat In Browser state management
 */

// ============================================================================
// Message Types
// ============================================================================

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export type MessageType = 'text' | 'system' | 'action' | 'voice' | 'image';

export interface Message {
  /** Unique message identifier (Nostr event ID or local UUID) */
  id: string;
  /** Channel this message belongs to */
  channelId: string;
  /** Sender's public key fingerprint */
  senderFingerprint: string;
  /** Sender's display name at time of sending */
  senderNickname: string;
  /** Message content */
  content: string;
  /** Timestamp when message was created */
  timestamp: number;
  /** Message type */
  type: MessageType;
  /** Current message status */
  status: MessageStatus;
  /** Whether this message is from the local user */
  isOwn: boolean;
  /** Nostr event ID (if synced to relays) */
  nostrEventId?: string;
  /** Whether message has been read */
  isRead: boolean;
  /** Mentioned user fingerprints */
  mentions?: string[];
  /** Voice note ID (for voice messages stored in IndexedDB) */
  voiceNoteId?: string;
  /** Voice message duration in seconds */
  voiceDuration?: number;
  /** Voice message waveform data for visualization */
  voiceWaveform?: number[];
  /** Image message ID (for images stored in IndexedDB) */
  imageId?: string;
  /** Image thumbnail (base64 blurred preview) */
  imageThumbnail?: string;
  /** Image width in pixels */
  imageWidth?: number;
  /** Image height in pixels */
  imageHeight?: number;
  /** Image MIME type */
  imageMimeType?: string;
}

// ============================================================================
// Channel Types
// ============================================================================

export type ChannelType = 'location' | 'public' | 'dm';

export interface Channel {
  /** Unique channel identifier */
  id: string;
  /** Channel name (e.g., "Downtown SF", "Global", or DM recipient) */
  name: string;
  /** Channel type */
  type: ChannelType;
  /** Geohash for location channels */
  geohash?: string;
  /** Precision level for location channels (1-12) */
  geohashPrecision?: number;
  /** Last message timestamp for sorting */
  lastMessageAt: number;
  /** Number of unread messages */
  unreadCount: number;
  /** Whether this channel is pinned */
  isPinned: boolean;
  /** Whether this channel is muted */
  isMuted: boolean;
  /** For DM channels: the other party's fingerprint */
  dmPeerFingerprint?: string;
  /** Channel description */
  description?: string;
  /** Timestamp when channel was created/joined */
  createdAt: number;
}

// ============================================================================
// Peer Types
// ============================================================================

export type PeerStatus = 'online' | 'offline' | 'away';

export type PeerSource = 'nostr' | 'webrtc' | 'local';

export interface Peer {
  /** Public key fingerprint (derived from public key) */
  fingerprint: string;
  /** Nostr public key (hex) */
  publicKey: string;
  /** Display nickname */
  nickname: string;
  /** Current online status */
  status: PeerStatus;
  /** Last time peer was seen active */
  lastSeenAt: number;
  /** How we discovered this peer */
  source: PeerSource;
  /** Whether this peer is trusted/verified */
  isTrusted: boolean;
  /** Whether this peer is blocked */
  isBlocked: boolean;
  /** User-set notes about this peer */
  notes?: string;
  /** Avatar URL or data URI */
  avatar?: string;
  /** NIP-05 identifier if verified */
  nip05?: string;
}

// ============================================================================
// Settings Types
// ============================================================================

export type Theme = 'dark' | 'light' | 'system';

export type NotificationLevel = 'all' | 'mentions' | 'none';

export interface Settings {
  /** User's display nickname */
  nickname: string;
  /** UI theme preference */
  theme: Theme;
  /** Notification preference */
  notifications: NotificationLevel;
  /** Whether to show message timestamps */
  showTimestamps: boolean;
  /** Whether to show message status indicators */
  showMessageStatus: boolean;
  /** Whether to enable sound notifications */
  soundEnabled: boolean;
  /** Whether to auto-join location channel on startup */
  autoJoinLocation: boolean;
  /** Preferred geohash precision for location channels */
  locationPrecision: number;
  /** Whether compact mode is enabled */
  compactMode: boolean;
  /** Font size preference */
  fontSize: 'small' | 'medium' | 'large';
  /** Whether developer mode is enabled */
  devMode: boolean;
  /** Whether onboarding has been completed */
  onboardingComplete: boolean;
  /** Whether to auto-reveal images without tapping */
  autoRevealImages: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  nickname: '',
  theme: 'dark',
  notifications: 'all',
  showTimestamps: true,
  showMessageStatus: true,
  soundEnabled: true,
  autoJoinLocation: true,
  locationPrecision: 6,
  compactMode: false,
  fontSize: 'medium',
  devMode: false,
  onboardingComplete: false,
  autoRevealImages: false,
};

// ============================================================================
// Identity Types
// ============================================================================

export interface Identity {
  /** Nostr public key (hex) */
  publicKey: string;
  /** Public key fingerprint for display */
  fingerprint: string;
  /** Whether the private key is loaded in memory */
  isKeyLoaded: boolean;
  /** Nostr public key in npub format */
  npub?: string;
  /** NIP-05 identifier if set */
  nip05?: string;
  /** Timestamp when identity was created */
  createdAt: number;
}

// ============================================================================
// App State Types
// ============================================================================

export type ViewType = 'channels' | 'messages' | 'peers' | 'settings' | 'onboarding';

export interface AppState {
  /** Whether the app has network connectivity */
  isOnline: boolean;
  /** Whether the app has finished initializing */
  isInitialized: boolean;
  /** Current view/screen */
  currentView: ViewType;
  /** Global error message */
  error: string | null;
  /** Whether the app is in background */
  isBackground: boolean;
  /** App version */
  version: string;
}

// ============================================================================
// Store Action Types
// ============================================================================

export interface AppActions {
  setOnline: (isOnline: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
  setView: (view: ViewType) => void;
  setError: (error: string | null) => void;
  setBackground: (isBackground: boolean) => void;
  reset: () => void;
}

export interface MessagesActions {
  addMessage: (message: Message) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  updateMessageStatus: (channelId: string, messageId: string, status: MessageStatus) => void;
  markAsRead: (channelId: string, messageId: string) => void;
  markAllAsRead: (channelId: string) => void;
  clearChannel: (channelId: string) => void;
  clearAll: () => void;
}

export interface ChannelsActions {
  addChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
  setActiveChannel: (channelId: string) => void;
  updateChannel: (channelId: string, updates: Partial<Channel>) => void;
  incrementUnread: (channelId: string) => void;
  clearUnread: (channelId: string) => void;
  pinChannel: (channelId: string, isPinned: boolean) => void;
  muteChannel: (channelId: string, isMuted: boolean) => void;
}

export interface PeersActions {
  addPeer: (peer: Peer) => void;
  updatePeer: (fingerprint: string, updates: Partial<Peer>) => void;
  removePeer: (fingerprint: string) => void;
  setTrusted: (fingerprint: string, isTrusted: boolean) => void;
  setBlocked: (fingerprint: string, isBlocked: boolean) => void;
  updateStatus: (fingerprint: string, status: PeerStatus) => void;
  clearAll: () => void;
}

export interface SettingsActions {
  updateSettings: (updates: Partial<Settings>) => void;
  setNickname: (nickname: string) => void;
  setTheme: (theme: Theme) => void;
  setNotifications: (level: NotificationLevel) => void;
  resetSettings: () => void;
}

export interface IdentityActions {
  setIdentity: (identity: Omit<Identity, 'isKeyLoaded'> & { isKeyLoaded?: boolean }) => void;
  setKeyLoaded: (isLoaded: boolean) => void;
  clearIdentity: () => void;
}
