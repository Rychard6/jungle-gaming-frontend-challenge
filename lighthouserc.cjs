/**
 * Lighthouse CI — mede a build de produção servida por `vite preview`.
 *
 *   npm run build
 *   npm run lighthouse
 *
 * O relatório HTML/JSON fica em ./reports/lighthouse/mobile (e ./reports/lighthouse/desktop no preset desktop). O `@lhci/cli` é executado via `npx`
 * (versão fixada no script) para não alterar o lockfile entregue.
 *
 * Observação sobre a medição: sem credenciais, as rotas protegidas redirecionam ao login, então
 * ficam de fora; medimos catálogo e detalhe do NFT conforme os critérios do desafio.
 */
const origin = 'http://127.0.0.1:4174'

const assertions = {
  'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
  'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
  'categories:best-practices': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
  'categories:seo': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
}

module.exports = {
  ci: {
    collect: {
      startServerCommand:
        'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 60000,
      url: [
        `${origin}/`,
        `${origin}/nfts/nft-1`,
      ],
      // A mediana de 3 execuções reduz a variância; o preset móvel é o padrão do Lighthouse.
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: { assertions },
    upload: {
      target: 'filesystem',
      outputDir: './reports/lighthouse/mobile',
    },
  },
}
