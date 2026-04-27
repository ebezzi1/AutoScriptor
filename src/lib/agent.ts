// ── Types ─────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string
  version: string
  uptime: number
  projectDir: string | null
  nodeVersion: string
  npmVersion: string
}

export interface ProjectInfoResponse {
  path: string | null
  hasPackageJson: boolean
  hasPlaywright: boolean
  playwrightVersion: string | null
  gitInitialized: boolean
  nodeVersion?: string
}

export interface ScaffoldResponse {
  success: boolean
  path: string
  errors: string[]
}

export interface EnvCheck {
  name: string
  passed: boolean
  version?: string
  error?: string
}

export interface CheckEnvResponse {
  ready: boolean
  checks: EnvCheck[]
}

export interface FileStatResponse {
  exists: boolean
  modifiedAt: string | null
  size: number
  hash: string
}

export interface FileReadResponse {
  content: string
  modifiedAt: string
  hash: string
}

export interface FileListResponse {
  files: { path: string; modifiedAt: string; size: number }[]
}

export interface SyncConflict {
  filePath: string
  localHash: string
  expectedHash: string
  localModifiedAt: string
}

export interface ParsedTest {
  name: string
  file: string
  status: 'passed' | 'failed' | 'skipped' | 'timedOut'
  duration: number
  error?: string
  steps?: string[]
}

export interface ParsedResults {
  total: number
  passed: number
  failed: number
  skipped: number
  duration: number
  tests: ParsedTest[]
}

export type WSMessage =
  | { type: 'auth_ok' }
  | { type: 'error'; message: string }
  | { type: 'stdout'; data: string; timestamp: number }
  | { type: 'stderr'; data: string; timestamp: number }
  | { type: 'progress'; test: string; status: 'running' | 'passed' | 'failed' | 'skipped' }
  | { type: 'exit'; code: number; duration: number; results?: ParsedResults }
  | { type: 'killed' }
  | { type: 'pong'; timestamp: number }

// ── Protocol detection ───────────────────────────────────────────────────────

const HTTPS_URL = 'https://localhost:4568'
const HTTP_URL = 'http://localhost:4567'

/** Try HTTPS first, fall back to HTTP. Returns the working base URL or null. */
export async function detectProtocol(token: string): Promise<{ baseUrl: string; protocol: 'https' | 'http' } | null> {
  for (const candidate of [
    { baseUrl: HTTPS_URL, protocol: 'https' as const },
    { baseUrl: HTTP_URL, protocol: 'http' as const },
  ]) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      const res = await fetch(`${candidate.baseUrl}/health`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (res.ok) return candidate
    } catch {
      // try next
    }
  }
  return null
}

// ── AgentClient ───────────────────────────────────────────────────────────────

export class AgentClient {
  private baseUrl: string
  private token: string
  private ws: WebSocket | null = null
  /** Which protocol is currently working */
  detectedProtocol: 'https' | 'http' | null = null

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  getBaseUrl(): string { return this.baseUrl }
  getToken(): string { return this.token }

  updateCredentials(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    timeoutMs = 10000
  ): Promise<T> {
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
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string }
        throw new Error(err.error ?? res.statusText)
      }
      return res.json() as Promise<T>
    } finally {
      clearTimeout(timer)
    }
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthResponse> {
    return this.request('GET', '/health')
  }

  /** Try HTTPS then HTTP, returning health data and updating internal baseUrl */
  async healthCheckWithFallback(): Promise<HealthResponse> {
    const result = await detectProtocol(this.token)
    if (result) {
      this.baseUrl = result.baseUrl
      this.detectedProtocol = result.protocol
      return this.request('GET', '/health')
    }
    throw new Error('Agent not reachable')
  }

  // ── Project ────────────────────────────────────────────────────────────────

  setProjectDir(path: string): Promise<ProjectInfoResponse & { success: boolean }> {
    return this.request('POST', '/project/set', { path })
  }

  getProjectInfo(): Promise<ProjectInfoResponse> {
    return this.request('GET', '/project/info')
  }

  scaffoldProject(path: string, projectName: string): Promise<ScaffoldResponse> {
    return this.request('POST', '/project/scaffold', { path, projectName }, 300000)
  }

  checkEnvironment(): Promise<CheckEnvResponse> {
    return this.request('POST', '/project/check-env')
  }

  // ── Files ──────────────────────────────────────────────────────────────────

  writeFile(filePath: string, content: string): Promise<{ success: boolean; filePath: string }> {
    return this.request('POST', '/files/write', { filePath, content })
  }

  writeBatch(files: { filePath: string; content: string }[]): Promise<{ success: boolean; written: number; errors: { filePath: string; error: string }[] }> {
    return this.request('POST', '/files/write-batch', { files })
  }

  readFile(filePath: string): Promise<FileReadResponse> {
    return this.request('GET', `/files/read?path=${encodeURIComponent(filePath)}`)
  }

  statFile(filePath: string): Promise<FileStatResponse> {
    return this.request('GET', `/files/stat?path=${encodeURIComponent(filePath)}`)
  }

  listFiles(pattern?: string): Promise<FileListResponse> {
    const q = pattern ? `?pattern=${encodeURIComponent(pattern)}` : ''
    return this.request('GET', `/files/list${q}`)
  }

  deleteFile(filePath: string): Promise<{ success: boolean }> {
    return this.request('DELETE', '/files/delete', { filePath })
  }

  syncCheck(files: { filePath: string; expectedHash: string }[]): Promise<{ conflicts: SyncConflict[] }> {
    return this.request('POST', '/files/sync-check', { files })
  }

  // ── IDE ────────────────────────────────────────────────────────────────────

  openInIDE(ide: 'vscode' | 'cursor' | 'terminal', filePath?: string): Promise<{ success: boolean; command: string }> {
    return this.request('POST', '/ide/open', { ide, filePath })
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  openReport(): Promise<{ success: boolean }> {
    return this.request('POST', '/report/open')
  }

  getLastResults(): Promise<ParsedResults | { error: string }> {
    return this.request('GET', '/report/last-results')
  }

  // ── Playwright ─────────────────────────────────────────────────────────────

  updatePlaywright(): Promise<{ success: boolean; newVersion: string }> {
    return this.request('POST', '/playwright/update', undefined, 300000)
  }

  launchCodegen(url?: string): Promise<{ success: boolean }> {
    return this.request('POST', '/playwright/codegen', { url })
  }

  // ── WebSocket ──────────────────────────────────────────────────────────────

  connectWebSocket(
    onMessage: (msg: WSMessage) => void,
    onOpen?: () => void,
    onClose?: () => void,
    onError?: () => void
  ): WebSocket {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws'
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      this.ws!.send(JSON.stringify({ type: 'auth', token: this.token }))
      onOpen?.()
    }
    this.ws.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data as string) as WSMessage) } catch { /* ignore */ }
    }
    this.ws.onclose = () => onClose?.()
    this.ws.onerror = () => onError?.()

    return this.ws
  }

  disconnectWebSocket(): void {
    if (this.ws) { this.ws.close(); this.ws = null }
  }

  isWebSocketOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  runCommand(command: string, reporter?: 'json'): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'run', command, reporter }))
    }
  }

  killCommand(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'kill' }))
    }
  }

  ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'ping' }))
    }
  }
}
