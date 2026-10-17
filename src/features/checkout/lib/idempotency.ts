const IDEMPOTENCY_STORAGE_PREFIX = 'kurio_order_idempotency_'

interface IdempotencyRecord {
  key: string
  signature: string
}

export function getIdempotencyStorageKey(sessionKey: string): string {
  return `${IDEMPOTENCY_STORAGE_PREFIX}${sessionKey}`
}

function isIdempotencyRecord(value: unknown): value is IdempotencyRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    'signature' in value &&
    typeof value.key === 'string' &&
    typeof value.signature === 'string'
  )
}

function readRecord(storageKey: string): IdempotencyRecord | null {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return null
  try {
    const record: unknown = JSON.parse(saved)
    return isIdempotencyRecord(record) ? record : null
  } catch {
    // Registro corrompido: é descartado e uma nova chave será gerada.
    return null
  }
}

/** Assinatura SHA-256 do conteúdo do pedido; a mesma tentativa gera sempre a mesma assinatura. */
export async function signOrderInput(input: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(input)),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/**
 * Reutiliza a chave de idempotência persistida enquanto o conteúdo do pedido não muda;
 * conteúdo diferente recebe uma chave nova (reutilizá-la geraria 409 IDEMPOTENCY_CONFLICT).
 */
export function getPersistedIdempotencyKey(
  storageKey: string,
  signature: string,
): string {
  const record = readRecord(storageKey)
  if (record && record.signature === signature) return record.key
  const key = crypto.randomUUID()
  localStorage.setItem(storageKey, JSON.stringify({ key, signature }))
  return key
}

/** Chave de uma tentativa de compra iniciada e ainda não concluída (ex.: timeout + recarga). */
export function getPendingIdempotencyKey(storageKey: string): string | null {
  return readRecord(storageKey)?.key ?? null
}

export function clearIdempotencyRecord(storageKey: string): void {
  localStorage.removeItem(storageKey)
}

export function clearAllIdempotencyRecords(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(IDEMPOTENCY_STORAGE_PREFIX)) localStorage.removeItem(key)
  }
}
