/**
 * Media Services - Barrel Export
 *
 * Export all media-related services:
 * - Voice recording and playback
 */

export {
  VoiceRecorderService,
  saveVoiceNote,
  getVoiceNote,
  deleteVoiceNote,
  getAllVoiceNotes,
  clearAllVoiceNotes,
  createVoiceNoteUrl,
  generateVoiceNoteId,
  formatDuration,
  normalizeWaveformData,
  generateWaveformFromBlob,
} from './voice-recorder';

export type {
  VoiceNote,
  RecordingState,
  WaveformCallback,
  StateChangeCallback,
  DurationCallback,
} from './voice-recorder';

// Image handling
export {
  ImageHandlerService,
  getImageHandler,
} from './image-handler';

export type { ImageMessageContent } from './image-handler';
