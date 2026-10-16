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
  LoginRequestDto,
  RegisterRequestDto,
} from '../../../shared/api/types'
import { AuthContext, type AuthContextValue } from './auth-context'
import {
  getSessionCacheKey,
  resetGuestSessionId,
  setAuthSession,
  setOnUnauthorizedCallback,
} from '../../../shared/api/http'
import { resetSocketSession } from '../../../shared/socket/socket-client'
import {
  fetchAuthSession,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../api/auth-api'

const AUTH_QUERY_KEY = ['auth', 'session'] as const

function removePrivateQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  sessionKey: string | null,
): void {
  if (!sessionKey) return
  queryClient.removeQueries({
    predicate: (query) =>
      (query.queryKey[0] === 'cart' ||
        query.queryKey[0] === 'favorites' ||
        query.queryKey[0] === 'profile' ||
        query.queryKey[0] === 'wallets' ||
        query.queryKey[0] === 'orders') &&
      query.queryKey[1] === sessionKey,
  })
}

function storeAuthenticatedSession(
  queryClient: ReturnType<typeof useQueryClient>,
  response: AuthResponseDto,
): void {
  const previousSessionKey = getSessionCacheKey()
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
        search: { redirect: currentPath, expired: true },
      })
    })
    return () => setOnUnauthorizedCallback(undefined)
  }, [clearLocalSession, currentPath, navigate])

  useEffect(() => {
    const session = sessionQuery.data?.session
    if (session) resetSocketSession(session.user.id)
  }, [sessionQuery.data?.session])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      clearLocalSession()
    }
  }, [clearLocalSession])

  const login = useCallback(
    (input: LoginRequestDto) => loginMutation.mutateAsync(input),
    [loginMutation],
  )
  const register = useCallback(
    (input: RegisterRequestDto) => registerMutation.mutateAsync(input),
    [registerMutation],
  )
  const switchUser = useCallback(
    async (user: 'nova' | 'kael' | 'guest') => {
      if (user === 'guest') {
        await logout()
        setNotice('Sessão de visitante iniciada.')
        return
      }
      await logout()
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
  const value = useMemo<AuthContextValue>(
    () => ({
      session: sessionQuery.data?.session ?? null,
      wallets: sessionQuery.data?.wallets ?? [],
      isLoading: sessionQuery.isLoading,
      notice,
      clearNotice,
      login,
      register,
      logout,
      switchUser,
    }),
    [
      sessionQuery.data?.session,
      sessionQuery.data?.wallets,
      sessionQuery.isLoading,
      notice,
      clearNotice,
      login,
      register,
      logout,
      switchUser,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
