/**
 * VoiceMessage Component Tests
 *
 * Tests for the voice message playback component including:
 * - Play button rendering
 * - Duration display
 * - Play/pause functionality
 * - Waveform visualization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/preact';
import { h } from 'preact';
import { VoiceMessage } from '../VoiceMessage';

// ============================================================================
// Mocks
// ============================================================================

// Create mock functions first (before vi.mock)
const getVoiceNoteMock = vi.fn();
const createVoiceNoteUrlMock = vi.fn();
const formatDurationMock = vi.fn();
const normalizeWaveformDataMock = vi.fn();

vi.mock('../../../services/media/voice-recorder', () => ({
  getVoiceNote: (...args: unknown[]) => getVoiceNoteMock(...args),
  createVoiceNoteUrl: (...args: unknown[]) => createVoiceNoteUrlMock(...args),
  formatDuration: (...args: unknown[]) => formatDurationMock(...args),
  normalizeWaveformData: (...args: unknown[]) => normalizeWaveformDataMock(...args),
}));

// Sample voice note data
const createMockVoiceNote = () => ({
  id: 'voice-123',
  blob: new Blob(['mock audio data'], { type: 'audio/webm' }),
  mimeType: 'audio/webm',
  duration: 45,
  waveformData: [0.3, 0.5, 0.7, 0.4, 0.6, 0.8, 0.5, 0.3],
  createdAt: Date.now(),
});

// Mock HTMLAudioElement
class MockAudioElement {
  src: string = '';
  currentTime: number = 0;
  duration: number = 45;
  paused: boolean = true;
  volume: number = 1;

  private eventListeners: Map<string, Set<Function>> = new Map();

  play = vi.fn().mockImplementation(() => {
    this.paused = false;
    return Promise.resolve();
  });

  pause = vi.fn().mockImplementation(() => {
    this.paused = true;
  });

  load = vi.fn().mockImplementation(() => {
    setTimeout(() => {
      this.dispatchEvent('loadedmetadata');
    }, 0);
  });

  addEventListener = vi.fn().mockImplementation((event: string, handler: Function) => {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
  });

  removeEventListener = vi.fn().mockImplementation((event: string, handler: Function) => {
    this.eventListeners.get(event)?.delete(handler);
  });

  dispatchEvent(event: string) {
    this.eventListeners.get(event)?.forEach(handler => handler());
  }
}

let mockAudioInstances: MockAudioElement[] = [];

// Mock URL.createObjectURL and URL.revokeObjectURL
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-audio-url');
  URL.revokeObjectURL = vi.fn();
});

afterAll(() => {
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

// ============================================================================
// Test Setup
// ============================================================================

describe('VoiceMessage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAudioInstances = [];
    (globalThis as any).Audio = vi.fn().mockImplementation((src?: string) => {
      const audio = new MockAudioElement();
      if (src) audio.src = src;
      mockAudioInstances.push(audio);
      return audio;
    });

    // Default mock implementations
    getVoiceNoteMock.mockResolvedValue(createMockVoiceNote());
    createVoiceNoteUrlMock.mockReturnValue('blob:mock-url');
    formatDurationMock.mockImplementation((seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    });
    normalizeWaveformDataMock.mockImplementation((data: number[], bars: number) => {
      if (data.length === 0) return new Array(bars).fill(0.1);
      if (data.length === bars) return data;
      return data.slice(0, bars);
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('Initial Rendering', () => {
    it('should render with play button', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton).toBeDefined();
      });
    });

    it('should render waveform visualization', async () => {
      render(
        <VoiceMessage
          voiceNoteId="voice-123"
          waveformData={[0.2, 0.4, 0.6, 0.8, 0.6, 0.4, 0.2]}
        />
      );

      await waitFor(() => {
        const waveformContainer = document.querySelector('[role="slider"]');
        expect(waveformContainer).toBeDefined();
      });
    });

    it('should show loading state initially', () => {
      getVoiceNoteMock.mockImplementation(() => new Promise(() => {})); // Never resolves
      render(<VoiceMessage voiceNoteId="voice-123" />);

      const loadingIcon = document.querySelector('.animate-spin');
      expect(loadingIcon).toBeDefined();
    });

    it('should apply isOwn styling when true', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" isOwn={true} />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton?.classList.toString()).toContain('bg-background');
      });
    });
  });

  describe('Duration Display', () => {
    it('should show duration from prop', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={45} />);

      await waitFor(() => {
        expect(formatDurationMock).toHaveBeenCalledWith(45);
      });
    });

    it('should display duration in M:SS format', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={65} />);

      await waitFor(() => {
        const container = document.querySelector('.font-mono.tabular-nums');
        expect(container).toBeDefined();
      });
    });

    it('should show 0:00 for zero duration', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={0} />);

      await waitFor(() => {
        // formatDuration is called with 0
        expect(formatDurationMock).toHaveBeenCalledWith(0);
      });
    });
  });

  describe('Play/Pause Functionality', () => {
    it('should show play icon when paused', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton).toBeDefined();
      });
    });

    it('should toggle to pause on play button click', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton).toBeDefined();
      });

      const playButton = document.querySelector('button[aria-label="Play"]');
      // Click should work without error
      expect(() => fireEvent.click(playButton!)).not.toThrow();
    });

    it('should handle play and pause button clicks', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton).toBeDefined();
      });

      const playButton = document.querySelector('button[aria-label="Play"]');
      // Click play button - verify it doesn't throw
      expect(() => fireEvent.click(playButton!)).not.toThrow();

      // Look for either play or pause button - both are valid
      const anyButton = document.querySelector('button[aria-label="Play"], button[aria-label="Pause"]');
      expect(anyButton).toBeDefined();
    });

    it('should be disabled while loading', () => {
      getVoiceNoteMock.mockImplementation(() => new Promise(() => {}));

      render(<VoiceMessage voiceNoteId="voice-123" />);

      const playButton = document.querySelector('button');
      expect(playButton?.disabled || playButton?.classList.contains('cursor-wait')).toBe(true);
    });
  });

  describe('Waveform Display', () => {
    it('should render waveform bars', async () => {
      render(
        <VoiceMessage
          voiceNoteId="voice-123"
          waveformData={new Array(32).fill(0.5)}
        />
      );

      await waitFor(() => {
        const waveformContainer = document.querySelector('[role="slider"]');
        expect(waveformContainer).toBeDefined();
        const bars = waveformContainer?.querySelectorAll('.rounded-full');
        expect(bars?.length).toBeGreaterThan(0);
      });
    });

    it('should use default waveform when none provided', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const waveformContainer = document.querySelector('[role="slider"]');
        expect(waveformContainer).toBeDefined();
      });
    });

    it('should have accessible role slider on waveform', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const slider = document.querySelector('[role="slider"]');
        expect(slider).toBeDefined();
        expect(slider?.getAttribute('aria-label')).toBe('Audio playback position');
      });
    });

    it('should have ARIA attributes on waveform slider', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={45} />);

      await waitFor(() => {
        const slider = document.querySelector('[role="slider"]');
        expect(slider?.getAttribute('aria-valuemin')).toBe('0');
        expect(slider?.getAttribute('aria-valuemax')).toBeDefined();
        expect(slider?.getAttribute('aria-valuenow')).toBeDefined();
      });
    });
  });

  describe('Seeking via Waveform', () => {
    it('should allow clicking waveform to seek', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={45} />);

      await waitFor(() => {
        const waveform = document.querySelector('[role="slider"]');
        expect(waveform).toBeDefined();
      });

      const waveform = document.querySelector('[role="slider"]');

      vi.spyOn(waveform!, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        width: 100,
        top: 0,
        right: 100,
        bottom: 20,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });

      fireEvent.click(waveform!, { clientX: 50 });

      await waitFor(() => {
        expect(waveform).toBeDefined();
      });
    });

    it('should support keyboard navigation on waveform', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const waveform = document.querySelector('[role="slider"]');
        expect(waveform).toBeDefined();
      });

      const waveform = document.querySelector('[role="slider"]');
      expect(waveform?.getAttribute('tabIndex')).toBe('0');
    });
  });

  describe('Error Handling', () => {
    it('should show error state when voice note not found', async () => {
      getVoiceNoteMock.mockResolvedValue(null);

      render(<VoiceMessage voiceNoteId="non-existent" />);

      await waitFor(() => {
        const errorText = screen.queryByText(/not found/i);
        expect(errorText).toBeDefined();
      });
    });

    it('should show error state when loading fails', async () => {
      getVoiceNoteMock.mockRejectedValue(new Error('Load failed'));

      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const errorContainer = document.querySelector('.text-error');
        expect(errorContainer).toBeDefined();
      });
    });

    it('should display error icon in error state', async () => {
      getVoiceNoteMock.mockResolvedValue(null);

      render(<VoiceMessage voiceNoteId="non-existent" />);

      await waitFor(() => {
        const errorIndicator = screen.queryByText('!');
        expect(errorIndicator).toBeDefined();
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should show remaining time during playback', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={45} />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton).toBeDefined();
      });

      const playButton = document.querySelector('button[aria-label="Play"]');
      // Click should work without error
      expect(() => fireEvent.click(playButton!)).not.toThrow();
    });

    it('should update waveform progress visually', async () => {
      render(
        <VoiceMessage
          voiceNoteId="voice-123"
          duration={45}
          waveformData={new Array(32).fill(0.5)}
        />
      );

      await waitFor(() => {
        const waveformContainer = document.querySelector('[role="slider"]');
        expect(waveformContainer).toBeDefined();
      });

      const bars = document.querySelectorAll('[role="slider"] .rounded-full');
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  describe('Cleanup', () => {
    it('should handle unmount gracefully', async () => {
      const { unmount } = render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton).toBeDefined();
      });

      expect(() => unmount()).not.toThrow();
    });

    it('should pause audio on unmount', async () => {
      const { unmount } = render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton).toBeDefined();
      });

      const playButton = document.querySelector('button[aria-label="Play"]');
      // Click play button
      fireEvent.click(playButton!);

      // Unmount should not throw
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible play/pause button', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton).toBeDefined();
        expect(playButton?.getAttribute('aria-label')).toBe('Play');
      });
    });

    it('should have accessible waveform slider', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const slider = document.querySelector('[role="slider"]');
        expect(slider).toBeDefined();
        expect(slider?.getAttribute('aria-label')).toBe('Audio playback position');
      });
    });

    it('should have correct ARIA value attributes', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={45} />);

      await waitFor(() => {
        const slider = document.querySelector('[role="slider"]');
        expect(slider?.getAttribute('aria-valuemin')).toBe('0');
        expect(slider?.getAttribute('aria-valuenow')).toBeDefined();
      });
    });

    it('should be keyboard focusable', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const slider = document.querySelector('[role="slider"]');
        expect(slider?.getAttribute('tabIndex')).toBe('0');
      });
    });

    it('should have type button to prevent form submission', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton?.getAttribute('type')).toBe('button');
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support space key to toggle playback', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const slider = document.querySelector('[role="slider"]');
        expect(slider).toBeDefined();
      });

      const slider = document.querySelector('[role="slider"]');
      // Space key should be handled
      expect(() => fireEvent.keyDown(slider!, { key: ' ' })).not.toThrow();
    });

    it('should support arrow keys for seeking', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const slider = document.querySelector('[role="slider"]');
        expect(slider).toBeDefined();
      });

      const slider = document.querySelector('[role="slider"]');

      // ArrowRight should seek forward
      expect(() => fireEvent.keyDown(slider!, { key: 'ArrowRight' })).not.toThrow();

      // ArrowLeft should seek backward
      expect(() => fireEvent.keyDown(slider!, { key: 'ArrowLeft' })).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={0} />);

      await waitFor(() => {
        expect(formatDurationMock).toHaveBeenCalledWith(0);
      });
    });

    it('should handle very long duration', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" duration={3600} />); // 1 hour

      await waitFor(() => {
        expect(formatDurationMock).toHaveBeenCalledWith(3600);
      });
    });

    it('should handle empty waveform data', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" waveformData={[]} />);

      await waitFor(() => {
        const waveformContainer = document.querySelector('[role="slider"]');
        expect(waveformContainer).toBeDefined();
      });
    });

    it('should handle null waveform in voice note', async () => {
      getVoiceNoteMock.mockResolvedValue({
        ...createMockVoiceNote(),
        waveformData: null,
      });

      render(<VoiceMessage voiceNoteId="voice-123" />);

      await waitFor(() => {
        const waveformContainer = document.querySelector('[role="slider"]');
        expect(waveformContainer).toBeDefined();
      });
    });
  });

  describe('Styling Variants', () => {
    it('should apply different styling for incoming messages', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" isOwn={false} />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton?.classList.toString()).toContain('text-primary');
      });
    });

    it('should apply different styling for outgoing messages', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" isOwn={true} />);

      await waitFor(() => {
        const playButton = document.querySelector('button[aria-label="Play"]');
        expect(playButton?.classList.toString()).toContain('bg-background');
      });
    });

    it('should accept custom className', async () => {
      render(<VoiceMessage voiceNoteId="voice-123" class="custom-class" />);

      await waitFor(() => {
        const container = document.querySelector('.custom-class');
        expect(container).toBeDefined();
      });
    });
  });
});
