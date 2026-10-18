import { Slot } from '@radix-ui/react-slot'
import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast active:opacity-80',
  secondary: 'bg-surface-2 text-text active:opacity-80',
  ghost: 'text-text active:bg-surface-2',
  danger: 'bg-surface-2 text-danger active:opacity-80',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; asChild?: boolean }

export function Button({ variant = 'primary', asChild, className, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : type}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
