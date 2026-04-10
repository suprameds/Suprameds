import { getStoredCountryCode } from "@/lib/data/country-code"
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    let countryCode = "in"
    try {
      const result = await getStoredCountryCode()
      countryCode = result.countryCode || "in"
    } catch {
      // Backend unreachable — default to India
    }

    throw redirect({
      to: "/$countryCode",
      params: { countryCode },
    })
  },
})
