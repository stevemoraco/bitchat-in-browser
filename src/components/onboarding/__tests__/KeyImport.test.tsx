/**
 * KeyImport (ImportIdentityStep) Tests
 *
 * Comprehensive tests for key import functionality:
 * - Format detection (nsec, hex, mnemonic)
 * - Input validation
 * - Passphrase handling for mnemonics
 * - Password protection
 * - Error handling and recovery
 * - Fingerprint preview display
 *
 * @module components/onboarding/__tests__/KeyImport.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { ImportIdentityStep } from '../ImportIdentityStep';

// ============================================================================
// Test Constants
// ============================================================================

const validNsec = 'nsec1' + 'a'.repeat(58);
const validHex = 'a'.repeat(64);
const validMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const mockPublicKey = 'b'.repeat(64);

// ============================================================================
// Mock Setup - Using vi.hoisted for proper hoisting
// ============================================================================

const mocks = vi.hoisted(() => {
  return {
    mockImportKeyFn: vi.fn(),
    mockValidateImportFn: vi.fn(),
    mockDetectImportFormatFn: vi.fn(),
    mockSanitizeImportInputFn: vi.fn(),
    mockGenerateVisualFingerprintFn: vi.fn(),
    mockIdentityServiceInitialize: vi.fn(),
    mockIdentityServiceGenerateFromSeed: vi.fn(),
    mockStorageManagerInitialize: vi.fn(),
  };
});

vi.mock('../../../services/identity', () => ({
  IdentityService: {
    getInstance: vi.fn(() => ({
      initialize: mocks.mockIdentityServiceInitialize,
      generateFromSeed: mocks.mockIdentityServiceGenerateFromSeed,
    })),
  },
  validateImport: mocks.mockValidateImportFn,
  importKey: mocks.mockImportKeyFn,
  detectImportFormat: mocks.mockDetectImportFormatFn,
  sanitizeImportInput: mocks.mockSanitizeImportInputFn,
  generateVisualFingerprint: mocks.mockGenerateVisualFingerprintFn,
}));

vi.mock('../../../services/storage', () => ({
  getStorageManager: vi.fn(() => ({
    initialize: mocks.mockStorageManagerInitialize,
  })),
}));

// ============================================================================
// ImportIdentityStep Tests
// ============================================================================

describe('ImportIdentityStep', () => {
  const mockOnComplete = vi.fn();
  const mockOnBack = vi.fn();

  // Default mock validate result
  const defaultValidateResult = {
    valid: true,
    format: 'nsec' as const,
    publicKey: mockPublicKey,
    npubPreview: 'npub1abc...xyz',
    error: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock implementations
    mocks.mockValidateImportFn.mockReturnValue(defaultValidateResult);
    mocks.mockImportKeyFn.mockResolvedValue({
      success: true,
      privateKey: new Uint8Array(32).fill(1),
    });
    mocks.mockDetectImportFormatFn.mockImplementation((input: string) => {
      if (input.startsWith('nsec1')) return 'nsec';
      if (/^[a-f0-9]{64}$/i.test(input)) return 'hex';
      if (input.split(' ').length >= 12) return 'mnemonic';
      return null;
    });
    mocks.mockSanitizeImportInputFn.mockImplementation((input: string) => input.trim().toLowerCase());
    mocks.mockGenerateVisualFingerprintFn.mockReturnValue({
      blocks: 'TEST-BLOCKS',
      short: 'TEST-FP',
    });
    mocks.mockIdentityServiceInitialize.mockResolvedValue(undefined);
    mocks.mockIdentityServiceGenerateFromSeed.mockResolvedValue({
      publicKey: mockPublicKey,
      fingerprint: 'c'.repeat(64),
    });
    mocks.mockStorageManagerInitialize.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the import identity form', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      // Use getAllByText since "Import Identity" appears in both heading and button
      const headings = screen.getAllByText('Import Identity');
      expect(headings.length).toBeGreaterThan(0);
      expect(screen.getByText(/Enter your existing Nostr key/i)).toBeTruthy();
    });

    it('displays key input textarea', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      expect(keyInput).toBeTruthy();
      expect(keyInput.tagName).toBe('TEXTAREA');
    });

    it('displays password fields', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText('Password')).toBeTruthy();
      expect(screen.getByText('Confirm Password')).toBeTruthy();
      expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeTruthy();
      expect(screen.getByPlaceholderText(/Repeat password/i)).toBeTruthy();
    });

    it('displays supported formats hint', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText(/Supported formats/i)).toBeTruthy();
      expect(screen.getAllByText(/Nostr Secret Key/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Hex Private Key/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Mnemonic Phrase/i).length).toBeGreaterThan(0);
    });

    it('displays import button', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      expect(submitButton).toBeTruthy();
    });
  });

  describe('Format Detection', () => {
    it('detects nsec format', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validNsec } });

      await waitFor(() => {
        const elements = screen.getAllByText(/Nostr Secret Key/i);
        expect(elements.length).toBeGreaterThan(0);
      });
    });

    it('detects hex format', async () => {
      mocks.mockValidateImportFn.mockReturnValue({ ...defaultValidateResult, format: 'hex' });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validHex } });

      await waitFor(() => {
        expect(mocks.mockDetectImportFormatFn).toHaveBeenCalledWith(validHex);
      });
    });

    it('detects mnemonic format', async () => {
      mocks.mockValidateImportFn.mockReturnValue({ ...defaultValidateResult, format: 'mnemonic' });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validMnemonic } });

      await waitFor(() => {
        expect(mocks.mockDetectImportFormatFn).toHaveBeenCalledWith(validMnemonic);
      });
    });
  });

  describe('Input Validation', () => {
    it('validates key input and shows error for invalid key', async () => {
      mocks.mockValidateImportFn.mockReturnValue({
        valid: false,
        format: 'nsec',
        publicKey: '',
        npubPreview: '',
        error: 'Invalid key format',
      });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: 'invalid-key' } });

      await waitFor(() => {
        expect(screen.getByText('Invalid key format')).toBeInTheDocument();
      });
    });

    it('shows success styling for valid key', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validNsec } });

      await waitFor(() => {
        expect(keyInput).toHaveClass('border-terminal-green');
      });
    });

    it('shows error styling for invalid key', async () => {
      mocks.mockValidateImportFn.mockReturnValue({
        ...defaultValidateResult,
        valid: false,
        error: 'Invalid checksum',
      });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: 'nsec1invalid' } });

      await waitFor(() => {
        expect(keyInput).toHaveClass('border-terminal-red');
      });
    });

    it('displays npub preview for valid key', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validNsec } });

      await waitFor(() => {
        expect(screen.getByText('npub1abc...xyz')).toBeInTheDocument();
      });
    });

    it('displays fingerprint preview for valid key', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validNsec } });

      await waitFor(() => {
        expect(screen.getByText(/Fingerprint:/i)).toBeInTheDocument();
        expect(screen.getByText('TEST-FP')).toBeInTheDocument();
      });
    });
  });

  describe('Passphrase Field (Mnemonic)', () => {
    it('shows passphrase field when mnemonic format detected', async () => {
      mocks.mockValidateImportFn.mockReturnValue({ ...defaultValidateResult, format: 'mnemonic' });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validMnemonic } });

      await waitFor(() => {
        expect(screen.getByText(/BIP-39 Passphrase/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Leave empty if none/i)).toBeInTheDocument();
      });
    });

    it('hides passphrase field for nsec format', async () => {
      mocks.mockValidateImportFn.mockReturnValue({ ...defaultValidateResult, format: 'nsec' });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validNsec } });

      await waitFor(() => {
        expect(screen.queryByText(/BIP-39 Passphrase/i)).not.toBeInTheDocument();
      });
    });

    it('includes passphrase in import when provided', async () => {
      mocks.mockValidateImportFn.mockReturnValue({ ...defaultValidateResult, format: 'mnemonic' });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validMnemonic } });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Leave empty if none/i)).toBeInTheDocument();
      });

      const passphraseInput = screen.getByPlaceholderText(/Leave empty if none/i);
      fireEvent.input(passphraseInput, { target: { value: 'my-secret-passphrase' } });

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mocks.mockImportKeyFn).toHaveBeenCalledWith(validMnemonic, 'my-secret-passphrase');
      });
    });
  });

  describe('Password Protection', () => {
    it('validates password minimum length', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'short' } });
      fireEvent.input(confirmInput, { target: { value: 'short' } });

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      expect(submitButton).toBeDisabled();
    });

    it('validates password confirmation match', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'different123' } });

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('shows password visibility toggle', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const toggleButton = screen.getByLabelText(/Show password|Hide password/i);
      expect(toggleButton).toBeInTheDocument();
    });

    it('toggles password visibility', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleButton = screen.getByLabelText(/Show password/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(passwordInput).toHaveAttribute('type', 'text');
      });
    });
  });

  describe('Form Submission', () => {
    it('disables submit button when key is invalid', () => {
      mocks.mockValidateImportFn.mockReturnValue({ ...defaultValidateResult, valid: false, error: 'Invalid' });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when password is invalid', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      fireEvent.input(keyInput, { target: { value: validNsec } });

      // Password too short
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.input(passwordInput, { target: { value: 'short' } });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: 'Import Identity' });
        expect(submitButton).toBeDisabled();
      });
    });

    it('enables submit button when all validations pass', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: 'Import Identity' });
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('shows importing state during submission', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Importing...')).toBeInTheDocument();
      });
    });

    it('calls onComplete with password after successful import', async () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith('password123');
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('displays error when import fails', async () => {
      mocks.mockImportKeyFn.mockResolvedValueOnce({
        success: false,
        error: 'Invalid key checksum',
      });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid key checksum')).toBeInTheDocument();
      });
    });

    it('displays generic error for unknown failures', async () => {
      mocks.mockImportKeyFn.mockRejectedValueOnce('unknown error');

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to import identity/i)).toBeInTheDocument();
      });
    });

    it('re-enables form after error for retry', async () => {
      mocks.mockImportKeyFn.mockResolvedValueOnce({
        success: false,
        error: 'Import failed',
      });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Import failed')).toBeInTheDocument();
      });

      // Form should be re-enabled
      await waitFor(() => {
        expect(keyInput).not.toBeDisabled();
        expect(passwordInput).not.toBeDisabled();
      });
    });

    it('allows retry after error with corrected input', async () => {
      mocks.mockImportKeyFn
        .mockResolvedValueOnce({
          success: false,
          error: 'Invalid key',
        })
        .mockResolvedValueOnce({
          success: true,
          privateKey: new Uint8Array(32).fill(1),
        });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      // First attempt - fails
      let submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Invalid key')).toBeInTheDocument();
      });

      // Second attempt - succeeds
      submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith('password123');
      });
    });
  });

  describe('Security', () => {
    it('textarea has security attributes', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);

      // Check autocomplete, autocorrect, autocapitalize attributes
      expect(keyInput).toHaveAttribute('autocomplete', 'off');
      expect(keyInput).toHaveAttribute('autocorrect', 'off');
      expect(keyInput).toHaveAttribute('autocapitalize', 'off');
    });

    it('securely clears private key from memory after import', async () => {
      const mockPrivateKey = new Uint8Array(32).fill(1);
      mocks.mockImportKeyFn.mockResolvedValueOnce({
        success: true,
        privateKey: mockPrivateKey,
      });

      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const keyInput = screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i);
      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(keyInput, { target: { value: validNsec } });
      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByRole('button', { name: 'Import Identity' });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // After import, private key should be zeroed
        expect(mockPrivateKey.every((b) => b === 0)).toBe(true);
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible label for key input', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText('Private Key or Mnemonic')).toBeInTheDocument();
    });

    it('has accessible labels for password fields', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByText('Confirm Password')).toBeInTheDocument();
    });

    it('toggle button has accessible label', () => {
      render(<ImportIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const toggleButton = screen.getByLabelText(/Show password|Hide password/i);
      expect(toggleButton).toBeInTheDocument();
    });
  });
});
