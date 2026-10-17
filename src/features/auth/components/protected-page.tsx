import { useEffect } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuth } from '../hooks/auth-context'
import { ProfilePage } from '../../profile/pages/profile-page'
import { WalletsPage } from '../../wallets/pages/wallets-page'
import { CheckoutPage } from '../../checkout/pages/checkout-page'
import { OrderConfirmationPage } from '../../orders/pages/order-confirmation-page'
import { isAuthRoutePath, redirectFromPath } from '../lib/safe-redirect'

export function ProtectedPage({
  section,
  orderId,
}: {
  section: 'profile' | 'wallets' | 'checkout' | 'order'
  orderId?: string
}) {
  const { session, isLoading } = useAuth()
  const navigate = useNavigate()
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const currentPath = useRouterState({
    select: (state) => `${state.location.pathname}${state.location.searchStr}`,
  })

  useEffect(() => {
    // Já estamos na tela de login (transição com chunk lazy mantém esta página montada):
    // não navegar de novo, senão o `redirect` cresce a cada render.
    if (isAuthRoutePath(pathname)) return
    if (!isLoading && !session) {
      void navigate({
        to: '/login',
        search: { redirect: redirectFromPath(currentPath) },
        replace: true,
      })
    }
  }, [currentPath, isLoading, navigate, pathname, session])

  if (isLoading || !session) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-20" aria-busy="true">
        <div className="skeleton-shimmer h-8 w-52 rounded" />
        <p className="mt-4 text-sm text-kurio-text-muted">
          Verificando sua sessão...
        </p>
      </main>
    )
  }

  if (section === 'profile') return <ProfilePage key={session.user.id} />
  if (section === 'wallets') return <WalletsPage key={session.user.id} />
  if (section === 'checkout') return <CheckoutPage key={session.user.id} />
  if (orderId) return <OrderConfirmationPage key={`${session.user.id}:${orderId}`} orderId={orderId} />
  return (
    <main className="mx-auto max-w-3xl px-5 py-20">
      <p role="alert" className="text-sm text-kurio-danger">
        Não foi possível identificar este pedido.
      </p>
      <Link to="/profile" className="mt-4 inline-flex text-sm text-kurio-amber underline">
        Voltar ao perfil
      </Link>
    </main>
  )
}
