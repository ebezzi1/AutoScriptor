import { useState, useCallback } from 'react'
import { Modal } from './common/Modal'
import { Btn } from './common/Btn'
import type { Feature, TestCase } from '../types'

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

type RunMode = 'all' | 'feature' | 'tag' | 'priority'

interface Props {
  features: Feature[]
  testCases: TestCase[]
  onClose: () => void
}

export function BulkRunPanel({ features, testCases, onClose }: Props) {
  const [mode, setMode] = useState<RunMode>('all')
  const [selectedFeatureId, setSelectedFeatureId] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedPriority, setSelectedPriority] = useState('')
  const [headed, setHeaded] = useState(false)
  const [browser, setBrowser] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  // Collect unique tags from all test cases and features
  const allTags = Array.from(
    new Set([
      ...testCases.flatMap((tc) => tc.tags),
      ...features.flatMap((f) => f.tags),
    ])
  ).filter(Boolean).sort()

  const priorities = ['P0', 'P1', 'P2', 'P3'] as const

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
    if (browser) parts.push(`--project=${browser}`)

    return parts.join(' ')
  }

  const command = buildCommand()

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }, [])

  const prebuilt: { label: string; cmd: string; key: string }[] = [
    { label: 'Run all tests', cmd: 'npx playwright test', key: 'all' },
    { label: 'Run headed', cmd: 'npx playwright test --headed', key: 'headed' },
    { label: 'Run Chromium only', cmd: 'npx playwright test --project=chromium', key: 'chromium' },
    { label: 'Run Firefox only', cmd: 'npx playwright test --project=firefox', key: 'firefox' },
    { label: 'Run WebKit only', cmd: 'npx playwright test --project=webkit', key: 'webkit' },
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

  return (
    <Modal
      title="Run Commands"
      onClose={onClose}
      footer={<Btn variant="ghost" onClick={onClose}>Close</Btn>}
    >
      <div className="flex flex-col gap-5 min-w-[520px]">

        {/* Pre-built commands */}
        <div>
          <p className="text-[9px] text-vsc-dim uppercase tracking-widest mb-2">Quick commands</p>
          <div className="flex flex-col gap-1">
            {prebuilt.map((item) => (
              <div
                key={item.key}
                className="flex items-center gap-2 bg-vsc-bg border border-vsc-border rounded-sm px-3 py-2 group"
              >
                <span className="text-[9px] text-vsc-muted uppercase tracking-wide w-[130px] shrink-0">
                  {item.label}
                </span>
                <code className="flex-1 text-[11px] text-vsc-accent font-mono truncate">
                  {item.cmd}
                </code>
                <button
                  onClick={() => handleCopy(item.cmd, item.key)}
                  className="text-[9px] text-vsc-dim hover:text-vsc-accent transition-colors shrink-0 px-1.5 py-0.5 border border-vsc-border/50 rounded-sm hover:border-vsc-accent/40"
                >
                  {copied === item.key ? '✓' : 'copy'}
                </button>
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

            {/* Options row */}
            <div className="flex items-center gap-4 pt-1 border-t border-vsc-border/50">
              {/* Headed toggle */}
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

              {/* Browser selector */}
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
            </div>

            {/* Generated command output */}
            <div className="flex items-center gap-2 bg-vsc-sidebar border border-vsc-accent/30 rounded-sm px-3 py-2">
              <code className="flex-1 text-[12px] text-vsc-accent font-mono break-all leading-relaxed">
                {command}
              </code>
              <button
                onClick={() => handleCopy(command, 'builder')}
                className="text-[9px] text-vsc-dim hover:text-vsc-accent transition-colors shrink-0 px-1.5 py-0.5 border border-vsc-border/50 rounded-sm hover:border-vsc-accent/40"
              >
                {copied === 'builder' ? '✓' : 'copy'}
              </button>
            </div>
          </div>
        </div>

      </div>
    </Modal>
  )
}
