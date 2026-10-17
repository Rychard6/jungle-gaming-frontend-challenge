import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Copy,
  Heart,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
} from 'lucide-react'
import { ApiClientError } from '../../../shared/api/http'
import { NFT_EDITION_TYPES } from '../../../shared/api/types'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import { useDocumentTitle } from '../../../shared/lib/use-document-title'
import { Button } from '../../../shared/ui/button'
import { buttonVariants } from '../../../shared/ui/button-variants'
import { Skeleton } from '../../../shared/ui/skeleton'
import { NftCard } from '../../catalog/components/nft-card'
import { useFavorites } from '../../favorites/hooks/use-favorites'
import { useCart } from '../../cart/hooks/use-cart'
import {
  fetchCollectionNfts,
  fetchNftDetail,
} from '../api/nft-detail-api'
import { NftGallery } from '../components/nft-gallery'

const HOME_SEARCH = { tab: 'all', sort: 'recent', page: 1 } as const

function formatEditions(count: number): string {
  return `${count} ${count === 1 ? 'edição' : 'edições'}`
}

function DetailSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <span className="sr-only">Carregando NFT…</span>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <Skeleton className="aspect-square w-full rounded-2xl" />
        <div className="space-y-5 py-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </main>
  )
}

export function NftDetailPage() {
  const { nftId } = useParams({ from: '/nfts/$nftId' })
  const navigate = useNavigate()
  const [quantityState, setQuantityState] = useState({ nftId, quantity: 1 })
  const [feedback, setFeedback] = useState({
    nftId,
    notice: '',
    error: '',
  })
  const quantity =
    quantityState.nftId === nftId ? quantityState.quantity : 1
  const notice = feedback.nftId === nftId ? feedback.notice : ''
  const actionError = feedback.nftId === nftId ? feedback.error : ''
  const nftQuery = useQuery({
    queryKey: ['nft', nftId],
    queryFn: ({ signal }) => fetchNftDetail(nftId, signal),
  })
  const nft = nftQuery.data
  useDocumentTitle(nft ? `${nft.title} — KURIO` : 'NFT — KURIO')
  const collectionQuery = useQuery({
    queryKey: ['nft-collection', nft?.collectionName],
    queryFn: ({ signal }) => fetchCollectionNfts(nft?.collectionName ?? '', signal),
    enabled: nft !== undefined,
  })
  const favorites = useFavorites(nft?.id ?? '')
  const cart = useCart()

  const inCartQuantity =
    cart.cart?.items.find((item) => item.nftId === nft?.id)?.quantity ?? 0
  const remainingEditions = Math.max(
    0,
    (nft?.availableEditions ?? 0) - inCartQuantity,
  )
  const selectedQuantity =
    remainingEditions > 0
      ? Math.min(Math.max(quantity, 1), remainingEditions)
      : 0

  const addToCart = async (goToCart = false) => {
    if (!nft || selectedQuantity < 1) return
    try {
      await cart.addItemAsync({
        nftId: nft.id,
        quantity: selectedQuantity,
        editionType: nft.editionType,
      })
      setFeedback({
        nftId,
        notice: `${formatEditions(selectedQuantity)} de ${nft.title} adicionada(s) ao carrinho.`,
        error: '',
      })
      if (goToCart) {
        void navigate({ to: '/cart' })
      }
    } catch (error) {
      setFeedback({
        nftId,
        notice: '',
        error:
          error instanceof Error
            ? error.message
            : 'Não foi possível adicionar o NFT ao carrinho.',
      })
    }
  }

  const shareNft = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setFeedback({ nftId, notice: 'Link do NFT copiado.', error: '' })
    } catch {
      setFeedback({
        nftId,
        notice: '',
        error: 'Não foi possível copiar o link. Tente novamente.',
      })
    }
  }

  if (nftQuery.isLoading) return <DetailSkeleton />

  if (nftQuery.isError) {
    const isNotFound =
      nftQuery.error instanceof ApiClientError &&
      nftQuery.error.status === 404

    return (
      <main className="mx-auto max-w-3xl px-5 py-20 text-center sm:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-kurio-amber">
          {isNotFound ? '404 · NFT não encontrado' : 'Falha ao carregar'}
        </p>
        <h1 className="mt-4 text-2xl font-bold text-kurio-text sm:text-3xl">
          {isNotFound ? 'Esta peça não está disponível.' : 'Não foi possível abrir o NFT.'}
        </h1>
        <p role="alert" className="mt-3 text-sm text-kurio-text-muted">
          {nftQuery.error.message}
        </p>
        {!isNotFound && (
          <Button
            variant="outline"
            onClick={() => void nftQuery.refetch()}
            className="mt-6"
          >
            Tentar novamente
          </Button>
        )}
        <Link
          to="/"
          search={HOME_SEARCH}
          className={buttonVariants({ className: 'mx-auto mt-6 flex w-fit' })}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Voltar ao catálogo
        </Link>
      </main>
    )
  }

  if (!nft) return null

  const soldOut = nft.availableEditions < 1
  const cartHoldsEverything = !soldOut && remainingEditions < 1
  const atQuantityLimit = remainingEditions > 0 && selectedQuantity >= remainingEditions
  const relatedNfts =
    collectionQuery.data?.filter((item) => item.id !== nft.id) ?? []
  const availabilityMessage = soldOut
    ? 'Edição esgotada: esta peça não está mais disponível para compra.'
    : cartHoldsEverything
      ? `Você já tem ${formatEditions(inCartQuantity)} no carrinho, o máximo disponível.`
      : atQuantityLimit
        ? `Limite de ${formatEditions(remainingEditions)} para este NFT atingido.`
        : `${nft.availableEditions} disponíveis`

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-4 hidden text-[10px] text-kurio-text-muted sm:block">
        <Link to="/" search={HOME_SEARCH} className="hover:text-kurio-amber">Início</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <Link to="/" search={HOME_SEARCH} hash="catalogo" className="hover:text-kurio-amber">Mercado</Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span aria-current="page" className="text-kurio-text">{nft.title}</span>
      </nav>
      <Link
        to="/"
        search={HOME_SEARCH}
        className="mb-6 inline-flex items-center gap-2 rounded text-xs text-kurio-text-muted hover:text-kurio-amber focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-kurio-amber sm:mb-8"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Voltar ao catálogo
      </Link>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-12">
        <NftGallery
          key={nft.id}
          title={nft.title}
          imageUrl={nft.imageUrl}
          galleryUrls={nft.galleryUrls}
        />

        <section className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-kurio-amber">
                {nft.collectionName}
              </p>
              <h1 className="mt-2 text-2xl font-bold leading-tight text-kurio-text sm:text-3xl">
                {nft.title}
              </h1>
              <p className="mt-3 text-xs text-kurio-text-muted">
                <span role="img" className="text-kurio-amber" aria-label={`${nft.rating} de 5 estrelas`}>
                  ★
                </span>{' '}
                {nft.rating.toFixed(1)} ({nft.reviewsCount} avaliações de colecionadores)
              </p>
            </div>
            <button
              type="button"
              onClick={favorites.toggleFavorite}
              disabled={favorites.isPending}
              aria-label={
                favorites.favorite
                  ? `Remover ${nft.title} dos favoritos`
                  : `Adicionar ${nft.title} aos favoritos`
              }
              aria-pressed={favorites.favorite}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-kurio-border text-kurio-amber hover:border-kurio-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:opacity-60"
            >
              <Heart
                size={19}
                fill={favorites.favorite ? 'currentColor' : 'none'}
                aria-hidden="true"
              />
            </button>
          </div>

          {favorites.mutationError && (
            <p role="alert" className="mt-3 text-xs text-kurio-danger">
              Não foi possível atualizar os favoritos. A alteração foi revertida.
            </p>
          )}
          {!favorites.mutationError && favorites.loadError && (
            <p role="alert" className="mt-3 text-xs text-kurio-danger">
              Não foi possível carregar a lista de favoritos.
            </p>
          )}

          <p className="mt-6 text-sm leading-7 text-kurio-text-muted">
            {nft.longDescription}
          </p>

          <div className="mt-6">
            <p id="edition-label" className="text-[10px] uppercase tracking-wider text-kurio-text-muted">
              Edição
            </p>
            <div role="radiogroup" aria-labelledby="edition-label" className="mt-2 flex flex-wrap gap-2">
              {NFT_EDITION_TYPES.map((edition) => {
                const isCurrent = edition === nft.editionType
                return (
                  <button
                    key={edition}
                    type="button"
                    role="radio"
                    aria-checked={isCurrent}
                    disabled={!isCurrent}
                    title={isCurrent ? undefined : 'Edição indisponível para esta peça'}
                    className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold ${
                      isCurrent
                        ? 'border-kurio-amber/60 bg-kurio-amber/10 text-kurio-amber'
                        : 'border-kurio-border text-kurio-text-muted line-through opacity-50'
                    }`}
                  >
                    {edition}
                  </button>
                )
              })}
            </div>
            <p
              aria-live="polite"
              className={`mt-3 text-xs ${soldOut ? 'font-semibold text-kurio-danger' : 'text-kurio-text-muted'}`}
            >
              {availabilityMessage}
            </p>
          </div>

          <div className="mt-7 rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-kurio-text-muted">
                  Preço por edição
                </p>
                <p className="mt-1 text-2xl font-bold text-kurio-amber">
                  {formatEthDisplay(nft.priceEth)}
                </p>
              </div>
              <div>
                <p className="mb-2 text-[10px] text-kurio-text-muted">Qtd.</p>
                <div className="flex items-center gap-3 rounded-md border border-kurio-border px-2 py-1.5">
                  <button
                    type="button"
                    aria-label={`Diminuir quantidade de ${nft.title}`}
                    disabled={selectedQuantity <= 1}
                    onClick={() =>
                      setQuantityState((current) => ({
                        nftId,
                        quantity: Math.max(
                          1,
                          current.nftId === nftId ? current.quantity - 1 : 0,
                        ),
                      }))
                    }
                    className="grid size-7 place-items-center rounded text-kurio-text hover:bg-kurio-surface-elevated focus-visible:outline-2 focus-visible:outline-kurio-amber disabled:opacity-40"
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <output aria-label="Quantidade selecionada" className="min-w-4 text-center text-xs">
                    {selectedQuantity}
                  </output>
                  <button
                    type="button"
                    aria-label={`Aumentar quantidade de ${nft.title}`}
                    disabled={selectedQuantity >= remainingEditions}
                    onClick={() =>
                      setQuantityState((current) => ({
                        nftId,
                        quantity: Math.min(
                          remainingEditions,
                          (current.nftId === nftId ? current.quantity : 1) + 1,
                        ),
                      }))
                    }
                    className="grid size-7 place-items-center rounded text-kurio-text hover:bg-kurio-surface-elevated focus-visible:outline-2 focus-visible:outline-kurio-amber disabled:opacity-40"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                size="lg"
                disabled={remainingEditions < 1 || cart.isMutating}
                onClick={() => void addToCart(true)}
                className="min-h-11"
              >
                <ShoppingBag size={16} aria-hidden="true" />
                Comprar agora
              </Button>
              <Button
                variant="outline"
                size="lg"
                disabled={remainingEditions < 1 || cart.isMutating}
                onClick={() => void addToCart()}
                className="min-h-11 font-semibold"
              >
                <ShoppingBag size={16} aria-hidden="true" />
                Adicionar ao carrinho
              </Button>
            </div>
            {notice && (
              <p role="status" className="mt-3 text-xs text-kurio-success">
                {notice}
              </p>
            )}
            {actionError && (
              <p role="alert" className="mt-3 text-xs text-kurio-danger">
                {actionError}
              </p>
            )}
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-kurio-border p-4 text-xs">
            <div>
              <dt className="text-[10px] uppercase text-kurio-text-muted">ID do token</dt>
              <dd className="mt-1 font-semibold text-kurio-text">{nft.tokenId}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-kurio-text-muted">Coleção</dt>
              <dd className="mt-1 font-semibold text-kurio-text">{nft.collectionName}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-kurio-text-muted">Rede</dt>
              <dd className="mt-1 font-semibold text-kurio-text">{nft.network}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase text-kurio-text-muted">Direitos autorais</dt>
              <dd className="mt-1 font-semibold text-kurio-text">{nft.creatorRoyaltyPercent}%</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase text-kurio-text-muted">Contrato</dt>
              <dd className="mt-1 break-all font-semibold text-kurio-text">
                {nft.contractAddress}
              </dd>
            </div>
          </dl>

          <section className="mt-6" aria-labelledby="nft-attributes-title">
            <h2 id="nft-attributes-title" className="text-xs font-semibold text-kurio-text">
              Atributos
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {nft.attributes.map((attribute) => (
                <li
                  key={attribute}
                  className="rounded-md border border-kurio-border bg-kurio-surface px-3 py-2 text-[10px] text-kurio-text-muted"
                >
                  {attribute}
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-kurio-border pt-5">
            <span className="mr-1 text-[10px] uppercase tracking-wider text-kurio-text-muted">
              Compartilhar este NFT
            </span>
            <a
              href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(nft.title)}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Compartilhar ${nft.title} no X (abre em nova aba)`}
              className="inline-flex items-center gap-2 rounded-md border border-kurio-border px-3 py-2 text-[10px] text-kurio-text hover:border-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              <Share2 size={14} aria-hidden="true" />
              X
            </a>
            <button
              type="button"
              onClick={() => void shareNft()}
              className="inline-flex items-center gap-2 rounded-md border border-kurio-border px-3 py-2 text-[10px] text-kurio-text hover:border-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              <Copy size={14} aria-hidden="true" />
              Copiar link
            </button>
          </div>
        </section>
      </div>

      <section className="mt-14 border-t border-kurio-border pt-9 sm:mt-20" aria-labelledby="same-collection-title">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">
              {nft.collectionName}
            </p>
            <h2 id="same-collection-title" className="mt-2 text-xl font-bold text-kurio-text">
              Mais desta coleção
            </h2>
          </div>
        </div>
        {collectionQuery.isLoading ? (
          <div aria-busy="true" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            <span className="sr-only">Carregando itens da coleção…</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="aspect-[0.85] w-full rounded-xl" />
            ))}
          </div>
        ) : collectionQuery.isError ? (
          <p role="alert" className="text-xs text-kurio-danger">
            Não foi possível carregar os outros itens desta coleção.
          </p>
        ) : relatedNfts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {relatedNfts.slice(0, 3).map((item) => (
              <NftCard key={item.id} nft={item} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-kurio-border bg-kurio-surface p-5 text-xs text-kurio-text-muted">
            Esta é a única peça disponível desta coleção no momento.
          </p>
        )}
      </section>
    </main>
  )
}
