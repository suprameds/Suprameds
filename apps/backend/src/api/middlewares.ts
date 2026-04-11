import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"
import { authenticate, defineMiddlewares } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { PHARMA_MODULE } from "../modules/pharma"
import { createRateLimiter } from "./rate-limiter"
import { securityHeaders } from "./security-headers"
import { authorize, enforceSsd } from "./rbac-authorize"
import { getPrescriptionUploader, getGrnCreator, getPoRaiser } from "./rbac-ssd-helpers"
// Sentry — must be imported early so auto-instrumentation hooks attach before routes load
import "../lib/sentry"
import { sentryErrorHandler } from "../lib/sentry"
import { requireMfa } from "./admin/middlewares/mfa-guard"
import { requirePharmacistRole } from "./store/pharmacist/guard"

/**
 * Password strength validation middleware for registration.
 * Enforces: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit.
 */
function validatePasswordStrength(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const { password } = (req.body || {}) as { password?: string }
  if (!password) return next() // let Medusa handle missing password error

  const errors: string[] = []
  if (password.length < 8) errors.push("at least 8 characters")
  if (!/[A-Z]/.test(password)) errors.push("one uppercase letter")
  if (!/[a-z]/.test(password)) errors.push("one lowercase letter")
  if (!/\d/.test(password)) errors.push("one digit")

  if (errors.length > 0) {
    return res.status(400).json({
      type: "invalid_data",
      message: `Password must contain ${errors.join(", ")}.`,
    })
  }
  next()
}

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
  const pharmaService = req.scope.resolve(PHARMA_MODULE) as any

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
    // ── Security headers — applied to every response ──────────────────────
    {
      matcher: "/**",
      middlewares: [securityHeaders()],
    },
    // ── Password strength on registration ───────────────────────────────
    {
      matcher: "/auth/customer/emailpass/register",
      method: "POST",
      middlewares: [validatePasswordStrength],
    },
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
    {
      matcher: "/webhooks/paytm",
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
    // Prescription file upload to S3/R2 via file module (base64 in JSON body)
    {
      matcher: "/store/prescriptions/upload-file",
      method: "POST",
      bodyParser: { sizeLimit: "15mb" },
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Loyalty points redemption on cart
    {
      matcher: "/store/carts/:id/loyalty-redeem",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // ── Pharmacist storefront routes — customer auth + role check ──────
    {
      matcher: "/store/pharmacist/*",
      middlewares: [
        authenticate("customer", ["bearer", "session"]),
        requirePharmacistRole(),
      ],
    },

    // Pincode CSV import — large payload (155K+ rows as JSON ≈ 40MB)
    {
      matcher: "/admin/pincodes/import",
      method: "POST",
      bodyParser: { sizeLimit: "50mb" },
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
    {
      matcher: "/store/push/*",
      method: "POST",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Shipment tracking — authenticated customers only
    {
      matcher: "/store/shipments",
      method: "GET",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Customer invoice PDF download — authenticated customers only
    {
      matcher: "/store/invoices/:orderId/pdf",
      method: "GET",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Customer invoice email — authenticated customers only
    {
      matcher: "/store/invoices/:orderId/email",
      method: "POST",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Refill reminders — authenticated customers only
    {
      matcher: "/store/reminders",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/reminders/:id",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Wishlist — authenticated customers only
    {
      matcher: "/store/wishlist*",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Notifications — authenticated customers only
    {
      matcher: "/store/notifications",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/notifications/:id/read",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Wallet — authenticated customers only
    {
      matcher: "/store/wallet",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/wallet/apply",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/wallet/remove",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Loyalty — authenticated customers only (except validate-referral which is public for signup)
    {
      matcher: "/store/loyalty/account",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // AfterShip webhook — preserve raw body for HMAC signature verification
    {
      matcher: "/webhooks/aftership",
      method: "POST",
      bodyParser: { preserveRawBody: true },
    },
    // ── Rate limiting ────────────────────────────────────────────────
    // OTP send: 3 requests per 10 minutes per IP
    {
      matcher: "/store/otp/send",
      method: "POST",
      middlewares: [
        createRateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 3 }),
      ],
    },
    // OTP verify: 10 requests per 10 minutes per IP
    {
      matcher: "/store/otp/verify",
      method: "POST",
      middlewares: [
        createRateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 10 }),
      ],
    },
    // Prescription upload: 5 requests per minute per IP
    {
      matcher: "/store/prescriptions",
      method: "POST",
      middlewares: [
        createRateLimiter({ windowMs: 60 * 1000, maxRequests: 5 }),
      ],
    },
    // Prescription file upload: 5 requests per minute per IP
    {
      matcher: "/store/prescriptions/upload-file",
      method: "POST",
      middlewares: [
        createRateLimiter({ windowMs: 60 * 1000, maxRequests: 5 }),
      ],
    },
    // Loyalty: 10 req/min per IP
    {
      matcher: "/store/loyalty/account",
      method: "GET",
      middlewares: [
        createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 }),
      ],
    },
    // Referral validation: 20 req/min per IP (public endpoint)
    {
      matcher: "/store/loyalty/validate-referral",
      method: "GET",
      middlewares: [
        createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20 }),
      ],
    },
    // MSG91 webhook — no auth, but preserve body
    {
      matcher: "/webhooks/msg91",
      method: "POST",
      bodyParser: { preserveRawBody: true },
    },
    // WhatsApp webhook — preserve raw body for X-Hub-Signature-256 verification
    {
      matcher: "/webhooks/whatsapp",
      method: "POST",
      bodyParser: { preserveRawBody: true },
    },
    // Admin rate limiting: 30 requests per minute per IP (prevents query bombing)
    {
      matcher: "/admin/analytics/*",
      method: "GET",
      middlewares: [
        createRateLimiter({ windowMs: 60 * 1000, maxRequests: 30 }),
      ],
    },
    {
      matcher: "/admin/compliance/*",
      method: "POST",
      middlewares: [
        createRateLimiter({ windowMs: 60 * 1000, maxRequests: 20 }),
      ],
    },
    {
      matcher: "/admin/rbac/*",
      method: "POST",
      middlewares: [
        createRateLimiter({ windowMs: 60 * 1000, maxRequests: 10 }),
      ],
    },

    // ── Admin self-registration — NO auth required ──────────────────────
    // Must appear before the /admin/* MFA guard so it's accessible to anonymous users.
    // Uses allowUnauthenticated to bypass Medusa's default admin auth middleware.
    {
      matcher: "/admin/auth/register",
      method: "POST",
      middlewares: [
        authenticate("user", ["bearer", "session"], { allowUnauthenticated: true }),
        createRateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 5 }),
      ],
    },

    // ── MFA enforcement for admin routes ──
    // Enforces TOTP verification for roles that require it.
    // Gracefully skips if RBAC tables haven't been migrated yet.
    {
      matcher: "/admin/*",
      middlewares: [requireMfa()],
    },

    // ── RBAC authorization for admin routes ───────────────────────────

    // Prescriptions — pharmacist create-order requires order:create permission
    {
      matcher: "/admin/prescriptions/:id/create-order",
      method: "POST",
      middlewares: [authorize("order", "create")],
    },

    // Prescriptions — approve/reject requires permission + SSD-01
    {
      matcher: "/admin/prescriptions/:id",
      method: "POST",
      middlewares: [
        authorize("prescription", "approve"),
        enforceSsd("SSD-01", getPrescriptionUploader),
      ],
    },

    // Pharma batches — recall requires permission
    {
      matcher: "/admin/pharma/batches/:id/recall",
      method: "POST",
      middlewares: [authorize("batch", "update")],
    },

    // GRN — approve requires permission + SSD-02
    {
      matcher: "/admin/warehouse/grn",
      method: "POST",
      middlewares: [
        authorize("grn", "approve"),
        enforceSsd("SSD-02", getGrnCreator),
      ],
    },

    // Purchase orders — receive requires permission + SSD-03
    {
      matcher: "/admin/pharma/purchases/:id/receive",
      method: "POST",
      middlewares: [
        authorize("purchase_order", "approve"),
        enforceSsd("SSD-03", getPoRaiser),
      ],
    },

    // Orders — returns require permission
    {
      matcher: "/admin/orders/returns",
      method: "POST",
      middlewares: [authorize("order", "update")],
    },

    // Shipments — create requires permission
    {
      matcher: "/admin/shipments",
      method: "POST",
      middlewares: [authorize("shipment", "create")],
    },

    // Dispense — decisions require clinical permission
    {
      matcher: "/admin/dispense/decisions",
      method: "POST",
      middlewares: [authorize("dispense", "create")],
    },

    // Dispense — pre-dispatch sign-off requires pharmacist permission
    {
      matcher: "/admin/dispense/pre-dispatch",
      method: "POST",
      middlewares: [authorize("dispense", "approve")],
    },

    // Override requests — approval requires compliance permission
    {
      matcher: "/admin/compliance/override-requests",
      method: "POST",
      middlewares: [authorize("override", "approve")],
    },

    // RBAC management — role assignment requires role:create permission
    {
      matcher: "/admin/rbac/assign",
      method: "POST",
      middlewares: [authorize("role", "create")],
    },
    {
      matcher: "/admin/rbac/revoke",
      method: "POST",
      middlewares: [authorize("role", "delete")],
    },

    // Signup request review — requires role:write permission
    {
      matcher: "/admin/rbac/signup-requests/*/review",
      method: "POST",
      middlewares: [authorize("role", "write")],
    },

    // Analytics — read requires permission
    {
      matcher: "/admin/analytics/*",
      method: "GET",
      middlewares: [authorize("analytics", "read")],
    },

    // Loyalty — management requires permission
    {
      matcher: "/admin/loyalty",
      method: "GET",
      middlewares: [authorize("loyalty", "read")],
    },

    // H1 Register — export requires permission
    {
      matcher: "/admin/dispense/h1-register/export",
      method: "GET",
      middlewares: [authorize("h1_register", "export")],
    },

    // Reports — requires permission
    {
      matcher: "/admin/reports/*",
      method: "GET",
      middlewares: [authorize("report", "read")],
    },

    // Product import/export requires permission
    {
      matcher: "/admin/pharma/import",
      method: "POST",
      middlewares: [authorize("product", "import")],
    },
    {
      matcher: "/admin/pharma/import/batch",
      method: "POST",
      bodyParser: { sizeLimit: "50mb" },
      middlewares: [authorize("product", "import")],
    },
    {
      matcher: "/admin/pharma/export",
      method: "GET",
      middlewares: [authorize("product", "export")],
    },

    // ── Customer document verification routes ──────────────────────────
    // Document upload needs a larger body limit for base64 image data
    {
      matcher: "/store/documents/upload",
      method: "POST",
      bodyParser: { sizeLimit: "15mb" },
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    {
      matcher: "/store/documents/upload",
      method: "POST",
      middlewares: [
        createRateLimiter({ windowMs: 60 * 1000, maxRequests: 5 }),
      ],
    },
    {
      matcher: "/store/documents",
      method: "GET",
      middlewares: [authenticate("customer", ["bearer", "session"])],
    },
    // Admin document review routes
    {
      matcher: "/admin/documents",
      method: "GET",
      middlewares: [authorize("compliance", "read")],
    },
    {
      matcher: "/admin/documents/:id/review",
      method: "POST",
      middlewares: [authorize("compliance", "write")],
    },

    // ── Sentry error handler — MUST be last to catch unhandled route errors ──
    {
      matcher: "/**",
      middlewares: [sentryErrorHandler as any],
    },
  ],
})
