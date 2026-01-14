/**
 * LinkPreview Component
 *
 * Displays a preview card for URLs with title, description, and image.
 * Fetches Open Graph metadata when available.
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import {
  fetchLinkPreview,
  sanitizeUrl,
  type LinkPreviewData
} from '../../services/formatting/renderer';

// ============================================================================
// Types
// ============================================================================

export interface LinkPreviewProps {
  /** URL to preview */
  url: string;
  /** Click handler */
  onClick?: (url: string) => void;
  /** Whether to show the image */
  showImage?: boolean;
  /** Whether to show the description */
  showDescription?: boolean;
  /** Maximum description length */
  maxDescriptionLength?: number;
  /** Additional CSS classes */
  className?: string;
  /** Loading timeout in milliseconds */
  timeout?: number;
  /** Compact mode */
  compact?: boolean;
}

type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

// ============================================================================
// Component
// ============================================================================

export const LinkPreview: FunctionComponent<LinkPreviewProps> = ({
  url,
  onClick,
  showImage = true,
  showDescription = true,
  maxDescriptionLength = 150,
  className = '',
  timeout = 5000,
  compact = false,
}) => {
  const [state, setState] = useState<LoadingState>('idle');
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [imageError, setImageError] = useState(false);

  // Validate URL
  const safeUrl = sanitizeUrl(url);

  // Fetch preview data
  useEffect(() => {
    if (!safeUrl) {
      setState('error');
      return;
    }

    let cancelled = false;
    setState('loading');

    fetchLinkPreview(safeUrl, timeout)
      .then((result) => {
        if (!cancelled) {
          if (result) {
            setData(result);
            setState('loaded');
          } else {
            setState('error');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [safeUrl, timeout]);

  // Handle click
  const handleClick = useCallback(() => {
    if (safeUrl) {
      if (onClick) {
        onClick(safeUrl);
      } else {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
    }
  }, [safeUrl, onClick]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  // Handle image error
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  // Don't render if URL is invalid
  if (!safeUrl) {
    return null;
  }

  // Extract domain for display
  let domain = '';
  try {
    domain = new URL(safeUrl).hostname;
  } catch {
    domain = safeUrl;
  }

  // Truncate description
  const truncatedDescription =
    data?.description && data.description.length > maxDescriptionLength
      ? `${data.description.slice(0, maxDescriptionLength).trim()  }...`
      : data?.description;

  // Container classes
  const containerClass = [
    'link-preview',
    'border border-terminal-green/30 rounded overflow-hidden',
    'hover:border-terminal-green/50 transition-colors',
    'cursor-pointer bg-terminal-bg/50',
    compact ? 'flex items-center gap-2 p-2' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // Loading state
  if (state === 'loading') {
    return (
      <div class={containerClass}>
        <div class="p-3 flex items-center gap-2">
          <div class="w-4 h-4 border-2 border-terminal-green/30 border-t-terminal-green rounded-full animate-spin" />
          <span class="text-terminal-green/50 text-sm truncate">{domain}</span>
        </div>
      </div>
    );
  }

  // Error state - show minimal preview
  if (state === 'error' || !data) {
    return (
      <div
        class={containerClass}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="link"
        tabIndex={0}
      >
        <div class="p-3 flex items-center gap-2">
          <LinkIcon />
          <span class="text-terminal-green/70 text-sm truncate flex-1">
            {domain}
          </span>
          <ExternalLinkIcon />
        </div>
      </div>
    );
  }

  // Compact mode
  if (compact) {
    return (
      <div
        class={containerClass}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="link"
        tabIndex={0}
      >
        {data.favicon && !imageError ? (
          <img
            src={data.favicon}
            alt=""
            class="w-4 h-4 flex-shrink-0"
            onError={handleImageError}
          />
        ) : (
          <LinkIcon />
        )}
        <span class="text-terminal-green text-sm truncate flex-1">
          {data.title || domain}
        </span>
        <ExternalLinkIcon />
      </div>
    );
  }

  // Full preview
  return (
    <div
      class={containerClass}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
    >
      {/* Image */}
      {showImage && data.image && !imageError && (
        <div class="w-full h-32 bg-terminal-green/5 overflow-hidden">
          <img
            src={data.image}
            alt=""
            class="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div class="p-3">
        {/* Site name / domain */}
        <div class="flex items-center gap-2 text-terminal-green/50 text-xs mb-1">
          {data.favicon && !imageError ? (
            <img
              src={data.favicon}
              alt=""
              class="w-3 h-3"
              onError={handleImageError}
            />
          ) : (
            <LinkIcon size={12} />
          )}
          <span class="truncate">{data.siteName || domain}</span>
        </div>

        {/* Title */}
        {data.title && (
          <h3 class="text-terminal-green font-semibold text-sm line-clamp-2 mb-1">
            {data.title}
          </h3>
        )}

        {/* Description */}
        {showDescription && truncatedDescription && (
          <p class="text-terminal-green/70 text-xs line-clamp-2">
            {truncatedDescription}
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Icon Components
// ============================================================================

const LinkIcon: FunctionComponent<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="text-terminal-green/50 flex-shrink-0"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ExternalLinkIcon: FunctionComponent<{ size?: number }> = ({
  size = 14,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="text-terminal-green/30 flex-shrink-0"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ============================================================================
// Utility Components
// ============================================================================

/**
 * Simple link preview without fetching (just domain display)
 */
export const SimpleLinkPreview: FunctionComponent<{
  url: string;
  onClick?: (url: string) => void;
  className?: string;
}> = ({ url, onClick, className = '' }) => {
  const safeUrl = sanitizeUrl(url);
  if (!safeUrl) return null;

  let domain = '';
  try {
    domain = new URL(safeUrl).hostname;
  } catch {
    domain = safeUrl;
  }

  const handleClick = () => {
    if (onClick) {
      onClick(safeUrl);
    } else {
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      class={`inline-flex items-center gap-1 text-terminal-cyan hover:text-terminal-cyan/80 cursor-pointer ${className}`}
      onClick={handleClick}
      role="link"
      tabIndex={0}
    >
      <LinkIcon size={12} />
      <span class="text-sm underline">{domain}</span>
    </div>
  );
};

/**
 * Multiple link previews container
 */
export const LinkPreviewList: FunctionComponent<{
  urls: string[];
  maxPreviews?: number;
  onClick?: (url: string) => void;
  compact?: boolean;
  className?: string;
}> = ({ urls, maxPreviews = 3, onClick, compact = false, className = '' }) => {
  // Deduplicate URLs
  const uniqueUrls = [...new Set(urls)].slice(0, maxPreviews);

  if (uniqueUrls.length === 0) {
    return null;
  }

  return (
    <div class={`link-preview-list space-y-2 ${className}`}>
      {uniqueUrls.map((url) => (
        <LinkPreview key={url} url={url} onClick={onClick} compact={compact} />
      ))}
    </div>
  );
};

export default LinkPreview;
