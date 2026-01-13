/**
 * Message Renderer for BitChat
 *
 * Converts parsed tokens to Preact VNodes for safe rendering.
 * Includes XSS prevention and sanitization.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { VNode, createElement, Fragment } from 'preact';
import type {
  Token,
  TextToken,
  UrlToken,
  MentionToken,
  HashtagToken,
  NostrNpubToken,
  NostrNoteToken,
  NostrNeventToken,
  NostrNprofileToken,
  NostrNaddrToken,
  EmojiToken,
  CodeBlockToken,
  InlineCodeToken,
  ParseResult,
} from './parser';
import { parseMessage, ParserOptions } from './parser';

// ============================================================================
// Types
// ============================================================================

export interface RenderContext {
  /** Lookup peer name by pubkey/fingerprint */
  getPeerName?: (pubkey: string) => string | undefined;
  /** Handler for mention clicks */
  onMentionClick?: (pubkey: string) => void;
  /** Handler for hashtag clicks */
  onHashtagClick?: (tag: string) => void;
  /** Handler for Nostr entity clicks */
  onNostrEntityClick?: (
    type: 'npub' | 'note' | 'nevent' | 'nprofile' | 'naddr',
    value: string
  ) => void;
  /** Handler for URL clicks */
  onUrlClick?: (url: string) => void;
  /** Whether to show link previews */
  showLinkPreviews?: boolean;
  /** Custom class names for elements */
  classNames?: RenderClassNames;
}

export interface RenderClassNames {
  text?: string;
  url?: string;
  mention?: string;
  hashtag?: string;
  nostrEntity?: string;
  emoji?: string;
  codeBlock?: string;
  codeBlockHeader?: string;
  codeBlockContent?: string;
  inlineCode?: string;
}

export interface RenderOptions extends ParserOptions, RenderContext {
  /** Enable compact mode (no margins/padding) */
  compact?: boolean;
}

// ============================================================================
// XSS Prevention / Sanitization
// ============================================================================

/**
 * HTML entity map for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Validate and sanitize a URL
 * Returns null if URL is not safe
 */
export function sanitizeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    // Prevent javascript: URLs disguised with unicode
    const lowercaseHref = parsed.href.toLowerCase();
    if (
      lowercaseHref.includes('javascript:') ||
      lowercaseHref.includes('data:') ||
      lowercaseHref.includes('vbscript:')
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Sanitize text content (remove control characters, normalize whitespace)
 */
export function sanitizeText(text: string): string {
  // Remove null bytes and other control characters (except newline, tab)
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// ============================================================================
// Default Class Names
// ============================================================================

const DEFAULT_CLASS_NAMES: Required<RenderClassNames> = {
  text: '',
  url: 'text-terminal-cyan underline hover:text-terminal-cyan/80 cursor-pointer break-all',
  mention:
    'text-terminal-yellow hover:text-terminal-yellow/80 cursor-pointer font-semibold',
  hashtag:
    'text-terminal-magenta hover:text-terminal-magenta/80 cursor-pointer',
  nostrEntity:
    'text-terminal-cyan hover:text-terminal-cyan/80 cursor-pointer font-mono text-sm',
  emoji: 'inline',
  codeBlock:
    'my-2 border border-terminal-green/30 rounded overflow-hidden bg-terminal-bg/50',
  codeBlockHeader:
    'px-3 py-1 bg-terminal-green/10 text-terminal-green/70 text-xs font-mono border-b border-terminal-green/30 flex justify-between items-center',
  codeBlockContent:
    'p-3 font-mono text-sm overflow-x-auto whitespace-pre text-terminal-green/90',
  inlineCode:
    'px-1.5 py-0.5 bg-terminal-green/10 border border-terminal-green/30 rounded font-mono text-sm text-terminal-green/90',
};

// ============================================================================
// Token Renderers
// ============================================================================

/**
 * Render a text token
 */
function renderText(
  token: TextToken,
  _context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> | string {
  const sanitized = sanitizeText(token.raw);
  const escaped = escapeHtml(sanitized);

  if (classNames.text) {
    return createElement('span', { class: classNames.text }, escaped);
  }
  return escaped;
}

/**
 * Render a URL token
 */
function renderUrl(
  token: UrlToken,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const safeUrl = sanitizeUrl(token.url);
  const displayUrl =
    token.raw.length > 50 ? token.raw.slice(0, 47) + '...' : token.raw;

  if (!safeUrl) {
    // Unsafe URL, render as plain text
    return createElement('span', { class: 'text-terminal-red' }, token.raw);
  }

  const handleClick = (e: Event) => {
    if (context.onUrlClick) {
      e.preventDefault();
      context.onUrlClick(safeUrl);
    }
  };

  return createElement(
    'a',
    {
      href: safeUrl,
      target: '_blank',
      rel: 'noopener noreferrer',
      class: classNames.url,
      onClick: handleClick,
      title: token.url,
    },
    displayUrl
  );
}

/**
 * Render a mention token
 */
function renderMention(
  token: MentionToken,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const peerName = context.getPeerName?.(token.pubkey);
  const displayText = peerName || `@${token.pubkey.slice(0, 8)}...`;

  const handleClick = (e: Event) => {
    e.preventDefault();
    context.onMentionClick?.(token.pubkey);
  };

  return createElement(
    'span',
    {
      class: classNames.mention,
      onClick: handleClick,
      title: token.pubkey,
      'data-pubkey': token.pubkey,
    },
    displayText
  );
}

/**
 * Render a hashtag token
 */
function renderHashtag(
  token: HashtagToken,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const handleClick = (e: Event) => {
    e.preventDefault();
    context.onHashtagClick?.(token.tag);
  };

  return createElement(
    'span',
    {
      class: classNames.hashtag,
      onClick: handleClick,
      'data-hashtag': token.tag,
    },
    `#${token.tag}`
  );
}

/**
 * Render a Nostr npub token
 */
function renderNostrNpub(
  token: NostrNpubToken,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const peerName = context.getPeerName?.(token.npub);
  const shortNpub = `${token.npub.slice(0, 8)}...${token.npub.slice(-4)}`;
  const displayText = peerName || shortNpub;

  const handleClick = (e: Event) => {
    e.preventDefault();
    context.onNostrEntityClick?.('npub', token.npub);
  };

  return createElement(
    'span',
    {
      class: classNames.nostrEntity,
      onClick: handleClick,
      title: token.npub,
      'data-npub': token.npub,
    },
    displayText
  );
}

/**
 * Render a Nostr note token
 */
function renderNostrNote(
  token: NostrNoteToken,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const shortNote = `${token.note.slice(0, 8)}...${token.note.slice(-4)}`;

  const handleClick = (e: Event) => {
    e.preventDefault();
    context.onNostrEntityClick?.('note', token.note);
  };

  return createElement(
    'span',
    {
      class: classNames.nostrEntity,
      onClick: handleClick,
      title: token.note,
      'data-note': token.note,
    },
    shortNote
  );
}

/**
 * Render a Nostr nevent token
 */
function renderNostrNevent(
  token: NostrNeventToken,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const shortNevent = `${token.nevent.slice(0, 12)}...`;

  const handleClick = (e: Event) => {
    e.preventDefault();
    context.onNostrEntityClick?.('nevent', token.nevent);
  };

  return createElement(
    'span',
    {
      class: classNames.nostrEntity,
      onClick: handleClick,
      title: token.nevent,
      'data-nevent': token.nevent,
    },
    shortNevent
  );
}

/**
 * Render a Nostr nprofile token
 */
function renderNostrNprofile(
  token: NostrNprofileToken,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const shortNprofile = `${token.nprofile.slice(0, 12)}...`;

  const handleClick = (e: Event) => {
    e.preventDefault();
    context.onNostrEntityClick?.('nprofile', token.nprofile);
  };

  return createElement(
    'span',
    {
      class: classNames.nostrEntity,
      onClick: handleClick,
      title: token.nprofile,
      'data-nprofile': token.nprofile,
    },
    shortNprofile
  );
}

/**
 * Render a Nostr naddr token
 */
function renderNostrNaddr(
  token: NostrNaddrToken,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const shortNaddr = `${token.naddr.slice(0, 12)}...`;

  const handleClick = (e: Event) => {
    e.preventDefault();
    context.onNostrEntityClick?.('naddr', token.naddr);
  };

  return createElement(
    'span',
    {
      class: classNames.nostrEntity,
      onClick: handleClick,
      title: token.naddr,
      'data-naddr': token.naddr,
    },
    shortNaddr
  );
}

/**
 * Render an emoji token
 */
function renderEmoji(
  token: EmojiToken,
  _context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  return createElement(
    'span',
    {
      class: classNames.emoji,
      title: token.shortcode,
      role: 'img',
      'aria-label': token.shortcode.replace(/:/g, ''),
    },
    token.emoji
  );
}

/**
 * Render a code block token
 */
function renderCodeBlock(
  token: CodeBlockToken,
  _context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const sanitizedCode = sanitizeText(token.code);
  const lines = sanitizedCode.split('\n');

  // Header with language and copy button
  const header = createElement(
    'div',
    { class: classNames.codeBlockHeader },
    createElement('span', null, token.language || 'code'),
    createElement(
      'button',
      {
        type: 'button',
        class:
          'text-terminal-green/50 hover:text-terminal-green transition-colors',
        onClick: () => {
          navigator.clipboard?.writeText(sanitizedCode).catch(() => {
            // Fallback for older browsers - copy will fail silently
          });
        },
        title: 'Copy code',
      },
      'copy'
    )
  );

  // Code content with line numbers
  const codeLines = lines.map((line, i) =>
    createElement(
      'div',
      { class: 'flex', key: i },
      createElement(
        'span',
        {
          class:
            'select-none text-terminal-green/30 w-8 text-right pr-3 flex-shrink-0',
        },
        String(i + 1)
      ),
      createElement('span', { class: 'flex-1' }, escapeHtml(line))
    )
  );

  const content = createElement(
    'div',
    { class: classNames.codeBlockContent },
    ...codeLines
  );

  return createElement('div', { class: classNames.codeBlock }, header, content);
}

/**
 * Render an inline code token
 */
function renderInlineCode(
  token: InlineCodeToken,
  _context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode<any> {
  const sanitizedCode = sanitizeText(token.code);
  return createElement(
    'code',
    { class: classNames.inlineCode },
    escapeHtml(sanitizedCode)
  );
}

/**
 * Render a newline token
 */
function renderNewline(): VNode<any> {
  return createElement('br', null);
}

// ============================================================================
// Main Renderer
// ============================================================================

/**
 * Render a single token
 */
function renderToken(
  token: Token,
  context: RenderContext,
  classNames: Required<RenderClassNames>
): VNode | string {
  switch (token.type) {
    case 'text':
      return renderText(token as TextToken, context, classNames);
    case 'url':
      return renderUrl(token as UrlToken, context, classNames);
    case 'mention':
      return renderMention(token as MentionToken, context, classNames);
    case 'hashtag':
      return renderHashtag(token as HashtagToken, context, classNames);
    case 'nostr_npub':
      return renderNostrNpub(token as NostrNpubToken, context, classNames);
    case 'nostr_note':
      return renderNostrNote(token as NostrNoteToken, context, classNames);
    case 'nostr_nevent':
      return renderNostrNevent(token as NostrNeventToken, context, classNames);
    case 'nostr_nprofile':
      return renderNostrNprofile(
        token as NostrNprofileToken,
        context,
        classNames
      );
    case 'nostr_naddr':
      return renderNostrNaddr(token as NostrNaddrToken, context, classNames);
    case 'emoji':
      return renderEmoji(token as EmojiToken, context, classNames);
    case 'code_block':
      return renderCodeBlock(token as CodeBlockToken, context, classNames);
    case 'inline_code':
      return renderInlineCode(token as InlineCodeToken, context, classNames);
    case 'newline':
      return renderNewline();
    default:
      return escapeHtml((token as TextToken).raw);
  }
}

/**
 * Render parsed tokens to VNodes
 */
export function renderTokens(
  tokens: Token[],
  context: RenderContext = {}
): VNode<any> {
  const classNames: Required<RenderClassNames> = {
    ...DEFAULT_CLASS_NAMES,
    ...context.classNames,
  };

  const children = tokens.map((token, index) => {
    const rendered = renderToken(token, context, classNames);
    // Wrap strings in a span with a key for React reconciliation
    if (typeof rendered === 'string') {
      return createElement(Fragment, { key: index }, rendered);
    }
    return createElement(Fragment, { key: index }, rendered);
  });

  return createElement(Fragment, null, ...children);
}

/**
 * Parse and render a message string
 */
export function renderMessage(
  content: string,
  options: RenderOptions = {}
): VNode<any> {
  const {
    parseUrls,
    parseMentions,
    parseHashtags,
    parseNostrEntities,
    parseEmojis,
    parseCode,
    preserveNewlines,
    ...context
  } = options;

  const parserOptions: ParserOptions = {
    parseUrls,
    parseMentions,
    parseHashtags,
    parseNostrEntities,
    parseEmojis,
    parseCode,
    preserveNewlines,
  };

  const result = parseMessage(content, parserOptions);
  return renderTokens(result.tokens, context);
}

/**
 * Parse and render, returning both VNode and parse metadata
 */
export function renderMessageWithMetadata(
  content: string,
  options: RenderOptions = {}
): { vnode: VNode; parseResult: ParseResult } {
  const {
    parseUrls,
    parseMentions,
    parseHashtags,
    parseNostrEntities,
    parseEmojis,
    parseCode,
    preserveNewlines,
    ...context
  } = options;

  const parserOptions: ParserOptions = {
    parseUrls,
    parseMentions,
    parseHashtags,
    parseNostrEntities,
    parseEmojis,
    parseCode,
    preserveNewlines,
  };

  const parseResult = parseMessage(content, parserOptions);
  const vnode = renderTokens(parseResult.tokens, context);

  return { vnode, parseResult };
}

// ============================================================================
// Link Preview Types & Fetching
// ============================================================================

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
}

/**
 * Fetch link preview data (optional, for use with LinkPreview component)
 * Uses a CORS proxy or og:meta extraction service
 */
export async function fetchLinkPreview(
  url: string,
  timeout = 5000
): Promise<LinkPreviewData | null> {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) {
    return null;
  }

  try {
    // Try to fetch Open Graph data
    // In production, you'd want to use a server-side proxy or
    // a service like microlink.io, opengraph.io, etc.
    // For now, we just return basic info extracted from the URL

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Attempt direct fetch (will fail on most sites due to CORS)
      const response = await fetch(safeUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Accept: 'text/html',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Fetch failed');
      }

      const html = await response.text();
      return extractOpenGraphData(html, safeUrl);
    } catch {
      clearTimeout(timeoutId);
      // CORS error or timeout - return basic URL info
      return extractBasicUrlInfo(safeUrl);
    }
  } catch {
    return null;
  }
}

/**
 * Extract Open Graph metadata from HTML
 */
function extractOpenGraphData(html: string, url: string): LinkPreviewData {
  const result: LinkPreviewData = { url };

  // Extract og:title
  const titleMatch = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i
  );
  if (titleMatch && titleMatch[1]) {
    result.title = decodeHtmlEntities(titleMatch[1]);
  } else {
    // Fallback to <title>
    const fallbackTitle = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (fallbackTitle && fallbackTitle[1]) {
      result.title = decodeHtmlEntities(fallbackTitle[1]);
    }
  }

  // Extract og:description
  const descMatch = html.match(
    /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i
  );
  if (descMatch && descMatch[1]) {
    result.description = decodeHtmlEntities(descMatch[1]);
  } else {
    // Fallback to meta description
    const fallbackDesc = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i
    );
    if (fallbackDesc && fallbackDesc[1]) {
      result.description = decodeHtmlEntities(fallbackDesc[1]);
    }
  }

  // Extract og:image
  const imageMatch = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i
  );
  if (imageMatch && imageMatch[1]) {
    result.image = imageMatch[1];
  }

  // Extract og:site_name
  const siteMatch = html.match(
    /<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']*)["']/i
  );
  if (siteMatch && siteMatch[1]) {
    result.siteName = decodeHtmlEntities(siteMatch[1]);
  }

  // Extract favicon
  const iconMatch = html.match(
    /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i
  );
  if (iconMatch && iconMatch[1]) {
    // Resolve relative URLs
    try {
      const baseUrl = new URL(url);
      result.favicon = new URL(iconMatch[1], baseUrl).href;
    } catch {
      result.favicon = iconMatch[1];
    }
  }

  return result;
}

/**
 * Extract basic info from URL when fetch fails
 */
function extractBasicUrlInfo(url: string): LinkPreviewData {
  try {
    const parsed = new URL(url);
    return {
      url,
      title: parsed.hostname,
      siteName: parsed.hostname,
    };
  } catch {
    return { url };
  }
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
  };

  return text.replace(
    /&(?:#x?[0-9a-f]+|[a-z]+);/gi,
    (match) => entities[match] || match
  );
}
