/**
 * Shell Component - BitChat In Browser
 *
 * Main app shell providing the overall layout structure:
 * - Header with title and status indicators
 * - Navigation tabs (bottom for mobile, sidebar on desktop)
 * - Main content area
 * - Status bar
 *
 * Responsive design:
 * - Mobile: Bottom navigation, compact status bar
 * - Tablet: Optional sidebar, expanded status
 * - Desktop: Sidebar navigation, three-column layout
 *
 * Safe area support for notch and home indicator.
 */

import type { FunctionComponent, ComponentChildren } from 'preact';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { StatusBar, CompactStatusBar } from './StatusBar';
import { useAppStore } from '../../stores';
import { SkipLinks, SKIP_LINK_TARGETS } from '../a11y/SkipLinks';
import { ariaLabels } from '../../hooks/useA11y';
import {
  useIsMobile,
  useNavigationLayout,
  useIsLandscape,
} from '../../hooks/useMediaQuery';

// ============================================================================
// Types
// ============================================================================

interface ShellProps {
  /** Child content to render in main area */
  children: ComponentChildren;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Whether to show navigation */
  showNavigation?: boolean;
  /** Whether to show status bar */
  showStatusBar?: boolean;
  /** Current sync progress (0-100) */
  syncProgress?: number;
  /** Number of connected relays */
  relayCount?: number;
  /** Number of WebRTC peers */
  webrtcPeerCount?: number;
  /** Whether currently syncing */
  isSyncing?: boolean;
  /** Last sync timestamp */
  lastSyncAt?: number;
  /** Unread counts for navigation badges */
  unreadCounts?: {
    channels?: number;
    messages?: number;
    peers?: number;
  };
  /** Callback for emergency wipe */
  onEmergencyWipe?: () => void;
}

// ============================================================================
// Shell Component
// ============================================================================

export const Shell: FunctionComponent<ShellProps> = ({
  children,
  showHeader = true,
  showNavigation = true,
  showStatusBar = true,
  syncProgress,
  relayCount = 0,
  webrtcPeerCount = 0,
  isSyncing = false,
  lastSyncAt,
  unreadCounts = {},
  onEmergencyWipe,
}) => {
  const currentView = useAppStore((state) => state.currentView);

  // Responsive hooks
  const isMobile = useIsMobile();
  const navigationLayout = useNavigationLayout();
  const isLandscape = useIsLandscape();

  // Hide shell components during onboarding
  const isOnboarding = currentView === 'onboarding';
  const shouldShowHeader = showHeader && !isOnboarding;
  const shouldShowNavigation = showNavigation && !isOnboarding;
  const shouldShowStatusBar = showStatusBar && !isOnboarding;

  // Generate status description for screen readers
  const statusDescription = ariaLabels.connectionStatus(relayCount, webrtcPeerCount);

  // Determine layout classes based on device
  const isSidebarLayout = navigationLayout === 'sidebar';

  // Calculate main content padding
  // pt-12 accounts for the fixed header height (48px)
  const mainContentClasses = `
    main-content flex-1 overflow-y-auto overflow-x-hidden
    ${shouldShowHeader ? 'pt-12' : ''}
    ${shouldShowNavigation && !isSidebarLayout ? 'pb-14' : ''}
    ${isSidebarLayout ? 'main-content-with-sidebar' : ''}
    ${isLandscape && isMobile ? 'landscape-safe-x' : ''}
  `;

  // Container classes for responsive layout
  const containerClasses = `
    app-root min-h-screen min-h-[100dvh] bg-terminal-bg text-terminal-green font-mono
    ${isSidebarLayout ? 'flex flex-row' : 'flex flex-col'}
  `;

  return (
    <div class={containerClasses}>
      {/* Skip links for keyboard navigation - must be first focusable elements */}
      <SkipLinks
        mainContentId={SKIP_LINK_TARGETS.main}
        navigationId={SKIP_LINK_TARGETS.navigation}
        showNavigationLink={shouldShowNavigation}
      />

      {/* Desktop sidebar navigation */}
      {shouldShowNavigation && isSidebarLayout && (
        <Navigation
          id={SKIP_LINK_TARGETS.navigation}
          unreadCounts={unreadCounts}
        />
      )}

      {/* Main content wrapper */}
      <div class={isSidebarLayout ? 'flex-1 flex flex-col min-h-screen min-h-[100dvh]' : 'flex-1 flex flex-col'}>
        {/* Header */}
        {shouldShowHeader && (
          <Header
            onEmergencyWipe={onEmergencyWipe}
          />
        )}

        {/* Main content area */}
        <main
          id={SKIP_LINK_TARGETS.main}
          role="main"
          aria-label="Main content"
          tabIndex={-1}
          class={mainContentClasses}
        >
          {children}
        </main>

        {/* Status bar (tablet and desktop, above navigation or inline) */}
        {shouldShowStatusBar && !isMobile && (
          <div
            class="block"
            role="status"
            aria-label={statusDescription}
            aria-live="polite"
          >
            <StatusBar
              relayCount={relayCount}
              webrtcPeerCount={webrtcPeerCount}
              isSyncing={isSyncing}
              lastSyncAt={lastSyncAt}
            />
          </div>
        )}

        {/* Compact status bar (mobile only, above navigation) */}
        {shouldShowStatusBar && isMobile && !isSidebarLayout && (
          <div
            class={`fixed left-0 right-0 z-30 ${isLandscape ? 'bottom-10' : 'bottom-14'}`}
            role="status"
            aria-label={statusDescription}
            aria-live="polite"
          >
            <CompactStatusBar
              relayCount={relayCount}
              webrtcPeerCount={webrtcPeerCount}
              isSyncing={isSyncing}
            />
          </div>
        )}
      </div>

      {/* Bottom navigation (mobile and tablet only) */}
      {shouldShowNavigation && !isSidebarLayout && (
        <Navigation
          id={SKIP_LINK_TARGETS.navigation}
          position="bottom"
          unreadCounts={unreadCounts}
        />
      )}
    </div>
  );
};

// ============================================================================
// Minimal Shell (for onboarding, error states, etc.)
// ============================================================================

interface MinimalShellProps {
  children: ComponentChildren;
  /** Optional title to show */
  title?: string;
}

export const MinimalShell: FunctionComponent<MinimalShellProps> = ({
  children,
  title = 'BitChat In Browser',
}) => (
    <div class="min-h-screen min-h-[100dvh] bg-terminal-bg text-terminal-green font-mono flex flex-col">
      {/* Minimal header */}
      <header class="px-4 py-3 border-b border-terminal-green/30" role="banner">
        <h1 class="text-lg font-bold">{title}</h1>
      </header>

      {/* Content */}
      <main
        id={SKIP_LINK_TARGETS.main}
        role="main"
        aria-label="Main content"
        tabIndex={-1}
        class="flex-1 overflow-y-auto"
      >
        {children}
      </main>

      {/* Footer */}
      <footer
        class="px-4 py-2 border-t border-terminal-green/20 text-center"
        role="contentinfo"
      >
        <p class="text-terminal-xs text-terminal-green/40">
          bitbrowse.eth.limo | No tracking | Your keys, your messages
        </p>
      </footer>
    </div>
  );

// ============================================================================
// Loading Shell (for initial app load)
// ============================================================================

interface LoadingShellProps {
  message?: string;
}

export const LoadingShell: FunctionComponent<LoadingShellProps> = ({
  message = 'Initializing BitChat...',
}) => (
    <div
      class="min-h-screen min-h-[100dvh] bg-terminal-bg text-terminal-green font-mono flex flex-col items-center justify-center p-4"
      role="main"
      aria-label="Loading"
      aria-busy="true"
    >
      <div class="text-center space-y-4">
        {/* Terminal-style loading animation */}
        <div class="text-lg font-bold" aria-hidden="true">BitChat In Browser</div>
        <div
          class="flex items-center justify-center gap-1 text-terminal-green/70"
          role="status"
          aria-live="polite"
        >
          <span>{message}</span>
          <span class="animate-pulse" aria-hidden="true">_</span>
        </div>

        {/* Loading dots - decorative only */}
        <div class="flex justify-center gap-1" aria-hidden="true">
          <div
            class="w-2 h-2 bg-terminal-green rounded-full animate-bounce"
            style="animation-delay: 0ms"
          />
          <div
            class="w-2 h-2 bg-terminal-green rounded-full animate-bounce"
            style="animation-delay: 150ms"
          />
          <div
            class="w-2 h-2 bg-terminal-green rounded-full animate-bounce"
            style="animation-delay: 300ms"
          />
        </div>

        {/* Screen reader announcement */}
        <div class="sr-only" aria-live="assertive">
          {message}
        </div>
      </div>
    </div>
  );

// ============================================================================
// Error Shell (for fatal errors)
// ============================================================================

interface ErrorShellProps {
  error: string;
  onRetry?: () => void;
}

export const ErrorShell: FunctionComponent<ErrorShellProps> = ({
  error,
  onRetry,
}) => (
    <div
      class="min-h-screen min-h-[100dvh] bg-terminal-bg text-terminal-green font-mono flex flex-col items-center justify-center p-4"
      role="main"
      aria-label="Error"
    >
      <div
        class="text-center space-y-4 max-w-md"
        role="alert"
        aria-live="assertive"
      >
        {/* Error indicator */}
        <div class="text-terminal-red text-4xl font-bold" aria-hidden="true">[!]</div>
        <div class="text-lg font-bold text-terminal-red" id="error-title">System Error</div>

        {/* Error message */}
        <div
          class="bg-terminal-red/10 border border-terminal-red/30 rounded p-4 text-left"
          role="status"
          aria-labelledby="error-title"
        >
          <pre class="text-terminal-xs text-terminal-red whitespace-pre-wrap break-words">
            {error}
          </pre>
        </div>

        {/* Retry button */}
        {onRetry && (
          <button
            onClick={onRetry}
            class="btn-terminal mt-4"
            aria-label="Retry loading the application"
          >
            [RETRY]
          </button>
        )}

        {/* Help text */}
        <p class="text-terminal-xs text-terminal-green/50">
          If this persists, try clearing your browser data for this site.
        </p>
      </div>
    </div>
  );

export default Shell;
