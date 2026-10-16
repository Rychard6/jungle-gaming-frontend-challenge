import { httpClient } from '../../../shared/api/http'
import type { CatalogResponse, NftCollectionCategory, BlockchainNetwork } from '../../../shared/api/types'

export interface CatalogSearchParams {
  q?: string
  categories?: string
  networks?: string
  minPrice?: string
  maxPrice?: string
  tab?: 'all' | 'new' | 'trending'
  sort?: 'recent' | 'price_asc' | 'price_desc' | 'rating_desc'
  page?: number
}

function toApiArray(value?: string): string[] | undefined {
  const values = value?.split(',').map((item) => item.trim()).filter(Boolean)
  return values?.length ? values : undefined
}

export async function fetchCatalog(
  params: CatalogSearchParams,
  signal?: AbortSignal,
): Promise<CatalogResponse> {
  const response = await httpClient.get<CatalogResponse>('/nfts', {
    params: {
      search: params.q,
      categories: toApiArray(params.categories)?.join(','),
      networks: toApiArray(params.networks)?.join(','),
      minPriceEth: params.minPrice,
      maxPriceEth: params.maxPrice,
      tab: params.tab,
      sort: params.sort,
      page: params.page ?? 1,
      limit: 9,
    },
    signal,
  })
  return response.data
}

export const catalogCategories: NftCollectionCategory[] = [
  'Arte digital',
  'Fotografia',
  'Música',
  'Arte 3D',
  'Colecionáveis',
  'Generativa',
  'Jogos',
  'Assinaturas',
  'Utilidade',
]

export const catalogNetworks: BlockchainNetwork[] = [
  'Ethereum',
  'Polygon',
  'Solana',
]
