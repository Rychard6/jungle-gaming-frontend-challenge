import { useNavigate, Outlet } from '@tanstack/react-router'
import { AppLayout } from './app-layout'
import { AuthProvider } from '../../../features/auth/hooks/auth-provider'

export function RootLayout() {
  return (
    <AuthProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AuthProvider>
  )
}

export function NotFoundPage() {
  const navigate = useNavigate()
  return (
    <main className="mx-auto max-w-3xl px-5 py-24 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-kurio-amber">404</p>
      <h1 className="mt-4 text-3xl font-bold text-kurio-text">
        Página não encontrada
      </h1>
      <p className="mt-3 text-sm text-kurio-text-muted">
        O endereço pode estar incorreto ou a página não existe.
      </p>
      <button
        type="button"
        onClick={() =>
          void navigate({
            to: '/',
            search: { tab: 'all', sort: 'recent', page: 1 },
          })
        }
        className="mt-8 rounded-md bg-kurio-amber px-5 py-3 font-bold text-kurio-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber"
      >
        Voltar ao início
      </button>
    </main>
  )
}

export function PlaceholderPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-20">
      <p className="text-xs uppercase tracking-[0.2em] text-kurio-amber">KURIO</p>
      <h1 className="mt-3 text-3xl font-bold text-kurio-text">Em breve</h1>
      <p className="mt-4 text-kurio-text-muted">
        Esta página faz parte das próximas etapas do marketplace.
      </p>
    </main>
  )
}
