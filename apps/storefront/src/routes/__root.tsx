import NotFound from "@/components/not-found"
import Layout from "@/components/layout"
import { listRegions } from "@/lib/data/regions"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router"
import appCss from "../styles/app.css?url"

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
    ],
    scripts: [],
  }),
  notFoundComponent: NotFound,
  component: RootComponent,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <html lang="en">
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
