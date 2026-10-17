import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import type { HomeSearch } from '../../../app/router'
import { Skeleton } from '../../../shared/ui/skeleton'
import { buttonVariants } from '../../../shared/ui/button-variants'
import {
  featuredNftsQueryKey,
  fetchFeaturedNfts,
} from '../api/catalog-api'

/**
 * Destaque principal da home. A peça exibida vem da API (`GET /nfts?featured=true`), então
 * preço e disponibilidade seguem os eventos `nft.updated` como no restante do catálogo.
 */
export function FeaturedHero({ search }: { search: HomeSearch }) {
  const featuredQuery = useQuery({
    queryKey: featuredNftsQueryKey,
    queryFn: ({ signal }) => fetchFeaturedNfts(signal),
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const featured = featuredQuery.data?.items ?? []
  const active = featured.find((item) => item.id === selectedId) ?? featured[0]

  return (
    <section
      aria-label="Destaques"
      className="relative isolate overflow-hidden border-b border-kurio-border bg-kurio-surface"
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-7 px-5 py-8 sm:px-8 md:grid-cols-[1fr_0.8fr] md:py-14">
        <div className="relative z-10 order-2 md:order-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-kurio-amber sm:text-xs">
            Bem-vindo à Kurio
          </p>
          <h1 className="mt-4 max-w-xl text-3xl font-bold uppercase leading-tight text-kurio-text sm:text-5xl">
            Seja dono do futuro da arte digital
          </h1>
          <p className="mt-4 max-w-lg text-xs leading-6 text-kurio-text-muted sm:text-sm">
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <Link
            to="/"
            search={search}
            hash="catalogo"
            className={buttonVariants({
              size: 'lg',
              className: 'mt-6 uppercase',
            })}
          >
            Explorar <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div className="relative order-1 mx-auto w-full max-w-sm md:order-2 md:max-w-none">
          <div className="absolute -inset-5 rounded-full bg-kurio-amber/10 blur-3xl" />
          {active ? (
            <Link
              to="/nfts/$nftId"
              params={{ nftId: active.id }}
              aria-label={`Ver detalhes de ${active.title}, peça em destaque`}
              className="relative block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
            >
              <img
                src={active.imageUrl}
                alt={`${active.title}, peça em destaque da coleção ${active.collectionName}`}
                width={640}
                height={556}
                fetchPriority="high"
                className="aspect-[1.15] w-full rounded-xl object-cover sm:aspect-[1.35] md:aspect-[1.15]"
              />
              <span className="absolute bottom-3 left-3 rounded-lg border border-kurio-border bg-kurio-bg/90 px-3 py-2 backdrop-blur">
                <span className="block text-[9px] uppercase tracking-wider text-kurio-text-muted">
                  Destaque KURIO
                </span>
                <span className="mt-1 block text-xs font-semibold text-kurio-text">
                  {active.title}
                </span>
              </span>
            </Link>
          ) : (
            <Skeleton className="relative aspect-[1.15] w-full rounded-xl sm:aspect-[1.35] md:aspect-[1.15]" />
          )}
            <div
              role="group"
              aria-label="Escolher destaque"
              className="relative mt-3 flex h-6 justify-center gap-1"
            >
              {featured.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Destaque ${index + 1}: ${item.title}`}
                  aria-pressed={item.id === active?.id}
                  onClick={() => setSelectedId(item.id)}
                  className="grid size-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rounded-full border border-kurio-amber ${
                      item.id === active?.id ? 'bg-kurio-amber' : 'bg-transparent'
                    }`}
                  />
                </button>
              ))}
            </div>
        </div>
      </div>
    </section>
  )
}
