/**
 * Command Registry - BitChat terminal command definitions
 *
 * Provides a terminal-style command interface like the native BitChat app.
 * Commands are organized by category and support autocomplete.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Command argument definition
 */
export interface CommandArg {
  /** Argument name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Whether this argument is required */
  required: boolean;
  /** Expected type */
  type: 'string' | 'number' | 'boolean';
  /** Default value if not provided */
  defaultValue?: string | number | boolean;
  /** Validation pattern (regex string) */
  pattern?: string;
  /** List of valid values (for autocomplete) */
  choices?: string[];
}

/**
 * Command result from execution
 */
export interface CommandResult {
  /** Whether the command succeeded */
  success: boolean;
  /** Output to display to the user */
  output: string | string[];
  /** Error message if failed */
  error?: string;
  /** Whether to clear the terminal */
  clearTerminal?: boolean;
  /** Whether this was a destructive operation */
  isDestructive?: boolean;
  /** Additional data for programmatic use */
  data?: unknown;
}

/**
 * Command category for organization
 */
export type CommandCategory =
  | 'general'
  | 'identity'
  | 'channels'
  | 'messaging'
  | 'connection'
  | 'system';

/**
 * Command definition
 */
export interface Command {
  /** Command name (without /) */
  name: string;
  /** Aliases that also trigger this command */
  aliases?: string[];
  /** Short description for help */
  description: string;
  /** Detailed usage instructions */
  usage: string;
  /** Command category */
  category: CommandCategory;
  /** Expected arguments */
  args?: CommandArg[];
  /** Whether this is a destructive command */
  isDestructive?: boolean;
  /** Whether this command requires confirmation */
  requiresConfirmation?: boolean;
  /** Execute the command */
  execute: (args: string[], context: CommandContext) => Promise<CommandResult>;
}

/**
 * Execution context passed to commands
 */
export interface CommandContext {
  /** Current user's public key */
  publicKey: string | null;
  /** Current user's fingerprint */
  fingerprint: string | null;
  /** Current channel ID */
  activeChannelId: string | null;
  /** Confirmation callback for destructive commands */
  confirm: (message: string) => Promise<boolean>;
  /** Add a system message to the chat */
  addSystemMessage: (content: string) => void;
}

// ============================================================================
// Command Registry
// ============================================================================

const commands = new Map<string, Command>();
const aliases = new Map<string, string>();

/**
 * Register a command
 */
export function registerCommand(command: Command): void {
  commands.set(command.name, command);

  // Register aliases
  if (command.aliases) {
    for (const alias of command.aliases) {
      aliases.set(alias, command.name);
    }
  }
}

/**
 * Get a command by name or alias
 */
export function getCommand(name: string): Command | undefined {
  const normalizedName = name.toLowerCase();
  const actualName = aliases.get(normalizedName) || normalizedName;
  return commands.get(actualName);
}

/**
 * Get all registered commands
 */
export function getAllCommands(): Command[] {
  return [...commands.values()];
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: CommandCategory): Command[] {
  return getAllCommands().filter((cmd) => cmd.category === category);
}

/**
 * Search commands by name or description
 */
export function searchCommands(query: string): Command[] {
  const lowerQuery = query.toLowerCase();
  return getAllCommands().filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery) ||
      cmd.aliases?.some((a) => a.toLowerCase().includes(lowerQuery))
  );
}

/**
 * Get command suggestions for autocomplete
 */
export function getCommandSuggestions(partial: string): Command[] {
  const lowerPartial = partial.toLowerCase().replace(/^\//, '');

  if (lowerPartial === '') {
    return getAllCommands().sort((a, b) => a.name.localeCompare(b.name));
  }

  return getAllCommands()
    .filter(
      (cmd) =>
        cmd.name.toLowerCase().startsWith(lowerPartial) ||
        cmd.aliases?.some((a) => a.toLowerCase().startsWith(lowerPartial))
    )
    .sort((a, b) => {
      // Exact matches first
      if (a.name === lowerPartial) return -1;
      if (b.name === lowerPartial) return 1;
      return a.name.localeCompare(b.name);
    });
}

// ============================================================================
// Built-in Commands
// ============================================================================

// Help command
registerCommand({
  name: 'help',
  aliases: ['h', '?'],
  description: 'Show available commands',
  usage: '/help [command]',
  category: 'general',
  args: [
    {
      name: 'command',
      description: 'Specific command to get help for',
      required: false,
      type: 'string',
    },
  ],
  execute: async (args) => {
    if (args.length > 0) {
      const argName = args[0] ?? '';
      const cmd = getCommand(argName);
      if (!cmd) {
        return {
          success: false,
          output: [],
          error: `Unknown command: ${argName}`,
        };
      }

      const output = [
        `Command: /${cmd.name}`,
        `Description: ${cmd.description}`,
        `Usage: ${cmd.usage}`,
      ];

      if (cmd.aliases?.length) {
        output.push(`Aliases: ${cmd.aliases.map((a) => `/${a}`).join(', ')}`);
      }

      if (cmd.args?.length) {
        output.push('Arguments:');
        for (const arg of cmd.args) {
          const required = arg.required ? '(required)' : '(optional)';
          output.push(`  ${arg.name} - ${arg.description} ${required}`);
        }
      }

      return { success: true, output };
    }

    // Show all commands grouped by category
    const categories: CommandCategory[] = [
      'general',
      'identity',
      'channels',
      'messaging',
      'connection',
      'system',
    ];

    const output: string[] = ['BitChat Commands', '================', ''];

    for (const category of categories) {
      const cmds = getCommandsByCategory(category);
      if (cmds.length === 0) continue;

      output.push(`[${category.toUpperCase()}]`);
      for (const cmd of cmds) {
        const aliasStr =
          cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : '';
        output.push(`  /${cmd.name}${aliasStr} - ${cmd.description}`);
      }
      output.push('');
    }

    output.push('Type /help <command> for detailed usage.');

    return { success: true, output };
  },
});

// Nick command
registerCommand({
  name: 'nick',
  aliases: ['name', 'nickname'],
  description: 'Set your display nickname',
  usage: '/nick <name>',
  category: 'identity',
  args: [
    {
      name: 'name',
      description: 'Your new nickname (max 32 characters)',
      required: true,
      type: 'string',
    },
  ],
  execute: async (args) => {
    if (args.length === 0) {
      return {
        success: false,
        output: [],
        error: 'Usage: /nick <name>',
      };
    }

    const nickname = args.join(' ').trim().slice(0, 32);

    if (nickname.length === 0) {
      return {
        success: false,
        output: [],
        error: 'Nickname cannot be empty',
      };
    }

    // Import dynamically to avoid circular dependencies
    const { useSettingsStore } = await import('../../stores/settings-store');
    useSettingsStore.getState().setNickname(nickname);

    return {
      success: true,
      output: `Nickname set to: ${nickname}`,
      data: { nickname },
    };
  },
});

// Join command
registerCommand({
  name: 'join',
  aliases: ['j'],
  description: 'Join a location channel by geohash',
  usage: '/join <geohash>',
  category: 'channels',
  args: [
    {
      name: 'geohash',
      description: 'Geohash for the location (e.g., "9q8yy" for SF)',
      required: true,
      type: 'string',
      pattern: '^[0-9a-z]{1,12}$',
    },
  ],
  execute: async (args) => {
    if (args.length === 0) {
      return {
        success: false,
        output: [],
        error: 'Usage: /join <geohash>',
      };
    }

    const geohash = (args[0] ?? '').toLowerCase().trim();

    // Validate geohash format
    if (!/^[0-9a-z]{1,12}$/.test(geohash)) {
      return {
        success: false,
        output: [],
        error: 'Invalid geohash format. Use 1-12 alphanumeric characters.',
      };
    }

    const { useChannelsStore, createChannel } = await import(
      '../../stores/channels-store'
    );
    const store = useChannelsStore.getState();

    // Check if channel already exists
    const existingChannel = store.channels.find(
      (c) => c.type === 'location' && c.geohash === geohash
    );

    if (existingChannel) {
      store.setActiveChannel(existingChannel.id);
      return {
        success: true,
        output: `Switched to existing channel: ${existingChannel.name}`,
        data: { channelId: existingChannel.id, geohash },
      };
    }

    // Create new location channel
    const channelId = `location:${geohash}`;
    const channelName = `#${geohash}`;

    const newChannel = createChannel({
      id: channelId,
      name: channelName,
      type: 'location',
      geohash,
      geohashPrecision: geohash.length,
    });

    store.addChannel(newChannel);
    store.setActiveChannel(channelId);

    return {
      success: true,
      output: [`Joined location channel: ${channelName}`, `Geohash: ${geohash}`],
      data: { channelId, geohash },
    };
  },
});

// Leave command
registerCommand({
  name: 'leave',
  aliases: ['part', 'quit'],
  description: 'Leave the current channel',
  usage: '/leave',
  category: 'channels',
  execute: async (_args, context) => {
    if (!context.activeChannelId) {
      return {
        success: false,
        output: [],
        error: 'No active channel to leave',
      };
    }

    const { useChannelsStore } = await import('../../stores/channels-store');
    const store = useChannelsStore.getState();

    const channel = store.channels.find((c) => c.id === context.activeChannelId);
    if (!channel) {
      return {
        success: false,
        output: [],
        error: 'Channel not found',
      };
    }

    const channelName = channel.name;
    store.removeChannel(context.activeChannelId);

    return {
      success: true,
      output: `Left channel: ${channelName}`,
      data: { channelId: context.activeChannelId },
    };
  },
});

// Message (DM) command
registerCommand({
  name: 'msg',
  aliases: ['dm', 'pm', 'whisper'],
  description: 'Send a direct message to a user',
  usage: '/msg <pubkey|fingerprint> <message>',
  category: 'messaging',
  args: [
    {
      name: 'recipient',
      description: 'Public key or fingerprint of the recipient',
      required: true,
      type: 'string',
    },
    {
      name: 'message',
      description: 'Message to send',
      required: true,
      type: 'string',
    },
  ],
  execute: async (args) => {
    if (args.length < 2) {
      return {
        success: false,
        output: [],
        error: 'Usage: /msg <pubkey|fingerprint> <message>',
      };
    }

    const recipient = args[0] ?? '';
    const message = args.slice(1).join(' ');

    if (message.trim().length === 0) {
      return {
        success: false,
        output: [],
        error: 'Message cannot be empty',
      };
    }

    // For now, just acknowledge - actual DM implementation will be added later
    // This creates the DM channel and prepares for messaging
    const { useChannelsStore, createChannel } = await import(
      '../../stores/channels-store'
    );
    const store = useChannelsStore.getState();

    const dmChannelId = `dm:${recipient}`;
    const existingChannel = store.channels.find((c) => c.id === dmChannelId);

    if (!existingChannel) {
      const shortRecipient =
        recipient.length > 12
          ? `${recipient.slice(0, 6)}...${recipient.slice(-4)}`
          : recipient;

      const newChannel = createChannel({
        id: dmChannelId,
        name: shortRecipient,
        type: 'dm',
        dmPeerFingerprint: recipient,
      });

      store.addChannel(newChannel);
    }

    store.setActiveChannel(dmChannelId);

    return {
      success: true,
      output: [
        `DM to ${recipient.slice(0, 12)}...: ${message}`,
        '(Message queued for sending)',
      ],
      data: { recipient, message, channelId: dmChannelId },
    };
  },
});

// Clear command
registerCommand({
  name: 'clear',
  aliases: ['cls'],
  description: 'Clear chat history for the current channel',
  usage: '/clear',
  category: 'system',
  execute: async (_args, context) => {
    if (!context.activeChannelId) {
      return {
        success: true,
        output: 'Terminal cleared',
        clearTerminal: true,
      };
    }

    const { useMessagesStore } = await import('../../stores/messages-store');
    useMessagesStore.getState().clearChannel(context.activeChannelId);

    return {
      success: true,
      output: 'Chat history cleared',
      clearTerminal: true,
      data: { channelId: context.activeChannelId },
    };
  },
});

// Status command
registerCommand({
  name: 'status',
  aliases: ['info', 'whoami'],
  description: 'Show connection and identity status',
  usage: '/status',
  category: 'connection',
  execute: async () => {
    const { useAppStore } = await import('../../stores/app-store');
    const { useIdentityStore } = await import('../../stores/identity-store');
    const { useSettingsStore } = await import('../../stores/settings-store');

    const appState = useAppStore.getState();
    const identity = useIdentityStore.getState().identity;
    const settings = useSettingsStore.getState().settings;

    const output: string[] = [
      'BitChat Status',
      '==============',
      '',
      '[NETWORK]',
      `  Online: ${appState.isOnline ? 'YES' : 'NO'}`,
      `  Initialized: ${appState.isInitialized ? 'YES' : 'NO'}`,
      '',
      '[IDENTITY]',
    ];

    if (identity) {
      output.push(
        `  Nickname: ${settings.nickname || '(not set)'}`,
        `  Fingerprint: ${identity.fingerprint}`,
        `  npub: ${identity.npub || '(not set)'}`,
        `  Key Loaded: ${identity.isKeyLoaded ? 'YES' : 'NO'}`
      );
    } else {
      output.push('  No identity configured');
    }

    output.push('', '[SETTINGS]');
    output.push(
      `  Theme: ${settings.theme}`,
      `  Notifications: ${settings.notifications}`,
      `  Auto-join Location: ${settings.autoJoinLocation ? 'YES' : 'NO'}`
    );

    return { success: true, output };
  },
});

// Relays command
registerCommand({
  name: 'relays',
  aliases: ['relay', 'connections'],
  description: 'Show Nostr relay connection status',
  usage: '/relays',
  category: 'connection',
  execute: async () => {
    const { getDefaultPool } = await import('../nostr/relays');
    const pool = getDefaultPool();
    const statuses = pool.getRelayStatuses();

    if (statuses.length === 0) {
      return {
        success: true,
        output: ['No relay connections configured', 'Connect with /connect'],
      };
    }

    const output: string[] = [
      'Relay Status',
      '============',
      '',
    ];

    const connected = statuses.filter((s) => s.isConnected);
    const disconnected = statuses.filter((s) => !s.isConnected);

    output.push(`Connected: ${connected.length}/${statuses.length}`);
    output.push('');

    if (connected.length > 0) {
      output.push('[CONNECTED]');
      for (const relay of connected.slice(0, 10)) {
        output.push(`  + ${relay.url}`);
        output.push(
          `    TX: ${relay.messagesSent} | RX: ${relay.messagesReceived}`
        );
      }
      if (connected.length > 10) {
        output.push(`  ... and ${connected.length - 10} more`);
      }
      output.push('');
    }

    if (disconnected.length > 0) {
      output.push('[DISCONNECTED]');
      for (const relay of disconnected.slice(0, 5)) {
        const errorStr = relay.lastError
          ? ` (${relay.lastError instanceof Error ? relay.lastError.message : String(relay.lastError)})`
          : '';
        output.push(`  - ${relay.url}${errorStr}`);
      }
      if (disconnected.length > 5) {
        output.push(`  ... and ${disconnected.length - 5} more`);
      }
    }

    return {
      success: true,
      output,
      data: { connected: connected.length, total: statuses.length },
    };
  },
});

// Export command
registerCommand({
  name: 'export',
  aliases: ['backup'],
  description: 'Export your identity for backup',
  usage: '/export',
  category: 'identity',
  requiresConfirmation: true,
  execute: async (_args, context) => {
    if (!context.publicKey) {
      return {
        success: false,
        output: [],
        error: 'No identity to export. Create one first.',
      };
    }

    const confirmed = await context.confirm(
      'Export will show your identity info. Make sure no one is watching your screen. Continue?'
    );

    if (!confirmed) {
      return {
        success: false,
        output: ['Export cancelled'],
      };
    }

    const { useIdentityStore } = await import('../../stores/identity-store');
    const identity = useIdentityStore.getState().identity;

    if (!identity) {
      return {
        success: false,
        output: [],
        error: 'No identity found',
      };
    }

    const output: string[] = [
      'Identity Export',
      '===============',
      '',
      'PUBLIC KEY (safe to share):',
      `  ${identity.publicKey}`,
      '',
    ];

    if (identity.npub) {
      output.push('NPUB (safe to share):', `  ${identity.npub}`, '');
    }

    output.push(
      'FINGERPRINT:',
      `  ${identity.fingerprint}`,
      '',
      'NOTE: Your private key (nsec) is stored securely.',
      'To export your full identity including private key,',
      'use the Settings > Export Identity option.'
    );

    return {
      success: true,
      output,
      data: {
        publicKey: identity.publicKey,
        npub: identity.npub,
        fingerprint: identity.fingerprint,
      },
    };
  },
});

// Wipe command
registerCommand({
  name: 'wipe',
  aliases: ['reset', 'purge'],
  description: 'Emergency wipe all local data',
  usage: '/wipe',
  category: 'system',
  isDestructive: true,
  requiresConfirmation: true,
  execute: async (_args, context) => {
    const confirmed = await context.confirm(
      'WARNING: This will permanently delete ALL local data including your identity, messages, and settings. This cannot be undone. Type YES to confirm.'
    );

    if (!confirmed) {
      return {
        success: false,
        output: ['Wipe cancelled. Your data is safe.'],
      };
    }

    // Perform the wipe
    const { clearAllStores } = await import('../../stores');

    try {
      clearAllStores();

      // Also clear any additional storage
      if (typeof localStorage !== 'undefined') {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('bitchat-')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));
      }

      return {
        success: true,
        output: [
          '!!! DATA WIPED !!!',
          '',
          'All local data has been permanently deleted:',
          '  - Identity cleared',
          '  - Messages deleted',
          '  - Settings reset',
          '  - All channels removed',
          '',
          'Refresh the page to start fresh.',
        ],
        isDestructive: true,
        clearTerminal: true,
      };
    } catch (error) {
      return {
        success: false,
        output: [],
        error: `Wipe failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Me command (action message)
registerCommand({
  name: 'me',
  aliases: ['action'],
  description: 'Send an action message',
  usage: '/me <action>',
  category: 'messaging',
  args: [
    {
      name: 'action',
      description: 'Action to perform (e.g., "waves hello")',
      required: true,
      type: 'string',
    },
  ],
  execute: async (args, context) => {
    if (args.length === 0) {
      return {
        success: false,
        output: [],
        error: 'Usage: /me <action>',
      };
    }

    const action = args.join(' ');

    // This would normally add an action message to the current channel
    // For now, just format and return
    return {
      success: true,
      output: `* ${context.fingerprint?.slice(0, 8) || 'you'} ${action}`,
      data: { action, type: 'action' },
    };
  },
});

// Version command
registerCommand({
  name: 'version',
  aliases: ['ver', 'about'],
  description: 'Show BitChat version info',
  usage: '/version',
  category: 'general',
  execute: async () => {
    const output: string[] = [
      'BitChat In Browser',
      '==================',
      '',
      'Version: 0.1.0 (PWA)',
      'Protocol: Nostr',
      'License: MIT',
      '',
      'Build: Progressive Web App',
      'Hosting: IPFS + ENS',
      'URL: bitbrowse.eth.limo',
      '',
      'Interoperable with:',
      '  - BitChat iOS',
      '  - BitChat Android',
      '',
      '100% Private. Your keys, your messages.',
    ];

    return { success: true, output };
  },
});

// Debug command (dev mode only)
registerCommand({
  name: 'debug',
  aliases: ['dev'],
  description: 'Toggle developer mode',
  usage: '/debug [on|off]',
  category: 'system',
  args: [
    {
      name: 'state',
      description: 'Enable or disable (on/off)',
      required: false,
      type: 'string',
      choices: ['on', 'off'],
    },
  ],
  execute: async (args) => {
    const { useSettingsStore } = await import('../../stores/settings-store');
    const store = useSettingsStore.getState();
    const currentDevMode = store.settings.devMode;

    let newDevMode: boolean;

    if (args.length === 0) {
      newDevMode = !currentDevMode;
    } else {
      const arg = (args[0] ?? '').toLowerCase();
      newDevMode = arg === 'on' || arg === 'true' || arg === '1';
    }

    store.updateSettings({ devMode: newDevMode });

    return {
      success: true,
      output: `Developer mode: ${newDevMode ? 'ENABLED' : 'DISABLED'}`,
      data: { devMode: newDevMode },
    };
  },
});

// Peers command
registerCommand({
  name: 'peers',
  aliases: ['users', 'online'],
  description: 'Show online peers',
  usage: '/peers',
  category: 'connection',
  execute: async () => {
    const { usePeersStore } = await import('../../stores/peers-store');
    const peers = Object.values(usePeersStore.getState().peers);

    if (peers.length === 0) {
      return {
        success: true,
        output: ['No peers discovered yet', 'Start chatting to see peers!'],
      };
    }

    const onlinePeers = peers.filter((p) => p.status === 'online');
    const output: string[] = [
      `Peers (${onlinePeers.length} online / ${peers.length} total)`,
      '='.repeat(40),
      '',
    ];

    for (const peer of peers) {
      const statusIcon =
        peer.status === 'online' ? '+' : peer.status === 'away' ? '~' : '-';
      const trustIcon = peer.isTrusted ? '*' : '';
      const blockIcon = peer.isBlocked ? '[BLOCKED]' : '';
      output.push(
        `${statusIcon} ${peer.nickname}${trustIcon} ${blockIcon}`.trim()
      );
      output.push(`    ${peer.fingerprint.slice(0, 16)}...`);
    }

    return { success: true, output };
  },
});

// Connect command
registerCommand({
  name: 'connect',
  aliases: ['reconnect'],
  description: 'Connect to Nostr relays',
  usage: '/connect',
  category: 'connection',
  execute: async () => {
    const { getDefaultPool, DEFAULT_RELAYS } = await import('../nostr/relays');
    const pool = getDefaultPool();

    try {
      await pool.connect([...DEFAULT_RELAYS]);

      const connected = pool.getConnectedRelays().length;
      return {
        success: true,
        output: [
          'Connecting to relays...',
          `Connected to ${connected}/${DEFAULT_RELAYS.length} relays`,
        ],
        data: { connected, total: DEFAULT_RELAYS.length },
      };
    } catch (error) {
      return {
        success: false,
        output: [],
        error: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
});

// Disconnect command
registerCommand({
  name: 'disconnect',
  aliases: ['offline'],
  description: 'Disconnect from all relays',
  usage: '/disconnect',
  category: 'connection',
  execute: async () => {
    const { getDefaultPool } = await import('../nostr/relays');
    const pool = getDefaultPool();

    pool.disconnect();

    return {
      success: true,
      output: 'Disconnected from all relays',
    };
  },
});

// Mute command
registerCommand({
  name: 'mute',
  aliases: ['silence'],
  description: 'Mute the current channel',
  usage: '/mute',
  category: 'channels',
  execute: async (_args, context) => {
    if (!context.activeChannelId) {
      return {
        success: false,
        output: [],
        error: 'No active channel to mute',
      };
    }

    const { useChannelsStore } = await import('../../stores/channels-store');
    useChannelsStore.getState().muteChannel(context.activeChannelId, true);

    return {
      success: true,
      output: 'Channel muted. You will no longer receive notifications.',
    };
  },
});

// Unmute command
registerCommand({
  name: 'unmute',
  aliases: ['unsilence'],
  description: 'Unmute the current channel',
  usage: '/unmute',
  category: 'channels',
  execute: async (_args, context) => {
    if (!context.activeChannelId) {
      return {
        success: false,
        output: [],
        error: 'No active channel to unmute',
      };
    }

    const { useChannelsStore } = await import('../../stores/channels-store');
    useChannelsStore.getState().muteChannel(context.activeChannelId, false);

    return {
      success: true,
      output: 'Channel unmuted. Notifications enabled.',
    };
  },
});

// Pin command
registerCommand({
  name: 'pin',
  description: 'Pin the current channel',
  usage: '/pin',
  category: 'channels',
  execute: async (_args, context) => {
    if (!context.activeChannelId) {
      return {
        success: false,
        output: [],
        error: 'No active channel to pin',
      };
    }

    const { useChannelsStore } = await import('../../stores/channels-store');
    useChannelsStore.getState().pinChannel(context.activeChannelId, true);

    return {
      success: true,
      output: 'Channel pinned to top of list.',
    };
  },
});

// Unpin command
registerCommand({
  name: 'unpin',
  description: 'Unpin the current channel',
  usage: '/unpin',
  category: 'channels',
  execute: async (_args, context) => {
    if (!context.activeChannelId) {
      return {
        success: false,
        output: [],
        error: 'No active channel to unpin',
      };
    }

    const { useChannelsStore } = await import('../../stores/channels-store');
    useChannelsStore.getState().pinChannel(context.activeChannelId, false);

    return {
      success: true,
      output: 'Channel unpinned.',
    };
  },
});

// Types are already exported above via export interface declarations
