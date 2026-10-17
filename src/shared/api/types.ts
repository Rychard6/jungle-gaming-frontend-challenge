export const BLOCKCHAIN_NETWORKS = ['Ethereum', 'Polygon', 'Solana'] as const

export type BlockchainNetwork = (typeof BLOCKCHAIN_NETWORKS)[number]

export type NftCollectionCategory =
  | 'Arte digital'
  | 'Fotografia'
  | 'Música'
  | 'Arte 3D'
  | 'Colecionáveis'
  | 'Generativa'
  | 'Jogos'
  | 'Assinaturas'
  | 'Utilidade'

export const NFT_EDITION_TYPES = ['1/1', '1/10', '1/50', 'ABERTA'] as const

export type NftEditionType = (typeof NFT_EDITION_TYPES)[number]

export type CatalogTab = 'all' | 'new' | 'trending'

export type CatalogSort =
  | 'recent'
  | 'price_asc'
  | 'price_desc'
  | 'rating_desc'

export const WALLET_PROVIDER_TYPES = [
  'MetaMask',
  'WalletConnect',
  'Coinbase Wallet',
] as const

export type WalletProviderType = (typeof WALLET_PROVIDER_TYPES)[number]

export interface NftItem {
  id: string
  tokenId: string
  slug: string
  title: string
  collectionName: string
  category: NftCollectionCategory
  network: BlockchainNetwork
  priceEth: string
  originalPriceEth?: string
  editionType: NftEditionType
  availableEditions: number
  totalEditions: number
  imageUrl: string
  galleryUrls: string[]
  isRare?: boolean
  isFeatured?: boolean
  isLaunch?: boolean
  rating: number
  reviewsCount: number
  description: string
  longDescription: string
  attributes: string[]
  contractAddress: string
  creatorRoyaltyPercent: number
  version: number
  updatedAt: string
}

export interface CatalogQueryParams {
  search?: string
  categories?: NftCollectionCategory[]
  networks?: BlockchainNetwork[]
  minPriceEth?: string
  maxPriceEth?: string
  tab?: CatalogTab
  sort?: CatalogSort
  featured?: boolean
  page?: number
  limit?: number
}

export interface CatalogCounts {
  categories: Record<NftCollectionCategory, number>
  networks: Record<BlockchainNetwork, number>
}

export interface CatalogResponse {
  items: NftItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  counts: CatalogCounts
}

export interface CartItemDto {
  itemId: string
  nftId: string
  tokenId: string
  title: string
  imageUrl: string
  editionType: NftEditionType
  unitPriceEth: string
  addedPriceEth: string
  quantity: number
  availableEditions: number
  lineTotalEth: string
  nftVersion: number
  priceChanged?: boolean
  previousPriceEth?: string
  insufficientStock?: boolean
}

export interface CartDto {
  items: CartItemDto[]
  couponCode: string | null
  discountLabel: string
  subtotalEth: string
  discountEth: string
  networkFeeEth: string
  totalEth: string
  quoteVersion: string
  hasStaleItems: boolean
  updatedAt: string
  acknowledgedUnavailableItems?: string[]
}

export interface AddCartItemInput {
  nftId: string
  quantity: number
  editionType?: NftEditionType
}

export interface UpdateCartItemInput {
  quantity: number
}

export interface ApplyCartCouponInput {
  code: string
}

export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface CollectorCheckoutData {
  displayName: string
  username: string
  network: BlockchainNetwork
  profileName: string
  walletAddress: string
  secondaryWalletOrEns?: string
  walletType: WalletProviderType
  referralCode?: string
  email: string
  ensName: string
  ensDomain: string
  useAnotherWallet: boolean
  notes?: string
}

export interface OrderDto {
  id: string
  transactionHash: string
  userId: string
  status: OrderStatus
  createdAt: string
  updatedAt: string
  version: number
  idempotencyKey: string
  walletProvider: WalletProviderType
  network: BlockchainNetwork
  collector: CollectorCheckoutData
  snapshot: {
    items: Array<{
      nftId: string
      tokenId: string
      title: string
      imageUrl: string
      editionType: NftEditionType
      quantity: number
      unitPriceEth: string
      subtotalEth: string
    }>
    subtotalEth: string
    discountEth: string
    networkFeeEth: string
    totalEth: string
    couponCode: string | null
  }
  failureReason?: string
}

export type CheckoutQuoteDto = CartDto

export interface CreateOrderRequestDto {
  quoteVersion: string
  walletProvider: WalletProviderType
  network: BlockchainNetwork
  collector: CollectorCheckoutData
}

export interface OrderListDto {
  orders: OrderDto[]
}

export interface UserProfileDto {
  id: string
  displayName: string
  username: string
  email: string
  ensName: string
  ensDomain: string
  walletNickname: string
  avatarUrl: string | null
}

export interface WalletDto {
  id: string
  userId: string
  isPrimary: boolean
  label: 'Principal' | 'Reserva'
  displayName: string
  walletNickname: string
  network: BlockchainNetwork
  profileName: string
  address: string
  secondaryAddressOrEns?: string
  walletType: WalletProviderType
  referralCode: string
  email: string
  ensName: string
  ensDomain: string
  sameAsPrimary?: boolean
}

export type UpdateProfileRequestDto = Omit<UserProfileDto, 'id'>

export interface UpdatePasswordRequestDto {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export type WalletInputDto = Omit<WalletDto, 'id' | 'userId' | 'label'> & {
  label?: WalletDto['label']
}

export interface AuthSessionDto {
  token: string
  expiresAt: string
  user: UserProfileDto
}

export interface LoginRequestDto {
  email: string
  password: string
}

export interface RegisterRequestDto {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export interface AuthResponseDto {
  session: AuthSessionDto
  wallets: WalletDto[]
}

export interface AuthSessionResponseDto {
  session: AuthSessionDto | null
  wallets: WalletDto[]
}

export const MOCK_SCENARIO_IDS = [
  'default',
  'empty-results',
  'slow-network',
  'out-of-order',
  'network-error',
  'server-error-500',
  'session-expired',
  'price-change-on-checkout',
  'edition-sold-out',
  'order-timeout-recovery',
  'order-pending',
  'payment-declined',
] as const

export type MockScenarioId = (typeof MOCK_SCENARIO_IDS)[number]

export function isMockScenarioId(value: unknown): value is MockScenarioId {
  return MOCK_SCENARIO_IDS.some((scenario) => scenario === value)
}

export interface SocketEventEnvelope<
  TType extends string,
  TPayload,
> {
  eventId: string
  type: TType
  resourceId: string
  version: number
  userId?: string
  timestamp: string
  payload: TPayload
}

export type NftUpdatedEvent = SocketEventEnvelope<
  'nft.updated',
  {
    nftId: string
    priceEth: string
    availableEditions: number
    editionType: NftEditionType
  }
>

export type OrderUpdatedEvent = SocketEventEnvelope<
  'order.updated',
  {
    orderId: string
    status: OrderStatus
    transactionHash: string
    failureReason?: string
  }
>
