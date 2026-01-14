import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read package.json for version info
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
const buildTime = new Date().toISOString();

export default defineConfig({
  // Use relative paths for IPFS deployment
  base: './',

  plugins: [
    preact(),
    VitePWA({
      // Auto-update on new version detection
      registerType: 'autoUpdate',

      // Include all assets in precache
      includeAssets: [
        'favicon.ico',
        'robots.txt',
        'icons/*.png',
        'icons/*.svg',
        'splash/*.png',
        'offline.html',
      ],

      // Use the custom service worker with injectManifest strategy
      strategies: 'injectManifest',
      srcDir: 'src/workers',
      filename: 'sw.ts',

      // Inject manifest into service worker
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        // Inject version info into service worker
        injectionPoint: undefined,
      },

      // PWA Manifest
      manifest: {
        name: 'BitChat In Browser',
        short_name: 'BitChat',
        description: 'Encrypted mesh-style messaging via Nostr protocol',
        theme_color: '#0a0a0a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['communication', 'social'],
        lang: 'en',

        // Icons
        icons: [
          {
            src: 'icons/icon-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: 'icons/icon-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: 'icons/icon-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: 'icons/icon-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: 'icons/icon-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: 'icons/icon-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: 'icons/icon-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'maskable any',
          },
          {
            src: 'icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any',
          },
        ],

        // Shortcuts for quick actions
        shortcuts: [
          {
            name: 'New Message',
            short_name: 'Message',
            description: 'Send a new message',
            url: './?action=new-message',
            icons: [{ src: 'icons/shortcut-message.png', sizes: '96x96' }],
          },
          {
            name: 'Nearby Chat',
            short_name: 'Nearby',
            description: 'Join location-based chat',
            url: './?action=nearby',
            icons: [{ src: 'icons/shortcut-nearby.png', sizes: '96x96' }],
          },
        ],

        // Screenshots for app store
        screenshots: [
          {
            src: 'screenshots/chat-dark.png',
            sizes: '1080x1920',
            type: 'image/png',
            label: 'Chat screen in dark mode',
          },
          {
            src: 'screenshots/channels.png',
            sizes: '1080x1920',
            type: 'image/png',
            label: 'Location channels view',
          },
        ],

        // Related native apps
        related_applications: [
          {
            platform: 'itunes',
            url: 'https://apps.apple.com/app/bitchat-mesh/id6748219622',
            id: 'id6748219622',
          },
          {
            platform: 'play',
            url: 'https://play.google.com/store/apps/details?id=com.bitchat.droid',
            id: 'com.bitchat.droid',
          },
        ],
        prefer_related_applications: false,

        // Protocol handlers
        protocol_handlers: [
          {
            protocol: 'web+nostr',
            url: './?nostr=%s',
          },
        ],

        // Share target
        share_target: {
          action: './share',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'files',
                accept: ['image/*', 'text/*'],
              },
            ],
          },
        },
      },

      // Development options
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },

      // Workbox options (used as fallback when injectManifest is active)
      workbox: {
        // Don't precache source maps
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // Navigation fallback
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/offline\.html$/],

        // Runtime caching strategies
        runtimeCaching: [
          // Images - StaleWhileRevalidate
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'bitchat-images',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
            },
          },
          // Fonts - CacheFirst
          {
            urlPattern: /\.(?:woff|woff2|ttf|otf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bitchat-fonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
            },
          },
          // API/Relay calls - NetworkFirst with 5s timeout
          {
            urlPattern: /^https:\/\/.*\.(nostr|relay)\..*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bitchat-relay-cache',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
            },
          },
        ],

        // Skip waiting behavior
        skipWaiting: true,
        clientsClaim: true,

        // Clean old caches
        cleanupOutdatedCaches: true,
      },
    }),
  ],

  build: {
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: true, // Enable for debugging
    outDir: 'dist',

    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-preact': ['preact'],
          'vendor-crypto': ['libsodium-wrappers-sumo'],
          'vendor-nostr': ['nostr-tools'],
          'vendor-storage': ['dexie', 'zustand'],
        },
      },
    },

    // Keep bundle size under 500KB
    chunkSizeWarningLimit: 500,

    // Inline assets under 4KB
    assetsInlineLimit: 4096,

    // CSS code splitting
    cssCodeSplit: true,
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'preact',
      'preact/hooks',
      'preact/compat',
      'zustand',
      'nostr-tools',
      'dexie',
    ],
    esbuildOptions: {
      // Support top-level await in libsodium ESM
      target: 'esnext',
    },
  },

  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      '@': '/src',
      '@components': '/src/components',
      '@services': '/src/services',
      '@stores': '/src/stores',
      '@hooks': '/src/hooks',
      '@utils': '/src/utils',
      '@types': '/src/types',
      '@workers': '/src/workers',
    },
  },

  // Development server
  server: {
    port: 3000,
    host: true, // Allow external connections for P2P sharing testing
    strictPort: false,

    // Headers for OPFS and SharedArrayBuffer support
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // Preview server (for testing production build)
  preview: {
    port: 4173,
    host: true,

    // Same headers for production preview
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  // CSS options
  css: {
    postcss: './postcss.config.js',
  },

  // Define global constants for version info
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
});
