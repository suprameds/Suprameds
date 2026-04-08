import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"

// ── Types ───────────────────────────────────────────────────────────

export type DocumentType =
  | "aadhaar"
  | "pan"
  | "driving_license"
  | "passport"
  | "voter_id"

export type DocumentStatus = "pending" | "approved" | "rejected"

export interface CustomerDocument {
  id: string
  customer_id: string
  document_type: DocumentType
  file_key: string
  file_url: string
  original_filename: string
  status: DocumentStatus
  reviewed_by: string | null
  reviewed_at: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  driving_license: "Driving License",
  passport: "Passport",
  voter_id: "Voter ID",
}

// ── List customer documents ─────────────────────────────────────────

export const useCustomerDocuments = (enabled = true) => {
  return useQuery<CustomerDocument[]>({
    queryKey: queryKeys.documents.forCustomer(),
    queryFn: async () => {
      const res = await sdk.client.fetch<{
        documents: CustomerDocument[]
      }>("/store/documents", { method: "GET" })
      return res.documents
    },
    staleTime: 1000 * 30,
    enabled,
  })
}

// ── Upload document ─────────────────────────────────────────────────

interface UploadDocumentInput {
  filename: string
  content_type: string
  content: string // base64
  document_type: DocumentType
}

export const useUploadDocument = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UploadDocumentInput) => {
      const res = await sdk.client.fetch<{ document: CustomerDocument }>(
        "/store/documents/upload",
        {
          method: "POST",
          body: input,
        }
      )
      return res.document
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.documents.forCustomer(),
      })
    },
  })
}
