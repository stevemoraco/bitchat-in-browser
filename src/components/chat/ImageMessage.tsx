/**
 * ImageMessage - Image message display component with blur-to-reveal
 *
 * Features:
 * - Blurred thumbnail display by default (privacy)
 * - "Tap to reveal" overlay
 * - Smooth transition on reveal (0.3s ease)
 * - Respects "Auto-reveal images" setting
 * - Long-press menu: Save, Share, Copy
 * - Responsive sizing
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { getImageHandler, type ImageMessageContent } from '../../services/media/image-handler';
import { useAutoRevealImages } from '../../stores/settings-store';

// ============================================================================
// Types
// ============================================================================

export interface ImageMessageProps {
  /** Image message content */
  content: ImageMessageContent;
  /** Whether the message is from the current user */
  isOwn: boolean;
  /** Callback when image is revealed */
  onReveal?: () => void;
  /** Callback for context menu actions */
  onContextMenu?: (action: 'save' | 'share' | 'copy') => void;
}

// ============================================================================
// Icons
// ============================================================================

const EyeIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const DownloadIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ShareIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const CopyIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const CloseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ============================================================================
// Constants
// ============================================================================

const LONG_PRESS_DURATION = 500; // ms
const MAX_IMAGE_WIDTH = 280; // px
const MAX_IMAGE_HEIGHT = 400; // px

// ============================================================================
// Component
// ============================================================================

export const ImageMessage: FunctionComponent<ImageMessageProps> = ({
  content,
  isOwn,
  onReveal,
  onContextMenu,
}) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get auto-reveal setting
  const autoRevealImages = useAutoRevealImages();

  // Calculate display dimensions
  const { displayWidth, displayHeight } = calculateDisplayDimensions(
    content.width,
    content.height,
    MAX_IMAGE_WIDTH,
    MAX_IMAGE_HEIGHT
  );

  // Auto-reveal if setting is enabled
  useEffect(() => {
    if (autoRevealImages && !isRevealed) {
      handleReveal();
    }
  }, [autoRevealImages]);

  // Cleanup object URL on unmount
  useEffect(() => () => {
      if (fullImageUrl) {
        URL.revokeObjectURL(fullImageUrl);
      }
    }, [fullImageUrl]);

  // Handle revealing the image
  const handleReveal = useCallback(async () => {
    if (isRevealed || isLoading) return;

    setIsLoading(true);

    try {
      const imageHandler = getImageHandler();
      const url = await imageHandler.createImageUrl(content.imageId);

      if (url) {
        setFullImageUrl(url);
        setIsRevealed(true);
        onReveal?.();
      }
    } catch (error) {
      console.error('Failed to load image:', error);
    } finally {
      setIsLoading(false);
    }
  }, [content.imageId, isRevealed, isLoading, onReveal]);

  // Handle click/tap
  const handleClick = useCallback(() => {
    if (!isRevealed) {
      handleReveal();
    }
  }, [isRevealed, handleReveal]);

  // Handle long press start
  const handlePointerDown = useCallback(() => {
    if (!isRevealed) return;

    longPressTimerRef.current = window.setTimeout(() => {
      setShowContextMenu(true);
    }, LONG_PRESS_DURATION);
  }, [isRevealed]);

  // Handle long press end
  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Handle context menu action
  const handleContextAction = useCallback(
    async (action: 'save' | 'share' | 'copy') => {
      setShowContextMenu(false);

      if (!fullImageUrl) return;

      try {
        const imageHandler = getImageHandler();
        const blob = await imageHandler.getImage(content.imageId);

        if (!blob) return;

        switch (action) {
          case 'save': {
            // Create download link
            const link = document.createElement('a');
            link.href = fullImageUrl;
            link.download = `bitchat-image-${content.imageId}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            break;
          }
          case 'share': {
            // Use Web Share API if available
            if (navigator.share) {
              const file = new File([blob], `bitchat-image.jpg`, {
                type: content.mimeType,
              });
              await navigator.share({
                files: [file],
                title: 'BitChat Image',
              });
            }
            break;
          }
          case 'copy': {
            // Copy image to clipboard
            if (navigator.clipboard && 'write' in navigator.clipboard) {
              const item = new ClipboardItem({
                [content.mimeType]: blob,
              });
              await navigator.clipboard.write([item]);
            }
            break;
          }
        }

        onContextMenu?.(action);
      } catch (error) {
        console.error(`Failed to ${action} image:`, error);
      }
    },
    [content.imageId, content.mimeType, fullImageUrl, onContextMenu]
  );

  // Close context menu on outside click
  useEffect(() => {
    if (!showContextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContextMenu]);

  return (
    <div
      ref={containerRef}
      class={`relative rounded-terminal overflow-hidden cursor-pointer select-none ${
        isOwn ? 'ml-auto' : 'mr-auto'
      }`}
      style={{
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
        maxWidth: '100%',
      }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onContextMenu={(e) => {
        if (isRevealed) {
          e.preventDefault();
          setShowContextMenu(true);
        }
      }}
    >
      {/* Blurred thumbnail (always visible, fades out on reveal) */}
      <img
        src={content.thumbnail}
        alt="Blurred preview"
        class={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
          isRevealed ? 'opacity-0' : 'opacity-100'
        }`}
        style={{
          filter: 'blur(20px)',
          transform: 'scale(1.1)', // Prevent blur edge artifacts
        }}
        draggable={false}
      />

      {/* Full image (visible when revealed) */}
      {fullImageUrl && (
        <img
          src={fullImageUrl}
          alt="Image message"
          class={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isRevealed ? 'opacity-100' : 'opacity-0'
          }`}
          draggable={false}
        />
      )}

      {/* Tap to reveal overlay */}
      {!isRevealed && !isLoading && (
        <div class="absolute inset-0 flex items-center justify-center bg-black/30">
          <div class="flex flex-col items-center gap-2 text-white">
            <EyeIcon class="w-8 h-8" />
            <span class="text-terminal-xs font-mono">Tap to reveal</span>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div class="absolute inset-0 flex items-center justify-center bg-black/30">
          <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Context menu */}
      {showContextMenu && isRevealed && (
        <div class="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
          <div class="bg-surface border border-muted rounded-terminal p-2 shadow-terminal">
            <button
              type="button"
              class="flex items-center gap-2 w-full px-3 py-2 text-terminal-sm text-text hover:bg-primary/10 rounded-terminal transition-colors"
              onClick={() => handleContextAction('save')}
            >
              <DownloadIcon class="w-4 h-4" />
              <span>Save</span>
            </button>

            {/* Only show share if Web Share API is available */}
            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <button
                type="button"
                class="flex items-center gap-2 w-full px-3 py-2 text-terminal-sm text-text hover:bg-primary/10 rounded-terminal transition-colors"
                onClick={() => handleContextAction('share')}
              >
                <ShareIcon class="w-4 h-4" />
                <span>Share</span>
              </button>
            )}

            <button
              type="button"
              class="flex items-center gap-2 w-full px-3 py-2 text-terminal-sm text-text hover:bg-primary/10 rounded-terminal transition-colors"
              onClick={() => handleContextAction('copy')}
            >
              <CopyIcon class="w-4 h-4" />
              <span>Copy</span>
            </button>

            <div class="my-1 border-t border-muted" />

            <button
              type="button"
              class="flex items-center gap-2 w-full px-3 py-2 text-terminal-sm text-muted hover:bg-primary/10 rounded-terminal transition-colors"
              onClick={() => setShowContextMenu(false)}
            >
              <CloseIcon class="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate display dimensions maintaining aspect ratio
 */
function calculateDisplayDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { displayWidth: number; displayHeight: number } {
  let displayWidth = originalWidth;
  let displayHeight = originalHeight;

  // Scale down if needed
  if (displayWidth > maxWidth) {
    displayHeight = (displayHeight * maxWidth) / displayWidth;
    displayWidth = maxWidth;
  }

  if (displayHeight > maxHeight) {
    displayWidth = (displayWidth * maxHeight) / displayHeight;
    displayHeight = maxHeight;
  }

  // Minimum size
  displayWidth = Math.max(displayWidth, 100);
  displayHeight = Math.max(displayHeight, 100);

  return {
    displayWidth: Math.round(displayWidth),
    displayHeight: Math.round(displayHeight),
  };
}

// ============================================================================
// Image Message Bubble Wrapper
// ============================================================================

export interface ImageMessageBubbleProps {
  /** Image message content */
  content: ImageMessageContent;
  /** Whether the message is from the current user */
  isOwn: boolean;
  /** Formatted timestamp */
  timestamp: string;
  /** Sender nickname (for received messages) */
  senderNickname?: string;
  /** Sender fingerprint */
  senderFingerprint?: string;
  /** Show sender info */
  showSender?: boolean;
}

/**
 * ImageMessageBubble wraps ImageMessage with message bubble styling
 */
export const ImageMessageBubble: FunctionComponent<ImageMessageBubbleProps> = ({
  content,
  isOwn,
  timestamp,
  senderNickname,
  senderFingerprint,
  showSender = true,
}) => {
  const shortFingerprint = senderFingerprint?.slice(0, 8) ?? '';

  return (
    <div
      class={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} py-1 animate-terminal-fade-in`}
    >
      {/* Sender name (for received messages) */}
      {!isOwn && showSender && senderNickname && (
        <div class="flex items-center gap-1.5 mb-0.5 px-1">
          <span class="text-terminal-xs font-medium text-primary">
            {senderNickname}
          </span>
          {shortFingerprint && (
            <span class="text-terminal-xs text-muted font-mono">
              [{shortFingerprint}]
            </span>
          )}
        </div>
      )}

      {/* Image message */}
      <div
        class={`p-1 rounded-terminal ${
          isOwn ? 'bg-primary/20 border border-primary/30' : 'bg-surface border border-muted'
        }`}
      >
        <ImageMessage content={content} isOwn={isOwn} />

        {/* Timestamp */}
        <div class="flex justify-end mt-1 px-1">
          <span class="text-terminal-xs text-muted">{timestamp}</span>
        </div>
      </div>
    </div>
  );
};

export default ImageMessage;
