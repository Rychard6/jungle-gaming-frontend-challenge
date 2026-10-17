import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
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
import { MOCKS_ENABLED } from '../../../app/config'
import { ScenarioDevToolbar } from '../../../features/dev-tools/scenario-dev-toolbar'
import { useCart } from '../../../features/cart/hooks/use-cart'
import { useAuth } from '../../../features/auth/hooks/auth-context'
import { useUrlSearchField } from '../../../features/catalog/hooks/use-url-search-field'
import { Button } from '../button'
import { buttonVariants } from '../button-variants'

const HOME_SEARCH = { tab: 'all', sort: 'recent', page: 1 } as const

function getCollectorInitials(displayName: string): string {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toLocaleUpperCase()
}

/** Anuncia a nova página para leitores de tela após cada navegação (SPA não recarrega o documento). */
function RouteAnnouncer() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [message, setMessage] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setMessage(document.title), 400)
    return () => window.clearTimeout(timer)
  }, [pathname])

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const cart = useCart()
  const auth = useAuth()
  const cartCount =
    cart.cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0
  const [notice, setNotice] = useState('')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { pathname, searchStr } = useRouterState({
    select: (state) => ({
      pathname: state.location.pathname,
      searchStr: state.location.searchStr,
    }),
  })
  const isHome = pathname === '/'
  const isAuthRoute = pathname === '/login' || pathname === '/register'
  const urlQuery = new URLSearchParams(searchStr).get('q') ?? ''

  // Um aviso por vez, descartado sozinho; o `useEffect` evita timers presos entre trocas.
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [mobileMenuOpen])

  const showOutOfScopeNotice = (section: string) => {
    setNotice(`${section} não faz parte do escopo desta demonstração.`)
  }

  // Digitar em outra página abre o catálogo (novo passo de histórico); no catálogo, só reescreve.
  const commitSearch = useCallback(
    (value: string) => {
      void navigate({
        to: '/',
        replace: isHome,
        search: (previous) => ({
          ...previous,
          tab: previous.tab ?? 'all',
          sort: previous.sort ?? 'recent',
          q: value || undefined,
          page: 1,
        }),
      })
    },
    [isHome, navigate],
  )
  const searchField = useUrlSearchField(urlQuery, commitSearch)

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    searchField.submit()
  }

  const skipToContent = () => {
    document.getElementById('conteudo')?.focus()
  }

  const logoutWithFeedback = () => {
    void auth.logout().catch((error: unknown) => {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível encerrar a sessão.',
      )
    })
  }

  const bannerNotice = notice || (isAuthRoute ? '' : auth.notice)

  return (
    <div className="min-h-screen overflow-x-clip bg-kurio-bg pb-20 text-kurio-text md:pb-0">
      <a
        href="#conteudo"
        onClick={(event) => {
          event.preventDefault()
          skipToContent()
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-md focus:bg-kurio-amber focus:px-4 focus:py-2 focus:text-xs focus:font-bold focus:text-kurio-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-text"
      >
        Pular para o conteúdo
      </a>
      <header className="sticky top-0 z-40 border-b border-kurio-border bg-kurio-bg/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center gap-6 px-4 sm:px-8">
          <Link
            to="/"
            search={HOME_SEARCH}
            className="shrink-0 rounded text-xl font-bold tracking-tight text-kurio-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber sm:text-2xl"
          >
            KURIO<span className="text-kurio-amber">.</span>
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-5 xl:flex">
            <Link to="/" search={HOME_SEARCH} className="text-xs text-kurio-text hover:text-kurio-amber">Início</Link>
            <Link to="/" search={HOME_SEARCH} hash="catalogo" className="text-xs text-kurio-text-muted hover:text-kurio-amber">Mercado</Link>
            <button type="button" onClick={() => showOutOfScopeNotice('Criadores')} className="text-xs text-kurio-text-muted hover:text-kurio-amber">Criadores</button>
            <button type="button" onClick={() => showOutOfScopeNotice('Aprenda')} className="text-xs text-kurio-text-muted hover:text-kurio-amber">Aprenda</button>
          </nav>

          <form onSubmit={submitSearch} className="relative ml-auto hidden min-w-48 max-w-sm flex-1 lg:block">
            <label htmlFor="header-search" className="sr-only">Buscar NFTs</label>
            <Search size={16} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-kurio-text-muted" />
            <input
              id="header-search"
              value={searchField.value}
              onChange={(event) => searchField.onChange(event.target.value)}
              placeholder="Buscar NFTs, coleções..."
              className="h-10 w-full rounded-md border border-kurio-border bg-kurio-surface pl-9 pr-3 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
            />
          </form>

          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            {/* Em telas móveis o carrinho fica na navegação inferior (como no Figma); evita dois links idênticos. */}
            <Link
              to="/cart"
              aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'edição' : 'edições'}`}
              className="relative hidden size-10 place-items-center rounded-full border border-kurio-border text-kurio-text hover:border-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber md:grid"
            >
              <ShoppingBag size={18} aria-hidden="true" />
              {cartCount > 0 && (
                <span aria-hidden="true" className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-kurio-amber text-[9px] font-bold text-kurio-bg">
                  {cartCount}
                </span>
              )}
            </Link>
            {auth.session ? (
              <div className="hidden items-center gap-3 sm:flex">
                <Link
                  to="/profile"
                  aria-label={`Perfil de ${auth.session.user.displayName}`}
                  className="flex max-w-44 items-center gap-2 truncate text-xs font-semibold text-kurio-text hover:text-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  {auth.session.user.avatarUrl ? (
                    <img
                      src={auth.session.user.avatarUrl}
                      alt=""
                      width={32}
                      height={32}
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
                  className="text-xs text-kurio-text-muted hover:text-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber"
                >
                  Carteiras
                </Link>
                <Button variant="secondary" size="sm" onClick={logoutWithFeedback} className="font-normal text-kurio-text-muted hover:text-kurio-text">
                  Sair
                </Button>
              </div>
            ) : (
              <Link
                to="/login"
                className={buttonVariants({ className: 'hidden sm:inline-flex' })}
              >
                Entrar
              </Link>
            )}
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="grid size-10 place-items-center rounded-md border border-kurio-border text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber xl:hidden"
            >
              {mobileMenuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav id="mobile-menu" aria-label="Menu móvel" className="space-y-1 border-t border-kurio-border bg-kurio-surface px-5 py-4 xl:hidden">
            <Link to="/" search={HOME_SEARCH} hash="catalogo" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm text-kurio-text">Mercado</Link>
            <button type="button" onClick={() => { setMobileMenuOpen(false); showOutOfScopeNotice('Criadores') }} className="block py-2 text-sm text-kurio-text">Criadores</button>
            <button type="button" onClick={() => { setMobileMenuOpen(false); showOutOfScopeNotice('Aprenda') }} className="block py-2 text-sm text-kurio-text">Aprenda</button>
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
                    logoutWithFeedback()
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

      {bannerNotice && (
        <p role="status" className="fixed left-1/2 top-20 z-50 w-[min(92vw,32rem)] -translate-x-1/2 rounded-lg border border-kurio-amber/50 bg-kurio-surface px-4 py-3 text-center text-xs text-kurio-text shadow-xl">
          {bannerNotice}
        </p>
      )}

      <RouteAnnouncer />
      <div id="conteudo" tabIndex={-1} className="focus:outline-none">
        {children}
      </div>

      <footer className="border-t border-kurio-border bg-kurio-surface">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="grid gap-8 border-b border-kurio-border pb-10 md:grid-cols-2 xl:grid-cols-4">
            <FooterFeature
              mark="W"
              title="Segurança da carteira"
              detail="Proteja sua carteira e colecione arte digital verificada com confiança."
            />
            <FooterFeature
              mark="C"
              title="Criadores em destaque"
              detail="Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede."
            />
            <FooterFeature
              mark="D"
              title="Alertas de lançamentos"
              detail="Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado."
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
            <FooterColumn title="Meu perfil">
              <li><Link to="/profile" className={footerLinkClass}>Meu perfil</Link></li>
              {['Minha coleção', 'Atividade', 'Estúdio do criador', 'Lista de interesse'].map((label) => (
                <li key={label}><FooterAction label={label} onAction={showOutOfScopeNotice} /></li>
              ))}
            </FooterColumn>
            <FooterColumn title="Central de ajuda">
              {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((label) => (
                <li key={label}><FooterAction label={label} onAction={showOutOfScopeNotice} /></li>
              ))}
            </FooterColumn>
            <FooterColumn title="Coleções">
              {(['Arte digital', 'Fotografia', 'Música', 'Arte 3D', 'Utilidade'] as const).map((category) => (
                <li key={category}>
                  <Link
                    to="/"
                    search={{ ...HOME_SEARCH, categories: category }}
                    hash="catalogo"
                    className={footerLinkClass}
                  >
                    {category}
                  </Link>
                </li>
              ))}
            </FooterColumn>
            <div>
              <h2 className="mb-3 text-xs font-semibold text-kurio-text">Redes sociais</h2>
              <ul className="flex flex-wrap gap-2">
                {([
                  ['Facebook', 'f'],
                  ['Instagram', 'ig'],
                  ['X', 'x'],
                  ['LinkedIn', 'in'],
                  ['YouTube', 'yt'],
                ] as const).map(([name, glyph]) => (
                  <li key={name}>
                    <button
                      type="button"
                      aria-label={name}
                      onClick={() => showOutOfScopeNotice(`Perfil da KURIO no ${name}`)}
                      className="grid size-8 place-items-center rounded border border-kurio-amber/60 text-[10px] font-bold uppercase text-kurio-amber hover:bg-kurio-amber/10 focus-visible:outline-2 focus-visible:outline-kurio-amber"
                    >
                      {glyph}
                    </button>
                  </li>
                ))}
              </ul>
              <h2 className="mb-3 mt-6 text-xs font-semibold text-kurio-text">Carteiras compatíveis</h2>
              <p className="inline-block rounded border border-kurio-border bg-kurio-bg px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-kurio-amber">
                MetaMask · WalletConnect · Coinbase
              </p>
            </div>
          </div>

          <p className="border-t border-kurio-border pt-6 text-center text-[10px] text-kurio-text-muted">
            © 2026 Kurio. Propriedade digital para todos.
          </p>
        </div>
      </footer>

      <nav
        aria-label="Navegação inferior"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[68px] grid-cols-5 border-t border-kurio-border bg-kurio-bg/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <Link to="/" search={HOME_SEARCH} className="flex flex-col items-center justify-center gap-1 text-[9px] text-kurio-amber">
          <Compass size={18} aria-hidden="true" />Início
        </Link>
        <button type="button" onClick={() => showOutOfScopeNotice('A lista de favoritos')} className="flex flex-col items-center justify-center gap-1 text-[9px] text-kurio-text-muted">
          <Heart size={18} aria-hidden="true" />Favoritos
        </button>
        <Link to="/" search={HOME_SEARCH} hash="catalogo" aria-label="Explorar coleções" className="mx-auto -mt-4 grid size-12 place-items-center rounded-full border-4 border-kurio-bg bg-kurio-amber text-kurio-bg shadow-lg">
          <Search size={19} aria-hidden="true" />
        </Link>
        <Link
          to="/cart"
          aria-label={`Carrinho, ${cartCount} ${cartCount === 1 ? 'edição' : 'edições'}`}
          className="relative flex flex-col items-center justify-center gap-1 text-[9px] text-kurio-text-muted"
        >
          <ShoppingBag size={18} aria-hidden="true" />Carrinho
          {cartCount > 0 && (
            <span aria-hidden="true" className="absolute right-4 top-1 grid size-4 place-items-center rounded-full bg-kurio-amber text-[8px] font-bold text-kurio-bg">
              {cartCount}
            </span>
          )}
        </Link>
        <Link to="/profile" className="flex flex-col items-center justify-center gap-1 text-[9px] text-kurio-text-muted">
          <UserRound size={18} aria-hidden="true" />Perfil
        </Link>
      </nav>

      {MOCKS_ENABLED && <ScenarioDevToolbar />}
    </div>
  )
}

const footerLinkClass =
  'text-left text-[10px] text-kurio-text-muted hover:text-kurio-amber focus-visible:outline-2 focus-visible:outline-kurio-amber'

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
    // A newsletter está fora do escopo: nada é enviado nem armazenado, e o aviso diz isso.
    setMessage('A newsletter não faz parte desta demonstração: nenhum e-mail foi registrado.')
    setEmail('')
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-kurio-text">Antecipe-se ao próximo lançamento</h2>
      <form onSubmit={submit} noValidate className="mt-3 flex">
        <label htmlFor="newsletter-email" className="sr-only">Receber lançamentos</label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="digite seu e-mail..."
          className="min-w-0 flex-1 rounded-l-md border border-kurio-border bg-kurio-bg px-3 py-2 text-xs text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber"
        />
        <button type="submit" className="rounded-r-md bg-kurio-amber px-3 text-xs font-bold text-kurio-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber">Enviar</button>
      </form>
      <p className="mt-2 text-[10px] leading-4 text-kurio-text-muted">
        Receba lançamentos selecionados, histórias de criadores e novidades do mercado.
      </p>
      <p aria-live="polite" className="mt-2 min-h-4 text-[10px] text-kurio-amber">{message}</p>
    </div>
  )
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold text-kurio-text">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  )
}

function FooterAction({
  label,
  onAction,
}: {
  label: string
  onAction: (section: string) => void
}) {
  return (
    <button type="button" onClick={() => onAction(label)} className={footerLinkClass}>
      {label}
    </button>
  )
}
