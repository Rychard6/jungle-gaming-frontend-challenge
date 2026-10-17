import { cn } from '../lib/cn'

/**
 * Variações do botão no padrão shadcn/ui (`buttonVariants`), adaptadas ao tema KURIO. Ficam em
 * arquivo próprio para que `button.tsx` exporte só componentes (Fast Refresh) e porque
 * `class-variance-authority` não faz parte do lockfile entregue: o mapa de classes é simples.
 */
const buttonVariantClasses = {
  default: 'bg-kurio-amber text-kurio-bg hover:bg-kurio-amber-hover',
  outline: 'border border-kurio-amber text-kurio-amber hover:bg-kurio-amber/10',
  secondary:
    'border border-kurio-border text-kurio-text hover:border-kurio-amber',
  ghost: 'text-kurio-text-muted hover:text-kurio-text',
  destructive:
    'border border-kurio-danger/50 text-kurio-danger hover:bg-kurio-danger/10',
} as const

const buttonSizeClasses = {
  default: 'min-h-10 px-4 py-2.5 text-xs',
  sm: 'min-h-9 px-3 py-2 text-[10px]',
  lg: 'min-h-12 px-5 py-3 text-sm',
  icon: 'size-10 p-0',
} as const

export type ButtonVariant = keyof typeof buttonVariantClasses
export type ButtonSize = keyof typeof buttonSizeClasses

export function buttonVariants({
  variant = 'default',
  size = 'default',
  className,
}: {
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  className?: string | undefined
} = {}): string {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kurio-amber disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
    buttonVariantClasses[variant],
    buttonSizeClasses[size],
    className,
  )
}
