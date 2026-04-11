import * as XLSX from 'xlsx'
import type { Project, Feature, TestCase, Fixture } from '../types'

export interface MatrixRow {
  featureName: string
  testCaseName: string
  type: string
  priority: string
  tags: string
  authRole: string
  stepCount: number
  assertionsCount: number
  linkedFixture: string
  annotations: string
  status: string
  notes: string
}

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 }

export function buildMatrixRows(
  project: Project,
  features: Feature[],
  testCases: TestCase[],
  fixtures: Fixture[],
): MatrixRow[] {
  const rows: MatrixRow[] = []

  for (const tc of testCases) {
    if (tc.disabled) continue
    const feature = features.find((f) => f.id === tc.featureId)
    if (!feature) continue

    const authRole = tc.authRoleId
      ? (project.auth?.roles.find((r) => r.id === tc.authRoleId)?.name ?? '')
      : ''

    const fixture = tc.linkedFixture
      ? (fixtures.find((fx) => fx.id === tc.linkedFixture)?.name ?? '')
      : ''

    const isUI = (tc.type ?? 'ui') === 'ui'
    const stepCount = isUI ? tc.steps.length : (tc.apiSteps ?? []).length
    const assertionsCount = isUI
      ? tc.steps.filter((s) => s.assertion && s.assertion !== 'none').length
      : (tc.apiSteps ?? []).reduce((sum, s) =>
          sum + (s.statusAssertion !== null ? 1 : 0) + s.responseAssertions.length, 0
        )

    rows.push({
      featureName: feature.name,
      testCaseName: tc.name,
      type: isUI ? 'UI' : 'API',
      priority: tc.priority,
      tags: tc.tags.join(', '),
      authRole,
      stepCount,
      assertionsCount,
      linkedFixture: fixture,
      annotations: tc.annotations.join(', '),
      status: '',
      notes: '',
    })
  }

  // Sort: Feature Name → Priority (P0 first) → TC Name
  rows.sort((a, b) => {
    const featCmp = a.featureName.localeCompare(b.featureName)
    if (featCmp !== 0) return featCmp
    const prioA = PRIORITY_ORDER[a.priority] ?? 99
    const prioB = PRIORITY_ORDER[b.priority] ?? 99
    if (prioA !== prioB) return prioA - prioB
    return a.testCaseName.localeCompare(b.testCaseName)
  })

  return rows
}

const HEADERS = [
  'Feature Name',
  'Test Case Name',
  'Type',
  'Priority',
  'Tags',
  'Auth Role',
  'Step Count',
  'Assertions',
  'Linked Fixture',
  'Annotations',
  'Status',
  'Notes',
]

function rowToArray(row: MatrixRow): (string | number)[] {
  return [
    row.featureName,
    row.testCaseName,
    row.type,
    row.priority,
    row.tags,
    row.authRole,
    row.stepCount,
    row.assertionsCount,
    row.linkedFixture,
    row.annotations,
    row.status,
    row.notes,
  ]
}

export function exportCsv(rows: MatrixRow[], projectName: string): void {
  const lines: string[] = []
  const escape = (v: string | number) => {
    const s = String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  lines.push(HEADERS.map(escape).join(','))
  for (const row of rows) {
    lines.push(rowToArray(row).map(escape).join(','))
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  triggerDownload(blob, `${slug(projectName)}-test-matrix.csv`)
}

export function exportXlsx(rows: MatrixRow[], projectName: string): void {
  const wsData: (string | number)[][] = [
    HEADERS,
    ...rows.map(rowToArray),
  ]

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // Column widths
  ws['!cols'] = [
    { wch: 24 }, // Feature Name
    { wch: 36 }, // Test Case Name
    { wch: 8 },  // Type
    { wch: 9 },  // Priority
    { wch: 24 }, // Tags
    { wch: 16 }, // Auth Role
    { wch: 11 }, // Step Count
    { wch: 12 }, // Assertions
    { wch: 18 }, // Linked Fixture
    { wch: 18 }, // Annotations
    { wch: 12 }, // Status
    { wch: 28 }, // Notes
  ]

  // Freeze top row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as XLSX.WorkSheet['!freeze']

  XLSX.utils.book_append_sheet(wb, ws, 'Test Matrix')
  XLSX.writeFile(wb, `${slug(projectName)}-test-matrix.xlsx`)
}

function slug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
