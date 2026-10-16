import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, UserRound } from 'lucide-react'
import { ApiClientError, getSessionCacheKey } from '../../../shared/api/http'
import type {
  AuthSessionResponseDto,
  UpdateProfileRequestDto,
  UserProfileDto,
} from '../../../shared/api/types'
import { useAuth } from '../../auth/hooks/auth-context'
import {
  fetchProfile,
  updatePassword,
  updateProfile,
} from '../api/profile-api'
import { AccountSidebarLayout } from '../components/account-sidebar-layout'

const avatarChoices = [
  '/mock-assets/nfts/ape-emerald.png',
  '/mock-assets/nfts/ape-cosmic.png',
  '/mock-assets/nfts/ape-ivory.png',
  '/mock-assets/nfts/ape-golden.png',
] as const

function fieldValue(data: FormData, name: string): string {
  return String(data.get(name) ?? '').trim()
}

export function ProfilePage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const sessionKey = getSessionCacheKey() ?? 'anonymous'
  const profileQueryKey = ['profile', sessionKey] as const
  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: ({ signal }) => fetchProfile(signal),
    enabled: Boolean(auth.session),
  })
  const [avatarOverride, setAvatarOverride] = useState<
    string | null | undefined
  >(undefined)
  const [showPasswords, setShowPasswords] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    setSaving(true)
    setError('')
    setNotice('')
    setFieldErrors({})

    const data = new FormData(event.currentTarget)
    const passwordInput = {
      currentPassword: String(data.get('currentPassword') ?? ''),
      newPassword: String(data.get('newPassword') ?? ''),
      confirmPassword: String(data.get('confirmPassword') ?? ''),
    }
    const hasPasswordChange = Object.values(passwordInput).some(Boolean)
    if (
      hasPasswordChange &&
      Object.values(passwordInput).some((value) => value.length === 0)
    ) {
      const passwordErrors: Record<string, string> = {}
      if (!passwordInput.currentPassword) {
        passwordErrors.currentPassword = 'Informe a senha atual para alterá-la.'
      }
      if (!passwordInput.newPassword) {
        passwordErrors.newPassword = 'Informe a nova senha.'
      }
      if (!passwordInput.confirmPassword) {
        passwordErrors.confirmPassword = 'Confirme a nova senha.'
      }
      setFieldErrors(passwordErrors)
      setSaving(false)
      return
    }
    if (
      hasPasswordChange &&
      passwordInput.newPassword !== passwordInput.confirmPassword
    ) {
      setFieldErrors({ confirmPassword: 'As senhas não coincidem.' })
      setSaving(false)
      return
    }

    try {
      const input: UpdateProfileRequestDto = {
        displayName: fieldValue(data, 'displayName'),
        username: fieldValue(data, 'username'),
        email: fieldValue(data, 'email'),
        ensName: fieldValue(data, 'ensName'),
        ensDomain: fieldValue(data, 'ensDomain'),
        walletNickname: fieldValue(data, 'walletNickname'),
        avatarUrl:
          avatarOverride !== undefined
            ? avatarOverride
            : profileQuery.data?.avatarUrl ?? null,
      }
      const updatedProfile = await updateProfile(input)
      setAvatarOverride(updatedProfile.avatarUrl)
      queryClient.setQueryData<UserProfileDto>(profileQueryKey, updatedProfile)
      queryClient.setQueryData<AuthSessionResponseDto>(
        ['auth', 'session'],
        (current) =>
          current?.session
            ? {
                ...current,
                session: {
                  ...current.session,
                  user: updatedProfile,
                },
              }
            : current,
      )
      if (hasPasswordChange) {
        await updatePassword(passwordInput)
      }
      setNotice(
        hasPasswordChange
          ? 'Perfil e senha atualizados com sucesso.'
          : 'Perfil atualizado com sucesso.',
      )
      formElement.reset()
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        setError(requestError.message)
        setFieldErrors(requestError.fieldErrors ?? {})
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível salvar as alterações.',
        )
      }
    } finally {
      setSaving(false)
    }
  }

  if (profileQuery.isLoading) {
    return (
      <AccountSidebarLayout active="profile">
        <div aria-busy="true" className="space-y-4">
          <div className="skeleton-shimmer h-8 w-56 rounded" />
          <div className="skeleton-shimmer h-64 rounded-xl" />
        </div>
      </AccountSidebarLayout>
    )
  }
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <AccountSidebarLayout active="profile">
        <p role="alert" className="rounded-lg border border-kurio-danger/40 p-4 text-sm text-kurio-danger">
          {profileQuery.error instanceof Error
            ? profileQuery.error.message
            : 'Não foi possível carregar seu perfil.'}
        </p>
      </AccountSidebarLayout>
    )
  }

  const profile = profileQuery.data
  const avatarUrl =
    avatarOverride !== undefined ? avatarOverride : profile.avatarUrl
  const inputClass =
    'mt-2 h-11 w-full rounded-lg border border-kurio-border bg-kurio-bg px-3 text-sm text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber'
  const labelClass = 'block text-xs font-semibold text-kurio-text'

  return (
    <AccountSidebarLayout active="profile">
      <form
        key={profile.id}
        onSubmit={(event) => void onSubmit(event)}
        className="rounded-xl border border-kurio-border bg-kurio-surface p-4 sm:p-6 lg:p-8"
      >
        <div className="border-b border-kurio-border pb-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-kurio-amber">
            Conta
          </p>
          <h2 className="mt-2 text-xl font-bold">Dados do perfil</h2>
          <p className="mt-2 text-xs leading-5 text-kurio-text-muted">
            Gerencie as informações públicas da sua conta de colecionador.
          </p>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className={labelClass}>
            Nome de exibição *
            <input
              name="displayName"
              required
              minLength={2}
              defaultValue={profile.displayName}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.displayName)}
              aria-describedby={fieldErrors.displayName ? 'displayName-error' : undefined}
            />
            {fieldErrors.displayName && (
              <span id="displayName-error" className="mt-1 block text-[10px] text-kurio-danger">
                {fieldErrors.displayName}
              </span>
            )}
          </label>
          <label className={labelClass}>
            Nome de usuário *
            <input
              name="username"
              required
              minLength={3}
              autoComplete="username"
              defaultValue={profile.username}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.username)}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
            />
            {fieldErrors.username && (
              <span id="username-error" className="mt-1 block text-[10px] text-kurio-danger">
                {fieldErrors.username}
              </span>
            )}
          </label>
          <label className={labelClass}>
            E-mail *
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={profile.email}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <span id="email-error" className="mt-1 block text-[10px] text-kurio-danger">
                {fieldErrors.email}
              </span>
            )}
          </label>
          <fieldset>
            <legend className={labelClass}>Nome ENS *</legend>
            <div className="mt-2 flex gap-2">
              <input
                name="ensName"
                required
                defaultValue={profile.ensName}
                aria-label="Nome ENS"
                className={`${inputClass} mt-0 min-w-0 flex-1`}
                aria-invalid={Boolean(fieldErrors.ensName)}
              />
              <select
                name="ensDomain"
                defaultValue={profile.ensDomain}
                aria-label="Domínio ENS"
                className="h-11 rounded-lg border border-kurio-border bg-kurio-bg px-2 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
              >
                <option value=".eth">.eth</option>
                <option value=".kurio">.kurio</option>
                <option value=".xyz">.xyz</option>
              </select>
            </div>
            {fieldErrors.ensName && (
              <span className="mt-1 block text-[10px] text-kurio-danger">
                {fieldErrors.ensName}
              </span>
            )}
            {fieldErrors.ensDomain && (
              <span className="mt-1 block text-[10px] text-kurio-danger">
                {fieldErrors.ensDomain}
              </span>
            )}
          </fieldset>
          <label className={labelClass}>
            Apelido da carteira *
            <input
              name="walletNickname"
              required
              defaultValue={profile.walletNickname}
              className={inputClass}
              aria-invalid={Boolean(fieldErrors.walletNickname)}
              aria-describedby={fieldErrors.walletNickname ? 'walletNickname-error' : undefined}
            />
            {fieldErrors.walletNickname && (
              <span id="walletNickname-error" className="mt-1 block text-[10px] text-kurio-danger">
                {fieldErrors.walletNickname}
              </span>
            )}
          </label>
          <div className="sm:col-span-2">
            <p className={labelClass}>Avatar</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-kurio-border bg-kurio-bg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Prévia do avatar" className="size-full object-cover" />
                ) : (
                  <UserRound size={28} aria-hidden="true" className="text-kurio-text-muted" />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="profile-avatar" className="sr-only">
                  Selecionar avatar
                </label>
                <select
                  id="profile-avatar"
                  value={avatarUrl ?? ''}
                  onChange={(event) =>
                    setAvatarOverride(event.target.value || null)
                  }
                  className="h-10 max-w-48 rounded-lg border border-kurio-border bg-kurio-bg px-3 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  <option value="">Avatar padrão</option>
                  {avatarChoices.map((choice, index) => (
                    <option key={choice} value={choice}>
                      Arte KURIO {index + 1}
                    </option>
                  ))}
                </select>
                <label htmlFor="profile-avatar-url" className="sr-only">
                  URL de avatar
                </label>
                <input
                  id="profile-avatar-url"
                  type="url"
                  value={avatarUrl?.startsWith('http') ? avatarUrl : ''}
                  onChange={(event) =>
                    setAvatarOverride(event.target.value || null)
                  }
                  placeholder="URL de imagem"
                  className="h-10 max-w-48 rounded-lg border border-kurio-border bg-kurio-bg px-3 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
                />
                <button
                  type="button"
                  onClick={() => {
                    const index = avatarChoices.findIndex(
                      (choice) => choice === avatarUrl,
                    )
                    setAvatarOverride(
                      avatarChoices[(index + 1) % avatarChoices.length],
                    )
                  }}
                  className="rounded-lg bg-kurio-amber px-4 py-2.5 text-xs font-bold text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  Alterar
                </button>
                <button
                  type="button"
                  onClick={() => setAvatarOverride(null)}
                  disabled={!avatarUrl}
                  className="rounded-lg border border-kurio-border px-4 py-2.5 text-xs text-kurio-text-muted hover:text-kurio-text disabled:opacity-50"
                >
                  Remover
                </button>
              </div>
            </div>
            {fieldErrors.avatarUrl && (
              <p role="alert" className="mt-2 text-[10px] text-kurio-danger">
                {fieldErrors.avatarUrl}
              </p>
            )}
            <p className="mt-2 text-[10px] text-kurio-text-muted">
              Escolha uma arte local de demonstração ou use o avatar padrão.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-kurio-border pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold">Alterar senha</h3>
              <p className="mt-1 text-[10px] text-kurio-text-muted">
                Deixe em branco para manter sua senha atual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasswords((visible) => !visible)}
              aria-label={showPasswords ? 'Ocultar senhas' : 'Mostrar senhas'}
              className="grid size-9 place-items-center rounded-lg border border-kurio-border text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ['currentPassword', 'Senha atual', 'current-password'],
              ['newPassword', 'Nova senha', 'new-password'],
              ['confirmPassword', 'Confirmar nova senha', 'new-password'],
            ].map(([name, label, autoComplete]) => (
              <label key={name} className={labelClass}>
                {label}
                <input
                  name={name}
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete={autoComplete}
                  minLength={name === 'newPassword' ? 8 : undefined}
                  className={inputClass}
                  aria-invalid={Boolean(fieldErrors[name])}
                  aria-describedby={fieldErrors[name] ? `${name}-error` : undefined}
                />
                {fieldErrors[name] && (
                  <span id={`${name}-error`} className="mt-1 block text-[10px] text-kurio-danger">
                    {fieldErrors[name]}
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-lg border border-kurio-danger/40 bg-kurio-danger/10 p-3 text-xs text-kurio-danger">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="mt-5 rounded-lg border border-kurio-success/40 bg-kurio-success/5 p-3 text-xs text-kurio-success">
            {notice}
          </p>
        )}
        <div className="mt-6 flex justify-end border-t border-kurio-border pt-5">
          <button
            type="submit"
            disabled={saving}
            className="min-h-11 min-w-32 rounded-lg bg-kurio-amber px-6 py-3 text-xs font-bold text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </AccountSidebarLayout>
  )
}
