/**
 * Settings Page - Main settings interface for BitChat In Browser
 *
 * Provides access to all user-configurable settings organized by section:
 * - Identity: Public key, fingerprint, export, password change
 * - Privacy: Location precision, anonymous mode, read receipts
 * - Network: Relay management, WebRTC settings
 * - Storage: Usage display, data export/import, clear history
 * - About: App version, native app links, source code
 * - Danger Zone: Reset identity, wipe all data
 *
 * @module pages/SettingsPage
 */

import { FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';
import { IdentitySettings } from '../components/settings/IdentitySettings';
import { PrivacySettings } from '../components/settings/PrivacySettings';
import { NetworkSettings } from '../components/settings/NetworkSettings';
import { StorageSettings } from '../components/settings/StorageSettings';
import { AboutSettings } from '../components/settings/AboutSettings';
import { DangerZone } from '../components/settings/DangerZone';

// ============================================================================
// Types
// ============================================================================

type SettingsSection =
  | 'identity'
  | 'privacy'
  | 'network'
  | 'storage'
  | 'about'
  | 'danger';

interface SectionConfig {
  id: SettingsSection;
  title: string;
  icon: string;
  description: string;
}

// ============================================================================
// Constants
// ============================================================================

const SECTIONS: SectionConfig[] = [
  {
    id: 'identity',
    title: 'Identity',
    icon: '[ID]',
    description: 'Your cryptographic identity and keys',
  },
  {
    id: 'privacy',
    title: 'Privacy',
    icon: '[PR]',
    description: 'Location and communication privacy settings',
  },
  {
    id: 'network',
    title: 'Network',
    icon: '[NW]',
    description: 'Relay connections and WebRTC settings',
  },
  {
    id: 'storage',
    title: 'Storage',
    icon: '[ST]',
    description: 'Data management and backup',
  },
  {
    id: 'about',
    title: 'About',
    icon: '[AB]',
    description: 'App information and links',
  },
  {
    id: 'danger',
    title: 'Danger Zone',
    icon: '[!!]',
    description: 'Destructive actions - use with caution',
  },
];

// ============================================================================
// Component
// ============================================================================

export interface SettingsPageProps {
  /** Callback when user wants to go back */
  onBack?: () => void;
}

export const SettingsPage: FunctionComponent<SettingsPageProps> = ({
  onBack,
}) => {
  const [expandedSection, setExpandedSection] = useState<SettingsSection | null>(
    null
  );

  const toggleSection = (section: SettingsSection) => {
    setExpandedSection((current) => (current === section ? null : section));
  };

  const renderSectionContent = (section: SettingsSection) => {
    switch (section) {
      case 'identity':
        return <IdentitySettings />;
      case 'privacy':
        return <PrivacySettings />;
      case 'network':
        return <NetworkSettings />;
      case 'storage':
        return <StorageSettings />;
      case 'about':
        return <AboutSettings />;
      case 'danger':
        return <DangerZone />;
      default:
        return null;
    }
  };

  return (
    <div class="min-h-screen bg-terminal-bg text-terminal-green font-mono">
      {/* Header */}
      <header class="p-4 border-b border-terminal-green/30 flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            class="text-terminal-green hover:text-terminal-green/80 transition-colors"
            aria-label="Go back"
          >
            {'<'} Back
          </button>
        )}
        <div>
          <h1 class="text-xl font-bold">&gt; Settings</h1>
          <p class="text-sm text-terminal-green/70">
            Configure your BitChat experience
          </p>
        </div>
      </header>

      {/* Settings Sections */}
      <main class="p-4 max-w-3xl mx-auto">
        <div class="space-y-2">
          {SECTIONS.map((section) => (
            <div
              key={section.id}
              class={`border ${
                section.id === 'danger'
                  ? 'border-terminal-red/30'
                  : 'border-terminal-green/30'
              }`}
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                class={`w-full p-4 text-left flex items-center justify-between ${
                  section.id === 'danger'
                    ? 'hover:bg-terminal-red/10'
                    : 'hover:bg-terminal-green/10'
                } transition-colors`}
                aria-expanded={expandedSection === section.id}
              >
                <div class="flex items-center gap-3">
                  <span
                    class={`${
                      section.id === 'danger'
                        ? 'text-terminal-red'
                        : 'text-terminal-green'
                    }`}
                  >
                    {section.icon}
                  </span>
                  <div>
                    <span
                      class={`font-bold ${
                        section.id === 'danger'
                          ? 'text-terminal-red'
                          : 'text-terminal-green'
                      }`}
                    >
                      {section.title}
                    </span>
                    <p
                      class={`text-xs ${
                        section.id === 'danger'
                          ? 'text-terminal-red/60'
                          : 'text-terminal-green/60'
                      }`}
                    >
                      {section.description}
                    </p>
                  </div>
                </div>
                <span
                  class={`transform transition-transform ${
                    expandedSection === section.id ? 'rotate-90' : ''
                  } ${
                    section.id === 'danger'
                      ? 'text-terminal-red'
                      : 'text-terminal-green'
                  }`}
                >
                  {'>'}
                </span>
              </button>

              {/* Section Content */}
              {expandedSection === section.id && (
                <div
                  class={`border-t ${
                    section.id === 'danger'
                      ? 'border-terminal-red/30'
                      : 'border-terminal-green/30'
                  } p-4 animate-terminal-fade-in`}
                >
                  {renderSectionContent(section.id)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div class="mt-8 text-center text-xs text-terminal-green/40">
          <p>BitChat In Browser PWA</p>
          <p class="mt-1">Your keys, your messages, your privacy.</p>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;
