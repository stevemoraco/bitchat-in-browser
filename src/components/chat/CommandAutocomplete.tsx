/**
 * CommandAutocomplete - Handles autocomplete for / commands
 *
 * Supported Commands:
 * - /me <action> - Send an action message (e.g., "/me waves")
 * - /nick <name> - Change your nickname
 * - /join <channel> - Join a channel
 * - /leave - Leave current channel
 * - /clear - Clear message history
 * - /help - Show help message
 * - /mesh - Show mesh status/info
 */

import type { FunctionComponent } from 'preact';
import { useMemo } from 'preact/hooks';
import { AutocompletePopup, type AutocompleteItem } from './AutocompletePopup';

// ============================================================================
// Types
// ============================================================================

export interface Command {
  /** Command name (without /) */
  name: string;
  /** Description of what the command does */
  description: string;
  /** Usage example */
  usage: string;
  /** Whether the command requires an argument */
  requiresArg: boolean;
  /** Argument placeholder (if applicable) */
  argPlaceholder?: string;
}

export interface CommandAutocompleteProps {
  /** Current input text (everything after /) */
  query: string;
  /** Currently selected index */
  selectedIndex: number;
  /** Callback when a command is selected */
  onSelect: (command: Command) => void;
  /** Callback when selection index changes */
  onIndexChange: (index: number) => void;
  /** Callback to dismiss the popup */
  onDismiss: () => void;
  /** Whether the popup is visible */
  isVisible: boolean;
}

// ============================================================================
// Command Definitions
// ============================================================================

export const COMMANDS: Command[] = [
  {
    name: 'me',
    description: 'Send an action message',
    usage: '/me <action>',
    requiresArg: true,
    argPlaceholder: 'waves hello',
  },
  {
    name: 'nick',
    description: 'Change your nickname',
    usage: '/nick <name>',
    requiresArg: true,
    argPlaceholder: 'newname',
  },
  {
    name: 'join',
    description: 'Join a channel',
    usage: '/join <channel>',
    requiresArg: true,
    argPlaceholder: 'general',
  },
  {
    name: 'leave',
    description: 'Leave the current channel',
    usage: '/leave',
    requiresArg: false,
  },
  {
    name: 'clear',
    description: 'Clear message history',
    usage: '/clear',
    requiresArg: false,
  },
  {
    name: 'help',
    description: 'Show available commands',
    usage: '/help',
    requiresArg: false,
  },
  {
    name: 'mesh',
    description: 'Show mesh network status',
    usage: '/mesh',
    requiresArg: false,
  },
];

// ============================================================================
// Icons
// ============================================================================

const CommandIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M6.672 1.911a1 1 0 10-1.932.518l.259.966a1 1 0 001.932-.518l-.26-.966zM2.429 4.74a1 1 0 10-.517 1.932l.966.259a1 1 0 00.517-1.932l-.966-.26zm8.814-.569a1 1 0 00-1.415-1.414l-.707.707a1 1 0 101.414 1.415l.708-.708zm-7.071 7.072l.707-.707A1 1 0 003.465 9.12l-.708.707a1 1 0 001.415 1.415zm3.2-5.171a1 1 0 00-1.3 1.3l4 10a1 1 0 001.823.075l1.38-2.759 3.018 3.02a1 1 0 001.414-1.415l-3.019-3.02 2.76-1.379a1 1 0 00-.076-1.822l-10-4z"
      clip-rule="evenodd"
    />
  </svg>
);

// ============================================================================
// Component
// ============================================================================

export const CommandAutocomplete: FunctionComponent<CommandAutocompleteProps> = ({
  query,
  selectedIndex,
  onSelect,
  onIndexChange,
  onDismiss,
  isVisible,
}) => {
  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    const lowerQuery = query.toLowerCase().trim();

    if (!lowerQuery) {
      // Show all commands if no query
      return COMMANDS;
    }

    return COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().startsWith(lowerQuery) ||
        cmd.description.toLowerCase().includes(lowerQuery)
    );
  }, [query]);

  // Convert commands to autocomplete items
  const items: AutocompleteItem[] = useMemo(() => filteredCommands.map((cmd) => ({
      id: cmd.name,
      label: `/${cmd.name}`,
      description: cmd.description,
      icon: <CommandIcon class="w-4 h-4" />,
      data: cmd,
    })), [filteredCommands]);

  // Handle selection
  const handleSelect = (item: AutocompleteItem) => {
    const command = item.data as Command;
    onSelect(command);
  };

  return (
    <AutocompletePopup
      items={items}
      selectedIndex={selectedIndex}
      onSelect={handleSelect}
      onIndexChange={onIndexChange}
      onDismiss={onDismiss}
      isVisible={isVisible}
      title="Commands"
      emptyMessage="No matching commands"
    />
  );
};

// ============================================================================
// Utilities
// ============================================================================

/**
 * Check if input starts with a command prefix
 */
export function isCommandInput(input: string): boolean {
  return input.startsWith('/') && !input.startsWith('//');
}

/**
 * Extract the command query from input
 * Returns the text after / and before any space
 */
export function extractCommandQuery(input: string): string {
  if (!input.startsWith('/')) return '';
  const afterSlash = input.slice(1);
  const spaceIndex = afterSlash.indexOf(' ');
  return spaceIndex === -1 ? afterSlash : afterSlash.slice(0, spaceIndex);
}

/**
 * Check if a complete command is entered (command name followed by space or is complete)
 */
export function isCommandComplete(input: string): boolean {
  if (!input.startsWith('/')) return false;
  const afterSlash = input.slice(1);
  const spaceIndex = afterSlash.indexOf(' ');

  if (spaceIndex === -1) {
    // No space - check if it matches a command exactly
    const cmdName = afterSlash.toLowerCase();
    return COMMANDS.some((cmd) => cmd.name === cmdName);
  }

  // Has space - check if command name matches
  const cmdName = afterSlash.slice(0, spaceIndex).toLowerCase();
  return COMMANDS.some((cmd) => cmd.name === cmdName);
}

/**
 * Find a command by name
 */
export function findCommand(name: string): Command | undefined {
  return COMMANDS.find((cmd) => cmd.name.toLowerCase() === name.toLowerCase());
}

export default CommandAutocomplete;
