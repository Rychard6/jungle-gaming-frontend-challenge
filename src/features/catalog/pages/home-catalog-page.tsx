import { useCallback, useEffect, type FormEvent } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type {
  BlockchainNetwork,
  NftCollectionCategory,
} from '../../../shared/api/types'
import { useDocumentTitle } from '../../../shared/lib/use-document-title'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import {
  CatalogFilters,
  type CatalogFilterValues,
} from '../components/catalog-filters'
import { EditorialSections } from '../components/editorial-sections'
import { FeaturedHero } from '../components/featured-hero'
import { NftCard } from '../components/nft-card'
import { fetchCatalog } from '../api/catalog-api'
import { useUrlSearchField } from '../hooks/use-url-search-field'

const tabs = [
  { id: 'all', label: 'Todos os NFTs' },
  { id: 'new', label: 'Novos lançamentos' },
  { id: 'trending', label: 'Em alta' },
] as const

const sortOptions = [
  { value: 'recent', label: 'Listados recentemente' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'rating_desc', label: 'Melhor avaliados' },
] as const

function valuesToString(values: string[]): string | undefined {
  return values.length > 0 ? values.join(',') : undefined
}

function PageSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Carregando NFTs…</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
        {Array.from({ length: 9 }, (_, index) => (
          <article
            key={index}
            className="overflow-hidden rounded-xl border border-kurio-border bg-kurio-surface p-2 sm:p-3"
          >
            <Skeleton className="aspect-square w-full rounded-lg" />
            <Skeleton className="mt-3 h-3 w-2/5" />
            <Skeleton className="mt-2 h-4 w-4/5" />
            <div className="mt-4 flex justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export function HomeCatalogPage() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })
  useDocumentTitle('KURIO — Marketplace de NFTs')

  // `keepPreviousData` evita o piscar de skeleton ao paginar/filtrar: a grade anterior
  // permanece (esmaecida) até a nova resposta chegar; respostas atrasadas são descartadas
  // pelo TanStack Query porque cada combinação de filtros tem a sua própria chave.
  const catalogQuery = useQuery({
    queryKey: ['nfts', search],
    queryFn: ({ signal }) => fetchCatalog(search, signal),
    placeholderData: keepPreviousData,
  })

  const categoryValues = search.categories?.split(',').filter(Boolean) ?? []
  const networkValues = search.networks?.split(',').filter(Boolean) ?? []

  const commitSearch = useCallback(
    (value: string) => {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, q: value || undefined, page: 1 }),
      })
    },
    [navigate],
  )
  const searchField = useUrlSearchField(search.q ?? '', commitSearch)

  // Página inexistente (ex.: ?page=99 após um filtro): volta para a última página válida.
  const totalPages = catalogQuery.data?.totalPages
  const isPlaceholder = catalogQuery.isPlaceholderData
  useEffect(() => {
    if (
      !isPlaceholder &&
      totalPages !== undefined &&
      totalPages > 0 &&
      search.page > totalPages
    ) {
      void navigate({
        replace: true,
        search: (previous) => ({ ...previous, page: totalPages }),
      })
    }
  }, [isPlaceholder, navigate, search.page, totalPages])

  const updateFilters = (values: CatalogFilterValues) => {
    const currentCategories = search.categories?.split(',').filter(Boolean) ?? []
    const currentNetworks = search.networks?.split(',').filter(Boolean) ?? []
    const categoriesChanged =
      values.categories.join(',') !== currentCategories.join(',')
    const networksChanged = values.networks.join(',') !== currentNetworks.join(',')

    if (categoriesChanged || networksChanged) {
      void navigate({
        search: (previous) => ({
          ...previous,
          categories: valuesToString(values.categories),
          networks: valuesToString(values.networks),
          page: 1,
        }),
      })
    }
  }

  const applyPriceRange = (range: Pick<CatalogFilterValues, 'minPrice' | 'maxPrice'>) => {
    void navigate({
      search: (previous) => ({
        ...previous,
        minPrice: range.minPrice || undefined,
        maxPrice: range.maxPrice || undefined,
        page: 1,
      }),
    })
  }

  const filterValues: CatalogFilterValues = {
    categories: categoryValues,
    networks: networkValues,
    minPrice: search.minPrice ?? '',
    maxPrice: search.maxPrice ?? '',
  }

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    searchField.submit()
  }

  const changeSort = (value: string) => {
    const option = sortOptions.find((candidate) => candidate.value === value)
    if (!option) return
    void navigate({
      search: (previous) => ({ ...previous, sort: option.value, page: 1 }),
    })
  }

  const clearFilters = () => {
    void navigate({
      search: (previous) => ({
        ...previous,
        q: undefined,
        categories: undefined,
        networks: undefined,
        minPrice: undefined,
        maxPrice: undefined,
        tab: 'all',
        sort: 'recent',
        page: 1,
      }),
    })
  }

  const items = catalogQuery.data?.items

  return (
    <main>
      <FeaturedHero search={search} />

      <div id="catalogo" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-8 sm:px-8 sm:py-12">
        <div className="mb-6 flex gap-2 lg:hidden">
          <form onSubmit={applySearch} className="relative min-w-0 flex-1">
            <label htmlFor="mobile-catalog-search" className="sr-only">
              Explorar coleções
            </label>
            <Search
              size={17}
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-kurio-text-muted"
            />
            <input
              id="mobile-catalog-search"
              value={searchField.value}
              onChange={(event) => searchField.onChange(event.target.value)}
              placeholder="Explorar coleções"
              className="h-11 w-full rounded-md border border-kurio-border bg-kurio-surface pl-10 pr-3 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
            />
          </form>
          <CatalogFilters
            values={filterValues}
            categoryCounts={catalogQuery.data?.counts.categories ?? emptyCategoryCounts()}
            networkCounts={catalogQuery.data?.counts.networks ?? emptyNetworkCounts()}
            onChange={updateFilters}
            onApplyPriceRange={applyPriceRange}
            variant="mobile"
            idPrefix="mobile-catalog"
          />
        </div>

        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-kurio-amber">
              Coleção KURIO
            </p>
            <h2 className="text-xl font-bold text-kurio-text sm:text-2xl">
              Explore o mercado
            </h2>
          </div>
          <p aria-live="polite" className="text-right text-[10px] text-kurio-text-muted sm:text-xs">
            {catalogQuery.data?.total ?? 0} peças selecionadas
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:gap-8">
          <CatalogFilters
            values={filterValues}
            categoryCounts={catalogQuery.data?.counts.categories ?? emptyCategoryCounts()}
            networkCounts={catalogQuery.data?.counts.networks ?? emptyNetworkCounts()}
            onChange={updateFilters}
            onApplyPriceRange={applyPriceRange}
            variant="desktop"
            idPrefix="desktop-catalog"
          />

          <section
            aria-label="Resultados do catálogo"
            aria-busy={catalogQuery.isFetching}
            className="min-w-0"
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 rounded-lg border border-kurio-border bg-kurio-surface p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={search.tab === tab.id}
                    onClick={() =>
                      void navigate({
                        search: (previous) => ({ ...previous, tab: tab.id, page: 1 }),
                      })
                    }
                    className={`rounded-md px-3 py-2 text-[10px] font-semibold focus-visible:outline-2 focus-visible:outline-kurio-amber sm:text-xs ${
                      search.tab === tab.id
                        ? 'bg-kurio-amber text-kurio-bg'
                        : 'text-kurio-text-muted hover:text-kurio-text'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[10px] text-kurio-text-muted sm:text-xs">
                Ordenar por:
                <select
                  value={search.sort}
                  onChange={(event) => changeSort(event.target.value)}
                  className="max-w-44 rounded-md border border-kurio-border bg-kurio-surface px-2 py-2 text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {catalogQuery.isLoading ? (
              <PageSkeleton />
            ) : catalogQuery.isError ? (
              <div role="alert" className="rounded-xl border border-kurio-danger/40 bg-kurio-surface p-8 text-center">
                <p className="font-semibold text-kurio-text">Não foi possível carregar os NFTs.</p>
                <p className="mt-2 text-xs text-kurio-text-muted">{catalogQuery.error.message}</p>
                <Button
                  variant="outline"
                  onClick={() => void catalogQuery.refetch()}
                  className="mt-5"
                >
                  Tentar novamente
                </Button>
              </div>
            ) : items?.length === 0 ? (
              <div className="rounded-xl border border-kurio-border bg-kurio-surface p-10 text-center">
                <h3 className="text-lg font-semibold text-kurio-text">Nenhum NFT encontrado</h3>
                <p className="mt-2 text-sm text-kurio-text-muted">
                  Tente ajustar a busca ou remover alguns filtros.
                </p>
                <Button onClick={clearFilters} className="mt-5">
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <>
                <div
                  className={`grid grid-cols-2 gap-3 transition-opacity motion-reduce:transition-none md:grid-cols-3 md:gap-5 ${
                    isPlaceholder ? 'opacity-60' : ''
                  }`}
                >
                  {items?.map((nft) => (
                    <NftCard key={nft.id} nft={nft} />
                  ))}
                </div>
                {catalogQuery.data && catalogQuery.data.totalPages > 1 && (
                  <nav aria-label="Paginação do catálogo" className="mt-8 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      aria-label="Página anterior"
                      disabled={search.page <= 1}
                      onClick={() =>
                        void navigate({
                          search: (previous) => ({ ...previous, page: search.page - 1 }),
                        })
                      }
                      className="grid size-9 place-items-center rounded-md border border-kurio-border text-kurio-text disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-kurio-amber"
                    >
                      <ChevronLeft size={17} aria-hidden="true" />
                    </button>
                    {Array.from(
                      { length: catalogQuery.data.totalPages },
                      (_, index) => index + 1,
                    ).map((page) => (
                      <button
                        key={page}
                        type="button"
                        aria-label={`Página ${page}`}
                        aria-current={page === search.page ? 'page' : undefined}
                        onClick={() =>
                          void navigate({ search: (previous) => ({ ...previous, page }) })
                        }
                        className={`grid size-9 place-items-center rounded-md border text-xs focus-visible:outline-2 focus-visible:outline-kurio-amber ${
                          page === search.page
                            ? 'border-kurio-amber bg-kurio-amber text-kurio-bg'
                            : 'border-kurio-border text-kurio-text'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      aria-label="Próxima página"
                      disabled={search.page >= catalogQuery.data.totalPages}
                      onClick={() =>
                        void navigate({
                          search: (previous) => ({ ...previous, page: search.page + 1 }),
                        })
                      }
                      className="grid size-9 place-items-center rounded-md border border-kurio-border text-kurio-text disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-kurio-amber"
                    >
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>

        <EditorialSections search={search} />
      </div>
    </main>
  )
}

function emptyCategoryCounts(): Record<NftCollectionCategory, number> {
  return {
    'Arte digital': 0,
    Fotografia: 0,
    Música: 0,
    'Arte 3D': 0,
    Colecionáveis: 0,
    Generativa: 0,
    Jogos: 0,
    Assinaturas: 0,
    Utilidade: 0,
  }
}

function emptyNetworkCounts(): Record<BlockchainNetwork, number> {
  return { Ethereum: 0, Polygon: 0, Solana: 0 }
}
