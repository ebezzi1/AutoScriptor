import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { Field, Input, Select, Toggle } from '../components/common/Field'
import { Btn } from '../components/common/Btn'
import { StepTable } from '../components/steps/StepTable'
import type { Project, EnvProfile, AuthRole, AuthConfig } from '../types'
import { getEnvColor, AUTH_ROLE_COLORS, toKebab } from '../types'

const STANDARD_ENV_NAMES = ['dev', 'development', 'local', 'staging', 'stage', 'qa', 'uat', 'production', 'prod']

interface Props { projectId: string }

export function ProjectSettings({ projectId }: Props) {
  const { state, dispatch } = useApp()
  const { toast } = useToast()
  const project = state.projects.find((p) => p.id === projectId)
  const projectVars = state.variables.filter((v) => v.projectId === projectId && v.scope === 'project')
  const projectUtils = state.utils.filter((u) => u.projectId === projectId)

  if (!project) return <div className="p-8 text-vsc-muted text-xs">Project not found</div>

  const environments = project.environments ?? []
  const authConfig: AuthConfig = project.auth ?? { enabled: false, roles: [] }

  const update = <K extends keyof Project>(k: K, v: Project[K]) => {
    dispatch({
      type: 'UPDATE_PROJECT',
      project: { ...project, [k]: v, updatedAt: new Date().toISOString() },
    })
  }

  const updateAuth = (updated: AuthConfig) => update('auth', updated)

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

  const updateEnv = (updated: EnvProfile) => {
    const envs = environments.map((e) => e.id === updated.id ? updated : e)
    update('environments', envs)
  }

  const addEnv = () => {
    const newEnv: EnvProfile = { id: crypto.randomUUID(), name: 'new-env', baseUrl: '', variableOverrides: {} }
    update('environments', [...environments, newEnv])
  }

  const removeEnv = (envId: string) => {
    const envs = environments.filter((e) => e.id !== envId)
    const activeId = project.activeEnvironmentId === envId ? null : project.activeEnvironmentId
    dispatch({
      type: 'UPDATE_PROJECT',
      project: { ...project, environments: envs, activeEnvironmentId: activeId, updatedAt: new Date().toISOString() },
    })
  }

  const save = () => toast('Settings saved')

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <p className="text-[9px] text-vsc-accent uppercase tracking-[0.16em] mb-1.5">@ Configuration</p>
        <h1 className="text-xl font-semibold text-vsc-text tracking-tight">Project settings</h1>
      </div>

      <div className="flex flex-col gap-5">
        <Field label="Project name">
          <Input
            value={project.name}
            onChange={(e) => update('name', e.target.value)}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={project.description}
            onChange={(e) => update('description', e.target.value)}
            rows={2}
            className="w-full bg-vsc-bg border border-vsc-border rounded-sm px-3 py-1.5 text-xs text-vsc-text placeholder-vsc-dim focus:border-vsc-accent focus:shadow-[0_0_0_1px_rgba(200,152,32,0.15)] outline-none resize-none transition-all"
            placeholder="What does this project test?"
          />
        </Field>

        <div className="h-px bg-vsc-border/40" />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Language">
            <Select
              value={project.language}
              onChange={(e) => update('language', e.target.value as Project['language'])}
            >
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
            </Select>
          </Field>

          <Field label="Base URL">
            <Input
              value={project.baseUrl}
              onChange={(e) => update('baseUrl', e.target.value)}
              placeholder="https://staging.myapp.com"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Browser">
            <Select
              value={project.browser}
              onChange={(e) => update('browser', e.target.value as Project['browser'])}
            >
              <option value="chromium">Chromium</option>
              <option value="firefox">Firefox</option>
              <option value="webkit">WebKit</option>
              <option value="all">All browsers</option>
            </Select>
          </Field>

          <Field label="Default timeout (ms)">
            <Input
              type="number"
              value={project.defaultTimeout}
              onChange={(e) => update('defaultTimeout', Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Default selector strategy">
            <Select
              value={project.selectorStrategy}
              onChange={(e) => update('selectorStrategy', e.target.value as Project['selectorStrategy'])}
            >
              <option value="css">CSS</option>
              <option value="xpath">XPath</option>
              <option value="data-testid">data-testid</option>
              <option value="role">Role</option>
              <option value="text">Text</option>
              <option value="label">Label</option>
            </Select>
          </Field>

          <Field label="Retries">
            <Input
              type="number"
              min={0}
              max={5}
              value={project.retries}
              onChange={(e) => update('retries', Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Reporter">
            <Select
              value={project.reporter}
              onChange={(e) => update('reporter', e.target.value as Project['reporter'])}
            >
              <option value="html">HTML</option>
              <option value="json">JSON</option>
              <option value="junit">JUnit</option>
              <option value="list">List</option>
            </Select>
          </Field>
        </div>

        <div className="h-px bg-vsc-border/40" />

        <div className="pt-1">
          <Toggle
            checked={project.generatePOM}
            onChange={(v) => update('generatePOM', v)}
            label="Generate Page Object Model (POM)"
          />
        </div>

        <div className="h-px bg-vsc-border/40" />

        {/* Environment Profiles */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em] shrink-0">
              Environment Profiles
            </p>
            <div className="flex-1 h-px bg-vsc-border/50" />
            <button
              onClick={addEnv}
              className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-2 py-1 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all"
            >
              + Add
            </button>
          </div>

          {environments.length === 0 && (
            <p className="text-[10px] text-vsc-dim">No environments defined. Click + Add to create one.</p>
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
                    {projectVars.length === 0 && (
                      <p className="text-[10px] text-vsc-dim">No project-scope variables defined yet. Use Utils &amp; Parameters to add env-specific variables.</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="h-px bg-vsc-border/40" />

        {/* Authentication */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <p className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em] shrink-0">
              Authentication
            </p>
            <div className="flex-1 h-px bg-vsc-border/50" />
          </div>

          <div className="pt-1">
            <Toggle
              checked={authConfig.enabled}
              onChange={toggleAuth}
              label="Reuse auth state (storageState)"
            />
          </div>

          <div className={`mt-4 flex flex-col gap-4 ${authConfig.enabled ? '' : 'opacity-40 pointer-events-none select-none'}`}>
            {authConfig.roles.map((role) => {
              const canDelete = authConfig.roles.length > 1
              return (
                <details key={role.id} className="group">
                  <summary className="cursor-pointer list-none flex items-center gap-2 py-2 text-[9px] font-semibold text-vsc-muted uppercase tracking-[0.14em] hover:text-vsc-text transition-colors select-none">
                    <span className="group-open:rotate-90 transition-transform inline-block text-vsc-dim">▸</span>
                    <span className="w-2 h-2 rounded-full shrink-0 inline-block" style={{ backgroundColor: role.color }} />
                    <span>{role.name || 'Unnamed Role'}</span>
                    <span className="text-vsc-dim normal-case tracking-normal font-normal">
                      — {role.loginSteps.length} login step{role.loginSteps.length !== 1 ? 's' : ''}
                    </span>
                  </summary>

                  <div className="mt-2 bg-vsc-panel border border-vsc-border rounded-sm p-4 flex flex-col gap-4">
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
            })}

            <button
              onClick={addRole}
              className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-2 py-1 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all self-start"
            >
              + Add Role
            </button>
          </div>
        </div>

        <div className="pt-1">
          <Btn variant="primary" onClick={save}>Save settings</Btn>
        </div>
      </div>
    </div>
  )
}
