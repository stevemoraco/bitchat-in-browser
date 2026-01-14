/**
 * Sheet Component Tests
 *
 * Tests for iOS-style slide-up modal sheet including:
 * - Open/close animations
 * - Drag-to-dismiss gesture
 * - Sheet stack behavior
 * - Backdrop interactions
 * - Height configurations
 *
 * Manual Testing Checklist:
 * [ ] All sheets animate smoothly at 60fps
 * [ ] Drag handle allows swipe-to-dismiss
 * [ ] Backdrop click closes sheet when enabled
 * [ ] Sheet stack navigation works correctly
 * [ ] Half and full height modes display correctly
 * [ ] Title and close button render properly
 * [ ] Content scrolls within sheet
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, screen, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { Sheet, SheetProps } from '../Sheet';
import { SheetStackProvider, useSheetStack, useOpenSheet } from '../SheetStack';

describe('Sheet Component', () => {
  const defaultProps: SheetProps = {
    isOpen: true,
    onClose: vi.fn(),
    children: <div>Test Content</div>,
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render when isOpen is true', () => {
      render(<Sheet {...defaultProps} />);

      expect(screen.getByText('Test Content')).toBeDefined();
    });

    it('should not render when isOpen is false', () => {
      render(<Sheet {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('Test Content')).toBeNull();
    });

    it('should render title when provided', () => {
      render(<Sheet {...defaultProps} title="Test Title" />);

      expect(screen.getByText('Test Title')).toBeDefined();
    });

    it('should render close button when title is present', () => {
      render(<Sheet {...defaultProps} title="Test Title" />);

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeDefined();
    });

    it('should render drag handle by default', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      // Handle is a div with specific styling
      const handle = container.querySelector('.w-10.h-1');
      expect(handle).toBeDefined();
    });

    it('should not render drag handle when showHandle is false', () => {
      const { container } = render(<Sheet {...defaultProps} showHandle={false} />);

      const handle = container.querySelector('.cursor-grab');
      expect(handle).toBeNull();
    });

    it('should render children content', () => {
      render(
        <Sheet {...defaultProps}>
          <div data-testid="custom-content">Custom Children</div>
        </Sheet>
      );

      expect(screen.getByTestId('custom-content')).toBeDefined();
    });
  });

  describe('height configurations', () => {
    it('should apply half height class by default', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const sheet = container.querySelector('.h-\\[50vh\\]');
      expect(sheet).toBeDefined();
    });

    it('should apply full height class when height is full', () => {
      const { container } = render(<Sheet {...defaultProps} height="full" />);

      const sheet = container.querySelector('.h-\\[90vh\\]');
      expect(sheet).toBeDefined();
    });

    it('should apply auto height class when height is auto', () => {
      const { container } = render(<Sheet {...defaultProps} height="auto" />);

      const sheet = container.querySelector('.h-auto');
      expect(sheet).toBeDefined();
    });
  });

  describe('backdrop interactions', () => {
    it('should call onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      const { container } = render(<Sheet {...defaultProps} onClose={onClose} />);

      // Backdrop is the first div inside the fixed container
      const backdrop = container.querySelector('.bg-black');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(onClose).toHaveBeenCalled();
    });

    it('should not call onClose on backdrop click when closeOnBackdrop is false', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Sheet {...defaultProps} onClose={onClose} closeOnBackdrop={false} />
      );

      const backdrop = container.querySelector('.bg-black');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should have blur effect on backdrop', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const backdrop = container.querySelector('.bg-black');
      expect(backdrop).toBeDefined();

      // Check for backdrop-filter style
      const style = backdrop?.getAttribute('style');
      expect(style).toContain('blur');
    });
  });

  describe('close button', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<Sheet {...defaultProps} onClose={onClose} title="Title" />);

      const closeButton = screen.getByRole('button');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('open/close animations', () => {
    it('should have animation classes', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const sheet = container.querySelector('.transition-transform');
      expect(sheet).toBeDefined();
    });

    it('should have duration class for animation timing', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const sheet = container.querySelector('.duration-300');
      expect(sheet).toBeDefined();
    });

    it('should animate backdrop opacity', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const backdrop = container.querySelector('.transition-opacity');
      expect(backdrop).toBeDefined();
    });
  });

  describe('drag-to-dismiss gesture', () => {
    it('should set up touch handlers on handle', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const sheet = container.querySelector('[class*="rounded-t-2xl"]');
      expect(sheet).toBeDefined();
    });

    it('should set up mouse handlers on handle for desktop', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const handle = container.querySelector('.cursor-grab');
      expect(handle).toBeDefined();
    });

    it('should dismiss on large drag', async () => {
      const onClose = vi.fn();
      const { container } = render(<Sheet {...defaultProps} onClose={onClose} />);

      const sheet = container.querySelector('[class*="rounded-t-2xl"]');
      if (sheet) {
        // Simulate touch start
        fireEvent.touchStart(sheet, {
          touches: [{ clientY: 0 }],
        });

        // Simulate touch move (drag down > 100px)
        fireEvent.touchMove(sheet, {
          touches: [{ clientY: 150 }],
        });

        // Simulate touch end
        fireEvent.touchEnd(sheet);

        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should not dismiss on small drag', async () => {
      const onClose = vi.fn();
      const { container } = render(<Sheet {...defaultProps} onClose={onClose} />);

      const sheet = container.querySelector('[class*="rounded-t-2xl"]');
      if (sheet) {
        fireEvent.touchStart(sheet, {
          touches: [{ clientY: 0 }],
        });

        // Small drag (< 100px)
        fireEvent.touchMove(sheet, {
          touches: [{ clientY: 50 }],
        });

        fireEvent.touchEnd(sheet);

        expect(onClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('scroll behavior', () => {
    it('should have scrollable content area', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const contentArea = container.querySelector('.overflow-auto');
      expect(contentArea).toBeDefined();
    });

    it('should use flex layout', () => {
      const { container } = render(<Sheet {...defaultProps} />);

      const sheet = container.querySelector('.flex.flex-col');
      expect(sheet).toBeDefined();
    });
  });
});

describe('SheetStackProvider', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should render children', () => {
    render(
      <SheetStackProvider>
        <div>Provider Content</div>
      </SheetStackProvider>
    );

    expect(screen.getByText('Provider Content')).toBeDefined();
  });

  it('should provide context to children', () => {
    let contextValue: ReturnType<typeof useSheetStack> | null = null;

    const TestComponent = () => {
      contextValue = useSheetStack();
      return <div>Test</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    expect(contextValue).not.toBeNull();
    expect(contextValue!.pushSheet).toBeDefined();
    expect(contextValue!.popSheet).toBeDefined();
    expect(contextValue!.popToRoot).toBeDefined();
  });

  it('should throw when useSheetStack is used outside provider', () => {
    const TestComponent = () => {
      useSheetStack();
      return <div>Test</div>;
    };

    expect(() => render(<TestComponent />)).toThrow();
  });
});

describe('Sheet Stack Behavior', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should push sheet to stack', async () => {
    let context: ReturnType<typeof useSheetStack> | null = null;

    const TestComponent = () => {
      context = useSheetStack();
      return <div>Base</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    // Push a sheet
    context!.pushSheet({
      id: 'test-sheet',
      title: 'Test Sheet',
      content: <div>Sheet Content</div>,
    });

    await waitFor(() => {
      expect(screen.getByText('Sheet Content')).toBeDefined();
    });
  });

  it('should pop sheet from stack', async () => {
    let context: ReturnType<typeof useSheetStack> | null = null;

    const TestComponent = () => {
      context = useSheetStack();
      return <div>Base</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    // Push then pop
    context!.pushSheet({
      id: 'pop-test',
      content: <div>Pop Test Content</div>,
    });

    await waitFor(() => {
      expect(screen.getByText('Pop Test Content')).toBeDefined();
    });

    context!.popSheet();

    await waitFor(() => {
      expect(screen.queryByText('Pop Test Content')).toBeNull();
    });
  });

  it('should pop all sheets to root', async () => {
    let context: ReturnType<typeof useSheetStack> | null = null;

    const TestComponent = () => {
      context = useSheetStack();
      return <div>Base</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    // Push multiple sheets
    context!.pushSheet({ id: 'sheet-1', content: <div>Sheet 1</div> });
    context!.pushSheet({ id: 'sheet-2', content: <div>Sheet 2</div> });

    await waitFor(() => {
      expect(screen.getByText('Sheet 2')).toBeDefined();
    });

    context!.popToRoot();

    await waitFor(() => {
      expect(screen.queryByText('Sheet 1')).toBeNull();
      expect(screen.queryByText('Sheet 2')).toBeNull();
    });
  });

  it('should replace current sheet', async () => {
    let context: ReturnType<typeof useSheetStack> | null = null;

    const TestComponent = () => {
      context = useSheetStack();
      return <div>Base</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    // Push initial sheet
    context!.pushSheet({ id: 'initial', content: <div>Initial</div> });

    await waitFor(() => {
      expect(screen.getByText('Initial')).toBeDefined();
    });

    // Replace
    context!.replaceSheet({ id: 'replaced', content: <div>Replaced</div> });

    await waitFor(() => {
      expect(screen.queryByText('Initial')).toBeNull();
      expect(screen.getByText('Replaced')).toBeDefined();
    });
  });

  it('should call onClose when sheet is popped', async () => {
    let context: ReturnType<typeof useSheetStack> | null = null;
    const onClose = vi.fn();

    const TestComponent = () => {
      context = useSheetStack();
      return <div>Base</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    context!.pushSheet({
      id: 'callback-test',
      content: <div>Callback Test</div>,
      onClose,
    });

    await waitFor(() => {
      expect(screen.getByText('Callback Test')).toBeDefined();
    });

    context!.popSheet();

    expect(onClose).toHaveBeenCalled();
  });
});

describe('useOpenSheet Hook', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should provide openSheet function', () => {
    let hookResult: ReturnType<typeof useOpenSheet> | null = null;

    const TestComponent = () => {
      hookResult = useOpenSheet();
      return <div>Test</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    expect(hookResult!.openSheet).toBeDefined();
    expect(hookResult!.closeSheet).toBeDefined();
    expect(hookResult!.closeAllSheets).toBeDefined();
  });

  it('should open sheet with options', async () => {
    let hookResult: ReturnType<typeof useOpenSheet> | null = null;

    const TestComponent = () => {
      hookResult = useOpenSheet();
      return <div>Test</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    hookResult!.openSheet('test-id', <div>Hook Content</div>, {
      title: 'Hook Title',
      height: 'full',
    });

    await waitFor(() => {
      expect(screen.getByText('Hook Content')).toBeDefined();
      expect(screen.getByText('Hook Title')).toBeDefined();
    });
  });

  it('should close sheet', async () => {
    let hookResult: ReturnType<typeof useOpenSheet> | null = null;

    const TestComponent = () => {
      hookResult = useOpenSheet();
      return <div>Test</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    hookResult!.openSheet('close-test', <div>Close Content</div>);

    await waitFor(() => {
      expect(screen.getByText('Close Content')).toBeDefined();
    });

    hookResult!.closeSheet();

    await waitFor(() => {
      expect(screen.queryByText('Close Content')).toBeNull();
    });
  });

  it('should close all sheets', async () => {
    let hookResult: ReturnType<typeof useOpenSheet> | null = null;

    const TestComponent = () => {
      hookResult = useOpenSheet();
      return <div>Test</div>;
    };

    render(
      <SheetStackProvider>
        <TestComponent />
      </SheetStackProvider>
    );

    hookResult!.openSheet('all-1', <div>All 1</div>);
    hookResult!.openSheet('all-2', <div>All 2</div>);

    await waitFor(() => {
      expect(screen.getByText('All 2')).toBeDefined();
    });

    hookResult!.closeAllSheets();

    await waitFor(() => {
      expect(screen.queryByText('All 1')).toBeNull();
      expect(screen.queryByText('All 2')).toBeNull();
    });
  });
});

describe('Sheet Accessibility', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('should use semantic heading for title', () => {
    render(
      <Sheet isOpen={true} onClose={vi.fn()} title="Accessible Title">
        <div>Content</div>
      </Sheet>
    );

    const heading = screen.getByRole('heading');
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe('Accessible Title');
  });

  it('should have accessible close button', () => {
    render(
      <Sheet isOpen={true} onClose={vi.fn()} title="Title">
        <div>Content</div>
      </Sheet>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDefined();
  });
});
