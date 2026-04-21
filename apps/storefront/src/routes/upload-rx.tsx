import { createFileRoute, notFound } from "@tanstack/react-router"
import { getRegion } from "@/lib/data/regions"
import UploadRx from "@/pages/upload-rx"
import { SITE_URL, DEFAULT_COUNTRY_CODE } from "@/lib/constants/site"

export const Route = createFileRoute("/upload-rx")({
  loader: async ({ context }) => {
    const { queryClient } = context

    const region = await queryClient.ensureQueryData({
      queryKey: ["region", DEFAULT_COUNTRY_CODE],
      queryFn: () => getRegion({ country_code: DEFAULT_COUNTRY_CODE }),
    })

    if (!region) {
      throw notFound()
    }

    return { region }
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
    links: [
      { rel: "canonical", href: `${SITE_URL}/upload-rx` },
    ],
  }),
  component: UploadRx,
})
