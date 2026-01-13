/**
 * Notification Prompt Component
 *
 * Permission request UI for push notifications:
 * - Explains benefits of notifications
 * - Enable/decline buttons
 * - Links to settings
 * - Handles iOS PWA requirements
 *
 * @module components/notifications/NotificationPrompt
 */

import { FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import {
  getNotificationService,
  NotificationCapabilities,
} from '../../services/notifications';

// ============================================================================
// Types
// ============================================================================

interface NotificationPromptProps {
  /** Called when user enables notifications */
  onEnable?: () => void;
  /** Called when user declines notifications */
  onDecline?: () => void;
  /** Called when user dismisses the prompt */
  onDismiss?: () => void;
  /** Show as compact inline banner instead of full prompt */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

type PromptState = 'initial' | 'requesting' | 'granted' | 'denied' | 'unsupported';

// ============================================================================
// Constants
// ============================================================================

const BENEFITS = [
  'Get notified when you receive new messages',
  'Never miss important conversations',
  'Works even when the app is in the background',
  'Respects your notification settings',
];

// ============================================================================
// Sub-Components
// ============================================================================

interface InfoBoxProps {
  type: 'info' | 'warning' | 'success' | 'error';
  children: preact.ComponentChildren;
}

const InfoBox: FunctionComponent<InfoBoxProps> = ({ type, children }) => {
  const colors = {
    info: 'border-terminal-blue/30 text-terminal-blue/70',
    warning: 'border-terminal-yellow/30 text-terminal-yellow/70 bg-terminal-yellow/5',
    success: 'border-terminal-green/30 text-terminal-green/70 bg-terminal-green/5',
    error: 'border-terminal-red/30 text-terminal-red/70 bg-terminal-red/5',
  };

  return (
    <div class={`p-3 border text-sm ${colors[type]}`}>
      {children}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const NotificationPrompt: FunctionComponent<NotificationPromptProps> = ({
  onEnable,
  onDecline,
  onDismiss,
  compact = false,
  className = '',
}) => {
  const [state, setState] = useState<PromptState>('initial');
  const [capabilities, setCapabilities] = useState<NotificationCapabilities | null>(null);

  // Get capabilities on first render
  if (!capabilities) {
    const service = getNotificationService();
    const caps = service.getCapabilities();
    setCapabilities(caps);

    // Check if already granted or denied
    if (service.isGranted()) {
      setState('granted');
    } else if (service.isDenied()) {
      setState('denied');
    } else if (!caps.canNotify) {
      setState('unsupported');
    }
  }

  // Handle enable button click
  const handleEnable = useCallback(async () => {
    setState('requesting');

    const service = getNotificationService();
    const granted = await service.requestPermission();

    if (granted) {
      setState('granted');
      onEnable?.();
    } else {
      setState('denied');
    }
  }, [onEnable]);

  // Handle decline button click
  const handleDecline = useCallback(() => {
    onDecline?.();
    onDismiss?.();
  }, [onDecline, onDismiss]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  // Render nothing if already granted and not showing success
  if (state === 'granted' && !compact) {
    return null;
  }

  // Compact banner variant
  if (compact) {
    return (
      <CompactPrompt
        state={state}
        capabilities={capabilities}
        onEnable={handleEnable}
        onDecline={handleDecline}
        className={className}
      />
    );
  }

  // Full prompt variant
  return (
    <div class={`space-y-4 ${className}`}>
      {/* Header */}
      <div class="text-center">
        <div class="text-terminal-green text-lg font-bold mb-2">
          Enable Notifications
        </div>
        <p class="text-terminal-green/60 text-sm">
          Stay connected with push notifications
        </p>
      </div>

      {/* Platform-specific messages */}
      {capabilities && renderPlatformMessage(capabilities)}

      {/* State-specific content */}
      {state === 'initial' && (
        <InitialState
          onEnable={handleEnable}
          onDecline={handleDecline}
        />
      )}

      {state === 'requesting' && (
        <RequestingState />
      )}

      {state === 'denied' && (
        <DeniedState onDismiss={handleDismiss} />
      )}

      {state === 'unsupported' && capabilities && (
        <UnsupportedState
          capabilities={capabilities}
          onDismiss={handleDismiss}
        />
      )}

      {state === 'granted' && (
        <GrantedState onDismiss={handleDismiss} />
      )}
    </div>
  );
};

// ============================================================================
// State Components
// ============================================================================

interface StateProps {
  onEnable?: () => void;
  onDecline?: () => void;
  onDismiss?: () => void;
  capabilities?: NotificationCapabilities | null;
}

const InitialState: FunctionComponent<StateProps> = ({ onEnable, onDecline }) => (
  <>
    {/* Benefits list */}
    <div class="border border-terminal-green/20 p-3">
      <div class="text-terminal-green text-sm font-bold mb-2">
        Notification Benefits:
      </div>
      <ul class="text-xs text-terminal-green/60 space-y-1">
        {BENEFITS.map((benefit, index) => (
          <li key={index}>- {benefit}</li>
        ))}
      </ul>
    </div>

    {/* Privacy note */}
    <InfoBox type="info">
      <div class="text-xs">
        BitChat respects your privacy. Notification content is generated locally
        and never sent to external servers.
      </div>
    </InfoBox>

    {/* Action buttons */}
    <div class="flex gap-3">
      <button
        onClick={onEnable}
        class="flex-1 px-4 py-3 bg-terminal-green text-terminal-bg font-bold
               hover:bg-terminal-green/90 transition-colors"
      >
        [ENABLE NOTIFICATIONS]
      </button>
      <button
        onClick={onDecline}
        class="px-4 py-3 border border-terminal-green/30 text-terminal-green/70
               hover:border-terminal-green/50 transition-colors"
      >
        [LATER]
      </button>
    </div>
  </>
);

const RequestingState: FunctionComponent = () => (
  <div class="text-center py-8">
    <div class="text-terminal-green animate-pulse mb-4">
      [REQUESTING PERMISSION...]
    </div>
    <p class="text-terminal-green/60 text-sm">
      Please allow notifications when prompted by your browser.
    </p>
  </div>
);

const DeniedState: FunctionComponent<StateProps> = ({ onDismiss }) => (
  <>
    <InfoBox type="warning">
      <div class="font-bold mb-1">[!] Notifications Blocked</div>
      <p class="text-xs">
        You've previously blocked notifications. To enable them, you'll need to
        update your browser settings.
      </p>
    </InfoBox>

    <div class="border border-terminal-green/20 p-3">
      <div class="text-terminal-green text-sm font-bold mb-2">
        How to enable notifications:
      </div>
      <ol class="text-xs text-terminal-green/60 space-y-1 list-decimal list-inside">
        <li>Click the lock/info icon in your browser's address bar</li>
        <li>Find "Notifications" in the permissions</li>
        <li>Change from "Block" to "Allow"</li>
        <li>Refresh this page</li>
      </ol>
    </div>

    <button
      onClick={onDismiss}
      class="w-full px-4 py-3 border border-terminal-green/30 text-terminal-green/70
             hover:border-terminal-green/50 transition-colors"
    >
      [CLOSE]
    </button>
  </>
);

const UnsupportedState: FunctionComponent<StateProps> = ({ capabilities, onDismiss }) => (
  <>
    <InfoBox type="error">
      <div class="font-bold mb-1">[X] Notifications Unavailable</div>
      <p class="text-xs">
        {capabilities?.reason || 'Push notifications are not supported on this device/browser.'}
      </p>
    </InfoBox>

    {capabilities?.isIOS && !capabilities?.isInstalledPWA && (
      <div class="border border-terminal-blue/20 p-3 bg-terminal-blue/5">
        <div class="text-terminal-blue text-sm font-bold mb-2">
          Enable on iOS:
        </div>
        <ol class="text-xs text-terminal-blue/70 space-y-1 list-decimal list-inside">
          <li>Tap the Share button in Safari</li>
          <li>Select "Add to Home Screen"</li>
          <li>Open BitChat from your Home Screen</li>
          <li>Enable notifications when prompted</li>
        </ol>
      </div>
    )}

    <button
      onClick={onDismiss}
      class="w-full px-4 py-3 border border-terminal-green/30 text-terminal-green/70
             hover:border-terminal-green/50 transition-colors"
    >
      [CLOSE]
    </button>
  </>
);

const GrantedState: FunctionComponent<StateProps> = ({ onDismiss }) => (
  <>
    <InfoBox type="success">
      <div class="font-bold mb-1">[OK] Notifications Enabled</div>
      <p class="text-xs">
        You'll now receive notifications for new messages.
      </p>
    </InfoBox>

    <button
      onClick={onDismiss}
      class="w-full px-4 py-3 bg-terminal-green text-terminal-bg font-bold
             hover:bg-terminal-green/90 transition-colors"
    >
      [CONTINUE]
    </button>
  </>
);

// ============================================================================
// Compact Prompt Component
// ============================================================================

interface CompactPromptProps {
  state: PromptState;
  capabilities: NotificationCapabilities | null;
  onEnable: () => void;
  onDecline: () => void;
  className?: string;
}

const CompactPrompt: FunctionComponent<CompactPromptProps> = ({
  state,
  capabilities,
  onEnable,
  onDecline,
  className = '',
}) => {
  // Don't show if already granted or unsupported
  if (state === 'granted' || state === 'unsupported') {
    return null;
  }

  // Show denied message
  if (state === 'denied') {
    return (
      <div class={`flex items-center gap-3 p-2 border border-terminal-yellow/30 bg-terminal-yellow/5 ${className}`}>
        <span class="text-terminal-yellow/70 text-xs flex-1">
          [!] Notifications blocked. Update browser settings to enable.
        </span>
      </div>
    );
  }

  // Show requesting state
  if (state === 'requesting') {
    return (
      <div class={`flex items-center gap-3 p-2 border border-terminal-green/30 ${className}`}>
        <span class="text-terminal-green text-xs flex-1 animate-pulse">
          [REQUESTING PERMISSION...]
        </span>
      </div>
    );
  }

  // Show initial enable prompt
  return (
    <div class={`flex items-center gap-3 p-2 border border-terminal-green/30 ${className}`}>
      <span class="text-terminal-green/70 text-xs flex-1">
        Enable notifications to stay connected
        {capabilities?.isIOS && !capabilities?.isInstalledPWA && ' (add to Home Screen first)'}
      </span>
      <button
        onClick={onEnable}
        disabled={capabilities?.isIOS && !capabilities?.isInstalledPWA}
        class="px-2 py-1 text-xs bg-terminal-green text-terminal-bg font-bold
               hover:bg-terminal-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        [ENABLE]
      </button>
      <button
        onClick={onDecline}
        class="px-2 py-1 text-xs text-terminal-green/50 hover:text-terminal-green/70"
      >
        [X]
      </button>
    </div>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Render platform-specific messages based on capabilities
 */
function renderPlatformMessage(capabilities: NotificationCapabilities) {
  if (capabilities.isIOS) {
    if (!capabilities.isInstalledPWA) {
      return (
        <InfoBox type="warning">
          <div class="font-bold mb-1">[iOS] Add to Home Screen Required</div>
          <p class="text-xs">
            On iOS, notifications only work when BitChat is installed as an app.
            Use Safari's "Add to Home Screen" option first.
          </p>
        </InfoBox>
      );
    }

    if (capabilities.iOSVersion && capabilities.iOSVersion < 16) {
      return (
        <InfoBox type="error">
          <div class="font-bold mb-1">[iOS] Update Required</div>
          <p class="text-xs">
            Push notifications require iOS 16.4 or later.
            Your device is running iOS {capabilities.iOSVersion}.
          </p>
        </InfoBox>
      );
    }
  }

  return null;
}

// ============================================================================
// Exports
// ============================================================================

export default NotificationPrompt;
