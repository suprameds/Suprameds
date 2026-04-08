import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/utils/sdk"
import { queryKeys } from "@/lib/utils/query-keys"

interface Notification {
  id: string
  title: string
  body: string
  type: string
  read: boolean
  created_at: string
  metadata?: Record<string, unknown>
}

interface NotificationsResponse {
  notifications: Notification[]
  count: number
}

export const useNotifications = (limit = 20, offset = 0) => {
  return useQuery({
    queryKey: [...queryKeys.notifications.all, "list", limit, offset],
    queryFn: async () => {
      const data = await sdk.client.fetch<NotificationsResponse>(
        `/store/notifications?limit=${limit}&offset=${offset}`
      )
      return data
    },
    staleTime: 1000 * 60 * 2, // 2 min
  })
}

export const useUnreadCount = () => {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: async () => {
      const data = await sdk.client.fetch<NotificationsResponse>(
        "/store/notifications?limit=1&offset=0"
      )
      return data.count
    },
    staleTime: 1000 * 60, // 1 min
    refetchInterval: 1000 * 60 * 2, // poll every 2 min
  })
}

export const useMarkAsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (notificationId: string) => {
      await sdk.client.fetch(`/store/notifications/${notificationId}/read`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all })
    },
  })
}
