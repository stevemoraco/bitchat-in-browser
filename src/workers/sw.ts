/**
 * BitChat In Browser - Service Worker
 *
 * Provides offline-first caching strategies for the PWA.
 * Uses Workbox for cache management with the following strategies:
 * - App shell (HTML, JS, CSS): CacheFirst
 * - API/relay calls: NetworkFirst with 5s timeout
 * - Images: StaleWhileRevalidate
 * - Fonts: CacheFirst (fonts never change)
 *
 * Also handles:
 * - Push notifications with channel-specific routing
 * - Badge API for unread count display
 * - Background sync for offline messages
 * - Version management for IPFS hosting
 * - Cache versioning and cleanup
 * - Update notifications to clients
 */

/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute, Route, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare let self: ServiceWorkerGlobalScope;

// ============================================================================
// IndexedDB Configuration for P2P Received Bundles
// ============================================================================

const BUNDLE_DB_NAME = 'bitchat-app-bundle';
const BUNDLE_DB_VERSION = 1;
const ASSETS_STORE = 'assets';

interface StoredAsset {
  path: string;
  content: Uint8Array;
  mimeType: string;
  size: number;
}

/**
 * Open the bundle IndexedDB
 */
async function openBundleDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(BUNDLE_DB_NAME, BUNDLE_DB_VERSION);

      request.onerror = () => {
        console.warn('[SW] Could not open bundle DB');
        resolve(null);
      };

      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(ASSETS_STORE)) {
          db.createObjectStore(ASSETS_STORE, { keyPath: 'path' });
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Get asset from IndexedDB
 */
async function getAssetFromDB(path: string): Promise<StoredAsset | null> {
  const db = await openBundleDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(ASSETS_STORE, 'readonly');
      const store = tx.objectStore(ASSETS_STORE);
      const request = store.get(path);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Create Response from stored asset
 */
function assetToResponse(asset: StoredAsset): Response {
  // Create a new ArrayBuffer copy to ensure it's a proper ArrayBuffer (not SharedArrayBuffer)
  const buffer = new ArrayBuffer(asset.content.byteLength);
  new Uint8Array(buffer).set(asset.content);
  return new Response(buffer, {
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Type': asset.mimeType,
      'Content-Length': asset.size.toString(),
      'X-Served-From': 'indexeddb-bundle',
    },
  });
}

// ============================================================================
// Version Information
// ============================================================================

/**
 * Service Worker Version
 * This should be updated with each deployment.
 * For IPFS hosting, each deployment gets a new CID automatically.
 */
const SW_VERSION = '__SW_VERSION__'; // Will be replaced at build time
const SW_BUILD_TIME = '__SW_BUILD_TIME__'; // Will be replaced at build time

/**
 * Log version info on load
 */
console.log(`[SW] BitChat Service Worker v${SW_VERSION}`);
console.log(`[SW] Build time: ${SW_BUILD_TIME}`);

// Precache manifest will be injected by vite-plugin-pwa during build
// @ts-ignore - __WB_MANIFEST is injected by workbox at build time
precacheAndRoute(self.__WB_MANIFEST);

// Clean up old caches from previous versions
cleanupOutdatedCaches();

// ============================================================================
// Cache Configuration
// ============================================================================

// Cache names with version for easy cleanup
const CACHE_PREFIX = 'bitchat';
const CACHE_VERSION = 'v2'; // Increment when cache schema changes
const STATIC_CACHE = `${CACHE_PREFIX}-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `${CACHE_PREFIX}-images-${CACHE_VERSION}`;
const FONT_CACHE = `${CACHE_PREFIX}-fonts-${CACHE_VERSION}`;

/**
 * List of all cache names used by this SW version
 */
const CURRENT_CACHES = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE, FONT_CACHE];

// ============================================================================
// Lifecycle Events
// ============================================================================

/**
 * Install event
 * - Pre-cache critical assets
 * - Skip waiting if instructed by client
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version...');

  event.waitUntil(
    (async () => {
      // Pre-cache the offline page
      const cache = await caches.open(STATIC_CACHE);
      await cache.add(new Request('/offline.html', { cache: 'reload' }));

      // Pre-cache version.json for update checking
      try {
        await cache.add(new Request('./version.json', { cache: 'reload' }));
      } catch (e) {
        console.warn('[SW] Could not cache version.json:', e);
      }

      console.log('[SW] Installation complete');
    })()
  );
});

/**
 * Activate event
 * - Clean up old caches
 * - Claim clients
 * - Notify clients of update
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new version...');

  event.waitUntil(
    (async () => {
      // Clean up old caches
      await cleanupOldCaches();

      // Claim all clients
      await self.clients.claim();

      // Notify all clients that an update was applied
      await notifyClientsOfUpdate();

      console.log('[SW] Activation complete');
    })()
  );
});

/**
 * Clean up caches from previous versions
 */
async function cleanupOldCaches(): Promise<void> {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter((name) => {
    // Keep current caches
    if (CURRENT_CACHES.includes(name)) {
      return false;
    }
    // Delete old bitchat caches
    if (name.startsWith(CACHE_PREFIX)) {
      return true;
    }
    // Keep workbox precache (managed by workbox)
    if (name.startsWith('workbox-')) {
      return false;
    }
    return false;
  });

  console.log('[SW] Cleaning up old caches:', oldCaches);

  await Promise.all(
    oldCaches.map((cacheName) => {
      console.log(`[SW] Deleting cache: ${cacheName}`);
      return caches.delete(cacheName);
    })
  );
}

/**
 * Notify all clients that an update was applied
 */
async function notifyClientsOfUpdate(): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' });

  for (const client of clients) {
    client.postMessage({
      type: 'SW_UPDATED',
      version: SW_VERSION,
      buildTime: SW_BUILD_TIME,
    });
  }
}

/**
 * Navigation Route
 * Serve the app shell for all navigation requests
 * Checks IndexedDB first for P2P received bundles, then falls back to Workbox cache
 */
async function handleNavigation(options: {
  event: ExtendableEvent;
  request: Request;
  url: URL;
  params?: string[] | Record<string, unknown>;
}): Promise<Response> {
  const { request, url } = options;

  // Try IndexedDB first (P2P received bundle)
  const indexPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const dbAsset = await getAssetFromDB(indexPath);
  if (dbAsset) {
    console.log('[SW] Serving navigation from IndexedDB:', indexPath);
    return assetToResponse(dbAsset);
  }

  // Fall back to the default Workbox handler
  const defaultHandler = createHandlerBoundToURL('/index.html');
  return defaultHandler(options);
}

// Replace the simple NavigationRoute with our custom one
const navigationRoute = new NavigationRoute(handleNavigation, {
  denylist: [
    // Exclude certain paths from app shell
    /^\/api\//,
    /^\/offline\.html$/,
  ],
});
registerRoute(navigationRoute);

/**
 * App Shell (CSS, JS) - Check IndexedDB first, then CacheFirst
 * Checks IndexedDB for P2P received bundles before falling back to Workbox cache
 */
const appShellRoute = new Route(
  ({ request, url }) => {
    // Match JS and CSS files from same origin
    if (url.origin !== self.location.origin) return false;
    return (
      request.destination === 'script' ||
      request.destination === 'style' ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css')
    );
  },
  async (options: {
    event: ExtendableEvent;
    request: Request;
    url: URL;
    params?: string[] | Record<string, unknown>;
  }): Promise<Response> => {
    const { request, url, event } = options;

    // Try IndexedDB first (P2P received bundle)
    const dbAsset = await getAssetFromDB(url.pathname);
    if (dbAsset) {
      console.log('[SW] Serving asset from IndexedDB:', url.pathname);
      return assetToResponse(dbAsset);
    }

    // Fall back to CacheFirst strategy
    const cacheFirst = new CacheFirst({
      cacheName: STATIC_CACHE,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          purgeOnQuotaError: true,
        }),
      ],
    });

    return cacheFirst.handle({ request, event });
  }
);
registerRoute(appShellRoute);

/**
 * API and Relay Calls - NetworkFirst with 5s timeout
 * Try network first for fresh data, fall back to cache
 */
const apiRoute = new Route(
  ({ url }) => 
    // Match Nostr relay WebSocket upgrades (handled separately)
    // Match any API endpoints
     (
      url.pathname.startsWith('/api/') ||
      // Common Nostr relay patterns
      url.protocol === 'wss:' ||
      url.pathname.includes('/relay') ||
      // External API calls
      url.origin !== self.location.origin
    )
  ,
  new NetworkFirst({
    cacheName: DYNAMIC_CACHE,
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
        purgeOnQuotaError: true,
      }),
    ],
  })
);
registerRoute(apiRoute);

/**
 * Images - StaleWhileRevalidate
 * Serve from cache while updating in background
 */
const imageRoute = new Route(
  ({ request }) => request.destination === 'image',
  new StaleWhileRevalidate({
    cacheName: IMAGE_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  })
);
registerRoute(imageRoute);

/**
 * Fonts - CacheFirst
 * Fonts never change, cache first for instant loading
 */
const fontRoute = new Route(
  ({ request, url }) => (
      request.destination === 'font' ||
      url.pathname.endsWith('.woff') ||
      url.pathname.endsWith('.woff2') ||
      url.pathname.endsWith('.ttf') ||
      url.pathname.endsWith('.otf')
    ),
  new CacheFirst({
    cacheName: FONT_CACHE,
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        purgeOnQuotaError: true,
      }),
    ],
  })
);
registerRoute(fontRoute);

/**
 * Offline Fallback
 * Catch handler for when all routes fail (network and cache both miss)
 * This works with the NavigationRoute above which uses CacheFirst via createHandlerBoundToURL
 */
setCatchHandler(async ({ request }) => {
  // For navigation requests, serve cached index.html or offline page
  if (request.destination === 'document' || request.mode === 'navigate') {
    const cachedIndex = await caches.match('/index.html');
    if (cachedIndex) return cachedIndex;

    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;
  }

  // For other requests, return error
  return Response.error();
});

/**
 * Background Sync for Offline Queue
 * When back online, sync queued messages
 */
self.addEventListener('sync', (event: SyncEvent) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

/**
 * Sync queued messages with relays
 * This will be implemented to work with the OfflineQueue service
 */
async function syncMessages(): Promise<void> {
  // Send message to clients to trigger sync
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({
      type: 'SYNC_REQUESTED',
      tag: 'sync-messages',
    });
  }
}

// ============================================================================
// Push Notification Support
// ============================================================================

/**
 * Extended notification options for service worker (supports modern notification features)
 */
interface ExtendedNotificationOptions extends NotificationOptions {
  timestamp?: number;
  vibrate?: number[];
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  image?: string;
  renotify?: boolean;
}

/**
 * Notification data structure for type safety
 */
interface NotificationPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    type?: 'message' | 'connection' | 'sync' | 'system';
    channelId?: string;
    senderFingerprint?: string;
    url?: string;
    [key: string]: unknown;
  };
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
  timestamp?: number;
  renotify?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  image?: string;
}

/**
 * Handle incoming push notifications.
 * Parses push payload and shows notification with appropriate options.
 */
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW] Push event received without data');
    return;
  }

  let payload: NotificationPayload;
  try {
    payload = event.data.json();
  } catch (error) {
    // If not JSON, treat as plain text
    payload = {
      title: 'BitChat',
      body: event.data.text() || 'New notification',
    };
  }

  const title = payload.title || 'BitChat';

  // Use extended notification options type for modern browser features
  const options: ExtendedNotificationOptions = {
    body: payload.body || 'New message',
    icon: payload.icon || '/icons/icon-192x192.png',
    badge: payload.badge || '/icons/badge-72x72.png',
    tag: payload.tag || 'bitchat-notification',
    data: payload.data || {},
    requireInteraction: payload.requireInteraction ?? false,
    silent: payload.silent ?? false,
    timestamp: payload.timestamp || Date.now(),
    renotify: payload.renotify ?? false,
  };

  // Add vibration pattern for non-silent notifications
  if (!payload.silent && payload.vibrate) {
    options.vibrate = payload.vibrate;
  }

  // Add actions if provided
  if (payload.actions && payload.actions.length > 0) {
    options.actions = payload.actions;
  }

  // Add image if provided
  if (payload.image) {
    options.image = payload.image;
  }

  event.waitUntil(
    (async () => {
      // Show the notification
      await self.registration.showNotification(title, options);

      // Update badge count if supported
      await updateBadgeFromClients();

      console.log('[SW] Push notification shown:', title);
    })()
  );
});

/**
 * Handle notification click events.
 * Opens or focuses the app and navigates to the appropriate view.
 */
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  // Close the notification
  notification.close();

  event.waitUntil(
    (async () => {
      // Determine URL to open based on notification data and action
      let targetUrl = '/';

      if (data.url) {
        targetUrl = data.url;
      } else if (data.channelId) {
        targetUrl = `/?channel=${data.channelId}`;
      }

      // Handle specific actions
      if (action === 'reply') {
        // For reply action, ensure we open the chat input
        if (data.channelId) {
          targetUrl = `/?channel=${data.channelId}&focus=input`;
        }
      } else if (action === 'mark-read') {
        // For mark-read action, just notify clients and don't open window
        await notifyClientsOfAction('mark-read', data);
        return;
      }

      // Get all window clients
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Try to find an existing window to focus
      for (const client of clientList) {
        // Check if this client is at the app origin
        if (client.url.startsWith(self.location.origin)) {
          // Found an existing window
          await client.focus();

          // Send message to navigate
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: {
              ...data,
              action,
              targetUrl,
            },
          });

          console.log('[SW] Notification click: focused existing window');
          return;
        }
      }

      // No existing window found, open a new one
      const newClient = await self.clients.openWindow(targetUrl);

      if (newClient) {
        // Small delay to allow page to load before sending message
        setTimeout(() => {
          newClient.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: {
              ...data,
              action,
              targetUrl,
            },
          });
        }, 1000);
      }

      console.log('[SW] Notification click: opened new window');
    })()
  );
});

/**
 * Handle notification close events (dismissed without clicking).
 */
self.addEventListener('notificationclose', (event) => {
  const notification = event.notification;
  const data = notification.data || {};

  console.log('[SW] Notification closed:', notification.tag);

  // Track notification dismissal if needed for analytics
  event.waitUntil(
    notifyClientsOfAction('notification-dismissed', data)
  );
});

// ============================================================================
// Badge API Support
// ============================================================================

/**
 * Update the app badge with unread count.
 * Queries clients for the current unread count.
 */
async function updateBadgeFromClients(): Promise<void> {
  // Check if Badge API is supported
  if (!('setAppBadge' in navigator)) {
    return;
  }

  try {
    // Get badge count from clients
    const clients = await self.clients.matchAll({ type: 'window' });

    for (const client of clients) {
      // Request badge count from client
      client.postMessage({ type: 'GET_BADGE_COUNT' });
    }
  } catch (error) {
    console.error('[SW] Error updating badge:', error);
  }
}

/**
 * Set the app badge count directly.
 * Called when receiving badge count from clients.
 */
async function setBadgeCount(count: number): Promise<void> {
  // Check if Badge API is supported
  if (!('setAppBadge' in navigator)) {
    return;
  }

  try {
    if (count > 0) {
      await (navigator as any).setAppBadge(count);
    } else {
      await (navigator as any).clearAppBadge();
    }
    console.log('[SW] Badge updated:', count);
  } catch (error) {
    console.error('[SW] Error setting badge:', error);
  }
}

/**
 * Notify all clients of a notification action.
 */
async function notifyClientsOfAction(
  action: string,
  data: Record<string, unknown>
): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' });

  for (const client of clients) {
    client.postMessage({
      type: 'NOTIFICATION_ACTION',
      action,
      data,
    });
  }
}

// ============================================================================
// Message Handler for Badge Updates
// ============================================================================

// Extend message handler to include badge updates and version info
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      console.log('[SW] Skip waiting requested');
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      // Return version info to client
      event.source?.postMessage({
        type: 'VERSION_INFO',
        version: SW_VERSION,
        buildTime: SW_BUILD_TIME,
        caches: CURRENT_CACHES,
      });
      break;

    case 'CHECK_UPDATE':
      // Client is asking if there's an update available
      // In IPFS hosting, the SW itself being new indicates an update
      event.source?.postMessage({
        type: 'UPDATE_CHECK_RESULT',
        version: SW_VERSION,
        buildTime: SW_BUILD_TIME,
      });
      break;

    case 'CLEAR_ALL_CACHES':
      // Clear all caches (for debugging/testing)
      caches.keys().then((names) => {
        Promise.all(names.map((name) => caches.delete(name))).then(() => {
          console.log('[SW] All caches cleared');
          event.source?.postMessage({ type: 'CACHES_CLEARED' });
        });
      });
      break;

    case 'SET_BADGE_COUNT':
      if (typeof data?.count === 'number') {
        setBadgeCount(data.count);
      }
      break;

    case 'CLEAR_BADGE':
      setBadgeCount(0);
      break;

    case 'SHOW_NOTIFICATION':
      // Allow clients to request notifications
      if (data?.title) {
        self.registration.showNotification(data.title, {
          body: data.body,
          icon: data.icon || '/icons/icon-192x192.png',
          badge: data.badge || '/icons/badge-72x72.png',
          tag: data.tag,
          data: data.data,
          silent: data.silent ?? false,
        });
      }
      break;

    case 'CLOSE_NOTIFICATIONS':
      // Close notifications by tag
      if (data?.tag) {
        self.registration.getNotifications({ tag: data.tag }).then((notifications) => {
          notifications.forEach((n) => n.close());
        });
      }
      break;

    case 'CLOSE_ALL_NOTIFICATIONS':
      // Close all notifications
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((n) => n.close());
      });
      break;

    case 'BUNDLE_UPDATED':
      // Notify all clients that a new P2P bundle is available
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'BUNDLE_READY',
            version: data?.version,
            hash: data?.hash,
          });
        });
      });
      break;

    case 'CHECK_BUNDLE':
      // Check if we have a P2P bundle in IndexedDB
      (async () => {
        const asset = await getAssetFromDB('/index.html');
        event.source?.postMessage({
          type: 'BUNDLE_STATUS',
          hasBundle: !!asset,
        });
      })();
      break;

    default:
      // Unknown message type - ignore
      break;
  }
});

// TypeScript declarations for service worker events
interface SyncEvent extends ExtendableEvent {
  tag: string;
}

declare global {
  interface ServiceWorkerGlobalScopeEventMap {
    sync: SyncEvent;
  }
}

export {};
