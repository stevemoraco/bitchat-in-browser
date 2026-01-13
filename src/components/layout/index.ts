/**
 * Layout Components - BitChat In Browser
 *
 * Core layout components for the app shell:
 * - Shell: Main app wrapper with header, navigation, content area
 * - Header: Top bar with title, status, emergency wipe
 * - Navigation: Tab-based navigation with badges
 * - StatusBar: Network/relay/peer status display
 * - ResponsiveContainer: Adaptive layout wrapper
 */

export { Header } from './Header';
export type { ConnectionState } from './Header';

export { Navigation, TabBar } from './Navigation';

export { StatusBar, CompactStatusBar } from './StatusBar';

export {
  Shell,
  MinimalShell,
  LoadingShell,
  ErrorShell,
} from './Shell';

export {
  ResponsiveContainer,
  LayoutProvider,
  SplitView,
  MobileView,
  ModalContainer,
  ChatContainer,
  ThreeColumnLayout,
  MobileOnly,
  TabletOnly,
  DesktopOnly,
  HiddenOnMobile,
  HiddenOnDesktop,
} from './ResponsiveContainer';
