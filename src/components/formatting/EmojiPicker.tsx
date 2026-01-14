/**
 * EmojiPicker Component
 *
 * A terminal-styled emoji picker with categories, search, and recent emojis.
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback, useMemo, useRef } from 'preact/hooks';
import {
  getEmojiShortcodes,
  searchEmojis,
} from '../../services/formatting/parser';

// ============================================================================
// Types
// ============================================================================

export interface EmojiPickerProps {
  /** Called when an emoji is selected */
  onSelect: (emoji: string, shortcode: string) => void;
  /** Called when picker is closed */
  onClose?: () => void;
  /** Maximum recent emojis to show */
  maxRecent?: number;
  /** Additional CSS classes */
  className?: string;
  /** Position (for floating picker) */
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

export interface EmojiButtonProps {
  /** Called when button is clicked */
  onClick: () => void;
  /** Whether picker is open */
  isOpen?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface EmojiData {
  emoji: string;
  shortcode: string;
}

type EmojiCategory =
  | 'recent'
  | 'smileys'
  | 'gestures'
  | 'hearts'
  | 'symbols'
  | 'objects'
  | 'animals'
  | 'food'
  | 'activities';

// ============================================================================
// Emoji Data by Category
// ============================================================================

const CATEGORY_LABELS: Record<EmojiCategory, string> = {
  recent: 'Recent',
  smileys: 'Smileys',
  gestures: 'Gestures',
  hearts: 'Hearts',
  symbols: 'Symbols',
  objects: 'Objects',
  animals: 'Animals',
  food: 'Food',
  activities: 'Activities',
};

const CATEGORY_ICONS: Record<EmojiCategory, string> = {
  recent: '\u{1F551}', // Clock
  smileys: '\u{1F604}', // Smile
  gestures: '\u{1F44D}', // Thumbs up
  hearts: '\u{2764}', // Heart
  symbols: '\u{26A1}', // Lightning
  objects: '\u{1F4BB}', // Computer
  animals: '\u{1F436}', // Dog
  food: '\u{1F355}', // Pizza
  activities: '\u{26BD}', // Soccer
};

// Map shortcodes to categories
const SHORTCODE_CATEGORIES: Record<string, EmojiCategory> = {
  // Smileys
  ':smile:': 'smileys',
  ':grin:': 'smileys',
  ':joy:': 'smileys',
  ':rofl:': 'smileys',
  ':wink:': 'smileys',
  ':blush:': 'smileys',
  ':innocent:': 'smileys',
  ':heart_eyes:': 'smileys',
  ':kissing_heart:': 'smileys',
  ':stuck_out_tongue:': 'smileys',
  ':stuck_out_tongue_winking_eye:': 'smileys',
  ':sunglasses:': 'smileys',
  ':thinking:': 'smileys',
  ':unamused:': 'smileys',
  ':disappointed:': 'smileys',
  ':worried:': 'smileys',
  ':angry:': 'smileys',
  ':rage:': 'smileys',
  ':cry:': 'smileys',
  ':sob:': 'smileys',
  ':scream:': 'smileys',
  ':fearful:': 'smileys',
  ':cold_sweat:': 'smileys',
  ':sweat:': 'smileys',
  ':sleeping:': 'smileys',
  ':mask:': 'smileys',
  ':skull:': 'smileys',
  ':ghost:': 'smileys',
  ':alien:': 'smileys',
  ':robot:': 'smileys',
  ':smiling_imp:': 'smileys',
  ':poop:': 'smileys',
  ':clown:': 'smileys',
  // Gestures
  ':+1:': 'gestures',
  ':thumbsup:': 'gestures',
  ':-1:': 'gestures',
  ':thumbsdown:': 'gestures',
  ':ok_hand:': 'gestures',
  ':punch:': 'gestures',
  ':fist:': 'gestures',
  ':wave:': 'gestures',
  ':raised_hand:': 'gestures',
  ':clap:': 'gestures',
  ':pray:': 'gestures',
  ':muscle:': 'gestures',
  ':point_up:': 'gestures',
  ':point_down:': 'gestures',
  ':point_left:': 'gestures',
  ':point_right:': 'gestures',
  ':middle_finger:': 'gestures',
  ':writing_hand:': 'gestures',
  // Hearts
  ':heart:': 'hearts',
  ':red_heart:': 'hearts',
  ':orange_heart:': 'hearts',
  ':yellow_heart:': 'hearts',
  ':green_heart:': 'hearts',
  ':blue_heart:': 'hearts',
  ':purple_heart:': 'hearts',
  ':black_heart:': 'hearts',
  ':broken_heart:': 'hearts',
  ':sparkling_heart:': 'hearts',
  ':two_hearts:': 'hearts',
  ':revolving_hearts:': 'hearts',
  ':heartbeat:': 'hearts',
  ':heartpulse:': 'hearts',
  // Symbols
  ':fire:': 'symbols',
  ':100:': 'symbols',
  ':star:': 'symbols',
  ':sparkles:': 'symbols',
  ':zap:': 'symbols',
  ':boom:': 'symbols',
  ':collision:': 'symbols',
  ':lightning:': 'symbols',
  ':rainbow:': 'symbols',
  ':sun:': 'symbols',
  ':moon:': 'symbols',
  ':cloud:': 'symbols',
  ':snowflake:': 'symbols',
  ':droplet:': 'symbols',
  ':warning:': 'symbols',
  ':x:': 'symbols',
  ':check:': 'symbols',
  ':white_check_mark:': 'symbols',
  ':question:': 'symbols',
  ':exclamation:': 'symbols',
  ':bitcoin:': 'symbols',
  ':rocket:': 'symbols',
  ':satellite:': 'symbols',
  ':flying_saucer:': 'symbols',
  // Objects
  ':key:': 'objects',
  ':lock:': 'objects',
  ':unlock:': 'objects',
  ':bell:': 'objects',
  ':no_bell:': 'objects',
  ':bookmark:': 'objects',
  ':link:': 'objects',
  ':paperclip:': 'objects',
  ':scissors:': 'objects',
  ':pencil:': 'objects',
  ':pen:': 'objects',
  ':memo:': 'objects',
  ':bulb:': 'objects',
  ':gear:': 'objects',
  ':wrench:': 'objects',
  ':hammer:': 'objects',
  ':computer:': 'objects',
  ':phone:': 'objects',
  ':camera:': 'objects',
  ':tv:': 'objects',
  ':radio:': 'objects',
  ':speaker:': 'objects',
  ':mute:': 'objects',
  ':microphone:': 'objects',
  ':movie_camera:': 'objects',
  // Animals
  ':dog:': 'animals',
  ':cat:': 'animals',
  ':mouse:': 'animals',
  ':hamster:': 'animals',
  ':rabbit:': 'animals',
  ':fox:': 'animals',
  ':bear:': 'animals',
  ':panda:': 'animals',
  ':koala:': 'animals',
  ':tiger:': 'animals',
  ':lion:': 'animals',
  ':cow:': 'animals',
  ':pig:': 'animals',
  ':frog:': 'animals',
  ':monkey:': 'animals',
  ':chicken:': 'animals',
  ':penguin:': 'animals',
  ':bird:': 'animals',
  ':eagle:': 'animals',
  ':owl:': 'animals',
  ':bat:': 'animals',
  ':wolf:': 'animals',
  ':unicorn:': 'animals',
  ':bee:': 'animals',
  ':bug:': 'animals',
  ':butterfly:': 'animals',
  ':snail:': 'animals',
  ':turtle:': 'animals',
  ':snake:': 'animals',
  ':dragon:': 'animals',
  ':whale:': 'animals',
  ':dolphin:': 'animals',
  ':fish:': 'animals',
  ':octopus:': 'animals',
  ':crab:': 'animals',
  // Food
  ':apple:': 'food',
  ':banana:': 'food',
  ':orange:': 'food',
  ':lemon:': 'food',
  ':watermelon:': 'food',
  ':grapes:': 'food',
  ':strawberry:': 'food',
  ':peach:': 'food',
  ':cherries:': 'food',
  ':pizza:': 'food',
  ':burger:': 'food',
  ':fries:': 'food',
  ':hotdog:': 'food',
  ':taco:': 'food',
  ':burrito:': 'food',
  ':popcorn:': 'food',
  ':cake:': 'food',
  ':cookie:': 'food',
  ':chocolate:': 'food',
  ':candy:': 'food',
  ':lollipop:': 'food',
  ':donut:': 'food',
  ':icecream:': 'food',
  ':coffee:': 'food',
  ':tea:': 'food',
  ':beer:': 'food',
  ':wine:': 'food',
  ':cocktail:': 'food',
  ':champagne:': 'food',
  // Activities
  ':soccer:': 'activities',
  ':basketball:': 'activities',
  ':football:': 'activities',
  ':baseball:': 'activities',
  ':tennis:': 'activities',
  ':golf:': 'activities',
  ':trophy:': 'activities',
  ':medal:': 'activities',
  ':gamepad:': 'activities',
  ':joystick:': 'activities',
  ':dice:': 'activities',
  ':chess:': 'activities',
  ':dart:': 'activities',
  ':bowling:': 'activities',
  ':guitar:': 'activities',
  ':piano:': 'activities',
  ':drum:': 'activities',
  ':art:': 'activities',
};

// ============================================================================
// Local Storage for Recent Emojis
// ============================================================================

const RECENT_STORAGE_KEY = 'bitchat-recent-emojis';

function getRecentEmojis(maxCount: number): EmojiData[] {
  try {
    const stored = localStorage.getItem(RECENT_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as EmojiData[];
      return parsed.slice(0, maxCount);
    }
  } catch {
    // Ignore
  }
  return [];
}

function addRecentEmoji(emoji: string, shortcode: string, maxCount: number): void {
  try {
    const current = getRecentEmojis(maxCount);
    // Remove if already exists
    const filtered = current.filter((e) => e.shortcode !== shortcode);
    // Add to front
    const updated = [{ emoji, shortcode }, ...filtered].slice(0, maxCount);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

// ============================================================================
// EmojiPicker Component
// ============================================================================

export const EmojiPicker: FunctionComponent<EmojiPickerProps> = ({
  onSelect,
  onClose,
  maxRecent = 16,
  className = '',
  position = 'bottom-left',
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<EmojiCategory>('smileys');
  const [recentEmojis, setRecentEmojis] = useState<EmojiData[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent emojis
  useEffect(() => {
    setRecentEmojis(getRecentEmojis(maxRecent));
  }, [maxRecent]);

  // Focus search on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Get all emojis organized by category
  const emojisByCategory = useMemo(() => {
    const allEmojis = getEmojiShortcodes();
    const categories: Record<EmojiCategory, EmojiData[]> = {
      recent: [],
      smileys: [],
      gestures: [],
      hearts: [],
      symbols: [],
      objects: [],
      animals: [],
      food: [],
      activities: [],
    };

    for (const [shortcode, emoji] of Object.entries(allEmojis)) {
      const category = SHORTCODE_CATEGORIES[shortcode] || 'symbols';
      categories[category].push({ emoji, shortcode });
    }

    return categories;
  }, []);

  // Search results
  const searchResults = useMemo(() => {
    if (!search.trim()) {
      return null;
    }
    return searchEmojis(search);
  }, [search]);

  // Handle emoji selection
  const handleSelect = useCallback(
    (emoji: string, shortcode: string) => {
      addRecentEmoji(emoji, shortcode, maxRecent);
      setRecentEmojis(getRecentEmojis(maxRecent));
      onSelect(emoji, shortcode);
    },
    [onSelect, maxRecent]
  );

  // Position classes
  const positionClasses: Record<string, string> = {
    'bottom-left': 'top-full left-0 mt-1',
    'bottom-right': 'top-full right-0 mt-1',
    'top-left': 'bottom-full left-0 mb-1',
    'top-right': 'bottom-full right-0 mb-1',
  };

  // Categories to show (with recent first if available)
  const categories: EmojiCategory[] = useMemo(() => {
    const cats: EmojiCategory[] = [];
    if (recentEmojis.length > 0) {
      cats.push('recent');
    }
    cats.push('smileys', 'gestures', 'hearts', 'symbols', 'objects', 'animals', 'food', 'activities');
    return cats;
  }, [recentEmojis.length]);

  // Current emojis to display
  const currentEmojis = useMemo(() => {
    if (searchResults) {
      return searchResults;
    }
    if (activeCategory === 'recent') {
      return recentEmojis;
    }
    return emojisByCategory[activeCategory];
  }, [searchResults, activeCategory, recentEmojis, emojisByCategory]);

  return (
    <div
      ref={containerRef}
      class={[
        'emoji-picker',
        'absolute z-50',
        positionClasses[position],
        'w-72 max-h-80',
        'border border-terminal-green/30 rounded',
        'bg-terminal-bg shadow-lg',
        'flex flex-col',
        className,
      ].join(' ')}
    >
      {/* Search */}
      <div class="p-2 border-b border-terminal-green/30">
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          placeholder="Search emojis..."
          class={[
            'w-full px-2 py-1 rounded',
            'bg-terminal-bg border border-terminal-green/30',
            'text-terminal-green text-sm font-mono',
            'placeholder:text-terminal-green/40',
            'focus:outline-none focus:border-terminal-green/60',
          ].join(' ')}
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div class="flex border-b border-terminal-green/30 px-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              class={[
                'px-2 py-1.5 text-lg transition-colors flex-shrink-0',
                activeCategory === cat
                  ? 'text-terminal-green border-b-2 border-terminal-green'
                  : 'text-terminal-green/50 hover:text-terminal-green/80',
              ].join(' ')}
              onClick={() => setActiveCategory(cat)}
              title={CATEGORY_LABELS[cat]}
            >
              {CATEGORY_ICONS[cat]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div class="flex-1 overflow-y-auto p-2">
        {/* Category label */}
        {!search && (
          <div class="text-terminal-green/50 text-xs mb-1 font-mono">
            {CATEGORY_LABELS[activeCategory]}
          </div>
        )}

        {/* Search results label */}
        {search && (
          <div class="text-terminal-green/50 text-xs mb-1 font-mono">
            {searchResults?.length || 0} results
          </div>
        )}

        {/* Emoji grid */}
        <div class="grid grid-cols-8 gap-0.5">
          {currentEmojis.map(({ emoji, shortcode }) => (
            <button
              key={shortcode}
              type="button"
              class={[
                'w-8 h-8 flex items-center justify-center',
                'text-lg rounded',
                'hover:bg-terminal-green/20 transition-colors',
              ].join(' ')}
              onClick={() => handleSelect(emoji, shortcode)}
              title={shortcode}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* No results */}
        {search && searchResults?.length === 0 && (
          <div class="text-terminal-green/50 text-sm text-center py-4">
            No emojis found
          </div>
        )}
      </div>

      {/* Footer with shortcode hint */}
      <div class="px-2 py-1 border-t border-terminal-green/30 text-terminal-green/40 text-xs">
        Tip: Type :shortcode: in messages
      </div>
    </div>
  );
};

// ============================================================================
// EmojiButton Component
// ============================================================================

export const EmojiButton: FunctionComponent<EmojiButtonProps> = ({
  onClick,
  isOpen = false,
  className = '',
}) => (
    <button
      type="button"
      class={[
        'emoji-button',
        'p-1.5 rounded transition-colors',
        isOpen
          ? 'bg-terminal-green/20 text-terminal-green'
          : 'text-terminal-green/50 hover:text-terminal-green hover:bg-terminal-green/10',
        className,
      ].join(' ')}
      onClick={onClick}
      title="Add emoji"
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
        <line x1="9" y1="9" x2="9.01" y2="9" />
        <line x1="15" y1="9" x2="15.01" y2="9" />
      </svg>
    </button>
  );

// ============================================================================
// EmojiPickerWithButton Component
// ============================================================================

export const EmojiPickerWithButton: FunctionComponent<{
  onSelect: (emoji: string, shortcode: string) => void;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
  className?: string;
}> = ({ onSelect, position = 'bottom-left', className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback(
    (emoji: string, shortcode: string) => {
      onSelect(emoji, shortcode);
      setIsOpen(false);
    },
    [onSelect]
  );

  return (
    <div class={`relative ${className}`}>
      <EmojiButton onClick={() => setIsOpen(!isOpen)} isOpen={isOpen} />
      {isOpen && (
        <EmojiPicker
          onSelect={handleSelect}
          onClose={() => setIsOpen(false)}
          position={position}
        />
      )}
    </div>
  );
};

// ============================================================================
// Inline Emoji Autocomplete
// ============================================================================

export interface EmojiAutocompleteProps {
  /** Current input value */
  query: string;
  /** Called when an emoji is selected */
  onSelect: (emoji: string, shortcode: string) => void;
  /** Called when autocomplete should close */
  onClose?: () => void;
  /** Maximum suggestions to show */
  maxSuggestions?: number;
  /** Additional CSS classes */
  className?: string;
}

export const EmojiAutocomplete: FunctionComponent<EmojiAutocompleteProps> = ({
  query,
  onSelect,
  onClose,
  maxSuggestions = 8,
  className = '',
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Get suggestions
  const suggestions = useMemo(() => {
    if (!query || query.length < 2) {
      return [];
    }
    return searchEmojis(query).slice(0, maxSuggestions);
  }, [query, maxSuggestions]);

  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedIndex(0);
  }, [suggestions]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % suggestions.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          break;
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          const selected = suggestions[selectedIndex];
          if (selected) {
            onSelect(selected.emoji, selected.shortcode);
          }
          break;
        case 'Escape':
          onClose?.();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [suggestions, selectedIndex, onSelect, onClose]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div
      class={[
        'emoji-autocomplete',
        'absolute bottom-full left-0 mb-1',
        'w-64 max-h-48 overflow-y-auto',
        'border border-terminal-green/30 rounded',
        'bg-terminal-bg shadow-lg',
        className,
      ].join(' ')}
    >
      {suggestions.map((item, index) => (
        <div
          key={item.shortcode}
          class={[
            'flex items-center gap-2 px-3 py-1.5 cursor-pointer',
            index === selectedIndex
              ? 'bg-terminal-green/20'
              : 'hover:bg-terminal-green/10',
          ].join(' ')}
          onClick={() => onSelect(item.emoji, item.shortcode)}
        >
          <span class="text-lg">{item.emoji}</span>
          <span class="text-terminal-green/70 text-sm font-mono">
            {item.shortcode}
          </span>
        </div>
      ))}
    </div>
  );
};

export default EmojiPicker;
