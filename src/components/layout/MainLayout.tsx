/**
 * Main Layout
 *
 * The root layout component that wraps the app with:
 * - Sheet navigation system
 * - Main chat view (always visible behind sheets)
 * - Header and input components
 */

import { h, type FunctionComponent, type ComponentChildren } from 'preact';
import { SheetRenderer } from './SheetRenderer';
import { useNavigationStore } from '../../stores/navigation-store';
import { useMeshStore } from '../../stores/mesh-store';

interface MainLayoutProps {
  children: ComponentChildren;
}

export const MainLayout: FunctionComponent<MainLayoutProps> = ({ children }) => {
  const isAnySheetOpen = useNavigationStore((state) => state.sheets.length > 0);

  return (
    <div class="h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Main content (chat view) - always rendered */}
      <div class={`flex-1 flex flex-col overflow-hidden ${isAnySheetOpen ? 'pointer-events-none' : ''}`}>
        {children}
      </div>

      {/* Sheet stack overlay */}
      <SheetRenderer />
    </div>
  );
};

/**
 * Header component with sheet triggers
 */
export const AppHeader: FunctionComponent = () => {
  const { openChannels, openPeers, openSettings } = useNavigationStore();
  const meshStatus = useMeshStore((state) => state.status);
  const peerCount = useMeshStore((state) => state.peers.length);

  // Mesh status indicator color
  const statusColor = {
    'connected': 'bg-green-500',
    'connecting': 'bg-yellow-500',
    'discovering': 'bg-blue-500',
    'disconnected': 'bg-gray-500',
  }[meshStatus] || 'bg-gray-500';

  return (
    <header class="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
      {/* Left: Menu */}
      <button
        class="p-2 hover:bg-gray-800 rounded"
        onClick={openSettings}
        aria-label="Open settings"
      >
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Center: Channel selector */}
      <button
        onClick={openChannels}
        class="flex items-center gap-2 px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors"
        aria-label="Select channel"
      >
        <span class="text-sm font-medium">Global</span>
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Right: Peers and mesh status */}
      <div class="flex items-center gap-2">
        <button
          onClick={openPeers}
          class="flex items-center gap-1 px-2 py-1 hover:bg-gray-800 rounded transition-colors"
          aria-label={`View ${peerCount} peers`}
        >
          <span class="text-sm">{peerCount}</span>
          <svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </button>

        <div class={`w-2 h-2 rounded-full ${statusColor}`} title={`Mesh: ${meshStatus}`} />

        <button
          onClick={openSettings}
          class="p-2 hover:bg-gray-800 rounded"
          aria-label="Open settings"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default MainLayout;
