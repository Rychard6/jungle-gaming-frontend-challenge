import { httpClient } from '../../../shared/api/http'
import type {
  AddCartItemInput,
  ApplyCartCouponInput,
  CartDto,
  UpdateCartItemInput,
} from '../../../shared/api/types'

export async function fetchCart(signal?: AbortSignal): Promise<CartDto> {
  const response = await httpClient.get<CartDto>('/cart', { signal })
  return response.data
}

export async function addCartItem(input: AddCartItemInput): Promise<CartDto> {
  const response = await httpClient.post<CartDto>('/cart/items', input)
  return response.data
}

export async function updateCartItem(
  itemId: string,
  input: UpdateCartItemInput,
): Promise<CartDto> {
  const response = await httpClient.patch<CartDto>(
    `/cart/items/${encodeURIComponent(itemId)}`,
    input,
  )
  return response.data
}

export async function deleteCartItem(itemId: string): Promise<CartDto> {
  const response = await httpClient.delete<CartDto>(
    `/cart/items/${encodeURIComponent(itemId)}`,
  )
  return response.data
}

export async function applyCartCoupon(
  input: ApplyCartCouponInput,
): Promise<CartDto> {
  const response = await httpClient.post<CartDto>('/cart/coupon', input)
  return response.data
}

export async function deleteCartCoupon(): Promise<CartDto> {
  const response = await httpClient.delete<CartDto>('/cart/coupon')
  return response.data
}

export async function acknowledgeCartChanges(): Promise<CartDto> {
  const response = await httpClient.post<CartDto>(
    '/cart/acknowledge-changes',
  )
  return response.data
}
