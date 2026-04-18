import { useState, useCallback } from 'react'
import { Modal } from './common/Modal'
import { Btn } from './common/Btn'
import { useAgent } from '../store/AgentContext'
import { useApp } from '../store/AppContext'
import { useToast } from './common/Toast'
import type { Feature, TestCase, Project } from '../types'
import {
  generateConfig,
  generateSpecFile,
  generateConstants,
  generateEnvFile,
  generateUtilHelper,
  generateFixtureFile,
} from '../lib/codeGenerator'

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

type RunMode = 'all' | 'feature' | 'tag' | 'priority'

interface Props {
  project: Project
  features: Feature[]
  testCases: TestCase[]
  onClose: () => void
}

export function BulkRunPanel({ project, features, testCases, onClose }: Props) {
  const { isConnected, runCommand, setShowSetupWizard, client } = useAgent()
  const { state, navigate } = useApp()
  const { toast } = useToast()
  const [mode, setMode] = useState<RunMode>('all')
  const [selectedFeatureId, setSelectedFeatureId] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('')
  const [headed, setHeaded] = useState(false)
  const [browser, setBrowser] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [showSetupPrompt, setShowSetupPrompt] = useState(false)

  // Collect unique tags from all test cases and features
  const allTags = Array.from(
    new Set([
      ...testCases.flatMap((tc) => tc.tags),
      ...features.flatMap((f) => f.tags),
    ])
  ).filter(Boolean).sort()

  const priorities = ['P0', 'P1', 'P2', 'P3'] as const

  // Named projects exist only when multi-role auth is configured
  const hasNamedProjects = !!(project.auth?.enabled && project.auth.roles.length > 1)

  function browserFlag(b: string): string {
    return hasNamedProjects ? `--project=${b}` : `--browser=${b}`
  }

  function buildCommand(): string {
    const parts = ['npx playwright test']

    if (mode === 'feature' && selectedFeatureId) {
      const f = features.find((f) => f.id === selectedFeatureId)
      if (f) parts.push(`tests/${slug(f.name)}/`)
    } else if (mode === 'tag' && selectedTag) {
      parts.push(`--grep "${selectedTag}"`)
    } else if (mode === 'priority' && selectedPriority) {
      parts.push(`--grep "@${selectedPriority}"`)
    }

    if (headed) parts.push('--headed')
    if (browser) parts.push(browserFlag(browser))

    return parts.join(' ')
  }

  const command = buildCommand()

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }, [])

  // Generate all files needed for a run and write them to the agent
  const syncFiles = useCallback(async (): Promise<boolean> => {
    if (!client) return false
    try {
      const ext = project.language === 'typescript' ? 'ts' : 'js'
      const vars = state.variables.filter((v) => v.projectId === project.id)
      const utils = state.utils.filter((u) => u.projectId === project.id)
      const fixtures = state.fixtures.filter((f) => f.projectId === project.id)
      const activeTCs = testCases.filter((tc) => !tc.disabled)

      const files: { filePath: string; content: string }[] = []

      // playwright.config
      files.push({ filePath: `playwright.config.${ext}`, content: generateConfig(project) })

      // constants + .env.test
      files.push({ filePath: `utils/constants.${ext}`, content: generateConstants(vars, project.language) })
      files.push({ filePath: '.env.test', content: generateEnvFile(vars) })

      // util helpers
      for (const util of utils) {
        files.push({
          filePath: `utils/${util.name}.helper.${ext}`,
          content: generateUtilHelper(util, vars, project.language),
        })
      }

      // fixtures
      for (const fx of fixtures) {
        files.push({
          filePath: `fixtures/${fx.name}.json`,
          content: generateFixtureFile(fx),
        })
      }

      // spec files per feature
      for (const f of features) {
        const fTCs = activeTCs.filter((tc) => tc.featureId === f.id)
        if (fTCs.length === 0) continue
        const specContent = generateSpecFile(f, fTCs, vars, utils, fixtures, project)
        files.push({
          filePath: `tests/${slug(f.name)}/${slug(f.name)}.spec.${ext}`,
          content: specContent,
        })
      }

      await client.writeBatch(files)
      return true
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to sync files', 'error')
      return false
    }
  }, [client, project, features, testCases, state.variables, state.utils, state.fixtures, toast])

  // Pre-run check: directory set? Playwright installed? Then sync + run
  const handleRunWithChecks = useCallback(async (cmd: string) => {
    if (!client || !isConnected) {
      setShowSetupWizard(true)
      onClose()
      return
    }

    // Check if directory is set
    if (!project.localDirectory) {
      toast('Set a project directory first', 'error')
      navigate({ type: 'project-settings', projectId: project.id })
      onClose()
      return
    }

    // Check project info
    try {
      const info = await client.getProjectInfo()
      if (!info.hasPlaywright) {
        setShowSetupPrompt(true)
        return
      }
    } catch {
      // If check fails, try to run anyway
    }

    // Sync files then run
    setSyncing(true)
    const synced = await syncFiles()
    setSyncing(false)
    if (!synced) return

    runCommand(cmd)
    onClose()
  }, [client, isConnected, project, syncFiles, runCommand, onClose, toast, navigate, setShowSetupWizard])

  const prebuilt: { label: string; cmd: string; key: string }[] = [
    { label: 'Run all tests', cmd: 'npx playwright test', key: 'all' },
    { label: 'Run headed', cmd: 'npx playwright test --headed', key: 'headed' },
    { label: 'Run Chromium only', cmd: `npx playwright test ${browserFlag('chromium')}`, key: 'chromium' },
    { label: 'Run Firefox only', cmd: `npx playwright test ${browserFlag('firefox')}`, key: 'firefox' },
    { label: 'Run WebKit only', cmd: `npx playwright test ${browserFlag('webkit')}`, key: 'webkit' },
    { label: 'Run smoke tests', cmd: 'npx playwright test --grep "@smoke"', key: 'smoke' },
    { label: 'Debug mode', cmd: 'npx playwright test --debug', key: 'debug' },
    { label: 'UI mode', cmd: 'npx playwright test --ui', key: 'ui' },
  ]

  const MODE_LABELS: Record<RunMode, string> = {
    all: 'All tests',
    feature: 'By feature',
    tag: 'By tag',
    priority: 'By priority',
  }

  // Build all commands (prebuilt + dynamic builder) with current options applied
  const dynamicPrebuilt = prebuilt.map((item) => {
    let cmd = item.cmd
    // Apply current headed/browser options to quick commands
    if (headed && !cmd.includes('--headed') && !cmd.includes('--debug') && !cmd.includes('--ui')) {
      cmd += ' --headed'
    }
    if (browser && !cmd.includes('--browser=') && !cmd.includes('--project=') && item.key !== 'chromium' && item.key !== 'firefox' && item.key !== 'webkit') {
      cmd += ` ${browserFlag(browser)}`
    }
    return { ...item, cmd }
  })

  return (
    <Modal
      title="Run Commands"
      onClose={onClose}
      footer={<Btn variant="ghost" onClick={onClose}>Close</Btn>}
    >
      <div className="flex flex-col gap-5 min-w-[600px]">

        {/* Options bar */}
        <div className="flex items-center gap-4 px-1">
          <label className="flex items-center gap-1.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={headed}
              onChange={(e) => setHeaded(e.target.checked)}
              className="w-3 h-3 accent-vsc-accent"
            />
            <span className="text-[10px] text-vsc-muted group-hover:text-vsc-text transition-colors">
              --headed
            </span>
          </label>

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-vsc-dim uppercase tracking-wide">Browser</span>
            <select
              value={browser}
              onChange={(e) => setBrowser(e.target.value)}
              className="bg-vsc-panel border border-vsc-border text-vsc-text text-[10px] px-1.5 py-0.5 rounded-sm outline-none focus:border-vsc-accent/50"
            >
              <option value="">all</option>
              <option value="chromium">chromium</option>
              <option value="firefox">firefox</option>
              <option value="webkit">webkit</option>
            </select>
          </div>

          {!isConnected && (
            <span className="text-[9px] text-vsc-dim ml-auto" title="Connect the agent to enable Run buttons">
              Agent not connected
            </span>
          )}
        </div>

        {/* Quick commands */}
        <div>
          <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-2">Quick commands</p>
          <div className="flex flex-col gap-1">
            {dynamicPrebuilt.map((item) => (
              <div
                key={item.key}
                className="flex flex-wrap items-start gap-2 bg-vsc-bg border border-vsc-border rounded-sm px-3 py-2"
              >
                <code className="flex-1 min-w-0 text-[11px] text-vsc-accent font-mono break-all leading-relaxed">
                  {item.cmd}
                </code>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleCopy(item.cmd, item.key)}
                    className="text-[9px] text-vsc-dim hover:text-vsc-accent transition-colors px-1.5 py-0.5 border border-vsc-border/50 rounded-sm hover:border-vsc-accent/40"
                  >
                    {copied === item.key ? '✓' : 'copy'}
                  </button>
                  <button
                    onClick={() => handleRunWithChecks(item.cmd)}
                    disabled={syncing || !isConnected}
                    className="text-[9px] font-medium text-white bg-vsc-accent hover:bg-vsc-accent-hover transition-colors px-1.5 py-0.5 rounded-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={!isConnected ? 'Connect the agent to run tests' : 'Run'}
                >
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <path d="M2 1l7 4-7 4V1z" fill="currentColor"/>
                  </svg>
                </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Command builder */}
        <div>
          <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-2">Command builder</p>
          <div className="bg-vsc-bg border border-vsc-border rounded-sm p-3 flex flex-col gap-3">

            {/* Mode selector */}
            <div className="flex gap-1.5">
              {(Object.keys(MODE_LABELS) as RunMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`text-[9px] uppercase tracking-wide px-2.5 py-1 rounded-sm border transition-all ${
                    mode === m
                      ? 'bg-vsc-accent/20 border-vsc-accent/50 text-vsc-accent'
                      : 'border-vsc-border text-vsc-dim hover:text-vsc-muted hover:border-vsc-border'
                  }`}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>

            {/* Conditional selectors */}
            {mode === 'feature' && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-vsc-dim uppercase tracking-wide">Feature</label>
                <select
                  value={selectedFeatureId}
                  onChange={(e) => setSelectedFeatureId(e.target.value)}
                  className="bg-vsc-panel border border-vsc-border text-vsc-text text-[11px] px-2 py-1.5 rounded-sm outline-none focus:border-vsc-accent/50"
                >
                  <option value="">— select feature —</option>
                  {features.map((f) => {
                    const count = testCases.filter((tc) => tc.featureId === f.id).length
                    return (
                      <option key={f.id} value={f.id}>
                        {f.name} ({count} test{count !== 1 ? 's' : ''})
                      </option>
                    )
                  })}
                </select>
                {selectedFeatureId && (
                  <p className="text-[9px] text-vsc-muted">
                    Path: <span className="text-vsc-accent font-mono">
                      tests/{slug(features.find((f) => f.id === selectedFeatureId)?.name ?? '')}/
                    </span>
                  </p>
                )}
              </div>
            )}

            {mode === 'tag' && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-vsc-dim uppercase tracking-wide">Tag</label>
                {allTags.length === 0 ? (
                  <p className="text-[10px] text-vsc-muted italic">No tags found in this project</p>
                ) : (
                  <select
                    value={selectedTag}
                    onChange={(e) => setSelectedTag(e.target.value)}
                    className="bg-vsc-panel border border-vsc-border text-vsc-text text-[11px] px-2 py-1.5 rounded-sm outline-none focus:border-vsc-accent/50"
                  >
                    <option value="">— select tag —</option>
                    {allTags.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {mode === 'priority' && (
              <div className="flex flex-col gap-1">
                <label className="text-[9px] text-vsc-dim uppercase tracking-wide">Priority</label>
                <select
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  className="bg-vsc-panel border border-vsc-border text-vsc-text text-[11px] px-2 py-1.5 rounded-sm outline-none focus:border-vsc-accent/50"
                >
                  <option value="">— select priority —</option>
                  {priorities.map((p) => {
                    const count = testCases.filter((tc) => tc.priority === p).length
                    return (
                      <option key={p} value={p}>
                        {p} — {count} test{count !== 1 ? 's' : ''}
                      </option>
                    )
                  })}
                </select>
                <p className="text-[9px] text-vsc-muted">
                  Matches test cases tagged <span className="font-mono text-vsc-accent">@{selectedPriority || 'Px'}</span> — add the priority as a tag on your test cases
                </p>
              </div>
            )}

            {/* Generated command output */}
            <div className="flex flex-wrap items-start gap-2 bg-vsc-sidebar border border-vsc-accent/30 rounded-sm px-3 py-2">
              <code className="flex-1 min-w-0 text-[12px] text-vsc-accent font-mono break-all leading-relaxed">
                {command}
              </code>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => handleCopy(command, 'builder')}
                  className="text-[9px] text-vsc-dim hover:text-vsc-accent transition-colors px-1.5 py-0.5 border border-vsc-border/50 rounded-sm hover:border-vsc-accent/40"
                >
                  {copied === 'builder' ? '✓' : 'copy'}
                </button>
                <button
                  onClick={() => handleRunWithChecks(command)}
                  disabled={syncing || !isConnected}
                  className="text-[9px] font-medium text-white bg-vsc-accent hover:bg-vsc-accent-hover transition-colors px-2.5 py-1 rounded-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={!isConnected ? 'Connect the agent to run tests' : 'Run'}
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none" className="shrink-0">
                        <path d="M2 1l7 4-7 4V1z" fill="currentColor"/>
                      </svg>
                      Run
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Playwright not installed prompt */}
        {showSetupPrompt && (
          <div className="bg-vsc-bg border border-amber-500/30 rounded-sm p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-amber-400 shrink-0">
                <path d="M8 1L1 14h14L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M8 6v3M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p className="text-xs text-vsc-text font-medium">Playwright is not installed in this directory.</p>
            </div>
            <p className="text-[10px] text-vsc-muted">Set up the project directory first to install Playwright and its dependencies.</p>
            <div className="flex items-center gap-2">
              <Btn variant="primary" size="sm" onClick={() => {
                navigate({ type: 'project-settings', projectId: project.id })
                onClose()
              }}>
                Setup
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => setShowSetupPrompt(false)}>
                Cancel
              </Btn>
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}
