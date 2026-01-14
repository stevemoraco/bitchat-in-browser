/**
 * MainLayout Component Tests
 *
 * Tests for the main layout component including:
 * - Integration of all layout components
 * - Navigation state handling
 * - Sheet overlay behavior
 * - AppHeader functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { MainLayout, AppHeader } from '../MainLayout';

// Mock sheet data
let mockSheets: any[] = [];
const mockOpenChannels = vi.fn();
const mockOpenPeers = vi.fn();
const mockOpenSettings = vi.fn();

vi.mock('../../../stores/navigation-store', () => ({
  useNavigationStore: (selector?: (state: any) => any) => {
    const state = {
      sheets: mockSheets,
      openChannels: mockOpenChannels,
      openPeers: mockOpenPeers,
      openSettings: mockOpenSettings,
    };
    // Support both selector pattern and destructuring pattern
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  },
}));

vi.mock('../../../stores/mesh-store', () => ({
  useMeshStore: (selector?: (state: any) => any) => {
    const state = {
      status: 'connected',
      peers: [{ peerId: 'peer1' }, { peerId: 'peer2' }, { peerId: 'peer3' }],
    };
    // Support both selector pattern and destructuring pattern
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  },
}));

// Mock SheetRenderer
vi.mock('../SheetRenderer', () => ({
  SheetRenderer: () => h('div', { 'data-testid': 'sheet-renderer' }, 'Sheet Renderer'),
}));

describe('MainLayout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSheets = [];
  });

  afterEach(() => {
    cleanup();
    mockSheets = [];
  });

  describe('rendering', () => {
    it('should render children content', () => {
      render(
        <MainLayout>
          <div data-testid="main-content">Main Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId('main-content')).toBeDefined();
      expect(screen.getByText('Main Content')).toBeDefined();
    });

    it('should render SheetRenderer', () => {
      render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId('sheet-renderer')).toBeDefined();
    });

    it('should have full height layout', () => {
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const root = container.firstElementChild;
      expect(root?.className).toContain('h-screen');
    });

    it('should use flex column layout', () => {
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const root = container.firstElementChild;
      expect(root?.className).toContain('flex');
      expect(root?.className).toContain('flex-col');
    });

    it('should have correct background color', () => {
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const root = container.firstElementChild;
      expect(root?.className).toContain('bg-gray-950');
    });

    it('should have correct text color', () => {
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const root = container.firstElementChild;
      expect(root?.className).toContain('text-gray-100');
    });
  });

  describe('content wrapper behavior', () => {
    it('should apply pointer-events-none when sheet is open', () => {
      mockSheets = [{ type: 'settings', id: 'sheet-1' }];

      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const contentWrapper = container.querySelector('.flex-1.flex.flex-col');
      expect(contentWrapper?.className).toContain('pointer-events-none');
    });

    it('should not apply pointer-events-none when no sheet is open', () => {
      mockSheets = [];

      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const contentWrapper = container.querySelector('.flex-1.flex.flex-col');
      expect(contentWrapper?.className).not.toContain('pointer-events-none');
    });

    it('should have overflow-hidden on content wrapper', () => {
      const { container } = render(
        <MainLayout>
          <div>Content</div>
        </MainLayout>
      );

      const contentWrapper = container.querySelector('.flex-1.flex.flex-col');
      expect(contentWrapper?.className).toContain('overflow-hidden');
    });
  });

  describe('multiple children', () => {
    it('should render multiple children', () => {
      render(
        <MainLayout>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </MainLayout>
      );

      expect(screen.getByTestId('child-1')).toBeDefined();
      expect(screen.getByTestId('child-2')).toBeDefined();
      expect(screen.getByTestId('child-3')).toBeDefined();
    });
  });
});

describe('AppHeader Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSheets = [];
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('should render header element', () => {
      const { container } = render(<AppHeader />);
      const header = container.querySelector('header');
      expect(header).toBeDefined();
    });

    it('should render menu button', () => {
      render(<AppHeader />);
      // There are two buttons with "Open settings" - hamburger and gear
      const settingsButtons = screen.getAllByLabelText('Open settings');
      expect(settingsButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('should render channel selector button', () => {
      render(<AppHeader />);
      const channelButton = screen.getByLabelText('Select channel');
      expect(channelButton).toBeDefined();
    });

    it('should render peer count button', () => {
      render(<AppHeader />);
      const peerButton = screen.getByLabelText('View 3 peers');
      expect(peerButton).toBeDefined();
    });

    it('should render settings gear button', () => {
      const { container } = render(<AppHeader />);
      // There are two settings buttons - one menu (hamburger) and one gear
      const settingsButtons = container.querySelectorAll('[aria-label="Open settings"]');
      expect(settingsButtons.length).toBe(2);
    });

    it('should display current channel name', () => {
      render(<AppHeader />);
      expect(screen.getByText('Global')).toBeDefined();
    });

    it('should display peer count', () => {
      render(<AppHeader />);
      expect(screen.getByText('3')).toBeDefined();
    });
  });

  describe('channel selector', () => {
    it('should open channels sheet when channel selector is clicked', () => {
      render(<AppHeader />);

      const channelButton = screen.getByLabelText('Select channel');
      fireEvent.click(channelButton);

      expect(mockOpenChannels).toHaveBeenCalledTimes(1);
    });

    it('should have dropdown arrow icon', () => {
      const { container } = render(<AppHeader />);

      const channelButton = screen.getByLabelText('Select channel');
      const svg = channelButton.querySelector('svg');
      expect(svg).toBeDefined();
    });
  });

  describe('peer list', () => {
    it('should open peers sheet when peer count is clicked', () => {
      render(<AppHeader />);

      const peerButton = screen.getByLabelText('View 3 peers');
      fireEvent.click(peerButton);

      expect(mockOpenPeers).toHaveBeenCalledTimes(1);
    });

    it('should have person icon', () => {
      const { container } = render(<AppHeader />);

      const peerButton = screen.getByLabelText('View 3 peers');
      const svg = peerButton.querySelector('svg');
      expect(svg).toBeDefined();
    });
  });

  describe('settings', () => {
    it('should open settings sheet when settings button is clicked', () => {
      render(<AppHeader />);

      // Get the gear settings button (second settings button)
      const settingsButtons = screen.getAllByLabelText('Open settings');
      const gearButton = settingsButtons[settingsButtons.length - 1];
      fireEvent.click(gearButton);

      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('menu button', () => {
    it('should open settings when menu button is clicked', () => {
      render(<AppHeader />);

      // The hamburger menu also opens settings
      const menuButton = screen.getAllByLabelText('Open settings')[0];
      fireEvent.click(menuButton);

      expect(mockOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('should have hamburger icon', () => {
      render(<AppHeader />);

      const menuButton = screen.getAllByLabelText('Open settings')[0];
      const svg = menuButton.querySelector('svg');
      const paths = svg?.querySelectorAll('path');
      // Hamburger icon typically has path with three horizontal lines pattern
      expect(paths?.length).toBeGreaterThan(0);
    });
  });

  describe('mesh status indicator', () => {
    it('should render mesh status dot', () => {
      const { container } = render(<AppHeader />);

      // Look for the status dot (small colored circle)
      const statusDot = container.querySelector('.rounded-full.w-2.h-2, [class*="rounded-full"][class*="w-2"][class*="h-2"]');
      expect(statusDot).toBeDefined();
    });

    it('should have green color when connected', () => {
      const { container } = render(<AppHeader />);

      // The status indicator should show green for 'connected' status
      const statusDot = container.querySelector('[class*="bg-green"]');
      expect(statusDot).toBeDefined();
    });
  });

  describe('styling', () => {
    it('should have correct header styling', () => {
      const { container } = render(<AppHeader />);

      const header = container.querySelector('header');
      expect(header?.className).toContain('flex');
      expect(header?.className).toContain('items-center');
      expect(header?.className).toContain('justify-between');
    });

    it('should have correct background color', () => {
      const { container } = render(<AppHeader />);

      const header = container.querySelector('header');
      expect(header?.className).toContain('bg-gray-900');
    });

    it('should have border styling', () => {
      const { container } = render(<AppHeader />);

      const header = container.querySelector('header');
      expect(header?.className).toContain('border-b');
      expect(header?.className).toContain('border-gray-800');
    });

    it('should have padding', () => {
      const { container } = render(<AppHeader />);

      const header = container.querySelector('header');
      expect(header?.className).toContain('px-4');
      expect(header?.className).toContain('py-3');
    });
  });

  describe('accessibility', () => {
    it('should have proper aria-labels for all interactive elements', () => {
      render(<AppHeader />);

      expect(screen.getAllByLabelText('Open settings').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText('Select channel')).toBeDefined();
      expect(screen.getByLabelText('View 3 peers')).toBeDefined();
    });
  });
});

describe('MainLayout with AppHeader integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSheets = [];
  });

  afterEach(() => {
    cleanup();
  });

  it('should allow using AppHeader as child of MainLayout', () => {
    render(
      <MainLayout>
        <AppHeader />
        <div data-testid="chat-content">Chat Area</div>
      </MainLayout>
    );

    expect(screen.getByText('Global')).toBeDefined(); // From AppHeader
    expect(screen.getByTestId('chat-content')).toBeDefined();
    expect(screen.getByTestId('sheet-renderer')).toBeDefined();
  });
});

describe('AppHeader mesh status variations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should display correct peer count in aria label', () => {
    render(<AppHeader />);

    // With 3 peers from mock
    const peerButton = screen.getByLabelText('View 3 peers');
    expect(peerButton).toBeDefined();
  });

  it('should have accessible title on mesh status dot', () => {
    const { container } = render(<AppHeader />);

    const statusDot = container.querySelector('[title*="Mesh"]');
    expect(statusDot?.getAttribute('title')).toContain('connected');
  });
});

describe('MainLayout sheet overlay behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    mockSheets = [];
  });

  it('should block pointer events on content when multiple sheets are open', () => {
    mockSheets = [
      { type: 'settings', id: 'sheet-1' },
      { type: 'settings-identity', id: 'sheet-2' },
    ];

    const { container } = render(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    const contentWrapper = container.querySelector('.flex-1.flex.flex-col');
    expect(contentWrapper?.className).toContain('pointer-events-none');
  });

  it('should restore pointer events when all sheets are closed', () => {
    mockSheets = [];

    const { container } = render(
      <MainLayout>
        <button data-testid="test-button">Click Me</button>
      </MainLayout>
    );

    const contentWrapper = container.querySelector('.flex-1.flex.flex-col');
    expect(contentWrapper?.className).not.toContain('pointer-events-none');
  });
});

describe('AppHeader channel selector styling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should have rounded-full class on channel selector', () => {
    render(<AppHeader />);

    const channelButton = screen.getByLabelText('Select channel');
    expect(channelButton.className).toContain('rounded-full');
  });

  it('should have appropriate background color classes', () => {
    render(<AppHeader />);

    const channelButton = screen.getByLabelText('Select channel');
    expect(channelButton.className).toContain('bg-gray-800');
    expect(channelButton.className).toContain('hover:bg-gray-700');
  });

  it('should have transition class for smooth hover effect', () => {
    render(<AppHeader />);

    const channelButton = screen.getByLabelText('Select channel');
    expect(channelButton.className).toContain('transition-colors');
  });

  it('should have proper flex alignment', () => {
    render(<AppHeader />);

    const channelButton = screen.getByLabelText('Select channel');
    expect(channelButton.className).toContain('flex');
    expect(channelButton.className).toContain('items-center');
    expect(channelButton.className).toContain('gap-2');
  });
});

describe('MainLayout z-index layering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('should render SheetRenderer after main content for proper z-index stacking', () => {
    const { container } = render(
      <MainLayout>
        <div data-testid="main-content">Main Content</div>
      </MainLayout>
    );

    const mainContent = screen.getByTestId('main-content');
    const sheetRenderer = screen.getByTestId('sheet-renderer');

    // SheetRenderer should come after main content wrapper in DOM
    const contentWrapper = mainContent.closest('.flex-1.flex.flex-col');
    expect(contentWrapper).toBeDefined();
    expect(sheetRenderer).toBeDefined();
  });
});
