/**
 * ImportIdentityStep - Import existing Nostr identity
 *
 * Features:
 * - Import nsec key (bech32 format)
 * - Import mnemonic (BIP-39 phrase)
 * - Import hex private key
 * - Auto-detect format
 * - Password to encrypt locally
 * - Show public key preview on valid input
 */

import type { FunctionComponent } from 'preact';
import { useState, useCallback, useMemo, useEffect } from 'preact/hooks';
import {
  IdentityService,
  validateImport,
  importKey,
  detectImportFormat,
  sanitizeImportInput,
  generateVisualFingerprint,
  type ImportFormat,
  type ImportValidation,
} from '../../services/identity';
import { getStorageManager } from '../../services/storage';

// ============================================================================
// Types
// ============================================================================

export interface ImportIdentityStepProps {
  /** Called when identity is successfully imported */
  onComplete: (password: string) => void;
  /** Called when user wants to go back */
  onBack: () => void;
}

// ============================================================================
// Format Labels
// ============================================================================

const FORMAT_LABELS: Record<ImportFormat, { label: string; hint: string }> = {
  nsec: {
    label: 'Nostr Secret Key (nsec)',
    hint: 'Starts with nsec1...',
  },
  hex: {
    label: 'Hex Private Key',
    hint: '64 hexadecimal characters',
  },
  mnemonic: {
    label: 'Mnemonic Phrase',
    hint: '12, 15, 18, 21, or 24 words',
  },
};

// ============================================================================
// Component
// ============================================================================

export const ImportIdentityStep: FunctionComponent<ImportIdentityStepProps> = ({
  onComplete,
  onBack: _onBack,
}) => {
  // Note: onBack is handled by parent component via floating back button
  void _onBack;
  // Form state
  const [keyInput, setKeyInput] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassphraseField, setShowPassphraseField] = useState(false);

  // Validation state
  const [validation, setValidation] = useState<ImportValidation | null>(null);
  const detectedFormat = useMemo(
    () => detectImportFormat(keyInput.trim()),
    [keyInput]
  );

  // Validate key input on change
  useEffect(() => {
    const trimmed = keyInput.trim();
    if (!trimmed) {
      setValidation(null);
      return;
    }

    const result = validateImport(trimmed);
    setValidation(result);

    // Show passphrase field for mnemonic
    setShowPassphraseField(result.format === 'mnemonic');
  }, [keyInput]);

  // Password validation
  const passwordsMatch = password === confirmPassword;
  const isPasswordValid = password.length >= 8;
  const isKeyValid = validation?.valid ?? false;
  const canSubmit =
    isKeyValid && isPasswordValid && passwordsMatch && !isImporting;

  // Handle key input change
  const handleKeyInputChange = useCallback(
    (e: Event) => {
      const value = (e.target as HTMLTextAreaElement).value;
      setKeyInput(value);
      setError(null);
    },
    []
  );

  // Sanitize input on blur
  const handleKeyInputBlur = useCallback(() => {
    if (keyInput) {
      setKeyInput(sanitizeImportInput(keyInput));
    }
  }, [keyInput]);

  // Import identity
  const handleImport = useCallback(async () => {
    if (!canSubmit) return;

    setIsImporting(true);
    setError(null);

    try {
      // Import the key
      const importResult = await importKey(keyInput.trim(), passphrase);

      if (!importResult.success || !importResult.privateKey) {
        throw new Error(importResult.error ?? 'Failed to import key');
      }

      // Initialize storage
      const storageManager = getStorageManager();
      await storageManager.initialize();

      // Get identity service instance
      const identityService = IdentityService.getInstance();
      await identityService.initialize({ storage: storageManager });

      // Generate identity from imported seed
      await identityService.generateFromSeed(importResult.privateKey, password);

      // Securely clear the private key from memory
      importResult.privateKey.fill(0);

      // Complete step
      onComplete(password);
    } catch (err) {
      console.error('Failed to import identity:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to import identity. Please check your input and try again.'
      );
    } finally {
      setIsImporting(false);
    }
  }, [canSubmit, keyInput, passphrase, password, onComplete]);

  // Handle form submit
  const handleSubmit = useCallback(
    (e: Event) => {
      e.preventDefault();
      handleImport();
    },
    [handleImport]
  );

  // Generate fingerprint preview
  const fingerprintPreview = useMemo(() => {
    if (!validation?.valid || !validation.publicKey) return null;
    const visualFp = generateVisualFingerprint(validation.publicKey);
    return visualFp.short;
  }, [validation]);

  return (
    <div>
      {/* Header */}
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-terminal-green font-mono mb-2">
          Import Identity
        </h2>
        <p class="text-terminal-green/70 font-mono text-sm">
          Enter your existing Nostr key
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} class="space-y-4">
        {/* Key input */}
        <div>
          <label class="block text-terminal-green/70 font-mono text-sm mb-1">
            Private Key or Mnemonic
          </label>
          <textarea
            value={keyInput}
            onInput={handleKeyInputChange}
            onBlur={handleKeyInputBlur}
            class={`w-full px-3 py-2 bg-terminal-bg border rounded-terminal text-terminal-green font-mono text-sm focus:outline-none resize-none h-24 ${
              keyInput && !validation?.valid
                ? 'border-terminal-red focus:border-terminal-red'
                : validation?.valid
                  ? 'border-terminal-green focus:border-terminal-green'
                  : 'border-terminal-green/30 focus:border-terminal-green'
            }`}
            placeholder="nsec1... or 64 hex chars or mnemonic phrase"
            disabled={isImporting}
            spellcheck={false}
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
          />

          {/* Format detection indicator */}
          {detectedFormat && (
            <div class="mt-2 flex items-center gap-2">
              <span
                class={`text-xs font-mono px-2 py-0.5 rounded ${
                  validation?.valid
                    ? 'bg-terminal-green/20 text-terminal-green'
                    : 'bg-terminal-yellow/20 text-terminal-yellow'
                }`}
              >
                {FORMAT_LABELS[detectedFormat]?.label ?? 'Unknown format'}
              </span>
              {validation?.npubPreview && (
                <span class="text-xs text-terminal-green/60 font-mono">
                  {validation.npubPreview}
                </span>
              )}
            </div>
          )}

          {/* Validation error */}
          {keyInput && validation && !validation.valid && (
            <p class="mt-1 text-xs text-terminal-red font-mono">
              {validation.error}
            </p>
          )}

          {/* Fingerprint preview */}
          {fingerprintPreview && (
            <div class="mt-2 p-2 bg-terminal-green/10 border border-terminal-green/20 rounded-terminal">
              <p class="text-xs text-terminal-green/60 font-mono">
                Fingerprint: <span class="text-terminal-green">{fingerprintPreview}</span>
              </p>
            </div>
          )}
        </div>

        {/* Passphrase field (for mnemonic) */}
        {showPassphraseField && (
          <div>
            <label class="block text-terminal-green/70 font-mono text-sm mb-1">
              BIP-39 Passphrase (optional)
            </label>
            <input
              type="text"
              value={passphrase}
              onInput={(e) =>
                setPassphrase((e.target as HTMLInputElement).value)
              }
              class="w-full px-3 py-2 bg-terminal-bg border border-terminal-green/30 rounded-terminal text-terminal-green font-mono focus:outline-none focus:border-terminal-green"
              placeholder="Leave empty if none"
              disabled={isImporting}
            />
            <p class="mt-1 text-xs text-terminal-green/50 font-mono">
              Only enter if your mnemonic was created with a passphrase
            </p>
          </div>
        )}

        {/* Divider */}
        <div class="border-t border-terminal-green/20 my-4" />

        {/* Password section */}
        <p class="text-terminal-green/60 font-mono text-sm">
          Choose a password to encrypt your key locally:
        </p>

        {/* Password field */}
        <div>
          <label class="block text-terminal-green/70 font-mono text-sm mb-1">
            Password
          </label>
          <div class="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              class="w-full px-3 py-2 bg-terminal-bg border border-terminal-green/30 rounded-terminal text-terminal-green font-mono focus:outline-none focus:border-terminal-green pr-10"
              placeholder="Min 8 characters"
              minLength={8}
              required
              disabled={isImporting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-terminal-green/50 hover:text-terminal-green transition-colors p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg
                  class="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
              ) : (
                <svg
                  class="w-5 h-5"
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
              )}
            </button>
          </div>
        </div>

        {/* Confirm password field */}
        <div>
          <label class="block text-terminal-green/70 font-mono text-sm mb-1">
            Confirm Password
          </label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onInput={(e) =>
              setConfirmPassword((e.target as HTMLInputElement).value)
            }
            class={`w-full px-3 py-2 bg-terminal-bg border rounded-terminal text-terminal-green font-mono focus:outline-none ${
              confirmPassword && !passwordsMatch
                ? 'border-terminal-red focus:border-terminal-red'
                : 'border-terminal-green/30 focus:border-terminal-green'
            }`}
            placeholder="Repeat password"
            required
            disabled={isImporting}
          />
          {confirmPassword && !passwordsMatch && (
            <p class="mt-1 text-xs text-terminal-red font-mono">
              Passwords do not match
            </p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div class="p-3 bg-terminal-red/10 border border-terminal-red/30 rounded-terminal">
            <p class="text-sm text-terminal-red font-mono">{error}</p>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={!canSubmit}
          class={`w-full py-3 px-6 font-mono font-bold text-lg rounded-terminal transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-terminal-bg ${
            canSubmit
              ? 'bg-terminal-green text-terminal-bg hover:bg-terminal-green/90 focus:ring-terminal-green'
              : 'bg-terminal-green/30 text-terminal-bg/50 cursor-not-allowed'
          }`}
        >
          {isImporting ? (
            <span class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Importing...
            </span>
          ) : (
            'Import Identity'
          )}
        </button>
      </form>

      {/* Format hints */}
      <div class="mt-6 space-y-2">
        <p class="text-xs text-terminal-green/40 font-mono">Supported formats:</p>
        <ul class="text-xs text-terminal-green/30 font-mono space-y-1">
          {Object.entries(FORMAT_LABELS).map(([key, { label, hint }]) => (
            <li key={key}>
              - {label}: {hint}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ImportIdentityStep;
