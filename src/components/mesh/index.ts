/**
 * Mesh Components - Barrel Export
 *
 * Export all mesh-related components for easy importing:
 * import { QRCodeDisplay, QRScanner, JoinMeshModal, MeshStatusIndicator, MeshDebugPanel, PeerListItem } from '@/components/mesh';
 */

// QR code display
export { QRCodeDisplay } from './QRCodeDisplay';
export type { QRCodeDisplayProps } from './QRCodeDisplay';

// QR scanner
export { QRScanner } from './QRScanner';
export type { QRScannerProps } from './QRScanner';

// Join mesh modal
export { JoinMeshModal } from './JoinMeshModal';
export type { JoinMeshModalProps } from './JoinMeshModal';

// Mesh status indicator (for header)
export { MeshStatusIndicator } from './MeshStatusIndicator';

// Mesh debug panel (full sheet)
export { MeshDebugPanel } from './MeshDebugPanel';
export type { MeshDebugPanelProps } from './MeshDebugPanel';

// Peer list item
export { PeerListItem } from './PeerListItem';
export type { PeerListItemProps } from './PeerListItem';
