/**
 * Navigation Component - BitChat In Browser
 *
 * Tab navigation for main app views:
 * - Channels (location-based channels)
 * - Messages (direct messages)
 * - Peers (contacts/peers list)
 * - Settings
 *
 * Features:
 * - Active tab highlighting
 * - Unread badge counts
 * - Mobile-optimized bottom navigation
 * - Desktop sidebar option
 * - Responsive layout (bottom tabs on mobile, sidebar on desktop)
 */

import { FunctionComponent } from 'preact';
import { useCallback, useRef } from 'preact/hooks';
import { useAppStore } from '../../stores';
import type { ViewType } from '../../stores/types';
import { useNavigationLayout, useIsLandscape, useIsMobile } from '../../hooks/useMediaQuery';
import { useRovingTabIndex, ariaLabels } from '../../hooks/useA11y';

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  id: ViewType;
  label: string;
  shortLabel: string;
  icon: string;
}

interface NavigationProps {
  /** ID for the navigation element (for skip links) */
  id?: string;
  /** Current active tab */
  activeTab?: ViewType;
  /** Callback when tab is selected */
  onTabChange?: (tab: ViewType) => void;
  /** Position of navigation (bottom for mobile, top for desktop) */
  position?: 'top' | 'bottom';
  /** Unread counts for each tab */
  unreadCounts?: {
    channels?: number;
    messages?: number;
    peers?: number;
  };
}

// ============================================================================
// Navigation Items Configuration
// ============================================================================

const NAV_ITEMS: NavItem[] = [
  {
    id: 'channels',
    label: 'Channels',
    shortLabel: 'Chan',
    icon: '#', // Hash for channels
  },
  {
    id: 'messages',
    label: 'Messages',
    shortLabel: 'Msgs',
    icon: '@', // At for DMs
  },
  {
    id: 'peers',
    label: 'Peers',
    shortLabel: 'Peer',
    icon: '*', // Asterisk for peers
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Set',
    icon: '>', // Prompt for settings
  },
];

// ============================================================================
// Unread Badge Component
// ============================================================================

interface UnreadBadgeProps {
  count: number;
}

const UnreadBadge: FunctionComponent<UnreadBadgeProps> = ({ count }) => {
  if (count <= 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <span
      class="absolute -top-1 -right-1 min-w-[1.25rem] h-5 flex items-center justify-center px-1 text-terminal-xs font-bold bg-terminal-red text-terminal-bg rounded-full"
      aria-label={`${count} unread`}
    >
      {displayCount}
    </span>
  );
};

// ============================================================================
// Navigation Tab Component
// ============================================================================

interface NavTabProps {
  item: NavItem;
  isActive: boolean;
  unreadCount?: number;
  onClick: () => void;
  position: 'top' | 'bottom';
  isCompact?: boolean;
  /** Ref for roving tabindex */
  buttonRef?: preact.RefObject<HTMLButtonElement>;
}

const NavTab: FunctionComponent<NavTabProps> = ({
  item,
  isActive,
  unreadCount = 0,
  onClick,
  position,
  isCompact = false,
  buttonRef,
}) => {
  const baseClasses = `
    relative flex-1 flex items-center justify-center gap-1.5
    ${isCompact ? 'py-1.5 px-1' : 'py-3 px-2'}
    font-mono text-sm transition-colors duration-150
    focus:outline-none focus-visible:ring-1 focus-visible:ring-terminal-green
    touch-target
  `;

  const activeClasses = isActive
    ? 'text-terminal-green bg-terminal-green/10'
    : 'text-terminal-green/50 hover:text-terminal-green/80 hover:bg-terminal-green/5';

  const borderClasses =
    position === 'top'
      ? isActive
        ? 'border-b-2 border-terminal-green'
        : 'border-b-2 border-transparent'
      : isActive
        ? 'border-t-2 border-terminal-green'
        : 'border-t-2 border-transparent';

  // Generate accessible label including unread count
  const accessibleLabel = unreadCount > 0
    ? ariaLabels.navItemWithBadge(item.label, unreadCount)
    : item.label;

  return (
    <button
      ref={buttonRef}
      onClick={onClick}
      class={`${baseClasses} ${activeClasses} ${borderClasses}`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={accessibleLabel}
      role="tab"
      aria-selected={isActive}
    >
      {/* Icon - decorative, hidden from screen readers */}
      <span
        class={`${isCompact ? 'text-base' : 'text-lg'} ${isActive ? 'text-terminal-green' : 'text-terminal-green/50'}`}
        aria-hidden="true"
      >
        {item.icon}
      </span>

      {/* Label - hide in compact mode */}
      {!isCompact && (
        <>
          <span class="hidden sm:inline">{item.label}</span>
          <span class="sm:hidden text-terminal-xs">{item.shortLabel}</span>
        </>
      )}

      {/* Unread badge - with sr-only text for screen readers */}
      {unreadCount > 0 && (
        <>
          <UnreadBadge count={unreadCount} />
          <span class="sr-only">, {unreadCount} unread</span>
        </>
      )}
    </button>
  );
};

// ============================================================================
// Sidebar Navigation Item (Desktop)
// ============================================================================

interface SidebarNavItemProps {
  item: NavItem;
  isActive: boolean;
  unreadCount?: number;
  onClick: () => void;
}

const SidebarNavItem: FunctionComponent<SidebarNavItemProps> = ({
  item,
  isActive,
  unreadCount = 0,
  onClick,
}) => {
  const baseClasses = `
    relative flex items-center gap-3 w-full
    px-4 py-3 font-mono text-sm transition-colors duration-150
    focus:outline-none focus-visible:ring-1 focus-visible:ring-terminal-green
    list-item-touch
  `;

  const activeClasses = isActive
    ? 'text-terminal-green bg-terminal-green/10 border-l-2 border-terminal-green'
    : 'text-terminal-green/60 hover:text-terminal-green hover:bg-terminal-green/5 border-l-2 border-transparent';

  return (
    <button
      onClick={onClick}
      class={`${baseClasses} ${activeClasses}`}
      aria-current={isActive ? 'page' : undefined}
      aria-label={item.label}
    >
      {/* Icon */}
      <span
        class={`text-lg w-6 text-center ${isActive ? 'text-terminal-green' : 'text-terminal-green/50'}`}
      >
        {item.icon}
      </span>

      {/* Label */}
      <span class="flex-1 text-left">{item.label}</span>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span class="min-w-[1.25rem] h-5 flex items-center justify-center px-1 text-terminal-xs font-bold bg-terminal-red text-terminal-bg rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};

// ============================================================================
// Navigation Component
// ============================================================================

export const Navigation: FunctionComponent<NavigationProps> = ({
  id,
  activeTab: externalActiveTab,
  onTabChange: externalOnTabChange,
  position: externalPosition,
  unreadCounts = {},
}) => {
  // Use store for state if not provided externally
  const storeView = useAppStore((state) => state.currentView);
  const setView = useAppStore((state) => state.setView);

  // Responsive layout detection
  const responsiveLayout = useNavigationLayout();
  const isLandscape = useIsLandscape();
  const isMobile = useIsMobile();

  // Refs for roving tabindex
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Determine position: use external prop if provided, otherwise use responsive layout
  const position = externalPosition ?? (responsiveLayout === 'sidebar' ? 'top' : 'bottom');

  // Use external props if provided, otherwise use store
  const activeTab = externalActiveTab ?? storeView;

  // Find current active index
  const currentActiveIndex = NAV_ITEMS.findIndex(item => item.id === activeTab);

  // Roving tabindex for keyboard navigation
  const { handleKeyDown: handleRovingKeyDown } = useRovingTabIndex({
    items: tabRefs.current,
    currentIndex: currentActiveIndex >= 0 ? currentActiveIndex : 0,
    orientation: responsiveLayout === 'sidebar' ? 'vertical' : 'horizontal',
    wrap: true,
    onIndexChange: (index) => {
      // Focus the tab but don't select it until Enter/Space is pressed
      const tab = tabRefs.current[index];
      if (tab) {
        tab.focus();
      }
    },
  });

  const handleTabChange = useCallback(
    (tab: ViewType) => {
      if (externalOnTabChange) {
        externalOnTabChange(tab);
      } else {
        setView(tab);
      }
    },
    [externalOnTabChange, setView]
  );

  // Don't show navigation on onboarding view
  if (activeTab === 'onboarding') {
    return null;
  }

  // Desktop sidebar layout
  if (responsiveLayout === 'sidebar') {
    return (
      <nav
        id={id}
        class="nav-container bg-terminal-bg"
        role="navigation"
        aria-label="Main navigation"
        tabIndex={-1}
      >
        <div class="flex flex-col h-full py-4">
          {/* App title */}
          <div class="px-4 pb-4 border-b border-terminal-green/20">
            <h1 class="text-terminal-green font-bold text-sm">BitChat</h1>
          </div>

          {/* Nav items */}
          <div class="flex-1 py-2" role="tablist" aria-orientation="vertical">
            {NAV_ITEMS.map((item, _index) => (
              <SidebarNavItem
                key={item.id}
                item={item}
                isActive={activeTab === item.id}
                unreadCount={
                  item.id === 'channels'
                    ? unreadCounts.channels
                    : item.id === 'messages'
                      ? unreadCounts.messages
                      : item.id === 'peers'
                        ? unreadCounts.peers
                        : undefined
                }
                onClick={() => handleTabChange(item.id)}
              />
            ))}
          </div>

          {/* Footer */}
          <div class="px-4 pt-4 border-t border-terminal-green/20">
            <span class="text-terminal-xs text-terminal-green/40">v1.0.0</span>
          </div>
        </div>
      </nav>
    );
  }

  // Mobile/tablet bottom navigation
  const containerClasses = `
    nav-container bg-terminal-bg
    ${isMobile && isLandscape ? 'nav-items-landscape' : ''}
  `;

  return (
    <nav
      id={id}
      class={containerClasses}
      role="navigation"
      aria-label="Main navigation"
      tabIndex={-1}
    >
      <div
        class={`flex items-stretch ${isMobile && isLandscape ? 'justify-around' : ''}`}
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={(e) => handleRovingKeyDown(e as unknown as KeyboardEvent)}
      >
        {NAV_ITEMS.map((item, index) => (
          <NavTab
            key={item.id}
            item={item}
            isActive={activeTab === item.id}
            unreadCount={
              item.id === 'channels'
                ? unreadCounts.channels
                : item.id === 'messages'
                  ? unreadCounts.messages
                  : item.id === 'peers'
                    ? unreadCounts.peers
                    : undefined
            }
            onClick={() => handleTabChange(item.id)}
            position={position}
            isCompact={isMobile && isLandscape}
            buttonRef={{ current: tabRefs.current[index] || null } as preact.RefObject<HTMLButtonElement>}
          />
        ))}
      </div>
    </nav>
  );
};

// ============================================================================
// Desktop Tab Bar (Alternative horizontal layout)
// ============================================================================

export const TabBar: FunctionComponent<NavigationProps> = (props) => {
  return <Navigation {...props} position="top" />;
};

export default Navigation;
