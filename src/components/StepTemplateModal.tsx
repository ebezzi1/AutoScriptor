import { useState, useEffect } from 'react'
import { Modal } from './common/Modal'
import { Btn } from './common/Btn'
import { Field, Input } from './common/Field'
import {
  BUILTIN_TEMPLATES,
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  instantiateTemplate,
  type StepTemplate,
  type StepBlueprint,
} from '../lib/stepTemplates'
import type { TestStep } from '../types'
import { ACTION_LABELS, ASSERTION_LABELS } from '../types'

// ── Step preview row ─────────────────────────────────────────────────────────

function StepPreview({ step, index }: { step: StepBlueprint; index: number }) {
  const action = ACTION_LABELS[step.action] ?? step.action
  const assertion = step.assertion !== 'none' ? ASSERTION_LABELS[step.assertion] ?? step.assertion : null

  return (
    <div className="flex items-start gap-2 py-1 border-b border-vsc-border/20 last:border-0">
      <span className="text-[9px] text-vsc-dim font-mono tabular-nums w-4 shrink-0 pt-px">{index + 1}</span>
      <div className="flex flex-wrap gap-1.5 flex-1">
        <span className="text-[9px] bg-vsc-accent/10 text-vsc-accent border border-vsc-accent/20 px-1.5 py-0.5 rounded-sm font-mono uppercase tracking-wide">
          {action}
        </span>
        {step.selector && (
          <span className="text-[9px] text-vsc-muted font-mono bg-vsc-bg border border-vsc-border/50 px-1.5 py-0.5 rounded-sm">
            {step.selector}
          </span>
        )}
        {step.value && (
          <span className="text-[9px] text-vsc-dim font-mono">
            "{step.value}"
          </span>
        )}
        {assertion && (
          <span className="text-[9px] text-green-400/80 font-mono">
            → {assertion}{step.assertionValue ? ` "${step.assertionValue}"` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Template card ────────────────────────────────────────────────────────────

interface CardProps {
  template: StepTemplate
  onInsert: () => void
  onDelete?: () => void
}

function TemplateCard({ template, onInsert, onDelete }: CardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-vsc-bg border border-vsc-border rounded-sm overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-vsc-text">{template.name}</span>
            <span className="text-[8px] text-vsc-dim border border-vsc-border/50 px-1.5 py-0.5 rounded-sm tabular-nums">
              {template.steps.length} step{template.steps.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p className="text-[10px] text-vsc-muted truncate mt-0.5">{template.description}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[9px] text-vsc-dim hover:text-vsc-muted transition-colors px-1.5 py-0.5 border border-vsc-border/50 rounded-sm hover:border-vsc-border uppercase tracking-wide"
          >
            {expanded ? '▲' : '▼'}
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete template"
              className="text-[10px] text-vsc-dim hover:text-red-400 transition-colors px-1.5 py-0.5 border border-vsc-border/50 rounded-sm hover:border-red-400/30"
            >
              ×
            </button>
          )}
          <button
            onClick={onInsert}
            className="text-[9px] text-vsc-accent bg-vsc-accent/10 hover:bg-vsc-accent/20 border border-vsc-accent/30 hover:border-vsc-accent/50 transition-all px-2.5 py-1 rounded-sm uppercase tracking-wide font-medium"
          >
            Insert
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-2.5 border-t border-vsc-border/30 pt-2">
          {template.steps.map((step, i) => (
            <StepPreview key={i} step={step} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Insert Template Modal ────────────────────────────────────────────────────

interface InsertProps {
  projectId: string
  stepCount: number
  onInsert: (steps: TestStep[]) => void
  onClose: () => void
}

export function InsertTemplateModal({ projectId, stepCount, onInsert, onClose }: InsertProps) {
  const [customTemplates, setCustomTemplates] = useState<StepTemplate[]>([])

  useEffect(() => {
    setCustomTemplates(getCustomTemplates(projectId))
  }, [projectId])

  const handleInsert = (template: StepTemplate) => {
    const newSteps = instantiateTemplate(template.steps, stepCount)
    onInsert(newSteps)
    onClose()
  }

  const handleDelete = (templateId: string) => {
    deleteCustomTemplate(projectId, templateId)
    setCustomTemplates(getCustomTemplates(projectId))
  }

  return (
    <Modal title="Insert Step Template" onClose={onClose} footer={<Btn variant="ghost" onClick={onClose}>Close</Btn>}>
      <div className="flex flex-col gap-5 min-w-[540px] max-h-[70vh] overflow-y-auto pr-1">

        {/* Built-in */}
        <div>
          <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-2">Built-in templates</p>
          <div className="flex flex-col gap-1.5">
            {BUILTIN_TEMPLATES.map((t) => (
              <TemplateCard key={t.id} template={t} onInsert={() => handleInsert(t)} />
            ))}
          </div>
        </div>

        {/* Custom */}
        <div>
          <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-2">My templates</p>
          {customTemplates.length === 0 ? (
            <div className="border border-dashed border-vsc-border/40 rounded-sm py-6 text-center">
              <p className="text-[10px] text-vsc-dim">
                No custom templates yet — use <span className="text-vsc-accent font-mono">Save as Template</span> to create one
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {customTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onInsert={() => handleInsert(t)}
                  onDelete={() => handleDelete(t.id)}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </Modal>
  )
}

// ── Save as Template Modal ───────────────────────────────────────────────────

interface SaveProps {
  projectId: string
  steps: TestStep[]
  onSaved: () => void
  onClose: () => void
}

export function SaveTemplateModal({ projectId, steps, onSaved, onClose }: SaveProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const blueprints: StepBlueprint[] = steps.map(({ id: _id, order: _order, ...rest }) => rest)

  const handleSave = () => {
    if (!name.trim()) return
    const template: StepTemplate = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim(),
      steps: blueprints,
      builtin: false,
      createdAt: new Date().toISOString(),
    }
    saveCustomTemplate(projectId, template)
    onSaved()
    onClose()
  }

  return (
    <Modal
      title="Save as Template"
      onClose={onClose}
      footer={
        <>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleSave} disabled={!name.trim()}>Save</Btn>
        </>
      }
    >
      <div className="flex flex-col gap-4 min-w-[400px]">
        <Field label="Template name">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Login Flow, Admin Setup…"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </Field>
        <Field label="Description">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this template does…"
          />
        </Field>
        <div>
          <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-2">
            Steps to save ({blueprints.length})
          </p>
          <div className="bg-vsc-bg border border-vsc-border rounded-sm px-3 py-2 max-h-40 overflow-y-auto">
            {blueprints.map((step, i) => (
              <StepPreview key={i} step={step} index={i} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
