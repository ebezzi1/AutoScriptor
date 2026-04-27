/**
 * Scaffold Service
 *
 * Orchestrates project scaffolding via the agent, tracking progress
 * with a typed event emitter pattern. Updates project_directories
 * in Supabase as scaffolding proceeds.
 */

import { supabase } from '../lib/supabase'
import type { AgentClientService } from './agentClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ScaffoldStepLabel =
  | 'create_folder'
  | 'npm_init'
  | 'install_playwright'
  | 'install_browsers'
  | 'create_structure'
  | 'git_init'

export type ScaffoldStepStatus = 'pending' | 'running' | 'done' | 'error'

export interface ScaffoldStep {
  label: ScaffoldStepLabel
  displayName: string
  status: ScaffoldStepStatus
  output?: string
  error?: string
}

export type ScaffoldEventType = 'step_start' | 'step_done' | 'step_error' | 'complete' | 'failed'

export interface ScaffoldEvent {
  type: ScaffoldEventType
  step?: ScaffoldStepLabel
  message: string
  progress: number // 0–100
  steps: ScaffoldStep[]
}

export type ScaffoldListener = (event: ScaffoldEvent) => void

// ── Step definitions ──────────────────────────────────────────────────────────

const SCAFFOLD_STEPS: { label: ScaffoldStepLabel; displayName: string }[] = [
  { label: 'create_folder', displayName: 'Creating project folder' },
  { label: 'npm_init', displayName: 'Initializing npm project' },
  { label: 'install_playwright', displayName: 'Installing Playwright' },
  { label: 'install_browsers', displayName: 'Installing browsers' },
  { label: 'create_structure', displayName: 'Creating folder structure' },
  { label: 'git_init', displayName: 'Initializing git repository' },
]

// ── ScaffoldService ───────────────────────────────────────────────────────────

export class ScaffoldService {
  private agent: AgentClientService
  private projectId: string
  private listeners: Set<ScaffoldListener> = new Set()
  private steps: ScaffoldStep[]
  private _isRunning = false

  constructor(agent: AgentClientService, projectId: string) {
    this.agent = agent
    this.projectId = projectId
    this.steps = SCAFFOLD_STEPS.map((s) => ({
      ...s,
      status: 'pending' as const,
    }))
  }

  // ── Event emitter ─────────────────────────────────────────────────────────

  on(listener: ScaffoldListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: ScaffoldEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {
        // Don't let listener errors break the scaffold flow
      }
    }
  }

  get isRunning(): boolean {
    return this._isRunning
  }

  get currentSteps(): ScaffoldStep[] {
    return [...this.steps]
  }

  // ── Progress helpers ──────────────────────────────────────────────────────

  private progress(): number {
    const done = this.steps.filter((s) => s.status === 'done').length
    return Math.round((done / this.steps.length) * 100)
  }

  private markStep(
    label: ScaffoldStepLabel,
    status: ScaffoldStepStatus,
    output?: string,
    error?: string
  ): void {
    const step = this.steps.find((s) => s.label === label)
    if (step) {
      step.status = status
      if (output) step.output = output
      if (error) step.error = error
    }
  }

  // ── Scaffold execution ────────────────────────────────────────────────────

  async run(directoryPath: string, projectName: string): Promise<boolean> {
    if (this._isRunning) return false
    this._isRunning = true

    // Reset steps
    this.steps = SCAFFOLD_STEPS.map((s) => ({
      ...s,
      status: 'pending' as const,
    }))

    // Mark project_directories as in_progress
    await this.updateDirectoryRecord(directoryPath, 'in_progress')

    try {
      // The agent's scaffoldProject endpoint handles all sub-steps
      // internally. We simulate step progress for the UI.
      for (const stepDef of SCAFFOLD_STEPS) {
        this.markStep(stepDef.label, 'running')
        this.emit({
          type: 'step_start',
          step: stepDef.label,
          message: stepDef.displayName,
          progress: this.progress(),
          steps: this.currentSteps,
        })

        // For the main scaffold call, we only call the agent once
        // during the 'install_playwright' step (which triggers the
        // full scaffold). Other steps are tracked for UI granularity.
        if (stepDef.label === 'install_playwright') {
          const result = await this.agent.scaffoldProject(
            directoryPath,
            projectName
          )

          if (!result.success) {
            const errorMsg = result.errors.join('; ') || 'Scaffold failed'
            this.markStep(stepDef.label, 'error', undefined, errorMsg)
            this.emit({
              type: 'step_error',
              step: stepDef.label,
              message: errorMsg,
              progress: this.progress(),
              steps: this.currentSteps,
            })

            // Mark remaining steps as error
            for (const remaining of SCAFFOLD_STEPS) {
              if (
                this.steps.find((s) => s.label === remaining.label)?.status ===
                'pending'
              ) {
                this.markStep(remaining.label, 'error', undefined, 'Skipped due to earlier failure')
              }
            }

            await this.updateDirectoryRecord(directoryPath, 'failed', errorMsg)
            this._isRunning = false

            this.emit({
              type: 'failed',
              message: errorMsg,
              progress: this.progress(),
              steps: this.currentSteps,
            })

            return false
          }

          // Mark all remaining steps as done since agent handled everything
          for (const s of SCAFFOLD_STEPS) {
            this.markStep(s.label, 'done')
          }

          // Emit done for each step after the current one
          for (const s of SCAFFOLD_STEPS.slice(
            SCAFFOLD_STEPS.indexOf(stepDef)
          )) {
            this.emit({
              type: 'step_done',
              step: s.label,
              message: `${s.displayName} - done`,
              progress: this.progress(),
              steps: this.currentSteps,
            })
          }

          break
        }

        // Pre-scaffold steps: just mark as done (agent handles them)
        this.markStep(stepDef.label, 'done')
        this.emit({
          type: 'step_done',
          step: stepDef.label,
          message: `${stepDef.displayName} - done`,
          progress: this.progress(),
          steps: this.currentSteps,
        })
      }

      // Update directory record
      await this.updateDirectoryRecord(directoryPath, 'completed')

      this._isRunning = false
      this.emit({
        type: 'complete',
        message: 'Project scaffolded successfully',
        progress: 100,
        steps: this.currentSteps,
      })

      return true
    } catch (err) {
      const message = (err as Error).message
      await this.updateDirectoryRecord(directoryPath, 'failed', message)
      this._isRunning = false

      this.emit({
        type: 'failed',
        message,
        progress: this.progress(),
        steps: this.currentSteps,
      })

      return false
    }
  }

  // ── Supabase project_directories ──────────────────────────────────────────

  private async updateDirectoryRecord(
    directoryPath: string,
    scaffoldStatus: 'pending' | 'in_progress' | 'completed' | 'failed',
    scaffoldError?: string
  ): Promise<void> {
    const now = new Date().toISOString()

    const row = {
      project_id: this.projectId,
      directory_path: directoryPath,
      is_scaffolded: scaffoldStatus === 'completed',
      scaffold_status: scaffoldStatus,
      scaffold_error: scaffoldError ?? null,
      last_sync_at: scaffoldStatus === 'completed' ? now : null,
      updated_at: now,
    }

    const { error } = await supabase
      .from('project_directories')
      .upsert(row, { onConflict: 'project_id' })

    if (error) {
      console.error(
        '[ScaffoldService] updateDirectoryRecord error:',
        error.message
      )
    }
  }
}

// ── Standalone helpers ──────────────────────────────────────────────────────

export async function getProjectDirectory(
  projectId: string
): Promise<{
  directoryPath: string
  isScaffolded: boolean
  scaffoldStatus: string
  scaffoldError: string | null
} | null> {
  const { data, error } = await supabase
    .from('project_directories')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error || !data) return null

  return {
    directoryPath: data.directory_path as string,
    isScaffolded: (data.is_scaffolded as boolean) ?? false,
    scaffoldStatus: (data.scaffold_status as string) ?? 'pending',
    scaffoldError: (data.scaffold_error as string | null) ?? null,
  }
}
