/**
 * InstallPrompt - PWA Installation Prompt Component
 *
 * Provides a custom install experience for the BitChat PWA:
 * - Native install prompt on Chrome/Edge (Android, Desktop)
 * - Manual instructions for iOS (Safari)
 * - Benefits of installing the app
 * - Dismissible with memory (won't show for 7 days after dismissal)
 *
 * @module components/install/InstallPrompt
 */

import { FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useInstallPrompt, type Platform } from '../../hooks/useInstallPrompt';

// ============================================================================
// Types
// ============================================================================

interface InstallPromptProps {
  /** Optional callback when install is successful */
  onInstalled?: () => void;
  /** Optional callback when user dismisses */
  onDismissed?: () => void;
  /** Whether to show as a compact banner vs full modal */
  variant?: 'banner' | 'modal' | 'inline';
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Benefits list shown in the install prompt
 */
const InstallBenefits: FunctionComponent = () => (
  <ul class="space-y-2 text-sm text-terminal-green/80">
    <li class="flex items-start gap-2">
      <span class="text-terminal-green shrink-0">+</span>
      <span>Works offline after first load</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-terminal-green shrink-0">+</span>
      <span>Faster launch from home screen</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-terminal-green shrink-0">+</span>
      <span>Full screen experience</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-terminal-green shrink-0">+</span>
      <span>Push notifications for messages</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-terminal-green shrink-0">+</span>
      <span>Share to BitChat from any app</span>
    </li>
  </ul>
);

/**
 * iOS-specific installation instructions
 */
const IOSInstructions: FunctionComponent = () => (
  <div class="space-y-4">
    <p class="text-sm text-terminal-green/70">
      To install on iOS, follow these steps:
    </p>
    <ol class="space-y-3 text-sm">
      <li class="flex items-start gap-3">
        <span class="flex items-center justify-center w-6 h-6 rounded border border-terminal-green/30 text-terminal-green shrink-0">
          1
        </span>
        <span class="text-terminal-green/80">
          Tap the <strong class="text-terminal-green">Share</strong> button
          <span class="inline-block ml-1 px-1 border border-terminal-green/30 rounded text-xs">
            [^]
          </span>
          in Safari's toolbar
        </span>
      </li>
      <li class="flex items-start gap-3">
        <span class="flex items-center justify-center w-6 h-6 rounded border border-terminal-green/30 text-terminal-green shrink-0">
          2
        </span>
        <span class="text-terminal-green/80">
          Scroll down and tap <strong class="text-terminal-green">"Add to Home Screen"</strong>
        </span>
      </li>
      <li class="flex items-start gap-3">
        <span class="flex items-center justify-center w-6 h-6 rounded border border-terminal-green/30 text-terminal-green shrink-0">
          3
        </span>
        <span class="text-terminal-green/80">
          Tap <strong class="text-terminal-green">"Add"</strong> to confirm
        </span>
      </li>
    </ol>
    <div class="mt-4 p-3 bg-terminal-green/5 border border-terminal-green/20 rounded">
      <p class="text-xs text-terminal-green/60">
        Note: You must use Safari on iOS. Other browsers don't support PWA installation.
      </p>
    </div>
  </div>
);

/**
 * Android-specific installation message
 */
const AndroidInstructions: FunctionComponent<{ onInstall: () => void }> = ({ onInstall }) => (
  <div class="space-y-4">
    <p class="text-sm text-terminal-green/70">
      Install BitChat on your device for the best experience:
    </p>
    <button
      onClick={onInstall}
      class="w-full px-4 py-3 bg-terminal-green text-terminal-bg font-bold rounded hover:bg-terminal-green/90 transition-colors"
    >
      [INSTALL BITCHAT]
    </button>
  </div>
);

/**
 * Desktop installation message
 */
const DesktopInstructions: FunctionComponent<{ onInstall: () => void }> = ({ onInstall }) => (
  <div class="space-y-4">
    <p class="text-sm text-terminal-green/70">
      Install BitChat as a desktop app:
    </p>
    <button
      onClick={onInstall}
      class="w-full px-4 py-3 bg-terminal-green text-terminal-bg font-bold rounded hover:bg-terminal-green/90 transition-colors"
    >
      [INSTALL APP]
    </button>
    <p class="text-xs text-terminal-green/50">
      Or click the install icon in your browser's address bar.
    </p>
  </div>
);

/**
 * Platform-specific install content
 */
const InstallContent: FunctionComponent<{
  platform: Platform;
  onInstall: () => void;
}> = ({ platform, onInstall }) => {
  switch (platform) {
    case 'ios':
      return <IOSInstructions />;
    case 'android':
      return <AndroidInstructions onInstall={onInstall} />;
    case 'desktop':
      return <DesktopInstructions onInstall={onInstall} />;
    default:
      return <DesktopInstructions onInstall={onInstall} />;
  }
};

// ============================================================================
// Main Component
// ============================================================================

/**
 * InstallPrompt - Full installation prompt component
 */
export const InstallPrompt: FunctionComponent<InstallPromptProps> = ({
  onInstalled,
  onDismissed,
  variant = 'modal',
  className = '',
}) => {
  const {
    shouldShowInstallBanner,
    platform,
    promptInstall,
    dismissPrompt,
    isInstalled,
  } = useInstallPrompt();

  const [isInstalling, setIsInstalling] = useState(false);
  const [showModal, setShowModal] = useState(true);

  const handleInstall = useCallback(async () => {
    setIsInstalling(true);
    const success = await promptInstall();
    setIsInstalling(false);

    if (success) {
      onInstalled?.();
      setShowModal(false);
    }
  }, [promptInstall, onInstalled]);

  const handleDismiss = useCallback(() => {
    dismissPrompt();
    onDismissed?.();
    setShowModal(false);
  }, [dismissPrompt, onDismissed]);

  // Don't render if already installed or should not show
  if (isInstalled || !shouldShowInstallBanner || !showModal) {
    return null;
  }

  // Banner variant - compact inline banner
  if (variant === 'banner') {
    return (
      <div class={`bg-terminal-bg border-t border-terminal-green/30 p-3 ${className}`}>
        <div class="flex items-center justify-between gap-4 max-w-lg mx-auto">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-terminal-green text-lg shrink-0">&gt;_</span>
            <p class="text-sm text-terminal-green/80 truncate">
              Install BitChat for the best experience
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            {platform !== 'ios' && (
              <button
                onClick={handleInstall}
                disabled={isInstalling}
                class="px-3 py-1 text-sm bg-terminal-green text-terminal-bg font-bold rounded hover:bg-terminal-green/90 transition-colors disabled:opacity-50"
              >
                {isInstalling ? 'Installing...' : 'Install'}
              </button>
            )}
            <button
              onClick={handleDismiss}
              class="p-1 text-terminal-green/50 hover:text-terminal-green transition-colors"
              aria-label="Dismiss"
            >
              [X]
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant - fits into page flow
  if (variant === 'inline') {
    return (
      <div class={`border border-terminal-green/30 rounded p-4 ${className}`}>
        <div class="flex items-start justify-between gap-4 mb-4">
          <div class="flex items-center gap-2">
            <span class="text-terminal-green text-xl">&gt;_</span>
            <h3 class="font-bold text-terminal-green">Install BitChat</h3>
          </div>
          <button
            onClick={handleDismiss}
            class="text-terminal-green/50 hover:text-terminal-green transition-colors text-sm"
          >
            [DISMISS]
          </button>
        </div>
        <InstallContent platform={platform} onInstall={handleInstall} />
      </div>
    );
  }

  // Modal variant - full overlay modal
  return (
    <div class={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-terminal-bg/95 ${className}`}>
      <div class="w-full max-w-md bg-terminal-bg border border-terminal-green/30 rounded shadow-terminal-glow">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-terminal-green/20">
          <div class="flex items-center gap-2">
            <span class="text-terminal-green text-2xl">&gt;_</span>
            <h2 class="text-lg font-bold text-terminal-green">Install BitChat</h2>
          </div>
          <button
            onClick={handleDismiss}
            class="text-terminal-green/50 hover:text-terminal-green transition-colors"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        {/* Content */}
        <div class="p-4 space-y-6">
          {/* Benefits */}
          <div>
            <h3 class="text-sm font-bold text-terminal-green mb-3">
              &gt; Why install?
            </h3>
            <InstallBenefits />
          </div>

          {/* Platform-specific instructions */}
          <div>
            <h3 class="text-sm font-bold text-terminal-green mb-3">
              &gt; How to install
            </h3>
            <InstallContent platform={platform} onInstall={handleInstall} />
          </div>
        </div>

        {/* Footer */}
        <div class="p-4 border-t border-terminal-green/20">
          <button
            onClick={handleDismiss}
            class="w-full px-4 py-2 text-sm text-terminal-green/60 hover:text-terminal-green border border-terminal-green/30 rounded transition-colors"
          >
            [MAYBE LATER]
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Compact Install Button
// ============================================================================

/**
 * InstallButton - Compact button to trigger install
 * Use this in settings or other places where a simple button is needed
 */
export const InstallButton: FunctionComponent<{
  className?: string;
  onInstalled?: () => void;
}> = ({ className = '', onInstalled }) => {
  const { canInstall, platform, promptInstall, isInstalled } = useInstallPrompt();
  const [showInstructions, setShowInstructions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleClick = useCallback(async () => {
    if (platform === 'ios') {
      setShowInstructions(true);
    } else {
      setIsInstalling(true);
      const success = await promptInstall();
      setIsInstalling(false);
      if (success) {
        onInstalled?.();
      }
    }
  }, [platform, promptInstall, onInstalled]);

  if (isInstalled) {
    return (
      <div class={`text-terminal-green/50 text-sm ${className}`}>
        App is installed
      </div>
    );
  }

  if (!canInstall) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isInstalling}
        class={`px-4 py-2 bg-terminal-green text-terminal-bg font-bold rounded hover:bg-terminal-green/90 transition-colors disabled:opacity-50 ${className}`}
      >
        {isInstalling ? 'Installing...' : 'Install App'}
      </button>

      {/* iOS Instructions Modal */}
      {showInstructions && platform === 'ios' && (
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-terminal-bg/95">
          <div class="w-full max-w-sm bg-terminal-bg border border-terminal-green/30 rounded p-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-bold text-terminal-green">Install on iOS</h3>
              <button
                onClick={() => setShowInstructions(false)}
                class="text-terminal-green/50 hover:text-terminal-green"
              >
                [X]
              </button>
            </div>
            <IOSInstructions />
            <button
              onClick={() => setShowInstructions(false)}
              class="w-full mt-4 px-4 py-2 text-terminal-green/60 border border-terminal-green/30 rounded hover:text-terminal-green transition-colors"
            >
              [GOT IT]
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default InstallPrompt;
