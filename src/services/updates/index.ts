/**
 * BitChat In Browser - Update Services
 *
 * Unified exports for the update management system.
 *
 * @module services/updates
 */

// Core update service (legacy - maintained for compatibility)
export {
  UpdateService,
  updateService,
  type UpdateStatus,
  type UpdateInfo,
  type UpdateCallback,
} from './service';

// Update checker
export {
  UpdateChecker,
  updateChecker,
  type VersionInfo,
  type UpdateCheckResult,
  type UpdateCheckerConfig,
  type UpdateCheckCallback,
} from './checker';

// Update installer
export {
  UpdateInstaller,
  updateInstaller,
  type InstallStatus,
  type InstallProgress,
  type StateSnapshot,
  type InstallProgressCallback,
  type UpdateInstallerConfig,
} from './installer';
