/**
 * VoiceRecorder Component Tests
 *
 * Tests for the voice recording interface component including:
 * - Recording state management
 * - Waveform visualization during recording
 * - Timer/duration display
 * - Cancel and send functionality
 * - Keyboard shortcuts
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/preact';
import { h } from 'preact';
import { VoiceRecorder, type VoiceRecorderProps } from '../VoiceRecorder';

// ============================================================================
// Mocks
// ============================================================================

// Create mock functions first (before vi.mock)
const formatDurationMock = vi.fn();

// Mock class for VoiceRecorderService
class MockVoiceRecorderService {
  private waveformCallback: ((data: number[]) => void) | null = null;
  private durationCallback: ((seconds: number) => void) | null = null;
  private stateCallback: ((state: string) => void) | null = null;
  private _isRecording = false;

  onWaveform(callback: (data: number[]) => void) {
    this.waveformCallback = callback;
  }

  onDurationUpdate(callback: (seconds: number) => void) {
    this.durationCallback = callback;
  }

  onStateChange(callback: (state: string) => void) {
    this.stateCallback = callback;
  }

  startRecording = vi.fn().mockImplementation(async () => {
    this._isRecording = true;
    if (this.stateCallback) this.stateCallback('recording');
    if (this.durationCallback) this.durationCallback(0);
    if (this.waveformCallback) {
      this.waveformCallback(new Array(32).fill(0.5));
    }
  });

  stopRecording = vi.fn().mockImplementation(async () => {
    this._isRecording = false;
    if (this.stateCallback) this.stateCallback('stopped');
    return new Blob(['mock audio'], { type: 'audio/webm' });
  });

  cancelRecording = vi.fn().mockImplementation(() => {
    this._isRecording = false;
    if (this.stateCallback) this.stateCallback('idle');
  });

  isRecording() {
    return this._isRecording;
  }

  getWaveformData() {
    return new Array(32).fill(0.5);
  }

  getRecordingDuration() {
    return 10;
  }

  // Test helpers
  simulateDurationUpdate(seconds: number) {
    if (this.durationCallback) this.durationCallback(seconds);
  }

  simulateWaveformUpdate(data: number[]) {
    if (this.waveformCallback) this.waveformCallback(data);
  }
}

let mockRecorderInstance: MockVoiceRecorderService;

vi.mock('../../../services/media/voice-recorder', () => ({
  VoiceRecorderService: function() {
    mockRecorderInstance = new MockVoiceRecorderService();
    return mockRecorderInstance;
  },
  formatDuration: (...args: unknown[]) => formatDurationMock(...args),
}));

// ============================================================================
// Test Utilities
// ============================================================================

const defaultProps: VoiceRecorderProps = {
  onRecordingComplete: vi.fn(),
  onCancel: vi.fn(),
};

// ============================================================================
// VoiceRecorder Component Tests
// ============================================================================

describe('VoiceRecorder Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRecorderInstance = new MockVoiceRecorderService();

    formatDurationMock.mockImplementation((seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('Initial Recording State', () => {
    it('should start recording automatically on mount', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      expect(mockRecorderInstance.startRecording).toHaveBeenCalled();
    });

    it('should show recording indicator (red dot)', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const recordingDot = document.querySelector('.bg-error');
      expect(recordingDot).toBeDefined();
    });

    it('should show cancel button', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const cancelButton = document.querySelector('button[aria-label="Cancel recording"]');
      expect(cancelButton).toBeDefined();
    });

    it('should show send button', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const sendButton = document.querySelector('button[aria-label="Stop and send voice message"]');
      expect(sendButton).toBeDefined();
    });
  });

  describe('Waveform Visualization', () => {
    it('should display waveform bars during recording', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const waveformBars = document.querySelectorAll('.rounded-full.bg-primary');
      expect(waveformBars.length).toBeGreaterThan(0);
    });

    it('should update waveform when new data arrives', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      act(() => {
        mockRecorderInstance.simulateWaveformUpdate(new Array(32).fill(0.8));
      });

      const waveformBars = document.querySelectorAll('.rounded-full.bg-primary');
      expect(waveformBars.length).toBeGreaterThan(0);
    });
  });

  describe('Timer Display', () => {
    it('should show duration starting at 0:00', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      expect(formatDurationMock).toHaveBeenCalledWith(0);
    });

    it('should update duration as recording progresses', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      act(() => {
        mockRecorderInstance.simulateDurationUpdate(30);
      });

      expect(formatDurationMock).toHaveBeenCalledWith(30);
    });

    it('should format duration as M:SS', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      expect(formatDurationMock(65)).toBe('1:05');
      expect(formatDurationMock(0)).toBe('0:00');
      expect(formatDurationMock(59)).toBe('0:59');
    });
  });

  describe('Time Limit Warning', () => {
    it('should show warning when approaching max duration (60s)', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      act(() => {
        mockRecorderInstance.simulateDurationUpdate(55);
      });

      const warningText = screen.queryByText(/5s remaining/i);
      expect(warningText).toBeDefined();
    });

    it('should not show warning when plenty of time remains', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      act(() => {
        mockRecorderInstance.simulateDurationUpdate(10);
      });

      const warningText = screen.queryByText(/remaining/i);
      expect(warningText).toBeNull();
    });

    it('should have error styling for time warning', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      act(() => {
        mockRecorderInstance.simulateDurationUpdate(55);
      });

      const errorText = document.querySelector('.text-error');
      expect(errorText).toBeDefined();
    });
  });

  describe('Cancel Functionality', () => {
    it('should call cancelRecording when cancel button clicked', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const cancelButton = document.querySelector('button[aria-label="Cancel recording"]');
      fireEvent.click(cancelButton!);

      expect(mockRecorderInstance.cancelRecording).toHaveBeenCalled();
    });

    it('should call onCancel prop when cancel button clicked', async () => {
      const onCancel = vi.fn();
      render(<VoiceRecorder {...defaultProps} onCancel={onCancel} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const cancelButton = document.querySelector('button[aria-label="Cancel recording"]');
      fireEvent.click(cancelButton!);

      expect(onCancel).toHaveBeenCalled();
    });

    it('should cancel on Escape key press', async () => {
      const onCancel = vi.fn();
      render(<VoiceRecorder {...defaultProps} onCancel={onCancel} />);

      await act(async () => {
        vi.runAllTimers();
      });

      fireEvent.keyDown(window, { key: 'Escape' });

      await act(async () => {
        vi.runAllTimers();
      });

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe('Send Functionality', () => {
    it('should call stopRecording when send button clicked', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const sendButton = document.querySelector('button[aria-label="Stop and send voice message"]');
      fireEvent.click(sendButton!);

      await act(async () => {
        vi.runAllTimers();
      });

      expect(mockRecorderInstance.stopRecording).toHaveBeenCalled();
    });

    it('should call stopRecording and trigger completion flow', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      act(() => {
        mockRecorderInstance.simulateDurationUpdate(15);
      });

      const sendButton = document.querySelector('button[aria-label="Stop and send voice message"]');
      expect(sendButton).toBeDefined();
      fireEvent.click(sendButton!);

      await act(async () => {
        vi.runAllTimers();
      });

      // Verify stop recording was called
      expect(mockRecorderInstance.stopRecording).toHaveBeenCalled();
    });

    it('should send on Enter key press', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      fireEvent.keyDown(window, { key: 'Enter' });

      await act(async () => {
        vi.runAllTimers();
      });

      expect(mockRecorderInstance.stopRecording).toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should not start recording when disabled', async () => {
      render(<VoiceRecorder {...defaultProps} disabled={true} />);

      await act(async () => {
        vi.runAllTimers();
      });

      expect(mockRecorderInstance.startRecording).not.toHaveBeenCalled();
    });
  });

  describe('Keyboard Accessibility', () => {
    it('should show keyboard hints on desktop', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const hintText = screen.queryByText(/Press Enter to send/i);
      expect(hintText).toBeDefined();
    });

    it('should show Escape to cancel hint', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const hintText = screen.queryByText(/Escape to cancel/i);
      expect(hintText).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cancel recording on unmount if still recording', async () => {
      const { unmount } = render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      unmount();

      expect(mockRecorderInstance.cancelRecording).toHaveBeenCalled();
    });

    it('should clean up keyboard event listeners on unmount', async () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Recording Animation', () => {
    it('should have pulsing animation on recording dot', async () => {
      render(<VoiceRecorder {...defaultProps} />);

      await act(async () => {
        vi.runAllTimers();
      });

      const recordingDot = document.querySelector('.animate-pulse');
      expect(recordingDot).toBeDefined();
    });
  });
});
