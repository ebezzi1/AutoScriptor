import { useState, useRef, useEffect, useCallback } from 'react'

// Same slug logic as zipBuilder — kept local to avoid coupling
function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

const IDE_ROOT_KEY = 'pw-ide-root'

function readRoot(): string {
  try { return localStorage.getItem(IDE_ROOT_KEY) ?? '' } catch { return '' }
}
function writeRoot(v: string): void {
  try { localStorage.setItem(IDE_ROOT_KEY, v) } catch {}
}

// ── small copy hook ───────────────────────────────────────────────────────────
function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [])
  return [copied, copy]
}

// ── CopyBtn ───────────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, copy] = useCopy()
  return (
    <button
      onClick={() => copy(text)}
      className={`shrink-0 px-2 py-0.5 text-[9px] uppercase tracking-widest border rounded-sm transition-all duration-150 ${
        copied
          ? 'border-vsc-success/60 text-vsc-success bg-vsc-success/10'
          : 'border-vsc-border text-vsc-muted hover:border-vsc-accent/60 hover:text-vsc-accent'
      }`}
    >
      {copied ? '✓' : '⎘'}
    </button>
  )
}

// ── CommandLine ───────────────────────────────────────────────────────────────
function CommandLine({ cmd }: { cmd: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-vsc-code rounded-sm group">
      <span className="text-vsc-dim text-[11px] font-mono shrink-0 select-none">$</span>
      <span className="flex-1 font-mono text-[11px] text-vsc-success select-all overflow-x-auto whitespace-nowrap scrollbar-thin">
        {cmd}
      </span>
      <CopyBtn text={cmd} />
    </div>
  )
}

// ── IDEButton ─────────────────────────────────────────────────────────────────
function IDEButton({
  label,
  icon,
  href,
  disabled,
}: {
  label: string
  icon: string
  href: string | null
  disabled: boolean
}) {
  const base =
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-wider border rounded-sm transition-all duration-150 font-medium'
  const active =
    'border-vsc-border text-vsc-text hover:border-vsc-accent/60 hover:text-vsc-accent hover:bg-vsc-hover'
  const dis = 'border-vsc-border/40 text-vsc-dim cursor-not-allowed opacity-50'

  if (disabled || !href) {
    return (
      <span className={`${base} ${dis}`} title="Set project root first">
        <span>{icon}</span> {label}
      </span>
    )
  }

  return (
    <a href={href} className={`${base} ${active}`} title={`Open in ${label}`}>
      <span>{icon}</span> {label}
    </a>
  )
}

// ── RootPopover ───────────────────────────────────────────────────────────────
function RootPopover({
  root,
  onSave,
  onClose,
}: {
  root: string
  onSave: (v: string) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(root)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1.5 z-30 w-80 bg-vsc-panel border border-vsc-border rounded-sm shadow-xl shadow-black/50"
    >
      {/* Amber accent top bar */}
      <div className="h-[2px] bg-vsc-accent rounded-t-sm" />
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em] mb-1.5">
            Local project root
          </p>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onSave(draft); onClose() }
              if (e.key === 'Escape') onClose()
            }}
            placeholder="/Users/me/my-project"
            className="w-full bg-vsc-bg border border-vsc-border rounded-sm px-3 py-1.5 text-xs text-vsc-text placeholder-vsc-dim focus:border-vsc-accent focus:shadow-[0_0_0_1px_rgba(200,152,32,0.15)] outline-none transition-all font-mono"
          />
          <p className="text-[9px] text-vsc-dim mt-1.5 leading-relaxed">
            Used to build IDE protocol URIs. Saved in your browser — never sent anywhere.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 text-[10px] uppercase tracking-wider border border-vsc-border rounded-sm text-vsc-muted hover:text-vsc-text hover:bg-vsc-hover transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(draft); onClose() }}
            className="px-3 py-1 text-[10px] uppercase tracking-wider bg-vsc-accent text-[#0c0f0c] border-transparent rounded-sm font-semibold hover:bg-vsc-accent-hover transition-all"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── TestRunPanel ──────────────────────────────────────────────────────────────
interface Props {
  featureName: string
  tcName: string
  language: 'typescript' | 'javascript'
}

export function TestRunPanel({ featureName, tcName, language }: Props) {
  const [root, setRoot] = useState(readRoot)
  const [showSettings, setShowSettings] = useState(false)

  const featureSlug = slug(featureName)
  const tcSlug = slug(tcName)
  const ext = language === 'typescript' ? 'ts' : 'js'
  const specPath = `tests/${featureSlug}/${tcSlug}.spec.${ext}`
  const baseCmd = `npx playwright test ${specPath}`
  const headedCmd = `${baseCmd} --headed`

  const handleSaveRoot = (v: string) => {
    const trimmed = v.trim().replace(/\/$/, '')
    setRoot(trimmed)
    writeRoot(trimmed)
  }

  const filePath = root ? `${root}/${specPath}` : null

  const ideLinks: { label: string; icon: string; href: string | null }[] = [
    {
      label: 'VS Code',
      icon: '⬡',
      href: filePath ? `vscode://file/${filePath}` : null,
    },
    {
      label: 'Cursor',
      icon: '◎',
      href: filePath ? `cursor://file/${filePath}` : null,
    },
    {
      label: 'WebStorm',
      icon: '◈',
      href: filePath
        ? `jetbrains://webstorm/open?file=${encodeURIComponent(filePath)}`
        : null,
    },
  ]

  const noRoot = !root

  return (
    <div className="flex flex-col gap-4">
      {/* ── Run Command ── */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em] shrink-0">
            Run command
          </h2>
          <div className="flex-1 h-px bg-vsc-border/50" />
        </div>
        <div className="flex flex-col gap-1.5">
          <CommandLine cmd={baseCmd} />
          <CommandLine cmd={headedCmd} />
        </div>
      </div>

      {/* ── Open in IDE ── */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-[9px] font-semibold text-vsc-dim uppercase tracking-[0.14em] shrink-0">
            Open in IDE
          </h2>
          <div className="flex-1 h-px bg-vsc-border/50" />

          {/* Settings trigger */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`flex items-center gap-1.5 px-2 py-1 text-[9px] uppercase tracking-wider border rounded-sm transition-all ${
                showSettings || root
                  ? 'border-vsc-accent/50 text-vsc-accent bg-vsc-accent-light'
                  : 'border-vsc-border text-vsc-muted hover:border-vsc-accent/40 hover:text-vsc-accent'
              }`}
              title="Set local project root"
            >
              <span>⚙</span>
              <span className="font-mono max-w-[180px] truncate">
                {root || 'set root…'}
              </span>
            </button>

            {showSettings && (
              <RootPopover
                root={root}
                onSave={handleSaveRoot}
                onClose={() => setShowSettings(false)}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {ideLinks.map((ide) => (
            <IDEButton
              key={ide.label}
              label={ide.label}
              icon={ide.icon}
              href={ide.href}
              disabled={noRoot}
            />
          ))}
          {noRoot && (
            <span className="text-[9px] text-vsc-dim">
              ← set project root to enable IDE links
            </span>
          )}
        </div>

        {filePath && (
          <p className="text-[9px] text-vsc-dim font-mono mt-2 break-all">
            {filePath}
          </p>
        )}
      </div>
    </div>
  )
}
