/**
 * Maximum number of product IDs to pass to the Medusa product list API.
 * Keeps the GET URL short enough for CORS preflight on Railway/Cloudflare.
 */
export const MAX_FILTER_IDS = 20

/**
 * Builds the product ID filter array for the Medusa product list query.
 *
 * Returns:
 *   undefined — no filter active, or filter still loading (query should wait)
 *   string[]  — filtered IDs to pass as `id` param, or `["__none__"]` sentinel
 */
export function buildPharmaIdFilter({
  hasPharmaFilter,
  isFilterFetching,
  filteredIds,
}: {
  hasPharmaFilter: boolean
  isFilterFetching: boolean
  filteredIds: string[] | undefined
}): string[] | undefined {
  if (!hasPharmaFilter) return undefined

  if (isFilterFetching) return undefined

  if (filteredIds && filteredIds.length > 0) {
    return filteredIds.slice(0, MAX_FILTER_IDS)
  }

  return ["__none__"]
}
