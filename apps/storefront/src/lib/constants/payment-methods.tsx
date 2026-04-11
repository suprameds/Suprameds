import React from "react"
import { Cash, CreditCard } from "@medusajs/icons"

/* Map of payment provider_id to their title and icon. */
export const paymentMethodsData: Record<
  string,
  { title: string; icon: React.JSX.Element; description?: string }
> = {
  pp_stripe_stripe: {
    title: "Credit card",
    icon: <CreditCard />,
    description: "Pay securely with Visa, Mastercard, or RuPay",
  },
  pp_system_default: {
    title: "Cash on Delivery (COD)",
    icon: <Cash />,
    description: "Pay in cash when your order arrives at your doorstep",
  },
  pp_paytm_paytm: {
    title: "Paytm",
    icon: <CreditCard />,
    description: "UPI, Cards, NetBanking, Wallets",
  },
  pp_razorpay_razorpay: {
    title: "Razorpay",
    icon: <CreditCard />,
    description: "UPI, Cards, NetBanking, Wallets & EMI",
  },
}