import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSessionCacheKey } from '../../../shared/api/http'
import type {
  AddCartItemInput,
  CartDto,
} from '../../../shared/api/types'
import {
  acknowledgeCartChanges,
  addCartItem,
  applyCartCoupon,
  deleteCartCoupon,
  deleteCartItem,
  fetchCart,
  updateCartItem,
} from '../api/cart-api'

type CartAction =
  | { type: 'add'; input: AddCartItemInput }
  | { type: 'update'; itemId: string; quantity: number }
  | { type: 'delete'; itemId: string }
  | { type: 'apply-coupon'; code: string }
  | { type: 'delete-coupon' }
  | { type: 'acknowledge' }

export const cartQueryKey = (sessionId: string | null) =>
  ['cart', sessionId ?? 'anonymous'] as const

export function useCart() {
  const queryClient = useQueryClient()
  const queryKey = cartQueryKey(getSessionCacheKey())
  const cartQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchCart(signal),
  })

  const mutation = useMutation<CartDto, Error, CartAction>({
    mutationFn: (action) => {
      switch (action.type) {
        case 'add':
          return addCartItem(action.input)
        case 'update':
          return updateCartItem(action.itemId, { quantity: action.quantity })
        case 'delete':
          return deleteCartItem(action.itemId)
        case 'apply-coupon':
          return applyCartCoupon({ code: action.code })
        case 'delete-coupon':
          return deleteCartCoupon()
        case 'acknowledge':
          return acknowledgeCartChanges()
      }
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKey, cart)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    cart: cartQuery.data,
    isLoading: cartQuery.isLoading,
    isFetching: cartQuery.isFetching,
    loadError: cartQuery.error,
    mutationError: mutation.error,
    isMutating: mutation.isPending,
    addItem: (input: AddCartItemInput) => mutation.mutate({ type: 'add', input }),
    addItemAsync: (input: AddCartItemInput) =>
      mutation.mutateAsync({ type: 'add', input }),
    updateItem: (itemId: string, quantity: number) =>
      mutation.mutate({ type: 'update', itemId, quantity }),
    removeItem: (itemId: string) =>
      mutation.mutate({ type: 'delete', itemId }),
    applyCoupon: (code: string) =>
      mutation.mutate({ type: 'apply-coupon', code }),
    removeCoupon: () => mutation.mutate({ type: 'delete-coupon' }),
    acknowledgeChanges: () => mutation.mutate({ type: 'acknowledge' }),
    acknowledgeChangesAsync: () =>
      mutation.mutateAsync({ type: 'acknowledge' }),
    lastMutationResult: mutation.data,
    refetch: () => cartQuery.refetch(),
  }
}
