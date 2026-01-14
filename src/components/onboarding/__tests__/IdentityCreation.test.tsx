/**
 * IdentityCreation (CreateIdentityStep) Tests
 *
 * Comprehensive tests for identity creation form:
 * - Password input validation
 * - Password strength meter
 * - Password confirmation matching
 * - Form submission states
 * - Error handling and recovery
 * - Fingerprint display after generation
 *
 * @module components/onboarding/__tests__/IdentityCreation.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { CreateIdentityStep } from '../CreateIdentityStep';

// ============================================================================
// Mocks
// ============================================================================

const mockGeneratedIdentity = {
  publicKey: 'a'.repeat(64),
  fingerprint: 'b'.repeat(64),
};

const mockIdentityService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  generateNewIdentity: vi.fn().mockResolvedValue(mockGeneratedIdentity),
};

vi.mock('../../../services/identity', () => ({
  IdentityService: {
    getInstance: vi.fn(() => mockIdentityService),
  },
  generateVisualFingerprint: vi.fn(() => ({
    blocks: 'TEST-BLOCK-FINGERPRINT',
    short: 'TEST-SHORT',
  })),
}));

const mockStorageManager = {
  initialize: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../../services/storage', () => ({
  getStorageManager: vi.fn(() => mockStorageManager),
}));

// ============================================================================
// CreateIdentityStep Tests
// ============================================================================

describe('CreateIdentityStep', () => {
  const mockOnComplete = vi.fn();
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders the create identity form', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText('Create Identity')).toBeInTheDocument();
      expect(screen.getByText(/Choose a password to protect your keys/i)).toBeInTheDocument();
    });

    it('displays password input field', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      expect(passwordInput).toBeInTheDocument();
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('displays confirm password input field', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);
      expect(confirmInput).toBeInTheDocument();
      expect(confirmInput).toHaveAttribute('type', 'password');
    });

    it('displays password requirements checklist', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText(/Password requirements/i)).toBeInTheDocument();
      expect(screen.getByText(/At least 8 characters/i)).toBeInTheDocument();
      expect(screen.getByText(/Mixed case letters/i)).toBeInTheDocument();
      expect(screen.getByText(/At least one number/i)).toBeInTheDocument();
    });

    it('displays submit button', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText('Generate Identity')).toBeInTheDocument();
    });

    it('displays security note about password recovery', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText(/Your password encrypts your keys locally/i)).toBeInTheDocument();
      expect(screen.getByText(/no password recovery/i)).toBeInTheDocument();
    });
  });

  describe('Password Visibility Toggle', () => {
    it('renders show/hide password button', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const toggleButton = screen.getByLabelText(/Show password|Hide password/i);
      expect(toggleButton).toBeInTheDocument();
    });

    it('toggles password visibility when button clicked', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      const toggleButton = screen.getByLabelText(/Show password/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(passwordInput).toHaveAttribute('type', 'text');
      });
    });

    it('applies visibility toggle to both password fields', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      const toggleButton = screen.getByLabelText(/Show password/i);
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(passwordInput).toHaveAttribute('type', 'text');
        expect(confirmInput).toHaveAttribute('type', 'text');
      });
    });
  });

  describe('Password Strength Meter', () => {
    it('shows initial strength label before input', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText('Enter password')).toBeInTheDocument();
    });

    it('shows "Too weak" for very short passwords', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.input(passwordInput, { target: { value: 'abc' } });

      await waitFor(() => {
        expect(screen.getByText('Too weak')).toBeInTheDocument();
      });
    });

    it('shows "Weak" for short passwords meeting length', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.input(passwordInput, { target: { value: 'abcdefgh' } });

      await waitFor(() => {
        expect(screen.getByText('Weak')).toBeInTheDocument();
      });
    });

    it('shows "Fair" for passwords with some complexity', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.input(passwordInput, { target: { value: 'Abcdefgh1' } });

      await waitFor(() => {
        expect(screen.getByText('Fair')).toBeInTheDocument();
      });
    });

    it('shows "Good" for longer passwords with some variety', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.input(passwordInput, { target: { value: 'AbcDefgh1234' } });

      await waitFor(() => {
        expect(screen.getByText('Good')).toBeInTheDocument();
      });
    });

    it('shows "Strong" for complex passwords', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      fireEvent.input(passwordInput, { target: { value: 'AbcDefgh1234!@#$' } });

      await waitFor(() => {
        expect(screen.getByText('Strong')).toBeInTheDocument();
      });
    });

    it('displays strength meter visual bars', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      // Should have 4 strength indicator bars
      const strengthBars = document.querySelectorAll('.h-1.flex-1');
      expect(strengthBars.length).toBe(4);
    });
  });

  describe('Password Requirements Checklist', () => {
    it('updates 8 character requirement indicator', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);

      // Initially unchecked
      expect(screen.getByText('[ ] At least 8 characters')).toBeInTheDocument();

      fireEvent.input(passwordInput, { target: { value: 'password' } });

      await waitFor(() => {
        expect(screen.getByText('[x] At least 8 characters')).toBeInTheDocument();
      });
    });

    it('updates mixed case requirement indicator', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);

      // Initially unchecked
      expect(screen.getByText('[ ] Mixed case letters')).toBeInTheDocument();

      fireEvent.input(passwordInput, { target: { value: 'Password' } });

      await waitFor(() => {
        expect(screen.getByText('[x] Mixed case letters')).toBeInTheDocument();
      });
    });

    it('updates number requirement indicator', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);

      // Initially unchecked
      expect(screen.getByText('[ ] At least one number')).toBeInTheDocument();

      fireEvent.input(passwordInput, { target: { value: 'password1' } });

      await waitFor(() => {
        expect(screen.getByText('[x] At least one number')).toBeInTheDocument();
      });
    });
  });

  describe('Password Confirmation Validation', () => {
    it('shows error when passwords do not match', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password456' } });

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });
    });

    it('removes error when passwords match', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password456' } });

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
      });

      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      await waitFor(() => {
        expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
      });
    });

    it('applies error styling to confirm input when passwords mismatch', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'different' } });

      await waitFor(() => {
        expect(confirmInput).toHaveClass('border-terminal-red');
      });
    });
  });

  describe('Form Submission', () => {
    it('disables submit button when password is too short', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const submitButton = screen.getByText('Generate Identity');
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when passwords do not match', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'different123' } });

      await waitFor(() => {
        const submitButton = screen.getByText('Generate Identity');
        expect(submitButton).toBeDisabled();
      });
    });

    it('enables submit button when all validations pass', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      await waitFor(() => {
        const submitButton = screen.getByText('Generate Identity');
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('shows generating state during submission', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Generating...')).toBeInTheDocument();
      });
    });

    it('disables inputs during generation', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(passwordInput).toBeDisabled();
        expect(confirmInput).toBeDisabled();
      });
    });

    it('calls onComplete with password after successful generation', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith('password123');
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when generation fails', async () => {
      mockIdentityService.generateNewIdentity.mockRejectedValueOnce(
        new Error('Key generation failed')
      );

      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Key generation failed')).toBeInTheDocument();
      });
    });

    it('displays generic error message for unknown errors', async () => {
      mockIdentityService.generateNewIdentity.mockRejectedValueOnce('unknown error');

      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed to generate identity/i)).toBeInTheDocument();
      });
    });

    it('re-enables form after error', async () => {
      mockIdentityService.generateNewIdentity.mockRejectedValueOnce(
        new Error('Key generation failed')
      );

      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Key generation failed')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(passwordInput).not.toBeDisabled();
        expect(confirmInput).not.toBeDisabled();
      });
    });

    it('allows retry after error', async () => {
      mockIdentityService.generateNewIdentity
        .mockRejectedValueOnce(new Error('Key generation failed'))
        .mockResolvedValueOnce(mockGeneratedIdentity);

      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      // First attempt - fails
      let submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Key generation failed')).toBeInTheDocument();
      });

      // Second attempt - succeeds
      submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith('password123');
      });
    });
  });

  describe('Storage Initialization', () => {
    it('initializes storage before generating identity', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockStorageManager.initialize).toHaveBeenCalled();
      });
    });

    it('initializes identity service before generating', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      const submitButton = screen.getByText('Generate Identity');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockIdentityService.initialize).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible labels for password fields', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      expect(screen.getByText('Password')).toBeInTheDocument();
      expect(screen.getByText('Confirm Password')).toBeInTheDocument();
    });

    it('password fields have proper input types', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      expect(passwordInput).toHaveAttribute('type', 'password');
      expect(confirmInput).toHaveAttribute('type', 'password');
    });

    it('toggle button has accessible label', () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const toggleButton = screen.getByLabelText(/Show password/i);
      expect(toggleButton).toBeInTheDocument();
    });

    it('form can be submitted via Enter key', async () => {
      render(<CreateIdentityStep onComplete={mockOnComplete} onBack={mockOnBack} />);

      const passwordInput = screen.getByPlaceholderText(/Min 8 characters/i);
      const confirmInput = screen.getByPlaceholderText(/Repeat password/i);

      fireEvent.input(passwordInput, { target: { value: 'password123' } });
      fireEvent.input(confirmInput, { target: { value: 'password123' } });

      // Submit form
      const form = document.querySelector('form');
      if (form) {
        fireEvent.submit(form);
      }

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });
});
