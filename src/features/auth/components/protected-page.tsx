import { useEffect } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useAuth } from '../hooks/auth-context'
import { ProfilePage } from '../../profile/pages/profile-page'
import { WalletsPage } from '../../wallets/pages/wallets-page'
import { CheckoutPage } from '../../checkout/pages/checkout-page'
import { OrderConfirmationPage } from '../../orders/pages/order-confirmation-page'

export function ProtectedPage({
  section,
  orderId,
}: {
  section: 'profile' | 'wallets' | 'checkout' | 'order'
  orderId?: string
}) {
  const { session, isLoading } = useAuth()
  const navigate = useNavigate()
  const currentPath = useRouterState({
    select: (state) => `${state.location.pathname}${state.location.searchStr}`,
  })

  useEffect(() => {
    if (!isLoading && !session) {
      void navigate({
        to: '/login',
        search: { redirect: currentPath },
      })
    }
  }, [currentPath, isLoading, navigate, session])

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

  if (section === 'profile') return <ProfilePage />
  if (section === 'wallets') return <WalletsPage />
  if (section === 'checkout') return <CheckoutPage />
  if (orderId) return <OrderConfirmationPage orderId={orderId} />
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
