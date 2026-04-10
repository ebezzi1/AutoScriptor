import type { KVPair } from '../../types/api'
import { makeKVPair } from '../../types/api'

const HEADER_SUGGESTIONS = [
  'Content-Type', 'Authorization', 'Accept', 'Accept-Language',
  'Cache-Control', 'X-API-Key', 'X-Auth-Token', 'X-Request-ID',
  'X-Correlation-ID', 'Idempotency-Key', 'User-Agent',
]

const VALUE_SUGGESTIONS: Record<string, string[]> = {
  'Content-Type': [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
  ],
  'Accept': ['application/json', 'text/html', '*/*'],
}

const cellCls =
  'bg-transparent border border-vsc-border/50 rounded-sm px-2 py-1 text-[11px] text-vsc-text ' +
  'focus:border-vsc-accent focus:outline-none w-full font-mono placeholder-vsc-dim/50 transition-colors'

interface Props {
  pairs: KVPair[]
  onChange: (pairs: KVPair[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  /** If true, shows header-name autocomplete on key field */
  headerMode?: boolean
  /** Additional variable names to show in value autocomplete */
  variables?: string[]
}

export function KVTable({
  pairs,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  headerMode = false,
  variables = [],
}: Props) {
  const update = (id: string, field: keyof KVPair, value: string | boolean) => {
    onChange(pairs.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }
  const remove = (id: string) => onChange(pairs.filter((p) => p.id !== id))
  const add = () => onChange([...pairs, makeKVPair()])

  const datalistId = `kv-vars-${Math.random().toString(36).slice(2)}`

  return (
    <div className="flex flex-col gap-0.5">
      {/* datalist for variable autocomplete */}
      {variables.length > 0 && (
        <datalist id={datalistId}>
          {variables.map((v) => (
            <option key={v} value={`{{${v}}}`} />
          ))}
        </datalist>
      )}

      {pairs.length > 0 && (
        <div className="flex flex-col gap-0.5 mb-1">
          {pairs.map((pair) => {
            const keySuggestId = headerMode ? `kv-keys-${pair.id}` : undefined
            const valSuggestId = headerMode && VALUE_SUGGESTIONS[pair.key]
              ? `kv-vals-${pair.id}`
              : undefined

            return (
              <div key={pair.id} className="flex items-center gap-1.5">
                {/* Enabled toggle */}
                <button
                  onClick={() => update(pair.id, 'enabled', !pair.enabled)}
                  className={`shrink-0 w-3.5 h-3.5 border rounded-sm transition-colors flex items-center justify-center ${
                    pair.enabled
                      ? 'border-vsc-accent/60 bg-vsc-accent/20'
                      : 'border-vsc-border/40 bg-transparent'
                  }`}
                  title={pair.enabled ? 'Disable row' : 'Enable row'}
                >
                  {pair.enabled && (
                    <span className="text-vsc-accent text-[7px] leading-none">✓</span>
                  )}
                </button>

                {/* Key */}
                <div className="flex-1 min-w-0">
                  {keySuggestId && (
                    <datalist id={keySuggestId}>
                      {HEADER_SUGGESTIONS.map((h) => <option key={h} value={h} />)}
                    </datalist>
                  )}
                  <input
                    value={pair.key}
                    onChange={(e) => update(pair.id, 'key', e.target.value)}
                    placeholder={keyPlaceholder}
                    list={keySuggestId}
                    disabled={!pair.enabled}
                    className={`${cellCls} ${!pair.enabled ? 'opacity-40' : ''}`}
                  />
                </div>

                <span className="text-vsc-dim text-[10px] shrink-0">=</span>

                {/* Value */}
                <div className="flex-1 min-w-0">
                  {valSuggestId && (
                    <datalist id={valSuggestId}>
                      {(VALUE_SUGGESTIONS[pair.key] ?? []).map((v) => (
                        <option key={v} value={v} />
                      ))}
                    </datalist>
                  )}
                  <input
                    value={pair.value}
                    onChange={(e) => update(pair.id, 'value', e.target.value)}
                    placeholder={valuePlaceholder}
                    list={valSuggestId ?? (variables.length > 0 ? datalistId : undefined)}
                    disabled={!pair.enabled}
                    className={`${cellCls} ${!pair.enabled ? 'opacity-40' : ''}`}
                  />
                </div>

                {/* Delete */}
                <button
                  onClick={() => remove(pair.id)}
                  className="shrink-0 text-vsc-dim hover:text-vsc-danger transition-colors text-[13px] w-4 text-center"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={add}
        className="self-start text-[9px] text-vsc-dim hover:text-vsc-accent transition-colors uppercase tracking-widest px-1 py-0.5"
      >
        + Add row
      </button>
    </div>
  )
}
