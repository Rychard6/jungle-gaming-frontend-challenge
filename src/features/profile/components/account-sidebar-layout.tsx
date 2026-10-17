import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  CircleHelp,
  Heart,
  History,
  LogOut,
  Tag,
  UserRound,
  WalletCards,
} from 'lucide-react'
import { useAuth } from '../../auth/hooks/auth-context'

const auxiliaryItems = [
  { label: 'Atividade', icon: History },
  { label: 'Lista de interesse', icon: Heart },
  { label: 'Ofertas', icon: Tag },
  { label: 'Arquivos baixados', icon: Archive },
  { label: 'Suporte', icon: CircleHelp },
] as const

const outOfScopeNotice = (label: string) =>
  `${label} não faz parte do escopo desta demonstração.`

export function AccountSidebarLayout({
  active,
  children,
}: {
  active: 'profile' | 'wallets'
  children: ReactNode
}) {
  const auth = useAuth()
  const navigate = useNavigate()
  const [notice, setNotice] = useState('')
  const [logoutError, setLogoutError] = useState('')

  const signOut = async () => {
    setLogoutError('')
    try {
      await auth.logout()
      await navigate({ to: '/login' })
    } catch (error) {
      setLogoutError(
        error instanceof Error
          ? error.message
          : 'Não foi possível encerrar a sessão.',
      )
    }
  }

  const menuLinkClass = (isActive: boolean) =>
    `flex min-h-11 items-center gap-3 border-l-2 px-4 text-left text-xs transition-colors ${
      isActive
        ? 'border-kurio-amber bg-kurio-amber/10 font-semibold text-kurio-amber'
        : 'border-transparent text-kurio-text-muted hover:bg-kurio-bg hover:text-kurio-text'
    }`

  return (
    <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-7 sm:px-8 sm:py-10">
      <p className="text-[10px] uppercase tracking-[0.22em] text-kurio-amber">
        Área do colecionador
      </p>
      <h1 className="mt-2 text-2xl font-bold text-kurio-text sm:text-3xl">
        Meu perfil
      </h1>

      <div className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8">
        <nav
          aria-label="Navegação da conta"
          className="rounded-xl border border-kurio-border bg-kurio-surface p-2 lg:self-start"
        >
          <p className="px-4 py-3 text-xs font-bold text-kurio-text">
            Meu perfil
          </p>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:block lg:overflow-visible">
            <Link
              to="/profile"
              aria-current={active === 'profile' ? 'page' : undefined}
              className={`${menuLinkClass(active === 'profile')} shrink-0 rounded-r-md lg:w-full`}
            >
              <UserRound size={16} aria-hidden="true" />
              Dados do perfil
            </Link>
            <Link
              to="/wallets"
              aria-current={active === 'wallets' ? 'page' : undefined}
              className={`${menuLinkClass(active === 'wallets')} shrink-0 rounded-r-md lg:w-full`}
            >
              <WalletCards size={16} aria-hidden="true" />
              Carteiras
            </Link>
            <div className="hidden lg:block">
              {auxiliaryItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setNotice(outOfScopeNotice(label))}
                  className={`${menuLinkClass(false)} w-full`}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1 flex gap-1 overflow-x-auto pb-1 lg:hidden">
            {auxiliaryItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                onClick={() => setNotice(outOfScopeNotice(label))}
                className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-md border border-kurio-border px-3 text-[10px] text-kurio-text-muted"
              >
                <Icon size={13} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div className="mt-2 hidden border-t border-kurio-border pt-2 lg:block">
            <button
              type="button"
              onClick={() => void signOut()}
              className={`${menuLinkClass(false)} w-full`}
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </div>
          <div className="mt-2 flex gap-1 border-t border-kurio-border pt-2 lg:hidden">
            <button
              type="button"
              onClick={() => void signOut()}
              className={`${menuLinkClass(false)} min-w-0 flex-1 justify-center rounded-md px-2`}
            >
              <LogOut size={16} aria-hidden="true" />
              Sair
            </button>
          </div>
        </nav>

        <section className="min-w-0">
          {notice && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-kurio-amber/40 bg-kurio-amber/10 px-4 py-3 text-xs text-kurio-amber"
            >
              <div className="flex items-start justify-between gap-3">
                <p>{notice}</p>
                <button
                  type="button"
                  onClick={() => setNotice('')}
                  aria-label="Fechar aviso"
                  className="shrink-0 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
          {logoutError && (
            <p role="alert" className="mb-4 text-xs text-kurio-danger">
              {logoutError}
            </p>
          )}
          {children}
        </section>
      </div>
    </main>
  )
}
