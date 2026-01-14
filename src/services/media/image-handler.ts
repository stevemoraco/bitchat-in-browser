/**
 * Image Handler Service
 *
 * Provides image processing capabilities for BitChat:
 * - Image compression for efficient sending
 * - Blurred thumbnail generation for privacy
 * - IndexedDB storage for image persistence
 *
 * @module services/media/image-handler
 */

import Dexie, { type Table } from 'dexie';

// ============================================================================
// Types
// ============================================================================

/**
 * Image message content structure
 */
export interface ImageMessageContent {
  type: 'image';
  imageId: string;
  thumbnail: string; // base64 blurred thumbnail
  width: number;
  height: number;
  mimeType: string;
}

/**
 * Stored image record
 */
interface StoredImage {
  id: string;
  blob: Blob;
  thumbnail: string; // base64
  width: number;
  height: number;
  mimeType: string;
  createdAt: number;
}

/**
 * Image database schema
 */
interface ImageDB extends Dexie {
  images: Table<StoredImage>;
}

// ============================================================================
// Constants
// ============================================================================

const DB_NAME = 'bitchat-images';
const DB_VERSION = 1;
const DEFAULT_MAX_WIDTH = 1200;
const DEFAULT_MAX_HEIGHT = 1200;
const THUMBNAIL_SIZE = 100;
const THUMBNAIL_BLUR = 20;
const COMPRESSION_QUALITY = 0.8;

// ============================================================================
// Image Handler Service
// ============================================================================

/**
 * Image Handler Service class
 *
 * Handles image compression, thumbnail generation, and storage
 * for image messages in BitChat.
 *
 * @example
 * ```typescript
 * const imageHandler = ImageHandlerService.getInstance();
 * const compressed = await imageHandler.compressImage(file);
 * const thumbnail = await imageHandler.generateBlurredThumbnail(compressed);
 * await imageHandler.storeImage('img-123', compressed);
 * ```
 */
export class ImageHandlerService {
  private static instance: ImageHandlerService;
  private db: ImageDB;
  private isInitialized = false;

  private constructor() {
    this.db = this.createDatabase();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ImageHandlerService {
    if (!ImageHandlerService.instance) {
      ImageHandlerService.instance = new ImageHandlerService();
    }
    return ImageHandlerService.instance;
  }

  /**
   * Create and configure the Dexie database
   */
  private createDatabase(): ImageDB {
    const db = new Dexie(DB_NAME) as ImageDB;

    db.version(DB_VERSION).stores({
      images: 'id, createdAt',
    });

    return db;
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.db.open();
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize image database:', error);
      throw new Error(
        `Failed to initialize image database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Compress an image file for sending
   *
   * @param file - The image file to compress
   * @param maxWidth - Maximum width (default 1200px)
   * @param maxHeight - Maximum height (default 1200px)
   * @returns Compressed image blob with dimensions
   */
  async compressImage(
    file: File,
    maxWidth: number = DEFAULT_MAX_WIDTH,
    maxHeight: number = DEFAULT_MAX_HEIGHT
  ): Promise<{ blob: Blob; width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      img.onload = () => {
        try {
          // Calculate new dimensions maintaining aspect ratio
          let { width, height } = img;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }

          // Round to integers
          width = Math.round(width);
          height = Math.round(height);

          // Set canvas size
          canvas.width = width;
          canvas.height = height;

          // Draw image on canvas
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ blob, width, height });
              } else {
                reject(new Error('Failed to create image blob'));
              }
            },
            'image/jpeg',
            COMPRESSION_QUALITY
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // Load image from file
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Generate a blurred thumbnail from an image blob
   *
   * @param imageBlob - The image blob to create thumbnail from
   * @returns Base64 encoded blurred thumbnail
   */
  async generateBlurredThumbnail(imageBlob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      img.onload = () => {
        try {
          // Calculate thumbnail dimensions maintaining aspect ratio
          let width = THUMBNAIL_SIZE;
          let height = THUMBNAIL_SIZE;

          if (img.width > img.height) {
            height = (img.height * THUMBNAIL_SIZE) / img.width;
          } else {
            width = (img.width * THUMBNAIL_SIZE) / img.height;
          }

          // Round to integers
          width = Math.round(width);
          height = Math.round(height);

          // Set canvas size
          canvas.width = width;
          canvas.height = height;

          // Apply blur effect using CSS filter
          ctx.filter = `blur(${THUMBNAIL_BLUR}px)`;

          // Draw scaled-down image (helps with blur performance)
          ctx.drawImage(img, 0, 0, width, height);

          // Get base64 data
          const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
          resolve(dataUrl);
        } catch (error) {
          reject(error);
        } finally {
          // Clean up object URL
          URL.revokeObjectURL(img.src);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image for thumbnail'));
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  /**
   * Store an image in IndexedDB
   *
   * @param id - Unique image identifier
   * @param blob - Image blob to store
   * @param thumbnail - Base64 blurred thumbnail
   * @param width - Image width
   * @param height - Image height
   * @param mimeType - Image MIME type
   */
  async storeImage(
    id: string,
    blob: Blob,
    thumbnail: string,
    width: number,
    height: number,
    mimeType: string = 'image/jpeg'
  ): Promise<void> {
    await this.ensureInitialized();

    const record: StoredImage = {
      id,
      blob,
      thumbnail,
      width,
      height,
      mimeType,
      createdAt: Date.now(),
    };

    await this.db.images.put(record);
  }

  /**
   * Get an image from storage
   *
   * @param id - Image identifier
   * @returns Image blob or null if not found
   */
  async getImage(id: string): Promise<Blob | null> {
    await this.ensureInitialized();

    const record = await this.db.images.get(id);
    return record?.blob ?? null;
  }

  /**
   * Get image metadata and thumbnail
   *
   * @param id - Image identifier
   * @returns Image record or null if not found
   */
  async getImageRecord(id: string): Promise<Omit<StoredImage, 'blob'> | null> {
    await this.ensureInitialized();

    const record = await this.db.images.get(id);
    if (!record) return null;

    // Return without the blob for metadata-only access
    const { blob: _, ...metadata } = record;
    return metadata;
  }

  /**
   * Delete an image from storage
   *
   * @param id - Image identifier
   */
  async deleteImage(id: string): Promise<void> {
    await this.ensureInitialized();
    await this.db.images.delete(id);
  }

  /**
   * Clear all stored images
   */
  async clearAllImages(): Promise<void> {
    await this.ensureInitialized();
    await this.db.images.clear();
  }

  /**
   * Get storage usage statistics
   *
   * @returns Number of stored images and approximate size
   */
  async getStorageStats(): Promise<{ count: number; approximateSize: number }> {
    await this.ensureInitialized();

    const allImages = await this.db.images.toArray();
    const count = allImages.length;
    const approximateSize = allImages.reduce(
      (total, img) => total + img.blob.size,
      0
    );

    return { count, approximateSize };
  }

  /**
   * Create an object URL for an image
   * Remember to revoke the URL when done using it
   *
   * @param id - Image identifier
   * @returns Object URL or null if image not found
   */
  async createImageUrl(id: string): Promise<string | null> {
    const blob = await this.getImage(id);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  }

  /**
   * Process an image file for sending
   * Compresses the image and generates a blurred thumbnail
   *
   * @param file - Image file to process
   * @returns Processed image data ready for storing and sending
   */
  async processImageForSending(file: File): Promise<{
    id: string;
    blob: Blob;
    thumbnail: string;
    width: number;
    height: number;
    mimeType: string;
  }> {
    // Generate unique ID
    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Compress the image
    const { blob, width, height } = await this.compressImage(file);

    // Generate blurred thumbnail
    const thumbnail = await this.generateBlurredThumbnail(blob);

    // Store the image
    const mimeType = 'image/jpeg';
    await this.storeImage(id, blob, thumbnail, width, height, mimeType);

    return {
      id,
      blob,
      thumbnail,
      width,
      height,
      mimeType,
    };
  }

  /**
   * Create an ImageMessageContent object from processed image data
   *
   * @param imageData - Processed image data
   * @returns ImageMessageContent ready for message creation
   */
  createImageMessageContent(imageData: {
    id: string;
    thumbnail: string;
    width: number;
    height: number;
    mimeType: string;
  }): ImageMessageContent {
    return {
      type: 'image',
      imageId: imageData.id,
      thumbnail: imageData.thumbnail,
      width: imageData.width,
      height: imageData.height,
      mimeType: imageData.mimeType,
    };
  }

  /**
   * Check if a MIME type is a supported image format
   *
   * @param mimeType - MIME type to check
   * @returns Whether the type is supported
   */
  static isSupportedImageType(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/heic',
      'image/heif',
    ];
    return supportedTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Get accept attribute for file input
   */
  static getAcceptTypes(): string {
    return 'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif';
  }

  /**
   * Format file size for display
   *
   * @param bytes - File size in bytes
   * @returns Human-readable size string
   */
  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// ============================================================================
// Export singleton instance getter
// ============================================================================

export const getImageHandler = (): ImageHandlerService => ImageHandlerService.getInstance();

export default ImageHandlerService;
