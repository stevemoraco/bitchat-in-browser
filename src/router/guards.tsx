/**
 * BitChat In Browser - Route Guards
 *
 * Provides route protection components:
 * - AuthGuard: Redirects to onboarding if user has no identity
 * - OnboardingGuard: Redirects to channels if user is already onboarded
 *
 * Guards are implemented as wrapper components that check conditions
 * before rendering children or redirecting.
 */

import { FunctionComponent, ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useHasIdentity, useSettingsStore } from '../stores';

// ============================================================================
// Types
// ============================================================================

export interface RouteGuardProps {
  /**
   * Path to redirect to if guard condition fails
   */
  redirectTo: string;

  /**
   * Children to render if guard condition passes
   */
  children: ComponentChildren;

  /**
   * Optional loading component while checking
   */
  fallback?: ComponentChildren;
}

// ============================================================================
// Auth Guard
// ============================================================================

/**
 * Protects routes that require authentication.
 * Redirects to specified path if user has no identity.
 */
export const AuthGuard: FunctionComponent<RouteGuardProps> = ({
  redirectTo,
  children,
  fallback,
}) => {
  const hasIdentity = useHasIdentity();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Small delay to ensure store is hydrated
    const checkAuth = async () => {
      // Wait a tick for store hydration
      await new Promise((resolve) => setTimeout(resolve, 50));
      setIsChecking(false);
    };

    checkAuth();
  }, []);

  useEffect(() => {
    if (!isChecking && !hasIdentity) {
      // Use hash-based navigation for IPFS compatibility
      const targetPath = redirectTo.startsWith('#') ? redirectTo : `#${redirectTo}`;
      window.location.hash = targetPath.replace('#', '');
    }
  }, [isChecking, hasIdentity, redirectTo]);

  // Show loading state while checking
  if (isChecking) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div class="flex items-center justify-center min-h-[50vh]">
        <div class="text-terminal-green/50 animate-pulse">&gt;_</div>
      </div>
    );
  }

  // If no identity, don't render children (will redirect)
  if (!hasIdentity) {
    return null;
  }

  // Identity exists, render children
  return <>{children}</>;
};

// ============================================================================
// Onboarding Guard
// ============================================================================

/**
 * Protects onboarding route from users who are already onboarded.
 * Redirects to specified path if user has completed onboarding.
 */
export const OnboardingGuard: FunctionComponent<RouteGuardProps> = ({
  redirectTo,
  children,
  fallback,
}) => {
  const hasIdentity = useHasIdentity();
  const onboardingComplete = useSettingsStore(
    (state) => state.settings.onboardingComplete
  );
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Small delay to ensure store is hydrated
    const checkOnboarding = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      setIsChecking(false);
    };

    checkOnboarding();
  }, []);

  useEffect(() => {
    if (!isChecking && hasIdentity && onboardingComplete) {
      // User is already onboarded, redirect away
      const targetPath = redirectTo.startsWith('#') ? redirectTo : `#${redirectTo}`;
      window.location.hash = targetPath.replace('#', '');
    }
  }, [isChecking, hasIdentity, onboardingComplete, redirectTo]);

  // Show loading state while checking
  if (isChecking) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div class="flex items-center justify-center min-h-[50vh]">
        <div class="text-terminal-green/50 animate-pulse">&gt;_</div>
      </div>
    );
  }

  // If already onboarded, don't render children (will redirect)
  if (hasIdentity && onboardingComplete) {
    return null;
  }

  // Not onboarded, render children
  return <>{children}</>;
};

// ============================================================================
// Custom Guard Hook
// ============================================================================

export interface GuardCondition {
  /**
   * Check function - returns true if guard should allow access
   */
  check: () => boolean | Promise<boolean>;

  /**
   * Path to redirect to if check fails
   */
  redirectTo: string;
}

/**
 * Hook for custom guard logic
 */
export function useRouteGuard(
  condition: GuardCondition
): { isAllowed: boolean; isChecking: boolean } {
  const [isAllowed, setIsAllowed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const runCheck = async () => {
      try {
        const result = await condition.check();
        setIsAllowed(result);

        if (!result) {
          const targetPath = condition.redirectTo.startsWith('#')
            ? condition.redirectTo
            : `#${condition.redirectTo}`;
          window.location.hash = targetPath.replace('#', '');
        }
      } catch (error) {
        console.error('Guard check failed:', error);
        setIsAllowed(false);
      } finally {
        setIsChecking(false);
      }
    };

    runCheck();
  }, [condition]);

  return { isAllowed, isChecking };
}

// ============================================================================
// Conditional Route Guard
// ============================================================================

interface ConditionalGuardProps extends RouteGuardProps {
  /**
   * Condition function that determines if access is allowed
   */
  condition: () => boolean;
}

/**
 * Generic guard that uses a custom condition function
 */
export const ConditionalGuard: FunctionComponent<ConditionalGuardProps> = ({
  condition,
  redirectTo,
  children,
  fallback,
}) => {
  const [isChecking, setIsChecking] = useState(true);
  const isAllowed = condition();

  useEffect(() => {
    // Small delay for stability
    const timer = setTimeout(() => setIsChecking(false), 50);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isChecking && !isAllowed) {
      const targetPath = redirectTo.startsWith('#') ? redirectTo : `#${redirectTo}`;
      window.location.hash = targetPath.replace('#', '');
    }
  }, [isChecking, isAllowed, redirectTo]);

  if (isChecking) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div class="flex items-center justify-center min-h-[50vh]">
        <div class="text-terminal-green/50 animate-pulse">&gt;_</div>
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
};

// ============================================================================
// Multi-Guard Wrapper
// ============================================================================

interface MultiGuardProps {
  /**
   * Array of guards to check in order
   */
  guards: Array<{
    check: () => boolean;
    redirectTo: string;
  }>;

  /**
   * Children to render if all guards pass
   */
  children: ComponentChildren;

  /**
   * Optional loading component
   */
  fallback?: ComponentChildren;
}

/**
 * Applies multiple guards in sequence
 */
export const MultiGuard: FunctionComponent<MultiGuardProps> = ({
  guards,
  children,
  fallback,
}) => {
  const [isChecking, setIsChecking] = useState(true);
  const [failedGuardRedirect, setFailedGuardRedirect] = useState<string | null>(null);

  useEffect(() => {
    const runGuards = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));

      for (const guard of guards) {
        if (!guard.check()) {
          setFailedGuardRedirect(guard.redirectTo);
          setIsChecking(false);
          return;
        }
      }

      setIsChecking(false);
    };

    runGuards();
  }, [guards]);

  useEffect(() => {
    if (!isChecking && failedGuardRedirect) {
      const targetPath = failedGuardRedirect.startsWith('#')
        ? failedGuardRedirect
        : `#${failedGuardRedirect}`;
      window.location.hash = targetPath.replace('#', '');
    }
  }, [isChecking, failedGuardRedirect]);

  if (isChecking) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div class="flex items-center justify-center min-h-[50vh]">
        <div class="text-terminal-green/50 animate-pulse">&gt;_</div>
      </div>
    );
  }

  if (failedGuardRedirect) {
    return null;
  }

  return <>{children}</>;
};
