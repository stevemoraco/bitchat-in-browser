/**
 * Voice Recorder Service
 *
 * Handles voice note recording with the MediaRecorder API.
 * Features:
 * - Records audio using Opus codec in WebM container
 * - Maximum 60 second recording duration
 * - Real-time waveform data via Web Audio API
 * - Audio blob storage in IndexedDB
 *
 * @module services/media/voice-recorder
 */

import Dexie, { type Table } from 'dexie';

// ============================================================================
// Types
// ============================================================================

/** Stored voice note record */
export interface VoiceNote {
  /** Unique identifier for the voice note */
  id: string;
  /** Audio blob data */
  blob: Blob;
  /** MIME type of the audio */
  mimeType: string;
  /** Duration in seconds */
  duration: number;
  /** Waveform data for visualization (normalized 0-1) */
  waveformData: number[];
  /** Creation timestamp */
  createdAt: number;
}

/** Recording state */
export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

/** Waveform callback for real-time visualization */
export type WaveformCallback = (data: number[]) => void;

/** Recording state change callback */
export type StateChangeCallback = (state: RecordingState) => void;

/** Duration update callback */
export type DurationCallback = (seconds: number) => void;

// ============================================================================
// Constants
// ============================================================================

/** Maximum recording duration in seconds */
const MAX_RECORDING_DURATION = 60;

/** Update interval for waveform visualization (ms) */
const WAVEFORM_UPDATE_INTERVAL = 1000 / 60; // 60fps

/** Number of frequency bars for visualization */
const WAVEFORM_BARS = 32;

/** Preferred audio MIME types in order of preference */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
  'audio/ogg',
  'audio/mp4',
];

// ============================================================================
// IndexedDB Storage for Voice Notes
// ============================================================================

interface VoiceNoteDB extends Dexie {
  voiceNotes: Table<VoiceNote>;
}

class VoiceNoteStorage {
  private db: VoiceNoteDB;
  private isInitialized = false;

  constructor() {
    this.db = new Dexie('bitchat-voice-notes') as VoiceNoteDB;
    this.db.version(1).stores({
      voiceNotes: 'id, createdAt',
    });
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    await this.db.open();
    this.isInitialized = true;
  }

  async save(voiceNote: VoiceNote): Promise<void> {
    await this.ensureInitialized();
    await this.db.voiceNotes.put(voiceNote);
  }

  async get(id: string): Promise<VoiceNote | undefined> {
    await this.ensureInitialized();
    return this.db.voiceNotes.get(id);
  }

  async delete(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db.voiceNotes.delete(id);
  }

  async getAll(): Promise<VoiceNote[]> {
    await this.ensureInitialized();
    return this.db.voiceNotes.toArray();
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();
    await this.db.voiceNotes.clear();
  }
}

// Singleton storage instance
const voiceNoteStorage = new VoiceNoteStorage();

// ============================================================================
// Voice Recorder Service
// ============================================================================

/**
 * Voice Recorder Service class for recording audio.
 *
 * @example
 * ```typescript
 * const recorder = new VoiceRecorderService();
 * recorder.onWaveform((data) => drawWaveform(data));
 * recorder.onDurationUpdate((seconds) => updateTimer(seconds));
 *
 * await recorder.startRecording();
 * // ... user records
 * const blob = await recorder.stopRecording();
 * ```
 */
export class VoiceRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private recordingState: RecordingState = 'idle';
  private startTime: number = 0;
  private duration: number = 0;
  private waveformData: number[] = [];
  private animationFrameId: number | null = null;
  private durationIntervalId: ReturnType<typeof setInterval> | null = null;
  private maxDurationTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // Callbacks
  private waveformCallback: WaveformCallback | null = null;
  private stateChangeCallback: StateChangeCallback | null = null;
  private durationCallback: DurationCallback | null = null;

  // Resolved MIME type
  private mimeType: string = '';

  /**
   * Register a callback for waveform updates (60fps during recording).
   */
  onWaveform(callback: WaveformCallback): void {
    this.waveformCallback = callback;
  }

  /**
   * Register a callback for recording state changes.
   */
  onStateChange(callback: StateChangeCallback): void {
    this.stateChangeCallback = callback;
  }

  /**
   * Register a callback for duration updates (every second).
   */
  onDurationUpdate(callback: DurationCallback): void {
    this.durationCallback = callback;
  }

  /**
   * Get the current recording state.
   */
  getState(): RecordingState {
    return this.recordingState;
  }

  /**
   * Check if currently recording.
   */
  isRecording(): boolean {
    return this.recordingState === 'recording';
  }

  /**
   * Get the current recording duration in seconds.
   */
  getRecordingDuration(): number {
    if (this.recordingState === 'recording') {
      return Math.floor((Date.now() - this.startTime) / 1000);
    }
    return this.duration;
  }

  /**
   * Start recording audio.
   *
   * @throws Error if microphone access is denied or unavailable
   */
  async startRecording(): Promise<void> {
    if (this.recordingState === 'recording') {
      console.warn('Already recording');
      return;
    }

    try {
      // Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });

      // Find supported MIME type
      this.mimeType = this.getSupportedMimeType();
      if (!this.mimeType) {
        throw new Error('No supported audio MIME type found');
      }

      // Create MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: this.mimeType,
      });

      // Set up Web Audio API for waveform visualization
      this.setupAudioAnalyser();

      // Reset state
      this.audioChunks = [];
      this.waveformData = [];
      this.duration = 0;
      this.startTime = Date.now();

      // Handle recorded data
      this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        this.duration = Math.floor((Date.now() - this.startTime) / 1000);
        this.cleanup();
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.updateState('recording');

      // Start waveform animation
      this.startWaveformAnimation();

      // Start duration updates
      this.startDurationUpdates();

      // Set maximum duration timeout
      this.maxDurationTimeoutId = setTimeout(() => {
        if (this.recordingState === 'recording') {
          console.log('Max recording duration reached');
          this.stopRecording();
        }
      }, MAX_RECORDING_DURATION * 1000);

    } catch (error) {
      this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording and return the audio blob.
   *
   * @returns The recorded audio blob, or null if no recording was in progress
   */
  async stopRecording(): Promise<Blob | null> {
    if (!this.mediaRecorder || this.recordingState !== 'recording') {
      return null;
    }

    return new Promise((resolve) => {
      const handleStop = () => {
        const blob = new Blob(this.audioChunks, { type: this.mimeType });
        this.cleanup();
        this.updateState('stopped');
        resolve(blob);
      };

      this.mediaRecorder!.onstop = handleStop;
      this.mediaRecorder!.stop();
    });
  }

  /**
   * Cancel the current recording without saving.
   */
  cancelRecording(): void {
    if (this.mediaRecorder && this.recordingState === 'recording') {
      this.mediaRecorder.stop();
    }
    this.cleanup();
    this.updateState('idle');
  }

  /**
   * Get the final waveform data (sampled for visualization).
   */
  getWaveformData(): number[] {
    return [...this.waveformData];
  }

  /**
   * Check if voice recording is supported in this browser.
   */
  static isSupported(): boolean {
    return !!(
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      typeof AudioContext !== 'undefined'
    );
  }

  /**
   * Get the supported MIME type for recording.
   */
  private getSupportedMimeType(): string {
    for (const mimeType of PREFERRED_MIME_TYPES) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return '';
  }

  /**
   * Set up the Web Audio API analyser for waveform visualization.
   */
  private setupAudioAnalyser(): void {
    if (!this.mediaStream) return;

    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      source.connect(this.analyser);
    } catch (error) {
      console.error('Failed to set up audio analyser:', error);
    }
  }

  /**
   * Start the waveform animation loop.
   */
  private startWaveformAnimation(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateWaveform = () => {
      if (this.recordingState !== 'recording') return;

      this.analyser!.getByteFrequencyData(dataArray);

      // Sample frequency data into bars
      const barData: number[] = [];
      const step = Math.floor(bufferLength / WAVEFORM_BARS);

      for (let i = 0; i < WAVEFORM_BARS; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j];
        }
        // Normalize to 0-1
        barData.push(sum / step / 255);
      }

      // Store waveform data for final visualization
      this.waveformData.push(...barData.slice(0, 4)); // Sample a few bars

      // Call waveform callback
      if (this.waveformCallback) {
        this.waveformCallback(barData);
      }

      this.animationFrameId = requestAnimationFrame(updateWaveform);
    };

    updateWaveform();
  }

  /**
   * Start duration update interval.
   */
  private startDurationUpdates(): void {
    this.durationIntervalId = setInterval(() => {
      if (this.recordingState === 'recording' && this.durationCallback) {
        const currentDuration = this.getRecordingDuration();
        this.durationCallback(currentDuration);
      }
    }, 1000);

    // Initial callback
    if (this.durationCallback) {
      this.durationCallback(0);
    }
  }

  /**
   * Update the recording state and notify listeners.
   */
  private updateState(state: RecordingState): void {
    this.recordingState = state;
    if (this.stateChangeCallback) {
      this.stateChangeCallback(state);
    }
  }

  /**
   * Clean up resources.
   */
  private cleanup(): void {
    // Stop animation frame
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop duration interval
    if (this.durationIntervalId !== null) {
      clearInterval(this.durationIntervalId);
      this.durationIntervalId = null;
    }

    // Clear max duration timeout
    if (this.maxDurationTimeoutId !== null) {
      clearTimeout(this.maxDurationTimeoutId);
      this.maxDurationTimeoutId = null;
    }

    // Stop media stream tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.mediaRecorder = null;
  }
}

// ============================================================================
// Voice Note Storage Functions
// ============================================================================

/**
 * Generate a unique ID for a voice note.
 */
export function generateVoiceNoteId(): string {
  return `voice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Save a recorded voice note to IndexedDB.
 *
 * @param blob - The audio blob from recording
 * @param duration - Duration in seconds
 * @param waveformData - Optional waveform data for visualization
 * @returns The saved voice note record
 */
export async function saveVoiceNote(
  blob: Blob,
  duration: number,
  waveformData: number[] = []
): Promise<VoiceNote> {
  const voiceNote: VoiceNote = {
    id: generateVoiceNoteId(),
    blob,
    mimeType: blob.type,
    duration,
    waveformData: normalizeWaveformData(waveformData, 32),
    createdAt: Date.now(),
  };

  await voiceNoteStorage.save(voiceNote);
  return voiceNote;
}

/**
 * Get a voice note by ID.
 */
export async function getVoiceNote(id: string): Promise<VoiceNote | undefined> {
  return voiceNoteStorage.get(id);
}

/**
 * Delete a voice note by ID.
 */
export async function deleteVoiceNote(id: string): Promise<void> {
  return voiceNoteStorage.delete(id);
}

/**
 * Get all voice notes.
 */
export async function getAllVoiceNotes(): Promise<VoiceNote[]> {
  return voiceNoteStorage.getAll();
}

/**
 * Clear all voice notes.
 */
export async function clearAllVoiceNotes(): Promise<void> {
  return voiceNoteStorage.clear();
}

/**
 * Create an object URL for a voice note blob.
 * Remember to revoke when done using URL.revokeObjectURL().
 */
export function createVoiceNoteUrl(voiceNote: VoiceNote): string {
  return URL.createObjectURL(voiceNote.blob);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format duration as MM:SS.
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Normalize waveform data to a specific number of bars.
 *
 * @param data - Raw waveform data
 * @param targetBars - Number of bars to normalize to
 * @returns Normalized array of values between 0 and 1
 */
export function normalizeWaveformData(data: number[], targetBars: number): number[] {
  if (data.length === 0) {
    return new Array(targetBars).fill(0.1);
  }

  if (data.length === targetBars) {
    return data;
  }

  const result: number[] = [];
  const step = data.length / targetBars;

  for (let i = 0; i < targetBars; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let sum = 0;
    let count = 0;

    for (let j = start; j < end && j < data.length; j++) {
      sum += data[j];
      count++;
    }

    // Ensure minimum height for visualization
    result.push(Math.max(count > 0 ? sum / count : 0, 0.1));
  }

  return result;
}

/**
 * Generate static waveform data from an audio blob.
 * Useful for voice messages received from peers.
 */
export async function generateWaveformFromBlob(
  blob: Blob,
  targetBars: number = 32
): Promise<number[]> {
  try {
    const audioContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const channelData = audioBuffer.getChannelData(0);
    const samplesPerBar = Math.floor(channelData.length / targetBars);
    const waveform: number[] = [];

    for (let i = 0; i < targetBars; i++) {
      let sum = 0;
      for (let j = 0; j < samplesPerBar; j++) {
        sum += Math.abs(channelData[i * samplesPerBar + j]);
      }
      // Normalize and ensure minimum height
      waveform.push(Math.max(sum / samplesPerBar, 0.1));
    }

    // Normalize to 0-1 range
    const max = Math.max(...waveform);
    const normalized = waveform.map((v) => v / max);

    await audioContext.close();
    return normalized;
  } catch (error) {
    console.error('Failed to generate waveform from blob:', error);
    return new Array(targetBars).fill(0.3);
  }
}

// Default export of the service class
export default VoiceRecorderService;
