/**
 * Navigation Store
 *
 * Manages sheet-based navigation state.
 * Replaces traditional page routing with iOS-style sheet modals.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// Available sheet types
export type SheetType =
  | 'channels'
  | 'channel-detail'
  | 'peers'
  | 'peer-detail'
  | 'settings'
  | 'settings-identity'
  | 'settings-privacy'
  | 'settings-network'
  | 'settings-storage'
  | 'settings-about'
  | 'mesh-join'
  | 'mesh-status'
  | 'key-import'
  | 'share-app'
  | 'custom';

export type SheetHeight = 'half' | 'full' | 'auto';

export interface SheetState {
  type: SheetType;
  title?: string;
  height?: SheetHeight;
  props?: Record<string, unknown>;
  id: string;
}

export interface NavigationState {
  // Sheet stack
  sheets: SheetState[];

  // Quick access to current state
  currentSheet: SheetState | null;
  isAnySheetOpen: boolean;

  // Actions
  openSheet: (type: SheetType, options?: {
    title?: string;
    height?: SheetHeight;
    props?: Record<string, unknown>;
  }) => void;

  closeSheet: () => void;
  closeAllSheets: () => void;
  replaceSheet: (type: SheetType, options?: {
    title?: string;
    height?: SheetHeight;
    props?: Record<string, unknown>;
  }) => void;

  // Convenience methods
  openChannels: () => void;
  openPeers: () => void;
  openSettings: () => void;
  openMeshJoin: () => void;
  openKeyImport: () => void;
  openShareApp: () => void;

  // Settings sub-sheets
  openSettingsIdentity: () => void;
  openSettingsPrivacy: () => void;
  openSettingsNetwork: () => void;
  openSettingsStorage: () => void;
  openSettingsAbout: () => void;

  // Navigation helpers
  goBack: () => void;
  canGoBack: () => boolean;
}

// Generate unique ID for each sheet
let sheetIdCounter = 0;
const generateSheetId = () => `sheet-${++sheetIdCounter}-${Date.now()}`;

// Default heights for each sheet type
const DEFAULT_HEIGHTS: Record<SheetType, SheetHeight> = {
  'channels': 'half',
  'channel-detail': 'full',
  'peers': 'half',
  'peer-detail': 'full',
  'settings': 'full',
  'settings-identity': 'full',
  'settings-privacy': 'full',
  'settings-network': 'full',
  'settings-storage': 'full',
  'settings-about': 'full',
  'mesh-join': 'full',
  'mesh-status': 'half',
  'key-import': 'full',
  'share-app': 'full',
  'custom': 'half',
};

// Default titles for each sheet type
const DEFAULT_TITLES: Record<SheetType, string> = {
  'channels': 'Channels',
  'channel-detail': 'Channel',
  'peers': 'People',
  'peer-detail': 'Person',
  'settings': 'Settings',
  'settings-identity': 'Identity',
  'settings-privacy': 'Privacy',
  'settings-network': 'Network',
  'settings-storage': 'Storage',
  'settings-about': 'About',
  'mesh-join': 'Join Mesh',
  'mesh-status': 'Mesh Status',
  'key-import': 'Import Key',
  'share-app': 'Share App',
  'custom': '',
};

export const useNavigationStore = create<NavigationState>()(
  devtools(
    (set, get) => ({
      sheets: [],

      get currentSheet() {
        const sheets = get().sheets;
        return sheets.length > 0 ? sheets[sheets.length - 1] : null;
      },

      get isAnySheetOpen() {
        return get().sheets.length > 0;
      },

      openSheet: (type, options = {}) => {
        const newSheet: SheetState = {
          type,
          id: generateSheetId(),
          title: options.title ?? DEFAULT_TITLES[type],
          height: options.height ?? DEFAULT_HEIGHTS[type],
          props: options.props,
        };

        set((state) => ({
          sheets: [...state.sheets, newSheet],
        }), false, 'openSheet');
      },

      closeSheet: () => {
        set((state) => ({
          sheets: state.sheets.slice(0, -1),
        }), false, 'closeSheet');
      },

      closeAllSheets: () => {
        set({ sheets: [] }, false, 'closeAllSheets');
      },

      replaceSheet: (type, options = {}) => {
        const newSheet: SheetState = {
          type,
          id: generateSheetId(),
          title: options.title ?? DEFAULT_TITLES[type],
          height: options.height ?? DEFAULT_HEIGHTS[type],
          props: options.props,
        };

        set((state) => ({
          sheets: state.sheets.length > 0
            ? [...state.sheets.slice(0, -1), newSheet]
            : [newSheet],
        }), false, 'replaceSheet');
      },

      // Convenience methods
      openChannels: () => get().openSheet('channels'),
      openPeers: () => get().openSheet('peers'),
      openSettings: () => get().openSheet('settings'),
      openMeshJoin: () => get().openSheet('mesh-join'),
      openKeyImport: () => get().openSheet('key-import'),
      openShareApp: () => get().openSheet('share-app'),

      // Settings sub-sheets
      openSettingsIdentity: () => get().openSheet('settings-identity'),
      openSettingsPrivacy: () => get().openSheet('settings-privacy'),
      openSettingsNetwork: () => get().openSheet('settings-network'),
      openSettingsStorage: () => get().openSheet('settings-storage'),
      openSettingsAbout: () => get().openSheet('settings-about'),

      // Navigation helpers
      goBack: () => get().closeSheet(),

      canGoBack: () => get().sheets.length > 0,
    }),
    {
      name: 'bitchat-navigation-store',
      enabled: process.env.NODE_ENV !== 'production',
    }
  )
);

// === Selector Hooks ===

export const useCurrentSheet = () => useNavigationStore((state) =>
  state.sheets.length > 0 ? state.sheets[state.sheets.length - 1] : null
);

export const useIsSheetOpen = (type: SheetType) => useNavigationStore((state) =>
  state.sheets.some(s => s.type === type)
);

export const useSheetStack = () => useNavigationStore((state) => state.sheets);

export const useNavigationActions = () => useNavigationStore((state) => ({
  openSheet: state.openSheet,
  closeSheet: state.closeSheet,
  closeAllSheets: state.closeAllSheets,
  replaceSheet: state.replaceSheet,
  goBack: state.goBack,
}));

// === Standalone Selectors (for use outside React) ===

export const getNavigationState = () => useNavigationStore.getState();
export const isAnySheetOpen = () => useNavigationStore.getState().sheets.length > 0;
export const getCurrentSheetType = () => {
  const sheets = useNavigationStore.getState().sheets;
  return sheets.length > 0 ? sheets[sheets.length - 1].type : null;
};

export default useNavigationStore;
