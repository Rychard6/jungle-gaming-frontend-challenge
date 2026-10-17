/**
 * Regras de validação compartilhadas entre a interface (feedback imediato) e a API simulada
 * (validação autoritativa). Mantê-las em um único módulo evita que as duas divirjam.
 */
import { compareEth, parseEthToWei } from './eth-math'
import type { CollectorCheckoutData, WalletInputDto } from '../api/types'

export type FieldErrors = Record<string, string>

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** Endereço 0x completo (40 hex) ou abreviado no formato `0xAAAA...BBBB` usado nas fixtures. */
export const WALLET_ADDRESS_PATTERN =
  /^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{4}\.\.\.[a-fA-F0-9]{4})$/
export const MIN_USERNAME_LENGTH = 3
export const MIN_PASSWORD_LENGTH = 8
export const ENS_DOMAINS = ['.eth', '.kurio', '.xyz'] as const

export function validateCollector(input: CollectorCheckoutData): FieldErrors {
  const errors = validateWallet({
    ...input,
    walletNickname: input.profileName,
    address: input.walletAddress,
    secondaryAddressOrEns: input.secondaryWalletOrEns,
    referralCode: input.referralCode ?? '',
  })
  if (input.username.trim().length < MIN_USERNAME_LENGTH) {
    errors.username = `O nome de usuário deve ter pelo menos ${MIN_USERNAME_LENGTH} caracteres.`
  }
  if (errors.address) {
    errors.walletAddress = errors.address
    delete errors.address
  }
  if (errors.secondaryAddressOrEns) {
    errors.secondaryWalletOrEns = errors.secondaryAddressOrEns
    delete errors.secondaryAddressOrEns
  }
  delete errors.walletNickname
  return errors
}

/** Campos do perfil do colecionador (a validação de avatar fica com quem o recebe/envia). */
export function validateProfile(input: {
  displayName: string
  username: string
  email: string
  ensName: string
  ensDomain: string
  walletNickname: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (input.displayName.trim().length < 2) {
    errors.displayName =
      'Informe um nome de exibição com pelo menos 2 caracteres.'
  }
  if (input.username.trim().length < MIN_USERNAME_LENGTH) {
    errors.username = `O nome de usuário deve ter pelo menos ${MIN_USERNAME_LENGTH} caracteres.`
  }
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Informe um e-mail válido.'
  }
  if (!input.ensName.trim()) errors.ensName = 'Informe seu nome ENS.'
  if (!ENS_DOMAINS.some((domain) => domain === input.ensDomain)) {
    errors.ensDomain = 'Selecione um domínio ENS válido.'
  }
  if (input.walletNickname.trim().length < 2) {
    errors.walletNickname = 'Informe um apelido de carteira.'
  }
  return errors
}

/** Cadastro/edição de carteira (a mesma regra vale no formulário e na API simulada). */
export function validateWallet(
  input: Omit<WalletInputDto, 'isPrimary' | 'sameAsPrimary' | 'network' | 'walletType'>,
): FieldErrors {
  const errors: FieldErrors = {}
  const requiredFields: ReadonlyArray<
    readonly [
      'displayName' | 'walletNickname' | 'profileName' | 'address' | 'referralCode' | 'ensName',
      string,
    ]
  > = [
    ['displayName', 'Informe um nome de exibição.'],
    ['walletNickname', 'Informe um apelido para a carteira.'],
    ['profileName', 'Informe o nome do perfil.'],
    ['address', 'Informe o endereço da carteira.'],
    ['referralCode', 'Informe o código de indicação.'],
    ['ensName', 'Informe seu nome ENS.'],
  ]
  for (const [field, message] of requiredFields) {
    if (!input[field].trim()) errors[field] = message
  }
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Informe um e-mail válido.'
  }
  if (!errors.address && !WALLET_ADDRESS_PATTERN.test(input.address.trim())) {
    errors.address = 'Informe um endereço 0x válido.'
  }
  if (!ENS_DOMAINS.some((domain) => domain === input.ensDomain)) {
    errors.ensDomain = 'Selecione um domínio ENS válido.'
  }
  const secondary = input.secondaryAddressOrEns?.trim()
  if (
    secondary &&
    !secondary.includes('.') &&
    !/^0x[a-fA-F0-9]{4,}$/.test(secondary)
  ) {
    errors.secondaryAddressOrEns = 'Informe um ENS ou endereço válido.'
  }
  return errors
}

export function validateLogin(input: {
  email: string
  password: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Informe um e-mail válido.'
  }
  if (!input.password) errors.password = 'Informe sua senha.'
  return errors
}

export function validateRegistration(input: {
  username: string
  email: string
  password: string
  confirmPassword: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (input.username.trim().length < MIN_USERNAME_LENGTH) {
    errors.username = `O nome de usuário deve ter pelo menos ${MIN_USERNAME_LENGTH} caracteres.`
  }
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Informe um e-mail válido.'
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'As senhas não coincidem.'
  }
  return errors
}

export function validatePasswordChange(input: {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}): FieldErrors {
  const errors: FieldErrors = {}
  if (!input.currentPassword) {
    errors.currentPassword = 'Informe a senha atual para alterá-la.'
  }
  if (input.newPassword.length < MIN_PASSWORD_LENGTH) {
    errors.newPassword = `A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`
  }
  if (input.newPassword !== input.confirmPassword) {
    errors.confirmPassword = 'As senhas não coincidem.'
  }
  return errors
}

/** Faixa de preço do catálogo: ambos opcionais, decimais em ETH e mínimo ≤ máximo. */
export function validatePriceRange(
  minPrice: string,
  maxPrice: string,
): FieldErrors {
  const errors: FieldErrors = {}
  const isValidEth = (value: string, field: 'minPrice' | 'maxPrice') => {
    if (!value.trim()) return false
    try {
      parseEthToWei(value)
      return true
    } catch {
      errors[field] = 'Informe um valor em ETH válido, como 0.25.'
      return false
    }
  }
  const minIsValid = isValidEth(minPrice, 'minPrice')
  const maxIsValid = isValidEth(maxPrice, 'maxPrice')
  if (minIsValid && maxIsValid && compareEth(minPrice, maxPrice) > 0) {
    errors.maxPrice = 'O preço máximo deve ser maior ou igual ao mínimo.'
  }
  return errors
}
