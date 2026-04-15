import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils"

/**
 * Custom cart completion route that checks for an existing order BEFORE
 * touching the workflow engine.
 *
 * Why: Medusa's built-in complete-cart workflow acquires an in-memory lock
 * as its FIRST step. If the lock is stuck (leaked from a previous attempt),
 * the retry can never check whether the order was already created. This
 * route performs that check pre-lock, so stale locks don't strand the user.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const cart_id = req.params.id

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
  const logger = req.scope.resolve("logger") as any

  // ── 1. Check if this cart already has a completed order ──
  // This query hits the DB directly — no locks, no workflow engine.
  try {
    const { data: orderCartLink } = await query.graph({
      entity: "order_cart",
      fields: ["order_id"],
      filters: { cart_id },
    })

    const existingOrderId = Array.isArray(orderCartLink)
      ? orderCartLink[0]?.order_id
      : orderCartLink?.order_id

    if (existingOrderId) {
      logger.info(
        `[complete-cart] Cart ${cart_id} already completed → order ${existingOrderId}. Returning existing order.`
      )

      const { data: orders } = await query.graph({
        entity: "order",
        fields: req.queryConfig?.fields || [
          "id",
          "display_id",
          "status",
          "total",
          "currency_code",
          "created_at",
          "*items",
          "*shipping_address",
          "*billing_address",
          "*shipping_methods",
        ],
        filters: { id: existingOrderId },
      })

      const order = Array.isArray(orders) ? orders[0] : orders
      if (order) {
        return res.status(200).json({ type: "order", order })
      }
      // Order link exists but order not found — fall through to workflow
    }
  } catch (err: any) {
    // order_cart query failed — non-fatal, fall through to normal workflow
    logger.warn(
      `[complete-cart] Pre-check for existing order failed: ${err.message}. Proceeding with workflow.`
    )
  }

  // ── 2. No existing order — run the standard Medusa completion workflow ──
  const we = req.scope.resolve(Modules.WORKFLOW_ENGINE) as any

  const { errors, result, transaction } = await we.run(
    "complete-cart",
    {
      input: { id: cart_id },
      throwOnError: false,
    }
  )

  if (!transaction.hasFinished()) {
    // Workflow is still running from a previous request.
    // Instead of throwing immediately, wait and re-check for the order.
    logger.info(
      `[complete-cart] Cart ${cart_id} workflow in progress. Waiting 5s then re-checking for order.`
    )

    await new Promise((r) => setTimeout(r, 5000))

    try {
      const { data: orderCartLink } = await query.graph({
        entity: "order_cart",
        fields: ["order_id"],
        filters: { cart_id },
      })

      const orderId = Array.isArray(orderCartLink)
        ? orderCartLink[0]?.order_id
        : orderCartLink?.order_id

      if (orderId) {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: req.queryConfig?.fields || [
            "id",
            "display_id",
            "status",
            "total",
            "currency_code",
            "created_at",
            "*items",
            "*shipping_address",
            "*billing_address",
            "*shipping_methods",
          ],
          filters: { id: orderId },
        })

        const order = Array.isArray(orders) ? orders[0] : orders
        if (order) {
          logger.info(
            `[complete-cart] Cart ${cart_id} completed during wait → order ${orderId}`
          )
          return res.status(200).json({ type: "order", order })
        }
      }
    } catch {
      // Re-check failed — fall through to conflict error
    }

    throw new MedusaError(
      MedusaError.Types.CONFLICT,
      "Cart is already being completed by another request"
    )
  }

  // ── 3. Handle workflow errors ──
  if (errors?.[0]) {
    const error = errors[0].error as any

    const statusOKErrors = [
      MedusaError.Types.PAYMENT_AUTHORIZATION_ERROR,
      (MedusaError.Types as any).PAYMENT_REQUIRES_MORE_ERROR,
    ].filter(Boolean)

    const remoteQuery = req.scope.resolve(
      ContainerRegistrationKeys.REMOTE_QUERY
    ) as any
    const queryObject = remoteQueryObjectFromString({
      entryPoint: "cart",
      variables: { filters: { id: cart_id } },
      fields: req.queryConfig?.fields || [
        "id",
        "*items",
        "total",
        "currency_code",
        "completed_at",
      ],
    })
    const [cart] = await remoteQuery(queryObject)

    if (!statusOKErrors.includes(error?.type)) {
      throw error
    }

    return res.status(200).json({
      type: "cart",
      cart,
      error: {
        message: error.message,
        name: error.name,
        type: error.type,
      },
    })
  }

  // ── 4. Success — return the created order ──
  const { data } = await query.graph({
    entity: "order",
    fields: req.queryConfig?.fields || [
      "id",
      "display_id",
      "status",
      "total",
      "currency_code",
      "created_at",
      "*items",
      "*shipping_address",
      "*billing_address",
      "*shipping_methods",
    ],
    filters: { id: result.id },
  })

  res.status(200).json({
    type: "order",
    order: data[0],
  })
}
