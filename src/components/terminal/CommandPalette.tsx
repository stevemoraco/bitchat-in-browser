/**
 * CommandPalette - Full-screen command palette (Cmd+K style)
 *
 * Features:
 * - Keyboard shortcut activation (Cmd+K / Ctrl+K)
 * - Search and filter commands
 * - Recent commands section
 * - Categorized command display
 * - Quick execution
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import {
  getCommandsByCategory,
  searchCommands,
  type Command,
  type CommandCategory,
} from '../../services/commands';
import { getUniqueRecentCommands, executeCommand, formatTerminalOutput } from '../../services/commands/executor';

// ============================================================================
// Types
// ============================================================================

export interface CommandPaletteProps {
  /** Whether the palette is open */
  isOpen: boolean;
  /** Called when palette should close */
  onClose: () => void;
  /** Called when a command is executed */
  onCommandExecute?: (command: string, output: string[]) => void;
  /** Called when output should be displayed */
  onOutput?: (lines: string[], isError: boolean) => void;
}

interface GroupedCommands {
  category: CommandCategory;
  label: string;
  commands: Command[];
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  general: 'General',
  identity: 'Identity',
  channels: 'Channels',
  messaging: 'Messaging',
  connection: 'Connection',
  system: 'System',
};

const CATEGORY_ORDER: CommandCategory[] = [
  'general',
  'identity',
  'channels',
  'messaging',
  'connection',
  'system',
];

// ============================================================================
// Component
// ============================================================================

export const CommandPalette: FunctionComponent<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onCommandExecute,
  onOutput,
}) => {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showRecent, setShowRecent] = useState(true);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Get recent commands
  const recentCommands = useMemo(() => getUniqueRecentCommands(5), [isOpen]); // Refresh when opened

  // Filter and group commands based on search query
  const { filteredCommands, flatList } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (query.length === 0) {
      // Show all commands grouped by category
      const grouped: GroupedCommands[] = CATEGORY_ORDER.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        commands: getCommandsByCategory(category),
      })).filter((g) => g.commands.length > 0);

      const flat = grouped.flatMap((g) => g.commands);

      return { filteredCommands: grouped, flatList: flat };
    }

    // Search commands
    const matches = searchCommands(query);

    // Group results by category
    const grouped: GroupedCommands[] = CATEGORY_ORDER.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      commands: matches.filter((cmd) => cmd.category === category),
    })).filter((g) => g.commands.length > 0);

    const flat = grouped.flatMap((g) => g.commands);

    return { filteredCommands: grouped, flatList: flat };
  }, [searchQuery]);

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setShowRecent(true);

      // Focus input after animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Navigate with arrow keys
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatList.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatList.length - 1
        );
        return;
      }

      // Execute on Enter
      if (e.key === 'Enter') {
        e.preventDefault();
        const selected = flatList[selectedIndex];
        if (selected) {
          await executeSelectedCommand(selected);
        }
        return;
      }
    },
    [flatList, selectedIndex, onClose]
  );

  // Execute selected command
  const executeSelectedCommand = useCallback(
    async (command: Command) => {
      setIsExecuting(true);

      try {
        // Execute with just the command name (user can add args later)
        const result = await executeCommand(`/${command.name}`, {
          onConfirm: async (message) => window.confirm(message),
        });

        const outputLines = formatTerminalOutput(result);

        onCommandExecute?.(`/${command.name}`, outputLines);
        onOutput?.(outputLines, !result.success);

        // Close palette on success
        if (result.success) {
          onClose();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Command failed';
        onOutput?.([`Error: ${errorMessage}`], true);
      } finally {
        setIsExecuting(false);
      }
    },
    [onCommandExecute, onOutput, onClose]
  );

  // Handle command click
  const handleCommandClick = useCallback(
    async (command: Command) => {
      await executeSelectedCommand(command);
    },
    [executeSelectedCommand]
  );

  // Handle recent command click
  const handleRecentClick = useCallback(
    async (commandString: string) => {
      setIsExecuting(true);

      try {
        const result = await executeCommand(commandString, {
          onConfirm: async (message) => window.confirm(message),
        });

        const outputLines = formatTerminalOutput(result);

        onCommandExecute?.(commandString, outputLines);
        onOutput?.(outputLines, !result.success);

        if (result.success) {
          onClose();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Command failed';
        onOutput?.([`Error: ${errorMessage}`], true);
      } finally {
        setIsExecuting(false);
      }
    },
    [onCommandExecute, onOutput, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector('[data-selected="true"]');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Palette container */}
      <div
        class="relative w-full max-w-xl mx-4 bg-terminal-bg border border-terminal-green/40 rounded-lg shadow-2xl overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div class="flex items-center gap-3 px-4 py-3 border-b border-terminal-green/20">
          <span class="text-terminal-green/60 font-mono">/</span>
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            placeholder="Search commands..."
            class="flex-1 bg-transparent border-0 outline-none text-terminal-green font-mono placeholder-terminal-green/40"
            disabled={isExecuting}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellcheck={false}
          />
          {isExecuting && (
            <span class="text-terminal-green/60 animate-pulse font-mono">
              ...
            </span>
          )}
          <kbd class="hidden sm:inline px-2 py-0.5 text-xs text-terminal-green/50 bg-terminal-green/10 rounded font-mono">
            esc
          </kbd>
        </div>

        {/* Recent commands */}
        {showRecent && searchQuery === '' && recentCommands.length > 0 && (
          <div class="border-b border-terminal-green/20">
            <div class="px-4 py-2 text-xs text-terminal-green/50 font-mono uppercase tracking-wider">
              Recent
            </div>
            <div class="pb-2">
              {recentCommands.map((cmd, index) => (
                <button
                  key={`recent-${index}`}
                  type="button"
                  class="w-full px-4 py-2 text-left font-mono text-sm text-terminal-green/70 hover:bg-terminal-green/10 hover:text-terminal-green transition-colors"
                  onClick={() => handleRecentClick(cmd)}
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Command list */}
        <div
          ref={listRef}
          class="max-h-[50vh] overflow-y-auto"
          role="listbox"
        >
          {filteredCommands.map((group) => (
            <div key={group.category}>
              {/* Category header */}
              <div class="px-4 py-2 text-xs text-terminal-green/50 font-mono uppercase tracking-wider sticky top-0 bg-terminal-bg/95 backdrop-blur-sm">
                {group.label}
              </div>

              {/* Commands in category */}
              {group.commands.map((command) => {
                const globalIndex = flatList.indexOf(command);
                const isSelected = globalIndex === selectedIndex;

                return (
                  <button
                    key={command.name}
                    type="button"
                    class={`w-full px-4 py-2.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-terminal-green/20 text-terminal-green'
                        : 'text-terminal-green/80 hover:bg-terminal-green/10'
                    }`}
                    onClick={() => handleCommandClick(command)}
                    onMouseEnter={() => setSelectedIndex(globalIndex)}
                    data-selected={isSelected}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div class="min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-mono font-medium">
                            /{command.name}
                          </span>
                          {command.aliases && command.aliases.length > 0 && (
                            <span class="text-xs text-terminal-green/40 font-mono">
                              ({command.aliases.join(', ')})
                            </span>
                          )}
                          {command.isDestructive && (
                            <span class="text-terminal-red text-xs">!</span>
                          )}
                        </div>
                        <div class="text-sm text-terminal-green/60 mt-0.5 truncate">
                          {command.description}
                        </div>
                      </div>

                      {/* Usage hint */}
                      <div class="hidden sm:block text-xs text-terminal-green/40 font-mono shrink-0">
                        {command.usage.replace(/^\/\w+\s*/, '')}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}

          {/* No results */}
          {flatList.length === 0 && (
            <div class="px-4 py-8 text-center text-terminal-green/50 font-mono">
              No commands found for "{searchQuery}"
            </div>
          )}
        </div>

        {/* Footer with hints */}
        <div class="px-4 py-2 border-t border-terminal-green/20 flex items-center justify-between text-xs text-terminal-green/40 font-mono">
          <div class="flex items-center gap-4">
            <span>
              <kbd class="px-1 py-0.5 bg-terminal-green/10 rounded">
                {'\u2191'}
              </kbd>
              <kbd class="px-1 py-0.5 bg-terminal-green/10 rounded ml-0.5">
                {'\u2193'}
              </kbd>
              <span class="ml-1">navigate</span>
            </span>
            <span>
              <kbd class="px-1 py-0.5 bg-terminal-green/10 rounded">
                {'\u21B5'}
              </kbd>
              <span class="ml-1">execute</span>
            </span>
          </div>
          <span>{flatList.length} commands</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Global Keyboard Handler Hook
// ============================================================================

/**
 * Hook to manage command palette keyboard shortcut
 */
export function useCommandPalette(): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      // Cmd+/ or Ctrl+/ as alternative
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
}

// ============================================================================
// Standalone Command Palette Button
// ============================================================================

export const CommandPaletteButton: FunctionComponent<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className = '' }) => (
    <button
      type="button"
      onClick={onClick}
      class={`flex items-center gap-2 px-3 py-1.5 text-sm text-terminal-green/70 bg-terminal-green/5 border border-terminal-green/20 rounded hover:bg-terminal-green/10 hover:text-terminal-green transition-colors font-mono ${className}`}
      title="Open command palette (Cmd+K)"
    >
      <span>/</span>
      <span class="hidden sm:inline">Commands</span>
      <kbd class="hidden sm:inline px-1.5 py-0.5 text-xs bg-terminal-green/10 rounded">
        {'\u2318'}K
      </kbd>
    </button>
  );

export default CommandPalette;
