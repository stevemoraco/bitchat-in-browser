/**
 * Privacy Settings Component
 *
 * Controls for user privacy preferences:
 * - Location precision default
 * - Anonymous mode toggle
 * - Read receipts toggle
 * - Typing indicators toggle
 *
 * @module components/settings/PrivacySettings
 */

import type { FunctionComponent } from 'preact';
import { useSettingsStore, useSettings } from '../../stores/settings-store';

// ============================================================================
// Types
// ============================================================================

interface ToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  danger?: boolean;
}

interface SliderProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

// ============================================================================
// Sub-Components
// ============================================================================

const Toggle: FunctionComponent<ToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  danger = false,
}) => (
    <div
      class={`flex items-start justify-between gap-4 p-3 border ${
        danger ? 'border-terminal-red/30' : 'border-terminal-green/20'
      }`}
    >
      <div class="flex-1">
        <span
          class={`font-bold ${
            danger ? 'text-terminal-red' : 'text-terminal-green'
          }`}
        >
          {label}
        </span>
        <p
          class={`text-xs mt-1 ${
            danger ? 'text-terminal-red/60' : 'text-terminal-green/60'
          }`}
        >
          {description}
        </p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        class={`w-16 h-8 border ${
          danger
            ? checked
              ? 'bg-terminal-red border-terminal-red'
              : 'border-terminal-red/50'
            : checked
              ? 'bg-terminal-green border-terminal-green'
              : 'border-terminal-green/50'
        } flex items-center justify-center transition-colors`}
        role="switch"
        aria-checked={checked}
      >
        <span
          class={`text-xs font-bold ${
            checked
              ? danger
                ? 'text-terminal-bg'
                : 'text-terminal-bg'
              : danger
                ? 'text-terminal-red/50'
                : 'text-terminal-green/50'
          }`}
        >
          {checked ? '[ON]' : '[OFF]'}
        </span>
      </button>
    </div>
  );

const Slider: FunctionComponent<SliderProps> = ({
  label,
  description,
  value,
  min,
  max,
  onChange,
  formatValue,
}) => (
    <div class="space-y-2 p-3 border border-terminal-green/20">
      <div class="flex items-center justify-between">
        <span class="font-bold text-terminal-green">{label}</span>
        <span class="text-terminal-green font-mono">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <p class="text-xs text-terminal-green/60">{description}</p>
      <div class="flex items-center gap-2">
        <span class="text-xs text-terminal-green/50">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt((e.target as HTMLInputElement).value, 10))}
          class="flex-1 h-2 appearance-none bg-terminal-green/20 cursor-pointer
                 [&::-webkit-slider-thumb]:appearance-none
                 [&::-webkit-slider-thumb]:w-4
                 [&::-webkit-slider-thumb]:h-4
                 [&::-webkit-slider-thumb]:bg-terminal-green
                 [&::-webkit-slider-thumb]:cursor-pointer
                 [&::-moz-range-thumb]:w-4
                 [&::-moz-range-thumb]:h-4
                 [&::-moz-range-thumb]:bg-terminal-green
                 [&::-moz-range-thumb]:border-0
                 [&::-moz-range-thumb]:cursor-pointer"
        />
        <span class="text-xs text-terminal-green/50">{max}</span>
      </div>
    </div>
  );

// ============================================================================
// Constants
// ============================================================================

/**
 * Location precision levels and their approximate areas
 */
const PRECISION_LABELS: Record<number, string> = {
  1: '~5,000 km',
  2: '~1,250 km',
  3: '~156 km',
  4: '~39 km',
  5: '~5 km',
  6: '~1.2 km',
  7: '~153 m',
  8: '~38 m',
  9: '~5 m',
  10: '~1.2 m',
  11: '~15 cm',
  12: '~3.7 cm',
};

// ============================================================================
// Main Component
// ============================================================================

export const PrivacySettings: FunctionComponent = () => {
  const settings = useSettings();
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  // Format precision value with area description
  const formatPrecision = (value: number): string => {
    const area = PRECISION_LABELS[value] || `~${value}`;
    return `${value} (${area})`;
  };

  return (
    <div class="space-y-4">
      {/* Section Header */}
      <div class="text-sm text-terminal-green/70 mb-4">
        Control how much information you share with others.
      </div>

      {/* Location Precision */}
      <Slider
        label="Location Precision"
        description="Default geohash precision for location channels. Lower values share less precise location."
        value={settings.locationPrecision}
        min={1}
        max={12}
        onChange={(value) => updateSettings({ locationPrecision: value })}
        formatValue={formatPrecision}
      />

      {/* Precision Legend */}
      <div class="px-3 py-2 border border-terminal-green/10 text-xs">
        <div class="text-terminal-green/70 mb-2">Precision Guide:</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-terminal-green/50">
          <span>1-2: Country/Region</span>
          <span>3-4: City/District</span>
          <span>5-6: Neighborhood</span>
          <span>7-8: Street level</span>
          <span>9-10: Building</span>
          <span>11-12: Exact point</span>
        </div>
        <div class="mt-2 text-terminal-yellow/70">
          [!] Recommended: 5-6 for reasonable privacy
        </div>
      </div>

      {/* Anonymous Mode */}
      <Toggle
        label="Anonymous Mode"
        description="When enabled, use randomized identifiers in location channels instead of your real npub. Other users cannot link your messages to your identity."
        checked={false}
        onChange={(_checked) => {
          // TODO: Implement anonymous mode in settings store
          console.log('Anonymous mode not yet implemented');
        }}
      />

      {/* Read Receipts */}
      <Toggle
        label="Read Receipts"
        description="Let others know when you've read their direct messages. Disable to keep your read status private."
        checked={settings.showMessageStatus}
        onChange={(checked) => updateSettings({ showMessageStatus: checked })}
      />

      {/* Typing Indicators */}
      <Toggle
        label="Typing Indicators"
        description="Show others when you're typing a message. Disable for more privacy, but others won't see your typing status either."
        checked
        onChange={(_checked) => {
          // TODO: Implement typing indicators in settings store
          console.log('Typing indicators not yet implemented');
        }}
      />

      {/* Auto-Join Location */}
      <Toggle
        label="Auto-Join Location Channel"
        description="Automatically join the local channel based on your GPS location when the app starts."
        checked={settings.autoJoinLocation}
        onChange={(checked) => updateSettings({ autoJoinLocation: checked })}
      />

      {/* Warnings */}
      <div class="mt-6 p-3 border border-terminal-yellow/30 bg-terminal-yellow/5">
        <div class="text-terminal-yellow text-sm font-bold mb-2">
          [!] Privacy Notes
        </div>
        <ul class="text-xs text-terminal-yellow/70 space-y-1">
          <li>
            - Messages in location channels are public and linked to your npub
          </li>
          <li>- Direct messages use NIP-17 encryption but metadata may be visible</li>
          <li>- Relay operators can see connection patterns</li>
          <li>- Use Tor or VPN for additional network privacy</li>
        </ul>
      </div>

      {/* Privacy Best Practices */}
      <div class="mt-4 p-3 border border-terminal-green/20">
        <div class="text-terminal-green text-sm font-bold mb-2">
          Privacy Best Practices
        </div>
        <ul class="text-xs text-terminal-green/60 space-y-1">
          <li>- Use location precision 5-6 for neighborhood-level privacy</li>
          <li>- Create a separate identity for sensitive conversations</li>
          <li>- Avoid sharing personally identifiable information</li>
          <li>- Consider using anonymous mode in public channels</li>
        </ul>
      </div>
    </div>
  );
};

export default PrivacySettings;
