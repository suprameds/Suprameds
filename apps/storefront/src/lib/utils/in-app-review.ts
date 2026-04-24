import { isNativeApp } from "@/lib/utils/capacitor"

const ORDER_COUNT_KEY = "suprameds_successful_orders"
const LAST_PROMPT_KEY = "suprameds_review_prompt_at"
const DISMISSED_KEY = "suprameds_review_dismissed"
const PROMPT_AFTER_ORDERS = 3
const RE_PROMPT_DAYS = 120

function daysSince(ts: number) {
  return (Date.now() - ts) / (1000 * 60 * 60 * 24)
}

/**
 * Increments the successful-order counter and prompts the user to review the
 * app on Play Store after their Nth successful order. Google's Play In-App
 * Review API has no Capacitor plugin in our deps, so we fall back to:
 *  - a branded confirm() dialog, then
 *  - deep-linking to Play Store listing via market:// intent.
 *
 * Safe no-op on web and when the user has already dismissed twice.
 */
export async function maybePromptReview() {
  if (!isNativeApp()) return

  try {
    const count = Number(localStorage.getItem(ORDER_COUNT_KEY) || "0") + 1
    localStorage.setItem(ORDER_COUNT_KEY, String(count))

    if (count < PROMPT_AFTER_ORDERS) return
    if (localStorage.getItem(DISMISSED_KEY) === "permanent") return

    const lastPromptedAt = Number(localStorage.getItem(LAST_PROMPT_KEY) || "0")
    if (lastPromptedAt && daysSince(lastPromptedAt) < RE_PROMPT_DAYS) return

    localStorage.setItem(LAST_PROMPT_KEY, String(Date.now()))

    const ok = window.confirm(
      "Enjoying Suprameds? Would you take a moment to rate us on Play Store? It helps more patients find reliable medicines."
    )
    if (!ok) {
      // Mark "dismissed" so we back off \u2014 next prompt waits the full re-prompt window.
      const dismissals = Number(localStorage.getItem("suprameds_review_dismiss_count") || "0") + 1
      localStorage.setItem("suprameds_review_dismiss_count", String(dismissals))
      if (dismissals >= 2) localStorage.setItem(DISMISSED_KEY, "permanent")
      return
    }

    const { Browser } = await import("@capacitor/browser")
    await Browser.open({
      url: "https://play.google.com/store/apps/details?id=in.supracyn.app",
      presentationStyle: "popover",
    })
    localStorage.setItem(DISMISSED_KEY, "permanent")
  } catch (err) {
    if (import.meta.env.DEV) console.warn("[review] prompt failed", err)
  }
}
