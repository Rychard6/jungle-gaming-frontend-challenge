import { delay, http, HttpResponse } from 'msw'
import {
  addEth,
  compareEth,
  parseEthToWei,
} from '../shared/lib/eth-math'
import { getStoredMockScenario, setMockScenario } from '../shared/api/http'
import {
  validatePasswordChange,
  validateCollector,
  validatePriceRange,
  validateProfile,
  validateRegistration,
  validateWallet,
} from '../shared/lib/validation'
import {
  isMockScenarioId,
  NFT_EDITION_TYPES,
  type MockScenarioId,
} from '../shared/api/types'
import type {
  AddCartItemInput,
  ApplyCartCouponInput,
  AuthResponseDto,
  AuthSessionResponseDto,
  CatalogResponse,
  CollectorCheckoutData,
  CreateOrderRequestDto,
  LoginRequestDto,
  NftEditionType,
  OrderStatus,
  RegisterRequestDto,
  WalletProviderType,
  BlockchainNetwork,
  UpdatePasswordRequestDto,
  UpdateProfileRequestDto,
  WalletInputDto,
  UpdateCartItemInput,
  OrderDto,
} from '../shared/api/types'
import {
  acknowledgeMockCartChanges,
  authenticateMockUser,
  addMockCartItem,
  applyMockCartCoupon,
  createMockOrder,
  createMockWallet,
  deleteMockWallet,
  getMockOrderByIdempotencyKey,
  getMockOrderOwnerId,
  getMockProfile,
  getMockSession,
  getMockWallets,
  findMockUserByEmailOrUsername,
  getCatalogCounts,
  getMockCart,
  getMockCheckoutQuote,
  getMockFavorites,
  getMockNfts,
  getMockOrder,
  getMockOrders,
  listMockPendingOrders,
  removeMockCartCoupon,
  removeMockCartItem,
  resetMockDb,
  mergeMockGuestCart,
  registerMockUser,
  revokeMockSession,
  saveMockFavorites,
  updateMockNft,
  updateMockPassword,
  updateMockProfile,
  updateMockWallet,
  updateMockCartItem,
  transitionMockOrder,
} from './db'
import {
  createNftUpdatedEvent,
  dropSocketConnections,
  emitNftUpdated,
  emitOrderUpdated,
  replayLastNftEvent,
  resetSocketServerState,
  socketIoHandler,
} from './socket-server'

function getScenario(request: Request): MockScenarioId {
  const header = request.headers.get('x-mock-scenario')
  return isMockScenarioId(header) ? header : 'default'
}

function splitQueryValues(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

/** Busca sem diferenciar maiúsculas/minúsculas nem acentos ("musica" encontra "Música"). */
function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').trim().toLocaleLowerCase()
}

function validatePriceFilter(
  minPriceEth: string | null,
  maxPriceEth: string | null,
): Record<string, string> {
  const { minPrice, maxPrice } = validatePriceRange(
    minPriceEth ?? '',
    maxPriceEth ?? '',
  )
  return {
    ...(minPrice ? { minPriceEth: minPrice } : {}),
    ...(maxPrice ? { maxPriceEth: maxPrice } : {}),
  }
}

function jsonError(message: string, status: number, code: string) {
  return HttpResponse.json({ message, code }, { status })
}

// Escopo (`user:<id>` ou `guest:<id>`) usado pelo carrinho. Favoritos exigem usuário autenticado.
function getFavoritesSessionId(request: Request): string {
  const token = getBearerToken(request)
  if (token) return `user:${getMockSession(token)?.session.user.id ?? 'invalid'}`
  return `guest:${request.headers.get('x-guest-session-id') ?? 'anonymous'}`
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')
  if (!authorization) return null
  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  return match?.[1] ?? null
}

function getSessionError(request: Request) {
  const token = getBearerToken(request)
  if (!token) return null
  const session = getMockSession(token)
  if (!session) {
    return jsonError(
      'Sua sessão expirou. Faça login novamente para continuar.',
      401,
      'SESSION_EXPIRED',
    )
  }
  if (getScenario(request) === 'session-expired') {
    if (sessionExpiredScenarioTriggered) return null
    sessionExpiredScenarioTriggered = true
    return jsonError(
      'Sua sessão expirou. Faça login novamente para continuar.',
      401,
      'SESSION_EXPIRED',
    )
  }
  sessionExpiredScenarioTriggered = false
  return null
}

function requireAuthenticatedUser(
  request: Request,
): { userId: string; response?: never } | { userId?: never; response: Response } {
  const token = getBearerToken(request)
  if (!token) {
    return {
      response: jsonError('Faça login para continuar.', 401, 'AUTH_REQUIRED'),
    }
  }
  const sessionError = getSessionError(request)
  if (sessionError) return { response: sessionError }
  const session = getMockSession(token)
  if (!session) {
    return {
      response: jsonError('Sua sessão expirou. Faça login novamente.', 401, 'SESSION_EXPIRED'),
    }
  }
  return { userId: session.session.user.id }
}

function mergeGuestSession(request: Request, userId: string): void {
  const guestId = request.headers.get('x-guest-session-id')
  if (guestId) mergeMockGuestCart(guestId, userId)
}

function isNetworkErrorScenario(request: Request): boolean {
  return getScenario(request) === 'network-error'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isWalletInput(value: Record<string, unknown>): value is Record<
  string,
  unknown
> & WalletInputDto {
  return (
    isString(value.displayName) &&
    isString(value.walletNickname) &&
    (value.network === 'Ethereum' ||
      value.network === 'Polygon' ||
      value.network === 'Solana') &&
    isString(value.profileName) &&
    isString(value.address) &&
    (value.secondaryAddressOrEns === undefined ||
      isString(value.secondaryAddressOrEns)) &&
    (value.walletType === 'MetaMask' ||
      value.walletType === 'WalletConnect' ||
      value.walletType === 'Coinbase Wallet') &&
    isString(value.referralCode) &&
    isString(value.email) &&
    isString(value.ensName) &&
    isString(value.ensDomain) &&
    typeof value.isPrimary === 'boolean' &&
    (value.sameAsPrimary === undefined ||
      typeof value.sameAsPrimary === 'boolean')
  )
}

function toWalletInput(value: Record<string, unknown>): WalletInputDto | null {
  if (!isWalletInput(value)) {
    return null
  }
  return {
    displayName: value.displayName,
    walletNickname: value.walletNickname,
    network: value.network,
    profileName: value.profileName,
    address: value.address,
    ...(isString(value.secondaryAddressOrEns)
      ? { secondaryAddressOrEns: value.secondaryAddressOrEns }
      : {}),
    walletType: value.walletType,
    referralCode: value.referralCode,
    email: value.email,
    ensName: value.ensName,
    ensDomain: value.ensDomain,
    isPrimary: value.isPrimary,
    ...(typeof value.sameAsPrimary === 'boolean'
      ? { sameAsPrimary: value.sameAsPrimary }
      : {}),
  }
}

function isBlockchainNetwork(value: unknown): value is BlockchainNetwork {
  return value === 'Ethereum' || value === 'Polygon' || value === 'Solana'
}

function isWalletProvider(value: unknown): value is WalletProviderType {
  return (
    value === 'MetaMask' ||
    value === 'WalletConnect' ||
    value === 'Coinbase Wallet'
  )
}

function parseCreateOrderInput(value: unknown): CreateOrderRequestDto | null {
  if (
    !isRecord(value) ||
    !isString(value.quoteVersion) ||
    !isBlockchainNetwork(value.network) ||
    !isWalletProvider(value.walletProvider) ||
    !isRecord(value.collector)
  ) {
    return null
  }
  const collector = value.collector
  if (
    !isString(collector.displayName) ||
    !isString(collector.username) ||
    !isBlockchainNetwork(collector.network) ||
    !isString(collector.profileName) ||
    !isString(collector.walletAddress) ||
    !isWalletProvider(collector.walletType) ||
    !isString(collector.email) ||
    !isString(collector.ensName) ||
    !isString(collector.ensDomain) ||
    typeof collector.useAnotherWallet !== 'boolean' ||
    (collector.secondaryWalletOrEns !== undefined &&
      !isString(collector.secondaryWalletOrEns)) ||
    (collector.referralCode !== undefined &&
      !isString(collector.referralCode)) ||
    (collector.notes !== undefined && !isString(collector.notes))
  ) {
    return null
  }
  const typedCollector: CollectorCheckoutData = {
    displayName: collector.displayName,
    username: collector.username,
    network: collector.network,
    profileName: collector.profileName,
    walletAddress: collector.walletAddress,
    ...(isString(collector.secondaryWalletOrEns)
      ? { secondaryWalletOrEns: collector.secondaryWalletOrEns }
      : {}),
    walletType: collector.walletType,
    ...(isString(collector.referralCode)
      ? { referralCode: collector.referralCode }
      : {}),
    email: collector.email,
    ensName: collector.ensName,
    ensDomain: collector.ensDomain,
    useAnotherWallet: collector.useAnotherWallet,
    ...(isString(collector.notes) ? { notes: collector.notes } : {}),
  }
  return {
    quoteVersion: value.quoteVersion,
    network: value.network,
    walletProvider: value.walletProvider,
    collector: typedCollector,
  }
}

const ORDER_CONFIRMATION_DELAY_MS = 1200

const scheduledOrderTransitions = new Map<string, ReturnType<typeof setTimeout>>()

function emitOrderStockUpdates(order: OrderDto): void {
  for (const item of order.snapshot.items) {
    const nft = getMockNfts().find((entry) => entry.id === item.nftId)
    if (nft) emitNftUpdated(createNftUpdatedEvent(nft))
  }
}

// Sob `order-pending` o pedido só avança quando alguém o confirma ou recusa
// (toolbar ou `/__mock__/simulate-order-update`), o que permite testar o estado pendente.
function scheduleOrderConfirmation(
  order: OrderDto,
  scenario: MockScenarioId,
): void {
  if (
    scenario === 'order-pending' ||
    order.status !== 'pending' ||
    scheduledOrderTransitions.has(order.id)
  ) {
    return
  }
  const timer = setTimeout(() => {
    const confirmed = transitionMockOrder(order.userId, order.id, 'confirmed')
    if (confirmed) emitOrderUpdated(confirmed)
    scheduledOrderTransitions.delete(order.id)
  }, ORDER_CONFIRMATION_DELAY_MS)
  scheduledOrderTransitions.set(order.id, timer)
}

// Os timers vivem na página: ao recarregar, pedidos pendentes retomam a simulação.
function resumePendingOrders(): void {
  const scenario = getStoredMockScenario()
  for (const order of listMockPendingOrders()) {
    scheduleOrderConfirmation(order, scenario)
  }
}

const timeoutRecoveryKeys = new Set<string>()
// Mudanças "durante a compra" disparam uma única vez por usuário e cenário,
// senão o usuário ficaria preso em um ciclo infinito de revisão.
const duringPurchaseChanges = new Set<string>()

function isEditionType(value: unknown): value is NftEditionType {
  return NFT_EDITION_TYPES.some((edition) => edition === value)
}

function cartMutationError(error: unknown) {
  if (!(error instanceof RangeError)) {
    return jsonError('Não foi possível atualizar o carrinho.', 500, 'CART_ERROR')
  }
  if (error.message === 'INSUFFICIENT_STOCK') {
    return jsonError(
      'A quantidade solicitada excede as edições disponíveis.',
      409,
      'INSUFFICIENT_STOCK',
    )
  }
  if (error.message === 'CART_ITEM_NOT_FOUND') {
    return jsonError('Item não encontrado no carrinho.', 404, 'CART_ITEM_NOT_FOUND')
  }
  if (error.message === 'EDITION_UNAVAILABLE') {
    return jsonError('Esta edição não está disponível para o NFT.', 409, 'EDITION_UNAVAILABLE')
  }
  if (error.message === 'COUPON_EXPIRED') {
    return jsonError('Este código promocional expirou.', 422, 'COUPON_EXPIRED')
  }
  if (error.message === 'INVALID_COUPON') {
    return jsonError('Código promocional inválido.', 422, 'INVALID_COUPON')
  }
  if (error.message === 'COUPON_MINIMUM_NOT_MET') {
    return jsonError(
      'O subtotal mínimo para este cupom é 2.00 ETH.',
      422,
      'COUPON_MINIMUM_NOT_MET',
    )
  }
  if (error.message === 'NFT não encontrado.') {
    return jsonError('NFT não encontrado.', 404, 'NFT_NOT_FOUND')
  }
  return jsonError(error.message, 400, 'INVALID_CART_INPUT')
}

let outOfOrderRequestCount = 0
let slowNetworkRequestCount = 0
let sessionExpiredScenarioTriggered = false

// Sequência fixa e irregular: a lentidão varia entre requisições, mas os testes continuam reproduzíveis.
const SLOW_NETWORK_DELAYS_MS = [900, 1500, 400, 1200, 700] as const

/** Restaura os contadores e disparos únicos dos cenários para um estado conhecido. */
function resetScenarioState(): void {
  outOfOrderRequestCount = 0
  slowNetworkRequestCount = 0
  sessionExpiredScenarioTriggered = false
  timeoutRecoveryKeys.clear()
  duringPurchaseChanges.clear()
  for (const timer of scheduledOrderTransitions.values()) clearTimeout(timer)
  scheduledOrderTransitions.clear()
  resetSocketServerState()
}

/**
 * Cenários `price-change-on-checkout` e `edition-sold-out`: na primeira tentativa de
 * compra o catálogo muda (REST + evento `nft.updated`) e o pedido é recusado com 409,
 * obrigando o usuário a revisar a nova cotação.
 */
function applyDuringPurchaseScenario(
  userId: string,
  scenario: MockScenarioId,
): Response | null {
  if (scenario !== 'price-change-on-checkout' && scenario !== 'edition-sold-out') {
    return null
  }
  const triggerKey = `${userId}:${scenario}`
  if (duringPurchaseChanges.has(triggerKey)) return null
  const [firstItem] = getMockCheckoutQuote(userId).items
  if (!firstItem) return null
  duringPurchaseChanges.add(triggerKey)

  if (scenario === 'price-change-on-checkout') {
    const updated = updateMockNft(firstItem.nftId, {
      priceEth: addEth(firstItem.unitPriceEth, '0.05'),
    })
    if (updated) emitNftUpdated(createNftUpdatedEvent(updated))
    return jsonError(
      `O preço de ${firstItem.title} mudou durante a compra. Revise os novos valores antes de confirmar.`,
      409,
      'STALE_QUOTE',
    )
  }
  const updated = updateMockNft(firstItem.nftId, { availableEditions: 0 })
  if (updated) emitNftUpdated(createNftUpdatedEvent(updated))
  return jsonError(
    `A edição de ${firstItem.title} esgotou durante a compra. Revise o carrinho.`,
    409,
    'EDITION_SOLD_OUT',
  )
}

const SCENARIO_GATE_EXEMPT_PATHS = /^\/api\/(__mock__|auth)\//

// Avatar enviado pelo usuário é reduzido no cliente e trafega como data URL (≤ 300.000 caracteres).
const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/
const AVATAR_DATA_URL_MAX_LENGTH = 300_000

/**
 * Primeiro handler: aplica lentidão (`slow-network`) e falha 5xx (`server-error-500`) a toda a
 * API de dados. Retornar `undefined` faz o MSW seguir para o handler específico da rota.
 */
const scenarioGateHandler = http.all('/api/*', async ({ request }) => {
  if (SCENARIO_GATE_EXEMPT_PATHS.test(new URL(request.url).pathname)) return
  const scenario = getScenario(request)
  if (scenario === 'slow-network') {
    const delayMs =
      SLOW_NETWORK_DELAYS_MS[slowNetworkRequestCount % SLOW_NETWORK_DELAYS_MS.length]
    slowNetworkRequestCount += 1
    await delay(delayMs)
  }
  if (scenario === 'server-error-500') {
    return jsonError('Falha simulada no servidor.', 500, 'MOCK_SERVER_ERROR')
  }
})

export const handlers = [
  socketIoHandler,
  scenarioGateHandler,
  http.post('/api/checkout/quote', ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const quote = getMockCheckoutQuote(auth.userId)
    if (quote.items.length === 0) {
      return jsonError('Seu carrinho está vazio.', 422, 'EMPTY_CART')
    }
    return HttpResponse.json(quote)
  }),
  http.post('/api/orders', async ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim()
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return jsonError(
        'O header Idempotency-Key é obrigatório.',
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
      )
    }
    const input = parseCreateOrderInput(await request.json().catch(() => null))
    if (!input) {
      return jsonError('Dados inválidos para criar o pedido.', 400, 'INVALID_ORDER_INPUT')
    }
    const fieldErrors = validateCollector(input.collector)
    if (input.network !== input.collector.network) fieldErrors.network = 'A rede deve corresponder à carteira selecionada.'
    if (input.walletProvider !== input.collector.walletType) fieldErrors.walletType = 'O provedor deve corresponder à carteira selecionada.'
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        { message: 'Revise os campos indicados.', code: 'VALIDATION_ERROR', fieldErrors },
        { status: 422 },
      )
    }
    const scenario = getScenario(request)
    const alreadyCreated = getMockOrderByIdempotencyKey(auth.userId, idempotencyKey)
    if (!alreadyCreated) {
      const pendingOrder = getMockOrders(auth.userId).find((order) => order.status === 'pending')
      if (pendingOrder) {
        return jsonError('Você já tem uma compra em processamento. Aguarde sua conclusão.', 409, 'ORDER_PENDING')
      }
      const changedDuringPurchase = applyDuringPurchaseScenario(
        auth.userId,
        scenario,
      )
      if (changedDuringPurchase) return changedDuringPurchase
    }
    const status: OrderStatus =
      scenario === 'payment-declined' ? 'declined' : 'pending'
    const result = createMockOrder(
      auth.userId,
      idempotencyKey,
      input,
      status,
    )
    if (result.kind === 'idempotency-conflict') {
      return jsonError(
        'Esta chave de idempotência já foi usada com dados diferentes.',
        409,
        'IDEMPOTENCY_CONFLICT',
      )
    }
    if (result.kind === 'stale') {
      return jsonError(
        'Os valores do carrinho mudaram. Revise a cotação antes de confirmar.',
        409,
        'STALE_QUOTE',
      )
    }
    if (result.kind === 'unavailable') {
      return jsonError(result.message, 409, 'EDITION_SOLD_OUT')
    }
    if (result.kind === 'invalid-cart') {
      return jsonError(result.message, 409, 'CART_NOT_PURCHASABLE')
    }

    if (result.kind === 'created' && result.order.status !== 'declined') {
      emitOrderStockUpdates(result.order)
    }
    if (result.order.status === 'declined') {
      if (result.kind === 'created') emitOrderUpdated(result.order)
    } else {
      scheduleOrderConfirmation(result.order, scenario)
    }

    if (
      scenario === 'order-timeout-recovery' &&
      result.kind === 'created' &&
      !timeoutRecoveryKeys.has(`${auth.userId}:${idempotencyKey}`)
    ) {
      timeoutRecoveryKeys.add(`${auth.userId}:${idempotencyKey}`)
      return jsonError(
        'A confirmação da rede demorou. Você pode tentar novamente com segurança.',
        504,
        'ORDER_TIMEOUT',
      )
    }
    return HttpResponse.json(
      { order: result.order },
      { status: result.kind === 'created' ? 201 : 200 },
    )
  }),
  http.get('/api/orders', ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    return HttpResponse.json({ orders: getMockOrders(auth.userId) })
  }),
  http.get('/api/orders/:orderId', ({ params, request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const order = getMockOrder(auth.userId, String(params.orderId))
    if (!order) {
      const ownerId = getMockOrderOwnerId(String(params.orderId))
      if (ownerId && ownerId !== auth.userId) {
        return jsonError(
          'Você não tem permissão para acessar este pedido.',
          403,
          'ORDER_FORBIDDEN',
        )
      }
      return jsonError('Pedido não encontrado.', 404, 'ORDER_NOT_FOUND')
    }
    return HttpResponse.json({ order })
  }),
  http.post('/api/__mock__/simulate-order-update', async ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const body: unknown = await request.json().catch(() => null)
    if (
      !isRecord(body) ||
      !isString(body.orderId) ||
      (body.status !== 'confirmed' && body.status !== 'declined')
    ) {
      return jsonError('Informe um pedido e um estado terminal válido.', 400, 'INVALID_ORDER_UPDATE')
    }
    const order = getMockOrder(auth.userId, body.orderId)
    if (!order) return jsonError('Pedido não encontrado.', 404, 'ORDER_NOT_FOUND')
    const updatedOrder = transitionMockOrder(
      order.userId,
      order.id,
      body.status,
      isString(body.failureReason) ? body.failureReason : undefined,
    )
    if (!updatedOrder) {
      return jsonError('Somente pedidos pendentes podem ser atualizados.', 409, 'ORDER_NOT_PENDING')
    }
    if (updatedOrder.status === 'declined') emitOrderStockUpdates(updatedOrder)
    emitOrderUpdated(updatedOrder)
    return HttpResponse.json({ order: updatedOrder })
  }),
  http.get('/api/profile', ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const profile = getMockProfile(auth.userId)
    if (!profile) return jsonError('Perfil não encontrado.', 404, 'PROFILE_NOT_FOUND')
    return HttpResponse.json(profile)
  }),
  http.patch('/api/profile', async ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const body: unknown = await request.json().catch(() => null)
    if (!isRecord(body)) {
      return jsonError('Informe os dados do perfil.', 400, 'INVALID_PROFILE_INPUT')
    }
    const input: UpdateProfileRequestDto = {
      displayName: isString(body.displayName) ? body.displayName.trim() : '',
      username: isString(body.username) ? body.username.trim() : '',
      email: isString(body.email) ? body.email.trim() : '',
      ensName: isString(body.ensName) ? body.ensName.trim() : '',
      ensDomain: isString(body.ensDomain) ? body.ensDomain : '',
      walletNickname: isString(body.walletNickname)
        ? body.walletNickname.trim()
        : '',
      avatarUrl:
        body.avatarUrl === null || isString(body.avatarUrl)
          ? body.avatarUrl
          : null,
    }
    const fieldErrors: Record<string, string> = validateProfile(input)
    if (typeof input.avatarUrl === 'string') {
      const isPresetAvatar = input.avatarUrl.startsWith('/mock-assets/nfts/')
      const isUploadedAvatar =
        input.avatarUrl.length <= AVATAR_DATA_URL_MAX_LENGTH &&
        AVATAR_DATA_URL_PATTERN.test(input.avatarUrl)
      const isRemoteAvatar = /^https?:\/\/\S+$/i.test(input.avatarUrl)
      if (!isPresetAvatar && !isUploadedAvatar && !isRemoteAvatar) {
        fieldErrors.avatarUrl =
          'Envie uma imagem PNG, JPEG ou WebP de até 200 KB, ou escolha uma das artes KURIO.'
      }
    }
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        { message: 'Revise os campos indicados.', code: 'VALIDATION_ERROR', fieldErrors },
        { status: 422 },
      )
    }
    try {
      const profile = updateMockProfile(auth.userId, input)
      if (!profile) return jsonError('Perfil não encontrado.', 404, 'PROFILE_NOT_FOUND')
      return HttpResponse.json(profile)
    } catch (error) {
      if (error instanceof RangeError && error.message === 'EMAIL_EXISTS') {
        return HttpResponse.json(
          {
            message: 'Este e-mail já está cadastrado.',
            code: 'USER_ALREADY_EXISTS',
            fieldErrors: { email: 'Este e-mail já está cadastrado.' },
          },
          { status: 409 },
        )
      }
      if (error instanceof RangeError && error.message === 'USERNAME_EXISTS') {
        return HttpResponse.json(
          {
            message: 'Este nome de usuário já está em uso.',
            code: 'USER_ALREADY_EXISTS',
            fieldErrors: { username: 'Este nome de usuário já está em uso.' },
          },
          { status: 409 },
        )
      }
      throw error
    }
  }),
  http.post('/api/profile/password', async ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const body: unknown = await request.json().catch(() => null)
    if (
      !isRecord(body) ||
      !isString(body.currentPassword) ||
      !isString(body.newPassword) ||
      !isString(body.confirmPassword)
    ) {
      return jsonError('Preencha os campos de senha.', 400, 'INVALID_PASSWORD_INPUT')
    }
    const input: UpdatePasswordRequestDto = {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
    }
    const fieldErrors = validatePasswordChange(input)
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        { message: 'Revise os campos indicados.', code: 'VALIDATION_ERROR', fieldErrors },
        { status: 422 },
      )
    }
    if (
      !(await updateMockPassword(
        auth.userId,
        input.currentPassword,
        input.newPassword,
      ))
    ) {
      return HttpResponse.json(
        {
          message: 'A senha atual está incorreta.',
          code: 'INVALID_CURRENT_PASSWORD',
          fieldErrors: { currentPassword: 'A senha atual está incorreta.' },
        },
        { status: 422 },
      )
    }
    return HttpResponse.json({ success: true })
  }),
  http.get('/api/wallets', ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    return HttpResponse.json({ wallets: getMockWallets(auth.userId) })
  }),
  http.post('/api/wallets', async ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const body: unknown = await request.json().catch(() => null)
    if (!isRecord(body)) {
      return jsonError('Informe os dados da carteira.', 400, 'INVALID_WALLET_INPUT')
    }
    const input = toWalletInput(body)
    if (!input) {
      return jsonError('Informe os dados obrigatórios da carteira.', 400, 'INVALID_WALLET_INPUT')
    }
    const fieldErrors = validateWallet(input)
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        { message: 'Revise os campos indicados.', code: 'VALIDATION_ERROR', fieldErrors },
        { status: 422 },
      )
    }
    const wallet = createMockWallet(auth.userId, input)
    if (!wallet) return jsonError('Usuário não encontrado.', 404, 'USER_NOT_FOUND')
    return HttpResponse.json({ wallet, wallets: getMockWallets(auth.userId) }, { status: 201 })
  }),
  http.patch('/api/wallets/:id', async ({ params, request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    const body: unknown = await request.json().catch(() => null)
    if (!isRecord(body)) {
      return jsonError('Informe os dados da carteira.', 400, 'INVALID_WALLET_INPUT')
    }
    const input = toWalletInput(body)
    if (!input) {
      return jsonError('Informe os dados obrigatórios da carteira.', 400, 'INVALID_WALLET_INPUT')
    }
    const fieldErrors = validateWallet(input)
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        { message: 'Revise os campos indicados.', code: 'VALIDATION_ERROR', fieldErrors },
        { status: 422 },
      )
    }
    const wallet = updateMockWallet(auth.userId, String(params.id), input)
    if (!wallet) return jsonError('Carteira não encontrada.', 404, 'WALLET_NOT_FOUND')
    return HttpResponse.json({ wallet, wallets: getMockWallets(auth.userId) })
  }),
  http.delete('/api/wallets/:id', ({ params, request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    if (!deleteMockWallet(auth.userId, String(params.id))) {
      return jsonError('Carteira não encontrada.', 404, 'WALLET_NOT_FOUND')
    }
    return HttpResponse.json({ wallets: getMockWallets(auth.userId) })
  }),
  http.post('/api/auth/login', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.email !== 'string' ||
      typeof body.password !== 'string'
    ) {
      return jsonError('Informe e-mail e senha.', 400, 'INVALID_AUTH_INPUT')
    }
    const input: LoginRequestDto = {
      email: body.email,
      password: body.password,
    }
    const result = await authenticateMockUser(input.email, input.password)
    if (!result) {
      return jsonError(
        'E-mail ou senha inválidos.',
        401,
        'INVALID_CREDENTIALS',
      )
    }
    mergeGuestSession(request, result.session.user.id)
    return HttpResponse.json<AuthResponseDto>(result)
  }),
  http.post('/api/auth/register', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.username !== 'string' ||
      typeof body.email !== 'string' ||
      typeof body.password !== 'string' ||
      typeof body.confirmPassword !== 'string'
    ) {
      return jsonError('Preencha todos os campos.', 400, 'INVALID_AUTH_INPUT')
    }
    const input: RegisterRequestDto = {
      username: body.username.trim(),
      email: body.email.trim(),
      password: body.password,
      confirmPassword: body.confirmPassword,
    }
    const fieldErrors = validateRegistration(input)
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        { message: 'Revise os campos indicados.', code: 'VALIDATION_ERROR', fieldErrors },
        { status: 422 },
      )
    }
    const duplicateField = findMockUserByEmailOrUsername(
      input.email,
      input.username,
    )
    if (duplicateField) {
      const duplicateMessage =
        duplicateField === 'email'
          ? 'Este e-mail já está cadastrado.'
          : 'Este nome de usuário já está em uso.'
      return HttpResponse.json(
        {
          message: duplicateMessage,
          code: 'USER_ALREADY_EXISTS',
          fieldErrors: { [duplicateField]: duplicateMessage },
        },
        { status: 409 },
      )
    }
    const result = await registerMockUser({
      username: input.username,
      email: input.email,
      password: input.password,
    })
    mergeGuestSession(request, result.session.user.id)
    return HttpResponse.json<AuthResponseDto>(result, { status: 201 })
  }),
  http.get('/api/auth/session', ({ request }) => {
    const token = getBearerToken(request)
    if (!token) {
      return HttpResponse.json<AuthSessionResponseDto>({
        session: null,
        wallets: [],
      })
    }
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    return HttpResponse.json<AuthSessionResponseDto>({
      session: getMockSession(token)?.session ?? null,
      wallets: getMockSession(token)?.wallets ?? [],
    })
  }),
  http.post('/api/auth/logout', ({ request }) => {
    const token = getBearerToken(request)
    if (token) revokeMockSession(token)
    return HttpResponse.json({ success: true })
  }),
  http.get('/api/nfts', async ({ request }) => {
    const scenario = getScenario(request)
    if (scenario === 'out-of-order') {
      outOfOrderRequestCount += 1
      await delay(outOfOrderRequestCount === 1 ? 1600 : 150)
    } else {
      outOfOrderRequestCount = 0
    }

    const url = new URL(request.url)
    const search = normalizeSearchText(url.searchParams.get('search') ?? '')
    const categories = splitQueryValues(url.searchParams, 'categories')
    const networks = splitQueryValues(url.searchParams, 'networks')
    const minPriceEth = url.searchParams.get('minPriceEth')
    const maxPriceEth = url.searchParams.get('maxPriceEth')
    const tab = url.searchParams.get('tab')
    const sort = url.searchParams.get('sort') ?? 'recent'
    const page = parsePositiveInteger(url.searchParams.get('page'), 1)
    const limit = Math.min(
      parsePositiveInteger(url.searchParams.get('limit'), 12),
      100,
    )
    const featuredOnly = url.searchParams.get('featured') === 'true'

    const priceErrors = validatePriceFilter(minPriceEth, maxPriceEth)
    if (Object.keys(priceErrors).length > 0) {
      return HttpResponse.json(
        {
          message: 'Revise o filtro de preço.',
          code: 'VALIDATION_ERROR',
          fieldErrors: priceErrors,
        },
        { status: 422 },
      )
    }

    let items = getMockNfts().filter((nft) => {
      if (
        search &&
        !normalizeSearchText(
          `${nft.title} ${nft.collectionName} ${nft.description} ${nft.tokenId}`,
        ).includes(search)
      ) {
        return false
      }
      if (categories.length > 0 && !categories.includes(nft.category)) {
        return false
      }
      if (networks.length > 0 && !networks.includes(nft.network)) {
        return false
      }
      if (
        minPriceEth &&
        compareEth(nft.priceEth, minPriceEth) < 0
      ) {
        return false
      }
      if (
        maxPriceEth &&
        compareEth(nft.priceEth, maxPriceEth) > 0
      ) {
        return false
      }
      if (tab === 'new' && !nft.isLaunch) return false
      if (tab === 'trending' && nft.rating < 4.7) return false
      if (featuredOnly && !nft.isFeatured) return false
      return true
    })
    if (scenario === 'empty-results') items = []

    switch (sort) {
      case 'price_asc':
        items = items.toSorted((a, b) => compareEth(a.priceEth, b.priceEth))
        break
      case 'price_desc':
        items = items.toSorted((a, b) => compareEth(b.priceEth, a.priceEth))
        break
      case 'rating_desc':
        items = items.toSorted((a, b) => b.rating - a.rating)
        break
      default:
        items = items.toSorted(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
    }

    const total = items.length
    const totalPages = Math.ceil(total / limit)
    const response: CatalogResponse = {
      items: items.slice((page - 1) * limit, page * limit),
      total,
      page,
      limit,
      totalPages,
      counts: getCatalogCounts(),
    }

    return HttpResponse.json(response)
  }),
  http.get('/api/nfts/:id', ({ params }) => {
    const items = getMockNfts()
    const requestedId = String(params.id)
    const fixtureAlias = /^nft-(\d+)$/.exec(requestedId)
    const fixtureIndex = fixtureAlias ? Number(fixtureAlias[1]) - 1 : -1
    const nft = items.find(
      (item) => item.id === params.id || item.slug === params.id,
    ) ?? (Number.isSafeInteger(fixtureIndex) ? items[fixtureIndex] : undefined)
    if (!nft) {
      return jsonError('NFT não encontrado.', 404, 'NFT_NOT_FOUND')
    }
    return HttpResponse.json(nft)
  }),
  http.get('/api/favorites', ({ request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    return HttpResponse.json({
      nftIds: getMockFavorites(`user:${auth.userId}`),
    })
  }),
  http.post('/api/favorites/:nftId', ({ params, request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const nftId = String(params.nftId)
    if (!getMockNfts().some((item) => item.id === nftId)) {
      return jsonError('NFT não encontrado.', 404, 'NFT_NOT_FOUND')
    }
    const sessionId = `user:${auth.userId}`
    const favorites = getMockFavorites(sessionId)
    return HttpResponse.json({
      nftIds: saveMockFavorites(sessionId, [...favorites, nftId]),
    })
  }),
  http.delete('/api/favorites/:nftId', ({ params, request }) => {
    const auth = requireAuthenticatedUser(request)
    if (auth.response) return auth.response
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const sessionId = `user:${auth.userId}`
    const nftId = String(params.nftId)
    return HttpResponse.json({
      nftIds: saveMockFavorites(
        sessionId,
        getMockFavorites(sessionId).filter((id) => id !== nftId),
      ),
    })
  }),
  http.get('/api/cart', ({ request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    return HttpResponse.json(getMockCart(getFavoritesSessionId(request)))
  }),
  http.post('/api/cart/items', async ({ request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const body: unknown = await request.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.nftId !== 'string' ||
      typeof body.quantity !== 'number' ||
      !Number.isSafeInteger(body.quantity) ||
      (body.editionType !== undefined && !isEditionType(body.editionType))
    ) {
      return jsonError('Dados inválidos para adicionar ao carrinho.', 400, 'INVALID_CART_INPUT')
    }
    const input: AddCartItemInput = {
      nftId: body.nftId,
      quantity: body.quantity,
      ...(isEditionType(body.editionType)
        ? { editionType: body.editionType }
        : {}),
    }
    try {
      return HttpResponse.json(
        addMockCartItem(
          getFavoritesSessionId(request),
          input.nftId,
          input.quantity,
          input.editionType,
        ),
      )
    } catch (error) {
      return cartMutationError(error)
    }
  }),
  http.patch('/api/cart/items/:itemId', async ({ params, request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const body: unknown = await request.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.quantity !== 'number' ||
      !Number.isSafeInteger(body.quantity)
    ) {
      return jsonError('Informe uma quantidade inteira válida.', 400, 'INVALID_CART_INPUT')
    }
    const input: UpdateCartItemInput = { quantity: body.quantity }
    try {
      return HttpResponse.json(
        updateMockCartItem(
          getFavoritesSessionId(request),
          String(params.itemId),
          input.quantity,
        ),
      )
    } catch (error) {
      return cartMutationError(error)
    }
  }),
  http.delete('/api/cart/items/:itemId', ({ params, request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    try {
      return HttpResponse.json(
        removeMockCartItem(
          getFavoritesSessionId(request),
          String(params.itemId),
        ),
      )
    } catch (error) {
      return cartMutationError(error)
    }
  }),
  http.post('/api/cart/coupon', async ({ request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const body: unknown = await request.json().catch(() => null)
    if (!isRecord(body) || typeof body.code !== 'string') {
      return jsonError('Informe um código promocional válido.', 400, 'INVALID_CART_INPUT')
    }
    const input: ApplyCartCouponInput = { code: body.code }
    try {
      return HttpResponse.json(
        applyMockCartCoupon(getFavoritesSessionId(request), input.code),
      )
    } catch (error) {
      return cartMutationError(error)
    }
  }),
  http.delete('/api/cart/coupon', ({ request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    return HttpResponse.json(
      removeMockCartCoupon(getFavoritesSessionId(request)),
    )
  }),
  http.post('/api/cart/acknowledge-changes', ({ request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    return HttpResponse.json(
      acknowledgeMockCartChanges(getFavoritesSessionId(request)),
    )
  }),
  http.post('/api/__mock__/reset', () => {
    const items = resetMockDb()
    resetScenarioState()
    setMockScenario('default')
    return HttpResponse.json({ items, scenario: 'default' })
  }),
  http.post('/api/__mock__/simulate-nft-update', async ({ request }) => {
    const body: unknown = await request.json().catch(() => null)
    if (
      !isRecord(body) ||
      typeof body.nftId !== 'string' ||
      typeof body.priceEth !== 'string' ||
      typeof body.availableEditions !== 'number' ||
      !Number.isSafeInteger(body.availableEditions) ||
      body.availableEditions < 0
    ) {
      return jsonError('Dados inválidos para atualizar o NFT.', 400, 'INVALID_UPDATE')
    }

    try {
      parseEthToWei(body.priceEth)
    } catch {
      return jsonError('Preço ETH inválido.', 400, 'INVALID_ETH_PRICE')
    }

    const updatedNft = updateMockNft(body.nftId, {
      priceEth: body.priceEth,
      availableEditions: body.availableEditions,
    })
    if (!updatedNft) {
      return jsonError('NFT não encontrado.', 404, 'NFT_NOT_FOUND')
    }

    const event = createNftUpdatedEvent(updatedNft)
    emitNftUpdated(event)
    return HttpResponse.json(event)
  }),
  http.post('/api/__mock__/simulate-duplicate-events', () => {
    if (!replayLastNftEvent()) {
      return jsonError(
        'Dispare um evento nft.updated antes de testar duplicatas.',
        409,
        'NO_EVENT_TO_REPLAY',
      )
    }
    return HttpResponse.json({ replayed: 2 })
  }),
  http.post('/api/__mock__/simulate-socket-drop', () =>
    HttpResponse.json({ closedConnections: dropSocketConnections() }),
  ),
]

resumePendingOrders()
