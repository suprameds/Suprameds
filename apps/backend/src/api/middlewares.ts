import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { authenticate, defineMiddlewares } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { PHARMA_MODULE } from "../modules/pharma"

/**
 * Schedule X block — stateless API middleware.
 *
 * Blocks adding Schedule X / narcotic products to cart at the HTTP layer.
 * NDPS Act, 1985: absolute prohibition on online sale of Schedule X / narcotic substances.
 *
 * Runs on POST /store/carts/:id/line-items. Workflow hook (addToCartWorkflow.validate)
 * provides a second layer of enforcement.
 */
async function scheduleXBlockAddToCart(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  const variantId = (req.body as { variant_id?: string })?.variant_id
  if (!variantId) return next()

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const pharmaService = req.scope.resolve(PHARMA_MODULE)

  const { data: variants } = await query.graph({
    entity: "variants",
    fields: ["id", "product_id"],
    filters: { id: [variantId] },
  })

  const variant = (variants as { id: string; product_id?: string }[])?.[0]
  const productId = variant?.product_id
  if (!productId) return next()

  let drugProducts: any[]
  try {
    drugProducts = await pharmaService.listDrugProducts({ product_id: productId })
  } catch {
    return next()
  }

  if (!drugProducts?.length) return next()
  const drug = drugProducts[0]

  if (drug.schedule === "X" || drug.is_narcotic) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This product cannot be sold online. NDPS Act, 1985 prohibits online sale of Schedule X / narcotic substances."
    )
  }

  if (drug.requires_refrigeration) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This product requires cold chain storage which is not available through our delivery network."
    )
  }

  next()
}

export default defineMiddlewares({
  routes: [
    {
      matcher: "/store/carts/:id/line-items",
      method: "POST",
      middlewares: [scheduleXBlockAddToCart],
    },
    {
      matcher: "/webhooks/razorpay",
      method: "POST",
      bodyParser: { preserveRawBody: true },
    },
    // Prescription upload needs a larger body limit for base64 image data
    {
      matcher: "/store/prescriptions",
      method: "POST",
      bodyParser: { sizeLimit: "15mb" },
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/prescriptions",
      method: "GET",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/prescriptions/:id",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Cart prescription endpoint — auth optional (GET works for anyone, POST needs customer)
    {
      matcher: "/store/carts/:id/prescription",
      middlewares: [authenticate("customer", ["bearer", "session"], { allowUnauthenticated: true })],
    },
  ],
})
