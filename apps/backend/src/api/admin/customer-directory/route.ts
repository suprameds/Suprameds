import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * GET /admin/customer-directory
 *
 * Returns the same shape Medusa's /admin/customers does, but enriched with
 * the most recent device snapshot from auth_identity.app_metadata.last_devices.
 *
 * Used by the Customer Directory admin extension page so the table can show
 * "last login device" alongside Email / Name / Phone / Account / Created.
 *
 * The device data is captured by /store/otp/verify on every OTP login.
 * Email/password logins don't capture it yet (Medusa's built-in route).
 *
 * Query params: limit, offset, q (passed through to listAndCountCustomers).
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { limit = 25, offset = 0, q } = req.query as {
    limit?: number | string
    offset?: number | string
    q?: string
  }

  const customerService = req.scope.resolve(Modules.CUSTOMER) as any
  const authService = req.scope.resolve(Modules.AUTH) as any

  // 1. Fetch customers
  const [customers, count] = await customerService.listAndCountCustomers(
    q
      ? {
          $or: [
            { email: { $ilike: `%${q}%` } },
            { first_name: { $ilike: `%${q}%` } },
            { last_name: { $ilike: `%${q}%` } },
            { phone: { $ilike: `%${q}%` } },
          ],
        }
      : {},
    {
      take: Number(limit),
      skip: Number(offset),
      order: { created_at: "DESC" },
    }
  )

  if (customers.length === 0) {
    return res.json({ customers: [], count, offset: Number(offset), limit: Number(limit) })
  }

  // 2. Fetch all auth_identity rows whose app_metadata.customer_id is in our set.
  //    Medusa's MikroORM JSONB query support is limited, so we list and filter.
  //    Identities are small (≤2 per customer for our OTP+email flows), so this is cheap.
  const customerIds = customers.map((c: { id: string }) => c.id)
  const [identities] = await authService.listAndCountAuthIdentities({}, { take: 1000 })

  // Build a customer_id → most-recent-device map
  const lastDeviceByCustomer = new Map<string, any>()
  for (const ident of identities as Array<{ app_metadata?: Record<string, unknown> }>) {
    const meta = ident.app_metadata || {}
    const cid = meta.customer_id as string | undefined
    if (!cid || !customerIds.includes(cid)) continue
    const devices = (meta.last_devices as any[]) || []
    if (devices.length === 0) continue
    const latest = devices[0]
    const existing = lastDeviceByCustomer.get(cid)
    if (!existing || (latest?.at && existing?.at && latest.at > existing.at)) {
      lastDeviceByCustomer.set(cid, latest)
    }
  }

  // 3. Stitch
  const enriched = customers.map((c: { id: string }) => ({
    ...c,
    last_device: lastDeviceByCustomer.get(c.id) || null,
  }))

  return res.json({
    customers: enriched,
    count,
    offset: Number(offset),
    limit: Number(limit),
  })
}
