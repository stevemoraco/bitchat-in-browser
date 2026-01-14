/**
 * VerifyPeer - Peer verification component
 *
 * Provides:
 * - Side-by-side fingerprint comparison
 * - QR code display for your key
 * - Verification confirmation flow
 * - Mark as verified button
 */

import type { FunctionComponent } from 'preact';
import { useState, useMemo, useCallback } from 'preact/hooks';
import { usePeersStore, usePeer } from '../../stores/peers-store';
import { useIdentity } from '../../stores/identity-store';
import { VisualFingerprint } from './PeerItem';

// ============================================================================
// Types
// ============================================================================

interface VerifyPeerProps {
  /** Fingerprint of peer to verify */
  fingerprint: string;
  /** Callback when verification is complete */
  onComplete?: () => void;
  /** Callback when cancelled */
  onCancel?: () => void;
}

type VerificationStep = 'compare' | 'confirm' | 'success';

// ============================================================================
// QR Code Display Component
// ============================================================================

interface QRCodeDisplayProps {
  data: string;
  size?: number;
  label?: string;
}

const QRCodeDisplay: FunctionComponent<QRCodeDisplayProps> = ({
  data,
  size = 200,
  label,
}) => 
  // In production, you would use a QR code library like qrcode-generator
  // For now, we display a placeholder with a simulated QR pattern

   (
    <div class="flex flex-col items-center">
      {label && (
        <span class="text-terminal-xs text-muted uppercase tracking-wider mb-2">
          {label}
        </span>
      )}
      <div
        class="bg-white p-4 rounded-terminal"
        style={{ width: size, height: size }}
      >
        {/* Simulated QR code pattern using visual fingerprint colors */}
        <div class="w-full h-full grid grid-cols-8 gap-0.5">
          {/* Generate a grid pattern based on the data */}
          {Array.from({ length: 64 }, (_, i) => {
            const byte = parseInt(data.slice((i * 2) % data.length, (i * 2 + 2) % data.length) || '00', 16);
            const isBlack = byte % 2 === 0;
            return (
              <div
                key={i}
                class={`w-full aspect-square ${isBlack ? 'bg-black' : 'bg-white'}`}
              />
            );
          })}
        </div>
      </div>
      <p class="text-terminal-xs text-muted mt-2 text-center max-w-[200px]">
        Scan this code with another device to verify
      </p>
    </div>
  )
;

// ============================================================================
// Fingerprint Comparison Component
// ============================================================================

interface FingerprintComparisonProps {
  yourFingerprint: string;
  theirFingerprint: string;
  theirNickname: string;
}

const FingerprintComparison: FunctionComponent<FingerprintComparisonProps> = ({
  yourFingerprint,
  theirFingerprint,
  theirNickname,
}) => {
  // Split fingerprints into chunks for comparison
  const splitFingerprint = (fp: string): string[] => {
    const chunks: string[] = [];
    for (let i = 0; i < fp.length; i += 4) {
      chunks.push(fp.slice(i, i + 4));
    }
    return chunks;
  };

  const yourChunks = useMemo(() => splitFingerprint(yourFingerprint), [yourFingerprint]);
  const theirChunks = useMemo(() => splitFingerprint(theirFingerprint), [theirFingerprint]);

  return (
    <div class="space-y-6">
      {/* Your fingerprint */}
      <div class="card-terminal">
        <div class="flex items-center gap-3 mb-3">
          <VisualFingerprint fingerprint={yourFingerprint} size="md" />
          <div>
            <span class="text-terminal-xs text-muted uppercase tracking-wider block">
              Your Key
            </span>
            <span class="text-terminal-sm text-primary">You</span>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-1 font-mono text-terminal-xs">
          {yourChunks.map((chunk, index) => (
            <div
              key={index}
              class="bg-background px-2 py-1 text-center text-primary rounded-terminal-sm"
            >
              {chunk}
            </div>
          ))}
        </div>
      </div>

      {/* Divider with comparison icon */}
      <div class="flex items-center justify-center">
        <div class="flex-1 h-px bg-muted/30" />
        <span class="px-4 text-muted text-terminal-sm">[COMPARE]</span>
        <div class="flex-1 h-px bg-muted/30" />
      </div>

      {/* Their fingerprint */}
      <div class="card-terminal">
        <div class="flex items-center gap-3 mb-3">
          <VisualFingerprint fingerprint={theirFingerprint} size="md" />
          <div>
            <span class="text-terminal-xs text-muted uppercase tracking-wider block">
              Their Key
            </span>
            <span class="text-terminal-sm text-secondary">{theirNickname}</span>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-1 font-mono text-terminal-xs">
          {theirChunks.map((chunk, index) => (
            <div
              key={index}
              class="bg-background px-2 py-1 text-center text-secondary rounded-terminal-sm"
            >
              {chunk}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Verification Instructions Component
// ============================================================================

const VerificationInstructions: FunctionComponent = () => {
  const steps = [
    'Meet in person or video call with the peer you want to verify',
    'Compare the fingerprints shown above with what they see on their device',
    'Verify both the visual pattern (colored blocks) and the text match exactly',
    'If everything matches, click "Fingerprints Match" to mark as verified',
  ];

  return (
    <div class="card-terminal bg-primary/5 border-primary/30">
      <h4 class="text-terminal-sm text-primary font-bold mb-3">
        How to Verify
      </h4>
      <ol class="space-y-2">
        {steps.map((step, index) => (
          <li key={index} class="flex gap-2 text-terminal-xs text-text/80">
            <span class="text-primary flex-shrink-0">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

// ============================================================================
// Confirmation Dialog Component
// ============================================================================

interface ConfirmationDialogProps {
  peerNickname: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationDialog: FunctionComponent<ConfirmationDialogProps> = ({
  peerNickname,
  onConfirm,
  onCancel,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div class="space-y-6">
      <div class="text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 bg-terminal-green/10 rounded-full mb-4">
          <span class="text-3xl text-terminal-green">[V]</span>
        </div>
        <h3 class="text-terminal-lg text-primary font-bold mb-2">
          Confirm Verification
        </h3>
        <p class="text-terminal-sm text-muted">
          You are about to mark <span class="text-secondary">{peerNickname}</span> as a verified contact.
        </p>
      </div>

      <div class="card-terminal border-terminal-yellow/30 bg-terminal-yellow/5">
        <h4 class="text-terminal-sm text-terminal-yellow font-bold mb-2">
          [!] Important
        </h4>
        <p class="text-terminal-xs text-text/80">
          Only verify if you have personally confirmed the fingerprints match
          in person or via a trusted video call. This helps prevent
          man-in-the-middle attacks.
        </p>
      </div>

      <label class="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed((e.target as HTMLInputElement).checked)}
          class="mt-1"
        />
        <span class="text-terminal-sm text-text">
          I have verified the fingerprints match and confirm this is the correct person
        </span>
      </label>

      <div class="flex gap-3">
        <button class="btn-terminal-ghost flex-1" onClick={onCancel}>
          Go Back
        </button>
        <button
          class="btn-terminal flex-1"
          onClick={onConfirm}
          disabled={!confirmed}
        >
          Verify Peer
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Success View Component
// ============================================================================

interface SuccessViewProps {
  peerNickname: string;
  onDone: () => void;
}

const SuccessView: FunctionComponent<SuccessViewProps> = ({ peerNickname, onDone }) => (
    <div class="text-center py-8">
      <div
        class="inline-flex items-center justify-center w-20 h-20 bg-terminal-green/10 rounded-full mb-6"
        style={{ animation: 'success-pulse 1s ease-out' }}
      >
        <span class="text-4xl text-terminal-green glow-primary">[V]</span>
      </div>

      <h3 class="text-terminal-xl text-primary font-bold mb-2">
        Peer Verified!
      </h3>
      <p class="text-terminal-sm text-muted mb-6">
        <span class="text-secondary">{peerNickname}</span> has been marked as a verified contact.
        You can now trust messages from this peer.
      </p>

      <div class="card-terminal inline-block mb-6">
        <div class="flex items-center gap-2 text-terminal-sm">
          <span class="text-terminal-green">[V]</span>
          <span class="text-text">Verified</span>
          <span class="text-muted">-</span>
          <span class="text-secondary">{peerNickname}</span>
        </div>
      </div>

      <button class="btn-terminal w-full max-w-xs mx-auto" onClick={onDone}>
        Done
      </button>

      <style>
        {`
          @keyframes success-pulse {
            0% { transform: scale(0.8); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}
      </style>
    </div>
  );

// ============================================================================
// VerifyPeer Component
// ============================================================================

export const VerifyPeer: FunctionComponent<VerifyPeerProps> = ({
  fingerprint,
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<VerificationStep>('compare');
  const [showQR, setShowQR] = useState(false);

  const peer = usePeer(fingerprint);
  const identity = useIdentity();
  const { setTrusted } = usePeersStore();

  const handleProceed = useCallback(() => {
    setStep('confirm');
  }, []);

  const handleConfirm = useCallback(() => {
    setTrusted(fingerprint, true);
    setStep('success');
  }, [fingerprint, setTrusted]);

  const handleBack = useCallback(() => {
    if (step === 'confirm') {
      setStep('compare');
    } else if (onCancel) {
      onCancel();
    }
  }, [step, onCancel]);

  const handleDone = useCallback(() => {
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  // Error states
  if (!peer) {
    return (
      <div class="flex flex-col h-full bg-background p-4">
        <div class="empty-state">
          <div class="empty-state-icon text-2xl">[!]</div>
          <h3 class="empty-state-title">Peer not found</h3>
          <p class="empty-state-description">This peer may have been removed.</p>
          {onCancel && (
            <button class="btn-terminal mt-4" onClick={onCancel}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!identity) {
    return (
      <div class="flex flex-col h-full bg-background p-4">
        <div class="empty-state">
          <div class="empty-state-icon text-2xl">[!]</div>
          <h3 class="empty-state-title">Identity Required</h3>
          <p class="empty-state-description">You need to set up your identity first.</p>
          {onCancel && (
            <button class="btn-terminal mt-4" onClick={onCancel}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  // Already verified
  if (peer.isTrusted) {
    return (
      <div class="flex flex-col h-full bg-background p-4">
        <div class="empty-state">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-terminal-green/10 rounded-full mb-4">
            <span class="text-3xl text-terminal-green">[V]</span>
          </div>
          <h3 class="empty-state-title">Already Verified</h3>
          <p class="empty-state-description">
            <span class="text-secondary">{peer.nickname}</span> is already a verified contact.
          </p>
          {onCancel && (
            <button class="btn-terminal mt-4" onClick={onCancel}>
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div class="flex flex-col h-full bg-background">
      {/* Header */}
      <div class="px-4 py-3 border-b border-muted flex items-center gap-3">
        <button
          class="btn-terminal-ghost btn-terminal-sm"
          onClick={handleBack}
          aria-label="Go back"
        >
          &lt;
        </button>
        <h2 class="text-terminal-lg font-bold text-primary flex-1">
          &gt; Verify {peer.nickname}
        </h2>
        {step === 'compare' && (
          <button
            class="btn-terminal-ghost btn-terminal-sm text-terminal-xs"
            onClick={() => setShowQR(!showQR)}
          >
            {showQR ? '[COMPARE]' : '[QR]'}
          </button>
        )}
      </div>

      {/* Progress indicator */}
      {step !== 'success' && (
        <div class="px-4 py-2 border-b border-muted/30">
          <div class="flex items-center gap-2 text-terminal-xs">
            <span class={step === 'compare' ? 'text-primary' : 'text-muted'}>
              1. Compare
            </span>
            <span class="text-muted">&gt;</span>
            <span class={step === 'confirm' ? 'text-primary' : 'text-muted'}>
              2. Confirm
            </span>
          </div>
        </div>
      )}

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4">
        {step === 'compare' && !showQR && (
          <div class="space-y-6">
            <FingerprintComparison
              yourFingerprint={identity.fingerprint}
              theirFingerprint={peer.fingerprint}
              theirNickname={peer.nickname}
            />
            <VerificationInstructions />
          </div>
        )}

        {step === 'compare' && showQR && (
          <div class="flex flex-col items-center">
            <QRCodeDisplay
              data={identity.publicKey}
              size={200}
              label="Your Public Key"
            />
            <p class="text-terminal-sm text-muted mt-6 text-center">
              Have {peer.nickname} scan this QR code to verify your identity
            </p>
          </div>
        )}

        {step === 'confirm' && (
          <ConfirmationDialog
            peerNickname={peer.nickname}
            onConfirm={handleConfirm}
            onCancel={handleBack}
          />
        )}

        {step === 'success' && (
          <SuccessView peerNickname={peer.nickname} onDone={handleDone} />
        )}
      </div>

      {/* Footer action (only for compare step) */}
      {step === 'compare' && !showQR && (
        <div class="px-4 py-3 border-t border-muted">
          <button class="btn-terminal w-full" onClick={handleProceed}>
            Fingerprints Match
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export { QRCodeDisplay, FingerprintComparison };
export type { VerifyPeerProps };
