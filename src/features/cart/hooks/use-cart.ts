import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessionKey } from '../../../shared/api/use-session-key'
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

export type CartActionType = CartAction['type']

export const cartQueryKey = (sessionId: string | null) =>
  ['cart', sessionId ?? 'anonymous'] as const

export function useCart() {
  const queryClient = useQueryClient()
  // Reativo: login, logout, expiração e troca de usuário trocam a chave e, com ela, o cache.
  const sessionKey = useSessionKey()
  const queryKey = cartQueryKey(sessionKey)
  const cartQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchCart(signal),
  })

  const mutation = useMutation<CartDto, Error, CartAction & { sessionKey: string }>({
    mutationFn: (action) => {
      if (getSessionCacheKey() !== action.sessionKey) throw new Error('A sessão mudou. Tente novamente.')
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
    onSuccess: (cart, action) => {
      if (getSessionCacheKey() !== action.sessionKey) return
      queryClient.setQueryData(cartQueryKey(action.sessionKey), cart)
    },
    onSettled: (_data, _error, action) => {
      if (getSessionCacheKey() !== action.sessionKey) return
      void queryClient.invalidateQueries({ queryKey: cartQueryKey(action.sessionKey) })
      void queryClient.invalidateQueries({ queryKey: ['checkout', 'quote', action.sessionKey] })
    },
  })

  return {
    cart: cartQuery.data,
    isLoading: cartQuery.isLoading,
    isFetching: cartQuery.isFetching,
    loadError: cartQuery.error,
    mutationError: mutation.error,
    /** Qual operação falhou; permite exibir o erro junto ao controle correto. */
    mutationAction: mutation.variables?.type,
    isMutating: mutation.isPending,
    addItem: (input: AddCartItemInput) => mutation.mutate({ type: 'add', input, sessionKey }),
    addItemAsync: (input: AddCartItemInput) =>
      mutation.mutateAsync({ type: 'add', input, sessionKey }),
    updateItem: (itemId: string, quantity: number) =>
      mutation.mutate({ type: 'update', itemId, quantity, sessionKey }),
    removeItem: (itemId: string) =>
      mutation.mutate({ type: 'delete', itemId, sessionKey }),
    applyCoupon: (code: string) =>
      mutation.mutate({ type: 'apply-coupon', code, sessionKey }),
    removeCoupon: () => mutation.mutate({ type: 'delete-coupon', sessionKey }),
    acknowledgeChanges: () => mutation.mutate({ type: 'acknowledge', sessionKey }),
    acknowledgeChangesAsync: () =>
      mutation.mutateAsync({ type: 'acknowledge', sessionKey }),
    lastMutationResult: mutation.data,
    refetch: () => cartQuery.refetch(),
  }
}
