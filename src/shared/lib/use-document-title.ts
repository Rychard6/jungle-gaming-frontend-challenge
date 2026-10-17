import { useEffect } from 'react'

/** Define o título da aba para a rota atual (WCAG 2.4.2) e alimenta o anúncio de navegação. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
