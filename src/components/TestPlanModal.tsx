import { useMemo, useState } from 'react'
import { marked } from 'marked'
import { generateTestPlan } from '../lib/testPlanGenerator'
import { Btn } from './common/Btn'
import type { Project, Feature, TestCase, GlobalVariable, ReusableUtil, Fixture } from '../types'

// Configure marked: sync, safe defaults
marked.setOptions({ async: false, gfm: true, breaks: false })

interface Props {
  project: Project
  features: Feature[]
  testCases: TestCase[]
  variables: GlobalVariable[]
  utils: ReusableUtil[]
  fixtures: Fixture[]
  onClose: () => void
}

type Tab = 'preview' | 'raw'

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function TestPlanModal({
  project, features, testCases, variables, utils, fixtures, onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>('preview')
  const [copied, setCopied] = useState(false)

  const markdown = useMemo(
    () => generateTestPlan(project, features, testCases, variables, utils, fixtures),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project.id, features.length, testCases.length, variables.length, utils.length, fixtures.length],
  )

  const renderedHtml = useMemo(() => marked.parse(markdown) as string, [markdown])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadMd = () => {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slug(project.name)}-test-plan.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrintPDF = () => {
    // Build a light-mode print document and open it in a new window
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${project.name} — Test Plan</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 11pt;
      color: #111;
      line-height: 1.65;
      max-width: 900px;
      margin: 0 auto;
      padding: 40pt 40pt;
    }
    h1 { font-size: 22pt; border-bottom: 2px solid #333; padding-bottom: 6pt; margin-bottom: 16pt; }
    h2 { font-size: 16pt; border-bottom: 1px solid #bbb; padding-bottom: 4pt; margin: 24pt 0 10pt; }
    h3 { font-size: 13pt; margin: 18pt 0 6pt; color: #222; }
    h4 { font-size: 11pt; margin: 14pt 0 4pt; color: #333; }
    p { margin: 6pt 0; }
    ul, ol { margin: 6pt 0 6pt 20pt; }
    li { margin: 3pt 0; }
    hr { border: none; border-top: 1px solid #ccc; margin: 16pt 0; }
    code {
      font-family: 'Courier New', Courier, monospace;
      font-size: 9pt;
      background: #f4f4f4;
      padding: 1pt 4pt;
      border-radius: 2pt;
      border: 1px solid #ddd;
    }
    pre {
      background: #f4f4f4;
      padding: 10pt 12pt;
      border-radius: 4pt;
      overflow: auto;
      margin: 8pt 0;
      page-break-inside: avoid;
    }
    pre code { background: none; border: none; padding: 0; font-size: 8.5pt; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 8pt 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }
    th {
      background: #eee;
      font-family: Arial, sans-serif;
      font-size: 7.5pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 5pt 8pt;
      border: 1px solid #ccc;
      text-align: left;
    }
    td { padding: 4pt 8pt; border: 1px solid #ccc; }
    tr:nth-child(even) td { background: #f9f9f9; }
    blockquote {
      border-left: 3pt solid #6366f1;
      padding: 4pt 12pt;
      color: #555;
      margin: 8pt 0;
      background: #f8f8ff;
      border-radius: 0 4pt 4pt 0;
    }
    strong { font-weight: bold; }
    em { font-style: italic; color: #444; }
    a { color: #4f46e5; }
    @media print {
      body { padding: 0; }
      h2 { page-break-before: always; }
      h2:first-of-type { page-break-before: avoid; }
    }
  </style>
</head>
<body>
  ${renderedHtml}
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html)
    win.document.close()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-vsc-panel border border-vsc-border rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-slide-down"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-7 py-4 border-b border-vsc-border shrink-0">
          <div className="flex items-center gap-3">
            {/* Doc icon */}
            <div className="w-8 h-8 rounded-lg bg-vsc-accent/10 border border-vsc-accent/20 flex items-center justify-center shrink-0">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-vsc-accent">
                <path d="M3 1h6.5L12 3.5V14H3V1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M9 1v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                <path d="M5 7h5M5 9.5h5M5 12h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-vsc-text leading-tight">Test Plan</h2>
              <p className="text-xs text-vsc-dim mt-0.5">{project.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs border rounded-md transition-all font-medium ${
                copied
                  ? 'border-vsc-success/50 text-vsc-success bg-vsc-success/10'
                  : 'border-vsc-border text-vsc-muted hover:text-vsc-text hover:border-vsc-accent/40'
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="3.5" y="3.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M1 8V1h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {copied ? 'Copied!' : 'Copy MD'}
            </button>

            <button
              onClick={handleDownloadMd}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-vsc-border rounded-md text-vsc-muted hover:text-vsc-text hover:border-vsc-accent/40 transition-all font-medium"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1v7.5M2.5 6L6 9.5 9.5 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 11h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Download .md
            </button>

            <button
              onClick={handlePrintPDF}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-vsc-border rounded-md text-vsc-muted hover:text-vsc-text hover:border-vsc-accent/40 transition-all font-medium"
              title="Opens a print-optimised page — use your browser's Save as PDF"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="3.5" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M3 3.5V1.5h6V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M3 9.5v-3h6v3" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="9" cy="6" r="0.7" fill="currentColor"/>
              </svg>
              Save PDF
            </button>

            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-vsc-dim hover:text-vsc-text hover:bg-vsc-hover transition-all text-lg leading-none ml-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="flex items-center border-b border-vsc-border px-7 shrink-0 bg-vsc-panel">
          {([
            { id: 'preview', label: 'Preview', icon: (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 6s2-4 5-4 5 4 5 4-2 4-5 4-5-4-5-4z" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
            )},
            { id: 'raw', label: 'Raw Markdown', icon: (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 3l3 3-3 3M7 9h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )},
          ] as const).map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
                tab === id
                  ? 'border-vsc-accent text-vsc-accent'
                  : 'border-transparent text-vsc-muted hover:text-vsc-text'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}

          {/* Doc stats right-aligned */}
          <div className="ml-auto flex items-center gap-4 py-2">
            <span className="text-[10px] text-vsc-dim tabular-nums">
              {features.length} feature{features.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-vsc-dim tabular-nums">
              {testCases.length} test case{testCases.length !== 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-vsc-dim tabular-nums">
              ~{Math.ceil(markdown.length / 1000)}KB
            </span>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'preview' ? (
            <div className="px-10 py-8 max-w-4xl mx-auto">
              <div
                className="md-preview"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            </div>
          ) : (
            <div className="h-full">
              <pre className="p-6 text-[11.5px] font-mono leading-[1.75] text-vsc-muted whitespace-pre-wrap break-words select-all">
                {markdown}
              </pre>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-7 py-3 border-t border-vsc-border bg-vsc-panel shrink-0">
          <span className="text-xs text-vsc-dim">
            {markdown.split('\n').length} lines · {markdown.length.toLocaleString()} chars
          </span>
          <Btn variant="ghost" size="sm" onClick={onClose}>Close</Btn>
        </div>
      </div>
    </div>
  )
}
