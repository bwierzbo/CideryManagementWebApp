"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { httpBatchLink } from "@trpc/client"
import { SessionProvider } from "next-auth/react"
import { useState } from "react"
import { trpc } from "../utils/trpc"
import { ToastProvider } from "../components/ui/toast-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  )

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: "/api/trpc",
          headers() {
            return {
              'content-type': 'application/json',
            }
          },
          // Force mutations to use POST
          fetch(url, options) {
            return fetch(url, {
              ...options,
              method: options?.method || 'POST',
            })
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