import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  children: ReactNode
}

const variants = {
  primary:
    'bg-vsc-accent hover:bg-vsc-accent-hover text-[#0c0f0c] border-transparent font-semibold',
  secondary:
    'bg-transparent hover:bg-vsc-hover text-vsc-text border-vsc-border hover:border-vsc-accent/50',
  ghost:
    'bg-transparent hover:bg-vsc-hover text-vsc-muted hover:text-vsc-accent border-transparent',
  danger:
    'bg-transparent hover:bg-vsc-danger-light text-vsc-danger border-vsc-danger/30 hover:border-vsc-danger/60',
}

const sizes = {
  sm: 'px-2.5 py-1 text-[10px] tracking-wider',
  md: 'px-3 py-1.5 text-[10px] tracking-wider',
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
      className={`inline-flex items-center gap-1.5 border rounded-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed uppercase ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
