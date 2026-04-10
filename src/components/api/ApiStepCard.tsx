import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type {
  ApiStep, ApiTab, HttpMethod, AuthType, BodyType,
  AssertOperator, CaptureScope,
} from '../../types/api'
import {
  HTTP_METHODS, METHOD_STYLE, ASSERT_OPERATOR_LABELS,
  makeKVPair, makeResponseAssertion, makeCaptureVar,
} from '../../types/api'
import { KVTable } from './KVTable'

// ── Shared input style ────────────────────────────────────────────────────────

const inputCls =
  'bg-vsc-bg border border-vsc-border/60 rounded-sm px-2 py-1 text-[11px] text-vsc-text ' +
  'focus:border-vsc-accent focus:outline-none font-mono placeholder-vsc-dim/60 transition-colors w-full'

const selectCls =
  'bg-vsc-bg border border-vsc-border/60 rounded-sm px-2 py-1 text-[10px] text-vsc-text ' +
  'focus:border-vsc-accent focus:outline-none cursor-pointer transition-colors uppercase tracking-wide'

// ── Section heading ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[8px] font-semibold text-vsc-dim uppercase tracking-[0.18em] mb-2">
      {children}
    </p>
  )
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

const TABS: { id: ApiTab; label: string }[] = [
  { id: 'params',  label: 'Params'  },
  { id: 'headers', label: 'Headers' },
  { id: 'body',    label: 'Body'    },
  { id: 'auth',    label: 'Auth'    },
]

interface TabBarProps {
  active: ApiTab
  step: ApiStep
  onSelect: (t: ApiTab) => void
}

function TabBar({ active, step, onSelect }: TabBarProps) {
  const counts: Partial<Record<ApiTab, number>> = {
    params:  step.params.filter((p) => p.enabled && p.key).length || undefined,
    headers: step.headers.filter((h) => h.enabled && h.key).length || undefined,
  }
  const bodyActive = step.bodyType !== 'none'
  const authActive = step.auth.type !== 'none'

  return (
    <div className="flex border-b border-vsc-border">
      {TABS.map((t) => {
        const badge = counts[t.id]
        const dot = (t.id === 'body' && bodyActive) || (t.id === 'auth' && authActive)
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-wider border-b-2 transition-colors flex items-center gap-1 ${
              active === t.id
                ? 'border-vsc-accent text-vsc-accent'
                : 'border-transparent text-vsc-dim hover:text-vsc-muted'
            }`}
          >
            {t.label}
            {badge !== undefined && (
              <span className="text-[8px] bg-vsc-accent/20 text-vsc-accent px-1 rounded-sm tabular-nums">
                {badge}
              </span>
            )}
            {dot && !badge && (
              <span className="w-1 h-1 rounded-full bg-vsc-accent inline-block" />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Auth section ──────────────────────────────────────────────────────────────

function AuthSection({
  auth,
  variables,
  onChange,
}: {
  auth: ApiStep['auth']
  variables: string[]
  onChange: (a: ApiStep['auth']) => void
}) {
  const u = <K extends keyof ApiStep['auth']>(k: K, v: ApiStep['auth'][K]) =>
    onChange({ ...auth, [k]: v })

  const varListId = 'auth-vars'

  return (
    <div className="flex flex-col gap-3">
      <datalist id={varListId}>
        {variables.map((v) => <option key={v} value={`{{${v}}}`} />)}
      </datalist>

      <div className="flex items-center gap-2">
        <SectionLabel>Type</SectionLabel>
        <select
          value={auth.type}
          onChange={(e) => u('type', e.target.value as AuthType)}
          className={selectCls}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer Token</option>
          <option value="basic">Basic Auth</option>
          <option value="apikey">API Key</option>
        </select>
      </div>

      {auth.type === 'bearer' && (
        <div>
          <SectionLabel>Token</SectionLabel>
          <input
            value={auth.token}
            onChange={(e) => u('token', e.target.value)}
            placeholder="{{TOKEN}} or paste token"
            list={varListId}
            className={inputCls}
          />
        </div>
      )}

      {auth.type === 'basic' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <SectionLabel>Username</SectionLabel>
            <input
              value={auth.username}
              onChange={(e) => u('username', e.target.value)}
              placeholder="{{USERNAME}}"
              list={varListId}
              className={inputCls}
            />
          </div>
          <div className="flex-1">
            <SectionLabel>Password</SectionLabel>
            <input
              type="password"
              value={auth.password}
              onChange={(e) => u('password', e.target.value)}
              placeholder="{{PASSWORD}}"
              className={inputCls}
            />
          </div>
        </div>
      )}

      {auth.type === 'apikey' && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <SectionLabel>Key name</SectionLabel>
              <input
                value={auth.keyName}
                onChange={(e) => u('keyName', e.target.value)}
                placeholder="X-API-Key"
                className={inputCls}
              />
            </div>
            <div className="flex-1">
              <SectionLabel>Value</SectionLabel>
              <input
                value={auth.keyValue}
                onChange={(e) => u('keyValue', e.target.value)}
                placeholder="{{API_KEY}}"
                list={varListId}
                className={inputCls}
              />
            </div>
            <div className="w-24 shrink-0">
              <SectionLabel>Send in</SectionLabel>
              <select
                value={auth.keyIn}
                onChange={(e) => u('keyIn', e.target.value as 'header' | 'query')}
                className={selectCls}
              >
                <option value="header">Header</option>
                <option value="query">Query</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {auth.type === 'none' && (
        <p className="text-[10px] text-vsc-dim italic">No authentication for this request.</p>
      )}
    </div>
  )
}

// ── Body section ──────────────────────────────────────────────────────────────

function BodySection({
  step,
  variables,
  onChange,
}: {
  step: ApiStep
  variables: string[]
  onChange: (updates: Partial<ApiStep>) => void
}) {
  const isBodyMethod = ['POST', 'PUT', 'PATCH'].includes(step.method)

  if (!isBodyMethod) {
    return (
      <p className="text-[10px] text-vsc-dim italic">
        Body is only available for POST, PUT, and PATCH requests.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Body type selector */}
      <div className="flex gap-1.5">
        {(['none', 'json', 'formdata'] as BodyType[]).map((t) => (
          <button
            key={t}
            onClick={() => onChange({ bodyType: t })}
            className={`text-[9px] uppercase tracking-wide px-2.5 py-1 rounded-sm border transition-all ${
              step.bodyType === t
                ? 'bg-vsc-accent/20 border-vsc-accent/50 text-vsc-accent'
                : 'border-vsc-border text-vsc-dim hover:text-vsc-muted'
            }`}
          >
            {t === 'none' ? 'None' : t === 'json' ? 'JSON' : 'Form Data'}
          </button>
        ))}
      </div>

      {step.bodyType === 'json' && (
        <div>
          <SectionLabel>JSON Body</SectionLabel>
          <textarea
            value={step.bodyJson}
            onChange={(e) => onChange({ bodyJson: e.target.value })}
            rows={8}
            spellCheck={false}
            className={`${inputCls} resize-y leading-relaxed text-vsc-success`}
            placeholder={'{\n  "key": "value"\n}'}
          />
        </div>
      )}

      {step.bodyType === 'formdata' && (
        <div>
          <SectionLabel>Form Fields</SectionLabel>
          <KVTable
            pairs={step.bodyFormData}
            onChange={(bodyFormData) => onChange({ bodyFormData })}
            keyPlaceholder="field name"
            valuePlaceholder="value"
            variables={variables}
          />
        </div>
      )}
    </div>
  )
}

// ── Response assertions section ───────────────────────────────────────────────

function AssertionsSection({
  step,
  variables,
  onChange,
}: {
  step: ApiStep
  variables: string[]
  onChange: (updates: Partial<ApiStep>) => void
}) {
  const updateAssertion = (id: string, field: string, value: string) =>
    onChange({
      responseAssertions: step.responseAssertions.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    })

  const removeAssertion = (id: string) =>
    onChange({ responseAssertions: step.responseAssertions.filter((a) => a.id !== id) })

  const varListId = `assert-vars-${step.id}`

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <SectionLabel>Status code</SectionLabel>
        <input
          type="number"
          value={step.statusAssertion ?? ''}
          onChange={(e) =>
            onChange({ statusAssertion: e.target.value ? Number(e.target.value) : null })
          }
          placeholder="200"
          className={`${inputCls} w-20`}
        />
        <span className="text-[9px] text-vsc-dim">expected HTTP status</span>
      </div>

      <SectionLabel>Response body assertions</SectionLabel>

      <datalist id={varListId}>
        {variables.map((v) => <option key={v} value={`{{${v}}}`} />)}
      </datalist>

      {step.responseAssertions.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {step.responseAssertions.map((a) => (
            <div key={a.id} className="flex items-center gap-1.5">
              <input
                value={a.jsonPath}
                onChange={(e) => updateAssertion(a.id, 'jsonPath', e.target.value)}
                placeholder="$.data.id"
                className={`${inputCls} flex-1`}
              />
              <select
                value={a.operator}
                onChange={(e) => updateAssertion(a.id, 'operator', e.target.value)}
                className={`${selectCls} shrink-0`}
              >
                {(Object.entries(ASSERT_OPERATOR_LABELS) as [AssertOperator, string][]).map(
                  ([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  )
                )}
              </select>
              {!['exists', 'notEmpty', 'isArray'].includes(a.operator) && (
                <input
                  value={a.expected}
                  onChange={(e) => updateAssertion(a.id, 'expected', e.target.value)}
                  placeholder={a.operator === 'hasLength' ? '3' : 'expected value'}
                  list={varListId}
                  className={`${inputCls} flex-1`}
                />
              )}
              <button
                onClick={() => removeAssertion(a.id)}
                className="shrink-0 text-vsc-dim hover:text-vsc-danger transition-colors text-[13px]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() =>
          onChange({ responseAssertions: [...step.responseAssertions, makeResponseAssertion()] })
        }
        className="text-[9px] text-vsc-dim hover:text-vsc-accent transition-colors uppercase tracking-widest"
      >
        + Add assertion
      </button>
    </div>
  )
}

// ── Capture variables section ─────────────────────────────────────────────────

function CaptureSection({
  step,
  onChange,
}: {
  step: ApiStep
  onChange: (updates: Partial<ApiStep>) => void
}) {
  const update = (id: string, field: string, value: string) =>
    onChange({
      captureVars: step.captureVars.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    })
  const remove = (id: string) =>
    onChange({ captureVars: step.captureVars.filter((c) => c.id !== id) })

  return (
    <div>
      <SectionLabel>Capture variables</SectionLabel>
      <p className="text-[9px] text-vsc-dim mb-2 leading-relaxed">
        Extract values from the response and use them as{' '}
        <span className="font-mono text-vsc-accent/80">{'{{variableName}}'}</span> in subsequent steps.
      </p>

      {step.captureVars.length > 0 && (
        <div className="flex flex-col gap-1 mb-2">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="flex-1 text-[8px] text-vsc-dim uppercase tracking-widest">Variable</span>
            <span className="flex-1 text-[8px] text-vsc-dim uppercase tracking-widest">JSON path</span>
            <span className="w-20 shrink-0 text-[8px] text-vsc-dim uppercase tracking-widest">Scope</span>
            <span className="w-4" />
          </div>
          {step.captureVars.map((c) => (
            <div key={c.id} className="flex items-center gap-1.5">
              <input
                value={c.name}
                onChange={(e) => update(c.id, 'name', e.target.value)}
                placeholder="userId"
                className={`${inputCls} flex-1`}
              />
              <input
                value={c.jsonPath}
                onChange={(e) => update(c.id, 'jsonPath', e.target.value)}
                placeholder="$.data.id"
                className={`${inputCls} flex-1`}
              />
              <select
                value={c.scope}
                onChange={(e) => update(c.id, 'scope', e.target.value as CaptureScope)}
                className={`${selectCls} w-24 shrink-0`}
              >
                <option value="test">This test</option>
                <option value="environment">Environment</option>
              </select>
              <button
                onClick={() => remove(c.id)}
                className="shrink-0 text-vsc-dim hover:text-vsc-danger transition-colors text-[13px]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => onChange({ captureVars: [...step.captureVars, makeCaptureVar()] })}
        className="text-[9px] text-vsc-dim hover:text-vsc-accent transition-colors uppercase tracking-widest"
      >
        + Capture variable
      </button>
    </div>
  )
}

// ── Main: ApiStepCard ─────────────────────────────────────────────────────────

interface Props {
  step: ApiStep
  index: number
  allVariables: string[]       // global vars
  capturedFromPrior: string[]  // vars captured by earlier steps
  onChange: (updated: ApiStep) => void
  onDelete: () => void
  onDuplicate: () => void
}

export function ApiStepCard({
  step,
  index,
  allVariables,
  capturedFromPrior,
  onChange,
  onDelete,
  onDuplicate,
}: Props) {
  const [activeTab, setActiveTab] = useState<ApiTab>('params')

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: step.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const ms = METHOD_STYLE[step.method]
  const u = (updates: Partial<ApiStep>) => onChange({ ...step, ...updates })
  const variables = [...allVariables, ...capturedFromPrior]

  // URL datalist id
  const urlVarsId = `url-vars-${step.id}`

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeftColor: ms.border }}
      className="rounded-sm border border-vsc-border border-l-4 bg-vsc-panel overflow-hidden"
    >
      {/* ── Header bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-vsc-sidebar/60">
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="text-vsc-dim hover:text-vsc-muted cursor-grab active:cursor-grabbing text-[11px] select-none shrink-0"
          title="Drag to reorder"
        >
          ≡
        </span>

        {/* Step number */}
        <span className="text-[9px] text-vsc-dim font-mono tabular-nums shrink-0 w-4">
          {index + 1}
        </span>

        {/* Method selector */}
        <div className="shrink-0">
          <select
            value={step.method}
            onChange={(e) => u({ method: e.target.value as HttpMethod })}
            style={{ color: ms.text, borderColor: ms.border, backgroundColor: ms.bg }}
            className="border rounded-sm px-2 py-0.5 text-[10px] font-semibold font-mono cursor-pointer focus:outline-none uppercase tracking-wider"
          >
            {HTTP_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* URL input */}
        <div className="flex-1 min-w-0">
          <datalist id={urlVarsId}>
            {variables.map((v) => <option key={v} value={`{{${v}}}`} />)}
          </datalist>
          <input
            value={step.url}
            onChange={(e) => u({ url: e.target.value })}
            placeholder="https://api.example.com/endpoint or {{BASE_URL}}/path"
            list={urlVarsId}
            className="bg-vsc-bg border border-vsc-border/50 rounded-sm px-2.5 py-1 text-[11px] text-vsc-text font-mono focus:border-vsc-accent focus:outline-none w-full placeholder-vsc-dim/50 transition-colors"
          />
        </div>

        {/* Step name (editable label) */}
        <input
          value={step.name}
          onChange={(e) => u({ name: e.target.value })}
          placeholder="Step name"
          className="w-28 shrink-0 bg-transparent border-b border-transparent hover:border-vsc-border/40 focus:border-vsc-accent/60 focus:outline-none text-[10px] text-vsc-muted text-right px-1 transition-colors"
        />

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => u({ collapsed: !step.collapsed })}
            className="text-vsc-dim hover:text-vsc-muted transition-colors text-[11px] w-5 text-center"
            title={step.collapsed ? 'Expand' : 'Collapse'}
          >
            {step.collapsed ? '▸' : '▾'}
          </button>
          <button
            onClick={onDuplicate}
            className="text-vsc-dim hover:text-vsc-accent transition-colors text-[11px] w-5 text-center"
            title="Duplicate step"
          >
            ⧉
          </button>
          <button
            onClick={onDelete}
            className="text-vsc-dim hover:text-vsc-danger transition-colors text-[13px] w-5 text-center"
            title="Delete step"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Expanded body ──────────────────────────────────────── */}
      {!step.collapsed && (
        <div>
          {/* Tabs */}
          <TabBar active={activeTab} step={step} onSelect={setActiveTab} />

          {/* Tab content */}
          <div className="p-3">
            {activeTab === 'params' && (
              <KVTable
                pairs={step.params}
                onChange={(params) => u({ params })}
                keyPlaceholder="param"
                valuePlaceholder="value"
                variables={variables}
              />
            )}

            {activeTab === 'headers' && (
              <KVTable
                pairs={step.headers}
                onChange={(headers) => u({ headers })}
                keyPlaceholder="Header"
                valuePlaceholder="value"
                headerMode
                variables={variables}
              />
            )}

            {activeTab === 'body' && (
              <BodySection step={step} variables={variables} onChange={u} />
            )}

            {activeTab === 'auth' && (
              <AuthSection auth={step.auth} variables={variables} onChange={(auth) => u({ auth })} />
            )}
          </div>

          {/* Response Assertions */}
          <div className="border-t border-vsc-border/40 p-3">
            <AssertionsSection step={step} variables={variables} onChange={u} />
          </div>

          {/* Variable Capture */}
          <div className="border-t border-vsc-border/40 p-3">
            <CaptureSection step={step} onChange={u} />
          </div>
        </div>
      )}
    </div>
  )
}
