/**
 * OnboardingFlow - Main container for the onboarding flow
 *
 * Manages the multi-step onboarding process including:
 * - Step indicator showing progress
 * - Navigation (back/next)
 * - Progress tracking and persistence
 * - Conditional step rendering based on import vs create flow
 */

import type { FunctionComponent } from 'preact';
import { useState, useCallback, useMemo } from 'preact/hooks';
import { WelcomeStep } from './WelcomeStep';
import { CreateIdentityStep } from './CreateIdentityStep';
import { ImportIdentityStep } from './ImportIdentityStep';
import { BackupStep } from './BackupStep';
import { PermissionsStep } from './PermissionsStep';
import { CompleteStep } from './CompleteStep';
import { useSettingsStore } from '../../stores/settings-store';

// ============================================================================
// Types
// ============================================================================

export type OnboardingStep =
  | 'welcome'
  | 'create-identity'
  | 'import-identity'
  | 'backup'
  | 'permissions'
  | 'complete';

export type OnboardingFlow = 'create' | 'import';

export interface OnboardingState {
  /** Current step in the flow */
  currentStep: OnboardingStep;
  /** Whether user chose to create or import identity */
  flow: OnboardingFlow | null;
  /** Password set during identity creation/import */
  password: string | null;
  /** Indicates if backup was confirmed */
  backupConfirmed: boolean;
}

export interface OnboardingFlowProps {
  /** Callback when onboarding is completed */
  onComplete: () => void;
  /** Initial step to start from (for resuming) */
  initialStep?: OnboardingStep;
}

// ============================================================================
// Step Configuration
// ============================================================================

interface StepConfig {
  id: OnboardingStep;
  title: string;
  showInProgress: boolean;
  flowType: 'both' | 'create' | 'import';
}

const STEPS: StepConfig[] = [
  { id: 'welcome', title: 'Welcome', showInProgress: false, flowType: 'both' },
  { id: 'create-identity', title: 'Create Identity', showInProgress: true, flowType: 'create' },
  { id: 'import-identity', title: 'Import Identity', showInProgress: true, flowType: 'import' },
  { id: 'backup', title: 'Backup', showInProgress: true, flowType: 'create' },
  { id: 'permissions', title: 'Permissions', showInProgress: true, flowType: 'both' },
  { id: 'complete', title: 'Complete', showInProgress: false, flowType: 'both' },
];

// ============================================================================
// Component
// ============================================================================

export const OnboardingFlow: FunctionComponent<OnboardingFlowProps> = ({
  onComplete,
  initialStep = 'welcome',
}) => {
  // State
  const [state, setState] = useState<OnboardingState>({
    currentStep: initialStep,
    flow: null,
    password: null,
    backupConfirmed: false,
  });

  const updateSettings = useSettingsStore((s) => s.updateSettings);

  // Get visible steps based on flow type
  const visibleSteps = useMemo(() => {
    if (!state.flow) {
      return STEPS.filter((s) => s.id === 'welcome');
    }
    return STEPS.filter(
      (s) => s.flowType === 'both' || s.flowType === state.flow
    );
  }, [state.flow]);

  // Get current step index for progress indicator
  const currentStepIndex = useMemo(() => visibleSteps.findIndex((s) => s.id === state.currentStep), [visibleSteps, state.currentStep]);

  // Get steps to show in progress indicator
  const progressSteps = useMemo(() => visibleSteps.filter((s) => s.showInProgress), [visibleSteps]);

  // Navigation handlers
  const goToStep = useCallback((step: OnboardingStep) => {
    setState((prev) => ({ ...prev, currentStep: step }));
  }, []);

  const goBack = useCallback(() => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      const prevStep = visibleSteps[prevIndex];
      if (prevStep) {
        goToStep(prevStep.id);
      }
    }
  }, [currentStepIndex, visibleSteps, goToStep]);

  // Note: goNext is available for future use but currently navigation
  // is handled by individual step completion callbacks
  const _goNext = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < visibleSteps.length) {
      const nextStep = visibleSteps[nextIndex];
      if (nextStep) {
        goToStep(nextStep.id);
      }
    }
  }, [currentStepIndex, visibleSteps, goToStep]);
  void _goNext;

  // Flow selection handlers
  const handleSelectCreate = useCallback(() => {
    setState((prev) => ({
      ...prev,
      flow: 'create',
      currentStep: 'create-identity',
    }));
  }, []);

  const handleSelectImport = useCallback(() => {
    setState((prev) => ({
      ...prev,
      flow: 'import',
      currentStep: 'import-identity',
    }));
  }, []);

  // Identity created/imported handler
  const handleIdentityReady = useCallback((password: string) => {
    setState((prev) => ({
      ...prev,
      password,
      currentStep: prev.flow === 'create' ? 'backup' : 'permissions',
    }));
  }, []);

  // Backup confirmed handler
  const handleBackupConfirmed = useCallback(() => {
    setState((prev) => ({
      ...prev,
      backupConfirmed: true,
      currentStep: 'permissions',
    }));
  }, []);

  // Permissions done handler
  const handlePermissionsDone = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: 'complete',
    }));
  }, []);

  // Complete handler
  const handleComplete = useCallback(() => {
    // Mark onboarding as complete in settings
    updateSettings({ onboardingComplete: true } as any);
    onComplete();
  }, [onComplete, updateSettings]);

  // Check if can go back
  const canGoBack = currentStepIndex > 0 && state.currentStep !== 'welcome';

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (progressSteps.length === 0) return 0;
    const currentProgressIndex = progressSteps.findIndex(
      (s) => s.id === state.currentStep
    );
    if (currentProgressIndex === -1) {
      // If current step not in progress, check if we're past it
      const currentInAll = STEPS.findIndex((s) => s.id === state.currentStep);
      const lastProgressInAll = STEPS.findIndex(
        (s) => s.id === progressSteps[progressSteps.length - 1]?.id
      );
      if (currentInAll > lastProgressInAll) return 100;
      return 0;
    }
    return ((currentProgressIndex + 1) / progressSteps.length) * 100;
  }, [progressSteps, state.currentStep]);

  // Render step content
  const renderStep = () => {
    switch (state.currentStep) {
      case 'welcome':
        return (
          <WelcomeStep
            onGetStarted={handleSelectCreate}
            onImportKey={handleSelectImport}
          />
        );

      case 'create-identity':
        return (
          <CreateIdentityStep
            onComplete={handleIdentityReady}
            onBack={goBack}
          />
        );

      case 'import-identity':
        return (
          <ImportIdentityStep
            onComplete={handleIdentityReady}
            onBack={goBack}
          />
        );

      case 'backup':
        return (
          <BackupStep
            password={state.password!}
            onComplete={handleBackupConfirmed}
            onBack={goBack}
          />
        );

      case 'permissions':
        return (
          <PermissionsStep
            onComplete={handlePermissionsDone}
            onSkip={handlePermissionsDone}
            onBack={canGoBack ? goBack : undefined}
          />
        );

      case 'complete':
        return <CompleteStep onStartChatting={handleComplete} />;

      default:
        return null;
    }
  };

  return (
    <div class="min-h-screen bg-terminal-bg flex flex-col">
      {/* Progress indicator - only show during middle steps */}
      {state.flow && state.currentStep !== 'complete' && (
        <div class="px-4 pt-4">
          <div class="max-w-md mx-auto">
            {/* Progress bar */}
            <div class="h-1 bg-terminal-green/20 rounded-full overflow-hidden mb-2">
              <div
                class="h-full bg-terminal-green transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Step indicators */}
            <div class="flex justify-between text-xs font-mono">
              {progressSteps.map((step, index) => {
                const isActive = step.id === state.currentStep;
                const isPast =
                  progressSteps.findIndex((s) => s.id === state.currentStep) >
                  index;

                return (
                  <div
                    key={step.id}
                    class={`flex items-center gap-1 ${
                      isActive
                        ? 'text-terminal-green'
                        : isPast
                          ? 'text-terminal-green/60'
                          : 'text-terminal-green/30'
                    }`}
                  >
                    <span class="w-5 h-5 flex items-center justify-center border border-current rounded-full text-[10px]">
                      {isPast ? (
                        <svg
                          class="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="3"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span class="hidden sm:inline">{step.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step content */}
      <div class="flex-1 flex items-center justify-center p-4">
        <div class="w-full max-w-md animate-terminal-fade-in">
          {renderStep()}
        </div>
      </div>

      {/* Back button - floating for certain steps */}
      {canGoBack &&
        state.currentStep !== 'welcome' &&
        state.currentStep !== 'complete' && (
          <button
            onClick={goBack}
            class="fixed top-4 left-4 p-2 text-terminal-green/60 hover:text-terminal-green transition-colors"
            aria-label="Go back"
          >
            <svg
              class="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
    </div>
  );
};

export default OnboardingFlow;
