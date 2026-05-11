/**
 * Initial-status resolver for newly uploaded prescriptions.
 *
 * Default: every upload lands in "pending_review" and a pharmacist must
 * explicitly approve it before any Rx line item can be added to an order.
 * This matches the Drugs and Cosmetics Act 1940 and the Pharmacy Practice
 * Regulations 2015 — a registered pharmacist must verify the Rx.
 *
 * Override: set PRESCRIPTION_AUTO_APPROVE_ON_UPLOAD=true to skip the
 * pending_review state and mark new uploads as "approved" immediately.
 * Useful when:
 *   - The pharmacist verifies prescriptions offline / out-of-band and
 *     uses the system purely for order creation (pharmacist-driven flow
 *     where the act of creating an order is the approval).
 *   - Early-stage / pre-launch testing.
 *   - You're only dispensing OTC products and the prescription flow is
 *     advisory rather than gating.
 *
 * IMPORTANT: with auto-approve on, customers can attach any uploaded
 * image to an Rx order. The compliance burden shifts entirely to your
 * pre-dispatch pharmacist sign-off (the carrier-booking workflow hook
 * is the other gate — keep that strict).
 *
 * Toggle off any time by removing the env var or setting it to "false".
 */
export type PrescriptionInitialStatus = "pending_review" | "approved"

export function isPrescriptionAutoApproveEnabled(): boolean {
  return (process.env.PRESCRIPTION_AUTO_APPROVE_ON_UPLOAD || "")
    .toLowerCase()
    .trim() === "true"
}

export function getPrescriptionInitialStatus(): PrescriptionInitialStatus {
  return isPrescriptionAutoApproveEnabled() ? "approved" : "pending_review"
}

/**
 * Returns extra fields to set when auto-approving — review timestamp and
 * a synthetic reviewer ID so it's clear in the audit log this didn't
 * come from a human pharmacist.
 */
export function getAutoApproveFields():
  | { reviewed_by: string; reviewed_at: Date }
  | Record<string, never> {
  if (!isPrescriptionAutoApproveEnabled()) return {}
  return {
    reviewed_by: "system-auto-approve",
    reviewed_at: new Date(),
  }
}
