import type { ErrorEvent } from "@sentry/react"

export function isExtensionNoise(event: ErrorEvent): boolean {
  const exception = event.exception?.values?.[0]
  if (exception?.mechanism?.type !== "onerror") return false

  const frames = exception.stacktrace?.frames
  if (!frames || frames.length === 0) return false

  return frames.every((frame) => {
    const filename = frame.filename
    if (!filename) return false
    if (filename.includes("/assets/")) return false
    if (filename.endsWith(".js") || filename.endsWith(".mjs")) return false
    return true
  })
}

/**
 * Cloudflare Zaraz intercepts window.dataLayer.push and tries to JSON.stringify
 * its internal payload. When a DOM element (HTMLAnchorElement with React fiber)
 * ends up in Zaraz's page-context capture it throws a circular-structure error
 * as an unhandled rejection. Our GA4/gtag tracking is unaffected — this is
 * purely Zaraz noise.
 */
export function isZarazNoise(event: ErrorEvent): boolean {
  const exception = event.exception?.values?.[0]
  if (!exception) return false

  const message = exception.value ?? ""
  if (!message.includes("Converting circular structure to JSON")) return false

  const frames = exception.stacktrace?.frames ?? []
  return frames.some((frame) => frame.filename?.includes("/cdn-cgi/zaraz/"))
}
