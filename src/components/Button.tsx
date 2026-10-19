import { Slot } from '@radix-ui/react-slot'
import { clsx } from 'clsx'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-contrast shadow-[0_6px_24px_-8px_rgb(47_123_255/0.7)] active:brightness-90',
  secondary: 'bg-surface-2 text-text border border-border-strong active:bg-surface-3',
  // Low-emphasis actions are often sentence-long ("No password yet? …"): body type, no caps.
  ghost:
    'font-sans! normal-case! tracking-normal! text-base! font-semibold! text-muted active:bg-surface-2 active:text-text',
  danger: 'bg-danger-soft text-danger active:brightness-125',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; asChild?: boolean }

export function Button({ variant = 'primary', asChild, className, type = 'button', ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      type={asChild ? undefined : type}
      className={clsx(
        'font-display inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[1.0625rem] font-bold tracking-wide uppercase transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
