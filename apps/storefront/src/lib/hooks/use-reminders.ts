import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"

export type Reminder = {
  id: string
  variant_id: string
  product_title: string
  variant_title: string | null
  product_handle: string | null
  thumbnail: string | null
  frequency_days: number
  next_expected_at: string
  last_purchased_at: string
  reminder_sent_at: string | null
  confidence_score: number
  is_active: boolean
  is_manual: boolean
}

const REMINDERS_KEY = ["reminders"]

export const useReminders = () => {
  return useQuery({
    queryKey: REMINDERS_KEY,
    queryFn: async () => {
      const res = await sdk.client.fetch<{ reminders: Reminder[]; count: number }>(
        "/store/reminders",
        { method: "GET" }
      )
      return res
    },
    staleTime: 5 * 60 * 1000, // 5 min — reminders rarely change, mutations invalidate
  })
}

export const useCreateReminder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { variant_id: string; frequency_days: number }) => {
      return sdk.client.fetch<{ reminder: any }>("/store/reminders", {
        method: "POST",
        body: input,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REMINDERS_KEY })
    },
  })
}

export const useUpdateReminder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...body
    }: {
      id: string
      is_active?: boolean
      frequency_days?: number
    }) => {
      return sdk.client.fetch<{ reminder: any }>(`/store/reminders/${id}`, {
        method: "POST",
        body,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REMINDERS_KEY })
    },
  })
}

export const useDeleteReminder = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      return sdk.client.fetch<{ id: string; deleted: boolean }>(
        `/store/reminders/${id}`,
        { method: "DELETE" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REMINDERS_KEY })
    },
  })
}
