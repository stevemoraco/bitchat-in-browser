/**
 * Peers Components - Public exports
 *
 * All peer management UI components for BitChat In Browser PWA.
 */

// Main components
export { PeersList } from './PeersList';
export { PeerItem, VisualFingerprint, formatLastSeen, generateVisualFingerprint } from './PeerItem';
export { PeerProfile, FingerprintGrid, TrustLevelSelector } from './PeerProfile';
export { AddPeer } from './AddPeer';
export { VerifyPeer, QRCodeDisplay, FingerprintComparison } from './VerifyPeer';

// Types
export type { PeersListProps, FilterMode } from './PeersList';
export type { PeerItemProps } from './PeerItem';
export type { PeerProfileProps } from './PeerProfile';
export type { AddPeerProps } from './AddPeer';
export type { VerifyPeerProps } from './VerifyPeer';
