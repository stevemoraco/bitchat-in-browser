/**
 * WelcomeStep - Initial welcome screen for onboarding
 *
 * Features:
 * - BitChat logo and title
 * - Brief description of the app
 * - "Get Started" button for new users
 * - "Import Existing Key" link for existing users
 */

import { FunctionComponent } from 'preact';

// ============================================================================
// Types
// ============================================================================

export interface WelcomeStepProps {
  /** Called when user clicks "Get Started" to create new identity */
  onGetStarted: () => void;
  /** Called when user clicks "Import Existing Key" */
  onImportKey: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const WelcomeStep: FunctionComponent<WelcomeStepProps> = ({
  onGetStarted,
  onImportKey,
}) => {
  return (
    <div class="text-center">
      {/* Logo */}
      <div class="mb-8">
        <div class="w-24 h-24 mx-auto mb-4 relative">
          {/* Terminal-style logo */}
          <div class="absolute inset-0 border-2 border-terminal-green rounded-lg transform rotate-3 opacity-30" />
          <div class="absolute inset-0 border-2 border-terminal-green rounded-lg transform -rotate-3 opacity-30" />
          <div class="absolute inset-0 flex items-center justify-center border-2 border-terminal-green rounded-lg bg-terminal-bg">
            <span class="text-4xl font-bold text-terminal-green font-mono">
              BC
            </span>
          </div>
          {/* Glow effect */}
          <div class="absolute inset-0 rounded-lg shadow-terminal-glow" />
        </div>

        <h1 class="text-2xl font-bold text-terminal-green font-mono mb-2">
          BitChat
        </h1>
        <p class="text-terminal-green/70 font-mono text-sm">
          In Browser
        </p>
      </div>

      {/* Description */}
      <div class="mb-8 space-y-3 text-terminal-green/80 font-mono text-sm">
        <p>
          Encrypted mesh messaging that works offline.
        </p>
        <p class="text-terminal-green/60 text-xs">
          Your keys. Your messages. No tracking.
        </p>
      </div>

      {/* Features list */}
      <div class="mb-8 text-left max-w-xs mx-auto">
        <ul class="space-y-2 font-mono text-sm">
          <li class="flex items-center gap-2 text-terminal-green/70">
            <span class="text-terminal-green">[+]</span>
            <span>End-to-end encrypted</span>
          </li>
          <li class="flex items-center gap-2 text-terminal-green/70">
            <span class="text-terminal-green">[+]</span>
            <span>Works offline after install</span>
          </li>
          <li class="flex items-center gap-2 text-terminal-green/70">
            <span class="text-terminal-green">[+]</span>
            <span>Compatible with Nostr</span>
          </li>
          <li class="flex items-center gap-2 text-terminal-green/70">
            <span class="text-terminal-green">[+]</span>
            <span>Location-based channels</span>
          </li>
        </ul>
      </div>

      {/* Primary CTA */}
      <button
        onClick={onGetStarted}
        class="w-full py-3 px-6 bg-terminal-green text-terminal-bg font-mono font-bold text-lg rounded-terminal hover:bg-terminal-green/90 transition-colors mb-4 focus:outline-none focus:ring-2 focus:ring-terminal-green focus:ring-offset-2 focus:ring-offset-terminal-bg"
      >
        Get Started
      </button>

      {/* Secondary CTA */}
      <button
        onClick={onImportKey}
        class="w-full py-2 px-4 text-terminal-green/70 font-mono text-sm hover:text-terminal-green transition-colors focus:outline-none focus:underline"
      >
        Import Existing Key
      </button>

      {/* Version info */}
      <p class="mt-8 text-terminal-green/30 font-mono text-xs">
        v1.0.0 | bitbrowse.eth.limo
      </p>
    </div>
  );
};

export default WelcomeStep;
