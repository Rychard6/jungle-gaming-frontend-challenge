import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useSessionKey } from '../../../shared/api/use-session-key'
import { getSessionCacheKey } from '../../../shared/api/http'
import { useAuth } from '../../auth/hooks/auth-context'
import {
  addFavorite,
  fetchFavorites,
  removeFavorite,
} from '../api/favorites-api'

interface FavoriteChange {
  nftId: string
  favorite: boolean
  sessionKey: string
}

interface FavoriteMutationContext {
  previouslyFavorite: boolean
}

export function useFavorites(nftId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const auth = useAuth()
  const isAuthenticated = Boolean(auth.session)
  const sessionKey = useSessionKey()
  const queryKey = ['favorites', sessionKey] as const

  // Favoritos pertencem ao usuário autenticado: visitantes nem chegam a consultar a API.
  const favoritesQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchFavorites(signal),
    enabled: isAuthenticated,
  })

  const mutation = useMutation<
    void,
    Error,
    FavoriteChange,
    FavoriteMutationContext
  >({
    mutationKey: ['favorites', sessionKey],
    mutationFn: ({ nftId: changedNftId, favorite, sessionKey: originSession }) => {
      if (getSessionCacheKey() !== originSession) throw new Error('A sessão mudou. Tente novamente.')
      return favorite ? addFavorite(changedNftId) : removeFavorite(changedNftId)
    },
    onMutate: async ({ nftId: changedNftId, favorite, sessionKey: originSession }) => {
      const originKey = ['favorites', originSession] as const
      await queryClient.cancelQueries({ queryKey: originKey })
      if (getSessionCacheKey() !== originSession) throw new Error('A sessão mudou. Tente novamente.')
      const previousFavorites = queryClient.getQueryData<string[]>(originKey)
      const currentFavorites = previousFavorites ?? []
      const updatedFavorites = favorite
        ? [...new Set([...currentFavorites, changedNftId])]
        : currentFavorites.filter((id) => id !== changedNftId)

      queryClient.setQueryData(originKey, updatedFavorites)
      return { previouslyFavorite: currentFavorites.includes(changedNftId) }
    },
    onError: (_error, change, context) => {
      if (!context || getSessionCacheKey() !== change.sessionKey) return
      queryClient.setQueryData<string[]>(['favorites', change.sessionKey], (current = []) =>
        context.previouslyFavorite
          ? [...new Set([...current, change.nftId])]
          : current.filter((id) => id !== change.nftId),
      )
    },
    onSettled: (_data, _error, change) => {
      if (getSessionCacheKey() !== change.sessionKey) return
      if (queryClient.isMutating({ mutationKey: ['favorites', change.sessionKey] }) === 1) {
        void queryClient.invalidateQueries({ queryKey: ['favorites', change.sessionKey] })
      }
    },
  })

  const favorite = favoritesQuery.data?.includes(nftId) ?? false

  const toggleFavorite = () => {
    if (!isAuthenticated) {
      auth.showNotice('Entre na sua conta para salvar NFTs nos favoritos.')
      void navigate({
        to: '/login',
        search: {
          redirect: `${window.location.pathname}${window.location.search}`,
        },
      })
      return
    }
    mutation.mutate({ nftId, favorite: !favorite, sessionKey })
  }

  return {
    favorite,
    isAuthenticated,
    isLoading: favoritesQuery.isLoading,
    isPending: mutation.isPending,
    mutationError: mutation.error,
    loadError: favoritesQuery.error,
    toggleFavorite,
  }
}
