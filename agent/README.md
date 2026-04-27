# AutoScriptor Agent

Local agent that enables AutoScriptor to run Playwright tests, sync files, and open reports directly from the web app.

## Installation

```bash
# Install globally
npm install -g autoscriptor-agent

# Or run directly with npx
npx autoscriptor-agent start
```

## Usage

```bash
# Start on default port (4567)
autoscriptor-agent start

# Start on custom port
autoscriptor-agent start --port 8080

# Check if running
autoscriptor-agent status
autoscriptor-agent status --port 8080
```

On first start, a security token is generated and saved to `~/.autoscriptor/agent-token`. The token is printed on every startup — paste it into AutoScriptor's Agent settings.

## Authentication

Every request requires the token printed on startup.

**HTTP:** `Authorization: Bearer <token>`

**WebSocket:** Send `{ "type": "auth", "token": "<token>" }` as the first message.

## Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Status, version, uptime, node/npm versions |

### Project Directory

| Method | Path | Body / Query | Description |
|--------|------|--------------|-------------|
| POST | `/project/set` | `{ path }` | Set working directory |
| GET | `/project/info` | — | Current directory details |
| POST | `/project/scaffold` | `{ path, projectName }` | Create a new Playwright project |
| POST | `/project/check-env` | — | Verify Node, npm, Playwright |

### File Operations

| Method | Path | Body / Query | Description |
|--------|------|--------------|-------------|
| POST | `/files/write` | `{ filePath, content }` | Write a single file |
| POST | `/files/write-batch` | `{ files: [{ filePath, content }] }` | Write multiple files |
| GET | `/files/read` | `?path=` | Read file content + hash |
| GET | `/files/stat` | `?path=` | File metadata |
| GET | `/files/list` | `?pattern=` | List matching files |
| DELETE | `/files/delete` | `{ filePath }` | Delete a file |
| POST | `/files/sync-check` | `{ files: [{ filePath, expectedHash }] }` | Detect local changes |

### IDE Integration

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/ide/open` | `{ ide, filePath? }` | Open in VS Code, Cursor, or Terminal |

### Reports

| Method | Path | Description |
|--------|------|-------------|
| POST | `/report/open` | Launch `npx playwright show-report` |
| GET | `/report/last-results` | Parse last JSON results |

### Playwright Utilities

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/playwright/update` | — | `npm update @playwright/test && npx playwright install` |
| POST | `/playwright/codegen` | `{ url? }` | Launch Playwright codegen |

## WebSocket (`/ws`)

Connect to `ws://localhost:4567/ws`. First message must be the auth handshake.

### Messages you can send

```jsonc
// Authenticate
{ "type": "auth", "token": "<your-token>" }

// Run a command (streams stdout/stderr back)
{ "type": "run", "command": "npx playwright test", "reporter": "json" }

// Kill the running process
{ "type": "kill" }

// Heartbeat
{ "type": "ping" }
```

### Messages you receive

```jsonc
{ "type": "auth_ok" }
{ "type": "stdout", "data": "...", "timestamp": 1234567890 }
{ "type": "stderr", "data": "...", "timestamp": 1234567890 }
{ "type": "progress", "test": "Login flow", "status": "passed" }
{ "type": "exit", "code": 0, "duration": 4200, "results": { ... } }
{ "type": "killed" }
{ "type": "pong", "timestamp": 1234567890 }
{ "type": "error", "message": "..." }
```

## Troubleshooting

**"Unauthorized" errors**
Token mismatch. Check `~/.autoscriptor/agent-token` and ensure you pasted the correct token in AutoScriptor settings.

**Port already in use**
Another process is on port 4567. Use `--port 8080` and update the Agent URL in AutoScriptor settings.

**`autoscriptor-agent` command not found**
Run `npm install -g autoscriptor-agent` again, or check that npm's global bin is in your PATH:
```bash
npm config get prefix
# Add <prefix>/bin to your PATH
```

**Browsers not installed**
Run `npx playwright install --with-deps` inside your project directory.
