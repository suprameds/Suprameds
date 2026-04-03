import { createFileRoute } from "@tanstack/react-router"
import PrescriptionDetailPage from "@/pages/account/pharmacist/prescription-detail"

export const Route = createFileRoute(
  "/$countryCode/account/_layout/pharmacist/prescription/$prescriptionId"
)({
  head: () => ({
    meta: [
      { title: "Prescription Review | Pharmacist | Suprameds" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PrescriptionDetailPage,
})
