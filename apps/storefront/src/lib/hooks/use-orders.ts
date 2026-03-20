import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/utils/query-keys"
import { sdk } from "@/lib/utils/sdk"

export const useCustomerOrders = ({ fields }: { fields?: string } = {}) => {
  return useQuery({
    queryKey: queryKeys.customer.orders(),
    queryFn: async () => {
      const { orders } = await sdk.store.order.list({ fields })
      return orders
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
}

export const useOrder = ({
  order_id,
  fields,
}: {
  order_id: string;
  fields?: string;
}) => {
  return useQuery({
    queryKey: queryKeys.orders.detail(order_id),
    queryFn: async () => {
      const { order } = await sdk.store.order.retrieve(order_id, { fields })
      return order
    },
    enabled: !!order_id,
    // Always refetch on mount and window focus so status/fulfillment
    // changes made in the admin panel are reflected immediately.
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  })
}
