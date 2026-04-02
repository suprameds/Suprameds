import { AuthenticatedMedusaRequest, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../../modules/prescription"
import {
  decryptPhiArray,
  encryptPhi,
  PRESCRIPTION_PHI_FIELDS,
  isPhiEncryptionEnabled,
} from "../../../lib/phi-crypto"
import { createLogger } from "../../../lib/logger"

const logger = createLogger("admin:prescriptions")

/**
 * GET /admin/prescriptions
 * Admin: list prescriptions with optional filtering.
 *
 * Query params:
 *   - status: filter by prescription status
 *   - order_id: filter to prescriptions linked to a specific order
 *   - customer_id: filter by customer
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const status = req.query.status as string | undefined
  const orderId = req.query.order_id as string | undefined
  const customerId = req.query.customer_id as string | undefined

  // If filtering by order_id, query the link table directly (query.graph link traversal
  // is unreliable — the field name varies between Medusa versions)
  if (orderId) {
    try {
      const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
      const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any

      // Direct SQL on the link table — always works regardless of query.graph field naming
      const { rows: linkRows } = await pgConnection.raw(
        `SELECT prescription_id FROM order_order_pharmaprescription_prescription WHERE order_id = ? AND deleted_at IS NULL`,
        [orderId]
      )

      if (!linkRows?.length) {
        return res.json({ prescriptions: [], count: 0 })
      }

      const prescriptionIds = linkRows.map((r: any) => r.prescription_id)
      let prescriptions = await prescriptionService.listPrescriptions(
        { id: prescriptionIds },
        { relations: ["lines"], take: 100 }
      )

      if (status) {
        prescriptions = prescriptions.filter((rx: any) => rx.status === status)
      }

      const result = isPhiEncryptionEnabled()
        ? decryptPhiArray(prescriptions, PRESCRIPTION_PHI_FIELDS)
        : prescriptions

      return res.json({ prescriptions: result, count: result.length })
    } catch (err: any) {
      logger.warn(
        `[admin:prescriptions] Could not resolve prescriptions for order ${orderId}: ${err?.message}`
      )
      return res.json({ prescriptions: [], count: 0 })
    }
  }

  // Standard listing — use the module service directly (more reliable than query.graph)
  try {
    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any

    const filters: Record<string, any> = {}
    if (status) filters.status = status
    if (customerId) filters.customer_id = customerId

    const prescriptions = await prescriptionService.listPrescriptions(
      filters,
      {
        order: { created_at: "DESC" },
        take: 100,
        relations: ["lines"],
      }
    )

    const result = isPhiEncryptionEnabled()
      ? decryptPhiArray(prescriptions, PRESCRIPTION_PHI_FIELDS)
      : prescriptions

    return res.json({ prescriptions: result, count: result.length })
  } catch (err: any) {
    logger.error("Failed to list prescriptions:", err?.message)
    return res.status(500).json({ error: "Failed to load prescriptions" })
  }
}

/**
 * POST /admin/prescriptions
 * Admin: upload a prescription on behalf of a customer and optionally link to an order.
 *
 * Body: { order_id?, customer_id?, file (base64 data URI), original_filename, mime_type, file_size_bytes }
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const {
    order_id,
    customer_id,
    file,
    original_filename,
    mime_type,
    file_size_bytes,
  } = req.body as any

  if (!file) {
    return res.status(400).json({ error: "file (base64) is required" })
  }

  const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
  const fileModuleService = req.scope.resolve(Modules.FILE) as any

  // Strip the data:...;base64, prefix if present
  const base64Content = file.includes(",") ? file.split(",")[1] : file
  const safeName = (original_filename || "prescription").replace(/[^a-zA-Z0-9._-]/g, "_")
  const fileKey = `rx/admin/${Date.now()}-${safeName}`

  // Upload file via Medusa file module
  const uploadedFile = await fileModuleService.createFiles({
    filename: fileKey,
    mimeType: mime_type || "application/octet-stream",
    content: base64Content,
    access: "private",
  })

  const shouldEncrypt = isPhiEncryptionEnabled()

  // Create prescription record
  const prescription = await prescriptionService.createPrescriptions({
    customer_id: customer_id ?? null,
    file_key: uploadedFile.id,
    file_url: uploadedFile.url ?? null,
    original_filename: shouldEncrypt ? encryptPhi(original_filename) : original_filename,
    mime_type,
    file_size_bytes: file_size_bytes ?? null,
    status: "pending_review",
  })

  // Link to order if order_id provided
  if (order_id && prescription?.id) {
    try {
      const linkService = req.scope.resolve(ContainerRegistrationKeys.LINK) as any
      await linkService.create({
        [Modules.ORDER]: { order_id },
        [PRESCRIPTION_MODULE]: { prescription_id: prescription.id },
      })
      logger.info(
        `[admin:prescriptions] Linked prescription ${prescription.id} to order ${order_id}`
      )
    } catch (linkErr: any) {
      logger.warn(
        `[admin:prescriptions] Failed to link prescription to order: ${linkErr?.message}`
      )
    }
  }

  return res.status(201).json({ prescription })
}
