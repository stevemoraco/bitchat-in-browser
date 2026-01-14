/**
 * Message Parser for BitChat
 *
 * Parses raw message content into structured tokens for rendering.
 * Supports URLs, @mentions, #hashtags, Nostr entities, emoji shortcodes,
 * and code blocks.
 */

// ============================================================================
// Token Types
// ============================================================================

export type TokenType =
  | 'text'
  | 'url'
  | 'mention'
  | 'hashtag'
  | 'nostr_npub'
  | 'nostr_note'
  | 'nostr_nevent'
  | 'nostr_nprofile'
  | 'nostr_naddr'
  | 'emoji'
  | 'code_block'
  | 'inline_code'
  | 'newline';

export interface BaseToken {
  type: TokenType;
  raw: string;
  start: number;
  end: number;
}

export interface TextToken extends BaseToken {
  type: 'text';
}

export interface UrlToken extends BaseToken {
  type: 'url';
  url: string;
  protocol: string;
  domain: string;
  path: string;
}

export interface MentionToken extends BaseToken {
  type: 'mention';
  pubkey: string;
  isNpub: boolean;
}

export interface HashtagToken extends BaseToken {
  type: 'hashtag';
  tag: string;
}

export interface NostrNpubToken extends BaseToken {
  type: 'nostr_npub';
  npub: string;
  pubkeyHex?: string;
}

export interface NostrNoteToken extends BaseToken {
  type: 'nostr_note';
  note: string;
  eventIdHex?: string;
}

export interface NostrNeventToken extends BaseToken {
  type: 'nostr_nevent';
  nevent: string;
  eventIdHex?: string;
  relays?: string[];
}

export interface NostrNprofileToken extends BaseToken {
  type: 'nostr_nprofile';
  nprofile: string;
  pubkeyHex?: string;
  relays?: string[];
}

export interface NostrNaddrToken extends BaseToken {
  type: 'nostr_naddr';
  naddr: string;
  kind?: number;
  pubkeyHex?: string;
  identifier?: string;
  relays?: string[];
}

export interface EmojiToken extends BaseToken {
  type: 'emoji';
  shortcode: string;
  emoji: string;
}

export interface CodeBlockToken extends BaseToken {
  type: 'code_block';
  code: string;
  language?: string;
}

export interface InlineCodeToken extends BaseToken {
  type: 'inline_code';
  code: string;
}

export interface NewlineToken extends BaseToken {
  type: 'newline';
}

export type Token =
  | TextToken
  | UrlToken
  | MentionToken
  | HashtagToken
  | NostrNpubToken
  | NostrNoteToken
  | NostrNeventToken
  | NostrNprofileToken
  | NostrNaddrToken
  | EmojiToken
  | CodeBlockToken
  | InlineCodeToken
  | NewlineToken;

// ============================================================================
// Common Emoji Shortcodes
// ============================================================================

const EMOJI_SHORTCODES: Record<string, string> = {
  // Smileys
  ':smile:': '\u{1F604}',
  ':grin:': '\u{1F601}',
  ':joy:': '\u{1F602}',
  ':rofl:': '\u{1F923}',
  ':wink:': '\u{1F609}',
  ':blush:': '\u{1F60A}',
  ':innocent:': '\u{1F607}',
  ':heart_eyes:': '\u{1F60D}',
  ':kissing_heart:': '\u{1F618}',
  ':stuck_out_tongue:': '\u{1F61B}',
  ':stuck_out_tongue_winking_eye:': '\u{1F61C}',
  ':sunglasses:': '\u{1F60E}',
  ':thinking:': '\u{1F914}',
  ':unamused:': '\u{1F612}',
  ':disappointed:': '\u{1F61E}',
  ':worried:': '\u{1F61F}',
  ':angry:': '\u{1F620}',
  ':rage:': '\u{1F621}',
  ':cry:': '\u{1F622}',
  ':sob:': '\u{1F62D}',
  ':scream:': '\u{1F631}',
  ':fearful:': '\u{1F628}',
  ':cold_sweat:': '\u{1F630}',
  ':sweat:': '\u{1F613}',
  ':sleeping:': '\u{1F634}',
  ':mask:': '\u{1F637}',
  ':skull:': '\u{1F480}',
  ':ghost:': '\u{1F47B}',
  ':alien:': '\u{1F47D}',
  ':robot:': '\u{1F916}',
  ':smiling_imp:': '\u{1F608}',
  ':poop:': '\u{1F4A9}',
  ':clown:': '\u{1F921}',
  // Gestures
  ':+1:': '\u{1F44D}',
  ':thumbsup:': '\u{1F44D}',
  ':-1:': '\u{1F44E}',
  ':thumbsdown:': '\u{1F44E}',
  ':ok_hand:': '\u{1F44C}',
  ':punch:': '\u{1F44A}',
  ':fist:': '\u{270A}',
  ':wave:': '\u{1F44B}',
  ':raised_hand:': '\u{270B}',
  ':clap:': '\u{1F44F}',
  ':pray:': '\u{1F64F}',
  ':muscle:': '\u{1F4AA}',
  ':point_up:': '\u{261D}',
  ':point_down:': '\u{1F447}',
  ':point_left:': '\u{1F448}',
  ':point_right:': '\u{1F449}',
  ':middle_finger:': '\u{1F595}',
  ':writing_hand:': '\u{270D}',
  // Hearts
  ':heart:': '\u{2764}',
  ':red_heart:': '\u{2764}',
  ':orange_heart:': '\u{1F9E1}',
  ':yellow_heart:': '\u{1F49B}',
  ':green_heart:': '\u{1F49A}',
  ':blue_heart:': '\u{1F499}',
  ':purple_heart:': '\u{1F49C}',
  ':black_heart:': '\u{1F5A4}',
  ':broken_heart:': '\u{1F494}',
  ':sparkling_heart:': '\u{1F496}',
  ':two_hearts:': '\u{1F495}',
  ':revolving_hearts:': '\u{1F49E}',
  ':heartbeat:': '\u{1F493}',
  ':heartpulse:': '\u{1F497}',
  // Symbols
  ':fire:': '\u{1F525}',
  ':100:': '\u{1F4AF}',
  ':star:': '\u{2B50}',
  ':sparkles:': '\u{2728}',
  ':zap:': '\u{26A1}',
  ':boom:': '\u{1F4A5}',
  ':collision:': '\u{1F4A5}',
  ':lightning:': '\u{1F329}',
  ':rainbow:': '\u{1F308}',
  ':sun:': '\u{2600}',
  ':moon:': '\u{1F319}',
  ':cloud:': '\u{2601}',
  ':snowflake:': '\u{2744}',
  ':droplet:': '\u{1F4A7}',
  ':ocean:': '\u{1F30A}',
  ':warning:': '\u{26A0}',
  ':x:': '\u{274C}',
  ':check:': '\u{2714}',
  ':white_check_mark:': '\u{2705}',
  ':question:': '\u{2753}',
  ':exclamation:': '\u{2757}',
  // Objects
  ':key:': '\u{1F511}',
  ':lock:': '\u{1F512}',
  ':unlock:': '\u{1F513}',
  ':bell:': '\u{1F514}',
  ':no_bell:': '\u{1F515}',
  ':bookmark:': '\u{1F516}',
  ':link:': '\u{1F517}',
  ':paperclip:': '\u{1F4CE}',
  ':scissors:': '\u{2702}',
  ':pencil:': '\u{270F}',
  ':pen:': '\u{1F58A}',
  ':memo:': '\u{1F4DD}',
  ':bulb:': '\u{1F4A1}',
  ':gear:': '\u{2699}',
  ':wrench:': '\u{1F527}',
  ':hammer:': '\u{1F528}',
  ':computer:': '\u{1F4BB}',
  ':phone:': '\u{1F4F1}',
  ':camera:': '\u{1F4F7}',
  ':tv:': '\u{1F4FA}',
  ':radio:': '\u{1F4FB}',
  ':speaker:': '\u{1F50A}',
  ':mute:': '\u{1F507}',
  ':microphone:': '\u{1F3A4}',
  ':movie_camera:': '\u{1F3A5}',
  // Animals
  ':dog:': '\u{1F436}',
  ':cat:': '\u{1F431}',
  ':mouse:': '\u{1F42D}',
  ':hamster:': '\u{1F439}',
  ':rabbit:': '\u{1F430}',
  ':fox:': '\u{1F98A}',
  ':bear:': '\u{1F43B}',
  ':panda:': '\u{1F43C}',
  ':koala:': '\u{1F428}',
  ':tiger:': '\u{1F42F}',
  ':lion:': '\u{1F981}',
  ':cow:': '\u{1F42E}',
  ':pig:': '\u{1F437}',
  ':frog:': '\u{1F438}',
  ':monkey:': '\u{1F435}',
  ':chicken:': '\u{1F414}',
  ':penguin:': '\u{1F427}',
  ':bird:': '\u{1F426}',
  ':eagle:': '\u{1F985}',
  ':owl:': '\u{1F989}',
  ':bat:': '\u{1F987}',
  ':wolf:': '\u{1F43A}',
  ':unicorn:': '\u{1F984}',
  ':bee:': '\u{1F41D}',
  ':bug:': '\u{1F41B}',
  ':butterfly:': '\u{1F98B}',
  ':snail:': '\u{1F40C}',
  ':turtle:': '\u{1F422}',
  ':snake:': '\u{1F40D}',
  ':dragon:': '\u{1F409}',
  ':whale:': '\u{1F433}',
  ':dolphin:': '\u{1F42C}',
  ':fish:': '\u{1F41F}',
  ':octopus:': '\u{1F419}',
  ':crab:': '\u{1F980}',
  // Food
  ':apple:': '\u{1F34E}',
  ':banana:': '\u{1F34C}',
  ':orange:': '\u{1F34A}',
  ':lemon:': '\u{1F34B}',
  ':watermelon:': '\u{1F349}',
  ':grapes:': '\u{1F347}',
  ':strawberry:': '\u{1F353}',
  ':peach:': '\u{1F351}',
  ':cherries:': '\u{1F352}',
  ':pizza:': '\u{1F355}',
  ':burger:': '\u{1F354}',
  ':fries:': '\u{1F35F}',
  ':hotdog:': '\u{1F32D}',
  ':taco:': '\u{1F32E}',
  ':burrito:': '\u{1F32F}',
  ':popcorn:': '\u{1F37F}',
  ':cake:': '\u{1F370}',
  ':cookie:': '\u{1F36A}',
  ':chocolate:': '\u{1F36B}',
  ':candy:': '\u{1F36C}',
  ':lollipop:': '\u{1F36D}',
  ':donut:': '\u{1F369}',
  ':icecream:': '\u{1F368}',
  ':coffee:': '\u{2615}',
  ':tea:': '\u{1F375}',
  ':beer:': '\u{1F37A}',
  ':wine:': '\u{1F377}',
  ':cocktail:': '\u{1F378}',
  ':champagne:': '\u{1F37E}',
  // Activities
  ':soccer:': '\u{26BD}',
  ':basketball:': '\u{1F3C0}',
  ':football:': '\u{1F3C8}',
  ':baseball:': '\u{26BE}',
  ':tennis:': '\u{1F3BE}',
  ':golf:': '\u{26F3}',
  ':trophy:': '\u{1F3C6}',
  ':medal:': '\u{1F3C5}',
  ':gamepad:': '\u{1F3AE}',
  ':joystick:': '\u{1F579}',
  ':dice:': '\u{1F3B2}',
  ':chess:': '\u{265F}',
  ':dart:': '\u{1F3AF}',
  ':bowling:': '\u{1F3B3}',
  ':guitar:': '\u{1F3B8}',
  ':piano:': '\u{1F3B9}',
  ':drum:': '\u{1F941}',
  ':art:': '\u{1F3A8}',
  // Crypto/Tech
  ':bitcoin:': '\u{20BF}',
  ':rocket:': '\u{1F680}',
  ':satellite:': '\u{1F6F0}',
  ':flying_saucer:': '\u{1F6F8}',
};

// ============================================================================
// Regex Patterns
// ============================================================================

// URL pattern - matches http/https URLs and some common TLDs without protocol
const URL_PATTERN = /https?:\/\/[^\s<>[\]{}|\\^`]+|(?:www\.)[^\s<>[\]{}|\\^`]+/gi;

// Mention pattern - @npub1... or @hex pubkey (64 chars)
const MENTION_PATTERN = /@(npub1[a-z0-9]{58,59}|[a-f0-9]{64})/gi;

// Hashtag pattern - #word (letters, numbers, underscore, but not all numbers)
const HASHTAG_PATTERN = /#([a-zA-Z_][a-zA-Z0-9_]*)/g;

// Nostr entity patterns (bech32)
const NPUB_PATTERN = /npub1[a-z0-9]{58,59}/gi;
const NOTE_PATTERN = /note1[a-z0-9]{58,59}/gi;
const NEVENT_PATTERN = /nevent1[a-z0-9]+/gi;
const NPROFILE_PATTERN = /nprofile1[a-z0-9]+/gi;
const NADDR_PATTERN = /naddr1[a-z0-9]+/gi;

// Emoji shortcode pattern
const EMOJI_PATTERN = /:[a-z0-9_+-]+:/gi;

// Code block pattern (multiline, with optional language)
const CODE_BLOCK_PATTERN = /```(\w*)\n?([\s\S]*?)```/g;

// Inline code pattern (single backticks)
const INLINE_CODE_PATTERN = /`([^`\n]+)`/g;

// Newline pattern
const NEWLINE_PATTERN = /\n/g;

// ============================================================================
// Parser Interface
// ============================================================================

export interface ParseResult {
  tokens: Token[];
  hasUrls: boolean;
  hasMentions: boolean;
  hasHashtags: boolean;
  hasNostrEntities: boolean;
  hasCode: boolean;
  hasEmoji: boolean;
  mentionedPubkeys: string[];
  hashtags: string[];
  urls: string[];
}

export interface ParserOptions {
  /** Parse URLs */
  parseUrls?: boolean;
  /** Parse @mentions */
  parseMentions?: boolean;
  /** Parse #hashtags */
  parseHashtags?: boolean;
  /** Parse Nostr entities (npub, note, nevent, etc.) */
  parseNostrEntities?: boolean;
  /** Parse emoji shortcodes */
  parseEmojis?: boolean;
  /** Parse code blocks and inline code */
  parseCode?: boolean;
  /** Preserve newlines as separate tokens */
  preserveNewlines?: boolean;
}

const DEFAULT_OPTIONS: ParserOptions = {
  parseUrls: true,
  parseMentions: true,
  parseHashtags: true,
  parseNostrEntities: true,
  parseEmojis: true,
  parseCode: true,
  preserveNewlines: true,
};

// ============================================================================
// Match Interface (for sorting)
// ============================================================================

interface Match {
  type: TokenType;
  start: number;
  end: number;
  raw: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Parser Implementation
// ============================================================================

/**
 * Parse a message into tokens
 */
export function parseMessage(
  content: string,
  options: ParserOptions = {}
): ParseResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const matches: Match[] = [];

  // Collect all matches first, then sort and process
  // This prevents overlapping issues

  // Parse code blocks first (they take precedence)
  if (opts.parseCode) {
    // Code blocks
    let match;
    CODE_BLOCK_PATTERN.lastIndex = 0;
    while ((match = CODE_BLOCK_PATTERN.exec(content)) !== null) {
      matches.push({
        type: 'code_block',
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0],
        data: {
          language: match[1] || undefined,
          code: match[2],
        },
      });
    }

    // Inline code
    INLINE_CODE_PATTERN.lastIndex = 0;
    while ((match = INLINE_CODE_PATTERN.exec(content)) !== null) {
      // Check if this is inside a code block
      const matchIndex = match.index;
      const isInsideCodeBlock = matches.some(
        (m) =>
          m.type === 'code_block' &&
          matchIndex >= m.start &&
          matchIndex < m.end
      );
      if (!isInsideCodeBlock) {
        matches.push({
          type: 'inline_code',
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          data: {
            code: match[1],
          },
        });
      }
    }
  }

  // Helper to check if position is inside code
  const isInsideCode = (pos: number): boolean => matches.some(
      (m) =>
        (m.type === 'code_block' || m.type === 'inline_code') &&
        pos >= m.start &&
        pos < m.end
    );

  // Parse URLs
  if (opts.parseUrls) {
    let match;
    URL_PATTERN.lastIndex = 0;
    while ((match = URL_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        let url = match[0];
        // Clean trailing punctuation that's not part of URL
        const trailingPunct = /[.,;:!?)]+$/;
        const trailingMatch = url.match(trailingPunct);
        if (trailingMatch) {
          // Check for matching parens
          const openParens = (url.match(/\(/g) || []).length;
          const closeParens = (url.match(/\)/g) || []).length;
          if (closeParens > openParens) {
            url = url.slice(0, -trailingMatch[0].length);
          } else if (!url.endsWith(')')) {
            url = url.slice(0, -trailingMatch[0].length);
          }
        }

        try {
          const urlObj = new URL(
            url.startsWith('www.') ? `https://${url}` : url
          );
          matches.push({
            type: 'url',
            start: match.index,
            end: match.index + url.length,
            raw: url,
            data: {
              url: urlObj.href,
              protocol: urlObj.protocol.replace(':', ''),
              domain: urlObj.hostname,
              path: urlObj.pathname + urlObj.search + urlObj.hash,
            },
          });
        } catch {
          // Invalid URL, skip
        }
      }
    }
  }

  // Parse mentions
  if (opts.parseMentions) {
    let match;
    MENTION_PATTERN.lastIndex = 0;
    while ((match = MENTION_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        const captured = match[1] ?? '';
        const isNpub = captured.startsWith('npub1');
        matches.push({
          type: 'mention',
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          data: {
            pubkey: captured,
            isNpub,
          },
        });
      }
    }
  }

  // Parse hashtags
  if (opts.parseHashtags) {
    let match;
    HASHTAG_PATTERN.lastIndex = 0;
    while ((match = HASHTAG_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        matches.push({
          type: 'hashtag',
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          data: {
            tag: match[1],
          },
        });
      }
    }
  }

  // Parse Nostr entities
  if (opts.parseNostrEntities) {
    // npub
    let match;
    NPUB_PATTERN.lastIndex = 0;
    while ((match = NPUB_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        // Check if this is already part of a mention
        const npubMatchIndex = match.index;
        const isMention = matches.some(
          (m) =>
            m.type === 'mention' &&
            npubMatchIndex >= m.start &&
            npubMatchIndex < m.end
        );
        if (!isMention) {
          matches.push({
            type: 'nostr_npub',
            start: match.index,
            end: match.index + match[0].length,
            raw: match[0],
            data: {
              npub: match[0],
            },
          });
        }
      }
    }

    // note
    NOTE_PATTERN.lastIndex = 0;
    while ((match = NOTE_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        matches.push({
          type: 'nostr_note',
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          data: {
            note: match[0],
          },
        });
      }
    }

    // nevent
    NEVENT_PATTERN.lastIndex = 0;
    while ((match = NEVENT_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        matches.push({
          type: 'nostr_nevent',
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          data: {
            nevent: match[0],
          },
        });
      }
    }

    // nprofile
    NPROFILE_PATTERN.lastIndex = 0;
    while ((match = NPROFILE_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        matches.push({
          type: 'nostr_nprofile',
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          data: {
            nprofile: match[0],
          },
        });
      }
    }

    // naddr
    NADDR_PATTERN.lastIndex = 0;
    while ((match = NADDR_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        matches.push({
          type: 'nostr_naddr',
          start: match.index,
          end: match.index + match[0].length,
          raw: match[0],
          data: {
            naddr: match[0],
          },
        });
      }
    }
  }

  // Parse emojis
  if (opts.parseEmojis) {
    let match;
    EMOJI_PATTERN.lastIndex = 0;
    while ((match = EMOJI_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        const shortcode = match[0].toLowerCase();
        const emoji = EMOJI_SHORTCODES[shortcode];
        if (emoji) {
          matches.push({
            type: 'emoji',
            start: match.index,
            end: match.index + match[0].length,
            raw: match[0],
            data: {
              shortcode: match[0],
              emoji,
            },
          });
        }
      }
    }
  }

  // Parse newlines
  if (opts.preserveNewlines) {
    let match;
    NEWLINE_PATTERN.lastIndex = 0;
    while ((match = NEWLINE_PATTERN.exec(content)) !== null) {
      if (!isInsideCode(match.index)) {
        matches.push({
          type: 'newline',
          start: match.index,
          end: match.index + 1,
          raw: '\n',
          data: {},
        });
      }
    }
  }

  // Sort matches by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep first)
  const nonOverlapping: Match[] = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      nonOverlapping.push(match);
      lastEnd = match.end;
    }
  }

  // Build tokens with text segments
  const tokens: Token[] = [];
  let pos = 0;

  for (const match of nonOverlapping) {
    // Add text before this match
    if (match.start > pos) {
      tokens.push({
        type: 'text',
        raw: content.slice(pos, match.start),
        start: pos,
        end: match.start,
      });
    }

    // Add the matched token
    tokens.push(buildToken(match));
    pos = match.end;
  }

  // Add remaining text
  if (pos < content.length) {
    tokens.push({
      type: 'text',
      raw: content.slice(pos),
      start: pos,
      end: content.length,
    });
  }

  // Build result
  const mentionedPubkeys: string[] = [];
  const hashtags: string[] = [];
  const urls: string[] = [];

  for (const token of tokens) {
    if (token.type === 'mention') {
      mentionedPubkeys.push((token).pubkey);
    } else if (token.type === 'hashtag') {
      hashtags.push((token).tag);
    } else if (token.type === 'url') {
      urls.push((token).url);
    }
  }

  return {
    tokens,
    hasUrls: urls.length > 0,
    hasMentions: mentionedPubkeys.length > 0,
    hasHashtags: hashtags.length > 0,
    hasNostrEntities: tokens.some(
      (t) =>
        t.type === 'nostr_npub' ||
        t.type === 'nostr_note' ||
        t.type === 'nostr_nevent' ||
        t.type === 'nostr_nprofile' ||
        t.type === 'nostr_naddr'
    ),
    hasCode: tokens.some(
      (t) => t.type === 'code_block' || t.type === 'inline_code'
    ),
    hasEmoji: tokens.some((t) => t.type === 'emoji'),
    mentionedPubkeys,
    hashtags,
    urls,
  };
}

/**
 * Build a Token from a Match
 */
function buildToken(match: Match): Token {
  const base: BaseToken = {
    type: match.type,
    raw: match.raw,
    start: match.start,
    end: match.end,
  };

  switch (match.type) {
    case 'url':
      return {
        ...base,
        type: 'url',
        url: match.data.url as string,
        protocol: match.data.protocol as string,
        domain: match.data.domain as string,
        path: match.data.path as string,
      };
    case 'mention':
      return {
        ...base,
        type: 'mention',
        pubkey: match.data.pubkey as string,
        isNpub: match.data.isNpub as boolean,
      };
    case 'hashtag':
      return {
        ...base,
        type: 'hashtag',
        tag: match.data.tag as string,
      };
    case 'nostr_npub':
      return {
        ...base,
        type: 'nostr_npub',
        npub: match.data.npub as string,
      };
    case 'nostr_note':
      return {
        ...base,
        type: 'nostr_note',
        note: match.data.note as string,
      };
    case 'nostr_nevent':
      return {
        ...base,
        type: 'nostr_nevent',
        nevent: match.data.nevent as string,
      };
    case 'nostr_nprofile':
      return {
        ...base,
        type: 'nostr_nprofile',
        nprofile: match.data.nprofile as string,
      };
    case 'nostr_naddr':
      return {
        ...base,
        type: 'nostr_naddr',
        naddr: match.data.naddr as string,
      };
    case 'emoji':
      return {
        ...base,
        type: 'emoji',
        shortcode: match.data.shortcode as string,
        emoji: match.data.emoji as string,
      };
    case 'code_block':
      return {
        ...base,
        type: 'code_block',
        code: match.data.code as string,
        language: match.data.language as string | undefined,
      };
    case 'inline_code':
      return {
        ...base,
        type: 'inline_code',
        code: match.data.code as string,
      };
    case 'newline':
      return {
        ...base,
        type: 'newline',
      };
    default:
      return base as TextToken;
  }
}

/**
 * Check if a string contains any parseable content
 */
export function containsFormattableContent(
  content: string,
  options: ParserOptions = {}
): boolean {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.parseCode) {
    if (CODE_BLOCK_PATTERN.test(content) || INLINE_CODE_PATTERN.test(content)) {
      return true;
    }
  }

  if (opts.parseUrls && URL_PATTERN.test(content)) {
    return true;
  }

  if (opts.parseMentions && MENTION_PATTERN.test(content)) {
    return true;
  }

  if (opts.parseHashtags && HASHTAG_PATTERN.test(content)) {
    return true;
  }

  if (opts.parseNostrEntities) {
    if (
      NPUB_PATTERN.test(content) ||
      NOTE_PATTERN.test(content) ||
      NEVENT_PATTERN.test(content) ||
      NPROFILE_PATTERN.test(content) ||
      NADDR_PATTERN.test(content)
    ) {
      return true;
    }
  }

  if (opts.parseEmojis && EMOJI_PATTERN.test(content)) {
    // Check if any shortcode is valid
    const matches = content.match(EMOJI_PATTERN);
    if (matches) {
      for (const match of matches) {
        if (EMOJI_SHORTCODES[match.toLowerCase()]) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Get all available emoji shortcodes
 */
export function getEmojiShortcodes(): Record<string, string> {
  return { ...EMOJI_SHORTCODES };
}

/**
 * Lookup an emoji by shortcode
 */
export function lookupEmoji(shortcode: string): string | undefined {
  const normalized = shortcode.toLowerCase();
  const withColons = normalized.startsWith(':')
    ? normalized
    : `:${normalized}:`;
  return EMOJI_SHORTCODES[withColons];
}

/**
 * Search emoji shortcodes
 */
export function searchEmojis(query: string): Array<{ shortcode: string; emoji: string }> {
  const normalizedQuery = query.toLowerCase().replace(/:/g, '');
  const results: Array<{ shortcode: string; emoji: string }> = [];

  for (const [shortcode, emoji] of Object.entries(EMOJI_SHORTCODES)) {
    if (shortcode.toLowerCase().includes(normalizedQuery)) {
      results.push({ shortcode, emoji });
    }
  }

  // Sort by relevance (starts with query first)
  results.sort((a, b) => {
    const aStarts = a.shortcode.slice(1).startsWith(normalizedQuery);
    const bStarts = b.shortcode.slice(1).startsWith(normalizedQuery);
    if (aStarts && !bStarts) return -1;
    if (bStarts && !aStarts) return 1;
    return a.shortcode.localeCompare(b.shortcode);
  });

  return results;
}

/**
 * Extract plain text from parsed tokens (strip formatting)
 */
export function tokensToPlainText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      switch (token.type) {
        case 'emoji':
          return (token).emoji;
        case 'code_block':
          return (token).code;
        case 'inline_code':
          return (token).code;
        case 'newline':
          return '\n';
        default:
          return token.raw;
      }
    })
    .join('');
}
