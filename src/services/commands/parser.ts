/**
 * Command Parser - Parse terminal command strings
 *
 * Extracts command name, arguments, and validates input.
 * Supports quoted arguments and escape sequences.
 */

import { getCommand } from './index';
import type { Command, CommandArg } from './index';

// ============================================================================
// Types
// ============================================================================

/**
 * Parsed command structure
 */
export interface ParsedCommand {
  /** Whether this is a valid command */
  isCommand: boolean;
  /** Raw input string */
  raw: string;
  /** Command name (without /) */
  name: string;
  /** Parsed arguments */
  args: string[];
  /** Matching command definition */
  command?: Command;
  /** Validation errors */
  errors: string[];
  /** Whether the command is complete and valid */
  isValid: boolean;
}

/**
 * Parse result for argument validation
 */
export interface ArgValidation {
  isValid: boolean;
  value: string | number | boolean;
  error?: string;
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Check if a string starts with a command prefix
 */
export function isCommandString(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * Parse a command string into structured components
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  const result: ParsedCommand = {
    isCommand: false,
    raw: input,
    name: '',
    args: [],
    errors: [],
    isValid: false,
  };

  // Check if it's a command
  if (!trimmed.startsWith('/')) {
    return result;
  }

  result.isCommand = true;

  // Remove leading slash
  const withoutSlash = trimmed.slice(1);

  // Handle empty command
  if (withoutSlash.length === 0) {
    result.errors.push('Empty command');
    return result;
  }

  // Parse command and arguments
  const parts = parseArguments(withoutSlash);

  if (parts.length === 0) {
    result.errors.push('Failed to parse command');
    return result;
  }

  // First part is the command name
  result.name = (parts[0] ?? '').toLowerCase();
  result.args = parts.slice(1);

  // Look up the command
  result.command = getCommand(result.name);

  if (!result.command) {
    result.errors.push(`Unknown command: /${result.name}`);
    return result;
  }

  // Validate arguments
  const argErrors = validateArguments(result.args, result.command.args || []);
  result.errors.push(...argErrors);

  result.isValid = result.errors.length === 0;

  return result;
}

/**
 * Parse arguments from a string, respecting quotes
 */
export function parseArguments(input: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  let escapeNext = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === undefined) continue;

    // Handle escape sequences
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    // Backslash escapes the next character
    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    // Handle quotes
    if ((char === '"' || char === "'") && !inQuote) {
      inQuote = true;
      quoteChar = char;
      continue;
    }

    if (char === quoteChar && inQuote) {
      inQuote = false;
      quoteChar = '';
      continue;
    }

    // Handle whitespace (argument separator)
    if (!inQuote && /\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }

    // Regular character
    current += char;
  }

  // Add remaining content
  if (current.length > 0) {
    args.push(current);
  }

  // Handle unclosed quote
  if (inQuote) {
    // Treat the quote as a literal character
    args[args.length - 1] = args[args.length - 1] || '';
  }

  return args;
}

/**
 * Validate arguments against command definition
 */
export function validateArguments(
  args: string[],
  definitions: CommandArg[]
): string[] {
  const errors: string[] = [];

  // Check required arguments
  const requiredArgs = definitions.filter((d) => d.required);

  for (let i = 0; i < requiredArgs.length; i++) {
    const reqArg = requiredArgs[i];
    if (reqArg && (args.length <= i || args[i] === undefined || args[i] === '')) {
      errors.push(`Missing required argument: ${reqArg.name}`);
    }
  }

  // Validate provided arguments
  for (let i = 0; i < args.length && i < definitions.length; i++) {
    const arg = args[i];
    const def = definitions[i];
    if (!arg || !def) continue;
    const validation = validateArg(arg, def);

    if (!validation.isValid && validation.error) {
      errors.push(validation.error);
    }
  }

  return errors;
}

/**
 * Validate a single argument
 */
export function validateArg(value: string, definition: CommandArg): ArgValidation {
  // Check pattern if defined
  if (definition.pattern) {
    const regex = new RegExp(definition.pattern);
    if (!regex.test(value)) {
      return {
        isValid: false,
        value,
        error: `Invalid ${definition.name}: does not match expected format`,
      };
    }
  }

  // Check choices if defined
  if (definition.choices && definition.choices.length > 0) {
    if (!definition.choices.includes(value.toLowerCase())) {
      return {
        isValid: false,
        value,
        error: `Invalid ${definition.name}: must be one of ${definition.choices.join(', ')}`,
      };
    }
  }

  // Type coercion and validation
  switch (definition.type) {
    case 'number': {
      const num = parseFloat(value);
      if (isNaN(num)) {
        return {
          isValid: false,
          value,
          error: `${definition.name} must be a number`,
        };
      }
      return { isValid: true, value: num };
    }

    case 'boolean': {
      const lower = value.toLowerCase();
      if (!['true', 'false', 'yes', 'no', '1', '0', 'on', 'off'].includes(lower)) {
        return {
          isValid: false,
          value,
          error: `${definition.name} must be true/false, yes/no, or on/off`,
        };
      }
      const bool = ['true', 'yes', '1', 'on'].includes(lower);
      return { isValid: true, value: bool };
    }

    case 'string':
    default:
      return { isValid: true, value };
  }
}

/**
 * Get help text for a command
 */
export function getCommandHelp(command: Command): string[] {
  const lines: string[] = [
    `/${command.name}`,
    '',
    command.description,
    '',
    `Usage: ${command.usage}`,
  ];

  if (command.aliases?.length) {
    lines.push(`Aliases: ${command.aliases.map((a) => `/${a}`).join(', ')}`);
  }

  if (command.args?.length) {
    lines.push('', 'Arguments:');
    for (const arg of command.args) {
      const required = arg.required ? '(required)' : '(optional)';
      lines.push(`  ${arg.name} - ${arg.description} ${required}`);

      if (arg.choices?.length) {
        lines.push(`    Options: ${arg.choices.join(', ')}`);
      }

      if (arg.defaultValue !== undefined) {
        lines.push(`    Default: ${arg.defaultValue}`);
      }
    }
  }

  if (command.isDestructive) {
    lines.push('', 'WARNING: This is a destructive command!');
  }

  return lines;
}

/**
 * Format error message for display
 */
export function formatParseError(parsed: ParsedCommand): string {
  if (parsed.errors.length === 0) {
    return '';
  }

  if (parsed.errors.length === 1) {
    return parsed.errors[0] ?? '';
  }

  return parsed.errors.map((e) => `- ${e}`).join('\n');
}

/**
 * Extract command name from partial input (for autocomplete)
 */
export function extractPartialCommand(input: string): string {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    return '';
  }

  // Get just the command part (first word after /)
  const withoutSlash = trimmed.slice(1);
  const spaceIndex = withoutSlash.indexOf(' ');

  if (spaceIndex === -1) {
    return withoutSlash.toLowerCase();
  }

  return withoutSlash.slice(0, spaceIndex).toLowerCase();
}

/**
 * Check if input appears to be a complete command
 */
export function isCompleteCommand(input: string): boolean {
  const parsed = parseCommand(input);
  return parsed.isCommand && parsed.command !== undefined;
}

/**
 * Get the current argument index being typed
 */
export function getCurrentArgIndex(input: string): number {
  const trimmed = input.trim();

  if (!trimmed.startsWith('/')) {
    return -1;
  }

  // Count spaces after the command
  const parts = parseArguments(trimmed.slice(1));

  // Subtract 1 because first part is the command name
  // If input ends with space, we're on the next argument
  const endsWithSpace = /\s$/.test(input);

  return Math.max(0, parts.length - 1 + (endsWithSpace ? 1 : 0));
}

/**
 * Get suggestions for the current argument
 */
export function getArgSuggestions(
  input: string,
  command: Command
): string[] {
  const argIndex = getCurrentArgIndex(input) - 1; // -1 because we're counting from args, not including command

  if (argIndex < 0 || !command.args || argIndex >= command.args.length) {
    return [];
  }

  const argDef = command.args[argIndex];

  // Return choices if available
  if (argDef && argDef.choices && argDef.choices.length > 0) {
    return argDef.choices;
  }

  return [];
}
