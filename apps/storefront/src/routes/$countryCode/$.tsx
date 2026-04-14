import NotFound from "@/components/not-found"
import { createFileRoute } from "@tanstack/react-router"

// Route tree will be regenerated on next dev/build — path is valid
// @ts-expect-error Route not yet in generated FileRoutesByPath
export const Route = createFileRoute("/$countryCode/$")({
  component: NotFound,
})
