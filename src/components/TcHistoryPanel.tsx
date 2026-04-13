import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './auth/AuthProvider'
import { useToast } from './common/Toast'
import { supabase } from '../lib/supabase'
import {
  getVersionSnapshots,
  createVersionSnapshot,
  deleteVersionSnapshot,
  pinVersionSnapshot,
  pruneOldVersionSnapshots,
  type VersionSnapshot,
} from '../lib/database/versionHistory'
import type { TestCase, TestStep } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

type StepDiffEntry = {
  status: 'added' | 'removed' | 'modified' | 'unchanged'
  snapshotStep?: TestStep
  currentStep?: TestStep
}

function computeStepDiffs(snapSteps: TestStep[], currSteps: TestStep[]): StepDiffEntry[] {
  const sortedSnap = [...snapSteps].sort((a, b) => a.order - b.order)
  const sortedCurr = [...currSteps].sort((a, b) => a.order - b.order)
  const snapById = new Map(snapSteps.map(s => [s.id, s]))
  const currById = new Map(currSteps.map(s => [s.id, s]))
  const matchedCurrIds = new Set<string>()
  const result: StepDiffEntry[] = []

  for (const snap of sortedSnap) {
    const curr = currById.get(snap.id)
    if (curr) {
      matchedCurrIds.add(curr.id)
      const unchanged = JSON.stringify(snap) === JSON.stringify(curr)
      result.push({ status: unchanged ? 'unchanged' : 'modified', snapshotStep: snap, currentStep: curr })
    } else {
      result.push({ status: 'removed', snapshotStep: snap })
    }
  }

  for (const curr of sortedCurr) {
    if (!matchedCurrIds.has(curr.id) && !snapById.has(curr.id)) {
      result.push({ status: 'added', currentStep: curr })
    }
  }

  return result
}

function stepLabel(step?: TestStep): string {
  if (!step) return '—'
  const parts: string[] = [step.action as string]
  if (step.selector) parts.push(step.selector)
  if (step.value) parts.push(`"${step.value}"`)
  if (step.assertion && step.assertion !== 'none') parts.push(String(step.assertion))
  return parts.join(' · ')
}

const DIFF_COLORS: Record<StepDiffEntry['status'], string> = {
  added: 'bg-green-500/10 border-l-2 border-green-500/60 text-green-400',
  removed: 'bg-red-500/10 border-l-2 border-red-500/60 text-red-400 line-through opacity-70',
  modified: 'bg-amber-500/10 border-l-2 border-amber-500/60 text-amber-300',
  unchanged: 'border-l-2 border-transparent text-vsc-muted',
}

const DIFF_BADGE: Record<StepDiffEntry['status'], string> = {
  added: '+',
  removed: '−',
  modified: '~',
  unchanged: '=',
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  testCaseId: string
  projectId: string
  currentTc: TestCase
  onClose: () => void
  onRestore: (tc: TestCase) => void
}

// ── Main component ────────────────────────────────────────────────────────────

export function TcHistoryPanel({ testCaseId, projectId, currentTc, onClose, onRestore }: Props) {
  const { user } = useAuth()
  const { toast } = useToast()

  const [snapshots, setSnapshots] = useState<VersionSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualLabel, setManualLabel] = useState('')
  const [savingManual, setSavingManual] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<VersionSnapshot | null>(null)
  const [undoState, setUndoState] = useState<TestCase | null>(null)
  const [undoTimer, setUndoTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  const selectedSnapshot = snapshots.find(s => s.id === selectedId) ?? null

  const handleSelectSnapshot = (snap: VersionSnapshot, isCurrentlySelected: boolean) => {
    if (isCurrentlySelected) {
      setSelectedId(null)
      return
    }
    const rawData = snap.data
    // Ensure nested objects survived the jsonb round-trip (guard against string payloads)
    const parsedData: Record<string, unknown> =
      typeof rawData === 'string'
        ? (() => { try { return JSON.parse(rawData) } catch { return {} } })()
        : rawData ?? {}
    const parsedTc = parsedData.tc as TestCase | undefined
    console.log('[VersionHistory] Snapshot selected:', {
      id: snap.id,
      label: snap.label,
      createdAt: snap.createdAt,
      rawData,
      parsedData,
      parsedTc,
      parsedTcStepCount: parsedTc?.steps?.length ?? 0,
      parsedTcApiStepCount: parsedTc?.apiSteps?.length ?? 0,
      currentTc,
      currentTcStepCount: currentTc.steps?.length ?? 0,
      currentTcApiStepCount: currentTc.apiSteps?.length ?? 0,
    })
    // If data came back as a string (double-stringified), fix it in-place in state
    if (typeof rawData === 'string') {
      setSnapshots(prev =>
        prev.map(s => s.id === snap.id ? { ...s, data: parsedData } : s)
      )
    }
    setSelectedId(snap.id)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const snaps = await getVersionSnapshots(projectId, testCaseId, 50)
    setSnapshots(snaps)

    const ids = [...new Set(snaps.filter(s => s.createdBy).map(s => s.createdBy!))]
    if (ids.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', ids)
      if (data) {
        setUserNames(new Map(data.map((p: { id: string; display_name: string | null }) => [p.id, p.display_name ?? 'Unknown'])))
      }
    }
    setLoading(false)
  }, [projectId, testCaseId])

  useEffect(() => { load() }, [load])

  // Cleanup undo timer on unmount
  useEffect(() => () => { if (undoTimer) clearTimeout(undoTimer) }, [undoTimer])

  const handleSaveManual = async () => {
    if (savingManual) return
    setSavingManual(true)
    await createVersionSnapshot(
      projectId, testCaseId, 'manual',
      manualLabel.trim() || `Snapshot at ${formatAbsoluteTime(new Date().toISOString())}`,
      { tc: JSON.parse(JSON.stringify(currentTc)) },
      user?.id ?? null,
      null,
      true // pinned
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
    if (selectedId === snap.id) setSelectedId(null)
  }

  const handleRestore = async (snap: VersionSnapshot) => {
    const snapTc = (snap.data as { tc?: TestCase }).tc
    if (!snapTc) { toast('Snapshot data is incomplete', 'error'); return }

    // Save pre-restore state as a pinned snapshot (deep-clone to freeze current state)
    await createVersionSnapshot(
      projectId, testCaseId, 'auto',
      `Before restore to "${snap.label}"`,
      { tc: JSON.parse(JSON.stringify(currentTc)) },
      user?.id ?? null, null, true
    )

    const preRestoreTc = { ...currentTc }
    onRestore({ ...snapTc, id: testCaseId, featureId: currentTc.featureId, projectId })
    setConfirmRestore(null)

    // Show undo toast for 10 seconds
    if (undoTimer) clearTimeout(undoTimer)
    setUndoState(preRestoreTc)
    const timer = setTimeout(() => { setUndoState(null) }, 10000)
    setUndoTimer(timer)

    await load()
    toast('Restored')
  }

  const handleUndo = () => {
    if (!undoState) return
    onRestore(undoState)
    if (undoTimer) clearTimeout(undoTimer)
    setUndoTimer(null)
    setUndoState(null)
    toast('Restore undone')
  }

  const snapTcForDiff = selectedSnapshot
    ? (selectedSnapshot.data as { tc?: TestCase }).tc
    : null

  const stepDiffs = snapTcForDiff
    ? computeStepDiffs(snapTcForDiff.steps ?? [], currentTc.steps ?? [])
    : []

  const metadataDiffFields: (keyof TestCase)[] = [
    'name', 'description', 'priority', 'tags', 'annotations', 'pageUrl', 'viewport',
    'screenshotOnFailure', 'traceRecording', 'linkedFixture', 'authRoleId', 'type', 'disabled',
  ]
  const metadataChanges = snapTcForDiff
    ? metadataDiffFields.filter(
        f => JSON.stringify(snapTcForDiff[f]) !== JSON.stringify(currentTc[f])
      )
    : []

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-[460px] bg-vsc-panel border-l border-vsc-border flex flex-col shadow-2xl shadow-black/50 animate-slide-in-right">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-vsc-border shrink-0">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-vsc-accent shrink-0">
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 4.5V8l2.5 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-sm font-semibold text-vsc-text">Version History</span>
            <span className="text-xs text-vsc-dim">· {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManualInput(v => !v)}
              title="Save snapshot"
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-all ${
                showManualInput ? 'bg-vsc-accent/15 text-vsc-accent' : 'text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover'
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1l1.4 3.8L12 5.3l-3 2.7.9 3.9-3.4-2-3.4 2 .9-3.9L1 5.3l4.1-.5L6.5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Manual snapshot input */}
        {showManualInput && (
          <div className="px-5 py-3 border-b border-vsc-border bg-vsc-hover/50 shrink-0 animate-slide-down">
            <p className="text-xs text-vsc-dim mb-2">Save a pinned snapshot of the current state</p>
            <div className="flex gap-2">
              <input
                autoFocus
                value={manualLabel}
                onChange={e => setManualLabel(e.target.value)}
                placeholder="Label (e.g. Before refactor, Working version…)"
                className="flex-1 bg-vsc-bg border border-vsc-border rounded-md px-3 py-1.5 text-sm text-vsc-text placeholder-vsc-dim focus:border-vsc-accent outline-none"
                onKeyDown={e => { if (e.key === 'Enter') handleSaveManual() }}
              />
              <button
                onClick={handleSaveManual}
                disabled={savingManual}
                className="px-3 py-1.5 bg-vsc-accent text-vsc-bg text-xs font-semibold rounded-md hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Undo toast */}
        {undoState && (
          <div className="mx-5 mt-3 flex items-center gap-3 bg-vsc-accent/10 border border-vsc-accent/30 rounded-lg px-4 py-2.5 shrink-0 animate-fade-in">
            <span className="text-xs text-vsc-accent flex-1">Restored successfully.</span>
            <button
              onClick={handleUndo}
              className="text-xs font-semibold text-vsc-accent hover:underline"
            >
              Undo
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-vsc-dim text-sm">
              <svg className="animate-spin w-4 h-4 mr-2 text-vsc-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Loading history…
            </div>
          ) : snapshots.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="text-vsc-dim/40">
                <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2"/>
                <path d="M16 9v7l4 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-sm text-vsc-dim">No snapshots yet</p>
              <p className="text-xs text-vsc-dim/60 text-center max-w-[240px]">
                Snapshots are created automatically when you edit this test case.
              </p>
            </div>
          ) : (
            <div className="p-4">
              {/* Timeline */}
              <div className="relative">
                {snapshots.map((snap, i) => {
                  const isSelected = snap.id === selectedId
                  const isLast = i === snapshots.length - 1
                  const userName = snap.createdBy ? (userNames.get(snap.createdBy) ?? 'You') : 'System'
                  const snapTc = (snap.data as { tc?: TestCase }).tc

                  return (
                    <div key={snap.id} className="relative pl-6">
                      {/* Connecting line */}
                      {!isLast && (
                        <div className="absolute left-[9px] top-5 bottom-0 w-px bg-vsc-border/60" />
                      )}
                      {/* Dot */}
                      <div className={`absolute left-[5px] top-[18px] w-2 h-2 rounded-full border-2 ${
                        snap.isPinned
                          ? 'bg-vsc-accent border-vsc-accent'
                          : snap.snapshotType === 'generation'
                          ? 'bg-green-500 border-green-500'
                          : snap.snapshotType === 'manual'
                          ? 'bg-amber-400 border-amber-400'
                          : 'bg-vsc-border border-vsc-border'
                      }`} />

                      <div
                        className={`mb-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-vsc-accent/60 bg-vsc-accent/5'
                            : 'border-vsc-border bg-vsc-bg hover:border-vsc-accent/30 hover:bg-vsc-hover/50'
                        }`}
                        onClick={() => handleSelectSnapshot(snap, isSelected)}
                      >
                        <div className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-vsc-text truncate">{snap.label}</span>
                                {snap.isPinned && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-vsc-accent/15 text-vsc-accent border border-vsc-accent/25 shrink-0">
                                    pinned
                                  </span>
                                )}
                                {snap.snapshotType === 'generation' && (
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/25 shrink-0">
                                    generated
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs text-vsc-dim">{formatRelativeTime(snap.createdAt)}</span>
                                <span className="text-vsc-dim/40 text-xs">·</span>
                                {snapTc && (
                                  <span className="text-xs text-vsc-dim tabular-nums">
                                    {(snapTc.steps?.length ?? 0) + (snapTc.apiSteps?.length ?? 0)} step{((snapTc.steps?.length ?? 0) + (snapTc.apiSteps?.length ?? 0)) !== 1 ? 's' : ''}
                                  </span>
                                )}
                                <span className="text-vsc-dim/40 text-xs">·</span>
                                <span className="text-xs text-vsc-dim">{userName}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={e => handleTogglePin(snap, e)}
                                title={snap.isPinned ? 'Unpin' : 'Pin (prevents auto-deletion)'}
                                className={`w-6 h-6 flex items-center justify-center rounded transition-all ${
                                  snap.isPinned ? 'text-vsc-accent' : 'text-vsc-dim/50 hover:text-vsc-dim'
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
                                  title="Delete snapshot"
                                  className="w-6 h-6 flex items-center justify-center rounded text-vsc-dim/40 hover:text-red-400 transition-all"
                                >
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M1.5 2.5h7M4 2.5V1.5h2V2.5M3 2.5v6h4v-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Restore button row */}
                        {isSelected && (
                          <div className="px-4 pb-3 pt-0">
                            <button
                              onClick={e => { e.stopPropagation(); setConfirmRestore(snap) }}
                              className="text-xs font-medium text-vsc-accent hover:underline"
                            >
                              Restore this version →
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Diff view */}
              {selectedSnapshot && snapTcForDiff && (
                <div className="mt-4 border border-vsc-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-vsc-bg border-b border-vsc-border">
                    <p className="text-xs font-semibold text-vsc-dim uppercase tracking-widest">
                      Diff — {formatAbsoluteTime(selectedSnapshot.createdAt)} vs now
                    </p>
                  </div>

                  {/* Metadata changes */}
                  {metadataChanges.length > 0 && (
                    <div className="px-4 py-3 border-b border-vsc-border/60">
                      <p className="text-[10px] text-vsc-dim uppercase tracking-wider font-semibold mb-2">Settings changes</p>
                      <div className="flex flex-col gap-1.5">
                        {metadataChanges.map(field => (
                          <div key={field} className="flex items-center gap-2 text-xs">
                            <span className="text-vsc-dim capitalize w-24 shrink-0">{field}</span>
                            <span className="text-red-400 line-through opacity-70 truncate max-w-[100px]">
                              {JSON.stringify((snapTcForDiff as unknown as Record<string, unknown>)[field])}
                            </span>
                            <span className="text-vsc-dim/40">→</span>
                            <span className="text-green-400 truncate max-w-[100px]">
                              {JSON.stringify((currentTc as unknown as Record<string, unknown>)[field])}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Steps diff */}
                  <div className="p-3">
                    <p className="text-[10px] text-vsc-dim uppercase tracking-wider font-semibold mb-2 px-1">
                      Steps ({snapTcForDiff.steps?.length ?? 0} → {currentTc.steps?.length ?? 0})
                    </p>
                    {stepDiffs.length === 0 ? (
                      <p className="text-xs text-vsc-dim px-1">No steps in either version</p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {stepDiffs.map((entry, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-2 px-3 py-2 rounded-md text-xs font-mono ${DIFF_COLORS[entry.status]}`}
                          >
                            <span className="shrink-0 w-4 font-bold opacity-80">{DIFF_BADGE[entry.status]}</span>
                            <span className="truncate flex-1">
                              {entry.status === 'modified'
                                ? <>
                                    <span className="line-through opacity-60">{stepLabel(entry.snapshotStep)}</span>
                                    <span className="ml-2 not-italic">→ {stepLabel(entry.currentStep)}</span>
                                  </>
                                : stepLabel(entry.snapshotStep ?? entry.currentStep)
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Restore confirmation dialog */}
      {confirmRestore && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmRestore(null)} />
          <div className="relative bg-vsc-panel border border-vsc-border rounded-2xl shadow-2xl shadow-black/60 p-6 w-full max-w-sm animate-slide-down">
            <h3 className="text-base font-semibold text-vsc-text mb-2">Restore this version?</h3>
            <p className="text-sm text-vsc-muted mb-1">
              This will restore the test case to its state from{' '}
              <span className="font-medium text-vsc-text">{formatAbsoluteTime(confirmRestore.createdAt)}</span>.
            </p>
            <p className="text-xs text-vsc-dim mb-5">
              A snapshot of the current state will be saved first. You'll have 10 seconds to undo.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRestore(null)}
                className="px-4 py-2 text-sm text-vsc-muted border border-vsc-border rounded-lg hover:bg-vsc-hover transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestore(confirmRestore)}
                className="px-4 py-2 text-sm font-semibold bg-vsc-accent text-vsc-bg rounded-lg hover:opacity-90 transition-opacity"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
