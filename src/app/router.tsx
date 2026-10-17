import {
  createRootRoute,
  createRoute,
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'
import {
  NotFoundPage,
  RootLayout,
} from '../shared/ui/layout/route-pages'
import {
  CartRoute,
  HomeCatalogRoute,
  LoginRoute,
  NftDetailRoute,
  ProtectedRoute,
  RegisterRoute,
} from './route-components'

export interface HomeSearch {
  q?: string
  categories?: string
  networks?: string
  minPrice?: string
  maxPrice?: string
  tab: 'all' | 'new' | 'trending'
  sort: 'recent' | 'price_asc' | 'price_desc' | 'rating_desc'
  page: number
}

const tabs = ['all', 'new', 'trending'] as const
const sorts = ['recent', 'price_asc', 'price_desc', 'rating_desc'] as const

function validateSearch(search: Record<string, unknown>): HomeSearch {
  const tab =
    typeof search.tab === 'string' &&
    tabs.includes(search.tab as (typeof tabs)[number])
      ? (search.tab as HomeSearch['tab'])
      : 'all'
  const sort =
    typeof search.sort === 'string' &&
    sorts.includes(search.sort as (typeof sorts)[number])
      ? (search.sort as HomeSearch['sort'])
      : 'recent'
  const parsedPage = Number(search.page)
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1
  const isString = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0

  return {
    ...(isString(search.q) ? { q: search.q } : {}),
    ...(isString(search.categories) ? { categories: search.categories } : {}),
    ...(isString(search.networks) ? { networks: search.networks } : {}),
    ...(isString(search.minPrice) ? { minPrice: search.minPrice } : {}),
    ...(isString(search.maxPrice) ? { maxPrice: search.maxPrice } : {}),
    tab,
    sort,
    page,
  }
}

interface AuthSearch {
  redirect?: string
  expired?: boolean
}

function validateAuthSearch(search: Record<string, unknown>): AuthSearch {
  return {
    ...(typeof search.redirect === 'string'
      ? { redirect: search.redirect }
      : {}),
    ...(search.expired === true || search.expired === 'true'
      ? { expired: true }
      : {}),
  }
}

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch,
  component: HomeCatalogRoute,
})

const nftDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nfts/$nftId',
  component: NftDetailRoute,
})
const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cart',
  component: CartRoute,
})
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: validateAuthSearch,
  component: LoginRoute,
})
const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  validateSearch: validateAuthSearch,
  component: RegisterRoute,
})
const profileRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/profile',
  component: () => <ProtectedRoute section="profile" />,
})
const walletsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/wallets',
  component: () => <ProtectedRoute section="wallets" />,
})
const checkoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/checkout',
  component: () => <ProtectedRoute section="checkout" />,
})
const orderRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/orders/$orderId',
  component: () => (
    <ProtectedRoute
      section="order"
      orderId={orderRoute.useParams().orderId}
    />
  ),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  nftDetailRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  profileRoute,
  walletsRoute,
  checkoutRoute,
  orderRoute,
])

// Search values are plain strings (validated in `validateSearch`). The default
// serializer JSON-quotes numeric-looking strings (e.g. minPrice="0.5"), so both
// directions use raw strings here.
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  parseSearch: parseSearchWith((value) => value),
  stringifySearch: stringifySearchWith((value) => String(value)),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
