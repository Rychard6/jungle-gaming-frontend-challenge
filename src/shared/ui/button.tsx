import type { ButtonHTMLAttributes } from 'react'
import {
  buttonVariants,
  type ButtonSize,
  type ButtonVariant,
} from './button-variants'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/**
 * Botão no padrão shadcn/ui (`data-slot`, `variant`, `size`), adaptado ao tema KURIO.
 * `type="button"` por padrão evita envios acidentais de formulários.
 */
export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      data-slot="button"
      type={type}
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}
