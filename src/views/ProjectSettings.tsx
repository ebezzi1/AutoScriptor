import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { useAgent } from '../store/AgentContext'
import { Field, Input, Select, Toggle } from '../components/common/Field'
import { Btn } from '../components/common/Btn'
import { CiCdPanel } from '../components/CiCdPanel'
import { ProjectDirectorySettings } from '../components/project/ProjectDirectorySettings'
import type { Project, CiCdConfig } from '../types'
import { CI_PLATFORM_META } from '../types'

interface Props { projectId: string }

export function ProjectSettings({ projectId }: Props) {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const { agentUrl, agentToken, setAgentUrl, setAgentToken, saveSettings, testConnection, setShowSetupWizard, isConnected, consecutiveFailures } = useAgent()
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; version?: string; uptime?: number; error?: string } | null>(null)
  const [showCicd, setShowCicd] = useState(false)
  const project = state.projects.find((p) => p.id === projectId)

  if (!project) return <div className="p-8 text-vsc-muted text-xs">Project not found</div>

  const update = <K extends keyof Project>(k: K, v: Project[K]) => {
    dispatch({
      type: 'UPDATE_PROJECT',
      project: { ...project, [k]: v, updatedAt: new Date().toISOString() },
    })
  }

  const saveCicd = (cfg: CiCdConfig) => {
    update('cicd', cfg)
    setShowCicd(false)
    toast('CI/CD config saved')
  }

  const save = () => toast('Settings saved')

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    const result = await testConnection()
    setTestResult(result)
    setTesting(false)
  }

  const handleSaveAgentSettings = async () => {
    try {
      await saveSettings()
      toast('Agent settings saved')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save', 'error')
    }
  }

  const cicdPlatformList = (project.cicd?.platforms ?? []).map((p) => CI_PLATFORM_META[p].name).join(', ')

  return (
    <div className="py-10 px-6 max-w-3xl mx-auto">
      <div className="mb-10">
        <p className="text-[9px] text-vsc-accent uppercase tracking-[0.16em] mb-1.5">@ Configuration</p>
        <h1 className="text-xl font-semibold text-vsc-text tracking-tight">Project settings</h1>
      </div>

      <div className="flex flex-col gap-8">
        {/* ── General ──────────────────────────────────────────── */}
        <section>
          <SectionTitle>General</SectionTitle>
          <div className="flex flex-col gap-4">
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
          </div>
        </section>

        <div className="h-px bg-vsc-border/30" />

        {/* ── Test Configuration ───────────────────────────────── */}
        <section>
          <SectionTitle>Test Configuration</SectionTitle>
          <div className="flex flex-col gap-4">
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

            <div className="pt-1">
              <Toggle
                checked={project.generatePOM}
                onChange={(v) => update('generatePOM', v)}
                label="Generate Page Object Model (POM)"
              />
            </div>
          </div>
        </section>

        <div className="h-px bg-vsc-border/30" />

        {/* ── CI/CD ────────────────────────────────────────────── */}
        <section>
          <SectionTitle>CI/CD</SectionTitle>
          <div className="flex items-center justify-between gap-4">
            <p className="text-[10px] text-vsc-dim leading-relaxed">
              {project.cicd && project.cicd.platforms.length > 0
                ? <>Configured for <span className="text-vsc-muted">{cicdPlatformList}</span>.</>
                : <>No CI/CD pipelines configured.</>}
            </p>
            <Btn variant="ghost" size="sm" onClick={() => setShowCicd(true)}>
              {project.cicd && project.cicd.platforms.length > 0 ? 'Edit CI/CD' : 'Configure CI/CD'}
            </Btn>
          </div>
        </section>

        <div className="h-px bg-vsc-border/30" />

        {/* ── Local Project ────────────────────────────────────── */}
        <ProjectDirectorySettings
          projectId={project.id}
          projectName={project.name}
          localDirectory={project.localDirectory}
          onDirectoryChange={(dir) => update('localDirectory', dir)}
        />

        <div className="h-px bg-vsc-border/30" />

        {/* ── Agent Connection ────────────────────────────────── */}
        <section>
          <SectionTitle>Agent Connection</SectionTitle>

          <p className="text-[10px] text-vsc-dim mb-4">
            Connect to a running <code className="font-mono text-vsc-muted">autoscriptor-agent</code> to run tests, sync files, and open reports locally.
            Agent settings are saved per project.
          </p>

          {/* Reconnect banner when agent configured but unreachable */}
          {agentToken && !isConnected && consecutiveFailures > 0 && (
            <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-vsc-muted">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="flex-1">Agent not reachable. Is it running?</span>
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="text-[10px] text-vsc-accent hover:text-white font-medium transition-colors shrink-0"
              >
                {testing ? 'Reconnecting…' : 'Reconnect'}
              </button>
              <button
                onClick={() => setShowSetupWizard(true)}
                className="text-[10px] text-vsc-dim hover:text-vsc-accent transition-colors shrink-0"
              >
                Setup Agent
              </button>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <Field label="Agent URL">
              <Input
                value={agentUrl}
                onChange={(e) => setAgentUrl(e.target.value)}
                placeholder="http://localhost:4567"
              />
            </Field>

            <Field label="Agent token">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showToken ? 'text' : 'password'}
                    value={agentToken}
                    onChange={(e) => setAgentToken(e.target.value)}
                    placeholder="Paste token from agent startup output"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-vsc-dim hover:text-vsc-muted transition-colors"
                    title={showToken ? 'Hide token' : 'Show token'}
                  >
                    {showToken ? (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M1 6.5C1 6.5 3 2.5 6.5 2.5S12 6.5 12 6.5 10 10.5 6.5 10.5 1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.2"/>
                        <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M2 2l9 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M1 6.5C1 6.5 3 2.5 6.5 2.5S12 6.5 12 6.5 10 10.5 6.5 10.5 1 6.5 1 6.5z" stroke="currentColor" strokeWidth="1.2"/>
                        <circle cx="6.5" cy="6.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </Field>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleTestConnection}
                disabled={testing || !agentToken}
                className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {testing ? 'Testing…' : 'Test connection'}
              </button>

              <Btn variant="primary" size="sm" onClick={handleSaveAgentSettings}>
                Save agent settings
              </Btn>

              {testResult && (
                <span className={`text-[10px] flex items-center gap-1.5 ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {testResult.ok ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 5.5l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      v{testResult.version} · up {Math.floor((testResult.uptime ?? 0) / 1000)}s
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                        <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                      </svg>
                      {testResult.error}
                    </>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSetupWizard(true)}
                className="text-[9px] uppercase tracking-wider border border-vsc-border text-vsc-muted px-3 py-1.5 rounded-sm hover:border-vsc-accent/60 hover:text-vsc-accent transition-all flex items-center gap-1.5"
              >
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2h8v8H2V2z" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 4.5l3 1.5-3 1.5v-3z" fill="currentColor"/>
                </svg>
                Re-run Setup Wizard
              </button>
            </div>

            <p className="text-[10px] text-vsc-dim/70">
              Start the agent:{' '}
              <code className="font-mono text-vsc-muted bg-vsc-hover px-1 py-0.5 rounded">
                npm i -g autoscriptor-agent && autoscriptor-agent start
              </code>
            </p>
          </div>
        </section>

        <div className="pt-2 flex items-center gap-3">
          <Btn variant="primary" onClick={save}>Save settings</Btn>
          <button
            onClick={() => navigate({ type: 'utils', projectId })}
            className="text-[10px] text-vsc-dim hover:text-vsc-accent transition-colors"
          >
            Manage environments &amp; auth roles in Utils &amp; Params →
          </button>
        </div>
      </div>

      {showCicd && (
        <CiCdPanel
          project={project}
          onSave={saveCicd}
          onClose={() => setShowCicd(false)}
        />
      )}
    </div>
  )
}

function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-center gap-3 mb-4 ${className}`}>
      <p className="text-[10px] font-semibold text-vsc-dim uppercase tracking-[0.14em] shrink-0">
        {children}
      </p>
      <div className="flex-1 h-px bg-vsc-border/40" />
    </div>
  )
}
