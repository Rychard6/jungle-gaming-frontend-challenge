import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { Eye, EyeOff, X } from 'lucide-react'
import { ApiClientError } from '../../../shared/api/http'
import type { RegisterRequestDto } from '../../../shared/api/types'
import { useAuth } from '../hooks/auth-context'

type AuthMode = 'login' | 'register'

function safeRedirectPath(value: string | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null
  return value
}

export function AuthModalOrPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    redirect?: string
    expired?: boolean
  }
  const { login, register, notice, clearNotice } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const dialogRef = useRef<HTMLElement>(null)
  const isRegister = mode === 'register'
  const redirectPath = safeRedirectPath(search.redirect)

  useEffect(() => {
    dialogRef.current
      ?.querySelector<HTMLElement>('input')
      ?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        void navigate({
          to: '/',
          search: { tab: 'all', sort: 'recent', page: 1 },
        })
        return
      }
      if (event.key !== 'Tab') return

      const dialog = dialogRef.current
      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled])',
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate])

  const finishAuthentication = () => {
    clearNotice()
    if (redirectPath) {
      window.location.assign(redirectPath)
      return
    }
    void navigate({
      to: '/',
      search: { tab: 'all', sort: 'recent', page: 1 },
    })
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    setFieldErrors({})
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    try {
      if (isRegister) {
        const input: RegisterRequestDto = {
          username: String(formData.get('username') ?? '').trim(),
          email,
          password,
          confirmPassword: String(formData.get('confirmPassword') ?? ''),
        }
        await register(input)
      } else {
        await login({ email, password })
      }
      finishAuthentication()
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message)
        setFieldErrors(error.fieldErrors ?? {})
      } else {
        setFormError(
          error instanceof Error
            ? error.message
            : 'Não foi possível concluir a autenticação.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'mt-1.5 h-11 w-full rounded-lg border border-kurio-border bg-kurio-bg px-3 text-sm text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber'

  return (
    <main className="fixed inset-0 z-[60] grid overflow-y-auto bg-black/75 p-0 backdrop-blur-sm md:place-items-center md:p-6">
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="relative my-auto min-h-screen w-full border border-kurio-border bg-kurio-surface px-6 py-10 text-kurio-text md:min-h-0 md:max-w-md md:rounded-2xl md:px-9 md:py-8"
      >
        <button
          type="button"
          onClick={() =>
            void navigate({
              to: '/',
              search: { tab: 'all', sort: 'recent', page: 1 },
            })
          }
          aria-label="Fechar autenticação"
          className="absolute right-5 top-5 grid size-9 place-items-center rounded-full border border-kurio-border text-kurio-text-muted hover:text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
        >
          <X size={17} aria-hidden="true" />
        </button>
        <p className="text-center text-xl font-bold tracking-tight">
          KURIO<span className="text-kurio-amber">.</span>
        </p>
        <div className="mt-7 grid grid-cols-2 border-b border-kurio-border text-center text-sm">
          <Link
            to="/login"
            search={(previous) => ({
              redirect: previous.redirect,
              expired: previous.expired,
            })}
            aria-current={!isRegister ? 'page' : undefined}
            className={`border-b-2 pb-3 ${!isRegister ? 'border-kurio-amber font-bold text-kurio-amber' : 'border-transparent text-kurio-text-muted'}`}
          >
            Entrar
          </Link>
          <Link
            to="/register"
            search={(previous) => ({
              redirect: previous.redirect,
              expired: previous.expired,
            })}
            aria-current={isRegister ? 'page' : undefined}
            className={`border-b-2 pb-3 ${isRegister ? 'border-kurio-amber font-bold text-kurio-amber' : 'border-transparent text-kurio-text-muted'}`}
          >
            Criar conta
          </Link>
        </div>
        <h1 id="auth-title" className="mt-7 text-center text-2xl font-bold">
          {isRegister ? 'Crie seu perfil' : 'Bem-vindo de volta'}
        </h1>
        <p className="mt-2 text-center text-xs text-kurio-text-muted">
          {isRegister
            ? 'Faça parte da comunidade de colecionadores KURIO.'
            : 'Entre para continuar sua jornada de colecionador.'}
        </p>
        {(notice || (search.expired && !notice)) && (
          <p role="alert" className="mt-5 rounded-lg border border-kurio-amber/40 bg-kurio-amber/10 p-3 text-xs text-kurio-amber">
            {notice || 'Sua sessão expirou. Faça login novamente para continuar.'}
          </p>
        )}
        <form onSubmit={(event) => void onSubmit(event)} className="mt-6 space-y-4">
          {isRegister && (
            <div>
              <label htmlFor="auth-username" className="text-xs font-medium">
                Nome de usuário
              </label>
              <input
                id="auth-username"
                name="username"
                autoComplete="username"
                autoFocus={isRegister}
                required
                minLength={3}
                aria-invalid={fieldErrors.username ? true : undefined}
                aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                className={inputClass}
              />
              {fieldErrors.username && (
                <p id="username-error" className="mt-1 text-xs text-kurio-danger">
                  {fieldErrors.username}
                </p>
              )}
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="text-xs font-medium">
              E-mail
            </label>
            <input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus={!isRegister}
              required
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={inputClass}
            />
            {fieldErrors.email && (
              <p id="email-error" className="mt-1 text-xs text-kurio-danger">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="auth-password" className="text-xs font-medium">
              Senha
            </label>
            <div className="relative">
              <input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={isRegister ? 8 : undefined}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="mt-1 text-xs text-kurio-danger">
                {fieldErrors.password}
              </p>
            )}
          </div>
          {isRegister && (
            <div>
              <label htmlFor="auth-confirm-password" className="text-xs font-medium">
                Confirmar senha
              </label>
              <input
                id="auth-confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                aria-describedby={fieldErrors.confirmPassword ? 'confirm-password-error' : undefined}
                className={inputClass}
              />
              {fieldErrors.confirmPassword && (
                <p id="confirm-password-error" className="mt-1 text-xs text-kurio-danger">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          )}
          {formError && (
            <p role="alert" className="rounded-lg border border-kurio-danger/40 bg-kurio-danger/10 p-3 text-xs text-kurio-danger">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-lg bg-kurio-amber text-sm font-bold text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:opacity-60"
          >
            {submitting
              ? 'Aguarde...'
              : isRegister
                ? 'Criar perfil'
                : 'Entrar'}
          </button>
        </form>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setFormError('A autenticação Google ficará disponível em uma próxima etapa.')}
            className="rounded-lg border border-kurio-border px-3 py-3 text-xs text-kurio-text hover:border-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
          >
            Continuar com Google
          </button>
          <button
            type="button"
            onClick={() => setFormError('A autenticação Facebook ficará disponível em uma próxima etapa.')}
            className="rounded-lg border border-kurio-border px-3 py-3 text-xs text-kurio-text hover:border-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
          >
            Continuar com Facebook
          </button>
        </div>
        <p className="mt-6 text-center text-xs text-kurio-text-muted">
          {isRegister ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
          <Link
            to={isRegister ? '/login' : '/register'}
            search={{
              ...(redirectPath ? { redirect: redirectPath } : {}),
              ...(search.expired ? { expired: true } : {}),
            }}
            className="font-semibold text-kurio-amber underline-offset-4 hover:underline"
          >
            {isRegister ? 'Entrar' : 'Criar perfil'}
          </Link>
        </p>
      </section>
    </main>
  )
}
