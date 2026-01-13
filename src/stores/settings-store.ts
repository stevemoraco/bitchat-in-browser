/**
 * Settings Store - User preferences management
 *
 * Manages user settings with localStorage persistence:
 * - User nickname
 * - Theme preferences
 * - Notification settings
 * - Display preferences
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type {
  Settings,
  SettingsActions,
  Theme,
  NotificationLevel,
} from './types';

// ============================================================================
// Re-export default settings
// ============================================================================

export { DEFAULT_SETTINGS } from './types';

// ============================================================================
// Types
// ============================================================================

interface SettingsState {
  settings: Settings;
}

interface SettingsStore extends SettingsState, SettingsActions {}

// ============================================================================
// Initial State
// ============================================================================

const defaultSettings: Settings = {
  nickname: '',
  theme: 'dark',
  notifications: 'all',
  showTimestamps: true,
  showMessageStatus: true,
  soundEnabled: true,
  autoJoinLocation: true,
  locationPrecision: 6,
  compactMode: false,
  fontSize: 'medium',
  devMode: false,
  onboardingComplete: false,
};

const initialState: SettingsState = {
  settings: defaultSettings,
};

// ============================================================================
// Store
// ============================================================================

export const useSettingsStore = create<SettingsStore>()(
  devtools(
    persist(
      (set, _get) => ({
        ...initialState,

        /**
         * Update multiple settings at once
         */
        updateSettings: (updates: Partial<Settings>) => {
          set(
            (state) => ({
              settings: {
                ...state.settings,
                ...updates,
              },
            }),
            false,
            'updateSettings'
          );
        },

        /**
         * Set user nickname
         */
        setNickname: (nickname: string) => {
          // Validate nickname
          const cleaned = nickname.trim().slice(0, 32);
          set(
            (state) => ({
              settings: {
                ...state.settings,
                nickname: cleaned,
              },
            }),
            false,
            'setNickname'
          );
        },

        /**
         * Set theme preference
         */
        setTheme: (theme: Theme) => {
          set(
            (state) => ({
              settings: {
                ...state.settings,
                theme,
              },
            }),
            false,
            'setTheme'
          );

          // Apply theme to document
          applyTheme(theme);
        },

        /**
         * Set notification level
         */
        setNotifications: (level: NotificationLevel) => {
          set(
            (state) => ({
              settings: {
                ...state.settings,
                notifications: level,
              },
            }),
            false,
            'setNotifications'
          );
        },

        /**
         * Reset all settings to defaults
         */
        resetSettings: () => {
          set({ settings: defaultSettings }, false, 'resetSettings');
          applyTheme(defaultSettings.theme);
        },
      }),
      {
        name: 'bitchat-settings',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          settings: state.settings,
        }),
        onRehydrateStorage: () => (state) => {
          // Apply theme on rehydration
          if (state?.settings?.theme) {
            applyTheme(state.settings.theme);
          }
        },
      }
    ),
    {
      name: 'bitchat-settings-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// ============================================================================
// Theme Utilities
// ============================================================================

/**
 * Apply theme to document
 */
function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

/**
 * Get the effective theme (resolving 'system' to actual value)
 */
export function getEffectiveTheme(): 'dark' | 'light' {
  const theme = useSettingsStore.getState().settings.theme;

  if (theme === 'system') {
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  return theme;
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Get all settings
 */
export const selectSettings = (state: SettingsStore) => state.settings;

/**
 * Get nickname
 */
export const selectNickname = (state: SettingsStore) => state.settings.nickname;

/**
 * Get theme
 */
export const selectTheme = (state: SettingsStore) => state.settings.theme;

/**
 * Get notification level
 */
export const selectNotifications = (state: SettingsStore) =>
  state.settings.notifications;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get all settings
 */
export const useSettings = (): Settings => {
  return useSettingsStore((state) => state.settings);
};

/**
 * Hook to get nickname
 */
export const useNickname = (): string => {
  return useSettingsStore((state) => state.settings.nickname);
};

/**
 * Hook to get theme
 */
export const useTheme = (): Theme => {
  return useSettingsStore((state) => state.settings.theme);
};

/**
 * Hook to get effective theme (dark or light)
 */
export const useEffectiveTheme = (): 'dark' | 'light' => {
  const theme = useSettingsStore((state) => state.settings.theme);

  if (theme === 'system') {
    // This won't react to system theme changes, but that's acceptable
    // for most use cases. A more complex solution would use useSyncExternalStore
    if (typeof window === 'undefined') return 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  return theme;
};

/**
 * Hook to get notification level
 */
export const useNotificationLevel = (): NotificationLevel => {
  return useSettingsStore((state) => state.settings.notifications);
};

/**
 * Hook to check if notifications are enabled for a type
 */
export const useCanNotify = (isMention: boolean = false): boolean => {
  return useSettingsStore((state) => {
    const level = state.settings.notifications;
    if (level === 'none') return false;
    if (level === 'all') return true;
    return isMention; // 'mentions' level - only notify for mentions
  });
};

/**
 * Hook to check if sound is enabled
 */
export const useSoundEnabled = (): boolean => {
  return useSettingsStore((state) => state.settings.soundEnabled);
};

/**
 * Hook to get font size class
 */
export const useFontSizeClass = (): string => {
  return useSettingsStore((state) => {
    switch (state.settings.fontSize) {
      case 'small':
        return 'text-sm';
      case 'large':
        return 'text-lg';
      default:
        return 'text-base';
    }
  });
};

/**
 * Hook to check if compact mode is enabled
 */
export const useCompactMode = (): boolean => {
  return useSettingsStore((state) => state.settings.compactMode);
};

/**
 * Hook to check if dev mode is enabled
 */
export const useDevMode = (): boolean => {
  return useSettingsStore((state) => state.settings.devMode);
};

/**
 * Hook to check if onboarding is complete
 */
export const useOnboardingComplete = (): boolean => {
  return useSettingsStore((state) => state.settings.onboardingComplete);
};

// ============================================================================
// Initialize system theme listener
// ============================================================================

if (typeof window !== 'undefined') {
  // Listen for system theme changes
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  mediaQuery.addEventListener('change', () => {
    const theme = useSettingsStore.getState().settings.theme;
    if (theme === 'system') {
      applyTheme('system');
    }
  });

  // Apply initial theme (after store hydration)
  setTimeout(() => {
    const theme = useSettingsStore.getState().settings.theme;
    applyTheme(theme);
  }, 0);
}
