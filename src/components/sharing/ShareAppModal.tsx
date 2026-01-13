/**
 * ShareAppModal Component
 *
 * Modal for sharing the BitChat app via WiFi hotspot.
 * Provides step-by-step instructions, QR code, and connection status.
 *
 * Features:
 * - Platform-specific hotspot setup instructions
 * - QR code generation for the share URL
 * - Connection status display
 * - Copy-to-clipboard functionality
 *
 * @module components/sharing/ShareAppModal
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback, useMemo } from 'preact/hooks';
import {
  localServerService,
  type LocalServerStatus,
} from '../../services/sharing/local-server';
import {
  hotspotBridge,
  type HotspotState,
  type HotspotInstructions,
} from '../../services/sharing/hotspot-bridge';

// ============================================================================
// Types
// ============================================================================

export interface ShareAppModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Optional callback when sharing starts */
  onShareStart?: () => void;
  /** Optional callback when sharing stops */
  onShareStop?: () => void;
}

type ShareStep =
  | 'intro'
  | 'hotspot-setup'
  | 'ready-to-share'
  | 'sharing';

// ============================================================================
// Sub-components
// ============================================================================

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const StepIndicator: FunctionComponent<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
}) => (
  <div class="flex items-center justify-center gap-2 mb-4">
    {Array.from({ length: totalSteps }).map((_, i) => (
      <div
        key={i}
        class={`w-2 h-2 rounded-full transition-colors ${
          i <= currentStep ? 'bg-terminal-green' : 'bg-terminal-green/30'
        }`}
      />
    ))}
  </div>
);

interface QRCodeDisplayProps {
  url: string;
  size?: number;
}

/**
 * Simple QR Code display component.
 * In production, you'd want to use a proper QR code library.
 * This creates a visual representation using CSS.
 */
const QRCodeDisplay: FunctionComponent<QRCodeDisplayProps> = ({
  url,
  size = 180,
}) => {
  // Generate a deterministic pattern from the URL
  // This is a visual placeholder - use a real QR library in production
  const pattern = useMemo(() => {
    const hash = url.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);

    // Create a 21x21 grid (minimum QR code size)
    const grid: boolean[][] = [];
    for (let i = 0; i < 21; i++) {
      grid[i] = [];
      for (let j = 0; j < 21; j++) {
        // Position patterns (corners)
        const isPositionPattern =
          (i < 7 && j < 7) || // Top-left
          (i < 7 && j >= 14) || // Top-right
          (i >= 14 && j < 7); // Bottom-left

        if (isPositionPattern) {
          // Create the finder pattern
          const inOuter =
            i === 0 || i === 6 || j === 0 || j === 6 ||
            (i >= 14 && (i === 14 || i === 20)) ||
            (j >= 14 && (j === 14 || j === 20));
          const inInner =
            (i >= 2 && i <= 4 && j >= 2 && j <= 4) ||
            (i >= 2 && i <= 4 && j >= 16 && j <= 18) ||
            (i >= 16 && i <= 18 && j >= 2 && j <= 4);
          grid[i]![j] = inOuter || inInner;
        } else {
          // Pseudo-random data pattern based on hash
          grid[i]![j] = ((hash >> ((i + j) % 31)) & 1) === 1;
        }
      }
    }
    return grid;
  }, [url]);

  const cellSize = size / 21;

  return (
    <div
      class="bg-white p-2 rounded inline-block"
      style={{ width: size + 16, height: size + 16 }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        class="block"
      >
        {pattern.map((row, i) =>
          row.map((cell, j) =>
            cell ? (
              <rect
                key={`${i}-${j}`}
                x={j * cellSize}
                y={i * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#000"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};

interface CopyButtonProps {
  text: string;
  label?: string;
}

const CopyButton: FunctionComponent<CopyButtonProps> = ({ text, label = 'Copy' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      class={`px-3 py-1 text-sm border transition-colors ${
        copied
          ? 'border-terminal-green bg-terminal-green/20 text-terminal-green'
          : 'border-terminal-green/50 hover:border-terminal-green text-terminal-green/70 hover:text-terminal-green'
      }`}
    >
      {copied ? '[COPIED]' : `[${label.toUpperCase()}]`}
    </button>
  );
};

interface HotspotStepProps {
  step: {
    number: number;
    title: string;
    description: string;
    settingsPath?: string;
  };
  isCompleted: boolean;
  isCurrent: boolean;
}

const HotspotStep: FunctionComponent<HotspotStepProps> = ({
  step,
  isCompleted,
  isCurrent,
}) => (
  <div
    class={`flex gap-3 p-3 rounded border transition-colors ${
      isCurrent
        ? 'border-terminal-green bg-terminal-green/10'
        : isCompleted
        ? 'border-terminal-green/50 bg-terminal-green/5'
        : 'border-terminal-green/20'
    }`}
  >
    <div
      class={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
        isCompleted
          ? 'bg-terminal-green text-terminal-bg'
          : isCurrent
          ? 'border-2 border-terminal-green text-terminal-green'
          : 'border border-terminal-green/30 text-terminal-green/30'
      }`}
    >
      {isCompleted ? '>' : step.number}
    </div>
    <div class="flex-1">
      <div class={`font-bold ${isCurrent ? '' : 'text-terminal-green/70'}`}>
        {step.title}
      </div>
      <div class="text-sm text-terminal-green/60 mt-1">{step.description}</div>
      {step.settingsPath && isCurrent && (
        <div class="text-xs text-terminal-green/40 mt-1 font-mono">
          {step.settingsPath}
        </div>
      )}
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const ShareAppModal: FunctionComponent<ShareAppModalProps> = ({
  isOpen,
  onClose,
  onShareStart,
  onShareStop,
}) => {
  // State
  const [shareStep, setShareStep] = useState<ShareStep>('intro');
  const [hotspotState, setHotspotState] = useState<HotspotState>('unknown');
  const [serverStatus, setServerStatus] = useState<LocalServerStatus | null>(null);
  const [currentSetupStep, setCurrentSetupStep] = useState(0);
  const [instructions, setInstructions] = useState<HotspotInstructions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize services
  useEffect(() => {
    if (isOpen) {
      const init = async () => {
        await localServerService.initialize({ verbose: true });
        await hotspotBridge.initialize({ verbose: true });

        setInstructions(hotspotBridge.getInstructions());
        setServerStatus(localServerService.getStatus());
      };

      init();

      // Subscribe to state changes
      const unsubscribeHotspot = hotspotBridge.onStateChange(setHotspotState);
      const unsubscribeServer = localServerService.onEvent((event) => {
        if (event.type === 'started' || event.type === 'stopped') {
          setServerStatus(localServerService.getStatus());
        }
      });

      return () => {
        unsubscribeHotspot();
        unsubscribeServer();
      };
    }
    return undefined;
  }, [isOpen]);

  // Get platform info
  const platformName =
    instructions?.platformName ?? 'Your Device';

  // Handle starting the share
  const handleStartShare = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const status = await localServerService.start();
      setServerStatus(status);
      setShareStep('sharing');
      onShareStart?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start sharing');
    } finally {
      setIsLoading(false);
    }
  }, [onShareStart]);

  // Handle stopping the share
  const handleStopShare = useCallback(() => {
    localServerService.stop();
    hotspotBridge.reset();
    setServerStatus(localServerService.getStatus());
    setShareStep('intro');
    onShareStop?.();
  }, [onShareStop]);

  // Handle proceeding through setup steps
  const handleProceedSetup = useCallback(() => {
    if (!instructions) return;

    if (currentSetupStep < instructions.steps.length - 1) {
      setCurrentSetupStep((prev) => prev + 1);
    } else {
      // All steps done, mark hotspot as active
      hotspotBridge.markActive();
      setShareStep('ready-to-share');
    }
  }, [currentSetupStep, instructions]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setShareStep('intro');
      setCurrentSetupStep(0);
      setError(null);
    }
  }, [isOpen]);

  // Don't render if not open
  if (!isOpen) return null;

  // Step content mapping
  const stepNumber =
    shareStep === 'intro'
      ? 0
      : shareStep === 'hotspot-setup'
      ? 1
      : shareStep === 'ready-to-share'
      ? 2
      : 3;

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div class="bg-terminal-bg border border-terminal-green rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-terminal-green/30">
          <h2 class="text-lg font-bold">&gt; Share BitChat</h2>
          <button
            onClick={onClose}
            class="text-terminal-green/70 hover:text-terminal-green text-xl"
          >
            [X]
          </button>
        </div>

        {/* Step Indicator */}
        <div class="px-4 pt-4">
          <StepIndicator currentStep={stepNumber} totalSteps={4} />
        </div>

        {/* Content */}
        <div class="p-4">
          {/* Intro Step */}
          {shareStep === 'intro' && (
            <div class="space-y-4">
              <p class="text-terminal-green/80">
                Share BitChat with someone nearby without needing internet.
                You'll create a WiFi hotspot and they'll connect to get the app.
              </p>

              <div class="border border-terminal-green/30 rounded p-4 space-y-2">
                <h3 class="font-bold">How it works:</h3>
                <ol class="text-sm text-terminal-green/70 space-y-2 list-decimal list-inside">
                  <li>You enable WiFi hotspot on your {platformName}</li>
                  <li>Your friend connects to your hotspot</li>
                  <li>They open the link or scan the QR code</li>
                  <li>BitChat installs on their device</li>
                </ol>
              </div>

              <div class="flex items-center gap-2 text-sm text-terminal-green/50">
                <span>[!]</span>
                <span>No internet needed after they connect</span>
              </div>

              <button
                onClick={() => setShareStep('hotspot-setup')}
                class="btn-terminal w-full"
              >
                [START SHARING]
              </button>
            </div>
          )}

          {/* Hotspot Setup Step */}
          {shareStep === 'hotspot-setup' && instructions && (
            <div class="space-y-4">
              <div class="text-center mb-4">
                <span class="text-terminal-green/50">Setting up on</span>
                <span class="ml-2 font-bold">{platformName}</span>
              </div>

              <div class="space-y-2">
                {instructions.steps.map((step, index) => (
                  <HotspotStep
                    key={step.number}
                    step={step}
                    isCompleted={index < currentSetupStep}
                    isCurrent={index === currentSetupStep}
                  />
                ))}
              </div>

              <div class="flex gap-2 mt-4">
                {currentSetupStep > 0 && (
                  <button
                    onClick={() => setCurrentSetupStep((prev) => prev - 1)}
                    class="flex-1 px-4 py-2 border border-terminal-green/50 text-terminal-green/70 hover:text-terminal-green hover:border-terminal-green"
                  >
                    [BACK]
                  </button>
                )}
                <button
                  onClick={handleProceedSetup}
                  class="flex-1 btn-terminal"
                >
                  {currentSetupStep < instructions.steps.length - 1
                    ? '[NEXT]'
                    : '[DONE]'}
                </button>
              </div>

              <button
                onClick={() => {
                  hotspotBridge.markActive();
                  setShareStep('ready-to-share');
                }}
                class="w-full text-center text-sm text-terminal-green/50 hover:text-terminal-green/70"
              >
                Skip - I already have hotspot enabled
              </button>
            </div>
          )}

          {/* Ready to Share Step */}
          {shareStep === 'ready-to-share' && (
            <div class="space-y-4">
              <div class="text-center">
                <div class="text-2xl mb-2">[*]</div>
                <h3 class="font-bold text-lg">Hotspot Ready!</h3>
                <p class="text-sm text-terminal-green/70 mt-2">
                  Your hotspot should now be visible to nearby devices.
                </p>
              </div>

              <div class="border border-terminal-green/30 rounded p-4 space-y-3">
                <div class="text-sm text-terminal-green/50">
                  Suggested password to share:
                </div>
                <div class="flex items-center gap-2">
                  <code class="flex-1 bg-terminal-green/10 px-3 py-2 rounded font-mono">
                    {hotspotBridge.generatePasswordSuggestion()}
                  </code>
                  <CopyButton
                    text={hotspotBridge.generatePasswordSuggestion()}
                    label="Copy"
                  />
                </div>
                <div class="text-xs text-terminal-green/40">
                  (Change this in your hotspot settings if you prefer)
                </div>
              </div>

              {error && (
                <div class="text-terminal-red text-sm border border-terminal-red/30 rounded p-2">
                  {error}
                </div>
              )}

              <button
                onClick={handleStartShare}
                disabled={isLoading}
                class="btn-terminal w-full"
              >
                {isLoading ? '[LOADING...]' : '[GENERATE SHARE LINK]'}
              </button>
            </div>
          )}

          {/* Sharing Step */}
          {shareStep === 'sharing' && serverStatus && (
            <div class="space-y-4">
              <div class="text-center">
                <div class="text-terminal-green text-2xl mb-2">[+]</div>
                <h3 class="font-bold text-lg">Sharing Active</h3>
              </div>

              {/* QR Code */}
              <div class="flex justify-center">
                <QRCodeDisplay url={serverStatus.localUrl ?? ''} />
              </div>

              {/* Share URL */}
              <div class="space-y-2">
                <div class="text-sm text-terminal-green/50 text-center">
                  Share this URL:
                </div>
                <div class="flex items-center gap-2">
                  <code class="flex-1 bg-terminal-green/10 px-3 py-2 rounded text-sm font-mono overflow-hidden text-ellipsis">
                    {serverStatus.localUrl}
                  </code>
                  <CopyButton
                    text={serverStatus.localUrl ?? ''}
                    label="Copy"
                  />
                </div>
              </div>

              {/* Instructions for receiver */}
              <div class="border border-terminal-green/30 rounded p-4 space-y-2">
                <h4 class="font-bold text-sm">Tell your friend:</h4>
                <ol class="text-sm text-terminal-green/70 space-y-1 list-decimal list-inside">
                  <li>Connect to your WiFi hotspot</li>
                  <li>Scan this QR code or open the URL</li>
                  <li>Tap "Add to Home Screen" when prompted</li>
                </ol>
              </div>

              {/* Status indicators */}
              <div class="flex items-center justify-center gap-4 text-sm text-terminal-green/50">
                <div class="flex items-center gap-1">
                  <span
                    class={`w-2 h-2 rounded-full ${
                      hotspotState === 'active' || hotspotState === 'connected'
                        ? 'bg-terminal-green animate-pulse'
                        : 'bg-terminal-green/30'
                    }`}
                  />
                  <span>Hotspot</span>
                </div>
                <div class="flex items-center gap-1">
                  <span
                    class={`w-2 h-2 rounded-full ${
                      serverStatus.isActive
                        ? 'bg-terminal-green animate-pulse'
                        : 'bg-terminal-green/30'
                    }`}
                  />
                  <span>Sharing</span>
                </div>
              </div>

              <button
                onClick={handleStopShare}
                class="w-full px-4 py-2 border border-terminal-red/50 text-terminal-red/70 hover:text-terminal-red hover:border-terminal-red"
              >
                [STOP SHARING]
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div class="px-4 pb-4">
          <div class="text-xs text-terminal-green/30 text-center">
            Platform: {platformName} | IP: {serverStatus?.localIp ?? 'detecting...'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareAppModal;
