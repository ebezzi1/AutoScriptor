import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import { spawn } from 'child_process'

export type OS = 'macos' | 'windows' | 'linux'

export function detectOS(): OS {
  if (process.platform === 'darwin') return 'macos'
  if (process.platform === 'win32') return 'windows'
  return 'linux'
}

export function openInIDE(
  ide: 'vscode' | 'cursor' | 'terminal',
  dirPath: string,
  filePath?: string
): { success: boolean; command: string } {
  const target = filePath ? path.join(dirPath, filePath) : dirPath
  const os = detectOS()

  let command: string
  if (ide === 'vscode') {
    command = `code "${target}"`
  } else if (ide === 'cursor') {
    command = `cursor "${target}"`
  } else {
    if (os === 'macos') command = `open -a Terminal "${dirPath}"`
    else if (os === 'windows') command = `start cmd /K "cd /D ${dirPath}"`
    else command = `x-terminal-emulator --working-directory="${dirPath}"`
  }

  try {
    const proc = spawn(command, [], { shell: true, detached: true, stdio: 'ignore' })
    proc.unref()
    return { success: true, command }
  } catch {
    return { success: false, command }
  }
}

export function hashFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
  } catch {
    return ''
  }
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}
