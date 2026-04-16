import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createCartWorkflow,
  updateCartWorkflow,
  addShippingMethodToCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  completeCartWorkflow,
  createPaymentSessionsWorkflow,
} from "@medusajs/medusa/core-flows"
import { PRESCRIPTION_MODULE } from "../../../../../modules/prescription"
import { PHARMA_MODULE } from "../../../../../modules/pharma"
import { createLogger } from "../../../../../lib/logger"

const logger = createLogger("store:pharmacist:orders:create")
const SYSTEM_DEFAULT_PROVIDER = "pp_system_default"

interface CreateOrderBody {
  customer_id: string
  items: Array<{ variant_id: string; quantity: number }>
  shipping_address: {
    first_name?: string
    last_name?: string
    address_1: string
    address_2?: string
    city: string
    province?: string
    postal_code: string
    country_code?: string
    phone?: string
  }
  prescription_id?: string
  notes?: string
}

/**
 * POST /store/pharmacist/orders/create
 * Pharmacist creates a full COD order on behalf of a customer.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = req.body as CreateOrderBody
  const pharmacistId = (req as any).auth_context?.actor_id || "unknown"

  // 1. Validate input
  if (!body.customer_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "customer_id is required.")
  }
  if (!body.items?.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "At least one item is required.")
  }
  if (!body.shipping_address?.address_1 || !body.shipping_address?.city || !body.shipping_address?.postal_code) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "shipping_address with address_1, city, and postal_code is required."
    )
  }

  // 2. Validate customer
  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  let customer: any
  try {
    customer = await customerService.retrieveCustomer(body.customer_id)
  } catch {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Customer ${body.customer_id} not found.`)
  }

  if (!customer.email) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Customer has no email address.")
  }

  // 3. Check items for blocked products
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const pharmaService = req.scope.resolve(PHARMA_MODULE) as any

  const variantIds = body.items.map((i) => i.variant_id)
  const { data: variants } = await query.graph({
    entity: "variants",
    fields: ["id", "product_id"],
    filters: { id: variantIds },
  })
  const productIds = (variants as Array<{ id: string; product_id?: string }>)
    .map((v) => v.product_id)
    .filter(Boolean) as string[]

  let hasRxItems = false

  if (productIds.length) {
    let drugProducts: any[] = []
    try {
      drugProducts = await pharmaService.listDrugProducts({ product_id: productIds })
    } catch {
      /* OTC products — no drug_product records */
    }

    for (const drug of drugProducts) {
      if (drug.schedule === "X" || drug.is_narcotic) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Cannot sell ${drug.generic_name || "this product"} online. NDPS Act prohibition.`
        )
      }
      if (drug.requires_refrigeration) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `${drug.generic_name || "This product"} requires cold chain storage.`
        )
      }
      if (drug.schedule === "H" || drug.schedule === "H1") {
        hasRxItems = true
      }
    }
  }

  // 4. Rx gate
  if (hasRxItems && !body.prescription_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Prescription is required for Schedule H/H1 items. Provide prescription_id."
    )
  }

  if (body.prescription_id) {
    const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
    const [rx] = await prescriptionService.listPrescriptions(
      { id: body.prescription_id },
      { take: 1 }
    )
    if (!rx) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Prescription ${body.prescription_id} not found.`)
    }
    if (rx.status !== "approved" && rx.status !== "pending_review") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `Prescription must be approved or pending_review. Current: ${rx.status}`
      )
    }
  }

  // 5. Resolve India region
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { currency_code: "inr" },
  })
  const indiaRegion = (regions as Array<{ id: string }>)?.[0]
  if (!indiaRegion) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "India region (INR) not found.")
  }

  // 6. Create cart with items
  const addressPayload = {
    first_name: body.shipping_address.first_name || customer.first_name || "Customer",
    last_name: body.shipping_address.last_name || customer.last_name || "",
    address_1: body.shipping_address.address_1,
    address_2: body.shipping_address.address_2 || "",
    city: body.shipping_address.city,
    province: body.shipping_address.province || "",
    postal_code: body.shipping_address.postal_code,
    country_code: body.shipping_address.country_code || "in",
    phone: body.shipping_address.phone || customer.phone || "",
  }

  logger.info(`Creating cart for customer ${body.customer_id}, pharmacist ${pharmacistId}`)

  const { result: cart } = await createCartWorkflow(req.scope).run({
    input: {
      region_id: indiaRegion.id,
      customer_id: body.customer_id,
      email: customer.email,
      currency_code: "inr",
      metadata: {
        pharmacist_order: true,
        placed_by: pharmacistId,
        prescription_id: body.prescription_id || null,
        notes: body.notes || "",
      },
      items: body.items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
    },
  })

  logger.info(`Cart created: ${cart.id}`)

  try {
    // 7. Set addresses
    await updateCartWorkflow(req.scope).run({
      input: { id: cart.id, shipping_address: addressPayload, billing_address: addressPayload },
    })

    // 8. Add shipping method
    const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT) as any
    const shippingOptions = await fulfillmentService.listShippingOptions({}, { take: 10 })
    const shippingOption =
      shippingOptions.find((o: any) => o.name === "Standard Shipping (India)") || shippingOptions[0]

    if (!shippingOption) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "No shipping option available.")
    }

    await addShippingMethodToCartWorkflow(req.scope).run({
      input: { cart_id: cart.id, options: [{ id: shippingOption.id }] },
    })

    // 9. COD payment
    const { result: paymentCollection } = await createPaymentCollectionForCartWorkflow(req.scope).run({
      input: { cart_id: cart.id },
    })

    await createPaymentSessionsWorkflow(req.scope).run({
      input: { payment_collection_id: paymentCollection.id, provider_id: SYSTEM_DEFAULT_PROVIDER },
    })

    // 10. Complete cart → create order
    const { result: orderResult } = await completeCartWorkflow(req.scope).run({
      input: { id: cart.id },
    })

    const orderId = orderResult.id
    logger.info(`Order created: ${orderId} for customer ${body.customer_id}`)

    // Retrieve order to get display_id and total
    const orderService = req.scope.resolve(Modules.ORDER) as any
    let displayId: number | undefined
    let total: number | undefined
    try {
      const order = await orderService.retrieveOrder(orderId)
      displayId = order.display_id
      total = order.total
    } catch (err) {
      logger.warn(`Failed to retrieve order details: ${(err as Error).message}`)
    }

    // 11. Return
    return res.status(201).json({
      order_id: orderId,
      display_id: displayId,
      total,
      message: "Order created successfully.",
    })
  } catch (err) {
    logger.error(`Order creation failed for customer ${body.customer_id} (cart ${cart.id}): ${(err as Error).message}`)
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, `Order creation failed: ${(err as Error).message}`)
  }
}
