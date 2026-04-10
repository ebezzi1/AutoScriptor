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
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[9px] text-vsc-accent uppercase tracking-[0.16em] mb-1.5">
            Playwright Test Generator
          </p>
          <h1 className="text-xl font-semibold text-vsc-text tracking-tight">Projects</h1>
          <p className="text-[11px] text-vsc-muted mt-1">
            Manage your Playwright test suites
          </p>
        </div>
        <Btn variant="primary" onClick={() => setCreating(true)}>
          + New project
        </Btn>
      </div>

      {state.projects.length === 0 ? (
        <div className="border border-dashed border-vsc-border/60 rounded-sm p-16 text-center">
          <div className="w-8 h-8 border border-vsc-border mx-auto mb-4 flex items-center justify-center">
            <span className="text-vsc-dim text-xs">PW</span>
          </div>
          <p className="text-vsc-dim text-[11px] uppercase tracking-wider">No projects yet</p>
          <p className="text-vsc-dim text-[10px] mt-1">Create one to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {state.projects.map((p) => {
            const featureCount = state.features.filter(
              (f) => f.projectId === p.id
            ).length
            const tcCount = state.testCases.filter(
              (tc) => tc.projectId === p.id
            ).length
            return (
              <div
                key={p.id}
                className="bg-vsc-panel border border-vsc-border rounded-sm p-4 cursor-pointer hover:border-vsc-accent/60 hover:bg-vsc-hover transition-all duration-150 group relative overflow-hidden"
                onClick={() =>
                  navigate({ type: 'project-dashboard', projectId: p.id })
                }
              >
                {/* Amber left accent */}
                <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-vsc-accent/30 group-hover:bg-vsc-accent transition-all duration-150" />

                <div className="flex items-start justify-between gap-2 pl-1">
                  <h3 className="font-semibold text-[12px] text-vsc-text truncate leading-tight">
                    {p.name}
                  </h3>
                  <div className="flex gap-1 shrink-0">
                    <span className="text-[9px] border border-vsc-border/80 px-1.5 py-0.5 text-vsc-muted uppercase tracking-wide">
                      {p.language === 'typescript' ? 'TS' : 'JS'}
                    </span>
                    <span className="text-[9px] border border-vsc-border/80 px-1.5 py-0.5 text-vsc-muted uppercase tracking-wide">
                      {p.browser}
                    </span>
                  </div>
                </div>
                {p.description && (
                  <p className="text-[10px] text-vsc-muted mt-1.5 line-clamp-2 pl-1">
                    {p.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3 text-[10px] text-vsc-dim pl-1">
                  <span className="tabular-nums">{featureCount} features</span>
                  <span className="text-vsc-dim/40">·</span>
                  <span className="tabular-nums">{tcCount} test cases</span>
                </div>
                <div className="flex items-center justify-between mt-3 pl-1">
                  <span className="text-[9px] text-vsc-dim">
                    {new Date(p.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    className="text-[9px] text-vsc-dim hover:text-vsc-danger opacity-0 group-hover:opacity-100 transition-all uppercase tracking-wide"
                    onClick={(e) => {
                      e.stopPropagation()
                      confirmDelete(p.id)
                    }}
                  >
                    Delete
                  </button>
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
              <Btn variant="primary" onClick={handleCreate} disabled={!name.trim()}>
                Create
              </Btn>
            </>
          }
        >
          <div className="flex flex-col gap-4">
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
              <Select
                value={lang}
                onChange={(e) =>
                  setLang(e.target.value as 'typescript' | 'javascript')
                }
              >
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
          <p className="text-xs text-vsc-muted leading-relaxed">
            This will permanently delete the project and all its features, test
            cases, variables, utils, and fixtures. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
