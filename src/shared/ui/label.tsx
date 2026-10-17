import type { LabelHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      data-slot="label"
      className={cn('text-xs font-medium text-kurio-text', className)}
      {...props}
    />
  )
}
