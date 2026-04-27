import express from 'express'
import cors from 'cors'
import * as http from 'http'
import * as https from 'https'
import { WebSocketServer } from 'ws'
import type { WebSocket as WS } from 'ws'
import { execSync, spawn } from 'child_process'
import type { ChildProcess } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as os from 'os'
import chalk from 'chalk'
import { loadOrCreateToken, verifyBearerToken } from './security'
import { openInIDE, hashFile, ensureDir } from './utils'
import { extractJSONFromStdout, parsePlaywrightJSON } from './parser'
import type { ParsedResults } from './parser'

const VERSION = '1.0.0'
const startTime = Date.now()

interface ProjectState {
  path: string | null
}

const projectState: ProjectState = { path: null }

// ── Helpers ────────────────────────────────────────────────────────────────────

function requireAuth(token: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!verifyBearerToken(req.headers.authorization, token)) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    next()
  }
}

function getProjectInfo(projectPath: string) {
  const hasPackageJson = fs.existsSync(path.join(projectPath, 'package.json'))
  const hasPlaywright = fs.existsSync(path.join(projectPath, 'node_modules', '@playwright', 'test'))
  const gitInitialized = fs.existsSync(path.join(projectPath, '.git'))

  let playwrightVersion: string | null = null
  if (hasPlaywright) {
    try {
      const pkgPath = path.join(projectPath, 'node_modules', '@playwright', 'test', 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      playwrightVersion = pkg.version ?? null
    } catch { /* ignore */ }
  }

  return { hasPackageJson, hasPlaywright, playwrightVersion, gitInitialized }
}

function resolveFilePath(filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(projectState.path ?? '.', filePath)
}

// ── SSL certificate management ────────────────────────────────────────────────

function getOrCreateCerts(): { cert: string; key: string } {
  const configDir = path.join(os.homedir(), '.autoscriptor')
  const certPath = path.join(configDir, 'cert.pem')
  const keyPath = path.join(configDir, 'key.pem')

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath, 'utf-8'),
      key: fs.readFileSync(keyPath, 'utf-8'),
    }
  }

  // Generate self-signed certificate
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const selfsigned = require('selfsigned')
  const attrs = [{ name: 'commonName', value: 'localhost' }]
  const pems = selfsigned.generate(attrs, {
    keySize: 2048,
    days: 365,
    algorithm: 'sha256',
    extensions: [
      { name: 'subjectAltName', altNames: [
        { type: 2, value: 'localhost' },
        { type: 7, ip: '127.0.0.1' },
      ]},
    ],
  })

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  fs.writeFileSync(certPath, pems.cert, 'utf-8')
  fs.writeFileSync(keyPath, pems.private, 'utf-8')

  return { cert: pems.cert, key: pems.private }
}

// ── WebSocket handler factory ─────────────────────────────────────────────────

function attachWebSocket(server: http.Server | https.Server, wsPath: string, token: string) {
  const wss = new WebSocketServer({ server, path: wsPath })

  wss.on('connection', (ws: WS) => {
    let authenticated = false
    let currentProc: ChildProcess | null = null
    let procStartTime = 0
    let stdoutBuffer = ''

    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.send(JSON.stringify({ type: 'error', message: 'Auth timeout' }))
        ws.close()
      }
    }, 5000)

    ws.on('message', (raw: Buffer) => {
      let msg: Record<string, unknown>
      try { msg = JSON.parse(raw.toString()) } catch { return }

      // Auth handshake
      if (!authenticated) {
        if (msg.type === 'auth' && msg.token === token) {
          authenticated = true
          clearTimeout(authTimeout)
          ws.send(JSON.stringify({ type: 'auth_ok' }))
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' }))
          ws.close()
        }
        return
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
        return
      }

      if (msg.type === 'kill') {
        if (currentProc) {
          currentProc.kill('SIGTERM')
          const killTimer = setTimeout(() => { if (currentProc) currentProc.kill('SIGKILL') }, 5000)
          currentProc.on('exit', () => clearTimeout(killTimer))
          ws.send(JSON.stringify({ type: 'killed' }))
          currentProc = null
        }
        return
      }

      if (msg.type === 'run') {
        if (currentProc) {
          ws.send(JSON.stringify({ type: 'error', message: 'A command is already running' }))
          return
        }

        const command = msg.command as string
        const reporter = msg.reporter as string | undefined
        const cwd = projectState.path ?? '.'

        let fullCommand = command
        if (reporter === 'json' && command.includes('playwright')) {
          fullCommand = command + ' --reporter=json'
        }

        stdoutBuffer = ''
        procStartTime = Date.now()

        currentProc = spawn(fullCommand, [], { cwd, shell: true })

        currentProc.stdout?.on('data', (data: Buffer) => {
          const text = data.toString()
          stdoutBuffer += text
          ws.send(JSON.stringify({ type: 'stdout', data: text, timestamp: Date.now() }))

          // Emit progress events for common Playwright output patterns
          const lines = text.split('\n')
          for (const line of lines) {
            const m = line.match(/^\s*(✓|✘|×|○|•)\s+(.+?)\s+\((\d+)ms\)/)
            if (m) {
              const status = m[1] === '✓' ? 'passed' : m[1] === '○' ? 'skipped' : 'failed'
              ws.send(JSON.stringify({ type: 'progress', test: m[2].trim(), status }))
            }
          }
        })

        currentProc.stderr?.on('data', (data: Buffer) => {
          ws.send(JSON.stringify({ type: 'stderr', data: data.toString(), timestamp: Date.now() }))
        })

        currentProc.on('exit', (code) => {
          const duration = Date.now() - procStartTime
          let results: ParsedResults | null = null
          if (reporter === 'json') {
            results = extractJSONFromStdout(stdoutBuffer)
          }
          ws.send(JSON.stringify({ type: 'exit', code: code ?? 0, duration, ...(results ? { results } : {}) }))
          currentProc = null
        })
      }
    })

    ws.on('close', () => {
      clearTimeout(authTimeout)
      if (currentProc) { currentProc.kill('SIGTERM'); currentProc = null }
    })
  })

  return wss
}

// ── Server factory ─────────────────────────────────────────────────────────────

export interface ServerOptions {
  httpPort: number
  httpsPort: number
  httpsOnly?: boolean
  httpOnly?: boolean
}

export function startServer(opts: ServerOptions): void {
  const { httpPort, httpsPort, httpsOnly = false, httpOnly = false } = opts
  const token = loadOrCreateToken()
  const app = express()

  app.use(cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman) and localhost/HTTPS app origins
      if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin) || /^https:\/\//.test(origin ?? '')) cb(null, true)
      else cb(null, false)
    },
  }))
  app.use(express.json({ limit: '50mb' }))

  const auth = requireAuth(token)

  // ── Health ───────────────────────────────────────────────────────────────────

  app.get('/health', auth, (_req, res) => {
    let npmVersion = ''
    try { npmVersion = execSync('npm --version', { timeout: 5000 }).toString().trim() } catch { /* ignore */ }
    res.json({
      status: 'ok',
      version: VERSION,
      uptime: Date.now() - startTime,
      projectDir: projectState.path,
      nodeVersion: process.version,
      npmVersion,
    })
  })

  // ── Project ──────────────────────────────────────────────────────────────────

  app.post('/project/set', auth, (req, res) => {
    const { path: projectPath } = req.body as { path: string }
    if (!projectPath || !fs.existsSync(projectPath)) {
      res.status(400).json({ error: 'Path does not exist' })
      return
    }
    projectState.path = projectPath
    res.json({ success: true, path: projectPath, ...getProjectInfo(projectPath) })
  })

  app.get('/project/info', auth, (_req, res) => {
    if (!projectState.path) {
      res.json({ path: null, hasPackageJson: false, hasPlaywright: false, playwrightVersion: null, gitInitialized: false, nodeVersion: process.version })
      return
    }
    res.json({ path: projectState.path, ...getProjectInfo(projectState.path), nodeVersion: process.version })
  })

  app.post('/project/scaffold', auth, (req, res) => {
    const { path: projectPath, projectName } = req.body as { path: string; projectName?: string }
    if (!projectPath) { res.status(400).json({ error: 'path is required' }); return }

    const errors: string[] = []

    const steps: { name: string; fn: () => void }[] = [
      { name: 'Create directory', fn: () => { fs.mkdirSync(projectPath, { recursive: true }) } },
      { name: 'npm init', fn: () => {
        execSync('npm init -y', { cwd: projectPath, timeout: 30000 })
        if (projectName) {
          const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8'))
          pkg.name = projectName.toLowerCase().replace(/\s+/g, '-')
          fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify(pkg, null, 2))
        }
      }},
      { name: 'Install @playwright/test', fn: () => { execSync('npm install -D @playwright/test', { cwd: projectPath, timeout: 120000 }) } },
      { name: 'Install browsers', fn: () => { execSync('npx playwright install --with-deps', { cwd: projectPath, timeout: 300000 }) } },
      { name: 'Create folder structure', fn: () => {
        for (const dir of ['tests', 'utils', 'fixtures', 'pages']) {
          fs.mkdirSync(path.join(projectPath, dir), { recursive: true })
        }
      }},
      { name: 'Git init', fn: () => {
        execSync('git init', { cwd: projectPath, timeout: 10000 })
        execSync('git add .', { cwd: projectPath, timeout: 10000 })
        try { execSync('git commit -m "Initial scaffold"', { cwd: projectPath, timeout: 10000 }) } catch { /* no commits if git not configured */ }
      }},
    ]

    for (const step of steps) {
      try { step.fn() } catch (err) { errors.push(`${step.name}: ${(err as Error).message}`) }
    }

    if (errors.length === 0) projectState.path = projectPath
    res.json({ success: errors.length === 0, path: projectPath, errors })
  })

  app.post('/project/check-env', auth, (_req, res) => {
    const checks: { name: string; passed: boolean; version?: string; error?: string }[] = []

    checks.push({ name: 'Node.js', passed: true, version: process.version })

    try {
      const v = execSync('npm --version', { timeout: 5000 }).toString().trim()
      checks.push({ name: 'npm', passed: true, version: v })
    } catch { checks.push({ name: 'npm', passed: false, error: 'Not found' }) }

    if (projectState.path) {
      const pwPath = path.join(projectState.path, 'node_modules', '@playwright', 'test', 'package.json')
      if (fs.existsSync(pwPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pwPath, 'utf-8'))
          checks.push({ name: '@playwright/test', passed: true, version: pkg.version })
        } catch { checks.push({ name: '@playwright/test', passed: false, error: 'Installed but unreadable' }) }
      } else {
        checks.push({ name: '@playwright/test', passed: false, error: 'Not installed in project' })
      }
    } else {
      checks.push({ name: '@playwright/test', passed: false, error: 'No project directory set' })
    }

    res.json({ ready: checks.every((c) => c.passed), checks })
  })

  // ── Files ────────────────────────────────────────────────────────────────────

  app.post('/files/write', auth, (req, res) => {
    const { filePath, content } = req.body as { filePath: string; content: string }
    if (!filePath) { res.status(400).json({ error: 'filePath required' }); return }
    const resolved = resolveFilePath(filePath)
    try {
      ensureDir(path.dirname(resolved))
      fs.writeFileSync(resolved, content, 'utf-8')
      res.json({ success: true, filePath: resolved })
    } catch (err) { res.status(500).json({ error: (err as Error).message }) }
  })

  app.post('/files/write-batch', auth, (req, res) => {
    const { files } = req.body as { files: { filePath: string; content: string }[] }
    const errors: { filePath: string; error: string }[] = []
    let written = 0
    for (const { filePath, content } of files) {
      const resolved = resolveFilePath(filePath)
      try {
        ensureDir(path.dirname(resolved))
        fs.writeFileSync(resolved, content, 'utf-8')
        written++
      } catch (err) { errors.push({ filePath, error: (err as Error).message }) }
    }
    res.json({ success: errors.length === 0, written, errors })
  })

  app.get('/files/read', auth, (req, res) => {
    const filePath = req.query.path as string
    if (!filePath) { res.status(400).json({ error: 'path query required' }); return }
    const resolved = resolveFilePath(filePath)
    try {
      const content = fs.readFileSync(resolved, 'utf-8')
      const stat = fs.statSync(resolved)
      const hash = crypto.createHash('md5').update(content).digest('hex')
      res.json({ content, modifiedAt: stat.mtime.toISOString(), hash })
    } catch (err) { res.status(404).json({ error: (err as Error).message }) }
  })

  app.get('/files/stat', auth, (req, res) => {
    const filePath = req.query.path as string
    if (!filePath) { res.status(400).json({ error: 'path query required' }); return }
    const resolved = resolveFilePath(filePath)
    try {
      const stat = fs.statSync(resolved)
      res.json({ exists: true, modifiedAt: stat.mtime.toISOString(), size: stat.size, hash: hashFile(resolved) })
    } catch { res.json({ exists: false, modifiedAt: null, size: 0, hash: '' }) }
  })

  app.get('/files/list', auth, (req, res) => {
    const pattern = (req.query.pattern as string) || 'tests/**/*.spec.{ts,js}'
    const baseDir = projectState.path ?? '.'
    const files: { path: string; modifiedAt: string; size: number }[] = []
    const matchSpec = pattern.includes('.spec.')
    const matchTs = pattern.includes('.ts')
    const matchJs = pattern.includes('.js')

    function walk(dir: string) {
      try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
            walk(full)
          } else if (entry.isFile()) {
            const isSpec = entry.name.includes('.spec.') || entry.name.includes('.test.')
            const isTsJs = entry.name.endsWith('.ts') || entry.name.endsWith('.js')
            const include = matchSpec ? (isSpec && isTsJs) : (!matchTs && !matchJs) || isTsJs
            if (include) {
              const stat = fs.statSync(full)
              files.push({ path: path.relative(baseDir, full), modifiedAt: stat.mtime.toISOString(), size: stat.size })
            }
          }
        }
      } catch { /* skip unreadable dirs */ }
    }

    walk(baseDir)
    res.json({ files })
  })

  app.delete('/files/delete', auth, (req, res) => {
    const { filePath } = req.body as { filePath: string }
    if (!filePath) { res.status(400).json({ error: 'filePath required' }); return }
    const resolved = resolveFilePath(filePath)
    try { fs.unlinkSync(resolved); res.json({ success: true }) }
    catch (err) { res.status(500).json({ error: (err as Error).message }) }
  })

  app.post('/files/sync-check', auth, (req, res) => {
    const { files } = req.body as { files: { filePath: string; expectedHash: string }[] }
    const conflicts: { filePath: string; localHash: string; expectedHash: string; localModifiedAt: string }[] = []

    for (const { filePath, expectedHash } of files) {
      const resolved = resolveFilePath(filePath)
      const localHash = hashFile(resolved)
      if (localHash && localHash !== expectedHash) {
        try {
          const stat = fs.statSync(resolved)
          conflicts.push({ filePath, localHash, expectedHash, localModifiedAt: stat.mtime.toISOString() })
        } catch { /* skip */ }
      }
    }

    res.json({ conflicts })
  })

  // ── IDE ──────────────────────────────────────────────────────────────────────

  app.post('/ide/open', auth, (req, res) => {
    const { ide, filePath } = req.body as { ide: 'vscode' | 'cursor' | 'terminal'; filePath?: string }
    if (!projectState.path) { res.status(400).json({ error: 'No project directory set' }); return }
    res.json(openInIDE(ide, projectState.path, filePath))
  })

  // ── Reports ──────────────────────────────────────────────────────────────────

  app.post('/report/open', auth, (_req, res) => {
    if (!projectState.path) { res.status(400).json({ error: 'No project directory set' }); return }
    const proc = spawn('npx', ['playwright', 'show-report'], { cwd: projectState.path, detached: true, stdio: 'ignore' })
    proc.unref()
    res.json({ success: true })
  })

  app.get('/report/last-results', auth, (_req, res) => {
    if (!projectState.path) { res.status(400).json({ error: 'No project directory set' }); return }
    const candidates = [
      path.join(projectState.path, 'test-results', 'results.json'),
      path.join(projectState.path, 'playwright-report', 'results.json'),
    ]
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const parsed = parsePlaywrightJSON(fs.readFileSync(p, 'utf-8'))
          if (parsed) { res.json(parsed); return }
        } catch { /* try next */ }
      }
    }
    res.json({ error: 'No results found' })
  })

  // ── Playwright utilities ──────────────────────────────────────────────────────

  app.post('/playwright/update', auth, (_req, res) => {
    if (!projectState.path) { res.status(400).json({ error: 'No project directory set' }); return }
    try {
      execSync('npm update @playwright/test', { cwd: projectState.path, timeout: 120000 })
      execSync('npx playwright install', { cwd: projectState.path, timeout: 300000 })
      const pkg = JSON.parse(fs.readFileSync(
        path.join(projectState.path, 'node_modules', '@playwright', 'test', 'package.json'), 'utf-8'
      ))
      res.json({ success: true, newVersion: pkg.version })
    } catch (err) { res.status(500).json({ error: (err as Error).message }) }
  })

  app.post('/playwright/codegen', auth, (req, res) => {
    const { url } = req.body as { url?: string }
    if (!projectState.path) { res.status(400).json({ error: 'No project directory set' }); return }
    const args = ['playwright', 'codegen', ...(url ? [url] : [])]
    const proc = spawn('npx', args, { cwd: projectState.path, detached: true, stdio: 'ignore' })
    proc.unref()
    res.json({ success: true })
  })

  // ── Start servers ────────────────────────────────────────────────────────────

  const cleanup: (() => void)[] = []

  if (!httpsOnly) {
    const httpServer = http.createServer(app)
    attachWebSocket(httpServer, '/ws', token)

    httpServer.listen(httpPort, () => {
      console.log(chalk.dim('  HTTP  ') + chalk.white(`http://localhost:${httpPort}`))
      console.log(chalk.dim('  WS    ') + chalk.white(`ws://localhost:${httpPort}/ws`))
    })

    cleanup.push(() => httpServer.close())
  }

  if (!httpOnly) {
    try {
      const certs = getOrCreateCerts()
      const httpsServer = https.createServer({ cert: certs.cert, key: certs.key }, app)
      attachWebSocket(httpsServer, '/ws', token)

      httpsServer.listen(httpsPort, () => {
        console.log(chalk.dim('  HTTPS ') + chalk.white(`https://localhost:${httpsPort}`))
        console.log(chalk.dim('  WSS   ') + chalk.white(`wss://localhost:${httpsPort}/ws`))
      })

      cleanup.push(() => httpsServer.close())
    } catch (err) {
      console.log(chalk.yellow('  ⚠ HTTPS failed to start: ' + (err as Error).message))
    }
  }

  // Print banner
  console.log()
  console.log(chalk.bold('  AutoScriptor Agent') + chalk.dim(` v${VERSION}`))
  console.log(chalk.dim('  ─────────────────────────────────────────'))
  console.log(chalk.dim('  Token ') + chalk.yellow(token))
  console.log(chalk.dim('  ─────────────────────────────────────────'))
  console.log(chalk.green('  ✓ Ready'))
  console.log()

  const shutdown = () => { cleanup.forEach((fn) => fn()); process.exit(0) }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
