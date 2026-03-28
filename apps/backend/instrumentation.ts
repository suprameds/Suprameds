/**
 * OpenTelemetry instrumentation for Medusa backend.
 *
 * Enabled when OTEL_EXPORTER_OTLP_ENDPOINT is set (e.g., Jaeger, Grafana Tempo).
 * Instruments: HTTP requests, workflow steps, database queries.
 */

export async function register() {
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  const isProduction = process.env.NODE_ENV === "production"

  // Skip instrumentation if no exporter configured in production
  if (isProduction && !otlpEndpoint) return

  try {
    const { registerOtel } = await import("@medusajs/medusa")

    registerOtel({
      serviceName: "suprameds-backend",
      instrument: {
        http: true,
        workflows: true,
        query: true,
      },
    })

    console.log(
      `[OTel] Instrumentation enabled` +
        (otlpEndpoint ? ` → ${otlpEndpoint}` : " (console exporter)")
    )
  } catch (err) {
    console.warn("[OTel] Failed to initialize instrumentation:", (err as Error).message)
  }
}
