/**
 * PermissionsStep - Request necessary permissions
 *
 * Features:
 * - Request notification permission
 * - Request location permission (optional, for location channels)
 * - Explain why each permission is needed
 * - Skip option for each permission
 * - Clear permission status indicators
 */

import { FunctionComponent } from 'preact';
import { useState, useCallback, useEffect } from 'preact/hooks';

// ============================================================================
// Types
// ============================================================================

export interface PermissionsStepProps {
  /** Called when permissions step is complete */
  onComplete: () => void;
  /** Called when user wants to skip all permissions */
  onSkip: () => void;
  /** Called when user wants to go back */
  onBack?: () => void;
}

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface PermissionState {
  notifications: PermissionStatus;
  location: PermissionStatus;
}

// ============================================================================
// Permission Helpers
// ============================================================================

async function getNotificationStatus(): Promise<PermissionStatus> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  const permission = Notification.permission;
  if (permission === 'granted') return 'granted';
  if (permission === 'denied') return 'denied';
  return 'prompt';
}

async function getLocationStatus(): Promise<PermissionStatus> {
  if (!('geolocation' in navigator)) {
    return 'unsupported';
  }

  // Check if permissions API is available
  if ('permissions' in navigator) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      if (result.state === 'granted') return 'granted';
      if (result.state === 'denied') return 'denied';
      return 'prompt';
    } catch {
      // Fallback if permissions API fails
      return 'prompt';
    }
  }

  return 'prompt';
}

async function requestNotificationPermission(): Promise<PermissionStatus> {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') return 'granted';
    if (result === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'denied';
  }
}

async function requestLocationPermission(): Promise<PermissionStatus> {
  if (!('geolocation' in navigator)) {
    return 'unsupported';
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve('denied');
        } else {
          // Other errors (timeout, position unavailable) don't indicate denial
          resolve('prompt');
        }
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  });
}

// ============================================================================
// Component
// ============================================================================

export const PermissionsStep: FunctionComponent<PermissionsStepProps> = ({
  onComplete,
  onSkip,
  onBack: _onBack,
}) => {
  // Note: onBack is available but not used - back navigation handled by parent
  void _onBack;
  // State
  const [permissions, setPermissions] = useState<PermissionState>({
    notifications: 'prompt',
    location: 'prompt',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingNotifications, setIsRequestingNotifications] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // Load initial permission states
  useEffect(() => {
    const loadPermissions = async () => {
      const [notifStatus, locStatus] = await Promise.all([
        getNotificationStatus(),
        getLocationStatus(),
      ]);

      setPermissions({
        notifications: notifStatus,
        location: locStatus,
      });
      setIsLoading(false);
    };

    loadPermissions();
  }, []);

  // Request notification permission
  const handleRequestNotifications = useCallback(async () => {
    setIsRequestingNotifications(true);
    const status = await requestNotificationPermission();
    setPermissions((prev) => ({ ...prev, notifications: status }));
    setIsRequestingNotifications(false);
  }, []);

  // Request location permission
  const handleRequestLocation = useCallback(async () => {
    setIsRequestingLocation(true);
    const status = await requestLocationPermission();
    setPermissions((prev) => ({ ...prev, location: status }));
    setIsRequestingLocation(false);
  }, []);

  // Check if we can continue (at least tried both or they're not available)
  const canContinue =
    (permissions.notifications !== 'prompt') &&
    (permissions.location !== 'prompt');

  // Render permission status badge
  const renderStatus = (status: PermissionStatus) => {
    switch (status) {
      case 'granted':
        return (
          <span class="flex items-center gap-1 text-terminal-green text-xs font-mono">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Granted
          </span>
        );
      case 'denied':
        return (
          <span class="flex items-center gap-1 text-terminal-red text-xs font-mono">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Denied
          </span>
        );
      case 'unsupported':
        return (
          <span class="text-terminal-yellow/60 text-xs font-mono">
            Not supported
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div class="text-center">
        <div class="animate-spin h-8 w-8 border-2 border-terminal-green border-t-transparent rounded-full mx-auto mb-4" />
        <p class="text-terminal-green/70 font-mono">Checking permissions...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div class="text-center mb-6">
        <div class="w-12 h-12 mx-auto mb-3 flex items-center justify-center border-2 border-terminal-green/50 rounded-full">
          <svg
            class="w-6 h-6 text-terminal-green"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-terminal-green font-mono mb-2">
          Permissions
        </h2>
        <p class="text-terminal-green/70 font-mono text-sm">
          Optional permissions to enhance your experience
        </p>
      </div>

      {/* Permission cards */}
      <div class="space-y-4 mb-6">
        {/* Notifications */}
        <div class="p-4 border border-terminal-green/30 rounded-terminal">
          <div class="flex items-start justify-between gap-4 mb-2">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 flex items-center justify-center border border-terminal-green/30 rounded-lg">
                <svg
                  class="w-5 h-5 text-terminal-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div>
                <h3 class="text-terminal-green font-mono font-bold">
                  Notifications
                </h3>
                <p class="text-terminal-green/60 font-mono text-xs">
                  Get notified of new messages
                </p>
              </div>
            </div>
            {renderStatus(permissions.notifications)}
          </div>

          {permissions.notifications === 'prompt' && (
            <button
              onClick={handleRequestNotifications}
              disabled={isRequestingNotifications}
              class="w-full mt-2 py-2 px-4 border border-terminal-green/50 text-terminal-green font-mono text-sm rounded-terminal hover:bg-terminal-green/10 transition-colors disabled:opacity-50"
            >
              {isRequestingNotifications ? 'Requesting...' : 'Enable Notifications'}
            </button>
          )}

          {permissions.notifications === 'denied' && (
            <p class="mt-2 text-xs text-terminal-green/50 font-mono">
              To enable, update browser settings for this site
            </p>
          )}
        </div>

        {/* Location */}
        <div class="p-4 border border-terminal-green/30 rounded-terminal">
          <div class="flex items-start justify-between gap-4 mb-2">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 flex items-center justify-center border border-terminal-green/30 rounded-lg">
                <svg
                  class="w-5 h-5 text-terminal-green"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
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
              </div>
              <div>
                <h3 class="text-terminal-green font-mono font-bold">Location</h3>
                <p class="text-terminal-green/60 font-mono text-xs">
                  Join location-based channels
                </p>
              </div>
            </div>
            {renderStatus(permissions.location)}
          </div>

          {permissions.location === 'prompt' && (
            <button
              onClick={handleRequestLocation}
              disabled={isRequestingLocation}
              class="w-full mt-2 py-2 px-4 border border-terminal-green/50 text-terminal-green font-mono text-sm rounded-terminal hover:bg-terminal-green/10 transition-colors disabled:opacity-50"
            >
              {isRequestingLocation ? 'Requesting...' : 'Enable Location'}
            </button>
          )}

          {permissions.location === 'denied' && (
            <p class="mt-2 text-xs text-terminal-green/50 font-mono">
              To enable, update browser settings for this site
            </p>
          )}

          <p class="mt-2 text-xs text-terminal-green/40 font-mono">
            Your location is never shared - only used to find nearby channels
          </p>
        </div>
      </div>

      {/* Info box */}
      <div class="p-3 bg-terminal-green/5 border border-terminal-green/20 rounded-terminal mb-6">
        <p class="text-xs text-terminal-green/60 font-mono">
          All permissions are optional. You can change them anytime in your
          browser settings. BitChat works fully without them.
        </p>
      </div>

      {/* Action buttons */}
      <div class="space-y-3">
        <button
          onClick={onComplete}
          class="w-full py-3 px-6 bg-terminal-green text-terminal-bg font-mono font-bold text-lg rounded-terminal hover:bg-terminal-green/90 transition-colors focus:outline-none focus:ring-2 focus:ring-terminal-green focus:ring-offset-2 focus:ring-offset-terminal-bg"
        >
          Continue
        </button>

        {!canContinue && (
          <button
            onClick={onSkip}
            class="w-full py-2 px-4 text-terminal-green/60 font-mono text-sm hover:text-terminal-green transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
};

export default PermissionsStep;
