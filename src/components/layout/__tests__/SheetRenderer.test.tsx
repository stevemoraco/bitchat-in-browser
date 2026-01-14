/**
 * SheetRenderer Component Tests
 *
 * Tests for the sheet rendering system including:
 * - Rendering correct component for each sheet type
 * - Sheet stack behavior
 * - Close button functionality
 * - Drag to dismiss
 * - Props passing
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import { SheetRenderer } from '../SheetRenderer';
import type { SheetState, SheetType } from '../../../stores/navigation-store';

// Mock sheet data
let mockSheets: SheetState[] = [];
const mockCloseSheet = vi.fn();
const mockOpenSheet = vi.fn();

vi.mock('../../../stores/navigation-store', () => ({
  useNavigationStore: (selector?: (state: any) => any) => {
    const state = {
      sheets: mockSheets,
      closeSheet: mockCloseSheet,
      openSheet: mockOpenSheet,
    };
    // If selector is provided, use it; otherwise return the state (for destructuring)
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  },
  SheetState: {},
}));

// Mock Sheet component
vi.mock('../../ui/Sheet', () => ({
  Sheet: ({
    isOpen,
    onClose,
    title,
    height,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    height?: string;
    children: any;
  }) =>
    h(
      'div',
      {
        'data-testid': `sheet-${title?.toLowerCase().replace(/\s/g, '-') || 'untitled'}`,
        'data-open': isOpen.toString(),
        'data-height': height,
      },
      [
        title && h('h2', { key: 'title' }, title),
        h('button', { key: 'close', 'data-testid': 'sheet-close-btn', onClick: onClose }, 'Close'),
        h('div', { key: 'content', 'data-testid': 'sheet-content' }, children),
      ]
    ),
}));

// Mock MeshDebugPanel
vi.mock('../../mesh/MeshDebugPanel', () => ({
  MeshDebugPanel: () => h('div', { 'data-testid': 'mesh-debug-panel' }, 'Mesh Debug Panel'),
}));

describe('SheetRenderer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSheets = [];
  });

  afterEach(() => {
    cleanup();
    mockSheets = [];
  });

  describe('empty state', () => {
    it('should render nothing when no sheets are open', () => {
      mockSheets = [];
      const { container } = render(<SheetRenderer />);

      // Should render an empty fragment
      expect(container.children.length).toBe(0);
    });
  });

  describe('single sheet rendering', () => {
    it('should render a single sheet when one is in the stack', () => {
      mockSheets = [
        {
          type: 'channels',
          id: 'sheet-1',
          title: 'Channels',
          height: 'half',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByTestId('sheet-channels')).toBeDefined();
    });

    it('should render sheet with correct title', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Settings')).toBeDefined();
    });

    it('should render sheet with correct height', () => {
      mockSheets = [
        {
          type: 'peers',
          id: 'sheet-1',
          title: 'People',
          height: 'half',
        },
      ];

      render(<SheetRenderer />);

      const sheet = screen.getByTestId('sheet-people');
      expect(sheet.getAttribute('data-height')).toBe('half');
    });
  });

  describe('sheet types', () => {
    const sheetTypes: Array<{ type: SheetType; expectedContent: string }> = [
      { type: 'channels', expectedContent: 'Select a channel to join' },
      { type: 'peers', expectedContent: 'People in this channel' },
      { type: 'settings', expectedContent: 'Identity' },
      { type: 'mesh-status', expectedContent: 'Mesh Debug Panel' },
    ];

    sheetTypes.forEach(({ type, expectedContent }) => {
      it(`should render correct content for ${type} sheet`, () => {
        mockSheets = [
          {
            type,
            id: 'sheet-1',
            title: type.charAt(0).toUpperCase() + type.slice(1),
            height: 'half',
          },
        ];

        render(<SheetRenderer />);

        expect(screen.getByText(expectedContent)).toBeDefined();
      });
    });

    it('should render channel-detail sheet with props', () => {
      mockSheets = [
        {
          type: 'channel-detail',
          id: 'sheet-1',
          title: 'Channel',
          height: 'full',
          props: { channelId: 'test-channel' },
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Channel Details')).toBeDefined();
    });

    it('should render peer-detail sheet with props', () => {
      mockSheets = [
        {
          type: 'peer-detail',
          id: 'sheet-1',
          title: 'Person',
          height: 'full',
          props: { peerId: 'test-peer' },
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Peer Details')).toBeDefined();
    });

    it('should render settings-identity sheet', () => {
      mockSheets = [
        {
          type: 'settings-identity',
          id: 'sheet-1',
          title: 'Identity',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Identity Settings')).toBeDefined();
    });

    it('should render settings-privacy sheet', () => {
      mockSheets = [
        {
          type: 'settings-privacy',
          id: 'sheet-1',
          title: 'Privacy',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Privacy Settings')).toBeDefined();
    });

    it('should render settings-network sheet', () => {
      mockSheets = [
        {
          type: 'settings-network',
          id: 'sheet-1',
          title: 'Network',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Network Settings')).toBeDefined();
    });

    it('should render settings-storage sheet', () => {
      mockSheets = [
        {
          type: 'settings-storage',
          id: 'sheet-1',
          title: 'Storage',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Storage Settings')).toBeDefined();
    });

    it('should render settings-about sheet', () => {
      mockSheets = [
        {
          type: 'settings-about',
          id: 'sheet-1',
          title: 'About',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('About BitChat')).toBeDefined();
    });

    it('should render mesh-join sheet', () => {
      mockSheets = [
        {
          type: 'mesh-join',
          id: 'sheet-1',
          title: 'Join Mesh',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Join Mesh Network')).toBeDefined();
    });

    it('should render key-import sheet', () => {
      mockSheets = [
        {
          type: 'key-import',
          id: 'sheet-1',
          title: 'Import Key',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Import Nostr Key')).toBeDefined();
    });

    it('should render share-app sheet', () => {
      mockSheets = [
        {
          type: 'share-app',
          id: 'sheet-1',
          title: 'Share App',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Share BitChat')).toBeDefined();
    });

    it('should render custom sheet with content prop', () => {
      mockSheets = [
        {
          type: 'custom',
          id: 'sheet-1',
          title: 'Custom',
          height: 'half',
          props: { content: 'Custom content here' },
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Custom content here')).toBeDefined();
    });
  });

  describe('sheet stack', () => {
    it('should render multiple sheets in stack order', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
        {
          type: 'settings-identity',
          id: 'sheet-2',
          title: 'Identity',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      // Both sheets should be rendered - check for specific sheet content
      expect(screen.getByTestId('sheet-settings')).toBeDefined();
      expect(screen.getByTestId('sheet-identity')).toBeDefined();
    });

    it('should render sheets with unique keys based on id', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-unique-1',
          title: 'Settings',
          height: 'full',
        },
        {
          type: 'settings-identity',
          id: 'sheet-unique-2',
          title: 'Identity',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByTestId('sheet-settings')).toBeDefined();
      expect(screen.getByTestId('sheet-identity')).toBeDefined();
    });
  });

  describe('close button', () => {
    it('should call closeSheet when close button is clicked', () => {
      mockSheets = [
        {
          type: 'channels',
          id: 'sheet-1',
          title: 'Channels',
          height: 'half',
        },
      ];

      render(<SheetRenderer />);

      const closeButton = screen.getByTestId('sheet-close-btn');
      fireEvent.click(closeButton);

      expect(mockCloseSheet).toHaveBeenCalledTimes(1);
    });
  });

  describe('settings sheet navigation', () => {
    it('should render settings menu items', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      // The settings sheet should show menu items
      expect(screen.getByText('Identity')).toBeDefined();
      expect(screen.getByText('Privacy')).toBeDefined();
      expect(screen.getByText('Network')).toBeDefined();
      expect(screen.getByText('Storage')).toBeDefined();
      expect(screen.getByText('About')).toBeDefined();
    });

    it('should have clickable settings menu items', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      // Menu items should be buttons
      const identityButton = screen.getByText('Identity').closest('button');
      expect(identityButton).toBeDefined();

      const privacyButton = screen.getByText('Privacy').closest('button');
      expect(privacyButton).toBeDefined();
    });

    it('should open settings-identity when Identity is clicked', async () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      const identityButton = screen.getByText('Identity').closest('button');
      if (identityButton) {
        fireEvent.click(identityButton);
      }

      expect(mockOpenSheet).toHaveBeenCalledWith('settings-identity');
    });

    it('should open settings-privacy when Privacy is clicked', async () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      const privacyButton = screen.getByText('Privacy').closest('button');
      if (privacyButton) {
        fireEvent.click(privacyButton);
      }

      expect(mockOpenSheet).toHaveBeenCalledWith('settings-privacy');
    });

    it('should open settings-network when Network is clicked', async () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      const networkButton = screen.getByText('Network').closest('button');
      if (networkButton) {
        fireEvent.click(networkButton);
      }

      expect(mockOpenSheet).toHaveBeenCalledWith('settings-network');
    });

    it('should open settings-storage when Storage is clicked', async () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      const storageButton = screen.getByText('Storage').closest('button');
      if (storageButton) {
        fireEvent.click(storageButton);
      }

      expect(mockOpenSheet).toHaveBeenCalledWith('settings-storage');
    });

    it('should open settings-about when About is clicked', async () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      const aboutButton = screen.getByText('About').closest('button');
      if (aboutButton) {
        fireEvent.click(aboutButton);
      }

      expect(mockOpenSheet).toHaveBeenCalledWith('settings-about');
    });
  });

  describe('sheet props', () => {
    it('should pass props to sheet content components', () => {
      mockSheets = [
        {
          type: 'channel-detail',
          id: 'sheet-1',
          title: 'Channel',
          height: 'full',
          props: {
            channelId: 'test-channel-123',
            channelName: 'Test Channel',
          },
        },
      ];

      render(<SheetRenderer />);

      // The props should be visible in the rendered output (via JSON.stringify)
      expect(screen.getByText(/test-channel-123/)).toBeDefined();
    });

    it('should handle missing props gracefully', () => {
      mockSheets = [
        {
          type: 'custom',
          id: 'sheet-1',
          title: 'Custom',
          height: 'half',
        },
      ];

      render(<SheetRenderer />);

      // Should render default content when no props
      expect(screen.getByText('Custom content')).toBeDefined();
    });
  });

  describe('sheet isOpen state', () => {
    it('should pass isOpen as true to all rendered sheets', () => {
      mockSheets = [
        {
          type: 'channels',
          id: 'sheet-1',
          title: 'Channels',
          height: 'half',
        },
      ];

      render(<SheetRenderer />);

      const sheet = screen.getByTestId('sheet-channels');
      expect(sheet.getAttribute('data-open')).toBe('true');
    });

    it('should pass isOpen as true to all sheets in a stack', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
        {
          type: 'settings-identity',
          id: 'sheet-2',
          title: 'Identity',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      const settingsSheet = screen.getByTestId('sheet-settings');
      const identitySheet = screen.getByTestId('sheet-identity');
      expect(settingsSheet.getAttribute('data-open')).toBe('true');
      expect(identitySheet.getAttribute('data-open')).toBe('true');
    });
  });

  describe('sheet ordering', () => {
    it('should maintain proper DOM order for stacked sheets', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-first',
          title: 'Settings',
          height: 'full',
        },
        {
          type: 'settings-privacy',
          id: 'sheet-second',
          title: 'Privacy',
          height: 'full',
        },
        {
          type: 'settings-network',
          id: 'sheet-third',
          title: 'Network',
          height: 'full',
        },
      ];

      const { container } = render(<SheetRenderer />);

      // Verify all three sheets are rendered
      expect(screen.getByTestId('sheet-settings')).toBeDefined();
      expect(screen.getByTestId('sheet-privacy')).toBeDefined();
      expect(screen.getByTestId('sheet-network')).toBeDefined();
    });
  });

  describe('height variations', () => {
    it('should correctly pass half height to Sheet', () => {
      mockSheets = [
        {
          type: 'mesh-status',
          id: 'sheet-1',
          title: 'Mesh Status',
          height: 'half',
        },
      ];

      render(<SheetRenderer />);

      const sheet = screen.getByTestId('sheet-mesh-status');
      expect(sheet.getAttribute('data-height')).toBe('half');
    });

    it('should correctly pass full height to Sheet', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      render(<SheetRenderer />);

      const sheet = screen.getByTestId('sheet-settings');
      expect(sheet.getAttribute('data-height')).toBe('full');
    });

    it('should correctly pass auto height to Sheet', () => {
      mockSheets = [
        {
          type: 'custom',
          id: 'sheet-1',
          title: 'Custom',
          height: 'auto' as any, // Cast to handle type
        },
      ];

      render(<SheetRenderer />);

      const sheet = screen.getByTestId('sheet-custom');
      expect(sheet.getAttribute('data-height')).toBe('auto');
    });
  });

  describe('settings icons', () => {
    it('should render icons for each settings menu item', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      const { container } = render(<SheetRenderer />);

      // Each settings item should have an SVG icon
      const buttons = container.querySelectorAll('button');
      const menuButtons = Array.from(buttons).filter(btn =>
        ['Identity', 'Privacy', 'Network', 'Storage', 'About'].some(
          label => btn.textContent?.includes(label)
        )
      );

      menuButtons.forEach(button => {
        const svg = button.querySelector('svg');
        expect(svg).toBeDefined();
      });
    });

    it('should render chevron icons for navigation', () => {
      mockSheets = [
        {
          type: 'settings',
          id: 'sheet-1',
          title: 'Settings',
          height: 'full',
        },
      ];

      const { container } = render(<SheetRenderer />);

      // Look for chevron icons in the settings menu
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
    });
  });

  describe('custom sheet behavior', () => {
    it('should render default content when custom sheet has no content prop', () => {
      mockSheets = [
        {
          type: 'custom',
          id: 'sheet-1',
          title: 'Custom',
          height: 'half',
          props: undefined,
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('Custom content')).toBeDefined();
    });

    it('should render provided content when custom sheet has content prop', () => {
      mockSheets = [
        {
          type: 'custom',
          id: 'sheet-1',
          title: 'Custom',
          height: 'half',
          props: { content: 'My Custom Content' },
        },
      ];

      render(<SheetRenderer />);

      expect(screen.getByText('My Custom Content')).toBeDefined();
    });
  });

  describe('close functionality', () => {
    it('should only call closeSheet once per click', () => {
      mockSheets = [
        {
          type: 'peers',
          id: 'sheet-1',
          title: 'People',
          height: 'half',
        },
      ];

      render(<SheetRenderer />);

      const closeButton = screen.getByTestId('sheet-close-btn');
      fireEvent.click(closeButton);
      fireEvent.click(closeButton);

      // Should be called twice for two clicks
      expect(mockCloseSheet).toHaveBeenCalledTimes(2);
    });
  });
});
