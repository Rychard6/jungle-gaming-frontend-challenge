import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import type { CartDto } from '../../../shared/api/types'

interface CartSummaryCardProps {
  cart: CartDto
  disabled: boolean
  busy: boolean
  error: string
  onApplyCoupon: (code: string) => void
  onRemoveCoupon: () => void
  onFinalize: () => void
}

export function CartSummaryCard({
  cart,
  disabled,
  busy,
  error,
  onApplyCoupon,
  onRemoveCoupon,
  onFinalize,
}: CartSummaryCardProps) {
  const [couponDraft, setCouponDraft] = useState('')

  const submitCoupon = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onApplyCoupon(couponDraft)
  }

  return (
    <aside className="rounded-xl border border-kurio-border bg-kurio-surface p-5 sm:p-6">
      <h2 className="text-base font-bold text-kurio-text">Resumo da carteira</h2>
      <form onSubmit={submitCoupon} className="mt-5">
        <label
          htmlFor="cart-coupon"
          className="text-[10px] font-semibold uppercase tracking-wider text-kurio-text-muted"
        >
          Código promocional
        </label>
        {cart.couponCode ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-kurio-success/40 bg-kurio-success/5 px-3 py-2.5">
            <span className="min-w-0 text-xs font-semibold text-kurio-success">
              {cart.couponCode}
            </span>
            <button
              type="button"
              onClick={onRemoveCoupon}
              disabled={busy}
              className="shrink-0 text-[10px] text-kurio-text-muted underline decoration-kurio-border underline-offset-4 hover:text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber disabled:opacity-50"
            >
              Remover cupom
            </button>
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <input
              id="cart-coupon"
              value={couponDraft}
              onChange={(event) => setCouponDraft(event.target.value)}
              placeholder="Digite o código promocional..."
              autoComplete="off"
              className="h-10 min-w-0 flex-1 rounded-md border border-kurio-border bg-kurio-bg px-3 text-[10px] text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
            />
            <button
              type="submit"
              disabled={busy || couponDraft.trim().length === 0}
              className="rounded-md border border-kurio-amber px-3 text-[10px] font-bold text-kurio-amber hover:bg-kurio-amber/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:opacity-50"
            >
              Aplicar
            </button>
          </div>
        )}
      </form>

      {error && (
        <p role="alert" className="mt-3 text-[10px] leading-5 text-kurio-danger">
          {error}
        </p>
      )}

      <dl className="mt-6 space-y-3 border-t border-kurio-border pt-5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-kurio-text-muted">Subtotal</dt>
          <dd className="font-semibold text-kurio-text">
            {formatEthDisplay(cart.subtotalEth)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="min-w-0 text-kurio-text-muted">
            {cart.couponCode ? cart.discountLabel : 'Desconto do lançamento'}
          </dt>
          <dd className="shrink-0 font-semibold text-kurio-success">
            (-) {formatEthDisplay(cart.discountEth)}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-kurio-text-muted">
            Taxa de rede
            <span className="mt-1 block text-[9px]">Taxa estimada</span>
          </dt>
          <dd className="font-semibold text-kurio-text">
            {formatEthDisplay(cart.networkFeeEth)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-kurio-border pt-4">
          <dt className="font-bold text-kurio-text">Total</dt>
          <dd className="text-lg font-bold text-kurio-amber">
            {formatEthDisplay(cart.totalEth)}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onFinalize}
        disabled={disabled || busy || cart.items.length === 0}
        className="mt-6 min-h-12 w-full rounded-md bg-kurio-amber px-4 py-3 text-xs font-bold text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Atualizando carrinho…' : 'Conectar e finalizar'}
      </button>
      <p className="mt-3 text-center text-[9px] leading-4 text-kurio-text-muted">
        A conexão da carteira e o checkout serão concluídos na próxima etapa.
      </p>
      <Link
        to="/"
        search={{ tab: 'all', sort: 'recent', page: 1 }}
        className="mt-4 block text-center text-[10px] font-semibold text-kurio-text-muted underline decoration-kurio-border underline-offset-4 hover:text-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
      >
        Continuar explorando
      </Link>
    </aside>
  )
}
