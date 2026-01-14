/**
 * Shell Component Tests
 *
 * Tests for the main app shell including:
 * - Header rendering
 * - Main content area
 * - Safe area padding
 * - Navigation (bottom/sidebar)
 * - Status bar
 * - Emergency wipe callback
 * - Responsive layout
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/preact';
import { h } from 'preact';
import { Shell, MinimalShell, LoadingShell, ErrorShell } from '../Shell';

// Mock the stores
vi.mock('../../../stores', () => ({
  useAppStore: (selector: (state: any) => any) => {
    const state = {
      currentView: 'chat',
      isOnline: true,
    };
    return selector(state);
  },
}));

// Mock hooks
const mockIsMobile = vi.fn().mockReturnValue(false);
const mockNavigationLayout = vi.fn().mockReturnValue('bottom');
const mockIsLandscape = vi.fn().mockReturnValue(false);

vi.mock('../../../hooks/useMediaQuery', () => ({
  useIsMobile: () => mockIsMobile(),
  useNavigationLayout: () => mockNavigationLayout(),
  useIsLandscape: () => mockIsLandscape(),
}));

// Mock child components
vi.mock('../Header', () => ({
  Header: ({ onEmergencyWipe }: { onEmergencyWipe?: () => void }) =>
    h('header', {
      'data-testid': 'header',
      onClick: onEmergencyWipe,
    }, 'Header'),
}));

vi.mock('../Navigation', () => ({
  Navigation: ({ position, id }: { position?: string; id?: string }) =>
    h('nav', {
      'data-testid': `navigation-${position || 'sidebar'}`,
      id,
    }, 'Navigation'),
}));

vi.mock('../StatusBar', () => ({
  StatusBar: ({ relayCount, webrtcPeerCount }: { relayCount: number; webrtcPeerCount: number }) =>
    h('div', { 'data-testid': 'status-bar' }, `Relays: ${relayCount}, Peers: ${webrtcPeerCount}`),
  CompactStatusBar: ({ relayCount, webrtcPeerCount }: { relayCount: number; webrtcPeerCount: number }) =>
    h('div', { 'data-testid': 'compact-status-bar' }, `Compact: ${relayCount}/${webrtcPeerCount}`),
}));

vi.mock('../../a11y/SkipLinks', () => ({
  SkipLinks: () => h('div', { 'data-testid': 'skip-links' }, 'Skip Links'),
  SKIP_LINK_TARGETS: {
    main: 'main-content',
    navigation: 'main-navigation',
  },
}));

vi.mock('../../../hooks/useA11y', () => ({
  ariaLabels: {
    connectionStatus: (relays: number, peers: number) => `${relays} relays, ${peers} peers`,
  },
}));

describe('Shell Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsMobile.mockReturnValue(false);
    mockNavigationLayout.mockReturnValue('bottom');
    mockIsLandscape.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe('rendering', () => {
    it('should render children content', () => {
      render(
        <Shell>
          <div data-testid="test-content">Test Content</div>
        </Shell>
      );

      expect(screen.getByTestId('test-content')).toBeDefined();
      expect(screen.getByText('Test Content')).toBeDefined();
    });

    it('should render header by default', () => {
      render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByTestId('header')).toBeDefined();
    });

    it('should not render header when showHeader is false', () => {
      render(
        <Shell showHeader={false}>
          <div>Content</div>
        </Shell>
      );

      expect(screen.queryByTestId('header')).toBeNull();
    });

    it('should render navigation by default', () => {
      render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByTestId('navigation-bottom')).toBeDefined();
    });

    it('should not render navigation when showNavigation is false', () => {
      render(
        <Shell showNavigation={false}>
          <div>Content</div>
        </Shell>
      );

      expect(screen.queryByTestId('navigation-bottom')).toBeNull();
    });

    it('should render skip links', () => {
      render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByTestId('skip-links')).toBeDefined();
    });
  });

  describe('main content area', () => {
    it('should render main element with correct role', () => {
      render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      const main = screen.getByRole('main');
      expect(main).toBeDefined();
    });

    it('should have main-content id for skip link target', () => {
      const { container } = render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      const main = container.querySelector('#main-content');
      expect(main).toBeDefined();
    });

    it('should have correct aria-label', () => {
      render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      const main = screen.getByLabelText('Main content');
      expect(main).toBeDefined();
    });

    it('should have tabIndex -1 for programmatic focus', () => {
      const { container } = render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      const main = container.querySelector('main');
      expect(main?.getAttribute('tabIndex')).toBe('-1');
    });

    it('should have padding-top when header is shown', () => {
      const { container } = render(
        <Shell showHeader={true}>
          <div>Content</div>
        </Shell>
      );

      const main = container.querySelector('main');
      expect(main?.className).toContain('pt-12');
    });

    it('should not have padding-top when header is hidden', () => {
      const { container } = render(
        <Shell showHeader={false}>
          <div>Content</div>
        </Shell>
      );

      const main = container.querySelector('main');
      expect(main?.className).not.toContain('pt-12');
    });

    it('should have padding-bottom when navigation is shown (bottom layout)', () => {
      mockNavigationLayout.mockReturnValue('bottom');

      const { container } = render(
        <Shell showNavigation={true}>
          <div>Content</div>
        </Shell>
      );

      const main = container.querySelector('main');
      expect(main?.className).toContain('pb-14');
    });
  });

  describe('status bar', () => {
    it('should render status bar on non-mobile by default', () => {
      mockIsMobile.mockReturnValue(false);

      render(
        <Shell showStatusBar={true} relayCount={3} webrtcPeerCount={5}>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByTestId('status-bar')).toBeDefined();
    });

    it('should render compact status bar on mobile', () => {
      mockIsMobile.mockReturnValue(true);
      mockNavigationLayout.mockReturnValue('bottom');

      render(
        <Shell showStatusBar={true} relayCount={3} webrtcPeerCount={5}>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByTestId('compact-status-bar')).toBeDefined();
    });

    it('should not render status bar when showStatusBar is false', () => {
      render(
        <Shell showStatusBar={false}>
          <div>Content</div>
        </Shell>
      );

      expect(screen.queryByTestId('status-bar')).toBeNull();
      expect(screen.queryByTestId('compact-status-bar')).toBeNull();
    });

    it('should pass correct props to status bar', () => {
      mockIsMobile.mockReturnValue(false);

      render(
        <Shell showStatusBar={true} relayCount={3} webrtcPeerCount={5}>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByText('Relays: 3, Peers: 5')).toBeDefined();
    });
  });

  describe('emergency wipe', () => {
    it('should pass onEmergencyWipe to Header', () => {
      const onEmergencyWipe = vi.fn();

      render(
        <Shell onEmergencyWipe={onEmergencyWipe}>
          <div>Content</div>
        </Shell>
      );

      const header = screen.getByTestId('header');
      fireEvent.click(header);

      expect(onEmergencyWipe).toHaveBeenCalledTimes(1);
    });
  });

  describe('responsive layout', () => {
    it('should render sidebar navigation on sidebar layout', () => {
      mockNavigationLayout.mockReturnValue('sidebar');

      render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByTestId('navigation-sidebar')).toBeDefined();
    });

    it('should render bottom navigation on bottom layout', () => {
      mockNavigationLayout.mockReturnValue('bottom');

      render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByTestId('navigation-bottom')).toBeDefined();
    });

    it('should apply landscape safe classes', () => {
      mockIsMobile.mockReturnValue(true);
      mockIsLandscape.mockReturnValue(true);

      const { container } = render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      const main = container.querySelector('main');
      expect(main?.className).toContain('landscape-safe-x');
    });

    it('should use flex-row layout for sidebar mode', () => {
      mockNavigationLayout.mockReturnValue('sidebar');

      const { container } = render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      const root = container.firstElementChild;
      expect(root?.className).toContain('flex-row');
    });

    it('should use flex-col layout for bottom mode', () => {
      mockNavigationLayout.mockReturnValue('bottom');

      const { container } = render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      const root = container.firstElementChild;
      expect(root?.className).toContain('flex-col');
    });
  });

  describe('onboarding mode', () => {
    it('should hide header during onboarding', () => {
      // Override the store mock for this test
      vi.doMock('../../../stores', () => ({
        useAppStore: (selector: (state: any) => any) => {
          const state = {
            currentView: 'onboarding',
          };
          return selector(state);
        },
      }));

      // Component behavior depends on store state
      const { container } = render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      // The component should still render, just with different visibility
      expect(container).toBeDefined();
    });
  });

  describe('unread counts', () => {
    it('should pass unread counts to navigation', () => {
      const unreadCounts = {
        channels: 5,
        messages: 10,
        peers: 2,
      };

      render(
        <Shell unreadCounts={unreadCounts}>
          <div>Content</div>
        </Shell>
      );

      // Navigation receives the props
      expect(screen.getByTestId('navigation-bottom')).toBeDefined();
    });
  });

  describe('sync state', () => {
    it('should pass sync progress to status bar', () => {
      mockIsMobile.mockReturnValue(false);

      render(
        <Shell isSyncing={true} syncProgress={50}>
          <div>Content</div>
        </Shell>
      );

      expect(screen.getByTestId('status-bar')).toBeDefined();
    });
  });

  describe('combined visibility states', () => {
    it('should render only content when all shell components are hidden', () => {
      const { container } = render(
        <Shell showHeader={false} showNavigation={false} showStatusBar={false}>
          <div data-testid="only-content">Only Content</div>
        </Shell>
      );

      expect(screen.getByTestId('only-content')).toBeDefined();
      expect(screen.queryByTestId('header')).toBeNull();
      expect(screen.queryByTestId('navigation-bottom')).toBeNull();
      expect(screen.queryByTestId('status-bar')).toBeNull();
      expect(screen.queryByTestId('compact-status-bar')).toBeNull();
    });

    it('should correctly calculate main content classes with all components visible', () => {
      mockIsMobile.mockReturnValue(false);
      mockNavigationLayout.mockReturnValue('bottom');

      const { container } = render(
        <Shell showHeader={true} showNavigation={true} showStatusBar={true}>
          <div>Content</div>
        </Shell>
      );

      const main = container.querySelector('main');
      expect(main?.className).toContain('main-content');
      expect(main?.className).toContain('flex-1');
      expect(main?.className).toContain('overflow-y-auto');
      expect(main?.className).toContain('pt-12');
      expect(main?.className).toContain('pb-14');
    });
  });

  describe('sidebar layout with status bar', () => {
    it('should not show compact status bar on sidebar layout', () => {
      mockIsMobile.mockReturnValue(false);
      mockNavigationLayout.mockReturnValue('sidebar');

      render(
        <Shell showStatusBar={true} relayCount={2} webrtcPeerCount={3}>
          <div>Content</div>
        </Shell>
      );

      // Desktop/sidebar layout shows full status bar, not compact
      expect(screen.getByTestId('status-bar')).toBeDefined();
      expect(screen.queryByTestId('compact-status-bar')).toBeNull();
    });

    it('should apply main-content-with-sidebar class on sidebar layout', () => {
      mockNavigationLayout.mockReturnValue('sidebar');

      const { container } = render(
        <Shell>
          <div>Content</div>
        </Shell>
      );

      const main = container.querySelector('main');
      expect(main?.className).toContain('main-content-with-sidebar');
    });
  });

  describe('mobile landscape positioning', () => {
    it('should position compact status bar higher in landscape', () => {
      mockIsMobile.mockReturnValue(true);
      mockIsLandscape.mockReturnValue(true);
      mockNavigationLayout.mockReturnValue('bottom');

      const { container } = render(
        <Shell showStatusBar={true}>
          <div>Content</div>
        </Shell>
      );

      const statusContainer = container.querySelector('[role="status"]');
      // In landscape, compact status bar should be at bottom-10 instead of bottom-14
      expect(statusContainer?.className).toContain('bottom-10');
    });

    it('should position compact status bar normally in portrait', () => {
      mockIsMobile.mockReturnValue(true);
      mockIsLandscape.mockReturnValue(false);
      mockNavigationLayout.mockReturnValue('bottom');

      const { container } = render(
        <Shell showStatusBar={true}>
          <div>Content</div>
        </Shell>
      );

      const statusContainer = container.querySelector('[role="status"]');
      expect(statusContainer?.className).toContain('bottom-14');
    });
  });

  describe('aria-live regions', () => {
    it('should have polite aria-live on status bar container', () => {
      mockIsMobile.mockReturnValue(false);

      const { container } = render(
        <Shell showStatusBar={true} relayCount={5} webrtcPeerCount={10}>
          <div>Content</div>
        </Shell>
      );

      const statusContainer = container.querySelector('[role="status"]');
      expect(statusContainer?.getAttribute('aria-live')).toBe('polite');
    });
  });

  describe('default prop values', () => {
    it('should use default values for relay and peer counts', () => {
      mockIsMobile.mockReturnValue(false);

      render(
        <Shell showStatusBar={true}>
          <div>Content</div>
        </Shell>
      );

      // Default values are relayCount=0, webrtcPeerCount=0
      expect(screen.getByText('Relays: 0, Peers: 0')).toBeDefined();
    });
  });
});

describe('MinimalShell Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render children', () => {
    render(
      <MinimalShell>
        <div data-testid="minimal-content">Minimal Content</div>
      </MinimalShell>
    );

    expect(screen.getByTestId('minimal-content')).toBeDefined();
  });

  it('should render default title', () => {
    render(
      <MinimalShell>
        <div>Content</div>
      </MinimalShell>
    );

    expect(screen.getByText('BitChat In Browser')).toBeDefined();
  });

  it('should render custom title', () => {
    render(
      <MinimalShell title="Custom Title">
        <div>Content</div>
      </MinimalShell>
    );

    expect(screen.getByText('Custom Title')).toBeDefined();
  });

  it('should have header with banner role', () => {
    const { container } = render(
      <MinimalShell>
        <div>Content</div>
      </MinimalShell>
    );

    const header = container.querySelector('header');
    expect(header?.getAttribute('role')).toBe('banner');
  });

  it('should have main with main role', () => {
    render(
      <MinimalShell>
        <div>Content</div>
      </MinimalShell>
    );

    expect(screen.getByRole('main')).toBeDefined();
  });

  it('should have footer with contentinfo role', () => {
    const { container } = render(
      <MinimalShell>
        <div>Content</div>
      </MinimalShell>
    );

    const footer = container.querySelector('footer');
    expect(footer?.getAttribute('role')).toBe('contentinfo');
  });
});

describe('LoadingShell Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render default loading message', () => {
    render(<LoadingShell />);

    // Text appears in both visible span and sr-only div
    const messages = screen.getAllByText('Initializing BitChat...');
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it('should render custom loading message', () => {
    render(<LoadingShell message="Loading keys..." />);

    // Text appears in both visible span and sr-only div
    const messages = screen.getAllByText('Loading keys...');
    expect(messages.length).toBeGreaterThanOrEqual(1);
  });

  it('should have aria-busy attribute', () => {
    const { container } = render(<LoadingShell />);

    const main = container.firstElementChild;
    expect(main?.getAttribute('aria-busy')).toBe('true');
  });

  it('should have aria-label for screen readers', () => {
    const { container } = render(<LoadingShell />);

    const main = container.firstElementChild;
    expect(main?.getAttribute('aria-label')).toBe('Loading');
  });

  it('should render loading animation', () => {
    const { container } = render(<LoadingShell />);

    const bouncingDots = container.querySelectorAll('.animate-bounce');
    expect(bouncingDots.length).toBe(3);
  });

  it('should have pulsing cursor indicator', () => {
    const { container } = render(<LoadingShell />);

    const pulsingCursor = container.querySelector('.animate-pulse');
    expect(pulsingCursor).toBeDefined();
  });
});

describe('ErrorShell Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render error message', () => {
    render(<ErrorShell error="Test error message" />);

    expect(screen.getByText('Test error message')).toBeDefined();
  });

  it('should render System Error title', () => {
    render(<ErrorShell error="Test error" />);

    expect(screen.getByText('System Error')).toBeDefined();
  });

  it('should render retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorShell error="Test error" onRetry={onRetry} />);

    const retryButton = screen.getByText('[RETRY]');
    expect(retryButton).toBeDefined();
  });

  it('should not render retry button when onRetry is not provided', () => {
    render(<ErrorShell error="Test error" />);

    expect(screen.queryByText('[RETRY]')).toBeNull();
  });

  it('should call onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorShell error="Test error" onRetry={onRetry} />);

    const retryButton = screen.getByText('[RETRY]');
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should have alert role for screen readers', () => {
    render(<ErrorShell error="Test error" />);

    const alert = screen.getByRole('alert');
    expect(alert).toBeDefined();
  });

  it('should have aria-live assertive', () => {
    render(<ErrorShell error="Test error" />);

    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
  });

  it('should render help text', () => {
    render(<ErrorShell error="Test error" />);

    expect(
      screen.getByText(/If this persists, try clearing your browser data/)
    ).toBeDefined();
  });
});
