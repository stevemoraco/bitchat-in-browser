/**
 * Sheet Renderer
 *
 * Renders the appropriate content based on the current sheet type.
 * This component maps navigation store sheet types to actual components.
 */

import { h, type FunctionComponent } from 'preact';
import { useNavigationStore, SheetState, type SheetType } from '../../stores/navigation-store';
import { Sheet } from '../ui/Sheet';
import { MeshDebugPanel } from '../mesh/MeshDebugPanel';

// Lazy-load sheet contents to reduce initial bundle
// These will be replaced with actual imports once components exist
const SheetContents: Record<SheetType, FunctionComponent<{ props?: Record<string, unknown> }>> = {
  'channels': ({ props }) => (
    <div class="p-4">
      <div class="text-gray-400 mb-4">Select a channel to join</div>
      {/* ChannelList component will go here */}
      <div class="space-y-2">
        <div class="p-3 bg-gray-800 rounded-lg">Global</div>
        <div class="p-3 bg-gray-800 rounded-lg">Local (9q8y)</div>
        <div class="p-3 bg-gray-800 rounded-lg">Nearby (9q8)</div>
      </div>
    </div>
  ),

  'channel-detail': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Channel Details</div>
      <pre class="text-xs text-gray-500 mt-2">{JSON.stringify(props, null, 2)}</pre>
    </div>
  ),

  'peers': ({ props }) => (
    <div class="p-4">
      <div class="text-gray-400 mb-4">People in this channel</div>
      {/* PeerList component will go here */}
      <div class="space-y-2">
        <div class="p-3 bg-gray-800 rounded-lg flex items-center gap-3">
          <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white">A</div>
          <div>
            <div class="text-white">alice</div>
            <div class="text-xs text-gray-500">Connected via Nostr</div>
          </div>
        </div>
      </div>
    </div>
  ),

  'peer-detail': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Peer Details</div>
      <pre class="text-xs text-gray-500 mt-2">{JSON.stringify(props, null, 2)}</pre>
    </div>
  ),

  'settings': ({ props }) => (
    <SettingsSheet />
  ),

  'settings-identity': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Identity Settings</div>
      {/* IdentitySettings component will go here */}
    </div>
  ),

  'settings-privacy': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Privacy Settings</div>
      {/* PrivacySettings component will go here */}
    </div>
  ),

  'settings-network': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Network Settings</div>
      {/* NetworkSettings component will go here */}
    </div>
  ),

  'settings-storage': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Storage Settings</div>
      {/* StorageSettings component will go here */}
    </div>
  ),

  'settings-about': ({ props }) => (
    <div class="p-4">
      <div class="text-white">About BitChat</div>
      <div class="text-gray-400 mt-2">Version 1.0.0</div>
    </div>
  ),

  'mesh-join': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Join Mesh Network</div>
      {/* JoinMeshModal content will go here */}
    </div>
  ),

  'mesh-status': ({ props }) => (
    <MeshDebugPanel />
  ),

  'key-import': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Import Nostr Key</div>
      {/* KeyImport component will go here */}
    </div>
  ),

  'share-app': ({ props }) => (
    <div class="p-4">
      <div class="text-white">Share BitChat</div>
      {/* ShareApp component will go here */}
    </div>
  ),

  'custom': ({ props }) => (
    <div class="p-4">
      {props?.content || 'Custom content'}
    </div>
  ),
};

// Settings sheet with navigation to sub-settings
const SettingsSheet: FunctionComponent = () => {
  const { openSheet } = useNavigationStore();

  const settingsItems = [
    { label: 'Identity', icon: 'user', action: () => openSheet('settings-identity') },
    { label: 'Privacy', icon: 'lock', action: () => openSheet('settings-privacy') },
    { label: 'Network', icon: 'wifi', action: () => openSheet('settings-network') },
    { label: 'Storage', icon: 'database', action: () => openSheet('settings-storage') },
    { label: 'About', icon: 'info', action: () => openSheet('settings-about') },
  ];

  // Icon components (avoiding emojis per guidelines)
  const getIcon = (icon: string) => {
    switch (icon) {
      case 'user':
        return (
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'lock':
        return (
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      case 'wifi':
        return (
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        );
      case 'database':
        return (
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        );
      case 'info':
        return (
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div class="p-4 space-y-2">
      {settingsItems.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          class="w-full p-4 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center gap-3 transition-colors"
        >
          <span class="text-gray-400">{getIcon(item.icon)}</span>
          <span class="text-white">{item.label}</span>
          <span class="ml-auto text-gray-500">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </button>
      ))}
    </div>
  );
};

/**
 * Renders the current sheet stack
 */
export const SheetRenderer: FunctionComponent = () => {
  const sheets = useNavigationStore((state) => state.sheets);
  const closeSheet = useNavigationStore((state) => state.closeSheet);

  return (
    <>
      {sheets.map((sheet, index) => {
        const Content = SheetContents[sheet.type];

        return (
          <Sheet
            key={sheet.id}
            isOpen
            onClose={closeSheet}
            title={sheet.title}
            height={sheet.height}
          >
            <Content props={sheet.props} />
          </Sheet>
        );
      })}
    </>
  );
};

export default SheetRenderer;
