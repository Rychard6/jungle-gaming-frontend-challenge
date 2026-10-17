import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { SlidersHorizontal, X } from 'lucide-react'
import type {
  BlockchainNetwork,
  NftCollectionCategory,
} from '../../../shared/api/types'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import {
  validatePriceRange,
  type FieldErrors,
} from '../../../shared/lib/validation'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import {
  catalogCategories,
  catalogNetworks,
  featuredNftsQueryKey,
  fetchFeaturedNfts,
} from '../api/catalog-api'

export interface CatalogFilterValues {
  categories: string[]
  networks: string[]
  minPrice: string
  maxPrice: string
}

interface CatalogFiltersProps {
  values: CatalogFilterValues
  categoryCounts: Record<NftCollectionCategory, number>
  networkCounts: Record<BlockchainNetwork, number>
  onChange: (values: CatalogFilterValues) => void
  onApplyPriceRange: (range: Pick<CatalogFilterValues, 'minPrice' | 'maxPrice'>) => void
  variant?: 'all' | 'desktop' | 'mobile'
  idPrefix?: string
}

type PriceDraft = Pick<CatalogFilterValues, 'minPrice' | 'maxPrice'>

function describePriceRange({ minPrice, maxPrice }: PriceDraft): string {
  if (!minPrice && !maxPrice) return 'Preço: qualquer valor'
  return `Preço: ${minPrice || '0'} - ${maxPrice || 'sem limite'} ETH`
}

/** "NFT em destaque" da barra lateral: peça vinda da API (mesmo cache do destaque principal). */
function FeaturedPromo() {
  const featuredQuery = useQuery({
    queryKey: featuredNftsQueryKey,
    queryFn: ({ signal }) => fetchFeaturedNfts(signal),
  })
  const nft = featuredQuery.data?.items[1] ?? featuredQuery.data?.items[0]

  return (
    <section
      aria-label="NFT em destaque"
      className="rounded-lg border border-kurio-amber/40 bg-kurio-surface-elevated p-3"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-kurio-amber">
        NFT em destaque
      </p>
      {nft ? (
        <Link
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          className="group mt-2 block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
        >
          <img
            src={nft.imageUrl}
            alt={nft.description}
            width={200}
            height={200}
            loading="lazy"
            className="aspect-square w-full rounded-md object-cover"
          />
          <span className="mt-2 block text-xs font-semibold text-kurio-text group-hover:text-kurio-amber">
            {nft.title}
          </span>
          <span className="block text-[10px] text-kurio-amber">
            {formatEthDisplay(nft.priceEth)}
          </span>
        </Link>
      ) : null}
      <p className="mt-2 text-sm font-semibold text-kurio-text">Oferta limitada</p>
      <p className="mt-1 text-xs leading-5 text-kurio-text-muted">
        Obras especiais, selecionadas para quem coleciona com intenção.
      </p>
    </section>
  )
}

function FilterFields({
  values,
  categoryCounts,
  networkCounts,
  onChange,
  onApplyPriceRange,
  priceDraft,
  priceErrors,
  onPriceDraftChange,
  idPrefix,
  showPromo,
}: Omit<CatalogFiltersProps, 'variant'> & {
  priceDraft: PriceDraft
  priceErrors: FieldErrors
  onPriceDraftChange: (range: PriceDraft) => void
  showPromo: boolean
}) {
  const updateList = (
    key: 'categories' | 'networks',
    value: string,
    checked: boolean,
  ) => {
    const current = values[key]
    onChange({
      ...values,
      [key]: checked
        ? [...current, value]
        : current.filter((entry) => entry !== value),
    })
  }

  const priceInputClass =
    'min-w-0 rounded-md border border-kurio-border bg-kurio-bg px-2 py-2 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber aria-invalid:border-kurio-danger'
  const priceErrorId = `${idPrefix}-price-error`
  const priceError = priceErrors.minPrice ?? priceErrors.maxPrice

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-kurio-text">Coleções</legend>
        <div className="space-y-2.5">
          {catalogCategories.map((category) => (
            <label key={category} className="flex cursor-pointer items-center gap-2 text-xs text-kurio-text-muted">
              <input
                type="checkbox"
                checked={values.categories.includes(category)}
                onChange={(event) => updateList('categories', category, event.target.checked)}
                className="size-4 accent-kurio-amber"
              />
              <span className="min-w-0 flex-1">{category}</span>
              <span>{categoryCounts[category]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-kurio-text">Faixa de preço (ETH)</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="sr-only" htmlFor={`${idPrefix}-min-price`}>Mínimo ETH</label>
          <input
            id={`${idPrefix}-min-price`}
            inputMode="decimal"
            placeholder="Mínimo"
            value={priceDraft.minPrice}
            onChange={(event) => onPriceDraftChange({ ...priceDraft, minPrice: event.target.value })}
            aria-invalid={priceErrors.minPrice ? true : undefined}
            aria-describedby={priceError ? priceErrorId : undefined}
            className={priceInputClass}
          />
          <label className="sr-only" htmlFor={`${idPrefix}-max-price`}>Máximo ETH</label>
          <input
            id={`${idPrefix}-max-price`}
            inputMode="decimal"
            placeholder="Máximo"
            value={priceDraft.maxPrice}
            onChange={(event) => onPriceDraftChange({ ...priceDraft, maxPrice: event.target.value })}
            aria-invalid={priceErrors.maxPrice ? true : undefined}
            aria-describedby={priceError ? priceErrorId : undefined}
            className={priceInputClass}
          />
        </div>
        <p aria-live="polite" className="mt-2 text-[10px] text-kurio-text-muted">
          {describePriceRange(values)}
        </p>
        {priceError && (
          <p id={priceErrorId} className="mt-1 text-[10px] text-kurio-danger">
            {priceError}
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onApplyPriceRange(priceDraft)}
          className="mt-2 w-full font-semibold"
        >
          Aplicar
        </Button>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-kurio-text">Rede</legend>
        <div className="space-y-2.5">
          {catalogNetworks.map((network) => (
            <label key={network} className="flex cursor-pointer items-center gap-2 text-xs text-kurio-text-muted">
              <input
                type="checkbox"
                checked={values.networks.includes(network)}
                onChange={(event) => updateList('networks', network, event.target.checked)}
                className="size-4 accent-kurio-amber"
              />
              <span className="min-w-0 flex-1">{network}</span>
              <span>{networkCounts[network]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {showPromo && <FeaturedPromo />}
    </div>
  )
}

export function CatalogFilters({
  variant = 'all',
  idPrefix = 'catalog',
  values,
  onChange,
  onApplyPriceRange,
  ...props
}: CatalogFiltersProps) {
  const [open, setOpen] = useState(false)
  const [priceDraft, setPriceDraft] = useState<PriceDraft>({
    minPrice: values.minPrice,
    maxPrice: values.maxPrice,
  })
  const [priceErrors, setPriceErrors] = useState<FieldErrors>({})
  const [appliedPrice, setAppliedPrice] = useState<PriceDraft>({
    minPrice: values.minPrice,
    maxPrice: values.maxPrice,
  })
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  if (appliedPrice.minPrice !== values.minPrice || appliedPrice.maxPrice !== values.maxPrice) {
    const nextPrice = { minPrice: values.minPrice, maxPrice: values.maxPrice }
    setAppliedPrice(nextPrice)
    setPriceDraft(nextPrice)
    setPriceErrors({})
  }

  const applyPriceRange = (range: PriceDraft) => {
    const errors = validatePriceRange(range.minPrice, range.maxPrice)
    setPriceErrors(errors)
    if (Object.keys(errors).length > 0) return
    onApplyPriceRange({
      minPrice: range.minPrice.trim(),
      maxPrice: range.maxPrice.trim(),
    })
    if (variant !== 'desktop') setOpen(false)
  }

  const fieldProps = {
    ...props,
    values,
    onChange,
    onApplyPriceRange: applyPriceRange,
    priceDraft,
    priceErrors,
    onPriceDraftChange: setPriceDraft,
    idPrefix,
  }

  return (
    <>
      {variant !== 'mobile' && (
        <aside aria-label="Filtros do catálogo" className="hidden lg:block">
          <div className="rounded-xl border border-kurio-border bg-kurio-surface p-5">
            <FilterFields {...fieldProps} showPromo />
          </div>
        </aside>
      )}

      {variant !== 'desktop' && (
        <div className="flex gap-2 lg:hidden">
          <button
            ref={triggerRef}
            type="button"
            id={`${idPrefix}-filter-trigger`}
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-label="Abrir filtros"
            className="grid size-11 shrink-0 place-items-center rounded-md bg-kurio-amber text-kurio-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
          >
            <SlidersHorizontal size={19} aria-hidden="true" />
            <span className="sr-only">Abrir filtros</span>
          </button>
        </div>
      )}

      <Dialog
        open={variant !== 'desktop' && open}
        onClose={() => setOpen(false)}
        labelledBy="mobile-filter-heading"
        initialFocusRef={closeButtonRef}
        restoreFocusRef={triggerRef}
        overlayClassName="flex items-end sm:items-center sm:justify-center"
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-kurio-border bg-kurio-bg p-5 sm:max-w-md sm:rounded-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id="mobile-filter-heading" className="font-semibold text-kurio-text">
            Filtrar NFTs
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar filtros"
            className="grid size-9 place-items-center rounded-full border border-kurio-border text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <FilterFields {...fieldProps} showPromo={false} />
        <Button
          size="lg"
          onClick={() => setOpen(false)}
          className="mt-6 w-full"
        >
          Ver resultados
        </Button>
      </Dialog>
    </>
  )
}
