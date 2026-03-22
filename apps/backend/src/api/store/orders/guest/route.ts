import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { ORDERS_MODULE } from "../../../../modules/orders"

/**
 * POST /store/orders/guest — creates a guest checkout session.
 * Body: { email?: string, phone?: string }
 * Returns: { session_id, cart_id, expires_at }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { email, phone } = req.body as { email?: string; phone?: string }

  if (!phone && !email) {
    return res.status(400).json({ message: "Either email or phone is required" })
  }

  try {
    const orderService = req.scope.resolve(ORDERS_MODULE) as any
    const cartService = req.scope.resolve(Modules.CART) as any

    // Create a fresh cart for this guest session (India region, INR)
    const cart = await cartService.createCarts({
      currency_code: "inr",
    })

    // Session token for identifying the guest
    const sessionToken = crypto.randomUUID()

    // Guest sessions expire in 48 hours
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 48)

    const session = await orderService.createGuestSessions({
      session_token: sessionToken,
      phone: phone || "",
      email: email || null,
      cart_id: cart.id,
      expires_at: expiresAt,
    })

    res.status(201).json({
      session_id: session.id,
      session_token: session.session_token,
      cart_id: cart.id,
      expires_at: expiresAt.toISOString(),
    })
  } catch (err) {
    const message = (err as Error).message
    console.error("[store/orders/guest] POST error:", message)
    res.status(500).json({ message: "Failed to create guest session" })
  }
}

/**
 * GET /store/orders/guest?session_id=xxx — retrieves guest session details.
 * Returns the session info and associated cart.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const sessionId = req.query.session_id as string

  if (!sessionId) {
    return res.status(400).json({ message: "session_id query parameter is required" })
  }

  try {
    const orderService = req.scope.resolve(ORDERS_MODULE) as any

    const session = await orderService.retrieveGuestSession(sessionId)
    if (!session) {
      return res.status(404).json({ message: "Guest session not found" })
    }

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      return res.status(410).json({ message: "Guest session has expired" })
    }

    // Optionally load the cart if it exists
    let cart = null
    if (session.cart_id) {
      try {
        const cartService = req.scope.resolve(Modules.CART) as any
        cart = await cartService.retrieveCart(session.cart_id, {
          relations: ["items"],
        })
      } catch {
        // Cart may have been cleaned up
      }
    }

    res.json({
      session: {
        id: session.id,
        session_token: session.session_token,
        phone: session.phone,
        email: session.email,
        cart_id: session.cart_id,
        expires_at: session.expires_at,
        converted_to: session.converted_to,
      },
      cart,
    })
  } catch (err) {
    const message = (err as Error).message
    console.error("[store/orders/guest] GET error:", message)
    res.status(500).json({ message: "Failed to retrieve guest session" })
  }
}
