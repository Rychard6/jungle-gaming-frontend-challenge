import { lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import type { ProtectedPage as ProtectedPageComponent } from '../features/auth/components/protected-page'

const HomeCatalogPage = lazy(() =>
  import('../features/catalog/pages/home-catalog-page').then((module) => ({
    default: module.HomeCatalogPage,
  })),
)
const NftDetailRoutePage = lazy(() => import('../routes/nfts.$nftId'))
const CartRoutePage = lazy(() => import('../routes/cart'))
const AuthModalOrPage = lazy(() =>
  import('../features/auth/components/auth-modal-or-page').then((module) => ({
    default: module.AuthModalOrPage,
  })),
)
const ProtectedPage = lazy(() =>
  import('../features/auth/components/protected-page').then((module) => ({
    default: module.ProtectedPage,
  })),
)

function RouteLoadingFallback() {
  return (
    <main
      aria-busy="true"
      className="mx-auto min-h-screen max-w-7xl px-4 py-10 sm:px-8"
    >
      <div className="skeleton-shimmer h-8 w-56 rounded" />
      <div className="skeleton-shimmer mt-6 h-72 rounded-xl" />
    </main>
  )
}

function withRouteSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{element}</Suspense>
}

export function HomeCatalogRoute() {
  return withRouteSuspense(<HomeCatalogPage />)
}

export function NftDetailRoute() {
  return withRouteSuspense(<NftDetailRoutePage />)
}

export function CartRoute() {
  return withRouteSuspense(<CartRoutePage />)
}

export function LoginRoute() {
  return withRouteSuspense(<AuthModalOrPage mode="login" />)
}

export function RegisterRoute() {
  return withRouteSuspense(<AuthModalOrPage mode="register" />)
}

export function ProtectedRoute({
  section,
  orderId,
}: {
  section: Parameters<typeof ProtectedPageComponent>[0]['section']
  orderId?: string
}) {
  return withRouteSuspense(<ProtectedPage section={section} orderId={orderId} />)
}
