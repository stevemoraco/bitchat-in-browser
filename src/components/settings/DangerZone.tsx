/**
 * Danger Zone Component
 *
 * Destructive actions with confirmation dialogs:
 * - Reset identity (generate new keys)
 * - Wipe all data (complete reset)
 *
 * These actions are irreversible and require multiple confirmations.
 *
 * @module components/settings/DangerZone
 */

import type { FunctionComponent, VNode } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useIdentityStore } from '../../stores/identity-store';

// ============================================================================
// Types
// ============================================================================

type ConfirmationStep = 'idle' | 'warning' | 'confirm' | 'final' | 'processing' | 'success' | 'error';

interface DangerActionState {
  step: ConfirmationStep;
  confirmText: string;
  error?: string;
}

// ============================================================================
// Constants
// ============================================================================

const RESET_IDENTITY_CONFIRM_TEXT = 'RESET MY IDENTITY';
const WIPE_ALL_DATA_CONFIRM_TEXT = 'WIPE EVERYTHING';

// ============================================================================
// Component
// ============================================================================

export const DangerZone: FunctionComponent = () => {
  // State for each destructive action
  const [resetIdentityState, setResetIdentityState] = useState<DangerActionState>({
    step: 'idle',
    confirmText: '',
  });
  const [wipeAllState, setWipeAllState] = useState<DangerActionState>({
    step: 'idle',
    confirmText: '',
  });

  // Password for reset identity
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Get identity store methods
  const clearIdentity = useIdentityStore((state) => state.clearIdentity);

  // Handle reset identity flow
  const handleResetIdentity = useCallback(async () => {
    const { step, confirmText } = resetIdentityState;

    if (step === 'idle') {
      setResetIdentityState({ step: 'warning', confirmText: '' });
      return;
    }

    if (step === 'warning') {
      setResetIdentityState({ step: 'confirm', confirmText: '' });
      return;
    }

    if (step === 'confirm') {
      if (confirmText !== RESET_IDENTITY_CONFIRM_TEXT) {
        setResetIdentityState({
          ...resetIdentityState,
          error: `Type "${RESET_IDENTITY_CONFIRM_TEXT}" exactly`,
        });
        return;
      }
      setResetIdentityState({ step: 'final', confirmText });
      return;
    }

    if (step === 'final') {
      if (newPassword.length < 8) {
        setResetIdentityState({
          ...resetIdentityState,
          error: 'Password must be at least 8 characters',
        });
        return;
      }

      if (newPassword !== confirmPassword) {
        setResetIdentityState({
          ...resetIdentityState,
          error: 'Passwords do not match',
        });
        return;
      }

      setResetIdentityState({ step: 'processing', confirmText });

      try {
        // Import and use identity service
        const { IdentityService } = await import('../../services/identity');
        const identityService = IdentityService.getInstance();

        // Wipe existing identity
        await identityService.wipeAll();

        // Generate new identity
        await identityService.generateNewIdentity(newPassword);

        setResetIdentityState({ step: 'success', confirmText: '' });
        setNewPassword('');
        setConfirmPassword('');

        // Auto-reset after showing success
        setTimeout(() => {
          setResetIdentityState({ step: 'idle', confirmText: '' });
        }, 3000);
      } catch (error) {
        setResetIdentityState({
          step: 'error',
          confirmText: '',
          error: error instanceof Error ? error.message : 'Reset failed',
        });
      }
    }
  }, [resetIdentityState, newPassword, confirmPassword]);

  // Handle wipe all data flow
  const handleWipeAll = useCallback(async () => {
    const { step, confirmText } = wipeAllState;

    if (step === 'idle') {
      setWipeAllState({ step: 'warning', confirmText: '' });
      return;
    }

    if (step === 'warning') {
      setWipeAllState({ step: 'confirm', confirmText: '' });
      return;
    }

    if (step === 'confirm') {
      if (confirmText !== WIPE_ALL_DATA_CONFIRM_TEXT) {
        setWipeAllState({
          ...wipeAllState,
          error: `Type "${WIPE_ALL_DATA_CONFIRM_TEXT}" exactly`,
        });
        return;
      }
      setWipeAllState({ step: 'final', confirmText });
      return;
    }

    if (step === 'final') {
      setWipeAllState({ step: 'processing', confirmText });

      try {
        // Import services
        const { IdentityService } = await import('../../services/identity');
        const { getStorageManager } = await import('../../services/storage');

        const identityService = IdentityService.getInstance();
        const storageManager = getStorageManager();

        // Wipe identity
        await identityService.wipeAll();

        // Wipe all storage
        await storageManager.initialize();
        await storageManager.clearAllData();

        // Clear Zustand store
        clearIdentity();

        setWipeAllState({ step: 'success', confirmText: '' });

        // Reload the page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } catch (error) {
        setWipeAllState({
          step: 'error',
          confirmText: '',
          error: error instanceof Error ? error.message : 'Wipe failed',
        });
      }
    }
  }, [wipeAllState, clearIdentity]);

  // Cancel handlers
  const cancelResetIdentity = () => {
    setResetIdentityState({ step: 'idle', confirmText: '' });
    setNewPassword('');
    setConfirmPassword('');
  };

  const cancelWipeAll = () => {
    setWipeAllState({ step: 'idle', confirmText: '' });
  };

  // Render confirmation modal
  const renderConfirmationModal = (
    actionState: DangerActionState,
    title: string,
    warningMessage: string,
    confirmMessage: string,
    confirmPhrase: string,
    onConfirm: () => void,
    onCancel: () => void,
    setConfirmText: (text: string) => void,
    renderFinalStep?: () => VNode
  ) => {
    if (actionState.step === 'idle') return null;

    return (
      <div class="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
        <div class="bg-terminal-bg border-2 border-terminal-red p-6 max-w-md w-full">
          <h3 class="text-lg font-bold text-terminal-red mb-4">
            [!!] {title}
          </h3>

          {/* Warning Step */}
          {actionState.step === 'warning' && (
            <div class="space-y-4">
              <div class="p-4 border border-terminal-red/50 bg-terminal-red/10 text-sm">
                <p class="text-terminal-red font-bold mb-2">WARNING</p>
                <p class="text-terminal-red/80">{warningMessage}</p>
              </div>
              <div class="flex gap-2">
                <button onClick={onCancel} class="btn-terminal flex-1">
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  class="flex-1 px-4 py-2 border border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-terminal-bg transition-colors"
                >
                  I Understand
                </button>
              </div>
            </div>
          )}

          {/* Confirm Step */}
          {actionState.step === 'confirm' && (
            <div class="space-y-4">
              <p class="text-terminal-red/80 text-sm">{confirmMessage}</p>
              <div class="p-3 border border-terminal-red/50 text-center">
                <code class="text-terminal-red font-bold">{confirmPhrase}</code>
              </div>
              <input
                type="text"
                value={actionState.confirmText}
                onInput={(e) => setConfirmText((e.target as HTMLInputElement).value)}
                placeholder="Type the phrase above"
                class="w-full bg-transparent border border-terminal-red/50 text-terminal-red px-3 py-2 placeholder:text-terminal-red/30"
              />
              {actionState.error && (
                <div class="text-terminal-red text-xs">[!] {actionState.error}</div>
              )}
              <div class="flex gap-2">
                <button onClick={onCancel} class="btn-terminal flex-1">
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  class="flex-1 px-4 py-2 border border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-terminal-bg transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Final Step */}
          {actionState.step === 'final' && (
            <div class="space-y-4">
              {renderFinalStep ? (
                renderFinalStep()
              ) : (
                <>
                  <p class="text-terminal-red text-sm">
                    This is your last chance to cancel. Are you absolutely sure?
                  </p>
                  <div class="flex gap-2">
                    <button onClick={onCancel} class="btn-terminal flex-1">
                      Cancel
                    </button>
                    <button
                      onClick={onConfirm}
                      class="flex-1 px-4 py-2 bg-terminal-red border border-terminal-red text-terminal-bg font-bold hover:bg-terminal-red/80 transition-colors"
                    >
                      CONFIRM
                    </button>
                  </div>
                </>
              )}
              {actionState.error && (
                <div class="text-terminal-red text-xs">[!] {actionState.error}</div>
              )}
            </div>
          )}

          {/* Processing Step */}
          {actionState.step === 'processing' && (
            <div class="text-center py-8">
              <div class="text-terminal-red text-2xl animate-pulse">[...]</div>
              <p class="text-terminal-red/70 mt-4">Processing...</p>
            </div>
          )}

          {/* Success Step */}
          {actionState.step === 'success' && (
            <div class="text-center py-8">
              <div class="text-terminal-green text-2xl">[OK]</div>
              <p class="text-terminal-green mt-4">Operation completed successfully</p>
            </div>
          )}

          {/* Error Step */}
          {actionState.step === 'error' && (
            <div class="space-y-4">
              <div class="text-center py-4">
                <div class="text-terminal-red text-2xl">[!!]</div>
                <p class="text-terminal-red mt-4">{actionState.error}</p>
              </div>
              <button onClick={onCancel} class="btn-terminal w-full">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div class="space-y-6">
      {/* Warning Header */}
      <div class="p-4 border border-terminal-red/50 bg-terminal-red/10">
        <p class="text-terminal-red font-bold mb-2">[!!] DANGER ZONE</p>
        <p class="text-terminal-red/70 text-sm">
          The actions below are destructive and cannot be undone. Please make sure
          you have exported your identity and backed up any important data before
          proceeding.
        </p>
      </div>

      {/* Reset Identity */}
      <div class="p-4 border border-terminal-red/30">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <span class="font-bold text-terminal-red">Reset Identity</span>
            <p class="text-xs text-terminal-red/60 mt-1">
              Generate a completely new cryptographic identity. Your current keys,
              npub, and fingerprint will be permanently destroyed. Messages will be
              preserved but you'll appear as a new user.
            </p>
          </div>
          <button
            onClick={handleResetIdentity}
            class="px-4 py-2 border border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-terminal-bg text-sm transition-colors flex-shrink-0"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Wipe All Data */}
      <div class="p-4 border border-terminal-red/30">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <span class="font-bold text-terminal-red">Wipe All Data</span>
            <p class="text-xs text-terminal-red/60 mt-1">
              Completely erase all data including your identity, messages, channels,
              settings, and cached relay data. The app will return to its initial
              state as if freshly installed.
            </p>
          </div>
          <button
            onClick={handleWipeAll}
            class="px-4 py-2 border border-terminal-red text-terminal-red hover:bg-terminal-red hover:text-terminal-bg text-sm transition-colors flex-shrink-0"
          >
            Wipe
          </button>
        </div>
      </div>

      {/* Reset Identity Modal */}
      {renderConfirmationModal(
        resetIdentityState,
        'Reset Identity',
        'You are about to destroy your current identity. This will generate a new cryptographic keypair. Your npub will change, and anyone you\'ve communicated with will see you as a completely different person. This action CANNOT be undone.',
        'To continue, type the following phrase exactly:',
        RESET_IDENTITY_CONFIRM_TEXT,
        handleResetIdentity,
        cancelResetIdentity,
        (text: string) =>
          setResetIdentityState({ ...resetIdentityState, confirmText: text }),
        () => (
          <>
            <p class="text-terminal-red/80 text-sm mb-4">
              Enter a password for your new identity:
            </p>
            <div class="space-y-3">
              <input
                type="password"
                value={newPassword}
                onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
                placeholder="New password (min 8 characters)"
                class="w-full bg-transparent border border-terminal-red/50 text-terminal-red px-3 py-2 placeholder:text-terminal-red/30"
              />
              <input
                type="password"
                value={confirmPassword}
                onInput={(e) =>
                  setConfirmPassword((e.target as HTMLInputElement).value)
                }
                placeholder="Confirm new password"
                class="w-full bg-transparent border border-terminal-red/50 text-terminal-red px-3 py-2 placeholder:text-terminal-red/30"
              />
            </div>
            <div class="flex gap-2 mt-4">
              <button onClick={cancelResetIdentity} class="btn-terminal flex-1">
                Cancel
              </button>
              <button
                onClick={handleResetIdentity}
                class="flex-1 px-4 py-2 bg-terminal-red border border-terminal-red text-terminal-bg font-bold hover:bg-terminal-red/80 transition-colors"
              >
                CREATE NEW IDENTITY
              </button>
            </div>
          </>
        )
      )}

      {/* Wipe All Data Modal */}
      {renderConfirmationModal(
        wipeAllState,
        'Wipe All Data',
        'You are about to PERMANENTLY DELETE all data stored by BitChat. This includes your identity, private keys, messages, channel memberships, settings, and all cached data. The app will reload in a fresh state. This action is IRREVERSIBLE.',
        'To continue, type the following phrase exactly:',
        WIPE_ALL_DATA_CONFIRM_TEXT,
        handleWipeAll,
        cancelWipeAll,
        (text: string) =>
          setWipeAllState({ ...wipeAllState, confirmText: text })
      )}

      {/* Emergency Wipe Info */}
      <div class="p-3 border border-terminal-red/20 text-xs text-terminal-red/50">
        <p class="font-bold mb-1">Emergency Wipe</p>
        <p>
          For quick emergency data wipe, triple-tap the BitChat logo from the main
          screen. This will immediately erase all data without confirmation.
        </p>
      </div>
    </div>
  );
};

export default DangerZone;
