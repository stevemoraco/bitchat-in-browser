/**
 * Settings Components Tests
 *
 * Comprehensive tests for settings panel components:
 * - IdentitySettings: Key display, export, password change
 * - NetworkSettings: Relay management, filters, WebRTC toggle
 * - PrivacySettings: Privacy toggles and location precision
 * - StorageSettings: Storage display, export/import, clear
 * - DangerZone: Multi-step destructive action confirmation
 * - AboutSettings: Version info, app store links
 *
 * @module components/settings/__tests__/SettingsPanel.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { IdentitySettings } from '../IdentitySettings';
import { NetworkSettings } from '../NetworkSettings';
import { PrivacySettings } from '../PrivacySettings';
import { StorageSettings } from '../StorageSettings';
import { DangerZone } from '../DangerZone';
import { AboutSettings } from '../AboutSettings';

// ============================================================================
// Mocks
// ============================================================================

// Mock identity store
const mockIdentity = {
  publicKey: 'a'.repeat(64),
  fingerprint: 'b'.repeat(64),
  npub: 'npub1' + 'x'.repeat(58),
  isKeyLoaded: true,
  createdAt: Date.now(),
};

vi.mock('../../../stores/identity-store', () => ({
  useIdentity: vi.fn(() => mockIdentity),
  useNpub: vi.fn(() => mockIdentity.npub),
  useFingerprint: vi.fn(() => mockIdentity.fingerprint),
  useIsKeyLoaded: vi.fn(() => true),
  useIdentityStore: vi.fn((selector) => {
    const state = { clearIdentity: vi.fn() };
    return selector ? selector(state) : state;
  }),
}));

// Mock settings store
const mockSettings = {
  locationPrecision: 6,
  showMessageStatus: true,
  autoJoinLocation: false,
};

vi.mock('../../../stores/settings-store', () => ({
  useSettings: vi.fn(() => mockSettings),
  useSettingsStore: vi.fn((selector) => {
    const state = {
      updateSettings: vi.fn(),
      settings: mockSettings,
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock relay manager
const mockRelayStatuses = [
  { url: 'wss://relay1.example.com', state: 'connected', messagesSent: 10, messagesReceived: 20 },
  { url: 'wss://relay2.example.com', state: 'disconnected', messagesSent: 0, messagesReceived: 0, lastError: 'Connection failed' },
];

vi.mock('../../../services/nostr/relay-manager', () => ({
  getDefaultRelayManager: vi.fn(() => ({
    getRelayStatuses: vi.fn(() => mockRelayStatuses),
    getRelayStats: vi.fn(() => new Map()),
    getWhitelist: vi.fn(() => []),
    getBlacklist: vi.fn(() => []),
    getConnectionSummary: vi.fn(() => ({ connected: 1, connecting: 0, disconnected: 1, error: 0, total: 2 })),
    addToWhitelist: vi.fn(),
    addRelays: vi.fn().mockResolvedValue(undefined),
    removeFromWhitelist: vi.fn(),
    removeRelays: vi.fn(),
    addToBlacklist: vi.fn(),
    removeFromBlacklist: vi.fn(),
    retryConnection: vi.fn().mockResolvedValue(undefined),
    resetConnections: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('../../../services/nostr/relay-list', () => ({
  PRIMARY_RELAY_URLS: ['wss://relay1.example.com'],
}));

// Mock storage manager
const mockStorageHealth = {
  isHealthy: true,
  backendType: 'opfs',
  usagePercent: 25,
  usageFormatted: '25 MB / 100 MB',
  isPersistent: true,
  error: null,
};

vi.mock('../../../services/storage', () => ({
  getStorageManager: vi.fn(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getHealth: vi.fn().mockResolvedValue(mockStorageHealth),
    exportData: vi.fn().mockResolvedValue({ data: {}, exportedAt: Date.now() }),
    importData: vi.fn().mockResolvedValue({ success: true, imported: { messages: 5 }, skipped: { messages: 0 }, errors: [] }),
    clear: vi.fn().mockResolvedValue(undefined),
    clearAllData: vi.fn().mockResolvedValue(undefined),
    requestPersistentStorage: vi.fn().mockResolvedValue(true),
  })),
}));

// Mock identity service
vi.mock('../../../services/identity', () => ({
  IdentityService: {
    getInstance: vi.fn(() => ({
      exportAsNsec: vi.fn().mockResolvedValue({ data: 'nsec1' + 'x'.repeat(58), fingerprint: 'abcd1234' }),
      changePassword: vi.fn().mockResolvedValue(undefined),
      generateNewIdentity: vi.fn().mockResolvedValue({ publicKey: 'new'.repeat(21) }),
      wipeAll: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock clipboard
const mockClipboard = {
  writeText: vi.fn().mockResolvedValue(undefined),
};

Object.assign(navigator, { clipboard: mockClipboard });

// ============================================================================
// IdentitySettings Tests
// ============================================================================

describe('IdentitySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders identity information when identity exists', () => {
    render(<IdentitySettings />);

    expect(screen.getByText(/Public Key/i)).toBeInTheDocument();
    expect(screen.getByText(/Fingerprint/i)).toBeInTheDocument();
    expect(screen.getByText(/Key Status/i)).toBeInTheDocument();
  });

  it('displays unlocked status when key is loaded', () => {
    render(<IdentitySettings />);

    expect(screen.getByText('[UNLOCKED]')).toBeInTheDocument();
    expect(screen.getByText(/Private key is loaded in memory/i)).toBeInTheDocument();
  });

  it('shows action buttons for export, password change, and QR', () => {
    render(<IdentitySettings />);

    expect(screen.getByText('Export Identity')).toBeInTheDocument();
    expect(screen.getByText('Change Password')).toBeInTheDocument();
    expect(screen.getByText('Show QR Code')).toBeInTheDocument();
  });

  it('copies npub to clipboard when copy button clicked', async () => {
    render(<IdentitySettings />);

    const copyButtons = screen.getAllByText('Copy');
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockIdentity.npub);
    });
  });

  it('opens export modal when Export Identity clicked', async () => {
    render(<IdentitySettings />);

    fireEvent.click(screen.getByText('Export Identity'));

    await waitFor(() => {
      expect(screen.getByText('> Export Identity')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your password/i)).toBeInTheDocument();
    });
  });

  it('shows error when export without password', async () => {
    render(<IdentitySettings />);

    fireEvent.click(screen.getByText('Export Identity'));

    await waitFor(() => {
      expect(screen.getByText('> Export Identity')).toBeInTheDocument();
    });

    // Click export without entering password
    fireEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(screen.getByText(/Password required/i)).toBeInTheDocument();
    });
  });

  it('opens password change modal when Change Password clicked', async () => {
    render(<IdentitySettings />);

    fireEvent.click(screen.getByText('Change Password'));

    await waitFor(() => {
      expect(screen.getByText('> Change Password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter current password/i)).toBeInTheDocument();
    });
  });

  it('validates password change form fields', async () => {
    render(<IdentitySettings />);

    fireEvent.click(screen.getByText('Change Password'));

    await waitFor(() => {
      expect(screen.getByText('> Change Password')).toBeInTheDocument();
    });

    // Fill in mismatched passwords
    const currentPwdInput = screen.getByPlaceholderText(/Enter current password/i);
    const newPwdInput = screen.getByPlaceholderText(/Enter new password/i);
    const confirmPwdInput = screen.getByPlaceholderText(/Confirm new password/i);

    fireEvent.input(currentPwdInput, { target: { value: 'oldpassword' } });
    fireEvent.input(newPwdInput, { target: { value: 'newpassword123' } });
    fireEvent.input(confirmPwdInput, { target: { value: 'differentpassword' } });

    fireEvent.click(screen.getByText('Change'));

    await waitFor(() => {
      expect(screen.getByText(/New passwords do not match/i)).toBeInTheDocument();
    });
  });

  it('validates minimum password length', async () => {
    render(<IdentitySettings />);

    fireEvent.click(screen.getByText('Change Password'));

    await waitFor(() => {
      expect(screen.getByText('> Change Password')).toBeInTheDocument();
    });

    const currentPwdInput = screen.getByPlaceholderText(/Enter current password/i);
    const newPwdInput = screen.getByPlaceholderText(/Enter new password/i);
    const confirmPwdInput = screen.getByPlaceholderText(/Confirm new password/i);

    fireEvent.input(currentPwdInput, { target: { value: 'oldpassword' } });
    fireEvent.input(newPwdInput, { target: { value: 'short' } });
    fireEvent.input(confirmPwdInput, { target: { value: 'short' } });

    fireEvent.click(screen.getByText('Change'));

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('opens QR modal when Show QR Code clicked', async () => {
    render(<IdentitySettings />);

    fireEvent.click(screen.getByText('Show QR Code'));

    await waitFor(() => {
      expect(screen.getByText('> Share Identity')).toBeInTheDocument();
      expect(screen.getByText(/Scan to add this identity/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// NetworkSettings Tests
// ============================================================================

describe('NetworkSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders connection status summary', async () => {
    render(<NetworkSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Connection Status/i)).toBeInTheDocument();
      expect(screen.getByText(/Connected:/i)).toBeInTheDocument();
    });
  });

  it('shows add custom relay input', () => {
    render(<NetworkSettings />);

    expect(screen.getByPlaceholderText(/wss:\/\/relay.example.com/i)).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('validates relay URL format on add', async () => {
    render(<NetworkSettings />);

    const input = screen.getByPlaceholderText(/wss:\/\/relay.example.com/i);
    fireEvent.input(input, { target: { value: 'invalid-url' } });

    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText(/Invalid URL format/i)).toBeInTheDocument();
    });
  });

  it('validates relay URL protocol', async () => {
    render(<NetworkSettings />);

    const input = screen.getByPlaceholderText(/wss:\/\/relay.example.com/i);
    fireEvent.input(input, { target: { value: 'https://not-websocket.com' } });

    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText(/must use wss:\/\/ or ws:\/\/ protocol/i)).toBeInTheDocument();
    });
  });

  it('shows error when trying to add empty relay URL', async () => {
    render(<NetworkSettings />);

    fireEvent.click(screen.getByText('Add'));

    await waitFor(() => {
      expect(screen.getByText(/Please enter a relay URL/i)).toBeInTheDocument();
    });
  });

  it('renders filter tabs', () => {
    render(<NetworkSettings />);

    expect(screen.getByText(/All/i)).toBeInTheDocument();
    expect(screen.getByText(/Connected/i)).toBeInTheDocument();
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
    expect(screen.getByText(/Primary/i)).toBeInTheDocument();
    expect(screen.getByText(/Custom/i)).toBeInTheDocument();
  });

  it('shows WebRTC settings section', () => {
    render(<NetworkSettings />);

    expect(screen.getByText(/WebRTC Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable WebRTC P2P/i)).toBeInTheDocument();
  });

  it('renders connection timeout slider', () => {
    render(<NetworkSettings />);

    expect(screen.getByText(/Connection Timeout/i)).toBeInTheDocument();
    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });
});

// ============================================================================
// PrivacySettings Tests
// ============================================================================

describe('PrivacySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders privacy settings header', () => {
    render(<PrivacySettings />);

    expect(screen.getByText(/Control how much information you share/i)).toBeInTheDocument();
  });

  it('shows location precision slider', () => {
    render(<PrivacySettings />);

    expect(screen.getByText(/Location Precision/i)).toBeInTheDocument();
  });

  it('displays precision guide information', () => {
    render(<PrivacySettings />);

    expect(screen.getByText(/Precision Guide/i)).toBeInTheDocument();
    expect(screen.getByText(/Country\/Region/i)).toBeInTheDocument();
    expect(screen.getByText(/Neighborhood/i)).toBeInTheDocument();
  });

  it('shows privacy toggle options', () => {
    render(<PrivacySettings />);

    expect(screen.getByText(/Anonymous Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Read Receipts/i)).toBeInTheDocument();
    expect(screen.getByText(/Typing Indicators/i)).toBeInTheDocument();
    expect(screen.getByText(/Auto-Join Location Channel/i)).toBeInTheDocument();
  });

  it('displays privacy warnings', () => {
    render(<PrivacySettings />);

    expect(screen.getByText(/Privacy Notes/i)).toBeInTheDocument();
    expect(screen.getByText(/Messages in location channels are public/i)).toBeInTheDocument();
  });

  it('shows privacy best practices', () => {
    render(<PrivacySettings />);

    expect(screen.getByText(/Privacy Best Practices/i)).toBeInTheDocument();
    expect(screen.getByText(/Use location precision 5-6/i)).toBeInTheDocument();
  });
});

// ============================================================================
// StorageSettings Tests
// ============================================================================

describe('StorageSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders storage usage section', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Storage Usage/i)).toBeInTheDocument();
    });
  });

  it('displays storage health info when loaded', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Backend:/i)).toBeInTheDocument();
      expect(screen.getByText(/OPFS/i)).toBeInTheDocument();
    });
  });

  it('shows export data button', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Export All Data/i)).toBeInTheDocument();
      expect(screen.getByText(/Download a JSON backup/i)).toBeInTheDocument();
    });
  });

  it('shows import data button', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Import Data/i)).toBeInTheDocument();
      expect(screen.getByText(/Restore from a previously exported/i)).toBeInTheDocument();
    });
  });

  it('shows clear message history option', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Clear Message History/i)).toBeInTheDocument();
    });
  });

  it('shows confirmation when clear clicked', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Clear Message History/i)).toBeInTheDocument();
    });

    // Click clear button
    const clearButtons = screen.getAllByText('Clear');
    fireEvent.click(clearButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText(/This will delete all local messages/i)).toBeInTheDocument();
    });
  });

  it('cancels clear operation when cancel clicked', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText(/Clear Message History/i)).toBeInTheDocument();
    });

    const clearButtons = screen.getAllByText('Clear');
    fireEvent.click(clearButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      // Should return to idle state
      const newClearButtons = screen.getAllByText('Clear');
      expect(newClearButtons.length).toBeGreaterThan(0);
    });
  });

  it('displays storage info footer', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText(/About Storage:/i)).toBeInTheDocument();
      expect(screen.getByText(/BitChat uses OPFS/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// DangerZone Tests
// ============================================================================

describe('DangerZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders danger zone warning header', () => {
    render(<DangerZone />);

    expect(screen.getByText(/DANGER ZONE/i)).toBeInTheDocument();
    expect(screen.getByText(/actions below are destructive/i)).toBeInTheDocument();
  });

  it('shows reset identity option', () => {
    render(<DangerZone />);

    expect(screen.getByText('Reset Identity')).toBeInTheDocument();
    expect(screen.getByText(/Generate a completely new cryptographic identity/i)).toBeInTheDocument();
  });

  it('shows wipe all data option', () => {
    render(<DangerZone />);

    expect(screen.getByText('Wipe All Data')).toBeInTheDocument();
    expect(screen.getByText(/Completely erase all data/i)).toBeInTheDocument();
  });

  it('shows warning step when reset clicked', async () => {
    render(<DangerZone />);

    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(screen.getByText(/Reset Identity/i)).toBeInTheDocument();
      expect(screen.getByText(/WARNING/i)).toBeInTheDocument();
      expect(screen.getByText(/destroy your current identity/i)).toBeInTheDocument();
      expect(screen.getByText('I Understand')).toBeInTheDocument();
    });
  });

  it('advances to confirmation step after warning acknowledged', async () => {
    render(<DangerZone />);

    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(screen.getByText('I Understand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('I Understand'));

    await waitFor(() => {
      expect(screen.getByText(/type the following phrase/i)).toBeInTheDocument();
      expect(screen.getByText('RESET MY IDENTITY')).toBeInTheDocument();
    });
  });

  it('validates confirmation text exactly', async () => {
    render(<DangerZone />);

    // Go through warning step
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(screen.getByText('I Understand')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('I Understand'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Type the phrase above/i)).toBeInTheDocument();
    });

    // Enter wrong text
    const input = screen.getByPlaceholderText(/Type the phrase above/i);
    fireEvent.input(input, { target: { value: 'wrong text' } });

    fireEvent.click(screen.getByText('Continue'));

    await waitFor(() => {
      expect(screen.getByText(/Type "RESET MY IDENTITY" exactly/i)).toBeInTheDocument();
    });
  });

  it('can cancel at any confirmation step', async () => {
    render(<DangerZone />);

    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      // Should return to normal state
      expect(screen.queryByText(/WARNING/i)).not.toBeInTheDocument();
    });
  });

  it('shows warning step when wipe clicked', async () => {
    render(<DangerZone />);

    fireEvent.click(screen.getByText('Wipe'));

    await waitFor(() => {
      expect(screen.getByText(/Wipe All Data/i)).toBeInTheDocument();
      expect(screen.getByText(/WARNING/i)).toBeInTheDocument();
      expect(screen.getByText(/PERMANENTLY DELETE all data/i)).toBeInTheDocument();
    });
  });

  it('shows emergency wipe info', () => {
    render(<DangerZone />);

    expect(screen.getByText(/Emergency Wipe/i)).toBeInTheDocument();
    expect(screen.getByText(/triple-tap the BitChat logo/i)).toBeInTheDocument();
  });
});

// ============================================================================
// AboutSettings Tests
// ============================================================================

describe('AboutSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders version information', () => {
    render(<AboutSettings />);

    expect(screen.getByText(/Version Information/i)).toBeInTheDocument();
    expect(screen.getByText(/Version:/i)).toBeInTheDocument();
    expect(screen.getByText(/Build:/i)).toBeInTheDocument();
    expect(screen.getByText(/Platform:/i)).toBeInTheDocument();
  });

  it('shows native apps section', () => {
    render(<AboutSettings />);

    expect(screen.getByText(/Native Apps/i)).toBeInTheDocument();
    expect(screen.getByText(/BitChat is available as native apps/i)).toBeInTheDocument();
  });

  it('displays region selectors for app store links', () => {
    render(<AboutSettings />);

    expect(screen.getByText(/Americas/i)).toBeInTheDocument();
    expect(screen.getByText(/Europe/i)).toBeInTheDocument();
    expect(screen.getByText(/Asia/i)).toBeInTheDocument();
  });

  it('expands region to show country links', async () => {
    render(<AboutSettings />);

    // Click on Americas region
    fireEvent.click(screen.getByText(/Americas/i));

    await waitFor(() => {
      expect(screen.getByText('United States')).toBeInTheDocument();
      expect(screen.getByText('Canada')).toBeInTheDocument();
      expect(screen.getByText('Brazil')).toBeInTheDocument();
    });
  });

  it('collapses region when clicked again', async () => {
    render(<AboutSettings />);

    // Expand Americas
    fireEvent.click(screen.getByText(/Americas/i));

    await waitFor(() => {
      expect(screen.getByText('United States')).toBeInTheDocument();
    });

    // Collapse Americas
    fireEvent.click(screen.getByText(/Americas/i));

    await waitFor(() => {
      expect(screen.queryByText('United States')).not.toBeInTheDocument();
    });
  });

  it('shows links section', () => {
    render(<AboutSettings />);

    expect(screen.getByText(/Source Code/i)).toBeInTheDocument();
    expect(screen.getByText(/Web App/i)).toBeInTheDocument();
    expect(screen.getByText(/About Nostr Protocol/i)).toBeInTheDocument();
  });

  it('shows license information', () => {
    render(<AboutSettings />);

    // Use getAllByText since License appears multiple times in the page
    const licenseElements = screen.getAllByText(/License/i);
    expect(licenseElements.length).toBeGreaterThan(0);
  });

  it('shows built with credits', () => {
    render(<AboutSettings />);

    // Use getAllByText since these appear in different parts of the page
    const builtWithElements = screen.getAllByText(/Built With/i);
    expect(builtWithElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Preact')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Zustand')).toBeInTheDocument();
  });

  it('shows privacy footer', () => {
    render(<AboutSettings />);

    expect(screen.getByText(/Your keys, your messages, your privacy/i)).toBeInTheDocument();
    expect(screen.getByText(/No tracking. No analytics/i)).toBeInTheDocument();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Settings Components Integration', () => {
  it('maintains state between modal opens and closes', async () => {
    render(<IdentitySettings />);

    // Open export modal
    fireEvent.click(screen.getByText('Export Identity'));

    await waitFor(() => {
      expect(screen.getByText('> Export Identity')).toBeInTheDocument();
    });

    // Enter password
    const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
    fireEvent.input(passwordInput, { target: { value: 'testpassword' } });

    // Close modal
    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('> Export Identity')).not.toBeInTheDocument();
    });

    // Reopen - should be reset
    fireEvent.click(screen.getByText('Export Identity'));

    await waitFor(() => {
      const newPasswordInput = screen.getByPlaceholderText(/Enter your password/i);
      expect((newPasswordInput as HTMLInputElement).value).toBe('');
    });
  });

  it('handles concurrent async operations gracefully', async () => {
    render(<StorageSettings />);

    await waitFor(() => {
      expect(screen.getByText('Export')).toBeInTheDocument();
    });

    // Clicking export multiple times should not cause issues
    fireEvent.click(screen.getByText('Export'));

    // Should show exporting state
    await waitFor(() => {
      expect(screen.getByText(/Exporting.../i)).toBeInTheDocument();
    });
  });
});
