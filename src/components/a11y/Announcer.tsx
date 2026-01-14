/**
 * Announcer Component - BitChat In Browser
 *
 * Provides an ARIA live region for screen reader announcements.
 * This is essential for dynamic content updates in SPAs where
 * screen readers need to be notified of changes.
 *
 * Features:
 * - Polite announcements (waits for user to finish current task)
 * - Assertive announcements (interrupts current task)
 * - Message notifications with sender info
 * - Status updates for connection/sync states
 * - Automatic cleanup of old announcements
 *
 * @module components/a11y/Announcer
 */

import { createContext, type FunctionComponent } from 'preact';
import { useState, useEffect, useCallback, useContext, useRef } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

/** Announcement priority level */
export type AnnouncementPriority = 'polite' | 'assertive';

/** Announcement configuration */
export interface Announcement {
  /** Unique ID for the announcement */
  id: string;
  /** The message to announce */
  message: string;
  /** Priority level (polite = queue, assertive = interrupt) */
  priority: AnnouncementPriority;
  /** Timestamp when announcement was created */
  timestamp: number;
}

/** Announcer context value */
export interface AnnouncerContextValue {
  /** Make a polite announcement (queued, non-interrupting) */
  announce: (message: string) => void;
  /** Make an assertive announcement (interrupts current speech) */
  announceImmediate: (message: string) => void;
  /** Announce a new message notification */
  announceMessage: (sender: string, preview?: string) => void;
  /** Announce a status change */
  announceStatus: (status: string) => void;
  /** Clear all pending announcements */
  clearAnnouncements: () => void;
}

// ============================================================================
// Context
// ============================================================================

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

// ============================================================================
// Constants
// ============================================================================

/** How long to keep announcements before clearing (ms) */
const ANNOUNCEMENT_LIFETIME = 5000;

/** Debounce time for rapid announcements (ms) */
const ANNOUNCEMENT_DEBOUNCE = 500;

// ============================================================================
// Announcer Provider
// ============================================================================

interface AnnouncerProviderProps {
  children: preact.ComponentChildren;
}

/**
 * AnnouncerProvider - Provides announcement functionality to the app
 *
 * Wrap your app with this provider to enable screen reader announcements
 * throughout the component tree.
 *
 * @example
 * ```tsx
 * <AnnouncerProvider>
 *   <App />
 * </AnnouncerProvider>
 * ```
 */
export const AnnouncerProvider: FunctionComponent<AnnouncerProviderProps> = ({
  children,
}) => {
  const [politeMessage, setPoliteMessage] = useState('');
  const [assertiveMessage, setAssertiveMessage] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idCounter = useRef(0);

  // Generate unique IDs for announcements
  const generateId = useCallback(() => {
    idCounter.current += 1;
    return `announcement-${idCounter.current}`;
  }, []);

  // Make a polite announcement
  const announce = useCallback((message: string) => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce rapid announcements
    debounceRef.current = setTimeout(() => {
      // Clear first to ensure re-announcement of same message works
      setPoliteMessage('');
      requestAnimationFrame(() => {
        setPoliteMessage(message);
      });

      // Auto-clear after lifetime
      setTimeout(() => {
        setPoliteMessage((current) => (current === message ? '' : current));
      }, ANNOUNCEMENT_LIFETIME);
    }, ANNOUNCEMENT_DEBOUNCE);
  }, []);

  // Make an assertive (immediate) announcement
  const announceImmediate = useCallback((message: string) => {
    // Clear first to ensure re-announcement works
    setAssertiveMessage('');
    requestAnimationFrame(() => {
      setAssertiveMessage(message);
    });

    // Auto-clear after lifetime
    setTimeout(() => {
      setAssertiveMessage((current) => (current === message ? '' : current));
    }, ANNOUNCEMENT_LIFETIME);
  }, []);

  // Announce a new message
  const announceMessage = useCallback(
    (sender: string, preview?: string) => {
      const message = preview
        ? `New message from ${sender}: ${preview}`
        : `New message from ${sender}`;
      announce(message);
    },
    [announce]
  );

  // Announce a status change
  const announceStatus = useCallback(
    (status: string) => {
      announce(status);
    },
    [announce]
  );

  // Clear all announcements
  const clearAnnouncements = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setPoliteMessage('');
    setAssertiveMessage('');
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    }, []);

  const contextValue: AnnouncerContextValue = {
    announce,
    announceImmediate,
    announceMessage,
    announceStatus,
    clearAnnouncements,
  };

  return (
    <AnnouncerContext.Provider value={contextValue}>
      {children}
      {/* Live regions for announcements */}
      <LiveRegion message={politeMessage} priority="polite" />
      <LiveRegion message={assertiveMessage} priority="assertive" />
    </AnnouncerContext.Provider>
  );
};

// ============================================================================
// Live Region Component
// ============================================================================

interface LiveRegionProps {
  message: string;
  priority: AnnouncementPriority;
}

/**
 * LiveRegion - Hidden ARIA live region for screen readers
 *
 * This component renders a visually hidden div that screen readers
 * will monitor for changes and announce to users.
 */
const LiveRegion: FunctionComponent<LiveRegionProps> = ({
  message,
  priority,
}) => (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      class="sr-only"
    >
      {message}
    </div>
  );

// ============================================================================
// Hook for using announcer
// ============================================================================

/**
 * useAnnouncer - Access the announcer context
 *
 * @returns Announcer context methods
 * @throws Error if used outside AnnouncerProvider
 *
 * @example
 * ```tsx
 * const { announce, announceMessage } = useAnnouncer();
 *
 * // Announce a status change
 * announce('Connection established');
 *
 * // Announce a new message
 * announceMessage('Alice', 'Hello!');
 * ```
 */
export function useAnnouncer(): AnnouncerContextValue {
  const context = useContext(AnnouncerContext);
  if (!context) {
    throw new Error('useAnnouncer must be used within an AnnouncerProvider');
  }
  return context;
}

// ============================================================================
// Standalone Announcer (for use without provider)
// ============================================================================

interface StandaloneAnnouncerProps {
  /** ID for the announcer element */
  id?: string;
}

/**
 * StandaloneAnnouncer - A simple live region without context
 *
 * Use this when you need a simple announcement region without
 * the full provider setup.
 *
 * @example
 * ```tsx
 * <StandaloneAnnouncer id="form-announcer" />
 *
 * // To announce:
 * const announcer = document.getElementById('form-announcer');
 * if (announcer) announcer.textContent = 'Form submitted successfully';
 * ```
 */
export const StandaloneAnnouncer: FunctionComponent<StandaloneAnnouncerProps> = ({
  id = 'announcer',
}) => (
    <div
      id={id}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    />
  );

// ============================================================================
// Utility functions for common announcements
// ============================================================================

/**
 * Pre-built announcement messages for common scenarios
 */
export const AnnouncementMessages = {
  // Connection status
  connected: (relayCount: number) =>
    `Connected to ${relayCount} relay${relayCount !== 1 ? 's' : ''}`,
  disconnected: 'Disconnected from all relays',
  reconnecting: 'Reconnecting to relays...',
  peerConnected: (peerName: string) => `${peerName} connected`,
  peerDisconnected: (peerName: string) => `${peerName} disconnected`,

  // Sync status
  syncStarted: 'Syncing messages...',
  syncComplete: 'Sync complete',
  syncFailed: 'Sync failed. Please try again.',

  // Navigation
  viewChanged: (viewName: string) => `Navigated to ${viewName}`,
  modalOpened: (modalTitle: string) => `${modalTitle} dialog opened`,
  modalClosed: 'Dialog closed',

  // Actions
  messageSent: 'Message sent',
  messageFailed: 'Failed to send message',
  copied: 'Copied to clipboard',
  saved: 'Changes saved',

  // Errors
  error: (message: string) => `Error: ${message}`,
  warning: (message: string) => `Warning: ${message}`,
} as const;

export default AnnouncerProvider;
