import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const badgeVariantClasses = {
  default: 'bg-kurio-amber text-kurio-bg',
  outline: 'border border-kurio-border text-kurio-text-muted',
  destructive: 'border border-kurio-danger/60 bg-kurio-danger/10 text-kurio-danger',
} as const

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof badgeVariantClasses
}

/** O significado do estado vem sempre do texto, nunca só da cor. */
export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold tracking-wider',
        badgeVariantClasses[variant],
        className,
      )}
      {...props}
    />
  )
}
