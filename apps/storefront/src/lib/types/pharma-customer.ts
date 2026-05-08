export interface PharmaCustomerMetadata {
  dob?: string                                       // ISO "YYYY-MM-DD"
  gender?: "male" | "female" | "other" | "prefer_not_to_say"
  allergies?: string[]
  chronic_conditions?: string[]
  abha_id?: string
  emergency_contact?: { name: string; phone: string }
  preferred_language?: "en" | "hi" | "ml" | "te" | "ta"
  gst_number?: string
  consent_marketing?: { accepted: boolean; at: string }
  consent_terms?: { accepted: boolean; at: string }
  referred_by?: string
}

export type CustomerProfileUpdate = {
  first_name?: string
  last_name?: string
  phone?: string
  metadata?: Partial<PharmaCustomerMetadata>
}
