import type { Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import { getAuthToken, getAuthUserId } from '../api/http'
import type {
  CatalogResponse,
  NftItem,
  NftUpdatedEvent,
  OrderDto,
  OrderUpdatedEvent,
} from '../api/types'

type KurioServerEvents = {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}

type KurioClientEvents = Record<string, (...args: never[]) => void>

type ProcessedEvent = NftUpdatedEvent | OrderUpdatedEvent

const PROCESSED_EVENT_ID_LIMIT = 500

type KurioSocket = Socket<KurioServerEvents, KurioClientEvents>

let socket: KurioSocket | undefined
let socketPromise: Promise<KurioSocket> | undefined
let detachSocketListeners: (() => void) | undefined
let queryClientRef: QueryClient | undefined
const lastVersionByResource = new Map<string, number>()
// Conjunto limitado: guarda apenas os eventIds mais recentes para não crescer sem fim.
const processedEventIds = new Set<string>()
let ignoredEventCount = 0
const ignoredEventListeners = new Set<(count: number) => void>()
const connectionListeners = new Set<(connected: boolean) => void>()
const nftUpdateListeners = new Set<(event: NftUpdatedEvent) => void>()
let isConnected = false
let activeSocketUserId: string | null = null

function publishConnectionState(connected: boolean): void {
  isConnected = connected
  for (const listener of connectionListeners) listener(connected)
}

function recordIgnoredEvent(): void {
  ignoredEventCount += 1
  for (const listener of ignoredEventListeners) {
    listener(ignoredEventCount)
  }
}

function rememberEventId(eventId: string): void {
  processedEventIds.add(eventId)
  if (processedEventIds.size > PROCESSED_EVENT_ID_LIMIT) {
    const oldest = processedEventIds.values().next()
    if (!oldest.done) processedEventIds.delete(oldest.value)
  }
}

/**
 * Aplica o evento a um NFT em cache somente se ele for mais novo que o estado já conhecido.
 * Assim, um evento atrasado nunca regride dados que o REST já trouxe mais recentes.
 */
function applyNftEvent(item: NftItem, event: NftUpdatedEvent): NftItem {
  if (item.id !== event.payload.nftId || item.version >= event.version) {
    return item
  }
  return {
    ...item,
    priceEth: event.payload.priceEth,
    availableEditions: event.payload.availableEditions,
    editionType: event.payload.editionType,
    version: event.version,
    updatedAt: event.timestamp,
  }
}

function processNftUpdated(event: NftUpdatedEvent): void {
  const queryClient = queryClientRef
  if (!queryClient) return

  void queryClient.cancelQueries({ queryKey: ['nfts'] })
  void queryClient.cancelQueries({ queryKey: ['nft'] })
  void queryClient.cancelQueries({ queryKey: ['nft-collection'] })
  queryClient.setQueriesData<CatalogResponse>(
    { queryKey: ['nfts'] },
    (current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => applyNftEvent(item, event)),
          }
        : current,
  )
  // O detalhe pode ter sido aberto por slug ou alias; por isso casa pelo `id` canônico.
  queryClient.setQueriesData<NftItem>({ queryKey: ['nft'] }, (current) =>
    current ? applyNftEvent(current, event) : current,
  )
  queryClient.setQueriesData<NftItem[]>(
    { queryKey: ['nft-collection'] },
    (current) => current?.map((item) => applyNftEvent(item, event)),
  )
  void queryClient.invalidateQueries({ queryKey: ['nfts'] })
  void queryClient.invalidateQueries({ queryKey: ['nft-collection'] })
  void queryClient.invalidateQueries({ queryKey: ['cart'] })
  void queryClient.invalidateQueries({ queryKey: ['checkout', 'quote'] })
  for (const listener of nftUpdateListeners) listener(event)
}

function canApplyOrderEvent(order: OrderDto, event: OrderUpdatedEvent): boolean {
  if (order.version >= event.version) return false
  // Pedidos confirmados ou recusados são terminais e não aceitam outro desfecho.
  return order.status === 'pending' || order.status === event.payload.status
}

function processOrderUpdated(event: OrderUpdatedEvent): boolean {
  const queryClient = queryClientRef
  if (!queryClient) return false
  const { orderId } = event.payload
  const cachedOrders = queryClient.getQueriesData<OrderDto>({
    queryKey: ['order', orderId],
  })
  const cachedOrder = cachedOrders.find(([, order]) => order !== undefined)?.[1]
  if (cachedOrder && !canApplyOrderEvent(cachedOrder, event)) return false

  queryClient.setQueriesData<OrderDto>({ queryKey: ['order', orderId] }, (order) =>
    order
      ? {
          ...order,
          status: event.payload.status,
          transactionHash: event.payload.transactionHash,
          version: event.version,
          updatedAt: event.timestamp,
          ...(event.payload.failureReason
            ? { failureReason: event.payload.failureReason }
            : {}),
        }
      : order,
  )
  void queryClient.invalidateQueries({ queryKey: ['orders'] })
  void queryClient.invalidateQueries({ queryKey: ['order', orderId] })
  void queryClient.invalidateQueries({ queryKey: ['cart'] })
  return true
}

function processEvent(event: ProcessedEvent): void {
  // Barreira do cliente: eventos privados de outra sessão nunca tocam o cache atual.
  if (
    (event.userId !== undefined && event.userId !== activeSocketUserId) ||
    (event.type === 'order.updated' && !event.userId)
  ) {
    recordIgnoredEvent()
    return
  }
  const versionKey = `${event.type}:${event.resourceId}`
  if (
    processedEventIds.has(event.eventId) ||
    event.version <= (lastVersionByResource.get(versionKey) ?? 0)
  ) {
    recordIgnoredEvent()
    return
  }

  rememberEventId(event.eventId)
  lastVersionByResource.set(versionKey, event.version)

  if (event.type === 'nft.updated') {
    processNftUpdated(event)
  } else if (!processOrderUpdated(event)) {
    recordIgnoredEvent()
  }
}

/** Registra os ouvintes do cliente e devolve a função que os remove. */
function attachSocketListeners(client: KurioSocket): () => void {
  const onConnect = () => publishConnectionState(true)
  const onConnectError = (error: Error) => {
    console.warn('Socket.IO connection failed.', error)
  }
  const onDisconnect = () => publishConnectionState(false)
  // Após uma reconexão, o REST volta a ser a fonte de verdade: tudo que está ativo é reconciliado.
  const onReconnect = () => {
    publishConnectionState(true)
    void queryClientRef?.invalidateQueries({ refetchType: 'active' })
  }

  client.on('connect', onConnect)
  client.on('connect_error', onConnectError)
  client.on('disconnect', onDisconnect)
  client.io.on('reconnect', onReconnect)
  client.on('nft.updated', processEvent)
  client.on('order.updated', processEvent)

  return () => {
    client.off('connect', onConnect)
    client.off('connect_error', onConnectError)
    client.off('disconnect', onDisconnect)
    client.io.off('reconnect', onReconnect)
    client.off('nft.updated', processEvent)
    client.off('order.updated', processEvent)
  }
}

async function createSocket(): Promise<KurioSocket> {
  const { io } = await import('socket.io-client')
  const client: KurioSocket = io(window.location.origin, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    // Função: o token mais recente é reenviado a cada (re)conexão.
    auth: (callback) => callback({ token: getAuthToken() }),
  })
  detachSocketListeners = attachSocketListeners(client)
  return client
}

export async function initializeSocketClient(
  queryClient: QueryClient,
): Promise<KurioSocket> {
  queryClientRef = queryClient
  // A sessão persistida define de quem são os eventos privados aceitos desde o primeiro frame.
  activeSocketUserId = getAuthUserId()
  socketPromise ??= createSocket()
  socket = await socketPromise
  socket.connect()
  return socket
}

/**
 * Troca a identidade do socket (login, logout, expiração, troca de usuário): descarta o estado
 * de deduplicação e reabre a conexão para que o handshake carregue o token novo.
 * Chamadas repetidas com o mesmo usuário não reconectam.
 */
export function resetSocketSession(userId?: string | null): void {
  const nextUserId = userId ?? null
  if (nextUserId === activeSocketUserId) return
  activeSocketUserId = nextUserId
  resetSocketEventState()
  if (!socket) return
  socket.disconnect()
  socket.connect()
}

/** Encerra o cliente: remove ouvintes, desconecta e permite uma nova inicialização limpa. */
export function disposeSocketClient(): void {
  detachSocketListeners?.()
  detachSocketListeners = undefined
  socket?.disconnect()
  socket = undefined
  socketPromise = undefined
  queryClientRef = undefined
  activeSocketUserId = null
  resetSocketEventState()
  publishConnectionState(false)
}

export function subscribeSocketConnection(
  listener: (connected: boolean) => void,
): () => void {
  connectionListeners.add(listener)
  listener(isConnected)
  return () => connectionListeners.delete(listener)
}

export function isSocketConnected(): boolean {
  return isConnected
}

export function subscribeIgnoredEventCount(
  listener: (count: number) => void,
): () => void {
  ignoredEventListeners.add(listener)
  listener(ignoredEventCount)
  return () => ignoredEventListeners.delete(listener)
}

export function subscribeNftUpdates(
  listener: (event: NftUpdatedEvent) => void,
): () => void {
  nftUpdateListeners.add(listener)
  return () => nftUpdateListeners.delete(listener)
}

export function getIgnoredEventCount(): number {
  return ignoredEventCount
}

/** Resolve quando o contador de eventos ignorados atinge `target` (ou após o timeout). */
export function waitForIgnoredEventCount(
  target: number,
  timeoutMs = 3000,
): Promise<number> {
  return new Promise((resolve) => {
    if (ignoredEventCount >= target) {
      resolve(ignoredEventCount)
      return
    }
    const finish = () => {
      window.clearTimeout(timer)
      unsubscribe()
      resolve(ignoredEventCount)
    }
    const unsubscribe = subscribeIgnoredEventCount((count) => {
      if (count >= target) finish()
    })
    const timer = window.setTimeout(finish, timeoutMs)
  })
}

export function resetSocketEventState(): void {
  lastVersionByResource.clear()
  processedEventIds.clear()
}
