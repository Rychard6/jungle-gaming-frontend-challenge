import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Check, Clock3, Mail, XCircle } from 'lucide-react'
import { getSessionCacheKey } from '../../../shared/api/http'
import type { OrderDto } from '../../../shared/api/types'
import { formatEthDisplay } from '../../../shared/lib/eth-math'
import { fetchOrder } from '../api/orders-api'
import { useState } from 'react'

function formatOrderDate(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

function Receipt({ order }: { order: OrderDto }) {
  const [explorerNotice, setExplorerNotice] = useState('')
  const snapshot = order.snapshot

  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-kurio-border bg-kurio-surface shadow-2xl">
      <div className="px-5 py-9 text-center sm:px-10 sm:py-12">
        <div className="mx-auto grid size-16 place-items-center rounded-full border border-kurio-amber/40 bg-kurio-amber/10 text-kurio-amber">
          <Mail size={27} aria-hidden="true" />
        </div>
        <p className="mt-5 text-[10px] font-bold tracking-[0.3em] text-kurio-amber">
          THANK YOU
        </p>
        <h1 className="mt-3 text-2xl font-bold sm:text-3xl">
          Seus NFTs agora estão na sua carteira
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-kurio-text-muted">
          Sua compra foi confirmada. Este recibo registra os itens e valores no
          momento da transação.
        </p>
      </div>

      <dl className="grid gap-px border-y border-kurio-border bg-kurio-border sm:grid-cols-4">
        <div className="bg-kurio-bg px-4 py-4 sm:px-5">
          <dt className="text-[9px] uppercase tracking-wider text-kurio-text-muted">ID da transação</dt>
          <dd className="mt-2 break-all text-xs font-semibold text-kurio-amber">
            {order.transactionHash.slice(0, 7)}..{order.transactionHash.slice(-4)}
          </dd>
        </div>
        <div className="bg-kurio-bg px-4 py-4 sm:px-5">
          <dt className="text-[9px] uppercase tracking-wider text-kurio-text-muted">Data</dt>
          <dd className="mt-2 text-xs">{formatOrderDate(order.createdAt)}</dd>
        </div>
        <div className="bg-kurio-bg px-4 py-4 sm:px-5">
          <dt className="text-[9px] uppercase tracking-wider text-kurio-text-muted">Total</dt>
          <dd className="mt-2 text-xs font-bold text-kurio-amber">
            {formatEthDisplay(snapshot.totalEth)}
          </dd>
        </div>
        <div className="bg-kurio-bg px-4 py-4 sm:px-5">
          <dt className="text-[9px] uppercase tracking-wider text-kurio-text-muted">Carteira</dt>
          <dd className="mt-2 break-all text-xs">{order.collector.walletAddress}</dd>
        </div>
      </dl>

      <div className="p-5 sm:p-8">
        <h2 className="text-sm font-bold">Detalhes da transação</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-xs">
            <thead>
              <tr className="border-b border-kurio-border text-[9px] uppercase tracking-wider text-kurio-text-muted">
                <th className="pb-3 font-medium">NFTs</th>
                <th className="pb-3 font-medium">Edições</th>
                <th className="pb-3 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.items.map((item) => (
                <tr key={`${item.nftId}-${item.tokenId}`} className="border-b border-kurio-border/70">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="size-11 rounded-lg object-cover"
                      />
                      <span>
                        <span className="block font-semibold">{item.title}</span>
                        <span className="mt-1 block text-[9px] text-kurio-text-muted">
                          Token {item.tokenId} · {item.editionType}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="py-4 text-kurio-text-muted">
                    {item.editionType} (x {item.quantity})
                  </td>
                  <td className="py-4 text-right font-semibold">
                    {formatEthDisplay(item.subtotalEth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto mt-5 max-w-sm space-y-3 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-kurio-text-muted">Subtotal</dt>
            <dd>{formatEthDisplay(snapshot.subtotalEth)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-kurio-text-muted">
              {snapshot.couponCode
                ? `Desconto (${snapshot.couponCode})`
                : 'Desconto do lançamento'}
            </dt>
            <dd className="text-kurio-success">
              − {formatEthDisplay(snapshot.discountEth)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-kurio-text-muted">Taxa de rede</dt>
            <dd>{formatEthDisplay(snapshot.networkFeeEth)}</dd>
          </div>
          <div className="flex justify-between border-t border-kurio-border pt-4 text-sm font-bold">
            <dt>Total</dt>
            <dd className="text-kurio-amber">{formatEthDisplay(snapshot.totalEth)}</dd>
          </div>
        </dl>
        <p className="mt-6 rounded-lg border border-kurio-success/30 bg-kurio-success/5 p-4 text-[10px] leading-5 text-kurio-text-muted">
          Transação confirmada na {order.network}. A propriedade foi transferida
          para sua carteira conectada e registrada na rede.
        </p>
        {explorerNotice && (
          <p role="status" className="mt-3 text-[10px] text-kurio-amber">
            {explorerNotice}
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() =>
              setExplorerNotice(
                `Link simulado do explorador ${order.network}: ${order.transactionHash}`,
              )
            }
            className="min-h-11 rounded-lg bg-kurio-amber px-6 py-3 text-xs font-bold text-kurio-bg hover:bg-kurio-amber-hover"
          >
            Ver no {order.network === 'Ethereum' ? 'Etherscan' : 'explorador'}
          </button>
          <Link
            to="/"
            search={{ tab: 'all', sort: 'recent', page: 1 }}
            className="min-h-11 rounded-lg border border-kurio-border px-6 py-3 text-center text-xs font-semibold text-kurio-text"
          >
            Continuar explorando
          </Link>
        </div>
      </div>
    </article>
  )
}

export function OrderConfirmationPage({ orderId }: { orderId: string }) {
  const sessionKey = getSessionCacheKey() ?? 'anonymous'
  const orderQuery = useQuery({
    queryKey: ['order', orderId, sessionKey],
    queryFn: ({ signal }) => fetchOrder(orderId, signal),
    refetchInterval: (query) =>
      query.state.data?.status === 'pending' ? 2500 : false,
  })

  if (orderQuery.isLoading) {
    return (
      <main aria-busy="true" className="mx-auto max-w-4xl px-4 py-14">
        <div className="skeleton-shimmer h-[32rem] rounded-2xl" />
      </main>
    )
  }
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Pedido indisponível</h1>
        <p role="alert" className="mt-3 text-sm text-kurio-danger">
          {orderQuery.error instanceof Error
            ? orderQuery.error.message
            : 'Não foi possível carregar este pedido.'}
        </p>
        <Link to="/profile" className="mt-6 inline-block text-xs text-kurio-amber underline">
          Voltar ao perfil
        </Link>
      </main>
    )
  }

  const order = orderQuery.data
  return (
    <main className="mx-auto min-h-[60vh] max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
      {order.status === 'confirmed' ? (
        <Receipt order={order} />
      ) : order.status === 'pending' ? (
        <section
          role="status"
          className="mx-auto max-w-2xl rounded-2xl border border-kurio-amber/40 bg-kurio-surface px-6 py-14 text-center sm:px-12"
        >
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-kurio-amber/10 text-kurio-amber">
            <Clock3 size={28} aria-hidden="true" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">Compra em processamento</h1>
          <p className="mt-3 text-sm leading-6 text-kurio-text-muted">
            Aguardando confirmação da rede. Esta página será atualizada assim que
            a transação for concluída.
          </p>
          <p className="mt-5 text-[10px] text-kurio-text-muted">
            Pedido {order.id} · {formatEthDisplay(order.snapshot.totalEth)}
          </p>
        </section>
      ) : (
        <section
          role="alert"
          className="mx-auto max-w-2xl rounded-2xl border border-kurio-danger/40 bg-kurio-surface px-6 py-14 text-center sm:px-12"
        >
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-kurio-danger/10 text-kurio-danger">
            <XCircle size={28} aria-hidden="true" />
          </div>
          <h1 className="mt-6 text-2xl font-bold">Pagamento recusado</h1>
          <p className="mt-3 text-sm leading-6 text-kurio-text-muted">
            {order.failureReason ?? 'A carteira não autorizou esta transação.'}
          </p>
          <p className="mt-3 text-[10px] text-kurio-text-muted">
            Seus NFTs continuam no carrinho. Você pode revisar o pagamento e tentar novamente.
          </p>
          <Link
            to="/checkout"
            className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg bg-kurio-amber px-6 py-3 text-xs font-bold text-kurio-bg"
          >
            <Check size={15} aria-hidden="true" />
            Voltar ao checkout
          </Link>
        </section>
      )}
    </main>
  )
}
