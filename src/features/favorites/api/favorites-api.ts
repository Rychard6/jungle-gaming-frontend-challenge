import { httpClient } from '../../../shared/api/http'

interface FavoritesResponse {
  nftIds: string[]
}

export async function fetchFavorites(
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await httpClient.get<FavoritesResponse>('/favorites', {
    signal,
  })
  return response.data.nftIds
}

export async function addFavorite(nftId: string): Promise<void> {
  await httpClient.post(`/favorites/${encodeURIComponent(nftId)}`)
}

export async function removeFavorite(nftId: string): Promise<void> {
  await httpClient.delete(`/favorites/${encodeURIComponent(nftId)}`)
}
