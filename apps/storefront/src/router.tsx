import { routeTree } from "@/routeTree.gen"
import { QueryClient } from "@tanstack/react-query"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query"
import { lazy } from "react"

const NotFound = lazy(() => import("@/components/not-found"))

const isCapacitor = !!import.meta.env.VITE_CAPACITOR

export function createRouter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: (failureCount, error) => {
          // Don't retry auth errors (401/403)
          const msg = (error instanceof Error ? error.message : "").toLowerCase()
          if (msg.includes("401") || msg.includes("403") || msg.includes("unauthorized")) {
            return false
          }
          // Retry connection errors up to 2 times with backoff
          return failureCount < 2
        },
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: isCapacitor ? "intent" : false,
    ...(isCapacitor ? { defaultSsr: false } : {}),
    defaultNotFoundComponent: NotFound,
    scrollRestoration: true,
  })

  // SSR query integration only for web (not Capacitor SPA)
  if (!isCapacitor) {
    setupRouterSsrQueryIntegration({
      router,
      queryClient,
    })
  }

  return router
}

export function getRouter() {
  return createRouter()
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
