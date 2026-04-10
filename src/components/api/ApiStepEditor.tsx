import { useCallback } from 'react'
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
  arrayMove,
} from '@dnd-kit/sortable'
import type { ApiStep } from '../../types/api'
import { makeApiStep } from '../../types/api'
import { ApiStepCard } from './ApiStepCard'

interface Props {
  steps: ApiStep[]
  onChange: (steps: ApiStep[]) => void
  /** Global variable keys available for autocomplete */
  variables?: string[]
}

export function ApiStepEditor({ steps, onChange, variables = [] }: Props) {
  const sensors = useSensors(useSensor(PointerSensor))

  const sorted = [...steps].sort((a, b) => a.order - b.order)

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIdx = sorted.findIndex((s) => s.id === active.id)
      const newIdx = sorted.findIndex((s) => s.id === over.id)
      const reordered = arrayMove(sorted, oldIdx, newIdx).map((s, i) => ({
        ...s,
        order: i,
      }))
      onChange(reordered)
    },
    [sorted, onChange],
  )

  const addStep = () => {
    onChange([...steps, makeApiStep(steps.length)])
  }

  const updateStep = (id: string, updated: ApiStep) =>
    onChange(steps.map((s) => (s.id === id ? updated : s)))

  const deleteStep = (id: string) => onChange(steps.filter((s) => s.id !== id))

  const duplicateStep = (id: string) => {
    const src = steps.find((s) => s.id === id)
    if (!src) return
    const copy: ApiStep = {
      ...src,
      id: crypto.randomUUID(),
      order: steps.length,
      name: `${src.name} (copy)`,
      params: src.params.map((p) => ({ ...p, id: crypto.randomUUID() })),
      headers: src.headers.map((h) => ({ ...h, id: crypto.randomUUID() })),
      bodyFormData: src.bodyFormData.map((f) => ({ ...f, id: crypto.randomUUID() })),
      responseAssertions: src.responseAssertions.map((a) => ({
        ...a,
        id: crypto.randomUUID(),
      })),
      captureVars: src.captureVars.map((c) => ({ ...c, id: crypto.randomUUID() })),
    }
    onChange([...steps, copy])
  }

  return (
    <div className="flex flex-col gap-0">
      {sorted.length === 0 && (
        <div className="border border-dashed border-vsc-border/50 rounded-sm p-10 text-center mb-3">
          <p className="text-[10px] text-vsc-dim uppercase tracking-widest">
            No API steps yet — add one below
          </p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sorted.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {sorted.map((step, i) => {
              // Variables captured by all prior steps
              const capturedFromPrior = sorted
                .slice(0, i)
                .flatMap((s) => s.captureVars.map((c) => c.name).filter(Boolean))

              return (
                <ApiStepCard
                  key={step.id}
                  step={step}
                  index={i}
                  allVariables={variables}
                  capturedFromPrior={capturedFromPrior}
                  onChange={(updated) => updateStep(step.id, updated)}
                  onDelete={() => deleteStep(step.id)}
                  onDuplicate={() => duplicateStep(step.id)}
                />
              )
            })}
          </div>
        </SortableContext>
      </DndContext>

      <div className="mt-3">
        <button
          onClick={addStep}
          className="inline-flex items-center gap-1.5 border border-vsc-border bg-transparent hover:bg-vsc-hover text-vsc-muted hover:text-vsc-accent rounded-sm px-3 py-1.5 text-[10px] uppercase tracking-wider font-medium transition-all duration-150"
        >
          + Add API step
        </button>
      </div>
    </div>
  )
}
