/**
 * ImagePicker - Image selection component for message input
 *
 * Features:
 * - Triggered by [+] attachment button
 * - File input accepting images
 * - Camera capture option on mobile
 * - Preview before sending
 * - Image compression
 * - Progress indicator during processing
 */

import type { FunctionComponent } from 'preact';
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import { ImageHandlerService, getImageHandler, type ImageMessageContent } from '../../services/media/image-handler';

// ============================================================================
// Types
// ============================================================================

export interface ImagePickerProps {
  /** Callback when an image is selected and processed */
  onImageSelected: (content: ImageMessageContent) => void;
  /** Callback when picker is cancelled */
  onCancel?: () => void;
  /** Whether the picker modal is open */
  isOpen: boolean;
  /** Callback to close the picker */
  onClose: () => void;
  /** Maximum file size in bytes (default 10MB) */
  maxFileSize?: number;
}

export interface ImagePickerButtonProps {
  /** Callback when clicked */
  onClick: () => void;
  /** Whether button is disabled */
  disabled?: boolean;
}

// ============================================================================
// Icons
// ============================================================================

const PlusIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const ImageIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const CameraIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const CloseIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SendIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const TrashIcon: FunctionComponent<{ class?: string }> = ({ class: className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class={className}
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// ImagePicker Button Component
// ============================================================================

/**
 * Attachment button that opens the image picker
 */
export const ImagePickerButton: FunctionComponent<ImagePickerButtonProps> = ({
  onClick,
  disabled = false,
}) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      class={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-terminal border transition-all touch-target ${
        disabled
          ? 'bg-surface border-muted text-muted cursor-not-allowed'
          : 'bg-surface border-muted text-text hover:border-primary hover:text-primary active:bg-primary/10'
      }`}
      aria-label="Add attachment"
    >
      <PlusIcon class="w-5 h-5" />
    </button>
  );

// ============================================================================
// ImagePicker Component
// ============================================================================

export const ImagePicker: FunctionComponent<ImagePickerProps> = ({
  onImageSelected,
  onCancel,
  isOpen,
  onClose,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if camera is available (mobile detection)
  const isMobile = typeof navigator !== 'undefined' &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Cleanup preview URL on unmount or when file changes
  useEffect(() => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    }, [previewUrl]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen]);

  const resetState = useCallback(() => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setIsProcessing(false);
    setError(null);
  }, [previewUrl]);

  // Handle file selection
  const handleFileSelect = useCallback(
    async (event: Event) => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];

      if (!file) return;

      // Validate file type
      if (!ImageHandlerService.isSupportedImageType(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }

      // Validate file size
      if (file.size > maxFileSize) {
        const sizeStr = ImageHandlerService.formatFileSize(maxFileSize);
        setError(`Image is too large. Maximum size is ${sizeStr}`);
        return;
      }

      setError(null);
      setSelectedFile(file);

      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Reset file input
      input.value = '';
    },
    [maxFileSize]
  );

  // Handle sending the image
  const handleSend = useCallback(async () => {
    if (!selectedFile || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    try {
      const imageHandler = getImageHandler();
      const processedImage = await imageHandler.processImageForSending(selectedFile);
      const content = imageHandler.createImageMessageContent(processedImage);

      onImageSelected(content);
      onClose();
    } catch (err) {
      console.error('Failed to process image:', err);
      setError('Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, isProcessing, onImageSelected, onClose]);

  // Handle cancel/close
  const handleClose = useCallback(() => {
    resetState();
    onCancel?.();
    onClose();
  }, [resetState, onCancel, onClose]);

  // Trigger file input click
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Trigger camera input click
  const openCamera = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  // Remove selected image
  const handleRemoveImage = useCallback(() => {
    resetState();
  }, [resetState]);

  if (!isOpen) return null;

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ImageHandlerService.getAcceptTypes()}
        onChange={handleFileSelect}
        class="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        class="hidden"
      />

      {/* Modal backdrop */}
      <div
        class="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center animate-fade-in"
        onClick={handleClose}
      >
        {/* Modal content */}
        <div
          class="w-full sm:max-w-md bg-background border-t sm:border border-muted sm:rounded-terminal shadow-terminal animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between px-4 py-3 border-b border-muted">
            <h3 class="text-terminal-sm font-mono font-medium text-text">
              {selectedFile ? 'Preview' : 'Add Image'}
            </h3>
            <button
              type="button"
              onClick={handleClose}
              class="w-8 h-8 flex items-center justify-center text-muted hover:text-text transition-colors rounded-terminal"
              aria-label="Close"
            >
              <CloseIcon class="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div class="p-4">
            {/* Error message */}
            {error && (
              <div class="mb-4 px-3 py-2 bg-error/10 border border-error/30 rounded-terminal text-terminal-xs text-error font-mono">
                {error}
              </div>
            )}

            {/* Preview or picker options */}
            {selectedFile && previewUrl ? (
              /* Image preview */
              <div class="space-y-4">
                <div class="relative max-h-[300px] rounded-terminal overflow-hidden bg-surface">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    class="w-full h-full object-contain max-h-[300px]"
                  />

                  {/* Processing overlay */}
                  {isProcessing && (
                    <div class="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div class="flex flex-col items-center gap-2">
                        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span class="text-terminal-xs text-white font-mono">
                          Processing...
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* File info */}
                <div class="text-terminal-xs text-muted font-mono">
                  {selectedFile.name} ({ImageHandlerService.formatFileSize(selectedFile.size)})
                </div>

                {/* Action buttons */}
                <div class="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    disabled={isProcessing}
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-muted text-text rounded-terminal hover:bg-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <TrashIcon class="w-4 h-4" />
                    <span class="text-terminal-sm font-mono">Remove</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isProcessing}
                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background rounded-terminal hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? (
                      <div class="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <SendIcon class="w-4 h-4" />
                    )}
                    <span class="text-terminal-sm font-mono">
                      {isProcessing ? 'Sending...' : 'Send'}
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* Picker options */
              <div class="space-y-3">
                {/* Gallery option */}
                <button
                  type="button"
                  onClick={openFilePicker}
                  class="w-full flex items-center gap-4 px-4 py-3 bg-surface border border-muted rounded-terminal hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <div class="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-terminal">
                    <ImageIcon class="w-5 h-5 text-primary" />
                  </div>
                  <div class="text-left">
                    <div class="text-terminal-sm font-mono text-text">
                      Choose from Gallery
                    </div>
                    <div class="text-terminal-xs text-muted">
                      Select an existing photo
                    </div>
                  </div>
                </button>

                {/* Camera option (mobile only) */}
                {isMobile && (
                  <button
                    type="button"
                    onClick={openCamera}
                    class="w-full flex items-center gap-4 px-4 py-3 bg-surface border border-muted rounded-terminal hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div class="w-10 h-10 flex items-center justify-center bg-primary/10 rounded-terminal">
                      <CameraIcon class="w-5 h-5 text-primary" />
                    </div>
                    <div class="text-left">
                      <div class="text-terminal-sm font-mono text-text">
                        Take Photo
                      </div>
                      <div class="text-terminal-xs text-muted">
                        Use your camera
                      </div>
                    </div>
                  </button>
                )}

                {/* File size hint */}
                <p class="text-terminal-xs text-muted text-center mt-4 font-mono">
                  Maximum file size: {ImageHandlerService.formatFileSize(maxFileSize)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ImagePicker;
