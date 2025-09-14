/**
 * Service Worker Registration and Management
 * Handles PWA setup and background sync registration
 */

export interface SWRegistrationResult {
  success: boolean
  registration?: ServiceWorkerRegistration
  error?: string
}

export interface SyncRegistrationResult {
  success: boolean
  error?: string
}

class ServiceWorkerManager {
  private static instance: ServiceWorkerManager
  private registration: ServiceWorkerRegistration | null = null

  public static getInstance(): ServiceWorkerManager {
    if (!ServiceWorkerManager.instance) {
      ServiceWorkerManager.instance = new ServiceWorkerManager()
    }
    return ServiceWorkerManager.instance
  }

  private constructor() {
    // Initialize service worker on client side only
    if (typeof window !== 'undefined') {
      this.initialize()
    }
  }

  private async initialize(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        await this.register()
      } catch (error) {
        console.error('[SW Manager] Failed to initialize:', error)
      }
    } else {
      console.warn('[SW Manager] Service Worker not supported')
    }
  }

  async register(): Promise<SWRegistrationResult> {
    if (!('serviceWorker' in navigator)) {
      return { success: false, error: 'Service Worker not supported' }
    }

    try {
      console.log('[SW Manager] Registering service worker...')

      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'imports',
      })

      this.registration = registration

      // Handle updates
      registration.addEventListener('updatefound', () => {
        console.log('[SW Manager] Service worker update found')
        this.handleUpdate(registration)
      })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleMessage(event)
      })

      console.log('[SW Manager] Service worker registered successfully')
      return { success: true, registration }

    } catch (error) {
      console.error('[SW Manager] Service worker registration failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      }
    }
  }

  private handleUpdate(registration: ServiceWorkerRegistration): void {
    const newWorker = registration.installing

    if (newWorker) {
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('[SW Manager] New service worker available')

          // Notify user about update
          this.notifyUpdate()
        }
      })
    }
  }

  private handleMessage(event: MessageEvent): void {
    console.log('[SW Manager] Received message from service worker:', event.data)

    const { type, data } = event.data

    switch (type) {
      case 'SYNC_COMPLETE':
        console.log('[SW Manager] Sync completed:', data)
        // Trigger UI refresh or show notification
        window.dispatchEvent(new CustomEvent('sw-sync-complete', { detail: data }))
        break

      case 'CACHE_UPDATED':
        console.log('[SW Manager] Cache updated:', data)
        break

      case 'ERROR':
        console.error('[SW Manager] Service worker error:', data)
        break

      default:
        console.log('[SW Manager] Unknown message type:', type)
    }
  }

  private notifyUpdate(): void {
    // Create a simple notification for updates
    const notification = document.createElement('div')
    notification.className = 'fixed top-4 right-4 bg-blue-600 text-white p-4 rounded-lg shadow-lg z-50'
    notification.innerHTML = `
      <div class="flex items-center space-x-3">
        <div>
          <p class="font-medium">App Update Available</p>
          <p class="text-sm opacity-90">Refresh to get the latest features</p>
        </div>
        <button id="sw-refresh-btn" class="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium">
          Refresh
        </button>
        <button id="sw-dismiss-btn" class="text-white opacity-75 hover:opacity-100">
          ✕
        </button>
      </div>
    `

    document.body.appendChild(notification)

    // Handle refresh button
    const refreshBtn = notification.querySelector('#sw-refresh-btn')
    refreshBtn?.addEventListener('click', () => {
      window.location.reload()
    })

    // Handle dismiss button
    const dismissBtn = notification.querySelector('#sw-dismiss-btn')
    dismissBtn?.addEventListener('click', () => {
      notification.remove()
    })

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove()
      }
    }, 10000)
  }

  // Background sync registration
  async registerBackgroundSync(tag: string): Promise<SyncRegistrationResult> {
    if (!this.registration || !this.registration.sync) {
      return { success: false, error: 'Background sync not supported' }
    }

    try {
      await this.registration.sync.register(tag)
      console.log('[SW Manager] Background sync registered:', tag)
      return { success: true }
    } catch (error) {
      console.error('[SW Manager] Failed to register background sync:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sync registration failed'
      }
    }
  }

  // Check if app is running in standalone mode (PWA)
  isStandalone(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://')
  }

  // Check if PWA can be installed
  canInstall(): boolean {
    return 'beforeinstallprompt' in window
  }

  // Get service worker registration
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration
  }

  // Send message to service worker
  async sendMessage(message: any): Promise<void> {
    if (this.registration && this.registration.active) {
      this.registration.active.postMessage(message)
    }
  }

  // Force update check
  async checkForUpdates(): Promise<boolean> {
    if (!this.registration) return false

    try {
      await this.registration.update()
      return true
    } catch (error) {
      console.error('[SW Manager] Update check failed:', error)
      return false
    }
  }

  // Unregister service worker (for development/testing)
  async unregister(): Promise<boolean> {
    if (!this.registration) return false

    try {
      const result = await this.registration.unregister()
      this.registration = null
      console.log('[SW Manager] Service worker unregistered')
      return result
    } catch (error) {
      console.error('[SW Manager] Failed to unregister service worker:', error)
      return false
    }
  }
}

// Export singleton instance
export const serviceWorkerManager = ServiceWorkerManager.getInstance()

// Hook for React components
export function useServiceWorker() {
  const [isSupported] = useState(() => 'serviceWorker' in navigator)
  const [isRegistered, setIsRegistered] = useState(false)
  const [isStandalone] = useState(() => serviceWorkerManager.isStandalone())
  const [canInstall] = useState(() => serviceWorkerManager.canInstall())

  useEffect(() => {
    const checkRegistration = async () => {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        setIsRegistered(!!registration)
      }
    }

    checkRegistration()
  }, [])

  const registerSync = useCallback(async (tag: string) => {
    return await serviceWorkerManager.registerBackgroundSync(tag)
  }, [])

  const sendMessage = useCallback(async (message: any) => {
    await serviceWorkerManager.sendMessage(message)
  }, [])

  const checkForUpdates = useCallback(async () => {
    return await serviceWorkerManager.checkForUpdates()
  }, [])

  return {
    isSupported,
    isRegistered,
    isStandalone,
    canInstall,
    registerSync,
    sendMessage,
    checkForUpdates,
  }
}

// React imports (only needed when used as React hook)
import { useState, useEffect, useCallback } from 'react'