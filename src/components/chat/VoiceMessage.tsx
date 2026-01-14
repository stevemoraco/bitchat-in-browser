/**
 * VoiceMessage - Voice message playback component
 *
 * Features:
 * - Play/pause button
 * - Waveform visualization (static or animated during playback)
 * - Duration display (e.g., "0:45")
 * - Playback progress indicator
 * - Tap waveform to seek
 * - Keyboard accessibility
 */

import type { FunctionComponent } from 'preact';
import { useState, useEffect, useRef, useCallback, useMemo } from 'preact/hooks';
import {
  getVoiceNote,
  createVoiceNoteUrl,
  formatDuration,
  normalizeWaveformData,
} from '../../services/media/voice-recorder';

// ============================================================================
// Types
// ============================================================================

export interface VoiceMessageProps {
  /** Voice note ID stored in IndexedDB */
  voiceNoteId: string;
  /** Duration in seconds (used if voice note not yet loaded) */
  duration?: number;
  /** Waveform data for visualization */
  waveformData?: number[];
  /** Whether this is an outgoing (own) message */
  isOwn?: boolean;
  /** Optional class name for styling */
  class?: string;
}

// ============================================================================
// Icons
// ============================================================================

const PlayIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z"
      clip-rule="evenodd"
    />
  </svg>
);

const PauseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    class={className}
  >
    <path
      fill-rule="evenodd"
      d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z"
      clip-rule="evenodd"
    />
  </svg>
);

const LoadingIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    class={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      class="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      stroke-width="4"
    />
    <path
      class="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

// ============================================================================
// Constants
// ============================================================================

const WAVEFORM_BARS = 32;
const DEFAULT_WAVEFORM = new Array(WAVEFORM_BARS).fill(0.3);

// ============================================================================
// Component
// ============================================================================

export const VoiceMessage: FunctionComponent<VoiceMessageProps> = ({
  voiceNoteId,
  duration: propDuration = 0,
  waveformData: propWaveformData,
  isOwn = false,
  class: className = '',
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration);
  const [waveformData, setWaveformData] = useState<number[]>(
    propWaveformData ? normalizeWaveformData(propWaveformData, WAVEFORM_BARS) : DEFAULT_WAVEFORM
  );
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const waveformContainerRef = useRef<HTMLDivElement>(null);

  // Load voice note from IndexedDB
  useEffect(() => {
    let mounted = true;

    const loadVoiceNote = async () => {
      try {
        setIsLoading(true);
        const voiceNote = await getVoiceNote(voiceNoteId);

        if (!mounted) return;

        if (!voiceNote) {
          setError('Voice note not found');
          setIsLoading(false);
          return;
        }

        // Create audio URL
        const url = createVoiceNoteUrl(voiceNote);
        audioUrlRef.current = url;

        // Create audio element
        const audio = new Audio(url);
        audioRef.current = audio;

        // Set up event listeners
        audio.addEventListener('loadedmetadata', () => {
          if (mounted) {
            setDuration(Math.floor(audio.duration));
            setIsLoading(false);
          }
        });

        audio.addEventListener('timeupdate', () => {
          if (mounted) {
            setCurrentTime(Math.floor(audio.currentTime));
          }
        });

        audio.addEventListener('ended', () => {
          if (mounted) {
            setIsPlaying(false);
            setCurrentTime(0);
          }
        });

        audio.addEventListener('error', () => {
          if (mounted) {
            setError('Failed to load audio');
            setIsLoading(false);
          }
        });

        // Use voice note waveform data if available
        if (voiceNote.waveformData && voiceNote.waveformData.length > 0) {
          setWaveformData(normalizeWaveformData(voiceNote.waveformData, WAVEFORM_BARS));
        }

        // Set duration from voice note if available
        if (voiceNote.duration) {
          setDuration(voiceNote.duration);
        }

        // Load the audio
        audio.load();

      } catch (err) {
        if (mounted) {
          console.error('Failed to load voice note:', err);
          setError('Failed to load voice note');
          setIsLoading(false);
        }
      }
    };

    loadVoiceNote();

    return () => {
      mounted = false;

      // Cleanup
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [voiceNoteId]);

  // Play/pause toggle
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || isLoading || error) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Failed to play audio:', err);
        setError('Failed to play audio');
      });
      setIsPlaying(true);
    }
  }, [isPlaying, isLoading, error]);

  // Handle waveform click to seek
  const handleWaveformClick = useCallback(
    (e: MouseEvent) => {
      if (!audioRef.current || !waveformContainerRef.current || isLoading || error) return;

      const rect = waveformContainerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const percentage = clickX / rect.width;
      const seekTime = percentage * audioRef.current.duration;

      audioRef.current.currentTime = seekTime;
      setCurrentTime(Math.floor(seekTime));

      // Start playing if not already
      if (!isPlaying) {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    },
    [isLoading, error, isPlaying]
  );

  // Calculate progress percentage
  const progress = useMemo(() => {
    if (duration === 0) return 0;
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  // Display time (show current time when playing, duration otherwise)
  const displayTime = isPlaying ? currentTime : duration;

  // Color classes based on ownership
  const primaryColor = isOwn ? 'bg-background/80' : 'bg-primary';
  const secondaryColor = isOwn ? 'bg-background/40' : 'bg-primary/40';
  const textColor = isOwn ? 'text-background' : 'text-text';

  // Error state
  if (error) {
    return (
      <div class={`flex items-center gap-3 ${className}`}>
        <div class="w-10 h-10 flex items-center justify-center rounded-full bg-error/20">
          <span class="text-error text-terminal-xs">!</span>
        </div>
        <span class="text-terminal-xs text-error">{error}</span>
      </div>
    );
  }

  return (
    <div class={`flex items-center gap-3 ${className}`}>
      {/* Play/Pause button */}
      <button
        type="button"
        onClick={togglePlayPause}
        disabled={isLoading}
        class={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full transition-all touch-target ${
          isOwn
            ? 'bg-background/20 hover:bg-background/30 text-background'
            : 'bg-primary/20 hover:bg-primary/30 text-primary'
        } ${isLoading ? 'cursor-wait' : ''}`}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isLoading ? (
          <LoadingIcon class="w-5 h-5" />
        ) : isPlaying ? (
          <PauseIcon class="w-5 h-5" />
        ) : (
          <PlayIcon class="w-5 h-5" />
        )}
      </button>

      {/* Waveform and duration */}
      <div class="flex-1 flex flex-col gap-1 min-w-0">
        {/* Waveform visualization */}
        <div
          ref={waveformContainerRef}
          onClick={handleWaveformClick}
          class="relative flex items-center gap-[2px] h-8 cursor-pointer"
          role="slider"
          aria-label="Audio playback position"
          aria-valuemin={0}
          aria-valuemax={duration}
          aria-valuenow={currentTime}
          tabIndex={0}
          onKeyDown={(e) => {
            if (!audioRef.current) return;
            if (e.key === 'ArrowRight') {
              audioRef.current.currentTime = Math.min(
                audioRef.current.currentTime + 5,
                audioRef.current.duration
              );
            } else if (e.key === 'ArrowLeft') {
              audioRef.current.currentTime = Math.max(
                audioRef.current.currentTime - 5,
                0
              );
            } else if (e.key === ' ') {
              e.preventDefault();
              togglePlayPause();
            }
          }}
        >
          {waveformData.map((value, index) => {
            const barProgress = (index / waveformData.length) * 100;
            const isPlayed = barProgress < progress;

            return (
              <div
                key={index}
                class={`flex-1 rounded-full transition-all duration-75 ${
                  isPlayed ? primaryColor : secondaryColor
                }`}
                style={{
                  height: `${Math.max(value * 100, 15)}%`,
                }}
              />
            );
          })}
        </div>

        {/* Duration */}
        <div class="flex items-center justify-between">
          <span class={`text-terminal-xs font-mono tabular-nums ${textColor} opacity-70`}>
            {formatDuration(displayTime)}
          </span>
          {isPlaying && (
            <span class={`text-terminal-xs font-mono tabular-nums ${textColor} opacity-70`}>
              -{formatDuration(duration - currentTime)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceMessage;
