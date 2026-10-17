import { useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useRouter, useSearch } from '@tanstack/react-router'
import { Eye, EyeOff, X } from 'lucide-react'
import { ApiClientError } from '../../../shared/api/http'
import type { RegisterRequestDto } from '../../../shared/api/types'
import {
  validateLogin,
  validateRegistration,
  type FieldErrors,
} from '../../../shared/lib/validation'
import { useDocumentTitle } from '../../../shared/lib/use-document-title'
import { Button } from '../../../shared/ui/button'
import { Dialog } from '../../../shared/ui/dialog'
import { Input } from '../../../shared/ui/input'
import { Label } from '../../../shared/ui/label'
import { useAuth } from '../hooks/auth-context'
import { safeRedirectPath } from '../lib/safe-redirect'

type AuthMode = 'login' | 'register'

const HOME_SEARCH = { tab: 'all', sort: 'recent', page: 1 } as const

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '')
}

export function AuthModalOrPage({ mode }: { mode: AuthMode }) {
  const navigate = useNavigate()
  const router = useRouter()
  const { redirect, expired } = useSearch({ strict: false })
  const { login, register, notice, clearNotice } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [info, setInfo] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const isRegister = mode === 'register'
  const redirectPath = safeRedirectPath(redirect)
  useDocumentTitle(isRegister ? 'Criar conta — KURIO' : 'Entrar — KURIO')

  // Volta para onde o usuário estava (ex.: carrinho); sem histórico interno, vai ao catálogo.
  const closeAuth = () => {
    if (router.history.canGoBack()) {
      router.history.back()
      return
    }
    void navigate({ to: '/', search: HOME_SEARCH })
  }

  const finishAuthentication = () => {
    clearNotice()
    if (redirectPath) {
      router.history.push(redirectPath)
      return
    }
    void navigate({ to: '/', search: HOME_SEARCH })
  }

  const focusFirstInvalidField = (errors: FieldErrors) => {
    const firstInvalid = ['username', 'email', 'password', 'confirmPassword']
      .find((name) => errors[name])
    if (!firstInvalid) return
    formRef.current
      ?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)
      ?.focus()
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    setInfo('')
    const formData = new FormData(event.currentTarget)
    const email = field(formData, 'email').trim()
    const password = field(formData, 'password')
    const registration: RegisterRequestDto = {
      username: field(formData, 'username').trim(),
      email,
      password,
      confirmPassword: field(formData, 'confirmPassword'),
    }

    const clientErrors = isRegister
      ? validateRegistration(registration)
      : validateLogin({ email, password })
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) {
      focusFirstInvalidField(clientErrors)
      return
    }

    setSubmitting(true)
    try {
      if (isRegister) {
        await register(registration)
      } else {
        await login({ email, password })
      }
      finishAuthentication()
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message)
        setFieldErrors(error.fieldErrors ?? {})
        focusFirstInvalidField(error.fieldErrors ?? {})
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

  const errorId = (name: string) => `auth-${name}-error`
  const describe = (name: string) =>
    fieldErrors[name] ? errorId(name) : undefined
  const renderFieldError = (name: string) =>
    fieldErrors[name] ? (
      <p id={errorId(name)} className="mt-1 text-xs text-kurio-danger">
        {fieldErrors[name]}
      </p>
    ) : null

  return (
    <main>
      <Dialog
        open
        onClose={closeAuth}
        labelledBy="auth-title"
        initialFocusSelector="input"
        closeOnBackdropClick={false}
        overlayClassName="grid overflow-y-auto bg-black/75 p-0 backdrop-blur-sm md:place-items-center md:p-6"
        className="relative my-auto min-h-screen w-full border border-kurio-border bg-kurio-surface px-6 py-10 text-kurio-text md:min-h-0 md:max-w-md md:rounded-2xl md:px-9 md:py-8"
      >
        <button
          type="button"
          onClick={closeAuth}
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
            replace
            search={(previous) => ({
              redirect: previous.redirect,
              expired: previous.expired,
            })}
            aria-current={!isRegister ? 'page' : undefined}
            className={`border-b-2 pb-3 focus-visible:outline-2 focus-visible:outline-kurio-amber ${!isRegister ? 'border-kurio-amber font-bold text-kurio-amber' : 'border-transparent text-kurio-text-muted'}`}
          >
            Entrar
          </Link>
          <Link
            to="/register"
            replace
            search={(previous) => ({
              redirect: previous.redirect,
              expired: previous.expired,
            })}
            aria-current={isRegister ? 'page' : undefined}
            className={`border-b-2 pb-3 focus-visible:outline-2 focus-visible:outline-kurio-amber ${isRegister ? 'border-kurio-amber font-bold text-kurio-amber' : 'border-transparent text-kurio-text-muted'}`}
          >
            Criar conta
          </Link>
        </div>
        <h1 id="auth-title" className="mt-7 text-center text-2xl font-bold">
          {isRegister ? 'Crie seu perfil' : 'Bem-vindo de volta'}
        </h1>
        <p className="mt-2 text-center text-xs text-kurio-text-muted">
          {isRegister
            ? 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'
            : 'Entre para gerenciar sua carteira, coleção e perfil de criador.'}
        </p>
        {(notice || expired) && (
          <p role="alert" className="mt-5 rounded-lg border border-kurio-amber/40 bg-kurio-amber/10 p-3 text-xs text-kurio-amber">
            {notice || 'Sua sessão expirou. Faça login novamente para continuar.'}
          </p>
        )}
        <form
          ref={formRef}
          onSubmit={(event) => void onSubmit(event)}
          noValidate
          className="mt-6 space-y-4"
        >
          {isRegister && (
            <div>
              <Label htmlFor="auth-username">Nome de usuário</Label>
              <Input
                id="auth-username"
                name="username"
                autoComplete="username"
                placeholder="Nome de usuário"
                aria-invalid={fieldErrors.username ? true : undefined}
                aria-describedby={describe('username')}
                className="mt-1.5"
              />
              {renderFieldError('username')}
            </div>
          )}
          <div>
            <Label htmlFor="auth-email">E-mail</Label>
            <Input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder={isRegister ? 'Digite seu e-mail...' : 'contato@email.com'}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={describe('email')}
              className="mt-1.5"
            />
            {renderFieldError('email')}
          </div>
          <div>
            <Label htmlFor="auth-password">Senha</Label>
            <div className="relative">
              <Input
                id="auth-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? 'Senha' : undefined}
                aria-invalid={fieldErrors.password ? true : undefined}
                aria-describedby={describe('password')}
                className="mt-1.5 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 mt-0.5 grid size-8 -translate-y-1/2 place-items-center rounded text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
              >
                {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
              </button>
            </div>
            {renderFieldError('password')}
          </div>
          {isRegister && (
            <div>
              <Label htmlFor="auth-confirm-password">Confirmar senha</Label>
              <Input
                id="auth-confirm-password"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Confirmar senha"
                aria-invalid={fieldErrors.confirmPassword ? true : undefined}
                aria-describedby={describe('confirmPassword')}
                className="mt-1.5"
              />
              {renderFieldError('confirmPassword')}
            </div>
          )}
          {!isRegister && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => setInfo('A recuperação de senha não faz parte desta demonstração.')}
                className="text-xs text-kurio-amber underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-kurio-amber"
              >
                Esqueceu a senha?
              </button>
            </div>
          )}
          {formError && (
            <p role="alert" className="rounded-lg border border-kurio-danger/40 bg-kurio-danger/10 p-3 text-xs text-kurio-danger">
              {formError}
            </p>
          )}
          <Button type="submit" size="lg" disabled={submitting} className="h-12 w-full">
            {submitting
              ? 'Aguarde...'
              : isRegister
                ? 'Criar perfil'
                : 'Entrar'}
          </Button>
        </form>
        <p className="mt-6 text-center text-[10px] uppercase tracking-wider text-kurio-text-muted">
          Ou continue com
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Button
            variant="secondary"
            onClick={() => setInfo('O login com Google não faz parte desta demonstração.')}
            className="py-3 font-normal"
          >
            Continuar com Google
          </Button>
          <Button
            variant="secondary"
            onClick={() => setInfo('O login com Facebook não faz parte desta demonstração.')}
            className="py-3 font-normal"
          >
            Continuar com Facebook
          </Button>
        </div>
        {info && (
          <p role="status" className="mt-3 text-center text-xs text-kurio-text-muted">
            {info}
          </p>
        )}
        <p className="mt-6 text-center text-xs text-kurio-text-muted">
          {isRegister ? 'Já tem uma conta?' : 'Ainda não tem uma conta?'}{' '}
          <Link
            to={isRegister ? '/login' : '/register'}
            replace
            search={{
              ...(redirectPath ? { redirect: redirectPath } : {}),
              ...(expired ? { expired: true } : {}),
            }}
            className="font-semibold text-kurio-amber underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-kurio-amber"
          >
            {isRegister ? 'Entrar' : 'Criar perfil'}
          </Link>
        </p>
      </Dialog>
    </main>
  )
}
