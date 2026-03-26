import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, MedusaError } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../../../../modules/prescription"

/**
 * GET /admin/prescriptions/:id/file-url
 *
 * Returns a time-limited download URL for the prescription file.
 * Supports both legacy base64 data URLs and S3/R2-backed files.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { id } = req.params
  const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any

  const prescriptions = await prescriptionService.listPrescriptions(
    { id },
    { take: 1 }
  )

  if (!prescriptions.length) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Prescription ${id} not found`
    )
  }

  const rx = prescriptions[0] as any

  // Legacy: base64 data URL stored directly in the DB
  if (rx.file_url && rx.file_url.startsWith("data:")) {
    return res.json({ url: rx.file_url, expires_in: null })
  }

  // S3/R2: file_key contains the file module's file ID
  if (rx.file_key) {
    try {
      const fileModuleService = req.scope.resolve(Modules.FILE) as any
      const file = await fileModuleService.retrieveFile(rx.file_key)
      return res.json({ url: file.url, expires_in: 3600 })
    } catch {
      // Fall through to stored file_url
    }
  }

  return res.json({ url: rx.file_url || null, expires_in: null })
}
