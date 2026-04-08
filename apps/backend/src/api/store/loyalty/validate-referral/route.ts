import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { LOYALTY_MODULE } from "../../../../modules/loyalty"

/**
 * GET /store/loyalty/validate-referral?code=SM-XXXXXX
 *
 * Public endpoint — validates a referral code and returns the referrer's
 * masked name so the signup page can show "Referred by N***l".
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const code = (req.query.code as string)?.trim()?.toUpperCase()

  if (!code) {
    return res.status(400).json({ valid: false, message: "code is required" })
  }

  try {
    const loyaltyService = req.scope.resolve(LOYALTY_MODULE) as any
    const customerService = req.scope.resolve(Modules.CUSTOMER) as any

    const [account] = await loyaltyService.listLoyaltyAccounts(
      { referral_code: code },
      { take: 1 }
    )

    if (!account) {
      return res.status(200).json({ valid: false })
    }

    // Get referrer's name (masked for privacy)
    let referrerName = "a friend"
    try {
      const customer = await customerService.retrieveCustomer(account.customer_id)
      const firstName = customer?.first_name || ""
      if (firstName.length > 2) {
        referrerName = firstName[0] + "***" + firstName[firstName.length - 1]
      } else if (firstName) {
        referrerName = firstName[0] + "***"
      }
    } catch {
      // Use default masked name
    }

    return res.status(200).json({
      valid: true,
      referrer_name: referrerName,
    })
  } catch (error: any) {
    return res.status(500).json({ valid: false, message: error.message })
  }
}
