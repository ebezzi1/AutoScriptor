import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common/Modal'
import { Btn } from '../components/common/Btn'
import { Field, Input, Select, Toggle } from '../components/common/Field'
import { StepTable } from '../components/steps/StepTable'
import type { GlobalVariable, ReusableUtil, Fixture, UtilParameter, EnvProfile } from '../types'
import { getEnvColor } from '../types'

interface Props { projectId: string }

interface TabProps {
  projectId: string
  activeEnv: EnvProfile | null
  envHex: string | null
}

export function UtilsView({ projectId }: Props) {
  const { state } = useApp()
  const project = state.projects.find((p) => p.id === projectId)
  const activeEnv = project?.environments?.find((e) => e.id === project?.activeEnvironmentId) ?? null
  const envHex = activeEnv ? getEnvColor(activeEnv) : null

  const [tab, setTab] = useState<'variables' | 'utils' | 'fixtures'>('variables')

  return (
    <div className="p-6 flex flex-col gap-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] text-vsc-accent uppercase tracking-[0.16em] mb-1.5"># Configuration</p>
          <h1 className="text-xl font-semibold text-vsc-text tracking-tight">Utils & Parameters</h1>
        </div>
        {/* Active env badge */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[9px] uppercase tracking-widest font-semibold shrink-0 mt-1"
          style={
            activeEnv && envHex
              ? { color: envHex, borderColor: `${envHex}60`, backgroundColor: `${envHex}18` }
              : { color: '#666', borderColor: '#333', backgroundColor: 'transparent' }
          }
        >
          <span>{activeEnv ? '●' : '○'}</span>
          <span>{activeEnv ? activeEnv.name : 'Base / Shared'}</span>
        </div>
      </div>

      {/* Env color accent rule */}
      {envHex && (
        <div className="h-px" style={{ backgroundColor: `${envHex}50` }} />
      )}

      {/* Tabs */}
      <div
        className="flex gap-0 border-b border-vsc-border"
        style={envHex ? { borderBottomColor: `${envHex}40` } : undefined}
      >
        {(['variables', 'utils', 'fixtures'] as const).map((t) => (
          <button
            key={t}
            className={`px-4 py-2 text-[10px] transition-all uppercase tracking-widest border-b-2 -mb-px ${
              tab === t
                ? 'border-vsc-accent text-vsc-accent'
                : 'border-transparent text-vsc-muted hover:text-vsc-text'
            }`}
            style={tab === t && envHex ? { borderBottomColor: envHex, color: envHex } : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'variables' && <VariablesTab projectId={projectId} activeEnv={activeEnv} envHex={envHex} />}
      {tab === 'utils' && <UtilsTab projectId={projectId} activeEnv={activeEnv} envHex={envHex} />}
      {tab === 'fixtures' && <FixturesTab projectId={projectId} activeEnv={activeEnv} envHex={envHex} />}
    </div>
  )
}

/* ── Variables Tab ── */

function VariablesTab({ projectId, activeEnv, envHex }: TabProps) {
  const { state, dispatch } = useApp()
  const { toast } = useToast()
  const features = state.features.filter((f) => f.projectId === projectId)

  // Show Base vars + env-specific vars for the active env
  const allVars = state.variables.filter((v) => v.projectId === projectId)
  const visibleVars = allVars.filter((v) =>
    !v.environmentId || v.environmentId === activeEnv?.id
  )

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Omit<GlobalVariable, 'id' | 'projectId'>>({
    key: '', value: '', scope: 'project', sensitive: false, environmentId: null,
  })

  const openCreate = () => {
    setDraft({
      key: '', value: '', scope: 'project', sensitive: false,
      environmentId: activeEnv?.id ?? null,
    })
    setCreating(true)
  }

  const create = () => {
    if (!draft.key.trim()) return
    dispatch({
      type: 'CREATE_VAR',
      variable: { ...draft, id: crypto.randomUUID(), projectId },
    })
    toast('Variable created')
    setCreating(false)
  }

  const layerBadge = (v: GlobalVariable) => {
    if (!v.environmentId) {
      return { label: 'Base', style: { color: '#777', borderColor: '#444', backgroundColor: '#2a2a2a' } }
    }
    const envs = state.projects.find((p) => p.id === projectId)?.environments ?? []
    const env = envs.find((e) => e.id === v.environmentId)
    const hex = env ? getEnvColor(env) : '#a855f7'
    return {
      label: env?.name ?? 'env',
      style: { color: hex, borderColor: `${hex}60`, backgroundColor: `${hex}18` },
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Btn variant="primary" size="sm" onClick={openCreate}>+ Add variable</Btn>
      </div>
      {visibleVars.length === 0 ? (
        <div className="border border-dashed border-vsc-border/60 rounded-sm p-8 text-center text-vsc-dim text-[10px]">
          No variables yet. Use{' '}
          <code className="font-mono text-vsc-accent text-[11px]">{'{{variableName}}'}</code>{' '}
          in step values to reference them.
        </div>
      ) : (
        <div
          className="border rounded-sm overflow-hidden"
          style={envHex ? { borderColor: `${envHex}30` } : undefined}
        >
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr
                className="border-b border-vsc-border bg-vsc-panel"
                style={envHex ? { borderBottomColor: `${envHex}30` } : undefined}
              >
                {['Key', 'Value', 'Layer', 'Scope', 'Type', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 text-[9px] font-semibold uppercase tracking-widest"
                    style={{ color: envHex ? `${envHex}99` : undefined }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleVars.map((v) => {
                const badge = layerBadge(v)
                return (
                  <tr key={v.id} className="border-b border-vsc-border/30 group hover:bg-vsc-hover/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-vsc-accent text-[11px]">{`{{${v.key}}}`}</td>
                    <td className="px-3 py-2 text-vsc-muted font-mono text-[11px]">
                      {v.sensitive ? '••••••••' : v.value}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="text-[8px] border rounded-sm px-1.5 py-0.5 uppercase tracking-wide font-semibold"
                        style={badge.style}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-vsc-muted text-[10px] capitalize">{v.scope}</td>
                    <td className="px-3 py-2">
                      {v.sensitive && (
                        <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-sm px-1.5 py-0.5 uppercase tracking-wide">.env</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        className="opacity-0 group-hover:opacity-100 text-vsc-dim hover:text-vsc-danger transition-all text-[11px]"
                        onClick={() => {
                          dispatch({ type: 'DELETE_VAR', varId: v.id })
                          toast('Variable deleted', 'error')
                        }}
                      >×</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal
          title="New variable"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={create} disabled={!draft.key.trim()}>Create</Btn>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <Field label="Key">
              <Input autoFocus value={draft.key} onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))} placeholder="adminEmail" />
            </Field>
            <Field label="Value">
              <Input value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))} placeholder="admin@test.com" />
            </Field>
            <Field label="Scope">
              <Select value={draft.scope} onChange={(e) => setDraft((d) => ({ ...d, scope: e.target.value as GlobalVariable['scope'], featureId: undefined }))}>
                <option value="project">Project</option>
                <option value="feature">Feature</option>
              </Select>
            </Field>
            {draft.scope === 'feature' && (
              <Field label="Feature">
                <Select value={draft.featureId ?? ''} onChange={(e) => setDraft((d) => ({ ...d, featureId: e.target.value }))}>
                  <option value="">Select feature…</option>
                  {features.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </Select>
              </Field>
            )}
            {/* Layer selector — only shown when an env is active */}
            {activeEnv && (
              <Field label="Layer" hint="Base variables are shared across all environments">
                <Select
                  value={draft.environmentId ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, environmentId: e.target.value || null }))}
                >
                  <option value="">Base (shared across all environments)</option>
                  <option value={activeEnv.id}>{activeEnv.name} (env-specific)</option>
                </Select>
              </Field>
            )}
            <Toggle checked={draft.sensitive} onChange={(v) => setDraft((d) => ({ ...d, sensitive: v }))} label="Sensitive (goes to .env file)" />
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ── Utils Tab ── */

function UtilsTab({ projectId, activeEnv, envHex }: TabProps) {
  const { state, dispatch } = useApp()
  const { toast } = useToast()

  const allUtils = state.utils.filter((u) => u.projectId === projectId)
  const visibleUtils = allUtils.filter((u) =>
    !u.environmentId || u.environmentId === activeEnv?.id
  )

  const projectVars = state.variables.filter((v) => v.projectId === projectId).map((v) => v.key)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftLayer, setDraftLayer] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const openCreate = () => {
    setDraftName('')
    setDraftLayer(activeEnv?.id ?? null)
    setCreating(true)
  }

  const create = () => {
    if (!draftName.trim()) return
    const u: ReusableUtil = {
      id: crypto.randomUUID(), projectId,
      name: draftName.trim(), description: '', parameters: [], steps: [],
      environmentId: draftLayer,
    }
    dispatch({ type: 'CREATE_UTIL', util: u })
    toast(`Util "${u.name}" created`)
    setCreating(false)
    setDraftName('')
    setExpanded(u.id)
  }

  const update = (util: ReusableUtil) => dispatch({ type: 'UPDATE_UTIL', util })

  const addParam = (util: ReusableUtil) => {
    update({ ...util, parameters: [...util.parameters, { name: 'param' + (util.parameters.length + 1) }] })
  }

  const utilLayerBadge = (u: ReusableUtil) => {
    if (!u.environmentId) {
      return { label: 'Base', style: { color: '#777', borderColor: '#444', backgroundColor: '#2a2a2a' } }
    }
    const envs = state.projects.find((p) => p.id === projectId)?.environments ?? []
    const env = envs.find((e) => e.id === u.environmentId)
    const hex = env ? getEnvColor(env) : '#a855f7'
    return {
      label: env?.name ?? 'env',
      style: { color: hex, borderColor: `${hex}60`, backgroundColor: `${hex}18` },
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Btn variant="primary" size="sm" onClick={openCreate}>+ Add util</Btn>
      </div>
      {visibleUtils.length === 0 ? (
        <div className="border border-dashed border-vsc-border/60 rounded-sm p-8 text-center text-vsc-dim text-[10px]">
          No utils yet. Create reusable step sequences to share across test cases.
        </div>
      ) : (
        visibleUtils.map((u) => {
          const badge = utilLayerBadge(u)
          return (
            <div
              key={u.id}
              className="bg-vsc-panel border border-vsc-border rounded-sm overflow-hidden"
              style={u.environmentId && envHex ? { borderColor: `${envHex}40` } : undefined}
            >
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-vsc-hover transition-colors"
                onClick={() => setExpanded(expanded === u.id ? null : u.id)}
              >
                <span className="text-vsc-dim text-[10px]">{expanded === u.id ? '▾' : '▸'}</span>
                <span className="font-mono text-[12px] text-vsc-accent font-semibold">{u.name}</span>
                {u.parameters.length > 0 && (
                  <span className="text-[10px] text-vsc-muted font-mono">({u.parameters.map((p: UtilParameter) => p.name).join(', ')})</span>
                )}
                {/* Layer badge */}
                <span
                  className="text-[8px] border rounded-sm px-1.5 py-0.5 uppercase tracking-wide font-semibold"
                  style={badge.style}
                >
                  {badge.label}
                </span>
                <span className="text-[10px] text-vsc-dim ml-auto tabular-nums">{u.steps.length} steps</span>
                <button
                  className="text-vsc-dim hover:text-vsc-danger text-[11px] ml-2 transition-colors"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_UTIL', utilId: u.id }); toast('Util deleted', 'error') }}
                >×</button>
              </div>
              {expanded === u.id && (
                <div className="px-4 pb-4 border-t border-vsc-border">
                  <div className="flex gap-3 mt-3">
                    <Field label="Description">
                      <input
                        value={u.description}
                        onChange={(e) => update({ ...u, description: e.target.value })}
                        placeholder="What does this util do?"
                        className="bg-vsc-bg border border-vsc-border rounded-sm px-3 py-1.5 text-xs text-vsc-text focus:border-vsc-accent outline-none w-full transition-all"
                      />
                    </Field>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em]">Parameters</span>
                      <Btn variant="ghost" size="sm" onClick={() => addParam(u)}>+ Add param</Btn>
                    </div>
                    {u.parameters.map((param: UtilParameter, i: number) => (
                      <div key={i} className="flex gap-2 mb-1.5">
                        <Input
                          value={param.name}
                          onChange={(e) => {
                            const params = [...u.parameters]
                            params[i] = { ...param, name: e.target.value }
                            update({ ...u, parameters: params })
                          }}
                          placeholder="paramName"
                          className="!w-32"
                        />
                        <Input
                          value={param.defaultValue ?? ''}
                          onChange={(e) => {
                            const params = [...u.parameters]
                            params[i] = { ...param, defaultValue: e.target.value || undefined }
                            update({ ...u, parameters: params })
                          }}
                          placeholder="default value"
                        />
                        <button
                          className="text-vsc-dim hover:text-vsc-danger text-[11px] transition-colors"
                          onClick={() => update({ ...u, parameters: u.parameters.filter((_: UtilParameter, j: number) => j !== i) })}
                        >×</button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <span className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em] block mb-2">Steps</span>
                    <StepTable
                      steps={u.steps}
                      onChange={(steps) => update({ ...u, steps })}
                      variables={projectVars}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      {creating && (
        <Modal title="New util" onClose={() => setCreating(false)} footer={
          <><Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={create} disabled={!draftName.trim()}>Create</Btn></>
        }>
          <div className="flex flex-col gap-4">
            <Field label="Util name">
              <Input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="loginAsAdmin" onKeyDown={(e) => e.key === 'Enter' && create()} />
            </Field>
            {activeEnv && (
              <Field label="Layer" hint="Base utils are available in all environments">
                <Select
                  value={draftLayer ?? ''}
                  onChange={(e) => setDraftLayer(e.target.value || null)}
                >
                  <option value="">Base (shared across all environments)</option>
                  <option value={activeEnv.id}>{activeEnv.name} (env-specific)</option>
                </Select>
              </Field>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ── Fixtures Tab ── */

function FixturesTab({ projectId, activeEnv, envHex }: TabProps) {
  const { state, dispatch } = useApp()
  const { toast } = useToast()

  const allFixtures = state.fixtures.filter((fx) => fx.projectId === projectId)
  const visibleFixtures = allFixtures.filter((fx) =>
    !fx.environmentId || fx.environmentId === activeEnv?.id
  )

  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftLayer, setDraftLayer] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [jsonError, setJsonError] = useState<Record<string, string>>({})

  const openCreate = () => {
    setDraftName('')
    setDraftLayer(activeEnv?.id ?? null)
    setCreating(true)
  }

  const create = () => {
    if (!draftName.trim()) return
    const fx: Fixture = {
      id: crypto.randomUUID(), projectId,
      name: draftName.trim(),
      data: [{ key: 'value' }],
      environmentId: draftLayer,
    }
    dispatch({ type: 'CREATE_FIXTURE', fixture: fx })
    toast(`Fixture "${fx.name}" created`)
    setCreating(false)
    setDraftName('')
    setExpanded(fx.id)
  }

  const updateJson = (fx: Fixture, raw: string) => {
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('Must be an array')
      dispatch({ type: 'UPDATE_FIXTURE', fixture: { ...fx, data: parsed } })
      setJsonError((prev) => { const n = { ...prev }; delete n[fx.id]; return n })
    } catch (e) {
      setJsonError((prev) => ({ ...prev, [fx.id]: (e as Error).message }))
    }
  }

  const fixtureLayerBadge = (fx: Fixture) => {
    if (!fx.environmentId) {
      return { label: 'Base', style: { color: '#777', borderColor: '#444', backgroundColor: '#2a2a2a' } }
    }
    const envs = state.projects.find((p) => p.id === projectId)?.environments ?? []
    const env = envs.find((e) => e.id === fx.environmentId)
    const hex = env ? getEnvColor(env) : '#a855f7'
    return {
      label: env?.name ?? 'env',
      style: { color: hex, borderColor: `${hex}60`, backgroundColor: `${hex}18` },
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Btn variant="primary" size="sm" onClick={openCreate}>+ Add fixture</Btn>
      </div>
      {visibleFixtures.length === 0 ? (
        <div className="border border-dashed border-vsc-border/60 rounded-sm p-8 text-center text-vsc-dim text-[10px]">
          No fixtures yet. Fixtures provide data arrays for parameterized tests.
        </div>
      ) : (
        visibleFixtures.map((fx) => {
          const badge = fixtureLayerBadge(fx)
          return (
            <div
              key={fx.id}
              className="bg-vsc-panel border border-vsc-border rounded-sm overflow-hidden"
              style={fx.environmentId && envHex ? { borderColor: `${envHex}40` } : undefined}
            >
              <div
                className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-vsc-hover transition-colors"
                onClick={() => setExpanded(expanded === fx.id ? null : fx.id)}
              >
                <span className="text-vsc-dim text-[10px]">{expanded === fx.id ? '▾' : '▸'}</span>
                <span className="font-mono text-[12px] text-vsc-blue font-semibold">{fx.name}</span>
                {/* Layer badge */}
                <span
                  className="text-[8px] border rounded-sm px-1.5 py-0.5 uppercase tracking-wide font-semibold"
                  style={badge.style}
                >
                  {badge.label}
                </span>
                <span className="text-[10px] text-vsc-dim ml-auto tabular-nums">{fx.data.length} records</span>
                <button
                  className="text-vsc-dim hover:text-vsc-danger text-[11px] ml-2 transition-colors"
                  onClick={(e) => { e.stopPropagation(); dispatch({ type: 'DELETE_FIXTURE', fixtureId: fx.id }); toast('Fixture deleted', 'error') }}
                >×</button>
              </div>
              {expanded === fx.id && (
                <div className="px-4 pb-4 border-t border-vsc-border">
                  <p className="text-[10px] text-vsc-muted mt-3 mb-1.5 uppercase tracking-wide">Edit as JSON array:</p>
                  <div className="relative scanlines">
                    <textarea
                      rows={8}
                      defaultValue={JSON.stringify(fx.data, null, 2)}
                      onChange={(e) => updateJson(fx, e.target.value)}
                      className="w-full bg-vsc-code border border-vsc-border rounded-sm px-3 py-2 font-mono text-[11px] text-vsc-success focus:border-vsc-accent outline-none resize-y relative z-10 bg-transparent"
                    />
                  </div>
                  {jsonError[fx.id] && (
                    <p className="text-[10px] text-vsc-danger mt-1">{jsonError[fx.id]}</p>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {creating && (
        <Modal title="New fixture" onClose={() => setCreating(false)} footer={
          <><Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
          <Btn variant="primary" onClick={create} disabled={!draftName.trim()}>Create</Btn></>
        }>
          <div className="flex flex-col gap-4">
            <Field label="Fixture name">
              <Input autoFocus value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="validUsers" onKeyDown={(e) => e.key === 'Enter' && create()} />
            </Field>
            {activeEnv && (
              <Field label="Layer" hint="Base fixtures are available in all environments">
                <Select
                  value={draftLayer ?? ''}
                  onChange={(e) => setDraftLayer(e.target.value || null)}
                >
                  <option value="">Base (shared across all environments)</option>
                  <option value={activeEnv.id}>{activeEnv.name} (env-specific)</option>
                </Select>
              </Field>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
