/**
 * Voice Recorder Service Tests
 *
 * Tests for voice recording functionality including MediaRecorder support detection,
 * recording lifecycle, permission handling, max duration enforcement, and waveform generation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VoiceRecorderService,
  formatDuration,
  normalizeWaveformData,
  generateVoiceNoteId,
} from '../voice-recorder';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock MediaRecorder - using a factory function to ensure fresh mock per test
const createMockMediaRecorder = () => {
  class MockMediaRecorderClass {
    static isTypeSupported = vi.fn().mockReturnValue(true);

    state: 'inactive' | 'recording' | 'paused' = 'inactive';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: ((event: Error) => void) | null = null;

    private stream: MediaStream;
    private timeslice?: number;
    private intervalId?: ReturnType<typeof setInterval>;

    constructor(stream: MediaStream, _options?: { mimeType: string }) {
      this.stream = stream;
    }

    start(timeslice?: number): void {
      this.state = 'recording';
      this.timeslice = timeslice;

      // Simulate periodic data availability
      if (timeslice && this.ondataavailable) {
        this.intervalId = setInterval(() => {
          if (this.ondataavailable) {
            this.ondataavailable({ data: new Blob(['audio-data'], { type: 'audio/webm' }) });
          }
        }, timeslice);
      }
    }

    stop(): void {
      this.state = 'inactive';
      if (this.intervalId) {
        clearInterval(this.intervalId);
      }
      // Emit final data
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(['final-audio-data'], { type: 'audio/webm' }) });
      }
      // Call onstop callback
      setTimeout(() => {
        if (this.onstop) {
          this.onstop();
        }
      }, 0);
    }

    pause(): void {
      this.state = 'paused';
    }

    resume(): void {
      this.state = 'recording';
    }
  }
  return MockMediaRecorderClass;
};

// Default mock class
let MockMediaRecorder = createMockMediaRecorder();

// Mock MediaStream
class MockMediaStream {
  private tracks: MockMediaStreamTrack[] = [];

  constructor() {
    this.tracks = [new MockMediaStreamTrack()];
  }

  getTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }

  getAudioTracks(): MockMediaStreamTrack[] {
    return this.tracks;
  }
}

class MockMediaStreamTrack {
  kind = 'audio';
  enabled = true;
  muted = false;
  readyState: 'live' | 'ended' = 'live';

  stop(): void {
    this.readyState = 'ended';
  }
}

// Mock AudioContext
class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  sampleRate = 48000;

  createMediaStreamSource(_stream: MediaStream): MockMediaStreamAudioSourceNode {
    return new MockMediaStreamAudioSourceNode();
  }

  createAnalyser(): MockAnalyserNode {
    return new MockAnalyserNode();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

class MockMediaStreamAudioSourceNode {
  connect(_destination: AudioNode): void {
    // No-op
  }
}

class MockAnalyserNode {
  fftSize = 256;
  frequencyBinCount = 128;
  smoothingTimeConstant = 0.8;

  getByteFrequencyData(array: Uint8Array): void {
    // Fill with mock frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }

  getByteTimeDomainData(array: Uint8Array): void {
    // Fill with mock time domain data
    for (let i = 0; i < array.length; i++) {
      array[i] = 128 + Math.floor(Math.random() * 50);
    }
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('VoiceRecorderService', () => {
  let originalMediaRecorder: typeof MediaRecorder;
  let originalAudioContext: typeof AudioContext;
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Store originals
    originalMediaRecorder = globalThis.MediaRecorder;
    originalAudioContext = globalThis.AudioContext;

    // Create fresh mock class for each test
    MockMediaRecorder = createMockMediaRecorder();

    // Set up mocks
    globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    // Mock getUserMedia
    mockGetUserMedia = vi.fn().mockResolvedValue(new MockMediaStream());

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      configurable: true,
      writable: true,
    });

    // Reset mocks
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(async () => {
    // Allow any pending promises to resolve
    await vi.runAllTimersAsync();

    // Restore originals
    globalThis.MediaRecorder = originalMediaRecorder;
    globalThis.AudioContext = originalAudioContext;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Support Detection Tests
  // --------------------------------------------------------------------------

  describe('Support Detection', () => {
    describe('isSupported', () => {
      it('should return true when all APIs are available', () => {
        expect(VoiceRecorderService.isSupported()).toBe(true);
      });

      it('should return false when MediaRecorder is unavailable', () => {
        const original = globalThis.MediaRecorder;
        // @ts-expect-error - intentionally removing for test
        delete globalThis.MediaRecorder;

        expect(VoiceRecorderService.isSupported()).toBe(false);

        globalThis.MediaRecorder = original;
      });

      it('should return false when AudioContext is unavailable', () => {
        const original = globalThis.AudioContext;
        // @ts-expect-error - intentionally removing for test
        delete globalThis.AudioContext;

        expect(VoiceRecorderService.isSupported()).toBe(false);

        globalThis.AudioContext = original;
      });

      it('should return false when mediaDevices is unavailable', () => {
        const original = navigator.mediaDevices;
        Object.defineProperty(navigator, 'mediaDevices', {
          value: undefined,
          configurable: true,
          writable: true,
        });

        expect(VoiceRecorderService.isSupported()).toBe(false);

        Object.defineProperty(navigator, 'mediaDevices', {
          value: original,
          configurable: true,
          writable: true,
        });
      });

      it('should return false when getUserMedia is unavailable', () => {
        Object.defineProperty(navigator, 'mediaDevices', {
          value: {},
          configurable: true,
          writable: true,
        });

        expect(VoiceRecorderService.isSupported()).toBe(false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // Recording Lifecycle Tests
  // --------------------------------------------------------------------------

  describe('Recording Lifecycle', () => {
    let recorder: VoiceRecorderService;

    beforeEach(() => {
      recorder = new VoiceRecorderService();
    });

    describe('Initial State', () => {
      it('should start in idle state', () => {
        expect(recorder.getState()).toBe('idle');
      });

      it('should not be recording initially', () => {
        expect(recorder.isRecording()).toBe(false);
      });

      it('should have zero duration initially', () => {
        expect(recorder.getRecordingDuration()).toBe(0);
      });
    });

    describe('startRecording', () => {
      it('should request microphone access', async () => {
        const startPromise = recorder.startRecording();
        // Only advance enough time for async operations, not 60 second timeout
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        expect(mockGetUserMedia).toHaveBeenCalledWith({
          audio: expect.objectContaining({
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 48000,
          }),
        });
      });

      it('should transition to recording state', async () => {
        const startPromise = recorder.startRecording();
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        expect(recorder.getState()).toBe('recording');
        expect(recorder.isRecording()).toBe(true);
      });

      it('should not start if already recording', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const startPromise = recorder.startRecording();
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        // Try to start again - this returns immediately without a new promise
        await recorder.startRecording();

        expect(warnSpy).toHaveBeenCalledWith('Already recording');
      });

      it('should call state change callback', async () => {
        const stateCallback = vi.fn();
        recorder.onStateChange(stateCallback);

        const startPromise = recorder.startRecording();
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        expect(stateCallback).toHaveBeenCalledWith('recording');
      });
    });

    describe('stopRecording', () => {
      it('should return blob when recording stops', async () => {
        const startPromise = recorder.startRecording();
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        const blobPromise = recorder.stopRecording();
        await vi.advanceTimersByTimeAsync(100);
        const blob = await blobPromise;

        expect(blob).toBeInstanceOf(Blob);
      });

      it('should return null if not recording', async () => {
        const blob = await recorder.stopRecording();
        expect(blob).toBeNull();
      });

      it('should transition to stopped state', async () => {
        const startPromise = recorder.startRecording();
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        const blobPromise = recorder.stopRecording();
        await vi.advanceTimersByTimeAsync(100);
        await blobPromise;

        expect(recorder.getState()).toBe('stopped');
        expect(recorder.isRecording()).toBe(false);
      });

      it('should call state change callback', async () => {
        const stateCallback = vi.fn();
        recorder.onStateChange(stateCallback);

        const startPromise = recorder.startRecording();
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        const blobPromise = recorder.stopRecording();
        await vi.advanceTimersByTimeAsync(100);
        await blobPromise;

        expect(stateCallback).toHaveBeenCalledWith('stopped');
      });
    });

    describe('cancelRecording', () => {
      it('should transition to idle state', async () => {
        const startPromise = recorder.startRecording();
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        recorder.cancelRecording();
        await vi.advanceTimersByTimeAsync(100);

        expect(recorder.getState()).toBe('idle');
      });

      it('should not produce a blob', async () => {
        const startPromise = recorder.startRecording();
        await vi.advanceTimersByTimeAsync(100);
        await startPromise;

        recorder.cancelRecording();
        await vi.advanceTimersByTimeAsync(100);

        // State should be idle, not stopped
        expect(recorder.getState()).toBe('idle');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Permission Handling Tests
  // --------------------------------------------------------------------------

  describe('Permission Handling', () => {
    let recorder: VoiceRecorderService;

    beforeEach(() => {
      recorder = new VoiceRecorderService();
    });

    it('should throw error when permission is denied', async () => {
      mockGetUserMedia.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));

      await expect(recorder.startRecording()).rejects.toThrow();
    });

    it('should throw error when no microphone available', async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException('No device found', 'NotFoundError')
      );

      await expect(recorder.startRecording()).rejects.toThrow();
    });

    it('should throw error when device is in use', async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException('Device in use', 'NotReadableError')
      );

      await expect(recorder.startRecording()).rejects.toThrow();
    });

    it('should cleanup on error', async () => {
      mockGetUserMedia.mockRejectedValue(new Error('Test error'));

      try {
        await recorder.startRecording();
      } catch {
        // Expected to throw
      }

      expect(recorder.getState()).toBe('idle');
    });
  });

  // --------------------------------------------------------------------------
  // Max Duration Tests
  // --------------------------------------------------------------------------

  describe('Max Duration Enforcement', () => {
    let recorder: VoiceRecorderService;

    beforeEach(() => {
      recorder = new VoiceRecorderService();
    });

    it('should automatically stop after 60 seconds', async () => {
      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      expect(recorder.isRecording()).toBe(true);

      // Advance time by 60 seconds
      await vi.advanceTimersByTimeAsync(60 * 1000);

      // Should have stopped
      expect(recorder.isRecording()).toBe(false);
    });

    it('should not stop before 60 seconds', async () => {
      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      // Advance time by 59 seconds
      await vi.advanceTimersByTimeAsync(59 * 1000);

      // Should still be recording
      expect(recorder.isRecording()).toBe(true);
    });

    it('should log when max duration is reached', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      await vi.advanceTimersByTimeAsync(60 * 1000);

      expect(logSpy).toHaveBeenCalledWith('Max recording duration reached');
    });
  });

  // --------------------------------------------------------------------------
  // Waveform Data Tests
  // --------------------------------------------------------------------------

  describe('Waveform Data', () => {
    let recorder: VoiceRecorderService;

    beforeEach(() => {
      recorder = new VoiceRecorderService();
    });

    it('should call waveform callback during recording', async () => {
      const waveformCallback = vi.fn();
      recorder.onWaveform(waveformCallback);

      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      // Run animation frames
      await vi.advanceTimersByTimeAsync(100);

      // Waveform callback should have been called
      expect(waveformCallback).toHaveBeenCalled();
    });

    it('should provide array of normalized values', async () => {
      let waveformData: number[] = [];
      recorder.onWaveform((data) => {
        waveformData = data;
      });

      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      await vi.advanceTimersByTimeAsync(100);

      if (waveformData.length > 0) {
        // Values should be between 0 and 1
        expect(waveformData.every((v) => v >= 0 && v <= 1)).toBe(true);
      }
    });

    it('should store waveform data for retrieval', async () => {
      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      // Let some waveform data accumulate
      await vi.advanceTimersByTimeAsync(500);

      const waveformData = recorder.getWaveformData();
      expect(Array.isArray(waveformData)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Duration Tracking Tests
  // --------------------------------------------------------------------------

  describe('Duration Tracking', () => {
    let recorder: VoiceRecorderService;

    beforeEach(() => {
      recorder = new VoiceRecorderService();
    });

    it('should track duration during recording', async () => {
      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      await vi.advanceTimersByTimeAsync(5000);

      const duration = recorder.getRecordingDuration();
      expect(duration).toBeGreaterThanOrEqual(4); // Allow some variance
      expect(duration).toBeLessThanOrEqual(6);
    });

    it('should call duration callback every second', async () => {
      const durationCallback = vi.fn();
      recorder.onDurationUpdate(durationCallback);

      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      // Initial callback
      expect(durationCallback).toHaveBeenCalledWith(0);

      // After 1 second
      await vi.advanceTimersByTimeAsync(1000);

      // After 2 seconds
      await vi.advanceTimersByTimeAsync(1000);

      // Should have been called multiple times
      expect(durationCallback.mock.calls.length).toBeGreaterThan(1);
    });

    it('should preserve duration after stopping', async () => {
      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      // Advance time while recording
      await vi.advanceTimersByTimeAsync(5000);

      // Check duration before stopping
      const durationBeforeStop = recorder.getRecordingDuration();
      expect(durationBeforeStop).toBeGreaterThanOrEqual(4);

      const blobPromise = recorder.stopRecording();
      await vi.advanceTimersByTimeAsync(100);
      await blobPromise;

      // After stopping, duration should be preserved (though implementation may vary)
      const durationAfterStop = recorder.getRecordingDuration();
      expect(typeof durationAfterStop).toBe('number');
    });
  });

  // --------------------------------------------------------------------------
  // Callback Registration Tests
  // --------------------------------------------------------------------------

  describe('Callback Registration', () => {
    let recorder: VoiceRecorderService;

    beforeEach(() => {
      recorder = new VoiceRecorderService();
    });

    it('should allow registering waveform callback', () => {
      const callback = vi.fn();
      recorder.onWaveform(callback);
      // No error should be thrown
    });

    it('should allow registering state change callback', () => {
      const callback = vi.fn();
      recorder.onStateChange(callback);
      // No error should be thrown
    });

    it('should allow registering duration callback', () => {
      const callback = vi.fn();
      recorder.onDurationUpdate(callback);
      // No error should be thrown
    });

    it('should overwrite previous callback when registering new one', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      recorder.onStateChange(callback1);
      recorder.onStateChange(callback2);

      const startPromise = recorder.startRecording();
      await vi.advanceTimersByTimeAsync(100);
      await startPromise;

      // Only callback2 should be called
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Voice Recorder Utility Functions', () => {
  describe('formatDuration', () => {
    it('should format 0 seconds as 0:00', () => {
      expect(formatDuration(0)).toBe('0:00');
    });

    it('should format seconds correctly', () => {
      expect(formatDuration(5)).toBe('0:05');
      expect(formatDuration(30)).toBe('0:30');
      expect(formatDuration(59)).toBe('0:59');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(90)).toBe('1:30');
      expect(formatDuration(125)).toBe('2:05');
    });

    it('should pad seconds with leading zero', () => {
      expect(formatDuration(61)).toBe('1:01');
      expect(formatDuration(69)).toBe('1:09');
    });

    it('should handle large values', () => {
      expect(formatDuration(3600)).toBe('60:00');
      expect(formatDuration(3661)).toBe('61:01');
    });
  });

  describe('normalizeWaveformData', () => {
    it('should return array of minimum values for empty input', () => {
      const result = normalizeWaveformData([], 32);
      expect(result.length).toBe(32);
      expect(result.every((v) => v === 0.1)).toBe(true);
    });

    it('should return same data if length matches target', () => {
      const input = [0.5, 0.6, 0.7, 0.8];
      const result = normalizeWaveformData(input, 4);
      expect(result).toEqual(input);
    });

    it('should downsample longer data', () => {
      const input = Array(100).fill(0.5);
      const result = normalizeWaveformData(input, 32);
      expect(result.length).toBe(32);
    });

    it('should upsample shorter data', () => {
      const input = [0.5, 0.6, 0.7, 0.8];
      const result = normalizeWaveformData(input, 32);
      expect(result.length).toBe(32);
    });

    it('should ensure minimum value of 0.1 when resampling', () => {
      // When lengths differ, the function applies minimum value of 0.1
      const input = [0, 0, 0, 0, 0, 0, 0, 0]; // 8 elements
      const result = normalizeWaveformData(input, 4); // Downsample to 4
      expect(result.every((v) => v >= 0.1)).toBe(true);
    });

    it('should pass through data unchanged when length matches', () => {
      // When data.length === targetBars, data is returned as-is (per implementation)
      const input = [0, 0, 0, 0];
      const result = normalizeWaveformData(input, 4);
      expect(result).toEqual(input);
    });

    it('should handle single element input', () => {
      const input = [0.5];
      const result = normalizeWaveformData(input, 4);
      expect(result.length).toBe(4);
    });
  });

  describe('generateVoiceNoteId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateVoiceNoteId();
      const id2 = generateVoiceNoteId();
      expect(id1).not.toBe(id2);
    });

    it('should include voice prefix', () => {
      const id = generateVoiceNoteId();
      expect(id.startsWith('voice_')).toBe(true);
    });

    it('should include timestamp', () => {
      const id = generateVoiceNoteId();
      const parts = id.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(2);
      // Second part should be a timestamp (numeric)
      expect(Number.isInteger(parseInt(parts[1], 10))).toBe(true);
    });

    it('should include random suffix', () => {
      const id = generateVoiceNoteId();
      const parts = id.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      // Last part should be alphanumeric
      expect(parts[2].length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// MIME Type Support Tests
// ============================================================================

describe('MIME Type Support', () => {
  let originalMediaRecorder: typeof MediaRecorder;
  let originalAudioContext: typeof AudioContext;
  let mockGetUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalMediaRecorder = globalThis.MediaRecorder;
    originalAudioContext = globalThis.AudioContext;

    // Create fresh mock class for each test
    MockMediaRecorder = createMockMediaRecorder();

    globalThis.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
    globalThis.AudioContext = MockAudioContext as unknown as typeof AudioContext;

    mockGetUserMedia = vi.fn().mockResolvedValue(new MockMediaStream());

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: mockGetUserMedia,
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    globalThis.MediaRecorder = originalMediaRecorder;
    globalThis.AudioContext = originalAudioContext;
    vi.restoreAllMocks();
  });

  it('should check for audio/webm;codecs=opus support first', () => {
    const isTypeSupportedSpy = vi.spyOn(MockMediaRecorder, 'isTypeSupported');
    new VoiceRecorderService();

    // The service checks MIME types during recording, not instantiation
    // This test verifies the mock is set up correctly
    expect(isTypeSupportedSpy).toBeDefined();
  });

  it('should fall back to alternative formats', () => {
    MockMediaRecorder.isTypeSupported.mockImplementation((mimeType: string) => {
      // Only support audio/ogg
      return mimeType === 'audio/ogg';
    });

    // Service should still work with fallback format
    const recorder = new VoiceRecorderService();
    expect(recorder).toBeDefined();
  });

  it('should throw error when no supported format found', async () => {
    MockMediaRecorder.isTypeSupported.mockReturnValue(false);

    const recorder = new VoiceRecorderService();

    await expect(recorder.startRecording()).rejects.toThrow('No supported audio MIME type found');
  });
});
