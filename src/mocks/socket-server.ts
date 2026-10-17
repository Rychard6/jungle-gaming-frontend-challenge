import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'
import type {
  NftItem,
  NftUpdatedEvent,
  OrderDto,
  OrderUpdatedEvent,
} from '../shared/api/types'
import { getMockSession } from './db'

/**
 * Servidor Socket.IO simulado (MSW + @mswjs/socket.io-binding).
 *
 * Transporte: apenas WebSocket interceptado no browser; não há polling HTTP.
 * Limitações: sem salas/namespaces (recurso ausente no binding). O isolamento
 * por usuário é feito aqui, no "servidor", a partir do token enviado no
 * handshake (`auth.token`), e repetido no cliente como segunda barreira.
 */

// O MSW normaliza o caminho padrão do Socket.IO para "/" antes de casar handlers WebSocket.
const socketIoLink = ws.link(/\/socket\.io\/|\/$/)

type SocketIoClient = ReturnType<typeof toSocketIo>['client']

interface SocketSubscriber {
  client: SocketIoClient
  /** Usuário resolvido a partir do token do handshake; `null` para visitantes. */
  userId: string | null
  close: (code: number, reason: string) => void
}

const subscribers = new Set<SocketSubscriber>()
let lastNftEvent: NftUpdatedEvent | undefined

// O binding não envia pings do Engine.IO; sem eles o cliente fecha o transporte
// por "ping timeout" (pingInterval + pingTimeout = 30 s) quando fica ocioso.
const ENGINE_IO_PING_INTERVAL_MS = 20_000

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Pacote CONNECT do Socket.IO (Engine.IO "message" = 4, CONNECT = 0): `40{"token":"..."}`. */
function parseConnectAuth(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string' || !data.startsWith('40')) return null
  const payload = data.slice(2)
  if (!payload.startsWith('{')) return {}
  try {
    const parsed: unknown = JSON.parse(payload)
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export const socketIoHandler = socketIoLink.addEventListener(
  'connection',
  (connection) => {
    const { client } = toSocketIo(connection)
    const subscriber: SocketSubscriber = {
      client,
      userId: null,
      close: (code, reason) => connection.client.close(code, reason),
    }
    subscribers.add(subscriber)

    connection.client.addEventListener('message', (event) => {
      const auth = parseConnectAuth(event.data)
      if (!auth) return
      const token = typeof auth.token === 'string' ? auth.token : null
      subscriber.userId = token
        ? (getMockSession(token)?.session.user.id ?? null)
        : null
    })

    const pingTimer = window.setInterval(() => {
      connection.client.send('2')
    }, ENGINE_IO_PING_INTERVAL_MS)
    connection.client.addEventListener('close', () => {
      window.clearInterval(pingTimer)
      subscribers.delete(subscriber)
    })
  },
)

export function createNftUpdatedEvent(nft: NftItem): NftUpdatedEvent {
  return {
    eventId: crypto.randomUUID(),
    type: 'nft.updated',
    resourceId: nft.id,
    version: nft.version,
    timestamp: nft.updatedAt,
    payload: {
      nftId: nft.id,
      priceEth: nft.priceEth,
      availableEditions: nft.availableEditions,
      editionType: nft.editionType,
    },
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

/** `nft.updated` é público: chega a todas as conexões, inclusive de visitantes. */
export function emitNftUpdated(event: NftUpdatedEvent): void {
  lastNftEvent = event
  for (const subscriber of subscribers) {
    subscriber.client.emit('nft.updated', event)
  }
}

/** `order.updated` é privado: só chega às conexões autenticadas do dono do pedido. */
export function emitOrderUpdated(order: OrderDto): void {
  const event = createOrderUpdatedEvent(order)
  for (const subscriber of subscribers) {
    if (subscriber.userId === order.userId) {
      subscriber.client.emit('order.updated', event)
    }
  }
}

/**
 * Reenvia, pelo próprio Socket.IO, o último `nft.updated` (duplicata exata) e uma
 * versão mais antiga do mesmo recurso. O cliente deve ignorar ambos.
 */
export function replayLastNftEvent(): boolean {
  if (!lastNftEvent) return false
  const duplicate = lastNftEvent
  const stale: NftUpdatedEvent = {
    ...duplicate,
    eventId: crypto.randomUUID(),
    version: Math.max(0, duplicate.version - 1),
  }
  for (const subscriber of subscribers) {
    subscriber.client.emit('nft.updated', duplicate)
    subscriber.client.emit('nft.updated', stale)
  }
  return true
}

/** Fecha as conexões abertas como numa queda de rede; o socket.io-client reconecta sozinho. */
export function dropSocketConnections(): number {
  const closing = [...subscribers]
  for (const subscriber of closing) {
    subscriber.close(1001, 'Conexão interrompida pela simulação de rede.')
  }
  return closing.length
}

export function resetSocketServerState(): void {
  lastNftEvent = undefined
}
