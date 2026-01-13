/**
 * Identity Settings Component
 *
 * Displays and manages user's cryptographic identity:
 * - Public key (npub format)
 * - Fingerprint display
 * - Export identity (nsec backup)
 * - Change password
 * - QR code for sharing
 *
 * @module components/settings/IdentitySettings
 */

import { FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import {
  useIdentity,
  useNpub,
  useFingerprint,
  useIsKeyLoaded,
} from '../../stores/identity-store';

// ============================================================================
// Types
// ============================================================================

interface ExportState {
  status: 'idle' | 'exporting' | 'success' | 'error';
  nsec?: string;
  error?: string;
}

interface PasswordChangeState {
  status: 'idle' | 'changing' | 'success' | 'error';
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export const IdentitySettings: FunctionComponent = () => {
  const identity = useIdentity();
  const npub = useNpub();
  const fingerprint = useFingerprint();
  const isKeyLoaded = useIsKeyLoaded();

  // UI State
  const [showExportModal, setShowExportModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [passwordState, setPasswordState] = useState<PasswordChangeState>({
    status: 'idle',
  });

  // Form state for export
  const [exportPassword, setExportPassword] = useState('');
  const [exportPasswordVisible, setExportPasswordVisible] = useState(false);

  // Form state for password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }, []);

  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = useCallback(
    async (text: string, field: string) => {
      const success = await copyToClipboard(text);
      if (success) {
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      }
    },
    [copyToClipboard]
  );

  // Export identity (nsec)
  const handleExport = useCallback(async () => {
    if (!exportPassword.trim()) {
      setExportState({ status: 'error', error: 'Password required' });
      return;
    }

    setExportState({ status: 'exporting' });

    try {
      // Import the identity service dynamically to avoid circular deps
      const { IdentityService } = await import('../../services/identity');
      const identityService = IdentityService.getInstance();
      const backup = await identityService.exportAsNsec(exportPassword);
      setExportState({ status: 'success', nsec: backup.data });
    } catch (error) {
      setExportState({
        status: 'error',
        error:
          error instanceof Error ? error.message : 'Export failed - check password',
      });
    }
  }, [exportPassword]);

  // Change password
  const handlePasswordChange = useCallback(async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      setPasswordState({ status: 'error', error: 'All fields required' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordState({ status: 'error', error: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordState({
        status: 'error',
        error: 'New password must be at least 8 characters',
      });
      return;
    }

    setPasswordState({ status: 'changing' });

    try {
      const { IdentityService } = await import('../../services/identity');
      const identityService = IdentityService.getInstance();
      await identityService.changePassword(currentPassword, newPassword);
      setPasswordState({ status: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordState({ status: 'idle' });
      }, 1500);
    } catch (error) {
      setPasswordState({
        status: 'error',
        error:
          error instanceof Error
            ? error.message
            : 'Password change failed - check current password',
      });
    }
  }, [currentPassword, newPassword, confirmPassword]);

  // Close modals and reset state
  const closeExportModal = () => {
    setShowExportModal(false);
    setExportState({ status: 'idle' });
    setExportPassword('');
    setExportPasswordVisible(false);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordState({ status: 'idle' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Format npub for display (truncated)
  const formatNpub = (npub: string) => {
    if (!npub) return '---';
    return `${npub.slice(0, 16)}...${npub.slice(-8)}`;
  };

  // Format fingerprint for display
  const formatFingerprint = (fp: string) => {
    if (!fp) return '---';
    // Split into groups of 4 for readability
    return fp
      .slice(0, 32)
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join(' ') || fp;
  };

  // No identity state
  if (!identity) {
    return (
      <div class="space-y-4">
        <div class="text-terminal-yellow">
          [!] No identity found. Create or import an identity to continue.
        </div>
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Public Key (npub) */}
      <div class="space-y-2">
        <label class="block text-sm text-terminal-green/70">Public Key (npub)</label>
        <div class="flex items-center gap-2">
          <code class="flex-1 bg-terminal-bg border border-terminal-green/30 p-2 text-sm break-all">
            {npub ? formatNpub(npub) : '---'}
          </code>
          {npub && (
            <button
              onClick={() => handleCopy(npub, 'npub')}
              class="btn-terminal text-xs"
            >
              {copiedField === 'npub' ? '[OK]' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {/* Fingerprint */}
      <div class="space-y-2">
        <label class="block text-sm text-terminal-green/70">Fingerprint</label>
        <div class="flex items-center gap-2">
          <code class="flex-1 bg-terminal-bg border border-terminal-green/30 p-2 text-xs break-all font-mono">
            {fingerprint ? formatFingerprint(fingerprint) : '---'}
          </code>
          {fingerprint && (
            <button
              onClick={() => handleCopy(fingerprint, 'fingerprint')}
              class="btn-terminal text-xs"
            >
              {copiedField === 'fingerprint' ? '[OK]' : 'Copy'}
            </button>
          )}
        </div>
        <p class="text-xs text-terminal-green/50">
          Use this to verify identity with contacts
        </p>
      </div>

      {/* Key Status */}
      <div class="space-y-2">
        <label class="block text-sm text-terminal-green/70">Key Status</label>
        <div class="flex items-center gap-2">
          <span
            class={`${isKeyLoaded ? 'text-terminal-green' : 'text-terminal-yellow'}`}
          >
            {isKeyLoaded ? '[UNLOCKED]' : '[LOCKED]'}
          </span>
          <span class="text-terminal-green/60 text-sm">
            {isKeyLoaded
              ? 'Private key is loaded in memory'
              : 'Enter password to unlock'}
          </span>
        </div>
      </div>

      {/* Created Date */}
      {identity.createdAt && (
        <div class="space-y-2">
          <label class="block text-sm text-terminal-green/70">Created</label>
          <span class="text-terminal-green">
            {new Date(identity.createdAt).toLocaleDateString()} at{' '}
            {new Date(identity.createdAt).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div class="flex flex-wrap gap-3 pt-4 border-t border-terminal-green/20">
        <button onClick={() => setShowExportModal(true)} class="btn-terminal">
          Export Identity
        </button>
        <button onClick={() => setShowPasswordModal(true)} class="btn-terminal">
          Change Password
        </button>
        <button onClick={() => setShowQRModal(true)} class="btn-terminal">
          Show QR Code
        </button>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div class="bg-terminal-bg border border-terminal-green/50 p-6 max-w-md w-full">
            <h3 class="text-lg font-bold mb-4">&gt; Export Identity</h3>

            {exportState.status === 'success' && exportState.nsec ? (
              <div class="space-y-4">
                <div class="text-terminal-yellow text-sm">
                  [!] WARNING: This is your private key. Never share it!
                </div>
                <div class="bg-terminal-red/10 border border-terminal-red/30 p-4">
                  <code class="text-xs break-all text-terminal-red">
                    {exportPasswordVisible
                      ? exportState.nsec
                      : exportState.nsec.replace(/./g, '*')}
                  </code>
                </div>
                <div class="flex gap-2">
                  <button
                    onClick={() => setExportPasswordVisible(!exportPasswordVisible)}
                    class="btn-terminal text-sm"
                  >
                    {exportPasswordVisible ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => handleCopy(exportState.nsec!, 'nsec')}
                    class="btn-terminal text-sm"
                  >
                    {copiedField === 'nsec' ? '[Copied!]' : 'Copy'}
                  </button>
                </div>
                <button onClick={closeExportModal} class="btn-terminal w-full">
                  Done
                </button>
              </div>
            ) : (
              <div class="space-y-4">
                <p class="text-sm text-terminal-green/70">
                  Enter your password to export your private key (nsec format).
                </p>
                <div>
                  <label class="block text-sm mb-1">Password</label>
                  <input
                    type="password"
                    value={exportPassword}
                    onInput={(e) =>
                      setExportPassword((e.target as HTMLInputElement).value)
                    }
                    class="input-terminal w-full"
                    placeholder="Enter your password"
                  />
                </div>
                {exportState.status === 'error' && (
                  <div class="text-terminal-red text-sm">
                    [!] {exportState.error}
                  </div>
                )}
                <div class="flex gap-2">
                  <button onClick={closeExportModal} class="btn-terminal flex-1">
                    Cancel
                  </button>
                  <button
                    onClick={handleExport}
                    disabled={exportState.status === 'exporting'}
                    class="btn-terminal flex-1"
                  >
                    {exportState.status === 'exporting' ? 'Exporting...' : 'Export'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div class="bg-terminal-bg border border-terminal-green/50 p-6 max-w-md w-full">
            <h3 class="text-lg font-bold mb-4">&gt; Change Password</h3>

            {passwordState.status === 'success' ? (
              <div class="text-terminal-green text-center py-4">
                [OK] Password changed successfully!
              </div>
            ) : (
              <div class="space-y-4">
                <div>
                  <label class="block text-sm mb-1">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onInput={(e) =>
                      setCurrentPassword((e.target as HTMLInputElement).value)
                    }
                    class="input-terminal w-full"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label class="block text-sm mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onInput={(e) =>
                      setNewPassword((e.target as HTMLInputElement).value)
                    }
                    class="input-terminal w-full"
                    placeholder="Enter new password (min 8 chars)"
                  />
                </div>
                <div>
                  <label class="block text-sm mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onInput={(e) =>
                      setConfirmPassword((e.target as HTMLInputElement).value)
                    }
                    class="input-terminal w-full"
                    placeholder="Confirm new password"
                  />
                </div>
                {passwordState.status === 'error' && (
                  <div class="text-terminal-red text-sm">
                    [!] {passwordState.error}
                  </div>
                )}
                <div class="flex gap-2">
                  <button onClick={closePasswordModal} class="btn-terminal flex-1">
                    Cancel
                  </button>
                  <button
                    onClick={handlePasswordChange}
                    disabled={passwordState.status === 'changing'}
                    class="btn-terminal flex-1"
                  >
                    {passwordState.status === 'changing' ? 'Changing...' : 'Change'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div class="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div class="bg-terminal-bg border border-terminal-green/50 p-6 max-w-md w-full text-center">
            <h3 class="text-lg font-bold mb-4">&gt; Share Identity</h3>

            {npub ? (
              <div class="space-y-4">
                {/* ASCII Art QR placeholder - real implementation would use a QR library */}
                <div class="bg-white p-4 inline-block">
                  <div class="font-mono text-black text-xs leading-none whitespace-pre">
                    {generateASCIIQRPlaceholder()}
                  </div>
                </div>
                <p class="text-sm text-terminal-green/70">
                  Scan to add this identity
                </p>
                <code class="block text-xs break-all bg-terminal-bg border border-terminal-green/30 p-2">
                  {npub}
                </code>
                <button
                  onClick={() => setShowQRModal(false)}
                  class="btn-terminal w-full"
                >
                  Close
                </button>
              </div>
            ) : (
              <div class="text-terminal-yellow">No identity to share</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Generate a simple ASCII art placeholder for QR code
 * In production, use a proper QR code library like qrcode
 */
function generateASCIIQRPlaceholder(): string {
  // This is a simplified placeholder
  // Real implementation would generate actual QR code
  const size = 21;
  const lines: string[] = [];

  for (let y = 0; y < size; y++) {
    let line = '';
    for (let x = 0; x < size; x++) {
      // Create corner patterns
      const isCornerArea =
        (x < 7 && y < 7) || // top-left
        (x >= size - 7 && y < 7) || // top-right
        (x < 7 && y >= size - 7); // bottom-left

      if (isCornerArea) {
        // Finder pattern
        const cx = x < 7 ? x : x >= size - 7 ? x - (size - 7) : x;
        const cy = y < 7 ? y : y >= size - 7 ? y - (size - 7) : y;

        if (
          cx === 0 ||
          cy === 0 ||
          cx === 6 ||
          cy === 6 ||
          (cx >= 2 && cx <= 4 && cy >= 2 && cy <= 4)
        ) {
          line += '\u2588\u2588';
        } else {
          line += '  ';
        }
      } else {
        // Data area - pseudo-random pattern based on position
        line += (x + y) % 3 === 0 ? '\u2588\u2588' : '  ';
      }
    }
    lines.push(line);
  }

  return lines.join('\n');
}

export default IdentitySettings;
