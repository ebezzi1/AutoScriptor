import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { AgentClient, detectProtocol } from '../lib/agent'
import type { HealthResponse, WSMessage } from '../lib/agent'
import { useAuth } from '../components/auth/AuthProvider'
import { getPreference, setPreference } from '../lib/database/preferences'

const DEFAULT_HTTPS_URL = 'https://localhost:4568'
const DEFAULT_HTTP_URL = 'http://localhost:4567'

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
  saveSettings: () => Promise<void>
  testConnection: () => Promise<ConnectionTestResult>
  connect: (token?: string) => Promise<ConnectionTestResult>
  disconnect: () => void
  // Runner
  runner: RunnerState
  runCommand: (command: string) => void
  killCommand: () => void
  clearRunner: () => void
  showRunner: boolean
  setShowRunner: (v: boolean) => void
  // Wizard
  showSetupWizard: boolean
  setShowSetupWizard: (v: boolean) => void
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
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)

  // Runner state
  const [runner, setRunner] = useState<RunnerState>({
    isRunning: false,
    lines: [],
    exitCode: null,
    duration: null,
    startTime: null,
  })
  const [showRunner, setShowRunner] = useState(false)

  // Stable client ref so callbacks don't go stale
  const clientRef = useRef<AgentClient | null>(null)
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wsConnectedRef = useRef(false)

  // Load persisted settings from Supabase on auth
  useEffect(() => {
    if (!user) { setSettingsLoaded(true); return }
    Promise.all([
      getPreference(user.id, 'agent_url'),
      getPreference(user.id, 'agent_token'),
    ]).then(([url, token]) => {
      if (url) setAgentUrl(url)
      if (token) setAgentToken(token)
      setSettingsLoaded(true)
    }).catch(() => setSettingsLoaded(true))
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild client whenever url/token change (after settings loaded)
  useEffect(() => {
    if (!settingsLoaded) return
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
  }, [agentUrl, agentToken, settingsLoaded])

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
  }, [])

  // Connect WebSocket with auto-reconnect
  const connectWS = useCallback(() => {
    const client = clientRef.current
    if (!client || !isConnected) return

    // Don't reconnect if already open
    if (client.isWebSocketOpen()) return

    client.connectWebSocket(
      handleWSMessage,
      () => { wsConnectedRef.current = true },
      () => {
        wsConnectedRef.current = false
        // Auto-reconnect after 3s
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
      if (clientRef.current.detectedProtocol) {
        setDetectedProtocol(clientRef.current.detectedProtocol)
        setAgentUrl(clientRef.current.getBaseUrl())
      }
    } catch {
      setIsConnected(false)
    }
  }, [agentToken])

  // Initial check + 30-second polling (once settings loaded and token present)
  useEffect(() => {
    if (!settingsLoaded || !agentToken) return undefined

    silentCheck()

    healthIntervalRef.current = setInterval(silentCheck, 30000)
    return () => {
      if (healthIntervalRef.current) clearInterval(healthIntervalRef.current)
    }
  }, [settingsLoaded, agentToken, silentCheck])

  // Check setup wizard on first load
  useEffect(() => {
    if (!settingsLoaded || !user) return
    getPreference(user.id, 'agent_setup_dismissed').then((val) => {
      if (val !== '1' && !agentToken) {
        setShowSetupWizard(true)
      }
    }).catch(() => {})
  }, [settingsLoaded, user, agentToken])

  const saveSettings = useCallback(async () => {
    if (!user) return
    await Promise.all([
      setPreference(user.id, 'agent_url', agentUrl),
      setPreference(user.id, 'agent_token', agentToken),
    ])
  }, [user, agentUrl, agentToken])

  const testConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    if (!agentToken) return { ok: false, error: 'No token set' }
    const client = new AgentClient(agentUrl, agentToken)
    try {
      const data = await client.healthCheckWithFallback()
      setIsConnected(true)
      setProjectDir(data.projectDir ?? null)
      setAgentVersion(data.version)
      setAgentUptime(data.uptime)
      if (client.detectedProtocol) {
        setDetectedProtocol(client.detectedProtocol)
        setAgentUrl(client.getBaseUrl())
      }
      // Update the main client too
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

    // Try protocol detection
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

  const runCommand = useCallback((command: string) => {
    const client = clientRef.current
    if (!client || !isConnected) return

    // Ensure WS is connected
    if (!client.isWebSocketOpen()) {
      connectWS()
      // Wait briefly for connection
      setTimeout(() => {
        client.runCommand(command)
      }, 500)
    } else {
      client.runCommand(command)
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
  }, [isConnected, connectWS])

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
      runner,
      runCommand,
      killCommand,
      clearRunner,
      showRunner,
      setShowRunner,
      showSetupWizard,
      setShowSetupWizard,
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
