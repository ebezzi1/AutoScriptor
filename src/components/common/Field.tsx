import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
}

export function Field({ label, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-vsc-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-vsc-dim leading-relaxed">{hint}</p>}
    </div>
  )
}

export const inputCls =
  'w-full bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm text-vsc-text placeholder-vsc-dim focus:border-vsc-accent focus:ring-2 focus:ring-vsc-accent/12 outline-none transition-colors'

type InputProps = InputHTMLAttributes<HTMLInputElement>
export function Input({ className = '', ...props }: InputProps) {
  return <input className={`${inputCls} ${className}`} {...props} />
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>
export function Select({ className = '', children, ...props }: SelectProps & { children: ReactNode }) {
  return (
    <select className={`${inputCls} cursor-pointer ${className}`} {...props}>
      {children}
    </select>
  )
}

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${
          checked
            ? 'bg-vsc-accent'
            : 'bg-vsc-hover border border-vsc-border'
        }`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all duration-200 shadow-sm ${
            checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
          }`}
        />
      </div>
      <span className="text-sm text-vsc-text">{label}</span>
    </label>
  )
}
