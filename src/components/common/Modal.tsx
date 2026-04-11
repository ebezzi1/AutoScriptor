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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`bg-vsc-panel border border-vsc-border rounded-xl shadow-2xl shadow-black/70 flex flex-col max-h-[90vh] animate-slide-down ${wide ? 'w-[820px]' : 'w-[480px]'}`}
      >
        {/* Accent bar */}
        <div className="h-[2px] bg-vsc-accent rounded-t-xl shrink-0" />

        <div className="flex items-center justify-between px-6 py-4 border-b border-vsc-border shrink-0">
          <h2 className="text-sm font-semibold text-vsc-text tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-all text-base leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-vsc-border shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
