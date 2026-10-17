const REDIRECT_BASE_URL = 'https://kurio.invalid'

/**
 * Aceita apenas caminhos internos. Barra invertida, `//host` e URLs absolutas viram `null`
 * (open redirect); `/login` e `/register` também, para não prender o usuário em um laço.
 */
export function safeRedirectPath(value: string | undefined): string | null {
  if (!value || !value.startsWith('/') || value.includes('\\')) return null
  try {
    const parsed = new URL(value, REDIRECT_BASE_URL)
    if (parsed.origin !== REDIRECT_BASE_URL) return null
    if (parsed.pathname === '/login' || parsed.pathname === '/register') {
      return null
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return null
  }
}

/** Rotas de autenticação nunca são destino de retomada. */
export function isAuthRoutePath(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register'
}

/**
 * Converte o caminho atual em `redirect` para a tela de login. Caminhos de autenticação
 * retornam `undefined`, evitando `redirect=/login?redirect=...` aninhado durante a transição
 * (a página protegida pode continuar montada enquanto o chunk de `/login` carrega).
 */
export function redirectFromPath(path: string): string | undefined {
  const pathname = path.split(/[?#]/, 1)[0] ?? ''
  return isAuthRoutePath(pathname) ? undefined : path
}
