/**
 * CommandInput - Terminal-style command input with autocomplete
 *
 * Features:
 * - Command prefix detection (/)
 * - Autocomplete dropdown for commands
 * - Command history navigation (up/down arrows)
 * - Execute on Enter
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import {
  getCommandSuggestions,
  getAllCommands,
  type Command,
} from '../../services/commands';
import {
  isCommandString,
  extractPartialCommand,
  parseCommand,
} from '../../services/commands/parser';
import {
  executeCommand,
  getUniqueRecentCommands,
  formatTerminalOutput,
} from '../../services/commands/executor';

// ============================================================================
// Types
// ============================================================================

export interface CommandInputProps {
  /** Placeholder text */
  placeholder?: string;
  /** Called when a command executes */
  onCommandExecute?: (command: string, output: string[]) => void;
  /** Called when user sends a regular message (not a command) */
  onMessage?: (message: string) => void;
  /** Called when command results should be displayed */
  onOutput?: (lines: string[], isError: boolean) => void;
  /** Additional class names */
  className?: string;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Auto focus on mount */
  autoFocus?: boolean;
}

interface SuggestionItem {
  command: Command;
  highlighted: string;
}

// ============================================================================
// Component
// ============================================================================

export const CommandInput: FunctionComponent<CommandInputProps> = ({
  placeholder = 'Type a message or /command...',
  onCommandExecute,
  onMessage,
  onOutput,
  className = '',
  disabled = false,
  autoFocus = true,
}) => {
  // State
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Command history
  const commandHistory = useMemo(() => getUniqueRecentCommands(50), []);

  // Focus input on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Update suggestions when value changes
  useEffect(() => {
    if (!isCommandString(value)) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const partial = extractPartialCommand(value);
    const matches = getCommandSuggestions(partial);

    // Create highlighted suggestions
    const items: SuggestionItem[] = matches.map((cmd) => ({
      command: cmd,
      highlighted: highlightMatch(cmd.name, partial),
    }));

    setSuggestions(items);
    setShowSuggestions(items.length > 0 && partial.length > 0);
    setSelectedIndex(0);
  }, [value]);

  // Highlight matching portion of command name
  const highlightMatch = useCallback((name: string, partial: string): string => {
    if (partial.length === 0) return name;

    const lowerName = name.toLowerCase();
    const lowerPartial = partial.toLowerCase();
    const index = lowerName.indexOf(lowerPartial);

    if (index === -1) return name;

    return (
      name.slice(0, index) +
      `<mark>${name.slice(index, index + partial.length)}</mark>` +
      name.slice(index + partial.length)
    );
  }, []);

  // Handle input change
  const handleChange = useCallback((e: Event) => {
    const target = e.target as HTMLInputElement;
    setValue(target.value);
    setHistoryIndex(-1);
  }, []);

  // Handle key down events
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      // Tab completion
      if (e.key === 'Tab' && showSuggestions && suggestions.length > 0) {
        e.preventDefault();
        const selected = suggestions[selectedIndex];
        if (selected) {
          setValue(`/${selected.command.name} `);
          setShowSuggestions(false);
        }
        return;
      }

      // Navigate suggestions with arrow keys
      if (showSuggestions && suggestions.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0
          );
          return;
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1
          );
          return;
        }
      }

      // History navigation (when not showing suggestions)
      if (!showSuggestions && isCommandString(value) || value === '') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (commandHistory.length > 0) {
            const newIndex =
              historyIndex < commandHistory.length - 1
                ? historyIndex + 1
                : historyIndex;
            setHistoryIndex(newIndex);
            if (newIndex >= 0 && commandHistory[newIndex]) {
              setValue(commandHistory[newIndex] ?? '');
            }
          }
          return;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setValue(commandHistory[newIndex] ?? '');
          } else if (historyIndex === 0) {
            setHistoryIndex(-1);
            setValue('');
          }
          return;
        }
      }

      // Escape to close suggestions
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        setHistoryIndex(-1);
        return;
      }

      // Enter to execute
      if (e.key === 'Enter') {
        e.preventDefault();

        // If showing suggestions, select current suggestion
        if (showSuggestions && suggestions.length > 0) {
          const selected = suggestions[selectedIndex];
          if (selected) {
            setValue(`/${selected.command.name} `);
            setShowSuggestions(false);
            return;
          }
        }

        // Execute command or send message
        await handleSubmit();
      }
    },
    [
      value,
      showSuggestions,
      suggestions,
      selectedIndex,
      historyIndex,
      commandHistory,
    ]
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    const trimmedValue = value.trim();

    if (trimmedValue.length === 0) {
      return;
    }

    // Check if it's a command
    if (isCommandString(trimmedValue)) {
      setIsExecuting(true);

      try {
        const result = await executeCommand(trimmedValue, {
          onConfirm: async (message) => {
            return window.confirm(message);
          },
        });

        const outputLines = formatTerminalOutput(result);

        // Notify parent
        onCommandExecute?.(trimmedValue, outputLines);
        onOutput?.(outputLines, !result.success);

        // Clear input on success
        setValue('');
        setHistoryIndex(-1);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Command failed';
        onOutput?.([`Error: ${errorMessage}`], true);
      } finally {
        setIsExecuting(false);
      }
    } else {
      // Regular message
      onMessage?.(trimmedValue);
      setValue('');
      setHistoryIndex(-1);
    }

    setShowSuggestions(false);
  }, [value, onCommandExecute, onMessage, onOutput]);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (command: Command) => {
      setValue(`/${command.name} `);
      setShowSuggestions(false);
      inputRef.current?.focus();
    },
    []
  );

  // Scroll selected suggestion into view
  useEffect(() => {
    if (suggestionsRef.current && showSuggestions) {
      const selected = suggestionsRef.current.querySelector(
        '[data-selected="true"]'
      );
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showSuggestions]);

  // Get validation state for current input
  const validation = useMemo(() => {
    if (!isCommandString(value)) {
      return { isCommand: false, isValid: true, error: null };
    }

    const parsed = parseCommand(value);
    return {
      isCommand: true,
      isValid: parsed.isValid || !parsed.name,
      error: parsed.errors[0] || null,
    };
  }, [value]);

  // Determine input styling based on state
  const inputClasses = useMemo(() => {
    const baseClasses =
      'w-full bg-transparent border-0 outline-none text-terminal-green font-mono placeholder-terminal-green/40';
    const stateClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
    const errorClasses =
      validation.isCommand && !validation.isValid && value.length > 1
        ? 'text-terminal-red'
        : '';

    return `${baseClasses} ${stateClasses} ${errorClasses}`.trim();
  }, [disabled, validation, value]);

  return (
    <div class={`relative ${className}`}>
      {/* Input container */}
      <div class="flex items-center gap-2 bg-terminal-bg border border-terminal-green/30 rounded px-3 py-2 focus-within:border-terminal-green/60 transition-colors">
        {/* Prompt */}
        <span class="text-terminal-green/60 font-mono select-none">{'>'}</span>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onInput={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isExecuting}
          class={inputClasses}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellcheck={false}
          aria-label="Command input"
          aria-describedby={showSuggestions ? 'command-suggestions' : undefined}
          aria-expanded={showSuggestions}
          role="combobox"
        />

        {/* Loading indicator */}
        {isExecuting && (
          <span class="text-terminal-green/60 animate-pulse">...</span>
        )}
      </div>

      {/* Autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          id="command-suggestions"
          class="absolute bottom-full left-0 right-0 mb-1 max-h-64 overflow-y-auto bg-terminal-bg border border-terminal-green/30 rounded shadow-lg z-50"
          role="listbox"
        >
          {suggestions.map((item, index) => (
            <button
              key={item.command.name}
              type="button"
              class={`w-full px-3 py-2 text-left font-mono text-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-terminal-green/20 text-terminal-green'
                  : 'text-terminal-green/80 hover:bg-terminal-green/10'
              }`}
              onClick={() => handleSuggestionClick(item.command)}
              onMouseEnter={() => setSelectedIndex(index)}
              data-selected={index === selectedIndex}
              role="option"
              aria-selected={index === selectedIndex}
            >
              <div class="flex justify-between items-start">
                <div>
                  <span
                    class="text-terminal-green"
                    dangerouslySetInnerHTML={{ __html: `/${item.highlighted}` }}
                  />
                  {item.command.aliases && item.command.aliases.length > 0 && (
                    <span class="text-terminal-green/40 ml-2 text-xs">
                      ({item.command.aliases.join(', ')})
                    </span>
                  )}
                </div>
                {item.command.isDestructive && (
                  <span class="text-terminal-red text-xs">!</span>
                )}
              </div>
              <div class="text-terminal-green/50 text-xs mt-0.5 truncate">
                {item.command.description}
              </div>
            </button>
          ))}

          {/* Keyboard hint */}
          <div class="px-3 py-1.5 text-xs text-terminal-green/40 border-t border-terminal-green/20 font-mono">
            <span class="mr-3">Tab: complete</span>
            <span class="mr-3">Up/Down: navigate</span>
            <span>Enter: select</span>
          </div>
        </div>
      )}

      {/* Error hint */}
      {validation.isCommand && !validation.isValid && validation.error && (
        <div class="absolute left-0 right-0 mt-1 px-3 py-1 text-xs text-terminal-red font-mono">
          {validation.error}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Additional Components
// ============================================================================

/**
 * Simple command list for help display
 */
export const CommandList: FunctionComponent<{
  className?: string;
  onCommandSelect?: (command: Command) => void;
}> = ({ className = '', onCommandSelect }) => {
  const commands = getAllCommands();

  return (
    <div class={`font-mono text-sm ${className}`}>
      {commands.map((cmd) => (
        <button
          key={cmd.name}
          type="button"
          class="w-full px-2 py-1 text-left text-terminal-green/80 hover:bg-terminal-green/10 hover:text-terminal-green rounded transition-colors"
          onClick={() => onCommandSelect?.(cmd)}
        >
          <span class="text-terminal-green">/{cmd.name}</span>
          <span class="text-terminal-green/50 ml-2">{cmd.description}</span>
        </button>
      ))}
    </div>
  );
};

/**
 * Command history display
 */
export const CommandHistory: FunctionComponent<{
  className?: string;
  limit?: number;
  onCommandSelect?: (command: string) => void;
}> = ({ className = '', limit = 20, onCommandSelect }) => {
  const history = getUniqueRecentCommands(limit);

  if (history.length === 0) {
    return (
      <div class={`font-mono text-sm text-terminal-green/50 ${className}`}>
        No command history
      </div>
    );
  }

  return (
    <div class={`font-mono text-sm ${className}`}>
      {history.map((cmd, index) => (
        <button
          key={`${cmd}-${index}`}
          type="button"
          class="w-full px-2 py-1 text-left text-terminal-green/70 hover:bg-terminal-green/10 hover:text-terminal-green rounded transition-colors truncate"
          onClick={() => onCommandSelect?.(cmd)}
        >
          {cmd}
        </button>
      ))}
    </div>
  );
};

export default CommandInput;
