import type { ApiStep, ApiAuth, ResponseAssertion, CaptureVar } from '../types/api'
import type { TestCase, Feature, Project, GlobalVariable } from '../types'

// ── Variable replacement ───────────────────────────────────────────────────────

function replaceVarsInStr(
  str: string,
  globalVars: GlobalVariable[],
  capturedNames: string[],
): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
    if (capturedNames.includes(key)) return `\${${key}}`
    const gv = globalVars.find((v) => v.key === key)
    if (gv?.sensitive) return `\${process.env.${key.toUpperCase()}}`
    return `\${${key.toUpperCase()}}`
  })
}

/** Returns a JS string literal — a template literal if interpolation needed, otherwise a quoted string */
function jsStr(
  raw: string,
  globalVars: GlobalVariable[],
  capturedNames: string[],
): string {
  const replaced = replaceVarsInStr(raw, globalVars, capturedNames)
  if (replaced.includes('${')) return `\`${replaced}\``
  return JSON.stringify(raw)
}

// ── Auth header builder ────────────────────────────────────────────────────────

function authHeaderEntry(auth: ApiAuth, globalVars: GlobalVariable[], captured: string[]): string | null {
  if (auth.type === 'bearer' && auth.token) {
    const tok = jsStr(auth.token, globalVars, captured)
    return `'Authorization': \`Bearer \${${tok.replace(/^`|`$/g, '').replace(/^"(.*)"$/, '$1')}}\``
  }
  if (auth.type === 'basic' && auth.username) {
    const u = auth.username.replace(/'/g, "\\'")
    const p = auth.password.replace(/'/g, "\\'")
    return `'Authorization': \`Basic \${Buffer.from('${u}:${p}').toString('base64')}\``
  }
  return null
}

// ── JSON-path to JS property chain ───────────────────────────────────────────

function pathToChain(jsonPath: string, bodyVar: string): string {
  // $.data.items[0].id  →  body1?.data?.items?.[0]?.id
  const stripped = jsonPath.replace(/^\$/, '').replace(/^\./, '')
  if (!stripped) return bodyVar
  // Split on . but keep bracket notation
  const parts = stripped.split(/\.(?![^\[]*\])/)
  const chain = parts.map((p) => {
    const bracketMatch = /^(\w+)(\[(\d+)\])$/.exec(p)
    if (bracketMatch) return `?.${bracketMatch[1]}?.[${bracketMatch[3]}]`
    if (/^\[(\d+)\]$/.test(p)) return `?.[${p.slice(1, -1)}]`
    return `?.${p}`
  }).join('')
  return `${bodyVar}${chain}`
}

// ── Single step code block ────────────────────────────────────────────────────

function stepToCode(
  step: ApiStep,
  idx: number,
  globalVars: GlobalVariable[],
  capturedNames: string[], // mutated to add captures from this step
): string {
  const lines: string[] = []
  const resVar = `res${idx + 1}`
  const bodyVar = `body${idx + 1}`
  const method = step.method.toLowerCase()

  if (step.name) lines.push(`// ${step.name}`)

  // ── Options object ─────────────────────────────────────────────────
  const opts: string[] = []

  // Params
  const activeParams = step.params.filter((p) => p.enabled && p.key)
  if (step.auth.type === 'apikey' && step.auth.keyIn === 'query' && step.auth.keyName) {
    activeParams.push({
      id: '',
      key: step.auth.keyName,
      value: step.auth.keyValue,
      enabled: true,
    })
  }
  if (activeParams.length) {
    const entries = activeParams
      .map((p) => `      ${JSON.stringify(p.key)}: ${jsStr(p.value, globalVars, capturedNames)}`)
      .join(',\n')
    opts.push(`  params: {\n${entries}\n  }`)
  }

  // Headers
  const activeHeaders: Array<[string, string]> = step.headers
    .filter((h) => h.enabled && h.key)
    .map((h) => [h.key, h.value])

  if (step.auth.type === 'bearer' && step.auth.token) {
    const tok = step.auth.token
    const tokStr = jsStr(tok, globalVars, capturedNames)
    activeHeaders.push(['Authorization', `__TEMPLATE__Bearer \${${tokStr.replace(/^`(.*)`$/, '$1').replace(/^"(.*)"$/, '$1')}}`])
  } else if (step.auth.type === 'basic' && step.auth.username) {
    const u = step.auth.username.replace(/'/g, "\\'")
    const p = step.auth.password.replace(/'/g, "\\'")
    activeHeaders.push(['Authorization', `__BTOA__${u}:${p}`])
  } else if (step.auth.type === 'apikey' && step.auth.keyIn === 'header' && step.auth.keyName) {
    activeHeaders.push([step.auth.keyName, step.auth.keyValue])
  }

  if (activeHeaders.length) {
    const entries = activeHeaders.map(([k, v]) => {
      if (v.startsWith('__TEMPLATE__')) {
        return `      ${JSON.stringify(k)}: \`${v.replace('__TEMPLATE__', '')}\``
      }
      if (v.startsWith('__BTOA__')) {
        const creds = v.replace('__BTOA__', '')
        return `      ${JSON.stringify(k)}: \`Basic \${Buffer.from(${JSON.stringify(creds)}).toString('base64')}\``
      }
      return `      ${JSON.stringify(k)}: ${jsStr(v, globalVars, capturedNames)}`
    }).join(',\n')
    opts.push(`  headers: {\n${entries}\n  }`)
  }

  // Body
  const isBodyMethod = ['POST', 'PUT', 'PATCH'].includes(step.method)
  if (isBodyMethod && step.bodyType === 'json' && step.bodyJson.trim()) {
    opts.push(`  data: ${step.bodyJson.trim()}`)
  } else if (isBodyMethod && step.bodyType === 'formdata') {
    const activeForm = step.bodyFormData.filter((f) => f.enabled && f.key)
    if (activeForm.length) {
      const entries = activeForm
        .map((f) => `      ${JSON.stringify(f.key)}: ${jsStr(f.value, globalVars, capturedNames)}`)
        .join(',\n')
      opts.push(`  form: {\n${entries}\n  }`)
    }
  }

  const optStr = opts.length ? `, {\n${opts.join(',\n')}\n}` : ''
  const urlStr = jsStr(step.url || 'https://example.com', globalVars, capturedNames)

  lines.push(`const ${resVar} = await request.${method}(${urlStr}${optStr})`)

  // Status assertion
  if (step.statusAssertion !== null) {
    lines.push(`expect(${resVar}.status()).toBe(${step.statusAssertion})`)
  }

  // Parse body if needed
  const needsBody = step.responseAssertions.length > 0 || step.captureVars.length > 0
  if (needsBody) {
    lines.push(`const ${bodyVar} = await ${resVar}.json()`)
  }

  // Response assertions
  for (const a of step.responseAssertions) {
    if (!a.jsonPath) continue
    const chain = pathToChain(a.jsonPath, bodyVar)
    switch (a.operator) {
      case 'equals':
        lines.push(`expect(${chain}).toBe(${JSON.stringify(a.expected)})`)
        break
      case 'contains':
        lines.push(`expect(String(${chain})).toContain(${JSON.stringify(a.expected)})`)
        break
      case 'exists':
        lines.push(`expect(${chain}).toBeDefined()`)
        break
      case 'notEmpty':
        lines.push(`expect(${chain}).toBeTruthy()`)
        break
      case 'isArray':
        lines.push(`expect(Array.isArray(${chain})).toBe(true)`)
        break
      case 'hasLength':
        lines.push(`expect(${chain}).toHaveLength(${Number(a.expected) || 0})`)
        break
    }
  }

  // Capture variables
  for (const c of step.captureVars) {
    if (!c.name || !c.jsonPath) continue
    const chain = pathToChain(c.jsonPath, bodyVar)
    lines.push(`const ${c.name} = ${chain}`)
    capturedNames.push(c.name)
  }

  return lines.map((l) => `    ${l}`).join('\n')
}

// ── Public: preview for single TC ─────────────────────────────────────────────

export function generateApiTcPreview(
  tc: TestCase,
  feature: Feature,
  project: Project,
  globalVars: GlobalVariable[],
): string {
  const sorted = [...(tc.apiSteps ?? [])].sort((a, b) => a.order - b.order)
  const capturedNames: string[] = []

  const body = sorted.length
    ? sorted.map((step, i) => stepToCode(step, i, globalVars, capturedNames)).join('\n\n')
    : '    // No steps yet'

  const lang = project.language === 'typescript' ? 'TypeScript' : 'JavaScript'
  const header = `// Generated ${lang} — Playwright APIRequestContext\n`

  return `${header}import { test, expect } from '@playwright/test'

test.describe(${JSON.stringify(feature.name)}, () => {
  test(${JSON.stringify(tc.name)}, async ({ request }) => {
${body}
  })
})`
}

// ── Public: full spec file for a feature (all API TCs) ───────────────────────

export function generateApiSpecFile(
  feature: Feature,
  testCases: TestCase[],
  globalVars: GlobalVariable[],
  project: Project,
): string {
  const apiTCs = testCases.filter((tc) => (tc.type ?? 'ui') === 'api')
  if (!apiTCs.length) return ''

  const tcBlocks = apiTCs.map((tc) => {
    const sorted = [...(tc.apiSteps ?? [])].sort((a, b) => a.order - b.order)
    const captured: string[] = []
    const body = sorted.length
      ? sorted.map((s, i) => stepToCode(s, i, globalVars, captured)).join('\n\n')
      : '    // No steps'
    return `  test(${JSON.stringify(tc.name)}, async ({ request }) => {\n${body}\n  })`
  }).join('\n\n')

  return `import { test, expect } from '@playwright/test'

test.describe(${JSON.stringify(feature.name)}, () => {
${tcBlocks}
})`
}
