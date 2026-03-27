import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { DISPENSE_MODULE } from "../../../../modules/dispense"

/**
 * GET /admin/dispense/notes
 * List pharmacist notes with optional filters.
 * Query params: prescription_id, pharmacist_id, limit, offset
 *
 * POST /admin/dispense/notes
 * Create a pharmacist note.
 * Body: { prescription_id, note_text, line_id? }
 */

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const dispenseService = req.scope.resolve(DISPENSE_MODULE) as any

    const {
      prescription_id,
      pharmacist_id,
      limit: limitStr,
      offset: offsetStr,
    } = req.query as Record<string, string>

    const filters: Record<string, any> = {}
    if (prescription_id) filters.prescription_id = prescription_id
    if (pharmacist_id) filters.pharmacist_id = pharmacist_id

    const limit = Number(limitStr) || 20
    const offset = Number(offsetStr) || 0

    const notes = await dispenseService.listPharmacistNotes(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    const list = Array.isArray(notes?.[0])
      ? notes[0]
      : Array.isArray(notes)
      ? notes
      : []

    return res.json({ data: list, count: list.length, limit, offset })
  } catch (err: any) {
    console.error("[admin:dispense:notes] GET failed:", err?.message)
    return res.status(500).json({ error: "Failed to fetch pharmacist notes" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as Record<string, any>
  const actorId = (req as any).auth_context?.actor_id

  if (!body.prescription_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "prescription_id is required"
    )
  }

  if (!body.note_text) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "note_text is required"
    )
  }

  if (!actorId) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      "Authenticated pharmacist required"
    )
  }

  try {
    const dispenseService = req.scope.resolve(DISPENSE_MODULE) as any

    const note = await dispenseService.createPharmacistNotes({
      prescription_id: body.prescription_id,
      line_id: body.line_id ?? null,
      pharmacist_id: actorId,
      note_text: body.note_text,
    })

    return res.status(201).json({ note })
  } catch (err: any) {
    console.error("[admin:dispense:notes] POST failed:", err?.message)
    return res.status(400).json({ error: err?.message || "Failed to create note" })
  }
}
