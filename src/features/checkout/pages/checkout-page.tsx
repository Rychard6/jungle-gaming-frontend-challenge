import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Check, ChevronDown, CreditCard, LoaderCircle, WalletCards } from 'lucide-react'
import { ApiClientError, getSessionCacheKey } from '../../../shared/api/http'
import type {
  CollectorCheckoutData,
  CreateOrderRequestDto,
  WalletDto,
  WalletProviderType,
} from '../../../shared/api/types'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import { useAuth } from '../../auth/hooks/auth-context'
import { applyCartCoupon, acknowledgeCartChanges } from '../../cart/api/cart-api'
import { fetchWallets } from '../../wallets/api/wallets-api'
import { fetchCheckoutQuote, createOrder } from '../api/checkout-api'
import { subscribeNftUpdates } from '../../../shared/socket/socket-client'
import { fetchOrders } from '../../orders/api/orders-api'

type WalletConnectionState = 'connected' | 'declined' | 'disconnected'

function displayWalletAddress(wallet: WalletDto | undefined): string {
  if (!wallet) return 'Nenhuma carteira selecionada'
  return `${wallet.displayName} · ${wallet.address}`
}

function getField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

async function hashOrderInput(input: CreateOrderRequestDto): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(input)),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function getPersistedIdempotencyKey(
  storageKey: string,
  signature: string,
): string {
  const saved = localStorage.getItem(storageKey)
  if (saved) {
    const record: unknown = JSON.parse(saved)
    if (
      typeof record === 'object' &&
      record !== null &&
      'key' in record &&
      'signature' in record &&
      typeof record.key === 'string' &&
      typeof record.signature === 'string' &&
      record.signature === signature
    ) {
      return record.key
    }
  }
  const key = crypto.randomUUID()
  localStorage.setItem(storageKey, JSON.stringify({ key, signature }))
  return key
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:px-8">
      <div className="skeleton-shimmer h-[620px] rounded-xl" />
      <div className="skeleton-shimmer h-[520px] rounded-xl" />
    </div>
  )
}

export function CheckoutPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sessionKey = getSessionCacheKey() ?? 'anonymous'
  const quoteKey = ['checkout', 'quote', sessionKey] as const
  const walletsKey = ['wallets', sessionKey] as const
  const quoteQuery = useQuery({
    queryKey: quoteKey,
    queryFn: ({ signal }) => fetchCheckoutQuote(signal),
    enabled: Boolean(auth.session),
    retry: false,
  })
  const walletsQuery = useQuery({
    queryKey: walletsKey,
    queryFn: ({ signal }) => fetchWallets(signal),
    enabled: Boolean(auth.session),
  })
  const ordersQuery = useQuery({
    queryKey: ['orders', sessionKey],
    queryFn: ({ signal }) => fetchOrders(signal),
    enabled: Boolean(auth.session),
    retry: false,
  })
  const [selectedWalletId, setSelectedWalletId] = useState('')
  const [walletProvider, setWalletProvider] =
    useState<WalletProviderType>('WalletConnect')
  const [connectionState, setConnectionState] =
    useState<WalletConnectionState>('connected')
  const [useAnotherWallet, setUseAnotherWallet] = useState(false)
  const [showCoupon, setShowCoupon] = useState(false)
  const [couponDraft, setCouponDraft] = useState('')
  const [couponError, setCouponError] = useState('')
  const [actionError, setActionError] = useState('')
  const [updateNotice, setUpdateNotice] = useState('')
  const [needsReview, setNeedsReview] = useState(false)
  const [isReviewing, setIsReviewing] = useState(false)
  const [orderError, setOrderError] = useState('')
  const [orderTimeout, setOrderTimeout] = useState(false)
  const idempotencyRef = useRef<{ key: string; signature: string } | null>(null)
  const emptyCartError =
    quoteQuery.error instanceof ApiClientError &&
    quoteQuery.error.code === 'EMPTY_CART'

  useEffect(() => {
    const latestOrder = ordersQuery.data?.orders[0]
    if (
      emptyCartError &&
      latestOrder &&
      latestOrder.status !== 'declined'
    ) {
      void navigate({
        to: '/orders/$orderId',
        params: { orderId: latestOrder.id },
      })
    }
  }, [emptyCartError, navigate, ordersQuery.data])

  useEffect(
    () =>
      subscribeNftUpdates((event) => {
        setNeedsReview(true)
        setUpdateNotice(
          `O preço ou a disponibilidade de ${event.payload.nftId} mudou. Revise os valores antes de continuar.`,
        )
      }),
    [],
  )

  const wallets = walletsQuery.data?.wallets ?? auth.wallets
  const primaryWallet = wallets.find((wallet) => wallet.isPrimary)
  const selectedWallet =
    wallets.find((wallet) => wallet.id === selectedWalletId) ?? primaryWallet
  const quote = quoteQuery.data
  const effectiveReviewRequired = needsReview || Boolean(quote?.hasStaleItems)
  const orderMutation = useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateOrderRequestDto
      idempotencyKey: string
    }) => createOrder(input, idempotencyKey),
    onSuccess: async (order) => {
      setOrderError('')
      setOrderTimeout(false)
      idempotencyRef.current = null
      localStorage.removeItem(`kurio_order_idempotency_${sessionKey}`)
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      await navigate({
        to: '/orders/$orderId',
        params: { orderId: order.id },
      })
    },
    onError: (error: unknown) => {
      setOrderError(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a compra.',
      )
      setOrderTimeout(
        error instanceof ApiClientError &&
          (error.status === 504 || error.code === 'ORDER_TIMEOUT'),
      )
      if (error instanceof ApiClientError && error.code === 'STALE_QUOTE') {
        setNeedsReview(true)
      }
    },
  })

  if (quoteQuery.isLoading || walletsQuery.isLoading) return <CheckoutSkeleton />
  if (
    emptyCartError &&
    ordersQuery.isLoading
  ) {
    return (
      <main aria-busy="true" className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="skeleton-shimmer mx-auto h-32 max-w-lg rounded-xl" />
        <p className="mt-4 text-xs text-kurio-text-muted">
          Verificando pedidos recentes para recuperar sua compra…
        </p>
      </main>
    )
  }
  if (quoteQuery.isError || !quote) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Não foi possível abrir o checkout</h1>
        <p role="alert" className="mt-3 text-sm text-kurio-danger">
          {quoteQuery.error instanceof Error
            ? quoteQuery.error.message
            : 'A cotação não está disponível.'}
        </p>
        <Link
          to="/cart"
          className="mt-6 inline-flex rounded-lg border border-kurio-amber px-4 py-3 text-xs font-bold text-kurio-amber"
        >
          Voltar ao carrinho
        </Link>
      </main>
    )
  }

  const refreshQuote = async () => {
    setActionError('')
    setIsReviewing(true)
    try {
      await acknowledgeCartChanges()
      await queryClient.invalidateQueries({ queryKey: quoteKey })
      const result = await queryClient.fetchQuery({
        queryKey: quoteKey,
        queryFn: () => fetchCheckoutQuote(),
      })
      setNeedsReview(result.hasStaleItems)
      setUpdateNotice('')
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar a cotação.',
      )
    } finally {
      setIsReviewing(false)
    }
  }

  const applyCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCouponError('')
    try {
      await applyCartCoupon({ code: couponDraft })
      await queryClient.invalidateQueries({ queryKey: quoteKey })
      await queryClient.fetchQuery({
        queryKey: quoteKey,
        queryFn: () => fetchCheckoutQuote(),
      })
      setCouponDraft('')
    } catch (error) {
      setCouponError(error instanceof Error ? error.message : 'Cupom inválido.')
    }
  }

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setOrderError('')
    if (!selectedWallet) {
      setOrderError('Cadastre ou selecione uma carteira antes de continuar.')
      return
    }
    if (connectionState !== 'connected') {
      setOrderError(
        connectionState === 'declined'
          ? 'A conexão foi recusada pela carteira. Escolha outra opção e tente novamente.'
          : 'Conecte uma carteira antes de confirmar a compra.',
      )
      return
    }
    if (effectiveReviewRequired) {
      setOrderError('Revise a cotação atual antes de confirmar a compra.')
      return
    }

    const data = new FormData(event.currentTarget)
    const collector: CollectorCheckoutData = {
      displayName: getField(data, 'displayName'),
      username: getField(data, 'username'),
      network: selectedWallet.network,
      profileName: getField(data, 'profileName'),
      walletAddress: getField(data, 'walletAddress'),
      ...(getField(data, 'secondaryWalletOrEns')
        ? { secondaryWalletOrEns: getField(data, 'secondaryWalletOrEns') }
        : {}),
      walletType: walletProvider,
      ...(getField(data, 'referralCode')
        ? { referralCode: getField(data, 'referralCode') }
        : {}),
      email: getField(data, 'email'),
      ensName: getField(data, 'ensName'),
      ensDomain: getField(data, 'ensDomain'),
      useAnotherWallet,
      ...(getField(data, 'notes') ? { notes: getField(data, 'notes') } : {}),
    }
    const input: CreateOrderRequestDto = {
      quoteVersion: quote.quoteVersion,
      walletProvider,
      network: selectedWallet.network,
      collector,
    }
    const signature = await hashOrderInput(input)
    const storageKey = `kurio_order_idempotency_${sessionKey}`
    const key =
      idempotencyRef.current?.signature === signature
        ? idempotencyRef.current.key
        : getPersistedIdempotencyKey(storageKey, signature)
    idempotencyRef.current = { key, signature }
    await orderMutation.mutateAsync({
      input,
      idempotencyKey: key,
    }).catch(() => undefined)
  }

  const inputClass =
    'mt-1.5 h-10 w-full rounded-lg border border-kurio-border bg-kurio-bg px-3 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber'
  const labelClass = 'block text-[10px] font-semibold text-kurio-text'

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">
            Pagamento seguro
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Finalizar compra</h1>
        </div>
        <Link to="/cart" className="text-xs text-kurio-text-muted underline underline-offset-4">
          Voltar ao carrinho
        </Link>
      </div>

      {effectiveReviewRequired && (
        <section
          role="alert"
          className="mb-6 rounded-xl border border-kurio-amber/50 bg-kurio-amber/10 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={19} className="mt-0.5 shrink-0 text-kurio-amber" />
            <div>
              <h2 className="text-sm font-bold text-kurio-amber">
                Cotação desatualizada
              </h2>
              <p className="mt-1 text-xs leading-5 text-kurio-text">
                {updateNotice ||
                  'O preço ou a disponibilidade de um ou mais NFTs mudou. Confirme os novos valores antes de pagar.'}
              </p>
              <button
                type="button"
                onClick={() => void refreshQuote()}
                disabled={isReviewing}
                className="mt-3 rounded-lg bg-kurio-amber px-4 py-2.5 text-xs font-bold text-kurio-bg disabled:opacity-60"
              >
                {isReviewing ? 'Atualizando…' : 'Revisar e confirmar novos valores'}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          key={selectedWallet?.id ?? 'no-wallet'}
          onSubmit={(event) => void submitOrder(event)}
          className="space-y-5"
        >
          <section className="rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-6">
            <h2 className="text-base font-bold">Perfil do colecionador</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Nome de exibição *
                <input name="displayName" required defaultValue={auth.session?.user.displayName} className={inputClass} />
              </label>
              <label className={labelClass}>
                Nome de usuário *
                <input name="username" required defaultValue={auth.session?.user.username} className={inputClass} />
              </label>
              <label className={labelClass}>
                Rede *
                <input readOnly value={selectedWallet?.network ?? ''} className={`${inputClass} opacity-75`} />
              </label>
              <label className={labelClass}>
                Nome do perfil *
                <input name="profileName" required defaultValue={selectedWallet?.profileName} className={inputClass} />
              </label>
              <label className={labelClass}>
                Endereço da carteira *
                <input name="walletAddress" required defaultValue={selectedWallet?.address} className={inputClass} />
              </label>
              <label className={labelClass}>
                ENS ou carteira secundária (opcional)
                <input name="secondaryWalletOrEns" defaultValue={selectedWallet?.secondaryAddressOrEns} className={inputClass} />
              </label>
              <label className={labelClass}>
                Tipo de carteira *
                <input readOnly value={walletProvider} className={`${inputClass} opacity-75`} />
              </label>
              <label className={labelClass}>
                Código de indicação *
                <input name="referralCode" required defaultValue={selectedWallet?.referralCode} className={inputClass} />
              </label>
              <label className={labelClass}>
                E-mail *
                <input name="email" required type="email" defaultValue={auth.session?.user.email} className={inputClass} />
              </label>
              <fieldset>
                <legend className={labelClass}>Nome ENS *</legend>
                <div className="mt-1.5 flex gap-2">
                  <input name="ensName" required defaultValue={selectedWallet?.ensName ?? auth.session?.user.ensName} className={`${inputClass} mt-0 min-w-0 flex-1`} />
                  <select name="ensDomain" defaultValue={selectedWallet?.ensDomain ?? auth.session?.user.ensDomain} className="h-10 rounded-lg border border-kurio-border bg-kurio-bg px-2 text-[10px]">
                    <option value=".eth">.eth</option>
                    <option value=".kurio">.kurio</option>
                    <option value=".xyz">.xyz</option>
                  </select>
                </div>
              </fieldset>
              <fieldset className="sm:col-span-2">
                <legend className={labelClass}>Usar outra carteira?</legend>
                <div className="mt-2 flex gap-4 text-xs">
                  {[false, true].map((value) => (
                    <label key={String(value)} className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="useAnotherWallet"
                        checked={useAnotherWallet === value}
                        onChange={() => setUseAnotherWallet(value)}
                        className="accent-kurio-amber"
                      />
                      {value ? 'Sim' : 'Não'}
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className={`${labelClass} sm:col-span-2`}>
                Observação do colecionador (opcional)
                <textarea name="notes" rows={3} className={`${inputClass} h-auto py-3`} />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Carteira conectada</h2>
                <p className="mt-1 break-all text-[10px] text-kurio-text-muted">
                  {displayWalletAddress(selectedWallet)}
                </p>
              </div>
              {wallets.length > 1 && (
                <label className="shrink-0 text-[10px] text-kurio-amber">
                  <span className="sr-only">Trocar carteira</span>
                  <select
                    value={selectedWallet?.id ?? ''}
                    onChange={(event) => setSelectedWalletId(event.target.value)}
                    className="h-9 max-w-36 rounded-lg border border-kurio-amber bg-kurio-bg px-2 text-[10px] text-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
                  >
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        Trocar carteira · {wallet.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="mt-5">
              <h3 className="text-xs font-bold">Carteira e rede</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {([
                  ['WalletConnect', 'WALLETCONNECT', 'WALLETCONNECT • METAMASK • COINBASE'],
                  ['MetaMask', 'METAMASK', 'Ethereum'],
                  ['Coinbase Wallet', 'COINBASE', 'Ethereum'],
                ] as const).map(([provider, label, detail]) => (
                  <label
                    key={provider}
                    className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                      walletProvider === provider
                        ? 'border-kurio-amber bg-kurio-amber/10'
                        : 'border-kurio-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentWalletProvider"
                      value={provider}
                      checked={walletProvider === provider}
                      onChange={() => setWalletProvider(provider)}
                      className="accent-kurio-amber"
                    />
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold">{label}</span>
                      <span className="mt-1 block text-[8px] text-kurio-text-muted">{detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-kurio-border bg-kurio-bg p-3">
              <p className="inline-flex items-center gap-2 text-[10px]">
                {connectionState === 'connected' ? (
                  <Check size={14} className="text-kurio-success" aria-hidden="true" />
                ) : (
                  <AlertTriangle size={14} className="text-kurio-amber" aria-hidden="true" />
                )}
                {connectionState === 'connected'
                  ? 'Conectada'
                  : connectionState === 'declined'
                    ? 'Recusada pela carteira'
                    : 'Desconectada'}
              </p>
              <select
                aria-label="Simular estado da carteira"
                value={connectionState}
                onChange={(event) =>
                  setConnectionState(event.target.value as WalletConnectionState)
                }
                className="h-9 rounded border border-kurio-border bg-kurio-surface px-2 text-[10px]"
              >
                <option value="connected">Conectada</option>
                <option value="declined">Recusada pela carteira</option>
                <option value="disconnected">Desconectada</option>
              </select>
            </div>
          </section>

          {actionError && (
            <p role="alert" className="text-xs text-kurio-danger">{actionError}</p>
          )}
          {orderError && (
            <p role="alert" className="rounded-lg border border-kurio-danger/40 bg-kurio-danger/10 p-3 text-xs text-kurio-danger">
              {orderError}
            </p>
          )}
          <button
            type="submit"
            disabled={
              orderMutation.isPending ||
              effectiveReviewRequired ||
              !quote.items.length
            }
            className="min-h-12 w-full rounded-lg bg-kurio-amber px-5 py-3 text-sm font-bold text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:cursor-not-allowed disabled:opacity-50"
          >
            {orderMutation.isPending
              ? 'Confirmando…'
              : orderTimeout
                ? 'Tentar novamente com segurança'
                : 'Confirmar compra'}
          </button>
        </form>

        <aside className="rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-base font-bold">Seus NFTs</h2>
          <div className="mt-4 space-y-3">
            {quote.items.map((item) => (
              <article key={item.nftId} className="flex gap-3 border-b border-kurio-border pb-3">
                <img src={item.imageUrl} alt="" className="size-16 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold">{item.title}</p>
                  <p className="mt-1 text-[9px] text-kurio-text-muted">
                    ID do token: {item.tokenId} · (x {item.quantity})
                  </p>
                  <p className="mt-2 text-xs font-bold text-kurio-amber">
                    {formatEthDisplay(item.lineTotalEth)}
                  </p>
                  {item.priceChanged && (
                    <p className="mt-1 text-[9px] text-kurio-amber">
                      Preço alterado desde que foi adicionado ao carrinho.
                    </p>
                  )}
                  {item.insufficientStock && (
                    <p className="mt-1 text-[9px] text-kurio-danger">
                      Estoque atual: {item.availableEditions}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowCoupon((open) => !open)}
            aria-expanded={showCoupon}
            className="mt-4 flex w-full items-center justify-between text-left text-[10px] text-kurio-text-muted hover:text-kurio-text"
          >
            Tem um código promocional? Aplique aqui
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {showCoupon && (
            <form onSubmit={(event) => void applyCoupon(event)} className="mt-3 flex gap-2">
              <label htmlFor="checkout-coupon" className="sr-only">Código promocional</label>
              <input
                id="checkout-coupon"
                value={couponDraft}
                onChange={(event) => setCouponDraft(event.target.value)}
                placeholder={quote.couponCode ?? 'Código promocional'}
                className="h-10 min-w-0 flex-1 rounded-lg border border-kurio-border bg-kurio-bg px-3 text-[10px]"
              />
              <button
                type="submit"
                disabled={!couponDraft.trim()}
                className="rounded-lg border border-kurio-amber px-3 text-[10px] font-bold text-kurio-amber disabled:opacity-50"
              >
                Aplicar
              </button>
            </form>
          )}
          {couponError && <p role="alert" className="mt-2 text-[10px] text-kurio-danger">{couponError}</p>}
          {quote.couponCode && (
            <p className="mt-2 text-[10px] text-kurio-success">
              Cupom {quote.couponCode} aplicado.
            </p>
          )}
          <dl className="mt-5 space-y-3 border-t border-kurio-border pt-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-kurio-text-muted">Subtotal</dt>
              <dd>{formatEthDisplay(quote.subtotalEth)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-kurio-text-muted">Desconto do lançamento</dt>
              <dd className="text-kurio-success">− {formatEthDisplay(quote.discountEth)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-kurio-text-muted">
                Taxa de rede <span className="block text-[9px]">Taxa estimada</span>
              </dt>
              <dd>{formatEthDisplay(quote.networkFeeEth)}</dd>
            </div>
            <div className="flex justify-between border-t border-kurio-border pt-4 text-sm font-bold">
              <dt>Total</dt>
              <dd className="text-kurio-amber">{formatEthDisplay(quote.totalEth)}</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-2 text-[9px] text-kurio-text-muted">
            <CreditCard size={13} aria-hidden="true" />
            A cotação será validada novamente ao confirmar.
          </p>
          {wallets.length === 0 && (
            <Link to="/wallets" className="mt-4 inline-flex items-center gap-2 text-[10px] text-kurio-amber underline">
              <WalletCards size={13} aria-hidden="true" />
              Cadastrar carteira
            </Link>
          )}
          {orderMutation.isPending && (
            <p role="status" className="mt-3 flex items-center gap-2 text-[10px] text-kurio-text-muted">
              <LoaderCircle size={13} className="animate-spin" />
              Aguardando resposta da rede…
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}
