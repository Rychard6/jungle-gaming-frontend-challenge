import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, WalletCards } from 'lucide-react'
import { ApiClientError, getSessionCacheKey } from '../../../shared/api/http'
import { useSessionKey } from '../../../shared/api/use-session-key'
import {
  BLOCKCHAIN_NETWORKS,
  WALLET_PROVIDER_TYPES,
  type AuthSessionResponseDto,
  type UserProfileDto,
  type WalletDto,
  type WalletInputDto,
} from '../../../shared/api/types'
import { useDocumentTitle } from '../../../shared/lib/use-document-title'
import {
  ENS_DOMAINS,
  validateWallet,
  type FieldErrors,
} from '../../../shared/lib/validation'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Skeleton } from '../../../shared/ui/skeleton'
import { useAuth } from '../../auth/hooks/auth-context'
import {
  createWallet,
  deleteWallet,
  fetchWallets,
  updateWallet,
  type WalletsResponse,
} from '../api/wallets-api'
import { AccountSidebarLayout } from '../../profile/components/account-sidebar-layout'

const inputClass =
  'mt-2 h-11 w-full rounded-lg border border-kurio-border bg-kurio-bg px-3 text-sm text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber aria-invalid:border-kurio-danger'
const labelClass = 'block text-xs font-semibold text-kurio-text'

interface WalletRequest {
  wallet: WalletDto | null
  input: WalletInputDto
  delete?: boolean
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

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

/** Remove espaços acidentais antes de validar/enviar (o servidor trata o valor como está). */
function normalizeDraft(draft: WalletInputDto): WalletInputDto {
  const { secondaryAddressOrEns, ...rest } = draft
  const secondary = secondaryAddressOrEns?.trim()
  return {
    ...rest,
    displayName: rest.displayName.trim(),
    walletNickname: rest.walletNickname.trim(),
    profileName: rest.profileName.trim(),
    address: rest.address.trim(),
    referralCode: rest.referralCode.trim(),
    email: rest.email.trim(),
    ensName: rest.ensName.trim(),
    ...(secondary ? { secondaryAddressOrEns: secondary } : {}),
  }
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error: string | undefined
  children: ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-[10px] text-kurio-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function WalletEditor({
  initialValue,
  busy,
  onSave,
  onDelete,
  onMakePrimary,
}: {
  initialValue: WalletInputDto
  busy: boolean
  onSave: (input: WalletInputDto) => Promise<void>
  onDelete?: () => void
  onMakePrimary?: () => void
}) {
  const baseId = useId()
  const formRef = useRef<HTMLFormElement>(null)
  const [draft, setDraft] = useState(initialValue)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const setField = <K extends keyof WalletInputDto>(
    field: K,
    value: WalletInputDto[K],
  ) => setDraft((current) => ({ ...current, [field]: value }))

  const showErrors = (errors: FieldErrors) => {
    setFieldErrors(errors)
    const firstInvalid = Object.keys(errors)[0]
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
        ?.focus()
    }
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const normalized = normalizeDraft(draft)
    const clientErrors = validateWallet(normalized)
    if (Object.keys(clientErrors).length > 0) {
      showErrors(clientErrors)
      return
    }
    setFieldErrors({})
    try {
      await onSave(normalized)
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        setError(requestError.message)
        showErrors(requestError.fieldErrors ?? {})
      } else {
        setError(messageOf(requestError, 'Não foi possível salvar a carteira.'))
      }
    }
  }

  const fieldProps = (name: keyof WalletInputDto) => ({
    id: `${baseId}-${name}`,
    name,
    'aria-invalid': fieldErrors[name] ? true : undefined,
    'aria-describedby': fieldErrors[name] ? `${baseId}-${name}-error` : undefined,
  })

  return (
    <form
      ref={formRef}
      onSubmit={(event) => void submit(event)}
      noValidate
      className="rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-6"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={`${baseId}-displayName`} label="Nome de exibição *" error={fieldErrors.displayName}>
          <input
            {...fieldProps('displayName')}
            value={draft.displayName}
            onChange={(event) => setField('displayName', event.target.value)}
            aria-required="true"
            className={inputClass}
          />
        </Field>
        <Field id={`${baseId}-walletNickname`} label="Apelido da carteira *" error={fieldErrors.walletNickname}>
          <input
            {...fieldProps('walletNickname')}
            value={draft.walletNickname}
            onChange={(event) => setField('walletNickname', event.target.value)}
            aria-required="true"
            className={inputClass}
          />
        </Field>
        <Field id={`${baseId}-network`} label="Rede *" error={undefined}>
          <select
            {...fieldProps('network')}
            value={draft.network}
            onChange={(event) => {
              const network = BLOCKCHAIN_NETWORKS.find(
                (item) => item === event.target.value,
              )
              if (network) setField('network', network)
            }}
            className={inputClass}
          >
            {BLOCKCHAIN_NETWORKS.map((network) => (
              <option key={network}>{network}</option>
            ))}
          </select>
        </Field>
        <Field id={`${baseId}-profileName`} label="Nome do perfil *" error={fieldErrors.profileName}>
          <input
            {...fieldProps('profileName')}
            value={draft.profileName}
            onChange={(event) => setField('profileName', event.target.value)}
            aria-required="true"
            className={inputClass}
          />
        </Field>
        <Field id={`${baseId}-address`} label="Endereço da carteira *" error={fieldErrors.address}>
          <input
            {...fieldProps('address')}
            value={draft.address}
            onChange={(event) => setField('address', event.target.value)}
            placeholder="Endereço 0x da carteira"
            autoComplete="off"
            spellCheck={false}
            aria-required="true"
            className={inputClass}
          />
        </Field>
        <Field
          id={`${baseId}-secondaryAddressOrEns`}
          label="ENS ou carteira secundária (opcional)"
          error={fieldErrors.secondaryAddressOrEns}
        >
          <input
            {...fieldProps('secondaryAddressOrEns')}
            value={draft.secondaryAddressOrEns ?? ''}
            onChange={(event) =>
              setField('secondaryAddressOrEns', event.target.value || undefined)
            }
            placeholder="nome.eth ou endereço 0x"
            autoComplete="off"
            spellCheck={false}
            className={inputClass}
          />
        </Field>
        <Field id={`${baseId}-walletType`} label="Tipo de carteira *" error={undefined}>
          <select
            {...fieldProps('walletType')}
            value={draft.walletType}
            onChange={(event) => {
              const walletType = WALLET_PROVIDER_TYPES.find(
                (item) => item === event.target.value,
              )
              if (walletType) setField('walletType', walletType)
            }}
            className={inputClass}
          >
            {WALLET_PROVIDER_TYPES.map((walletType) => (
              <option key={walletType}>{walletType}</option>
            ))}
          </select>
        </Field>
        <Field id={`${baseId}-referralCode`} label="Código de indicação *" error={fieldErrors.referralCode}>
          <input
            {...fieldProps('referralCode')}
            value={draft.referralCode}
            onChange={(event) => setField('referralCode', event.target.value)}
            autoComplete="off"
            aria-required="true"
            className={inputClass}
          />
        </Field>
        <Field id={`${baseId}-email`} label="E-mail *" error={fieldErrors.email}>
          <input
            {...fieldProps('email')}
            type="email"
            value={draft.email}
            onChange={(event) => setField('email', event.target.value)}
            autoComplete="email"
            aria-required="true"
            className={inputClass}
          />
        </Field>
        <fieldset>
          <legend className={labelClass}>Nome ENS *</legend>
          <div className="mt-2 flex gap-2">
            <select
              name="ensDomain"
              value={draft.ensDomain}
              onChange={(event) => setField('ensDomain', event.target.value)}
              aria-label="Domínio ENS"
              className="h-11 rounded-lg border border-kurio-border bg-kurio-bg px-2 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              {ENS_DOMAINS.map((domain) => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
            <input
              name="ensName"
              value={draft.ensName}
              onChange={(event) => setField('ensName', event.target.value)}
              aria-label="Nome ENS"
              aria-required="true"
              aria-invalid={fieldErrors.ensName ? true : undefined}
              aria-describedby={fieldErrors.ensName ? `${baseId}-ensName-error` : undefined}
              className={`${inputClass} mt-0 min-w-0 flex-1`}
            />
          </div>
          {fieldErrors.ensName && (
            <p id={`${baseId}-ensName-error`} className="mt-1 text-[10px] text-kurio-danger">
              {fieldErrors.ensName}
            </p>
          )}
          {fieldErrors.ensDomain && (
            <p className="mt-1 text-[10px] text-kurio-danger">{fieldErrors.ensDomain}</p>
          )}
        </fieldset>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-kurio-danger/40 bg-kurio-danger/10 p-3 text-xs text-kurio-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-kurio-border pt-5">
        {onMakePrimary && (
          <Button
            variant="secondary"
            onClick={onMakePrimary}
            disabled={busy}
            className="mr-auto font-normal"
          >
            Definir como principal
          </Button>
        )}
        {onDelete && (
          <Button variant="destructive" onClick={onDelete} disabled={busy} className="font-normal">
            <Trash2 size={14} aria-hidden="true" />
            Remover
          </Button>
        )}
        <Button type="submit" disabled={busy} className="px-5">
          {busy ? 'Salvando…' : 'Salvar carteira'}
        </Button>
      </div>
    </form>
  )
}

export function WalletsPage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const sessionKey = useSessionKey()
  const queryKey = ['wallets', sessionKey] as const
  useDocumentTitle('Carteiras — KURIO')
  const walletsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => fetchWallets(signal),
    enabled: Boolean(auth.session),
  })
  const [addingSecondary, setAddingSecondary] = useState(false)
  const [pageError, setPageError] = useState('')
  const [notice, setNotice] = useState('')
  const [walletToDelete, setWalletToDelete] = useState<WalletDto | null>(null)
  // Reflete o clique no checkbox imediatamente enquanto a API simulada responde.
  const [pendingSameAsPrimary, setPendingSameAsPrimary] = useState<boolean | null>(null)

  const mutation = useMutation({
    mutationFn: async (request: WalletRequest): Promise<WalletsResponse> => {
      if (request.delete && request.wallet) {
        return deleteWallet(request.wallet.id)
      }
      if (request.wallet) {
        return updateWallet(request.wallet.id, request.input)
      }
      return createWallet(request.input)
    },
    onSuccess: ({ wallets }) => {
      if (getSessionCacheKey() !== sessionKey) return
      queryClient.setQueryData<WalletsResponse>(queryKey, { wallets })
      queryClient.setQueryData<AuthSessionResponseDto>(
        ['auth', 'session'],
        (current) =>
          current?.session && current.session.user.id === auth.session?.user.id
            ? { ...current, wallets }
            : current,
      )
    },
  })

  if (walletsQuery.isLoading) {
    return (
      <AccountSidebarLayout active="wallets">
        <div aria-busy="true" className="space-y-4">
          <span className="sr-only">Carregando carteiras…</span>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </AccountSidebarLayout>
    )
  }
  if (walletsQuery.isError || !walletsQuery.data) {
    return (
      <AccountSidebarLayout active="wallets">
        <p role="alert" className="rounded-lg border border-kurio-danger/40 p-4 text-sm text-kurio-danger">
          {messageOf(walletsQuery.error, 'Não foi possível carregar suas carteiras.')}
        </p>
      </AccountSidebarLayout>
    )
  }

  const wallets = walletsQuery.data.wallets
  const primary = wallets.find((wallet) => wallet.isPrimary) ?? null
  const secondary = wallets.find((wallet) => !wallet.isPrimary) ?? null
  const profile = auth.session?.user

  // Ações disparadas por botões da página (o erro aparece no topo, não dentro de um formulário).
  const runAction = (
    request: WalletRequest,
    successMessage: string,
    afterSuccess?: () => void,
  ) => {
    setPageError('')
    setNotice('')
    mutation.mutate(request, {
      onSuccess: () => {
        setNotice(successMessage)
        afterSuccess?.()
      },
      onError: (requestError) =>
        setPageError(
          messageOf(requestError, 'Não foi possível atualizar suas carteiras.'),
        ),
      onSettled: () => setPendingSameAsPrimary(null),
    })
  }

  // Salvar pelo formulário: o erro é exibido dentro do próprio formulário (quem chama trata).
  const saveFromForm =
    (wallet: WalletDto | null) => async (input: WalletInputDto) => {
      setPageError('')
      setNotice('')
      await mutation.mutateAsync({ wallet, input })
      setNotice('Carteira salva com sucesso.')
      setAddingSecondary(false)
    }

  const setSecondarySameAsPrimary = (sameAsPrimary: boolean) => {
    if (!primary) return
    setPendingSameAsPrimary(sameAsPrimary)
    if (secondary) {
      runAction(
        {
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
        },
        sameAsPrimary
          ? 'A carteira secundária agora usa o endereço da principal.'
          : 'A carteira secundária voltou a ter um endereço próprio.',
      )
      return
    }
    if (sameAsPrimary) {
      runAction(
        {
          wallet: null,
          input: {
            ...walletToInput(primary),
            isPrimary: false,
            sameAsPrimary: true,
          },
        },
        'A carteira secundária agora usa o endereço da principal.',
      )
    } else {
      setPendingSameAsPrimary(null)
      setAddingSecondary(true)
    }
  }

  const confirmDelete = () => {
    const target = walletToDelete
    if (!target) return
    setWalletToDelete(null)
    runAction(
      { wallet: target, input: walletToInput(target), delete: true },
      'Carteira removida.',
      () => {
        document
          .getElementById(
            target.isPrimary ? 'wallets-primary-heading' : 'wallets-secondary-heading',
          )
          ?.focus()
      },
    )
  }

  const secondaryDraft = secondary
    ? walletToInput(secondary)
    : emptyWallet(profile, false)
  const sameAsPrimaryChecked =
    pendingSameAsPrimary ?? secondary?.sameAsPrimary ?? false

  return (
    <AccountSidebarLayout active="wallets">
      <div className="space-y-6">
        {pageError && (
          <p role="alert" className="rounded-lg border border-kurio-danger/40 bg-kurio-danger/10 p-3 text-xs text-kurio-danger">
            {pageError}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg border border-kurio-success/40 bg-kurio-success/5 p-3 text-xs text-kurio-success">
            {notice}
          </p>
        )}
        <section aria-labelledby="wallets-primary-heading">
          <div className="mb-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">
              Conta
            </p>
            <h2
              id="wallets-primary-heading"
              tabIndex={-1}
              className="mt-2 text-xl font-bold focus:outline-none"
            >
              Carteira principal
            </h2>
            <p className="mt-2 max-w-xl text-xs leading-5 text-kurio-text-muted">
              Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
            </p>
          </div>
          {primary ? (
            <WalletEditor
              key={JSON.stringify(primary)}
              initialValue={walletToInput(primary)}
              busy={mutation.isPending}
              onSave={saveFromForm(primary)}
              onDelete={() => setWalletToDelete(primary)}
            />
          ) : (
            <>
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-kurio-border bg-kurio-surface p-4">
                <WalletCards size={20} className="text-kurio-amber" aria-hidden="true" />
                <p className="text-xs text-kurio-text-muted">
                  Você ainda não cadastrou uma carteira principal.
                </p>
              </div>
              <WalletEditor
                key="new-primary"
                initialValue={emptyWallet(profile, true)}
                busy={mutation.isPending}
                onSave={saveFromForm(null)}
              />
            </>
          )}
        </section>

        <section
          aria-labelledby="wallets-secondary-heading"
          className="border-t border-kurio-border pt-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2
                id="wallets-secondary-heading"
                tabIndex={-1}
                className="text-lg font-bold focus:outline-none"
              >
                Carteira secundária
              </h2>
              <p className="mt-1 text-xs text-kurio-text-muted">
                {secondary || addingSecondary
                  ? 'Adicione outra carteira de recebimento ou use a principal.'
                  : 'Você ainda não adicionou uma carteira secundária.'}
              </p>
            </div>
            {!secondary && !addingSecondary && (
              <Button
                variant="outline"
                onClick={() => setAddingSecondary(true)}
                disabled={!primary}
                aria-label="Adicionar carteira secundária"
                className="font-semibold"
              >
                <Plus size={15} aria-hidden="true" />
                Adicionar
              </Button>
            )}
          </div>
          <label className="mb-4 flex min-h-12 items-center gap-3 rounded-lg border border-kurio-border bg-kurio-surface px-4 py-3 text-xs text-kurio-text">
            <input
              type="checkbox"
              checked={sameAsPrimaryChecked}
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
              <Button
                variant="secondary"
                onClick={() => setSecondarySameAsPrimary(false)}
                disabled={mutation.isPending}
                className="mt-4 font-normal"
              >
                Usar endereço diferente
              </Button>
            </div>
          ) : secondary ? (
            <WalletEditor
              key={JSON.stringify(secondary)}
              initialValue={secondaryDraft}
              busy={mutation.isPending}
              onSave={saveFromForm(secondary)}
              onDelete={() => setWalletToDelete(secondary)}
              onMakePrimary={() =>
                runAction(
                  {
                    wallet: secondary,
                    input: {
                      ...walletToInput(secondary),
                      isPrimary: true,
                      sameAsPrimary: false,
                    },
                  },
                  'A carteira secundária agora é a principal.',
                )
              }
            />
          ) : addingSecondary ? (
            <WalletEditor
              key="new-secondary"
              initialValue={secondaryDraft}
              busy={mutation.isPending}
              onSave={saveFromForm(null)}
            />
          ) : null}
        </section>
      </div>

      <Dialog
        open={walletToDelete !== null}
        onClose={() => setWalletToDelete(null)}
        labelledBy="delete-wallet-title"
        initialFocusSelector="[data-autofocus]"
        overlayClassName="grid place-items-center p-4"
        className="w-full max-w-sm rounded-xl border border-kurio-border bg-kurio-surface p-6 shadow-2xl"
      >
        <h2 id="delete-wallet-title" className="text-lg font-bold">
          Remover carteira?
        </h2>
        <p className="mt-2 text-xs leading-5 text-kurio-text-muted">
          {walletToDelete
            ? `A carteira ${walletToDelete.walletNickname} será removida da sua conta.${walletToDelete.isPrimary ? ' Se houver outra carteira, ela passa a ser a principal.' : ''}`
            : ''}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button
            variant="secondary"
            data-autofocus
            onClick={() => setWalletToDelete(null)}
            className="font-normal"
          >
            Cancelar
          </Button>
          <Button variant="destructive" onClick={confirmDelete}>
            Remover carteira
          </Button>
        </div>
      </Dialog>
    </AccountSidebarLayout>
  )
}
