import { Modal } from './common/Modal'
import { Btn } from './common/Btn'
import type { Feature, TestCase } from '../types'

interface Props {
  tcName: string
  currentFeatureId: string
  features: Feature[]
  testCases: TestCase[]
  onDuplicate: (targetFeatureId: string) => void
  onClose: () => void
}

export function DuplicateToModal({
  tcName,
  currentFeatureId,
  features,
  testCases,
  onDuplicate,
  onClose,
}: Props) {
  return (
    <Modal title="Duplicate to feature" onClose={onClose} footer={<Btn variant="ghost" onClick={onClose}>Cancel</Btn>}>
      <div className="flex flex-col gap-3 min-w-[380px]">
        <p className="text-[10px] text-vsc-muted">
          Select a target feature for{' '}
          <span className="text-vsc-text font-medium">"{tcName}"</span>
          {' '}— a copy will be created there.
        </p>

        <div className="flex flex-col gap-1">
          {features.map((f) => {
            const count = testCases.filter((tc) => tc.featureId === f.id).length
            const isCurrent = f.id === currentFeatureId

            return (
              <button
                key={f.id}
                disabled={isCurrent}
                onClick={() => { onDuplicate(f.id); onClose() }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-sm border text-left transition-all duration-150 ${
                  isCurrent
                    ? 'border-vsc-border/30 bg-vsc-bg/40 cursor-not-allowed opacity-50'
                    : 'border-vsc-border bg-vsc-panel hover:border-vsc-accent/50 hover:bg-vsc-hover cursor-pointer group'
                }`}
              >
                <span className={`text-[10px] shrink-0 ${isCurrent ? 'text-vsc-dim' : 'text-vsc-accent/60 group-hover:text-vsc-accent'}`}>
                  ◆
                </span>
                <div className="flex-1 min-w-0">
                  <span className={`text-[11px] font-medium truncate block ${isCurrent ? 'text-vsc-dim' : 'text-vsc-text'}`}>
                    {f.name}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] text-vsc-dim uppercase tracking-wide">
                      current feature — use "Duplicate here"
                    </span>
                  )}
                </div>
                <span className={`text-[9px] shrink-0 tabular-nums ${isCurrent ? 'text-vsc-dim' : 'text-vsc-muted'}`}>
                  {count} test{count !== 1 ? 's' : ''}
                </span>
                {!isCurrent && (
                  <span className="text-[10px] text-vsc-accent/40 group-hover:text-vsc-accent transition-colors shrink-0">
                    →
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
