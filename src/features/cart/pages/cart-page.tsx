import { useRef, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import type { CartDto, CartItemDto } from '../../../shared/api/types'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import { useDocumentTitle } from '../../../shared/lib/use-document-title'
import { Button } from '../../../shared/ui/button'
import { buttonVariants } from '../../../shared/ui/button-variants'
import { Skeleton } from '../../../shared/ui/skeleton'
import { fetchCatalog } from '../../catalog/api/catalog-api'
import { NftCard } from '../../catalog/components/nft-card'
import { CartSummaryCard } from '../components/cart-summary-card'
import { useCart } from '../hooks/use-cart'
import { useAuth } from '../../auth/hooks/auth-context'

function CartSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_350px]">
      <span className="sr-only">Carregando carrinho…</span>
      <div className="space-y-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            className="flex gap-4 rounded-xl border border-kurio-border bg-kurio-surface p-4"
          >
            <Skeleton className="aspect-square w-24 shrink-0 rounded-lg sm:w-32" />
            <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="mt-auto h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-[360px] rounded-xl border border-kurio-border" />
    </div>
  )
}

function getCartErrorMessage(error: Error): string {
  const code = 'code' in error ? error.code : undefined
  if (code === 'INSUFFICIENT_STOCK') {
    return 'A quantidade solicitada excede as edições disponíveis.'
  }
  if (code === 'COUPON_EXPIRED') return 'Este código promocional expirou.'
  if (code === 'INVALID_COUPON') return 'Código promocional inválido.'
  // As demais mensagens (inclusive a do subtotal mínimo do cupom) vêm da API: a regra mora lá.
  return error.message
}

function formatEditions(count: number): string {
  return `${count} ${count === 1 ? 'edição' : 'edições'}`
}

function CartItemRow({
  item,
  busy,
  onUpdate,
  onRemove,
}: {
  item: CartItemDto
  busy: boolean
  onUpdate: (itemId: string, quantity: number) => void
  onRemove: (item: CartItemDto) => void
}) {
  const unavailable = item.availableEditions === 0

  return (
    <article className="grid grid-cols-[84px_minmax(0,1fr)] gap-3 rounded-xl border border-kurio-border bg-kurio-surface p-3 sm:grid-cols-[128px_minmax(0,1fr)_auto] sm:gap-5 sm:p-4">
      <Link
        to="/nfts/$nftId"
        params={{ nftId: item.nftId }}
        aria-label={`Ver ${item.title}`}
        className="block overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
      >
        <img
          src={item.imageUrl}
          alt={item.title}
          width={128}
          height={128}
          className="aspect-square w-full object-cover"
        />
      </Link>
      <div className="flex min-w-0 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to="/nfts/$nftId"
              params={{ nftId: item.nftId }}
              className="line-clamp-2 text-xs font-bold text-kurio-text hover:text-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber sm:text-sm"
            >
              {item.title}
            </Link>
            <p className="mt-2 text-[9px] text-kurio-text-muted">
              ID do token: {item.tokenId}
            </p>
            <p className="mt-1 text-[9px] text-kurio-text-muted sm:hidden">
              Edição: {item.editionType}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemove(item)}
            disabled={busy}
            aria-label={`Remover ${item.title} do carrinho`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-kurio-text-muted hover:bg-kurio-danger/10 hover:text-kurio-danger focus-visible:outline-2 focus-visible:outline-kurio-amber disabled:opacity-50 sm:hidden"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 text-[9px] text-kurio-text-muted">
          {formatEthDisplay(item.unitPriceEth)} <span className="hidden sm:inline">/ edição · {item.editionType}</span>
        </p>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
          <div
            role="group"
            className="inline-flex items-center gap-2 rounded-full border border-kurio-border p-1"
            aria-label={`Quantidade de ${item.title}`}
          >
            <button
              type="button"
              onClick={() => onUpdate(item.itemId, item.quantity - 1)}
              disabled={busy || item.quantity <= 1}
              aria-label={`Diminuir quantidade de ${item.title}`}
              className="grid size-7 place-items-center rounded-full bg-kurio-amber text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-kurio-text disabled:opacity-40"
            >
              <Minus size={13} aria-hidden="true" />
            </button>
            <output className="min-w-4 text-center text-[10px] font-semibold">
              {item.quantity}
            </output>
            <button
              type="button"
              onClick={() => onUpdate(item.itemId, item.quantity + 1)}
              disabled={busy || item.quantity >= item.availableEditions}
              aria-label={`Aumentar quantidade de ${item.title}`}
              className="grid size-7 place-items-center rounded-full bg-kurio-amber text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-kurio-text disabled:opacity-40"
            >
              <Plus size={13} aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs font-bold text-kurio-amber">
            {formatEthDisplay(item.lineTotalEth)}
          </p>
        </div>
        {item.quantity >= item.availableEditions && !item.insufficientStock && (
          <p className="mt-2 text-[9px] text-kurio-text-muted">
            Limite de {formatEditions(item.availableEditions)} disponíveis atingido.
          </p>
        )}
        {item.insufficientStock && (
          <p role="alert" className="mt-2 text-[9px] text-kurio-danger">
            {unavailable
              ? 'Esta peça esgotou.'
              : `Disponibilidade reduzida para ${formatEditions(item.availableEditions)}.`}
          </p>
        )}
      </div>
      <div className="hidden flex-col items-end justify-between sm:flex">
        <button
          type="button"
          onClick={() => onRemove(item)}
          disabled={busy}
          aria-label={`Remover ${item.title} do carrinho`}
          className="grid size-9 place-items-center rounded-full text-kurio-text-muted hover:bg-kurio-danger/10 hover:text-kurio-danger focus-visible:outline-2 focus-visible:outline-kurio-amber disabled:opacity-50"
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
        <p className="text-sm font-bold text-kurio-amber">
          {formatEthDisplay(item.lineTotalEth)}
        </p>
      </div>
    </article>
  )
}

function CartChangeBanner({
  cart,
  busy,
  onAcknowledge,
}: {
  cart: CartDto
  busy: boolean
  onAcknowledge: () => void
}) {
  const changedItems = cart.items.filter(
    (item) => item.priceChanged || item.insufficientStock,
  )

  if (!cart.hasStaleItems) return null
  return (
    <section
      role="alert"
      aria-labelledby="cart-changes-title"
      className="mb-5 rounded-xl border border-kurio-amber/60 bg-kurio-amber/10 p-4 sm:p-5"
    >
      <h2 id="cart-changes-title" className="text-sm font-bold text-kurio-amber">
        Alguns itens mudaram em tempo real
      </h2>
      <p className="mt-2 text-xs leading-5 text-kurio-text">
        O preço ou a disponibilidade de um ou mais itens mudou. Revise os valores
        antes de continuar.
      </p>
      <ul className="mt-3 space-y-2 text-[10px] text-kurio-text-muted">
        {changedItems.map((item) => (
          <li key={item.itemId} className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-kurio-text">{item.title}</span>
            {item.priceChanged && item.previousPriceEth && (
              <span>
                Preço anterior:{' '}
                <s>{formatEthDisplay(item.previousPriceEth)}</s>
                {' → '}
                <strong className="text-kurio-amber">
                  {formatEthDisplay(item.unitPriceEth)}
                </strong>
              </span>
            )}
            {item.insufficientStock && (
              <span className="text-kurio-danger">
                {item.availableEditions === 0
                  ? 'Sem estoque; será removido ao confirmar.'
                  : `Estoque atual: ${item.availableEditions}.`}
              </span>
            )}
          </li>
        ))}
      </ul>
      <Button
        onClick={onAcknowledge}
        disabled={busy}
        className="mt-4 font-bold"
      >
        Confirmar novos valores
      </Button>
    </section>
  )
}

export function CartPage() {
  const cartState = useCart()
  const navigate = useNavigate()
  const auth = useAuth()
  const [notice, setNotice] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  useDocumentTitle('Carrinho de NFTs — KURIO')
  const recommendationsQuery = useQuery({
    queryKey: ['nfts', 'cart-recommendations'],
    queryFn: ({ signal }) =>
      fetchCatalog({ page: 1, sort: 'recent', tab: 'all' }, signal),
  })
  const cart = cartState.cart
  const mutationError = cartState.mutationError
  const isCouponAction =
    cartState.mutationAction === 'apply-coupon' ||
    cartState.mutationAction === 'delete-coupon'
  // Cada erro aparece uma única vez, junto ao controle que o causou.
  const couponError =
    mutationError && isCouponAction ? getCartErrorMessage(mutationError) : ''
  const itemsError =
    mutationError && !isCouponAction ? getCartErrorMessage(mutationError) : ''
  const loadErrorMessage = cartState.loadError?.message ?? ''
  const hasUnavailableItems =
    cart?.items.some((item) => item.insufficientStock) ?? false

  if (cartState.isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-12">
        <CartSkeleton />
      </main>
    )
  }

  if (!cart) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h1 className="text-2xl font-bold text-kurio-text">
          Não foi possível carregar o carrinho.
        </h1>
        <p role="alert" className="mt-3 text-sm text-kurio-danger">
          {loadErrorMessage || 'Tente novamente em instantes.'}
        </p>
        <Button
          size="lg"
          onClick={() => void cartState.refetch()}
          className="mt-6"
        >
          Tentar novamente
        </Button>
      </main>
    )
  }

  const itemsInCart = new Set(cart.items.map((item) => item.nftId))
  const recommendations =
    recommendationsQuery.data?.items
      .filter((nft) => !itemsInCart.has(nft.id))
      .slice(0, 5) ?? []

  // Move o foco antes de o botão sumir do DOM; sem isso o foco do teclado seria perdido.
  const removeItem = (item: CartItemDto) => {
    headingRef.current?.focus()
    setAnnouncement(`${item.title} removido do carrinho.`)
    cartState.removeItem(item.itemId)
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-12">
      <nav aria-label="Breadcrumb" className="mb-7 hidden text-[10px] text-kurio-text-muted sm:block">
        <Link to="/" search={{ tab: 'all', sort: 'recent', page: 1 }} className="hover:text-kurio-amber">
          Início
        </Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <Link to="/" search={{ tab: 'all', sort: 'recent', page: 1 }} hash="catalogo" className="hover:text-kurio-amber">
          Mercado
        </Link>
        <span className="mx-2" aria-hidden="true">/</span>
        <span aria-current="page" className="text-kurio-text">Carrinho</span>
      </nav>
      <div className="mb-6 flex items-center gap-3 sm:mb-8">
        <Link
          to="/"
          search={{ tab: 'all', sort: 'recent', page: 1 }}
          aria-label="Voltar ao catálogo"
          className="grid size-10 place-items-center rounded-full border border-kurio-border text-kurio-text hover:border-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber sm:hidden"
        >
          <ArrowLeft size={17} aria-hidden="true" />
        </Link>
        <div>
          <p className="hidden text-[10px] uppercase tracking-[0.2em] text-kurio-amber sm:block">
            Sua seleção
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-bold text-kurio-text focus:outline-none sm:mt-2 sm:text-2xl"
          >
            Carrinho de NFTs
          </h1>
        </div>
        <span className="ml-auto text-[10px] text-kurio-text-muted">
          {formatEditions(cart.items.reduce((sum, item) => sum + item.quantity, 0))}
        </span>
      </div>
      <p aria-live="polite" className="sr-only">{announcement}</p>

      <CartChangeBanner
        cart={cart}
        busy={cartState.isMutating}
        onAcknowledge={() => {
          setNotice('')
          void cartState
            .acknowledgeChangesAsync()
            .then((acknowledgedCart) => {
              const removed = acknowledgedCart.acknowledgedUnavailableItems
              setNotice(
                removed && removed.length > 0
                  ? `Itens sem estoque removidos: ${removed.join(', ')}.`
                  : 'Novos valores confirmados.',
              )
            })
            .catch(() => undefined)
        }}
      />

      {notice && (
        <p role="status" className="mb-5 rounded-lg border border-kurio-success/40 bg-kurio-surface p-3 text-xs text-kurio-success">
          {notice}
        </p>
      )}

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_350px]">
        <section aria-label="Itens no carrinho" className="min-w-0">
          {itemsError && (
            <p role="alert" className="mb-4 rounded-lg border border-kurio-danger/40 bg-kurio-surface p-3 text-xs text-kurio-danger">
              {itemsError}
            </p>
          )}
          {cart.items.length > 0 ? (
            <div className="space-y-3">
              {cart.items.map((item) => (
                <CartItemRow
                  key={item.itemId}
                  item={item}
                  busy={cartState.isMutating}
                  onUpdate={cartState.updateItem}
                  onRemove={removeItem}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-kurio-border bg-kurio-surface px-5 py-12 text-center">
              <h2 className="text-base font-bold text-kurio-text">
                Seu carrinho está vazio
              </h2>
              <p className="mt-2 text-xs text-kurio-text-muted">
                Explore o catálogo e encontre sua próxima peça.
              </p>
              <Link
                to="/"
                search={{ tab: 'all', sort: 'recent', page: 1 }}
                className={buttonVariants({ size: 'lg', className: 'mt-5' })}
              >
                Explorar catálogo
              </Link>
            </div>
          )}
        </section>

        <CartSummaryCard
          cart={cart}
          disabled={cart.hasStaleItems || hasUnavailableItems}
          busy={cartState.isMutating}
          couponError={couponError}
          onApplyCoupon={(code) => {
            setNotice('')
            cartState.applyCoupon(code)
          }}
          onRemoveCoupon={() => {
            setNotice('')
            cartState.removeCoupon()
          }}
          onFinalize={() => {
            if (auth.session) {
              void navigate({ to: '/checkout' })
            } else {
              void navigate({
                to: '/login',
                search: { redirect: '/checkout' },
              })
            }
          }}
        />
      </div>

      <section className="mt-14 border-t border-kurio-border pt-9 sm:mt-20" aria-labelledby="cart-recommendations-title">
        <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">
          Continue descobrindo
        </p>
        <h2 id="cart-recommendations-title" className="mt-2 text-xl font-bold text-kurio-text">
          Colecionadores também viram
        </h2>
        {recommendationsQuery.isError ? (
          <p role="alert" className="mt-4 text-xs text-kurio-danger">
            Não foi possível carregar recomendações.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-5">
            {recommendations.map((nft) => (
              <NftCard key={nft.id} nft={nft} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
