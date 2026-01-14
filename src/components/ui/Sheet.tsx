/**
 * Sheet Component
 *
 * iOS-style slide-up modal sheet with support for:
 * - Half-sheet (50% height) and full-sheet modes
 * - Drag-to-dismiss gesture with velocity-based close
 * - Backdrop blur and dimming with smooth fade
 * - Spring physics animations for natural feel
 * - Stack offset animation for sheets behind
 */

import type { FunctionComponent, ComponentChildren } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { hapticFeedback } from '../../utils/haptics';

export type SheetHeight = 'half' | 'full' | 'auto';

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  height?: SheetHeight;
  title?: string;
  showHandle?: boolean;
  closeOnBackdrop?: boolean;
  /** Whether this sheet is stacked behind another */
  isStacked?: boolean;
  children: ComponentChildren;
}

// Animation timing constants
const ANIMATION_DURATION = 300; // ms
const VELOCITY_THRESHOLD = 0.5; // px/ms - velocity needed to trigger close
const DRAG_THRESHOLD = 100; // px - distance needed to trigger close without velocity

export const Sheet: FunctionComponent<SheetProps> = ({
  isOpen,
  onClose,
  height = 'half',
  title,
  showHandle = true,
  closeOnBackdrop = true,
  isStacked = false,
  children,
}) => {
  const [animationState, setAnimationState] = useState<'entering' | 'entered' | 'exiting' | 'exited'>('exited');
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);

  // Handle open/close animations
  useEffect(() => {
    if (isOpen && animationState === 'exited') {
      // Start entering animation
      setAnimationState('entering');
      hapticFeedback.light();

      // Use requestAnimationFrame for smooth animation start
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimationState('entered');
        });
      });
    } else if (!isOpen && (animationState === 'entered' || animationState === 'entering')) {
      // Start exiting animation
      setAnimationState('exiting');

      // Wait for animation to complete
      const timer = setTimeout(() => {
        setAnimationState('exited');
      }, ANIMATION_DURATION);

      return () => clearTimeout(timer);
    }
  }, [isOpen, animationState]);

  // Reset state when fully closed
  useEffect(() => {
    if (animationState === 'exited') {
      setDragOffset(0);
      setIsDragging(false);
    }
  }, [animationState]);

  // Calculate height class
  const heightClass = {
    half: 'h-[50vh]',
    full: 'h-[90vh]',
    auto: 'h-auto max-h-[90vh]',
  }[height];

  // Calculate velocity from drag movement
  const updateVelocity = useCallback((currentY: number, currentTime: number) => {
    const deltaY = currentY - lastYRef.current;
    const deltaTime = currentTime - lastTimeRef.current;

    if (deltaTime > 0) {
      velocityRef.current = deltaY / deltaTime;
    }

    lastYRef.current = currentY;
    lastTimeRef.current = currentTime;
  }, []);

  // Drag handlers for swipe-to-dismiss
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!showHandle) return;

    const touchY = e.touches[0].clientY;
    const now = performance.now();

    startYRef.current = touchY;
    startTimeRef.current = now;
    lastYRef.current = touchY;
    lastTimeRef.current = now;
    velocityRef.current = 0;

    setIsDragging(true);
  }, [showHandle]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;

    const currentY = e.touches[0].clientY;
    const now = performance.now();
    const diff = currentY - startYRef.current;

    updateVelocity(currentY, now);

    // Only allow dragging down
    if (diff > 0) {
      // Apply resistance as drag increases
      const resistance = 1 - Math.min(diff / 500, 0.5);
      setDragOffset(diff * resistance);
    }
  }, [isDragging, updateVelocity]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    // Check if should close based on velocity or distance
    const shouldClose =
      velocityRef.current > VELOCITY_THRESHOLD ||
      dragOffset > DRAG_THRESHOLD;

    if (shouldClose) {
      hapticFeedback.light();
      onClose();
    }

    setDragOffset(0);
  }, [isDragging, dragOffset, onClose]);

  // Mouse drag handlers (for desktop)
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!showHandle) return;

    const now = performance.now();

    startYRef.current = e.clientY;
    startTimeRef.current = now;
    lastYRef.current = e.clientY;
    lastTimeRef.current = now;
    velocityRef.current = 0;

    setIsDragging(true);
  }, [showHandle]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const now = performance.now();
    const diff = e.clientY - startYRef.current;

    updateVelocity(e.clientY, now);

    if (diff > 0) {
      const resistance = 1 - Math.min(diff / 500, 0.5);
      setDragOffset(diff * resistance);
    }
  }, [isDragging, updateVelocity]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    const shouldClose =
      velocityRef.current > VELOCITY_THRESHOLD ||
      dragOffset > DRAG_THRESHOLD;

    if (shouldClose) {
      onClose();
    }

    setDragOffset(0);
  }, [isDragging, dragOffset, onClose]);

  // Add/remove global mouse listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle backdrop click
  const handleBackdropClick = useCallback(() => {
    if (closeOnBackdrop) {
      hapticFeedback.light();
      onClose();
    }
  }, [closeOnBackdrop, onClose]);

  // Don't render if fully exited
  if (animationState === 'exited') return null;

  // Calculate backdrop opacity based on drag
  const backdropOpacity = isDragging
    ? Math.max(0, 0.5 - (dragOffset / 400))
    : animationState === 'entered' ? 0.5 : 0;

  // Calculate sheet transform
  const getSheetTransform = () => {
    if (isDragging) {
      return `translateY(${dragOffset}px)`;
    }
    if (isStacked) {
      return 'scale(0.95) translateY(-8px)';
    }
    if (animationState === 'entering' || animationState === 'exiting') {
      return 'translateY(100%)';
    }
    return 'translateY(0)';
  };

  return (
    <div class="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        class="sheet-backdrop absolute inset-0 bg-black"
        onClick={handleBackdropClick}
        style={{
          opacity: backdropOpacity,
          backdropFilter: animationState === 'entered' && !isDragging ? 'blur(4px)' : 'blur(0)',
          WebkitBackdropFilter: animationState === 'entered' && !isDragging ? 'blur(4px)' : 'blur(0)',
          transition: isDragging ? 'none' : `opacity ${ANIMATION_DURATION}ms ease-out, backdrop-filter ${ANIMATION_DURATION}ms ease-out`,
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        class={`sheet-panel absolute bottom-0 left-0 right-0 bg-surface rounded-t-2xl ${heightClass} flex flex-col ${
          isDragging ? 'sheet-panel-dragging' : ''
        } ${isStacked ? 'sheet-stacked' : ''}`}
        style={{
          transform: getSheetTransform(),
          opacity: isStacked ? 0.7 : 1,
          transition: isDragging
            ? 'none'
            : `transform ${ANIMATION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), opacity ${ANIMATION_DURATION}ms ease-out`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        {showHandle && (
          <div
            class="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-none"
            onMouseDown={handleMouseDown}
          >
            <div class="w-10 h-1 bg-muted rounded-full transition-colors hover:bg-primary/50" />
          </div>
        )}

        {/* Header */}
        {title && (
          <div class="flex items-center justify-between px-4 pb-3 border-b border-muted">
            <h2 class="text-lg font-semibold text-text">{title}</h2>
            <button
              onClick={() => {
                hapticFeedback.light();
                onClose();
              }}
              class="text-muted hover:text-text p-1 -mr-1 btn-press transition-colors"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        <div class="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Sheet;
