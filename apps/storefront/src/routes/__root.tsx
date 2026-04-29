import { useState, useCallback, useEffect } from "react"
import NotFound from "@/components/not-found"
import ErrorFallback from "@/components/error-fallback"
import Layout from "@/components/layout"
import { SplashScreen } from "@/components/auth/splash-screen"
import { listRegions } from "@/lib/data/regions"
import { captureAdAttribution } from "@/lib/utils/ad-attribution"
import * as Sentry from "@sentry/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router"
import { SITE_URL } from "@/lib/constants/site"
// eslint-disable-next-line no-restricted-imports
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
    // Pre-populate regions cache; cap SSR wait at 600ms so cold-start backend
    // latency doesn't spike TTFB — client refetches if the race times out.
    try {
      await Promise.race([
        queryClient.ensureQueryData({
          queryKey: ["regions"],
          queryFn: () => listRegions({ fields: "id, name, currency_code, *countries" }),
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 600)),
      ])
    } catch {
      // Backend unreachable or slow; leave cache empty, client will refetch
    }
    return {}
  },
  head: () => ({
    links: [
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/icon-192x192.png" },
      { rel: "icon", type: "image/png", sizes: "512x512", href: "/icons/icon-512x512.png" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      {
        rel: "apple-touch-icon",
        href: "/icons/apple-touch-icon-180x180.png",
      },
      // Preload hero image so browser discovers it before CSS/JS parsing
      {
        rel: "preload",
        as: "image",
        type: "image/webp",
        href: "/images/hero-bg.webp",
        fetchPriority: "high",
      } as any,
      // Preconnect to API and image storage — eliminates TCP+TLS handshake latency
      // on the first request to each domain (~200-300ms saved per domain)
      ...(import.meta.env.VITE_MEDUSA_BACKEND_URL
        ? [{ rel: "preconnect", href: new URL(import.meta.env.VITE_MEDUSA_BACKEND_URL).origin }]
        : []),
      ...(import.meta.env.VITE_SUPABASE_URL
        ? [{ rel: "preconnect", href: new URL(import.meta.env.VITE_SUPABASE_URL).origin }]
        : []),
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
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
      { property: "og:image", content: `${SITE_URL}/og-default.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${SITE_URL}/og-default.png` },
      // Google Search Console verification (set VITE_GSC_VERIFICATION in .env)
      ...(import.meta.env.VITE_GSC_VERIFICATION
        ? [{ name: "google-site-verification", content: import.meta.env.VITE_GSC_VERIFICATION }]
        : []),
    ],
    scripts: [
      // Non-blocking font loader — dynamically appending a link doesn't block the HTML parser
      // unlike a static <link rel="stylesheet"> which stalls rendering until the CSS downloads.
      // display=swap in the URL means text renders in system fonts immediately while Fraunces/DM
      // Sans fetch in the background, then swap in with no layout shift.
      {
        children: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;1,9..144,400&display=swap';document.head.appendChild(l)})();`,
      },
      // Google Analytics 4 — async loader
      {
        src: "https://www.googletagmanager.com/gtag/js?id=G-JKGJ3D3B86",
        async: true,
      },
      // GA4 inline initialisation (also configures Google Ads conversion ID when set)
      {
        children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-JKGJ3D3B86');${
          import.meta.env.VITE_GOOGLE_ADS_ID
            ? `gtag('config','${import.meta.env.VITE_GOOGLE_ADS_ID}');`
            : ""
        }`,
      },
      // Google Tag Manager — enables AdScale, Meta Pixel management, and other tags via GTM dashboard
      ...(import.meta.env.VITE_GTM_ID
        ? [{
            children: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${import.meta.env.VITE_GTM_ID}');`,
          }]
        : []),
      // Meta / Facebook Pixel — conversion tracking for Meta Ads
      ...(import.meta.env.VITE_META_PIXEL_ID
        ? [{
            children: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${import.meta.env.VITE_META_PIXEL_ID}');fbq('track','PageView');`,
          }]
        : []),
    ],
  }),
  pendingMs: 0,
  pendingComponent: RouteLoadingFallback,
  errorComponent: RouteErrorFallback,
  notFoundComponent: NotFound,
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  const [showSplash, setShowSplash] = useState(true)
  const hideSplash = useCallback(() => setShowSplash(false), [])

  // Capture ad click IDs (gclid/gbraid/wbraid) and UTM params on first load.
  // Stored 90 days so a conversion later can attribute back to the original ad.
  useEffect(() => {
    captureAdAttribution()
  }, [])

  return (
    <html lang="en-IN">
      <head>
        <HeadContent />
      </head>
      <body>
        {showSplash && <SplashScreen onComplete={hideSplash} />}
        {/* GTM noscript fallback */}
        {import.meta.env.VITE_GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${import.meta.env.VITE_GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        {/* Meta Pixel noscript fallback */}
        {import.meta.env.VITE_META_PIXEL_ID && (
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${import.meta.env.VITE_META_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        )}

        <QueryClientProvider client={queryClient}>
          <Layout />
        </QueryClientProvider>

        <Scripts />
      </body>
    </html>
  )
}
