import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSessionCacheKey } from '../../../shared/api/http'
import {
  addFavorite,
  fetchFavorites,
  removeFavorite,
} from '../api/favorites-api'

interface FavoriteChange {
  nftId: string
  favorite: boolean
}

interface FavoriteMutationContext {
  previousFavorites: string[] | undefined
}

export function useFavorites(nftId: string) {
  const queryClient = useQueryClient()
  const sessionId = getSessionCacheKey() ?? 'anonymous'
  const queryKey = ['favorites', sessionId] as const

  const favoritesQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchFavorites(signal),
  })

  const mutation = useMutation<
    void,
    Error,
    FavoriteChange,
    FavoriteMutationContext
  >({
    mutationFn: ({ nftId: changedNftId, favorite }) =>
      favorite ? addFavorite(changedNftId) : removeFavorite(changedNftId),
    onMutate: async ({ nftId: changedNftId, favorite }) => {
      await queryClient.cancelQueries({ queryKey })
      const previousFavorites = queryClient.getQueryData<string[]>(queryKey)
      const currentFavorites = previousFavorites ?? []
      const updatedFavorites = favorite
        ? [...new Set([...currentFavorites, changedNftId])]
        : currentFavorites.filter((id) => id !== changedNftId)

      queryClient.setQueryData(queryKey, updatedFavorites)
      return { previousFavorites }
    },
    onError: (_error, _change, context) => {
      if (!context) return
      if (context.previousFavorites === undefined) {
        queryClient.removeQueries({ queryKey, exact: true })
      } else {
        queryClient.setQueryData(queryKey, context.previousFavorites)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })

  const favorite = favoritesQuery.data?.includes(nftId) ?? false

  return {
    favorite,
    isLoading: favoritesQuery.isLoading,
    isPending: mutation.isPending,
    mutationError: mutation.error,
    loadError: favoritesQuery.error,
    toggleFavorite: () =>
      mutation.mutate({ nftId, favorite: !favorite }),
  }
}
