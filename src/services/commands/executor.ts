/**
 * Command Executor - Execute parsed commands
 *
 * Handles command execution with proper context,
 * confirmation dialogs, and error handling.
 */

import { parseCommand, formatParseError } from './parser';
import { getCommand } from './index';
import type { CommandResult, CommandContext, Command } from './index';

// ============================================================================
// Types
// ============================================================================

/**
 * Execution options
 */
export interface ExecutionOptions {
  /** Custom confirmation handler */
  onConfirm?: (message: string) => Promise<boolean>;
  /** System message handler */
  onSystemMessage?: (content: string) => void;
  /** Custom context values */
  context?: Partial<CommandContext>;
  /** Stop batch execution on first error */
  stopOnError?: boolean;
}

/**
 * Command history entry
 */
export interface HistoryEntry {
  /** Timestamp of execution */
  timestamp: number;
  /** Raw command string */
  command: string;
  /** Parsed command name */
  name: string;
  /** Whether execution was successful */
  success: boolean;
  /** Result output */
  output?: string | string[];
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// History Management
// ============================================================================

const MAX_HISTORY_SIZE = 100;
let commandHistory: HistoryEntry[] = [];

// Load history from localStorage
function loadHistory(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    const stored = localStorage.getItem('bitchat-command-history');
    if (stored) {
      commandHistory = JSON.parse(stored);
    }
  } catch {
    commandHistory = [];
  }
}

// Save history to localStorage
function saveHistory(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem('bitchat-command-history', JSON.stringify(commandHistory));
  } catch {
    // Ignore storage errors
  }
}

// Initialize history on load
loadHistory();

/**
 * Add a command to history
 */
function addToHistory(entry: HistoryEntry): void {
  commandHistory.push(entry);

  // Trim to max size
  if (commandHistory.length > MAX_HISTORY_SIZE) {
    commandHistory = commandHistory.slice(-MAX_HISTORY_SIZE);
  }

  saveHistory();
}

/**
 * Get command history
 */
export function getCommandHistory(): HistoryEntry[] {
  return [...commandHistory];
}

/**
 * Get recent command strings (for history navigation)
 */
export function getRecentCommands(limit: number = 50): string[] {
  return commandHistory
    .slice(-limit)
    .map((h) => h.command)
    .reverse();
}

/**
 * Get unique recent commands (no duplicates)
 */
export function getUniqueRecentCommands(limit: number = 20): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (let i = commandHistory.length - 1; i >= 0 && result.length < limit; i--) {
    const entry = commandHistory[i];
    if (entry) {
      const cmd = entry.command;
      if (!seen.has(cmd)) {
        seen.add(cmd);
        result.push(cmd);
      }
    }
  }

  return result;
}

/**
 * Clear command history
 */
export function clearCommandHistory(): void {
  commandHistory = [];
  saveHistory();
}

// ============================================================================
// Context Creation
// ============================================================================

/**
 * Create default command context
 */
async function createDefaultContext(
  options: ExecutionOptions = {}
): Promise<CommandContext> {
  // Import stores dynamically
  const { useIdentityStore } = await import('../../stores/identity-store');
  const { useChannelsStore } = await import('../../stores/channels-store');

  const identity = useIdentityStore.getState().identity;
  const activeChannelId = useChannelsStore.getState().activeChannelId;

  return {
    publicKey: identity?.publicKey ?? null,
    fingerprint: identity?.fingerprint ?? null,
    activeChannelId,
    confirm: options.onConfirm || defaultConfirm,
    addSystemMessage: options.onSystemMessage || defaultSystemMessage,
    ...options.context,
  };
}

/**
 * Default confirmation handler using browser confirm
 */
async function defaultConfirm(message: string): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.confirm(message);
}

/**
 * Default system message handler (console log)
 */
function defaultSystemMessage(content: string): void {
  console.log('[System]', content);
}

// ============================================================================
// Executor
// ============================================================================

/**
 * Execute a command string
 */
export async function executeCommand(
  input: string,
  options: ExecutionOptions = {}
): Promise<CommandResult> {
  const parsed = parseCommand(input);

  // Not a command, treat as regular message
  if (!parsed.isCommand) {
    return {
      success: false,
      output: [],
      error: 'Not a command',
    };
  }

  // Unknown command
  if (!parsed.command) {
    const result: CommandResult = {
      success: false,
      output: [],
      error: formatParseError(parsed) || `Unknown command: /${parsed.name}`,
    };

    // Add to history even if failed
    addToHistory({
      timestamp: Date.now(),
      command: input,
      name: parsed.name,
      success: false,
      error: result.error,
    });

    return result;
  }

  // Validation errors
  if (!parsed.isValid) {
    const result: CommandResult = {
      success: false,
      output: [],
      error: formatParseError(parsed),
    };

    addToHistory({
      timestamp: Date.now(),
      command: input,
      name: parsed.name,
      success: false,
      error: result.error,
    });

    return result;
  }

  // Create execution context
  const context = await createDefaultContext(options);

  // Execute the command
  try {
    const result = await parsed.command.execute(parsed.args, context);

    // Add to history
    addToHistory({
      timestamp: Date.now(),
      command: input,
      name: parsed.name,
      success: result.success,
      output: result.output,
      error: result.error,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const result: CommandResult = {
      success: false,
      output: [],
      error: `Command failed: ${errorMessage}`,
    };

    addToHistory({
      timestamp: Date.now(),
      command: input,
      name: parsed.name,
      success: false,
      error: result.error,
    });

    return result;
  }
}

/**
 * Execute a command by name with arguments
 */
export async function executeCommandByName(
  name: string,
  args: string[] = [],
  options: ExecutionOptions = {}
): Promise<CommandResult> {
  const command = getCommand(name);

  if (!command) {
    return {
      success: false,
      output: [],
      error: `Unknown command: ${name}`,
    };
  }

  const context = await createDefaultContext(options);

  try {
    return await command.execute(args, context);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      output: [],
      error: `Command failed: ${errorMessage}`,
    };
  }
}

/**
 * Format command result for terminal display
 */
export function formatResult(result: CommandResult): string[] {
  const lines: string[] = [];

  // Format output
  if (result.output) {
    if (Array.isArray(result.output)) {
      lines.push(...result.output);
    } else {
      lines.push(result.output);
    }
  }

  // Format error
  if (result.error) {
    lines.push(`Error: ${result.error}`);
  }

  return lines;
}

/**
 * Format result as terminal-style output with prefix
 */
export function formatTerminalOutput(result: CommandResult): string[] {
  const lines = formatResult(result);

  if (lines.length === 0) {
    return [];
  }

  // Add prefix based on success/failure
  const prefix = result.success ? '' : '[!] ';

  return lines.map((line, index) => {
    // Only prefix the first line if there's an error
    if (!result.success && index === 0 && result.error) {
      return `${prefix}${line}`;
    }
    return line;
  });
}

/**
 * Validate a command without executing it
 */
export function validateCommand(input: string): {
  isValid: boolean;
  command?: Command;
  errors: string[];
} {
  const parsed = parseCommand(input);

  return {
    isValid: parsed.isValid,
    command: parsed.command,
    errors: parsed.errors,
  };
}

/**
 * Check if a string would trigger a command
 */
export function wouldExecuteCommand(input: string): boolean {
  return parseCommand(input).isCommand;
}

/**
 * Get command from input string (for preview purposes)
 */
export function getCommandFromInput(input: string): Command | undefined {
  const parsed = parseCommand(input);
  return parsed.command;
}

// ============================================================================
// Batch Execution
// ============================================================================

/**
 * Execute multiple commands in sequence
 */
export async function executeCommands(
  inputs: string[],
  options: ExecutionOptions = {}
): Promise<CommandResult[]> {
  const results: CommandResult[] = [];

  for (const input of inputs) {
    const result = await executeCommand(input, options);
    results.push(result);

    // Stop on first failure if desired
    if (!result.success && options.stopOnError) {
      break;
    }
  }

  return results;
}

// ============================================================================
// Command Suggestions
// ============================================================================

/**
 * Get contextual command suggestions based on current state
 */
export async function getContextualSuggestions(): Promise<Command[]> {
  const { useIdentityStore } = await import('../../stores/identity-store');
  const { useChannelsStore } = await import('../../stores/channels-store');

  const hasIdentity = useIdentityStore.getState().identity !== null;
  const hasActiveChannel = useChannelsStore.getState().activeChannelId !== null;

  const { getAllCommands } = await import('./index');
  let commands = getAllCommands();

  // Filter based on context
  if (!hasIdentity) {
    // Suggest identity-related commands first
    commands = commands.sort((a, b) => {
      if (a.category === 'identity' && b.category !== 'identity') return -1;
      if (b.category === 'identity' && a.category !== 'identity') return 1;
      return 0;
    });
  }

  if (!hasActiveChannel) {
    // Suggest channel-related commands first
    commands = commands.sort((a, b) => {
      if (a.category === 'channels' && b.category !== 'channels') return -1;
      if (b.category === 'channels' && a.category !== 'channels') return 1;
      return 0;
    });
  }

  return commands;
}
