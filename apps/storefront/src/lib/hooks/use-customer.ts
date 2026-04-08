import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"

/** localStorage key for the OTP JWT token (bearer auth fallback) */
const OTP_JWT_KEY = "_suprameds_otp_jwt"

export function getStoredOtpToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(OTP_JWT_KEY)
}

export function setStoredOtpToken(token: string) {
  localStorage.setItem(OTP_JWT_KEY, token)
}

export function clearStoredOtpToken() {
  localStorage.removeItem(OTP_JWT_KEY)
}

export const useCustomer = () => {
  return useQuery({
    queryKey: queryKeys.customer.current(),
    queryFn: async () => {
      // Try session-based auth first (email/password login)
      try {
        const { customer } = await sdk.store.customer.retrieve()
        return customer
      } catch {
        // Fallback: try stored OTP JWT for phone-based login
        const otpToken = getStoredOtpToken()
        if (otpToken) {
          try {
            const { customer } = await sdk.client.fetch<{ customer: any }>(
              "/store/customers/me",
              { headers: { Authorization: `Bearer ${otpToken}` } }
            )
            return customer
          } catch {
            clearStoredOtpToken()
            return null
          }
        }
        return null
      }
    },
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    retry: 1,
    refetchOnWindowFocus: true,
  })
}

export const useLogin = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string
      password: string
    }) => {
      await sdk.auth.login("customer", "emailpass", { email, password })
      const { customer } = await sdk.store.customer.retrieve()
      return customer
    },
    onSuccess: (customer) => {
      queryClient.setQueryData(queryKeys.customer.current(), customer)
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.all })
    },
  })
}

export const useRegister = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      email,
      password,
      first_name,
      last_name,
      phone,
      metadata,
    }: {
      email: string
      password: string
      first_name: string
      last_name: string
      phone?: string
      metadata?: Record<string, unknown>
    }) => {
      /**
       * Medusa v2 registration is a two-step flow:
       *  1. /auth/customer/emailpass/register  → returns a registration JWT (actor_id is "")
       *  2. POST /store/customers with that token → creates the customer record
       *
       * The registration token has actor_id="" so /store/customers/me returns 401 with it.
       * We must explicitly log in after creation to get a real customer JWT.
       */
      const registrationToken = await sdk.auth.register("customer", "emailpass", { email, password })
      await sdk.store.customer.create(
        { email, first_name, last_name, phone, metadata } as any,
        {},
        { Authorization: `Bearer ${registrationToken}` }
      )
      // Swap the registration token for a real customer session token
      await sdk.auth.login("customer", "emailpass", { email, password })
      const { customer } = await sdk.store.customer.retrieve()
      return customer
    },
    onSuccess: (customer) => {
      queryClient.setQueryData(queryKeys.customer.current(), customer)
    },
  })
}

export const useLogout = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await sdk.auth.logout()
    },
    onSuccess: () => {
      clearStoredOtpToken()
      queryClient.setQueryData(queryKeys.customer.current(), null)
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.all })
    },
  })
}

// ============ OTP LOGIN (Phone SMS + Email) ============

type OtpChannel = "sms" | "email"

interface OtpSendResponse {
  success: boolean
  channel: OtpChannel
  message: string
  fallback_channel?: OtpChannel
}

interface OtpVerifyResponse {
  success: boolean
  token: string
  customer_id: string
}

/**
 * Send a 6-digit OTP via SMS or Email.
 * - For SMS: pass { phone, channel: "sms" }
 * - For Email: pass { email, channel: "email" }
 */
export const useOtpSend = () => {
  return useMutation({
    mutationFn: async (
      params:
        | { phone: string; country_code?: string; channel?: "sms" }
        | { email: string; channel: "email" }
    ) => {
      const body =
        "email" in params
          ? { email: params.email, channel: "email" as const }
          : { phone: params.phone, country_code: (params as any).country_code ?? "91", channel: "sms" as const }

      const response = await sdk.client.fetch<OtpSendResponse>(
        "/store/otp/send",
        { method: "POST", body }
      )
      return response
    },
  })
}

/**
 * Verify OTP, store the JWT, and load the customer into cache.
 * Works for both phone and email OTP.
 */
export const useOtpVerify = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      params:
        | { phone: string; otp: string; country_code?: string; channel?: "sms" }
        | { email: string; otp: string; channel: "email" }
    ) => {
      const body =
        "email" in params
          ? { email: params.email, otp: params.otp, channel: "email" as const }
          : { phone: params.phone, otp: params.otp, country_code: (params as any).country_code ?? "91", channel: "sms" as const }

      const response = await sdk.client.fetch<OtpVerifyResponse>(
        "/store/otp/verify",
        { method: "POST", body }
      )

      if (!response.success || !response.token) {
        throw new Error("OTP verification failed")
      }

      setStoredOtpToken(response.token)

      const { customer } = await sdk.client.fetch<{ customer: any }>(
        "/store/customers/me",
        { headers: { Authorization: `Bearer ${response.token}` } }
      )

      return customer
    },
    onSuccess: (customer) => {
      queryClient.setQueryData(queryKeys.customer.current(), customer)
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.all })
    },
  })
}

/** Request a password reset email. Backend sends token to the given email. */
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (email: string) => {
      await sdk.auth.resetPassword("customer", "emailpass", { identifier: email })
    },
  })
}

/** Set new password using the token from the reset email. */
export const useResetPassword = () => {
  return useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      await sdk.auth.updateProvider("customer", "emailpass", { password }, token)
    },
  })
}

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      first_name?: string
      last_name?: string
      phone?: string
    }) => {
      const { customer } = await sdk.store.customer.update(data)
      return customer
    },
    onSuccess: (customer) => {
      queryClient.setQueryData(queryKeys.customer.current(), customer)
    },
  })
}

export const useCreateAddress = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      first_name: string
      last_name: string
      address_1: string
      address_2?: string
      city: string
      province?: string
      postal_code: string
      country_code: string
      phone?: string
    }) => {
      await sdk.store.customer.createAddress(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.all })
    },
  })
}

export const useUpdateAddress = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      addressId,
      data,
    }: {
      addressId: string
      data: {
        first_name?: string
        last_name?: string
        address_1?: string
        address_2?: string
        city?: string
        province?: string
        postal_code?: string
        country_code?: string
        phone?: string
      }
    }) => {
      await sdk.store.customer.updateAddress(addressId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.all })
    },
  })
}

export const useDeleteAddress = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (addressId: string) => {
      await sdk.store.customer.deleteAddress(addressId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customer.all })
    },
  })
}

export const useCustomerAddresses = () => {
  return useQuery({
    queryKey: [...queryKeys.customer.all, "addresses"],
    queryFn: async () => {
      const { addresses } = await sdk.store.customer.listAddress()
      return addresses
    },
  })
}
