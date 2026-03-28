import { useQuery } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"

export type DrugProductMeta = {
  id: string
  product_id: string
  mrp_paise: number | null
  schedule: "OTC" | "H" | "H1" | "X" | null
  generic_name: string | null
  dosage_form: string | null
  strength: string | null
  composition: string | null
  pack_size: string | null
  unit_type: string | null
  therapeutic_class: string | null
  gst_rate: number | null
  habit_forming: boolean | null
  is_chronic: boolean | null
  manufacturer: string | null
}

/**
 * Fetches pharma metadata (MRP, schedule, generic_name, etc.)
 * for a list of product IDs in a single API call.
 *
 * Returns a map of product_id → DrugProductMeta.
 */
export function useBulkPharma(productIds: string[]) {
  const idsKey = productIds.sort().join(",")

  return useQuery({
    queryKey: ["pharma-bulk", idsKey],
    queryFn: async (): Promise<Record<string, DrugProductMeta>> => {
      if (!productIds.length) return {}
      const { drug_products } = await sdk.client.fetch<{
        drug_products: Record<string, DrugProductMeta>
      }>(`/store/products/pharma/bulk?ids=${productIds.join(",")}`, {
        method: "GET",
      })
      return drug_products ?? {}
    },
    enabled: productIds.length > 0,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Server-side pharma filter: returns product_ids matching the given
 * schedule and/or dosage_form. Uses the bulk endpoint in filter mode
 * (no ids param, just schedule/dosage_form).
 *
 * Only fires when at least one filter is active.
 */
export function usePharmaFilter(schedule?: string, dosageForm?: string) {
  const hasFilter = (schedule && schedule !== "all") || (dosageForm && dosageForm !== "all")

  return useQuery({
    queryKey: ["pharma-filter", schedule, dosageForm],
    queryFn: async (): Promise<string[]> => {
      const params = new URLSearchParams()
      if (schedule && schedule !== "all") params.set("schedule", schedule)
      if (dosageForm && dosageForm !== "all") params.set("dosage_form", dosageForm)

      const { product_ids } = await sdk.client.fetch<{ product_ids: string[] }>(
        `/store/products/pharma/bulk?${params.toString()}`,
        { method: "GET" }
      )
      return product_ids ?? []
    },
    enabled: !!hasFilter,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Calculates discount percentage from MRP and selling price.
 *   discount = ((MRP - sellingPrice) / MRP) * 100
 *
 * @param mrpPaise - MRP in paise (e.g. 7850 for ₹78.50)
 * @param sellingPrice - Selling price in base currency unit (e.g. 12 for ₹12)
 */
export function calcDiscountFromMRP(
  mrpPaise: number | null | undefined,
  sellingPrice: number | null | undefined
): number | null {
  if (!mrpPaise || !sellingPrice) return null
  // mrp_paise is stored in paise (1/100 of rupee)
  // Medusa stores prices in whole units for INR
  const mrp = mrpPaise / 100
  if (mrp <= 0 || sellingPrice >= mrp) return null
  return Math.round(((mrp - sellingPrice) / mrp) * 100)
}
