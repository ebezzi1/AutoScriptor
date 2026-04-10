import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  toast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const config: Record<Toast['type'], { prefix: string; cls: string }> = {
    success: {
      prefix: 'OK',
      cls: 'border-l-vsc-success text-vsc-success bg-vsc-panel border border-vsc-border border-l-2',
    },
    error: {
      prefix: 'ERR',
      cls: 'border-l-vsc-danger text-vsc-danger bg-vsc-panel border border-vsc-border border-l-2',
    },
    info: {
      prefix: 'INF',
      cls: 'border-l-vsc-accent text-vsc-accent bg-vsc-panel border border-vsc-border border-l-2',
    },
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col gap-1.5 z-50">
        {toasts.map((t) => {
          const { prefix, cls } = config[t.type]
          return (
            <div
              key={t.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-sm shadow-xl shadow-black/40 animate-toast-in ${cls}`}
            >
              <span className="text-[9px] font-semibold tracking-widest opacity-70">[{prefix}]</span>
              <span className="text-[11px] font-medium">{t.message}</span>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
