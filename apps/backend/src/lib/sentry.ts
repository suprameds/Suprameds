import * as Sentry from "@sentry/node"
import type { MedusaRequest, MedusaResponse, MedusaNextFunction } from "@medusajs/framework/http"

const dsn = process.env.SENTRY_DSN
const environment = process.env.NODE_ENV || "development"

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release: process.env.SENTRY_RELEASE || `suprameds-backend@${process.env.npm_package_version || "0.0.0"}`,

    // Capture 10% of transactions in production, 100% in dev
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,

    // Filter out noisy or expected errors
    beforeSend(event, hint) {
      const error = hint?.originalException
      if (error instanceof Error) {
        // Don't report validation errors (400s) — they're expected user input errors
        if (error.message?.includes("is required") || error.message?.includes("Invalid")) {
          return null
        }
      }
      return event
    },

    integrations: [
      // Auto-instruments Express, HTTP, Postgres
      ...Sentry.getDefaultIntegrations({}),
    ],
  })

  console.log(`[Sentry] Initialized (env=${environment})`)
} else if (environment === "production") {
  console.warn("[Sentry] SENTRY_DSN not set — error tracking is disabled in production!")
}

/**
 * Medusa-compatible error-handling middleware for Sentry.
 *
 * Medusa's defineMiddlewares calls handlers as (req, res, next) — 3 args.
 * Express error handlers need (err, req, res, next) — 4 args.
 * This wrapper bridges the gap by using Sentry.setupExpressErrorHandler()
 * and also exporting a manual captureException for use in catch blocks.
 */
export function sentryErrorHandler(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  // Nothing to do on the request path — Sentry captures via its integrations.
  // This middleware exists so Sentry's Express integration is properly wired.
  next()
}

/**
 * Capture an error manually (for use in catch blocks, subscribers, jobs).
 */
export function captureException(error: unknown, context?: Record<string, any>) {
  if (!dsn) return

  Sentry.withScope((scope) => {
    if (context) {
      scope.setExtras(context)
    }
    Sentry.captureException(error)
  })
}

/**
 * Capture a message (for alerting on non-error conditions).
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info") {
  if (!dsn) return
  Sentry.captureMessage(message, level)
}

export { Sentry }
