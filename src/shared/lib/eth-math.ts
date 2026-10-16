export const WEI_PER_ETH = 10n ** 18n

const MAX_DECIMALS = 18

function parseDecimalToWei(value: string): bigint {
  const normalizedValue = value.trim().replace(',', '.')

  if (!/^\d+(?:\.\d{1,18})?$/.test(normalizedValue)) {
    throw new TypeError(
      'Valor ETH inválido: informe um decimal não-negativo com até 18 casas.',
    )
  }

  const [wholePart, fractionalPart = ''] = normalizedValue.split('.')
  return (
    BigInt(wholePart) * WEI_PER_ETH +
    BigInt(fractionalPart.padEnd(MAX_DECIMALS, '0') || '0')
  )
}

function formatExactWei(wei: bigint): string {
  const isNegative = wei < 0n
  const absoluteWei = isNegative ? -wei : wei
  const wholePart = absoluteWei / WEI_PER_ETH
  const fractionalPart = (absoluteWei % WEI_PER_ETH)
    .toString()
    .padStart(MAX_DECIMALS, '0')
    .replace(/0+$/, '')
  const minimumFraction = fractionalPart.padEnd(2, '0')
  const result = fractionalPart.length > 0 ? minimumFraction : '00'

  return `${isNegative ? '-' : ''}${wholePart}.${result}`
}

export function parseEthToWei(ethDecimal: string): bigint {
  return parseDecimalToWei(ethDecimal)
}

export function formatWeiToEth(
  wei: bigint,
  options: { minDecimals?: number; maxDecimals?: number } = {},
): string {
  const minDecimals = options.minDecimals ?? 2
  const maxDecimals = options.maxDecimals ?? 4

  if (
    !Number.isInteger(minDecimals) ||
    !Number.isInteger(maxDecimals) ||
    minDecimals < 0 ||
    maxDecimals < minDecimals ||
    maxDecimals > MAX_DECIMALS
  ) {
    throw new RangeError(
      `Casas decimais devem satisfazer 0 <= minDecimals <= maxDecimals <= ${MAX_DECIMALS}.`,
    )
  }

  const isNegative = wei < 0n
  const absoluteWei = isNegative ? -wei : wei
  const wholePart = absoluteWei / WEI_PER_ETH
  const fractionalWei = absoluteWei % WEI_PER_ETH
  const fullFraction = fractionalWei
    .toString()
    .padStart(MAX_DECIMALS, '0')
  const discardedDigits = fullFraction.slice(maxDecimals)
  let roundedFraction = BigInt(fullFraction.slice(0, maxDecimals) || '0')

  if (discardedDigits.length > 0 && discardedDigits[0] >= '5') {
    roundedFraction += 1n
  }

  const decimalScale = 10n ** BigInt(maxDecimals)
  const roundedWholePart = wholePart + roundedFraction / decimalScale
  roundedFraction %= decimalScale

  const formattedFraction = roundedFraction
    .toString()
    .padStart(maxDecimals, '0')
    .replace(/0+$/, '')
    .padEnd(minDecimals, '0')
  const sign = isNegative && (roundedWholePart > 0n || roundedFraction > 0n)
    ? '-'
    : ''

  return formattedFraction.length > 0
    ? `${sign}${roundedWholePart}.${formattedFraction}`
    : `${sign}${roundedWholePart}`
}

export function formatEthDisplay(ethDecimal: string): string {
  return `${formatWeiToEth(parseEthToWei(ethDecimal))} ETH`
}

export function addEth(a: string, b: string): string {
  return formatExactWei(parseEthToWei(a) + parseEthToWei(b))
}

export function subtractEth(a: string, b: string): string {
  const difference = parseEthToWei(a) - parseEthToWei(b)
  return formatExactWei(difference > 0n ? difference : 0n)
}

export function multiplyEthByQuantity(
  unitPriceEth: string,
  quantity: number,
): string {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new RangeError('A quantidade deve ser um inteiro não-negativo seguro.')
  }

  return formatExactWei(parseEthToWei(unitPriceEth) * BigInt(quantity))
}

export function calculatePercentageDiscountEth(
  subtotalEth: string,
  discountPercent: number,
): string {
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw new RangeError('O percentual de desconto deve estar entre 0 e 100.')
  }

  const percentAsString = String(discountPercent)
  if (!/^\d+(?:\.\d{1,2})?$/.test(percentAsString)) {
    throw new RangeError('O percentual deve ter no máximo duas casas decimais.')
  }

  const [wholePercent, fractionalPercent = ''] = percentAsString.split('.')
  const basisPoints =
    BigInt(wholePercent) * 100n +
    BigInt(fractionalPercent.padEnd(2, '0') || '0')
  const discountProduct = parseEthToWei(subtotalEth) * basisPoints
  const roundedDiscount = (discountProduct + 5_000n) / 10_000n

  return formatExactWei(roundedDiscount)
}

export function sumEthValues(values: string[]): string {
  const total = values.reduce(
    (sum, value) => sum + parseEthToWei(value),
    0n,
  )
  return formatExactWei(total)
}

export function compareEth(a: string, b: string): -1 | 0 | 1 {
  const weiA = parseEthToWei(a)
  const weiB = parseEthToWei(b)
  if (weiA < weiB) return -1
  if (weiA > weiB) return 1
  return 0
}
