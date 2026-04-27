#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'

const VERSION = '1.0.0'

const program = new Command()
program
  .name('autoscriptor-agent')
  .description('AutoScriptor local agent — runs Playwright tests and syncs files')
  .version(VERSION)

program
  .command('start')
  .description('Start the agent server')
  .option('-p, --port <port>', 'HTTP port to listen on', '4567')
  .option('--https-port <port>', 'HTTPS port to listen on', '4568')
  .option('--https-only', 'Only start the HTTPS server')
  .option('--http-only', 'Only start the HTTP server')
  .action(async (opts: { port: string; httpsPort: string; httpsOnly?: boolean; httpOnly?: boolean }) => {
    const { startServer } = await import('./server')
    startServer({
      httpPort: parseInt(opts.port, 10),
      httpsPort: parseInt(opts.httpsPort, 10),
      httpsOnly: opts.httpsOnly,
      httpOnly: opts.httpOnly,
    })
  })

program
  .command('status')
  .description('Check if the agent is running')
  .option('-p, --port <port>', 'Port to check', '4567')
  .action(async (opts: { port: string }) => {
    const port = opts.port
    try {
      // Node 18+ has native fetch; fall back to http for older versions
      const data = await fetchJSON(`http://localhost:${port}/health`, '')
      console.log(chalk.green(`✓ Agent is running on port ${port}`))
      console.log(chalk.dim(`  Version : ${(data as Record<string, string>).version}`))
      console.log(chalk.dim(`  Node    : ${(data as Record<string, string>).nodeVersion}`))
      const uptime = Number((data as Record<string, unknown>).uptime)
      console.log(chalk.dim(`  Uptime  : ${Math.floor(uptime / 1000)}s`))
      const dir = (data as Record<string, unknown>).projectDir
      if (dir) console.log(chalk.dim(`  Project : ${dir}`))
    } catch (err) {
      console.log(chalk.red(`✗ Agent is not running on port ${port}`))
      console.log(chalk.dim(`  ${(err as Error).message}`))
      process.exit(1)
    }
  })

async function fetchJSON(url: string, _token: string): Promise<unknown> {
  if (typeof fetch !== 'undefined') {
    const res = await (fetch as typeof globalThis.fetch)(url, { signal: AbortSignal.timeout(3000) })
    return res.json()
  }
  // Fallback for Node < 18
  return new Promise((resolve, reject) => {
    const http = require('http') as typeof import('http')
    http.get(url, (res) => {
      let body = ''
      res.on('data', (d: Buffer) => { body += d.toString() })
      res.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) } })
    }).on('error', reject)
  })
}

program.parse(process.argv)
