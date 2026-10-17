import type { InputHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

/** Campo de texto no padrão shadcn/ui, com o foco visível e o contraste do tema KURIO. */
export function Input({
  className,
  type = 'text',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        'h-11 w-full rounded-lg border border-kurio-border bg-kurio-bg px-3 text-sm text-kurio-text placeholder:text-kurio-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber aria-invalid:border-kurio-danger',
        className,
      )}
      {...props}
    />
  )
}
