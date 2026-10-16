import type { Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import { getAuthToken } from '../api/http'
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

let socket: Socket<KurioServerEvents, KurioClientEvents> | undefined
let queryClientRef: QueryClient | undefined
const lastVersionByResource = new Map<string, number>()
const processedEventIds = new Set<string>()
const latestEventByResource = new Map<string, ProcessedEvent>()
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

function processNftUpdated(event: NftUpdatedEvent): void {
  if (!queryClientRef) return

  void queryClientRef.invalidateQueries({ queryKey: ['cart'] })
  void queryClientRef.invalidateQueries({ queryKey: ['checkout', 'quote'] })
  for (const listener of nftUpdateListeners) listener(event)

  queryClientRef.setQueriesData<CatalogResponse>(
    { queryKey: ['nfts'] },
    (current) => {
      if (!current) return current
      return {
        ...current,
        items: current.items.map((item) =>
          item.id === event.payload.nftId
            ? {
                ...item,
                priceEth: event.payload.priceEth,
                availableEditions: event.payload.availableEditions,
                editionType: event.payload.editionType,
                version: event.version,
                updatedAt: event.timestamp,
              }
            : item,
        ),
      }
    },
  )

  queryClientRef.setQueryData<NftItem>(
    ['nft', event.payload.nftId],
    (current) =>
      current
        ? {
            ...current,
            priceEth: event.payload.priceEth,
            availableEditions: event.payload.availableEditions,
            editionType: event.payload.editionType,
            version: event.version,
            updatedAt: event.timestamp,
          }
        : current,
  )
}

function processEvent(event: ProcessedEvent): void {
  if (
    (event.userId !== undefined && event.userId !== activeSocketUserId) ||
    (event.type === 'order.updated' && !event.userId)
  ) {
    recordIgnoredEvent()
    return
  }
  if (
    processedEventIds.has(event.eventId) ||
    event.version <=
      (lastVersionByResource.get(`${event.type}:${event.resourceId}`) ?? 0)
  ) {
    recordIgnoredEvent()
    return
  }

  processedEventIds.add(event.eventId)
  lastVersionByResource.set(`${event.type}:${event.resourceId}`, event.version)
  latestEventByResource.set(event.resourceId, event)

  if (event.type === 'nft.updated') {
    processNftUpdated(event)
  } else {
    const orderId = event.payload.orderId
    const existingOrder = queryClientRef?.getQueriesData<OrderDto>({
      queryKey: ['order', orderId],
    })
    const terminalOrder = existingOrder?.some(
      ([, order]) =>
        order?.status !== undefined &&
        order.status !== 'pending' &&
        order.status !== event.payload.status,
    )
    if (terminalOrder) {
      recordIgnoredEvent()
      return
    }
    queryClientRef?.setQueriesData<OrderDto>(
      { queryKey: ['order', orderId] },
      (order) =>
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
    void queryClientRef?.invalidateQueries({ queryKey: ['orders'] })
    void queryClientRef?.invalidateQueries({ queryKey: ['order', orderId] })
    void queryClientRef?.invalidateQueries({ queryKey: ['cart'] })
  }
}

export async function initializeSocketClient(
  queryClient: QueryClient,
): Promise<Socket<KurioServerEvents, KurioClientEvents>> {
  queryClientRef = queryClient

  if (socket) {
    socket.connect()
    return socket
  }

  const { io } = await import('socket.io-client')
  socket = io(window.location.origin, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
  })

  socket.on('connect', () => publishConnectionState(true))
  socket.on('connect_error', (error) => {
    console.error('Socket.IO connection failed.', error)
  })
  socket.on('disconnect', () => publishConnectionState(false))
  socket.io.on('reconnect', () => {
    publishConnectionState(true)
    void queryClientRef?.invalidateQueries({ refetchType: 'active' })
    void queryClientRef?.invalidateQueries({
      queryKey: ['orders'],
      refetchType: 'active',
    })
    void queryClientRef?.invalidateQueries({
      queryKey: ['order'],
      refetchType: 'active',
    })
  })
  socket.on('nft.updated', processEvent)
  socket.on('order.updated', processEvent)

  return socket
}

function bindSessionEventListeners(): void {
  if (!socket) return
  socket.off('nft.updated', processEvent)
  socket.off('order.updated', processEvent)
  socket.on('nft.updated', processEvent)
  socket.on('order.updated', processEvent)
}

export function resetSocketSession(userId?: string | null): void {
  activeSocketUserId = userId ?? null
  resetSocketEventState()
  if (!socket) return
  socket.disconnect()
  socket.off('nft.updated', processEvent)
  socket.off('order.updated', processEvent)
  socket.auth = {
    token: getAuthToken(),
    userId: activeSocketUserId,
  }
  bindSessionEventListeners()
  socket.connect()
}

export function subscribeSocketConnection(
  listener: (connected: boolean) => void,
): () => void {
  connectionListeners.add(listener)
  listener(isConnected)
  return () => connectionListeners.delete(listener)
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

export function resetSocketEventState(): void {
  lastVersionByResource.clear()
  processedEventIds.clear()
  latestEventByResource.clear()
}

export function simulateDuplicateAndOldEvents(): number {
  const latestEvents = Array.from(latestEventByResource.values())
  if (latestEvents.length === 0) return 0

  const countBefore = ignoredEventCount
  const latestEvent = latestEvents[0]
  processEvent(latestEvent)
  processEvent({
    ...latestEvent,
    eventId: `${latestEvent.eventId}-old`,
    version: latestEvent.version - 1,
  })
  return ignoredEventCount - countBefore
}
