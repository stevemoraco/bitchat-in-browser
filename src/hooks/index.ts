/**
 * Custom Hooks
 *
 * Central export for all custom React hooks.
 *
 * @module hooks
 */

export {
  useEmergencyWipe,
  useSimpleEmergencyWipe,
  type UseEmergencyWipeOptions,
  type UseEmergencyWipeReturn,
  type WipeState,
} from './useEmergencyWipe';

export {
  useNotifications,
  useNotificationPermission,
  useNotificationSupport,
  useNotificationBadge,
  type UseNotificationsOptions,
  type UseNotificationsReturn,
} from './useNotifications';

export {
  useServiceWorker,
  useUpdateAvailable,
  useUpdateStatus,
  useAppVersion,
  type ServiceWorkerState,
  type ServiceWorkerActions,
  type UseServiceWorkerOptions,
  type UseServiceWorkerReturn,
} from './useServiceWorker';

export {
  useInstallPrompt,
  useIsInstalled,
  usePlatform,
  useCanInstall,
  type InstallState,
  type UseInstallPromptReturn,
  type Platform,
} from './useInstallPrompt';

export {
  useApp,
  useAppInit,
  useAppConnection,
  useAppReady,
  useOnlineStatus,
  useRelayCount,
  useWebRTCPeerCount,
  type InitState,
  type ConnectionState,
  type AppState,
  type AppActions,
  type UseAppReturn,
} from './useApp';

export {
  useFocusTrap,
  useRovingTabIndex,
  useKeyboardNavigation,
  useFocusOnMount,
  useFocusReturn,
  usePrefersReducedMotion,
  usePrefersHighContrast,
  useScreenReaderAnnounce,
  ariaLabels,
  getFocusableElements,
  isFocusable,
  focusFirst,
  focusLast,
  getActiveElement,
  type UseFocusTrapOptions,
  type UseFocusTrapReturn,
  type UseRovingTabIndexOptions,
  type UseKeyboardNavigationOptions,
  type NavigationDirection,
} from './useA11y';

export {
  useLoading,
  useMultiLoading,
  useAsyncOperation,
  useDelayedLoading,
  type LoadingState,
  type UseLoadingOptions,
  type UseLoadingReturn,
  type MultiLoadingState,
  type UseMultiLoadingReturn,
  type AsyncOperationState,
  type UseAsyncOperationOptions,
  type UseAsyncOperationReturn,
  type UseDelayedLoadingOptions,
} from './useLoading';

export {
  useError,
  useToasts,
  useAsyncError,
  useGlobalErrors,
  useNetworkError,
  useErrorBoundaryReset,
  type ErrorState,
  type ErrorActions,
  type UseErrorReturn,
  type UseErrorOptions,
  type ToastState,
  type ToastActions,
  type UseToastsReturn,
  type UseAsyncErrorOptions,
  type UseAsyncErrorReturn,
} from './useError';

export {
  // Core media query hook
  useMediaQuery,
  // Device type hooks
  useIsMobile,
  useIsTablet,
  useIsDesktop,
  useIsSmallMobile,
  useIsLargeDesktop,
  useDeviceType,
  // Orientation hooks
  useIsPortrait,
  useIsLandscape,
  useOrientation,
  // Touch detection
  useIsTouchDevice,
  useCanHover,
  // Accessibility preferences
  usePrefersReducedMotion as useMediaPrefersReducedMotion,
  usePrefersDarkMode,
  usePrefersHighContrast as useMediaPrefersHighContrast,
  // Safe area
  useSafeAreaInsets,
  // Viewport
  useViewportSize,
  // Breakpoints
  useBreakpoint,
  useBelowBreakpoint,
  useBetweenBreakpoints,
  // Combined state
  useResponsive,
  // Layout helpers
  useNavigationLayout,
  useModalLayout,
  useChatLayout,
  // Keyboard detection
  useIsKeyboardOpen,
  // Constants
  BREAKPOINTS,
  QUERIES,
  // Types
  type DeviceType,
  type Orientation,
  type SafeAreaInsets,
  type ResponsiveState,
} from './useMediaQuery';

export {
  // Swipe gestures
  useSwipeGesture,
  useSwipeBack,
  // Pull to refresh
  usePullToRefresh,
  // Long press
  useLongPress,
  useContextMenu,
  // Double tap
  useDoubleTap,
  // Types
  type SwipeState,
  type SwipeDirection,
  type SwipeOptions,
  type SwipeCallbacks,
  type PullToRefreshState,
  type PullToRefreshOptions,
  type LongPressState,
  type LongPressOptions,
  type ContextMenuPosition,
  type ContextMenuState,
} from './useTouchGestures';

export {
  useNavigation,
  useRouteParams,
  useQueryParams,
  useCurrentRoute,
  useRouteMatch,
  useDeepLink,
  useNavigationListener,
  useNavLink,
  type NavigationActions,
  type RouteInfo,
  type UseNavigationReturn,
  type UseRouteParamsReturn,
  type UseQueryParamsReturn,
  type CurrentRoute,
  type UseDeepLinkReturn,
  type NavLinkProps,
} from './useNavigation';
