import { useState, useEffect, useRef, useCallback } from 'react'
import { useAgent } from '../../store/AgentContext'
import { SyncEngine } from '../../services/syncEngine'
import { AgentClientService } from '../../services/agentClient'
import { SyncDetailPopover } from './SyncDetailPopover'

const POLL_INTERVAL_MS = 30_000

interface Props {
  projectId: string
}

export function SyncStatusIndicator({ projectId }: Props) {
  const { isConnected, agentUrl, agentToken } = useAgent()
  const [syncStatus, setSyncStatus] = useState<{
    total: number
    synced: number
    pending: number
    conflict: number
    error: number
  } | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Click-outside dismiss
  useEffect(() => {
    if (!open) return undefined
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const fetchStatus = useCallback(async () => {
    if (!isConnected || !agentToken) return
    try {
      const agentSvc = new AgentClientService({ baseUrl: agentUrl, token: agentToken })
      const engine = new SyncEngine(agentSvc, projectId)
      const status = await engine.getSyncStatus()
      setSyncStatus(status)
    } catch {
      // Silently fail — status just won't update
    }
  }, [isConnected, agentUrl, agentToken, projectId])

  // Poll on mount + interval
  useEffect(() => {
    if (!isConnected) {
      setSyncStatus(null)
      return undefined
    }

    fetchStatus()
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isConnected, fetchStatus])

  // Don't render when disconnected or no data
  if (!isConnected || !syncStatus || syncStatus.total === 0) return null

  const hasConflicts = syncStatus.conflict > 0
  const hasPending = syncStatus.pending > 0 || syncStatus.error > 0
  const allSynced = !hasConflicts && !hasPending

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
          hasConflicts
            ? 'text-red-400 hover:bg-red-500/10'
            : hasPending
              ? 'text-amber-400 hover:bg-amber-500/10'
              : 'text-green-400 hover:bg-green-500/10'
        }`}
        title="File sync status"
      >
        {/* Sync icon */}
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M1.5 6a4.5 4.5 0 018.1-2.7M10.5 6a4.5 4.5 0 01-8.1 2.7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M9.6 1v2.3h-2.3M2.4 11V8.7h2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>

        {hasConflicts ? (
          <span>{syncStatus.conflict} conflict{syncStatus.conflict !== 1 ? 's' : ''}</span>
        ) : hasPending ? (
          <span>{syncStatus.pending + syncStatus.error} pending</span>
        ) : allSynced ? (
          <span>Synced</span>
        ) : null}
      </button>

      {open && (
        <SyncDetailPopover
          projectId={projectId}
          onClose={() => setOpen(false)}
          onRefresh={fetchStatus}
        />
      )}
    </div>
  )
}
