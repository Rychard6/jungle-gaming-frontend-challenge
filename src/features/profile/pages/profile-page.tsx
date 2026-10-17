import { useRef, useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, UserRound } from 'lucide-react'
import { ApiClientError, getSessionCacheKey } from '../../../shared/api/http'
import { useSessionKey } from '../../../shared/api/use-session-key'
import type {
  AuthSessionResponseDto,
  UpdateProfileRequestDto,
  UserProfileDto,
} from '../../../shared/api/types'
import { useDocumentTitle } from '../../../shared/lib/use-document-title'
import {
  ENS_DOMAINS,
  validatePasswordChange,
  validateProfile,
  type FieldErrors,
} from '../../../shared/lib/validation'
import { Button } from '../../../shared/ui/button'
import { Skeleton } from '../../../shared/ui/skeleton'
import { useAuth } from '../../auth/hooks/auth-context'
import {
  resizeAvatarToDataUrl,
  validateAvatarFile,
} from '../lib/avatar'
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

const PROFILE_FIELD_ORDER = [
  'displayName',
  'username',
  'email',
  'ensName',
  'walletNickname',
  'currentPassword',
  'newPassword',
  'confirmPassword',
] as const

const inputClass =
  'mt-2 h-11 w-full rounded-lg border border-kurio-border bg-kurio-bg px-3 text-sm text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber aria-invalid:border-kurio-danger'
const labelClass = 'block text-xs font-semibold text-kurio-text'

function fieldValue(data: FormData, name: string): string {
  return String(data.get(name) ?? '').trim()
}

export function ProfilePage() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const sessionKey = useSessionKey()
  const profileQueryKey = ['profile', sessionKey] as const
  useDocumentTitle('Perfil do colecionador — KURIO')
  const profileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: ({ signal }) => fetchProfile(signal),
    enabled: Boolean(auth.session),
  })
  const [avatarOverride, setAvatarOverride] = useState<
    string | null | undefined
  >(undefined)
  const [avatarError, setAvatarError] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const focusFirstInvalid = (errors: FieldErrors) => {
    const firstInvalid = PROFILE_FIELD_ORDER.find((name) => errors[name])
    if (firstInvalid) {
      formRef.current
        ?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
        ?.focus()
    }
  }

  const chooseAvatarFile = async (file: File | undefined) => {
    if (!file) return
    const problem = validateAvatarFile(file)
    if (problem) {
      setAvatarError(problem)
      return
    }
    try {
      setAvatarOverride(await resizeAvatarToDataUrl(file))
      setAvatarError('')
    } catch (cause) {
      setAvatarError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível processar a imagem escolhida.',
      )
    }
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    setError('')
    setNotice('')

    const data = new FormData(formElement)
    const profileValues = {
      displayName: fieldValue(data, 'displayName'),
      username: fieldValue(data, 'username'),
      email: fieldValue(data, 'email'),
      ensName: fieldValue(data, 'ensName'),
      ensDomain: fieldValue(data, 'ensDomain'),
      walletNickname: fieldValue(data, 'walletNickname'),
    }
    const passwordInput = {
      currentPassword: String(data.get('currentPassword') ?? ''),
      newPassword: String(data.get('newPassword') ?? ''),
      confirmPassword: String(data.get('confirmPassword') ?? ''),
    }
    const hasPasswordChange = Object.values(passwordInput).some(Boolean)
    const clientErrors = {
      ...validateProfile(profileValues),
      ...(hasPasswordChange ? validatePasswordChange(passwordInput) : {}),
    }
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) {
      focusFirstInvalid(clientErrors)
      return
    }

    setSaving(true)
    let updatedProfile: UserProfileDto
    try {
      const input: UpdateProfileRequestDto = {
        ...profileValues,
        avatarUrl:
          avatarOverride !== undefined
            ? avatarOverride
            : profileQuery.data?.avatarUrl ?? null,
      }
      updatedProfile = await updateProfile(input)
    } catch (requestError) {
      if (requestError instanceof ApiClientError) {
        setError(requestError.message)
        setFieldErrors(requestError.fieldErrors ?? {})
        focusFirstInvalid(requestError.fieldErrors ?? {})
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível salvar as alterações.',
        )
      }
      setSaving(false)
      return
    }

    if (getSessionCacheKey() !== sessionKey) return
    setAvatarOverride(updatedProfile.avatarUrl)
    queryClient.setQueryData<UserProfileDto>(profileQueryKey, updatedProfile)
    queryClient.setQueryData<AuthSessionResponseDto>(
      ['auth', 'session'],
      (current) =>
        current?.session?.user.id === updatedProfile.id
          ? { ...current, session: { ...current.session, user: updatedProfile } }
          : current,
    )
    void queryClient.invalidateQueries({ queryKey: ['wallets', sessionKey] })

    // O perfil já foi salvo: um erro de senha é informado sem desfazer nem esconder esse sucesso.
    if (hasPasswordChange) {
      try {
        await updatePassword(passwordInput)
        setNotice('Perfil e senha atualizados com sucesso.')
        formElement.reset()
      } catch (requestError) {
        setNotice('Perfil atualizado. A senha não foi alterada.')
        if (requestError instanceof ApiClientError) {
          setError(requestError.message)
          setFieldErrors(requestError.fieldErrors ?? {})
          focusFirstInvalid(requestError.fieldErrors ?? {})
        } else {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Não foi possível alterar a senha.',
          )
        }
      }
    } else {
      setNotice('Perfil atualizado com sucesso.')
      formElement.reset()
    }
    setSaving(false)
  }

  if (profileQuery.isLoading) {
    return (
      <AccountSidebarLayout active="profile">
        <div aria-busy="true" className="space-y-4">
          <span className="sr-only">Carregando perfil…</span>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-64 rounded-xl" />
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
  const isUploadedAvatar = avatarUrl?.startsWith('data:') ?? false

  const renderError = (name: string) =>
    fieldErrors[name] ? (
      <p id={`profile-${name}-error`} className="mt-1 text-[10px] text-kurio-danger">
        {fieldErrors[name]}
      </p>
    ) : null
  const describe = (name: string) =>
    fieldErrors[name] ? `profile-${name}-error` : undefined

  return (
    <AccountSidebarLayout active="profile">
      <form
        ref={formRef}
        key={profile.id}
        onSubmit={(event) => void onSubmit(event)}
        noValidate
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
          <div>
            <label htmlFor="profile-displayName" className={labelClass}>Nome de exibição *</label>
            <input
              id="profile-displayName"
              name="displayName"
              defaultValue={profile.displayName}
              className={inputClass}
              aria-invalid={fieldErrors.displayName ? true : undefined}
              aria-describedby={describe('displayName')}
            />
            {renderError('displayName')}
          </div>
          <div>
            <label htmlFor="profile-username" className={labelClass}>Nome de usuário *</label>
            <input
              id="profile-username"
              name="username"
              autoComplete="username"
              defaultValue={profile.username}
              className={inputClass}
              aria-invalid={fieldErrors.username ? true : undefined}
              aria-describedby={describe('username')}
            />
            {renderError('username')}
          </div>
          <div>
            <label htmlFor="profile-email" className={labelClass}>E-mail *</label>
            <input
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={profile.email}
              className={inputClass}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={describe('email')}
            />
            {renderError('email')}
          </div>
          <fieldset>
            <legend className={labelClass}>Nome ENS *</legend>
            <div className="mt-2 flex gap-2">
              <select
                name="ensDomain"
                defaultValue={profile.ensDomain}
                aria-label="Domínio ENS"
                className="h-11 rounded-lg border border-kurio-border bg-kurio-bg px-2 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
              >
                {ENS_DOMAINS.map((domain) => (
                  <option key={domain} value={domain}>{domain}</option>
                ))}
              </select>
              <input
                name="ensName"
                defaultValue={profile.ensName}
                aria-label="Nome ENS"
                className={`${inputClass} mt-0 min-w-0 flex-1`}
                aria-invalid={fieldErrors.ensName ? true : undefined}
                aria-describedby={describe('ensName')}
              />
            </div>
            {renderError('ensName')}
            {fieldErrors.ensDomain && (
              <p className="mt-1 text-[10px] text-kurio-danger">{fieldErrors.ensDomain}</p>
            )}
          </fieldset>
          <div>
            <label htmlFor="profile-walletNickname" className={labelClass}>Apelido da carteira *</label>
            <input
              id="profile-walletNickname"
              name="walletNickname"
              defaultValue={profile.walletNickname}
              className={inputClass}
              aria-invalid={fieldErrors.walletNickname ? true : undefined}
              aria-describedby={describe('walletNickname')}
            />
            {renderError('walletNickname')}
          </div>
          <div className="sm:col-span-2">
            <p className={labelClass}>Avatar</p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-kurio-border bg-kurio-bg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Prévia do avatar" width={80} height={80} className="size-full object-cover" />
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
                  onChange={(event) => {
                    setAvatarError('')
                    setAvatarOverride(event.target.value || null)
                  }}
                  className="h-10 max-w-48 rounded-lg border border-kurio-border bg-kurio-bg px-3 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  <option value="">Avatar padrão</option>
                  {avatarChoices.map((choice, index) => (
                    <option key={choice} value={choice}>
                      Arte KURIO {index + 1}
                    </option>
                  ))}
                  {isUploadedAvatar && avatarUrl && (
                    <option value={avatarUrl}>Imagem enviada</option>
                  )}
                </select>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Enviar imagem de avatar"
                  className="sr-only"
                  tabIndex={-1}
                  onChange={(event) => {
                    void chooseAvatarFile(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
                <Button onClick={() => fileInputRef.current?.click()} className="h-10">
                  Alterar
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setAvatarError('')
                    setAvatarOverride(null)
                  }}
                  disabled={!avatarUrl}
                  className="h-10 font-normal"
                >
                  Remover
                </Button>
              </div>
            </div>
            <p aria-live="polite" className="mt-2 min-h-4 text-[10px] text-kurio-danger">
              {avatarError || fieldErrors.avatarUrl}
            </p>
            <p className="text-[10px] text-kurio-text-muted">
              Envie uma imagem PNG, JPEG ou WebP (até 5 MB; ela é recortada e reduzida)
              ou escolha uma das artes KURIO.
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
              {showPasswords ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {([
              ['currentPassword', 'Senha atual', 'current-password'],
              ['newPassword', 'Nova senha', 'new-password'],
              ['confirmPassword', 'Confirmar nova senha', 'new-password'],
            ] as const).map(([name, label, autoComplete]) => (
              <div key={name}>
                <label htmlFor={`profile-${name}`} className={labelClass}>{label}</label>
                <input
                  id={`profile-${name}`}
                  name={name}
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete={autoComplete}
                  className={inputClass}
                  aria-invalid={fieldErrors[name] ? true : undefined}
                  aria-describedby={describe(name)}
                />
                {renderError(name)}
              </div>
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
          <Button
            type="submit"
            size="lg"
            disabled={saving}
            className="min-h-11 min-w-32 rounded-lg px-6 py-3 text-xs"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </AccountSidebarLayout>
  )
}
