"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { SessionProvider } from "next-auth/react"
import { useState } from "react"
import { trpc } from "../utils/trpc"
import { ToastProvider } from "../components/ui/toast-provider"
import { performanceMonitor } from "../lib/performance-monitor"

// Enhanced QueryClient with performance optimizations
function createOptimizedQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Increased stale time for better caching
        staleTime: 5 * 60 * 1000, // 5 minutes
        // Longer cache time for data that doesn't change often
        gcTime: 30 * 60 * 1000, // 30 minutes (formerly cacheTime)
        // Refetch on window focus for fresh data
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect by default
        refetchOnReconnect: false,
        // Retry failed requests
        retry: (failureCount, error) => {
          // Don't retry for certain HTTP status codes
          if (error instanceof Error && 'status' in error) {
            const status = (error as any).status;
            if (status === 404 || status === 403 || status === 401) {
              return false;
            }
          }
          return failureCount < 3;
        },
        // Performance monitoring will be handled at the query level
      },
      mutations: {
        // Retry mutations
        retry: 1,
      },
    },
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createOptimizedQueryClient)

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          // Enhanced batching configuration
          maxURLLength: 2083, // Reasonable URL length limit
          headers() {
            return {
              'content-type': 'application/json',
            }
          },
          // Performance-optimized fetch with monitoring
          fetch(url, options) {
            const startTime = performance.now();

            return fetch(url, {
              ...options,
              method: options?.method || 'POST',
              // Add connection optimizations
              keepalive: true,
              // Signal for request cancellation
              signal: options?.signal,
            }).then(response => {
              const duration = performance.now() - startTime;

              // Track API performance
              if (process.env.NODE_ENV === 'development') {
                console.log(`API request: ${url} - ${duration.toFixed(2)}ms`);
              }

              // Monitor slow requests
              if (duration > 2000) {
                console.warn(`Slow API request detected: ${url} took ${duration.toFixed(2)}ms`);
              }

              return response;
            }).catch(error => {
              const duration = performance.now() - startTime;
              console.error(`API request failed: ${url} - ${duration.toFixed(2)}ms`, error);
              throw error;
            });
          },
        }),
      ],
    })
  )

  return (
    <SessionProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </SessionProvider>
  )
}