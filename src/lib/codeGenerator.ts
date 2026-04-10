import type {
  Project,
  Feature,
  TestCase,
  TestStep,
  GlobalVariable,
  ReusableUtil,
  Fixture,
  SelectorStrategy,
} from '../types'

// ── Locator generation ──────────────────────────────────────────────────────

function buildLocator(selector: string, strategy: SelectorStrategy): string {
  switch (strategy) {
    case 'css':       return `page.locator(${JSON.stringify(selector)})`
    case 'xpath':     return `page.locator(${JSON.stringify('xpath=' + selector)})`
    case 'data-testid': return `page.getByTestId(${JSON.stringify(selector)})`
    case 'role':      return `page.getByRole(${JSON.stringify(selector)})`
    case 'text':      return `page.getByText(${JSON.stringify(selector)})`
    case 'label':     return `page.getByLabel(${JSON.stringify(selector)})`
  }
}

// ── Variable replacement ────────────────────────────────────────────────────

function replaceVars(
  value: string,
  vars: GlobalVariable[],
  utilParams?: Record<string, string>
): string {
  return value.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    if (utilParams && key in utilParams) return `\${${key}}`
    const v = vars.find((v) => v.key === key)
    if (!v) return `\${${key}}`
    if (v.sensitive) return `\${process.env.${key.toUpperCase()}}`
    return `\${${key.toUpperCase()}}`
  })
}

// ── Single step → code ──────────────────────────────────────────────────────

function stepToCode(
  step: TestStep,
  vars: GlobalVariable[],
  utils: ReusableUtil[],
  indent = '  ',
  utilParams?: Record<string, string>
): string {
  if (step.utilRef) {
    const util = utils.find((u) => u.id === step.utilRef)
    if (!util) return `${indent}// util not found: ${step.utilRef}`
    const args = util.parameters.map((p) => JSON.stringify(p.defaultValue ?? '')).join(', ')
    return `${indent}await ${util.name}(page${args ? ', ' + args : ''})`
  }

  const loc = buildLocator(step.selector, step.selectorStrategy)
  const val = replaceVars(step.value, vars, utilParams)
  const hasVarRef = val.includes('${')
  const valueStr = hasVarRef ? `\`${val}\`` : JSON.stringify(step.value)

  let actionCode = ''
  switch (step.action) {
    case 'click':      actionCode = `await ${loc}.click()`; break
    case 'fill':       actionCode = `await ${loc}.fill(${valueStr})`; break
    case 'check':      actionCode = `await ${loc}.check()`; break
    case 'uncheck':    actionCode = `await ${loc}.uncheck()`; break
    case 'select':     actionCode = `await ${loc}.selectOption(${valueStr})`; break
    case 'hover':      actionCode = `await ${loc}.hover()`; break
    case 'dblclick':   actionCode = `await ${loc}.dblclick()`; break
    case 'wait':       actionCode = `await page.waitForTimeout(${step.value || 1000})`; break
    case 'navigate':   actionCode = `await page.goto(${valueStr})`; break
    case 'screenshot': actionCode = `await page.screenshot({ path: ${valueStr} })`; break
    case 'press':      actionCode = `await ${loc}.press(${valueStr})`; break
    case 'scrollTo':   actionCode = `await ${loc}.scrollIntoViewIfNeeded()`; break
  }

  // wait behavior
  if (step.waitBehavior !== 'auto' && step.action === 'navigate') {
    const wbMap = { networkidle: 'networkidle', domcontentloaded: 'domcontentloaded', custom: 'load' }
    const wb = wbMap[step.waitBehavior as keyof typeof wbMap] ?? 'load'
    actionCode = actionCode.replace(')', `, { waitUntil: '${wb}' })`)
  }
  if (step.waitBehavior === 'custom' && step.action !== 'navigate') {
    actionCode += `\n${indent}await page.waitForTimeout(${step.waitMs ?? 1000})`
  }

  // assertion
  let assertCode = ''
  if (step.assertion !== 'none') {
    const assertVal = replaceVars(step.assertionValue, vars, utilParams)
    const hasAssertVarRef = assertVal.includes('${')
    const assertStr = hasAssertVarRef ? `\`${assertVal}\`` : JSON.stringify(step.assertionValue)

    switch (step.assertion) {
      case 'toBeVisible':  assertCode = `await expect(${loc}).toBeVisible()`; break
      case 'toBeHidden':   assertCode = `await expect(${loc}).toBeHidden()`; break
      case 'toHaveText':   assertCode = `await expect(${loc}).toHaveText(${assertStr})`; break
      case 'toHaveValue':  assertCode = `await expect(${loc}).toHaveValue(${assertStr})`; break
      case 'toContainText':assertCode = `await expect(${loc}).toContainText(${assertStr})`; break
      case 'toBeChecked':  assertCode = `await expect(${loc}).toBeChecked()`; break
      case 'toBeDisabled': assertCode = `await expect(${loc}).toBeDisabled()`; break
      case 'toBeEnabled':  assertCode = `await expect(${loc}).toBeEnabled()`; break
      case 'toHaveURL':    assertCode = `await expect(page).toHaveURL(${assertStr})`; break
      case 'toHaveTitle':  assertCode = `await expect(page).toHaveTitle(${assertStr})`; break
    }
  }

  const lines = [indent + actionCode]
  if (assertCode) lines.push(indent + assertCode)
  return lines.join('\n')
}

function stepsToCode(
  steps: TestStep[],
  vars: GlobalVariable[],
  utils: ReusableUtil[],
  indent = '  '
): string {
  return [...steps]
    .sort((a, b) => a.order - b.order)
    .map((s) => stepToCode(s, vars, utils, indent))
    .join('\n')
}

// ── Page URL goto line ──────────────────────────────────────────────────────

function buildPageUrlGoto(pageUrl: string | undefined, vars: GlobalVariable[], indent: string): string {
  if (!pageUrl?.trim()) return ''
  const replaced = replaceVars(pageUrl, vars)
  const hasVarRef = replaced.includes('${')
  const urlStr = hasVarRef ? `\`${replaced}\`` : JSON.stringify(pageUrl)
  return `${indent}await page.goto(${urlStr})\n`
}

// ── Variables check ─────────────────────────────────────────────────────────

function hasAssertions(steps: TestStep[]): boolean {
  return steps.some((s) => s.assertion !== 'none')
}

function collectImports(
  testCases: TestCase[],
  features: Feature[]
): { needsExpect: boolean } {
  const allSteps = [
    ...testCases.flatMap((tc) => tc.steps),
    ...features.flatMap((f) => [...f.beforeEachSteps, ...f.afterEachSteps]),
  ]
  return { needsExpect: hasAssertions(allSteps) }
}

// ── playwright.config ───────────────────────────────────────────────────────

export function generateConfig(project: Project): string {
  const auth = project.auth
  const reporterStr =
    project.reporter === 'html'
      ? `[['html', { open: 'never' }]]`
      : `[['${project.reporter}']]`

  const globalSetupLine = auth?.enabled
    ? `  globalSetup: require.resolve('./global-setup'),\n`
    : ''

  const storageStateLine = auth?.enabled && auth.roles.length === 1
    ? `    storageState: ${JSON.stringify(auth.roles[0].storageStatePath)},\n`
    : ''

  let projectsArr: string
  if (auth?.enabled && auth.roles.length > 1) {
    const entries = auth.roles
      .map((r) => `    { name: ${JSON.stringify(r.name)}, use: { storageState: ${JSON.stringify(r.storageStatePath)} } }`)
      .join(',\n')
    projectsArr = `[\n${entries}\n  ]`
  } else {
    projectsArr =
      project.browser === 'all'
        ? `['chromium', 'firefox', 'webkit'].map(name => ({ name, use: { ...devices['Desktop ' + name.charAt(0).toUpperCase() + name.slice(1)] } }))`
        : `[{ name: '${project.browser}', use: { ...devices['Desktop ${project.browser.charAt(0).toUpperCase() + project.browser.slice(1)}'] } }]`
  }

  return `import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
${globalSetupLine}  retries: ${project.retries},
  timeout: ${project.defaultTimeout},
  reporter: ${reporterStr},
  use: {
    baseURL: ${JSON.stringify(project.baseUrl)},
${storageStateLine}    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: ${projectsArr},
})
`
}

// ── Global setup (auth storage state) ──────────────────────────────────────

export function generateGlobalSetup(project: Project): string {
  const roles = (project.auth?.roles ?? []).filter((r) => r.loginSteps.length > 0)

  const importLine =
    project.language === 'typescript'
      ? `import { chromium } from '@playwright/test'`
      : `const { chromium } = require('@playwright/test')`

  const fnDecl =
    project.language === 'typescript'
      ? `async function globalSetup(): Promise<void>`
      : `async function globalSetup()`

  const exportLine =
    project.language === 'typescript'
      ? `\nexport default globalSetup`
      : `\nmodule.exports = globalSetup`

  const roleBlocks = roles.map((r) => {
    const varName = `browser_${r.id.replace(/-/g, '_')}`
    const pageVar = `page_${r.id.replace(/-/g, '_')}`
    const stepsCode = stepsToCode(r.loginSteps, [], [], '  ')
    return `  // Role: ${r.name}
  const ${varName} = await chromium.launch()
  const ${pageVar} = await ${varName}.newPage()
${stepsCode}
  await ${pageVar}.context().storageState({ path: ${JSON.stringify(r.storageStatePath)} })
  await ${varName}.close()`
  }).join('\n\n')

  return `${importLine}

${fnDecl} {
${roleBlocks || '  // No login steps defined — add steps to each role in Project Settings'}
}
${exportLine}
`
}

// ── constants file ──────────────────────────────────────────────────────────

export function generateConstants(
  vars: GlobalVariable[],
  language: 'typescript' | 'javascript'
): string {
  const nonSensitive = vars.filter((v) => !v.sensitive)
  if (nonSensitive.length === 0) return '// No non-sensitive variables defined\n'

  const lines = nonSensitive.map((v) => {
    const key = v.key.toUpperCase()
    return language === 'typescript'
      ? `export const ${key} = ${JSON.stringify(v.value)}`
      : `exports.${key} = ${JSON.stringify(v.value)}`
  })
  return lines.join('\n') + '\n'
}

// ── .env.test ───────────────────────────────────────────────────────────────

export function generateEnvFile(vars: GlobalVariable[]): string {
  const sensitive = vars.filter((v) => v.sensitive)
  if (sensitive.length === 0) return '# No sensitive variables defined\n'
  return sensitive.map((v) => `${v.key.toUpperCase()}=${v.value}`).join('\n') + '\n'
}

// ── util helper file ────────────────────────────────────────────────────────

export function generateUtilHelper(
  util: ReusableUtil,
  vars: GlobalVariable[],
  language: 'typescript' | 'javascript'
): string {
  const params = util.parameters.map((p) => p.name).join(', ')
  const allParams = params ? `page, ${params}` : 'page'
  const typeAnnotations = language === 'typescript' ? ': Page' : ''
  const importLine =
    language === 'typescript'
      ? `import type { Page } from '@playwright/test'\n\n`
      : ''

  const paramObj: Record<string, string> = {}
  util.parameters.forEach((p) => { paramObj[p.name] = p.name })

  const body = stepsToCode(util.steps, vars, [], '  ')

  const fnDecl =
    language === 'typescript'
      ? `export async function ${util.name}(page${typeAnnotations}${params ? ', ' + util.parameters.map((p) => `${p.name}: string`).join(', ') : ''}) {`
      : `async function ${util.name}(${allParams}) {`

  const exportLine =
    language === 'javascript' ? `\nmodule.exports = { ${util.name} }\n` : ''

  return `${importLine}${fnDecl}
${body || '  // no steps'}
}
${exportLine}`
}

// ── fixture file ────────────────────────────────────────────────────────────

export function generateFixtureFile(fixture: Fixture): string {
  return JSON.stringify(fixture.data, null, 2) + '\n'
}

// ── Page Object Model ───────────────────────────────────────────────────────

export function generatePOM(
  feature: Feature,
  testCases: TestCase[],
  language: 'typescript' | 'javascript'
): string {
  const allSteps = testCases.flatMap((tc) => tc.steps).filter((s) => s.selector)
  const uniqueSelectors = [...new Map(allSteps.map((s) => [s.selector, s])).values()]

  const className = feature.name.replace(/\s+(\w)/g, (_, c: string) => c.toUpperCase()).replace(/\s/g, '') + 'Page'

  const getters = uniqueSelectors.map((s) => {
    const name = s.selector.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '').replace(/_+(\w)/g, (_: string, c: string) => c.toUpperCase())
    return `  get ${name}() { return ${buildLocator(s.selector, s.selectorStrategy)} }`
  })

  const importLine =
    language === 'typescript'
      ? `import type { Page } from '@playwright/test'\n\n`
      : ''

  const classDecl =
    language === 'typescript'
      ? `export class ${className} {\n  constructor(private page: Page) {}`
      : `class ${className} {\n  constructor(page) { this.page = page }`

  const exportLine =
    language === 'javascript' ? `\nmodule.exports = { ${className} }\n` : ''

  return `${importLine}${classDecl}

${getters.join('\n')}
}
${exportLine}`
}

// ── Spec file ───────────────────────────────────────────────────────────────

function buildTCBlock(
  tc: TestCase,
  vars: GlobalVariable[],
  utils: ReusableUtil[],
  fixtures: Fixture[],
  indent = '  '
): string {
  const titleParts = [tc.name, ...tc.tags].join(' ')
  const fixture = tc.linkedFixture ? fixtures.find((fx) => fx.id === tc.linkedFixture) : null
  const annotations = tc.annotations.map((a) => `${indent}test.${a}()`).join('\n')
  const viewportStr = tc.viewport
    ? `${indent}  await page.setViewportSize({ width: ${tc.viewport.width}, height: ${tc.viewport.height} })\n`
    : ''
  const gotoStr = buildPageUrlGoto(tc.pageUrl, vars, `${indent}  `)
  const body = stepsToCode(tc.steps, vars, utils, `${indent}  `)

  if (fixture && fixture.data.length > 0) {
    const rows = JSON.stringify(fixture.data)
    return `${annotations ? annotations + '\n' : ''}${indent}for (const row of ${rows}) {
${indent}  test(\`${titleParts} - \${JSON.stringify(row)}\`, async ({ page }) => {
${viewportStr}${gotoStr}${body}
${indent}  })
${indent}}`
  }

  return `${annotations ? annotations + '\n' : ''}${indent}test(${JSON.stringify(titleParts)}, async ({ page }) => {
${viewportStr}${gotoStr}${body}
${indent}})`
}

export function generateSpecFile(
  feature: Feature,
  testCases: TestCase[],
  vars: GlobalVariable[],
  utils: ReusableUtil[],
  fixtures: Fixture[],
  project: Project
): string {
  const { needsExpect } = collectImports(testCases, [feature])
  const auth = project.auth

  const nonSensitiveVars = vars.filter((v) => !v.sensitive && v.scope === 'project')
  const utilImports = utils
    .filter((u) => testCases.some((tc) => tc.steps.some((s) => s.utilRef === u.id)))
    .map((u) => {
      const importPath = `../../utils/${u.name}.helper`
      return project.language === 'typescript'
        ? `import { ${u.name} } from '${importPath}'`
        : `const { ${u.name} } = require('${importPath}')`
    })

  const constImports =
    nonSensitiveVars.length > 0
      ? project.language === 'typescript'
        ? `import { ${nonSensitiveVars.map((v) => v.key.toUpperCase()).join(', ')} } from '../../utils/constants'`
        : `const { ${nonSensitiveVars.map((v) => v.key.toUpperCase()).join(', ')} } = require('../../utils/constants')`
      : ''

  const mainImport =
    project.language === 'typescript'
      ? `import { test${needsExpect ? ', expect' : ''} } from '@playwright/test'`
      : `const { test${needsExpect ? ', expect' : ''} } = require('@playwright/test')`

  const imports = [mainImport, constImports, ...utilImports].filter(Boolean).join('\n')

  const beforeEachCode = feature.beforeEachSteps.length
    ? `\n  test.beforeEach(async ({ page }) => {\n${stepsToCode(feature.beforeEachSteps, vars, utils, '    ')}\n  })\n`
    : ''

  const afterEachCode = feature.afterEachSteps.length
    ? `\n  test.afterEach(async ({ page }) => {\n${stepsToCode(feature.afterEachSteps, vars, utils, '    ')}\n  })\n`
    : ''

  if (auth?.enabled && auth.roles.length > 1) {
    // Group TCs by authRoleId, fallback to first role
    const groups = new Map<string, TestCase[]>()
    for (const tc of testCases) {
      const roleId = tc.authRoleId ?? auth.roles[0].id
      if (!groups.has(roleId)) groups.set(roleId, [])
      groups.get(roleId)!.push(tc)
    }

    const roleBlocks = [...groups.entries()].map(([roleId, roleTCs]) => {
      const role = auth.roles.find((r) => r.id === roleId) ?? auth.roles[0]
      const tcCode = roleTCs.map((tc) => buildTCBlock(tc, vars, utils, fixtures, '    ')).join('\n\n')
      return `  test.describe(${JSON.stringify(role.name)}, () => {
    test.use({ storageState: ${JSON.stringify(role.storageStatePath)} })

${tcCode}
  })`
    }).join('\n\n')

    return `${imports}

test.describe(${JSON.stringify(feature.name)}, () => {
${beforeEachCode}${afterEachCode}
${roleBlocks}
})
`
  }

  const authComment = auth?.enabled && auth.roles.length === 1
    ? `// Auth role: ${auth.roles[0].name} (${auth.roles[0].storageStatePath})\n`
    : ''

  const tcBlocks = testCases
    .map((tc) => buildTCBlock(tc, vars, utils, fixtures))
    .join('\n\n')

  return `${imports}

${authComment}test.describe(${JSON.stringify(feature.name)}, () => {
${beforeEachCode}${afterEachCode}
${tcBlocks}
})
`
}

// ── Single TC preview (for live code preview panel) ─────────────────────────

export function generateTCPreview(
  tc: TestCase,
  feature: Feature,
  project: Project,
  utils: ReusableUtil[],
  vars: GlobalVariable[]
): string {
  const needsExp = hasAssertions(tc.steps)
  const imp =
    project.language === 'typescript'
      ? `import { test${needsExp ? ', expect' : ''} } from '@playwright/test'`
      : `const { test${needsExp ? ', expect' : ''} } = require('@playwright/test')`

  const annotations = tc.annotations.map((a) => `test.${a}()\n`).join('')

  const auth = project.auth
  const multiRole = auth?.enabled && auth.roles.length > 1
  const activeRole = multiRole
    ? (auth!.roles.find((r) => r.id === tc.authRoleId) ?? auth!.roles[0])
    : auth?.enabled && auth.roles.length === 1
    ? auth.roles[0]
    : null

  if (multiRole && activeRole) {
    const viewportStr = tc.viewport
      ? `      await page.setViewportSize({ width: ${tc.viewport.width}, height: ${tc.viewport.height} })\n`
      : ''
    const gotoStr = buildPageUrlGoto(tc.pageUrl, vars, '      ')
    const body = stepsToCode(tc.steps, vars, utils, '      ')

    return `${imp}

${annotations}test.describe(${JSON.stringify(feature.name)}, () => {
  test.describe(${JSON.stringify(activeRole.name)}, () => {
    test.use({ storageState: ${JSON.stringify(activeRole.storageStatePath)} })

    test(${JSON.stringify(tc.name)}, async ({ page }) => {
${viewportStr}${gotoStr}${body}
    })
  })
})
`
  }

  const viewportStr = tc.viewport
    ? `    await page.setViewportSize({ width: ${tc.viewport.width}, height: ${tc.viewport.height} })\n`
    : ''
  const gotoStr = buildPageUrlGoto(tc.pageUrl, vars, '    ')
  const body = stepsToCode(tc.steps, vars, utils, '    ')

  const authComment = activeRole
    ? `// Auth role: ${activeRole.name} (${activeRole.storageStatePath})\n`
    : ''

  return `${imp}

${annotations}${authComment}test.describe(${JSON.stringify(feature.name)}, () => {
  test(${JSON.stringify(tc.name)}, async ({ page }) => {
${viewportStr}${gotoStr}${body}
  })
})
`
}
