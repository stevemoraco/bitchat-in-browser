/**
 * CreateIdentityStep - Generate new identity with password protection
 *
 * Features:
 * - Generate new cryptographic identity
 * - Password creation with strength meter
 * - Password confirmation
 * - Display generated fingerprint for verification
 */

import { FunctionComponent } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import { IdentityService, generateVisualFingerprint } from '../../services/identity';
import { getStorageManager } from '../../services/storage';

// ============================================================================
// Types
// ============================================================================

export interface CreateIdentityStepProps {
  /** Called when identity is successfully created */
  onComplete: (password: string) => void;
  /** Called when user wants to go back */
  onBack: () => void;
}

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
}

// ============================================================================
// Password Strength Calculator
// ============================================================================

function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: 'Enter password', color: 'terminal-green/30' };
  }

  let score = 0;

  // Length checks
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;

  // Character variety
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  // Cap at 4
  score = Math.min(score, 4);

  const labels: Record<number, { label: string; color: string }> = {
    0: { label: 'Too weak', color: 'terminal-red' },
    1: { label: 'Weak', color: 'terminal-red' },
    2: { label: 'Fair', color: 'terminal-yellow' },
    3: { label: 'Good', color: 'terminal-green/70' },
    4: { label: 'Strong', color: 'terminal-green' },
  };

  const info = labels[score] ?? labels[0]!;
  return { score, ...info };
}

// ============================================================================
// Component
// ============================================================================

export const CreateIdentityStep: FunctionComponent<CreateIdentityStepProps> = ({
  onComplete,
  onBack: _onBack,
}) => {
  // Note: onBack is handled by parent component via floating back button
  void _onBack;
  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedFingerprint, setGeneratedFingerprint] = useState<string | null>(null);

  // Password strength
  const strength = useMemo(() => calculatePasswordStrength(password), [password]);

  // Validation
  const passwordsMatch = password === confirmPassword;
  const isPasswordValid = password.length >= 8;
  const canSubmit = isPasswordValid && passwordsMatch && !isGenerating;

  // Generate identity
  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;

    setIsGenerating(true);
    setError(null);

    try {
      // Initialize storage
      const storageManager = getStorageManager();
      await storageManager.initialize();

      // Get identity service instance
      const identityService = IdentityService.getInstance();
      await identityService.initialize({ storage: storageManager });

      // Generate new identity
      const identity = await identityService.generateNewIdentity(password);

      // Generate visual fingerprint
      const visualFp = generateVisualFingerprint(identity.publicKey);
      setGeneratedFingerprint(visualFp.blocks);

      // Small delay to show fingerprint
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Complete step
      onComplete(password);
    } catch (err) {
      console.error('Failed to generate identity:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to generate identity. Please try again.'
      );
    } finally {
      setIsGenerating(false);
    }
  }, [canSubmit, password, onComplete]);

  // Handle form submit
  const handleSubmit = useCallback(
    (e: Event) => {
      e.preventDefault();
      handleGenerate();
    },
    [handleGenerate]
  );

  return (
    <div>
      {/* Header */}
      <div class="text-center mb-6">
        <h2 class="text-xl font-bold text-terminal-green font-mono mb-2">
          Create Identity
        </h2>
        <p class="text-terminal-green/70 font-mono text-sm">
          Choose a password to protect your keys
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} class="space-y-4">
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
              disabled={isGenerating}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-terminal-green/50 hover:text-terminal-green transition-colors p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          {/* Strength meter */}
          <div class="mt-2">
            <div class="flex gap-1 mb-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  class={`h-1 flex-1 rounded-full transition-colors ${
                    i < strength.score
                      ? `bg-${strength.color}`
                      : 'bg-terminal-green/20'
                  }`}
                  style={{
                    backgroundColor:
                      i < strength.score
                        ? strength.color === 'terminal-red'
                          ? '#ff4444'
                          : strength.color === 'terminal-yellow'
                            ? '#ffff00'
                            : strength.color === 'terminal-green/70'
                              ? 'rgba(0, 255, 0, 0.7)'
                              : strength.color === 'terminal-green'
                                ? '#00ff00'
                                : 'rgba(0, 255, 0, 0.2)'
                        : 'rgba(0, 255, 0, 0.2)',
                  }}
                />
              ))}
            </div>
            <p
              class={`text-xs font-mono`}
              style={{
                color:
                  strength.color === 'terminal-red'
                    ? '#ff4444'
                    : strength.color === 'terminal-yellow'
                      ? '#ffff00'
                      : strength.color === 'terminal-green/70'
                        ? 'rgba(0, 255, 0, 0.7)'
                        : strength.color === 'terminal-green'
                          ? '#00ff00'
                          : 'rgba(0, 255, 0, 0.3)',
              }}
            >
              {strength.label}
            </p>
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
            onInput={(e) => setConfirmPassword((e.target as HTMLInputElement).value)}
            class={`w-full px-3 py-2 bg-terminal-bg border rounded-terminal text-terminal-green font-mono focus:outline-none ${
              confirmPassword && !passwordsMatch
                ? 'border-terminal-red focus:border-terminal-red'
                : 'border-terminal-green/30 focus:border-terminal-green'
            }`}
            placeholder="Repeat password"
            required
            disabled={isGenerating}
          />
          {confirmPassword && !passwordsMatch && (
            <p class="mt-1 text-xs text-terminal-red font-mono">
              Passwords do not match
            </p>
          )}
        </div>

        {/* Generated fingerprint preview */}
        {generatedFingerprint && (
          <div class="p-3 bg-terminal-green/10 border border-terminal-green/30 rounded-terminal">
            <p class="text-xs text-terminal-green/70 font-mono mb-1">
              Your Fingerprint:
            </p>
            <p class="text-sm text-terminal-green font-mono break-all">
              {generatedFingerprint}
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div class="p-3 bg-terminal-red/10 border border-terminal-red/30 rounded-terminal">
            <p class="text-sm text-terminal-red font-mono">{error}</p>
          </div>
        )}

        {/* Password requirements hint */}
        <div class="text-xs text-terminal-green/50 font-mono space-y-1">
          <p>Password requirements:</p>
          <ul class="list-none space-y-0.5 pl-2">
            <li class={password.length >= 8 ? 'text-terminal-green' : ''}>
              {password.length >= 8 ? '[x]' : '[ ]'} At least 8 characters
            </li>
            <li
              class={
                /[a-z]/.test(password) && /[A-Z]/.test(password)
                  ? 'text-terminal-green'
                  : ''
              }
            >
              {/[a-z]/.test(password) && /[A-Z]/.test(password) ? '[x]' : '[ ]'}{' '}
              Mixed case letters
            </li>
            <li class={/\d/.test(password) ? 'text-terminal-green' : ''}>
              {/\d/.test(password) ? '[x]' : '[ ]'} At least one number
            </li>
          </ul>
        </div>

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
          {isGenerating ? (
            <span class="flex items-center justify-center gap-2">
              <svg
                class="animate-spin h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
              >
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
              Generating...
            </span>
          ) : (
            'Generate Identity'
          )}
        </button>
      </form>

      {/* Security note */}
      <p class="mt-6 text-xs text-terminal-green/40 font-mono text-center">
        Your password encrypts your keys locally. There is no password recovery
        - if you forget it, you will need to restore from backup.
      </p>
    </div>
  );
};

export default CreateIdentityStep;
