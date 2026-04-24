import { useEffect } from "react"
import { isNativeApp } from "@/lib/utils/capacitor"

/**
 * Hosts that stay IN the app WebView. Everything else opens in a Custom Tab
 * so the user never loses the app session when tapping an external link.
 */
const INTERNAL_HOSTS = new Set([
  "supracyn.in",
  "www.supracyn.in",
  // Payment gateways — must stay in WebView for return-URL callbacks to hit our JS handlers.
  "checkout.razorpay.com",
  "api.razorpay.com",
  "securegw.paytm.in",
  "securegw-stage.paytm.in",
  // Google OAuth + reCAPTCHA occasionally pop up during auth flows.
  "accounts.google.com",
  "www.google.com",
])

function isInternal(href: string): boolean {
  try {
    const url = new URL(href, window.location.href)
    if (url.protocol !== "http:" && url.protocol !== "https:") return true
    return INTERNAL_HOSTS.has(url.hostname)
  } catch {
    return true
  }
}

/**
 * Global click handler: any <a> pointing at an external host opens in a
 * Chrome Custom Tab instead of navigating the app WebView away.
 *
 * Only active in native builds \u2014 web uses normal anchor behavior.
 */
export function useExternalLinks() {
  useEffect(() => {
    if (!isNativeApp()) return

    const onClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      const anchor = target?.closest?.("a")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href) return

      // Skip mailto:, tel:, sms: \u2014 let the OS handle them (Capacitor intercepts to native intents).
      if (/^(mailto|tel|sms|whatsapp):/i.test(href)) return

      if (isInternal(href)) return

      event.preventDefault()
      try {
        const { Browser } = await import("@capacitor/browser")
        await Browser.open({
          url: new URL(href, window.location.href).toString(),
          presentationStyle: "popover",
          toolbarColor: "#0D1B2A",
        })
      } catch (err) {
        if (import.meta.env.DEV) console.warn("[external-link] open failed", err)
        // Fallback: let the browser handle it
        window.open(href, "_blank", "noopener")
      }
    }

    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
    }
  }, [])
}
