import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { AgentClient, detectProtocol } from '../lib/agent'
import type { HealthResponse, WSMessage, ParsedResults } from '../lib/agent'
import { useAuth } from '../components/auth/AuthProvider'
import type { Project, TestRun, TestRunResult } from '../types'
import {
  createTestRun,
  finishTestRun,
  getLatestRunResults,
} from '../lib/database/testRuns'

const DEFAULT_HTTPS_URL = 'https://localhost:4568'

export interface ConnectionTestResult {
  ok: boolean
  version?: string
  uptime?: number
  error?: string
}

// ── Runner state (shared across the app) ──────────────────────────────────────

export interface RunnerLine {
  type: 'stdout' | 'stderr' | 'info'
  text: string
  timestamp: number
}

export interface RunnerState {
  isRunning: boolean
  lines: RunnerLine[]
  exitCode: number | null
  duration: number | null
  startTime: number | null
}

export interface LatestResults {
  run: TestRun | null
  results: TestRunResult[]
  parsedResults: ParsedResults | null
}

interface AgentContextValue {
  isConnected: boolean
  isBusy: boolean
  client: AgentClient | null
  projectDir: string | null
  agentUrl: string
  agentToken: string
  agentVersion: string | null
  agentUptime: number | null
  detectedProtocol: 'https' | 'http' | null
  setAgentUrl: (url: string) => void
  setAgentToken: (token: string) => void
  /** Persists agent URL/token/setupComplete onto the current project via callback */
  saveSettings: () => Promise<void>
  testConnection: () => Promise<ConnectionTestResult>
  connect: (token?: string) => Promise<ConnectionTestResult>
  disconnect: () => void
  /** Called by App.tsx when the active project changes */
  switchProject: (project: Project | null) => void
  /** The project ID the agent is currently configured for */
  activeProjectId: string | null
  // Runner
  runner: RunnerState
  runCommand: (command: string, projectId?: string) => void
  killCommand: () => void
  clearRunner: () => void
  showRunner: boolean
  setShowRunner: (v: boolean) => void
  // Test results
  latestResults: LatestResults
  activeRunId: string | null
  loadLatestResults: (projectId: string) => Promise<void>
  // Wizard
  showSetupWizard: boolean
  setShowSetupWizard: (v: boolean) => void
  /** Number of consecutive health-check failures for current project */
  consecutiveFailures: number
  /** Callback set by App.tsx to persist agent settings on a project */
  onSaveProjectAgent: ((projectId: string, url: string, token: string, setupComplete: boolean) => void) | null
  setOnSaveProjectAgent: (cb: (projectId: string, url: string, token: string, setupComplete: boolean) => void) => void
}

const AgentContext = createContext<AgentContextValue | null>(null)

export function AgentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [agentUrl, setAgentUrl] = useState(DEFAULT_HTTPS_URL)
  const [agentToken, setAgentToken] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [projectDir, setProjectDir] = useState<string | null>(null)
  const [agentVersion, setAgentVersion] = useState<string | null>(null)
  const [agentUptime, setAgentUptime] = useState<number | null>(null)
  const [detectedProtocol, setDetectedProtocol] = useState<'https' | 'http' | null>(null)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [consecutiveFailures, setConsecutiveFailures] = useState(0)

  // Callback ref for saving project agent settings (set by App.tsx)
  const onSaveRef = useRef<((projectId: string, url: string, token: string, setupComplete: boolean) => void) | null>(null)

  // Runner state
  const [runner, setRunner] = useState<RunnerState>({
    isRunning: false,
    lines: [],
    exitCode: null,
    duration: null,
    startTime: null,
  })
  const [showRunner, setShowRunner] = useState(false)

  // Test results state
  const [latestResults, setLatestResults] = useState<LatestResults>({
    run: null,
    results: [],
    parsedResults: null,
  })
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const activeRunProjectId = useRef<string | null>(null)

  // Stable client ref so callbacks don't go stale
  const clientRef = useRef<AgentClient | null>(null)
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsConnectedRef = useRef(false)

  // ── Project switching ────────────────────────────────────────────────────────

  const switchProject = useCallback((project: Project | null) => {
    // Disconnect existing WS
    clientRef.current?.disconnectWebSocket()
    if (healthIntervalRef.current) { clearInterval(healthIntervalRef.current); healthIntervalRef.current = null }
    if (wsReconnectRef.current) { clearTimeout(wsReconnectRef.current); wsReconnectRef.current = null }

    if (!project) {
      setActiveProjectId(null)
      setAgentUrl(DEFAULT_HTTPS_URL)
      setAgentToken('')
      setIsConnected(false)
      setProjectDir(null)
      setAgentVersion(null)
      setAgentUptime(null)
      setDetectedProtocol(null)
      setConsecutiveFailures(0)
      setShowSetupWizard(false)
      clientRef.current = null
      return
    }

    setActiveProjectId(project.id)
    const url = project.agentUrl || DEFAULT_HTTPS_URL
    const token = project.agentToken || ''
    setAgentUrl(url)
    setAgentToken(token)
    setIsConnected(false)
    setProjectDir(null)
    setAgentVersion(null)
    setAgentUptime(null)
    setDetectedProtocol(null)
    setConsecutiveFailures(0)

    if (token) {
      // Build client and try connecting
      clientRef.current = new AgentClient(url, token)
    } else {
      clientRef.current = null
      // No agent configured — show wizard if setup not complete
      if (!project.agentSetupComplete) {
        setShowSetupWizard(true)
      }
    }
  }, [])

  // Rebuild client whenever url/token change manually (e.g. user edits in settings)
  useEffect(() => {
    if (agentToken) {
      if (clientRef.current) {
        clientRef.current.updateCredentials(agentUrl, agentToken)
      } else {
        clientRef.current = new AgentClient(agentUrl, agentToken)
      }
    } else {
      clientRef.current = null
      setIsConnected(false)
    }
  }, [agentUrl, agentToken])

  // WebSocket message handler
  const handleWSMessage = useCallback((msg: WSMessage) => {
    switch (msg.type) {
      case 'auth_ok':
        wsConnectedRef.current = true
        break
      case 'stdout':
        setRunner((prev) => ({
          ...prev,
          lines: [...prev.lines, { type: 'stdout', text: msg.data, timestamp: msg.timestamp }],
        }))
        break
      case 'stderr':
        setRunner((prev) => ({
          ...prev,
          lines: [...prev.lines, { type: 'stderr', text: msg.data, timestamp: msg.timestamp }],
        }))
        break
      case 'exit':
        setRunner((prev) => ({
          ...prev,
          isRunning: false,
          exitCode: msg.code,
          duration: msg.duration,
        }))
        setIsBusy(false)
        // Persist parsed results if available
        if (msg.results) {
          setLatestResults((prev) => ({ ...prev, parsedResults: msg.results! }))
          if (activeRunId) {
            const runId = activeRunId
            const projId = activeRunProjectId.current
            finishTestRun(runId, msg.results, projId ?? '', [], [])
              .then(({ results: dbResults }) => {
                setLatestResults((prev) => ({
                  ...prev,
                  run: {
                    id: runId,
                    projectId: projId ?? '',
                    command: '',
                    status: msg.results!.failed > 0 ? 'failed' : 'passed',
                    total: msg.results!.total,
                    passed: msg.results!.passed,
                    failed: msg.results!.failed,
                    skipped: msg.results!.skipped,
                    duration: msg.results!.duration,
                    createdAt: new Date().toISOString(),
                    finishedAt: new Date().toISOString(),
                  },
                  results: dbResults,
                }))
              })
              .catch(console.error)
          }
        }
        break
      case 'killed':
        setRunner((prev) => ({
          ...prev,
          isRunning: false,
          exitCode: -1,
          duration: prev.startTime ? Date.now() - prev.startTime : null,
        }))
        setIsBusy(false)
        break
      case 'error':
        setRunner((prev) => ({
          ...prev,
          lines: [...prev.lines, { type: 'info', text: `Error: ${msg.message}`, timestamp: Date.now() }],
        }))
        break
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Connect WebSocket with auto-reconnect
  const connectWS = useCallback(() => {
    const client = clientRef.current
    if (!client || !isConnected) return

    if (client.isWebSocketOpen()) return

    client.connectWebSocket(
      handleWSMessage,
      () => { wsConnectedRef.current = true },
      () => {
        wsConnectedRef.current = false
        if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current)
        wsReconnectRef.current = setTimeout(() => {
          if (clientRef.current && isConnected) connectWS()
        }, 3000)
      },
      () => {
        wsConnectedRef.current = false
      }
    )
  }, [isConnected, handleWSMessage])

  // Maintain WS connection when connected
  useEffect(() => {
    if (isConnected && clientRef.current) {
      connectWS()
    }
    return () => {
      if (wsReconnectRef.current) clearTimeout(wsReconnectRef.current)
    }
  }, [isConnected, connectWS])

  // Silent health check
  const silentCheck = useCallback(async () => {
    if (!clientRef.current || !agentToken) { setIsConnected(false); return }
    try {
      const data: HealthResponse = await clientRef.current.healthCheckWithFallback()
      setIsConnected(data.status === 'ok')
      setProjectDir(data.projectDir ?? null)
      setAgentVersion(data.version)
      setAgentUptime(data.uptime)
      setConsecutiveFailures(0)
      if (clientRef.current.detectedProtocol) {
        setDetectedProtocol(clientRef.current.detectedProtocol)
        setAgentUrl(clientRef.current.getBaseUrl())
      }
    } catch {
      setIsConnected(false)
      setConsecutiveFailures((prev) => prev + 1)
    }
  }, [agentToken])

  // Health polling: start when we have a token and a project
  useEffect(() => {
    if (!agentToken || !activeProjectId) return undefined

    silentCheck()

    healthIntervalRef.current = setInterval(silentCheck, 30000)
    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current)
    }
  }, [agentToken, activeProjectId, silentCheck])

  // ── Save settings (persists to current project) ────────────────────────────

  const saveSettings = useCallback(async () => {
    if (!activeProjectId || !onSaveRef.current) return
    onSaveRef.current(activeProjectId, agentUrl, agentToken, true)
  }, [activeProjectId, agentUrl, agentToken])

  const setOnSaveProjectAgent = useCallback(
    (cb: (projectId: string, url: string, token: string, setupComplete: boolean) => void) => {
      onSaveRef.current = cb
    },
    []
  )

  const testConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    if (!agentToken) return { ok: false, error: 'No token set' }
    const client = new AgentClient(agentUrl, agentToken)
    try {
      const data = await client.healthCheckWithFallback()
      setIsConnected(true)
      setProjectDir(data.projectDir ?? null)
      setAgentVersion(data.version)
      setAgentUptime(data.uptime)
      setConsecutiveFailures(0)
      if (client.detectedProtocol) {
        setDetectedProtocol(client.detectedProtocol)
        setAgentUrl(client.getBaseUrl())
      }
      if (clientRef.current) {
        clientRef.current.updateCredentials(client.getBaseUrl(), agentToken)
      } else {
        clientRef.current = client
      }
      return { ok: true, version: data.version, uptime: data.uptime }
    } catch (err) {
      setIsConnected(false)
      return { ok: false, error: (err as Error).message }
    }
  }, [agentUrl, agentToken])

  const connect = useCallback(async (tokenOverride?: string): Promise<ConnectionTestResult> => {
    const tok = tokenOverride ?? agentToken
    if (!tok) return { ok: false, error: 'No token set' }

    const result = await detectProtocol(tok)
    if (!result) return { ok: false, error: 'Agent not reachable on any protocol' }

    const client = new AgentClient(result.baseUrl, tok)
    try {
      const data = await client.healthCheck()
      setAgentUrl(result.baseUrl)
      if (tokenOverride) setAgentToken(tokenOverride)
      setDetectedProtocol(result.protocol)
      setIsConnected(true)
      setProjectDir(data.projectDir ?? null)
      setAgentVersion(data.version)
      setAgentUptime(data.uptime)
      setConsecutiveFailures(0)
      clientRef.current = client
      return { ok: true, version: data.version, uptime: data.uptime }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  }, [agentToken])

  const disconnect = useCallback(() => {
    clientRef.current?.disconnectWebSocket()
    setIsConnected(false)
    setProjectDir(null)
    setAgentVersion(null)
    setAgentUptime(null)
    setDetectedProtocol(null)
  }, [])

  // ── Runner commands ─────────────────────────────────────────────────────────

  const runCommand = useCallback((command: string, projectId?: string) => {
    const client = clientRef.current
    if (!client || !isConnected) return

    let cmd = command
    if (!cmd.includes('--reporter')) {
      cmd += ' --reporter=json'
    }

    if (!client.isWebSocketOpen()) {
      connectWS()
      setTimeout(() => {
        client.runCommand(cmd, 'json')
      }, 500)
    } else {
      client.runCommand(cmd, 'json')
    }

    setRunner({
      isRunning: true,
      lines: [{ type: 'info', text: `$ ${command}`, timestamp: Date.now() }],
      exitCode: null,
      duration: null,
      startTime: Date.now(),
    })
    setIsBusy(true)
    setShowRunner(true)

    setLatestResults((prev) => ({ ...prev, parsedResults: null }))

    if (projectId) {
      activeRunProjectId.current = projectId
      createTestRun(projectId, command, undefined, user?.id, user?.email ?? undefined)
        .then((run) => setActiveRunId(run.id))
        .catch(console.error)
    }
  }, [isConnected, connectWS, user?.id, user?.email])

  const loadLatestResults = useCallback(async (projectId: string) => {
    try {
      const { run, results } = await getLatestRunResults(projectId)
      setLatestResults({ run, results, parsedResults: null })
    } catch (err) {
      console.error('[AgentContext] loadLatestResults error:', err)
    }
  }, [])

  const killCommand = useCallback(() => {
    clientRef.current?.killCommand()
  }, [])

  const clearRunner = useCallback(() => {
    setRunner({
      isRunning: false,
      lines: [],
      exitCode: null,
      duration: null,
      startTime: null,
    })
  }, [])

  return (
    <AgentContext.Provider value={{
      isConnected,
      isBusy,
      client: clientRef.current,
      projectDir,
      agentUrl,
      agentToken,
      agentVersion,
      agentUptime,
      detectedProtocol,
      setAgentUrl,
      setAgentToken,
      saveSettings,
      testConnection,
      connect,
      disconnect,
      switchProject,
      activeProjectId,
      runner,
      runCommand,
      killCommand,
      clearRunner,
      showRunner,
      setShowRunner,
      latestResults,
      activeRunId,
      loadLatestResults,
      showSetupWizard,
      setShowSetupWizard,
      consecutiveFailures,
      onSaveProjectAgent: onSaveRef.current,
      setOnSaveProjectAgent,
    }}>
      {children}
    </AgentContext.Provider>
  )
}

export function useAgent() {
  const ctx = useContext(AgentContext)
  if (!ctx) throw new Error('useAgent must be inside AgentProvider')
  return ctx
}
