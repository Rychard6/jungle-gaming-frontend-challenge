import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Heart, ShoppingBag, Eye } from 'lucide-react'
import type { NftItem } from '../../../shared/api/types'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import { useFavorites } from '../../favorites/hooks/use-favorites'
import { useCart } from '../../cart/hooks/use-cart'

export function NftCard({ nft }: { nft: NftItem }) {
  const navigate = useNavigate()
  const favorites = useFavorites(nft.id)
  const cart = useCart()
  const [message, setMessage] = useState('')

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
    <article className="group min-w-0 overflow-hidden rounded-xl border border-kurio-border bg-kurio-surface">
      <div className="relative overflow-hidden">
        <img
          src={nft.imageUrl}
          alt={nft.description}
          loading="lazy"
          className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {nft.isRare && (
          <span className="absolute left-3 top-3 rounded-full bg-kurio-amber px-3 py-1 text-[10px] font-bold tracking-wider text-kurio-bg">
            RARO
          </span>
        )}
        <div className="absolute inset-x-3 bottom-3 flex translate-y-0 justify-center gap-2 opacity-100 transition-all group-hover:translate-y-0 group-hover:opacity-100 focus-within:translate-y-0 focus-within:opacity-100 sm:translate-y-2 sm:opacity-0">
          <button
            type="button"
            onClick={() => void addToCart()}
            disabled={cart.isMutating || nft.availableEditions < 1}
            aria-label={`Adicionar ${nft.title} ao carrinho`}
            className="grid size-10 place-items-center rounded-full bg-kurio-amber text-kurio-bg shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:opacity-50"
          >
            <ShoppingBag size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={favorites.toggleFavorite}
            disabled={favorites.isPending}
            aria-label={favorites.favorite ? `Remover ${nft.title} dos favoritos` : `Favoritar ${nft.title}`}
            aria-pressed={favorites.favorite}
            className="grid size-10 place-items-center rounded-full bg-kurio-bg/90 text-kurio-text shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:opacity-60"
          >
            <Heart size={17} fill={favorites.favorite ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/nfts/$nftId', params: { nftId: nft.id } })}
            aria-label={`Ver detalhes de ${nft.title}`}
            className="grid size-10 place-items-center rounded-full bg-kurio-bg/90 text-kurio-text shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
          >
            <Eye size={17} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] uppercase tracking-[0.12em] text-kurio-text-muted">
              {nft.collectionName}
            </p>
            <h3 className="mt-1 truncate text-sm font-semibold text-kurio-text">
              {nft.title}
            </h3>
          </div>
          <span className="shrink-0 rounded border border-kurio-border px-2 py-1 text-[10px] text-kurio-text-muted">
            {nft.editionType}
          </span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-2">
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
        ) : (
          <p aria-live="polite" className="sr-only">{message}</p>
        )}
      </div>
    </article>
  )
}
