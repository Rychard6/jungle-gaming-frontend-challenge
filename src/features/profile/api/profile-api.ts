import { httpClient } from '../../../shared/api/http'
import type {
  UpdatePasswordRequestDto,
  UpdateProfileRequestDto,
  UserProfileDto,
} from '../../../shared/api/types'

export async function fetchProfile(
  signal?: AbortSignal,
): Promise<UserProfileDto> {
  const response = await httpClient.get<UserProfileDto>('/profile', { signal })
  return response.data
}

export async function updateProfile(
  input: UpdateProfileRequestDto,
): Promise<UserProfileDto> {
  const response = await httpClient.patch<UserProfileDto>('/profile', input)
  return response.data
}

export async function updatePassword(
  input: UpdatePasswordRequestDto,
): Promise<void> {
  await httpClient.post('/profile/password', input)
}
