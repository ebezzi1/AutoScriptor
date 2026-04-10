import { useState, type KeyboardEvent } from 'react'

interface Props {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
}

export function ChipInput({ tags, onChange, placeholder = 'Add tag...' }: Props) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim()
    if (val && !tags.includes(val)) {
      onChange([...tags, val])
    }
    setInput('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      add()
    } else if (e.key === 'Backspace' && !input) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center min-h-[32px] bg-vsc-bg border border-vsc-border rounded-sm px-2 py-1 focus-within:border-vsc-accent focus-within:shadow-[0_0_0_1px_rgba(200,152,32,0.15)] transition-all">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 border border-vsc-accent/40 text-vsc-accent text-[10px] rounded-sm uppercase tracking-wide"
        >
          {tag}
          <button
            onClick={() => onChange(tags.filter((t) => t !== tag))}
            className="hover:text-vsc-accent-hover transition-colors leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKey}
        onBlur={add}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[80px] bg-transparent text-xs text-vsc-text placeholder-vsc-dim outline-none"
      />
    </div>
  )
}
