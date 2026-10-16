import { httpClient } from '../../../shared/api/http'
import type {
  CheckoutQuoteDto,
  CreateOrderRequestDto,
  OrderDto,
} from '../../../shared/api/types'

export async function fetchCheckoutQuote(
  signal?: AbortSignal,
): Promise<CheckoutQuoteDto> {
  const response = await httpClient.post<CheckoutQuoteDto>(
    '/checkout/quote',
    {},
    { signal },
  )
  return response.data
}

export async function createOrder(
  input: CreateOrderRequestDto,
  idempotencyKey: string,
): Promise<OrderDto> {
  const response = await httpClient.post<{ order: OrderDto }>(
    '/orders',
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data.order
}
