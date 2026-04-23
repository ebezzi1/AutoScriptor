import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { usePermissions as _usePermissions } from '../hooks/usePermissions'
import { Modal } from '../components/common/Modal'
import { Btn } from '../components/common/Btn'
import { Field, Input, Select } from '../components/common/Field'
import { CreateProjectDirectoryStep } from '../components/project/CreateProjectDirectoryStep'
import type { Project } from '../types'

function newProject(name: string): Project {
  return {
    id: crypto.randomUUID(),
    name,
    description: '',
    language: 'typescript',
    baseUrl: '',
    browser: 'chromium',
    defaultTimeout: 30000,
    selectorStrategy: 'css',
    retries: 0,
    reporter: 'html',
    generatePOM: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    environments: [
      { id: crypto.randomUUID(), name: 'dev', baseUrl: '', variableOverrides: {} },
      { id: crypto.randomUUID(), name: 'staging', baseUrl: '', variableOverrides: {} },
      { id: crypto.randomUUID(), name: 'production', baseUrl: '', variableOverrides: {} },
    ],
    activeEnvironmentId: null,
  }
}

const BROWSER_BADGE: Record<string, { label: string; className: string }> = {
  chromium: {
    label: 'Chromium',
    className: 'border-green-500/30 text-green-600 bg-green-500/10 dark:text-green-400',
  },
  firefox: {
    label: 'Firefox',
    className: 'border-orange-500/30 text-orange-600 bg-orange-500/10 dark:text-orange-400',
  },
  webkit: {
    label: 'WebKit',
    className: 'border-blue-500/30 text-blue-600 bg-blue-500/10 dark:text-blue-400',
  },
  all: {
    label: 'All',
    className: 'border-purple-500/30 text-purple-600 bg-purple-500/10 dark:text-purple-400',
  },
}

const LANG_BADGE: Record<string, { label: string; className: string }> = {
  typescript: {
    label: 'TS',
    className: 'border-blue-500/30 text-blue-600 bg-blue-500/10 dark:text-blue-400',
  },
  javascript: {
    label: 'JS',
    className: 'border-yellow-500/30 text-yellow-600 bg-yellow-500/10 dark:text-yellow-400',
  },
}

export function ProjectsList() {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const { isReadOnly } = _usePermissions()
  const [creating, setCreating] = useState(false)
  const [createStep, setCreateStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [lang, setLang] = useState<'typescript' | 'javascript'>('typescript')
  const [dirPath, setDirPath] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleCreate = (skipDir = false) => {
    if (!name.trim()) return
    const p = {
      ...newProject(name.trim()),
      language: lang,
      ...(dirPath.trim() && !skipDir ? { localDirectory: dirPath.trim() } : {}),
    }
    dispatch({ type: 'CREATE_PROJECT', project: p })
    toast(`Project "${p.name}" created`)
    navigate({ type: 'project-dashboard', projectId: p.id })
    setCreating(false)
    setCreateStep(1)
    setName('')
    setDirPath('')
  }

  const handleCloseCreate = () => {
    setCreating(false)
    setCreateStep(1)
    setName('')
    setDirPath('')
  }

  const confirmDelete = (id: string) => setDeleteTarget(id)
  const doDelete = () => {
    if (!deleteTarget) return
    const p = state.projects.find((p) => p.id === deleteTarget)
    dispatch({ type: 'DELETE_PROJECT', projectId: deleteTarget })
    toast(`Project "${p?.name}" deleted`, 'error')
    setDeleteTarget(null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto w-full flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between w-full">
        <div>
          <p className="text-xs text-vsc-accent font-semibold uppercase tracking-widest mb-2">
            Playwright Generator
          </p>
          <h1 className="text-3xl font-bold text-vsc-text tracking-tight leading-tight">Projects</h1>
          <p className="text-sm text-vsc-muted mt-1.5">
            Manage your Playwright test suites
          </p>
        </div>
        {!isReadOnly && (
          <Btn variant="primary" size="md" onClick={() => setCreating(true)}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
              <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            New project
          </Btn>
        )}
      </div>

      {state.projects.length === 0 ? (
        <div className="border border-dashed border-vsc-border rounded-2xl p-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-vsc-panel border border-vsc-border mx-auto mb-5 flex items-center justify-center">
            <span className="text-vsc-accent text-sm font-bold">PW</span>
          </div>
          <p className="text-vsc-muted text-sm font-medium">No projects yet</p>
          <p className="text-vsc-dim text-xs mt-1">{isReadOnly ? 'No projects have been created yet' : 'Create one to get started'}</p>
          {!isReadOnly && (
            <Btn variant="primary" size="md" className="mt-6" onClick={() => setCreating(true)}>
              Create your first project
            </Btn>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.projects.map((p) => {
            const featureCount = state.features.filter((f) => f.projectId === p.id).length
            const tcCount = state.testCases.filter((tc) => tc.projectId === p.id).length
            const browserBadge = BROWSER_BADGE[p.browser] ?? BROWSER_BADGE.chromium
            const langBadge = LANG_BADGE[p.language] ?? LANG_BADGE.typescript
            return (
              <div
                key={p.id}
                className="bg-vsc-panel border border-vsc-border rounded-xl cursor-pointer hover:border-vsc-accent/40 transition-all duration-200 group relative overflow-hidden flex flex-col"
                onClick={() => navigate({ type: 'project-dashboard', projectId: p.id })}
              >
                {/* Card header strip */}
                <div className="px-4 pt-4 pb-3 bg-vsc-hover/60 border-b border-vsc-border/60 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-vsc-text leading-snug group-hover:text-white transition-colors truncate flex-1 min-w-0">
                    {p.name}
                  </h3>
                  {/* Delete button — top-right, hover only */}
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded text-vsc-dim hover:text-vsc-danger hover:bg-vsc-danger-light shrink-0"
                    onClick={(e) => { e.stopPropagation(); confirmDelete(p.id) }}
                    aria-label="Delete project"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Card body */}
                <div className="px-4 py-3 flex flex-col gap-3 flex-1">
                  {/* Badges */}
                  <div className="flex gap-1.5 flex-wrap">
                    <span className={`text-2xs px-2 py-0.5 rounded-full border font-semibold ${langBadge.className}`}>
                      {langBadge.label}
                    </span>
                    <span className={`text-2xs px-2 py-0.5 rounded-full border font-semibold ${browserBadge.className}`}>
                      {browserBadge.label}
                    </span>
                  </div>

                  {p.description && (
                    <p className="text-xs text-vsc-muted line-clamp-2">{p.description}</p>
                  )}
                </div>

                {/* Card footer */}
                <div className="px-4 pb-3 pt-2 border-t border-vsc-border/50 flex items-center justify-between gap-2">
                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-vsc-dim">
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="opacity-60 shrink-0">
                        <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M1 4h9" stroke="currentColor" strokeWidth="1.3"/>
                        <path d="M4 4v6" stroke="currentColor" strokeWidth="1.3"/>
                      </svg>
                      <span className="tabular-nums">{featureCount} feature{featureCount !== 1 ? 's' : ''}</span>
                    </span>
                    <span className="text-vsc-border">·</span>
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="opacity-60 shrink-0">
                        <path d="M2 2h7M2 5h5M2 8h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                      </svg>
                      <span className="tabular-nums">{tcCount} test{tcCount !== 1 ? 's' : ''}</span>
                    </span>
                  </div>

                  {/* Date */}
                  <span className="text-2xs text-vsc-dim/60 shrink-0">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {creating && (
        <Modal
          title={createStep === 1 ? 'New project' : 'Project directory'}
          onClose={handleCloseCreate}
          footer={
            createStep === 1 ? (
              <>
                <Btn variant="ghost" onClick={handleCloseCreate}>Cancel</Btn>
                <Btn variant="primary" onClick={() => setCreateStep(2)} disabled={!name.trim()}>Next</Btn>
              </>
            ) : (
              <>
                <Btn variant="ghost" onClick={() => setCreateStep(1)}>Back</Btn>
                <Btn variant="primary" onClick={() => handleCreate()}>Create</Btn>
              </>
            )
          }
        >
          {createStep === 1 ? (
            <div className="flex flex-col gap-5">
              <Field label="Project name">
                <Input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My app tests"
                  onKeyDown={(e) => e.key === 'Enter' && name.trim() && setCreateStep(2)}
                />
              </Field>
              <Field label="Language">
                <Select value={lang} onChange={(e) => setLang(e.target.value as 'typescript' | 'javascript')}>
                  <option value="typescript">TypeScript</option>
                  <option value="javascript">JavaScript</option>
                </Select>
              </Field>
            </div>
          ) : (
            <CreateProjectDirectoryStep
              projectName={name.trim()}
              value={dirPath}
              onChange={setDirPath}
              onSkip={() => handleCreate(true)}
            />
          )}
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete project?"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Btn>
              <Btn variant="danger" onClick={doDelete}>Delete</Btn>
            </>
          }
        >
          <p className="text-sm text-vsc-muted leading-relaxed">
            This will permanently delete the project and all its features, test cases, variables,
            utils, and fixtures. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
