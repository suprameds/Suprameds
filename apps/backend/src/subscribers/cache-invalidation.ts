import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

/**
 * Invalidates Redis/in-memory cache entries when products change.
 * Non-fatal: if the cache service is unavailable the handler silently skips.
 */
export default async function cacheInvalidationHandler({
  container,
}: SubscriberArgs<{ id: string }>) {
  const cacheService = container.resolve(Modules.CACHE)

  const keysToInvalidate = [
    "store:products:list",
    "store:categories:list",
    "store:regions:list",
  ]

  for (const key of keysToInvalidate) {
    try {
      await cacheService.invalidate(key)
    } catch {
      // Cache invalidation failure is non-fatal
    }
  }
}

export const config: SubscriberConfig = {
  event: [
    "product.updated",
    "product.created",
    "product.deleted",
  ],
}
