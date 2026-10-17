import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Eye, Heart, ShoppingBag } from 'lucide-react'
import type { NftItem } from '../../../shared/api/types'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import { Badge } from '../../../shared/ui/badge'
import { useFavorites } from '../../favorites/hooks/use-favorites'
import { useCart } from '../../cart/hooks/use-cart'

const actionClass =
  'relative z-10 grid size-10 place-items-center rounded-full shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber'

export function NftCard({ nft }: { nft: NftItem }) {
  const favorites = useFavorites(nft.id)
  const cart = useCart()
  const [message, setMessage] = useState('')
  const soldOut = nft.availableEditions < 1

  const addToCart = async () => {
    try {
      await cart.addItemAsync({
        nftId: nft.id,
        quantity: 1,
        editionType: nft.editionType,
      })
      setMessage(`${nft.title} adicionado ao carrinho.`)
    } catch {
      setMessage('')
    }
  }

  return (
    <article className="group relative min-w-0 overflow-hidden rounded-xl border border-kurio-border bg-kurio-surface">
      <div className="relative overflow-hidden">
        <img
          src={nft.imageUrl}
          alt={nft.description}
          width={400}
          height={400}
          loading="lazy"
          className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {nft.isRare && <Badge>RARO</Badge>}
          {soldOut && <Badge variant="destructive" className="bg-kurio-bg/90">ESGOTADO</Badge>}
        </div>
        <div className="absolute inset-x-3 bottom-3 z-10 flex translate-y-0 justify-center gap-2 opacity-100 transition-all group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 motion-reduce:transition-none sm:translate-y-2 sm:opacity-0">
          <button
            type="button"
            onClick={() => void addToCart()}
            disabled={cart.isMutating || soldOut}
            aria-label={
              soldOut
                ? `${nft.title} esgotado`
                : `Adicionar ${nft.title} ao carrinho`
            }
            className={`${actionClass} bg-kurio-amber text-kurio-bg disabled:opacity-50`}
          >
            <ShoppingBag size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={favorites.toggleFavorite}
            disabled={favorites.isPending}
            aria-label={favorites.favorite ? `Remover ${nft.title} dos favoritos` : `Favoritar ${nft.title}`}
            aria-pressed={favorites.favorite}
            className={`${actionClass} bg-kurio-bg/90 text-kurio-text disabled:opacity-60`}
          >
            <Heart size={17} fill={favorites.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            aria-label={`Ver detalhes de ${nft.title}`}
            className={`${actionClass} bg-kurio-bg/90 text-kurio-text`}
          >
            <Eye size={17} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.12em] text-kurio-text-muted">
              {nft.collectionName}
            </p>
            <h3 className="mt-1 min-h-10 break-words text-xs font-semibold text-kurio-text sm:text-sm">
              {/* Link "esticado": toda a área do cartão abre o detalhe; os botões ficam acima (z-10). */}
              <Link
                to="/nfts/$nftId"
                params={{ nftId: nft.id }}
                className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-kurio-amber"
              >
                {nft.title}
              </Link>
            </h3>
          </div>
          <span className="shrink-0 rounded border border-kurio-border px-2 py-1 text-[10px] text-kurio-text-muted">
            {nft.editionType}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase text-kurio-text-muted">Preço</p>
            <p className="mt-1 font-bold text-kurio-amber">
              {formatEthDisplay(nft.priceEth)}
            </p>
            {nft.originalPriceEth && (
              <p className="text-xs text-kurio-text-muted line-through">
                {formatEthDisplay(nft.originalPriceEth)}
              </p>
            )}
          </div>
          <span className="text-[10px] text-kurio-text-muted">{nft.network}</span>
        </div>
        {cart.mutationError ? (
          <p role="alert" className="mt-2 text-[10px] text-kurio-danger">
            {cart.mutationError.message}
          </p>
        ) : favorites.mutationError ? (
          <p role="alert" className="mt-2 text-[10px] text-kurio-danger">
            Falha ao atualizar favoritos. A alteração foi revertida.
          </p>
        ) : favorites.loadError ? (
          <p role="alert" className="mt-2 text-[10px] text-kurio-danger">
            Não foi possível carregar a lista de favoritos.
          </p>
        ) : null}
        <p aria-live="polite" className="sr-only">{message}</p>
      </div>
    </article>
  )
}
