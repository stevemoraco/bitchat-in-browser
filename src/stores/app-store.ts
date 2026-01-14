/**
 * App Store - Global application state management
 *
 * Manages core app state including:
 * - Online/offline status
 * - Initialization state
 * - Current view/navigation
 * - Global error handling
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AppState, AppActions, ViewType } from './types';

const APP_VERSION = '1.0.0';

interface AppStore extends AppState, AppActions {}

const initialState: AppState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  isInitialized: false,
  currentView: 'channels',
  error: null,
  isBackground: false,
  version: APP_VERSION,
};

export const useAppStore = create<AppStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      /**
       * Set online/offline status
       */
      setOnline: (isOnline: boolean) => {
        set({ isOnline }, false, 'setOnline');
      },

      /**
       * Set initialization status
       */
      setInitialized: (isInitialized: boolean) => {
        set({ isInitialized }, false, 'setInitialized');
      },

      /**
       * Navigate to a view
       */
      setView: (view: ViewType) => {
        const { isInitialized, currentView } = get();

        // Don't allow navigation away from onboarding until initialized
        if (!isInitialized && view !== 'onboarding') {
          console.warn('Cannot navigate before initialization complete');
          return;
        }

        // Only update if view is different
        if (currentView !== view) {
          set({ currentView: view }, false, 'setView');
        }
      },

      /**
       * Set global error message
       */
      setError: (error: string | null) => {
        set({ error }, false, 'setError');

        // Auto-clear errors after 10 seconds
        if (error !== null) {
          setTimeout(() => {
            const currentError = get().error;
            if (currentError === error) {
              set({ error: null }, false, 'clearError');
            }
          }, 10000);
        }
      },

      /**
       * Set background state (when app is in background)
       */
      setBackground: (isBackground: boolean) => {
        set({ isBackground }, false, 'setBackground');
      },

      /**
       * Reset app state to initial values
       */
      reset: () => {
        set(initialState, false, 'reset');
      },
    }),
    {
      name: 'bitchat-app-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

export const selectIsOnline = (state: AppStore) => state.isOnline;
export const selectIsInitialized = (state: AppStore) => state.isInitialized;
export const selectCurrentView = (state: AppStore) => state.currentView;
export const selectError = (state: AppStore) => state.error;
export const selectIsBackground = (state: AppStore) => state.isBackground;
export const selectVersion = (state: AppStore) => state.version;

// ============================================================================
// Hooks for common patterns
// ============================================================================

/**
 * Hook to check if app is ready for use
 */
export const useIsAppReady = () => useAppStore((state) => state.isInitialized && !state.error);

/**
 * Hook to get connection status info
 */
export const useConnectionStatus = () => useAppStore((state) => ({
    isOnline: state.isOnline,
    isBackground: state.isBackground,
  }));

// ============================================================================
// Initialize network listeners
// ============================================================================

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useAppStore.getState().setOnline(true);
  });

  window.addEventListener('offline', () => {
    useAppStore.getState().setOnline(false);
  });

  document.addEventListener('visibilitychange', () => {
    useAppStore.getState().setBackground(document.hidden);
  });
}
