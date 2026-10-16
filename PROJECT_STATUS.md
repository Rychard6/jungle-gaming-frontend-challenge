# PROJECT_STATUS.md — KURIO NFT Marketplace (Jungle Gaming Challenge)

## 1. Estado Atual do Projeto
- **Fase Atual:** Fase 7 — Passo 3: documentação profissional e arquitetura registradas; auditoria Lighthouse permanece pendente.
- **Caminho Local:** `C:\Users\rycha\jungle-gaming-frontend-challenge`
- **Ambiente:** Node `v20.20.2` | Vite `^8.3.0` | React `^19.2.8` | TypeScript `~6.0.2`
- **Regra de Instalação de Pacotes:** Usar `npx npm@11.6.0 install ...` para evitar erro `edgesOut` do `@npmcli/arborist` no npm 10.8.2.

## 2. Dependências Confirmadas no `package.json`
- **Instaladas:**
  - `react` (`^19.2.8`), `react-dom` (`^19.2.8`)
  - `@tanstack/react-query` (`^5.104.3`)
  - `@tanstack/react-router` (`^1.170.44`)
  - `axios` (`^1.20.0`)
  - `socket.io-client` (`^4.8.4`)
  - `tailwindcss` (`^4.3.3`), `@tailwindcss/vite` (`^4.3.3`)
  - `clsx` (`^2.1.1`), `tailwind-merge` (`^3.7.0`), `lucide-react` (`^1.57.0`)
  - `msw` (`^2.15.0`), `@mswjs/socket.io-binding` (`^0.2.0`)
  - `@playwright/test` (`^1.64.1`)
- **Pendentes de Instalar (Próxima Etapa):**
  - `zod`, `react-hook-form`, `@hookform/resolvers`.

## 3. Decisões Técnicas e Visuais Aprovadas (Figma KURIO)
- **Identidade Visual (KURIO):** Tema escuro (`#140D08` fundo principal, `#22160F` cards/superfícies, `#3A2618` bordas, `#D48A46` cor primária âmbar/cobre) e tipografia monoespaçada (`IBM Plex Mono` / `JetBrains Mono`).
- **Estratégia de Assets:** As 4 ilustrações recorrentes de macacos do Figma (`ape-emerald`, `ape-cosmic`, `ape-ivory`, `ape-golden`) serão servidas localmente em `public/mock-assets/nfts/` para estabilidade nos testes de regressão visual e performance no Lighthouse.
- **Matemática Monetária (ETH):** Valores em ETH trafegam como strings decimais nos contratos da API e são calculados via `BigInt` na escala Wei (10^18).
- **Isolamento de Sessão:** Query Keys privadas escopadas por `userId` e limpeza completa de cache e conexões Socket.IO ao deslogar ou trocar de usuário.

## 4. Plano de Fases e Progresso
- [x] **Fase 0:** Reconhecimento do ambiente, validação do `package.json` e inspeção das 9 telas Desktop e 6 telas Mobile do Figma.
- [x] **Fase 1:** Instalação do Tailwind CSS + Configuração do Tema KURIO e Utilitários Base.
- [x] **Fase 2:** Fundação de Rede (Axios + MSW REST + Prova de Conceito Socket.IO + Matemática ETH).
- [x] **Fase 3 — Passo 1:** Rotas baseadas em código, layout responsivo, toolbar de cenários, catálogo com busca/filtros/ordenação/paginação sincronizados à URL e 18 fixtures.
- [x] **Fase 3 — Passo 2:** Página responsiva de detalhes do NFT, galeria, coleção, ações de compra e favoritos com atualização otimista e rollback.
- [x] **Fase 4 — Carrinho:** Carrinho persistido por sessão no MockDB, cupons, regras de estoque, UI responsiva e sincronização com eventos `nft.updated`.
- [x] **Fase 5:** Login/Cadastro e sessão; perfil do colecionador e CRUD de carteiras; merge guest → usuário, expiração 401, isolamento de dados e logout.
- [x] **Fase 6:** Checkout, cotação validada, criação idempotente de pedidos, cenários de recusa/timeout, eventos `order.updated`, recuperação e recibo imutável.
- [x] **Fase 7 — Passos 1 e 3:** Code-splitting, configuração/suíte Playwright E2E/visual, README e arquitetura documentados. A execução da suíte E2E e auditoria Lighthouse permanecem pendentes; URL de deploy está registrada no README.

### Entregas da Fase 7 — Passo 1
- Rotas de catálogo, detalhe, carrinho, autenticação, área protegida e confirmação agora usam `React.lazy`/`Suspense`; a inicialização do MSW também foi adiada para separar o mock runtime do bundle inicial.
- Playwright configurado para preview em `127.0.0.1:4173`, projetos Chromium desktop `1440x900` e mobile `390x844`, trace retido em falhas e reporter HTML sem abertura automática.
- Scripts `test:e2e`, `test:e2e:ui` e `typecheck` adicionados; os specs cobrem catálogo/detalhe, autenticação/perfil/carteiras, carrinho/checkout/tempo real e snapshots visuais.
- IDs de fixture `/nfts/nft-1` são aliases estáveis do primeiro NFT, além dos IDs e slugs existentes, para suportar links diretos de demonstração.
- Execução completa do Playwright deliberadamente não realizada nesta sessão; os snapshots visuais são gerados/atualizados pelo runner ao executar os testes. Lighthouse, documentação e deploy continuam pendentes.
- Validação desta etapa: `npm run lint` e `npm run build` passaram. Bundle maior: runtime MSW com 481.89 kB; bundle inicial com 270.54 kB; Vite não emitiu aviso de chunk acima de 500 kB.
- Documentação: `README.md` contém apresentação, links, setup, comandos e cenários demonstrativos; `ARCHITECTURE.md` descreve módulos, contratos REST/Socket.IO, sessão, cache, valores ETH, carrinho e idempotência.

## 5. Entregas do Passo 1 da Fase 3
- Rotas `/`, `/nfts/$nftId`, `/cart`, `/login`, `/register`, `/profile` e `/wallets`, além de uma página 404 própria.
- Layout KURIO com cabeçalho e rodapé desktop, navegação móvel e avisos explícitos para ações demonstrativas fora do escopo.
- Catálogo com 18 NFTs em nove categorias e três redes; busca, filtros, faixa ETH, abas, ordenação e paginação usam parâmetros de busca da URL.
- Consultas do catálogo encaminham o `AbortSignal`; o cenário `out-of-order` atrasa respostas para exercitar cancelamento e prevenção de resultados obsoletos.
- Filtros móveis em diálogo acessível, com fechamento por Escape, retorno de foco e contenção de navegação por Tab.
- Toolbar recolhível para cenários MSW/Socket.IO, disparo/duplicação de eventos e reset das fixtures.
- Validação manual no navegador: sem overflow em 390/768/1440px; filtros e busca atualizam a URL; catálogo exibe 9 itens por página nas duas páginas; rota inexistente mostra 404; requisição antiga é cancelada no cenário `out-of-order`.
- `npm run lint` e `npm run build` concluídos com código 0. O build mantém o aviso informativo de bundle JavaScript acima de 500 kB.

## 6. Entregas do Passo 2 da Fase 3
- Rota `/nfts/$nftId` com carregamento de detalhes por ID/slug, estado de carregamento, tratamento específico de 404 e retorno ao catálogo.
- Página responsiva com galeria selecionável, dados da obra/coleção/rede/contrato, atributos, avaliações, edição disponível, seletor de quantidade limitado ao estoque, compartilhamento e itens da mesma coleção.
- Ações de compra e adição ao carrinho disponíveis nos cards e na página de detalhes; o carrinho persistente foi implementado na Fase 4.
- API REST simulada para favoritos com armazenamento separado por sessão/usuário, persistência no MockDB local e limpeza no reset.
- Hook `useFavorites` usa cache TanStack Query por sessão, atualização otimista, rollback em erro e invalidação após a mutação. O cenário de rede inclui a opção `Erro de rede` e falha nos endpoints de favoritos; o erro é anunciado de forma acessível.
- Botões de quantidade e favorito têm rótulos acessíveis e foco visível; controles de favoritos permanecem visíveis em telas estreitas.
- Validação manual no navegador: página de `Emerald Ape #042` carrega os quatro previews; favoritar atualiza o coração; com `Erro de rede`, remover o favorito reverte o estado e anuncia o erro; 404 oferece retorno ao catálogo; restauração do cenário e do MockDB confirmada.
- `npm run lint` concluído sem erros ou warnings e `npm run build` concluído com código 0 (o aviso existente de bundle acima de 500 kB permanece).

## 7. Entregas da Fase 4 — Carrinho Persistente
- Carrinhos e cupons são armazenados por sessão no MockDB local. A API usa token `Authorization` quando disponível, ou `x-guest-session-id` para visitantes; o cliente usa query key TanStack Query privada por sessão.
- Endpoints implementados: `GET /api/cart`, `POST/PATCH/DELETE /api/cart/items`, `POST/DELETE /api/cart/coupon` e `POST /api/cart/acknowledge-changes`.
- Itens incluem quantidade, edição escolhida e snapshot de preço/versão de inclusão. Operações validam IDs, quantidades e disponibilidade, com `409 INSUFFICIENT_STOCK` em excesso.
- Totais calculados com `eth-math.ts`: subtotal por linha, taxa de rede `0.016 ETH` quando o carrinho tem itens, cupom aplicado e total sem aritmética de ponto flutuante.
- Cupons disponíveis: `KURIO10` (10%), `LANCAMENTO1ETH` (1 ETH para subtotal mínimo de 2 ETH), códigos expirados `EXPIRADO20`/`EXPIRED` e erro de código inválido.
- Remoção de item/cupom, atualização de quantidade e confirmação de novos preços/estoque sincronizam o cache após resposta da API. Ao confirmar, itens sem estoque são removidos e informados; quantidades acima do estoque são ajustadas.
- `/cart` agora exibe itens, controles, resumo, cupom, taxa, bloqueio de finalização quando houver alterações pendentes/estoque insuficiente, skeletons e cinco recomendações. Header e navegação móvel refletem a soma das quantidades.
- Os cards e a página de detalhes usam o endpoint real do carrinho; o detalhe envia quantidade selecionada e tipo de edição.
- Ao receber `nft.updated`, o cliente atualiza os caches do catálogo/detalhe e invalida `['cart']`. O carrinho refaz a consulta e anuncia mudanças de preço/disponibilidade com os valores anteriores riscados.
- A ferramenta de demonstração permite alterar o preço e esgotar o primeiro item do carrinho (ou o primeiro do catálogo), emitindo `nft.updated`.
- Validação manual: inclusão pelo catálogo atualiza o badge e aparece na página; cupom `KURIO10` descontou 10%; alteração Socket.IO mostrou preço antigo riscado e bloqueou finalização; confirmação removeu item esgotado e limpou a pendência. API também retornou `409 INSUFFICIENT_STOCK` e `422 COUPON_EXPIRED`; estado simulado foi restaurado ao final.
- `npm run lint` e `npm run build` concluídos com código 0; permanece o aviso informativo de bundle acima de 500 kB.

### 8. Entregas da Fase 5 — Passo 1 (Autenticação e Sessão)
- API MSW para login, cadastro, consulta e encerramento de sessão; usuários e sessões ficam no MockDB, e as credenciais são verificadas por hash determinístico, nunca armazenadas em texto claro.
- Credenciais fictícias para demonstração: `contato@email.com` / `Kurio@2026` (Nova Sato) e `colecionador@kurio.io` / `Kurio@2026` (Kael Vance). Cada conta possui carteiras iniciais isoladas.
- Login/cadastro mesclam itens do carrinho temporário ao carrinho da conta, com quantidades limitadas pelas edições disponíveis; o carrinho guest é removido após a mesclagem.
- Rotas `/profile`, `/wallets` e `/checkout` exigem sessão e redirecionam para login mantendo a rota de retorno. A simulação `session-expired` retorna um 401 único, limpa a sessão local e preserva o fluxo para reautenticação.
- Chaves de cache de carrinho/favoritos incluem `user:<id>` ou `guest:<id>`; logout e troca de conta removem caches privados da sessão anterior e reiniciam o socket, cujos eventos privados são filtrados por usuário.
- Formulários responsivos de login/cadastro incluem alternância de senha, validação acessível, fechamento por Escape e contenção do foco; o cabeçalho mostra o nome/iniciais do colecionador e links para perfil/carteiras.
- Toolbar de desenvolvimento permite alternar Nova Sato, Kael Vance e visitante, além de selecionar a expiração simulada de sessão.
- `npm run lint` e `npm run build` concluídos com código 0.

### Entregas da Fase 5 — Passo 2 (Perfil e Carteiras)
- Endpoints autenticados de perfil e carteiras implementados no MSW/MockDB, com persistência local, validação de campos, conflitos de e-mail/username e validação de endereço de carteira.
- `AccountSidebarLayout` compartilhado oferece navegação lateral no desktop e menu horizontal acessível no mobile; ações fora do escopo anunciam indisponibilidade e logout encerra a sessão.
- `/profile` permite editar nome, usuário, e-mail, ENS/domínio, apelido da carteira e avatar local/URL, além de alterar senha validando senha atual, tamanho mínimo e confirmação.
- `/wallets` permite cadastrar/editar/remover carteiras principal e secundária, escolher rede/provedor, definir uma carteira como principal e vincular o endereço secundário ao principal.
- Queries usam `['profile', 'user:<id>']` e `['wallets', 'user:<id>']`; as mutações atualizam o cache autenticado, e as alterações persistem após recarregar a aplicação.
- `npm run lint` e `npm run build` concluídos com código 0.

### Entregas da Fase 6 — Checkout e Pedidos
- `POST /api/checkout/quote` revalida carrinho, disponibilidade, cupom e taxa de rede; `POST /api/orders` valida cotação, estoque e `Idempotency-Key`, cria snapshot e impede duplicação.
- Cenários determinísticos `payment-declined` e `order-timeout-recovery`; atualização simulada de pedidos pendentes emite `order.updated` e reconcilia carrinho/pedidos.
- Checkout responsivo inclui dados da carteira/perfil, seleção de provedor, cupom, totais, bloqueio e revisão de cotação após evento NFT.
- A chave e a assinatura hash do payload idempotente são mantidas no navegador para repetir com segurança após timeout/recarregamento; checkout recupera pedido recente quando o carrinho já foi consumido.
- `/orders/$orderId` exibe estados pendente/recusado e recibo confirmado usando os itens e valores congelados em `order.snapshot`.
- Validação da Fase 6: `npm run lint` e `npm run build` concluídos com código 0; o build mantém o aviso informativo de bundle JavaScript acima de 500 kB.

## 9. Regras de Arquitetura
- Manter a raiz do projeto limpa e organizada.
- Separar assets estáticos de mocks (`public/mock-assets/nfts`) do código-fonte (`src/`).

### 10. Restrições Explícitas
- NÃO instale nenhuma dependência nesta tarefa.
- Não apagar a pasta `.git` nem executar comandos Git destrutivos.

### 11. Comportamentos de Erro
- Se algum comando de terminal falhar (`lint` ou `build`), pare imediatamente e reporte o log completo do erro sem tentar modificar configurações de TypeScript ou ESLint por conta própria.

### 12. Critérios de Aceitação
- `npm run lint` passa sem erros ou warnings.
- `npm run build` conclui com código de saída 0.

### 13. Comandos de Validação (Execute no terminal PowerShell)
Execute os comandos abaixo no terminal e mostre a saída completa no chat:
```powershell
New-Item -ItemType Directory -Force -Path "public/mock-assets/nfts" | Out-Null
Test-Path "PROJECT_STATUS.md"
Test-Path "public/mock-assets/nfts"
Get-ChildItem -Path src -Recurse | Select-Object FullName
git status --short
npm run lint
npm run build
```
