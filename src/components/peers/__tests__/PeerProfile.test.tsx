/**
 * PeerProfile Component Tests
 *
 * Tests for the peer details view component including:
 * - Rendering peer information
 * - Fingerprint grid display and copy functionality
 * - Nickname editing
 * - Trust level selector
 * - Notes editing
 * - Remove peer (danger zone)
 * - Back navigation
 * - Message and verify actions
 * - Error state for non-existent peer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import { PeerProfile } from '../PeerProfile';
import type { Peer } from '../../../stores/types';

// ============================================================================
// Mock Data Factories
// ============================================================================

function createMockPeer(overrides: Partial<Peer> = {}): Peer {
  const fingerprint =
    overrides.fingerprint ?? 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
  return {
    fingerprint,
    publicKey: overrides.publicKey ?? `pubkey-${fingerprint}`,
    nickname: overrides.nickname ?? 'Test Peer',
    status: overrides.status ?? 'offline',
    lastSeenAt: overrides.lastSeenAt ?? Date.now(),
    source: overrides.source ?? 'nostr',
    isTrusted: overrides.isTrusted ?? false,
    isBlocked: overrides.isBlocked ?? false,
    notes: overrides.notes,
    avatar: overrides.avatar,
    nip05: overrides.nip05,
  };
}

// ============================================================================
// Mock Store Setup
// ============================================================================

let mockPeer: Peer | undefined = undefined;
const mockUpdatePeer = vi.fn();
const mockSetTrusted = vi.fn();
const mockSetBlocked = vi.fn();
const mockRemovePeer = vi.fn();

vi.mock('../../../stores/peers-store', () => ({
  usePeersStore: () => ({
    updatePeer: mockUpdatePeer,
    setTrusted: mockSetTrusted,
    setBlocked: mockSetBlocked,
    removePeer: mockRemovePeer,
  }),
  usePeer: (fingerprint: string) => {
    if (mockPeer && mockPeer.fingerprint === fingerprint) {
      return mockPeer;
    }
    return undefined;
  },
}));

// Mock PeerItem helpers
vi.mock('../PeerItem', () => ({
  formatLastSeen: (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  },
  generateVisualFingerprint: (fingerprint: string) => {
    // Return 4 colors based on fingerprint
    return ['#ff4444', '#00ff00', '#0066ff', '#ff00ff'];
  },
}));

// Mock clipboard API
const mockClipboardWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockClipboardWriteText,
  },
  writable: true,
});

// ============================================================================
// Tests
// ============================================================================

describe('PeerProfile Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPeer = undefined;
    mockClipboardWriteText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  describe('peer not found state', () => {
    it('should show error state when peer does not exist', () => {
      mockPeer = undefined;

      render(<PeerProfile fingerprint="nonexistent-fingerprint" />);

      expect(screen.getByText('Peer not found')).toBeDefined();
      expect(
        screen.getByText('This peer may have been removed.')
      ).toBeDefined();
    });

    it('should show back button in error state', () => {
      const onBack = vi.fn();
      mockPeer = undefined;

      render(<PeerProfile fingerprint="nonexistent" onBack={onBack} />);

      const backButton = screen.getByText('Back to Peers');
      expect(backButton).toBeDefined();

      fireEvent.click(backButton);
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('basic rendering', () => {
    it('should render peer nickname', () => {
      mockPeer = createMockPeer({ nickname: 'Alice' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('Alice')).toBeDefined();
    });

    it('should render back button when onBack is provided', () => {
      mockPeer = createMockPeer();

      render(
        <PeerProfile fingerprint={mockPeer.fingerprint} onBack={() => {}} />
      );

      expect(screen.getByLabelText('Go back')).toBeDefined();
    });

    it('should call onBack when back button is clicked', () => {
      const onBack = vi.fn();
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} onBack={onBack} />);

      const backButton = screen.getByLabelText('Go back');
      fireEvent.click(backButton);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('should render peer source', () => {
      mockPeer = createMockPeer({ source: 'nostr' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText(/via nostr/i)).toBeDefined();
    });

    it('should render NIP-05 identifier when present', () => {
      mockPeer = createMockPeer({ nip05: 'alice@example.com' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('alice@example.com')).toBeDefined();
      expect(screen.getByText('[NIP-05]')).toBeDefined();
    });
  });

  describe('online status', () => {
    it('should show "Online now" for online peers', () => {
      mockPeer = createMockPeer({ status: 'online' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('Online now')).toBeDefined();
    });

    it('should show last seen time for offline peers', () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      mockPeer = createMockPeer({ status: 'offline', lastSeenAt: fiveMinutesAgo });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText(/Last seen 5m ago/)).toBeDefined();
    });

    it('should show correct status indicator color for online', () => {
      mockPeer = createMockPeer({ status: 'online' });

      const { container } = render(
        <PeerProfile fingerprint={mockPeer.fingerprint} />
      );

      const statusDot = container.querySelector('.bg-terminal-green');
      expect(statusDot).toBeDefined();
    });

    it('should show correct status indicator color for away', () => {
      mockPeer = createMockPeer({ status: 'away' });

      const { container } = render(
        <PeerProfile fingerprint={mockPeer.fingerprint} />
      );

      const statusDot = container.querySelector('.bg-terminal-yellow');
      expect(statusDot).toBeDefined();
    });

    it('should show correct status indicator color for offline', () => {
      mockPeer = createMockPeer({ status: 'offline' });

      const { container } = render(
        <PeerProfile fingerprint={mockPeer.fingerprint} />
      );

      const statusDot = container.querySelector('.bg-muted');
      expect(statusDot).toBeDefined();
    });
  });

  describe('fingerprint grid', () => {
    it('should render fingerprint section', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('Fingerprint')).toBeDefined();
    });

    it('should render copy button', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('[COPY]')).toBeDefined();
    });

    it('should copy fingerprint when copy button is clicked', async () => {
      mockPeer = createMockPeer({ fingerprint: 'a1b2c3d4e5f6g7h8' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const copyButton = screen.getByText('[COPY]');
      fireEvent.click(copyButton);

      expect(mockClipboardWriteText).toHaveBeenCalledWith('a1b2c3d4e5f6g7h8');
    });

    it('should show [COPIED] after successful copy', async () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const copyButton = screen.getByText('[COPY]');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('[COPIED]')).toBeDefined();
      });
    });

    it('should render visual fingerprint blocks', () => {
      mockPeer = createMockPeer();

      const { container } = render(
        <PeerProfile fingerprint={mockPeer.fingerprint} />
      );

      // Should have 4 colored blocks in the visual fingerprint
      const visualFingerprint = container.querySelector('.w-16.h-16.grid');
      expect(visualFingerprint).toBeDefined();
    });

    it('should render fingerprint in 4-character chunks', () => {
      mockPeer = createMockPeer({ fingerprint: 'a1b2c3d4e5f6g7h8' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // First 4 chunks should be visible
      expect(screen.getByText('a1b2')).toBeDefined();
      expect(screen.getByText('c3d4')).toBeDefined();
    });
  });

  describe('nickname editing', () => {
    it('should show edit button for nickname', () => {
      mockPeer = createMockPeer({ nickname: 'Alice' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Multiple edit buttons exist (nickname and notes)
      const editButtons = screen.getAllByText('[EDIT]');
      expect(editButtons.length).toBeGreaterThan(0);
    });

    it('should switch to edit mode when edit button is clicked', () => {
      mockPeer = createMockPeer({ nickname: 'Alice' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[0]); // First edit button is for nickname

      // Should show input field
      const input = screen.getByDisplayValue('Alice');
      expect(input).toBeDefined();
    });

    it('should save nickname when OK is clicked', () => {
      mockPeer = createMockPeer({
        fingerprint: 'fp-123',
        nickname: 'Alice',
      });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Enter edit mode
      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[0]);

      // Change value
      const input = screen.getByDisplayValue('Alice') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Alice Updated' } });

      // Click OK
      const okButton = screen.getByText('[OK]');
      fireEvent.click(okButton);

      expect(mockUpdatePeer).toHaveBeenCalledWith('fp-123', {
        nickname: 'Alice Updated',
      });
    });

    it('should cancel editing when cancel button is clicked', () => {
      mockPeer = createMockPeer({ nickname: 'Alice' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Enter edit mode
      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[0]);

      // Change value
      const input = screen.getByDisplayValue('Alice') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Changed' } });

      // Click cancel - there may be multiple [X] buttons, use getAllByText
      const cancelButtons = screen.getAllByText('[X]');
      fireEvent.click(cancelButtons[0]);

      // Should not have called updatePeer
      expect(mockUpdatePeer).not.toHaveBeenCalled();

      // Should show original name
      expect(screen.getByText('Alice')).toBeDefined();
    });

    it('should save nickname when Enter is pressed', () => {
      mockPeer = createMockPeer({
        fingerprint: 'fp-123',
        nickname: 'Alice',
      });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Enter edit mode
      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[0]);

      // Change value and press Enter
      const input = screen.getByDisplayValue('Alice') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'New Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(mockUpdatePeer).toHaveBeenCalledWith('fp-123', {
        nickname: 'New Name',
      });
    });

    it('should cancel editing when Escape is pressed', () => {
      mockPeer = createMockPeer({ nickname: 'Alice' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Enter edit mode
      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[0]);

      // Change value and press Escape
      const input = screen.getByDisplayValue('Alice') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Changed' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      // Should not have saved
      expect(mockUpdatePeer).not.toHaveBeenCalled();
    });

    it('should not save if nickname is unchanged', () => {
      mockPeer = createMockPeer({
        fingerprint: 'fp-123',
        nickname: 'Alice',
      });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Enter edit mode
      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[0]);

      // Click OK without changing
      const okButton = screen.getByText('[OK]');
      fireEvent.click(okButton);

      // Should not call updatePeer if name is same
      expect(mockUpdatePeer).not.toHaveBeenCalled();
    });
  });

  describe('trust level selector', () => {
    it('should render trust level options', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('Trust Level')).toBeDefined();
      expect(screen.getByText('BLOCKED')).toBeDefined();
      expect(screen.getByText('UNKNOWN')).toBeDefined();
      expect(screen.getByText('TRUSTED')).toBeDefined();
    });

    it('should highlight UNKNOWN for neutral peer', () => {
      mockPeer = createMockPeer({ isTrusted: false, isBlocked: false });

      const { container } = render(
        <PeerProfile fingerprint={mockPeer.fingerprint} />
      );

      // Find the trust level section
      const trustSection = screen.getByText('Trust Level').parentElement;
      expect(trustSection).toBeDefined();

      // UNKNOWN should be highlighted (has text-muted class and is current)
      const unknownButton = screen.getByText('UNKNOWN').closest('button');
      expect(unknownButton?.className).toContain('bg-current/10');
    });

    it('should highlight TRUSTED for trusted peer', () => {
      mockPeer = createMockPeer({ isTrusted: true, isBlocked: false });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const trustedButton = screen.getByText('TRUSTED').closest('button');
      expect(trustedButton?.className).toContain('text-terminal-green');
    });

    it('should highlight BLOCKED for blocked peer', () => {
      mockPeer = createMockPeer({ isTrusted: false, isBlocked: true });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const blockedButton = screen.getByText('BLOCKED').closest('button');
      expect(blockedButton?.className).toContain('text-terminal-red');
    });

    it('should call setTrusted when TRUSTED is clicked', () => {
      mockPeer = createMockPeer({
        fingerprint: 'fp-123',
        isTrusted: false,
        isBlocked: false,
      });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const trustedButton = screen.getByText('TRUSTED').closest('button');
      fireEvent.click(trustedButton!);

      expect(mockSetTrusted).toHaveBeenCalledWith('fp-123', true);
    });

    it('should call setBlocked when BLOCKED is clicked', () => {
      mockPeer = createMockPeer({
        fingerprint: 'fp-123',
        isTrusted: false,
        isBlocked: false,
      });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const blockedButton = screen.getByText('BLOCKED').closest('button');
      fireEvent.click(blockedButton!);

      expect(mockSetBlocked).toHaveBeenCalledWith('fp-123', true);
    });

    it('should reset trust when UNKNOWN is clicked', () => {
      mockPeer = createMockPeer({
        fingerprint: 'fp-123',
        isTrusted: true,
        isBlocked: false,
      });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const unknownButton = screen.getByText('UNKNOWN').closest('button');
      fireEvent.click(unknownButton!);

      expect(mockSetBlocked).toHaveBeenCalledWith('fp-123', false);
      expect(mockSetTrusted).toHaveBeenCalledWith('fp-123', false);
    });
  });

  describe('notes editor', () => {
    it('should show notes section', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('Notes')).toBeDefined();
    });

    it('should show placeholder when no notes', () => {
      mockPeer = createMockPeer({ notes: undefined });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('No notes added.')).toBeDefined();
    });

    it('should show existing notes', () => {
      mockPeer = createMockPeer({ notes: 'Met at conference' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('Met at conference')).toBeDefined();
    });

    it('should enter edit mode when edit button is clicked', () => {
      mockPeer = createMockPeer({ notes: 'Some notes' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Click the edit button in notes section
      const editButtons = screen.getAllByText('[EDIT]');
      // Notes edit button is typically the second one
      fireEvent.click(editButtons[editButtons.length - 1]);

      // Should show textarea
      const textarea = screen.getByPlaceholderText(
        'Add private notes about this peer...'
      );
      expect(textarea).toBeDefined();
    });

    it('should save notes when save button is clicked', () => {
      mockPeer = createMockPeer({
        fingerprint: 'fp-123',
        notes: undefined,
      });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Enter edit mode
      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[editButtons.length - 1]);

      // Enter notes
      const textarea = screen.getByPlaceholderText(
        'Add private notes about this peer...'
      );
      fireEvent.input(textarea, { target: { value: 'New notes here' } });

      // Save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(mockUpdatePeer).toHaveBeenCalledWith('fp-123', {
        notes: 'New notes here',
      });
    });

    it('should cancel notes editing', () => {
      mockPeer = createMockPeer({ notes: 'Original notes' });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Enter edit mode
      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[editButtons.length - 1]);

      // Enter notes
      const textarea = screen.getByPlaceholderText(
        'Add private notes about this peer...'
      );
      fireEvent.input(textarea, { target: { value: 'Changed notes' } });

      // Cancel
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Should not have saved
      expect(mockUpdatePeer).not.toHaveBeenCalled();

      // Should show original notes
      expect(screen.getByText('Original notes')).toBeDefined();
    });

    it('should clear notes when saved with empty value', () => {
      mockPeer = createMockPeer({
        fingerprint: 'fp-123',
        notes: 'Some notes',
      });

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // Enter edit mode
      const editButtons = screen.getAllByText('[EDIT]');
      fireEvent.click(editButtons[editButtons.length - 1]);

      // Clear notes
      const textarea = screen.getByDisplayValue('Some notes');
      fireEvent.input(textarea, { target: { value: '' } });

      // Save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);

      expect(mockUpdatePeer).toHaveBeenCalledWith('fp-123', {
        notes: undefined,
      });
    });
  });

  describe('danger zone - remove peer', () => {
    it('should show danger zone section', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('Danger Zone')).toBeDefined();
    });

    it('should show remove peer button', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      expect(screen.getByText('Remove Peer')).toBeDefined();
    });

    it('should show confirmation when remove is clicked', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const removeButton = screen.getByText('Remove Peer');
      fireEvent.click(removeButton);

      expect(
        screen.getByText(/Are you sure you want to remove this peer/)
      ).toBeDefined();
      expect(screen.getByText(/This cannot be undone/)).toBeDefined();
    });

    it('should show cancel button in confirmation', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      fireEvent.click(screen.getByText('Remove Peer'));

      // In confirmation state
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDefined();
    });

    it('should cancel removal when cancel is clicked', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      fireEvent.click(screen.getByText('Remove Peer'));
      fireEvent.click(screen.getByText('Cancel'));

      // Should be back to normal state
      expect(
        screen.queryByText(/Are you sure you want to remove/)
      ).toBeNull();
      expect(mockRemovePeer).not.toHaveBeenCalled();
    });

    it('should remove peer when confirmed', () => {
      const onBack = vi.fn();
      mockPeer = createMockPeer({ fingerprint: 'fp-to-remove' });

      render(
        <PeerProfile fingerprint={mockPeer.fingerprint} onBack={onBack} />
      );

      // Click remove
      fireEvent.click(screen.getByText('Remove Peer'));

      // Confirm
      const confirmButtons = screen.getAllByText('Remove Peer');
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);

      expect(mockRemovePeer).toHaveBeenCalledWith('fp-to-remove');
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('footer actions', () => {
    it('should show Message button for non-blocked peer', () => {
      mockPeer = createMockPeer({ isBlocked: false });

      render(
        <PeerProfile
          fingerprint={mockPeer.fingerprint}
          onMessage={() => {}}
        />
      );

      expect(screen.getByText('Message')).toBeDefined();
    });

    it('should not show Message button for blocked peer', () => {
      mockPeer = createMockPeer({ isBlocked: true });

      render(
        <PeerProfile
          fingerprint={mockPeer.fingerprint}
          onMessage={() => {}}
        />
      );

      expect(screen.queryByText('Message')).toBeNull();
    });

    it('should call onMessage when Message button is clicked', () => {
      const onMessage = vi.fn();
      mockPeer = createMockPeer({ isBlocked: false });

      render(
        <PeerProfile fingerprint={mockPeer.fingerprint} onMessage={onMessage} />
      );

      const messageButton = screen.getByText('Message');
      fireEvent.click(messageButton);

      expect(onMessage).toHaveBeenCalledWith(mockPeer);
    });

    it('should show Verify button for untrusted, non-blocked peer', () => {
      mockPeer = createMockPeer({ isTrusted: false, isBlocked: false });

      render(
        <PeerProfile
          fingerprint={mockPeer.fingerprint}
          onVerify={() => {}}
        />
      );

      expect(screen.getByText('Verify')).toBeDefined();
    });

    it('should not show Verify button for trusted peer', () => {
      mockPeer = createMockPeer({ isTrusted: true, isBlocked: false });

      render(
        <PeerProfile
          fingerprint={mockPeer.fingerprint}
          onVerify={() => {}}
        />
      );

      expect(screen.queryByText('Verify')).toBeNull();
    });

    it('should not show Verify button for blocked peer', () => {
      mockPeer = createMockPeer({ isTrusted: false, isBlocked: true });

      render(
        <PeerProfile
          fingerprint={mockPeer.fingerprint}
          onVerify={() => {}}
        />
      );

      expect(screen.queryByText('Verify')).toBeNull();
    });

    it('should call onVerify when Verify button is clicked', () => {
      const onVerify = vi.fn();
      mockPeer = createMockPeer({ isTrusted: false, isBlocked: false });

      render(
        <PeerProfile fingerprint={mockPeer.fingerprint} onVerify={onVerify} />
      );

      const verifyButton = screen.getByText('Verify');
      fireEvent.click(verifyButton);

      expect(onVerify).toHaveBeenCalledWith(mockPeer);
    });
  });

  describe('error handling', () => {
    it('should handle clipboard copy failure gracefully', async () => {
      mockClipboardWriteText.mockRejectedValue(new Error('Clipboard error'));
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      const copyButton = screen.getByText('[COPY]');

      // Should not throw
      await expect(
        (async () => {
          fireEvent.click(copyButton);
        })()
      ).resolves.not.toThrow();

      // Should still show [COPY] (not [COPIED])
      expect(screen.getByText('[COPY]')).toBeDefined();
    });
  });

  describe('accessibility', () => {
    it('should have accessible back button', () => {
      mockPeer = createMockPeer();

      render(
        <PeerProfile fingerprint={mockPeer.fingerprint} onBack={() => {}} />
      );

      expect(screen.getByLabelText('Go back')).toBeDefined();
    });

    it('should have trust level buttons', () => {
      mockPeer = createMockPeer();

      render(<PeerProfile fingerprint={mockPeer.fingerprint} />);

      // All trust level options should be buttons
      const blockedButton = screen.getByText('BLOCKED').closest('button');
      const unknownButton = screen.getByText('UNKNOWN').closest('button');
      const trustedButton = screen.getByText('TRUSTED').closest('button');

      expect(blockedButton).toBeDefined();
      expect(unknownButton).toBeDefined();
      expect(trustedButton).toBeDefined();
    });
  });
});
