/**
 * BitChat In Browser - Main Application Component
 *
 * Root component of the PWA providing:
 * - Error boundary for graceful error handling
 * - App initialization with loading states
 * - Hash-based routing for IPFS compatibility
 * - Auth guards (redirect to onboarding if no identity)
 * - App shell with layout components
 * - Service integration (Nostr, WebRTC, Storage)
 *
 * @module App
 */

import { Component, type FunctionComponent, type ComponentChildren } from 'preact';
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import { Route } from 'preact-router';
import {
  Shell,
  LoadingShell,
  ErrorShell,
} from './components/layout';
import {
  useHasIdentity,
  useSettingsStore,
  useChannelsStore,
} from './stores';
import { OnboardingPage, ChannelsPage, PeersPage, SettingsPage } from './pages';
import { ChatView } from './components/chat';
import { PeerProfile } from './components/peers';
import { DownloadPage } from './components/download';
import { ReceiveApp } from './components/sharing';
import { useApp } from './hooks/useApp';
import { useNavigation, useCurrentRoute } from './hooks/useNavigation';
import { AnnouncerProvider, StandaloneAnnouncer } from './components/a11y/Announcer';
import {
  AppRouter,
  ROUTES,
  navigate,
  goBack,
  type RouteComponentProps,
} from './router';
import { AuthGuard, OnboardingGuard } from './router/guards';
import type { Peer } from './stores/types';

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: ComponentChildren;
  onError?: (error: Error) => void;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static override getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    console.error('[App] Error caught by boundary:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      return (
        <ErrorShell
          error={this.state.error?.message || 'An unexpected error occurred'}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Route Components
// ============================================================================

/** Channels list view */
const ChannelsRoute: FunctionComponent<RouteComponentProps> = () => {
  const { toChannel, toPeers } = useNavigation();
  const setActiveChannel = useChannelsStore((state) => state.setActiveChannel);

  const handleNavigateToChannel = useCallback(
    (channelId: string) => {
      setActiveChannel(channelId);
      toChannel(channelId);
    },
    [setActiveChannel, toChannel]
  );

  return (
    <AuthGuard redirectTo={ROUTES.ONBOARDING}>
      <ChannelsPage
        onNavigateToChannel={handleNavigateToChannel}
        onStartDM={toPeers}
      />
    </AuthGuard>
  );
};

/** Channel chat view */
interface ChannelDetailRouteProps extends RouteComponentProps {
  id?: string;
}

const ChannelDetailRoute: FunctionComponent<ChannelDetailRouteProps> = ({ id }) => {
  const setActiveChannel = useChannelsStore((state) => state.setActiveChannel);

  // Set active channel when route param changes
  useEffect(() => {
    if (id) {
      setActiveChannel(decodeURIComponent(id));
    }
  }, [id, setActiveChannel]);

  const handleBack = useCallback(() => {
    goBack();
  }, []);

  if (!id) {
    return (
      <div class="flex-1 flex items-center justify-center p-4">
        <div class="text-center">
          <div class="text-4xl mb-4 text-terminal-green/30">&gt;_</div>
          <h2 class="text-lg font-bold mb-2">No channel selected</h2>
          <p class="text-sm text-terminal-green/70">
            Select a channel to start messaging.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard redirectTo={ROUTES.ONBOARDING}>
      <ChatView
        channelId={decodeURIComponent(id)}
        showBack
        onBack={handleBack}
      />
    </AuthGuard>
  );
};

/** Direct messages list view */
const MessagesRoute: FunctionComponent<RouteComponentProps> = () => {
  const { toChannels } = useNavigation();

  // For now, redirect to channels - DMs are in channels list
  useEffect(() => {
    toChannels();
  }, [toChannels]);

  return null;
};

/** DM chat view */
interface MessageDetailRouteProps extends RouteComponentProps {
  pubkey?: string;
}

const MessageDetailRoute: FunctionComponent<MessageDetailRouteProps> = ({ pubkey }) => {
  const setActiveChannel = useChannelsStore((state) => state.setActiveChannel);
  const addChannel = useChannelsStore((state) => state.addChannel);

  // Create/set DM channel when route param changes
  useEffect(() => {
    if (pubkey) {
      const decodedPubkey = decodeURIComponent(pubkey);
      const channelId = `dm-${decodedPubkey}`;

      // Ensure the DM channel exists
      addChannel({
        id: channelId,
        name: decodedPubkey.slice(0, 8),
        type: 'dm',
        dmPeerFingerprint: decodedPubkey,
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      });

      setActiveChannel(channelId);
    }
  }, [pubkey, setActiveChannel, addChannel]);

  const handleBack = useCallback(() => {
    goBack();
  }, []);

  if (!pubkey) {
    return (
      <div class="flex-1 flex items-center justify-center p-4">
        <div class="text-center">
          <div class="text-4xl mb-4 text-terminal-green/30">&gt;_</div>
          <h2 class="text-lg font-bold mb-2">No conversation selected</h2>
          <p class="text-sm text-terminal-green/70">
            Select a peer to start a conversation.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard redirectTo={ROUTES.ONBOARDING}>
      <ChatView
        channelId={`dm-${decodeURIComponent(pubkey)}`}
        showBack
        onBack={handleBack}
      />
    </AuthGuard>
  );
};

/** Peers list view */
const PeersRoute: FunctionComponent<RouteComponentProps> = () => {
  const { toMessage, toChannels } = useNavigation();
  const setActiveChannel = useChannelsStore((state) => state.setActiveChannel);
  const addChannel = useChannelsStore((state) => state.addChannel);

  const handleMessagePeer = useCallback(
    (peer: Peer) => {
      // Find or create DM channel with this peer
      const channelId = `dm-${peer.fingerprint}`;
      addChannel({
        id: channelId,
        name: peer.nickname || peer.fingerprint.slice(0, 8),
        type: 'dm',
        dmPeerFingerprint: peer.fingerprint,
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      });

      setActiveChannel(channelId);
      toMessage(peer.publicKey);
    },
    [addChannel, setActiveChannel, toMessage]
  );

  return (
    <AuthGuard redirectTo={ROUTES.ONBOARDING}>
      <PeersPage
        onMessagePeer={handleMessagePeer}
        onBack={toChannels}
      />
    </AuthGuard>
  );
};

/** Peer profile view */
interface PeerDetailRouteProps extends RouteComponentProps {
  fingerprint?: string;
}

const PeerDetailRoute: FunctionComponent<PeerDetailRouteProps> = ({ fingerprint }) => {
  const { toMessage, toPeers } = useNavigation();
  const setActiveChannel = useChannelsStore((state) => state.setActiveChannel);
  const addChannel = useChannelsStore((state) => state.addChannel);

  const handleMessage = useCallback(
    (peer: Peer) => {
      const channelId = `dm-${peer.fingerprint}`;
      addChannel({
        id: channelId,
        name: peer.nickname || peer.fingerprint.slice(0, 8),
        type: 'dm',
        dmPeerFingerprint: peer.fingerprint,
        lastMessageAt: Date.now(),
        unreadCount: 0,
        isPinned: false,
        isMuted: false,
        createdAt: Date.now(),
      });
      setActiveChannel(channelId);
      toMessage(peer.publicKey);
    },
    [addChannel, setActiveChannel, toMessage]
  );

  if (!fingerprint) {
    return (
      <div class="flex-1 flex items-center justify-center p-4">
        <div class="text-center">
          <div class="text-4xl mb-4 text-terminal-green/30">[?]</div>
          <h2 class="text-lg font-bold mb-2">No peer selected</h2>
          <p class="text-sm text-terminal-green/70">
            Select a peer to view their profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard redirectTo={ROUTES.ONBOARDING}>
      <PeerProfile
        fingerprint={decodeURIComponent(fingerprint)}
        onBack={toPeers}
        onMessage={handleMessage}
      />
    </AuthGuard>
  );
};

/** Settings view */
interface SettingsRouteProps extends RouteComponentProps {
  section?: string;
}

const SettingsRoute: FunctionComponent<SettingsRouteProps> = () => {
  const handleBack = useCallback(() => {
    goBack();
  }, []);

  return (
    <AuthGuard redirectTo={ROUTES.ONBOARDING}>
      <SettingsPage onBack={handleBack} />
    </AuthGuard>
  );
};

/** Onboarding view */
const OnboardingRoute: FunctionComponent<RouteComponentProps> = () => {
  const { toChannels } = useNavigation();
  const { actions } = useApp();

  const handleComplete = useCallback(() => {
    toChannels();
    // Re-initialize to load the new identity
    actions.initialize().catch((error) => {
      console.error('[App] Re-initialization failed:', error);
    });
  }, [toChannels, actions]);

  return (
    <OnboardingGuard redirectTo={ROUTES.CHANNELS}>
      <OnboardingPage onComplete={handleComplete} />
    </OnboardingGuard>
  );
};

/** Download page view */
const DownloadRoute: FunctionComponent<RouteComponentProps> = () => {
  const handleBack = useCallback(() => {
    goBack();
  }, []);

  return <DownloadPage onBack={handleBack} showBackButton />;
};

/** P2P Share page view */
const ShareRoute: FunctionComponent<RouteComponentProps> = () => {
  const { toChannels } = useNavigation();

  return (
    <ReceiveApp
      onInstallComplete={toChannels}
      onSkip={toChannels}
      fullPage
    />
  );
};

/** Home redirect (redirects to channels) */
const HomeRoute: FunctionComponent<RouteComponentProps> = () => {
  const hasIdentity = useHasIdentity();
  const settings = useSettingsStore((s) => s.settings);
  const { toChannels, toOnboarding } = useNavigation();

  useEffect(() => {
    if (!hasIdentity || !settings.onboardingComplete) {
      toOnboarding();
    } else {
      toChannels();
    }
  }, [hasIdentity, settings.onboardingComplete, toChannels, toOnboarding]);

  return null;
};

// ============================================================================
// Main App Content
// ============================================================================

const AppContent: FunctionComponent = () => {
  // App hooks
  const { init, connection, actions } = useApp();
  const hasIdentity = useHasIdentity();
  const settings = useSettingsStore((s) => s.settings);
  const currentRoute = useCurrentRoute();

  // Track if we need onboarding
  const needsOnboarding = !hasIdentity || !settings.onboardingComplete;

  // Sync status state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | undefined>(undefined);

  // Listen for init progress
  useEffect(() => {
    if (init.started && !init.complete) {
      setIsSyncing(true);
      setSyncProgress(init.progress);
    } else {
      setIsSyncing(false);
      setSyncProgress(undefined);
    }
  }, [init.started, init.complete, init.progress]);

  // Initialize app on mount
  useEffect(() => {
    if (!init.started && !init.complete) {
      actions.initialize().catch((error) => {
        console.error('[App] Initialization failed:', error);
      });
    }
  }, [init.started, init.complete, actions]);

  // Redirect to onboarding if needed, after init
  useEffect(() => {
    if (
      init.complete &&
      needsOnboarding &&
      currentRoute.name !== 'onboarding' &&
      currentRoute.name !== 'download' &&
      currentRoute.name !== 'share'
    ) {
      navigate(ROUTES.ONBOARDING, true);
    }
  }, [init.complete, needsOnboarding, currentRoute.name]);

  // Emergency wipe handler
  const handleEmergencyWipe = useCallback(async () => {
    await actions.wipeAll();
  }, [actions]);

  // Unread counts (from stores)
  const unreadCounts = useMemo(
    () => ({
      channels: 0,
      messages: 0,
      peers: 0,
    }),
    []
  );

  // Show loading during initialization
  if (!init.complete && init.started) {
    return (
      <LoadingShell
        message={init.message || 'Initializing BitChat...'}
      />
    );
  }

  // Show error if init failed
  if (init.failed && init.error) {
    return (
      <ErrorShell
        error={init.error.message}
        onRetry={() => {
          actions.initialize().catch(console.error);
        }}
      />
    );
  }

  // Determine if we should show shell
  const showShell = currentRoute.name !== 'onboarding' &&
    currentRoute.name !== 'download' &&
    currentRoute.name !== 'share';
  const showHeader = showShell && !currentRoute.isDetail;

  // Main app with router
  return (
    <>
      {showShell ? (
        <Shell
          showHeader={showHeader}
          showNavigation
          showStatusBar
          syncProgress={syncProgress}
          relayCount={connection.relayCount}
          webrtcPeerCount={connection.webrtcPeerCount}
          isSyncing={isSyncing}
          unreadCounts={unreadCounts}
          onEmergencyWipe={handleEmergencyWipe}
        >
          <div data-scroll-container class="flex-1 overflow-y-auto">
            <AppRouter>
              <Route path={ROUTES.HOME} component={HomeRoute} />
              <Route path={ROUTES.ONBOARDING} component={OnboardingRoute} />
              <Route path={ROUTES.CHANNELS} component={ChannelsRoute} />
              <Route path={ROUTES.CHANNEL_DETAIL} component={ChannelDetailRoute} />
              <Route path={ROUTES.MESSAGES} component={MessagesRoute} />
              <Route path={ROUTES.MESSAGE_DETAIL} component={MessageDetailRoute} />
              <Route path={ROUTES.PEERS} component={PeersRoute} />
              <Route path={ROUTES.PEER_DETAIL} component={PeerDetailRoute} />
              <Route path={ROUTES.SETTINGS} component={SettingsRoute} />
              <Route path={ROUTES.SETTINGS_SECTION} component={SettingsRoute} />
              <Route path={ROUTES.DOWNLOAD} component={DownloadRoute} />
              <Route path={ROUTES.SHARE} component={ShareRoute} />
            </AppRouter>
          </div>
        </Shell>
      ) : (
        <div data-scroll-container class="min-h-screen">
          <AppRouter>
            <Route path={ROUTES.HOME} component={HomeRoute} />
            <Route path={ROUTES.ONBOARDING} component={OnboardingRoute} />
            <Route path={ROUTES.CHANNELS} component={ChannelsRoute} />
            <Route path={ROUTES.CHANNEL_DETAIL} component={ChannelDetailRoute} />
            <Route path={ROUTES.MESSAGES} component={MessagesRoute} />
            <Route path={ROUTES.MESSAGE_DETAIL} component={MessageDetailRoute} />
            <Route path={ROUTES.PEERS} component={PeersRoute} />
            <Route path={ROUTES.PEER_DETAIL} component={PeerDetailRoute} />
            <Route path={ROUTES.SETTINGS} component={SettingsRoute} />
            <Route path={ROUTES.SETTINGS_SECTION} component={SettingsRoute} />
            <Route path={ROUTES.DOWNLOAD} component={DownloadRoute} />
            <Route path={ROUTES.SHARE} component={ShareRoute} />
          </AppRouter>
        </div>
      )}

      {/* Accessibility announcer */}
      <StandaloneAnnouncer />
    </>
  );
};

// ============================================================================
// App Component
// ============================================================================

export const App: FunctionComponent = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Brief initial load to ensure DOM is ready
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return <LoadingShell message="Starting BitChat..." />;
  }

  return (
    <ErrorBoundary
      onError={(error) => {
        console.error('[App] Uncaught error:', error);
      }}
    >
      <AnnouncerProvider>
        <AppContent />
      </AnnouncerProvider>
    </ErrorBoundary>
  );
};

export default App;
