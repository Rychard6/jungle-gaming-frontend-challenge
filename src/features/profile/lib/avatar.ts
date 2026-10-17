export const AVATAR_MAX_SOURCE_BYTES = 5 * 1024 * 1024
export const AVATAR_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

const AVATAR_SIZE_PX = 256
const AVATAR_BACKGROUND = '#22160F'

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_ACCEPTED_TYPES.some((type) => type === file.type)) {
    return 'Envie uma imagem PNG, JPEG ou WebP.'
  }
  if (file.size > AVATAR_MAX_SOURCE_BYTES) {
    return 'A imagem deve ter no máximo 5 MB.'
  }
  return null
}

/**
 * Recorta a imagem em quadrado e reduz para 256×256 (JPEG), o que mantém o avatar leve o
 * suficiente para o armazenamento local do MockDB e para o contrato da API (≤ 300 mil caracteres).
 */
export async function resizeAvatarToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE_PX
    canvas.height = AVATAR_SIZE_PX
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Não foi possível processar a imagem neste navegador.')
    context.fillStyle = AVATAR_BACKGROUND
    context.fillRect(0, 0, AVATAR_SIZE_PX, AVATAR_SIZE_PX)
    const side = Math.min(bitmap.width, bitmap.height)
    context.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      AVATAR_SIZE_PX,
      AVATAR_SIZE_PX,
    )
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally {
    bitmap.close()
  }
}
