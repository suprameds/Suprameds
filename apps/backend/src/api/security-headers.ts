import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * Security headers middleware.
 *
 * Adds defence-in-depth HTTP response headers recommended by OWASP:
 *   - HSTS (forces HTTPS for one year)
 *   - X-Frame-Options (clickjacking protection)
 *   - X-Content-Type-Options (MIME-sniffing protection)
 *   - Referrer-Policy (limits referrer leakage)
 *   - Permissions-Policy (disables unused browser features)
 *   - Content-Security-Policy (controls allowed resource origins)
 *
 * Register as the FIRST middleware in middlewares.ts so it applies to every
 * response regardless of which route ultimately handles the request.
 */
export function securityHeaders() {
  return function securityHeadersMiddleware(
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ) {
    // Prevent MIME-type sniffing
    res.setHeader("X-Content-Type-Options", "nosniff")

    // Deny framing from external origins (clickjacking protection)
    res.setHeader("X-Frame-Options", "SAMEORIGIN")

    // Deprecated in modern browsers; kept at 0 to defer to CSP
    res.setHeader("X-XSS-Protection", "0")

    // Limit referrer information on cross-origin requests
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")

    // Disable camera, microphone, and geolocation for all origins
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

    // Force HTTPS for one year (including sub-domains)
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

    // Content Security Policy — permits:
    //   scripts: self + inline (required by Medusa admin / Vite HMR) + GA
    //   styles:  self + inline (Tailwind) + Google Fonts
    //   fonts:   self + Google Fonts CDN
    //   images:  self + data URIs + any HTTPS source + blobs (product images)
    //   connect: self + Suprameds API origins + GA + Firebase Cloud Messaging
    //   frames:  self only (blocks clickjacking at the CSP level too)
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com; " +
        "img-src 'self' data: https: blob:; " +
        "connect-src 'self' https://*.suprameds.in https://www.google-analytics.com https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com; " +
        "frame-ancestors 'self'",
    )

    next()
  }
}
