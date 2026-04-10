import { useMemo, useState } from 'react'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import 'highlight.js/styles/vs2015.css'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)

interface Props {
  code: string
  language: 'typescript' | 'javascript'
}

export function CodeBlock({ code, language }: Props) {
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
