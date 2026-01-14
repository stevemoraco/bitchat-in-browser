/**
 * BackupStep - Backup your newly created identity
 *
 * Features:
 * - Display nsec for backup
 * - Copy to clipboard
 * - Download backup file
 * - Confirm backup checkbox
 * - Security warnings
 */

import type { FunctionComponent } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';
import { IdentityService, type KeyBackup } from '../../services/identity';

// ============================================================================
// Types
// ============================================================================

export interface BackupStepProps {
  /** Password to decrypt keys for export */
  password: string;
  /** Called when backup is confirmed */
  onComplete: () => void;
  /** Called when user wants to go back */
  onBack: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const BackupStep: FunctionComponent<BackupStepProps> = ({
  password,
  onComplete,
  onBack,
}) => {
  // State
  const [nsec, setNsec] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNsec, setShowNsec] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Load backup data
  useEffect(() => {
    const loadBackup = async () => {
      try {
        const identityService = IdentityService.getInstance();
        const backup = await identityService.exportAsNsec(password);

        setNsec(backup.data);
        setFingerprint(backup.fingerprint.slice(0, 16).toUpperCase());
      } catch (err) {
        console.error('Failed to load backup:', err);
        setError('Failed to export key for backup');
      } finally {
        setIsLoading(false);
      }
    };

    loadBackup();
  }, [password]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!nsec) return;

    try {
      await navigator.clipboard.writeText(nsec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = nsec;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [nsec]);

  // Download backup file
  const handleDownload = useCallback(() => {
    if (!nsec || !fingerprint) return;

    const backupData: KeyBackup = {
      version: 1,
      type: 'nsec',
      data: nsec,
      exportedAt: Date.now(),
      publicKey: '', // Not included for security
      fingerprint,
    };

    const content = JSON.stringify(backupData, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `bitchat-backup-${fingerprint.slice(0, 8)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloaded(true);
  }, [nsec, fingerprint]);

  // Can proceed
  const canProceed = confirmed;

  // Handle continue
  const handleContinue = useCallback(() => {
    if (canProceed) {
      onComplete();
    }
  }, [canProceed, onComplete]);

  if (isLoading) {
    return (
      <div class="text-center">
        <div class="animate-spin h-8 w-8 border-2 border-terminal-green border-t-transparent rounded-full mx-auto mb-4" />
        <p class="text-terminal-green/70 font-mono">Preparing backup...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div class="text-center">
        <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center border-2 border-terminal-red rounded-full">
          <svg
            class="w-8 h-8 text-terminal-red"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>
        <p class="text-terminal-red font-mono mb-4">{error}</p>
        <button
          onClick={onBack}
          class="px-4 py-2 text-terminal-green font-mono hover:text-terminal-green/80 transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div class="text-center mb-6">
        <div class="w-12 h-12 mx-auto mb-3 flex items-center justify-center border-2 border-terminal-yellow rounded-full">
          <svg
            class="w-6 h-6 text-terminal-yellow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-terminal-green font-mono mb-2">
          Backup Your Key
        </h2>
        <p class="text-terminal-yellow/80 font-mono text-sm">
          Save this key - it's the only way to recover your identity!
        </p>
      </div>

      {/* nsec display */}
      <div class="mb-4">
        <label class="block text-terminal-green/70 font-mono text-sm mb-2">
          Your Secret Key (nsec)
        </label>
        <div class="relative">
          <div
            class={`p-3 bg-terminal-bg border border-terminal-green/30 rounded-terminal font-mono text-sm break-all ${
              showNsec ? 'text-terminal-green' : 'text-transparent'
            }`}
            style={{
              textShadow: showNsec ? 'none' : '0 0 8px rgba(0, 255, 0, 0.8)',
            }}
          >
            {nsec}
          </div>

          {/* Reveal button overlay */}
          {!showNsec && (
            <button
              onClick={() => setShowNsec(true)}
              class="absolute inset-0 flex items-center justify-center bg-terminal-bg/80 rounded-terminal"
            >
              <span class="text-terminal-green font-mono text-sm flex items-center gap-2">
                <svg
                  class="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Click to reveal
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div class="flex gap-2 mb-6">
        <button
          onClick={handleCopy}
          class={`flex-1 py-2 px-4 border font-mono text-sm rounded-terminal transition-colors flex items-center justify-center gap-2 ${
            copied
              ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
              : 'border-terminal-green/30 text-terminal-green/70 hover:text-terminal-green hover:border-terminal-green/50'
          }`}
        >
          {copied ? (
            <>
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </>
          )}
        </button>

        <button
          onClick={handleDownload}
          class={`flex-1 py-2 px-4 border font-mono text-sm rounded-terminal transition-colors flex items-center justify-center gap-2 ${
            downloaded
              ? 'border-terminal-green bg-terminal-green/10 text-terminal-green'
              : 'border-terminal-green/30 text-terminal-green/70 hover:text-terminal-green hover:border-terminal-green/50'
          }`}
        >
          {downloaded ? (
            <>
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Downloaded
            </>
          ) : (
            <>
              <svg
                class="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </>
          )}
        </button>
      </div>

      {/* Warning box */}
      <div class="p-3 bg-terminal-red/10 border border-terminal-red/30 rounded-terminal mb-6">
        <p class="text-sm text-terminal-red/90 font-mono">
          <strong>Warning:</strong> Anyone with this key can access your
          identity. Never share it. Store it securely offline.
        </p>
      </div>

      {/* Fingerprint for reference */}
      <div class="p-3 bg-terminal-green/5 border border-terminal-green/20 rounded-terminal mb-6">
        <p class="text-xs text-terminal-green/60 font-mono mb-1">
          Your fingerprint (for verification):
        </p>
        <p class="text-sm text-terminal-green font-mono">{fingerprint}</p>
      </div>

      {/* Confirmation checkbox */}
      <label class="flex items-start gap-3 mb-6 cursor-pointer group">
        <div class="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) =>
              setConfirmed((e.target as HTMLInputElement).checked)
            }
            class="sr-only"
          />
          <div
            class={`w-5 h-5 border-2 rounded transition-colors flex items-center justify-center ${
              confirmed
                ? 'border-terminal-green bg-terminal-green/20'
                : 'border-terminal-green/40 group-hover:border-terminal-green/60'
            }`}
          >
            {confirmed && (
              <svg
                class="w-3 h-3 text-terminal-green"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="3"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
        </div>
        <span class="text-sm text-terminal-green/80 font-mono">
          I have saved my backup key in a secure location and understand that I
          cannot recover my identity without it
        </span>
      </label>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        disabled={!canProceed}
        class={`w-full py-3 px-6 font-mono font-bold text-lg rounded-terminal transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-terminal-bg ${
          canProceed
            ? 'bg-terminal-green text-terminal-bg hover:bg-terminal-green/90 focus:ring-terminal-green'
            : 'bg-terminal-green/30 text-terminal-bg/50 cursor-not-allowed'
        }`}
      >
        Continue
      </button>

      {/* Skip warning */}
      <p class="mt-4 text-xs text-terminal-green/40 font-mono text-center">
        You can export your key again later from Settings
      </p>
    </div>
  );
};

export default BackupStep;
