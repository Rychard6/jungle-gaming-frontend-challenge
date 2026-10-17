# KURIO — NFT Marketplace

Marketplace responsivo de NFTs criado para o Jungle Gaming Frontend Challenge. A aplicação reúne catálogo e detalhes de NFTs, favoritos, carrinho com cupons, autenticação, perfil e carteiras, checkout, pedidos idempotentes e recibos com snapshot imutável. As APIs e os eventos em tempo real são simulados localmente com Mock Service Worker (MSW).

| Recurso | Link |
| --- | --- |
| Protótipo no Figma | [Frontend Challenge — KURIO](https://www.figma.com/design/Ff0SksUi7UFtPWUO8kyNtw/Frontend-Challenge?node-id=0-1) |
| Aplicação publicada | [jungle-gaming-frontend-challenge-rho.vercel.app](https://jungle-gaming-frontend-challenge-rho.vercel.app) |
| Repositório | [Rychard6/jungle-gaming-frontend-challenge](https://github.com/Rychard6/jungle-gaming-frontend-challenge) |

## Stack

- React 19 e TypeScript 6
- Vite 8, com divisão de código por rota e carregamento sob demanda
- TanStack Router para navegação e estado da URL
- TanStack Query para cache, mutações e sincronização de dados
- Axios para chamadas REST
- MSW 2 para APIs simuladas e `@mswjs/socket.io-binding` para eventos locais
- Socket.IO Client para eventos `nft.updated` e `order.updated`
- Tailwind CSS 4 e lucide-react
- Playwright Test para testes E2E e regressão visual
- ESLint 10 e TypeScript project references para qualidade e tipagem

## Requisitos

- Node.js 22.12 ou superior; a validacao local usa Node 22.23.3 (`nvm use`).
- npm

Não são necessárias variáveis de ambiente para executar a aplicação localmente. As APIs são atendidas pelo MSW no browser; não é necessário configurar servidor ou credenciais externas.

## Instalação e comandos

```bash
nvm use
npm ci
npm run dev
```

O servidor de desenvolvimento do Vite mostra o endereço local (normalmente `http://localhost:5173`).

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento com HMR. |
| `npm run build` | Executa `tsc -b` e gera o build de produção em `dist/`. |
| `npm run preview` | Serve localmente o último build de produção. |
| `npm run lint` | Executa ESLint no projeto. |
| `npm run typecheck` | Verifica os projetos TypeScript (`tsc -b`). |
| `npm run test:e2e` | Executa a suite Playwright em desktop, tablet e mobile. O `webServer` constroi e serve o app em `127.0.0.1:4173`. |
| `npm run test:e2e:ui` | Abre a interface de execução do Playwright. |
| `npm run test:e2e:update-snapshots` | Regenera explicitamente os 12 baselines visuais; revisar antes de aceitar. |
| `npm run lighthouse` | Audita home e detalhe, tres execucoes mobile por pagina. Requer build previo e Chrome/Chromium. |
| `npm run lighthouse:desktop` | Repete a auditoria com preset desktop. |
| `npm run lighthouse:summary` | Consolida medianas, LCP, CLS e TBT; termina com erro se um limite nao for atendido. |

Para preparar o servidor de preview manualmente:

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
```

## Contas demonstrativas

As fixtures do MockDB incluem duas contas para demonstração e testes de isolamento:

| Colecionador | E-mail | Senha |
| --- | --- | --- |
| Nova Sato | `contato@email.com` | `Kurio@2026` |
| Kael Vance | `colecionador@kurio.io` | `Kurio@2026` |

Essas credenciais são fictícias e usadas somente pelo ambiente de demonstração. O MockDB persiste localmente hashes das senhas, não as senhas em texto claro.

## Cenários de simulação (MSW)

Abra **Ferramentas de demonstração** no rodapé para trocar o cenário de rede. A escolha fica em `localStorage` sob `kurio_mock_scenario` e é enviada à API no header `x-mock-scenario`. O cenário **Normal** corresponde a `default`.

| Cenário | Como reproduzir | Resultado esperado |
| --- | --- | --- |
| Rede lenta (`slow-network`) | Selecione no menu e carregue o catálogo. | A resposta do catálogo é atrasada para exercitar skeletons. |
| Fora de ordem (`out-of-order`) | Selecione e faça consultas consecutivas ao catálogo. | Respostas têm latências diferentes para exercitar cancelamento e atualização segura da interface. |
| Erro de rede (`network-error`) | Selecione e altere favorito ou carrinho. | A chamada falha; a UI apresenta erro e reverte atualizações otimistas quando aplicável. |
| Erro 500 (`server-error-500`) | Selecione e abra/recarregue o catálogo. | O catálogo mostra erro e oferece **Tentar novamente**. |
| Sessão expirada (`session-expired`) | Autentique-se, selecione o cenário e acesse uma área autenticada. | A API retorna 401 uma vez; a sessão local é limpa e o login mantém a rota para retomada. |
| Pagamento recusado (`payment-declined`) | Adicione um NFT, autentique-se, avance ao checkout e confirme. | O pedido é recusado, o recibo de sucesso não é exibido e itens/estoque são preservados. |
| Timeout recuperável (`order-timeout-recovery`) | Faça checkout e confirme uma vez; depois use **Tentar novamente com segurança**. | A primeira resposta simula timeout; a repetição da mesma chave recupera o pedido sem duplicar a compra. |

Os botões da toolbar também permitem alternar entre Nova, Kael e visitante, emitir `nft.updated`, provocar alteração de preço/estoque no carrinho, confirmar ou recusar um pedido pendente, testar eventos antigos/duplicados e restaurar o MockDB. **Resetar MockDB** reinicializa as fixtures e retorna o cenário a `default`; para limpar também o estado do browser, limpe o `localStorage` e recarregue.

### Fluxos rápidos de falha e tempo real

1. **Rollback de favorito:** selecione **Erro de rede**; marque/remova um favorito e observe a mensagem e a reversão do coração.
2. **Revisão de carrinho:** adicione `Emerald Ape #042`, abra o carrinho e use **Simular mudança de preço e estoque no carrinho**. A finalização fica bloqueada até **Confirmar novos valores**; um item sem estoque pode ser removido ao confirmar.
3. **Cotação no checkout:** avance para checkout autenticado e use **Disparar nft.updated (+0.10 ETH)**. O pagamento fica bloqueado até **Revisar e confirmar novos valores**.
4. **Pedido pendente:** após iniciar uma compra, use **Confirmar pedido pendente** ou **Recusar pedido pendente** na toolbar. `order.updated` atualiza a confirmação; reconectar/recarregar reconcilia o estado pela API.
5. **Recibo:** pedidos confirmados mostram os valores e itens congelados no snapshot, mesmo se o catálogo mudar posteriormente.

## Testes E2E e snapshots

Os specs ficam em `tests/e2e/`; cada projeto usa viewport dedicado: Chromium desktop `1440×900`, tablet `768×1024` e mobile `390×844`. O servidor de teste e o build de producao em `http://127.0.0.1:4173`. Os testes incluem axe (WCAG 2 A/AA e 2.1 AA), contratos REST, isolamento entre contas/abas, recuperacao de pedidos e Socket.IO.

```bash
npx playwright install chromium
npm run test:e2e
```

Para atualizar os snapshots visuais intencionalmente:

```bash
npm run test:e2e:update-snapshots
```

O Playwright mantem traces e screenshots em falhas e gera o [relatorio HTML](reports/playwright/index.html) em `reports/playwright/`, sem abri-lo automaticamente. Os baselines versionados cobrem home, detalhe, carrinho e checkout nas tres larguras.

Neste ambiente corporativo, o download do Chromium/ffmpeg do Playwright foi bloqueado. A suite foi executada com o Chrome instalado (128.0.6613.119), sem video, preservando screenshots e traces em falhas:

```bash
PLAYWRIGHT_CHANNEL=chrome PLAYWRIGHT_VIDEO=off npm run test:e2e -- --workers=2
```

## Evidencias e limites da entrega

- Lint, TypeScript e build de producao aprovados em Node 22.23.3/npm 10.9.9.
- Ultima validacao de entrega: **84 testes aprovados, zero falhas**, em duas execucoes com dois workers: 36 testes criticos desktop/mobile (checkout, idempotencia, isolamento e oito comparacoes visuais) e 48 verificacoes adicionais em desktop/tablet/mobile (conta, favoritos, sessao, historico, Socket.IO e axe). O [relatorio HTML](reports/playwright/index.html) corresponde aos 36 testes criticos; as verificacoes adicionais usaram o reporter de linha para preservar esse artefato.
- A suite completa teve uma execucao anterior com 193 aprovados e dois ignorados por viewport. Reexecucoes posteriores tiveram timeouts sob concorrencia; nao considerar esse resultado anterior uma certificacao integral da revisao final. A ultima passagem focada usou dois workers e nao reproduziu essas falhas.
- Lighthouse CI 0.14.0: tres execucoes por pagina/preset, sem reduzir os limites do desafio. [Medianas e metricas](reports/lighthouse/README.md), [dados consolidados](reports/lighthouse/summary.json) e relatorios HTML/JSON completos em `reports/lighthouse/`.
- Performance: **73/75 no mobile** (home/detalhe), **97/90 no desktop**. Acessibilidade 100, boas praticas 96 mobile/100 desktop, SEO 100. **O gate de performance mobile continua reprovado**; os scripts retornam erro corretamente. CLS mobile zero; CLS do detalhe desktop 0.144 ainda merece ajuste.
- A instalacao limpa nao foi comprovada: o espelho corporativo retornou 404 para um pacote opcional do Tailwind ausente do cache. Executar `npm ci` em CI/ambiente com acesso ao registro antes de publicar.
- O repositorio publico aponta para a URL `-rho` acima, cuja home corresponde ao projeto. Na verificacao de entrega, `/nfts/nft-1` e `/login` responderam 404 em acesso direto. A URL antiga sem `-rho` mostra outra versao. Esta revisao local ainda nao foi publicada; incluir a configuracao de fallback de rotas de [vercel.json](vercel.json) no novo deploy e repetir a verificacao remota.

### Checklist antes de enviar

- Versionar e enviar os arquivos locais, incluindo lockfile, assets, mocks, testes, 12 baselines, configuracao Vercel e relatorios. Nesta workspace, quase todo o projeto ainda aparece como nao rastreado no Git; a URL do repositorio so entrega essas alteracoes depois de commit e push.
- Publicar a revisao no projeto Vercel correto, usando Node 22 e os mocks habilitados. Testar home, acesso direto/recarga de `/nfts/nft-1` e `/login`, compra completa e Socket.IO na URL publica.
- Confirmar `npm ci` em ambiente com acesso ao registro e informar a pendencia de performance mobile. Nao apresentar o projeto como aprovado em todos os requisitos enquanto esses itens estiverem abertos.

Para reproduzir as auditorias, pare processos concorrentes e execute:

```bash
npm run build
CHROME_PATH=/usr/bin/google-chrome npm run lighthouse
CHROME_PATH=/usr/bin/google-chrome npm run lighthouse:desktop
npm run lighthouse:summary
```

O caminho de Chrome e especifico do ambiente; ajuste-o em outro sistema. Nao rode Lighthouse junto da suite E2E: a disputa por CPU altera as medicoes. Os horarios registrados nos relatorios usam o relogio da maquina de execucao.

## Estrutura do repositório

- `src/features/`: catálogo, detalhe, favoritos, carrinho, auth, perfil, carteiras, checkout e pedidos, organizados por funcionalidade.
- `src/shared/`: cliente HTTP, contratos compartilhados, socket, matemática ETH, UI e layout.
- `src/mocks/`: fixtures e MockDB no browser, endpoints MSW e simulações Socket.IO.
- `tests/e2e/`: fluxos E2E e regressão visual.
- `public/mock-assets/`: assets estáticos das fixtures.

Para detalhes dos limites entre módulos, APIs, eventos e políticas de cache, consulte [ARCHITECTURE.md](./ARCHITECTURE.md).

## Limitações da demonstração

- Persistência e backend são simulados no browser; limpar os dados locais reinicializa o estado demonstrativo.
- Conexão de carteira, pagamento, transações e links de explorador são estados simulados; não há interação com uma blockchain real.
- Login social é apenas demonstrativo.
- A identidade visual foi preservada e ha regressao visual versionada, mas nao foi atestada equivalencia pixel a pixel com o Figma. Os baselines verificam estabilidade da implementacao, nao certificam fidelidade ao prototipo.
- Estes resultados nao constituem garantia de nota: a performance mobile exigida pelo desafio ainda nao foi atingida.
