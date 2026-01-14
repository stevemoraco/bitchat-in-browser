/**
 * Storage Settings Component
 *
 * Manages local data storage:
 * - Storage usage display
 * - Clear message history
 * - Export all data
 * - Import data
 *
 * @module components/settings/StorageSettings
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import { getStorageManager, type StorageHealth } from '../../services/storage';

// ============================================================================
// Types
// ============================================================================

interface ExportState {
  status: 'idle' | 'exporting' | 'success' | 'error';
  error?: string;
}

interface ImportState {
  status: 'idle' | 'selecting' | 'importing' | 'success' | 'error';
  error?: string;
  stats?: {
    imported: number;
    skipped: number;
  };
}

interface ClearState {
  status: 'idle' | 'confirming' | 'clearing' | 'success' | 'error';
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

export const StorageSettings: FunctionComponent = () => {
  // Storage health state
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);

  // Action states
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [importState, setImportState] = useState<ImportState>({ status: 'idle' });
  const [clearMessagesState, setClearMessagesState] = useState<ClearState>({
    status: 'idle',
  });

  // Load storage health
  const loadHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const storage = getStorageManager();
      await storage.initialize();
      const healthData = await storage.getHealth();
      setHealth(healthData);
    } catch (error) {
      console.error('Failed to load storage health:', error);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // Format bytes for display - used for raw byte display when needed
  const _formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  };
  void _formatBytes; // Suppress unused warning - available for future use

  // Export all data
  const handleExport = useCallback(async () => {
    setExportState({ status: 'exporting' });

    try {
      const storage = getStorageManager();
      await storage.initialize();
      const result = await storage.exportData();

      // Create downloadable file
      const blob = new Blob([JSON.stringify(result, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bitchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportState({ status: 'success' });
      setTimeout(() => setExportState({ status: 'idle' }), 2000);
    } catch (error) {
      setExportState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Export failed',
      });
    }
  }, []);

  // Import data
  const handleImportSelect = useCallback(() => {
    setImportState({ status: 'selecting' });

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        setImportState({ status: 'idle' });
        return;
      }

      setImportState({ status: 'importing' });

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Validate it's a backup file
        if (!data.data || typeof data.data !== 'object') {
          throw new Error('Invalid backup file format');
        }

        const storage = getStorageManager();
        await storage.initialize();
        const result = await storage.importData(data.data, {
          clearExisting: false,
          overwriteExisting: true,
        });

        if (result.success) {
          const totalImported = Object.values(result.imported).reduce(
            (a, b) => a + b,
            0
          );
          const totalSkipped = Object.values(result.skipped).reduce(
            (a, b) => a + b,
            0
          );

          setImportState({
            status: 'success',
            stats: { imported: totalImported, skipped: totalSkipped },
          });
          loadHealth(); // Refresh storage stats
        } else {
          throw new Error(result.errors.join(', '));
        }

        setTimeout(() => setImportState({ status: 'idle' }), 3000);
      } catch (error) {
        setImportState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Import failed',
        });
      }
    };

    input.click();
  }, [loadHealth]);

  // Clear message history
  const handleClearMessages = useCallback(async () => {
    if (clearMessagesState.status === 'idle') {
      setClearMessagesState({ status: 'confirming' });
      return;
    }

    if (clearMessagesState.status === 'confirming') {
      setClearMessagesState({ status: 'clearing' });

      try {
        const storage = getStorageManager();
        await storage.initialize();
        await storage.clear('messages');
        setClearMessagesState({ status: 'success' });
        loadHealth();
        setTimeout(() => setClearMessagesState({ status: 'idle' }), 2000);
      } catch (error) {
        setClearMessagesState({
          status: 'error',
          error: error instanceof Error ? error.message : 'Clear failed',
        });
      }
    }
  }, [clearMessagesState.status, loadHealth]);

  // Request persistent storage
  const handleRequestPersistence = useCallback(async () => {
    try {
      const storage = getStorageManager();
      const granted = await storage.requestPersistentStorage();
      if (granted) {
        loadHealth();
      }
    } catch (error) {
      console.error('Failed to request persistence:', error);
    }
  }, [loadHealth]);

  // Get usage bar color based on percentage
  const getUsageColor = (percent: number): string => {
    if (percent < 50) return 'bg-terminal-green';
    if (percent < 80) return 'bg-terminal-yellow';
    return 'bg-terminal-red';
  };

  return (
    <div class="space-y-6">
      {/* Storage Usage */}
      <div class="p-4 border border-terminal-green/30">
        <h4 class="text-sm font-bold mb-3">&gt; Storage Usage</h4>

        {isLoadingHealth ? (
          <div class="text-terminal-green/50">Loading storage info...</div>
        ) : health ? (
          <div class="space-y-4">
            {/* Usage Bar */}
            <div>
              <div class="flex justify-between text-sm mb-1">
                <span class="text-terminal-green/70">Used</span>
                <span class="text-terminal-green">{health.usageFormatted}</span>
              </div>
              <div class="h-4 bg-terminal-green/10 border border-terminal-green/30">
                <div
                  class={`h-full ${getUsageColor(health.usagePercent)} transition-all`}
                  style={{ width: `${Math.min(health.usagePercent, 100)}%` }}
                />
              </div>
              <div class="text-xs text-terminal-green/50 mt-1">
                {health.usagePercent}% of available storage
              </div>
            </div>

            {/* Storage Details */}
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-terminal-green/60">Backend:</span>
                <span class="ml-2 text-terminal-green uppercase">
                  {health.backendType}
                </span>
              </div>
              <div>
                <span class="text-terminal-green/60">Status:</span>
                <span
                  class={`ml-2 ${
                    health.isHealthy ? 'text-terminal-green' : 'text-terminal-red'
                  }`}
                >
                  {health.isHealthy ? '[Healthy]' : '[Warning]'}
                </span>
              </div>
              <div class="col-span-2">
                <span class="text-terminal-green/60">Persistence:</span>
                <span
                  class={`ml-2 ${
                    health.isPersistent
                      ? 'text-terminal-green'
                      : 'text-terminal-yellow'
                  }`}
                >
                  {health.isPersistent ? '[Persistent]' : '[Not Persistent]'}
                </span>
                {!health.isPersistent && (
                  <button
                    onClick={handleRequestPersistence}
                    class="ml-2 text-xs text-terminal-blue underline"
                  >
                    Request Persistence
                  </button>
                )}
              </div>
            </div>

            {health.error && (
              <div class="text-terminal-red text-sm">[!] {health.error}</div>
            )}
          </div>
        ) : (
          <div class="text-terminal-red">Failed to load storage info</div>
        )}

        <button
          onClick={loadHealth}
          class="mt-4 text-xs text-terminal-green/50 hover:text-terminal-green"
        >
          Refresh
        </button>
      </div>

      {/* Data Management Actions */}
      <div class="space-y-3">
        {/* Export Data */}
        <div class="p-4 border border-terminal-green/30">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <span class="font-bold text-terminal-green">Export All Data</span>
              <p class="text-xs text-terminal-green/60 mt-1">
                Download a JSON backup of all your messages, channels, and settings.
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exportState.status === 'exporting'}
              class="btn-terminal text-sm"
            >
              {exportState.status === 'exporting'
                ? 'Exporting...'
                : exportState.status === 'success'
                  ? '[Done!]'
                  : 'Export'}
            </button>
          </div>
          {exportState.status === 'error' && (
            <div class="text-terminal-red text-xs mt-2">
              [!] {exportState.error}
            </div>
          )}
        </div>

        {/* Import Data */}
        <div class="p-4 border border-terminal-green/30">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <span class="font-bold text-terminal-green">Import Data</span>
              <p class="text-xs text-terminal-green/60 mt-1">
                Restore from a previously exported JSON backup file.
              </p>
            </div>
            <button
              onClick={handleImportSelect}
              disabled={importState.status === 'importing'}
              class="btn-terminal text-sm"
            >
              {importState.status === 'importing'
                ? 'Importing...'
                : importState.status === 'success'
                  ? '[Done!]'
                  : 'Import'}
            </button>
          </div>
          {importState.status === 'success' && importState.stats && (
            <div class="text-terminal-green text-xs mt-2">
              Imported: {importState.stats.imported} records, Skipped:{' '}
              {importState.stats.skipped}
            </div>
          )}
          {importState.status === 'error' && (
            <div class="text-terminal-red text-xs mt-2">
              [!] {importState.error}
            </div>
          )}
        </div>

        {/* Clear Message History */}
        <div
          class={`p-4 border ${
            clearMessagesState.status === 'confirming'
              ? 'border-terminal-yellow/50 bg-terminal-yellow/5'
              : 'border-terminal-green/30'
          }`}
        >
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <span class="font-bold text-terminal-green">
                Clear Message History
              </span>
              <p class="text-xs text-terminal-green/60 mt-1">
                Delete all locally stored messages. Your identity and settings
                will be preserved.
              </p>
            </div>
            {clearMessagesState.status === 'confirming' ? (
              <div class="flex gap-2">
                <button
                  onClick={() => setClearMessagesState({ status: 'idle' })}
                  class="btn-terminal text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearMessages}
                  class="px-4 py-2 border border-terminal-yellow text-terminal-yellow hover:bg-terminal-yellow hover:text-terminal-bg text-sm transition-colors"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button
                onClick={handleClearMessages}
                disabled={clearMessagesState.status === 'clearing'}
                class="btn-terminal text-sm"
              >
                {clearMessagesState.status === 'clearing'
                  ? 'Clearing...'
                  : clearMessagesState.status === 'success'
                    ? '[Cleared!]'
                    : 'Clear'}
              </button>
            )}
          </div>
          {clearMessagesState.status === 'confirming' && (
            <div class="text-terminal-yellow text-xs mt-2">
              [!] This will delete all local messages. This cannot be undone.
            </div>
          )}
          {clearMessagesState.status === 'error' && (
            <div class="text-terminal-red text-xs mt-2">
              [!] {clearMessagesState.error}
            </div>
          )}
        </div>
      </div>

      {/* Storage Info */}
      <div class="p-3 border border-terminal-green/10 text-xs text-terminal-green/50">
        <p class="mb-2">
          <strong>About Storage:</strong>
        </p>
        <ul class="space-y-1">
          <li>
            - BitChat uses OPFS (Origin Private File System) when available, with
            IndexedDB as fallback
          </li>
          <li>
            - Persistent storage helps prevent data loss when the browser needs to
            free up space
          </li>
          <li>
            - Regular exports are recommended as an additional backup measure
          </li>
          <li>- Messages are stored locally only and not backed up to servers</li>
        </ul>
      </div>
    </div>
  );
};

export default StorageSettings;
