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
  featured?: boolean
  page?: number
  limit?: number
}

export const CATALOG_PAGE_SIZE = 9

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
      featured: params.featured ? true : undefined,
      page: params.page ?? 1,
      limit: params.limit ?? CATALOG_PAGE_SIZE,
    },
    signal,
  })
  return response.data
}

// Mantém o prefixo ['nfts'] para que eventos `nft.updated` atualizem também os destaques.
export const featuredNftsQueryKey = ['nfts', 'featured'] as const

export function fetchFeaturedNfts(signal?: AbortSignal): Promise<CatalogResponse> {
  return fetchCatalog({ featured: true, limit: 6 }, signal)
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
