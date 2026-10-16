import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Wrench } from 'lucide-react'
import {
  httpClient,
  setMockScenario,
} from '../../api/http'
import type {
  CartDto,
  CatalogResponse,
  MockScenarioId,
  NftItem,
} from '../../api/types'
import {
  resetSocketEventState,
  simulateDuplicateAndOldEvents,
} from '../../socket/socket-client'
import { addEth } from '../../lib/eth-math'
import { useAuth } from '../../../features/auth/hooks/auth-context'
import { fetchOrders } from '../../../features/orders/api/orders-api'

const scenarios: Array<{ id: MockScenarioId; label: string }> = [
  { id: 'default', label: 'Normal' },
  { id: 'slow-network', label: 'Rede lenta' },
  { id: 'out-of-order', label: 'Fora de ordem' },
  { id: 'network-error', label: 'Erro de rede' },
  { id: 'server-error-500', label: 'Erro 500' },
  { id: 'session-expired', label: 'Sessão expirada (401)' },
  { id: 'payment-declined', label: 'Pagamento recusado' },
  { id: 'order-timeout-recovery', label: 'Timeout recuperável do pedido' },
]

export function ScenarioDevToolbar() {
  const queryClient = useQueryClient()
  const auth = useAuth()
  const [scenario, setScenario] = useState<MockScenarioId>(
    () => (localStorage.getItem('kurio_mock_scenario') as MockScenarioId | null) ?? 'default',
  )
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const changeScenario = (nextScenario: MockScenarioId) => {
    setMockScenario(nextScenario)
    setScenario(nextScenario)
    void queryClient.invalidateQueries({ queryKey: ['nfts'] })
    void queryClient.invalidateQueries({ queryKey: ['favorites'] })
    void queryClient.invalidateQueries({ queryKey: ['cart'] })
    setMessage(`Cenário selecionado: ${nextScenario}`)
    setError('')
  }

  const simulateUpdate = async () => {
    try {
      const response = await httpClient.get<NftItem>('/nfts/emerald-ape-042')
      await httpClient.post('/__mock__/simulate-nft-update', {
        nftId: response.data.id,
        priceEth: addEth(response.data.priceEth, '0.10'),
        availableEditions: response.data.availableEditions,
      })
      setMessage('Evento nft.updated emitido.')
      setError('')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao simular evento.')
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
      setMessage(`Preço e estoque de ${nftResponse.data.title} alterados via Socket.IO.`)
      setError('')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao simular alteração no carrinho.',
      )
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
      setMessage(
        `Pedido ${pendingOrder.id} atualizado para ${status} via Socket.IO.`,
      )
      setError('')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao atualizar pedido.',
      )
    }
  }

  const resetDatabase = async () => {
    try {
      await httpClient.post('/__mock__/reset')
      resetSocketEventState()
      changeScenario('default')
      await queryClient.invalidateQueries({ queryKey: ['nfts'] })
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      setMessage('MockDB restaurado para as fixtures originais.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao resetar MockDB.')
    }
  }

  const switchDemoUser = async (user: 'nova' | 'kael' | 'guest') => {
    try {
      await auth.switchUser(user)
      await queryClient.invalidateQueries({ queryKey: ['cart'] })
      await queryClient.invalidateQueries({ queryKey: ['favorites'] })
      setMessage(
        user === 'guest'
          ? 'Sessão de visitante ativa.'
          : `Sessão de ${user === 'nova' ? 'Nova Sato' : 'Kael Vance'} ativa.`,
      )
      setError('')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Falha ao alternar usuário.',
      )
    }
  }

  return (
    <details className="fixed bottom-[76px] right-3 z-50 w-[min(19rem,calc(100vw-1.5rem))] rounded-lg border border-kurio-border bg-kurio-surface/95 text-kurio-text shadow-xl backdrop-blur md:bottom-4">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-[10px] font-semibold text-kurio-text-muted [&::-webkit-details-marker]:hidden">
        <Wrench size={14} aria-hidden="true" className="text-kurio-amber" />
        Ferramentas de demonstração
        <ChevronDown size={13} aria-hidden="true" className="ml-auto" />
      </summary>
      <div className="space-y-3 border-t border-kurio-border p-3">
        <div>
          <p className="mb-1 text-[10px] text-kurio-text-muted">
            Sessão atual: {auth.session?.user.displayName ?? 'Visitante'}
          </p>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => void switchDemoUser('nova')}
              className="rounded border border-kurio-border px-1 py-2 text-[9px] text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              Usuário 1
            </button>
            <button
              type="button"
              onClick={() => void switchDemoUser('kael')}
              className="rounded border border-kurio-border px-1 py-2 text-[9px] text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              Usuário 2
            </button>
            <button
              type="button"
              onClick={() => void switchDemoUser('guest')}
              className="rounded border border-kurio-border px-1 py-2 text-[9px] text-kurio-text focus-visible:outline-2 focus-visible:outline-kurio-amber"
            >
              Visitante
            </button>
          </div>
        </div>
        <label className="block text-[10px] text-kurio-text-muted">
          Cenário de rede
          <select
            value={scenario}
            onChange={(event) => changeScenario(event.target.value as MockScenarioId)}
            className="mt-1 w-full rounded border border-kurio-border bg-kurio-bg px-2 py-2 text-xs text-kurio-text"
          >
            {scenarios.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void simulateUpdate()} className="w-full rounded border border-kurio-amber px-3 py-2 text-left text-[10px] font-semibold text-kurio-amber">
          Disparar nft.updated (+0.10 ETH)
        </button>
        <button
          type="button"
          onClick={() => void simulateCartChange()}
          className="w-full rounded border border-kurio-danger/60 px-3 py-2 text-left text-[10px] font-semibold text-kurio-danger"
        >
          Simular mudança de preço e estoque no carrinho
        </button>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => void simulateOrderUpdate('confirmed')}
            className="rounded border border-kurio-success/60 px-2 py-2 text-[9px] font-semibold text-kurio-success"
          >
            Confirmar pedido pendente
          </button>
          <button
            type="button"
            onClick={() => void simulateOrderUpdate('declined')}
            className="rounded border border-kurio-danger/60 px-2 py-2 text-[9px] font-semibold text-kurio-danger"
          >
            Recusar pedido pendente
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMessage(`${simulateDuplicateAndOldEvents()} evento(s) antigo(s)/duplicado(s) ignorado(s).`)}
          className="w-full rounded border border-kurio-border px-3 py-2 text-left text-[10px] text-kurio-text"
        >
          Testar evento duplicado/antigo
        </button>
        <button type="button" onClick={() => void resetDatabase()} className="w-full rounded border border-kurio-border px-3 py-2 text-left text-[10px] text-kurio-text">
          Resetar MockDB
        </button>
        {message && <p role="status" className="text-[10px] text-kurio-success">{message}</p>}
        {error && <p role="alert" className="text-[10px] text-kurio-danger">{error}</p>}
      </div>
    </details>
  )
}
