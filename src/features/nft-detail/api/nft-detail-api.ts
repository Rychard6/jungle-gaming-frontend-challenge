import { httpClient } from '../../../shared/api/http'
import type { CatalogResponse, NftItem } from '../../../shared/api/types'

export async function fetchNftDetail(
  nftId: string,
  signal?: AbortSignal,
): Promise<NftItem> {
  const response = await httpClient.get<NftItem>(
    `/nfts/${encodeURIComponent(nftId)}`,
    { signal },
  )
  return response.data
}

export async function fetchCollectionNfts(
  collectionName: string,
  signal?: AbortSignal,
): Promise<NftItem[]> {
  const response = await httpClient.get<CatalogResponse>('/nfts', {
    params: { search: collectionName, limit: 100, page: 1 },
    signal,
  })
  return response.data.items.filter(
    (nft) => nft.collectionName === collectionName,
  )
}
