import { useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import type { CartDto } from '../../../shared/api/types'
import { Button } from '../../../shared/ui/button'
import { buttonVariants } from '../../../shared/ui/button-variants'

interface CartSummaryCardProps {
  cart: CartDto
  disabled: boolean
  busy: boolean
  /** Erro da última operação de cupom; é associado ao campo via `aria-describedby`. */
  couponError: string
  onApplyCoupon: (code: string) => void
  onRemoveCoupon: () => void
  onFinalize: () => void
}

// Estado próprio: ao aplicar/remover o cupom o formulário é remontado e o rascunho é descartado.
function CouponForm({
  busy,
  couponError,
  onApplyCoupon,
}: {
  busy: boolean
  couponError: string
  onApplyCoupon: (code: string) => void
}) {
  const [draft, setDraft] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onApplyCoupon(draft)
  }

  return (
    <form onSubmit={submit} className="mt-5">
      <label
        htmlFor="cart-coupon"
        className="text-[10px] font-semibold uppercase tracking-wider text-kurio-text-muted"
      >
        Código promocional
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="cart-coupon"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          aria-invalid={couponError ? true : undefined}
          aria-describedby={couponError ? 'cart-coupon-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-md border border-kurio-border bg-kurio-bg px-3 text-[10px] text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber aria-invalid:border-kurio-danger"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={busy || draft.trim().length === 0}
          className="h-10 font-bold"
        >
          Aplicar
        </Button>
      </div>
      {couponError && (
        <p id="cart-coupon-error" role="alert" className="mt-3 text-[10px] leading-5 text-kurio-danger">
          {couponError}
        </p>
      )}
    </form>
  )
}

export function CartSummaryCard({
  cart,
  disabled,
  busy,
  couponError,
  onApplyCoupon,
  onRemoveCoupon,
  onFinalize,
}: CartSummaryCardProps) {
  return (
    <aside aria-label="Resumo da carteira" className="rounded-xl border border-kurio-border bg-kurio-surface p-5 sm:p-6">
      <h2 className="text-base font-bold text-kurio-text">Resumo da carteira</h2>
      {cart.couponCode ? (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-kurio-text-muted">
            Código promocional
          </p>
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
          {couponError && (
            <p role="alert" className="mt-3 text-[10px] leading-5 text-kurio-danger">
              {couponError}
            </p>
          )}
        </div>
      ) : (
        <CouponForm busy={busy} couponError={couponError} onApplyCoupon={onApplyCoupon} />
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
            <span className="mt-1 block text-[9px] text-kurio-amber">Taxa estimada</span>
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

      <Button
        size="lg"
        onClick={onFinalize}
        disabled={disabled || busy || cart.items.length === 0}
        className="mt-6 w-full"
      >
        {busy ? 'Atualizando carrinho…' : 'Conectar e finalizar'}
      </Button>
      <p className="mt-3 text-center text-[9px] leading-4 text-kurio-text-muted">
        Você revisa carteira, rede e valores antes de confirmar o pedido.
      </p>
      <Link
        to="/"
        search={{ tab: 'all', sort: 'recent', page: 1 }}
        className={buttonVariants({
          variant: 'ghost',
          size: 'sm',
          className: 'mt-4 flex w-full text-kurio-amber',
        })}
      >
        Continuar explorando
      </Link>
    </aside>
  )
}
