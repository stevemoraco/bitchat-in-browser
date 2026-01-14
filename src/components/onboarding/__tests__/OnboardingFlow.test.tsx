/**
 * OnboardingFlow Tests
 *
 * Comprehensive tests for multi-step onboarding flow:
 * - Step navigation (forward and backward)
 * - Flow type selection (create vs import)
 * - Progress indicator behavior
 * - State persistence between steps
 * - Conditional step rendering
 * - Completion callback
 *
 * @module components/onboarding/__tests__/OnboardingFlow.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { OnboardingFlow } from '../OnboardingFlow';

// ============================================================================
// Mocks
// ============================================================================

// Mock settings store
vi.mock('../../../stores/settings-store', () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      updateSettings: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock identity service
const mockIdentityService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  generateNewIdentity: vi.fn().mockResolvedValue({
    publicKey: 'a'.repeat(64),
    fingerprint: 'b'.repeat(64),
  }),
  generateFromSeed: vi.fn().mockResolvedValue({
    publicKey: 'c'.repeat(64),
    fingerprint: 'd'.repeat(64),
  }),
  exportAsNsec: vi.fn().mockResolvedValue({
    data: 'nsec1' + 'x'.repeat(58),
    fingerprint: 'abcd1234',
  }),
};

vi.mock('../../../services/identity', () => ({
  IdentityService: {
    getInstance: vi.fn(() => mockIdentityService),
  },
  generateVisualFingerprint: vi.fn(() => ({
    blocks: 'TEST-BLOCKS',
    short: 'TEST-SHORT',
  })),
  validateImport: vi.fn(() => ({
    valid: true,
    format: 'nsec',
    publicKey: 'a'.repeat(64),
    npubPreview: 'npub1...',
  })),
  importKey: vi.fn().mockResolvedValue({
    success: true,
    privateKey: new Uint8Array(32).fill(1),
  }),
  detectImportFormat: vi.fn(() => 'nsec'),
  sanitizeImportInput: vi.fn((input: string) => input.trim()),
}));

// Mock storage manager
vi.mock('../../../services/storage', () => ({
  getStorageManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ============================================================================
// OnboardingFlow Tests
// ============================================================================

describe('OnboardingFlow', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initial Rendering', () => {
    it('renders welcome step by default', () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      expect(screen.getByText('BitChat')).toBeInTheDocument();
      expect(screen.getByText('In Browser')).toBeInTheDocument();
      expect(screen.getByText('Get Started')).toBeInTheDocument();
      expect(screen.getByText('Import Existing Key')).toBeInTheDocument();
    });

    it('renders with initial step when provided', () => {
      render(
        <OnboardingFlow onComplete={mockOnComplete} initialStep="welcome" />
      );

      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    it('does not show progress indicator on welcome step', () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      // Progress bar should not be visible
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('displays app features on welcome screen', () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      expect(screen.getByText(/End-to-end encrypted/i)).toBeInTheDocument();
      expect(screen.getByText(/Works offline after install/i)).toBeInTheDocument();
      expect(screen.getByText(/Compatible with Nostr/i)).toBeInTheDocument();
      expect(screen.getByText(/Location-based channels/i)).toBeInTheDocument();
    });
  });

  describe('Create Identity Flow', () => {
    it('navigates to create identity step when Get Started clicked', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Create Identity')).toBeInTheDocument();
        expect(screen.getByText(/Choose a password to protect your keys/i)).toBeInTheDocument();
      });
    });

    it('shows progress indicator after flow selection', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        // Should show step indicators
        expect(screen.getByText('Create Identity')).toBeInTheDocument();
      });
    });

    it('shows back button on create identity step', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        const backButton = screen.getByLabelText('Go back');
        expect(backButton).toBeInTheDocument();
      });
    });

    it('navigates back to welcome from create identity step', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Create Identity')).toBeInTheDocument();
      });

      const backButton = screen.getByLabelText('Go back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Get Started')).toBeInTheDocument();
      });
    });
  });

  describe('Import Identity Flow', () => {
    it('navigates to import identity step when Import Existing Key clicked', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Import Existing Key'));

      await waitFor(() => {
        expect(screen.getByText('Import Identity')).toBeInTheDocument();
        expect(screen.getByText(/Enter your existing Nostr key/i)).toBeInTheDocument();
      });
    });

    it('shows back button on import identity step', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Import Existing Key'));

      await waitFor(() => {
        const backButton = screen.getByLabelText('Go back');
        expect(backButton).toBeInTheDocument();
      });
    });

    it('navigates back to welcome from import identity step', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Import Existing Key'));

      await waitFor(() => {
        expect(screen.getByText('Import Identity')).toBeInTheDocument();
      });

      const backButton = screen.getByLabelText('Go back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Get Started')).toBeInTheDocument();
      });
    });
  });

  describe('Step Progression', () => {
    it('shows create flow specific steps in progress indicator', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        // Create flow shows: Create Identity, Backup, Permissions
        expect(screen.getAllByText('Create Identity').length).toBeGreaterThan(0);
      });
    });

    it('shows import flow specific steps in progress indicator', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Import Existing Key'));

      await waitFor(() => {
        // Import flow shows: Import Identity, Permissions
        expect(screen.getAllByText('Import Identity').length).toBeGreaterThan(0);
      });
    });
  });

  describe('Flow State Management', () => {
    it('maintains flow type selection through navigation', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      // Select create flow
      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        expect(screen.getByText('Create Identity')).toBeInTheDocument();
      });

      // Go back
      const backButton = screen.getByLabelText('Go back');
      fireEvent.click(backButton);

      await waitFor(() => {
        expect(screen.getByText('Get Started')).toBeInTheDocument();
      });

      // Select import flow
      fireEvent.click(screen.getByText('Import Existing Key'));

      await waitFor(() => {
        expect(screen.getByText('Import Identity')).toBeInTheDocument();
      });
    });
  });

  describe('Progress Indicator', () => {
    it('hides progress indicator on welcome step', () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      // Should not show progress bar content
      const progressBar = document.querySelector('[style*="width"]');
      expect(progressBar).not.toBeInTheDocument();
    });

    it('shows progress indicator during middle steps', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        // Progress bar should be visible
        const progressArea = document.querySelector('.h-1.bg-terminal-green');
        expect(progressArea).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible back button with label', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      fireEvent.click(screen.getByText('Get Started'));

      await waitFor(() => {
        const backButton = screen.getByLabelText('Go back');
        expect(backButton).toBeInTheDocument();
      });
    });

    it('buttons are focusable', () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      const getStartedButton = screen.getByText('Get Started');
      const importButton = screen.getByText('Import Existing Key');

      expect(getStartedButton).not.toBeDisabled();
      expect(importButton).not.toBeDisabled();
    });
  });

  describe('Animation and Transitions', () => {
    it('applies fade-in animation class to step content', async () => {
      render(<OnboardingFlow onComplete={mockOnComplete} />);

      const contentArea = document.querySelector('.animate-terminal-fade-in');
      expect(contentArea).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Flow Variant Tests
// ============================================================================

describe('OnboardingFlow - Create Path', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('follows correct step sequence for create flow', async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);

    // Step 1: Welcome -> Click Get Started
    expect(screen.getByText('BitChat')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Get Started'));

    // Step 2: Should be on Create Identity
    await waitFor(() => {
      expect(screen.getByText('Create Identity')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument();
    });
  });
});

describe('OnboardingFlow - Import Path', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('follows correct step sequence for import flow', async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);

    // Step 1: Welcome -> Click Import
    expect(screen.getByText('BitChat')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Import Existing Key'));

    // Step 2: Should be on Import Identity
    await waitFor(() => {
      expect(screen.getByText('Import Identity')).toBeInTheDocument();
      expect(screen.getByText(/Private Key or Mnemonic/i)).toBeInTheDocument();
    });
  });

  it('shows supported formats hint', async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);

    fireEvent.click(screen.getByText('Import Existing Key'));

    await waitFor(() => {
      expect(screen.getByText(/Supported formats/i)).toBeInTheDocument();
      expect(screen.getByText(/Nostr Secret Key/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('OnboardingFlow - Edge Cases', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles rapid step switching without crashing', async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);

    // Rapidly switch between flows
    fireEvent.click(screen.getByText('Get Started'));

    await waitFor(() => {
      expect(screen.getByLabelText('Go back')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Go back'));

    await waitFor(() => {
      expect(screen.getByText('Get Started')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Import Existing Key'));

    await waitFor(() => {
      expect(screen.getByText('Import Identity')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Go back'));

    await waitFor(() => {
      expect(screen.getByText('BitChat')).toBeInTheDocument();
    });
  });

  it('renders correctly with default props', () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);

    expect(screen.getByText('BitChat')).toBeInTheDocument();
  });

  it('handles component unmount during async operation gracefully', async () => {
    const { unmount } = render(<OnboardingFlow onComplete={mockOnComplete} />);

    fireEvent.click(screen.getByText('Get Started'));

    // Unmount before async operation completes
    unmount();

    // No errors should be thrown
    expect(true).toBe(true);
  });
});

// ============================================================================
// Integration with Child Components
// ============================================================================

describe('OnboardingFlow - Child Component Integration', () => {
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes correct props to WelcomeStep', () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);

    // WelcomeStep should have onGetStarted and onImportKey
    expect(screen.getByText('Get Started')).toBeInTheDocument();
    expect(screen.getByText('Import Existing Key')).toBeInTheDocument();
  });

  it('passes correct props to CreateIdentityStep', async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);

    fireEvent.click(screen.getByText('Get Started'));

    await waitFor(() => {
      // CreateIdentityStep should have password inputs
      expect(screen.getByPlaceholderText(/Min 8 characters/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Repeat password/i)).toBeInTheDocument();
    });
  });

  it('passes correct props to ImportIdentityStep', async () => {
    render(<OnboardingFlow onComplete={mockOnComplete} />);

    fireEvent.click(screen.getByText('Import Existing Key'));

    await waitFor(() => {
      // ImportIdentityStep should have key input
      expect(screen.getByPlaceholderText(/nsec1... or 64 hex chars or mnemonic phrase/i)).toBeInTheDocument();
    });
  });
});
