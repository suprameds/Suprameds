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
