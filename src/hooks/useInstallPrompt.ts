/**
 * useInstallPrompt - PWA Install Prompt Hook
 *
 * Manages the PWA installation experience across different platforms:
 * - Captures the beforeinstallprompt event on supported browsers
 * - Detects if the app is already installed
 * - Tracks user dismissals to avoid nagging
 * - Provides platform-specific detection for iOS instructions
 *
 * @module hooks/useInstallPrompt
 */

import { useState, useEffect, useCallback } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

/**
 * BeforeInstallPromptEvent - Chrome's install prompt event
 * This event is fired when the browser determines the app is installable
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Platform detection result
 */
export type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

/**
 * Installation state
 */
export interface InstallState {
  /** Whether the app can be installed (prompt available or iOS) */
  canInstall: boolean;
  /** Whether the app is already installed as PWA */
  isInstalled: boolean;
  /** Whether the user has dismissed the prompt recently */
  isDismissed: boolean;
  /** Detected platform for showing appropriate instructions */
  platform: Platform;
  /** Whether we're running in standalone mode (installed PWA) */
  isStandalone: boolean;
  /** Whether the browser supports PWA installation */
  isSupported: boolean;
}

/**
 * Return type for useInstallPrompt hook
 */
export interface UseInstallPromptReturn extends InstallState {
  /** Trigger the native install prompt (Chrome/Edge only) */
  promptInstall: () => Promise<boolean>;
  /** Dismiss the install prompt and remember for 7 days */
  dismissPrompt: () => void;
  /** Check if we should show the install banner */
  shouldShowInstallBanner: boolean;
  /** Reset the dismissed state (for testing) */
  resetDismissed: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'bitchat-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Detect the current platform
 */
function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown';

  const ua = navigator.userAgent.toLowerCase();

  // iOS detection (iPhone, iPad, iPod)
  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }

  // Android detection
  if (/android/.test(ua)) {
    return 'android';
  }

  // Desktop (Windows, Mac, Linux)
  if (/windows|macintosh|linux/.test(ua) && !/mobile/.test(ua)) {
    return 'desktop';
  }

  return 'unknown';
}

/**
 * Check if running as installed PWA (standalone mode)
 */
function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;

  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // Check iOS-specific standalone property
  if ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) {
    return true;
  }

  // Check if launched from home screen on Android
  if (document.referrer.includes('android-app://')) {
    return true;
  }

  return false;
}

/**
 * Check if the prompt was dismissed recently
 */
function isDismissedRecently(): boolean {
  if (typeof localStorage === 'undefined') return false;

  try {
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (!dismissedAt) return false;

    const timestamp = parseInt(dismissedAt, 10);
    const now = Date.now();

    return now - timestamp < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

/**
 * Save dismissal timestamp
 */
function saveDismissal(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  } catch {
    // Storage not available
  }
}

/**
 * Clear dismissal timestamp
 */
function clearDismissal(): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage not available
  }
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * useInstallPrompt - Main hook for PWA installation
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [isStandalone, setIsStandalone] = useState(false);

  // Initialize state
  useEffect(() => {
    setPlatform(detectPlatform());
    setIsStandalone(isStandaloneMode());
    setIsDismissed(isDismissedRecently());
    setIsInstalled(isStandaloneMode());
  }, []);

  // Listen for beforeinstallprompt event
  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      // Prevent the default mini-infobar
      event.preventDefault();
      // Store the event for later use
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    // Listen for the install prompt event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      console.log('[PWA] App installed successfully');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Listen for display mode changes (in case user installs via browser menu)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(display-mode: standalone)');

    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsStandalone(true);
        setIsInstalled(true);
      }
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  /**
   * Trigger the native install prompt
   * Returns true if user accepted, false if dismissed or unsupported
   */
  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) {
      console.log('[PWA] No install prompt available');
      return false;
    }

    try {
      // Show the install prompt
      await deferredPrompt.prompt();

      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;

      // Clear the deferred prompt (can only be used once)
      setDeferredPrompt(null);

      if (outcome === 'accepted') {
        console.log('[PWA] User accepted the install prompt');
        return true;
      } else {
        console.log('[PWA] User dismissed the install prompt');
        saveDismissal();
        setIsDismissed(true);
        return false;
      }
    } catch (error) {
      console.error('[PWA] Error showing install prompt:', error);
      return false;
    }
  }, [deferredPrompt]);

  /**
   * Dismiss the install prompt and remember for 7 days
   */
  const dismissPrompt = useCallback(() => {
    saveDismissal();
    setIsDismissed(true);
  }, []);

  /**
   * Reset the dismissed state (for testing/settings)
   */
  const resetDismissed = useCallback(() => {
    clearDismissal();
    setIsDismissed(false);
  }, []);

  // Computed properties
  const isSupported = deferredPrompt !== null || platform === 'ios';
  const canInstall = !isInstalled && (deferredPrompt !== null || platform === 'ios');
  const shouldShowInstallBanner = canInstall && !isDismissed && !isStandalone;

  return {
    canInstall,
    isInstalled,
    isDismissed,
    platform,
    isStandalone,
    isSupported,
    promptInstall,
    dismissPrompt,
    shouldShowInstallBanner,
    resetDismissed,
  };
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * useIsInstalled - Simple hook to check if app is installed
 */
export function useIsInstalled(): boolean {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(isStandaloneMode());

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = (event: MediaQueryListEvent) => {
      setIsInstalled(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return isInstalled;
}

/**
 * usePlatform - Simple hook to get the current platform
 */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  return platform;
}

/**
 * useCanInstall - Simple hook to check if installation is possible
 */
export function useCanInstall(): boolean {
  const { canInstall } = useInstallPrompt();
  return canInstall;
}
