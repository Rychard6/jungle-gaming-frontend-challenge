import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  Compass,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react'
import { ScenarioDevToolbar } from './scenario-dev-toolbar'
import { useCart } from '../../../features/cart/hooks/use-cart'
import { useAuth } from '../../../features/auth/hooks/auth-context'

function getCollectorInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase()
}

function EditorialAction({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  )
}

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const cart = useCart()
  const auth = useAuth()
  const cartCount =
    cart.cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const locationSearch = useRouterState({
    select: (state) => state.location.searchStr,
  })

  const search = new URLSearchParams(locationSearch).get('q') ?? ''

  const showDemoNotice = (section: string) => {
    setNotice(`${section} é uma seção demonstrativa e estará disponível em uma próxima fase.`)
    window.setTimeout(() => setNotice(''), 5000)
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void navigate({
      to: '/',
      search: (previous) => ({
        ...previous,
        tab: previous.tab ?? 'all',
        sort: previous.sort ?? 'recent',
        q: search.trim() || undefined,
        page: 1,
      }),
    })
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-kurio-bg pb-20 text-kurio-text md:pb-0">
      <header className="sticky top-0 z-40 border-b border-kurio-border bg-kurio-bg/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-6 px-4 sm:px-8">
          <Link
            to="/"
            search={{ tab: 'all', sort: 'recent', page: 1 }}
            className="shrink-0 text-xl font-bold tracking-tight text-kurio-text sm:text-2xl"
          >
            KURIO<span className="text-kurio-amber">.</span>
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-5 xl:flex">
            <Link to="/" search={{ tab: 'all', sort: 'recent', page: 1 }} className="text-xs text-kurio-text hover:text-kurio-amber">Início</Link>
            <a href="#catalogo" className="text-xs text-kurio-text-muted hover:text-kurio-amber">Mercado</a>
            <EditorialAction onClick={() => showDemoNotice('Criadores')} className="text-xs text-kurio-text-muted hover:text-kurio-amber">Criadores</EditorialAction>
            <EditorialAction onClick={() => showDemoNotice('Aprenda')} className="text-xs text-kurio-text-muted hover:text-kurio-amber">Aprenda</EditorialAction>
          </nav>

          <form onSubmit={submitSearch} className="relative ml-auto hidden min-w-48 max-w-sm flex-1 lg:block">
            <label htmlFor="header-search" className="sr-only">Buscar NFTs</label>
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-kurio-text-muted" />
            <input
              id="header-search"
              value={search}
              onChange={(event) =>
                void navigate({
                  to: '/',
                  search: (previous) => ({
                    ...previous,
                    tab: previous.tab ?? 'all',
                    sort: previous.sort ?? 'recent',
                    q: event.target.value || undefined,
                    page: 1,
                  }),
                })
              }
              placeholder="Buscar NFTs, coleções..."
              className="h-10 w-full rounded-md border border-kurio-border bg-kurio-surface pl-9 pr-3 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
            />
          </form>

          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <Link
              to="/cart"
              aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'edição' : 'edições'}`}
              className="relative grid size-10 place-items-center rounded-full border border-kurio-border text-kurio-text hover:border-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              <ShoppingBag size={18} aria-hidden="true" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-kurio-amber text-[9px] font-bold text-kurio-bg">
                  {cartCount}
                </span>
              )}
            </Link>
            {auth.session ? (
              <div className="hidden items-center gap-3 sm:flex">
                <Link
                  to="/profile"
                  aria-label={`Perfil de ${auth.session.user.displayName}`}
                  className="flex max-w-44 items-center gap-2 truncate text-xs font-semibold text-kurio-text hover:text-kurio-amber"
                >
                  {auth.session.user.avatarUrl ? (
                    <img
                      src={auth.session.user.avatarUrl}
                      alt=""
                      className="size-8 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="grid size-8 shrink-0 place-items-center rounded-full border border-kurio-amber/50 bg-kurio-amber/10 text-[10px] font-bold text-kurio-amber"
                    >
                      {getCollectorInitials(auth.session.user.displayName)}
                    </span>
                  )}
                  <span className="truncate">{auth.session.user.displayName}</span>
                </Link>
                <Link
                  to="/wallets"
                  className="text-xs text-kurio-text-muted hover:text-kurio-amber"
                >
                  Carteiras
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void auth.logout().catch((error: unknown) => {
                      setNotice(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.')
                    })
                  }}
                  className="rounded-md border border-kurio-border px-3 py-2 text-xs text-kurio-text-muted hover:text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  Sair
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                className="hidden rounded-md bg-kurio-amber px-4 py-2.5 text-xs font-bold text-kurio-bg hover:bg-kurio-amber-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber sm:inline-flex"
              >
                Entrar
              </Link>
            )}
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="grid size-10 place-items-center rounded-md border border-kurio-border text-kurio-text xl:hidden"
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav aria-label="Menu móvel" className="space-y-1 border-t border-kurio-border bg-kurio-surface px-5 py-4 xl:hidden">
            <a href="#catalogo" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-kurio-text">Mercado</a>
            <EditorialAction onClick={() => { setMobileMenuOpen(false); showDemoNotice('Criadores') }} className="block py-2 text-sm text-kurio-text">Criadores</EditorialAction>
            <EditorialAction onClick={() => { setMobileMenuOpen(false); showDemoNotice('Aprenda') }} className="block py-2 text-sm text-kurio-text">Aprenda</EditorialAction>
            {auth.session ? (
              <>
                <Link to="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 py-2 text-sm text-kurio-amber">
                  <span aria-hidden="true" className="grid size-7 place-items-center rounded-full border border-kurio-amber/50 bg-kurio-amber/10 text-[9px] font-bold">
                    {getCollectorInitials(auth.session.user.displayName)}
                  </span>
                  {auth.session.user.displayName}
                </Link>
                <Link to="/wallets" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-kurio-text">Carteiras</Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false)
                    void auth.logout().catch((error: unknown) => {
                      setNotice(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.')
                    })
                  }}
                  className="block py-2 text-sm text-kurio-text"
                >
                  Sair
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-kurio-amber">Entrar</Link>
            )}
          </nav>
        )}
      </header>

      {(notice || auth.notice) && (
        <p role="status" className="fixed left-1/2 top-20 z-50 w-[min(92vw,32rem)] -translate-x-1/2 rounded-lg border border-kurio-amber/50 bg-kurio-surface px-4 py-3 text-center text-xs text-kurio-text shadow-xl">
          {notice || auth.notice}
        </p>
      )}

      {children}

      <footer className="border-t border-kurio-border bg-kurio-surface">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-8 border-b border-kurio-border pb-10 md:grid-cols-2 xl:grid-cols-4">
            <FooterFeature
              mark="W"
              title="Segurança da carteira"
              detail="Sua carteira permanece sob seu controle."
            />
            <FooterFeature
              mark="C"
              title="Criadores em destaque"
              detail="Conheça artistas e coleções independentes."
            />
            <FooterFeature
              mark="D"
              title="Alertas de lançamentos"
              detail="Acompanhe novas peças e edições especiais."
            />
            <Newsletter />
          </div>

          <div className="grid gap-8 border-b border-kurio-border py-9 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-xl font-bold">KURIO<span className="text-kurio-amber">.</span></p>
              <p className="mt-2 text-xs text-kurio-text-muted">
                Feito para colecionadores, criadores e cultura
              </p>
            </div>
            <div className="space-y-2 text-xs text-kurio-text-muted md:text-right">
              <p><a href="mailto:contato@email.com" className="hover:text-kurio-amber">contato@email.com</a></p>
              <p><a href="tel:+551140028922" className="hover:text-kurio-amber">+55 11 4002 8922</a></p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 py-9 sm:grid-cols-4">
            <FooterLinks title="Meu perfil" links={['Minha conta', 'Meus favoritos', 'Minhas coleções']} onAction={showDemoNotice} />
            <FooterLinks title="Central de ajuda" links={['Como funciona', 'Segurança', 'Fale conosco']} onAction={showDemoNotice} />
            <FooterLinks title="Coleções" links={['Arte digital', 'Lançamentos', 'Em alta']} onAction={showDemoNotice} />
            <FooterLinks title="Redes sociais" links={['Instagram', 'X / Twitter', 'Discord']} onAction={showDemoNotice} />
          </div>

          <div className="flex flex-col gap-3 border-t border-kurio-border pt-6 text-[9px] uppercase tracking-[0.12em] text-kurio-text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 KURIO · Feito para a cultura digital</p>
            <p>Carteiras compatíveis: <span className="text-kurio-text">METAMASK • WALLETCONNECT • COINBASE</span></p>
          </div>
        </div>
      </footer>

      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-kurio-border bg-kurio-bg/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <Link to="/" search={{ tab: 'all', sort: 'recent', page: 1 }} className="flex flex-col items-center justify-center gap-1 text-[9px] text-kurio-amber">
          <Compass size={18} aria-hidden="true" />Início
        </Link>
        <button type="button" onClick={() => showDemoNotice('Favoritos')} className="flex flex-col items-center justify-center gap-1 text-[9px] text-kurio-text-muted">
          <Heart size={18} aria-hidden="true" />Favoritos
        </button>
        <a href="#catalogo" aria-label="Explorar coleções" className="mx-auto -mt-4 grid size-12 place-items-center rounded-full border-4 border-kurio-bg bg-kurio-amber text-kurio-bg shadow-lg">
          <Search size={19} aria-hidden="true" />
        </a>
        <Link
          to="/cart"
          aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'edição' : 'edições'}`}
          className="relative flex flex-col items-center justify-center gap-1 text-[9px] text-kurio-text-muted"
        >
          <ShoppingBag size={18} aria-hidden="true" />Carrinho
          {cartCount > 0 && (
            <span className="absolute right-4 top-1 grid size-4 place-items-center rounded-full bg-kurio-amber text-[8px] font-bold text-kurio-bg">
              {cartCount}
            </span>
          )}
        </Link>
        <Link to="/profile" className="flex flex-col items-center justify-center gap-1 text-[9px] text-kurio-text-muted">
          <UserRound size={18} aria-hidden="true" />Perfil
        </Link>
      </nav>

      <ScenarioDevToolbar />
    </div>
  )
}

function FooterFeature({ mark, title, detail }: { mark: string; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-kurio-amber text-sm font-bold text-kurio-bg">{mark}</span>
      <div>
        <h2 className="text-xs font-semibold text-kurio-text">{title}</h2>
        <p className="mt-2 text-[10px] leading-5 text-kurio-text-muted">{detail}</p>
      </div>
    </div>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.includes('@')) {
      setMessage('Informe um e-mail válido.')
      return
    }
    setMessage('Inscrição demonstrativa registrada neste navegador.')
    setEmail('')
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-kurio-text">Antecipe-se ao próximo lançamento</h2>
      <form onSubmit={submit} className="mt-3 flex">
        <label htmlFor="newsletter-email" className="sr-only">Seu e-mail</label>
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Seu e-mail"
          className="min-w-0 flex-1 rounded-l-md border border-kurio-border bg-kurio-bg px-3 py-2 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
        />
        <button type="submit" className="rounded-r-md bg-kurio-amber px-3 text-xs font-bold text-kurio-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber">Enviar</button>
      </form>
      <p role="status" aria-live="polite" className="mt-2 min-h-4 text-[10px] text-kurio-text-muted">{message}</p>
    </div>
  )
}

function FooterLinks({
  title,
  links,
  onAction,
}: {
  title: string
  links: string[]
  onAction: (section: string) => void
}) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold text-kurio-text">{title}</h2>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link}>
            <button
              type="button"
              onClick={() => onAction(link)}
              className="text-left text-[10px] text-kurio-text-muted hover:text-kurio-amber"
            >
              {link}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
