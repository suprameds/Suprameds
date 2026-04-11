import { useQuery } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"

export interface SearchDrugProduct {
  id: string
  schedule: "OTC" | "H" | "H1" | "X"
  generic_name: string
  dosage_form: string | null
  strength: string | null
  composition: string | null
  gst_rate: number
  manufacturer: string | null
}

export interface SearchProduct {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  description: string | null
  subtitle: string | null
  status: string
  drug_product: SearchDrugProduct | null
}

interface SearchResponse {
  products: SearchProduct[]
  count: number
}

/**
 * Calls GET /store/products/search?q=...&limit=...&offset=...
 * Uses the backend's PostgreSQL full-text search with ranked results.
 */
export const useSearch = ({
  q,
  limit = 20,
  offset = 0,
  categoryId,
}: {
  q: string
  limit?: number
  offset?: number
  categoryId?: string
}) => {
  return useQuery<SearchResponse>({
    queryKey: queryKeys.search.fts(q, limit, offset, categoryId),
    queryFn: async () => {
      const params = new URLSearchParams({ q, limit: String(limit), offset: String(offset) })
      if (categoryId) params.set("category_id", categoryId)

      const response = await sdk.client.fetch<SearchResponse>(
        `/store/products/search?${params.toString()}`,
        { method: "GET" }
      )

      return response
    },
    enabled: q.length > 0 || !!categoryId,
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  })
}
