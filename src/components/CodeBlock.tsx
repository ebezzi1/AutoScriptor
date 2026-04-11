import { useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import yaml from 'highlight.js/lib/languages/yaml'
import groovy from 'highlight.js/lib/languages/groovy'
import 'highlight.js/styles/vs2015.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('groovy', groovy)

interface Props {
  code: string
  language: 'typescript' | 'javascript' | 'yaml' | 'groovy'
  filename?: string
}

export function CodeBlock({ code, language, filename }: Props) {
  const [copied, setCopied] = useState(false)

  const highlighted = useMemo(() => {
    try {
      return hljs.highlight(code, { language }).value
    } catch {
      return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
    }
  }, [code, language])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group/codeblock">
      {filename && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-vsc-border bg-vsc-panel/60">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-vsc-dim shrink-0">
            <path d="M2 1h5.5L10 3.5V11H2V1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
            <path d="M7 1v3h3" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
          </svg>
          <span className="text-xs font-mono text-vsc-muted">{filename}</span>
        </div>
      )}
      {/* Copy button — top-right corner of the block */}
      <button
        onClick={handleCopy}
        className={`absolute top-3 right-3 z-10 px-2 py-1 text-[9px] uppercase tracking-widest border rounded-sm transition-all duration-150 ${
          copied
            ? 'border-vsc-success/60 text-vsc-success bg-vsc-success/10'
            : 'border-vsc-border text-vsc-muted hover:border-vsc-accent/60 hover:text-vsc-accent bg-[#080a08]/80 opacity-0 group-hover/codeblock:opacity-100'
        }`}
      >
        {copied ? '✓ Copied' : '⎘ Copy'}
      </button>

      <pre className="hljs code-preview-pre m-0 text-[11.5px] p-5 overflow-auto max-h-[420px] leading-[1.7] rounded-none">
        <code dangerouslySetInnerHTML={{ __html: highlighted }} />
      </pre>
    </div>
  )
}
