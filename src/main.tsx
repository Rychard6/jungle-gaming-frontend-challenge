import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { queryClient } from './app/query-client'
import { initializeSocketClient } from './shared/socket/socket-client'

async function startApplication(): Promise<void> {
  const { worker } = await import('./mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
  await initializeSocketClient(queryClient)

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
}

void startApplication().catch((error: unknown) => {
  console.error('Falha ao inicializar a aplicação KURIO.', error)
  const rootElement = document.getElementById('root')
  if (rootElement) {
    rootElement.textContent =
      'Não foi possível iniciar a aplicação. Consulte o console para detalhes.'
  }
})
