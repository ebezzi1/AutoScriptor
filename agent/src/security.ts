import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { v4 as uuidv4 } from 'uuid'

const CONFIG_DIR = path.join(os.homedir(), '.autoscriptor')
const TOKEN_FILE = path.join(CONFIG_DIR, 'agent-token')

export function loadOrCreateToken(): string {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
  if (fs.existsSync(TOKEN_FILE)) {
    return fs.readFileSync(TOKEN_FILE, 'utf-8').trim()
  }
  const token = uuidv4()
  fs.writeFileSync(TOKEN_FILE, token, 'utf-8')
  return token
}

export function verifyBearerToken(authHeader: string | undefined, token: string): boolean {
  if (!authHeader) return false
  const parts = authHeader.split(' ')
  return parts.length === 2 && parts[0] === 'Bearer' && parts[1] === token
}
