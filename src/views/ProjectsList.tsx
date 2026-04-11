import { useState } from 'react'
import { useApp } from '../store/AppContext'
import { useToast } from '../components/common/Toast'
import { Modal } from '../components/common/Modal'
import { Btn } from '../components/common/Btn'
import { Field, Input, Select } from '../components/common/Field'
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

export function ProjectsList() {
  const { state, dispatch, navigate } = useApp()
  const { toast } = useToast()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [lang, setLang] = useState<'typescript' | 'javascript'>('typescript')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleCreate = () => {
    if (!name.trim()) return
    const p = { ...newProject(name.trim()), language: lang }
    dispatch({ type: 'CREATE_PROJECT', project: p })
    toast(`Project "${p.name}" created`)
    navigate({ type: 'project-dashboard', projectId: p.id })
    setCreating(false)
    setName('')
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
    <div className="p-10 max-w-5xl">
      {/* Header */}
      <div className="flex items-end justify-between mb-10">
        <div>
          <p className="text-xs text-vsc-accent font-semibold uppercase tracking-widest mb-2">
            Playwright Generator
          </p>
          <h1 className="text-3xl font-bold text-vsc-text tracking-tight leading-tight">Projects</h1>
          <p className="text-sm text-vsc-muted mt-1.5">
            Manage your Playwright test suites
          </p>
        </div>
        <Btn variant="primary" size="md" onClick={() => setCreating(true)}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
            <path d="M6.5 1v11M1 6.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          New project
        </Btn>
      </div>

      {state.projects.length === 0 ? (
        <div className="border border-dashed border-vsc-border rounded-2xl p-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-vsc-panel border border-vsc-border mx-auto mb-5 flex items-center justify-center">
            <span className="text-vsc-accent text-sm font-bold">PW</span>
          </div>
          <p className="text-vsc-muted text-sm font-medium">No projects yet</p>
          <p className="text-vsc-dim text-xs mt-1">Create one to get started</p>
          <Btn variant="primary" size="md" className="mt-6" onClick={() => setCreating(true)}>
            Create your first project
          </Btn>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.projects.map((p) => {
            const featureCount = state.features.filter((f) => f.projectId === p.id).length
            const tcCount = state.testCases.filter((tc) => tc.projectId === p.id).length
            return (
              <div
                key={p.id}
                className="bg-vsc-panel border border-vsc-border rounded-xl p-5 cursor-pointer hover:border-vsc-accent/40 hover:bg-vsc-hover transition-all duration-200 group relative overflow-hidden"
                onClick={() => navigate({ type: 'project-dashboard', projectId: p.id })}
              >
                {/* Left accent */}
                <div className="absolute left-0 top-4 bottom-4 w-[2px] rounded-full bg-vsc-border group-hover:bg-vsc-accent transition-all duration-200" />

                <div className="pl-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm text-vsc-text truncate leading-snug group-hover:text-white transition-colors">
                      {p.name}
                    </h3>
                    <div className="flex gap-1.5 shrink-0">
                      <span className="text-2xs border border-vsc-border px-2 py-0.5 text-vsc-dim rounded-full font-medium">
                        {p.language === 'typescript' ? 'TS' : 'JS'}
                      </span>
                      <span className="text-2xs border border-vsc-border px-2 py-0.5 text-vsc-dim rounded-full font-medium">
                        {p.browser}
                      </span>
                    </div>
                  </div>

                  {p.description && (
                    <p className="text-xs text-vsc-muted mt-1 mb-2 line-clamp-2">{p.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-3 text-xs text-vsc-dim">
                    <span className="tabular-nums">{featureCount} feature{featureCount !== 1 ? 's' : ''}</span>
                    <span className="text-vsc-border">·</span>
                    <span className="tabular-nums">{tcCount} test{tcCount !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-vsc-border/50">
                    <span className="text-2xs text-vsc-dim/60">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                    <button
                      className="text-2xs text-vsc-dim hover:text-vsc-danger opacity-0 group-hover:opacity-100 transition-all font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        confirmDelete(p.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {creating && (
        <Modal
          title="New project"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Btn variant="ghost" onClick={() => setCreating(false)}>Cancel</Btn>
              <Btn variant="primary" onClick={handleCreate} disabled={!name.trim()}>Create</Btn>
            </>
          }
        >
          <div className="flex flex-col gap-5">
            <Field label="Project name">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My app tests"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </Field>
            <Field label="Language">
              <Select value={lang} onChange={(e) => setLang(e.target.value as 'typescript' | 'javascript')}>
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
              </Select>
            </Field>
          </div>
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
