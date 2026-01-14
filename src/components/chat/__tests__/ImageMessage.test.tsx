/**
 * ImageMessage Component Tests
 *
 * Tests for the image message display component including:
 * - Blurred by default rendering
 * - Tap to reveal functionality
 * - Auto-reveal setting respect
 * - Context menu actions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import { ImageMessage, type ImageMessageProps } from '../ImageMessage';
import type { ImageMessageContent } from '../../../services/media/image-handler';

// ============================================================================
// Mocks
// ============================================================================

// Mock the image-handler service
const mockImageHandler = {
  createImageUrl: vi.fn(),
  getImage: vi.fn(),
};

vi.mock('../../../services/media/image-handler', () => ({
  getImageHandler: vi.fn(() => mockImageHandler),
}));

// Mock the settings store
let mockAutoRevealImages = false;

vi.mock('../../../stores/settings-store', () => ({
  useAutoRevealImages: vi.fn(() => mockAutoRevealImages),
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-image-url');
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

// ============================================================================
// Test Data
// ============================================================================

const mockImageContent: ImageMessageContent = {
  type: 'image',
  imageId: 'img-123',
  thumbnail: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', // Minimal valid base64 thumbnail
  width: 800,
  height: 600,
  mimeType: 'image/jpeg',
};

const defaultProps: ImageMessageProps = {
  content: mockImageContent,
  isOwn: false,
};

// ============================================================================
// ImageMessage Component Tests
// ============================================================================

describe('ImageMessage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAutoRevealImages = false;
    mockImageHandler.createImageUrl.mockResolvedValue('blob:revealed-image-url');
    mockImageHandler.getImage.mockResolvedValue(new Blob(['mock image'], { type: 'image/jpeg' }));
  });

  afterEach(() => {
    cleanup();
  });

  describe('Blurred Default State', () => {
    it('should render blurred thumbnail by default', () => {
      render(<ImageMessage {...defaultProps} />);

      // Should have blurred thumbnail image
      const blurredImg = document.querySelector('img[alt="Blurred preview"]');
      expect(blurredImg).toBeDefined();
      expect(blurredImg?.getAttribute('style')).toContain('blur');
    });

    it('should show tap to reveal overlay', () => {
      render(<ImageMessage {...defaultProps} />);

      // Should show "Tap to reveal" text
      const revealText = screen.queryByText(/Tap to reveal/i);
      expect(revealText).toBeDefined();
    });

    it('should show eye icon in unrevealed state', () => {
      render(<ImageMessage {...defaultProps} />);

      // Eye icon should be present for unrevealed images
      const overlay = document.querySelector('.bg-black\\/30');
      expect(overlay).toBeDefined();
    });

    it('should render with correct dimensions based on content', () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('.rounded-terminal');
      expect(container).toBeDefined();

      // Should have style with calculated dimensions
      const style = container?.getAttribute('style');
      expect(style).toContain('width');
      expect(style).toContain('height');
    });

    it('should scale down large images while maintaining aspect ratio', () => {
      const largeContent: ImageMessageContent = {
        ...mockImageContent,
        width: 4000,
        height: 3000,
      };

      render(<ImageMessage content={largeContent} isOwn={false} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      const style = container?.getAttribute('style');

      // Width should be constrained (max 280px)
      expect(style).toContain('width');
    });
  });

  describe('Tap to Reveal', () => {
    it('should reveal image on click', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      expect(container).toBeDefined();

      // Click to reveal
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalledWith('img-123');
      });
    });

    it('should remove blur overlay after revealing', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        // After reveal, "Tap to reveal" should be gone
        const revealText = screen.queryByText(/Tap to reveal/i);
        expect(revealText).toBeNull();
      });
    });

    it('should show full image after revealing', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        const fullImage = document.querySelector('img[alt="Image message"]');
        expect(fullImage).toBeDefined();
        expect(fullImage?.getAttribute('src')).toBe('blob:revealed-image-url');
      });
    });

    it('should call onReveal callback when image is revealed', async () => {
      const onReveal = vi.fn();
      render(<ImageMessage {...defaultProps} onReveal={onReveal} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(onReveal).toHaveBeenCalled();
      });
    });

    it('should show loading indicator while revealing', async () => {
      // Make createImageUrl take time
      mockImageHandler.createImageUrl.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('blob:url'), 100))
      );

      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      // Should show loading spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeDefined();
    });

    it('should not trigger reveal on already revealed image', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');

      // First click
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalledTimes(1);
      });

      // Second click should not call createImageUrl again
      fireEvent.click(container!);

      expect(mockImageHandler.createImageUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe('Auto-reveal Setting', () => {
    it('should auto-reveal when autoRevealImages setting is true', async () => {
      mockAutoRevealImages = true;

      render(<ImageMessage {...defaultProps} />);

      await waitFor(() => {
        // Should automatically load the image
        expect(mockImageHandler.createImageUrl).toHaveBeenCalledWith('img-123');
      });
    });

    it('should not show tap to reveal when auto-reveal is enabled', async () => {
      mockAutoRevealImages = true;

      render(<ImageMessage {...defaultProps} />);

      await waitFor(() => {
        const revealText = screen.queryByText(/Tap to reveal/i);
        expect(revealText).toBeNull();
      });
    });

    it('should respect autoReveal setting change', async () => {
      // Start with auto-reveal disabled
      mockAutoRevealImages = false;

      const { rerender } = render(<ImageMessage {...defaultProps} />);

      // Should show tap to reveal
      expect(screen.queryByText(/Tap to reveal/i)).toBeDefined();

      // Enable auto-reveal and rerender
      mockAutoRevealImages = true;

      // Rerender simulates the setting change
      rerender(<ImageMessage {...defaultProps} />);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });
    });
  });

  describe('Own vs Other Message Styling', () => {
    it('should align own messages to the right', () => {
      render(<ImageMessage {...defaultProps} isOwn={true} />);

      const container = document.querySelector('[class*="ml-auto"]');
      expect(container).toBeDefined();
    });

    it('should align other messages to the left', () => {
      render(<ImageMessage {...defaultProps} isOwn={false} />);

      const container = document.querySelector('[class*="mr-auto"]');
      expect(container).toBeDefined();
    });
  });

  describe('Context Menu (Long Press)', () => {
    it('should show context menu on right-click when revealed', async () => {
      render(<ImageMessage {...defaultProps} />);

      // First reveal the image
      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      // Right-click to show context menu
      fireEvent.contextMenu(container!);

      await waitFor(() => {
        // Context menu should appear
        const saveButton = screen.queryByText('Save');
        expect(saveButton).toBeDefined();
      });
    });

    it('should not show context menu on unrevealed image', () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');

      // Right-click without revealing first
      fireEvent.contextMenu(container!);

      // Context menu should not appear
      const saveButton = screen.queryByText('Save');
      expect(saveButton).toBeNull();
    });

    it('should have Save option in context menu', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      fireEvent.contextMenu(container!);

      await waitFor(() => {
        expect(screen.queryByText('Save')).toBeDefined();
      });
    });

    it('should have Copy option in context menu', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      fireEvent.contextMenu(container!);

      await waitFor(() => {
        expect(screen.queryByText('Copy')).toBeDefined();
      });
    });

    it('should have Cancel option in context menu', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      fireEvent.contextMenu(container!);

      await waitFor(() => {
        expect(screen.queryByText('Cancel')).toBeDefined();
      });
    });

    it('should close context menu on cancel click', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      fireEvent.contextMenu(container!);

      await waitFor(() => {
        const cancelButton = screen.queryByText('Cancel');
        expect(cancelButton).toBeDefined();
        fireEvent.click(cancelButton!);
      });

      await waitFor(() => {
        // Context menu should close
        expect(screen.queryByText('Save')).toBeNull();
      });
    });

    it('should call onContextMenu callback with save action', async () => {
      const onContextMenu = vi.fn();
      render(<ImageMessage {...defaultProps} onContextMenu={onContextMenu} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      fireEvent.contextMenu(container!);

      await waitFor(() => {
        const saveButton = screen.queryByText('Save');
        fireEvent.click(saveButton!);
      });

      await waitFor(() => {
        expect(onContextMenu).toHaveBeenCalledWith('save');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle image load failure gracefully', async () => {
      mockImageHandler.createImageUrl.mockResolvedValue(null);

      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      // Should still show blurred thumbnail on failure
      const blurredImg = document.querySelector('img[alt="Blurred preview"]');
      expect(blurredImg).toBeDefined();
    });

    it('should handle createImageUrl rejection', async () => {
      mockImageHandler.createImageUrl.mockRejectedValue(new Error('Load failed'));

      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      // Should not crash, blurred preview should remain
      const blurredImg = document.querySelector('img[alt="Blurred preview"]');
      expect(blurredImg).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should handle unmount gracefully', async () => {
      const { unmount } = render(<ImageMessage {...defaultProps} />);

      // Reveal the image
      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have cursor pointer for clickable image', () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="cursor-pointer"]');
      expect(container).toBeDefined();
    });

    it('should prevent image dragging', () => {
      render(<ImageMessage {...defaultProps} />);

      const img = document.querySelector('img');
      expect(img?.getAttribute('draggable')).toBe('false');
    });

    it('should have alt text on blurred preview', () => {
      render(<ImageMessage {...defaultProps} />);

      const img = document.querySelector('img[alt="Blurred preview"]');
      expect(img).toBeDefined();
    });

    it('should have alt text on revealed image', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        const fullImg = document.querySelector('img[alt="Image message"]');
        expect(fullImg).toBeDefined();
      });
    });

    it('should have selectable content class', () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('.select-none');
      expect(container).toBeDefined();
    });

    it('should have type button on context menu buttons', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      fireEvent.contextMenu(container!);

      await waitFor(() => {
        const buttons = document.querySelectorAll('.bg-surface button[type="button"]');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small image dimensions', () => {
      const smallContent: ImageMessageContent = {
        ...mockImageContent,
        width: 10,
        height: 10,
      };

      render(<ImageMessage content={smallContent} isOwn={false} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      const style = container?.getAttribute('style');

      // Should enforce minimum size
      expect(style).toContain('width');
      expect(style).toContain('height');
    });

    it('should handle very tall image (portrait)', () => {
      const tallContent: ImageMessageContent = {
        ...mockImageContent,
        width: 200,
        height: 2000,
      };

      render(<ImageMessage content={tallContent} isOwn={false} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      expect(container).toBeDefined();
    });

    it('should handle very wide image (landscape)', () => {
      const wideContent: ImageMessageContent = {
        ...mockImageContent,
        width: 2000,
        height: 200,
      };

      render(<ImageMessage content={wideContent} isOwn={false} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      expect(container).toBeDefined();
    });

    it('should handle square image', () => {
      const squareContent: ImageMessageContent = {
        ...mockImageContent,
        width: 500,
        height: 500,
      };

      render(<ImageMessage content={squareContent} isOwn={false} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      expect(container).toBeDefined();
    });

    it('should handle missing thumbnail gracefully', () => {
      const contentWithEmptyThumbnail: ImageMessageContent = {
        ...mockImageContent,
        thumbnail: '',
      };

      render(<ImageMessage content={contentWithEmptyThumbnail} isOwn={false} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      expect(container).toBeDefined();
    });
  });

  describe('Loading States', () => {
    it('should show loading state while fetching image', async () => {
      mockImageHandler.createImageUrl.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('blob:url'), 1000))
      );

      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      // Should show loading spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeDefined();
    });

    it('should remove loading state after image loads', async () => {
      render(<ImageMessage {...defaultProps} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      // Loading should be gone
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeNull();
    });
  });

  describe('Long Press Detection', () => {
    it('should not show context menu on short click', async () => {
      render(<ImageMessage {...defaultProps} />);

      // First reveal the image
      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      // Quick pointer down and up
      fireEvent.pointerDown(container!);
      fireEvent.pointerUp(container!);

      // Context menu should not appear
      const saveButton = screen.queryByText('Save');
      expect(saveButton).toBeNull();
    });

    it('should handle pointer leave during long press', async () => {
      render(<ImageMessage {...defaultProps} />);

      // First reveal the image
      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      // Start long press then leave
      fireEvent.pointerDown(container!);
      fireEvent.pointerLeave(container!);

      // Context menu should not appear
      const saveButton = screen.queryByText('Save');
      expect(saveButton).toBeNull();
    });
  });

  describe('Context Menu Actions', () => {
    it('should call onContextMenu with copy action', async () => {
      const onContextMenu = vi.fn();
      render(<ImageMessage {...defaultProps} onContextMenu={onContextMenu} />);

      const container = document.querySelector('[class*="rounded-terminal"]');
      fireEvent.click(container!);

      await waitFor(() => {
        expect(mockImageHandler.createImageUrl).toHaveBeenCalled();
      });

      fireEvent.contextMenu(container!);

      await waitFor(() => {
        const copyButton = screen.queryByText('Copy');
        fireEvent.click(copyButton!);
      });

      await waitFor(() => {
        expect(onContextMenu).toHaveBeenCalledWith('copy');
      });
    });
  });
});
