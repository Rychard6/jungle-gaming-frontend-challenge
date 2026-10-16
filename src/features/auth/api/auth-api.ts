import { httpClient } from '../../../shared/api/http'
import type {
  AuthResponseDto,
  AuthSessionResponseDto,
  LoginRequestDto,
  RegisterRequestDto,
} from '../../../shared/api/types'

export async function fetchAuthSession(
  signal?: AbortSignal,
): Promise<AuthSessionResponseDto> {
  const response = await httpClient.get<AuthSessionResponseDto>(
    '/auth/session',
    { signal },
  )
  return response.data
}

export async function login(
  input: LoginRequestDto,
): Promise<AuthResponseDto> {
  const response = await httpClient.post<AuthResponseDto>(
    '/auth/login',
    input,
  )
  return response.data
}

export async function register(
  input: RegisterRequestDto,
): Promise<AuthResponseDto> {
  const response = await httpClient.post<AuthResponseDto>(
    '/auth/register',
    input,
  )
  return response.data
}

export async function logout(): Promise<void> {
  await httpClient.post('/auth/logout')
}
