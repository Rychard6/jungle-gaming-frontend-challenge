import { createContext, useContext } from 'react'
import type {
  AuthResponseDto,
  AuthSessionDto,
  LoginRequestDto,
  RegisterRequestDto,
  WalletDto,
} from '../../../shared/api/types'

export interface AuthContextValue {
  session: AuthSessionDto | null
  wallets: WalletDto[]
  isLoading: boolean
  notice: string
  clearNotice: () => void
  login: (input: LoginRequestDto) => Promise<AuthResponseDto>
  register: (input: RegisterRequestDto) => Promise<AuthResponseDto>
  logout: () => Promise<void>
  switchUser: (user: 'nova' | 'kael' | 'guest') => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.')
  }
  return context
}
