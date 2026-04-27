import { useState } from 'react'
import { useAgent } from '../../store/AgentContext'
import { Input } from '../common/Field'

type Mode = 'create' | 'existing'

interface Props {
  projectName: string
  value: string
  onChange: (path: string) => void
  onSkip?: () => void
}

export function CreateProjectDirectoryStep({
  projectName,
  value,
  onChange,
  onSkip,
}: Props) {
  const { isConnected } = useAgent()
  const [mode, setMode] = useState<Mode>('create')

  const defaultPath = `~/Autoscriptor/${projectName.toLowerCase().replace(/\s+/g, '-')}/`

  const handleModeChange = (next: Mode) => {
    setMode(next)
    if (next === 'create' && !value) {
      onChange(defaultPath)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Icon */}
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-vsc-accent/10 text-vsc-accent mx-auto">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M3 7V5a2 2 0 012-2h4l2 2h8a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M12 10v6M9 13h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>

      <div className="text-center">
        <h3 className="text-base font-semibold text-vsc-text mb-2">Project Directory</h3>
        <p className="text-xs text-vsc-muted leading-relaxed">
          Choose where to store your Playwright test project on disk.
        </p>
      </div>

      {/* Agent status */}
      <div className="flex items-center justify-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-vsc-dim'}`} />
        <span className={`text-[10px] ${isConnected ? 'text-green-400' : 'text-vsc-dim'}`}>
          {isConnected ? 'Agent connected' : 'Agent disconnected'}
        </span>
      </div>

      {/* Radio options */}
      <div className="flex flex-col gap-2">
        <label
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
            mode === 'create'
              ? 'border-vsc-accent/50 bg-vsc-accent-light'
              : 'border-vsc-border bg-vsc-bg hover:border-vsc-border'
          }`}
          onClick={() => handleModeChange('create')}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            mode === 'create' ? 'border-vsc-accent' : 'border-vsc-border'
          }`}>
            {mode === 'create' && (
              <div className="w-2 h-2 rounded-full bg-vsc-accent" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-vsc-text">Create new folder</p>
            <p className="text-[10px] text-vsc-dim">We'll scaffold a fresh Playwright project at the path you specify</p>
          </div>
        </label>

        <label
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
            mode === 'existing'
              ? 'border-vsc-accent/50 bg-vsc-accent-light'
              : 'border-vsc-border bg-vsc-bg hover:border-vsc-border'
          }`}
          onClick={() => handleModeChange('existing')}
        >
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            mode === 'existing' ? 'border-vsc-accent' : 'border-vsc-border'
          }`}>
            {mode === 'existing' && (
              <div className="w-2 h-2 rounded-full bg-vsc-accent" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-vsc-text">Use existing folder</p>
            <p className="text-[10px] text-vsc-dim">Point to a folder that already has Playwright set up</p>
          </div>
        </label>
      </div>

      {/* Path input */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-vsc-muted">
          {mode === 'create' ? 'New project path' : 'Existing project path'}
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultPath}
          className="font-mono"
        />
        {mode === 'create' && !value && (
          <p className="text-[9px] text-vsc-dim">
            Suggested: <button
              onClick={() => onChange(defaultPath)}
              className="text-vsc-accent hover:underline font-mono"
            >
              {defaultPath}
            </button>
          </p>
        )}
        {!value.trim() && (
          <p className="text-[9px] text-red-400/70">Path is required</p>
        )}
      </div>

      {/* Skip link */}
      {onSkip && (
        <button
          onClick={onSkip}
          className="text-xs text-vsc-dim hover:text-vsc-muted transition-colors self-center"
        >
          Skip for now
        </button>
      )}
    </div>
  )
}
