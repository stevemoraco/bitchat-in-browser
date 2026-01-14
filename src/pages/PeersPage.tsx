/**
 * PeersPage - Main peers management page
 *
 * Page wrapper that handles routing between:
 * - Peers list view
 * - Peer profile view
 * - Add peer view
 * - Verify peer view
 */

import type { FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import type { Peer } from '../stores/types';

// Import peer components
import { PeersList } from '../components/peers/PeersList';
import { PeerProfile } from '../components/peers/PeerProfile';
import { AddPeer } from '../components/peers/AddPeer';
import { VerifyPeer } from '../components/peers/VerifyPeer';

// ============================================================================
// Types
// ============================================================================

type PeersView = 'list' | 'profile' | 'add' | 'verify';

interface PeersPageProps {
  /** Callback when navigating to message a peer */
  onMessagePeer?: (peer: Peer) => void;
  /** Callback when navigating back (e.g., to main app) */
  onBack?: () => void;
  /** Initial peer to show (for deep linking) */
  initialPeerFingerprint?: string;
}

interface ViewState {
  view: PeersView;
  fingerprint?: string;
}

// ============================================================================
// PeersPage Component
// ============================================================================

export const PeersPage: FunctionComponent<PeersPageProps> = ({
  onMessagePeer,
  onBack,
  initialPeerFingerprint,
}) => {
  // View state management
  const [viewState, setViewState] = useState<ViewState>(() => {
    if (initialPeerFingerprint) {
      return { view: 'profile', fingerprint: initialPeerFingerprint };
    }
    return { view: 'list' };
  });

  // Navigation handlers
  const navigateToList = useCallback(() => {
    setViewState({ view: 'list' });
  }, []);

  const navigateToProfile = useCallback((fingerprint: string) => {
    setViewState({ view: 'profile', fingerprint });
  }, []);

  const navigateToAdd = useCallback(() => {
    setViewState({ view: 'add' });
  }, []);

  const navigateToVerify = useCallback((fingerprint: string) => {
    setViewState({ view: 'verify', fingerprint });
  }, []);

  // Event handlers
  const handlePeerSelect = useCallback(
    (peer: Peer) => {
      navigateToProfile(peer.fingerprint);
    },
    [navigateToProfile]
  );

  const handleAddPeer = useCallback(() => {
    navigateToAdd();
  }, [navigateToAdd]);

  const handleAddComplete = useCallback(
    (fingerprint: string) => {
      // Navigate to the newly added peer's profile
      navigateToProfile(fingerprint);
    },
    [navigateToProfile]
  );

  const handleMessage = useCallback(
    (peer: Peer) => {
      if (onMessagePeer) {
        onMessagePeer(peer);
      }
    },
    [onMessagePeer]
  );

  const handleVerify = useCallback(
    (peer: Peer) => {
      navigateToVerify(peer.fingerprint);
    },
    [navigateToVerify]
  );

  const handleVerifyComplete = useCallback(() => {
    // Return to profile after verification
    if (viewState.fingerprint) {
      navigateToProfile(viewState.fingerprint);
    } else {
      navigateToList();
    }
  }, [viewState.fingerprint, navigateToProfile, navigateToList]);

  const handleBack = useCallback(() => {
    switch (viewState.view) {
      case 'profile':
      case 'add':
        navigateToList();
        break;
      case 'verify':
        if (viewState.fingerprint) {
          navigateToProfile(viewState.fingerprint);
        } else {
          navigateToList();
        }
        break;
      case 'list':
      default:
        if (onBack) {
          onBack();
        }
        break;
    }
  }, [viewState, navigateToList, navigateToProfile, onBack]);

  // Render current view
  const renderView = () => {
    switch (viewState.view) {
      case 'profile':
        if (!viewState.fingerprint) {
          return (
            <PeersList
              onPeerSelect={handlePeerSelect}
              onAddPeer={handleAddPeer}
            />
          );
        }
        return (
          <PeerProfile
            fingerprint={viewState.fingerprint}
            onBack={handleBack}
            onMessage={handleMessage}
            onVerify={handleVerify}
          />
        );

      case 'add':
        return (
          <AddPeer
            onComplete={handleAddComplete}
            onCancel={handleBack}
          />
        );

      case 'verify':
        if (!viewState.fingerprint) {
          return (
            <PeersList
              onPeerSelect={handlePeerSelect}
              onAddPeer={handleAddPeer}
            />
          );
        }
        return (
          <VerifyPeer
            fingerprint={viewState.fingerprint}
            onComplete={handleVerifyComplete}
            onCancel={handleBack}
          />
        );

      case 'list':
      default:
        return (
          <PeersList
            onPeerSelect={handlePeerSelect}
            onAddPeer={handleAddPeer}
            selectedFingerprint={viewState.fingerprint}
          />
        );
    }
  };

  return (
    <div class="h-full bg-background">
      {renderView()}
    </div>
  );
};

// ============================================================================
// Standalone Page Wrapper
// ============================================================================

/**
 * StandalonePeersPage - Full-screen peers page with header
 *
 * Use this when PeersPage needs to be rendered as a standalone route
 * with its own header and navigation.
 */
export const StandalonePeersPage: FunctionComponent<{
  onNavigateHome?: () => void;
  onMessagePeer?: (peer: Peer) => void;
}> = ({ onNavigateHome, onMessagePeer }) => (
    <div class="flex flex-col h-screen bg-background">
      {/* App header */}
      <header class="px-4 py-3 border-b border-muted flex items-center gap-3 bg-surface">
        {onNavigateHome && (
          <button
            class="btn-terminal-ghost btn-terminal-sm"
            onClick={onNavigateHome}
            aria-label="Go to home"
          >
            [HOME]
          </button>
        )}
        <h1 class="text-terminal-lg font-bold text-primary">BitChat</h1>
      </header>

      {/* Peers page content */}
      <main class="flex-1 overflow-hidden">
        <PeersPage onMessagePeer={onMessagePeer} onBack={onNavigateHome} />
      </main>
    </div>
  );

// ============================================================================
// Exports
// ============================================================================

export type { PeersPageProps, PeersView };
