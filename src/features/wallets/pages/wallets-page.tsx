import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, WalletCards } from 'lucide-react'
import { ApiClientError, getSessionCacheKey } from '../../../shared/api/http'
import type {
  BlockchainNetwork,
  AuthSessionResponseDto,
  UserProfileDto,
  WalletDto,
  WalletInputDto,
  WalletProviderType,
} from '../../../shared/api/types'
import { useAuth } from '../../auth/hooks/auth-context'
import {
  createWallet,
  deleteWallet,
  fetchWallets,
  updateWallet,
  type WalletsResponse,
} from '../api/wallets-api'
import { AccountSidebarLayout } from '../../profile/components/account-sidebar-layout'

function walletToInput(wallet: WalletDto): WalletInputDto {
  return {
    displayName: wallet.displayName,
    walletNickname: wallet.walletNickname,
    network: wallet.network,
    profileName: wallet.profileName,
    address: wallet.address,
    ...(wallet.secondaryAddressOrEns
      ? { secondaryAddressOrEns: wallet.secondaryAddressOrEns }
      : {}),
    walletType: wallet.walletType,
    referralCode: wallet.referralCode,
    email: wallet.email,
    ensName: wallet.ensName,
    ensDomain: wallet.ensDomain,
    isPrimary: wallet.isPrimary,
    ...(wallet.sameAsPrimary !== undefined
      ? { sameAsPrimary: wallet.sameAsPrimary }
      : {}),
  }
}

function emptyWallet(
  profile: UserProfileDto | undefined,
  isPrimary: boolean,
): WalletInputDto {
  return {
    displayName: '',
    walletNickname: profile?.walletNickname ?? '',
    network: 'Ethereum',
    profileName: profile?.username ?? '',
    address: '',
    walletType: 'MetaMask',
    referralCode: '',
    email: profile?.email ?? '',
    ensName: profile?.ensName ?? '',
    ensDomain: profile?.ensDomain ?? '.eth',
    isPrimary,
    sameAsPrimary: false,
  }
}

function WalletEditor({
  wallet,
  initialValue,
  busy,
  onSave,
  onDelete,
  onMakePrimary,
}: {
  wallet: WalletDto | null
  initialValue: WalletInputDto
  busy: boolean
  onSave: (input: WalletInputDto) => Promise<void>
  onDelete?: () => void
  onMakePrimary?: () => void
}) {
  const [draft, setDraft] = useState(initialValue)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const setField = <K extends keyof WalletInputDto>(
    field: K,
    value: WalletInputDto[K],
  ) => setDraft((current) => ({ ...current, [field]: value }))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    try {
      await onSave(draft)
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        setError(requestError.message)
        setFieldErrors(requestError.fieldErrors ?? {})
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível salvar a carteira.',
        )
      }
    }
  }

  const inputClass =
    'mt-2 h-11 w-full rounded-lg border border-kurio-border bg-kurio-bg px-3 text-sm text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber'
  const labelClass = 'block text-xs font-semibold text-kurio-text'
  const showFieldError = (field: keyof WalletInputDto) =>
    fieldErrors[field] ? (
      <span className="mt-1 block text-[10px] text-kurio-danger">
        {fieldErrors[field]}
      </span>
    ) : null

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelClass}>
          Nome de exibição *
          <input
            value={draft.displayName}
            onChange={(event) => setField('displayName', event.target.value)}
            required
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.displayName)}
          />
          {showFieldError('displayName')}
        </label>
        <label className={labelClass}>
          Apelido da carteira *
          <input
            value={draft.walletNickname}
            onChange={(event) => setField('walletNickname', event.target.value)}
            required
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.walletNickname)}
          />
          {showFieldError('walletNickname')}
        </label>
        <label className={labelClass}>
          Rede *
          <select
            value={draft.network}
            onChange={(event) =>
              setField('network', event.target.value as BlockchainNetwork)
            }
            className={inputClass}
          >
            <option>Ethereum</option>
            <option>Polygon</option>
            <option>Solana</option>
          </select>
        </label>
        <label className={labelClass}>
          Nome do perfil *
          <input
            value={draft.profileName}
            onChange={(event) => setField('profileName', event.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Endereço da carteira *
          <input
            value={draft.address}
            onChange={(event) => setField('address', event.target.value)}
            required
            placeholder="Endereço 0x da carteira"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.address)}
            aria-describedby={fieldErrors.address ? 'wallet-address-error' : undefined}
          />
          {fieldErrors.address && (
            <span id="wallet-address-error" className="mt-1 block text-[10px] text-kurio-danger">
              {fieldErrors.address}
            </span>
          )}
        </label>
        <label className={labelClass}>
          ENS ou carteira secundária (opcional)
          <input
            value={draft.secondaryAddressOrEns ?? ''}
            onChange={(event) =>
              setField(
                'secondaryAddressOrEns',
                event.target.value || undefined,
              )
            }
            placeholder="nome.eth ou endereço 0x"
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.secondaryAddressOrEns)}
          />
          {showFieldError('secondaryAddressOrEns')}
        </label>
        <label className={labelClass}>
          Tipo de carteira *
          <select
            value={draft.walletType}
            onChange={(event) =>
              setField('walletType', event.target.value as WalletProviderType)
            }
            className={inputClass}
          >
            <option>MetaMask</option>
            <option>WalletConnect</option>
            <option>Coinbase Wallet</option>
          </select>
        </label>
        <label className={labelClass}>
          Código de indicação *
          <input
            value={draft.referralCode}
            onChange={(event) => setField('referralCode', event.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          E-mail *
          <input
            type="email"
            value={draft.email}
            onChange={(event) => setField('email', event.target.value)}
            required
            className={inputClass}
            aria-invalid={Boolean(fieldErrors.email)}
          />
          {showFieldError('email')}
        </label>
        <fieldset>
          <legend className={labelClass}>Nome ENS *</legend>
          <div className="mt-2 flex gap-2">
            <input
              value={draft.ensName}
              onChange={(event) => setField('ensName', event.target.value)}
              required
              aria-label="Nome ENS"
              className={`${inputClass} mt-0 min-w-0 flex-1`}
              aria-invalid={Boolean(fieldErrors.ensName)}
            />
            <select
              value={draft.ensDomain}
              onChange={(event) => setField('ensDomain', event.target.value)}
              aria-label="Domínio ENS"
              className="h-11 rounded-lg border border-kurio-border bg-kurio-bg px-2 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              <option value=".eth">.eth</option>
              <option value=".kurio">.kurio</option>
              <option value=".xyz">.xyz</option>
            </select>
          </div>
          {showFieldError('ensName')}
          {showFieldError('ensDomain')}
        </fieldset>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-kurio-danger/40 bg-kurio-danger/10 p-3 text-xs text-kurio-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-kurio-border pt-5">
        {onMakePrimary && (
          <button
            type="button"
            onClick={onMakePrimary}
            disabled={busy}
            className="mr-auto rounded-lg border border-kurio-border px-4 py-2.5 text-xs text-kurio-text-muted hover:text-kurio-text disabled:opacity-50"
          >
            Definir como principal
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-kurio-danger/50 px-4 py-2.5 text-xs text-kurio-danger disabled:opacity-50"
          >
            <Trash2 size={14} aria-hidden="true" />
            Remover
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="min-h-10 rounded-lg bg-kurio-amber px-5 py-2.5 text-xs font-bold text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:opacity-60"
        >
          {busy ? 'Salvando…' : wallet ? 'Salvar carteira' : 'Adicionar carteira'}
        </button>
      </div>
    </form>
  )
}

export function WalletsPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const sessionKey = getSessionCacheKey() ?? 'anonymous'
  const queryKey = ['wallets', sessionKey] as const
  const walletsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchWallets(signal),
    enabled: Boolean(auth.session),
  })
  const [addingPrimary, setAddingPrimary] = useState(false)
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [pageError, setPageError] = useState('')
  const mutation = useMutation({
    mutationFn: async (request: {
      wallet: WalletDto | null
      input: WalletInputDto
      delete?: boolean
    }): Promise<WalletsResponse> => {
      if (request.delete && request.wallet) {
        return deleteWallet(request.wallet.id)
      }
      if (request.wallet) {
        return updateWallet(request.wallet.id, request.input)
      }
      return createWallet(request.input)
    },
    onSuccess: (response) => {
      queryClient.setQueryData<WalletsResponse>(queryKey, response)
      queryClient.setQueryData<AuthSessionResponseDto>(
        ['auth', 'session'],
        (current) => (current ? { ...current, wallets: response.wallets } : current),
      )
      setPageError('')
      setAddingPrimary(false)
      setAddingSecondary(false)
    },
    onError: (requestError) => {
      setPageError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível atualizar suas carteiras.',
      )
    },
  })

  if (walletsQuery.isLoading) {
    return (
      <AccountSidebarLayout active="wallets">
        <div aria-busy="true" className="space-y-4">
          <div className="skeleton-shimmer h-8 w-56 rounded" />
          <div className="skeleton-shimmer h-64 rounded-xl" />
        </div>
      </AccountSidebarLayout>
    )
  }
  if (walletsQuery.isError || !walletsQuery.data) {
    return (
      <AccountSidebarLayout active="wallets">
        <p role="alert" className="rounded-lg border border-kurio-danger/40 p-4 text-sm text-kurio-danger">
          {walletsQuery.error instanceof Error
            ? walletsQuery.error.message
            : 'Não foi possível carregar suas carteiras.'}
        </p>
      </AccountSidebarLayout>
    )
  }

  const wallets = walletsQuery.data.wallets
  const primary = wallets.find((wallet) => wallet.isPrimary) ?? null
  const secondary = wallets.find((wallet) => !wallet.isPrimary) ?? null
  const saveWallet = (wallet: WalletDto | null) => async (
    input: WalletInputDto,
  ) => {
    await mutation.mutateAsync({ wallet, input })
  }
  const saveAsPrimary = (wallet: WalletDto | null) => async (
    input: WalletInputDto,
  ) => {
    await mutation.mutateAsync({
      wallet,
      input: { ...input, isPrimary: true, sameAsPrimary: false },
    })
  }
  const profile = auth.session?.user
  const secondaryDraft = secondary
    ? walletToInput(secondary)
    : emptyWallet(profile, false)

  const setSecondarySameAsPrimary = (sameAsPrimary: boolean) => {
    if (!primary) return
    if (secondary) {
      mutation.mutate({
        wallet: secondary,
        input: {
          ...walletToInput(secondary),
          ...(sameAsPrimary
            ? {
                address: primary.address,
                network: primary.network,
                walletType: primary.walletType,
                ensName: primary.ensName,
                ensDomain: primary.ensDomain,
              }
            : {}),
          sameAsPrimary,
          isPrimary: false,
        },
      })
      return
    }
    if (sameAsPrimary) {
      mutation.mutate({
        wallet: null,
        input: {
          ...walletToInput(primary),
          isPrimary: false,
          sameAsPrimary: true,
        },
      })
    } else {
      setAddingSecondary(true)
    }
  }

  return (
    <AccountSidebarLayout active="wallets">
      <div className="space-y-6">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">
                Conta
              </p>
              <h2 className="mt-2 text-xl font-bold">Carteira principal</h2>
              <p className="mt-2 max-w-xl text-xs leading-5 text-kurio-text-muted">
                Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAddingPrimary((adding) => !adding)}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-kurio-amber px-4 py-2 text-xs font-semibold text-kurio-amber hover:bg-kurio-amber/10 focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              <Plus size={15} aria-hidden="true" />
              Adicionar
            </button>
          </div>
          {primary ? (
            <WalletEditor
              key={JSON.stringify(primary)}
              wallet={primary}
              initialValue={walletToInput(primary)}
              busy={mutation.isPending}
              onSave={saveWallet(primary)}
              onDelete={() =>
                mutation.mutate({ wallet: primary, input: walletToInput(primary), delete: true })
              }
            />
          ) : (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-kurio-border bg-kurio-surface p-4">
              <WalletCards size={20} className="text-kurio-amber" aria-hidden="true" />
              <p className="text-xs text-kurio-text-muted">
                Você ainda não cadastrou uma carteira principal.
              </p>
            </div>
          )}
          {addingPrimary && (
            <div className="mt-4">
              <h3 className="mb-3 text-sm font-bold">Adicionar carteira principal</h3>
              <WalletEditor
                key="new-primary"
                wallet={null}
                initialValue={emptyWallet(profile, true)}
                busy={mutation.isPending}
                onSave={saveAsPrimary(primary)}
              />
            </div>
          )}
        </section>

        <section className="border-t border-kurio-border pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Carteira secundária</h2>
              <p className="mt-1 text-xs text-kurio-text-muted">
                Adicione outra carteira de recebimento ou use a principal.
              </p>
            </div>
            {!secondary && !addingSecondary && (
              <button
                type="button"
                onClick={() => setAddingSecondary(true)}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-kurio-amber px-4 py-2 text-xs font-semibold text-kurio-amber hover:bg-kurio-amber/10 focus-visible:outline-2 focus-visible:outline-kurio-amber"
              >
                <Plus size={15} aria-hidden="true" />
                Adicionar
              </button>
            )}
          </div>
          <label className="mb-4 flex min-h-12 items-center gap-3 rounded-lg border border-kurio-border bg-kurio-surface px-4 py-3 text-xs text-kurio-text">
            <input
              type="checkbox"
              checked={secondary?.sameAsPrimary ?? false}
              disabled={!primary || mutation.isPending}
              onChange={(event) => setSecondarySameAsPrimary(event.target.checked)}
              className="size-4 accent-kurio-amber"
            />
            Igual à carteira principal
          </label>
          {secondary?.sameAsPrimary ? (
            <div className="rounded-xl border border-kurio-border bg-kurio-surface p-4">
              <p className="text-[10px] uppercase tracking-widest text-kurio-amber">
                Mesmo endereço da principal
              </p>
              <p className="mt-2 break-all text-sm font-semibold">{primary?.address}</p>
              <p className="mt-1 text-xs text-kurio-text-muted">
                {primary?.network} · {primary?.walletType}
              </p>
              <button
                type="button"
                onClick={() => setSecondarySameAsPrimary(false)}
                className="mt-4 rounded-lg border border-kurio-border px-3 py-2 text-xs text-kurio-text-muted hover:text-kurio-text"
              >
                Usar endereço diferente
              </button>
            </div>
          ) : secondary ? (
            <WalletEditor
              key={JSON.stringify(secondary)}
              wallet={secondary}
              initialValue={secondaryDraft}
              busy={mutation.isPending}
              onSave={saveWallet(secondary)}
              onDelete={() =>
                mutation.mutate({
                  wallet: secondary,
                  input: walletToInput(secondary),
                  delete: true,
                })
              }
              onMakePrimary={() =>
                mutation.mutate({
                  wallet: secondary,
                  input: {
                    ...walletToInput(secondary),
                    isPrimary: true,
                    sameAsPrimary: false,
                  },
                })
              }
            />
          ) : addingSecondary ? (
            <WalletEditor
              key="new-secondary"
              wallet={null}
              initialValue={secondaryDraft}
              busy={mutation.isPending}
              onSave={saveWallet(null)}
            />
          ) : null}
        </section>

        {pageError && (
          <p role="alert" className="rounded-lg border border-kurio-danger/40 bg-kurio-danger/10 p-3 text-xs text-kurio-danger">
            {pageError}
          </p>
        )}
      </div>
    </AccountSidebarLayout>
  )
}
