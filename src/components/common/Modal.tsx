import type { ReactNode } from 'react'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

export function Modal({ title, onClose, children, footer, wide }: Props) {
  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-vsc-panel border border-vsc-border rounded-sm shadow-2xl shadow-black/60 flex flex-col max-h-[90vh] ${wide ? 'w-[800px]' : 'w-[480px]'}`}
      >
        {/* Amber accent bar */}
        <div className="h-[2px] bg-vsc-accent rounded-t-sm shrink-0" />

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-vsc-border shrink-0">
          <h2 className="text-xs font-semibold text-vsc-text uppercase tracking-widest">{title}</h2>
          <button
            onClick={onClose}
            className="text-vsc-dim hover:text-vsc-text transition-colors text-base leading-none w-5 h-5 flex items-center justify-center"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-vsc-border shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
