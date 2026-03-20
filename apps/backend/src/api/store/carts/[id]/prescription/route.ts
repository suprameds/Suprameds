import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { PRESCRIPTION_MODULE } from "../../../../../modules/prescription"

/**
 * POST /store/carts/:id/prescription
 *
 * Attaches (or detaches) a prescription to the cart by storing its ID
 * in cart.metadata.prescription_id.
 *
 * Body: { prescription_id: string | null }
 *   - string → attach that prescription (must belong to the customer and be approved/pending_review)
 *   - null   → detach (clear the prescription from the cart)
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) {
  const { id: cartId } = req.params
  const { prescription_id } = req.body as { prescription_id: string | null }
  const customerId = (req as any).auth_context?.actor_id

  const cartService = req.scope.resolve(Modules.CART) as any

  // Retrieve current cart to verify ownership
  const cart = await cartService.retrieveCart(cartId)
  if (!cart) {
    return res.status(404).json({ error: "Cart not found" })
  }

  if (prescription_id) {
    // Validate the prescription exists and belongs to this customer
    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
    const [rx] = await prescriptionService.listPrescriptions({
      id: prescription_id,
    })

    if (!rx) {
      return res
        .status(404)
        .json({ error: "Prescription not found" })
    }

    // Ownership check: must belong to the same customer
    if (customerId && rx.customer_id !== customerId) {
      return res
        .status(403)
        .json({ error: "This prescription does not belong to you" })
    }

    // Status check: must be approved or pending_review
    const allowedStatuses = ["approved", "pending_review"]
    if (!allowedStatuses.includes(rx.status)) {
      return res.status(400).json({
        error: `Prescription is in "${rx.status}" status. Only approved or pending prescriptions can be attached.`,
      })
    }
  }

  // Update cart metadata with the prescription ID
  const existingMetadata = (cart.metadata as Record<string, any>) ?? {}
  const updatedCart = await cartService.updateCarts(cartId, {
    metadata: {
      ...existingMetadata,
      prescription_id: prescription_id ?? null,
    },
  })

  return res.json({
    cart_id: cartId,
    prescription_id: prescription_id ?? null,
    attached: !!prescription_id,
  })
}

/**
 * GET /store/carts/:id/prescription
 *
 * Returns the prescription currently attached to this cart (if any),
 * along with a flag indicating whether the cart contains Rx items.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id: cartId } = req.params

  const cartService = req.scope.resolve(Modules.CART) as any
  const cart = await cartService.retrieveCart(cartId, {
    relations: ["items"],
  })

  if (!cart) {
    return res.status(404).json({ error: "Cart not found" })
  }

  // Check if any cart items are Rx (H or H1 schedule)
  const productIds = (cart.items ?? [])
    .map((item: any) => item.product_id)
    .filter(Boolean)

  let hasRxItems = false
  const rxProductIds: string[] = []

  if (productIds.length > 0) {
    try {
      const { ContainerRegistrationKeys } = await import(
        "@medusajs/framework/utils"
      )
      const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
      const { data: drugProducts } = await query.graph({
        entity: "drug_product",
        fields: ["product_id", "schedule"],
        filters: { product_id: productIds },
      })

      for (const dp of drugProducts as any[]) {
        if (dp.schedule === "H" || dp.schedule === "H1") {
          hasRxItems = true
          rxProductIds.push(dp.product_id)
        }
      }
    } catch {
      // pharma module may not be loaded — treat as no Rx items
    }
  }

  const metadata = (cart.metadata as Record<string, any>) ?? {}
  const prescriptionId = metadata.prescription_id ?? null

  // If a prescription is attached, fetch its summary
  let prescription: Record<string, any> | null = null
  if (prescriptionId) {
    try {
      const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
      const [rx] = await prescriptionService.listPrescriptions({
        id: prescriptionId,
      })
      if (rx) {
        prescription = {
          id: rx.id,
          status: rx.status,
          original_filename: rx.original_filename,
          file_url: rx.file_url,
          created_at: rx.created_at,
          valid_until: rx.valid_until,
          doctor_name: rx.doctor_name,
          patient_name: rx.patient_name,
        }
      }
    } catch {
      // prescription module error — proceed without it
    }
  }

  return res.json({
    has_rx_items: hasRxItems,
    rx_product_ids: rxProductIds,
    prescription_id: prescriptionId,
    prescription,
  })
}
