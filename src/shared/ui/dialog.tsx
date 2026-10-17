import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react'
import { cn } from '../lib/cn'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.tabIndex >= 0 && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
  )
}

interface DialogProps {
  open: boolean
  onClose: () => void
  /** `id` do título; vira o nome acessível do diálogo. */
  labelledBy: string
  /** Quem recebe o foco ao abrir; padrão: o primeiro elemento focável. */
  initialFocusSelector?: string
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Quem recebe o foco ao fechar; padrão: o elemento que o tinha ao abrir. */
  restoreFocusRef?: RefObject<HTMLElement | null>
  closeOnBackdropClick?: boolean
  className?: string
  overlayClassName?: string
  children: ReactNode
}

/**
 * Diálogo modal acessível no padrão shadcn/ui (`Dialog`): `role="dialog"` + `aria-modal`,
 * foco inicial, foco preso (Tab/Shift+Tab), Escape, bloqueio de rolagem e devolução do foco.
 * Implementado sem Radix para manter o lockfile entregue; o contrato é o mesmo.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  initialFocusSelector,
  initialFocusRef,
  restoreFocusRef,
  closeOnBackdropClick = true,
  className,
  overlayClassName,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    if (!panel) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const returnTarget = restoreFocusRef?.current ?? previouslyFocused
    const initialTarget =
      initialFocusRef?.current ??
      (initialFocusSelector
        ? panel.querySelector<HTMLElement>(initialFocusSelector)
        : null) ??
      getFocusableElements(panel)[0] ??
      panel
    initialTarget.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const backgroundElements: Array<{ element: HTMLElement; inert: boolean }> = []
    let branch = panel.parentElement
    while (branch?.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling instanceof HTMLElement && sibling !== branch) {
          backgroundElements.push({ element: sibling, inert: sibling.inert })
          sibling.inert = true
        }
      }
      branch = branch.parentElement
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = getFocusableElements(panel)
      if (focusable.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const outside = !(active instanceof Node) || !panel.contains(active)
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      for (const { element, inert } of backgroundElements) element.inert = inert
      if (returnTarget?.isConnected) returnTarget.focus()
    }
  }, [open, initialFocusRef, initialFocusSelector, restoreFocusRef])

  if (!open) return null

  return (
    <div
      data-slot="dialog-overlay"
      className={cn('fixed inset-0 z-[60] bg-black/70', overlayClassName)}
      onMouseDown={(event) => {
        if (closeOnBackdropClick && event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        data-slot="dialog-content"
        className={cn('focus:outline-none', className)}
      >
        {children}
      </div>
    </div>
  )
}
