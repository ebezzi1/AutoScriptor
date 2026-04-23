import { useState, useEffect, useCallback } from 'react'
import { useAgent } from '../../store/AgentContext'
import { useToast } from '../common/Toast'
import { Field, Input } from '../common/Field'
import { Btn } from '../common/Btn'
import { ScaffoldProgressModal } from './ScaffoldProgressModal'
import { AgentClientService } from '../../services/agentClient'
import type { ProjectInfoResponse, CheckEnvResponse } from '../../lib/agent'

type DirBadge = 'not_configured' | 'ready' | 'scaffold_needed' | 'error'

function badgeFor(
  dirInput: string,
  dirStatus: ProjectInfoResponse | null,
  isConnected: boolean
): DirBadge {
  if (!dirInput.trim()) return 'not_configured'
  if (!isConnected) return 'not_configured'
  if (!dirStatus) return 'not_configured'
  if (!dirStatus.path) return 'scaffold_needed'
  if (!dirStatus.hasPlaywright) return 'scaffold_needed'
  return 'ready'
}

const BADGE_STYLES: Record<DirBadge, { label: string; cls: string }> = {
  not_configured: { label: 'Not configured', cls: 'text-vsc-dim border-vsc-border bg-vsc-hover' },
  ready: { label: 'Ready', cls: 'text-green-400 border-green-500/30 bg-green-500/5' },
  scaffold_needed: { label: 'Scaffold needed', cls: 'text-amber-400 border-amber-500/30 bg-amber-500/5' },
  error: { label: 'Error', cls: 'text-red-400 border-red-500/30 bg-red-500/5' },
}

interface Props {
  projectId: string
  projectName: string
  localDirectory?: string
  onDirectoryChange: (dir: string) => void
}

export function ProjectDirectorySettings({
  projectId,
  projectName,
  localDirectory,
  onDirectoryChange,
}: Props) {
  const { client, isConnected, agentUrl, agentToken } = useAgent()
  const { toast } = useToast()

  const [dirInput, setDirInput] = useState(localDirectory ?? '')
  const [dirStatus, setDirStatus] = useState<ProjectInfoResponse | null>(null)
  const [dirChecking, setDirChecking] = useState(false)
  const [envCheck, setEnvCheck] = useState<CheckEnvResponse | null>(null)
  const [envChecking, setEnvChecking] = useState(false)
  const [showScaffold, setShowScaffold] = useState(false)

  // Sync dirInput from prop
  useEffect(() => {
    if (localDirectory && !dirInput) setDirInput(localDirectory)
  }, [localDirectory]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkDirectory = useCallback(async () => {
    if (!client || !dirInput.trim()) return
    setDirChecking(true)
    try {
      await client.setProjectDir(dirInput.trim())
      const info = await client.getProjectInfo()
      setDirStatus(info)
    } catch {
      setDirStatus(null)
    } finally {
      setDirChecking(false)
    }
  }, [client, dirInput])

  // Auto-check on connect
  useEffect(() => {
    if (localDirectory && isConnected && client) checkDirectory()
  }, [isConnected]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSetDirectory = async () => {
    if (!dirInput.trim()) return
    onDirectoryChange(dirInput.trim())
    toast('Directory saved')
    if (isConnected && client) await checkDirectory()
  }

  const handleVerifyEnv = async () => {
    if (!client) return
    setEnvChecking(true)
    try {
      // Use the service-layer client for env check
      const svc = new AgentClientService({ baseUrl: agentUrl, token: agentToken })
      const result = await svc.checkEnvironment()
      setEnvCheck(result)
    } catch {
      setEnvCheck(null)
      toast('Failed to check environment', 'error')
    } finally {
      setEnvChecking(false)
    }
  }

  const badge = badgeFor(dirInput, dirStatus, isConnected)
  const { label: badgeLabel, cls: badgeCls } = BADGE_STYLES[badge]

  return (
    <>
      <section>
        <div className="flex items-center gap-3 mb-4">
          <p className="text-[10px] font-semibold text-vsc-dim uppercase tracking-[0.14em] shrink-0">
            Project Directory
          </p>
          <div className="flex-1 h-px bg-vsc-border/40" />
          <span className={`text-[9px] uppercase tracking-wider border rounded-sm px-2 py-0.5 ${badgeCls}`}>
            {badgeLabel}
          </span>
        </div>

        <p className="text-[10px] text-vsc-dim mb-4">
          Configure where generated test files live on disk. The agent writes and syncs files to this directory.
        </p>

        {/* Agent disconnected alert */}
        {!isConnected && (
          <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-vsc-muted">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="flex-1">
              Agent not connected. Start the agent and configure it in Agent Connection below to manage directories.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {/* Directory path input */}
          <Field label="Directory path">
            <div className="flex gap-2">
              <Input
                value={dirInput}
                onChange={(e) => setDirInput(e.target.value)}
                placeholder={`~/Autoscriptor/${projectName.toLowerCase().replace(/\s+/g, '-')}/`}
                className="font-mono"
              />
              <button
                onClick={handleSetDirectory}
                disabled={!dirInput.trim() || !isConnected || dirChecking}
                className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {dirChecking ? 'Checking...' : 'Set Directory'}
              </button>
            </div>
          </Field>

          {/* Directory status */}
          {dirStatus && isConnected && (
            <div className="bg-vsc-bg border border-vsc-border rounded-sm p-3 flex flex-col gap-1.5">
              <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-1">Directory Status</p>
              <StatusRow ok={!!dirStatus.path} label="Folder exists" />
              <StatusRow ok={dirStatus.hasPackageJson} label="Has package.json" />
              <StatusRow
                ok={dirStatus.hasPlaywright}
                label="Playwright installed"
                detail={dirStatus.playwrightVersion ? `v${dirStatus.playwrightVersion}` : undefined}
              />
              <StatusRow ok={dirStatus.gitInitialized} label="Git initialized" />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {isConnected && dirStatus && (!dirStatus.path || !dirStatus.hasPlaywright) && (
              <Btn variant="primary" size="sm" onClick={() => setShowScaffold(true)}>
                {!dirStatus.path ? 'Create & Scaffold' : 'Install Playwright'}
              </Btn>
            )}

            {isConnected && (
              <button
                onClick={handleVerifyEnv}
                disabled={envChecking}
                className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {envChecking ? 'Checking...' : 'Verify Environment'}
              </button>
            )}
          </div>

          {/* Open in IDE — shown when directory is ready */}
          {badge === 'ready' && isConnected && client && (
            <div>
              <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-2">Open project in</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => client.openInIDE('vscode')}
                  className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all flex items-center gap-1.5"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M11.5 1L5 7l6.5 6 2.5-1.5v-9L11.5 1z" fill="currentColor" fillOpacity="0.6"/>
                    <path d="M5 7L1.5 4 3 2.5 11.5 7 3 11.5 1.5 10 5 7z" fill="currentColor" fillOpacity="0.4"/>
                  </svg>
                  VS Code
                </button>
                <button
                  onClick={() => client.openInIDE('cursor')}
                  className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all flex items-center gap-1.5"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
                    <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                  Cursor
                </button>
                <button
                  onClick={() => client.openInIDE('terminal')}
                  className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all flex items-center gap-1.5"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M4 7l2.5 2L4 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M8.5 11H12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  Terminal
                </button>
              </div>
            </div>
          )}

          {/* Environment check results */}
          {envCheck && (
            <div className="bg-vsc-bg border border-vsc-border rounded-sm p-3 flex flex-col gap-1.5">
              <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-1">Environment Check</p>
              {envCheck.checks.map((check) => (
                <StatusRow
                  key={check.name}
                  ok={check.passed}
                  label={check.name}
                  detail={check.version ?? check.error}
                />
              ))}
              <div className="h-px bg-vsc-border/30 my-1" />
              <div className="flex items-center gap-2">
                {envCheck.ready ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-green-400 shrink-0">
                      <path d="M2 6l3 3 5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span className="text-[10px] text-green-400 font-medium">Environment ready</span>
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-red-400 shrink-0">
                      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[10px] text-red-400 font-medium">Environment not ready</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {showScaffold && (
        <ScaffoldProgressModal
          directory={dirInput.trim()}
          projectId={projectId}
          projectName={projectName}
          onClose={() => setShowScaffold(false)}
          onComplete={async () => {
            onDirectoryChange(dirInput.trim())
            if (isConnected && client) await checkDirectory()
          }}
        />
      )}
    </>
  )
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-green-400 shrink-0">
          <path d="M2 6l3 3 5-5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-red-400 shrink-0">
          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      )}
      <span className={`text-[10px] ${ok ? 'text-vsc-muted' : 'text-red-400/80'}`}>
        {label}
      </span>
      {detail && (
        <span className="text-[9px] text-vsc-dim ml-1">{detail}</span>
      )}
    </div>
  )
}
