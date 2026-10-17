import { useState, useSyncExternalStore } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Wrench } from 'lucide-react'
import {
  getStoredMockScenario,
  httpClient,
  setMockScenario,
} from '../../shared/api/http'
import {
  MOCK_SCENARIO_IDS,
  type CartDto,
  type CatalogResponse,
  type MockScenarioId,
  type NftItem,
} from '../../shared/api/types'
import {
  getIgnoredEventCount,
  isSocketConnected,
  resetSocketEventState,
  subscribeSocketConnection,
  waitForIgnoredEventCount,
} from '../../shared/socket/socket-client'
import { addEth } from '../../shared/lib/eth-math'
import { useAuth } from '../auth/hooks/auth-context'
import { clearAllIdempotencyRecords } from '../checkout/lib/idempotency'
import { fetchOrders } from '../orders/api/orders-api'

// `Record` obriga a rotular qualquer cenário novo adicionado a `MOCK_SCENARIO_IDS`.
const scenarioLabels: Record<MockScenarioId, string> = {
  default: 'Normal',
  'empty-results': 'Resultado vazio',
  'slow-network': 'Rede lenta',
  'out-of-order': 'Fora de ordem',
  'network-error': 'Erro de rede',
  'server-error-500': 'Erro 500',
  'session-expired': 'Sessão expirada (401)',
  'price-change-on-checkout': 'Preço muda durante a compra',
  'edition-sold-out': 'Edição esgota durante a compra',
  'payment-declined': 'Pagamento recusado',
  'order-timeout-recovery': 'Timeout recuperável do pedido',
  'order-pending': 'Pedido pendente (manual)',
}

const buttonClass =
  'rounded border px-3 py-2 text-left text-[10px] focus-visible:outline-2 focus-visible:outline-kurio-amber'

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

export function ScenarioDevToolbar() {
  const queryClient = useQueryClient()
  const auth = useAuth()
  const [scenario, setScenario] = useState<MockScenarioId>(getStoredMockScenario)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const socketConnected = useSyncExternalStore(
    subscribeSocketConnection,
    isSocketConnected,
    () => false,
  )

  const refreshData = () =>
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] !== 'auth',
    })

  const report = (text: string) => {
    setMessage(text)
    setError('')
  }

  const fail = (cause: unknown, fallback: string) => {
    setError(describeError(cause, fallback))
  }

  const changeScenario = (nextScenario: MockScenarioId) => {
    setMockScenario(nextScenario)
    setScenario(nextScenario)
    void refreshData()
    report(`Cenário selecionado: ${nextScenario}`)
  }

  const simulateUpdate = async () => {
    try {
      const response = await httpClient.get<NftItem>('/nfts/emerald-ape-042')
      await httpClient.post('/__mock__/simulate-nft-update', {
        nftId: response.data.id,
        priceEth: addEth(response.data.priceEth, '0.10'),
        availableEditions: response.data.availableEditions,
      })
      report('Evento nft.updated emitido.')
    } catch (cause) {
      fail(cause, 'Falha ao simular evento.')
    }
  }

  const simulateCartChange = async () => {
    try {
      const cartResponse = await httpClient.get<CartDto>('/cart')
      let nftId = cartResponse.data.items[0]?.nftId
      if (!nftId) {
        const catalogResponse = await httpClient.get<CatalogResponse>('/nfts', {
          params: { page: 1, limit: 1 },
        })
        nftId = catalogResponse.data.items[0]?.id
      }
      if (!nftId) {
        throw new Error('Não há NFTs disponíveis para simular uma alteração.')
      }
      const nftResponse = await httpClient.get<NftItem>(`/nfts/${nftId}`)
      await httpClient.post('/__mock__/simulate-nft-update', {
        nftId,
        priceEth: addEth(nftResponse.data.priceEth, '0.10'),
        availableEditions: 0,
      })
      report(`Preço e estoque de ${nftResponse.data.title} alterados via Socket.IO.`)
    } catch (cause) {
      fail(cause, 'Falha ao simular alteração no carrinho.')
    }
  }

  const simulateOrderUpdate = async (status: 'confirmed' | 'declined') => {
    try {
      const { orders } = await fetchOrders()
      const pendingOrder = orders.find((order) => order.status === 'pending')
      if (!pendingOrder) {
        throw new Error('Não há pedido pendente para atualizar.')
      }
      await httpClient.post('/__mock__/simulate-order-update', {
        orderId: pendingOrder.id,
        status,
        ...(status === 'declined'
          ? { failureReason: 'Pagamento recusado na simulação.' }
          : {}),
      })
      report(`Pedido ${pendingOrder.id} atualizado para ${status} via Socket.IO.`)
    } catch (cause) {
      fail(cause, 'Falha ao atualizar pedido.')
    }
  }

  // Duplicata e evento antigo saem do servidor MSW e chegam pelo socket.io-client real.
  const simulateDuplicateEvents = async () => {
    try {
      const baseline = getIgnoredEventCount()
      await httpClient.post('/__mock__/simulate-duplicate-events')
      const current = await waitForIgnoredEventCount(baseline + 2)
      report(`${current - baseline} evento(s) antigo(s)/duplicado(s) ignorado(s).`)
    } catch (cause) {
      fail(cause, 'Falha ao reenviar eventos.')
    }
  }

  const simulateSocketDrop = async () => {
    try {
      await httpClient.post('/__mock__/simulate-socket-drop')
      report('Conexão Socket.IO interrompida. O cliente vai reconectar e reconciliar via REST.')
    } catch (cause) {
      fail(cause, 'Falha ao interromper a conexão.')
    }
  }

  const resetDatabase = async () => {
    try {
      await httpClient.post('/__mock__/reset')
      resetSocketEventState()
      auth.resetLocalSession()
      clearAllIdempotencyRecords()
      setScenario('default')
      await refreshData()
      report('MockDB restaurado: fixtures originais, cenário Normal e sessão local limpa.')
    } catch (cause) {
      fail(cause, 'Falha ao resetar MockDB.')
    }
  }

  const switchDemoUser = async (user: 'nova' | 'kael' | 'guest') => {
    try {
      await auth.switchUser(user)
      await refreshData()
      report(
        user === 'guest'
          ? 'Sessão de visitante ativa.'
          : `Sessão de ${user === 'nova' ? 'Nova Sato' : 'Kael Vance'} ativa.`,
      )
    } catch (cause) {
      fail(cause, 'Falha ao alternar usuário.')
    }
  }

  return (
    <details className="group fixed bottom-[76px] right-3 z-50 w-10 rounded-lg border border-kurio-border bg-kurio-surface/95 text-kurio-text shadow-xl backdrop-blur open:w-[min(19rem,calc(100vw-1.5rem))] sm:w-[min(19rem,calc(100vw-1.5rem))] md:bottom-4">
      <summary title="Ferramentas de demonstração" className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[10px] font-semibold text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-kurio-amber [&::-webkit-details-marker]:hidden">
        <Wrench size={14} aria-hidden="true" className="text-kurio-amber" />
        <span className="sr-only group-open:not-sr-only sm:not-sr-only">Ferramentas de demonstração</span>
        <ChevronDown size={13} aria-hidden="true" className="ml-auto hidden group-open:block sm:block" />
      </summary>
      <div className="max-h-[70vh] space-y-3 overflow-y-auto border-t border-kurio-border p-3">
        <div>
          <p className="mb-1 text-[10px] text-kurio-text-muted">
            Sessão atual: {auth.session?.user.displayName ?? 'Visitante'}
          </p>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => void switchDemoUser('nova')}
              className={`${buttonClass} border-kurio-border px-1 text-[9px] text-kurio-text`}
            >
              Usuário 1
            </button>
            <button
              type="button"
              onClick={() => void switchDemoUser('kael')}
              className={`${buttonClass} border-kurio-border px-1 text-[9px] text-kurio-text`}
            >
              Usuário 2
            </button>
            <button
              type="button"
              onClick={() => void switchDemoUser('guest')}
              className={`${buttonClass} border-kurio-border px-1 text-[9px] text-kurio-text`}
            >
              Visitante
            </button>
          </div>
        </div>
        <label className="block text-[10px] text-kurio-text-muted">
          Cenário de rede
          <select
            value={scenario}
            onChange={(event) => {
              const next = event.target.value
              const matched = MOCK_SCENARIO_IDS.find((id) => id === next)
              if (matched) changeScenario(matched)
            }}
            className="mt-1 w-full rounded border border-kurio-border bg-kurio-bg px-2 py-2 text-xs text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
          >
            {MOCK_SCENARIO_IDS.map((id) => (
              <option key={id} value={id}>
                {scenarioLabels[id]}
              </option>
            ))}
          </select>
        </label>
        <p
          data-testid="socket-connection-status"
          className="text-[10px] text-kurio-text-muted"
        >
          Socket.IO: {socketConnected ? 'conectado' : 'desconectado'}
        </p>
        <button
          type="button"
          onClick={() => void simulateUpdate()}
          className={`${buttonClass} w-full border-kurio-amber font-semibold text-kurio-amber`}
        >
          Disparar nft.updated (+0.10 ETH)
        </button>
        <button
          type="button"
          onClick={() => void simulateCartChange()}
          className={`${buttonClass} w-full border-kurio-danger/60 font-semibold text-kurio-danger`}
        >
          Simular mudança de preço e estoque no carrinho
        </button>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => void simulateOrderUpdate('confirmed')}
            className={`${buttonClass} border-kurio-success/60 px-2 text-[9px] font-semibold text-kurio-success`}
          >
            Confirmar pedido pendente
          </button>
          <button
            type="button"
            onClick={() => void simulateOrderUpdate('declined')}
            className={`${buttonClass} border-kurio-danger/60 px-2 text-[9px] font-semibold text-kurio-danger`}
          >
            Recusar pedido pendente
          </button>
        </div>
        <button
          type="button"
          onClick={() => void simulateDuplicateEvents()}
          className={`${buttonClass} w-full border-kurio-border text-kurio-text`}
        >
          Testar evento duplicado/antigo
        </button>
        <button
          type="button"
          onClick={() => void simulateSocketDrop()}
          className={`${buttonClass} w-full border-kurio-border text-kurio-text`}
        >
          Simular queda do Socket.IO
        </button>
        <button
          type="button"
          onClick={() => void resetDatabase()}
          className={`${buttonClass} w-full border-kurio-border text-kurio-text`}
        >
          Resetar MockDB
        </button>
        {message && (
          <p role="status" className="text-[10px] text-kurio-success">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="text-[10px] text-kurio-danger">
            {error}
          </p>
        )}
      </div>
    </details>
  )
}
