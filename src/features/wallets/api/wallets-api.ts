import { httpClient } from '../../../shared/api/http'
import type { WalletDto, WalletInputDto } from '../../../shared/api/types'

export interface WalletsResponse {
  wallets: WalletDto[]
}

export async function fetchWallets(
  signal?: AbortSignal,
): Promise<WalletsResponse> {
  const response = await httpClient.get<WalletsResponse>('/wallets', { signal })
  return response.data
}

export async function createWallet(
  input: WalletInputDto,
): Promise<WalletsResponse> {
  const response = await httpClient.post<WalletsResponse>('/wallets', input)
  return response.data
}

export async function updateWallet(
  walletId: string,
  input: WalletInputDto,
): Promise<WalletsResponse> {
  const response = await httpClient.patch<WalletsResponse>(
    `/wallets/${encodeURIComponent(walletId)}`,
    input,
  )
  return response.data
}

export async function deleteWallet(walletId: string): Promise<WalletsResponse> {
  const response = await httpClient.delete<WalletsResponse>(
    `/wallets/${encodeURIComponent(walletId)}`,
  )
  return response.data
}
