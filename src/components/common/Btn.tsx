import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
}

const variants = {
  primary:
    'bg-vsc-accent hover:bg-vsc-accent-hover text-white border-transparent font-semibold shadow-sm shadow-vsc-accent/20',
  secondary:
    'bg-transparent hover:bg-vsc-hover text-vsc-text border-vsc-border hover:border-vsc-accent/40',
  ghost:
    'bg-transparent hover:bg-vsc-hover text-vsc-muted hover:text-vsc-text border-transparent',
  danger:
    'bg-transparent hover:bg-vsc-danger-light text-vsc-danger border-vsc-danger/30 hover:border-vsc-danger/50',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
}

export function Btn({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      className={`inline-flex items-center border rounded-md font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-vsc-accent/50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
