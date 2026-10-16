import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal, X } from 'lucide-react'
import type {
  BlockchainNetwork,
  NftCollectionCategory,
} from '../../../shared/api/types'
import { catalogCategories, catalogNetworks } from '../api/catalog-api'

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

function FilterFields({
  values,
  categoryCounts,
  networkCounts,
  onChange,
  onApplyPriceRange,
  priceDraft,
  onPriceDraftChange,
  idPrefix,
}: Omit<CatalogFiltersProps, 'variant'> & {
  priceDraft: Pick<CatalogFilterValues, 'minPrice' | 'maxPrice'>
  onPriceDraftChange: (range: Pick<CatalogFilterValues, 'minPrice' | 'maxPrice'>) => void
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
            className="min-w-0 rounded-md border border-kurio-border bg-kurio-bg px-2 py-2 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
          />
          <label className="sr-only" htmlFor={`${idPrefix}-max-price`}>Máximo ETH</label>
          <input
            id={`${idPrefix}-max-price`}
            inputMode="decimal"
            placeholder="Máximo"
            value={priceDraft.maxPrice}
            onChange={(event) => onPriceDraftChange({ ...priceDraft, maxPrice: event.target.value })}
            className="min-w-0 rounded-md border border-kurio-border bg-kurio-bg px-2 py-2 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
          />
        </div>
        <button
          type="button"
          onClick={() => onApplyPriceRange(priceDraft)}
          className="mt-2 w-full rounded-md border border-kurio-amber px-3 py-2 text-xs font-semibold text-kurio-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
        >
          Aplicar
        </button>
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

      <aside className="rounded-lg border border-kurio-amber/40 bg-kurio-surface-elevated p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-kurio-amber">
          NFT em destaque
        </p>
        <p className="mt-2 text-sm font-semibold text-kurio-text">Oferta limitada</p>
        <p className="mt-1 text-xs leading-5 text-kurio-text-muted">
          Obras especiais, selecionadas para quem coleciona com intenção.
        </p>
      </aside>
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
  const [priceDraft, setPriceDraft] = useState({
    minPrice: values.minPrice,
    maxPrice: values.maxPrice,
  })
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const applyPriceRange = (
    range: Pick<CatalogFilterValues, 'minPrice' | 'maxPrice'>,
  ) => {
    onApplyPriceRange(range)
    if (variant !== 'desktop') {
      setOpen(false)
      window.requestAnimationFrame(() => {
        document.getElementById(`${idPrefix}-filter-trigger`)?.focus()
      })
    }
  }
  const filterFieldsProps = {
    ...props,
    values,
    onChange: (nextValues: CatalogFilterValues) =>
      onChange({ ...nextValues, ...priceDraft }),
    onApplyPriceRange: applyPriceRange,
    priceDraft,
    onPriceDraftChange: setPriceDraft,
  }

  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (event.key === 'Tab') {
        const focusableElements =
          dialogRef.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
          )
        if (!focusableElements?.length) return
        const first = focusableElements[0]
        const last = focusableElements[focusableElements.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <>
      {variant !== 'mobile' && (
        <aside className="hidden lg:block">
          <div className="rounded-xl border border-kurio-border bg-kurio-surface p-5">
            <FilterFields {...filterFieldsProps} idPrefix={idPrefix} />
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

      {variant !== 'desktop' && open && (
        <div
          className="fixed inset-0 z-[60] flex items-end bg-black/70 sm:items-center sm:justify-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setOpen(false)
              triggerRef.current?.focus()
            }
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filter-heading"
            className="max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-kurio-border bg-kurio-bg p-5 sm:max-w-md sm:rounded-2xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="mobile-filter-heading" className="font-semibold text-kurio-text">
                Filtrar NFTs
              </h2>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => {
                  setOpen(false)
                  triggerRef.current?.focus()
                }}
                aria-label="Fechar filtros"
                className="grid size-9 place-items-center rounded-full border border-kurio-border text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <FilterFields {...filterFieldsProps} idPrefix={idPrefix} />
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
              }}
              className="mt-6 w-full rounded-md bg-kurio-amber px-4 py-3 text-sm font-bold text-kurio-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
            >
              Ver resultados
            </button>
          </section>
        </div>
      )}
    </>
  )
}
