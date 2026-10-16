import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowRight, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import type {
  BlockchainNetwork,
  NftCollectionCategory,
} from '../../../shared/api/types'
import { Skeleton } from '../../../shared/ui/skeleton'
import {
  CatalogFilters,
  type CatalogFilterValues,
} from '../components/catalog-filters'
import { NftCard } from '../components/nft-card'
import { fetchCatalog } from '../api/catalog-api'

const tabs = [
  { id: 'all', label: 'Todos' },
  { id: 'new', label: 'Novos' },
  { id: 'trending', label: 'Em alta' },
] as const

function valuesToString(values: string[]): string | undefined {
  return values.length > 0 ? values.join(',') : undefined
}

function PageSkeleton() {
  return (
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
  )
}

export function HomeCatalogPage() {
  const search = useSearch({ from: '/' })
  const navigate = useNavigate({ from: '/' })

  const catalogQuery = useQuery({
    queryKey: ['nfts', search],
    queryFn: ({ signal }) => fetchCatalog(search, signal),
  })

  const categoryValues = search.categories?.split(',').filter(Boolean) ?? []
  const networkValues = search.networks?.split(',').filter(Boolean) ?? []

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
    void navigate({
      search: (previous) => ({
        ...previous,
        q: search.q?.trim() || undefined,
        page: 1,
      }),
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

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-kurio-border bg-kurio-surface">
        <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-7 px-5 py-8 sm:px-8 md:grid-cols-[1fr_0.8fr] md:py-14">
          <div className="relative z-10 order-2 md:order-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-kurio-amber sm:text-xs">
              Arte digital · Edição limitada
            </p>
            <h1 className="mt-4 max-w-xl text-3xl font-bold leading-tight text-kurio-text sm:text-5xl">
              Descubra peças que contam histórias.
            </h1>
            <p className="mt-4 max-w-lg text-xs leading-6 text-kurio-text-muted sm:text-sm">
              Colecione arte digital singular, selecionada por quem vive a cultura.
            </p>
            <a
              href="#catalogo"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-kurio-amber px-4 py-3 text-xs font-bold text-kurio-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber sm:text-sm"
            >
              Explorar coleção <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="relative order-1 mx-auto w-full max-w-sm md:order-2 md:max-w-none">
            <div className="absolute -inset-5 rounded-full bg-kurio-amber/10 blur-3xl" />
            <img
              src="/mock-assets/nfts/ape-emerald.png"
              alt="Emerald Ape, peça em destaque da coleção KURIO"
              fetchPriority="high"
              className="relative aspect-[1.15] w-full rounded-xl object-cover sm:aspect-[1.35] md:aspect-[1.15]"
            />
            <div className="absolute bottom-3 left-3 rounded-lg border border-kurio-border bg-kurio-bg/90 px-3 py-2 backdrop-blur">
              <p className="text-[9px] uppercase tracking-wider text-kurio-text-muted">Destaque KURIO</p>
              <p className="mt-1 text-xs font-semibold text-kurio-text">Emerald Ape #042</p>
            </div>
          </div>
        </div>
      </section>

      <main id="catalogo" className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
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
              value={search.q ?? ''}
              onChange={(event) =>
                void navigate({
                  search: (previous) => ({
                    ...previous,
                    q: event.target.value || undefined,
                    page: 1,
                  }),
                })
              }
              placeholder="Explorar coleções"
              className="h-11 w-full rounded-md border border-kurio-border bg-kurio-surface pl-10 pr-3 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
            />
          </form>
          <CatalogFilters
            key={`mobile-${search.minPrice ?? ''}-${search.maxPrice ?? ''}`}
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
          <p className="text-right text-[10px] text-kurio-text-muted sm:text-xs">
            {catalogQuery.data?.total ?? 0} peças selecionadas
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] xl:gap-8">
          <CatalogFilters
            key={`desktop-${search.minPrice ?? ''}-${search.maxPrice ?? ''}`}
            values={filterValues}
            categoryCounts={catalogQuery.data?.counts.categories ?? emptyCategoryCounts()}
            networkCounts={catalogQuery.data?.counts.networks ?? emptyNetworkCounts()}
            onChange={updateFilters}
            onApplyPriceRange={applyPriceRange}
            variant="desktop"
            idPrefix="desktop-catalog"
          />

          <section aria-label="Resultados do catálogo" className="min-w-0">
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
                    className={`rounded-md px-3 py-2 text-[10px] font-semibold sm:text-xs ${
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
                Ordenar
                <select
                  value={search.sort}
                  onChange={(event) =>
                    void navigate({
                      search: (previous) => ({
                        ...previous,
                        sort: event.target.value as typeof search.sort,
                        page: 1,
                      }),
                    })
                  }
                  className="max-w-40 rounded-md border border-kurio-border bg-kurio-surface px-2 py-2 text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  <option value="recent">Mais recentes</option>
                  <option value="price_asc">Menor preço</option>
                  <option value="price_desc">Maior preço</option>
                  <option value="rating_desc">Melhor avaliados</option>
                </select>
              </label>
            </div>

            {catalogQuery.isLoading ? (
              <PageSkeleton />
            ) : catalogQuery.isError ? (
              <div role="alert" className="rounded-xl border border-kurio-danger/40 bg-kurio-surface p-8 text-center">
                <p className="font-semibold text-kurio-text">Não foi possível carregar os NFTs.</p>
                <p className="mt-2 text-xs text-kurio-text-muted">{catalogQuery.error.message}</p>
                <button
                  type="button"
                  onClick={() => void catalogQuery.refetch()}
                  className="mt-5 rounded-md border border-kurio-amber px-4 py-2 text-xs font-semibold text-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  Tentar novamente
                </button>
              </div>
            ) : catalogQuery.data?.items.length === 0 ? (
              <div className="rounded-xl border border-kurio-border bg-kurio-surface p-10 text-center">
                <h3 className="text-lg font-semibold text-kurio-text">Nenhum NFT encontrado</h3>
                <p className="mt-2 text-sm text-kurio-text-muted">
                  Tente ajustar a busca ou remover alguns filtros.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-md bg-kurio-amber px-4 py-2 text-xs font-bold text-kurio-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
                >
                  Limpar filtros
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
                  {catalogQuery.data?.items.map((nft) => (
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
                        aria-current={page === search.page ? 'page' : undefined}
                        onClick={() =>
                          void navigate({ search: (previous) => ({ ...previous, page }) })
                        }
                        className={`grid size-9 place-items-center rounded-md border text-xs ${
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

        <section className="mt-16 grid gap-5 border-y border-kurio-border py-10 sm:grid-cols-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">Edições especiais</p>
            <h2 className="mt-3 text-xl font-bold text-kurio-text">Lançamentos gênesis de edição limitada</h2>
          </div>
          <p className="self-end text-xs leading-6 text-kurio-text-muted">
            Descubra as primeiras obras de coleções que estão moldando a próxima geração da arte digital.
          </p>
        </section>

        <section className="grid gap-6 py-10 md:grid-cols-2 md:items-center">
          <img
            src="/mock-assets/nfts/ape-cosmic.png"
            alt="Arte digital cósmica selecionada pela KURIO"
            loading="lazy"
            className="aspect-[1.7] w-full rounded-xl object-cover"
          />
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">Curadoria KURIO</p>
            <h2 className="mt-3 text-2xl font-bold text-kurio-text">Arte digital selecionada e muito mais</h2>
            <p className="mt-3 text-xs leading-6 text-kurio-text-muted">
              Uma seleção que aproxima colecionadores de artistas e novas expressões da cultura.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-kurio-border bg-kurio-surface p-6 sm:p-8">
          <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">Notas do estúdio</p>
          <h2 className="mt-3 text-xl font-bold text-kurio-text">Diário da Cunhagem</h2>
          <p className="mt-3 max-w-2xl text-xs leading-6 text-kurio-text-muted">
            Histórias, processos e ideias por trás das peças digitais que chegam ao mercado KURIO.
          </p>
        </section>
      </main>
    </>
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
