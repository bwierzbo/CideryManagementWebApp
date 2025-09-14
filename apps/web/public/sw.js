/**
 * Service Worker for Cidery Management App
 * Provides offline functionality and PWA capabilities for pressing workflow
 */

const CACHE_NAME = 'cidery-v1'
const PRESSING_CACHE = 'cidery-pressing-v1'
const API_CACHE = 'cidery-api-v1'

// Static assets to cache for offline use
const STATIC_ASSETS = [
  '/',
  '/pressing',
  '/offline',
  '/manifest.json',
  // Add other critical static assets
]

// API endpoints that should be cached
const CACHEABLE_APIS = [
  '/api/trpc/appleVariety.list',
  '/api/trpc/purchaseLine.available',
  '/api/trpc/vendor.list',
  '/api/trpc/vessel.available',
]

// Background sync tags
const SYNC_TAGS = {
  PRESS_RUN_SYNC: 'press-run-sync',
  PRESS_LOAD_SYNC: 'press-load-sync',
}

self.addEventListener('install', event => {
  console.log('[SW] Installing service worker')

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('[SW] Static assets cached successfully')
        // Force activation of new service worker
        return self.skipWaiting()
      })
      .catch(error => {
        console.error('[SW] Failed to cache static assets:', error)
      })
  )
})

self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker')

  event.waitUntil(
    // Clean up old caches
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== PRESSING_CACHE && cacheName !== API_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        // Claim all clients
        return self.clients.claim()
      })
      .catch(error => {
        console.error('[SW] Error during activation:', error)
      })
  )
})

self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return
  }

  // Handle different types of requests
  if (isAPIRequest(url)) {
    event.respondWith(handleAPIRequest(request))
  } else if (isPressingRouteRequest(url)) {
    event.respondWith(handlePressingRequest(request))
  } else if (isStaticAssetRequest(url)) {
    event.respondWith(handleStaticAssetRequest(request))
  } else {
    event.respondWith(handleGeneralRequest(request))
  }
})

// Background sync for offline operations
self.addEventListener('sync', event => {
  console.log('[SW] Background sync triggered:', event.tag)

  if (event.tag === SYNC_TAGS.PRESS_RUN_SYNC) {
    event.waitUntil(syncPressRuns())
  } else if (event.tag === SYNC_TAGS.PRESS_LOAD_SYNC) {
    event.waitUntil(syncPressLoads())
  }
})

// Handle push notifications (future feature)
self.addEventListener('push', event => {
  console.log('[SW] Push notification received')

  const options = {
    body: 'Press run sync completed',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    tag: 'sync-notification',
    requireInteraction: false,
  }

  if (event.data) {
    const data = event.data.json()
    options.body = data.body || options.body
    options.title = data.title || 'Cidery Management'
  }

  event.waitUntil(
    self.registration.showNotification('Cidery Management', options)
  )
})

// Utility functions
function isAPIRequest(url) {
  return url.pathname.startsWith('/api/trpc/')
}

function isPressingRouteRequest(url) {
  return url.pathname.startsWith('/pressing')
}

function isStaticAssetRequest(url) {
  const extension = url.pathname.split('.').pop()
  return ['css', 'js', 'png', 'jpg', 'jpeg', 'svg', 'ico', 'woff', 'woff2'].includes(extension)
}

async function handleAPIRequest(request) {
  const url = new URL(request.url)

  // Network-first strategy for API calls
  try {
    console.log('[SW] Attempting network request for API:', url.pathname)
    const networkResponse = await fetch(request)

    // Cache successful responses for read-only operations
    if (networkResponse.ok && isCacheableAPI(url.pathname)) {
      const cache = await caches.open(API_CACHE)
      await cache.put(request, networkResponse.clone())
      console.log('[SW] API response cached:', url.pathname)
    }

    return networkResponse
  } catch (error) {
    console.log('[SW] Network request failed, trying cache for API:', url.pathname)

    // Fallback to cache for read operations
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request)
      if (cachedResponse) {
        console.log('[SW] Serving API from cache:', url.pathname)
        return cachedResponse
      }
    }

    // Return offline response for failed API requests
    return new Response(
      JSON.stringify({
        error: 'Offline - API request failed',
        message: 'This request requires an internet connection',
        offline: true,
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

async function handlePressingRequest(request) {
  // Cache-first strategy for pressing pages
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      console.log('[SW] Serving pressing page from cache')
      return cachedResponse
    }

    console.log('[SW] Pressing page not in cache, fetching from network')
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(PRESSING_CACHE)
      await cache.put(request, networkResponse.clone())
      console.log('[SW] Pressing page cached')
    }

    return networkResponse
  } catch (error) {
    console.log('[SW] Network failed for pressing page, serving offline fallback')

    // Serve basic offline page if available
    const offlineResponse = await caches.match('/offline')
    if (offlineResponse) {
      return offlineResponse
    }

    // Fallback HTML for pressing pages
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Cidery Management</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px; }
            .offline-message { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>You're Offline</h1>
          <div class="offline-message">
            <p>This page isn't available offline yet.</p>
            <p>Please check your internet connection and try again.</p>
          </div>
          <button onclick="window.location.reload()">Retry</button>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
      status: 503,
      statusText: 'Service Unavailable'
    })
  }
}

async function handleStaticAssetRequest(request) {
  // Cache-first strategy for static assets
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      await cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.log('[SW] Failed to load static asset:', request.url)
    return new Response('', { status: 404, statusText: 'Not Found' })
  }
}

async function handleGeneralRequest(request) {
  // Network-first strategy for other requests
  try {
    const networkResponse = await fetch(request)
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    })
  }
}

function isCacheableAPI(pathname) {
  return CACHEABLE_APIS.some(api => pathname.includes(api))
}

// Background sync functions
async function syncPressRuns() {
  console.log('[SW] Starting press run sync')

  try {
    // Get drafts from IndexedDB or localStorage
    const drafts = await getDraftsFromStorage()

    for (const draft of drafts) {
      if (draft.status === 'draft' || draft.status === 'error') {
        await syncSinglePressRun(draft)
      }
    }

    console.log('[SW] Press run sync completed')
  } catch (error) {
    console.error('[SW] Press run sync failed:', error)
  }
}

async function syncPressLoads() {
  console.log('[SW] Starting press load sync')

  try {
    // Get pending loads from storage
    const pendingLoads = await getPendingLoadsFromStorage()

    for (const load of pendingLoads) {
      await syncSingleLoad(load)
    }

    console.log('[SW] Press load sync completed')
  } catch (error) {
    console.error('[SW] Press load sync failed:', error)
  }
}

async function syncSinglePressRun(draft) {
  try {
    const response = await fetch('/api/trpc/pressRun.create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vendorId: draft.vendorId,
        startTime: draft.startTime,
        notes: draft.notes,
      }),
    })

    if (response.ok) {
      console.log('[SW] Press run synced successfully:', draft.id)
      await markDraftAsSynced(draft.id)
    } else {
      console.error('[SW] Failed to sync press run:', draft.id)
      await markDraftAsError(draft.id)
    }
  } catch (error) {
    console.error('[SW] Error syncing press run:', error)
    await markDraftAsError(draft.id)
  }
}

async function syncSingleLoad(load) {
  try {
    const response = await fetch('/api/trpc/pressRun.addLoad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(load),
    })

    if (response.ok) {
      console.log('[SW] Load synced successfully:', load.id)
      await markLoadAsSynced(load.id)
    } else {
      console.error('[SW] Failed to sync load:', load.id)
      await markLoadAsError(load.id)
    }
  } catch (error) {
    console.error('[SW] Error syncing load:', error)
    await markLoadAsError(load.id)
  }
}

// Storage access functions (these would integrate with the offline storage system)
async function getDraftsFromStorage() {
  // This would interface with the localStorage-based system we created
  // For now, return empty array as this is handled by the React hooks
  return []
}

async function getPendingLoadsFromStorage() {
  // This would interface with the localStorage-based system we created
  return []
}

async function markDraftAsSynced(draftId) {
  // This would update the draft status in localStorage
  console.log('[SW] Marking draft as synced:', draftId)
}

async function markDraftAsError(draftId) {
  // This would update the draft status in localStorage
  console.log('[SW] Marking draft as error:', draftId)
}

async function markLoadAsSynced(loadId) {
  // This would update the load status in localStorage
  console.log('[SW] Marking load as synced:', loadId)
}

async function markLoadAsError(loadId) {
  // This would update the load status in localStorage
  console.log('[SW] Marking load as error:', loadId)
}