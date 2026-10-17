/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `false` desativa o MSW/Socket.IO simulado (a API real deve responder em `/api`). Padrão: ativo. */
  readonly VITE_ENABLE_MOCKS?: 'true' | 'false'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
