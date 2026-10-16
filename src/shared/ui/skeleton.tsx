import type { HTMLAttributes } from 'react'
import { cn } from '../lib/cn'

function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={cn('skeleton-shimmer rounded-md bg-kurio-surface', className)}
    />
  )
}

export { Skeleton }
