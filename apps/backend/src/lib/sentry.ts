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
 * Express error-handling middleware for Sentry.
 * Add this AFTER all routes in defineMiddlewares to capture unhandled errors.
 */
export function sentryErrorHandler(
  err: Error & { type?: string; code?: string },
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) {
  if (!dsn) return next(err)

  Sentry.withScope((scope) => {
    // Tag with useful Medusa context
    scope.setTag("route", req.path)
    scope.setTag("method", req.method)

    const actorId = (req as any).auth_context?.actor_id
    if (actorId) {
      scope.setUser({ id: actorId })
    }

    // Don't report 4xx client errors as Sentry issues
    const statusCode = (err as any).status || (err as any).statusCode || 500
    if (statusCode >= 400 && statusCode < 500) {
      scope.setLevel("warning")
    }

    Sentry.captureException(err)
  })

  next(err)
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
