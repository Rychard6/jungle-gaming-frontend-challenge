import { toSocketIo } from '@mswjs/socket.io-binding'
import { delay, http, HttpResponse, ws } from 'msw'
import {
  compareEth,
  parseEthToWei,
} from '../shared/lib/eth-math'
import { setMockScenario } from '../shared/api/http'
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
  NftItem,
  NftUpdatedEvent,
  OrderDto,
  OrderStatus,
  OrderUpdatedEvent,
  RegisterRequestDto,
  WalletProviderType,
  BlockchainNetwork,
  UpdatePasswordRequestDto,
  UpdateProfileRequestDto,
  WalletInputDto,
  UpdateCartItemInput,
} from '../shared/api/types'
import {
  acknowledgeMockCartChanges,
  authenticateMockUser,
  addMockCartItem,
  applyMockCartCoupon,
  createMockOrder,
  createMockWallet,
  deleteMockWallet,
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
  removeMockCartCoupon,
  removeMockCartItem,
  resetMockDb,
  mergeMockGuestCart,
  registerMockUser,
  revokeMockSession,
  saveMockFavorites,
  saveMockNfts,
  updateMockPassword,
  updateMockProfile,
  updateMockWallet,
  updateMockCartItem,
  transitionMockOrder,
} from './db'

// MSW normalizes Socket.IO's default path to "/" before matching WebSocket handlers.
const socketIoLink = ws.link(/\/socket\.io\/|\/$/)
const socketClients = new Set<
  ReturnType<typeof toSocketIo>['client']
>()

const socketIoHandler = socketIoLink.addEventListener('connection', (connection) => {
  const socket = toSocketIo(connection)
  socketClients.add(socket.client)
  connection.client.addEventListener('close', () => {
    socketClients.delete(socket.client)
  })
})

function getScenario(request: Request): string {
  return request.headers.get('x-mock-scenario') ?? 'default'
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

function jsonError(message: string, status: number, code: string) {
  return HttpResponse.json({ message, code }, { status })
}

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

function validateWalletInput(input: WalletInputDto): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  const requiredFields: Array<[keyof WalletInputDto, string]> = [
    ['displayName', 'Informe um nome de exibição.'],
    ['walletNickname', 'Informe um apelido para a carteira.'],
    ['profileName', 'Informe o nome do perfil.'],
    ['address', 'Informe o endereço da carteira.'],
    ['referralCode', 'Informe o código de indicação.'],
    ['ensName', 'Informe seu nome ENS.'],
  ]
  for (const [field, message] of requiredFields) {
    if (!input[field]?.toString().trim()) fieldErrors[field] = message
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    fieldErrors.email = 'Informe um e-mail válido.'
  }
  if (!/^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4})$/.test(input.address)) {
    fieldErrors.address = 'Informe um endereço 0x válido.'
  }
  if (!['.eth', '.kurio', '.xyz'].includes(input.ensDomain)) {
    fieldErrors.ensDomain = 'Selecione um domínio ENS válido.'
  }
  if (
    input.secondaryAddressOrEns &&
    !input.secondaryAddressOrEns.includes('.') &&
    !/^0x[a-fA-F0-9]{4,}$/.test(input.secondaryAddressOrEns)
  ) {
    fieldErrors.secondaryAddressOrEns = 'Informe um ENS ou endereço válido.'
  }
  return fieldErrors
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

function createOrderUpdatedEvent(order: OrderDto): OrderUpdatedEvent {
  return {
    eventId: crypto.randomUUID(),
    type: 'order.updated',
    resourceId: order.id,
    version: order.version,
    userId: order.userId,
    timestamp: order.updatedAt,
    payload: {
      orderId: order.id,
      status: order.status,
      transactionHash: order.transactionHash,
      ...(order.failureReason ? { failureReason: order.failureReason } : {}),
    },
  }
}

function emitOrderUpdated(order: OrderDto): void {
  const event = createOrderUpdatedEvent(order)
  for (const client of socketClients) {
    client.emit('order.updated', event)
  }
}

const scheduledOrderTransitions = new Set<string>()
function scheduleOrderConfirmation(order: OrderDto): void {
  if (order.status !== 'pending' || scheduledOrderTransitions.has(order.id)) {
    return
  }
  scheduledOrderTransitions.add(order.id)
  setTimeout(() => {
    const confirmed = transitionMockOrder(order.userId, order.id, 'confirmed')
    if (confirmed) emitOrderUpdated(confirmed)
    scheduledOrderTransitions.delete(order.id)
  }, 1200)
}

const timeoutRecoveryKeys = new Set<string>()

function isEditionType(value: unknown): value is NftEditionType {
  return value === '1/1' || value === '1/10' || value === '1/50' || value === 'ABERTA'
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
let sessionExpiredScenarioTriggered = false

export const handlers = [
  socketIoHandler,
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
    const scenario = getScenario(request)
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
    if (result.kind === 'invalid-cart') {
      return jsonError(result.message, 409, 'CART_NOT_PURCHASABLE')
    }

    if (result.order.status === 'declined') {
      if (result.kind === 'created') emitOrderUpdated(result.order)
    } else {
      scheduleOrderConfirmation(result.order)
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
    if (!order) return jsonError('Pedido não encontrado.', 404, 'ORDER_NOT_FOUND')
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
    const fieldErrors: Record<string, string> = {}
    if (input.displayName.length < 2) {
      fieldErrors.displayName = 'Informe um nome de exibição com pelo menos 2 caracteres.'
    }
    if (input.username.length < 3) {
      fieldErrors.username = 'O nome de usuário deve ter pelo menos 3 caracteres.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      fieldErrors.email = 'Informe um e-mail válido.'
    }
    if (!input.ensName) fieldErrors.ensName = 'Informe seu nome ENS.'
    if (!['.eth', '.kurio', '.xyz'].includes(input.ensDomain)) {
      fieldErrors.ensDomain = 'Selecione um domínio ENS válido.'
    }
    if (input.walletNickname.length < 2) {
      fieldErrors.walletNickname = 'Informe um apelido de carteira.'
    }
    if (
      typeof input.avatarUrl === 'string' &&
      !input.avatarUrl.startsWith('/mock-assets/nfts/') &&
      !/^https?:\/\/\S+$/i.test(input.avatarUrl)
    ) {
      fieldErrors.avatarUrl = 'Informe uma URL http(s) válida para o avatar.'
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
    const fieldErrors: Record<string, string> = {}
    if (input.newPassword.length < 8) {
      fieldErrors.newPassword = 'A nova senha deve ter pelo menos 8 caracteres.'
    }
    if (input.newPassword !== input.confirmPassword) {
      fieldErrors.confirmPassword = 'As senhas não coincidem.'
    }
    if (Object.keys(fieldErrors).length > 0) {
      return HttpResponse.json(
        { message: 'Revise os campos indicados.', code: 'VALIDATION_ERROR', fieldErrors },
        { status: 422 },
      )
    }
    if (
      !updateMockPassword(
        auth.userId,
        input.currentPassword,
        input.newPassword,
      )
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
    const fieldErrors = validateWalletInput(input)
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
    const fieldErrors = validateWalletInput(input)
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
    const result = authenticateMockUser(input.email, input.password)
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
    const fieldErrors: Record<string, string> = {}
    if (input.username.length < 3) {
      fieldErrors.username = 'O nome de usuário deve ter pelo menos 3 caracteres.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      fieldErrors.email = 'Informe um e-mail válido.'
    }
    if (input.password.length < 8) {
      fieldErrors.password = 'A senha deve ter pelo menos 8 caracteres.'
    }
    if (input.password !== input.confirmPassword) {
      fieldErrors.confirmPassword = 'As senhas não coincidem.'
    }
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
    const result = registerMockUser({
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
    if (scenario === 'slow-network') await delay(900)
    if (scenario === 'out-of-order') {
      outOfOrderRequestCount += 1
      await delay(outOfOrderRequestCount === 1 ? 1600 : 150)
    } else {
      outOfOrderRequestCount = 0
    }
    if (scenario === 'server-error-500') {
      return jsonError('Falha simulada no servidor.', 500, 'MOCK_SERVER_ERROR')
    }

    const url = new URL(request.url)
    const search = url.searchParams.get('search')?.trim().toLocaleLowerCase()
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

    let items = getMockNfts().filter((nft) => {
      if (
        search &&
        !`${nft.title} ${nft.collectionName} ${nft.description} ${nft.tokenId}`
          .toLocaleLowerCase()
          .includes(search)
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
      return true
    })

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
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    return HttpResponse.json({
      nftIds: getMockFavorites(getFavoritesSessionId(request)),
    })
  }),
  http.post('/api/favorites/:nftId', ({ params, request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const nftId = String(params.nftId)
    if (!getMockNfts().some((item) => item.id === nftId)) {
      return jsonError('NFT não encontrado.', 404, 'NFT_NOT_FOUND')
    }
    const sessionId = getFavoritesSessionId(request)
    const favorites = getMockFavorites(sessionId)
    return HttpResponse.json({
      nftIds: saveMockFavorites(sessionId, [...favorites, nftId]),
    })
  }),
  http.delete('/api/favorites/:nftId', ({ params, request }) => {
    const sessionError = getSessionError(request)
    if (sessionError) return sessionError
    if (isNetworkErrorScenario(request)) return HttpResponse.error()
    const sessionId = getFavoritesSessionId(request)
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
    setMockScenario('default')
    return HttpResponse.json({ items, scenario: 'default' })
  }),
  http.post('/api/__mock__/simulate-nft-update', async ({ request }) => {
    const body: unknown = await request.json()
    if (
      !isRecord(body) ||
      !('nftId' in body) ||
      typeof body.nftId !== 'string' ||
      !('priceEth' in body) ||
      typeof body.priceEth !== 'string' ||
      !('availableEditions' in body) ||
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

    const items = getMockNfts()
    const nft = items.find((item) => item.id === body.nftId)
    if (!nft) {
      return jsonError('NFT não encontrado.', 404, 'NFT_NOT_FOUND')
    }

    const updatedNft: NftItem = {
      ...nft,
      priceEth: body.priceEth,
      availableEditions: body.availableEditions,
      version: nft.version + 1,
      updatedAt: new Date().toISOString(),
    }
    saveMockNfts(
      items.map((item) => (item.id === nft.id ? updatedNft : item)),
    )

    const event: NftUpdatedEvent = {
      eventId: crypto.randomUUID(),
      type: 'nft.updated',
      resourceId: nft.id,
      version: updatedNft.version,
      timestamp: updatedNft.updatedAt,
      payload: {
        nftId: nft.id,
        priceEth: updatedNft.priceEth,
        availableEditions: updatedNft.availableEditions,
        editionType: updatedNft.editionType,
      },
    }
    for (const client of socketClients) {
      client.emit('nft.updated', event)
    }

    return HttpResponse.json(event)
  }),
]
