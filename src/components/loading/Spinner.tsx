/**
 * Spinner Component - Terminal-style loading spinner
 *
 * Features:
 * - Rotating ASCII characters (| / - \)
 * - Multiple sizes
 * - Optional label
 * - Terminal aesthetic
 *
 * @module components/loading/Spinner
 */

import { FunctionComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerVariant = 'default' | 'dots' | 'blocks' | 'braille';

interface SpinnerProps {
  /** Size of the spinner */
  size?: SpinnerSize;
  /** Optional label to display */
  label?: string;
  /** Position of the label */
  labelPosition?: 'right' | 'bottom';
  /** Spinner animation variant */
  variant?: SpinnerVariant;
  /** Additional CSS classes */
  class?: string;
  /** Speed of animation in ms */
  speed?: number;
  /** Whether to show the cursor blink effect */
  showCursor?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Spinner animation frames for different variants */
const SPINNER_FRAMES: Record<SpinnerVariant, string[]> = {
  default: ['|', '/', '-', '\\'],
  dots: ['.  ', '.. ', '...', '   '],
  blocks: ['\u2591', '\u2592', '\u2593', '\u2588', '\u2593', '\u2592'],
  braille: ['\u28F7', '\u28EF', '\u28DF', '\u28BF', '\u287F', '\u28FE', '\u28FD', '\u28FB'],
};

/** Size classes mapping */
const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-2xl',
};

/** Default animation speed by size (ms) */
const DEFAULT_SPEEDS: Record<SpinnerSize, number> = {
  sm: 100,
  md: 100,
  lg: 120,
  xl: 150,
};

// ============================================================================
// Component
// ============================================================================

export const Spinner: FunctionComponent<SpinnerProps> = ({
  size = 'md',
  label,
  labelPosition = 'right',
  variant = 'default',
  class: className = '',
  speed,
  showCursor = false,
}) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = SPINNER_FRAMES[variant];
  const animationSpeed = speed ?? DEFAULT_SPEEDS[size];

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, animationSpeed);

    return () => clearInterval(interval);
  }, [frames.length, animationSpeed]);

  const sizeClass = SIZE_CLASSES[size];
  const isVertical = labelPosition === 'bottom';

  const spinnerContent = (
    <span class="text-terminal-green font-mono" aria-hidden="true">
      [{frames[frameIndex]}]
    </span>
  );

  const labelContent = label && (
    <span class={`text-terminal-green/80 ${sizeClass}`}>
      {label}
      {showCursor && <span class="animate-cursor-blink">_</span>}
    </span>
  );

  return (
    <div
      class={`
        inline-flex items-center font-mono
        ${isVertical ? 'flex-col gap-1' : 'flex-row gap-2'}
        ${sizeClass}
        ${className}
      `}
      role="status"
      aria-label={label || 'Loading'}
    >
      {spinnerContent}
      {labelContent}
      <span class="sr-only">{label || 'Loading'}</span>
    </div>
  );
};

// ============================================================================
// Alternative Spinner Styles
// ============================================================================

/**
 * Simple text spinner without brackets
 */
export const TextSpinner: FunctionComponent<{
  class?: string;
  speed?: number;
}> = ({ class: className = '', speed = 100 }) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = SPINNER_FRAMES.default;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, speed);

    return () => clearInterval(interval);
  }, [frames.length, speed]);

  return (
    <span
      class={`font-mono text-terminal-green ${className}`}
      aria-hidden="true"
    >
      {frames[frameIndex]}
    </span>
  );
};

/**
 * Dots loading indicator (...animation)
 */
export const DotsSpinner: FunctionComponent<{
  class?: string;
  speed?: number;
  prefix?: string;
}> = ({ class: className = '', speed = 400, prefix = '' }) => {
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount((prev) => (prev + 1) % 4);
    }, speed);

    return () => clearInterval(interval);
  }, [speed]);

  const dots = '.'.repeat(dotCount).padEnd(3, ' ');

  return (
    <span
      class={`font-mono text-terminal-green ${className}`}
      role="status"
      aria-label="Loading"
    >
      {prefix}{dots}
    </span>
  );
};

/**
 * Block progress spinner (fills blocks)
 */
export const BlockSpinner: FunctionComponent<{
  class?: string;
  speed?: number;
  blockCount?: number;
}> = ({ class: className = '', speed = 150, blockCount = 4 }) => {
  const [activeBlock, setActiveBlock] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveBlock((prev) => (prev + 1) % blockCount);
    }, speed);

    return () => clearInterval(interval);
  }, [speed, blockCount]);

  const blocks = Array.from({ length: blockCount }, (_, i) => {
    const isActive = i === activeBlock;
    return isActive ? '\u2588' : '\u2591';
  }).join('');

  return (
    <span
      class={`font-mono text-terminal-green ${className}`}
      role="status"
      aria-label="Loading"
    >
      [{blocks}]
    </span>
  );
};

/**
 * Pulse spinner (fading effect)
 */
export const PulseSpinner: FunctionComponent<{
  class?: string;
  character?: string;
}> = ({ class: className = '', character = '*' }) => {
  return (
    <span
      class={`font-mono text-terminal-green animate-pulse ${className}`}
      role="status"
      aria-label="Loading"
    >
      {character}
    </span>
  );
};

/**
 * Terminal-style loading with prefix
 */
export const TerminalSpinner: FunctionComponent<{
  message?: string;
  class?: string;
  speed?: number;
}> = ({ message = 'Loading', class: className = '', speed = 100 }) => {
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = SPINNER_FRAMES.default;

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % frames.length);
    }, speed);

    return () => clearInterval(interval);
  }, [frames.length, speed]);

  return (
    <div
      class={`font-mono text-terminal-green ${className}`}
      role="status"
      aria-label={message}
    >
      <span class="text-terminal-green/60">&gt;</span>{' '}
      <span class="text-terminal-green/80">{message}</span>{' '}
      <span>{frames[frameIndex]}</span>
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export type { SpinnerProps };
export default Spinner;
