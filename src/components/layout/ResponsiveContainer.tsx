/**
 * ResponsiveContainer - Adaptive layout wrapper component
 *
 * Provides responsive layouts that adapt to device type:
 * - Mobile: Full-width, stack layout
 * - Tablet: Split view with optional sidebar
 * - Desktop: Three-column layout with sidebar navigation
 *
 * Features:
 * - Automatic layout switching based on breakpoints
 * - Safe area inset handling
 * - Smooth transitions between layouts
 * - Support for swipe navigation on mobile
 */

import type { FunctionComponent, ComponentChildren } from 'preact';
import { useRef, useMemo } from 'preact/hooks';
import {
  useResponsive,
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useNavigationLayout,
  useChatLayout,
  useModalLayout,
  useSafeAreaInsets,
} from '../../hooks/useMediaQuery';
import { useSwipeBack, usePullToRefresh } from '../../hooks/useTouchGestures';

// ============================================================================
// Types
// ============================================================================

type LayoutType = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveContainerProps {
  /** Content to render */
  children: ComponentChildren;
  /** CSS class name */
  className?: string;
  /** Whether to apply safe area padding */
  useSafeArea?: boolean;
  /** Maximum content width */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

interface SplitViewProps {
  /** Primary/sidebar content */
  sidebar: ComponentChildren;
  /** Main content area */
  main: ComponentChildren;
  /** Width of the sidebar */
  sidebarWidth?: number | string;
  /** Whether sidebar is visible on mobile */
  showSidebarOnMobile?: boolean;
  /** Callback when mobile sidebar should close */
  onCloseSidebar?: () => void;
  /** CSS class name */
  className?: string;
}

interface MobileViewProps {
  /** Content to render */
  children: ComponentChildren;
  /** Callback when user swipes back */
  onSwipeBack?: () => void;
  /** Whether swipe back is enabled */
  enableSwipeBack?: boolean;
  /** Callback for pull to refresh */
  onRefresh?: () => Promise<void>;
  /** Whether pull to refresh is enabled */
  enablePullToRefresh?: boolean;
  /** CSS class name */
  className?: string;
}

interface ModalContainerProps {
  /** Modal content */
  children: ComponentChildren;
  /** Whether modal is open */
  isOpen: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Maximum width on desktop */
  maxWidth?: 'sm' | 'md' | 'lg';
  /** CSS class name */
  className?: string;
}

interface ChatContainerProps {
  /** Header content */
  header?: ComponentChildren;
  /** Message list content */
  messages: ComponentChildren;
  /** Message input content */
  input: ComponentChildren;
  /** Callback when user swipes back (mobile) */
  onSwipeBack?: () => void;
  /** CSS class name */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_WIDTHS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  full: '100%',
};

const MODAL_MAX_WIDTHS = {
  sm: '400px',
  md: '500px',
  lg: '600px',
};

// ============================================================================
// ResponsiveContainer Component
// ============================================================================

/**
 * Basic responsive container with safe area and max-width support
 */
export const ResponsiveContainer: FunctionComponent<ResponsiveContainerProps> = ({
  children,
  className = '',
  useSafeArea = true,
  maxWidth = 'full',
}) => {
  const safeAreaInsets = useSafeAreaInsets();

  const style = useMemo(
    () => ({
      maxWidth: MAX_WIDTHS[maxWidth],
      marginLeft: 'auto',
      marginRight: 'auto',
      ...(useSafeArea && {
        paddingTop: safeAreaInsets.top > 0 ? `${safeAreaInsets.top}px` : undefined,
        paddingBottom: safeAreaInsets.bottom > 0 ? `${safeAreaInsets.bottom}px` : undefined,
        paddingLeft: safeAreaInsets.left > 0 ? `${safeAreaInsets.left}px` : undefined,
        paddingRight: safeAreaInsets.right > 0 ? `${safeAreaInsets.right}px` : undefined,
      }),
    }),
    [maxWidth, useSafeArea, safeAreaInsets]
  );

  return (
    <div className={`w-full ${className}`} style={style}>
      {children}
    </div>
  );
};

// ============================================================================
// LayoutProvider Component
// ============================================================================

interface LayoutContextValue {
  layout: LayoutType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  navigationLayout: 'bottom' | 'sidebar';
  modalLayout: 'fullscreen' | 'centered';
  chatLayout: 'mobile' | 'split' | 'three-column';
}

/**
 * Provides layout context to children with current responsive state
 */
export const LayoutProvider: FunctionComponent<{
  children: (context: LayoutContextValue) => ComponentChildren;
}> = ({ children }) => {
  const { deviceType, isLandscape } = useResponsive();
  const navigationLayout = useNavigationLayout();
  const modalLayout = useModalLayout();
  const chatLayout = useChatLayout();

  const context: LayoutContextValue = {
    layout: deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isLandscape,
    navigationLayout,
    modalLayout,
    chatLayout,
  };

  return <>{children(context)}</>;
};

// ============================================================================
// SplitView Component
// ============================================================================

/**
 * Split view layout for tablet and desktop
 */
export const SplitView: FunctionComponent<SplitViewProps> = ({
  sidebar,
  main,
  sidebarWidth = 280,
  showSidebarOnMobile = false,
  onCloseSidebar,
  className = '',
}) => {
  const isMobile = useIsMobile();

  // Mobile: Show sidebar as overlay or hide completely
  if (isMobile && !showSidebarOnMobile) {
    return <div className={`flex-1 ${className}`}>{main}</div>;
  }

  // Mobile with sidebar overlay
  if (isMobile && showSidebarOnMobile) {
    return (
      <div className={`relative flex-1 ${className}`}>
        {/* Main content */}
        <div className="h-full">{main}</div>

        {/* Sidebar overlay */}
        <div
          className="fixed inset-0 z-50 flex"
          onClick={(e) => {
            if (e.target === e.currentTarget) onCloseSidebar?.();
          }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" />

          {/* Sidebar content */}
          <div
            className="relative z-10 h-full bg-background border-r border-muted safe-area-left safe-area-top safe-area-bottom"
            style={{ width: typeof sidebarWidth === 'number' ? `${sidebarWidth}px` : sidebarWidth }}
          >
            {sidebar}
          </div>
        </div>
      </div>
    );
  }

  // Tablet/Desktop: Side by side layout
  return (
    <div className={`flex h-full ${className}`}>
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 h-full border-r border-muted overflow-y-auto safe-area-left safe-area-top safe-area-bottom"
        style={{ width: typeof sidebarWidth === 'number' ? `${sidebarWidth}px` : sidebarWidth }}
      >
        {sidebar}
      </aside>

      {/* Main content */}
      <main className="flex-1 h-full overflow-y-auto safe-area-right safe-area-top safe-area-bottom">
        {main}
      </main>
    </div>
  );
};

// ============================================================================
// MobileView Component
// ============================================================================

/**
 * Mobile-optimized view with gesture support
 */
export const MobileView: FunctionComponent<MobileViewProps> = ({
  children,
  onSwipeBack,
  enableSwipeBack = true,
  onRefresh,
  enablePullToRefresh = false,
  className = '',
}) => {
  const { ref: swipeRef, state: swipeState, canSwipeBack } = useSwipeBack(
    () => onSwipeBack?.(),
    { enabled: enableSwipeBack && !!onSwipeBack }
  );

  const { ref: pullRef, state: pullState } = usePullToRefresh(
    async () => {
      if (onRefresh) await onRefresh();
    },
    { enabled: enablePullToRefresh && !!onRefresh }
  );

  // Combine refs if both gestures are enabled
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={enableSwipeBack ? swipeRef : enablePullToRefresh ? pullRef : containerRef}
      className={`relative h-full ${canSwipeBack ? 'can-swipe-back' : ''} ${className}`}
    >
      {/* Swipe indicator */}
      {canSwipeBack && swipeState.isSwiping && (
        <div
          className="swipe-indicator"
          style={{
            opacity: swipeState.progress,
            transform: `translateY(-50%) scaleY(${0.5 + swipeState.progress * 0.5})`,
          }}
        />
      )}

      {/* Pull to refresh indicator */}
      {enablePullToRefresh && (pullState.isPulling || pullState.isRefreshing) && (
        <div
          className="pull-to-refresh"
          style={{
            transform: `translateY(${pullState.pullDistance - 60}px)`,
            opacity: pullState.progress,
          }}
        >
          <div
            className={`pull-to-refresh-spinner ${pullState.isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: `rotate(${pullState.progress * 360}deg)`,
            }}
          />
        </div>
      )}

      {/* Content */}
      <div
        className="h-full"
        style={{
          transform:
            swipeState.isSwiping && canSwipeBack
              ? `translateX(${swipeState.distance * 0.3}px)`
              : pullState.isPulling
                ? `translateY(${pullState.pullDistance * 0.3}px)`
                : undefined,
          transition: swipeState.isSwiping || pullState.isPulling ? 'none' : 'transform 0.2s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// ModalContainer Component
// ============================================================================

/**
 * Responsive modal that adapts to device type
 */
export const ModalContainer: FunctionComponent<ModalContainerProps> = ({
  children,
  isOpen,
  onClose,
  title,
  showCloseButton = true,
  maxWidth = 'md',
  className = '',
}) => {
  const modalLayout = useModalLayout();

  if (!isOpen) return null;

  // Mobile: Full screen modal
  if (modalLayout === 'fullscreen') {
    return (
      <div className="modal-mobile" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-muted safe-area-top">
            {title && (
              <h2 id="modal-title" className="text-lg font-bold text-text">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-muted hover:text-text transition-colors"
                aria-label="Close modal"
              >
                <span className="text-xl">[X]</span>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={`flex-1 overflow-y-auto ${className}`}>{children}</div>
      </div>
    );
  }

  // Desktop: Centered overlay modal
  return (
    <div
      className="modal-desktop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal-desktop-content ${className}`}
        style={{ maxWidth: MODAL_MAX_WIDTHS[maxWidth] }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-muted">
            {title && (
              <h2 id="modal-title" className="text-lg font-bold text-text">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-muted hover:text-text transition-colors"
                aria-label="Close modal"
              >
                <span>[X]</span>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// ChatContainer Component
// ============================================================================

/**
 * Optimized container for chat view with responsive behavior
 */
export const ChatContainer: FunctionComponent<ChatContainerProps> = ({
  header,
  messages,
  input,
  onSwipeBack,
  className = '',
}) => {
  const isMobile = useIsMobile();
  const chatLayout = useChatLayout();

  // Mobile: Full screen with swipe back
  if (isMobile || chatLayout === 'mobile') {
    return (
      <MobileView
        onSwipeBack={onSwipeBack}
        enableSwipeBack={!!onSwipeBack}
        className={`chat-view-mobile ${className}`}
      >
        {/* Header */}
        {header && (
          <div className="flex-shrink-0 safe-area-top">{header}</div>
        )}

        {/* Messages - flex-1 to fill available space */}
        <div className="flex-1 overflow-y-auto min-h-0">{messages}</div>

        {/* Input - sticky bottom */}
        <div className="flex-shrink-0 message-input-container">{input}</div>
      </MobileView>
    );
  }

  // Tablet/Desktop: Constrained width
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      {header && <div className="flex-shrink-0">{header}</div>}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="chat-view-tablet">{messages}</div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 message-input-desktop">{input}</div>
    </div>
  );
};

// ============================================================================
// ThreeColumnLayout Component
// ============================================================================

interface ThreeColumnLayoutProps {
  /** Navigation sidebar (leftmost) */
  navigation: ComponentChildren;
  /** List/secondary panel (middle) */
  list: ComponentChildren;
  /** Main content area (rightmost) */
  main: ComponentChildren;
  /** Whether list panel is visible */
  showList?: boolean;
  /** Navigation width */
  navWidth?: number;
  /** List panel width */
  listWidth?: number;
  /** CSS class name */
  className?: string;
}

/**
 * Three-column layout for large desktop screens
 */
export const ThreeColumnLayout: FunctionComponent<ThreeColumnLayoutProps> = ({
  navigation,
  list,
  main,
  showList = true,
  navWidth = 280,
  listWidth = 320,
  className = '',
}) => {
  const isDesktop = useIsDesktop();

  // Fallback to split view on smaller screens
  if (!isDesktop) {
    return (
      <SplitView
        sidebar={showList ? list : navigation}
        main={main}
        sidebarWidth={showList ? listWidth : navWidth}
        className={className}
      />
    );
  }

  return (
    <div className={`flex h-full ${className}`}>
      {/* Navigation sidebar */}
      <nav
        className="flex-shrink-0 h-full border-r border-muted overflow-y-auto safe-area-left safe-area-y"
        style={{ width: `${navWidth}px` }}
      >
        {navigation}
      </nav>

      {/* List panel */}
      {showList && (
        <aside
          className="flex-shrink-0 h-full border-r border-muted overflow-y-auto safe-area-y"
          style={{ width: `${listWidth}px` }}
        >
          {list}
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 h-full overflow-y-auto safe-area-right safe-area-y">{main}</main>
    </div>
  );
};

// ============================================================================
// Responsive Visibility Components
// ============================================================================

interface VisibilityProps {
  children: ComponentChildren;
  className?: string;
}

/** Only visible on mobile devices */
export const MobileOnly: FunctionComponent<VisibilityProps> = ({ children, className = '' }) => {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return <div className={className}>{children}</div>;
};

/** Only visible on tablet devices */
export const TabletOnly: FunctionComponent<VisibilityProps> = ({ children, className = '' }) => {
  const isTablet = useIsTablet();
  if (!isTablet) return null;
  return <div className={className}>{children}</div>;
};

/** Only visible on desktop devices */
export const DesktopOnly: FunctionComponent<VisibilityProps> = ({ children, className = '' }) => {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return null;
  return <div className={className}>{children}</div>;
};

/** Hidden on mobile devices */
export const HiddenOnMobile: FunctionComponent<VisibilityProps> = ({ children, className = '' }) => {
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return <div className={className}>{children}</div>;
};

/** Hidden on desktop devices */
export const HiddenOnDesktop: FunctionComponent<VisibilityProps> = ({ children, className = '' }) => {
  const isDesktop = useIsDesktop();
  if (isDesktop) return null;
  return <div className={className}>{children}</div>;
};

// ============================================================================
// Exports
// ============================================================================

export default ResponsiveContainer;
