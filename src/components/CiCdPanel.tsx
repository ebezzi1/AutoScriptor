import { useState, useCallback } from 'react'
import { CodeBlock } from './CodeBlock'
import { Field, Toggle } from './common/Field'
import { Btn } from './common/Btn'
import { ChipInput } from './common/ChipInput'
import { generateCiConfig } from '../lib/ciConfigGenerator'
import {
  DEFAULT_CICD_CONFIG,
  CI_PLATFORM_META,
} from '../types'
import type { Project, CiCdConfig, CiPlatform } from '../types'

interface Props {
  project: Project
  onSave: (cfg: CiCdConfig) => void
  onClose: () => void
}

const PLATFORM_ICONS: Record<CiPlatform, string> = {
  github: 'GH',
  gitlab: 'GL',
  azure: 'AZ',
  jenkins: 'JK',
}

export function CiCdPanel({ project, onSave, onClose }: Props) {
  const [cfg, setCfg] = useState<CiCdConfig>(project.cicd ?? DEFAULT_CICD_CONFIG)
  const [activeTab, setActiveTab] = useState<CiPlatform>(cfg.platforms[0] ?? 'github')

  const update = useCallback((partial: Partial<CiCdConfig>) => {
    setCfg((prev) => ({ ...prev, ...partial }))
  }, [])

  const togglePlatform = (platform: CiPlatform) => {
    const has = cfg.platforms.includes(platform)
    if (has && cfg.platforms.length === 1) return // keep at least one
    const next = has ? cfg.platforms.filter((p) => p !== platform) : [...cfg.platforms, platform]
    update({ platforms: next })
    if (has && activeTab === platform) setActiveTab(next[0])
    if (!has) setActiveTab(platform)
  }

  const handleDownload = (platform: CiPlatform) => {
    const content = generateCiConfig(project, cfg, platform)
    const meta = CI_PLATFORM_META[platform]
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = meta.filename.split('/').pop()!
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCopy = async (platform: CiPlatform) => {
    await navigator.clipboard.writeText(generateCiConfig(project, cfg, platform))
  }

  const activePlatforms = cfg.platforms.length > 0 ? cfg.platforms : ['github' as CiPlatform]
  const safeTab = activePlatforms.includes(activeTab) ? activeTab : activePlatforms[0]

  const activeConfig = generateCiConfig(project, cfg, safeTab)
  const activeMeta = CI_PLATFORM_META[safeTab]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-vsc-panel border border-vsc-border rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-vsc-border shrink-0">
          <div>
            <h2 className="text-base font-bold text-vsc-text">CI/CD Config Generator</h2>
            <p className="text-xs text-vsc-dim mt-0.5">{project.name}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Btn variant="ghost" size="sm" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" size="sm" onClick={() => { onSave(cfg); onClose() }}>
              Save config
            </Btn>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Options panel */}
          <div className="w-72 shrink-0 border-r border-vsc-border overflow-y-auto p-6 flex flex-col gap-6">

            {/* Platforms */}
            <div>
              <p className="text-xs font-semibold text-vsc-dim uppercase tracking-widest mb-3">Platforms</p>
              <div className="flex flex-col gap-2">
                {(Object.keys(CI_PLATFORM_META) as CiPlatform[]).map((platform) => {
                  const meta = CI_PLATFORM_META[platform]
                  const selected = cfg.platforms.includes(platform)
                  return (
                    <button
                      key={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`flex items-center gap-3 w-full px-3.5 py-2.5 rounded-lg border transition-all text-left ${
                        selected
                          ? 'border-vsc-accent/50 bg-vsc-accent/8 text-vsc-text'
                          : 'border-vsc-border text-vsc-muted hover:border-vsc-border/80 hover:bg-vsc-hover'
                      }`}
                    >
                      <span className={`text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded shrink-0 ${
                        selected ? 'bg-vsc-accent text-white' : 'bg-vsc-active text-vsc-dim'
                      }`}>
                        {PLATFORM_ICONS[platform]}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">{meta.name}</div>
                        <div className="text-xs text-vsc-dim font-mono truncate mt-0.5">{meta.filename}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Node version */}
            <div>
              <p className="text-xs font-semibold text-vsc-dim uppercase tracking-widest mb-3">Node.js version</p>
              <div className="flex gap-2">
                {(['18', '20', '22'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => update({ nodeVersion: v })}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-lg border transition-all ${
                      cfg.nodeVersion === v
                        ? 'border-vsc-accent/50 bg-vsc-accent/10 text-vsc-accent'
                        : 'border-vsc-border text-vsc-muted hover:border-vsc-border/80'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Package manager */}
            <div>
              <p className="text-xs font-semibold text-vsc-dim uppercase tracking-widest mb-3">Package manager</p>
              <div className="flex gap-2">
                {(['npm', 'yarn', 'pnpm'] as const).map((pm) => (
                  <button
                    key={pm}
                    onClick={() => update({ packageManager: pm })}
                    className={`flex-1 py-1.5 text-sm font-semibold rounded-lg border transition-all ${
                      cfg.packageManager === pm
                        ? 'border-vsc-accent/50 bg-vsc-accent/10 text-vsc-accent'
                        : 'border-vsc-border text-vsc-muted hover:border-vsc-border/80'
                    }`}
                  >
                    {pm}
                  </button>
                ))}
              </div>
            </div>

            {/* Triggers */}
            <div>
              <p className="text-xs font-semibold text-vsc-dim uppercase tracking-widest mb-3">Triggers</p>
              <div className="flex flex-col gap-3">
                <Toggle
                  checked={cfg.pullRequests}
                  onChange={(v) => update({ pullRequests: v })}
                  label="Pull request"
                />
                <Toggle
                  checked={cfg.manualTrigger}
                  onChange={(v) => update({ manualTrigger: v })}
                  label="Manual trigger"
                />

                <Field label="Push branches">
                  <ChipInput
                    tags={cfg.pushBranches}
                    onChange={(tags) => update({ pushBranches: tags })}
                    placeholder="main, develop…"
                  />
                </Field>

                <Field label="Cron schedule">
                  <input
                    type="text"
                    value={cfg.scheduledCron}
                    onChange={(e) => update({ scheduledCron: e.target.value })}
                    placeholder="0 2 * * 1-5"
                    className="w-full bg-vsc-hover border border-vsc-border rounded-md px-3 py-2 text-sm font-mono focus:border-vsc-accent focus:ring-2 focus:ring-vsc-accent/15 outline-none transition-all"
                  />
                  <p className="text-xs text-vsc-dim mt-1">Leave blank to disable scheduled runs</p>
                </Field>
              </div>
            </div>

            {/* Sharding */}
            <div>
              <p className="text-xs font-semibold text-vsc-dim uppercase tracking-widest mb-3">Parallelism</p>
              <div className="flex flex-col gap-3">
                <Toggle
                  checked={cfg.shardEnabled}
                  onChange={(v) => update({ shardEnabled: v })}
                  label="Enable sharding"
                />
                {cfg.shardEnabled && (
                  <Field label="Shard workers">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={2}
                        max={10}
                        value={cfg.shardWorkers}
                        onChange={(e) => update({ shardWorkers: Number(e.target.value) })}
                        className="flex-1 accent-vsc-accent"
                      />
                      <span className="text-sm font-bold text-vsc-accent w-4 text-right tabular-nums">
                        {cfg.shardWorkers}
                      </span>
                    </div>
                    <p className="text-xs text-vsc-dim mt-1">Parallel shards using blob reporter + merge-reports</p>
                  </Field>
                )}
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Platform tabs */}
            <div className="flex items-center gap-0 border-b border-vsc-border px-4 shrink-0 overflow-x-auto">
              {activePlatforms.map((platform) => {
                const meta = CI_PLATFORM_META[platform]
                const isActive = platform === safeTab
                return (
                  <button
                    key={platform}
                    onClick={() => setActiveTab(platform)}
                    className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                      isActive
                        ? 'border-vsc-accent text-vsc-accent'
                        : 'border-transparent text-vsc-muted hover:text-vsc-text'
                    }`}
                  >
                    <span className={`text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded ${
                      isActive ? 'bg-vsc-accent text-white' : 'bg-vsc-active text-vsc-dim'
                    }`}>
                      {PLATFORM_ICONS[platform]}
                    </span>
                    {meta.name}
                  </button>
                )
              })}

              {/* Action buttons aligned right */}
              <div className="ml-auto flex items-center gap-2 pl-4 py-2 shrink-0">
                <button
                  onClick={() => handleCopy(safeTab)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-vsc-muted hover:text-vsc-text border border-vsc-border hover:border-vsc-accent/50 rounded-md transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <rect x="3.5" y="3.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M1 7.5V1h6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Copy
                </button>
                <button
                  onClick={() => handleDownload(safeTab)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-vsc-muted hover:text-vsc-text border border-vsc-border hover:border-vsc-accent/50 rounded-md transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M5.5 1v7M2 6l3.5 3.5L9 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M1 10h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  Download
                </button>
              </div>
            </div>

            {/* File path */}
            <div className="flex items-center gap-2 px-5 py-2 border-b border-vsc-border bg-vsc-bg/50 shrink-0">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-vsc-dim">
                <path d="M1 1h3.5L6 2.5H10v7H1V1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
              </svg>
              <span className="text-xs font-mono text-vsc-muted">{activeMeta.filename}</span>
            </div>

            {/* Code preview */}
            <div className="flex-1 overflow-auto">
              <CodeBlock
                code={activeConfig}
                language={activeMeta.language}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
