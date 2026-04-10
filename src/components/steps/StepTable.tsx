import { useCallback, useState } from 'react'
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
import type { TestStep, SelectorStrategy, ActionType, AssertionType, ReusableUtil } from '../../types'
import {
  ACTION_LABELS,
  ASSERTION_LABELS,
  STRATEGY_LABELS,
} from '../../types'
import { Btn } from '../common/Btn'
import { InsertTemplateModal, SaveTemplateModal } from '../StepTemplateModal'

interface RowProps {
  step: TestStep
  index: number
  variables: string[]
  utils: ReusableUtil[]
  onChange: (updated: TestStep) => void
  onDelete: () => void
  onDuplicate: () => void
}

function SortableRow({ step, index, variables, utils, onChange, onDelete, onDuplicate }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const u = <K extends keyof TestStep>(k: K, v: TestStep[K]) =>
    onChange({ ...step, [k]: v })

  const needsSelector = !['navigate', 'wait', 'screenshot'].includes(step.action)
  const needsValue = ['fill', 'navigate', 'select', 'press', 'wait', 'screenshot'].includes(step.action)
  const needsAssertionValue = !['none', 'toBeVisible', 'toBeHidden', 'toBeChecked', 'toBeDisabled', 'toBeEnabled'].includes(step.assertion)

  const cellCls = 'bg-transparent border border-vsc-border/60 rounded-sm px-1.5 py-1 text-[11px] text-vsc-text focus:border-vsc-accent focus:shadow-[0_0_0_1px_rgba(200,152,32,0.12)] outline-none transition-all w-full font-mono'
  const selectCls = `${cellCls} cursor-pointer`

  const showVarHint = variables.length > 0

  return (
    <tr ref={setNodeRef} style={style} className={`group border-b border-vsc-border/20 hover:bg-vsc-hover/30 transition-colors ${isDragging ? 'bg-vsc-active' : ''}`}>
      {/* drag handle + # */}
      <td className="px-2 py-1 text-center w-10">
        <div className="flex items-center justify-center gap-1">
          <span
            {...attributes}
            {...listeners}
            className="text-vsc-dim hover:text-vsc-muted cursor-grab active:cursor-grabbing text-[10px] select-none"
            title="Drag to reorder"
          >
            ≡
          </span>
          <span className="text-vsc-dim text-[10px] font-mono tabular-nums">{index + 1}</span>
        </div>
      </td>

      {/* selector strategy */}
      <td className="px-1 py-1 w-24">
        {needsSelector ? (
          <select
            value={step.selectorStrategy}
            onChange={(e) => u('selectorStrategy', e.target.value as SelectorStrategy)}
            className={selectCls}
          >
            {Object.entries(STRATEGY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        ) : (
          <span className="text-vsc-dim text-[10px] px-1">—</span>
        )}
      </td>

      {/* selector */}
      <td className="px-1 py-1">
        {step.utilRef ? (
          <span className="text-[11px] text-vsc-accent font-mono">
            util: {utils.find(u => u.id === step.utilRef)?.name ?? step.utilRef}
          </span>
        ) : needsSelector ? (
          <input
            value={step.selector}
            onChange={(e) => u('selector', e.target.value)}
            placeholder="#selector"
            className={cellCls}
          />
        ) : (
          <span className="text-vsc-dim text-[10px] px-1">—</span>
        )}
      </td>

      {/* action */}
      <td className="px-1 py-1 w-28">
        {step.utilRef ? (
          <span className="text-[10px] text-vsc-muted">call util</span>
        ) : (
          <select
            value={step.action}
            onChange={(e) => u('action', e.target.value as ActionType)}
            className={selectCls}
          >
            {Object.entries(ACTION_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )}
      </td>

      {/* value */}
      <td className="px-1 py-1">
        {needsValue && !step.utilRef ? (
          <div className="relative">
            <input
              value={step.value}
              onChange={(e) => u('value', e.target.value)}
              placeholder={step.action === 'navigate' ? 'https://...' : 'value'}
              className={cellCls}
              list={showVarHint ? `vars-${step.id}` : undefined}
            />
            {showVarHint && (
              <datalist id={`vars-${step.id}`}>
                {variables.map((v) => (
                  <option key={v} value={`{{${v}}}`} />
                ))}
              </datalist>
            )}
          </div>
        ) : (
          <span className="text-vsc-dim text-[10px] px-1">—</span>
        )}
      </td>

      {/* assertion */}
      <td className="px-1 py-1 w-32">
        <select
          value={step.assertion}
          onChange={(e) => u('assertion', e.target.value as AssertionType)}
          className={selectCls}
        >
          {Object.entries(ASSERTION_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </td>

      {/* assertion value */}
      <td className="px-1 py-1">
        {needsAssertionValue ? (
          <input
            value={step.assertionValue}
            onChange={(e) => u('assertionValue', e.target.value)}
            placeholder="expected"
            className={cellCls}
          />
        ) : (
          <span className="text-vsc-dim text-[10px] px-1">—</span>
        )}
      </td>

      {/* wait */}
      <td className="px-1 py-1 w-20">
        <select
          value={step.waitBehavior}
          onChange={(e) => u('waitBehavior', e.target.value as TestStep['waitBehavior'])}
          className={selectCls}
        >
          <option value="auto">Auto</option>
          <option value="networkidle">Network idle</option>
          <option value="domcontentloaded">DOM ready</option>
          <option value="custom">Custom</option>
        </select>
        {step.waitBehavior === 'custom' && (
          <input
            type="number"
            value={step.waitMs ?? ''}
            onChange={(e) => u('waitMs', Number(e.target.value))}
            placeholder="ms"
            className={`${cellCls} mt-1`}
          />
        )}
      </td>

      {/* actions */}
      <td className="px-2 py-1 w-14">
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onDuplicate}
            title="Duplicate"
            className="text-vsc-dim hover:text-vsc-accent transition-colors text-[11px]"
          >
            ⧉
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            className="text-vsc-dim hover:text-vsc-danger transition-colors text-[11px]"
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  )
}

interface Props {
  steps: TestStep[]
  onChange: (steps: TestStep[]) => void
  variables?: string[]
  utils?: ReusableUtil[]
  availableUtils?: ReusableUtil[]
  projectId?: string
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

export function StepTable({ steps, onChange, variables = [], utils = [], availableUtils = [], projectId }: Props) {
  const sensors = useSensors(useSensor(PointerSensor))
  const [showInsertTemplate, setShowInsertTemplate] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)

  const sorted = [...steps].sort((a, b) => a.order - b.order)

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sorted.findIndex((s) => s.id === active.id)
    const newIndex = sorted.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(sorted, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order: i,
    }))
    onChange(reordered)
  }, [sorted, onChange])

  const addStep = () => {
    onChange([...steps, makeStep(steps.length)])
  }

  const insertUtil = (utilId: string) => {
    const util = availableUtils.find((u) => u.id === utilId)
    if (!util) return
    const step: TestStep = {
      id: crypto.randomUUID(),
      order: steps.length,
      selector: '',
      selectorStrategy: 'css',
      action: 'click',
      value: '',
      assertion: 'none',
      assertionValue: '',
      waitBehavior: 'auto',
      utilRef: utilId,
    }
    onChange([...steps, step])
  }

  const updateStep = (id: string, updated: TestStep) =>
    onChange(steps.map((s) => (s.id === id ? updated : s)))

  const deleteStep = (id: string) =>
    onChange(steps.filter((s) => s.id !== id))

  const duplicateStep = (id: string) => {
    const idx = steps.findIndex((s) => s.id === id)
    if (idx === -1) return
    const copy = { ...steps[idx], id: crypto.randomUUID(), order: steps.length }
    onChange([...steps, copy])
  }

  const thCls = 'px-2 py-2 text-left text-[9px] font-semibold text-vsc-accent/70 uppercase tracking-widest border-b border-vsc-border bg-vsc-panel'

  return (
    <div className="flex flex-col gap-0">
      <div className="overflow-x-auto rounded-sm border border-vsc-border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className={`${thCls} w-10`}>#</th>
              <th className={`${thCls} w-24`}>Strategy</th>
              <th className={thCls}>Selector</th>
              <th className={`${thCls} w-28`}>Action</th>
              <th className={thCls}>Value</th>
              <th className={`${thCls} w-32`}>Assertion</th>
              <th className={thCls}>Expect</th>
              <th className={`${thCls} w-20`}>Wait</th>
              <th className={`${thCls} w-14`}></th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sorted.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-vsc-dim text-[10px] uppercase tracking-widest">
                      No steps yet — add one below
                    </td>
                  </tr>
                ) : (
                  sorted.map((step, i) => (
                    <SortableRow
                      key={step.id}
                      step={step}
                      index={i}
                      variables={variables.map((v) => v)}
                      utils={utils}
                      onChange={(updated) => updateStep(step.id, updated)}
                      onDelete={() => deleteStep(step.id)}
                      onDuplicate={() => duplicateStep(step.id)}
                    />
                  ))
                )}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <Btn variant="ghost" size="sm" onClick={addStep}>
          + Add step
        </Btn>
        {projectId && (
          <Btn variant="ghost" size="sm" onClick={() => setShowInsertTemplate(true)}>
            ☰ Insert Template
          </Btn>
        )}
        {projectId && steps.length > 0 && (
          <Btn variant="ghost" size="sm" onClick={() => setShowSaveTemplate(true)}>
            ⊕ Save as Template
          </Btn>
        )}
        {availableUtils.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                insertUtil(e.target.value)
                e.target.value = ''
              }
            }}
            className="bg-vsc-active border border-vsc-border rounded-sm px-2 py-1 text-[10px] text-vsc-muted cursor-pointer focus:border-vsc-accent outline-none uppercase tracking-wide"
            defaultValue=""
          >
            <option value="" disabled>Insert util…</option>
            {availableUtils.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}
      </div>

      {showInsertTemplate && projectId && (
        <InsertTemplateModal
          projectId={projectId}
          stepCount={steps.length}
          onInsert={(newSteps) => onChange([...steps, ...newSteps])}
          onClose={() => setShowInsertTemplate(false)}
        />
      )}

      {showSaveTemplate && projectId && (
        <SaveTemplateModal
          projectId={projectId}
          steps={steps}
          onSaved={() => {}}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}
    </div>
  )
}
