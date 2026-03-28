import NotFound from "@/components/not-found"
import ErrorFallback from "@/components/error-fallback"
import Layout from "@/components/layout"
import { listRegions } from "@/lib/data/regions"
import * as Sentry from "@sentry/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router"
import appCss from "../styles/app.css?url"

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="animate-spin h-8 w-8 text-[var(--text-tertiary)]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm text-[var(--text-tertiary)]">Loading…</span>
      </div>
    </div>
  )
}

function RouteErrorFallback({ error }: { error: Error }) {
  const router = useRouter()
  // Report route-level errors to Sentry
  Sentry.captureException(error)
  return (
    <ErrorFallback
      error={error}
      reset={() => router.invalidate()}
    />
  )
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  loader: async ({ context }) => {
    const { queryClient } = context
    // Pre-populate regions cache; don't block or throw on backend failure (SSR resilience)
    try {
      await queryClient.ensureQueryData({
        queryKey: ["regions"],
        queryFn: () => listRegions({ fields: "id, name, currency_code, *countries" }),
      })
    } catch {
      // Backend unreachable (e.g. dev); leave cache empty, client will refetch
    }
    return {}
  },
  head: () => ({
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/images/suprameds.svg" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "apple-touch-icon",
        href: "/icons/apple-touch-icon-180x180.png",
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,400&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
    meta: [
      { title: "Suprameds — India's Licensed Online Pharmacy" },
      { charSet: "UTF-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1.0",
      },
      {
        name: "description",
        content:
          "Suprameds — CDSCO-registered online pharmacy. Pharmacist-dispensed prescription medicines and OTC products delivered across India.",
      },
      { name: "theme-color", content: "#1E2D5A" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "default",
      },
      { property: "og:site_name", content: "Suprameds" },
      { property: "og:locale", content: "en_IN" },
      { property: "og:image", content: "https://suprameds.in/og-default.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://suprameds.in/og-default.png" },
    ],
    scripts: [
      // Google Analytics 4 — async loader
      {
        src: "https://www.googletagmanager.com/gtag/js?id=G-RDYLD3PM8D",
        async: true,
      },
      // GA4 inline initialisation
      {
        children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-RDYLD3PM8D');`,
      },
    ],
  }),
  pendingComponent: RouteLoadingFallback,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFound,
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <html lang="en-IN">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>

        <Scripts />
      </body>
    </html>
  )
}
