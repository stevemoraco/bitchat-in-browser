/**
 * useCommandHandler - Hook for handling chat commands
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

import { useCallback } from 'preact/hooks';
import { useSettingsStore } from '../../stores/settings-store';
import { useMessagesStore } from '../../stores/messages-store';
import { useChannelsStore, createChannel } from '../../stores/channels-store';
import { useMeshStore } from '../../stores/mesh-store';
import type { Message } from '../../stores/types';
import { COMMANDS } from './CommandAutocomplete';

// ============================================================================
// Types
// ============================================================================

export interface CommandResult {
  /** Whether the command was successfully executed */
  success: boolean;
  /** Optional feedback message to display */
  message?: string;
  /** Optional action message to send (for /me command) */
  actionMessage?: {
    content: string;
    type: 'action';
  };
}

export interface UseCommandHandlerOptions {
  /** Current channel ID */
  channelId: string;
  /** Callback to add a system message */
  onSystemMessage?: (content: string) => void;
  /** Callback when leaving the current channel */
  onLeaveChannel?: () => void;
}

// ============================================================================
// System Message Helper
// ============================================================================

/**
 * Create a system message object
 */
export function createSystemMessage(channelId: string, content: string): Message {
  return {
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    channelId,
    senderFingerprint: 'system',
    senderNickname: 'System',
    content,
    timestamp: Date.now(),
    type: 'system',
    status: 'delivered',
    isOwn: false,
    isRead: true,
  };
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook that provides command handling functionality
 */
export function useCommandHandler(options: UseCommandHandlerOptions) {
  const { channelId, onSystemMessage, onLeaveChannel } = options;

  // Store hooks
  const setNickname = useSettingsStore((state) => state.setNickname);
  const currentNickname = useSettingsStore((state) => state.settings.nickname);
  const clearChannel = useMessagesStore((state) => state.clearChannel);
  const addMessage = useMessagesStore((state) => state.addMessage);
  const addChannel = useChannelsStore((state) => state.addChannel);
  const removeChannel = useChannelsStore((state) => state.removeChannel);
  const setActiveChannel = useChannelsStore((state) => state.setActiveChannel);
  const meshStatus = useMeshStore((state) => state.status);
  const meshPeers = useMeshStore((state) => state.peers);
  const meshConfig = useMeshStore((state) => state.config);

  // Add system message to channel
  const addSystemMessage = useCallback(
    (content: string) => {
      if (onSystemMessage) {
        onSystemMessage(content);
      } else {
        addMessage(createSystemMessage(channelId, content));
      }
    },
    [channelId, onSystemMessage, addMessage]
  );

  // Command handlers
  const handleCommand = useCallback(
    (command: string, args: string): CommandResult => {
      const cmd = command.toLowerCase();

      switch (cmd) {
        case 'me': {
          // Action message
          if (!args.trim()) {
            return {
              success: false,
              message: 'Usage: /me <action> - Example: /me waves hello',
            };
          }
          return {
            success: true,
            actionMessage: {
              content: args.trim(),
              type: 'action',
            },
          };
        }

        case 'nick': {
          // Change nickname
          const newNick = args.trim();
          if (!newNick) {
            return {
              success: false,
              message: 'Usage: /nick <name> - Example: /nick Alice',
            };
          }
          if (newNick.length > 32) {
            return {
              success: false,
              message: 'Nickname must be 32 characters or less.',
            };
          }
          const oldNick = currentNickname || 'Anonymous';
          setNickname(newNick);
          addSystemMessage(`${oldNick} is now known as ${newNick}`);
          return {
            success: true,
            message: `Nickname changed to "${newNick}"`,
          };
        }

        case 'join': {
          // Join a channel
          const channelName = args.trim().replace(/^#/, '');
          if (!channelName) {
            return {
              success: false,
              message: 'Usage: /join <channel> - Example: /join general',
            };
          }
          // Create or switch to channel
          const newChannelId = `public-${channelName.toLowerCase()}`;
          const existingChannels = useChannelsStore.getState().channels;
          const exists = existingChannels.some((c) => c.id === newChannelId);

          if (!exists) {
            addChannel(
              createChannel({
                id: newChannelId,
                name: channelName,
                type: 'public',
              })
            );
            addSystemMessage(`Joined #${channelName}`);
          }
          setActiveChannel(newChannelId);
          return {
            success: true,
            message: exists ? `Switched to #${channelName}` : `Joined #${channelName}`,
          };
        }

        case 'leave': {
          // Leave current channel
          const channels = useChannelsStore.getState().channels;
          if (channels.length <= 1) {
            return {
              success: false,
              message: 'Cannot leave the last channel.',
            };
          }
          removeChannel(channelId);
          if (onLeaveChannel) {
            onLeaveChannel();
          }
          return {
            success: true,
            message: 'Left the channel.',
          };
        }

        case 'clear': {
          // Clear message history
          clearChannel(channelId);
          return {
            success: true,
            message: 'Message history cleared.',
          };
        }

        case 'help': {
          // Show help
          const helpText = COMMANDS.map((c) => `${c.usage} - ${c.description}`).join('\n');
          addSystemMessage(`Available commands:\n${helpText}`);
          return {
            success: true,
          };
        }

        case 'mesh': {
          // Show mesh status
          const peerCount = meshPeers.length;
          const statusText = `Mesh Status: ${meshStatus}\nConnected peers: ${peerCount}\nTopology: ${meshConfig.fullMeshThreshold > peerCount ? 'Full Mesh' : 'Hub-Spoke'}`;
          addSystemMessage(statusText);
          return {
            success: true,
          };
        }

        default: {
          return {
            success: false,
            message: `Unknown command: /${command}. Type /help for available commands.`,
          };
        }
      }
    },
    [
      channelId,
      currentNickname,
      setNickname,
      clearChannel,
      addChannel,
      removeChannel,
      setActiveChannel,
      meshStatus,
      meshPeers,
      meshConfig,
      addSystemMessage,
      onLeaveChannel,
    ]
  );

  return {
    handleCommand,
    addSystemMessage,
  };
}

export default useCommandHandler;
