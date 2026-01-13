/**
 * Commands Service Tests
 *
 * Tests for command parsing, validation, execution, and history.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseCommand,
  parseArguments,
  validateArguments,
  validateArg,
  isCommandString,
  getCommandHelp,
  formatParseError,
  extractPartialCommand,
  isCompleteCommand,
  getCurrentArgIndex,
  getArgSuggestions,
} from '../parser';
import {
  executeCommand,
  executeCommandByName,
  formatResult,
  formatTerminalOutput,
  validateCommand,
  wouldExecuteCommand,
  getCommandFromInput,
  getCommandHistory,
  clearCommandHistory,
  getRecentCommands,
  getUniqueRecentCommands,
} from '../executor';
import {
  registerCommand,
  getCommand,
  getAllCommands,
  getCommandsByCategory,
  searchCommands,
  getCommandSuggestions,
  type Command,
  type CommandContext,
} from '../index';

describe('Command Parser', () => {
  describe('isCommandString', () => {
    it('should identify command strings', () => {
      expect(isCommandString('/help')).toBe(true);
      expect(isCommandString('/nick Alice')).toBe(true);
      expect(isCommandString('  /help  ')).toBe(true);
    });

    it('should reject non-command strings', () => {
      expect(isCommandString('hello')).toBe(false);
      expect(isCommandString('not a /command')).toBe(false);
      expect(isCommandString('')).toBe(false);
    });
  });

  describe('parseCommand', () => {
    it('should parse basic command', () => {
      const result = parseCommand('/help');

      expect(result.isCommand).toBe(true);
      expect(result.name).toBe('help');
      expect(result.args).toEqual([]);
    });

    it('should parse command with arguments', () => {
      const result = parseCommand('/nick Alice');

      expect(result.name).toBe('nick');
      expect(result.args).toEqual(['Alice']);
    });

    it('should parse command with multiple arguments', () => {
      const result = parseCommand('/msg user123 Hello World');

      expect(result.name).toBe('msg');
      expect(result.args).toEqual(['user123', 'Hello', 'World']);
    });

    it('should handle empty command', () => {
      const result = parseCommand('/');

      expect(result.isCommand).toBe(true);
      expect(result.errors).toContain('Empty command');
      expect(result.isValid).toBe(false);
    });

    it('should handle unknown command', () => {
      const result = parseCommand('/unknowncommand');

      expect(result.isCommand).toBe(true);
      expect(result.command).toBeUndefined();
      expect(result.errors.some(e => e.includes('Unknown command'))).toBe(true);
    });

    it('should normalize command name to lowercase', () => {
      const result = parseCommand('/HELP');

      expect(result.name).toBe('help');
    });

    it('should identify valid known commands', () => {
      const result = parseCommand('/help');

      expect(result.command).toBeDefined();
      expect(result.command?.name).toBe('help');
    });

    it('should return validation errors for missing required args', () => {
      const result = parseCommand('/nick');

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('required'))).toBe(true);
    });
  });

  describe('parseArguments', () => {
    it('should parse simple arguments', () => {
      const args = parseArguments('arg1 arg2 arg3');

      expect(args).toEqual(['arg1', 'arg2', 'arg3']);
    });

    it('should handle quoted arguments', () => {
      const args = parseArguments('first "second argument" third');

      expect(args).toEqual(['first', 'second argument', 'third']);
    });

    it('should handle single-quoted arguments', () => {
      const args = parseArguments("first 'second argument' third");

      expect(args).toEqual(['first', 'second argument', 'third']);
    });

    it('should handle escaped characters', () => {
      const args = parseArguments('arg\\ with\\ spaces normal');

      expect(args).toEqual(['arg with spaces', 'normal']);
    });

    it('should handle escaped quotes', () => {
      const args = parseArguments('say \\"hello\\"');

      expect(args).toEqual(['say', '"hello"']);
    });

    it('should handle multiple spaces between arguments', () => {
      const args = parseArguments('arg1    arg2     arg3');

      expect(args).toEqual(['arg1', 'arg2', 'arg3']);
    });

    it('should handle empty input', () => {
      const args = parseArguments('');

      expect(args).toEqual([]);
    });

    it('should handle mixed quotes', () => {
      const args = parseArguments('"double" \'single\' normal');

      expect(args).toEqual(['double', 'single', 'normal']);
    });
  });

  describe('validateArguments', () => {
    const testDefinitions = [
      { name: 'required', description: 'A required arg', required: true, type: 'string' as const },
      { name: 'optional', description: 'An optional arg', required: false, type: 'string' as const },
    ];

    it('should pass when required args are present', () => {
      const errors = validateArguments(['value'], testDefinitions);

      expect(errors).toHaveLength(0);
    });

    it('should fail when required args are missing', () => {
      const errors = validateArguments([], testDefinitions);

      expect(errors.some(e => e.includes('required'))).toBe(true);
    });

    it('should pass with optional args missing', () => {
      const errors = validateArguments(['value'], testDefinitions);

      expect(errors).toHaveLength(0);
    });
  });

  describe('validateArg', () => {
    it('should validate string type', () => {
      const result = validateArg('test', {
        name: 'arg',
        description: 'Test',
        required: true,
        type: 'string',
      });

      expect(result.isValid).toBe(true);
      expect(result.value).toBe('test');
    });

    it('should validate number type', () => {
      const result = validateArg('42', {
        name: 'count',
        description: 'Count',
        required: true,
        type: 'number',
      });

      expect(result.isValid).toBe(true);
      expect(result.value).toBe(42);
    });

    it('should reject invalid numbers', () => {
      const result = validateArg('notanumber', {
        name: 'count',
        description: 'Count',
        required: true,
        type: 'number',
      });

      expect(result.isValid).toBe(false);
    });

    it('should validate boolean type', () => {
      const truthy = ['true', 'yes', '1', 'on'];
      const falsy = ['false', 'no', '0', 'off'];

      for (const val of truthy) {
        const result = validateArg(val, {
          name: 'flag',
          description: 'Flag',
          required: true,
          type: 'boolean',
        });
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(true);
      }

      for (const val of falsy) {
        const result = validateArg(val, {
          name: 'flag',
          description: 'Flag',
          required: true,
          type: 'boolean',
        });
        expect(result.isValid).toBe(true);
        expect(result.value).toBe(false);
      }
    });

    it('should validate against pattern', () => {
      const result = validateArg('abc123', {
        name: 'id',
        description: 'ID',
        required: true,
        type: 'string',
        pattern: '^[a-z0-9]+$',
      });

      expect(result.isValid).toBe(true);

      const invalid = validateArg('ABC!@#', {
        name: 'id',
        description: 'ID',
        required: true,
        type: 'string',
        pattern: '^[a-z0-9]+$',
      });

      expect(invalid.isValid).toBe(false);
    });

    it('should validate against choices', () => {
      const result = validateArg('on', {
        name: 'state',
        description: 'State',
        required: true,
        type: 'string',
        choices: ['on', 'off'],
      });

      expect(result.isValid).toBe(true);

      const invalid = validateArg('maybe', {
        name: 'state',
        description: 'State',
        required: true,
        type: 'string',
        choices: ['on', 'off'],
      });

      expect(invalid.isValid).toBe(false);
    });
  });

  describe('getCommandHelp', () => {
    it('should generate help text for command', () => {
      const command = getCommand('help');
      const helpLines = getCommandHelp(command!);

      expect(helpLines).toContain('/help');
      expect(helpLines.some(l => l.includes('Usage'))).toBe(true);
    });

    it('should include aliases', () => {
      const command = getCommand('help');
      const helpLines = getCommandHelp(command!);

      expect(helpLines.some(l => l.includes('Aliases'))).toBe(true);
    });

    it('should include argument descriptions', () => {
      const command = getCommand('nick');
      const helpLines = getCommandHelp(command!);

      expect(helpLines.some(l => l.includes('Arguments'))).toBe(true);
    });
  });

  describe('formatParseError', () => {
    it('should format single error', () => {
      const parsed = parseCommand('/unknown');
      const error = formatParseError(parsed);

      expect(error).toContain('Unknown command');
    });

    it('should format multiple errors', () => {
      // Create a mock parsed result with multiple errors
      const mockParsed = {
        isCommand: true,
        raw: '/test',
        name: 'test',
        args: [],
        errors: ['Error 1', 'Error 2'],
        isValid: false,
      };

      const error = formatParseError(mockParsed);
      expect(error).toContain('Error 1');
      expect(error).toContain('Error 2');
    });

    it('should return empty string for no errors', () => {
      const parsed = parseCommand('/help');
      const error = formatParseError(parsed);

      expect(error).toBe('');
    });
  });

  describe('extractPartialCommand', () => {
    it('should extract command name from partial input', () => {
      expect(extractPartialCommand('/hel')).toBe('hel');
      expect(extractPartialCommand('/nick')).toBe('nick');
      expect(extractPartialCommand('/nick Alice')).toBe('nick');
    });

    it('should return empty for non-command input', () => {
      expect(extractPartialCommand('hello')).toBe('');
    });
  });

  describe('isCompleteCommand', () => {
    it('should return true for known commands', () => {
      expect(isCompleteCommand('/help')).toBe(true);
      expect(isCompleteCommand('/nick Alice')).toBe(true);
    });

    it('should return false for unknown commands', () => {
      expect(isCompleteCommand('/unknownxyz')).toBe(false);
    });

    it('should return false for partial command', () => {
      expect(isCompleteCommand('/')).toBe(false);
    });
  });

  describe('getCurrentArgIndex', () => {
    it('should return 0 for command only', () => {
      expect(getCurrentArgIndex('/nick')).toBe(0);
    });

    it('should return correct index for partially typed arg', () => {
      expect(getCurrentArgIndex('/nick Ali')).toBe(1);
    });

    it('should increment index when ending with space', () => {
      expect(getCurrentArgIndex('/msg user ')).toBe(2);
    });

    it('should return -1 for non-command', () => {
      expect(getCurrentArgIndex('hello')).toBe(-1);
    });
  });

  describe('getArgSuggestions', () => {
    it('should return choices for arguments with choices', () => {
      const command = getCommand('debug');
      const suggestions = getArgSuggestions('/debug ', command!);

      expect(suggestions).toContain('on');
      expect(suggestions).toContain('off');
    });

    it('should return empty for arguments without choices', () => {
      const command = getCommand('nick');
      const suggestions = getArgSuggestions('/nick ', command!);

      expect(suggestions).toHaveLength(0);
    });
  });
});

describe('Command Registry', () => {
  describe('getCommand', () => {
    it('should get command by name', () => {
      const cmd = getCommand('help');

      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('help');
    });

    it('should get command by alias', () => {
      const cmd = getCommand('h');

      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('help');
    });

    it('should be case-insensitive', () => {
      expect(getCommand('HELP')).toBeDefined();
      expect(getCommand('Help')).toBeDefined();
    });

    it('should return undefined for unknown command', () => {
      expect(getCommand('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllCommands', () => {
    it('should return all registered commands', () => {
      const commands = getAllCommands();

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some(c => c.name === 'help')).toBe(true);
    });
  });

  describe('getCommandsByCategory', () => {
    it('should filter commands by category', () => {
      const general = getCommandsByCategory('general');
      const channels = getCommandsByCategory('channels');

      expect(general.every(c => c.category === 'general')).toBe(true);
      expect(channels.every(c => c.category === 'channels')).toBe(true);
    });
  });

  describe('searchCommands', () => {
    it('should search by command name', () => {
      const results = searchCommands('help');

      expect(results.some(c => c.name === 'help')).toBe(true);
    });

    it('should search by description', () => {
      const results = searchCommands('nickname');

      expect(results.some(c => c.name === 'nick')).toBe(true);
    });

    it('should search by alias', () => {
      const results = searchCommands('name');

      expect(results.some(c => c.aliases?.includes('name'))).toBe(true);
    });
  });

  describe('getCommandSuggestions', () => {
    it('should suggest commands starting with prefix', () => {
      const suggestions = getCommandSuggestions('hel');

      expect(suggestions.some(c => c.name === 'help')).toBe(true);
    });

    it('should return all commands for empty prefix', () => {
      const suggestions = getCommandSuggestions('');

      expect(suggestions.length).toBe(getAllCommands().length);
    });

    it('should handle leading slash', () => {
      const suggestions = getCommandSuggestions('/hel');

      expect(suggestions.some(c => c.name === 'help')).toBe(true);
    });

    it('should sort exact matches first', () => {
      const suggestions = getCommandSuggestions('help');

      if (suggestions.length > 0) {
        expect(suggestions[0].name).toBe('help');
      }
    });
  });
});

describe('Command Executor', () => {
  beforeEach(() => {
    clearCommandHistory();
  });

  describe('executeCommand', () => {
    it('should execute valid command', async () => {
      const result = await executeCommand('/version');

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    });

    it('should return error for unknown command', async () => {
      const result = await executeCommand('/unknownxyz123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });

    it('should return error for non-command input', async () => {
      const result = await executeCommand('not a command');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not a command');
    });

    it('should handle validation errors', async () => {
      const result = await executeCommand('/join');

      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should add to command history', async () => {
      await executeCommand('/version');

      const history = getCommandHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].command).toBe('/version');
    });
  });

  describe('executeCommandByName', () => {
    it('should execute command by name', async () => {
      const result = await executeCommandByName('version');

      expect(result.success).toBe(true);
    });

    it('should pass arguments', async () => {
      const result = await executeCommandByName('help', ['version']);

      expect(result.success).toBe(true);
    });

    it('should return error for unknown command', async () => {
      const result = await executeCommandByName('unknownxyz');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown command');
    });
  });

  describe('formatResult', () => {
    it('should format successful result', () => {
      const lines = formatResult({
        success: true,
        output: ['Line 1', 'Line 2'],
      });

      expect(lines).toContain('Line 1');
      expect(lines).toContain('Line 2');
    });

    it('should format string output', () => {
      const lines = formatResult({
        success: true,
        output: 'Single line',
      });

      expect(lines).toContain('Single line');
    });

    it('should include error message', () => {
      const lines = formatResult({
        success: false,
        output: [],
        error: 'Something went wrong',
      });

      expect(lines.some(l => l.includes('Something went wrong'))).toBe(true);
    });
  });

  describe('formatTerminalOutput', () => {
    it('should prefix errors', () => {
      const lines = formatTerminalOutput({
        success: false,
        output: [],
        error: 'Error message',
      });

      expect(lines[0]).toContain('[!]');
    });

    it('should not prefix success', () => {
      const lines = formatTerminalOutput({
        success: true,
        output: ['Success'],
      });

      expect(lines[0]).not.toContain('[!]');
    });
  });

  describe('validateCommand', () => {
    it('should validate known command', () => {
      const result = validateCommand('/help');

      expect(result.isValid).toBe(true);
      expect(result.command).toBeDefined();
    });

    it('should return errors for invalid command', () => {
      const result = validateCommand('/nick');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('wouldExecuteCommand', () => {
    it('should return true for command strings', () => {
      expect(wouldExecuteCommand('/help')).toBe(true);
      expect(wouldExecuteCommand('/nick Alice')).toBe(true);
    });

    it('should return false for non-command strings', () => {
      expect(wouldExecuteCommand('hello')).toBe(false);
      expect(wouldExecuteCommand('')).toBe(false);
    });
  });

  describe('getCommandFromInput', () => {
    it('should return command object for valid input', () => {
      const cmd = getCommandFromInput('/help');

      expect(cmd).toBeDefined();
      expect(cmd?.name).toBe('help');
    });

    it('should return undefined for unknown command', () => {
      const cmd = getCommandFromInput('/unknown123');

      expect(cmd).toBeUndefined();
    });
  });
});

describe('Command History', () => {
  beforeEach(() => {
    clearCommandHistory();
  });

  describe('getCommandHistory', () => {
    it('should return empty array initially', () => {
      const history = getCommandHistory();

      expect(history).toEqual([]);
    });

    it('should include executed commands', async () => {
      await executeCommand('/version');
      await executeCommand('/help');

      const history = getCommandHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('getRecentCommands', () => {
    it('should return recent command strings', async () => {
      await executeCommand('/version');
      await executeCommand('/help');

      const recent = getRecentCommands();
      expect(recent).toContain('/help');
      expect(recent).toContain('/version');
    });

    it('should return in reverse order (most recent first)', async () => {
      await executeCommand('/version');
      await executeCommand('/help');

      const recent = getRecentCommands();
      expect(recent[0]).toBe('/help');
      expect(recent[1]).toBe('/version');
    });

    it('should respect limit', async () => {
      await executeCommand('/version');
      await executeCommand('/help');
      await executeCommand('/status');

      const recent = getRecentCommands(2);
      expect(recent).toHaveLength(2);
    });
  });

  describe('getUniqueRecentCommands', () => {
    it('should deduplicate commands', async () => {
      await executeCommand('/version');
      await executeCommand('/help');
      await executeCommand('/version');

      const unique = getUniqueRecentCommands();
      const versionCount = unique.filter(c => c === '/version').length;
      expect(versionCount).toBe(1);
    });

    it('should keep most recent occurrence', async () => {
      await executeCommand('/version');
      await executeCommand('/help');
      await executeCommand('/version');

      const unique = getUniqueRecentCommands();
      expect(unique[0]).toBe('/version');
    });
  });

  describe('clearCommandHistory', () => {
    it('should clear all history', async () => {
      await executeCommand('/version');
      await executeCommand('/help');

      clearCommandHistory();

      const history = getCommandHistory();
      expect(history).toHaveLength(0);
    });
  });
});

describe('Built-in Commands', () => {
  describe('/help', () => {
    it('should list all commands', async () => {
      const result = await executeCommand('/help');

      expect(result.success).toBe(true);
      expect(result.output).toBeInstanceOf(Array);
      expect((result.output as string[]).some(l => l.includes('BitChat Commands'))).toBe(true);
    });

    it('should show help for specific command', async () => {
      const result = await executeCommand('/help nick');

      expect(result.success).toBe(true);
      expect((result.output as string[]).some(l => l.includes('/nick'))).toBe(true);
    });

    it('should show error for unknown command in help', async () => {
      const result = await executeCommand('/help unknownxyz');

      expect(result.success).toBe(false);
    });
  });

  describe('/version', () => {
    it('should show version info', async () => {
      const result = await executeCommand('/version');

      expect(result.success).toBe(true);
      expect((result.output as string[]).some(l => l.includes('BitChat'))).toBe(true);
    });
  });

  describe('/debug', () => {
    it('should toggle debug mode', async () => {
      const result = await executeCommand('/debug on');

      expect(result.success).toBe(true);
      expect((result.output as string).includes('ENABLED')).toBe(true);
    });

    it('should toggle without argument', async () => {
      const result = await executeCommand('/debug');

      expect(result.success).toBe(true);
    });
  });

  describe('/clear', () => {
    it('should request terminal clear', async () => {
      const result = await executeCommand('/clear');

      expect(result.success).toBe(true);
      expect(result.clearTerminal).toBe(true);
    });
  });

  describe('/join', () => {
    it('should validate geohash format', async () => {
      const result = await executeCommand('/join invalid!@#');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid geohash');
    });

    it('should accept valid geohash', async () => {
      const result = await executeCommand('/join 9q8yy');

      expect(result.success).toBe(true);
    });
  });

  describe('/nick', () => {
    it('should require nickname argument', async () => {
      const result = await executeCommand('/nick');

      expect(result.success).toBe(false);
    });

    it('should set nickname', async () => {
      const result = await executeCommand('/nick TestUser');

      expect(result.success).toBe(true);
      expect((result.output as string).includes('TestUser')).toBe(true);
    });
  });

  describe('/me', () => {
    it('should format action message', async () => {
      const result = await executeCommand('/me waves hello');

      expect(result.success).toBe(true);
      expect((result.output as string).includes('waves hello')).toBe(true);
    });

    it('should require action text', async () => {
      const result = await executeCommand('/me');

      expect(result.success).toBe(false);
    });
  });
});

describe('Command Aliases', () => {
  it('should support /h as alias for /help', async () => {
    const result = await executeCommand('/h');

    expect(result.success).toBe(true);
  });

  it('should support /? as alias for /help', async () => {
    const result = await executeCommand('/?');

    expect(result.success).toBe(true);
  });

  it('should support /j as alias for /join', async () => {
    const result = await executeCommand('/j 9q8yy');

    expect(result.success).toBe(true);
  });

  it('should support /name as alias for /nick', async () => {
    const result = await executeCommand('/name TestAlias');

    expect(result.success).toBe(true);
  });
});
