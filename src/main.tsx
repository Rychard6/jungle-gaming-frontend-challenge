import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { MOCKS_ENABLED } from './app/config'
import { queryClient } from './app/query-client'
import {
  disposeSocketClient,
  initializeSocketClient,
} from './shared/socket/socket-client'

// Libera o socket ao sair da página; páginas restauradas do bfcache (`persisted`) continuam ativas.
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) disposeSocketClient()
})
import.meta.hot?.dispose(disposeSocketClient)

async function startMocks(): Promise<void> {
  const { worker } = await import('./mocks/browser')
  await worker.start({
    quiet: import.meta.env.PROD,
    onUnhandledRequest: 'bypass',
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}

async function startApplication(): Promise<void> {
  if (MOCKS_ENABLED) await startMocks()

  const rootElement = document.getElementById('root')
  if (!rootElement) {
    throw new Error('Elemento raiz da aplicação (#root) não encontrado.')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StrictMode>,
  )
  // Sinaliza que a camada de rede (MSW) já responde; testes e auditorias aguardam este marcador.
  document.documentElement.dataset.kurioMocks = MOCKS_ENABLED ? 'ready' : 'disabled'
  void initializeSocketClient(queryClient).catch((error: unknown) => {
    console.error('Falha ao conectar o Socket.IO.', error)
  })
}

void startApplication().catch((error: unknown) => {
  console.error('Falha ao inicializar a aplicação KURIO.', error)
  const rootElement = document.getElementById('root')
  if (rootElement) {
    rootElement.textContent =
      'Não foi possível iniciar a aplicação. Consulte o console para detalhes.'
  }
})
