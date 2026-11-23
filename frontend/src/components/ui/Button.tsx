import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold tracking-[-0.01em] transition-all duration-300 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-forest text-white shadow-[0_14px_28px_-14px_rgba(52,75,53,0.85)] hover:bg-[#2b402c] hover:shadow-[0_18px_34px_-14px_rgba(52,75,53,0.85)]',
  secondary: 'bg-soft-sage text-forest hover:bg-sage/45 hover:text-[#263b27]',
  outline: 'border border-line bg-white/70 text-ink hover:border-sage hover:bg-white',
  ghost: 'text-forest hover:bg-soft-sage/70',
  danger: 'bg-alert text-white shadow-[0_12px_26px_-14px_rgba(232,65,44,0.9)] hover:bg-[#cf3523]',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 py-2 text-xs',
  md: 'min-h-11 px-5 py-2.5 text-sm',
  lg: 'min-h-13 px-7 py-3 text-sm sm:text-base',
}

export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  return (
    <button className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </button>
  )
}
