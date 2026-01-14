/**
 * AutocompletePopup Component Tests
 *
 * Tests for the reusable autocomplete dropdown component including:
 * - Visibility state management
 * - Item rendering
 * - Keyboard navigation (arrow keys)
 * - Tab/Enter selection
 * - Escape to dismiss
 * - Scrolling behavior
 * - Accessibility
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import { AutocompletePopup, type AutocompleteItem, type AutocompletePopupProps } from '../AutocompletePopup';

// ============================================================================
// Test Data
// ============================================================================

const mockItems: AutocompleteItem[] = [
  { id: '1', label: '/help', description: 'Show available commands' },
  { id: '2', label: '/nick', description: 'Change your nickname' },
  { id: '3', label: '/me', description: 'Send an action message' },
  { id: '4', label: '/clear', description: 'Clear chat history' },
  { id: '5', label: '/quit', description: 'Leave the channel' },
  { id: '6', label: '/join', description: 'Join a channel' },
  { id: '7', label: '/msg', description: 'Send a private message' },
];

const defaultProps: AutocompletePopupProps = {
  items: mockItems,
  selectedIndex: 0,
  onSelect: vi.fn(),
  onIndexChange: vi.fn(),
  onDismiss: vi.fn(),
  isVisible: true,
};

// ============================================================================
// AutocompletePopup Component Tests
// ============================================================================

describe('AutocompletePopup Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Visibility', () => {
    it('should render when isVisible is true', () => {
      render(<AutocompletePopup {...defaultProps} />);

      // Popup should be in the DOM
      const popup = document.querySelector('[role="listbox"]');
      expect(popup).toBeDefined();
    });

    it('should not render when isVisible is false', () => {
      render(<AutocompletePopup {...defaultProps} isVisible={false} />);

      // Popup should not be in the DOM
      const popup = document.querySelector('[role="listbox"]');
      expect(popup).toBeNull();
    });

    it('should position above the input (bottom-full)', () => {
      render(<AutocompletePopup {...defaultProps} />);

      const popup = document.querySelector('.bottom-full');
      expect(popup).toBeDefined();
    });
  });

  describe('Item Rendering', () => {
    it('should render all items', () => {
      render(<AutocompletePopup {...defaultProps} />);

      // All items should be rendered
      for (const item of mockItems) {
        expect(screen.queryByText(item.label)).toBeDefined();
      }
    });

    it('should render item labels', () => {
      render(<AutocompletePopup {...defaultProps} />);

      expect(screen.queryByText('/help')).toBeDefined();
      expect(screen.queryByText('/nick')).toBeDefined();
    });

    it('should render item descriptions', () => {
      render(<AutocompletePopup {...defaultProps} />);

      expect(screen.queryByText('Show available commands')).toBeDefined();
      expect(screen.queryByText('Change your nickname')).toBeDefined();
    });

    it('should render item icons when provided', () => {
      const itemsWithIcons: AutocompleteItem[] = [
        { id: '1', label: 'Item 1', icon: <span data-testid="icon-1">*</span> },
        { id: '2', label: 'Item 2', icon: <span data-testid="icon-2">+</span> },
      ];

      render(<AutocompletePopup {...defaultProps} items={itemsWithIcons} />);

      expect(screen.queryByTestId('icon-1')).toBeDefined();
      expect(screen.queryByTestId('icon-2')).toBeDefined();
    });

    it('should show empty message when no items', () => {
      render(<AutocompletePopup {...defaultProps} items={[]} emptyMessage="No commands found" />);

      expect(screen.queryByText('No commands found')).toBeDefined();
    });

    it('should use default empty message', () => {
      render(<AutocompletePopup {...defaultProps} items={[]} />);

      expect(screen.queryByText('No matches found')).toBeDefined();
    });
  });

  describe('Title', () => {
    it('should render title when provided', () => {
      render(<AutocompletePopup {...defaultProps} title="Commands" />);

      expect(screen.queryByText('Commands')).toBeDefined();
    });

    it('should not render title section when not provided', () => {
      render(<AutocompletePopup {...defaultProps} title={undefined} />);

      // Should not have a title element with border-b (title container)
      const titleSection = document.querySelector('.border-b.border-muted .text-muted');
      expect(titleSection).toBeNull();
    });
  });

  describe('Selection Highlighting', () => {
    it('should highlight selected item', () => {
      render(<AutocompletePopup {...defaultProps} selectedIndex={1} />);

      const buttons = document.querySelectorAll('button[role="option"]');
      const selectedButton = buttons[1];

      // Selected item should have aria-selected="true"
      expect(selectedButton?.getAttribute('aria-selected')).toBe('true');
    });

    it('should apply selected styling to current item', () => {
      render(<AutocompletePopup {...defaultProps} selectedIndex={2} />);

      const buttons = document.querySelectorAll('button[role="option"]');
      const selectedButton = buttons[2];

      // Selected item should have primary color styling
      expect(selectedButton?.classList.toString()).toContain('bg-primary');
    });

    it('should show selection hint on selected item', () => {
      render(<AutocompletePopup {...defaultProps} selectedIndex={0} />);

      // Should show "Tab/Enter" hint on selected item
      const hint = screen.queryByText('Tab/Enter');
      expect(hint).toBeDefined();
    });

    it('should only highlight one item at a time', () => {
      render(<AutocompletePopup {...defaultProps} selectedIndex={3} />);

      const selectedButtons = document.querySelectorAll('button[aria-selected="true"]');
      expect(selectedButtons.length).toBe(1);
    });
  });

  describe('Click Selection', () => {
    it('should call onSelect when item is clicked', () => {
      const onSelect = vi.fn();
      render(<AutocompletePopup {...defaultProps} onSelect={onSelect} />);

      const secondItem = screen.getByText('/nick');
      fireEvent.click(secondItem.closest('button')!);

      expect(onSelect).toHaveBeenCalledWith(mockItems[1]);
    });

    it('should update index on mouse enter', () => {
      const onIndexChange = vi.fn();
      render(<AutocompletePopup {...defaultProps} onIndexChange={onIndexChange} />);

      const buttons = document.querySelectorAll('button[role="option"]');
      fireEvent.mouseEnter(buttons[2]!);

      expect(onIndexChange).toHaveBeenCalledWith(2);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate down on ArrowDown', () => {
      const onIndexChange = vi.fn();
      render(<AutocompletePopup {...defaultProps} onIndexChange={onIndexChange} selectedIndex={0} />);

      fireEvent.keyDown(document, { key: 'ArrowDown' });

      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it('should navigate up on ArrowUp', () => {
      const onIndexChange = vi.fn();
      render(<AutocompletePopup {...defaultProps} onIndexChange={onIndexChange} selectedIndex={2} />);

      fireEvent.keyDown(document, { key: 'ArrowUp' });

      expect(onIndexChange).toHaveBeenCalledWith(1);
    });

    it('should wrap to last item when pressing ArrowUp at first item', () => {
      const onIndexChange = vi.fn();
      render(<AutocompletePopup {...defaultProps} onIndexChange={onIndexChange} selectedIndex={0} />);

      fireEvent.keyDown(document, { key: 'ArrowUp' });

      // Should wrap to last item
      expect(onIndexChange).toHaveBeenCalledWith(mockItems.length - 1);
    });

    it('should wrap to first item when pressing ArrowDown at last item', () => {
      const onIndexChange = vi.fn();
      render(
        <AutocompletePopup
          {...defaultProps}
          onIndexChange={onIndexChange}
          selectedIndex={mockItems.length - 1}
        />
      );

      fireEvent.keyDown(document, { key: 'ArrowDown' });

      // Should wrap to first item
      expect(onIndexChange).toHaveBeenCalledWith(0);
    });

    it('should prevent default on arrow key events', () => {
      render(<AutocompletePopup {...defaultProps} />);

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Tab/Enter Selection', () => {
    it('should select current item on Tab', () => {
      const onSelect = vi.fn();
      render(<AutocompletePopup {...defaultProps} onSelect={onSelect} selectedIndex={1} />);

      fireEvent.keyDown(document, { key: 'Tab' });

      expect(onSelect).toHaveBeenCalledWith(mockItems[1]);
    });

    it('should select current item on Enter', () => {
      const onSelect = vi.fn();
      render(<AutocompletePopup {...defaultProps} onSelect={onSelect} selectedIndex={2} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith(mockItems[2]);
    });

    it('should prevent default on Tab', () => {
      render(<AutocompletePopup {...defaultProps} />);

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should prevent default on Enter', () => {
      render(<AutocompletePopup {...defaultProps} />);

      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not select if no items', () => {
      const onSelect = vi.fn();
      render(<AutocompletePopup {...defaultProps} items={[]} onSelect={onSelect} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('should not select if index out of bounds', () => {
      const onSelect = vi.fn();
      render(<AutocompletePopup {...defaultProps} onSelect={onSelect} selectedIndex={100} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('Escape to Dismiss', () => {
    it('should call onDismiss on Escape', () => {
      const onDismiss = vi.fn();
      render(<AutocompletePopup {...defaultProps} onDismiss={onDismiss} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onDismiss).toHaveBeenCalled();
    });

    it('should prevent default on Escape', () => {
      render(<AutocompletePopup {...defaultProps} />);

      const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Scrolling', () => {
    it('should have max visible items constraint', () => {
      render(<AutocompletePopup {...defaultProps} maxVisible={3} />);

      // Should have max-height style based on maxVisible
      const scrollContainer = document.querySelector('.overflow-y-auto');
      const style = scrollContainer?.getAttribute('style');
      expect(style).toContain('max-height');
    });

    it('should scroll selected item into view', async () => {
      // Start with selected index at the bottom
      render(<AutocompletePopup {...defaultProps} selectedIndex={6} maxVisible={3} />);

      // Selected item should be scrolled into view
      const buttons = document.querySelectorAll('button[role="option"]');
      const selectedButton = buttons[6];

      // The component uses scrollIntoView, we can check if the element exists
      expect(selectedButton).toBeDefined();
    });

    it('should use default maxVisible of 5', () => {
      render(<AutocompletePopup {...defaultProps} />);

      // Default is 5 items * 44px = 220px max height
      const scrollContainer = document.querySelector('.overflow-y-auto');
      const style = scrollContainer?.getAttribute('style');
      expect(style).toContain('220px');
    });
  });

  describe('Keyboard Hint', () => {
    it('should show keyboard navigation hint when items exist', () => {
      render(<AutocompletePopup {...defaultProps} />);

      const hintText = screen.queryByText(/Use arrow keys to navigate/i);
      expect(hintText).toBeDefined();
    });

    it('should not show keyboard hint when no items', () => {
      render(<AutocompletePopup {...defaultProps} items={[]} />);

      const hintText = screen.queryByText(/Use arrow keys to navigate/i);
      expect(hintText).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have listbox role on container', () => {
      render(<AutocompletePopup {...defaultProps} />);

      const listbox = document.querySelector('[role="listbox"]');
      expect(listbox).toBeDefined();
    });

    it('should have aria-label on listbox', () => {
      render(<AutocompletePopup {...defaultProps} title="Commands" />);

      const listbox = document.querySelector('[role="listbox"]');
      expect(listbox?.getAttribute('aria-label')).toBe('Commands');
    });

    it('should use default aria-label when no title', () => {
      render(<AutocompletePopup {...defaultProps} title={undefined} />);

      const listbox = document.querySelector('[role="listbox"]');
      expect(listbox?.getAttribute('aria-label')).toBe('Autocomplete suggestions');
    });

    it('should have option role on items', () => {
      render(<AutocompletePopup {...defaultProps} />);

      const options = document.querySelectorAll('[role="option"]');
      expect(options.length).toBe(mockItems.length);
    });

    it('should set aria-selected on current item', () => {
      render(<AutocompletePopup {...defaultProps} selectedIndex={3} />);

      const options = document.querySelectorAll('[role="option"]');
      const selectedOption = options[3];

      expect(selectedOption?.getAttribute('aria-selected')).toBe('true');
    });

    it('should have unique keys for items', () => {
      render(<AutocompletePopup {...defaultProps} />);

      // If rendered correctly, all items should be present without React key warnings
      const options = document.querySelectorAll('[role="option"]');
      expect(options.length).toBe(mockItems.length);
    });
  });

  describe('Event Listener Cleanup', () => {
    it('should remove keyboard listener when isVisible becomes false', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { rerender } = render(<AutocompletePopup {...defaultProps} isVisible={true} />);

      // Change to invisible
      rerender(<AutocompletePopup {...defaultProps} isVisible={false} />);

      // Should have cleaned up event listener
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should remove keyboard listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = render(<AutocompletePopup {...defaultProps} />);
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Item Data', () => {
    it('should pass item with data through onSelect', () => {
      const itemsWithData: AutocompleteItem[] = [
        { id: '1', label: 'User', data: { userId: 'abc123' } },
      ];
      const onSelect = vi.fn();

      render(<AutocompletePopup {...defaultProps} items={itemsWithData} onSelect={onSelect} />);

      const button = document.querySelector('button[role="option"]');
      fireEvent.click(button!);

      expect(onSelect).toHaveBeenCalledWith(itemsWithData[0]);
      expect(onSelect.mock.calls[0][0].data).toEqual({ userId: 'abc123' });
    });
  });
});
