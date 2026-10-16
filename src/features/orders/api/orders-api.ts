import { httpClient } from '../../../shared/api/http'
import type { OrderDto, OrderListDto } from '../../../shared/api/types'

export async function fetchOrders(
  signal?: AbortSignal,
): Promise<OrderListDto> {
  const response = await httpClient.get<OrderListDto>('/orders', { signal })
  return response.data
}

export async function fetchOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderDto> {
  const response = await httpClient.get<{ order: OrderDto }>(
    `/orders/${encodeURIComponent(orderId)}`,
    { signal },
  )
  return response.data.order
}
