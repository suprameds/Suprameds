import { createFileRoute, notFound } from "@tanstack/react-router"
import { getRegion } from "@/lib/data/regions"
import UploadRx from "@/pages/upload-rx"

export const Route = createFileRoute("/$countryCode/upload-rx")({
  loader: async ({ params, context }) => {
    const { countryCode } = params
    const { queryClient } = context

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", countryCode],
      queryFn: () => getRegion({ country_code: countryCode }),
    })

    if (!region) {
      throw notFound()
    }

    return { countryCode, region }
  },
  head: () => ({
    meta: [
      { title: "Upload Prescription | Suprameds" },
      {
        name: "description",
        content:
          "Upload your doctor's prescription for pharmacist review. Approved within 4 hours. CDSCO-registered pharmacy.",
      },
    ],
  }),
  component: UploadRx,
})
