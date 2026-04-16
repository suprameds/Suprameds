import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { useCustomer } from "@/lib/hooks/use-customer"

// ── Types ───────────────────────────────────────────────────────────

export interface PharmacistPrescription {
  id: string
  customer_id: string | null
  status: string
  file_key: string
  file_url: string | null
  original_filename: string | null
  mime_type: string | null
  doctor_name: string | null
  doctor_reg_no: string | null
  patient_name: string | null
  prescribed_on: string | null
  valid_until: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  pharmacist_notes: string | null
  fully_dispensed: boolean
  created_at: string
  lines: any[]
}

export interface SearchProduct {
  id: string
  title: string
  handle: string
  thumbnail: string | null
  drug_product: {
    schedule: string
    generic_name: string
    dosage_form: string
    strength: string
    is_narcotic: boolean
    requires_refrigeration: boolean
    pack_size: string | null
    unit_type: string | null
  } | null
  variant: {
    id: string
    title: string
    sku: string | null
    price: number | null
    currency_code: string
  } | null
}

// ── Is Pharmacist ───────────────────────────────────────────────────

export function useIsPharmacist(): boolean {
  const { data: customer } = useCustomer()
  return (customer?.metadata as any)?.role === "pharmacist"
}

// ── Prescription List ───────────────────────────────────────────────

export function usePharmacistPrescriptions(status?: string) {
  return useQuery<PharmacistPrescription[]>({
    queryKey: ["pharmacist", "prescriptions", status],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      const url = `/store/pharmacist/prescriptions${params.toString() ? `?${params}` : ""}`
      const res = await sdk.client.fetch<{ prescriptions: PharmacistPrescription[] }>(url)
      return res.prescriptions ?? []
    },
  })
}

// ── Single Prescription ─────────────────────────────────────────────

export function usePharmacistPrescription(id: string | undefined) {
  return useQuery<PharmacistPrescription | null>({
    queryKey: ["pharmacist", "prescription", id],
    queryFn: async () => {
      if (!id) return null
      const res = await sdk.client.fetch<{ prescription: PharmacistPrescription }>(
        `/store/pharmacist/prescriptions/${id}`
      )
      return res.prescription ?? null
    },
    enabled: !!id,
  })
}

// ── Review Prescription ─────────────────────────────────────────────

export function useReviewPrescription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      prescriptionId,
      ...body
    }: {
      prescriptionId: string
      action: "approve" | "reject"
      rejection_reason?: string
      doctor_name?: string
      doctor_reg_no?: string
      patient_name?: string
      prescribed_on?: string
      valid_until?: string
      pharmacist_notes?: string
      lines?: any[]
    }) => {
      return sdk.client.fetch(`/store/pharmacist/prescriptions/${prescriptionId}`, {
        method: "POST",
        body,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] })
      queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescription"] })
    },
  })
}

// ── Product Search ──────────────────────────────────────────────────

export function usePharmacistProductSearch(query: string) {
  return useQuery<SearchProduct[]>({
    queryKey: ["pharmacist", "products", "search", query],
    queryFn: async () => {
      if (!query.trim()) return []
      const res = await sdk.client.fetch<{ products: SearchProduct[] }>(
        `/store/pharmacist/products/search?q=${encodeURIComponent(query)}&limit=10`
      )
      return res.products ?? []
    },
    enabled: query.trim().length >= 2,
  })
}

// ── Create Order for Customer ───────────────────────────────────────

export function useCreateOrderForCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      prescriptionId,
      items,
      shipping_address,
      notes,
    }: {
      prescriptionId: string
      items: Array<{ variant_id: string; quantity: number }>
      shipping_address?: any
      notes?: string
    }) => {
      return sdk.client.fetch<{ order_id: string; message: string }>(
        `/store/pharmacist/prescriptions/${prescriptionId}/create-order`,
        {
          method: "POST",
          body: { items, shipping_address, notes },
        }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescriptions"] })
      queryClient.invalidateQueries({ queryKey: ["pharmacist", "prescription"] })
    },
  })
}

// ── Pharmacist Create Order hooks ──

type CustomerLookupResult = {
  found: boolean
  customer: {
    id: string
    first_name: string
    last_name: string
    phone: string
    email: string
    addresses: Array<{
      id: string
      first_name: string
      last_name: string
      address_1: string
      address_2?: string
      city: string
      province?: string
      postal_code: string
      country_code: string
      phone?: string
      is_default_shipping?: boolean
    }>
  } | null
}

export function usePharmacistCustomerLookup() {
  return useMutation({
    mutationFn: async (data: {
      phone: string
      first_name?: string
      last_name?: string
    }): Promise<CustomerLookupResult> => {
      return await sdk.client.fetch<CustomerLookupResult>(
        "/store/pharmacist/customers/lookup",
        { method: "POST", body: data }
      )
    },
  })
}

type CreateOrderResult = {
  order_id: string
  display_id: number
  total: number
  message: string
}

export function usePharmacistCreateOrder() {
  return useMutation({
    mutationFn: async (data: {
      customer_id: string
      items: Array<{ variant_id: string; quantity: number }>
      shipping_address: {
        first_name: string
        last_name: string
        address_1: string
        address_2?: string
        city: string
        province?: string
        postal_code: string
        country_code: string
        phone?: string
      }
      prescription_id?: string
      notes?: string
    }): Promise<CreateOrderResult> => {
      return await sdk.client.fetch<CreateOrderResult>(
        "/store/pharmacist/orders/create",
        { method: "POST", body: data }
      )
    },
  })
}
