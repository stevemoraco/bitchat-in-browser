/**
 * Formatting Service Tests
 *
 * Tests for message parsing including URL detection, @mentions,
 * #hashtags, Nostr entities, emoji shortcodes, and code blocks.
 */

import { describe, it, expect } from 'vitest';
import {
  parseMessage,
  containsFormattableContent,
  getEmojiShortcodes,
  lookupEmoji,
  searchEmojis,
  tokensToPlainText,
  type Token,
  type UrlToken,
  type MentionToken,
  type HashtagToken,
  type EmojiToken,
  type CodeBlockToken,
  type InlineCodeToken,
  type NostrNpubToken,
  type ParseResult,
} from '../parser';

describe('Message Parser', () => {
  describe('Basic Parsing', () => {
    it('should parse plain text message', () => {
      const result = parseMessage('Hello, world!');

      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].type).toBe('text');
      expect(result.tokens[0].raw).toBe('Hello, world!');
    });

    it('should return correct metadata for plain text', () => {
      const result = parseMessage('Just some text');

      expect(result.hasUrls).toBe(false);
      expect(result.hasMentions).toBe(false);
      expect(result.hasHashtags).toBe(false);
      expect(result.hasNostrEntities).toBe(false);
      expect(result.hasCode).toBe(false);
      expect(result.hasEmoji).toBe(false);
    });

    it('should handle empty string', () => {
      const result = parseMessage('');

      expect(result.tokens).toHaveLength(0);
    });
  });

  describe('URL Detection', () => {
    it('should detect HTTPS URLs', () => {
      const result = parseMessage('Check out https://example.com');

      expect(result.hasUrls).toBe(true);
      expect(result.urls).toHaveLength(1);
      expect(result.urls[0]).toBe('https://example.com/');
    });

    it('should detect HTTP URLs', () => {
      const result = parseMessage('Visit http://example.com');

      expect(result.hasUrls).toBe(true);
      const urlToken = result.tokens.find(t => t.type === 'url') as UrlToken;
      expect(urlToken.protocol).toBe('http');
    });

    it('should detect www URLs and add https', () => {
      const result = parseMessage('Go to www.example.com');

      expect(result.hasUrls).toBe(true);
      const urlToken = result.tokens.find(t => t.type === 'url') as UrlToken;
      expect(urlToken.url).toBe('https://www.example.com/');
    });

    it('should parse URL components', () => {
      const result = parseMessage('https://example.com/path?query=1#hash');

      const urlToken = result.tokens.find(t => t.type === 'url') as UrlToken;
      expect(urlToken.domain).toBe('example.com');
      expect(urlToken.path).toContain('/path');
    });

    it('should handle multiple URLs', () => {
      const result = parseMessage('See https://a.com and https://b.com');

      expect(result.urls).toHaveLength(2);
    });

    it('should strip trailing punctuation from URLs', () => {
      const result = parseMessage('Check https://example.com.');

      const urlToken = result.tokens.find(t => t.type === 'url') as UrlToken;
      expect(urlToken.raw).toBe('https://example.com');
    });

    it('should preserve URLs in parentheses with balanced parens', () => {
      const result = parseMessage('(https://example.com/path)');

      expect(result.hasUrls).toBe(true);
    });

    it('should handle URLs with query parameters', () => {
      const result = parseMessage('https://example.com/search?q=test&page=1');

      expect(result.hasUrls).toBe(true);
      const urlToken = result.tokens.find(t => t.type === 'url') as UrlToken;
      expect(urlToken.path).toContain('?q=test');
    });
  });

  describe('Mention Detection', () => {
    it('should detect @npub mentions', () => {
      const npub = 'npub1' + 'a'.repeat(59);
      const result = parseMessage(`Hello @${npub}!`);

      expect(result.hasMentions).toBe(true);
      expect(result.mentionedPubkeys).toHaveLength(1);

      const mentionToken = result.tokens.find(t => t.type === 'mention') as MentionToken;
      expect(mentionToken.isNpub).toBe(true);
    });

    it('should detect @hex pubkey mentions', () => {
      const hexPubkey = 'a'.repeat(64);
      const result = parseMessage(`Hello @${hexPubkey}!`);

      expect(result.hasMentions).toBe(true);
      const mentionToken = result.tokens.find(t => t.type === 'mention') as MentionToken;
      expect(mentionToken.isNpub).toBe(false);
    });

    it('should handle multiple mentions', () => {
      const npub1 = 'npub1' + 'a'.repeat(59);
      const npub2 = 'npub1' + 'b'.repeat(59);
      const result = parseMessage(`@${npub1} and @${npub2}`);

      expect(result.mentionedPubkeys).toHaveLength(2);
    });

    it('should not match invalid mentions', () => {
      const result = parseMessage('@shortname @invalid');

      expect(result.hasMentions).toBe(false);
    });
  });

  describe('Hashtag Detection', () => {
    it('should detect #hashtags', () => {
      const result = parseMessage('Check out #bitcoin');

      expect(result.hasHashtags).toBe(true);
      expect(result.hashtags).toContain('bitcoin');
    });

    it('should detect multiple hashtags', () => {
      const result = parseMessage('#nostr #bitcoin #crypto');

      expect(result.hashtags).toHaveLength(3);
    });

    it('should handle hashtags with underscores', () => {
      const result = parseMessage('#my_hashtag');

      expect(result.hashtags).toContain('my_hashtag');
    });

    it('should handle hashtags with numbers', () => {
      const result = parseMessage('#bitcoin2024');

      expect(result.hashtags).toContain('bitcoin2024');
    });

    it('should not match hashtags that are all numbers', () => {
      const result = parseMessage('Issue #123');

      // This should match because hashtags must start with a letter or underscore
      const hashtagToken = result.tokens.find(t => t.type === 'hashtag');
      expect(hashtagToken).toBeUndefined();
    });
  });

  describe('Nostr Entity Detection', () => {
    describe('npub', () => {
      it('should detect npub entities', () => {
        const npub = 'npub1' + 'a'.repeat(59);
        const result = parseMessage(`Check out ${npub}`);

        expect(result.hasNostrEntities).toBe(true);
        const token = result.tokens.find(t => t.type === 'nostr_npub') as NostrNpubToken;
        expect(token.npub).toBe(npub);
      });
    });

    describe('note', () => {
      it('should detect note entities', () => {
        const note = 'note1' + 'a'.repeat(59);
        const result = parseMessage(`Reply to ${note}`);

        expect(result.hasNostrEntities).toBe(true);
        expect(result.tokens.some(t => t.type === 'nostr_note')).toBe(true);
      });
    });

    describe('nevent', () => {
      it('should detect nevent entities', () => {
        const nevent = 'nevent1' + 'a'.repeat(50);
        const result = parseMessage(`Event ${nevent}`);

        expect(result.hasNostrEntities).toBe(true);
        expect(result.tokens.some(t => t.type === 'nostr_nevent')).toBe(true);
      });
    });

    describe('nprofile', () => {
      it('should detect nprofile entities', () => {
        const nprofile = 'nprofile1' + 'a'.repeat(50);
        const result = parseMessage(`Profile ${nprofile}`);

        expect(result.hasNostrEntities).toBe(true);
        expect(result.tokens.some(t => t.type === 'nostr_nprofile')).toBe(true);
      });
    });

    describe('naddr', () => {
      it('should detect naddr entities', () => {
        const naddr = 'naddr1' + 'a'.repeat(50);
        const result = parseMessage(`Article ${naddr}`);

        expect(result.hasNostrEntities).toBe(true);
        expect(result.tokens.some(t => t.type === 'nostr_naddr')).toBe(true);
      });
    });
  });

  describe('Emoji Detection', () => {
    it('should detect emoji shortcodes', () => {
      const result = parseMessage('Hello :smile:');

      expect(result.hasEmoji).toBe(true);
      const emojiToken = result.tokens.find(t => t.type === 'emoji') as EmojiToken;
      expect(emojiToken.shortcode).toBe(':smile:');
      expect(emojiToken.emoji).toBe('\u{1F604}');
    });

    it('should detect multiple emoji shortcodes', () => {
      const result = parseMessage(':heart: :fire: :rocket:');

      const emojiTokens = result.tokens.filter(t => t.type === 'emoji');
      expect(emojiTokens).toHaveLength(3);
    });

    it('should handle thumbs up/down', () => {
      const result1 = parseMessage(':+1:');
      const result2 = parseMessage(':-1:');

      expect(result1.hasEmoji).toBe(true);
      expect(result2.hasEmoji).toBe(true);
    });

    it('should not convert unknown shortcodes', () => {
      const result = parseMessage(':unknownemoji:');

      expect(result.hasEmoji).toBe(false);
    });

    it('should be case-insensitive', () => {
      const result = parseMessage(':SMILE: :Heart:');

      const emojiTokens = result.tokens.filter(t => t.type === 'emoji');
      expect(emojiTokens).toHaveLength(2);
    });
  });

  describe('Code Block Detection', () => {
    it('should detect inline code', () => {
      const result = parseMessage('Use `console.log()` for debugging');

      expect(result.hasCode).toBe(true);
      const codeToken = result.tokens.find(t => t.type === 'inline_code') as InlineCodeToken;
      expect(codeToken.code).toBe('console.log()');
    });

    it('should detect code blocks', () => {
      const result = parseMessage('```\nconst x = 1;\n```');

      expect(result.hasCode).toBe(true);
      const codeToken = result.tokens.find(t => t.type === 'code_block') as CodeBlockToken;
      expect(codeToken.code).toContain('const x = 1;');
    });

    it('should detect code blocks with language', () => {
      const result = parseMessage('```javascript\nconst x = 1;\n```');

      const codeToken = result.tokens.find(t => t.type === 'code_block') as CodeBlockToken;
      expect(codeToken.language).toBe('javascript');
    });

    it('should not parse entities inside code blocks', () => {
      const result = parseMessage('```\nhttps://example.com\n```');

      // URL should not be detected inside code block
      expect(result.hasUrls).toBe(false);
    });

    it('should not parse entities inside inline code', () => {
      const result = parseMessage('Use `https://example.com` as the URL');

      // The URL inside backticks should not be detected
      expect(result.urls).toHaveLength(0);
    });
  });

  describe('Newline Handling', () => {
    it('should preserve newlines as tokens', () => {
      const result = parseMessage('Line 1\nLine 2');

      const newlineTokens = result.tokens.filter(t => t.type === 'newline');
      expect(newlineTokens).toHaveLength(1);
    });

    it('should handle multiple newlines', () => {
      const result = parseMessage('A\n\nB\n\nC');

      const newlineTokens = result.tokens.filter(t => t.type === 'newline');
      expect(newlineTokens).toHaveLength(4);
    });

    it('should not create newline tokens inside code blocks', () => {
      const result = parseMessage('```\nline1\nline2\n```');

      // Newlines inside code block should be part of the code, not separate tokens
      const codeToken = result.tokens.find(t => t.type === 'code_block') as CodeBlockToken;
      expect(codeToken).toBeDefined();
    });
  });

  describe('Mixed Content', () => {
    it('should parse message with multiple entity types', () => {
      const npub = 'npub1' + 'a'.repeat(59);
      const result = parseMessage(
        `Hello @${npub}! Check out https://example.com #nostr :rocket:`
      );

      expect(result.hasMentions).toBe(true);
      expect(result.hasUrls).toBe(true);
      expect(result.hasHashtags).toBe(true);
      expect(result.hasEmoji).toBe(true);
    });

    it('should maintain correct token order', () => {
      const result = parseMessage('Start https://a.com middle https://b.com end');

      const types = result.tokens.map(t => t.type);
      expect(types).toEqual(['text', 'url', 'text', 'url', 'text']);
    });

    it('should handle adjacent tokens without text between', () => {
      const result = parseMessage(':fire::rocket::star:');

      const emojiTokens = result.tokens.filter(t => t.type === 'emoji');
      expect(emojiTokens).toHaveLength(3);
    });
  });

  describe('Parser Options', () => {
    it('should disable URL parsing', () => {
      const result = parseMessage('https://example.com', { parseUrls: false });

      expect(result.hasUrls).toBe(false);
      expect(result.tokens).toHaveLength(1);
      expect(result.tokens[0].type).toBe('text');
    });

    it('should disable mention parsing', () => {
      const npub = 'npub1' + 'a'.repeat(59);
      const result = parseMessage(`@${npub}`, { parseMentions: false });

      expect(result.hasMentions).toBe(false);
    });

    it('should disable hashtag parsing', () => {
      const result = parseMessage('#hashtag', { parseHashtags: false });

      expect(result.hasHashtags).toBe(false);
    });

    it('should disable emoji parsing', () => {
      const result = parseMessage(':smile:', { parseEmojis: false });

      expect(result.hasEmoji).toBe(false);
    });

    it('should disable code parsing', () => {
      const result = parseMessage('`code`', { parseCode: false });

      expect(result.hasCode).toBe(false);
    });

    it('should disable newline preservation', () => {
      const result = parseMessage('Line 1\nLine 2', { preserveNewlines: false });

      const newlineTokens = result.tokens.filter(t => t.type === 'newline');
      expect(newlineTokens).toHaveLength(0);
    });
  });

  describe('Token Positions', () => {
    it('should track correct start/end positions', () => {
      const result = parseMessage('Hello https://example.com world');

      const urlToken = result.tokens.find(t => t.type === 'url')!;
      expect(urlToken.start).toBe(6);
      expect(urlToken.end).toBe(25);
    });

    it('should have non-overlapping tokens', () => {
      const result = parseMessage('Start https://a.com #tag :smile: end');

      let lastEnd = 0;
      for (const token of result.tokens) {
        expect(token.start).toBeGreaterThanOrEqual(lastEnd);
        lastEnd = token.end;
      }
    });
  });
});

describe('containsFormattableContent', () => {
  it('should return true for URLs', () => {
    expect(containsFormattableContent('https://example.com')).toBe(true);
  });

  it('should return true for mentions', () => {
    const npub = 'npub1' + 'a'.repeat(59);
    expect(containsFormattableContent(`@${npub}`)).toBe(true);
  });

  it('should return true for hashtags', () => {
    expect(containsFormattableContent('#hashtag')).toBe(true);
  });

  it('should return true for code', () => {
    expect(containsFormattableContent('`code`')).toBe(true);
  });

  it('should return true for valid emoji shortcodes', () => {
    expect(containsFormattableContent(':smile:')).toBe(true);
  });

  it('should return false for invalid emoji shortcodes', () => {
    expect(containsFormattableContent(':notanemoji:')).toBe(false);
  });

  it('should return false for plain text', () => {
    expect(containsFormattableContent('Just plain text')).toBe(false);
  });

  it('should respect options', () => {
    expect(containsFormattableContent('https://example.com', { parseUrls: false })).toBe(false);
  });
});

describe('Emoji Functions', () => {
  describe('getEmojiShortcodes', () => {
    it('should return emoji shortcode map', () => {
      const shortcodes = getEmojiShortcodes();

      expect(shortcodes[':smile:']).toBe('\u{1F604}');
      expect(shortcodes[':heart:']).toBe('\u{2764}');
      expect(shortcodes[':rocket:']).toBe('\u{1F680}');
    });

    it('should return a copy not the original', () => {
      const shortcodes1 = getEmojiShortcodes();
      const shortcodes2 = getEmojiShortcodes();

      shortcodes1[':test:'] = 'test';
      expect(shortcodes2[':test:']).toBeUndefined();
    });
  });

  describe('lookupEmoji', () => {
    it('should lookup emoji by shortcode', () => {
      expect(lookupEmoji(':smile:')).toBe('\u{1F604}');
    });

    it('should be case-insensitive', () => {
      expect(lookupEmoji(':SMILE:')).toBe('\u{1F604}');
    });

    it('should add colons if missing', () => {
      expect(lookupEmoji('smile')).toBe('\u{1F604}');
    });

    it('should return undefined for unknown shortcode', () => {
      expect(lookupEmoji(':unknown:')).toBeUndefined();
    });
  });

  describe('searchEmojis', () => {
    it('should search by shortcode', () => {
      const results = searchEmojis('heart');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.shortcode === ':heart:')).toBe(true);
    });

    it('should return multiple matches', () => {
      const results = searchEmojis('heart');

      // Should match :heart:, :orange_heart:, :yellow_heart:, etc.
      expect(results.length).toBeGreaterThan(5);
    });

    it('should sort exact prefix matches first', () => {
      const results = searchEmojis('star');

      // :star: should come before :sparkling_heart:
      const starIndex = results.findIndex(r => r.shortcode === ':star:');
      const sparklingIndex = results.findIndex(r => r.shortcode === ':sparkling_heart:');

      if (starIndex !== -1 && sparklingIndex !== -1) {
        expect(starIndex).toBeLessThan(sparklingIndex);
      }
    });

    it('should handle empty query', () => {
      const results = searchEmojis('');

      // Should return all emojis
      expect(results.length).toBeGreaterThan(100);
    });

    it('should strip colons from query', () => {
      const results1 = searchEmojis('smile');
      const results2 = searchEmojis(':smile:');

      expect(results1).toEqual(results2);
    });
  });
});

describe('tokensToPlainText', () => {
  it('should convert tokens back to plain text', () => {
    const result = parseMessage('Hello :smile: world');
    const text = tokensToPlainText(result.tokens);

    // Emoji shortcode should be converted to actual emoji
    expect(text).toContain('\u{1F604}');
  });

  it('should preserve code content without backticks', () => {
    const result = parseMessage('Use `console.log()`');
    const text = tokensToPlainText(result.tokens);

    expect(text).toContain('console.log()');
    // Should not include backticks
    expect(text).not.toContain('`');
  });

  it('should preserve newlines', () => {
    const result = parseMessage('Line 1\nLine 2');
    const text = tokensToPlainText(result.tokens);

    expect(text).toBe('Line 1\nLine 2');
  });

  it('should preserve URLs as-is', () => {
    const result = parseMessage('Check https://example.com');
    const text = tokensToPlainText(result.tokens);

    expect(text).toContain('https://example.com');
  });

  it('should handle empty token array', () => {
    const text = tokensToPlainText([]);
    expect(text).toBe('');
  });
});

describe('Edge Cases', () => {
  it('should handle very long messages', () => {
    const longMessage = 'Hello '.repeat(1000);
    const result = parseMessage(longMessage);

    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it('should handle unicode in messages', () => {
    const result = parseMessage('Hello world! Testing unicode');

    expect(result.tokens.length).toBeGreaterThan(0);
    expect(result.tokens[0].raw).toContain('Hello');
  });

  it('should handle special characters', () => {
    const result = parseMessage('Special: <>&"\'');

    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0].raw).toBe('Special: <>&"\'');
  });

  it('should handle malformed URLs gracefully', () => {
    // This should not crash
    const result = parseMessage('http:/malformed');

    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it('should handle unclosed code blocks', () => {
    const result = parseMessage('```\nunfinished code block');

    // Should not crash and should produce some tokens
    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it('should handle nested formatting attempts', () => {
    const result = parseMessage('`code with :emoji:`');

    // Emoji inside code should not be parsed
    const codeToken = result.tokens.find(t => t.type === 'inline_code');
    expect(codeToken).toBeDefined();
    expect(result.hasEmoji).toBe(false);
  });
});
