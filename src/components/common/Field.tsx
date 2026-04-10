import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'

interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
}

export function Field({ label, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-medium text-vsc-muted uppercase tracking-[0.12em]">
        {label}
      </label>
      {children}
      {hint && <p className="text-[10px] text-vsc-dim leading-relaxed">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full bg-vsc-bg border border-vsc-border rounded-sm px-3 py-1.5 text-xs text-vsc-text placeholder-vsc-dim focus:border-vsc-accent focus:shadow-[0_0_0_1px_rgba(200,152,32,0.15)] outline-none transition-all'

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
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div
        className={`w-8 h-[18px] rounded-sm transition-all relative ${checked ? 'bg-vsc-accent' : 'bg-vsc-active border border-vsc-border'}`}
        onClick={() => onChange(!checked)}
      >
        <div
          className={`w-3 h-3 bg-[#0c0f0c] rounded-sm absolute top-[3px] transition-transform ${checked ? 'translate-x-[17px]' : 'translate-x-[3px]'}`}
        />
      </div>
      <span className="text-xs text-vsc-text">{label}</span>
    </label>
  )
}
