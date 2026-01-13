/**
 * ReceiveApp Component
 *
 * Landing page for devices receiving the BitChat app via P2P sharing.
 * Guides users through:
 * - Connecting to the host's hotspot
 * - Installing the PWA
 * - Getting started with BitChat
 *
 * This page is shown when:
 * - User accesses the app from a shared URL
 * - Detected as first-time visitor
 * - PWA is not yet installed
 *
 * @module components/sharing/ReceiveApp
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export interface ReceiveAppProps {
  /** Callback when installation is complete */
  onInstallComplete?: () => void;
  /** Callback to skip and continue to app */
  onSkip?: () => void;
  /** Whether to show as a full page or embedded */
  fullPage?: boolean;
}

type ReceiveStep =
  | 'connecting'
  | 'connected'
  | 'install-prompt'
  | 'installing'
  | 'complete';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// ============================================================================
// PWA Install Detection Hook
// ============================================================================

interface InstallState {
  canInstall: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
}

function useInstallState(): InstallState {
  const [state, setState] = useState<InstallState>({
    canInstall: false,
    isInstalled: false,
    isStandalone: false,
    platform: 'unknown',
  });

  useEffect(() => {
    // Check if running as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-expect-error - iOS Safari specific
      window.navigator.standalone === true;

    // Detect platform
    const ua = navigator.userAgent.toLowerCase();
    let platform: 'ios' | 'android' | 'desktop' | 'unknown' = 'unknown';

    if (/iphone|ipad|ipod/.test(ua)) {
      platform = 'ios';
    } else if (/android/.test(ua)) {
      platform = 'android';
    } else if (/mac|windows|linux/.test(ua)) {
      platform = 'desktop';
    }

    // Check if PWA is installable
    const canInstall =
      'BeforeInstallPromptEvent' in window ||
      (platform === 'ios' && !isStandalone);

    setState({
      canInstall,
      isInstalled: isStandalone,
      isStandalone,
      platform,
    });
  }, []);

  return state;
}

// ============================================================================
// Sub-components
// ============================================================================

interface ProgressStepProps {
  number: number;
  title: string;
  isComplete: boolean;
  isCurrent: boolean;
}

const ProgressStep: FunctionComponent<ProgressStepProps> = ({
  number,
  title,
  isComplete,
  isCurrent,
}) => (
  <div class="flex items-center gap-3">
    <div
      class={`w-8 h-8 rounded-full flex items-center justify-center font-bold transition-colors ${
        isComplete
          ? 'bg-terminal-green text-terminal-bg'
          : isCurrent
          ? 'border-2 border-terminal-green text-terminal-green animate-pulse'
          : 'border border-terminal-green/30 text-terminal-green/30'
      }`}
    >
      {isComplete ? '>' : number}
    </div>
    <span
      class={
        isComplete || isCurrent ? 'text-terminal-green' : 'text-terminal-green/50'
      }
    >
      {title}
    </span>
  </div>
);

interface InstallInstructionsProps {
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  onDone?: () => void;
}

const InstallInstructions: FunctionComponent<InstallInstructionsProps> = ({
  platform,
  onDone,
}) => {
  if (platform === 'ios') {
    return (
      <div class="space-y-4">
        <h3 class="font-bold">Install on iPhone/iPad:</h3>
        <ol class="space-y-3">
          <li class="flex items-start gap-3">
            <span class="w-6 h-6 bg-terminal-green/20 rounded flex items-center justify-center text-sm">
              1
            </span>
            <div>
              <div class="font-bold">Tap the Share button</div>
              <div class="text-sm text-terminal-green/60">
                Look for the square with an arrow at the bottom of Safari
              </div>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-6 h-6 bg-terminal-green/20 rounded flex items-center justify-center text-sm">
              2
            </span>
            <div>
              <div class="font-bold">Scroll down and tap "Add to Home Screen"</div>
              <div class="text-sm text-terminal-green/60">
                You may need to scroll in the share menu
              </div>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-6 h-6 bg-terminal-green/20 rounded flex items-center justify-center text-sm">
              3
            </span>
            <div>
              <div class="font-bold">Tap "Add" to confirm</div>
              <div class="text-sm text-terminal-green/60">
                BitChat will appear on your home screen
              </div>
            </div>
          </li>
        </ol>
        <button onClick={onDone} class="btn-terminal w-full mt-4">
          [I'VE INSTALLED IT]
        </button>
      </div>
    );
  }

  if (platform === 'android') {
    return (
      <div class="space-y-4">
        <h3 class="font-bold">Install on Android:</h3>
        <ol class="space-y-3">
          <li class="flex items-start gap-3">
            <span class="w-6 h-6 bg-terminal-green/20 rounded flex items-center justify-center text-sm">
              1
            </span>
            <div>
              <div class="font-bold">Tap the menu button</div>
              <div class="text-sm text-terminal-green/60">
                Three dots in the top-right corner of Chrome
              </div>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-6 h-6 bg-terminal-green/20 rounded flex items-center justify-center text-sm">
              2
            </span>
            <div>
              <div class="font-bold">Tap "Install app" or "Add to Home screen"</div>
              <div class="text-sm text-terminal-green/60">
                Look for the install option in the menu
              </div>
            </div>
          </li>
          <li class="flex items-start gap-3">
            <span class="w-6 h-6 bg-terminal-green/20 rounded flex items-center justify-center text-sm">
              3
            </span>
            <div>
              <div class="font-bold">Tap "Install" to confirm</div>
              <div class="text-sm text-terminal-green/60">
                BitChat will be added to your app drawer
              </div>
            </div>
          </li>
        </ol>
        <button onClick={onDone} class="btn-terminal w-full mt-4">
          [I'VE INSTALLED IT]
        </button>
      </div>
    );
  }

  // Desktop
  return (
    <div class="space-y-4">
      <h3 class="font-bold">Install on Desktop:</h3>
      <ol class="space-y-3">
        <li class="flex items-start gap-3">
          <span class="w-6 h-6 bg-terminal-green/20 rounded flex items-center justify-center text-sm">
            1
          </span>
          <div>
            <div class="font-bold">Look for the install icon</div>
            <div class="text-sm text-terminal-green/60">
              In the address bar (Chrome) or menu
            </div>
          </div>
        </li>
        <li class="flex items-start gap-3">
          <span class="w-6 h-6 bg-terminal-green/20 rounded flex items-center justify-center text-sm">
            2
          </span>
          <div>
            <div class="font-bold">Click "Install"</div>
            <div class="text-sm text-terminal-green/60">
              Confirm the installation prompt
            </div>
          </div>
        </li>
      </ol>
      <button onClick={onDone} class="btn-terminal w-full mt-4">
        [I'VE INSTALLED IT]
      </button>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ReceiveApp: FunctionComponent<ReceiveAppProps> = ({
  onInstallComplete,
  onSkip,
  fullPage = true,
}) => {
  // State
  const [step, setStep] = useState<ReceiveStep>('connecting');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Hooks
  const installState = useInstallState();

  // Listen for install prompt (Chrome/Edge)
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-progress when connected
  useEffect(() => {
    if (step === 'connecting') {
      // Simulate connection check
      const timeout = setTimeout(() => {
        setStep('connected');
      }, 1500);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [step]);

  // Auto-progress after connected
  useEffect(() => {
    if (step === 'connected') {
      const timeout = setTimeout(() => {
        setStep('install-prompt');
      }, 1000);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [step]);

  // Simulate download progress
  useEffect(() => {
    if (step === 'installing') {
      const interval = setInterval(() => {
        setDownloadProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setStep('complete'), 500);
            return 100;
          }
          return prev + Math.random() * 15;
        });
      }, 200);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [step]);

  // Handle native install prompt
  const handleInstall = useCallback(async () => {
    if (installPrompt) {
      setStep('installing');

      try {
        await installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;

        if (outcome === 'accepted') {
          setStep('complete');
          onInstallComplete?.();
        } else {
          setStep('install-prompt');
        }
      } catch {
        setStep('install-prompt');
      }
    } else {
      // Manual install flow
      setStep('installing');
    }
  }, [installPrompt, onInstallComplete]);

  // Handle manual install confirmation
  const handleManualInstallDone = useCallback(() => {
    setStep('complete');
    onInstallComplete?.();
  }, [onInstallComplete]);

  // Skip if already installed
  useEffect(() => {
    if (installState.isInstalled) {
      onSkip?.();
    }
  }, [installState.isInstalled, onSkip]);

  // Calculate current step index
  const stepIndex =
    step === 'connecting'
      ? 0
      : step === 'connected'
      ? 1
      : step === 'install-prompt' || step === 'installing'
      ? 2
      : 3;

  // Wrapper class for full page vs embedded
  const wrapperClass = fullPage
    ? 'min-h-screen min-h-[100dvh] bg-terminal-bg text-terminal-green font-mono flex flex-col'
    : 'bg-terminal-bg text-terminal-green font-mono flex flex-col';

  return (
    <div class={wrapperClass}>
      {/* Header */}
      <header class="px-4 py-3 border-b border-terminal-green/30">
        <h1 class="text-lg font-bold">&gt; BitChat In Browser</h1>
        <p class="text-sm text-terminal-green/60">P2P App Transfer</p>
      </header>

      {/* Main content */}
      <main class="flex-1 p-4 overflow-y-auto">
        <div class="max-w-md mx-auto space-y-6">
          {/* Progress indicator */}
          <div class="space-y-3 border border-terminal-green/30 rounded p-4">
            <ProgressStep
              number={1}
              title="Connect to hotspot"
              isComplete={stepIndex > 0}
              isCurrent={stepIndex === 0}
            />
            <ProgressStep
              number={2}
              title="Download app"
              isComplete={stepIndex > 1}
              isCurrent={stepIndex === 1}
            />
            <ProgressStep
              number={3}
              title="Install"
              isComplete={stepIndex > 2}
              isCurrent={stepIndex === 2}
            />
            <ProgressStep
              number={4}
              title="Ready!"
              isComplete={stepIndex === 3}
              isCurrent={false}
            />
          </div>

          {/* Step-specific content */}
          <div class="border border-terminal-green/30 rounded p-4">
            {/* Connecting */}
            {step === 'connecting' && (
              <div class="text-center py-4">
                <div class="text-2xl mb-4 animate-pulse">[...]</div>
                <h3 class="font-bold mb-2">Connecting...</h3>
                <p class="text-sm text-terminal-green/60">
                  Establishing connection with the sender
                </p>
                <div class="flex justify-center gap-1 mt-4">
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
              </div>
            )}

            {/* Connected */}
            {step === 'connected' && (
              <div class="text-center py-4">
                <div class="text-2xl mb-4 text-terminal-green">[+]</div>
                <h3 class="font-bold mb-2">Connected!</h3>
                <p class="text-sm text-terminal-green/60">
                  Loading BitChat app data...
                </p>
              </div>
            )}

            {/* Install prompt */}
            {step === 'install-prompt' && (
              <div class="space-y-4">
                <div class="text-center">
                  <div class="text-3xl mb-2">&gt;_</div>
                  <h3 class="font-bold text-lg mb-1">Install BitChat</h3>
                  <p class="text-sm text-terminal-green/60">
                    Add BitChat to your device for the best experience
                  </p>
                </div>

                {/* Native install button or manual instructions */}
                {installPrompt ? (
                  <button onClick={handleInstall} class="btn-terminal w-full">
                    [INSTALL NOW]
                  </button>
                ) : (
                  <InstallInstructions
                    platform={installState.platform}
                    onDone={handleManualInstallDone}
                  />
                )}

                <button
                  onClick={onSkip}
                  class="w-full text-center text-sm text-terminal-green/50 hover:text-terminal-green/70"
                >
                  Skip - Continue in browser
                </button>
              </div>
            )}

            {/* Installing */}
            {step === 'installing' && (
              <div class="text-center py-4 space-y-4">
                <h3 class="font-bold mb-2">Installing...</h3>

                {/* Progress bar */}
                <div class="w-full bg-terminal-green/20 rounded h-2 overflow-hidden">
                  <div
                    class="h-full bg-terminal-green transition-all duration-200"
                    style={{ width: `${Math.min(downloadProgress, 100)}%` }}
                  />
                </div>

                <p class="text-sm text-terminal-green/60">
                  {downloadProgress < 30
                    ? 'Downloading app resources...'
                    : downloadProgress < 70
                    ? 'Caching for offline use...'
                    : downloadProgress < 100
                    ? 'Finalizing installation...'
                    : 'Complete!'}
                </p>

                {/* Manual install instructions if no native prompt */}
                {!installPrompt && downloadProgress >= 100 && (
                  <InstallInstructions
                    platform={installState.platform}
                    onDone={handleManualInstallDone}
                  />
                )}
              </div>
            )}

            {/* Complete */}
            {step === 'complete' && (
              <div class="text-center py-4 space-y-4">
                <div class="text-4xl text-terminal-green">[*]</div>
                <h3 class="font-bold text-lg">All Set!</h3>
                <p class="text-sm text-terminal-green/60">
                  BitChat is ready to use. Start chatting with end-to-end encryption.
                </p>

                <div class="border border-terminal-green/30 rounded p-3 text-left space-y-2">
                  <h4 class="font-bold text-sm">What's next:</h4>
                  <ul class="text-sm text-terminal-green/70 space-y-1">
                    <li>+ Create your identity</li>
                    <li>+ Join location-based channels</li>
                    <li>+ Connect with peers</li>
                    <li>+ Chat privately, even offline</li>
                  </ul>
                </div>

                <button onClick={onSkip} class="btn-terminal w-full">
                  [OPEN BITCHAT]
                </button>
              </div>
            )}
          </div>

          {/* Connection status */}
          <div class="flex items-center justify-center gap-4 text-xs text-terminal-green/40">
            <div class="flex items-center gap-1">
              <span
                class={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-terminal-green' : 'bg-terminal-red'
                }`}
              />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            <span>|</span>
            <span>{installState.platform}</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer class="px-4 py-2 border-t border-terminal-green/20 text-center">
        <p class="text-terminal-xs text-terminal-green/40">
          Encrypted mesh messaging | Your keys, your messages
        </p>
      </footer>
    </div>
  );
};

// ============================================================================
// Helper Component: First Visit Detection
// ============================================================================

/**
 * HOC to detect if this is a first visit from a P2P share
 * and show the ReceiveApp page if so.
 */
export const withReceiveAppDetection = <P extends object>(
  WrappedComponent: FunctionComponent<P>
): FunctionComponent<P> => {
  return (props: P) => {
    const [showReceivePage, setShowReceivePage] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
      // Check if this is a P2P share visit
      const urlParams = new URLSearchParams(window.location.search);
      const isShare = urlParams.get('share') === '1';
      const hasVisited = localStorage.getItem('bitchat_has_visited') === '1';

      if (isShare && !hasVisited) {
        setShowReceivePage(true);
      }

      setHasChecked(true);
    }, []);

    const handleComplete = useCallback(() => {
      localStorage.setItem('bitchat_has_visited', '1');
      setShowReceivePage(false);

      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('share');
      window.history.replaceState({}, '', url.toString());
    }, []);

    if (!hasChecked) {
      return null; // Or a loading state
    }

    if (showReceivePage) {
      return <ReceiveApp onInstallComplete={handleComplete} onSkip={handleComplete} />;
    }

    return <WrappedComponent {...props} />;
  };
};

export default ReceiveApp;
