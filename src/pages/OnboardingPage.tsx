/**
 * OnboardingPage - Page wrapper for the onboarding flow
 *
 * Features:
 * - Page-level routing and state management
 * - Handles onboarding completion
 * - Redirects if already onboarded
 * - Persists onboarding state
 */

import type { FunctionComponent } from 'preact';
import { useEffect, useState, useCallback } from 'preact/hooks';
import { OnboardingFlow } from '../components/onboarding/OnboardingFlow';
import { useSettingsStore } from '../stores/settings-store';
import { useHasIdentity } from '../stores/identity-store';

// ============================================================================
// Types
// ============================================================================

export interface OnboardingPageProps {
  /** Callback when onboarding is completed, for navigation */
  onComplete?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const OnboardingPage: FunctionComponent<OnboardingPageProps> = ({
  onComplete,
}) => {
  const [isReady, setIsReady] = useState(false);
  const hasIdentity = useHasIdentity();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // Check if onboarding is needed
  useEffect(() => {
    // Wait for stores to hydrate
    const checkReady = async () => {
      // Small delay to ensure store hydration
      await new Promise((resolve) => setTimeout(resolve, 100));
      setIsReady(true);
    };

    checkReady();
  }, []);

  // Handle onboarding completion
  const handleComplete = useCallback(() => {
    // Mark onboarding as complete in settings
    // We cast here because the settings type may not include onboardingComplete yet
    updateSettings({ onboardingComplete: true } as any);

    // Call parent callback if provided
    if (onComplete) {
      onComplete();
    }
  }, [updateSettings, onComplete]);

  // Show loading while checking state
  if (!isReady) {
    return (
      <div class="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin h-8 w-8 border-2 border-terminal-green border-t-transparent rounded-full mx-auto mb-4" />
          <p class="text-terminal-green/70 font-mono">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if already onboarded
  const isOnboarded = hasIdentity && (settings as any).onboardingComplete === true;

  if (isOnboarded && onComplete) {
    // Already onboarded, trigger navigation
    // Use effect to avoid calling during render
    setTimeout(() => onComplete(), 0);

    return (
      <div class="min-h-screen bg-terminal-bg flex items-center justify-center">
        <div class="text-center">
          <p class="text-terminal-green font-mono">Redirecting...</p>
        </div>
      </div>
    );
  }

  return <OnboardingFlow onComplete={handleComplete} />;
};

export default OnboardingPage;
