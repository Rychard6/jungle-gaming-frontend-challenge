import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import type {
  AuthResponseDto,
  AuthSessionResponseDto,
  LoginRequestDto,
  RegisterRequestDto,
} from '../../../shared/api/types'
import { AuthContext, type AuthContextValue } from './auth-context'
import {
  getAuthUserId,
  getSessionCacheKey,
  resetGuestSessionId,
  setAuthSession,
  setOnUnauthorizedCallback,
  subscribeForeignSessionChange,
} from '../../../shared/api/http'
import { resetSocketSession } from '../../../shared/socket/socket-client'
import {
  fetchAuthSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../api/auth-api'
import { redirectFromPath } from '../lib/safe-redirect'

const AUTH_QUERY_KEY = ['auth', 'session'] as const

// Raízes de query cujo conteúdo pertence a uma sessão. Todas carregam a session key em algum
// ponto da chave (`['order', id, sessionKey]`, `['checkout', 'quote', sessionKey]`, ...).
const PRIVATE_QUERY_ROOTS: ReadonlySet<unknown> = new Set([
  'cart',
  'favorites',
  'profile',
  'wallets',
  'orders',
  'order',
  'checkout',
])

function removePrivateQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionKey: string | null,
): void {
  if (!sessionKey) return
  queryClient.removeQueries({
    predicate: (query) =>
      PRIVATE_QUERY_ROOTS.has(query.queryKey[0]) &&
      query.queryKey.includes(sessionKey),
  })
}

function storeAuthenticatedSession(
  queryClient: ReturnType<typeof useQueryClient>,
  response: AuthResponseDto,
): void {
  const previousSessionKey = getSessionCacheKey()
  void queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEY })
  setAuthSession(response.session.token, response.session.user.id)
  removePrivateQueries(queryClient, previousSessionKey)
  queryClient.setQueryData(AUTH_QUERY_KEY, {
    session: response.session,
    wallets: response.wallets,
  })
  resetSocketSession(response.session.user.id)
  void queryClient.invalidateQueries({ queryKey: ['cart'] })
  void queryClient.invalidateQueries({ queryKey: ['favorites'] })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const currentPath = useRouterState({
    select: (state) => `${state.location.pathname}${state.location.searchStr}`,
  })
  const [notice, setNotice] = useState('')
  const [isReconciling, setIsReconciling] = useState(false)
  const expirationHandled = useRef(false)

  const sessionQuery = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: ({ signal }) => fetchAuthSession(signal),
    staleTime: 30_000,
    retry: false,
  })

  const loginMutation = useMutation({
    mutationFn: loginRequest,
    onSuccess: (response) => {
      expirationHandled.current = false
      setNotice('')
      storeAuthenticatedSession(queryClient, response)
    },
  })

  const registerMutation = useMutation({
    mutationFn: registerRequest,
    onSuccess: (response) => {
      expirationHandled.current = false
      setNotice('')
      storeAuthenticatedSession(queryClient, response)
    },
  })

  const clearLocalSession = useCallback(() => {
    const previousSessionKey = getSessionCacheKey()
    void queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEY })
    setAuthSession(null, null)
    resetGuestSessionId()
    removePrivateQueries(queryClient, previousSessionKey)
    queryClient.setQueryData(AUTH_QUERY_KEY, { session: null, wallets: [] })
    resetSocketSession(null)
  }, [queryClient])

  useEffect(() => {
    setOnUnauthorizedCallback(() => {
      if (expirationHandled.current) return
      expirationHandled.current = true
      clearLocalSession()
      setNotice('Sua sessão expirou. Faça login novamente para continuar.')
      void navigate({
        to: '/login',
        search: { redirect: redirectFromPath(currentPath), expired: true },
        replace: true,
      })
    })
    return () => setOnUnauthorizedCallback(undefined)
  }, [clearLocalSession, currentPath, navigate])

  useEffect(() => {
    const session = sessionQuery.data?.session
    if (session) resetSocketSession(session.user.id)
  }, [sessionQuery.data?.session])

  // Logout/troca de usuário em outra aba: descarta os dados privados exibidos nesta aba.
  useEffect(
    () =>
      subscribeForeignSessionChange(() => {
        const storedUserId = getAuthUserId()
        const knownUserId =
          queryClient.getQueryData<AuthSessionResponseDto>(AUTH_QUERY_KEY)?.session
            ?.user.id ?? null
        if (storedUserId === knownUserId) return
        setIsReconciling(true)
        void queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEY })
        queryClient.removeQueries({
          predicate: (query) => PRIVATE_QUERY_ROOTS.has(query.queryKey[0]),
        })
        queryClient.setQueryData(AUTH_QUERY_KEY, { session: null, wallets: [] })
        resetSocketSession(storedUserId)
        void queryClient.fetchQuery({
          queryKey: AUTH_QUERY_KEY,
          queryFn: ({ signal }) => fetchAuthSession(signal),
          staleTime: 0,
        }).catch(() => undefined).finally(() => setIsReconciling(false))
      }),
    [queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      clearLocalSession()
    }
  }, [clearLocalSession])

  const { mutateAsync: loginAsync } = loginMutation
  const { mutateAsync: registerAsync } = registerMutation
  const login = useCallback(
    (input: LoginRequestDto) => loginAsync(input),
    [loginAsync],
  )
  const register = useCallback(
    (input: RegisterRequestDto) => registerAsync(input),
    [registerAsync],
  )
  const switchUser = useCallback(
    async (user: 'nova' | 'kael' | 'guest') => {
      if (user === 'guest') {
        await logout()
        setNotice('Sessão de visitante iniciada.')
        return
      }
      // Login direto: substitui a sessão sem passar por um estado "deslogado". Um logout
      // antes faria a página protegida redirecionar para /login e deixaria a troca inacabada.
      // `storeAuthenticatedSession` já remove os dados privados da sessão anterior.
      await login({
        email:
          user === 'nova' ? 'contato@email.com' : 'colecionador@kurio.io',
        password: 'Kurio@2026',
      })
      setNotice(
        `Sessão de demonstração: ${user === 'nova' ? 'Nova Sato' : 'Kael Vance'}.`,
      )
    },
    [login, logout],
  )

  const clearNotice = useCallback(() => setNotice(''), [])
  const showNotice = useCallback((message: string) => setNotice(message), [])
  const value = useMemo<AuthContextValue>(
    () => ({
      session: sessionQuery.data?.session ?? null,
      wallets: sessionQuery.data?.wallets ?? [],
      isLoading: sessionQuery.isLoading || isReconciling,
      notice,
      clearNotice,
      showNotice,
      login,
      register,
      logout,
      switchUser,
      resetLocalSession: clearLocalSession,
    }),
    [
      sessionQuery.data?.session,
      sessionQuery.data?.wallets,
      sessionQuery.isLoading,
      isReconciling,
      notice,
      clearNotice,
      showNotice,
      login,
      register,
      logout,
      switchUser,
      clearLocalSession,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
