import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../../../../modules/orders"

/**
 * Indian GSTIN format: 2-digit state code + 10-char PAN + 1 entity + 1 check digit + Z
 * Example: 36AABCU9603R1ZM
 */
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

/**
 * GET /store/orders/gstin?order_id=xxx
 * Returns the GSTIN stored for a given order (if any).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { order_id } = req.query as { order_id?: string }

  if (!order_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Query param 'order_id' is required"
    )
  }

  const orderService = req.scope.resolve(ORDERS_MODULE) as any

  const [extension] = await orderService.listOrderExtensions(
    { order_id },
    { take: 1 }
  )

  if (!extension) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No order extension found for order ${order_id}`
    )
  }

  res.json({
    order_id,
    gstin: extension.gstin || null,
  })
}

/**
 * POST /store/orders/gstin
 * Body: { order_id: string, gstin: string }
 *
 * Validates the GSTIN format (15-char Indian GSTIN) and saves it
 * to the order extension for B2B invoicing purposes.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { order_id, gstin } = req.body as {
    order_id?: string
    gstin?: string
  }

  if (!order_id) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Field 'order_id' is required"
    )
  }

  if (!gstin) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Field 'gstin' is required"
    )
  }

  // Normalize to uppercase and validate format
  const normalizedGstin = gstin.trim().toUpperCase()

  if (normalizedGstin.length !== 15) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "GSTIN must be exactly 15 characters"
    )
  }

  if (!GSTIN_REGEX.test(normalizedGstin)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid GSTIN format. Expected: 2-digit state code + PAN + entity code + Z + check digit (e.g. 36AABCU9603R1ZM)"
    )
  }

  const orderService = req.scope.resolve(ORDERS_MODULE) as any

  const [extension] = await orderService.listOrderExtensions(
    { order_id },
    { take: 1 }
  )

  if (!extension) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `No order extension found for order ${order_id}`
    )
  }

  await orderService.updateOrderExtensions(extension.id, {
    gstin: normalizedGstin,
  })

  res.json({
    order_id,
    gstin: normalizedGstin,
    message: "GSTIN saved successfully",
  })
}
