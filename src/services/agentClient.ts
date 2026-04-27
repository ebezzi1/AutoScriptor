/**
 * Agent Client Service
 *
 * Typed wrapper around all agent HTTP endpoints with connection retry
 * and exponential backoff. Reads agent URL from project settings or env.
 */

import type {
  HealthResponse,
  ProjectInfoResponse,
  ScaffoldResponse,
  CheckEnvResponse,
  FileStatResponse,
  FileReadResponse,
  FileListResponse,
} from '../lib/agent'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AgentClientConfig {
  baseUrl: string
  token: string
}

export interface AgentRequestOptions {
  timeoutMs?: number
  retries?: number
}

export interface WriteBatchResult {
  success: boolean
  written: number
  errors: { filePath: string; error: string }[]
}

export interface WriteFileResult {
  success: boolean
  filePath: string
}

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_AGENT_URL =
  import.meta.env.VITE_AGENT_URL ?? 'http://localhost:4567'

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_RETRIES = 3
const INITIAL_BACKOFF_MS = 500
const MAX_BACKOFF_MS = 8_000

// ── Helpers ───────────────────────────────────────────────────────────────────

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffMs(attempt: number): number {
  const ms = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
  // Add jitter: +/- 25%
  const jitter = ms * 0.25 * (Math.random() * 2 - 1)
  return Math.min(ms + jitter, MAX_BACKOFF_MS)
}

// ── AgentClientService ────────────────────────────────────────────────────────

export class AgentClientService {
  private baseUrl: string
  private token: string

  constructor(config?: Partial<AgentClientConfig>) {
    this.baseUrl = (config?.baseUrl ?? DEFAULT_AGENT_URL).replace(/\/$/, '')
    this.token = config?.token ?? ''
  }

  // ── Configuration ─────────────────────────────────────────────────────────

  getBaseUrl(): string {
    return this.baseUrl
  }

  getToken(): string {
    return this.token
  }

  updateConfig(config: Partial<AgentClientConfig>): void {
    if (config.baseUrl) this.baseUrl = config.baseUrl.replace(/\/$/, '')
    if (config.token !== undefined) this.token = config.token
  }

  // ── Core request with retry ───────────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts?: AgentRequestOptions
  ): Promise<T> {
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const maxRetries = opts?.retries ?? 0 // default: no retry on normal calls

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        await wait(backoffMs(attempt - 1))
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const res = await fetch(`${this.baseUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timer)

        if (!res.ok) {
          const err = (await res.json().catch(() => ({
            error: res.statusText,
          }))) as { error?: string }
          throw new Error(err.error ?? res.statusText)
        }

        return (await res.json()) as T
      } catch (err) {
        clearTimeout(timer)
        lastError = err as Error

        // Don't retry on auth errors or client errors (4xx)
        if (
          lastError.message.includes('401') ||
          lastError.message.includes('403') ||
          lastError.message.includes('404')
        ) {
          throw lastError
        }
      }
    }

    throw lastError ?? new Error('Request failed')
  }

  // ── Connection ────────────────────────────────────────────────────────────

  async isConnected(): Promise<boolean> {
    try {
      const health = await this.request<HealthResponse>('GET', '/health', undefined, {
        timeoutMs: 3_000,
      })
      return health.status === 'ok'
    } catch {
      return false
    }
  }

  async getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('GET', '/health', undefined, {
      retries: DEFAULT_RETRIES,
    })
  }

  // ── Project ───────────────────────────────────────────────────────────────

  async setProjectDirectory(
    path: string
  ): Promise<ProjectInfoResponse & { success: boolean }> {
    return this.request('POST', '/project/set', { path }, { retries: 1 })
  }

  async getProjectInfo(): Promise<ProjectInfoResponse> {
    return this.request('GET', '/project/info')
  }

  async scaffoldProject(
    path: string,
    projectName: string
  ): Promise<ScaffoldResponse> {
    return this.request(
      'POST',
      '/project/scaffold',
      { path, projectName },
      { timeoutMs: 300_000, retries: 0 }
    )
  }

  async checkEnvironment(): Promise<CheckEnvResponse> {
    return this.request('POST', '/project/check-env', undefined, { retries: 1 })
  }

  // ── Files ─────────────────────────────────────────────────────────────────

  async writeFile(filePath: string, content: string): Promise<WriteFileResult> {
    return this.request('POST', '/files/write', { filePath, content })
  }

  async writeBatch(
    files: { filePath: string; content: string }[]
  ): Promise<WriteBatchResult> {
    return this.request('POST', '/files/write-batch', { files }, { timeoutMs: 30_000 })
  }

  async readFile(filePath: string): Promise<FileReadResponse> {
    return this.request(
      'GET',
      `/files/read?path=${encodeURIComponent(filePath)}`
    )
  }

  async statFile(filePath: string): Promise<FileStatResponse> {
    return this.request(
      'GET',
      `/files/stat?path=${encodeURIComponent(filePath)}`
    )
  }

  async listFiles(pattern?: string): Promise<FileListResponse> {
    const q = pattern ? `?pattern=${encodeURIComponent(pattern)}` : ''
    return this.request('GET', `/files/list${q}`)
  }
}
