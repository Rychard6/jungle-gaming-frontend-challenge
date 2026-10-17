import { Link, Outlet } from '@tanstack/react-router'
import { AppShell } from './app-shell'
import { AuthProvider } from '../../../features/auth/hooks/auth-provider'
import { buttonVariants } from '../button-variants'
import { useDocumentTitle } from '../../lib/use-document-title'

export function RootLayout() {
  return (
    <AuthProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthProvider>
  )
}

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada — KURIO')
  return (
    <main className="mx-auto max-w-3xl px-5 py-24 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-kurio-amber">404</p>
      <h1 className="mt-4 text-3xl font-bold text-kurio-text">
        Página não encontrada
      </h1>
      <p className="mt-3 text-sm text-kurio-text-muted">
        O endereço pode estar incorreto ou a página não existe.
      </p>
      <Link
        to="/"
        search={{ tab: 'all', sort: 'recent', page: 1 }}
        className={buttonVariants({ size: 'lg', className: 'mt-8' })}
      >
        Voltar ao início
      </Link>
    </main>
  )
}
