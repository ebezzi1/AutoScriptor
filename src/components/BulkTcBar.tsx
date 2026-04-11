import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from './common/Toast'
import type { TestCase, Feature, Project, Priority, Annotation } from '../types'

function slug(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── shared popover wrapper ────────────────────────────────────────────────────

function Popover({
  children,
  onClose,
  className = '',
}: {
  children: React.ReactNode
  onClose: () => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [onClose])

  return (
    <div
      ref={ref}
      className={`absolute bottom-full mb-2 z-50 bg-[#17171F] border border-[#28283A] rounded-xl shadow-2xl shadow-black/60 animate-popover-in ${className}`}
    >
      {children}
    </div>
  )
}

// ── bar action button ──────────────────────────────────────────────────────────

function BarBtn({
  onClick,
  children,
  active,
  danger,
  title,
}: {
  onClick: () => void
  children: React.ReactNode
  active?: boolean
  danger?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-all whitespace-nowrap ${
        danger
          ? 'border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50'
          : active
          ? 'border-vsc-accent/50 text-vsc-accent bg-vsc-accent/10'
          : 'border-[#2A2A3A] text-[#9090A8] hover:text-[#DDDDF0] hover:border-[#3A3A4A] hover:bg-[#1E1E2A]'
      }`}
    >
      {children}
    </button>
  )
}

// ── annotation toggle state ────────────────────────────────────────────────────

function annotationState(tcs: TestCase[], a: Annotation): 'all' | 'some' | 'none' {
  const withIt = tcs.filter((tc) => tc.annotations.includes(a)).length
  if (withIt === tcs.length) return 'all'
  if (withIt > 0) return 'some'
  return 'none'
}

// ── run selected popover ──────────────────────────────────────────────────────

function RunPopover({
  selectedTcs,
  features,
  project,
  onClose,
}: {
  selectedTcs: TestCase[]
  features: Feature[]
  project: Project
  onClose: () => void
}) {
  const [headed, setHeaded] = useState(false)
  const [debug, setDebug] = useState(false)
  const [browser, setBrowser] = useState('')
  const [copied, setCopied] = useState(false)
  const ext = project.language === 'typescript' ? 'ts' : 'js'
  const featureMap = new Map(features.map((f) => [f.id, f]))

  const paths = selectedTcs.map((tc) => {
    const f = featureMap.get(tc.featureId)
    return f ? `tests/${slug(f.name)}/${slug(tc.name)}.spec.${ext}` : ''
  }).filter(Boolean)

  const parts = ['npx playwright test', ...paths]
  if (headed) parts.push('--headed')
  if (debug) parts.push('--debug')
  if (browser) parts.push(`--project=${browser}`)
  const cmd = parts.join(' ')

  const handleCopy = () => {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <Popover onClose={onClose} className="right-0 w-[520px] p-4">
      <p className="text-[10px] font-semibold text-[#6060A0] uppercase tracking-widest mb-3">
        Run {selectedTcs.length} selected test{selectedTcs.length !== 1 ? 's' : ''}
      </p>

      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={headed} onChange={(e) => setHeaded(e.target.checked)} className="accent-vsc-accent w-3.5 h-3.5" />
          <span className="text-xs text-[#9090A8] hover:text-[#DDDDF0] transition-colors">--headed</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} className="accent-vsc-accent w-3.5 h-3.5" />
          <span className="text-xs text-[#9090A8] hover:text-[#DDDDF0] transition-colors">--debug</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#6060A0] uppercase tracking-wide">Browser</span>
          <select
            value={browser}
            onChange={(e) => setBrowser(e.target.value)}
            className="bg-[#1A1A26] border border-[#28283A] text-[#DDDDF0] text-xs px-2 py-1 rounded outline-none focus:border-vsc-accent/50"
          >
            <option value="">all</option>
            <option value="chromium">chromium</option>
            <option value="firefox">firefox</option>
            <option value="webkit">webkit</option>
          </select>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-[#0D0D12] border border-[#28283A] rounded-lg p-3">
        <code className="flex-1 text-[11px] text-vsc-accent font-mono break-all leading-relaxed">
          {cmd}
        </code>
        <button
          onClick={handleCopy}
          className={`shrink-0 text-xs px-2 py-1 rounded border transition-all ${
            copied
              ? 'border-green-500/40 text-green-400 bg-green-500/10'
              : 'border-[#28283A] text-[#6060A0] hover:text-[#DDDDF0] hover:border-[#3A3A4A]'
          }`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      <div className="mt-2.5 max-h-28 overflow-y-auto space-y-0.5">
        {paths.map((p, i) => (
          <p key={i} className="text-[10px] text-[#5050A0] font-mono">{p}</p>
        ))}
      </div>
    </Popover>
  )
}

// ── delete confirmation modal ──────────────────────────────────────────────────

function DeleteModal({
  selectedTcs,
  features,
  onConfirm,
  onClose,
}: {
  selectedTcs: TestCase[]
  features: Feature[]
  onConfirm: () => void
  onClose: () => void
}) {
  const [confirmText, setConfirmText] = useState('')
  const requiresTyping = selectedTcs.length > 5
  const canConfirm = !requiresTyping || confirmText.trim().toLowerCase() === 'delete'

  const grouped = features
    .map((f) => ({ f, tcs: selectedTcs.filter((tc) => tc.featureId === f.id) }))
    .filter((g) => g.tcs.length > 0)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md bg-[#12121A] border border-[#28283A] rounded-2xl shadow-2xl shadow-black/60 p-6 animate-slide-down" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-red-400">
              <path d="M2 4h10M5 4V2.5h4V4M6 7v4M8 7v4M3 4l.5 7.5h7L11 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#EEEEF0]">Delete {selectedTcs.length} test case{selectedTcs.length !== 1 ? 's' : ''}</h2>
            <p className="text-xs text-[#6060A0] mt-0.5">This cannot be undone.</p>
          </div>
        </div>

        <div className="mb-4 max-h-44 overflow-y-auto bg-[#0D0D12] border border-[#28283A] rounded-lg p-3 space-y-3">
          {grouped.map(({ f, tcs }) => (
            <div key={f.id}>
              <p className="text-[10px] font-semibold text-[#6060A0] uppercase tracking-widest mb-1.5">{f.name}</p>
              {tcs.map((tc) => (
                <div key={tc.id} className="flex items-center gap-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/60 shrink-0" />
                  <span className="text-xs text-[#AAAACC]">{tc.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {requiresTyping && (
          <div className="mb-4">
            <p className="text-xs text-[#8888A0] mb-2">
              Type <span className="font-mono font-bold text-red-400">delete</span> to confirm:
            </p>
            <input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="delete"
              className="w-full bg-[#1A1A26] border border-[#28283A] text-[#EEEEF0] text-sm rounded-lg px-3 py-2 outline-none focus:border-red-500/50 font-mono placeholder-[#3A3A5A]"
              onKeyDown={(e) => { if (e.key === 'Enter' && canConfirm) onConfirm() }}
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[#6060A0] hover:text-[#DDDDF0] rounded-lg border border-[#28283A] hover:border-[#3A3A4A] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500/80 hover:bg-red-500 rounded-lg border border-red-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Delete {selectedTcs.length} test case{selectedTcs.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main BulkTcBar component ──────────────────────────────────────────────────

interface Props {
  selectedTcs: TestCase[]
  features: Feature[]
  allTestCases: TestCase[]
  project: Project
  onClear: () => void
  onExit: () => void
  triggerDelete: boolean
  triggerDuplicate: boolean
  onTriggerHandled: () => void
}

export function BulkTcBar({
  selectedTcs,
  features,
  project,
  onClear,
  onExit,
  triggerDelete,
  triggerDuplicate,
  onTriggerHandled,
}: Props) {
  const { dispatch, navigate } = useApp()
  const { toast } = useToast()

  const [showDelete, setShowDelete] = useState(false)
  const [showMove, setShowMove] = useState(false)
  const [showCopy, setShowCopy] = useState(false)
  const [showPriority, setShowPriority] = useState(false)
  const [showAddTags, setShowAddTags] = useState(false)
  const [showRun, setShowRun] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showRemoveTags, setShowRemoveTags] = useState(false)
  const [addTagInput, setAddTagInput] = useState('')

  // Keyboard trigger effects
  useEffect(() => {
    if (triggerDelete) { setShowDelete(true); onTriggerHandled() }
  }, [triggerDelete, onTriggerHandled])

  useEffect(() => {
    if (triggerDuplicate) { handleDuplicate(); onTriggerHandled() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerDuplicate])

  const closeAll = useCallback(() => {
    setShowMove(false); setShowCopy(false); setShowPriority(false)
    setShowAddTags(false); setShowRun(false); setShowMore(false); setShowRemoveTags(false)
  }, [])

  // ── action handlers ────────────────────────────────────────────────────────

  const handleDelete = () => {
    const ids = selectedTcs.map((tc) => tc.id)
    dispatch({ type: 'BULK_DELETE_TC', tcIds: ids })
    toast(`Deleted ${selectedTcs.length} test case${selectedTcs.length !== 1 ? 's' : ''}`)
    setShowDelete(false)
    onExit()
  }

  const handleMove = (targetFeatureId: string) => {
    const targetFeature = features.find((f) => f.id === targetFeatureId)
    dispatch({ type: 'BULK_MOVE_TC', tcIds: selectedTcs.map((tc) => tc.id), targetFeatureId })
    toast(`Moved ${selectedTcs.length} TC${selectedTcs.length !== 1 ? 's' : ''} to "${targetFeature?.name}"`)
    setShowMove(false); onClear()
  }

  const handleCopyTo = (targetFeatureId: string) => {
    const targetFeature = features.find((f) => f.id === targetFeatureId)
    const copies = selectedTcs.map((tc) => ({
      ...tc,
      id: crypto.randomUUID(),
      featureId: targetFeatureId,
      name: `${tc.name} (copy)`,
      steps: tc.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
      apiSteps: tc.apiSteps?.map((s) => ({ ...s, id: crypto.randomUUID() })),
    }))
    dispatch({ type: 'BULK_COPY_TC', copies })
    toast(`Copied ${selectedTcs.length} TC${selectedTcs.length !== 1 ? 's' : ''} to "${targetFeature?.name}"`)
    setShowCopy(false); onClear()
  }

  const handleDuplicate = () => {
    const copies = selectedTcs.map((tc) => ({
      ...tc,
      id: crypto.randomUUID(),
      name: `${tc.name} (copy)`,
      steps: tc.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
      apiSteps: tc.apiSteps?.map((s) => ({ ...s, id: crypto.randomUUID() })),
    }))
    dispatch({ type: 'BULK_DUPLICATE_TC', copies })
    toast(`Duplicated ${selectedTcs.length} test case${selectedTcs.length !== 1 ? 's' : ''}`)
    onClear()
  }

  const handleSetPriority = (priority: Priority) => {
    selectedTcs.forEach((tc) => dispatch({ type: 'UPDATE_TC', tc: { ...tc, priority } }))
    toast(`Set priority to ${priority} on ${selectedTcs.length} TC${selectedTcs.length !== 1 ? 's' : ''}`)
    setShowPriority(false); closeAll()
  }

  const handleAddTags = (tagStr: string) => {
    const newTags = tagStr.split(',').map((t) => t.trim()).filter(Boolean)
    if (!newTags.length) return
    selectedTcs.forEach((tc) => {
      const merged = [...new Set([...tc.tags, ...newTags])]
      dispatch({ type: 'UPDATE_TC', tc: { ...tc, tags: merged } })
    })
    toast(`Added ${newTags.length} tag${newTags.length !== 1 ? 's' : ''} to ${selectedTcs.length} TC${selectedTcs.length !== 1 ? 's' : ''}`)
    setAddTagInput(''); setShowAddTags(false)
  }

  const handleRemoveTag = (tag: string) => {
    selectedTcs.forEach((tc) => {
      if (tc.tags.includes(tag)) dispatch({ type: 'UPDATE_TC', tc: { ...tc, tags: tc.tags.filter((t) => t !== tag) } })
    })
    toast(`Removed tag "${tag}" from selected TCs`)
  }

  const handleToggleAnnotation = (a: Annotation) => {
    const state = annotationState(selectedTcs, a)
    selectedTcs.forEach((tc) => {
      const has = tc.annotations.includes(a)
      let next: Annotation[]
      if (state === 'all') next = tc.annotations.filter((x) => x !== a)
      else next = has ? tc.annotations : [...tc.annotations, a]
      dispatch({ type: 'UPDATE_TC', tc: { ...tc, annotations: next } })
    })
  }

  const handleDisableToggle = () => {
    const allDisabled = selectedTcs.every((tc) => tc.disabled)
    const nextDisabled = !allDisabled
    selectedTcs.forEach((tc) => dispatch({ type: 'UPDATE_TC', tc: { ...tc, disabled: nextDisabled } }))
    toast(`${nextDisabled ? 'Disabled' : 'Enabled'} ${selectedTcs.length} test case${selectedTcs.length !== 1 ? 's' : ''}`)
  }

  const handleChangeType = (newType: 'ui' | 'api') => {
    selectedTcs.forEach((tc) => {
      const cur = tc.type ?? 'ui'
      if (cur !== newType) dispatch({ type: 'UPDATE_TC', tc: { ...tc, type: newType, steps: newType === 'api' ? tc.steps : tc.steps, apiSteps: newType === 'ui' ? tc.apiSteps : [] } })
    })
    toast(`Changed ${selectedTcs.length} TC${selectedTcs.length !== 1 ? 's' : ''} to ${newType.toUpperCase()} type`)
    setShowMore(false)
  }

  const handleSetAuthRole = (authRoleId: string) => {
    selectedTcs.forEach((tc) => dispatch({ type: 'UPDATE_TC', tc: { ...tc, authRoleId } }))
    toast(`Set auth role on ${selectedTcs.length} TC${selectedTcs.length !== 1 ? 's' : ''}`)
    setShowMore(false)
  }

  // ── Computed states ───────────────────────────────────────────────────────

  const skipSt = annotationState(selectedTcs, 'skip')
  const fixmeSt = annotationState(selectedTcs, 'fixme')
  const slowSt = annotationState(selectedTcs, 'slow')
  const allDisabled = selectedTcs.every((tc) => tc.disabled)

  const allTags = [...new Set(selectedTcs.flatMap((tc) => tc.tags))].sort()
  const hasAuth = (project.auth?.enabled && (project.auth.roles?.length ?? 0) > 0)

  return (
    <>
      {/* Floating bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-bulk-bar-in">
        <div className="border-t border-[#28283A] bg-[#0F0F16]/95 backdrop-blur-md shadow-2xl shadow-black/60">
          <div className="px-5 py-3 flex items-center gap-3">

            {/* Left: count + clear */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={onExit}
                className="w-6 h-6 flex items-center justify-center rounded-md text-[#5050A0] hover:text-[#DDDDF0] hover:bg-[#1E1E2A] transition-all"
                title="Exit selection mode (Esc)"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
              <span className="text-sm font-semibold text-[#DDDDF0] tabular-nums">
                {selectedTcs.length}
              </span>
              <span className="text-sm text-[#6060A0]">
                test case{selectedTcs.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={onClear}
                className="text-[10px] text-[#4040A0] hover:text-[#9090A8] transition-colors ml-1 underline underline-offset-2"
              >
                Clear
              </button>
            </div>

            <div className="h-4 w-px bg-[#28283A] mx-1 shrink-0" />

            {/* Action buttons — scrollable */}
            <div className="flex items-center gap-1.5 flex-1 overflow-x-auto scrollbar-thin">

              {/* DELETE */}
              <div className="relative shrink-0">
                <BarBtn danger onClick={() => { closeAll(); setShowDelete(true) }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1.5 3h8M4 3V1.5h3V3M4.5 5.5v3M6.5 5.5v3M2.5 3l.4 6h5.2l.4-6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Delete
                </BarBtn>
              </div>

              <div className="h-4 w-px bg-[#28283A] mx-0.5 shrink-0" />

              {/* DUPLICATE */}
              <div className="shrink-0">
                <BarBtn onClick={handleDuplicate} title="Duplicate in place (Ctrl+D)">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="1" y="3" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4 3V1.5h5.5V8H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Duplicate
                </BarBtn>
              </div>

              {/* MOVE TO */}
              <div className="relative shrink-0">
                <BarBtn active={showMove} onClick={() => { closeAll(); setShowMove(true) }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 5.5h7M6 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Move to
                </BarBtn>
                {showMove && (
                  <Popover onClose={() => setShowMove(false)} className="left-0 min-w-[200px] py-1">
                    <p className="px-3 py-2 text-[10px] font-semibold text-[#5050A0] uppercase tracking-widest border-b border-[#28283A]">Move to feature</p>
                    {features.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleMove(f.id)}
                        className="w-full text-left px-3 py-2 text-sm text-[#9090A8] hover:text-[#DDDDF0] hover:bg-[#1E1E2A] transition-colors"
                      >
                        {f.name}
                      </button>
                    ))}
                  </Popover>
                )}
              </div>

              {/* COPY TO */}
              <div className="relative shrink-0">
                <BarBtn active={showCopy} onClick={() => { closeAll(); setShowCopy(true) }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="1" y="3" width="6" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M4 3V1.5h5.5V8H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 6.5h3M5.5 5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Copy to
                </BarBtn>
                {showCopy && (
                  <Popover onClose={() => setShowCopy(false)} className="left-0 min-w-[200px] py-1">
                    <p className="px-3 py-2 text-[10px] font-semibold text-[#5050A0] uppercase tracking-widest border-b border-[#28283A]">Copy to feature</p>
                    {features.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleCopyTo(f.id)}
                        className="w-full text-left px-3 py-2 text-sm text-[#9090A8] hover:text-[#DDDDF0] hover:bg-[#1E1E2A] transition-colors"
                      >
                        {f.name}
                      </button>
                    ))}
                  </Popover>
                )}
              </div>

              <div className="h-4 w-px bg-[#28283A] mx-0.5 shrink-0" />

              {/* PRIORITY */}
              <div className="relative shrink-0">
                <BarBtn active={showPriority} onClick={() => { closeAll(); setShowPriority(true) }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 3h7M2 5.5h5M2 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Priority
                </BarBtn>
                {showPriority && (
                  <Popover onClose={() => setShowPriority(false)} className="left-0 py-1 min-w-[120px]">
                    {(['P0', 'P1', 'P2', 'P3'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => handleSetPriority(p)}
                        className="w-full text-left px-3 py-2 text-sm text-[#9090A8] hover:text-[#DDDDF0] hover:bg-[#1E1E2A] transition-colors font-medium"
                      >
                        {p}
                      </button>
                    ))}
                  </Popover>
                )}
              </div>

              {/* ADD TAGS */}
              <div className="relative shrink-0">
                <BarBtn active={showAddTags} onClick={() => { closeAll(); setShowAddTags(true) }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1.5 9L6 1.5h.5l4 7.5H1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                    <path d="M5.5 4.5v3M5.5 8.5v.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  + Tags
                </BarBtn>
                {showAddTags && (
                  <Popover onClose={() => setShowAddTags(false)} className="left-0 p-3 w-[240px]">
                    <p className="text-[10px] font-semibold text-[#5050A0] uppercase tracking-widest mb-2">Add tags to all selected</p>
                    <input
                      autoFocus
                      value={addTagInput}
                      onChange={(e) => setAddTagInput(e.target.value)}
                      placeholder="@smoke, @regression…"
                      className="w-full bg-[#1A1A26] border border-[#28283A] text-[#DDDDF0] text-xs px-2.5 py-2 rounded-lg outline-none focus:border-vsc-accent/50 placeholder-[#3A3A5A] mb-2"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddTags(addTagInput) }}
                    />
                    <button
                      onClick={() => handleAddTags(addTagInput)}
                      disabled={!addTagInput.trim()}
                      className="w-full py-1.5 text-xs font-medium bg-vsc-accent/80 hover:bg-vsc-accent text-white rounded-lg disabled:opacity-30 transition-all"
                    >
                      Apply
                    </button>
                  </Popover>
                )}
              </div>

              <div className="h-4 w-px bg-[#28283A] mx-0.5 shrink-0" />

              {/* ANNOTATION TOGGLES */}
              {(['skip', 'fixme', 'slow'] as Annotation[]).map((a) => {
                const st = a === 'skip' ? skipSt : a === 'fixme' ? fixmeSt : slowSt
                return (
                  <button
                    key={a}
                    onClick={() => handleToggleAnnotation(a)}
                    title={st === 'all' ? `Remove ${a} from all` : `Add ${a} to all`}
                    className={`shrink-0 inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition-all ${
                      st === 'all'
                        ? 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10'
                        : st === 'some'
                        ? 'border-yellow-500/20 text-yellow-500/60 bg-yellow-500/5'
                        : 'border-[#2A2A3A] text-[#6060A0] hover:text-yellow-400/80 hover:border-yellow-500/20'
                    }`}
                  >
                    {a}
                    {st === 'some' && <span className="text-[9px] opacity-70">~</span>}
                  </button>
                )
              })}

              <div className="h-4 w-px bg-[#28283A] mx-0.5 shrink-0" />

              {/* DISABLE TOGGLE */}
              <div className="shrink-0">
                <BarBtn
                  active={allDisabled}
                  onClick={handleDisableToggle}
                  title={allDisabled ? 'Re-enable selected TCs' : 'Disable selected TCs (excluded from generation)'}
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                    {allDisabled
                      ? <path d="M3.5 5.5l1.5 1.5 2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      : <path d="M3 3l5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    }
                  </svg>
                  {allDisabled ? 'Enable' : 'Disable'}
                </BarBtn>
              </div>

              <div className="h-4 w-px bg-[#28283A] mx-0.5 shrink-0" />

              {/* RUN SELECTED */}
              <div className="relative shrink-0">
                <BarBtn active={showRun} onClick={() => { closeAll(); setShowRun(true) }}>
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M2 1.5l8 4-8 4V1.5z" fill="currentColor" fillOpacity="0.7"/>
                  </svg>
                  Run
                </BarBtn>
                {showRun && (
                  <RunPopover
                    selectedTcs={selectedTcs}
                    features={features}
                    project={project}
                    onClose={() => setShowRun(false)}
                  />
                )}
              </div>

              {/* MORE */}
              <div className="relative shrink-0">
                <BarBtn active={showMore} onClick={() => { closeAll(); setShowMore(true) }}>
                  More
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 3L4.5 6.5 7.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </BarBtn>
                {showMore && (
                  <Popover onClose={() => setShowMore(false)} className="right-0 py-1 min-w-[180px]">
                    {/* Remove tags */}
                    <div>
                      <p className="px-3 py-1.5 text-[10px] font-semibold text-[#5050A0] uppercase tracking-widest border-b border-[#28283A]">Remove tags</p>
                      {allTags.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-[#5050A0] italic">No tags on selected TCs</p>
                      ) : (
                        <div className="px-2 py-2 flex flex-wrap gap-1.5 max-w-[240px]">
                          {allTags.map((tag) => (
                            <button
                              key={tag}
                              onClick={() => handleRemoveTag(tag)}
                              className="inline-flex items-center gap-1 text-xs bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded-full hover:bg-red-500/20 transition-colors"
                            >
                              {tag} ×
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Change type */}
                    <div className="border-t border-[#28283A]">
                      <p className="px-3 py-1.5 text-[10px] font-semibold text-[#5050A0] uppercase tracking-widest">Change type</p>
                      <div className="px-2 pb-2 flex gap-1.5">
                        {(['ui', 'api'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => handleChangeType(t)}
                            className="flex-1 py-1.5 text-xs font-semibold rounded-md border border-[#2A2A3A] text-[#7070A0] hover:text-[#DDDDF0] hover:bg-[#1E1E2A] transition-all"
                          >
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Auth role (if project has auth) */}
                    {hasAuth && (
                      <div className="border-t border-[#28283A]">
                        <p className="px-3 py-1.5 text-[10px] font-semibold text-[#5050A0] uppercase tracking-widest">Auth role</p>
                        {project.auth!.roles.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => handleSetAuthRole(r.id)}
                            className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-sm text-[#9090A8] hover:text-[#DDDDF0] hover:bg-[#1E1E2A] transition-colors"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                            {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </Popover>
                )}
              </div>
            </div>

            {/* Navigate to first selected */}
            <button
              onClick={() => {
                const first = selectedTcs[0]
                if (first) navigate({ type: 'test-case', projectId: project.id, featureId: first.featureId, testCaseId: first.id })
              }}
              className="shrink-0 text-xs text-[#4040A0] hover:text-vsc-accent transition-colors ml-1"
              title="Open first selected TC"
            >
              Open →
            </button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {showDelete && (
        <DeleteModal
          selectedTcs={selectedTcs}
          features={features}
          onConfirm={handleDelete}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  )
}
