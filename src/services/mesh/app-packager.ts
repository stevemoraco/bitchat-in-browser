/**
 * App Bundle Packager
 *
 * Collects PWA assets from Service Worker cache and packages them
 * for transfer over WebRTC mesh network.
 */

import type { AppBundle, AppAsset, AppBundleMetadata } from '../storage/app-bundle-store';

// App version (replaced at build time)
const APP_VERSION = '__APP_VERSION__';

export interface PackagingProgress {
  phase: 'collecting' | 'packaging' | 'compressing' | 'complete';
  current: number;
  total: number;
  currentFile?: string;
}

export interface TransferChunk {
  index: number;
  total: number;
  bundleHash: string;
  path: string;
  mimeType: string;
  data: string; // base64 encoded
  size: number;
}

type ProgressHandler = (progress: PackagingProgress) => void;

// Cache names used by the app
const CACHE_NAMES = [
  'workbox-precache-v2',
  'bitchat-static-v2',
  'bitchat-dynamic-v2',
];

// Essential files for the app to work
const ESSENTIAL_PATHS = ['/', '/index.html', '/manifest.json'];

// Max chunk size for WebRTC transfer (16KB is safe for data channels)
const MAX_CHUNK_SIZE = 16 * 1024;

export class AppPackager {
  private static instance: AppPackager | null = null;
  private progressHandlers: Set<ProgressHandler> = new Set();

  private constructor() {}

  static getInstance(): AppPackager {
    if (!AppPackager.instance) {
      AppPackager.instance = new AppPackager();
    }
    return AppPackager.instance;
  }

  /**
   * Package all cached assets into a transferable bundle
   */
  async packageApp(): Promise<AppBundle> {
    this.notifyProgress({ phase: 'collecting', current: 0, total: 0 });

    // Collect all cached assets
    const assets = await this.collectCachedAssets();

    this.notifyProgress({ phase: 'packaging', current: 0, total: assets.length });

    // Calculate total size and hash
    let totalSize = 0;
    const hashParts: string[] = [];

    for (let i = 0; i < assets.length; i++) {
      totalSize += assets[i].size;
      hashParts.push(`${assets[i].path}:${assets[i].size}`);
      this.notifyProgress({
        phase: 'packaging',
        current: i + 1,
        total: assets.length,
        currentFile: assets[i].path,
      });
    }

    // Generate bundle hash
    const hashInput = `${hashParts.sort().join('|')  }|${APP_VERSION}`;
    const hash = await this.generateHash(hashInput);

    const metadata: AppBundleMetadata = {
      version: APP_VERSION,
      hash,
      timestamp: Date.now(),
      totalSize,
      assetCount: assets.length,
    };

    this.notifyProgress({ phase: 'complete', current: assets.length, total: assets.length });

    console.log(`[AppPackager] Packaged ${assets.length} assets (${this.formatBytes(totalSize)})`);

    return { metadata, assets };
  }

  /**
   * Convert bundle to transfer chunks for WebRTC
   */
  async bundleToChunks(bundle: AppBundle): Promise<TransferChunk[]> {
    const chunks: TransferChunk[] = [];
    let chunkIndex = 0;

    for (const asset of bundle.assets) {
      // Convert Uint8Array to base64
      const base64 = this.uint8ArrayToBase64(asset.content);

      // Split into chunks if necessary
      if (base64.length <= MAX_CHUNK_SIZE) {
        chunks.push({
          index: chunkIndex++,
          total: 0, // Will be updated after
          bundleHash: bundle.metadata.hash,
          path: asset.path,
          mimeType: asset.mimeType,
          data: base64,
          size: asset.size,
        });
      } else {
        // Split large files into multiple chunks
        for (let i = 0; i < base64.length; i += MAX_CHUNK_SIZE) {
          const chunkData = base64.slice(i, i + MAX_CHUNK_SIZE);
          const isLast = i + MAX_CHUNK_SIZE >= base64.length;

          chunks.push({
            index: chunkIndex++,
            total: 0,
            bundleHash: bundle.metadata.hash,
            path: isLast ? asset.path : `${asset.path}#part${Math.floor(i / MAX_CHUNK_SIZE)}`,
            mimeType: isLast ? asset.mimeType : 'application/octet-stream+partial',
            data: chunkData,
            size: isLast ? asset.size : 0,
          });
        }
      }
    }

    // Update total count
    const total = chunks.length;
    chunks.forEach((c) => (c.total = total));

    console.log(`[AppPackager] Created ${chunks.length} transfer chunks`);

    return chunks;
  }

  /**
   * Reconstruct bundle from received chunks
   */
  chunksToBundle(chunks: TransferChunk[], metadata: AppBundleMetadata): AppBundle {
    const assetMap = new Map<string, { mimeType: string; parts: string[]; size: number }>();

    // Sort chunks by index
    chunks.sort((a, b) => a.index - b.index);

    // Group chunks by asset path
    for (const chunk of chunks) {
      // Check if this is a partial chunk
      const partMatch = chunk.path.match(/^(.+)#part(\d+)$/);
      const basePath = partMatch ? partMatch[1] : chunk.path;
      const partIndex = partMatch ? parseInt(partMatch[2]) : 0;

      if (!assetMap.has(basePath)) {
        assetMap.set(basePath, { mimeType: '', parts: [], size: 0 });
      }

      const asset = assetMap.get(basePath)!;
      asset.parts[partIndex] = chunk.data;

      // Update mimeType and size from the final chunk
      if (!partMatch || chunk.mimeType !== 'application/octet-stream+partial') {
        asset.mimeType = chunk.mimeType;
        asset.size = chunk.size;
      }
    }

    // Reconstruct assets
    const assets: AppAsset[] = [];

    for (const [path, { mimeType, parts, size }] of assetMap) {
      const base64 = parts.join('');
      const content = this.base64ToUint8Array(base64);

      assets.push({
        path,
        content,
        mimeType,
        size: size || content.length,
      });
    }

    console.log(`[AppPackager] Reconstructed ${assets.length} assets from chunks`);

    return { metadata, assets };
  }

  /**
   * Get current app version info
   */
  async getVersionInfo(): Promise<{ version: string; hash: string; timestamp: number }> {
    const bundle = await this.packageApp();
    return {
      version: bundle.metadata.version,
      hash: bundle.metadata.hash,
      timestamp: bundle.metadata.timestamp,
    };
  }

  /**
   * Register progress handler
   */
  onProgress(handler: ProgressHandler): () => void {
    this.progressHandlers.add(handler);
    return () => this.progressHandlers.delete(handler);
  }

  // === Private Helpers ===

  private async collectCachedAssets(): Promise<AppAsset[]> {
    const assets: AppAsset[] = [];
    const seenPaths = new Set<string>();

    // Try each cache name
    for (const cacheName of CACHE_NAMES) {
      try {
        const cacheNames = await caches.keys();
        const matchingCaches = cacheNames.filter((name) =>
          name.includes(cacheName.replace('-v2', ''))
        );

        for (const name of matchingCaches) {
          const cache = await caches.open(name);
          const requests = await cache.keys();

          for (const request of requests) {
            const url = new URL(request.url);
            const path = url.pathname;

            // Skip if already collected
            if (seenPaths.has(path)) continue;
            seenPaths.add(path);

            // Get the cached response
            const response = await cache.match(request);
            if (!response) continue;

            // Read content
            const buffer = await response.arrayBuffer();
            const content = new Uint8Array(buffer);

            // Determine MIME type
            const mimeType = response.headers.get('content-type') || this.guessMimeType(path);

            assets.push({
              path,
              content,
              mimeType,
              size: content.length,
            });
          }
        }
      } catch (error) {
        console.warn(`[AppPackager] Failed to read cache ${cacheName}:`, error);
      }
    }

    // Ensure essential files are present
    for (const essentialPath of ESSENTIAL_PATHS) {
      if (!seenPaths.has(essentialPath)) {
        console.warn(`[AppPackager] Missing essential file: ${essentialPath}`);
      }
    }

    console.log(`[AppPackager] Collected ${assets.length} cached assets`);

    return assets;
  }

  private async generateHash(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  }

  private guessMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const types: Record<string, string> = {
      html: 'text/html',
      js: 'application/javascript',
      mjs: 'application/javascript',
      css: 'text/css',
      json: 'application/json',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
      woff: 'font/woff',
      woff2: 'font/woff2',
      ttf: 'font/ttf',
      webp: 'image/webp',
    };
    return types[ext || ''] || 'application/octet-stream';
  }

  private uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))  } ${  sizes[i]}`;
  }

  private notifyProgress(progress: PackagingProgress): void {
    this.progressHandlers.forEach((h) => h(progress));
  }
}

// Export singleton
export const appPackager = AppPackager.getInstance();
export default appPackager;
