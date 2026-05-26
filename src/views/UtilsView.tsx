import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common/Modal'
import { Btn } from '../components/common/Btn'
import { Field, Input, Select, Toggle } from '../components/common/Field'
import { StepTable } from '../components/steps/StepTable'
import type {
  GlobalVariable, ReusableUtil, Fixture, UtilParameter,
  EnvProfile, AuthRole, AuthConfig, Project,
} from '../types'
import { getEnvColor, AUTH_ROLE_COLORS, toKebab } from '../types'

const STANDARD_ENV_NAMES = ['dev', 'development', 'local', 'staging', 'stage', 'qa', 'uat', 'production', 'prod']

interface Props { projectId: string }

interface TabProps {
  projectId: string
  activeEnv: EnvProfile | null
  envHex: string | null
}

type TabKey = 'variables' | 'utils' | 'fixtures' | 'environments' | 'auth'

export function UtilsView({ projectId }: Props) {
  const { state } = useApp()
  const project = state.projects.find((p) => p.id === projectId)
  const activeEnv = project?.environments?.find((e) => e.id === project?.activeEnvironmentId) ?? null
  const envHex = activeEnv ? getEnvColor(activeEnv) : null

  const [tab, setTab] = useState<TabKey>('variables')

  const tabs: { id: TabKey; label: string }[] = [
    { id: 'variables', label: 'Variables' },
    { id: 'utils', label: 'Utils' },
    { id: 'fixtures', label: 'Fixtures' },
    { id: 'environments', label: 'Environments' },
    { id: 'auth', label: 'Auth Roles' },
  ]

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
          <span>{activeEnv ? activeEnv.name : 'Global'}</span>
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
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`px-4 py-2 text-[10px] transition-all uppercase tracking-widest border-b-2 -mb-px ${
              tab === t.id
                ? 'border-vsc-accent text-vsc-accent'
                : 'border-transparent text-vsc-muted hover:text-vsc-text'
            }`}
            style={tab === t.id && envHex ? { borderBottomColor: envHex, color: envHex } : undefined}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'variables' && <VariablesTab projectId={projectId} activeEnv={activeEnv} envHex={envHex} />}
      {tab === 'utils' && <UtilsTab projectId={projectId} activeEnv={activeEnv} envHex={envHex} />}
      {tab === 'fixtures' && <FixturesTab projectId={projectId} activeEnv={activeEnv} envHex={envHex} />}
      {tab === 'environments' && <EnvironmentsTab projectId={projectId} activeEnv={activeEnv} envHex={envHex} />}
      {tab === 'auth' && <AuthRolesTab projectId={projectId} activeEnv={activeEnv} envHex={envHex} />}
    </div>
  )
}

/* ── Variables Tab ── */

function VariablesTab({ projectId, envHex }: TabProps) {
  const { state, dispatch } = useApp()
  const { toast } = useToast()
  const features = state.features.filter((f) => f.projectId === projectId)
  const project = state.projects.find((p) => p.id === projectId)
  const environments = project?.environments ?? []

  // All variables (both Global and env-specific). Sort: Global first, then by env, then by key.
  const allVars = state.variables
    .filter((v) => v.projectId === projectId)
    .slice()
    .sort((a, b) => {
      const aGlobal = !a.environmentId, bGlobal = !b.environmentId
      if (aGlobal !== bGlobal) return aGlobal ? -1 : 1
      if (a.environmentId !== b.environmentId) return (a.environmentId ?? '').localeCompare(b.environmentId ?? '')
      return a.key.localeCompare(b.key)
    })

  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Omit<GlobalVariable, 'id' | 'projectId'>>({
    key: '', value: '', scope: 'project', sensitive: false, environmentId: null,
  })

  const openCreate = () => {
    setDraft({ key: '', value: '', scope: 'project', sensitive: false, environmentId: null })
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

  const updateVar = (v: GlobalVariable) => dispatch({ type: 'UPDATE_VAR', variable: v })

  const envBadge = (v: GlobalVariable): { label: string; style: React.CSSProperties } | null => {
    if (!v.environmentId) return null
    const env = environments.find((e) => e.id === v.environmentId)
    if (!env) return { label: 'unknown', style: { color: '#777', borderColor: '#444', backgroundColor: '#2a2a2a' } }
    const hex = getEnvColor(env)
    return {
      label: env.name,
      style: { color: hex, borderColor: `${hex}60`, backgroundColor: `${hex}18` },
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Btn variant="primary" size="sm" onClick={openCreate}>+ Add variable</Btn>
      </div>
      {allVars.length === 0 ? (
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
                {['Key', 'Value', 'Environment', 'Scope', 'Type', ''].map((h) => (
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
              {allVars.map((v) => {
                const badge = envBadge(v)
                return (
                  <tr key={v.id} className="border-b border-vsc-border/30 group hover:bg-vsc-hover/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-vsc-accent text-[11px]">{`{{${v.key}}}`}</td>
                    <td className="px-3 py-2 text-vsc-muted font-mono text-[11px]">
                      {v.sensitive ? '••••••••' : v.value}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {badge && (
                          <span
                            className="text-[8px] border rounded-sm px-1.5 py-0.5 uppercase tracking-wide font-semibold"
                            style={badge.style}
                          >
                            {badge.label}
                          </span>
                        )}
                        <select
                          value={v.environmentId ?? ''}
                          onChange={(e) => updateVar({ ...v, environmentId: e.target.value || null })}
                          className="bg-transparent border border-vsc-border/40 rounded-sm px-1.5 py-0.5 text-[10px] text-vsc-muted focus:border-vsc-accent outline-none transition-all opacity-0 group-hover:opacity-100"
                          title="Change environment"
                        >
                          <option value="">Global</option>
                          {environments.map((e) => (
                            <option key={e.id} value={e.id}>{e.name}</option>
                          ))}
                        </select>
                      </div>
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
            <Field label="Environment" hint="Global variables apply everywhere; env-specific ones only when that env is active">
              <Select
                value={draft.environmentId ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, environmentId: e.target.value || null }))}
              >
                <option value="">Global (all environments)</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>{env.name} (env-specific)</option>
                ))}
              </Select>
            </Field>
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

/* ── Environments Tab ── */

function EnvironmentsTab({ projectId }: TabProps) {
  const { state, dispatch } = useApp()
  const { toast } = useToast()
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return null

  const environments = project.environments ?? []
  const projectVars = state.variables.filter((v) => v.projectId === projectId && v.scope === 'project')

  const updateProject = (updates: Partial<Project>) => {
    dispatch({
      type: 'UPDATE_PROJECT',
      project: { ...project, ...updates, updatedAt: new Date().toISOString() },
    })
  }

  const updateEnv = (updated: EnvProfile) => {
    updateProject({ environments: environments.map((e) => e.id === updated.id ? updated : e) })
  }

  const addEnv = () => {
    const newEnv: EnvProfile = { id: crypto.randomUUID(), name: 'new-env', baseUrl: '', variableOverrides: {} }
    updateProject({ environments: [...environments, newEnv] })
    toast('Environment added')
  }

  const removeEnv = (envId: string) => {
    const envs = environments.filter((e) => e.id !== envId)
    const activeId = project.activeEnvironmentId === envId ? null : project.activeEnvironmentId
    dispatch({
      type: 'UPDATE_PROJECT',
      project: { ...project, environments: envs, activeEnvironmentId: activeId, updatedAt: new Date().toISOString() },
    })
    toast('Environment removed', 'error')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] text-vsc-dim leading-relaxed">
          Define environments for this project. The active environment is selected from the top-bar switcher.
        </p>
        <Btn variant="primary" size="sm" onClick={addEnv}>+ Add environment</Btn>
      </div>

      {environments.length === 0 && (
        <div className="border border-dashed border-vsc-border/60 rounded-sm p-8 text-center text-vsc-dim text-[10px]">
          No environments defined. Click <span className="text-vsc-accent">+ Add environment</span> to create one.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {environments.map((env) => {
          const envHex = getEnvColor(env)
          const isStandard = STANDARD_ENV_NAMES.includes(env.name.toLowerCase().trim())
          return (
            <div key={env.id} className="border rounded-sm bg-vsc-panel overflow-hidden" style={{ borderColor: `${envHex}50` }}>
              {/* Env header */}
              <div className="flex items-center gap-3 px-3 py-2 border-b bg-vsc-hover" style={{ borderColor: `${envHex}30` }}>
                <span
                  className="text-[9px] uppercase tracking-widest shrink-0 font-semibold"
                  style={{ color: envHex }}
                >
                  ● env
                </span>
                <input
                  value={env.name}
                  onChange={(e) => updateEnv({ ...env, name: e.target.value })}
                  className="flex-1 bg-transparent text-[11px] font-semibold text-vsc-text outline-none border-b border-transparent focus:border-vsc-accent pb-0.5 transition-all"
                  placeholder="environment name"
                />
                {/* Color picker for non-standard env names */}
                {!isStandard && (
                  <input
                    type="color"
                    value={env.color ?? '#a855f7'}
                    onChange={(e) => updateEnv({ ...env, color: e.target.value })}
                    className="w-6 h-6 rounded-sm border border-vsc-border cursor-pointer p-0 overflow-hidden"
                    title="Pick environment color"
                  />
                )}
                <button
                  onClick={() => removeEnv(env.id)}
                  className="text-[9px] text-vsc-dim hover:text-vsc-danger transition-colors uppercase tracking-wide shrink-0"
                >
                  Remove
                </button>
              </div>

              <div className="p-3 flex flex-col gap-3">
                {/* Base URL override */}
                <Field label="Base URL override">
                  <input
                    value={env.baseUrl}
                    onChange={(e) => updateEnv({ ...env, baseUrl: e.target.value })}
                    placeholder={project.baseUrl || 'https://example.com'}
                    className="w-full bg-vsc-bg border border-vsc-border rounded-sm px-3 py-1.5 text-xs text-vsc-text placeholder-vsc-dim focus:border-vsc-accent focus:shadow-[0_0_0_1px_rgba(200,152,32,0.15)] outline-none transition-all"
                  />
                </Field>

                {/* Variable overrides (legacy — quick value overrides) */}
                {projectVars.length > 0 && (
                  <div>
                    <p className="text-[9px] font-medium text-vsc-muted uppercase tracking-[0.12em] mb-2">
                      Variable overrides
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {projectVars.map((v) => (
                        <div key={v.id} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-vsc-dim w-28 shrink-0 truncate" title={v.key}>
                            {v.key}
                          </span>
                          <input
                            value={env.variableOverrides[v.key] ?? ''}
                            onChange={(e) => {
                              const overrides = { ...env.variableOverrides }
                              if (e.target.value === '') {
                                delete overrides[v.key]
                              } else {
                                overrides[v.key] = e.target.value
                              }
                              updateEnv({ ...env, variableOverrides: overrides })
                            }}
                            placeholder={`default: ${v.sensitive ? '••••' : (v.value || '(empty)')}`}
                            className="flex-1 bg-vsc-bg border border-vsc-border rounded-sm px-2 py-1 text-[10px] text-vsc-text placeholder-vsc-dim focus:border-vsc-accent outline-none transition-all font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Auth Roles Tab ── */

function AuthRolesTab({ projectId }: TabProps) {
  const { state, dispatch } = useApp()
  const { toast } = useToast()
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return null

  const projectVars = state.variables.filter((v) => v.projectId === projectId && v.scope === 'project')
  const projectUtils = state.utils.filter((u) => u.projectId === projectId)
  const authConfig: AuthConfig = project.auth ?? { enabled: false, roles: [] }

  const updateProject = (updates: Partial<Project>) => {
    dispatch({
      type: 'UPDATE_PROJECT',
      project: { ...project, ...updates, updatedAt: new Date().toISOString() },
    })
  }

  const updateAuth = (updated: AuthConfig) => updateProject({ auth: updated })

  const updateRole = (updated: AuthRole) =>
    updateAuth({ ...authConfig, roles: authConfig.roles.map((r) => r.id === updated.id ? updated : r) })

  const handleRoleNameChange = (role: AuthRole, newName: string) => {
    const wasAutoPath = role.storageStatePath === `.auth/${toKebab(role.name)}.json`
    updateRole({
      ...role,
      name: newName,
      storageStatePath: wasAutoPath ? `.auth/${toKebab(newName)}.json` : role.storageStatePath,
    })
  }

  const addRole = () => {
    const idx = authConfig.roles.length % AUTH_ROLE_COLORS.length
    const newRole: AuthRole = {
      id: crypto.randomUUID(),
      name: 'New Role',
      storageStatePath: '.auth/new-role.json',
      color: AUTH_ROLE_COLORS[idx],
      loginSteps: [],
    }
    updateAuth({ ...authConfig, roles: [...authConfig.roles, newRole] })
  }

  const removeRole = (roleId: string) =>
    updateAuth({ ...authConfig, roles: authConfig.roles.filter((r) => r.id !== roleId) })

  const toggleAuth = (enabled: boolean) => {
    if (enabled && authConfig.roles.length === 0) {
      updateAuth({
        enabled: true,
        roles: [{
          id: crypto.randomUUID(),
          name: 'Default User',
          storageStatePath: '.auth/default-user.json',
          color: AUTH_ROLE_COLORS[0],
          loginSteps: [],
        }],
      })
    } else {
      updateAuth({ ...authConfig, enabled })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] text-vsc-dim leading-relaxed max-w-md">
          Auth roles capture login flows and reuse storage state across tests. Assign a role to each test case in the test case editor.
        </p>
        <div className="shrink-0 pt-0.5">
          <Toggle
            checked={authConfig.enabled}
            onChange={toggleAuth}
            label="Reuse auth state"
          />
        </div>
      </div>

      <div className={`flex flex-col gap-3 ${authConfig.enabled ? '' : 'opacity-40 pointer-events-none select-none'}`}>
        {authConfig.roles.length === 0 ? (
          <div className="border border-dashed border-vsc-border/60 rounded-sm p-8 text-center text-vsc-dim text-[10px]">
            No auth roles defined. Click <span className="text-vsc-accent">+ Add Role</span> to create one.
          </div>
        ) : (
          authConfig.roles.map((role) => {
            const canDelete = authConfig.roles.length > 1
            return (
              <details key={role.id} className="group bg-vsc-panel border border-vsc-border rounded-sm overflow-hidden">
                <summary className="cursor-pointer list-none flex items-center gap-2 px-4 py-3 text-[10px] font-semibold text-vsc-muted uppercase tracking-[0.14em] hover:text-vsc-text transition-colors select-none">
                  <span className="group-open:rotate-90 transition-transform inline-block text-vsc-dim">▸</span>
                  <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: role.color }} />
                  <span>{role.name || 'Unnamed Role'}</span>
                  <span className="text-vsc-dim normal-case tracking-normal font-normal">
                    — {role.loginSteps.length} login step{role.loginSteps.length !== 1 ? 's' : ''}
                  </span>
                </summary>

                <div className="px-4 pb-4 border-t border-vsc-border flex flex-col gap-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Role name">
                      <Input
                        value={role.name}
                        onChange={(e) => handleRoleNameChange(role, e.target.value)}
                        placeholder="admin"
                      />
                    </Field>
                    <Field label="Storage state path">
                      <Input
                        value={role.storageStatePath}
                        onChange={(e) => updateRole({ ...role, storageStatePath: e.target.value })}
                        placeholder=".auth/admin.json"
                        className="font-mono"
                      />
                    </Field>
                  </div>

                  <div>
                    <p className="text-[10px] font-medium text-vsc-muted uppercase tracking-[0.12em] mb-2">Color</p>
                    <div className="flex gap-2">
                      {AUTH_ROLE_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => updateRole({ ...role, color: c })}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${
                            role.color === c
                              ? 'border-vsc-text scale-110'
                              : 'border-transparent hover:border-vsc-muted'
                          }`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-medium text-vsc-muted uppercase tracking-[0.12em] mb-2">Login steps</p>
                    <StepTable
                      steps={role.loginSteps}
                      onChange={(loginSteps) => updateRole({ ...role, loginSteps })}
                      variables={projectVars.map((v) => v.key)}
                      availableUtils={projectUtils}
                      projectId={projectId}
                    />
                  </div>

                  {canDelete && (
                    <div className="flex justify-end">
                      <Btn variant="danger" size="sm" onClick={() => removeRole(role.id)}>
                        Remove role
                      </Btn>
                    </div>
                  )}
                </div>
              </details>
            )
          })
        )}

        <div>
          <button
            onClick={addRole}
            className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-2 py-1 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all"
          >
            + Add Role
          </button>
        </div>
      </div>
    </div>
  )
}
