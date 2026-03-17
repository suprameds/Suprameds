import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"

export const useCustomer = () => {
  return useQuery({
    queryKey: queryKeys.customer.current(),
    queryFn: async () => {
      try {
        const { customer } = await sdk.store.customer.retrieve()
        return customer
      } catch {
        return null
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
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
    }: {
      email: string
      password: string
      first_name: string
      last_name: string
      phone?: string
    }) => {
      // Get registration token first; /store/customers then requires it in Authorization header
      const token = await sdk.auth.register("customer", "emailpass", { email, password })
      const { customer } = await sdk.store.customer.create(
        { email, first_name, last_name, phone },
        {},
        { Authorization: `Bearer ${token}` }
      )
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
      queryClient.setQueryData(queryKeys.customer.current(), null)
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
