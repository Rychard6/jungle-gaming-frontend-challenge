import { useEffect, useState } from 'react'

/**
 * Campo de busca ligado à URL.
 *
 * - Digitar atualiza a URL com debounce e o chamador usa `replace`, de modo que uma busca
 *   ocupa um único passo do histórico (Voltar não percorre letra por letra).
 * - Qualquer mudança vinda da URL (Voltar/Avançar, limpar filtros) reescreve o campo.
 */
export function useUrlSearchField(
  urlValue: string,
  commit: (value: string) => void,
  delayMs = 300,
) {
  const [draft, setDraft] = useState(urlValue)
  const [syncedUrlValue, setSyncedUrlValue] = useState(urlValue)

  // "Ajuste de estado durante a renderização": mantém o campo alinhado com a URL.
  if (urlValue !== syncedUrlValue) {
    setSyncedUrlValue(urlValue)
    setDraft(urlValue)
  }

  useEffect(() => {
    if (draft === syncedUrlValue) return
    const timer = window.setTimeout(() => commit(draft), delayMs)
    return () => window.clearTimeout(timer)
  }, [commit, delayMs, draft, syncedUrlValue])

  return { value: draft, onChange: setDraft, submit: () => commit(draft.trim()) }
}
