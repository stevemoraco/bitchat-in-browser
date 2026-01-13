/**
 * Skeleton Component - Terminal-style skeleton loaders
 *
 * Features:
 * - Skeleton loaders for various content types
 * - Message list skeleton
 * - Channel list skeleton
 * - Peer list skeleton
 * - Settings section skeleton
 * - Terminal-style placeholder animation
 *
 * @module components/loading/Skeleton
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

interface SkeletonBaseProps {
  /** Additional CSS classes */
  class?: string;
  /** Animation variant */
  animate?: boolean;
}

interface SkeletonLineProps extends SkeletonBaseProps {
  /** Width of the line (CSS value or percentage) */
  width?: string;
  /** Height of the line */
  height?: 'sm' | 'md' | 'lg';
}

interface SkeletonMessageProps extends SkeletonBaseProps {
  /** Whether this is an outgoing message (right-aligned) */
  isOutgoing?: boolean;
  /** Show avatar placeholder */
  showAvatar?: boolean;
}

// ============================================================================
// Animation Hook
// ============================================================================

/**
 * Hook for terminal-style blinking animation
 */
function useBlinkAnimation(enabled: boolean = true, speed: number = 800): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setVisible((prev) => !prev);
    }, speed);

    return () => clearInterval(interval);
  }, [enabled, speed]);

  return visible;
}

/**
 * Hook for shimmer position animation
 * @internal Reserved for future shimmer-style skeleton animations
 */
export function useShimmerPosition(enabled: boolean = true): number {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setPosition((prev) => (prev + 5) % 100);
    }, 50);

    return () => clearInterval(interval);
  }, [enabled]);

  return position;
}

// ============================================================================
// Base Skeleton Components
// ============================================================================

/**
 * Basic skeleton line/block
 */
export const SkeletonLine: FunctionComponent<SkeletonLineProps> = ({
  width = '100%',
  height = 'md',
  class: className = '',
  animate = true,
}) => {
  const isVisible = useBlinkAnimation(animate);

  const heightClasses = {
    sm: 'h-3',
    md: 'h-4',
    lg: 'h-6',
  };

  return (
    <div
      class={`
        ${heightClasses[height]}
        bg-terminal-green/10
        border border-terminal-green/20
        rounded-terminal
        ${animate ? (isVisible ? 'opacity-60' : 'opacity-30') : 'opacity-40'}
        transition-opacity duration-300
        ${className}
      `}
      style={{ width }}
      aria-hidden="true"
    />
  );
};

/**
 * Skeleton circle (for avatars)
 */
export const SkeletonCircle: FunctionComponent<
  SkeletonBaseProps & { size?: 'sm' | 'md' | 'lg' }
> = ({ size = 'md', class: className = '', animate = true }) => {
  const isVisible = useBlinkAnimation(animate);

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  return (
    <div
      class={`
        ${sizeClasses[size]}
        bg-terminal-green/10
        border border-terminal-green/20
        rounded-full
        ${animate ? (isVisible ? 'opacity-60' : 'opacity-30') : 'opacity-40'}
        transition-opacity duration-300
        ${className}
      `}
      aria-hidden="true"
    />
  );
};

/**
 * Terminal-style placeholder text that blinks
 */
export const SkeletonText: FunctionComponent<
  SkeletonBaseProps & { text?: string; length?: number }
> = ({ text, length = 20, class: className = '', animate = true }) => {
  const isVisible = useBlinkAnimation(animate);
  const displayText = text || '\u2588'.repeat(length);

  return (
    <span
      class={`
        font-mono text-terminal-green/30
        ${animate ? (isVisible ? 'opacity-60' : 'opacity-30') : 'opacity-40'}
        transition-opacity duration-300
        ${className}
      `}
      aria-hidden="true"
    >
      {displayText}
    </span>
  );
};

// ============================================================================
// Composite Skeleton Components
// ============================================================================

/**
 * Message skeleton (for message list loading)
 */
export const SkeletonMessage: FunctionComponent<SkeletonMessageProps> = ({
  isOutgoing = false,
  showAvatar = true,
  class: className = '',
  animate = true,
}) => {
  const isVisible = useBlinkAnimation(animate, 600);

  return (
    <div
      class={`
        flex gap-3 py-2 px-3
        ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}
        ${className}
      `}
      aria-hidden="true"
    >
      {/* Avatar placeholder */}
      {showAvatar && !isOutgoing && <SkeletonCircle size="sm" animate={animate} />}

      {/* Message content */}
      <div
        class={`
          flex flex-col gap-1
          ${isOutgoing ? 'items-end' : 'items-start'}
          max-w-[70%]
        `}
      >
        {/* Sender name (for incoming) */}
        {!isOutgoing && (
          <SkeletonLine width="80px" height="sm" animate={animate} />
        )}

        {/* Message bubble */}
        <div
          class={`
            px-3 py-2 rounded-lg
            bg-terminal-green/5 border border-terminal-green/20
            ${animate ? (isVisible ? 'opacity-60' : 'opacity-40') : 'opacity-40'}
            transition-opacity duration-300
          `}
        >
          <div class="space-y-1">
            <SkeletonLine width="180px" height="md" animate={animate} />
            <SkeletonLine width="120px" height="md" animate={animate} />
          </div>
        </div>

        {/* Timestamp */}
        <SkeletonLine width="50px" height="sm" animate={animate} />
      </div>
    </div>
  );
};

/**
 * Channel item skeleton (for channel list loading)
 */
export const SkeletonChannel: FunctionComponent<SkeletonBaseProps> = ({
  class: className = '',
  animate = true,
}) => {
  return (
    <div
      class={`flex items-center gap-3 px-4 py-3 ${className}`}
      aria-hidden="true"
    >
      {/* Channel icon */}
      <SkeletonCircle size="md" animate={animate} />

      {/* Channel info */}
      <div class="flex-1 space-y-2">
        <div class="flex items-center justify-between">
          <SkeletonLine width="120px" height="md" animate={animate} />
          <SkeletonLine width="40px" height="sm" animate={animate} />
        </div>
        <SkeletonLine width="200px" height="sm" animate={animate} />
      </div>
    </div>
  );
};

/**
 * Peer item skeleton (for peer list loading)
 */
export const SkeletonPeer: FunctionComponent<SkeletonBaseProps> = ({
  class: className = '',
  animate = true,
}) => {
  return (
    <div
      class={`flex items-center gap-3 px-4 py-3 ${className}`}
      aria-hidden="true"
    >
      {/* Avatar with status */}
      <div class="relative">
        <SkeletonCircle size="md" animate={animate} />
        <div class="absolute bottom-0 right-0 w-3 h-3 bg-terminal-green/20 rounded-full border-2 border-terminal-bg" />
      </div>

      {/* Peer info */}
      <div class="flex-1 space-y-2">
        <SkeletonLine width="100px" height="md" animate={animate} />
        <SkeletonLine width="160px" height="sm" animate={animate} />
      </div>

      {/* Action area */}
      <SkeletonLine width="60px" height="md" animate={animate} />
    </div>
  );
};

/**
 * Settings section skeleton
 */
export const SkeletonSettings: FunctionComponent<
  SkeletonBaseProps & { rows?: number }
> = ({ rows = 4, class: className = '', animate = true }) => {
  return (
    <div class={`space-y-4 ${className}`} aria-hidden="true">
      {/* Section header */}
      <div class="flex items-center gap-2 mb-4">
        <SkeletonLine width="24px" height="md" animate={animate} />
        <SkeletonLine width="120px" height="lg" animate={animate} />
      </div>

      {/* Settings rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          class="flex items-center justify-between py-3 border-b border-terminal-green/10"
        >
          <div class="space-y-1">
            <SkeletonLine width="100px" height="md" animate={animate} />
            <SkeletonLine width="180px" height="sm" animate={animate} />
          </div>
          <SkeletonLine width="80px" height="md" animate={animate} />
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// List Skeleton Components
// ============================================================================

/**
 * Message list skeleton
 */
export const SkeletonMessageList: FunctionComponent<
  SkeletonBaseProps & { count?: number }
> = ({ count = 5, class: className = '', animate = true }) => {
  // Alternate between incoming and outgoing messages
  const messages = Array.from({ length: count }, (_, i) => ({
    id: i,
    isOutgoing: i % 3 === 0,
  }));

  return (
    <div class={`space-y-2 p-2 ${className}`} aria-hidden="true" role="status" aria-label="Loading messages">
      {messages.map((msg) => (
        <SkeletonMessage
          key={msg.id}
          isOutgoing={msg.isOutgoing}
          showAvatar={!msg.isOutgoing}
          animate={animate}
        />
      ))}
    </div>
  );
};

/**
 * Channel list skeleton
 */
export const SkeletonChannelList: FunctionComponent<
  SkeletonBaseProps & { count?: number }
> = ({ count = 5, class: className = '', animate = true }) => {
  return (
    <div class={`divide-y divide-terminal-green/10 ${className}`} aria-hidden="true" role="status" aria-label="Loading channels">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonChannel key={i} animate={animate} />
      ))}
    </div>
  );
};

/**
 * Peer list skeleton
 */
export const SkeletonPeerList: FunctionComponent<
  SkeletonBaseProps & { count?: number }
> = ({ count = 5, class: className = '', animate = true }) => {
  return (
    <div class={`divide-y divide-terminal-green/10 ${className}`} aria-hidden="true" role="status" aria-label="Loading peers">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonPeer key={i} animate={animate} />
      ))}
    </div>
  );
};

// ============================================================================
// Terminal-Style Skeleton
// ============================================================================

/**
 * Terminal command-style skeleton
 */
export const SkeletonTerminal: FunctionComponent<
  SkeletonBaseProps & { lines?: number }
> = ({ lines = 3, class: className = '', animate = true }) => {
  const isVisible = useBlinkAnimation(animate, 500);

  return (
    <div
      class={`font-mono text-sm space-y-1 ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} class="flex items-center gap-2">
          <span class="text-terminal-green/40">&gt;</span>
          <span
            class={`
              text-terminal-green/30
              ${animate ? (isVisible ? 'opacity-60' : 'opacity-30') : 'opacity-40'}
              transition-opacity duration-300
            `}
          >
            {'\u2588'.repeat(Math.floor(Math.random() * 30) + 10)}
          </span>
        </div>
      ))}
      {/* Blinking cursor on last line */}
      <div class="flex items-center gap-2">
        <span class="text-terminal-green/40">&gt;</span>
        <span class="text-terminal-green animate-cursor-blink">_</span>
      </div>
    </div>
  );
};

/**
 * Code block skeleton
 */
export const SkeletonCode: FunctionComponent<
  SkeletonBaseProps & { lines?: number }
> = ({ lines = 5, class: className = '', animate = true }) => {
  return (
    <div
      class={`
        bg-terminal-bg border border-terminal-green/20 rounded-terminal p-3
        font-mono text-xs space-y-1
        ${className}
      `}
      aria-hidden="true"
    >
      {Array.from({ length: lines }, (_, i) => {
        const indent = Math.floor(Math.random() * 3) * 2;
        const width = Math.floor(Math.random() * 60) + 20;
        return (
          <div key={i} class="flex">
            <span class="text-terminal-green/20 w-6">{i + 1}</span>
            <span style={{ paddingLeft: `${indent * 8}px` }}>
              <SkeletonLine width={`${width}%`} height="sm" animate={animate} />
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export type { SkeletonBaseProps, SkeletonLineProps, SkeletonMessageProps };
export default SkeletonLine;
