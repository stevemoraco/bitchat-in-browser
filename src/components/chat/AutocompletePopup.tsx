/**
 * AutocompletePopup - Reusable dropdown component for autocomplete suggestions
 *
 * Features:
 * - Appears above the input bar
 * - Shows matching options in a list
 * - Keyboard navigation (up/down arrows)
 * - Tab/Enter to select
 * - Escape to dismiss
 * - Max 5 visible items, scroll if more
 */

import type { FunctionComponent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export interface AutocompleteItem {
  /** Unique identifier for the item */
  id: string;
  /** Primary display text */
  label: string;
  /** Secondary description (optional) */
  description?: string;
  /** Icon or prefix to display (optional) */
  icon?: preact.ComponentChildren;
  /** Additional data associated with the item */
  data?: unknown;
}

export interface AutocompletePopupProps {
  /** List of items to display */
  items: AutocompleteItem[];
  /** Currently selected index */
  selectedIndex: number;
  /** Callback when an item is selected */
  onSelect: (item: AutocompleteItem) => void;
  /** Callback when selection index changes */
  onIndexChange: (index: number) => void;
  /** Callback to dismiss the popup */
  onDismiss: () => void;
  /** Whether the popup is visible */
  isVisible: boolean;
  /** Optional title for the popup */
  title?: string;
  /** Maximum number of visible items before scrolling */
  maxVisible?: number;
  /** Empty state message */
  emptyMessage?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_VISIBLE = 5;
const ITEM_HEIGHT = 44; // px

// ============================================================================
// Component
// ============================================================================

export const AutocompletePopup: FunctionComponent<AutocompletePopupProps> = ({
  items,
  selectedIndex,
  onSelect,
  onIndexChange,
  onDismiss,
  isVisible,
  title,
  maxVisible = DEFAULT_MAX_VISIBLE,
  emptyMessage = 'No matches found',
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current && listRef.current) {
      const list = listRef.current;
      const item = selectedItemRef.current;
      const listRect = list.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();

      // Check if item is above visible area
      if (itemRect.top < listRect.top) {
        item.scrollIntoView({ block: 'nearest' });
      }
      // Check if item is below visible area
      else if (itemRect.bottom > listRect.bottom) {
        item.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (items.length > 0) {
            const newIndex = selectedIndex <= 0 ? items.length - 1 : selectedIndex - 1;
            onIndexChange(newIndex);
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (items.length > 0) {
            const newIndex = selectedIndex >= items.length - 1 ? 0 : selectedIndex + 1;
            onIndexChange(newIndex);
          }
          break;

        case 'Tab':
        case 'Enter':
          if (items.length > 0 && selectedIndex >= 0 && selectedIndex < items.length) {
            e.preventDefault();
            onSelect(items[selectedIndex]);
          }
          break;

        case 'Escape':
          e.preventDefault();
          onDismiss();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, items, selectedIndex, onSelect, onIndexChange, onDismiss]);

  if (!isVisible) return null;

  const maxHeight = maxVisible * ITEM_HEIGHT;
  const hasScroll = items.length > maxVisible;

  return (
    <div
      class="absolute bottom-full left-0 right-0 mb-1 z-50"
      role="listbox"
      aria-label={title || 'Autocomplete suggestions'}
    >
      <div class="bg-surface border border-muted rounded-terminal shadow-lg overflow-hidden">
        {/* Optional title */}
        {title && (
          <div class="px-3 py-1.5 border-b border-muted">
            <span class="text-terminal-xs text-muted font-mono uppercase tracking-wider">
              {title}
            </span>
          </div>
        )}

        {/* Items list */}
        <div
          ref={listRef}
          class={`overflow-y-auto ${hasScroll ? 'scrollbar-thin' : ''}`}
          style={{ maxHeight: `${maxHeight}px` }}
        >
          {items.length === 0 ? (
            <div class="px-3 py-3 text-terminal-sm text-muted font-mono text-center">
              {emptyMessage}
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  ref={isSelected ? selectedItemRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelect(item)}
                  onMouseEnter={() => onIndexChange(index)}
                  class={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                    isSelected
                      ? 'bg-primary/20 text-primary'
                      : 'text-text hover:bg-surface-hover'
                  }`}
                  style={{ minHeight: `${ITEM_HEIGHT}px` }}
                >
                  {/* Icon/prefix */}
                  {item.icon && (
                    <span class="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted">
                      {item.icon}
                    </span>
                  )}

                  {/* Content */}
                  <div class="flex-1 min-w-0">
                    <div class="font-mono text-terminal-sm truncate">
                      {item.label}
                    </div>
                    {item.description && (
                      <div class="text-terminal-xs text-muted truncate">
                        {item.description}
                      </div>
                    )}
                  </div>

                  {/* Selection indicator */}
                  {isSelected && (
                    <span class="flex-shrink-0 text-terminal-xs text-muted font-mono">
                      Tab/Enter
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Keyboard hint */}
        {items.length > 0 && (
          <div class="px-3 py-1 border-t border-muted">
            <span class="text-terminal-xs text-muted font-mono">
              Use arrow keys to navigate, Tab or Enter to select, Esc to dismiss
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutocompletePopup;
