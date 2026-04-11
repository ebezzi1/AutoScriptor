import type {
  Project, Feature, TestCase, GlobalVariable,
  ReusableUtil, Fixture, TestStep,
} from '../types'
import { ASSERTION_LABELS } from '../types'
import type { ApiStep } from '../types/api'

// ── Step → plain English ──────────────────────────────────────────────────────

function describeUIStep(step: TestStep, n: number): string {
  const sel = step.selector ? `\`${step.selector}\`` : '`—`'
  let text: string

  switch (step.action) {
    case 'click':              text = `**Click** ${sel}`; break
    case 'dblclick':           text = `**Double-click** ${sel}`; break
    case 'fill':               text = `**Fill** ${sel} with \`"${step.value}"\``; break
    case 'check':              text = `**Check** ${sel}`; break
    case 'uncheck':            text = `**Uncheck** ${sel}`; break
    case 'select':             text = `**Select** \`"${step.value}"\` in ${sel}`; break
    case 'hover':              text = `**Hover over** ${sel}`; break
    case 'wait':               text = `**Wait** \`${step.waitMs ?? step.value}ms\``; break
    case 'navigate':           text = `**Navigate** to \`${step.value || '(url)'}\``; break
    case 'screenshot':         text = `**Take screenshot**`; break
    case 'press':              text = `**Press key** \`${step.value}\` on ${sel}`; break
    case 'scrollTo':           text = `**Scroll to** ${sel}`; break
    case 'screenshot.full':    text = `**Full-page screenshot** → \`${step.value || 'screenshot.png'}\``; break
    case 'screenshot.element': text = `**Element screenshot** → \`${step.value || 'screenshot.png'}\` of ${sel}`; break
    case 'screenshot.clip':    text = `**Clip screenshot** → \`${step.value || 'screenshot.png'}\``; break
    default:                   text = `**${step.action}** ${sel}`
  }

  if (step.assertion && step.assertion !== 'none') {
    const label = ASSERTION_LABELS[step.assertion] ?? step.assertion
    text += ` → Assert **${label}**`
    if (step.assertionValue) text += ` = \`"${step.assertionValue}"\``
  }

  return `${n}. ${text}`
}

function describeAPIStep(step: ApiStep, n: number): string {
  const lines: string[] = []
  lines.push(`${n}. **${step.method}** \`${step.url || '(url)'}\`${step.name ? ` — *${step.name}*` : ''}`)
  if (step.statusAssertion !== null) {
    lines.push(`   - Expected status: \`${step.statusAssertion}\``)
  }
  for (const a of step.responseAssertions) {
    if (a.jsonPath) {
      lines.push(`   - Assert \`${a.jsonPath}\` ${a.operator} \`${a.expected}\``)
    }
  }
  if (step.captureVars.length > 0) {
    for (const c of step.captureVars) {
      if (c.name) lines.push(`   - Capture \`${c.jsonPath}\` → \`${c.name}\``)
    }
  }
  return lines.join('\n')
}

function describeSteps(steps: TestStep[]): string {
  if (steps.length === 0) return '*No steps defined.*'
  return steps.map((s, i) => describeUIStep(s, i + 1)).join('\n')
}

function escapeTable(v: string): string {
  return v.replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

// ── Assertions count ──────────────────────────────────────────────────────────

function uiAssertCount(tc: TestCase): number {
  return tc.steps.filter((s) => s.assertion && s.assertion !== 'none').length
}

function apiAssertCount(tc: TestCase): number {
  return (tc.apiSteps ?? []).reduce(
    (n, s) => n + (s.statusAssertion !== null ? 1 : 0) + s.responseAssertions.length,
    0
  )
}

// ── Main generator ────────────────────────────────────────────────────────────

export function generateTestPlan(
  project: Project,
  features: Feature[],
  testCases: TestCase[],
  variables: GlobalVariable[],
  utils: ReusableUtil[],
  fixtures: Fixture[],
): string {
  const now = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const projectVars = variables.filter((v) => v.projectId === project.id && !v.environmentId)
  const projectUtils = utils.filter((u) => u.projectId === project.id)
  const projectFixtures = fixtures.filter((fx) => fx.projectId === project.id)

  // Priority sort order
  const PRIO_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }
  const sortedTCs = [...testCases].sort((a, b) => {
    const fa = features.findIndex((f) => f.id === a.featureId)
    const fb = features.findIndex((f) => f.id === b.featureId)
    if (fa !== fb) return fa - fb
    const pa = PRIO_ORDER[a.priority] ?? 99
    const pb = PRIO_ORDER[b.priority] ?? 99
    if (pa !== pb) return pa - pb
    return a.name.localeCompare(b.name)
  })

  // Coverage stats
  const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  let uiCount = 0, apiCount = 0
  for (const tc of sortedTCs) {
    byPriority[tc.priority] = (byPriority[tc.priority] ?? 0) + 1
    if ((tc.type ?? 'ui') === 'api') apiCount++; else uiCount++
  }

  const zeroP0Features = features
    .filter((f) => !sortedTCs.some((tc) => tc.featureId === f.id && tc.priority === 'P0'))
    .map((f) => f.name)

  const envs = (project.environments ?? [])

  const lines: string[] = []

  // ── Title ──────────────────────────────────────────────────────────────────
  lines.push(`# ${project.name} — Test Plan`, '')

  // ── Overview ──────────────────────────────────────────────────────────────
  lines.push('## Overview', '')
  lines.push(`| Field | Value |`)
  lines.push(`|-------|-------|`)
  lines.push(`| Project | ${escapeTable(project.name)} |`)
  lines.push(`| Language | ${project.language === 'typescript' ? 'TypeScript' : 'JavaScript'} |`)
  lines.push(`| Base URL | \`${escapeTable(project.baseUrl || '—')}\` |`)
  lines.push(`| Browser | ${project.browser} |`)
  lines.push(`| Environments | ${envs.length > 0 ? envs.map((e) => e.name).join(', ') : '—'} |`)
  lines.push(`| Generated | ${now} |`)
  lines.push(`| Total Features | ${features.length} |`)
  lines.push(`| Total Test Cases | ${sortedTCs.length} |`)
  lines.push('')

  // ── Test Summary ──────────────────────────────────────────────────────────
  lines.push('## Test Summary', '')

  if (sortedTCs.length === 0) {
    lines.push('*No test cases defined yet.*', '')
  } else {
    lines.push('| Feature | Test Case | Type | Priority | Tags | Auth Role | Steps | Assertions |')
    lines.push('|---------|-----------|------|----------|------|-----------|-------|------------|')
    for (const tc of sortedTCs) {
      const feature = features.find((f) => f.id === tc.featureId)
      const isUI = (tc.type ?? 'ui') === 'ui'
      const stepCount = isUI ? tc.steps.length : (tc.apiSteps ?? []).length
      const assertCount = isUI ? uiAssertCount(tc) : apiAssertCount(tc)
      const authRole = tc.authRoleId
        ? (project.auth?.roles.find((r) => r.id === tc.authRoleId)?.name ?? '—')
        : '—'
      lines.push(
        `| ${escapeTable(feature?.name ?? '—')} | ${escapeTable(tc.name)} | ${tc.type?.toUpperCase() ?? 'UI'} | ${tc.priority} | ${escapeTable(tc.tags.join(', ') || '—')} | ${escapeTable(authRole)} | ${stepCount} | ${assertCount} |`
      )
    }
    lines.push('')
  }

  // ── Coverage Summary ──────────────────────────────────────────────────────
  lines.push('## Coverage Summary', '')
  lines.push(`**By Priority:** P0: ${byPriority.P0} · P1: ${byPriority.P1} · P2: ${byPriority.P2} · P3: ${byPriority.P3}`, '')
  lines.push(`**By Type:** UI: ${uiCount} · API: ${apiCount}`, '')

  if (zeroP0Features.length > 0) {
    lines.push(`**Features with no P0 coverage:**`, '')
    for (const name of zeroP0Features) lines.push(`- ⚠️ ${name}`)
    lines.push('')
  } else {
    lines.push('✅ All features have at least one P0 test case.', '')
  }

  // ── Feature Details ───────────────────────────────────────────────────────
  lines.push('## Feature Details', '')

  for (const feature of features) {
    lines.push(`### ${feature.name}`, '')
    if (feature.description) lines.push(`${feature.description}`, '')
    if (feature.tags.length > 0) {
      lines.push(`**Tags:** ${feature.tags.join(', ')}`, '')
    }
    if (feature.beforeEachSteps.length > 0) {
      lines.push(`**Setup (beforeEach):**`, '')
      lines.push(describeSteps(feature.beforeEachSteps), '')
    }
    if (feature.afterEachSteps.length > 0) {
      lines.push(`**Teardown (afterEach):**`, '')
      lines.push(describeSteps(feature.afterEachSteps), '')
    }

    const featureTCs = sortedTCs.filter((tc) => tc.featureId === feature.id)
    if (featureTCs.length === 0) {
      lines.push('*No test cases yet.*', '')
    } else {
      for (const tc of featureTCs) {
        const isUI = (tc.type ?? 'ui') === 'ui'
        const authRole = tc.authRoleId
          ? (project.auth?.roles.find((r) => r.id === tc.authRoleId)?.name ?? null)
          : null
        const fixture = tc.linkedFixture
          ? (projectFixtures.find((fx) => fx.id === tc.linkedFixture)?.name ?? null)
          : null

        lines.push(`#### ${tc.name} \`[${tc.priority}]\` \`[${tc.type?.toUpperCase() ?? 'UI'}]\``, '')

        if (tc.description) lines.push(`${tc.description}`, '')
        if (tc.annotations.length > 0) lines.push(`**Annotations:** ${tc.annotations.join(', ')}`, '')
        if (authRole) lines.push(`**Auth Role:** ${authRole}`, '')
        if (tc.pageUrl) lines.push(`**Page URL:** \`${tc.pageUrl}\``, '')
        if (fixture) lines.push(`**Linked Fixture:** ${fixture}`, '')
        if (tc.viewport) lines.push(`**Viewport:** ${tc.viewport.width}×${tc.viewport.height}`, '')
        if (tc.tags.length > 0) lines.push(`**Tags:** ${tc.tags.join(', ')}`, '')

        if (isUI) {
          lines.push('**Steps:**', '')
          lines.push(describeSteps(tc.steps), '')
        } else {
          const apiSteps = tc.apiSteps ?? []
          if (apiSteps.length === 0) {
            lines.push('*No API requests defined.*', '')
          } else {
            lines.push('**Requests:**', '')
            lines.push(apiSteps.map((s, i) => describeAPIStep(s, i + 1)).join('\n'), '')
          }
        }
      }
    }

    lines.push('---', '')
  }

  // ── Reusable Utils ────────────────────────────────────────────────────────
  if (projectUtils.length > 0) {
    lines.push('## Reusable Utilities', '')
    for (const util of projectUtils) {
      lines.push(`### ${util.name}`, '')
      if (util.description) lines.push(`${util.description}`, '')
      if (util.parameters.length > 0) {
        lines.push(`**Parameters:** ${util.parameters.map((p) => `\`${p.name}\`` + (p.defaultValue ? ` (default: \`${p.defaultValue}\`)` : '')).join(', ')}`, '')
      }
      lines.push('**Steps:**', '')
      lines.push(describeSteps(util.steps), '')
    }
  }

  // ── Environment Configurations ────────────────────────────────────────────
  if (envs.length > 0) {
    lines.push('## Environment Configurations', '')
    for (const env of envs) {
      lines.push(`### ${env.name}`, '')
      lines.push(`**Base URL:** \`${env.baseUrl || '—'}\``, '')
      const overrides = Object.entries(env.variableOverrides ?? {})
      if (overrides.length > 0) {
        lines.push('**Variable overrides:**', '')
        for (const [k, v] of overrides) {
          const isSecret = projectVars.find((pv) => pv.key === k)?.sensitive
          lines.push(`- \`${k}\`: ${isSecret ? '**(hidden)**' : `\`${v}\``}`)
        }
        lines.push('')
      } else {
        lines.push('*No variable overrides.*', '')
      }
    }
  }

  // ── Variables ─────────────────────────────────────────────────────────────
  if (projectVars.length > 0) {
    lines.push('## Project Variables', '')
    lines.push('| Variable | Value | Sensitive |')
    lines.push('|----------|-------|-----------|')
    for (const v of projectVars) {
      lines.push(`| \`${v.key}\` | ${v.sensitive ? '**(hidden)**' : `\`${escapeTable(v.value)}\``} | ${v.sensitive ? 'Yes' : 'No'} |`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
