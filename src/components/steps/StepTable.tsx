import { useCallback, useState, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { TestStep, SelectorStrategy, ActionType, AssertionType, ReusableUtil, Feature, TestCase } from '../../types'
import {
  ACTION_LABELS,
  ACTION_GROUPS,
  VISUAL_ACTIONS,
  ASSERTION_LABELS,
  STRATEGY_LABELS,
} from '../../types'
import { Btn } from '../common/Btn'
import { Modal } from '../common/Modal'
import { InsertTemplateModal, SaveTemplateModal } from '../StepTemplateModal'

// ── shared styles ─────────────────────────────────────────────────────────────

const cellInput =
  'bg-transparent border border-vsc-border/70 rounded px-2 py-1.5 text-xs text-vsc-text placeholder-vsc-dim focus:border-vsc-accent focus:ring-1 focus:ring-vsc-accent/20 outline-none transition-all w-full font-mono'

const pillSelect =
  'bg-vsc-active border border-vsc-border/70 rounded px-2 py-1.5 text-xs text-vsc-muted cursor-pointer outline-none transition-all hover:border-vsc-accent/40 hover:text-vsc-text focus:border-vsc-accent w-full'

// ── BulkContext ───────────────────────────────────────────────────────────────

export interface BulkContext {
  allFeatures: Feature[]
  allTestCases: TestCase[]
  currentTcId: string
  projectId: string
  activeEnvironmentId?: string | null
  onAddStepsToTc: (targetTcId: string, steps: TestStep[]) => void
  onCreateUtil: (util: ReusableUtil) => void
}

// ── AssertionCell ─────────────────────────────────────────────────────────────

interface AssertionCellProps {
  step: TestStep
  onChange: (updated: TestStep) => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

function AssertionCell({ step, onChange, isOpen, onOpen, onClose }: AssertionCellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const u = <K extends keyof TestStep>(k: K, v: TestStep[K]) =>
    onChange({ ...step, [k]: v })

  const needsValue = !['none', 'toBeVisible', 'toBeHidden', 'toBeChecked', 'toBeDisabled', 'toBeEnabled'].includes(step.assertion)

  useEffect(() => {
    if (!isOpen) return undefined
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isOpen, onClose])

  const hasAssertion = step.assertion !== 'none'

  return (
    <div ref={containerRef} className="relative">
      {hasAssertion ? (
        <button
          onClick={(e) => { e.stopPropagation(); isOpen ? onClose() : onOpen() }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-2xs font-semibold border transition-all bg-vsc-accent/10 border-vsc-accent/30 text-vsc-accent hover:bg-vsc-accent/20 max-w-full truncate"
          title={step.assertionValue ? `${ASSERTION_LABELS[step.assertion]}: ${step.assertionValue}` : ASSERTION_LABELS[step.assertion]}
        >
          <span className="truncate max-w-[90px]">{ASSERTION_LABELS[step.assertion]}</span>
          {step.assertionValue && (
            <span className="text-vsc-accent/60 truncate max-w-[50px]">: {step.assertionValue}</span>
          )}
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); isOpen ? onClose() : onOpen() }}
          className="text-2xs text-vsc-dim hover:text-vsc-muted transition-colors px-1 py-1 rounded hover:bg-vsc-hover"
        >
          + assert
        </button>
      )}
      {isOpen && (
        <div
          className="absolute left-0 top-full mt-1.5 z-30 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl shadow-black/50 p-3 w-56 animate-popover-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-2xs font-semibold text-vsc-muted uppercase tracking-widest">Assertion</span>
            {hasAssertion && (
              <button onClick={() => { onChange({ ...step, assertion: 'none', assertionValue: '' }); onClose() }} className="text-vsc-dim hover:text-vsc-danger text-xs transition-colors">Clear</button>
            )}
          </div>
          <select value={step.assertion} onChange={(e) => u('assertion', e.target.value as AssertionType)} className={`${pillSelect} mb-2`} autoFocus>
            {Object.entries(ASSERTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {needsValue && (
            <input value={step.assertionValue} onChange={(e) => u('assertionValue', e.target.value)} placeholder="Expected value" className={cellInput} onKeyDown={(e) => e.key === 'Enter' && onClose()} />
          )}
        </div>
      )}
    </div>
  )
}

// ── WaitCell ──────────────────────────────────────────────────────────────────

interface WaitCellProps {
  step: TestStep
  onChange: (updated: TestStep) => void
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
}

function WaitCell({ step, onChange, isOpen, onOpen, onClose }: WaitCellProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const u = <K extends keyof TestStep>(k: K, v: TestStep[K]) => onChange({ ...step, [k]: v })

  useEffect(() => {
    if (!isOpen) return undefined
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [isOpen, onClose])

  const isCustom = step.waitBehavior !== 'auto'

  return (
    <div ref={containerRef} className="relative">
      {isCustom ? (
        <button onClick={(e) => { e.stopPropagation(); isOpen ? onClose() : onOpen() }} className="inline-flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium border transition-all bg-vsc-warning/10 border-vsc-warning/30 text-vsc-warning hover:bg-vsc-warning/20">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M5 2.5V5l2 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {step.waitBehavior === 'custom' ? `${step.waitMs ?? 0}ms` : step.waitBehavior}
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); isOpen ? onClose() : onOpen() }} className="text-vsc-dim/40 hover:text-vsc-dim transition-colors p-1 rounded hover:bg-vsc-hover" title="Configure wait behavior">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 3v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      )}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-30 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl shadow-black/50 p-3 w-48 animate-popover-in" onClick={(e) => e.stopPropagation()}>
          <p className="text-2xs font-semibold text-vsc-muted uppercase tracking-widest mb-2">Wait</p>
          <select value={step.waitBehavior} onChange={(e) => u('waitBehavior', e.target.value as TestStep['waitBehavior'])} className={pillSelect} autoFocus>
            <option value="auto">Auto</option>
            <option value="networkidle">Network idle</option>
            <option value="domcontentloaded">DOM ready</option>
            <option value="custom">Custom (ms)</option>
          </select>
          {step.waitBehavior === 'custom' && (
            <input type="number" value={step.waitMs ?? ''} onChange={(e) => u('waitMs', Number(e.target.value))} placeholder="1000" className={`${cellInput} mt-2`} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Inline modals ─────────────────────────────────────────────────────────────

function ConfirmDeleteModal({ count, onConfirm, onClose }: { count: number; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title="Delete steps?"
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" onClick={() => { onConfirm(); onClose() }}>Delete {count} step{count !== 1 ? 's' : ''}</Btn>
        </>
      }
    >
      <p className="text-sm text-vsc-muted leading-relaxed">
        This will permanently delete <span className="font-semibold text-vsc-text">{count}</span> selected step{count !== 1 ? 's' : ''}.
        This cannot be undone.
      </p>
    </Modal>
  )
}

function TransferModal({ allFeatures, allTestCases, currentTcId, mode, onConfirm, onClose }: {
  allFeatures: Feature[]
  allTestCases: TestCase[]
  currentTcId: string
  mode: 'move' | 'copy'
  onConfirm: (targetTcId: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selectedTcId, setSelectedTcId] = useState<string | null>(null)

  const featuresWithTCs = allFeatures
    .map((f) => ({
      feature: f,
      tcs: allTestCases.filter((tc) =>
        tc.featureId === f.id &&
        tc.id !== currentTcId &&
        (!query ||
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          tc.name.toLowerCase().includes(query.toLowerCase()))
      ),
    }))
    .filter((g) => g.tcs.length > 0)

  return (
    <Modal
      title={mode === 'move' ? 'Move steps to…' : 'Copy steps to…'}
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => selectedTcId && onConfirm(selectedTcId)} disabled={!selectedTcId}>
            {mode === 'move' ? 'Move' : 'Copy'}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search features or test cases…"
          className="w-full bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm focus:border-vsc-accent focus:ring-2 focus:ring-vsc-accent/15 outline-none transition-all"
        />
        <div className="max-h-72 overflow-y-auto flex flex-col gap-2 pr-1">
          {featuresWithTCs.length === 0 ? (
            <p className="text-sm text-vsc-dim text-center py-6">No matching test cases found</p>
          ) : (
            featuresWithTCs.map(({ feature, tcs }) => (
              <div key={feature.id}>
                <p className="text-[10px] font-bold text-vsc-dim uppercase tracking-widest px-2 py-1.5">{feature.name}</p>
                {tcs.map((tc) => (
                  <button
                    key={tc.id}
                    onClick={() => setSelectedTcId(tc.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 ${
                      selectedTcId === tc.id
                        ? 'bg-vsc-accent/15 border border-vsc-accent/40 text-vsc-text'
                        : 'hover:bg-vsc-hover text-vsc-muted hover:text-vsc-text border border-transparent'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${selectedTcId === tc.id ? 'bg-vsc-accent' : 'bg-vsc-border'}`} />
                    <span className="truncate">{tc.name}</span>
                    <span className="text-xs text-vsc-dim shrink-0 ml-auto">{tc.steps.length} step{tc.steps.length !== 1 ? 's' : ''}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

function GroupAsUtilModal({ stepCount, onConfirm, onClose }: {
  stepCount: number
  onConfirm: (name: string, params: { name: string; defaultValue: string }[]) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [params, setParams] = useState<{ name: string; defaultValue: string }[]>([])

  const addParam = () => setParams((p) => [...p, { name: '', defaultValue: '' }])
  const removeParam = (i: number) => setParams((p) => p.filter((_, idx) => idx !== i))
  const updateParam = (i: number, field: 'name' | 'defaultValue', val: string) =>
    setParams((p) => p.map((param, idx) => idx === i ? { ...param, [field]: val } : param))

  return (
    <Modal
      title="Group as reusable util"
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={() => name.trim() && onConfirm(name.trim(), params)} disabled={!name.trim()}>
            Create util
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-vsc-muted uppercase tracking-widest mb-2">
            Util name <span className="text-vsc-danger">*</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && onConfirm(name.trim(), params)}
            placeholder="e.g. loginWithCredentials"
            className="w-full bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm focus:border-vsc-accent focus:ring-2 focus:ring-vsc-accent/15 outline-none transition-all"
          />
          <p className="text-xs text-vsc-dim mt-1.5">
            {stepCount} step{stepCount !== 1 ? 's' : ''} will be grouped into this util
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-vsc-muted uppercase tracking-widest">Parameters</label>
            <button
              onClick={addParam}
              className="text-xs text-vsc-accent hover:text-vsc-accent/80 transition-colors font-medium flex items-center gap-1"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Add parameter
            </button>
          </div>
          {params.length === 0 ? (
            <p className="text-xs text-vsc-dim italic">No parameters — add some to make this util reusable with variable inputs</p>
          ) : (
            <div className="flex flex-col gap-2">
              {params.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={p.name} onChange={(e) => updateParam(i, 'name', e.target.value)} placeholder="paramName" className={`${cellInput} flex-1`} />
                  <input value={p.defaultValue} onChange={(e) => updateParam(i, 'defaultValue', e.target.value)} placeholder="default (optional)" className={`${cellInput} flex-1`} />
                  <button onClick={() => removeParam(i)} className="w-6 h-6 flex items-center justify-center text-vsc-dim hover:text-vsc-danger transition-colors text-lg leading-none shrink-0">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ── StepBulkBar ───────────────────────────────────────────────────────────────

interface BulkBarProps {
  count: number
  sorted: TestStep[]
  selectedIds: Set<string>
  bulkContext?: BulkContext
  onDeselect: () => void
  onDelete: () => void
  onDuplicate: () => void
  onBulkChangeAction: (action: ActionType) => void
  onBulkChangeStrategy: (strategy: SelectorStrategy) => void
  onMove: (targetTcId: string) => void
  onCopy: (targetTcId: string) => void
  onGroupAsUtil: (name: string, params: { name: string; defaultValue: string }[]) => void
}

function StepBulkBar({
  count, sorted, selectedIds, bulkContext,
  onDeselect, onDelete, onDuplicate,
  onBulkChangeAction, onBulkChangeStrategy,
  onMove, onCopy, onGroupAsUtil,
}: BulkBarProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showTransfer, setShowTransfer] = useState<'move' | 'copy' | null>(null)
  const [showGroupUtil, setShowGroupUtil] = useState(false)
  const [actionDropOpen, setActionDropOpen] = useState(false)
  const [stratDropOpen, setStratDropOpen] = useState(false)
  const actionDropRef = useRef<HTMLDivElement>(null)
  const stratDropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!actionDropOpen) return undefined
    const h = (e: MouseEvent) => { if (actionDropRef.current && !actionDropRef.current.contains(e.target as Node)) setActionDropOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [actionDropOpen])

  useEffect(() => {
    if (!stratDropOpen) return undefined
    const h = (e: MouseEvent) => { if (stratDropRef.current && !stratDropRef.current.contains(e.target as Node)) setStratDropOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [stratDropOpen])

  const hasContext = !!bulkContext
  const hasTCTargets = hasContext && bulkContext!.allTestCases.some(
    (tc) => tc.id !== bulkContext!.currentTcId && bulkContext!.allFeatures.some((f) => f.id === tc.featureId)
  )

  const barBtn = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-all'
  const barBtnNormal = `${barBtn} border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20`
  const barBtnDanger = `${barBtn} border-red-400/30 text-red-300 hover:text-red-200 hover:bg-red-500/15 hover:border-red-400/50`

  return (
    <div className="animate-bulk-bar-in sticky bottom-0 z-20 mt-2">
      <div className="flex items-center justify-between gap-3 bg-[#1C1C2E] border border-vsc-accent/30 rounded-xl px-4 py-3 shadow-2xl shadow-black/60 ring-1 ring-vsc-accent/10">
        {/* Left: count + deselect */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex items-center gap-2 bg-vsc-accent/15 border border-vsc-accent/30 rounded-lg px-2.5 py-1">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-vsc-accent">
              <rect x="1" y="1" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M3.5 6l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-bold text-vsc-accent tabular-nums">{count}</span>
            <span className="text-xs text-vsc-accent/60">selected</span>
          </div>
          <button
            onClick={onDeselect}
            className="w-5 h-5 flex items-center justify-center rounded text-white/40 hover:text-white hover:bg-white/10 transition-all text-base leading-none"
            title="Deselect all (Esc)"
          >
            ×
          </button>
        </div>

        {/* Right: action buttons */}
        <div className="flex items-center gap-1.5 flex-wrap justify-end">

          {/* Duplicate */}
          <button onClick={onDuplicate} className={barBtnNormal} title="Duplicate selected steps">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="1" y="3.5" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 3.5V1.5h6v6H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            Duplicate
          </button>

          {/* Move to… */}
          {hasContext && hasTCTargets && (
            <button onClick={() => setShowTransfer('move')} className={barBtnNormal}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 5.5h8M6.5 2.5l3 3-3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Move to…
            </button>
          )}

          {/* Copy to… */}
          {hasContext && hasTCTargets && (
            <button onClick={() => setShowTransfer('copy')} className={barBtnNormal}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="3.5" y="3.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/><path d="M1 7V1h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M7 3.5l2.5 3-2.5 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Copy to…
            </button>
          )}

          {/* Group as Util */}
          {hasContext && (
            <button onClick={() => setShowGroupUtil(true)} className={barBtnNormal}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 3.5h9M1 7.5h9M4 1v9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              Group as Util
            </button>
          )}

          {/* Separator */}
          <div className="w-px h-5 bg-white/10 mx-0.5" />

          {/* Change Action */}
          <div ref={actionDropRef} className="relative">
            <button
              onClick={() => { setActionDropOpen(v => !v); setStratDropOpen(false) }}
              className={`${barBtnNormal} gap-1`}
            >
              Action
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 3L4 5.5 6.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {actionDropOpen && (
              <div className="absolute bottom-full mb-2 right-0 z-40 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl shadow-black/50 py-1 w-44 animate-popover-in max-h-64 overflow-y-auto">
                {ACTION_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="px-3 py-1.5 text-[9px] font-bold text-vsc-dim uppercase tracking-widest">{group.label}</div>
                    {group.actions.map((a) => (
                      <button
                        key={a}
                        onClick={() => { onBulkChangeAction(a); setActionDropOpen(false) }}
                        className="w-full text-left px-3 py-2 text-xs text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors"
                      >
                        {ACTION_LABELS[a]}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Change Strategy */}
          <div ref={stratDropRef} className="relative">
            <button
              onClick={() => { setStratDropOpen(v => !v); setActionDropOpen(false) }}
              className={`${barBtnNormal} gap-1`}
            >
              Strategy
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 3L4 5.5 6.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {stratDropOpen && (
              <div className="absolute bottom-full mb-2 right-0 z-40 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl shadow-black/50 py-1 w-36 animate-popover-in">
                {Object.entries(STRATEGY_LABELS).map(([v, l]) => (
                  <button
                    key={v}
                    onClick={() => { onBulkChangeStrategy(v as SelectorStrategy); setStratDropOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-colors"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="w-px h-5 bg-white/10 mx-0.5" />

          {/* Delete */}
          <button onClick={() => setShowDeleteConfirm(true)} className={barBtnDanger}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 2.5h9M4 2.5V1h3v1.5M8.5 2.5l-.5 7h-5l-.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Delete
          </button>
        </div>
      </div>

      {/* Modals */}
      {showDeleteConfirm && (
        <ConfirmDeleteModal
          count={count}
          onConfirm={onDelete}
          onClose={() => setShowDeleteConfirm(false)}
        />
      )}

      {showTransfer && bulkContext && (
        <TransferModal
          allFeatures={bulkContext.allFeatures}
          allTestCases={bulkContext.allTestCases}
          currentTcId={bulkContext.currentTcId}
          mode={showTransfer}
          onConfirm={(targetTcId) => {
            if (showTransfer === 'move') onMove(targetTcId)
            else onCopy(targetTcId)
            setShowTransfer(null)
          }}
          onClose={() => setShowTransfer(null)}
        />
      )}

      {showGroupUtil && (
        <GroupAsUtilModal
          stepCount={count}
          onConfirm={(name, params) => { onGroupAsUtil(name, params); setShowGroupUtil(false) }}
          onClose={() => setShowGroupUtil(false)}
        />
      )}
    </div>
  )
}

// ── SortableRow ───────────────────────────────────────────────────────────────

interface RowProps {
  step: TestStep
  index: number
  variables: string[]
  utils: ReusableUtil[]
  onChange: (updated: TestStep) => void
  onDelete: () => void
  onDuplicate: () => void
  assertionOpen: boolean
  waitOpen: boolean
  onAssertionOpen: () => void
  onAssertionClose: () => void
  onWaitOpen: () => void
  onWaitClose: () => void
  isSelected: boolean
  onCheck: (e: React.MouseEvent) => void
}

function SortableRow({
  step, index, variables, utils, onChange, onDelete, onDuplicate,
  assertionOpen, waitOpen, onAssertionOpen, onAssertionClose, onWaitOpen, onWaitClose,
  isSelected, onCheck,
}: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id })

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const u = <K extends keyof TestStep>(k: K, v: TestStep[K]) => onChange({ ...step, [k]: v })

  const isVisual = VISUAL_ACTIONS.includes(step.action)
  const visualNeedsSelector = step.action === 'screenshot.element'
  const visualNeedsClip = step.action === 'screenshot.clip'
  const needsSelector = !isVisual && !['navigate', 'wait', 'screenshot'].includes(step.action)
  const needsValue = !isVisual && ['fill', 'navigate', 'select', 'press', 'wait', 'screenshot'].includes(step.action)
  const showVarHint = variables.length > 0
  const visualLabelCls = 'text-2xs font-semibold uppercase tracking-wider text-purple-400/60 mb-0.5 leading-none'

  const handleActionChange = (val: string) => {
    const next = val as ActionType
    const isNextVisual = VISUAL_ACTIONS.includes(next)
    const updates: Partial<TestStep> = { action: next }
    if (isNextVisual) {
      if (!step.value) updates.value = `screenshot-${index + 1}.png`
      if (step.maxDiffThreshold === undefined) updates.maxDiffThreshold = 0.2
      if (step.disableAnimations === undefined) updates.disableAnimations = true
      updates.assertion = 'none'
    }
    onChange({ ...step, ...updates })
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group/row border-b border-vsc-border/50 transition-colors ${
        isDragging
          ? 'bg-vsc-active'
          : isSelected
          ? 'bg-vsc-accent/8 hover:bg-vsc-accent/12'
          : isVisual
          ? 'bg-purple-950/10 hover:bg-purple-950/20'
          : 'hover:bg-vsc-hover/40'
      }`}
    >
      {/* checkbox */}
      <td className="pl-3 pr-1 py-3 w-8" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onCheck}
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
            isSelected
              ? 'border-vsc-accent bg-vsc-accent'
              : 'border-vsc-border/60 hover:border-vsc-accent/60 bg-transparent'
          }`}
          aria-label={isSelected ? 'Deselect step' : 'Select step'}
        >
          {isSelected && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 4l2.5 2.5L7 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </td>

      {/* drag handle */}
      <td className="pl-1 pr-1 py-3 w-8">
        <span
          {...attributes}
          {...listeners}
          className="text-vsc-dim/40 hover:text-vsc-dim cursor-grab active:cursor-grabbing text-xs select-none block transition-colors"
          title="Drag to reorder"
          aria-label="Drag to reorder step"
        >
          ⠿
        </span>
      </td>

      {/* selector strategy */}
      <td className="px-1 py-2 w-[72px]">
        {(needsSelector || visualNeedsSelector) && !step.utilRef ? (
          <select value={step.selectorStrategy} onChange={(e) => u('selectorStrategy', e.target.value as SelectorStrategy)} className={pillSelect} aria-label="Selector strategy">
            {Object.entries(STRATEGY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ) : (
          <span className="text-vsc-dim/40 text-xs px-1">—</span>
        )}
      </td>

      {/* selector */}
      <td className="px-1 py-2">
        {step.utilRef ? (
          <span className="text-xs text-vsc-accent font-mono px-1">util: {utils.find(u => u.id === step.utilRef)?.name ?? step.utilRef}</span>
        ) : isVisual ? (
          visualNeedsSelector ? (
            <input value={step.selector} onChange={(e) => u('selector', e.target.value)} placeholder="#element" className={cellInput} aria-label="Element selector" />
          ) : visualNeedsClip ? (
            <input value={step.selector} onChange={(e) => u('selector', e.target.value)} placeholder="x,y,w,h" title="Clip region in pixels" className={cellInput} aria-label="Clip region" />
          ) : (
            <span className="text-vsc-dim/40 text-xs px-1">—</span>
          )
        ) : needsSelector ? (
          <input value={step.selector} onChange={(e) => u('selector', e.target.value)} placeholder="#selector" className={cellInput} aria-label="CSS selector or locator" />
        ) : (
          <span className="text-vsc-dim/40 text-xs px-1">—</span>
        )}
      </td>

      {/* action */}
      <td className="px-1 py-2 w-[100px]">
        {step.utilRef ? (
          <span className="text-2xs text-vsc-muted px-1">call util</span>
        ) : (
          <select value={step.action} onChange={(e) => handleActionChange(e.target.value)} className={`${pillSelect} ${isVisual ? 'border-purple-500/40 text-purple-300' : ''}`} aria-label="Action type">
            {ACTION_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.actions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
              </optgroup>
            ))}
          </select>
        )}
      </td>

      {/* value */}
      <td className="px-1 py-2 w-[140px]">
        {isVisual ? (
          <div>
            <div className={visualLabelCls}>Name</div>
            <input value={step.value} onChange={(e) => u('value', e.target.value)} placeholder="shot.png" className={`${cellInput} border-purple-500/30`} />
          </div>
        ) : needsValue && !step.utilRef ? (
          <div className="relative">
            <input value={step.value} onChange={(e) => u('value', e.target.value)} placeholder={step.action === 'navigate' ? 'https://…' : 'value'} className={cellInput} list={showVarHint ? `vars-${step.id}` : undefined} aria-label="Step value" />
            {showVarHint && <datalist id={`vars-${step.id}`}>{variables.map((v) => <option key={v} value={`{{${v}}}`} />)}</datalist>}
          </div>
        ) : (
          <span className="text-vsc-dim/40 text-xs px-1">—</span>
        )}
      </td>

      {/* threshold / assertion */}
      <td className="px-1 py-2 w-[100px]">
        {isVisual ? (
          <div>
            <div className={visualLabelCls}>Threshold</div>
            <div className="flex items-center gap-1">
              <input type="number" min="0" max="1" step="0.01" value={step.maxDiffThreshold ?? 0.2} onChange={(e) => u('maxDiffThreshold', parseFloat(e.target.value) || 0)} className={`${cellInput} border-purple-500/30`} />
              <span className="text-2xs text-vsc-dim shrink-0">0–1</span>
            </div>
          </div>
        ) : !step.utilRef ? (
          <AssertionCell step={step} onChange={onChange} isOpen={assertionOpen} onOpen={onAssertionOpen} onClose={onAssertionClose} />
        ) : null}
      </td>

      {/* masks / wait */}
      <td className="px-1 py-2 w-[110px]">
        {isVisual ? (
          <div>
            <div className={visualLabelCls}>Masks</div>
            <input value={step.maskSelectors ?? ''} onChange={(e) => u('maskSelectors', e.target.value)} placeholder=".date,.avatar" title="Comma-separated selectors for dynamic content" className={`${cellInput} border-purple-500/30`} />
          </div>
        ) : !step.utilRef ? (
          <WaitCell step={step} onChange={onChange} isOpen={waitOpen} onOpen={onWaitOpen} onClose={onWaitClose} />
        ) : null}
      </td>

      {/* animations / row actions */}
      <td className="px-2 py-2 w-[80px]">
        {isVisual ? (
          <div>
            <div className={visualLabelCls}>Anim.</div>
            <button
              onClick={() => u('disableAnimations', !(step.disableAnimations ?? true))}
              className={`w-full rounded px-1.5 py-1 text-2xs font-semibold border transition-colors ${(step.disableAnimations ?? true) ? 'bg-purple-500/20 border-purple-500/40 text-purple-300' : 'bg-transparent border-vsc-border text-vsc-dim'}`}
              title="Toggle disable animations"
            >
              {(step.disableAnimations ?? true) ? 'off' : 'on'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity justify-end">
            <button onClick={onDuplicate} title="Duplicate step" aria-label="Duplicate step" className="w-6 h-6 flex items-center justify-center rounded text-vsc-dim hover:text-vsc-accent hover:bg-vsc-hover transition-all text-sm">⧉</button>
            <button onClick={onDelete} title="Delete step" aria-label="Delete step" className="w-6 h-6 flex items-center justify-center rounded text-vsc-dim hover:text-vsc-danger hover:bg-vsc-danger-light transition-all text-base leading-none">×</button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ── StepTable ─────────────────────────────────────────────────────────────────

interface Props {
  steps: TestStep[]
  onChange: (steps: TestStep[]) => void
  variables?: string[]
  utils?: ReusableUtil[]
  availableUtils?: ReusableUtil[]
  projectId?: string
  bulkContext?: BulkContext
}

function makeStep(order: number): TestStep {
  return {
    id: crypto.randomUUID(),
    order,
    selector: '',
    selectorStrategy: 'css',
    action: 'click',
    value: '',
    assertion: 'none',
    assertionValue: '',
    waitBehavior: 'auto',
  }
}

export function StepTable({ steps, onChange, variables = [], utils = [], availableUtils = [], projectId, bulkContext }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [showInsertTemplate, setShowInsertTemplate] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [assertionMenuId, setAssertionMenuId] = useState<string | null>(null)
  const [waitMenuId, setWaitMenuId] = useState<string | null>(null)

  // ── Selection state ────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastClickedIdRef = useRef<string | null>(null)

  const sorted = [...steps].sort((a, b) => a.order - b.order)

  // Clear stale selection when steps change
  useEffect(() => {
    setSelectedIds((prev) => {
      const stepIds = new Set(steps.map((s) => s.id))
      const next = new Set([...prev].filter((id) => stepIds.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [steps])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement
    const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)

    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !isInput) {
      e.preventDefault()
      setSelectedIds(new Set(sorted.map((s) => s.id)))
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0 && !isInput) {
      e.preventDefault()
      // Trigger delete by simulating — will be handled by the BulkBar
      // We raise a custom event so StepBulkBar can show its confirm dialog
      containerRef.current?.dispatchEvent(new CustomEvent('bulk-delete-request', { bubbles: true }))
      return
    }
    if (e.key === 'Escape' && selectedIds.size > 0) {
      setSelectedIds(new Set())
    }
  }

  // ── Checkbox handler ───────────────────────────────────────────────────────
  const handleCheck = (stepId: string, e: React.MouseEvent) => {
    const stepIdx = sorted.findIndex((s) => s.id === stepId)

    if (e.shiftKey && lastClickedIdRef.current) {
      const lastIdx = sorted.findIndex((s) => s.id === lastClickedIdRef.current)
      if (lastIdx !== -1) {
        const [from, to] = [Math.min(lastIdx, stepIdx), Math.max(lastIdx, stepIdx)]
        const rangeIds = sorted.slice(from, to + 1).map((s) => s.id)
        setSelectedIds((prev) => {
          const next = new Set(prev)
          const allSelected = rangeIds.every((id) => next.has(id))
          if (allSelected) rangeIds.forEach((id) => next.delete(id))
          else rangeIds.forEach((id) => next.add(id))
          return next
        })
        return
      }
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(stepId)) next.delete(stepId)
      else next.add(stepId)
      return next
    })
    lastClickedIdRef.current = stepId
  }

  const handleCheckAll = () => {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(sorted.map((s) => s.id)))
  }

  // ── Drag end ───────────────────────────────────────────────────────────────
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sorted.findIndex((s) => s.id === active.id)
    const newIndex = sorted.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }))
    onChange(reordered)
  }, [sorted, onChange])

  // ── Step CRUD ──────────────────────────────────────────────────────────────
  const addStep = () => onChange([...steps, makeStep(steps.length)])

  const insertUtil = (utilId: string) => {
    const step: TestStep = {
      id: crypto.randomUUID(), order: steps.length, selector: '', selectorStrategy: 'css',
      action: 'click', value: '', assertion: 'none', assertionValue: '', waitBehavior: 'auto', utilRef: utilId,
    }
    onChange([...steps, step])
  }

  const updateStep = (id: string, updated: TestStep) => onChange(steps.map((s) => s.id === id ? updated : s))

  const deleteStep = (id: string) => {
    onChange(steps.filter((s) => s.id !== id))
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next })
  }

  const duplicateStep = (id: string) => {
    const idx = sorted.findIndex((s) => s.id === id)
    if (idx === -1) return
    const copy = { ...sorted[idx], id: crypto.randomUUID() }
    const result = [...sorted]
    result.splice(idx + 1, 0, copy)
    onChange(result.map((s, i) => ({ ...s, order: i })))
  }

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const selectedSteps = sorted.filter((s) => selectedIds.has(s.id))

  const handleBulkDelete = () => {
    onChange(steps.filter((s) => !selectedIds.has(s.id)).map((s, i) => ({ ...s, order: i })))
    setSelectedIds(new Set())
  }

  const handleBulkDuplicate = () => {
    const lastSelectedIdx = sorted.reduce((max, s, i) => selectedIds.has(s.id) ? i : max, -1)
    const copies = selectedSteps.map((s) => ({ ...s, id: crypto.randomUUID() }))
    const result = [...sorted]
    result.splice(lastSelectedIdx + 1, 0, ...copies)
    onChange(result.map((s, i) => ({ ...s, order: i })))
    setSelectedIds(new Set(copies.map((s) => s.id)))
  }

  const handleBulkChangeAction = (action: ActionType) => {
    const isVisual = VISUAL_ACTIONS.includes(action)
    onChange(steps.map((s) => {
      if (!selectedIds.has(s.id)) return s
      const updates: Partial<TestStep> = { action }
      if (isVisual) {
        updates.assertion = 'none'
        if (updates.maxDiffThreshold === undefined) updates.maxDiffThreshold = 0.2
        if (updates.disableAnimations === undefined) updates.disableAnimations = true
      }
      return { ...s, ...updates }
    }))
  }

  const handleBulkChangeStrategy = (strategy: SelectorStrategy) => {
    onChange(steps.map((s) => selectedIds.has(s.id) ? { ...s, selectorStrategy: strategy } : s))
  }

  const handleMove = (targetTcId: string) => {
    if (!bulkContext) return
    const stepsToMove = selectedSteps.map((s, i) => ({ ...s, id: crypto.randomUUID(), order: i }))
    onChange(steps.filter((s) => !selectedIds.has(s.id)).map((s, i) => ({ ...s, order: i })))
    bulkContext.onAddStepsToTc(targetTcId, stepsToMove)
    setSelectedIds(new Set())
  }

  const handleCopy = (targetTcId: string) => {
    if (!bulkContext) return
    const stepsCopy = selectedSteps.map((s, i) => ({ ...s, id: crypto.randomUUID(), order: i }))
    bulkContext.onAddStepsToTc(targetTcId, stepsCopy)
    setSelectedIds(new Set())
  }

  const handleGroupAsUtil = (name: string, params: { name: string; defaultValue: string }[]) => {
    if (!bulkContext) return
    const util: ReusableUtil = {
      id: crypto.randomUUID(),
      projectId: bulkContext.projectId,
      name,
      description: '',
      parameters: params.map((p) => ({ name: p.name, defaultValue: p.defaultValue || undefined })),
      steps: selectedSteps.map((s, i) => ({ ...s, order: i })),
      environmentId: bulkContext.activeEnvironmentId ?? null,
    }
    bulkContext.onCreateUtil(util)

    // Replace selected steps with a single util-ref step at first selected position
    const firstIdx = sorted.findIndex((s) => selectedIds.has(s.id))
    const utilRefStep: TestStep = {
      id: crypto.randomUUID(), order: 0, selector: '', selectorStrategy: 'css',
      action: 'click', value: '', assertion: 'none', assertionValue: '', waitBehavior: 'auto',
      utilRef: util.id,
    }
    const remaining = sorted.filter((s) => !selectedIds.has(s.id))
    remaining.splice(firstIdx, 0, utilRefStep)
    onChange(remaining.map((s, i) => ({ ...s, order: i })))
    setSelectedIds(new Set())
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const thCls = 'px-2 py-2.5 text-left text-2xs font-semibold text-vsc-dim uppercase tracking-widest border-b border-vsc-border bg-vsc-panel'
  const allChecked = sorted.length > 0 && selectedIds.size === sorted.length
  const someChecked = selectedIds.size > 0 && selectedIds.size < sorted.length

  return (
    <div className="flex flex-col gap-0" ref={containerRef} tabIndex={-1} onKeyDown={handleKeyDown}>
      <div className="overflow-x-auto rounded-lg border border-vsc-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {/* header checkbox */}
              <th className={`${thCls} w-8 pl-3`}>
                <button
                  onClick={handleCheckAll}
                  title={allChecked ? 'Deselect all' : 'Select all'}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    allChecked
                      ? 'border-vsc-accent bg-vsc-accent'
                      : someChecked
                      ? 'border-vsc-accent bg-transparent'
                      : 'border-vsc-border/60 hover:border-vsc-accent/60 bg-transparent'
                  }`}
                  aria-label="Select all steps"
                >
                  {allChecked && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2.5 2.5L7 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {someChecked && !allChecked && (
                    <span className="w-2 h-0.5 bg-vsc-accent block rounded-full" />
                  )}
                </button>
              </th>
              <th className={`${thCls} w-8`} aria-label="Drag handle" />
              <th className={`${thCls} w-[72px]`}>Strategy</th>
              <th className={thCls}>Selector</th>
              <th className={`${thCls} w-[100px]`}>Action</th>
              <th className={`${thCls} w-[140px]`}>Value</th>
              <th className={`${thCls} w-[100px]`}>Assertion</th>
              <th className={`${thCls} w-[110px]`}>Wait</th>
              <th className={`${thCls} w-[80px]`} />
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-vsc-dim text-xs">
                      No steps yet — add one below
                    </td>
                  </tr>
                ) : (
                  sorted.map((step, i) => (
                    <SortableRow
                      key={step.id}
                      step={step}
                      index={i}
                      variables={variables}
                      utils={utils}
                      onChange={(updated) => updateStep(step.id, updated)}
                      onDelete={() => deleteStep(step.id)}
                      onDuplicate={() => duplicateStep(step.id)}
                      assertionOpen={assertionMenuId === step.id}
                      waitOpen={waitMenuId === step.id}
                      onAssertionOpen={() => { setAssertionMenuId(step.id); setWaitMenuId(null) }}
                      onAssertionClose={() => setAssertionMenuId(null)}
                      onWaitOpen={() => { setWaitMenuId(step.id); setAssertionMenuId(null) }}
                      onWaitClose={() => setWaitMenuId(null)}
                      isSelected={selectedIds.has(step.id)}
                      onCheck={(e) => handleCheck(step.id, e)}
                    />
                  ))
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <StepBulkBar
          count={selectedIds.size}
          sorted={sorted}
          selectedIds={selectedIds}
          bulkContext={bulkContext}
          onDeselect={() => setSelectedIds(new Set())}
          onDelete={handleBulkDelete}
          onDuplicate={handleBulkDuplicate}
          onBulkChangeAction={handleBulkChangeAction}
          onBulkChangeStrategy={handleBulkChangeStrategy}
          onMove={handleMove}
          onCopy={handleCopy}
          onGroupAsUtil={handleGroupAsUtil}
        />
      )}

      {/* Table actions */}
      <div className="flex items-center gap-1 mt-3 flex-wrap">
        <button onClick={addStep} className="text-sm text-vsc-muted hover:text-vsc-text transition-colors px-3 py-1.5 rounded-md hover:bg-vsc-hover font-medium flex items-center gap-1.5">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Add step
        </button>

        {projectId && (
          <button onClick={() => setShowInsertTemplate(true)} className="text-sm text-vsc-muted hover:text-vsc-text transition-colors px-3 py-1.5 rounded-md hover:bg-vsc-hover font-medium">
            Insert template
          </button>
        )}

        {projectId && steps.length > 0 && (
          <button onClick={() => setShowSaveTemplate(true)} className="text-sm text-vsc-muted hover:text-vsc-text transition-colors px-3 py-1.5 rounded-md hover:bg-vsc-hover font-medium">
            Save as template
          </button>
        )}

        {availableUtils.length > 0 && (
          <select
            onChange={(e) => { if (e.target.value) { insertUtil(e.target.value); e.target.value = '' } }}
            className="bg-transparent border border-vsc-border rounded-md px-3 py-1.5 text-sm text-vsc-muted cursor-pointer hover:border-vsc-accent/40 hover:text-vsc-text outline-none transition-all"
            defaultValue=""
          >
            <option value="" disabled>Insert util…</option>
            {availableUtils.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {showInsertTemplate && projectId && (
        <InsertTemplateModal projectId={projectId} stepCount={steps.length} onInsert={(newSteps) => onChange([...steps, ...newSteps])} onClose={() => setShowInsertTemplate(false)} />
      )}
      {showSaveTemplate && projectId && (
        <SaveTemplateModal projectId={projectId} steps={steps} onSaved={() => {}} onClose={() => setShowSaveTemplate(false)} />
      )}
    </div>
  )
}
