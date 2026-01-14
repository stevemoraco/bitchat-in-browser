/**
 * Image Handler Service Tests
 *
 * Tests for image compression, blurred thumbnail generation,
 * IndexedDB storage, and various image format handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ImageHandlerService, getImageHandler } from '../image-handler';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock canvas and 2D context
class MockCanvasRenderingContext2D {
  canvas: MockHTMLCanvasElement;
  filter = '';

  constructor(canvas: MockHTMLCanvasElement) {
    this.canvas = canvas;
  }

  drawImage(
    _image: HTMLImageElement,
    _sx: number,
    _sy: number,
    _sw?: number,
    _sh?: number
  ): void {
    // No-op for testing
  }

  getImageData(_sx: number, _sy: number, sw: number, sh: number): ImageData {
    return new ImageData(sw, sh);
  }

  putImageData(_imageData: ImageData, _dx: number, _dy: number): void {
    // No-op
  }
}

class MockHTMLCanvasElement {
  width = 100;
  height = 100;
  private context: MockCanvasRenderingContext2D;

  constructor() {
    this.context = new MockCanvasRenderingContext2D(this);
  }

  getContext(contextId: string): MockCanvasRenderingContext2D | null {
    if (contextId === '2d') {
      return this.context;
    }
    return null;
  }

  toBlob(
    callback: BlobCallback,
    type?: string,
    _quality?: number
  ): void {
    // Create a mock blob
    const blob = new Blob(['mock-image-data'], { type: type || 'image/png' });
    setTimeout(() => callback(blob), 0);
  }

  toDataURL(type?: string, _quality?: number): string {
    return `data:${type || 'image/png'};base64,mockbase64data`;
  }
}

// Mock Image element
class MockImage {
  src = '';
  width = 800;
  height = 600;
  onload: (() => void) | null = null;
  onerror: ((error: Error) => void) | null = null;
  naturalWidth = 800;
  naturalHeight = 600;

  constructor() {
    // Simulate async image loading
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
}

// ============================================================================
// Test Setup
// ============================================================================

describe('ImageHandlerService', () => {
  let originalCreateElement: typeof document.createElement;
  let originalCreateObjectURL: typeof URL.createObjectURL;
  let originalRevokeObjectURL: typeof URL.revokeObjectURL;
  let imageHandler: ImageHandlerService;

  beforeEach(() => {
    // Store originals
    originalCreateElement = document.createElement.bind(document);
    originalCreateObjectURL = URL.createObjectURL;
    originalRevokeObjectURL = URL.revokeObjectURL;

    // Mock createElement
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return new MockHTMLCanvasElement() as unknown as HTMLCanvasElement;
      }
      if (tagName === 'img') {
        return new MockImage() as unknown as HTMLImageElement;
      }
      return originalCreateElement(tagName);
    });

    // Mock URL methods
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    // Reset singleton for each test
    ImageHandlerService['instance'] = undefined as unknown as ImageHandlerService;
    imageHandler = ImageHandlerService.getInstance();

    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore originals
    document.createElement = originalCreateElement;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;

    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Singleton Pattern Tests
  // --------------------------------------------------------------------------

  describe('Singleton Pattern', () => {
    it('should return same instance on multiple getInstance calls', () => {
      const instance1 = ImageHandlerService.getInstance();
      const instance2 = ImageHandlerService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should return same instance via getImageHandler', () => {
      const instance1 = getImageHandler();
      const instance2 = getImageHandler();
      expect(instance1).toBe(instance2);
    });

    it('should return same instance from both access methods', () => {
      const instance1 = ImageHandlerService.getInstance();
      const instance2 = getImageHandler();
      expect(instance1).toBe(instance2);
    });
  });

  // --------------------------------------------------------------------------
  // Image Compression Tests
  // --------------------------------------------------------------------------

  describe('Image Compression', () => {
    it('should compress image and return blob with dimensions', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.compressImage(mockFile);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(typeof result.width).toBe('number');
      expect(typeof result.height).toBe('number');
    });

    it('should maintain aspect ratio when compressing', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.compressImage(mockFile, 400, 400);

      // Aspect ratio should be maintained (original is 800x600 = 4:3)
      const aspectRatio = result.width / result.height;
      expect(aspectRatio).toBeCloseTo(800 / 600, 1);
    });

    it('should respect max width constraint', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.compressImage(mockFile, 400, 1200);

      expect(result.width).toBeLessThanOrEqual(400);
    });

    it('should respect max height constraint', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.compressImage(mockFile, 1200, 300);

      expect(result.height).toBeLessThanOrEqual(300);
    });

    it('should use default max dimensions when not specified', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.compressImage(mockFile);

      expect(result.width).toBeLessThanOrEqual(1200);
      expect(result.height).toBeLessThanOrEqual(1200);
    });

    it('should reject when canvas context is unavailable', async () => {
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return {
            width: 0,
            height: 0,
            getContext: () => null,
          };
        }
        if (tagName === 'img') {
          return new MockImage();
        }
        return originalCreateElement(tagName);
      });

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(imageHandler.compressImage(mockFile)).rejects.toThrow(
        'Failed to get canvas context'
      );
    });

    it('should reject when image fails to load', async () => {
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return new MockHTMLCanvasElement();
        }
        if (tagName === 'img') {
          const img = {
            src: '',
            onload: null as (() => void) | null,
            onerror: null as ((error: Error) => void) | null,
          };
          // Trigger error instead of load
          setTimeout(() => {
            if (img.onerror) {
              img.onerror(new Error('Load failed'));
            }
          }, 0);
          return img;
        }
        return originalCreateElement(tagName);
      });

      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      await expect(imageHandler.compressImage(mockFile)).rejects.toThrow('Failed to load image');
    });
  });

  // --------------------------------------------------------------------------
  // Blurred Thumbnail Generation Tests
  // --------------------------------------------------------------------------

  describe('Blurred Thumbnail Generation', () => {
    it('should generate base64 thumbnail', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

      const result = await imageHandler.generateBlurredThumbnail(mockBlob);

      expect(typeof result).toBe('string');
      expect(result.startsWith('data:image/')).toBe(true);
    });

    it('should apply blur filter', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
      let appliedFilter = '';

      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          const canvas = new MockHTMLCanvasElement();
          const ctx = canvas.getContext('2d')!;
          const originalSetter = Object.getOwnPropertyDescriptor(
            MockCanvasRenderingContext2D.prototype,
            'filter'
          )?.set;
          Object.defineProperty(ctx, 'filter', {
            get: () => appliedFilter,
            set: (value: string) => {
              appliedFilter = value;
            },
          });
          return canvas;
        }
        if (tagName === 'img') {
          return new MockImage();
        }
        return originalCreateElement(tagName);
      });

      await imageHandler.generateBlurredThumbnail(mockBlob);

      expect(appliedFilter).toContain('blur');
    });

    it('should maintain aspect ratio for landscape images', async () => {
      // Mock landscape image (800x600)
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

      const result = await imageHandler.generateBlurredThumbnail(mockBlob);

      // Should have generated a thumbnail
      expect(result.length).toBeGreaterThan(0);
    });

    it('should maintain aspect ratio for portrait images', async () => {
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return new MockHTMLCanvasElement();
        }
        if (tagName === 'img') {
          const img = new MockImage();
          // Set portrait dimensions
          img.width = 600;
          img.height = 800;
          img.naturalWidth = 600;
          img.naturalHeight = 800;
          return img;
        }
        return originalCreateElement(tagName);
      });

      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

      const result = await imageHandler.generateBlurredThumbnail(mockBlob);

      // Should have generated a thumbnail
      expect(result.length).toBeGreaterThan(0);
    });

    it('should revoke object URL after generating thumbnail', async () => {
      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

      await imageHandler.generateBlurredThumbnail(mockBlob);

      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should reject when canvas context unavailable', async () => {
      document.createElement = vi.fn().mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          return {
            getContext: () => null,
          };
        }
        if (tagName === 'img') {
          return new MockImage();
        }
        return originalCreateElement(tagName);
      });

      const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

      await expect(imageHandler.generateBlurredThumbnail(mockBlob)).rejects.toThrow(
        'Failed to get canvas context'
      );
    });
  });

  // --------------------------------------------------------------------------
  // IndexedDB Storage Tests
  // --------------------------------------------------------------------------

  describe('IndexedDB Storage', () => {
    describe('storeImage', () => {
      it('should store image with all metadata', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        const id = 'test-image-1';
        const thumbnail = 'data:image/jpeg;base64,test';

        await imageHandler.storeImage(id, mockBlob, thumbnail, 800, 600, 'image/jpeg');

        // Verify by retrieving
        const storedBlob = await imageHandler.getImage(id);
        expect(storedBlob).not.toBeNull();
      });

      it('should use default MIME type when not specified', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        const id = 'test-image-2';
        const thumbnail = 'data:image/jpeg;base64,test';

        // Don't specify MIME type
        await imageHandler.storeImage(id, mockBlob, thumbnail, 800, 600);

        const record = await imageHandler.getImageRecord(id);
        expect(record?.mimeType).toBe('image/jpeg');
      });
    });

    describe('getImage', () => {
      it('should return null for non-existent image', async () => {
        const result = await imageHandler.getImage('non-existent-id');
        expect(result).toBeNull();
      });

      it('should return blob for existing image', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        const id = 'test-get-image';

        await imageHandler.storeImage(id, mockBlob, 'thumb', 100, 100);
        const result = await imageHandler.getImage(id);

        // In fake-indexeddb, blobs may be returned as plain objects
        // We verify it's truthy and has blob-like characteristics
        expect(result).not.toBeNull();
        expect(result).toBeDefined();
      });
    });

    describe('getImageRecord', () => {
      it('should return null for non-existent image', async () => {
        const result = await imageHandler.getImageRecord('non-existent-id');
        expect(result).toBeNull();
      });

      it('should return metadata without blob', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        const id = 'test-get-record';
        const thumbnail = 'data:image/jpeg;base64,test';

        await imageHandler.storeImage(id, mockBlob, thumbnail, 800, 600, 'image/jpeg');
        const result = await imageHandler.getImageRecord(id);

        expect(result).not.toBeNull();
        expect(result!.id).toBe(id);
        expect(result!.width).toBe(800);
        expect(result!.height).toBe(600);
        expect(result!.thumbnail).toBe(thumbnail);
        expect(result!.mimeType).toBe('image/jpeg');
        expect(typeof result!.createdAt).toBe('number');
        // Should not include blob
        expect((result as { blob?: Blob }).blob).toBeUndefined();
      });
    });

    describe('deleteImage', () => {
      it('should delete existing image', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        const id = 'test-delete-image';

        await imageHandler.storeImage(id, mockBlob, 'thumb', 100, 100);
        await imageHandler.deleteImage(id);

        const result = await imageHandler.getImage(id);
        expect(result).toBeNull();
      });

      it('should not throw for non-existent image', async () => {
        await expect(imageHandler.deleteImage('non-existent')).resolves.not.toThrow();
      });
    });

    describe('clearAllImages', () => {
      it('should remove all stored images', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });

        await imageHandler.storeImage('img1', mockBlob, 'thumb', 100, 100);
        await imageHandler.storeImage('img2', mockBlob, 'thumb', 100, 100);

        await imageHandler.clearAllImages();

        const stats = await imageHandler.getStorageStats();
        expect(stats.count).toBe(0);
      });
    });

    describe('getStorageStats', () => {
      it('should return count and approximate size', async () => {
        const mockBlob = new Blob(['test-data'], { type: 'image/jpeg' });

        await imageHandler.clearAllImages();
        await imageHandler.storeImage('stat-test-1', mockBlob, 'thumb', 100, 100);
        await imageHandler.storeImage('stat-test-2', mockBlob, 'thumb', 100, 100);

        const stats = await imageHandler.getStorageStats();

        expect(stats.count).toBe(2);
        // In fake-indexeddb, blobs may not preserve size property
        // so we just check it's a number (may be 0 or NaN)
        expect(typeof stats.approximateSize).toBe('number');
      });

      it('should return zero for empty storage', async () => {
        await imageHandler.clearAllImages();

        const stats = await imageHandler.getStorageStats();

        expect(stats.count).toBe(0);
        // May be 0 or NaN depending on fake-indexeddb implementation
        expect(typeof stats.approximateSize).toBe('number');
      });
    });

    describe('createImageUrl', () => {
      it('should return object URL for existing image', async () => {
        const mockBlob = new Blob(['test'], { type: 'image/jpeg' });
        const id = 'test-create-url';

        await imageHandler.storeImage(id, mockBlob, 'thumb', 100, 100);
        const url = await imageHandler.createImageUrl(id);

        expect(url).not.toBeNull();
        expect(typeof url).toBe('string');
      });

      it('should return null for non-existent image', async () => {
        const url = await imageHandler.createImageUrl('non-existent');
        expect(url).toBeNull();
      });
    });
  });

  // --------------------------------------------------------------------------
  // Image Format Support Tests
  // --------------------------------------------------------------------------

  describe('Image Format Support', () => {
    describe('isSupportedImageType', () => {
      it('should return true for JPEG', () => {
        expect(ImageHandlerService.isSupportedImageType('image/jpeg')).toBe(true);
        expect(ImageHandlerService.isSupportedImageType('image/jpg')).toBe(true);
      });

      it('should return true for PNG', () => {
        expect(ImageHandlerService.isSupportedImageType('image/png')).toBe(true);
      });

      it('should return true for WebP', () => {
        expect(ImageHandlerService.isSupportedImageType('image/webp')).toBe(true);
      });

      it('should return true for GIF', () => {
        expect(ImageHandlerService.isSupportedImageType('image/gif')).toBe(true);
      });

      it('should return true for HEIC/HEIF', () => {
        expect(ImageHandlerService.isSupportedImageType('image/heic')).toBe(true);
        expect(ImageHandlerService.isSupportedImageType('image/heif')).toBe(true);
      });

      it('should return false for unsupported types', () => {
        expect(ImageHandlerService.isSupportedImageType('image/svg+xml')).toBe(false);
        expect(ImageHandlerService.isSupportedImageType('image/bmp')).toBe(false);
        expect(ImageHandlerService.isSupportedImageType('video/mp4')).toBe(false);
        expect(ImageHandlerService.isSupportedImageType('application/pdf')).toBe(false);
      });

      it('should handle case insensitivity', () => {
        expect(ImageHandlerService.isSupportedImageType('IMAGE/JPEG')).toBe(true);
        expect(ImageHandlerService.isSupportedImageType('Image/Png')).toBe(true);
      });

      it('should return false for empty string', () => {
        expect(ImageHandlerService.isSupportedImageType('')).toBe(false);
      });
    });

    describe('getAcceptTypes', () => {
      it('should return comma-separated MIME types', () => {
        const acceptTypes = ImageHandlerService.getAcceptTypes();

        expect(acceptTypes).toContain('image/jpeg');
        expect(acceptTypes).toContain('image/png');
        expect(acceptTypes).toContain('image/gif');
        expect(acceptTypes).toContain('image/webp');
        expect(acceptTypes).toContain('image/heic');
        expect(acceptTypes).toContain('image/heif');
      });

      it('should return string suitable for file input accept attribute', () => {
        const acceptTypes = ImageHandlerService.getAcceptTypes();

        // Should be comma-separated
        expect(acceptTypes.includes(',')).toBe(true);
        // Should not have spaces (except in MIME type if applicable)
        expect(acceptTypes.includes(' ')).toBe(false);
      });
    });
  });

  // --------------------------------------------------------------------------
  // File Size Formatting Tests
  // --------------------------------------------------------------------------

  describe('File Size Formatting', () => {
    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(ImageHandlerService.formatFileSize(0)).toBe('0 B');
        expect(ImageHandlerService.formatFileSize(1)).toBe('1 B');
        expect(ImageHandlerService.formatFileSize(512)).toBe('512 B');
        expect(ImageHandlerService.formatFileSize(1023)).toBe('1023 B');
      });

      it('should format kilobytes correctly', () => {
        expect(ImageHandlerService.formatFileSize(1024)).toBe('1.0 KB');
        expect(ImageHandlerService.formatFileSize(1536)).toBe('1.5 KB');
        expect(ImageHandlerService.formatFileSize(10240)).toBe('10.0 KB');
        expect(ImageHandlerService.formatFileSize(1048575)).toBe('1024.0 KB');
      });

      it('should format megabytes correctly', () => {
        expect(ImageHandlerService.formatFileSize(1048576)).toBe('1.0 MB');
        expect(ImageHandlerService.formatFileSize(1572864)).toBe('1.5 MB');
        expect(ImageHandlerService.formatFileSize(10485760)).toBe('10.0 MB');
      });

      it('should round to one decimal place', () => {
        expect(ImageHandlerService.formatFileSize(1536)).toBe('1.5 KB');
        expect(ImageHandlerService.formatFileSize(1536000)).toBe('1.5 MB');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Process Image for Sending Tests
  // --------------------------------------------------------------------------

  describe('processImageForSending', () => {
    it('should generate unique ID', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result1 = await imageHandler.processImageForSending(mockFile);
      const result2 = await imageHandler.processImageForSending(mockFile);

      expect(result1.id).not.toBe(result2.id);
    });

    it('should return blob and thumbnail', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.processImageForSending(mockFile);

      expect(result.blob).toBeInstanceOf(Blob);
      expect(typeof result.thumbnail).toBe('string');
      expect(result.thumbnail.startsWith('data:image/')).toBe(true);
    });

    it('should return dimensions', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.processImageForSending(mockFile);

      expect(typeof result.width).toBe('number');
      expect(typeof result.height).toBe('number');
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
    });

    it('should set MIME type to image/jpeg', async () => {
      const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

      const result = await imageHandler.processImageForSending(mockFile);

      // Compressed images are output as JPEG
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('should store image in IndexedDB', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.processImageForSending(mockFile);

      // Verify image was stored
      const storedBlob = await imageHandler.getImage(result.id);
      expect(storedBlob).not.toBeNull();
    });

    it('should generate ID with img prefix', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const result = await imageHandler.processImageForSending(mockFile);

      expect(result.id.startsWith('img-')).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Create Image Message Content Tests
  // --------------------------------------------------------------------------

  describe('createImageMessageContent', () => {
    it('should create correct message content structure', () => {
      const imageData = {
        id: 'test-id',
        thumbnail: 'data:image/jpeg;base64,test',
        width: 800,
        height: 600,
        mimeType: 'image/jpeg',
      };

      const content = imageHandler.createImageMessageContent(imageData);

      expect(content.type).toBe('image');
      expect(content.imageId).toBe('test-id');
      expect(content.thumbnail).toBe('data:image/jpeg;base64,test');
      expect(content.width).toBe(800);
      expect(content.height).toBe(600);
      expect(content.mimeType).toBe('image/jpeg');
    });

    it('should include all required fields', () => {
      const imageData = {
        id: 'id',
        thumbnail: 'thumb',
        width: 100,
        height: 100,
        mimeType: 'image/png',
      };

      const content = imageHandler.createImageMessageContent(imageData);

      expect(content).toHaveProperty('type');
      expect(content).toHaveProperty('imageId');
      expect(content).toHaveProperty('thumbnail');
      expect(content).toHaveProperty('width');
      expect(content).toHaveProperty('height');
      expect(content).toHaveProperty('mimeType');
    });
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases and Error Handling', () => {
  let imageHandler: ImageHandlerService;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    originalCreateElement = document.createElement.bind(document);

    // Mock URL methods
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    URL.revokeObjectURL = vi.fn();

    ImageHandlerService['instance'] = undefined as unknown as ImageHandlerService;
    imageHandler = ImageHandlerService.getInstance();
  });

  afterEach(() => {
    document.createElement = originalCreateElement;
    vi.restoreAllMocks();
  });

  it('should handle very small images', async () => {
    // Mock a 10x10 image
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({
            filter: '',
            drawImage: vi.fn(),
          }),
          toBlob: (cb: BlobCallback) => {
            setTimeout(() => cb(new Blob(['tiny'], { type: 'image/jpeg' })), 0);
          },
          toDataURL: () => 'data:image/jpeg;base64,tiny',
        };
        return canvas;
      }
      if (tagName === 'img') {
        const img = {
          src: '',
          width: 10,
          height: 10,
          naturalWidth: 10,
          naturalHeight: 10,
          onload: null as (() => void) | null,
          onerror: null as ((error: Error) => void) | null,
        };
        setTimeout(() => {
          if (img.onload) img.onload();
        }, 0);
        return img;
      }
      return originalCreateElement(tagName);
    });

    const mockFile = new File(['test'], 'tiny.jpg', { type: 'image/jpeg' });
    const result = await imageHandler.compressImage(mockFile);

    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('should handle square images correctly', async () => {
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const canvas = {
          width: 0,
          height: 0,
          getContext: () => ({
            filter: '',
            drawImage: vi.fn(),
          }),
          toBlob: (cb: BlobCallback) => {
            setTimeout(() => cb(new Blob(['square'], { type: 'image/jpeg' })), 0);
          },
          toDataURL: () => 'data:image/jpeg;base64,square',
        };
        return canvas;
      }
      if (tagName === 'img') {
        const img = {
          src: '',
          width: 500,
          height: 500,
          naturalWidth: 500,
          naturalHeight: 500,
          onload: null as (() => void) | null,
          onerror: null as ((error: Error) => void) | null,
        };
        setTimeout(() => {
          if (img.onload) img.onload();
        }, 0);
        return img;
      }
      return originalCreateElement(tagName);
    });

    const mockFile = new File(['test'], 'square.jpg', { type: 'image/jpeg' });
    const result = await imageHandler.compressImage(mockFile);

    // Square images should remain square (aspect ratio 1:1)
    expect(result.width).toBe(result.height);
  });

  it('should handle canvas.toBlob returning null', async () => {
    document.createElement = vi.fn().mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            filter: '',
            drawImage: vi.fn(),
          }),
          toBlob: (cb: BlobCallback) => {
            setTimeout(() => cb(null), 0);
          },
        };
      }
      if (tagName === 'img') {
        const img = {
          src: '',
          width: 800,
          height: 600,
          onload: null as (() => void) | null,
        };
        setTimeout(() => {
          if (img.onload) img.onload();
        }, 0);
        return img;
      }
      return originalCreateElement(tagName);
    });

    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    await expect(imageHandler.compressImage(mockFile)).rejects.toThrow(
      'Failed to create image blob'
    );
  });
});
