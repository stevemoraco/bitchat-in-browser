/**
 * Progress Component - Terminal-style progress bars
 *
 * Features:
 * - Determinate progress (0-100%)
 * - Indeterminate mode (animated)
 * - Multiple variants (bar, blocks, ascii)
 * - Percentage display option
 * - Terminal aesthetic
 *
 * @module components/loading/Progress
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export type ProgressVariant = 'bar' | 'blocks' | 'ascii' | 'dots';
export type ProgressSize = 'sm' | 'md' | 'lg';

interface ProgressBaseProps {
  /** Current progress value (0-100) */
  value?: number;
  /** Whether progress is indeterminate */
  indeterminate?: boolean;
  /** Show percentage text */
  showPercentage?: boolean;
  /** Label to display */
  label?: string;
  /** Additional CSS classes */
  class?: string;
}

interface ProgressBarProps extends ProgressBaseProps {
  /** Progress bar variant */
  variant?: ProgressVariant;
  /** Size of the progress bar */
  size?: ProgressSize;
  /** Width of the progress bar (CSS value) */
  width?: string;
  /** Show brackets around the bar */
  showBrackets?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** ASCII block characters for progress */
const BLOCK_CHARS = {
  empty: '\u2591', // Light shade
  quarter: '\u2592', // Medium shade
  half: '\u2593', // Dark shade
  full: '\u2588', // Full block
};

/** Size configurations */
const SIZE_CONFIG: Record<ProgressSize, { height: string; fontSize: string; blockCount: number }> = {
  sm: { height: 'h-2', fontSize: 'text-xs', blockCount: 10 },
  md: { height: 'h-3', fontSize: 'text-sm', blockCount: 20 },
  lg: { height: 'h-4', fontSize: 'text-base', blockCount: 30 },
};

// ============================================================================
// Indeterminate Animation Hook
// ============================================================================

function useIndeterminateAnimation(enabled: boolean): number {
  const [position, setPosition] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setPosition((prev) => (prev + 2) % 100);
    }, 50);

    return () => clearInterval(interval);
  }, [enabled]);

  return position;
}

// ============================================================================
// Progress Bar Component
// ============================================================================

export const ProgressBar: FunctionComponent<ProgressBarProps> = ({
  value = 0,
  indeterminate = false,
  showPercentage = false,
  label,
  variant = 'bar',
  size = 'md',
  width = '100%',
  showBrackets = true,
  class: className = '',
}) => {
  const config = SIZE_CONFIG[size];
  const clampedValue = Math.max(0, Math.min(100, value));
  const animPosition = useIndeterminateAnimation(indeterminate);

  // Render based on variant
  const renderProgressContent = () => {
    switch (variant) {
      case 'blocks':
        return renderBlocksProgress(clampedValue, indeterminate, animPosition, config.blockCount);
      case 'ascii':
        return renderAsciiProgress(clampedValue, indeterminate, animPosition, config.blockCount);
      case 'dots':
        return renderDotsProgress(clampedValue, indeterminate, animPosition);
      default:
        return renderBarProgress(clampedValue, indeterminate, animPosition, config.height);
    }
  };

  return (
    <div
      class={`font-mono ${config.fontSize} ${className}`}
      style={{ width }}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
    >
      {/* Label */}
      {label && (
        <div class="flex items-center justify-between mb-1">
          <span class="text-terminal-green/80">{label}</span>
          {showPercentage && !indeterminate && (
            <span class="text-terminal-green/60">{Math.round(clampedValue)}%</span>
          )}
        </div>
      )}

      {/* Progress content */}
      <div class="flex items-center gap-1">
        {showBrackets && <span class="text-terminal-green/60">[</span>}
        <div class="flex-1">{renderProgressContent()}</div>
        {showBrackets && <span class="text-terminal-green/60">]</span>}
        {showPercentage && !label && !indeterminate && (
          <span class="text-terminal-green/60 ml-2">{Math.round(clampedValue)}%</span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// Render Functions
// ============================================================================

/**
 * Render standard bar progress
 */
function renderBarProgress(
  value: number,
  indeterminate: boolean,
  animPosition: number,
  heightClass: string
): preact.VNode {
  if (indeterminate) {
    return (
      <div class={`${heightClass} bg-terminal-green/10 rounded-terminal overflow-hidden`}>
        <div
          class="h-full bg-terminal-green rounded-terminal transition-all duration-100"
          style={{
            width: '30%',
            marginLeft: `${animPosition * 0.7}%`,
          }}
        />
      </div>
    );
  }

  return (
    <div class={`${heightClass} bg-terminal-green/10 rounded-terminal overflow-hidden`}>
      <div
        class="h-full bg-terminal-green rounded-terminal transition-all duration-150"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

/**
 * Render block-based progress
 */
function renderBlocksProgress(
  value: number,
  indeterminate: boolean,
  animPosition: number,
  blockCount: number
): preact.VNode {
  const filledBlocks = Math.floor((value / 100) * blockCount);
  const partialFill = ((value / 100) * blockCount) % 1;

  if (indeterminate) {
    const activeStart = Math.floor((animPosition / 100) * blockCount);
    return (
      <span class="text-terminal-green tracking-tighter">
        {Array.from({ length: blockCount }, (_, i) => {
          const distance = Math.abs(i - activeStart);
          if (distance <= 2) {
            return distance === 0 ? BLOCK_CHARS.full : distance === 1 ? BLOCK_CHARS.half : BLOCK_CHARS.quarter;
          }
          return BLOCK_CHARS.empty;
        }).join('')}
      </span>
    );
  }

  return (
    <span class="text-terminal-green tracking-tighter">
      {Array.from({ length: blockCount }, (_, i) => {
        if (i < filledBlocks) {
          return BLOCK_CHARS.full;
        }
        if (i === filledBlocks && partialFill > 0) {
          if (partialFill > 0.75) return BLOCK_CHARS.half;
          if (partialFill > 0.25) return BLOCK_CHARS.quarter;
        }
        return BLOCK_CHARS.empty;
      }).join('')}
    </span>
  );
}

/**
 * Render ASCII progress (= and -)
 */
function renderAsciiProgress(
  value: number,
  indeterminate: boolean,
  animPosition: number,
  blockCount: number
): preact.VNode {
  const filledBlocks = Math.floor((value / 100) * blockCount);

  if (indeterminate) {
    const activeStart = Math.floor((animPosition / 100) * blockCount);
    return (
      <span class="text-terminal-green">
        {Array.from({ length: blockCount }, (_, i) => {
          const distance = Math.abs(i - activeStart);
          return distance <= 2 ? '=' : '-';
        }).join('')}
      </span>
    );
  }

  return (
    <span class="text-terminal-green">
      {'='.repeat(filledBlocks)}
      {filledBlocks < blockCount && '>'}
      {'-'.repeat(Math.max(0, blockCount - filledBlocks - 1))}
    </span>
  );
}

/**
 * Render dots progress
 */
function renderDotsProgress(
  value: number,
  indeterminate: boolean,
  animPosition: number
): preact.VNode {
  const dotCount = 10;
  const filledDots = Math.floor((value / 100) * dotCount);

  if (indeterminate) {
    const activeIndex = Math.floor((animPosition / 100) * dotCount);
    return (
      <span class="text-terminal-green tracking-widest">
        {Array.from({ length: dotCount }, (_, i) => {
          const distance = Math.abs(i - activeIndex);
          return distance <= 1 ? '\u25CF' : '\u25CB';
        }).join(' ')}
      </span>
    );
  }

  return (
    <span class="text-terminal-green tracking-widest">
      {Array.from({ length: dotCount }, (_, i) =>
        i < filledDots ? '\u25CF' : '\u25CB'
      ).join(' ')}
    </span>
  );
}

// ============================================================================
// Alternative Progress Components
// ============================================================================

/**
 * Simple inline progress indicator
 */
export const InlineProgress: FunctionComponent<{
  value?: number;
  class?: string;
}> = ({ value = 0, class: className = '' }) => {
  const clampedValue = Math.max(0, Math.min(100, value));
  return (
    <span class={`font-mono text-terminal-green ${className}`}>
      [{Math.round(clampedValue)}%]
    </span>
  );
};

/**
 * Terminal-style progress with message
 */
export const TerminalProgress: FunctionComponent<{
  message: string;
  value?: number;
  indeterminate?: boolean;
  class?: string;
}> = ({ message, value = 0, indeterminate = false, class: className = '' }) => {
  const animPosition = useIndeterminateAnimation(indeterminate);
  const clampedValue = Math.max(0, Math.min(100, value));

  const spinnerFrames = ['|', '/', '-', '\\'];
  const frameIndex = Math.floor(animPosition / 10) % spinnerFrames.length;

  return (
    <div class={`font-mono text-sm ${className}`}>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-terminal-green/60">&gt;</span>
        <span class="text-terminal-green/80">{message}</span>
        {indeterminate && (
          <span class="text-terminal-green">{spinnerFrames[frameIndex]}</span>
        )}
      </div>
      <ProgressBar
        value={clampedValue}
        indeterminate={indeterminate}
        variant="ascii"
        size="sm"
        showBrackets
        showPercentage={!indeterminate}
      />
    </div>
  );
};

/**
 * Multi-step progress indicator
 */
export const StepProgress: FunctionComponent<{
  steps: Array<{ label: string; status: 'pending' | 'active' | 'completed' | 'error' }>;
  class?: string;
}> = ({ steps, class: className = '' }) => (
    <div class={`font-mono text-sm space-y-1 ${className}`}>
      {steps.map((step, index) => {
        const statusSymbol = {
          pending: '\u25CB',
          active: '\u25D4',
          completed: '\u25CF',
          error: '\u2715',
        }[step.status];

        const statusColor = {
          pending: 'text-terminal-green/40',
          active: 'text-terminal-green animate-pulse',
          completed: 'text-terminal-green',
          error: 'text-terminal-red',
        }[step.status];

        return (
          <div key={index} class="flex items-center gap-2">
            <span class={statusColor}>{statusSymbol}</span>
            <span
              class={
                step.status === 'pending'
                  ? 'text-terminal-green/40'
                  : step.status === 'error'
                  ? 'text-terminal-red'
                  : 'text-terminal-green/80'
              }
            >
              {step.label}
            </span>
            {step.status === 'active' && (
              <span class="text-terminal-green/60">...</span>
            )}
          </div>
        );
      })}
    </div>
  );

/**
 * Circular progress (text-based)
 */
export const CircularProgress: FunctionComponent<{
  value?: number;
  size?: 'sm' | 'md' | 'lg';
  class?: string;
}> = ({ value = 0, size = 'md', class: className = '' }) => {
  const clampedValue = Math.max(0, Math.min(100, value));

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  // Use pie chart unicode characters to represent progress
  const pieChars = [
    '\u25CB', // 0%
    '\u25D4', // 25%
    '\u25D1', // 50%
    '\u25D5', // 75%
    '\u25CF', // 100%
  ];

  const charIndex = Math.min(4, Math.floor(clampedValue / 25));

  return (
    <div class={`font-mono text-terminal-green text-center ${className}`}>
      <div class={sizeClasses[size]}>{pieChars[charIndex]}</div>
      <div class="text-xs text-terminal-green/60 mt-1">{Math.round(clampedValue)}%</div>
    </div>
  );
};

/**
 * Download/upload progress with speed indicator
 */
export const TransferProgress: FunctionComponent<{
  label?: string;
  transferred: number;
  total: number;
  speed?: number; // bytes per second
  class?: string;
}> = ({ label = 'Transfer', transferred, total, speed, class: className = '' }) => {
  const percentage = total > 0 ? (transferred / total) * 100 : 0;

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec < 1024) return `${bytesPerSec}B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)}KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)}MB/s`;
  };

  return (
    <div class={`font-mono text-sm ${className}`}>
      <div class="flex items-center justify-between mb-1">
        <span class="text-terminal-green/80">{label}</span>
        <span class="text-terminal-green/60">
          {formatBytes(transferred)} / {formatBytes(total)}
        </span>
      </div>
      <ProgressBar value={percentage} variant="blocks" size="sm" showBrackets />
      {speed !== undefined && (
        <div class="text-xs text-terminal-green/40 mt-1 text-right">
          {formatSpeed(speed)}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export type { ProgressBaseProps, ProgressBarProps };
export default ProgressBar;
