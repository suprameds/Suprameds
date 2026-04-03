import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import {
  createCartWorkflow,
  updateCartWorkflow,
  addShippingMethodToCartWorkflow,
  createPaymentCollectionForCartWorkflow,
  completeCartWorkflow,
} from "@medusajs/medusa/core-flows"
import { createPaymentSessionsWorkflow } from "@medusajs/medusa/core-flows"
import { PRESCRIPTION_MODULE } from "../../../../../modules/prescription"
import { PHARMA_MODULE } from "../../../../../modules/pharma"
import { createLogger } from "../../../../../lib/logger"

const logger = createLogger("admin:prescriptions:create-order")

const SYSTEM_DEFAULT_PROVIDER = "pp_system_default"

interface CreateOrderBody {
  items: Array<{ variant_id: string; quantity: number }>
  shipping_address?: {
    first_name: string
    last_name: string
    address_1: string
    address_2?: string
    city: string
    province?: string
    postal_code: string
    country_code: string
    phone?: string
  }
  notes?: string
}

/**
 * POST /admin/prescriptions/:id/create-order
 *
 * Pharmacist creates an order on behalf of a customer from an approved prescription.
 * Uses COD payment. Triggers the existing completeCartWorkflow which links
 * the prescription to the order automatically.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id: prescriptionId } = req.params
  const body = req.body as CreateOrderBody
  const pharmacistId = req.auth_context?.actor_id || "unknown"

  // ── 1. Validate request ────────────────────────────────────────────────
  if (!body.items?.length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "At least one item is required.")
  }

  // ── 2. Validate prescription ───────────────────────────────────────────
  const prescriptionService = req.scope.resolve(PRESCRIPTION_MODULE) as any
  const [rx] = await prescriptionService.listPrescriptions(
    { id: prescriptionId },
    { relations: ["lines"], take: 1 }
  )

  if (!rx) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Prescription ${prescriptionId} not found.`)
  }
  if (rx.status !== "approved") {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      `Prescription must be approved before creating an order. Current status: ${rx.status}`
    )
  }
  if (!rx.customer_id) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Cannot create an order for a guest prescription. Customer account is required."
    )
  }

  // ── 3. Validate items: block Schedule X / narcotic / cold chain ────────
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

  if (productIds.length) {
    let drugProducts: any[] = []
    try {
      drugProducts = await pharmaService.listDrugProducts({ product_id: productIds })
    } catch {
      // No drug data — OTC products, proceed
    }

    for (const drug of drugProducts) {
      if (drug.schedule === "X" || drug.is_narcotic) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `Cannot sell ${drug.generic_name || "this product"} online. Schedule X / NDPS Act prohibition.`
        )
      }
      if (drug.requires_refrigeration) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          `${drug.generic_name || "This product"} requires cold chain storage which is not available.`
        )
      }
    }
  }

  // ── 4. Resolve customer ────────────────────────────────────────────────
  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  let customer: any
  try {
    customer = await customerService.retrieveCustomer(rx.customer_id, {
      relations: ["addresses"],
    })
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Customer ${rx.customer_id} not found.`
    )
  }

  if (!customer.email) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Customer has no email address. Cannot create order."
    )
  }

  // Resolve shipping address: use body address, or customer's default, or first saved
  const shippingAddress = body.shipping_address
    || (customer.addresses?.find((a: any) => a.is_default_shipping) ?? customer.addresses?.[0])

  if (!shippingAddress) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "No shipping address available. Provide one in the request or ensure the customer has a saved address."
    )
  }

  const addressPayload = {
    first_name: shippingAddress.first_name || customer.first_name || "Customer",
    last_name: shippingAddress.last_name || customer.last_name || "",
    address_1: shippingAddress.address_1,
    address_2: shippingAddress.address_2 || "",
    city: shippingAddress.city,
    province: shippingAddress.province || "",
    postal_code: shippingAddress.postal_code,
    country_code: shippingAddress.country_code || "in",
    phone: shippingAddress.phone || customer.phone || "",
  }

  // ── 5. Resolve India region ────────────────────────────────────────────
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { currency_code: "inr" },
  })
  const indiaRegion = (regions as Array<{ id: string }>)?.[0]
  if (!indiaRegion) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "India region (INR) not found.")
  }

  // ── 6. Create cart with items ──────────────────────────────────────────
  logger.info(`Creating cart for Rx ${prescriptionId}, customer ${rx.customer_id}`)

  const { result: cart } = await createCartWorkflow(req.scope).run({
    input: {
      region_id: indiaRegion.id,
      customer_id: rx.customer_id,
      email: customer.email,
      currency_code: "inr",
      metadata: {
        prescription_id: prescriptionId,
        created_by_pharmacist: true,
        pharmacist_id: pharmacistId,
        pharmacist_notes: body.notes || "",
      },
      items: body.items.map((item) => ({
        variant_id: item.variant_id,
        quantity: item.quantity,
      })),
    },
  })

  logger.info(`Cart created: ${cart.id}`)

  try {
    // ── 7. Set shipping address ────────────────────────────────────────
    await updateCartWorkflow(req.scope).run({
      input: {
        id: cart.id,
        shipping_address: addressPayload,
        billing_address: addressPayload,
      },
    })

    // ── 8. Add shipping method ─────────────────────────────────────────
    // Find the default shipping option for this region
    const fulfillmentService = req.scope.resolve(Modules.FULFILLMENT) as any
    const shippingOptions = await fulfillmentService.listShippingOptions(
      {},
      { take: 10 }
    )

    // Prefer the calculated "Standard Shipping (India)" option
    const shippingOption = shippingOptions.find(
      (o: any) => o.name === "Standard Shipping (India)"
    ) || shippingOptions[0]

    if (!shippingOption) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "No shipping option available.")
    }

    await addShippingMethodToCartWorkflow(req.scope).run({
      input: {
        cart_id: cart.id,
        options: [{ id: shippingOption.id }],
      },
    })

    // ── 9. Create payment collection ───────────────────────────────────
    const { result: paymentCollection } = await createPaymentCollectionForCartWorkflow(
      req.scope
    ).run({
      input: { cart_id: cart.id },
    })

    // ── 10. Create COD payment session ─────────────────────────────────
    await createPaymentSessionsWorkflow(req.scope).run({
      input: {
        payment_collection_id: paymentCollection.id,
        provider_id: SYSTEM_DEFAULT_PROVIDER,
      },
    })

    // ── 11. Complete cart → create order ────────────────────────────────
    // The existing completeCartWorkflow.hooks.orderCreated in
    // link-prescription-on-complete.ts will automatically link
    // the prescription to the order via cart.metadata.prescription_id
    const { result: orderResult } = await completeCartWorkflow(req.scope).run({
      input: { id: cart.id },
    })

    const orderId = orderResult.id
    logger.info(`Order created: ${orderId} from Rx ${prescriptionId}`)

    // ── 12. Update prescription status to "used" ───────────────────────
    try {
      await prescriptionService.updatePrescriptions({
        id: prescriptionId,
        status: "used",
      })
    } catch (err) {
      logger.warn(
        `Failed to update Rx ${prescriptionId} status to "used": ${(err as Error).message}`
      )
    }

    // ── 13. Emit event for notifications ───────────────────────────────
    try {
      const eventBus = req.scope.resolve(Modules.EVENT_BUS) as any
      await eventBus.emit({
        name: "pharmacist-order.created",
        data: {
          order_id: orderId,
          prescription_id: prescriptionId,
          customer_id: rx.customer_id,
          pharmacist_id: pharmacistId,
        },
      })
    } catch (err) {
      logger.warn(`Failed to emit pharmacist-order.created: ${(err as Error).message}`)
    }

    return res.status(201).json({
      order_id: orderId,
      prescription_id: prescriptionId,
      message: "Order created successfully.",
    })
  } catch (err) {
    // If any step after cart creation fails, log the error
    // The cart will be orphaned but that's acceptable — Medusa handles cleanup
    logger.error(
      `Order creation failed for Rx ${prescriptionId} (cart ${cart.id}): ${(err as Error).message}`
    )
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Order creation failed: ${(err as Error).message}`
    )
  }
}
