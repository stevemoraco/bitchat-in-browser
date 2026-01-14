/**
 * CompleteStep - Onboarding completion screen
 *
 * Features:
 * - Success message with celebration
 * - Quick tips for getting started
 * - "Start Chatting" button
 */

import type { FunctionComponent } from 'preact';
import { useIdentity, useFingerprint } from '../../stores/identity-store';

// ============================================================================
// Types
// ============================================================================

export interface CompleteStepProps {
  /** Called when user clicks "Start Chatting" */
  onStartChatting: () => void;
}

// ============================================================================
// Quick Tips Data
// ============================================================================

const QUICK_TIPS = [
  {
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    title: 'Location Channels',
    description: 'Chat with people nearby using location-based channels',
  },
  {
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    title: 'Direct Messages',
    description: 'End-to-end encrypted DMs with other BitChat users',
  },
  {
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
        />
      </svg>
    ),
    title: 'Works Offline',
    description: 'Send messages offline - they sync when connected',
  },
  {
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
    title: 'Your Keys',
    description: 'You control your identity - no accounts, no tracking',
  },
];

// ============================================================================
// Component
// ============================================================================

export const CompleteStep: FunctionComponent<CompleteStepProps> = ({
  onStartChatting,
}) => {
  const identity = useIdentity();
  const fingerprint = useFingerprint();

  // Format fingerprint for display
  const shortFingerprint = fingerprint
    ? `${fingerprint.slice(0, 4)}...${fingerprint.slice(-4)}`
    : null;

  return (
    <div>
      {/* Success header */}
      <div class="text-center mb-8">
        {/* Animated checkmark */}
        <div class="w-20 h-20 mx-auto mb-4 relative">
          <div class="absolute inset-0 border-2 border-terminal-green rounded-full animate-pulse" />
          <div class="absolute inset-2 border-2 border-terminal-green/50 rounded-full" />
          <div class="absolute inset-0 flex items-center justify-center">
            <svg
              class="w-10 h-10 text-terminal-green"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h2 class="text-2xl font-bold text-terminal-green font-mono mb-2">
          You're All Set!
        </h2>
        <p class="text-terminal-green/70 font-mono text-sm">
          Your BitChat identity is ready to use
        </p>
      </div>

      {/* Identity card */}
      {identity && (
        <div class="mb-6 p-4 border border-terminal-green/30 rounded-terminal bg-terminal-green/5">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 flex items-center justify-center border border-terminal-green/50 rounded-lg font-mono text-terminal-green font-bold">
              {fingerprint?.slice(0, 2).toUpperCase() ?? '??'}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-terminal-green font-mono text-sm font-bold truncate">
                {identity.npub
                  ? `${identity.npub.slice(0, 12)}...${identity.npub.slice(-4)}`
                  : shortFingerprint}
              </p>
              <p class="text-terminal-green/60 font-mono text-xs">
                Your public identity
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick tips */}
      <div class="mb-8">
        <h3 class="text-terminal-green/60 font-mono text-xs uppercase tracking-wide mb-3">
          Quick Tips
        </h3>
        <div class="space-y-3">
          {QUICK_TIPS.map((tip, index) => (
            <div
              key={index}
              class="flex items-start gap-3 p-3 border border-terminal-green/20 rounded-terminal"
            >
              <div class="flex-shrink-0 w-8 h-8 flex items-center justify-center text-terminal-green/70">
                {tip.icon}
              </div>
              <div>
                <p class="text-terminal-green font-mono text-sm font-bold">
                  {tip.title}
                </p>
                <p class="text-terminal-green/60 font-mono text-xs">
                  {tip.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Start chatting button */}
      <button
        onClick={onStartChatting}
        class="w-full py-4 px-6 bg-terminal-green text-terminal-bg font-mono font-bold text-lg rounded-terminal hover:bg-terminal-green/90 transition-colors focus:outline-none focus:ring-2 focus:ring-terminal-green focus:ring-offset-2 focus:ring-offset-terminal-bg"
      >
        Start Chatting
      </button>

      {/* Footer links */}
      <div class="mt-6 flex justify-center gap-4 text-xs font-mono">
        <button class="text-terminal-green/40 hover:text-terminal-green/60 transition-colors">
          View Settings
        </button>
        <span class="text-terminal-green/20">|</span>
        <button class="text-terminal-green/40 hover:text-terminal-green/60 transition-colors">
          Learn More
        </button>
      </div>

      {/* Version */}
      <p class="mt-4 text-center text-terminal-green/30 font-mono text-xs">
        BitChat In Browser v1.0.0
      </p>
    </div>
  );
};

export default CompleteStep;
