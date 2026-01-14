/**
 * VoiceRecorder - Recording interface component
 *
 * Features:
 * - Real-time waveform visualization during recording
 * - Timer showing duration
 * - Cancel button (X)
 * - Stop/Send button
 * - Red recording indicator
 * - Keyboard accessibility
 * - Responsive design
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import {
  VoiceRecorderService,
  formatDuration,
} from '../../services/media/voice-recorder';

// ============================================================================
// Types
// ============================================================================

export interface VoiceRecorderProps {
  /** Callback when recording is complete */
  onRecordingComplete: (blob: Blob, duration: number, waveform: number[]) => void;
  /** Callback when recording is cancelled */
  onCancel: () => void;
  /** Whether the component is disabled */
  disabled?: boolean;
}

// ============================================================================
// Icons
// ============================================================================

const StopIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M4.5 7.5a3 3 0 013-3h9a3 3 0 013 3v9a3 3 0 01-3 3h-9a3 3 0 01-3-3v-9z"
      clip-rule="evenodd"
    />
  </svg>
);

const CloseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
  </svg>
);

const SendIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    class={className}
  >
    <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
  </svg>
);

// ============================================================================
// Constants
// ============================================================================

const WAVEFORM_BARS = 32;
const MAX_DURATION = 60;

// ============================================================================
// Component
// ============================================================================

export const VoiceRecorder: FunctionComponent<VoiceRecorderProps> = ({
  onRecordingComplete,
  onCancel,
  disabled = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [waveformData, setWaveformData] = useState<number[]>(new Array(WAVEFORM_BARS).fill(0.1));
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<VoiceRecorderService | null>(null);
  const waveformHistory = useRef<number[]>([]);

  // Initialize recorder
  useEffect(() => {
    recorderRef.current = new VoiceRecorderService();

    // Set up callbacks
    recorderRef.current.onWaveform((data) => {
      setWaveformData(data);
      // Accumulate waveform history for final message display
      waveformHistory.current.push(...data.slice(0, 4));
    });

    recorderRef.current.onDurationUpdate((seconds) => {
      setDuration(seconds);
    });

    recorderRef.current.onStateChange((state) => {
      setIsRecording(state === 'recording');
    });

    return () => {
      if (recorderRef.current?.isRecording()) {
        recorderRef.current.cancelRecording();
      }
    };
  }, []);

  // Start recording when component mounts
  useEffect(() => {
    const startRecording = async () => {
      if (!recorderRef.current || disabled) return;

      try {
        waveformHistory.current = [];
        await recorderRef.current.startRecording();
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start recording';
        setError(message);
        console.error('Recording error:', err);
      }
    };

    startRecording();
  }, [disabled]);

  // Handle stop and send
  const handleStopAndSend = useCallback(async () => {
    if (!recorderRef.current || !isRecording) return;

    try {
      const blob = await recorderRef.current.stopRecording();
      if (blob) {
        onRecordingComplete(blob, duration, waveformHistory.current);
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError('Failed to save recording');
    }
  }, [isRecording, duration, onRecordingComplete]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.cancelRecording();
    }
    onCancel();
  }, [onCancel]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 'Enter' && isRecording) {
        handleStopAndSend();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCancel, handleStopAndSend, isRecording]);

  // Show error state
  if (error) {
    return (
      <div class="flex items-center gap-3 p-3 bg-error/10 border-t border-error/30">
        <div class="flex-1 text-error text-terminal-sm font-mono">
          {error}
        </div>
        <button
          type="button"
          onClick={onCancel}
          class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-terminal border border-muted text-muted hover:text-text hover:border-text transition-colors touch-target"
          aria-label="Cancel"
        >
          <CloseIcon class="w-5 h-5" />
        </button>
      </div>
    );
  }

  const remainingTime = MAX_DURATION - duration;
  const isNearLimit = remainingTime <= 10;

  return (
    <div class="border-t border-muted bg-background">
      {/* Recording bar */}
      <div class="flex items-center gap-3 p-3">
        {/* Cancel button */}
        <button
          type="button"
          onClick={handleCancel}
          class="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-terminal border border-muted text-muted hover:text-text hover:border-text transition-colors touch-target"
          aria-label="Cancel recording"
        >
          <CloseIcon class="w-5 h-5" />
        </button>

        {/* Recording indicator and waveform */}
        <div class="flex-1 flex items-center gap-3 min-w-0">
          {/* Recording dot */}
          <div class="flex-shrink-0 flex items-center gap-2">
            <span
              class="w-3 h-3 rounded-full bg-error animate-pulse"
              aria-label="Recording"
            />
            <span class={`text-terminal-sm font-mono tabular-nums ${isNearLimit ? 'text-error' : 'text-text'}`}>
              {formatDuration(duration)}
            </span>
          </div>

          {/* Waveform visualization */}
          <div class="flex-1 flex items-center justify-center gap-[2px] h-8 overflow-hidden">
            {waveformData.map((value, index) => (
              <div
                key={index}
                class="w-[3px] bg-primary rounded-full transition-all duration-75"
                style={{
                  height: `${Math.max(value * 100, 10)}%`,
                  opacity: value > 0.1 ? 1 : 0.5,
                }}
              />
            ))}
          </div>
        </div>

        {/* Stop/Send button */}
        <button
          type="button"
          onClick={handleStopAndSend}
          disabled={!isRecording}
          class="flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-terminal bg-primary border-primary text-background hover:bg-primary/80 active:bg-primary/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed touch-target"
          aria-label="Stop and send voice message"
        >
          <SendIcon class="w-5 h-5" />
        </button>
      </div>

      {/* Time limit warning */}
      {isNearLimit && (
        <div class="px-3 pb-2">
          <span class="text-terminal-xs text-error font-mono">
            {remainingTime}s remaining
          </span>
        </div>
      )}

      {/* Keyboard hint - desktop only */}
      <div class="hidden lg:block px-3 pb-2">
        <span class="text-terminal-xs text-muted font-mono">
          Press Enter to send, Escape to cancel
        </span>
      </div>
    </div>
  );
};

export default VoiceRecorder;
