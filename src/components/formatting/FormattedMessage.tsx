/**
 * FormattedMessage Component
 *
 * Renders formatted message content with support for:
 * - URLs with optional previews
 * - @mentions
 * - #hashtags
 * - Nostr entities (npub, note, nevent, etc.)
 * - Emoji shortcodes
 * - Code blocks and inline code
 */

import type { FunctionComponent } from 'preact';
import { useMemo, useCallback } from 'preact/hooks';
import {
  parseMessage,
  type ParseResult,
  type UrlToken
} from '../../services/formatting/parser';
import {
  renderTokens,
  type RenderContext,
  type RenderClassNames
} from '../../services/formatting/renderer';
import { usePeersStore } from '../../stores/peers-store';
import { LinkPreview } from './LinkPreview';

// ============================================================================
// Types
// ============================================================================

export interface FormattedMessageProps {
  /** Message content to format */
  content: string;
  /** Whether to show link previews */
  showLinkPreviews?: boolean;
  /** Maximum number of link previews to show */
  maxLinkPreviews?: number;
  /** Handler for mention clicks */
  onMentionClick?: (pubkey: string) => void;
  /** Handler for hashtag clicks */
  onHashtagClick?: (tag: string) => void;
  /** Handler for Nostr entity clicks */
  onNostrEntityClick?: (
    type: 'npub' | 'note' | 'nevent' | 'nprofile' | 'naddr',
    value: string
  ) => void;
  /** Handler for URL clicks (if not provided, opens in new tab) */
  onUrlClick?: (url: string) => void;
  /** Additional CSS classes */
  className?: string;
  /** Custom class names for formatted elements */
  classNames?: RenderClassNames;
  /** Enable compact mode */
  compact?: boolean;
  /** Disable URL parsing */
  disableUrls?: boolean;
  /** Disable mention parsing */
  disableMentions?: boolean;
  /** Disable hashtag parsing */
  disableHashtags?: boolean;
  /** Disable Nostr entity parsing */
  disableNostrEntities?: boolean;
  /** Disable emoji parsing */
  disableEmojis?: boolean;
  /** Disable code parsing */
  disableCode?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const FormattedMessage: FunctionComponent<FormattedMessageProps> = ({
  content,
  showLinkPreviews = false,
  maxLinkPreviews = 3,
  onMentionClick,
  onHashtagClick,
  onNostrEntityClick,
  onUrlClick,
  className = '',
  classNames,
  compact = false,
  disableUrls = false,
  disableMentions = false,
  disableHashtags = false,
  disableNostrEntities = false,
  disableEmojis = false,
  disableCode = false,
}) => {
  // Get peer lookup from store
  const peers = usePeersStore((state) => state.peers);

  // Lookup peer name by pubkey
  const getPeerName = useCallback(
    (pubkey: string): string | undefined => {
      // Try direct fingerprint lookup
      if (peers[pubkey]) {
        return peers[pubkey].nickname;
      }
      // Try to find by publicKey
      for (const peer of Object.values(peers)) {
        if (peer.publicKey === pubkey) {
          return peer.nickname;
        }
        // Handle npub format - strip prefix and compare
        if (pubkey.startsWith('npub1') && peer.publicKey) {
          // For now, return undefined - would need bech32 decode
          // In production, you'd decode the npub to hex and compare
        }
      }
      return undefined;
    },
    [peers]
  );

  // Parse content
  const parseResult: ParseResult = useMemo(() => parseMessage(content, {
      parseUrls: !disableUrls,
      parseMentions: !disableMentions,
      parseHashtags: !disableHashtags,
      parseNostrEntities: !disableNostrEntities,
      parseEmojis: !disableEmojis,
      parseCode: !disableCode,
      preserveNewlines: true,
    }), [
    content,
    disableUrls,
    disableMentions,
    disableHashtags,
    disableNostrEntities,
    disableEmojis,
    disableCode,
  ]);

  // Default URL handler
  const handleUrlClick = useCallback(
    (url: string) => {
      if (onUrlClick) {
        onUrlClick(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    },
    [onUrlClick]
  );

  // Build render context
  const renderContext: RenderContext = useMemo(
    () => ({
      getPeerName,
      onMentionClick,
      onHashtagClick,
      onNostrEntityClick,
      onUrlClick: handleUrlClick,
      showLinkPreviews,
      classNames,
    }),
    [
      getPeerName,
      onMentionClick,
      onHashtagClick,
      onNostrEntityClick,
      handleUrlClick,
      showLinkPreviews,
      classNames,
    ]
  );

  // Render tokens
  const renderedContent = useMemo(() => renderTokens(parseResult.tokens, renderContext), [parseResult.tokens, renderContext]);

  // Extract URLs for previews
  const urlsForPreviews = useMemo(() => {
    if (!showLinkPreviews || !parseResult.hasUrls) {
      return [];
    }

    const urlTokens = parseResult.tokens.filter(
      (t): t is UrlToken => t.type === 'url'
    );

    // Get unique URLs, limited to maxLinkPreviews
    const seen = new Set<string>();
    const urls: string[] = [];
    for (const token of urlTokens) {
      if (!seen.has(token.url) && urls.length < maxLinkPreviews) {
        seen.add(token.url);
        urls.push(token.url);
      }
    }

    return urls;
  }, [showLinkPreviews, parseResult, maxLinkPreviews]);

  // Container classes
  const containerClass = [
    'formatted-message',
    compact ? 'leading-tight' : 'leading-relaxed',
    'break-words',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div class={containerClass}>
      {/* Rendered message content */}
      <div class="message-content">{renderedContent}</div>

      {/* Link previews */}
      {urlsForPreviews.length > 0 && (
        <div class="link-previews mt-2 space-y-2">
          {urlsForPreviews.map((url) => (
            <LinkPreview key={url} url={url} onClick={handleUrlClick} />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Utility Components
// ============================================================================

/**
 * Simple formatted message without previews or interactivity
 */
export const SimpleFormattedMessage: FunctionComponent<{
  content: string;
  className?: string;
}> = ({ content, className = '' }) => {
  const parseResult = useMemo(() => parseMessage(content, {
      parseUrls: true,
      parseMentions: true,
      parseHashtags: true,
      parseNostrEntities: true,
      parseEmojis: true,
      parseCode: true,
      preserveNewlines: true,
    }), [content]);

  const renderedContent = useMemo(() => renderTokens(parseResult.tokens, {}), [parseResult.tokens]);

  return (
    <div class={`formatted-message break-words ${className}`}>
      {renderedContent}
    </div>
  );
};

/**
 * Code-only formatted message (for terminal output, etc.)
 */
export const CodeFormattedMessage: FunctionComponent<{
  content: string;
  className?: string;
}> = ({ content, className = '' }) => {
  const parseResult = useMemo(() => parseMessage(content, {
      parseUrls: false,
      parseMentions: false,
      parseHashtags: false,
      parseNostrEntities: false,
      parseEmojis: false,
      parseCode: true,
      preserveNewlines: true,
    }), [content]);

  const renderedContent = useMemo(() => renderTokens(parseResult.tokens, {}), [parseResult.tokens]);

  return (
    <div class={`code-formatted-message font-mono ${className}`}>
      {renderedContent}
    </div>
  );
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to get parse result for message content
 */
export function useFormattedMessage(content: string): ParseResult {
  return useMemo(() => parseMessage(content, {
      parseUrls: true,
      parseMentions: true,
      parseHashtags: true,
      parseNostrEntities: true,
      parseEmojis: true,
      parseCode: true,
      preserveNewlines: true,
    }), [content]);
}

/**
 * Hook to check if content has any formattable elements
 */
export function useHasFormattableContent(content: string): {
  hasUrls: boolean;
  hasMentions: boolean;
  hasHashtags: boolean;
  hasNostrEntities: boolean;
  hasCode: boolean;
  hasEmoji: boolean;
  hasAny: boolean;
} {
  const result = useFormattedMessage(content);

  return useMemo(
    () => ({
      hasUrls: result.hasUrls,
      hasMentions: result.hasMentions,
      hasHashtags: result.hasHashtags,
      hasNostrEntities: result.hasNostrEntities,
      hasCode: result.hasCode,
      hasEmoji: result.hasEmoji,
      hasAny:
        result.hasUrls ||
        result.hasMentions ||
        result.hasHashtags ||
        result.hasNostrEntities ||
        result.hasCode ||
        result.hasEmoji,
    }),
    [result]
  );
}

export default FormattedMessage;
