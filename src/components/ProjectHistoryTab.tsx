import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth/AuthProvider'
import { useToast } from './common/Toast'
import { useApp } from '../store/AppContext'
import { supabase } from '../lib/supabase'
import {
  getVersionSnapshots,
  createVersionSnapshot,
  deleteVersionSnapshot,
  pinVersionSnapshot,
  getProjectSnapshot,
  restoreProjectSnapshot,
  type VersionSnapshot,
} from '../lib/database/versionHistory'
import { loadFullState } from '../lib/database'

interface Props {
  projectId: string
  projectName: string
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  auto:       { label: 'auto',        cls: 'bg-vsc-border/60 text-vsc-dim' },
  manual:     { label: 'manual',      cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' },
  generation: { label: 'generated',   cls: 'bg-green-500/15 text-green-400 border border-green-500/25' },
}

export function ProjectHistoryTab({ projectId, projectName }: Props) {
  const { user, teamId } = useAuth()
  const { toast } = useToast()
  const { dispatch } = useApp()

  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<VersionSnapshot | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualLabel, setManualLabel] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const { state } = useApp()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Query new-style snapshots (entity_type = 'project') AND old-style
      // project-level snapshots (entity_type IS NULL AND test_case_id IS NULL)
      // so the panel works before and after the backfill migration.
      console.log('[ProjectHistory] Fetching snapshots for project:', projectId, {
        filters: { project_id: projectId, entity_type: 'project OR null', test_case_id: 'null (for old rows)' },
      })
      const { data: rawSnaps, error } = await supabase
        .from('snapshots')
        .select('*')
        .eq('project_id', projectId)
        .or(`entity_type.eq.project,and(entity_type.is.null,test_case_id.is.null)`)
        .order('created_at', { ascending: false })
        .limit(50)

      console.log('[ProjectHistory] Supabase response:', { data: rawSnaps, error })

      if (error) {
        console.error('[ProjectHistory] Query error:', error)
        setSnapshots([])
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const snaps = (rawSnaps ?? []).map((row: any) => {
        let data = row.data ?? {}
        if (typeof data === 'string') { try { data = JSON.parse(data) } catch { data = {} } }
        return {
          id: row.id as string,
          projectId: row.project_id as string,
          entityType: (row.entity_type ?? 'project') as import('../lib/database/versionHistory').SnapshotEntityType,
          entityId: (row.entity_id ?? row.project_id) as string,
          createdBy: row.created_by as string | null,
          snapshotType: row.snapshot_type as 'auto' | 'manual' | 'generation',
          label: row.label as string,
          changeDescription: row.change_description as string | null,
          data: data as Record<string, unknown>,
          isPinned: row.is_pinned as boolean,
          createdAt: row.created_at as string,
        }
      })

      console.log('[ProjectHistory] Processed snapshots:', snaps.length, 'rows')
      setSnapshots(snaps)

      const ids = [...new Set(snaps.filter(s => s.createdBy).map(s => s.createdBy!))]
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', ids)
        if (profiles) {
          setUserNames(new Map(profiles.map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? 'Unknown'])))
        }
      }
    } catch (err) {
      console.error('[ProjectHistory] Unexpected error in load():', err)
      setSnapshots([])
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleSaveManual = async () => {
    if (savingManual) return
    setSavingManual(true)
    const data = getProjectSnapshot(projectId, state)
    await createVersionSnapshot(
      projectId, 'project', projectId, 'manual',
      manualLabel.trim() || `Snapshot at ${formatAbsoluteTime(new Date().toISOString())}`,
      data, user?.id ?? null, null, true
    )
    await load()
    setShowManualInput(false)
    setManualLabel('')
    setSavingManual(false)
    toast('Snapshot saved')
  }

  const handleTogglePin = async (snap: VersionSnapshot, e: React.MouseEvent) => {
    e.stopPropagation()
    await pinVersionSnapshot(snap.id, !snap.isPinned)
    setSnapshots(prev => prev.map(s => s.id === snap.id ? { ...s, isPinned: !s.isPinned } : s))
  }

  const handleDelete = async (snap: VersionSnapshot, e: React.MouseEvent) => {
    e.stopPropagation()
    if (snap.isPinned) return
    await deleteVersionSnapshot(snap.id)
    setSnapshots(prev => prev.filter(s => s.id !== snap.id))
    if (expandedId === snap.id) setExpandedId(null)
  }

  const handleRestore = async () => {
    if (!confirmRestore || confirmText.trim() !== projectName) return
    setRestoring(true)

    try {
      // Save current state as pinned snapshot
      const currentData = getProjectSnapshot(projectId, state)
      await createVersionSnapshot(
        projectId, 'project', projectId, 'manual',
        `Before restore to "${confirmRestore.label}"`,
        currentData, user?.id ?? null, null, true
      )

      await restoreProjectSnapshot(projectId, confirmRestore.data)

      // Reload fresh state
      const fresh = await loadFullState(teamId!)
      dispatch({ type: 'HYDRATE', state: fresh })
      toast('Project restored successfully')
      setConfirmRestore(null)
      setConfirmText('')
      await load()
    } catch (err) {
      toast(`Restore failed: ${(err as Error).message}`, 'error')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-vsc-text">Project History</h2>
          <p className="text-xs text-vsc-dim mt-0.5">
            Automatic snapshots of project-level changes. Last {snapshots.length} events.
          </p>
        </div>
        <button
          onClick={() => setShowManualInput(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
            showManualInput
              ? 'bg-vsc-accent/10 border-vsc-accent/30 text-vsc-accent'
              : 'border-vsc-border text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover'
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.2 3.2L10.5 4.7l-2.5 2.3.7 3.2-2.7-1.6-2.7 1.6.7-3.2L1.5 4.7l3.3-.5L6 1z"
              stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
              fill={showManualInput ? 'currentColor' : 'none'}
            />
          </svg>
          Save snapshot
        </button>
      </div>

      {/* Manual snapshot input */}
      {showManualInput && (
        <div className="mb-5 p-4 border border-vsc-border rounded-xl bg-vsc-bg animate-slide-down">
          <p className="text-xs text-vsc-dim mb-2">Creates a pinned snapshot of the full project state</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={manualLabel}
              onChange={e => setManualLabel(e.target.value)}
              placeholder="Label (e.g. Before refactor, Sprint 3 baseline…)"
              className="flex-1 bg-vsc-panel border border-vsc-border rounded-md px-3 py-2 text-sm text-vsc-text placeholder-vsc-dim focus:border-vsc-accent outline-none"
              onKeyDown={e => { if (e.key === 'Enter') handleSaveManual() }}
            />
            <button
              onClick={handleSaveManual}
              disabled={savingManual}
              className="px-4 py-2 bg-vsc-accent text-vsc-bg text-sm font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-vsc-dim text-sm">
          <svg className="animate-spin w-4 h-4 mr-2 text-vsc-accent" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Loading history…
        </div>
      ) : snapshots.length === 0 ? (
        <div className="border border-dashed border-vsc-border/60 rounded-xl p-14 text-center">
          <p className="text-vsc-dim text-sm font-medium">No project snapshots yet</p>
          <p className="text-xs text-vsc-dim/60 mt-2 max-w-xs mx-auto">
            Snapshots are created automatically when you change project settings, add features, edit utils, or generate code.
          </p>
        </div>
      ) : (
        <div className="relative">
          {snapshots.map((snap, i) => {
            const isExpanded = snap.id === expandedId
            const isLast = i === snapshots.length - 1
            const userName = snap.createdBy ? (userNames.get(snap.createdBy) ?? 'Unknown') : 'System'
            const badge = TYPE_BADGE[snap.snapshotType] ?? TYPE_BADGE.auto
            const snapData = snap.data as Record<string, unknown>
            const tcCount = Array.isArray(snapData.testCases) ? (snapData.testCases as unknown[]).length : null
            const featureCount = Array.isArray(snapData.features) ? (snapData.features as unknown[]).length : null

            return (
              <div key={snap.id} className="relative pl-7">
                {!isLast && (
                  <div className="absolute left-[11px] top-5 bottom-0 w-px bg-vsc-border/50" />
                )}
                <div className={`absolute left-[7px] top-[18px] w-2.5 h-2.5 rounded-full border-2 ${
                  snap.isPinned
                    ? 'bg-vsc-accent border-vsc-accent'
                    : snap.snapshotType === 'generation'
                    ? 'bg-green-500 border-green-500'
                    : snap.snapshotType === 'manual'
                    ? 'bg-amber-400 border-amber-400'
                    : 'bg-vsc-border border-vsc-panel'
                }`} />

                <div
                  className={`mb-3 rounded-xl border transition-all ${
                    isExpanded
                      ? 'border-vsc-accent/40 bg-vsc-panel'
                      : 'border-vsc-border bg-vsc-bg hover:border-vsc-accent/25 cursor-pointer'
                  }`}
                  onClick={() => !isExpanded && setExpandedId(snap.id)}
                >
                  <div className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            className="text-sm font-medium text-vsc-text text-left hover:text-white transition-colors"
                            onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : snap.id) }}
                          >
                            {snap.label}
                          </button>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>
                            {badge.label}
                          </span>
                          {snap.isPinned && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-vsc-accent/15 text-vsc-accent border border-vsc-accent/25">
                              pinned
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-vsc-dim">{formatRelativeTime(snap.createdAt)}</span>
                          <span className="text-vsc-dim/40">·</span>
                          <span className="text-xs text-vsc-dim">{userName}</span>
                          {featureCount !== null && (
                            <>
                              <span className="text-vsc-dim/40">·</span>
                              <span className="text-xs text-vsc-dim tabular-nums">{featureCount} feature{featureCount !== 1 ? 's' : ''}</span>
                            </>
                          )}
                          {tcCount !== null && (
                            <>
                              <span className="text-vsc-dim/40">·</span>
                              <span className="text-xs text-vsc-dim tabular-nums">{tcCount} test case{tcCount !== 1 ? 's' : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={e => handleTogglePin(snap, e)}
                          title={snap.isPinned ? 'Unpin' : 'Pin'}
                          className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                            snap.isPinned ? 'text-vsc-accent' : 'text-vsc-dim/40 hover:text-vsc-dim'
                          }`}
                        >
                          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <path d="M5.5 1l1.2 3.2L10 4.7l-2.5 2.3.7 3.2-2.7-1.6-2.7 1.6.7-3.2L1 4.7l3.3-.5L5.5 1z"
                              stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"
                              fill={snap.isPinned ? 'currentColor' : 'none'}
                            />
                          </svg>
                        </button>
                        {!snap.isPinned && (
                          <button
                            onClick={e => handleDelete(snap, e)}
                            title="Delete"
                            className="w-6 h-6 flex items-center justify-center rounded text-vsc-dim/40 hover:text-red-400 transition-all"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M1.5 2.5h7M4 2.5V1.5h2V2.5M3 2.5v6h4v-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : snap.id) }}
                          className="w-6 h-6 flex items-center justify-center rounded text-vsc-dim hover:text-vsc-text transition-all"
                        >
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          >
                            <path d="M2 3.5L5 7l3-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-vsc-border/60 animate-slide-down">
                      <p className="text-xs text-vsc-dim mt-3 mb-3">
                        Snapshot captured on {formatAbsoluteTime(snap.createdAt)}
                      </p>
                      {snapData.project && (
                        <div className="text-xs text-vsc-dim mb-4">
                          <span className="font-medium text-vsc-muted">Settings captured: </span>
                          language, browser, base URL, timeout, reporter, auth, CI/CD
                        </div>
                      )}
                      <button
                        onClick={() => setConfirmRestore(snap)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-vsc-border text-xs font-medium text-vsc-muted hover:text-vsc-text hover:border-vsc-accent/40 hover:bg-vsc-hover transition-all"
                      >
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                          <path d="M1 5.5A4.5 4.5 0 105.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                          <path d="M1 1v4.5h4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Restore project to this point
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Restore confirmation dialog */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setConfirmRestore(null); setConfirmText('') }} />
          <div className="relative bg-vsc-panel border border-vsc-border rounded-2xl shadow-2xl shadow-black/60 p-6 w-full max-w-md animate-slide-down">
            <h3 className="text-base font-semibold text-vsc-text mb-2">Restore project?</h3>
            <p className="text-sm text-vsc-muted mb-4">
              This will restore <span className="font-semibold text-vsc-text">{projectName}</span> to the state from{' '}
              <span className="font-medium text-vsc-text">{formatAbsoluteTime(confirmRestore.createdAt)}</span>.
              All current features, test cases, variables, utils, and fixtures will be replaced.
            </p>
            <p className="text-xs text-vsc-dim mb-1">
              A snapshot of the current state will be saved before restoring. Type the project name to confirm:
            </p>
            <input
              autoFocus
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder={projectName}
              className="w-full bg-vsc-bg border border-vsc-border rounded-lg px-3 py-2 text-sm text-vsc-text placeholder-vsc-dim focus:border-vsc-accent outline-none mb-4 mt-1"
              onKeyDown={e => { if (e.key === 'Enter' && confirmText === projectName) handleRestore() }}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setConfirmRestore(null); setConfirmText('') }}
                className="px-4 py-2 text-sm text-vsc-muted border border-vsc-border rounded-lg hover:bg-vsc-hover transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={confirmText.trim() !== projectName || restoring}
                className="px-4 py-2 text-sm font-semibold bg-vsc-danger text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {restoring ? 'Restoring…' : 'Restore project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
