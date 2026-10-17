import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { AlertTriangle, Check, ChevronDown, CreditCard, LoaderCircle, WalletCards } from 'lucide-react'
import { ApiClientError, getSessionCacheKey } from '../../../shared/api/http'
import { useSessionKey } from '../../../shared/api/use-session-key'
import {
  BLOCKCHAIN_NETWORKS,
  WALLET_PROVIDER_TYPES,
  type BlockchainNetwork,
  type CheckoutQuoteDto,
  type CollectorCheckoutData,
  type CreateOrderRequestDto,
  type WalletDto,
  type WalletProviderType,
} from '../../../shared/api/types'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import { useDocumentTitle } from '../../../shared/lib/use-document-title'
import {
  validateCollector,
  type FieldErrors,
} from '../../../shared/lib/validation'
import { Button } from '../../../shared/ui/button'
import { buttonVariants } from '../../../shared/ui/button-variants'
import { Skeleton } from '../../../shared/ui/skeleton'
import { useAuth } from '../../auth/hooks/auth-context'
import { applyCartCoupon, acknowledgeCartChanges } from '../../cart/api/cart-api'
import { fetchWallets } from '../../wallets/api/wallets-api'
import { fetchCheckoutQuote, createOrder } from '../api/checkout-api'
import {
  clearIdempotencyRecord,
  getIdempotencyStorageKey,
  getPendingIdempotencyKey,
  getPersistedIdempotencyKey,
  signOrderInput,
} from '../lib/idempotency'
import { subscribeNftUpdates } from '../../../shared/socket/socket-client'
import { fetchOrders } from '../../orders/api/orders-api'

type WalletConnectionState = 'connected' | 'declined' | 'disconnected'

// Falhas de compra que tornam a cotação em tela obsoleta e exigem uma nova confirmação do usuário.
const REVIEW_REQUIRED_CODES = new Set([
  'STALE_QUOTE',
  'EDITION_SOLD_OUT',
  'INSUFFICIENT_STOCK',
  'CART_NOT_PURCHASABLE',
])

const COLLECTOR_FIELDS = [
  'displayName',
  'username',
  'profileName',
  'walletAddress',
  'referralCode',
  'email',
  'ensName',
] as const

function displayWalletAddress(wallet: WalletDto | undefined): string {
  if (!wallet) return 'Nenhuma carteira selecionada'
  return `${wallet.displayName} · ${wallet.address}`
}

function getField(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '').trim()
}

function CheckoutSkeleton() {
  return (
    <main aria-busy="true" className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_25rem] lg:px-8">
      <span className="sr-only">Carregando checkout…</span>
      <Skeleton className="h-[620px] rounded-xl" />
      <Skeleton className="h-[520px] rounded-xl" />
    </main>
  )
}

const inputClass =
  'mt-1.5 h-10 w-full rounded-lg border border-kurio-border bg-kurio-bg px-3 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber aria-invalid:border-kurio-danger'
const selectClass =
  'mt-1.5 h-10 w-full rounded-lg border border-kurio-border bg-kurio-bg px-2 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber'
const labelClass = 'block text-[10px] font-semibold text-kurio-text'

export function CheckoutPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const sessionKey = useSessionKey()
  const idempotencyStorageKey = getIdempotencyStorageKey(sessionKey)
  const quoteKey = ['checkout', 'quote', sessionKey] as const
  const walletsKey = ['wallets', sessionKey] as const
  useDocumentTitle('Pagamento — KURIO')
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
    staleTime: 0,
    retry: false,
  })
  const [selectedWalletId, setSelectedWalletId] = useState('')
  // Rede e provedor partem da carteira escolhida, mas o colecionador pode alterá-los.
  const [networkOverride, setNetworkOverride] = useState<BlockchainNetwork | null>(null)
  const [providerOverride, setProviderOverride] = useState<WalletProviderType | null>(null)
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const idempotencyRef = useRef<{ key: string; signature: string; input: CreateOrderRequestDto } | null>(null)
  // Barra cliques repetidos antes de o `isPending` da mutação refletir na tela.
  const submittingRef = useRef(false)
  const quoteRef = useRef<CheckoutQuoteDto | undefined>(undefined)
  const emptyCartError =
    quoteQuery.error instanceof ApiClientError &&
    quoteQuery.error.code === 'EMPTY_CART'

  // Carrinho consumido por uma tentativa anterior (timeout/recarga): recupera o MESMO pedido
  // pela chave de idempotência persistida, ou o pedido ainda pendente; nunca cria outro.
  useEffect(() => {
    if (!ordersQuery.data || getSessionCacheKey() !== sessionKey) return
    const { orders } = ordersQuery.data
    const attemptedKey = getPendingIdempotencyKey(idempotencyStorageKey)
    const recovered =
      (attemptedKey
        ? orders.find((order) => order.idempotencyKey === attemptedKey)
        : undefined) ?? orders.find((order) => order.status === 'pending')
    if (!recovered) return
    clearIdempotencyRecord(idempotencyStorageKey)
    void navigate({
      to: '/orders/$orderId',
      params: { orderId: recovered.id },
      replace: true,
    })
  }, [idempotencyStorageKey, navigate, ordersQuery.data, sessionKey])

  useEffect(() => {
    quoteRef.current = quoteQuery.data
  })

  // Só uma mudança em NFT que está na cotação exige nova revisão.
  useEffect(
    () =>
      subscribeNftUpdates((event) => {
        const affected = quoteRef.current?.items.find(
          (item) => item.nftId === event.payload.nftId,
        )
        if (!affected) return
        setNeedsReview(true)
        setUpdateNotice(
          `O preço ou a disponibilidade de ${affected.title} mudou. Revise os valores antes de continuar.`,
        )
      }),
    [],
  )

  const wallets = walletsQuery.data?.wallets ?? auth.wallets
  const primaryWallet = wallets.find((wallet) => wallet.isPrimary)
  const selectedWallet =
    wallets.find((wallet) => wallet.id === selectedWalletId) ?? primaryWallet
  const network: BlockchainNetwork =
    networkOverride ?? selectedWallet?.network ?? 'Ethereum'
  const walletProvider: WalletProviderType =
    providerOverride ?? selectedWallet?.walletType ?? 'MetaMask'
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
      if (getSessionCacheKey() !== sessionKey) return
      setOrderError('')
      setOrderTimeout(false)
      idempotencyRef.current = null
      clearIdempotencyRecord(idempotencyStorageKey)
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      await navigate({
        to: '/orders/$orderId',
        params: { orderId: order.id },
      })
    },
    onError: (error: unknown) => {
      if (getSessionCacheKey() !== sessionKey) return
      if (error instanceof ApiClientError) {
        setFieldErrors(error.fieldErrors ?? {})
        if (error.code === 'ORDER_PENDING') void queryClient.invalidateQueries({ queryKey: ['orders', sessionKey] })
      }
      setOrderError(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a compra.',
      )
      setOrderTimeout(
        error instanceof ApiClientError &&
          (error.status === 504 || error.status === 0 || error.code === 'ORDER_TIMEOUT'),
      )
      if (error instanceof ApiClientError && REVIEW_REQUIRED_CODES.has(error.code)) {
        setNeedsReview(true)
        // A API é a fonte de verdade: rebusca cotação e carrinho para mostrar os novos valores.
        void queryClient.invalidateQueries({ queryKey: quoteKey })
        void queryClient.invalidateQueries({ queryKey: ['cart'] })
      }
    },
  })

  if (quoteQuery.isLoading || walletsQuery.isLoading || ordersQuery.isLoading) return <CheckoutSkeleton />
  if (walletsQuery.isError || ordersQuery.isError) {
    const failedQuery = walletsQuery.isError ? walletsQuery : ordersQuery
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Não foi possível verificar sua conta</h1>
        <p role="alert" className="mt-3 text-sm text-kurio-danger">{failedQuery.error?.message}</p>
        <Button onClick={() => void failedQuery.refetch()} className="mt-6">Tentar novamente</Button>
      </main>
    )
  }
  if (emptyCartError && ordersQuery.isLoading) {
    return (
      <main aria-busy="true" className="mx-auto max-w-3xl px-4 py-16 text-center">
        <Skeleton className="mx-auto h-32 max-w-lg rounded-xl" />
        <p className="mt-4 text-xs text-kurio-text-muted">
          Verificando pedidos recentes para recuperar sua compra…
        </p>
      </main>
    )
  }
  if (quoteQuery.isError || !quote) {
    // Carrinho vazio (ex.: itens removidos por falta de estoque) não é uma falha técnica.
    if (emptyCartError) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Seu carrinho está vazio</h1>
          <p className="mt-3 text-sm text-kurio-text-muted">
            Não há itens para pagar. Explore o catálogo e escolha uma nova peça.
          </p>
          <Link
            to="/"
            search={{ tab: 'all', sort: 'recent', page: 1 }}
            className={buttonVariants({ size: 'lg', className: 'mt-6' })}
          >
            Explorar catálogo
          </Link>
        </main>
      )
    }
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
          className="mt-6 inline-flex rounded-lg border border-kurio-amber px-4 py-3 text-xs font-bold text-kurio-amber focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
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
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      await queryClient.invalidateQueries({ queryKey: quoteKey })
      const result = await queryClient.fetchQuery({
        queryKey: quoteKey,
        queryFn: () => fetchCheckoutQuote(),
      })
      setNeedsReview(result.hasStaleItems)
      setOrderError('')
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
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
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
    if (submittingRef.current) return
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
    if (effectiveReviewRequired && !orderTimeout) {
      setOrderError('Revise a cotação atual antes de confirmar a compra.')
      return
    }

    const data = new FormData(event.currentTarget)
    const values = Object.fromEntries(
      [...COLLECTOR_FIELDS, 'secondaryWalletOrEns', 'ensDomain', 'notes'].map(
        (name) => [name, getField(data, name)],
      ),
    )
    const collector: CollectorCheckoutData = {
      displayName: values.displayName,
      username: values.username,
      network,
      profileName: values.profileName,
      walletAddress: values.walletAddress,
      ...(values.secondaryWalletOrEns
        ? { secondaryWalletOrEns: values.secondaryWalletOrEns }
        : {}),
      walletType: walletProvider,
      ...(values.referralCode ? { referralCode: values.referralCode } : {}),
      email: values.email,
      ensName: values.ensName,
      ensDomain: values.ensDomain,
      useAnotherWallet,
      ...(values.notes ? { notes: values.notes } : {}),
    }
    const errors = validateCollector(collector)
    setFieldErrors(errors)
    const firstInvalid = Object.keys(errors)[0]
    if (firstInvalid && !orderTimeout) {
      document.getElementById(`checkout-${firstInvalid}`)?.focus()
      return
    }
    const input: CreateOrderRequestDto = orderTimeout && idempotencyRef.current
      ? idempotencyRef.current.input
      : {
      quoteVersion: quote.quoteVersion,
      walletProvider,
      network,
      collector,
    }

    submittingRef.current = true
    try {
      const signature = await signOrderInput(input)
      if (getSessionCacheKey() !== sessionKey) return
      const key =
        idempotencyRef.current?.signature === signature
          ? idempotencyRef.current.key
          : getPersistedIdempotencyKey(idempotencyStorageKey, signature)
      idempotencyRef.current = { key, signature, input }
      await orderMutation
        .mutateAsync({ input, idempotencyKey: key })
        .catch(() => undefined)
    } finally {
      submittingRef.current = false
    }
  }

  const selectWallet = (walletId: string) => {
    setSelectedWalletId(walletId)
    setNetworkOverride(null)
    setProviderOverride(null)
    setFieldErrors({})
  }

  const renderTextField = ({
    name,
    label,
    defaultValue,
    type = 'text',
    required = true,
    autoComplete,
  }: {
    name: (typeof COLLECTOR_FIELDS)[number] | 'secondaryWalletOrEns'
    label: string
    defaultValue: string | undefined
    type?: string
    required?: boolean
    autoComplete?: string
  }) => {
    const error = fieldErrors[name]
    return (
      <div>
        <label htmlFor={`checkout-${name}`} className={labelClass}>
          {label}
          {required ? ' *' : ''}
        </label>
        <input
          id={`checkout-${name}`}
          name={name}
          type={type}
          defaultValue={defaultValue}
          autoComplete={autoComplete}
          aria-required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `checkout-${name}-error` : undefined}
          className={inputClass}
        />
        {error && (
          <p id={`checkout-${name}-error`} className="mt-1 text-[10px] text-kurio-danger">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-7 sm:px-8 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">
            Pagamento seguro
          </p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Finalizar compra</h1>
        </div>
        <Link to="/cart" className="text-xs text-kurio-text-muted underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-kurio-amber">
          Voltar ao carrinho
        </Link>
      </div>

      {effectiveReviewRequired && (
        <section
          role="alert"
          className="mb-6 rounded-xl border border-kurio-amber/50 bg-kurio-amber/10 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={19} aria-hidden="true" className="mt-0.5 shrink-0 text-kurio-amber" />
            <div>
              <h2 className="text-sm font-bold text-kurio-amber">
                Cotação desatualizada
              </h2>
              <p className="mt-1 text-xs leading-5 text-kurio-text">
                {updateNotice ||
                  'O preço ou a disponibilidade de um ou mais NFTs mudou. Confirme os novos valores antes de pagar.'}
              </p>
              <Button
                onClick={() => void refreshQuote()}
                disabled={isReviewing}
                className="mt-3 rounded-lg"
              >
                {isReviewing ? 'Atualizando…' : 'Revisar e confirmar novos valores'}
              </Button>
            </div>
          </div>
        </section>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <form
          key={selectedWallet?.id ?? 'no-wallet'}
          onSubmit={(event) => void submitOrder(event)}
          noValidate
          className="space-y-5"
        >
          <section className="rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-6">
            <h2 className="text-base font-bold">Perfil do colecionador</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {renderTextField({ name: 'displayName', label: 'Nome de exibição', defaultValue: auth.session?.user.displayName })}
              {renderTextField({ name: 'username', label: 'Nome de usuário', defaultValue: auth.session?.user.username, autoComplete: 'username' })}
              <div>
                <label htmlFor="checkout-network" className={labelClass}>Rede *</label>
                <select
                  id="checkout-network"
                  name="network"
                  value={network}
                  onChange={(event) => {
                    const chosen = BLOCKCHAIN_NETWORKS.find((item) => item === event.target.value)
                    if (chosen) setNetworkOverride(chosen)
                  }}
                  className={selectClass}
                >
                  {BLOCKCHAIN_NETWORKS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              {renderTextField({ name: 'profileName', label: 'Nome do perfil', defaultValue: selectedWallet?.profileName })}
              {renderTextField({ name: 'walletAddress', label: 'Endereço da carteira', defaultValue: selectedWallet?.address })}
              {renderTextField({ name: 'secondaryWalletOrEns', label: 'ENS ou carteira secundária (opcional)', defaultValue: selectedWallet?.secondaryAddressOrEns, required: false })}
              <div>
                <label htmlFor="checkout-wallet-type" className={labelClass}>Tipo de carteira *</label>
                <select
                  id="checkout-wallet-type"
                  name="walletType"
                  value={walletProvider}
                  onChange={(event) => {
                    const chosen = WALLET_PROVIDER_TYPES.find((item) => item === event.target.value)
                    if (chosen) setProviderOverride(chosen)
                  }}
                  className={selectClass}
                >
                  {WALLET_PROVIDER_TYPES.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
              {renderTextField({ name: 'referralCode', label: 'Código de indicação', defaultValue: selectedWallet?.referralCode })}
              {renderTextField({ name: 'email', label: 'E-mail', type: 'email', defaultValue: auth.session?.user.email, autoComplete: 'email' })}
              <fieldset>
                <legend className={labelClass}>Nome ENS *</legend>
                <div className="mt-1.5 flex gap-2">
                  <input
                    id="checkout-ensName"
                    name="ensName"
                    aria-label="Nome ENS"
                    defaultValue={selectedWallet?.ensName ?? auth.session?.user.ensName}
                    aria-invalid={fieldErrors.ensName ? true : undefined}
                    aria-describedby={fieldErrors.ensName ? 'checkout-ensName-error' : undefined}
                    className={`${inputClass} mt-0 min-w-0 flex-1`}
                  />
                  <select
                    name="ensDomain"
                    aria-label="Domínio ENS"
                    defaultValue={selectedWallet?.ensDomain ?? auth.session?.user.ensDomain}
                    className="h-10 rounded-lg border border-kurio-border bg-kurio-bg px-2 text-[10px] focus-visible:outline-2 focus-visible:outline-kurio-amber"
                  >
                    <option value=".eth">.eth</option>
                    <option value=".kurio">.kurio</option>
                    <option value=".xyz">.xyz</option>
                  </select>
                </div>
                {fieldErrors.ensName && (
                  <p id="checkout-ensName-error" className="mt-1 text-[10px] text-kurio-danger">
                    {fieldErrors.ensName}
                  </p>
                )}
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
              <div className="sm:col-span-2">
                <label htmlFor="checkout-notes" className={labelClass}>
                  Observação do colecionador (opcional)
                </label>
                <textarea
                  id="checkout-notes"
                  name="notes"
                  rows={3}
                  className={`${inputClass} h-auto py-3`}
                />
              </div>
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
                    onChange={(event) => selectWallet(event.target.value)}
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
            <fieldset className="mt-5">
              <legend className="text-xs font-bold">Carteira e rede</legend>
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
                      onChange={() => setProviderOverride(provider)}
                      className="accent-kurio-amber"
                    />
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold">{label}</span>
                      <span className="mt-1 block text-[9px] text-kurio-text-muted">{detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
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
                onChange={(event) => {
                  const next = event.target.value
                  if (next === 'connected' || next === 'declined' || next === 'disconnected') {
                    setConnectionState(next)
                  }
                }}
                className="h-9 rounded border border-kurio-border bg-kurio-surface px-2 text-[10px] focus-visible:outline-2 focus-visible:outline-kurio-amber"
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
          <Button
            type="submit"
            size="lg"
            disabled={
              orderMutation.isPending ||
              (effectiveReviewRequired && !orderTimeout) ||
              !quote.items.length
            }
            className="w-full rounded-lg"
          >
            {orderMutation.isPending
              ? 'Confirmando…'
              : orderTimeout
                ? 'Tentar novamente com segurança'
                : 'Confirmar compra'}
          </Button>
        </form>

        <aside aria-label="Resumo do pedido" className="rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-base font-bold">Seus NFTs</h2>
          <div className="mt-4 space-y-3">
            {quote.items.map((item) => (
              <article key={item.nftId} className="flex gap-3 border-b border-kurio-border pb-3">
                <img src={item.imageUrl} alt="" width={64} height={64} className="size-16 rounded-lg object-cover" />
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
            className="mt-4 flex w-full items-center justify-between text-left text-[10px] text-kurio-text-muted hover:text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
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
                aria-invalid={couponError ? true : undefined}
                aria-describedby={couponError ? 'checkout-coupon-error' : undefined}
                className="h-10 min-w-0 flex-1 rounded-lg border border-kurio-border bg-kurio-bg px-3 text-[10px] focus-visible:outline-2 focus-visible:outline-kurio-amber aria-invalid:border-kurio-danger"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={!couponDraft.trim()}
                className="h-10 rounded-lg"
              >
                Aplicar
              </Button>
            </form>
          )}
          {couponError && <p id="checkout-coupon-error" role="alert" className="mt-2 text-[10px] text-kurio-danger">{couponError}</p>}
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
                Taxa de rede <span className="block text-[9px] text-kurio-amber">Taxa estimada</span>
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
            <Link to="/wallets" className="mt-4 inline-flex items-center gap-2 text-[10px] text-kurio-amber underline focus-visible:outline-2 focus-visible:outline-kurio-amber">
              <WalletCards size={13} aria-hidden="true" />
              Cadastrar carteira
            </Link>
          )}
          {orderMutation.isPending && (
            <p role="status" className="mt-3 flex items-center gap-2 text-[10px] text-kurio-text-muted">
              <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Aguardando resposta da rede…
            </p>
          )}
        </aside>
      </div>
    </main>
  )
}
