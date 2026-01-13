/**
 * Emergency Wipe Feature
 *
 * Provides emergency data destruction capabilities for BitChat.
 *
 * @module features/emergency
 */

// Wipe service
export {
  performEmergencyWipe,
  quickWipe,
  silentWipe,
  registerSensitiveData,
  unregisterSensitiveData,
  type WipeProgress,
  type WipeStep,
  type WipeProgressCallback,
  type WipeResult,
} from './wipe';

// Trigger detection
export {
  createTapDetector,
  createKeyboardDetector,
  createShakeDetector,
  createDelayedTrigger,
  createTriggerManager,
  supportsShakeDetection,
  isMobileDevice,
  requestShakePermission,
  type TriggerType,
  type TriggerEvent,
  type TriggerCallback,
  type TapDetectorConfig,
  type ShakeDetectorConfig,
  type DelayedTriggerConfig,
  type TriggerManagerConfig,
} from './trigger';
