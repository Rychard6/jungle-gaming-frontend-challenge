# Arquitetura do KURIO

Este documento descreve a organização do frontend, seus contratos simulados, as regras de sessão e os mecanismos usados para manter REST, cache e eventos em tempo real consistentes.

## Visão geral

```text
Browser
├── React 19 + TanStack Router
├── TanStack Query ── Axios ── MSW handlers ── MockDB (localStorage)
└── Socket.IO Client ── MSW Socket.IO binding
```

O servidor Vite entrega a aplicação. O MSW intercepta as requisições REST no browser e mantém os dados demonstrativos no armazenamento local; o binding de Socket.IO simula eventos em tempo real. Não existe backend ou blockchain real neste fluxo.

## Organização por módulos

### `src/features/*`

Cada feature contém as páginas, componentes, hooks e funções de API necessários ao seu fluxo:

- `catalog` e `nft-detail`: catálogo pesquisável, filtros, paginação e detalhe.
- `favorites`: estado de favoritos e mutações otimistas.
- `cart`: carrinho persistido, quantidades, cupons e revisão de disponibilidade.
- `auth`: autenticação, provider/contexto de sessão e guarda de páginas privadas.
- `profile` e `wallets`: dados de colecionador, senha e carteiras.
- `checkout`: cotação e envio de compra.
- `orders`: consulta, estado e recibo de pedido.

As funções `features/*/api` acessam o `httpClient` comum e transformam respostas HTTP nos DTOs compartilhados. As rotas fazem lazy loading via `src/app/route-components.tsx`; `<Suspense>` apresenta um estado de carregamento enquanto o chunk da rota é baixado.

### `src/shared/*`

- `shared/api/types.ts`: tipos dos recursos, DTOs e envelopes de evento.
- `shared/api/http.ts`: instância Axios, headers de autenticação/cenário, identidade de sessão e tratamento de 401.
- `shared/socket/socket-client.ts`: conexão Socket.IO, deduplicação/versionamento de eventos, filtragem por usuário e reconciliação do cache.
- `shared/lib/eth-math.ts`: parsing, formatação e operações exatas entre ETH decimal e Wei.
- `shared/ui` e `shared/ui/layout`: componentes de interface, navegação e toolbar de cenários.

### `src/mocks/*`

- `mocks/db.ts`: fixtures e operações do MockDB. O estado é persistido no `localStorage` e pode ser restaurado pelo endpoint de reset.
- `mocks/handlers.ts`: contratos REST, validações, erros e cenários controlados pelo header `x-mock-scenario`.
- `mocks/browser.ts`: configuração do worker MSW.

O worker é carregado dinamicamente durante a inicialização para não incorporar o runtime MSW ao bundle inicial. O processo da aplicação aguarda o worker iniciar antes de renderizar a árvore React.

## Sessão, autenticação e isolamento

### Autenticação

O token de sessao demonstrativo e o `userId` sao armazenados no `localStorage`. Senhas usam PBKDF2-SHA256 com 100 mil iteracoes e salt aleatorio para novas senhas; apenas as fixtures possuem salts fixos para reproducao. Isso nao substitui sessao, armazenamento e autorizacao em um servidor de producao.

As rotas de perfil, carteiras, checkout e pedidos exigem sessão. Uma chamada autenticada que retorna `401` aciona o callback central do cliente HTTP:

1. remove token/identidade local e dados privados do usuário anterior;
2. reinicia o Socket.IO para a sessão anônima e cria um novo ID de visitante;
3. anuncia que a sessão expirou;
4. direciona para `/login?redirect=<rota-atual>`;
5. após autenticação, retoma o destino guardado.

Logout e troca de conta removem as queries privadas da identidade anterior e reinicializam o socket, inclusive entre abas pelo evento `storage`. Paginas privadas remontam por usuario; callbacks de mutacoes verificam a identidade capturada antes de alterar caches ou navegar. No login/cadastro, o carrinho visitante e mesclado ao da conta, limitado pelo estoque.

### Chaves de cache privadas

Toda query privada deve ser separada pelo escopo da sessão. O helper `getSessionCacheKey()` fornece `user:<userId>` para uma conta ou `guest:<guestSessionId>` para um visitante. Exemplos:

```ts
['cart', sessionKey]
['favorites', sessionKey]
['profile', sessionKey]
['wallets', sessionKey]
['orders', sessionKey]
['order', orderId, sessionKey]
```

O escopo impede que uma resposta cacheada para um usuário seja renderizada para outro. Ao trocar usuário ou sair, as queries da chave anterior são removidas. Queries públicas, como o catálogo, não usam esse escopo.

## Contratos REST do mock

Os caminhos abaixo são relativos à base `/api`. Os recursos privados exigem `Authorization: Bearer <token>`, exceto quando explicitamente indicado.

| Método e caminho | Acesso | Função |
| --- | --- | --- |
| `GET /nfts` | Público | Busca, filtros, ordenação e paginação do catálogo. |
| `GET /nfts/:id` | Público | Detalhe por ID, slug ou alias demonstrativo `/nfts/nft-1`. |
| `GET /favorites` | Sessão atual | Consulta IDs favoritados. |
| `POST /favorites/:nftId` | Sessão atual | Marca favorito. |
| `DELETE /favorites/:nftId` | Sessão atual | Remove favorito. |
| `GET /cart` | Sessão atual/guest | Consulta itens, totais, cupom, versões e alterações pendentes. |
| `POST /cart/items` | Sessão atual/guest | Adiciona item/quantidade. |
| `PATCH /cart/items/:itemId` | Sessão atual/guest | Altera a quantidade. |
| `DELETE /cart/items/:itemId` | Sessão atual/guest | Remove item. |
| `POST /cart/coupon` e `DELETE /cart/coupon` | Sessão atual/guest | Aplica ou remove cupom. |
| `POST /cart/acknowledge-changes` | Sessão atual/guest | Confirma preços/estoque atualizados e remove itens indisponíveis. |
| `POST /auth/login` | Público | Autentica credenciais demonstrativas e mescla o carrinho guest. |
| `POST /auth/register` | Público | Valida e cria conta demonstrativa; mescla o carrinho guest. |
| `GET /auth/session` e `POST /auth/logout` | Público/token quando disponível | Consulta ou encerra a sessão atual. |
| `GET /profile` e `PATCH /profile` | Autenticado | Consulta e atualiza o perfil do usuário. |
| `POST /profile/password` | Autenticado | Valida senha atual e altera a senha. |
| `GET /wallets`, `POST /wallets`, `PATCH /wallets/:id`, `DELETE /wallets/:id` | Autenticado | Consulta e mantém carteiras do usuário. |
| `POST /checkout/quote` | Autenticado | Revalida carrinho, disponibilidade, cupom, taxa de rede e total; retorna `quoteVersion`. |
| `POST /orders` | Autenticado | Cria ou recupera pedido idempotente; exige `Idempotency-Key`. |
| `GET /orders` e `GET /orders/:orderId` | Autenticado | Lista pedidos do usuário ou consulta pedido próprio. |
| `POST /__mock__/reset` | Ferramenta de desenvolvimento | Restaura fixtures e o cenário de rede `default`. |
| `POST /__mock__/simulate-nft-update` | Ferramenta de desenvolvimento | Atualiza preço/estoque de NFT e emite evento de NFT. |
| `POST /__mock__/simulate-order-update` | Autenticado, ferramenta de desenvolvimento | Transiciona pedido pendente para confirmado/recusado e emite evento. |

Erros da API têm `message`, `code` e, quando aplicável, `fieldErrors`. Entre os erros de domínio estão `SESSION_EXPIRED` (401), `USER_ALREADY_EXISTS` (409), `INSUFFICIENT_STOCK`, `COUPON_EXPIRED`, `STALE_QUOTE` (409), `IDEMPOTENCY_CONFLICT` (409) e `ORDER_TIMEOUT` (504).

## Carrinho, cupons e valores monetários

O carrinho é mantido por identidade de sessão no MockDB, inclusive para visitantes via `x-guest-session-id`. Cada item retém preço/versão da inclusão; a API recalcula o estado atual e marca diferença de preço ou disponibilidade. O cliente bloqueia a finalização até a pessoa revisar as mudanças. No merge guest → usuário, as quantidades são somadas respeitando `availableEditions`, e o carrinho temporário é limpo.

Cupons demonstrativos:

- `KURIO10`: desconto percentual de 10%.
- `LANCAMENTO1ETH`: desconto fixo de 1 ETH quando o subtotal mínimo de 2 ETH é atendido.
- `EXPIRADO20` e `EXPIRED`: simulam cupom expirado.

Valores trafegam nos DTOs como strings decimais em ETH. Operações monetárias convertem para Wei usando `BigInt` (`1 ETH = 10^18 Wei`) em `shared/lib/eth-math.ts`, evitando erros de arredondamento de ponto flutuante. A taxa de rede da simulação é `0.016 ETH` para carrinhos com itens.

## Pedidos, cotação e idempotência

O cliente solicita uma cotação e envia `quoteVersion` com os dados do coletor, rede e provedor ao criar o pedido. O servidor revalida preço, estoque e carrinho. Se a cotação mudou, retorna `409 STALE_QUOTE`, exigindo nova revisão.

`Idempotency-Key` identifica uma tentativa de compra por usuário. O MockDB associa a chave ao hash do payload:

- mesma chave e mesmo payload: devolve o pedido existente sem nova baixa de estoque;
- mesma chave e payload diferente: `409 IDEMPOTENCY_CONFLICT`;
- timeout transitório: o pedido fica gravado; a repetição com a mesma chave recupera esse pedido.

O pedido armazena `snapshot` com itens, quantidades, preco unitario, subtotais, desconto, taxa e total. O recibo le exclusivamente esse snapshot. Um pedido pendente reserva estoque, mas preserva o carrinho. A confirmacao remove somente as quantidades compradas, mantendo adicoes posteriores. A recusa devolve o estoque reservado, sem duplicar itens no carrinho. Reservas e devolucoes emitem `nft.updated`.

Uma nova chave nao cria outra compra enquanto existe pedido pendente (`409 ORDER_PENDING`). O checkout recupera pedidos pendentes mesmo com carrinho preenchido. Repeticoes apos timeout reutilizam a chave e o payload original; dados invalidos do coletor sao rejeitados por validacao compartilhada entre UI e handlers REST.

## Socket.IO e reconciliação

Os eventos usam um envelope comum:

```ts
interface EventEnvelope<TType, TPayload> {
  eventId: string
  type: TType
  resourceId: string
  version: number
  userId?: string
  timestamp: string
  payload: TPayload
}
```

### `nft.updated`

Payload: `{ nftId, priceEth, availableEditions, editionType }`. O cliente cancela consultas publicas em voo, atualiza os caches conhecidos e invalida listas para recomputar ordenacao, filtros e paginacao, alem de carrinho/cotacao. A alteracao exige confirmacao explicita antes de enviar o pedido.

### `order.updated`

Payload: `{ orderId, status, transactionHash, failureReason? }`, com `userId` obrigatório. O cliente filtra eventos de outro usuário, ignora `eventId` já processado e versões iguais/antigas, e impede regressão de pedido terminal. Atualiza os caches de pedido quando disponíveis e invalida lista de pedidos, detalhe do pedido e carrinho. Na reconexão, invalida queries ativas de pedidos para reconciliar via REST.

REST permanece a fonte de verdade recuperável. Eventos aceleram a atualização da interface; reconexão ou carregamento da rota faz nova consulta para não depender da entrega de cada evento.

## Política de cache do TanStack Query

- `staleTime` padrao: 30 segundos; `gcTime`: 5 minutos. Sem refetch ao focar a janela; reconexao revalida dados ativos. Consultas de recuperacao de pedidos usam `staleTime: 0`.
- Queries repetem uma vez falhas de rede/5xx, nunca 4xx; mutations nao possuem repeticao automatica.
- Dados públicos do catálogo e detalhe são cacheados por parâmetros/ID do recurso; o socket atualiza o que sabe e invalida recursos dependentes.
- Favoritos, carrinho, perfil, carteiras e pedidos carregam o escopo da sessão na query key.
- Favoritos usam atualizacao otimista com rollback por NFT, sem substituir a lista de outras mutacoes concorrentes.
- Mutação de carrinho invalida/refaz a consulta para obter totais e disponibilidade autoritativos do MockDB.
- Perfil e carteiras são atualizados no cache após mutation para refletir alterações imediatamente e após recarga.
- Eventos de pedido atualizam/invalida caches; reconnect invalida consultas ativas de pedidos e busca o estado atual na API.
- Logout, expiração e troca de usuário removem queries privadas sob o escopo anterior.

## Limitações conhecidas e decisões de UX

- MSW/MockDB, sessão, Socket.IO, pagamentos, estados de carteira e links de explorador são simulações no browser. Não há persistência multi-dispositivo, validação de autorização no servidor real ou transação blockchain.
- A persistencia local valida estruturas antes de aceita-las; dados corrompidos voltam ao estado demonstrativo seguro. Nao ha migracao ou recuperacao de registros locais invalidos.
- A toolbar de desenvolvimento expõe controles de reset, troca de usuário e simulação; não deve ser habilitada como ferramenta operacional em um produto publicado.
- A autenticação Google/Facebook é indicativa, não executa OAuth.
- Checkout bloqueia envio em caso de cotação desatualizada ou carteira desconectada/recusada e pede revisão explícita; erro de rede e recusas mantêm contexto para nova tentativa.
- Login/cadastro e filtros móveis implementam Escape e foco visível/contido; erros da API são apresentados junto ao formulário e associados aos campos quando aplicável.
- A implementação prioriza estados de carregamento, erro, vazio, sessão expirada, pedido pendente e pagamento recusado em vez de exibir sucesso presumido.
- Dialogos tornam o fundo `inert`, filtram controles invisiveis e restauram foco. Filtros preservam o acionador ao aplicar precos. A toolbar fechada ocupa apenas um icone no mobile.
- Evidencias, ambiente de medicao e pendencias de performance/deploy estao no README e em `reports/lighthouse/`; nao ha afirmacao de conformidade integral enquanto os gates mobile falharem.
