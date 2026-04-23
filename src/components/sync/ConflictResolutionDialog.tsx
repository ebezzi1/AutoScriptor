import { useState } from 'react'
import { Btn } from '../common/Btn'

type Resolution = 'app' | 'local'

interface ConflictEntry {
  filePath: string
  contentHash: string
  localHash: string
}

interface Props {
  conflicts: ConflictEntry[]
  onApply: (resolutions: Record<string, Resolution>) => Promise<void>
  onCancel: () => void
}

export function ConflictResolutionDialog({ conflicts, onApply, onCancel }: Props) {
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>(() => {
    const init: Record<string, Resolution> = {}
    for (const c of conflicts) init[c.filePath] = 'app'
    return init
  })
  const [applying, setApplying] = useState(false)

  const setResolution = (filePath: string, value: Resolution) => {
    setResolutions((prev) => ({ ...prev, [filePath]: value }))
  }

  const handleApply = async () => {
    setApplying(true)
    try {
      await onApply(resolutions)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-[60] p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && !applying && onCancel()}
    >
      <div className="bg-vsc-panel border border-vsc-border rounded-xl shadow-2xl w-[520px] max-h-[90vh] flex flex-col animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-vsc-border shrink-0">
          <div className="flex items-center gap-2.5">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-amber-400 shrink-0">
              <path d="M8 1L1 14h14L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 6v3M8 11.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <h2 className="text-sm font-semibold text-vsc-text">
              Resolve Conflicts ({conflicts.length})
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={applying}
            className="w-7 h-7 flex items-center justify-center rounded-md text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-colors text-lg leading-none disabled:opacity-30"
            aria-label="Close"
          >
            x
          </button>
        </div>

        {/* Description */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-xs text-vsc-muted leading-relaxed">
            These files have been modified both in the app and on disk.
            Choose which version to keep for each file.
          </p>
        </div>

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          <div className="flex flex-col gap-3">
            {conflicts.map((conflict) => (
              <div
                key={conflict.filePath}
                className="border border-vsc-border rounded-md p-3 bg-vsc-bg"
              >
                {/* File path */}
                <div className="flex items-center gap-2 mb-3">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-vsc-muted shrink-0">
                    <path d="M2 2h5l1 1h2v7H2V2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[10px] font-mono text-vsc-text truncate" title={conflict.filePath}>
                    {conflict.filePath}
                  </span>
                </div>

                {/* Hashes */}
                <div className="flex items-center gap-4 mb-3 text-[9px] text-vsc-dim">
                  <span>App: <code className="text-vsc-muted font-mono">{conflict.contentHash.slice(0, 8)}...</code></span>
                  <span>Local: <code className="text-vsc-muted font-mono">{conflict.localHash.slice(0, 8)}...</code></span>
                </div>

                {/* Resolution radios */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        resolutions[conflict.filePath] === 'app'
                          ? 'border-vsc-accent'
                          : 'border-vsc-border'
                      }`}
                      onClick={() => setResolution(conflict.filePath, 'app')}
                    >
                      {resolutions[conflict.filePath] === 'app' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-vsc-accent" />
                      )}
                    </div>
                    <span className="text-[10px] text-vsc-muted">Use app version</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        resolutions[conflict.filePath] === 'local'
                          ? 'border-vsc-accent'
                          : 'border-vsc-border'
                      }`}
                      onClick={() => setResolution(conflict.filePath, 'local')}
                    >
                      {resolutions[conflict.filePath] === 'local' && (
                        <div className="w-1.5 h-1.5 rounded-full bg-vsc-accent" />
                      )}
                    </div>
                    <span className="text-[10px] text-vsc-muted">Keep local version</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-vsc-border shrink-0 flex items-center justify-end gap-3">
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={applying}>
            Cancel
          </Btn>
          <Btn variant="primary" size="sm" onClick={handleApply} disabled={applying}>
            {applying ? 'Applying...' : 'Apply'}
          </Btn>
        </div>
      </div>
    </div>
  )
}
