import type { TestCase, Feature } from '../types'

// ── Cycle detection ───────────────────────────────────────────────────────────

/** Returns true if adding newDepId as a dependency of tcId would create a cycle */
export function wouldCreateCycle(
  tcId: string,
  newDepId: string,
  allTestCases: TestCase[]
): boolean {
  // DFS from newDepId following existing deps — if we reach tcId it's a cycle
  const visited = new Set<string>()
  const stack = [newDepId]
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === tcId) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    const tc = allTestCases.find((t) => t.id === cur)
    for (const dep of tc?.dependencies ?? []) stack.push(dep)
  }
  return false
}

// ── Chain traversal ───────────────────────────────────────────────────────────

/** Returns all TC IDs that tcId transitively depends on (ancestors) */
export function getUpstream(tcId: string, allTestCases: TestCase[]): Set<string> {
  const result = new Set<string>()
  const stack = [tcId]
  while (stack.length) {
    const cur = stack.pop()!
    const tc = allTestCases.find((t) => t.id === cur)
    for (const dep of tc?.dependencies ?? []) {
      if (!result.has(dep)) { result.add(dep); stack.push(dep) }
    }
  }
  return result
}

/** Returns all TC IDs that transitively depend on tcId (descendants) */
export function getDownstream(tcId: string, allTestCases: TestCase[]): Set<string> {
  const result = new Set<string>()
  const stack = [tcId]
  while (stack.length) {
    const cur = stack.pop()!
    for (const tc of allTestCases) {
      if ((tc.dependencies ?? []).includes(cur) && !result.has(tc.id)) {
        result.add(tc.id)
        stack.push(tc.id)
      }
    }
  }
  return result
}

// ── Topological sort ──────────────────────────────────────────────────────────

/** Returns testCases sorted so dependencies always appear before dependents */
export function topoSort(testCases: TestCase[]): TestCase[] {
  const inDegree = new Map<string, number>(testCases.map((tc) => [tc.id, 0]))
  const adj = new Map<string, string[]>(testCases.map((tc) => [tc.id, []]))

  for (const tc of testCases) {
    for (const dep of tc.dependencies ?? []) {
      if (adj.has(dep)) adj.get(dep)!.push(tc.id)
      inDegree.set(tc.id, (inDegree.get(tc.id) ?? 0) + 1)
    }
  }

  const queue = testCases
    .filter((tc) => (inDegree.get(tc.id) ?? 0) === 0)
    .map((tc) => tc.id)
  const sortedIds: string[] = []

  while (queue.length) {
    const id = queue.shift()!
    sortedIds.push(id)
    for (const next of adj.get(id) ?? []) {
      const newDeg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, newDeg)
      if (newDeg === 0) queue.push(next)
    }
  }

  const idMap = new Map(testCases.map((tc) => [tc.id, tc]))
  const sorted = sortedIds.map((id) => idMap.get(id)!).filter(Boolean)
  for (const tc of testCases) if (!sorted.includes(tc)) sorted.push(tc)
  return sorted
}

// ── Serial groups ─────────────────────────────────────────────────────────────

/**
 * Returns connected components within a feature.
 * Components with >1 TC should be wrapped in test.describe.serial().
 */
export function getSameFeatureSerialGroups(
  featureId: string,
  allTestCases: TestCase[]
): TestCase[][] {
  const featureTCs = allTestCases.filter((tc) => tc.featureId === featureId)
  const featureTCIds = new Set(featureTCs.map((tc) => tc.id))

  // Undirected adjacency for component detection (within-feature edges only)
  const adj = new Map<string, Set<string>>(featureTCs.map((tc) => [tc.id, new Set()]))
  for (const tc of featureTCs) {
    for (const dep of tc.dependencies ?? []) {
      if (featureTCIds.has(dep)) {
        adj.get(tc.id)!.add(dep)
        adj.get(dep)!.add(tc.id)
      }
    }
  }

  const visited = new Set<string>()
  const components: TestCase[][] = []

  for (const tc of featureTCs) {
    if (visited.has(tc.id)) continue
    const component: TestCase[] = []
    const stack = [tc.id]
    while (stack.length) {
      const cur = stack.pop()!
      if (visited.has(cur)) continue
      visited.add(cur)
      const curTc = featureTCs.find((t) => t.id === cur)
      if (curTc) component.push(curTc)
      for (const nb of adj.get(cur) ?? []) if (!visited.has(nb)) stack.push(nb)
    }
    components.push(component)
  }

  // Sort each component in topological order
  return components.map((group) => topoSort(group))
}

// ── Layout for SVG graph ──────────────────────────────────────────────────────

export interface GraphNode {
  tc: TestCase
  feature: Feature
  level: number
  indexInLevel: number
  x: number
  y: number
}

export interface GraphEdge {
  from: GraphNode
  to: GraphNode
}

const NODE_W = 188
const NODE_H = 56
const COL_GAP = 240
const ROW_GAP = 18
const PADDING = 40

export interface GraphLayout {
  nodes: GraphNode[]
  edges: GraphEdge[]
  svgWidth: number
  svgHeight: number
  independentTCs: TestCase[]
}

export function computeGraphLayout(
  testCases: TestCase[],
  features: Feature[],
  projectId: string
): GraphLayout {
  const projectTCs = testCases.filter((tc) => tc.projectId === projectId)
  const featureMap = new Map(features.map((f) => [f.id, f]))

  // Separate: TCs that have deps or are depended on vs truly independent
  const tcIds = new Set(projectTCs.map((tc) => tc.id))
  const dependentSet = new Set<string>()
  for (const tc of projectTCs) {
    for (const dep of tc.dependencies ?? []) {
      if (tcIds.has(dep)) {
        dependentSet.add(tc.id)
        dependentSet.add(dep)
      }
    }
  }

  const graphTCs = projectTCs.filter((tc) => dependentSet.has(tc.id))
  const independentTCs = projectTCs.filter((tc) => !dependentSet.has(tc.id))

  if (graphTCs.length === 0) {
    return { nodes: [], edges: [], svgWidth: 0, svgHeight: 0, independentTCs }
  }

  // Compute levels (longest path from root)
  const level = new Map<string, number>(graphTCs.map((tc) => [tc.id, 0]))
  let changed = true
  while (changed) {
    changed = false
    for (const tc of graphTCs) {
      for (const dep of tc.dependencies ?? []) {
        if (!tcIds.has(dep)) continue
        const newLevel = (level.get(dep) ?? 0) + 1
        if (newLevel > (level.get(tc.id) ?? 0)) {
          level.set(tc.id, newLevel)
          changed = true
        }
      }
    }
  }

  // Group by level, sort within level by featureId for stability
  const levelGroups = new Map<number, TestCase[]>()
  for (const tc of graphTCs) {
    const l = level.get(tc.id) ?? 0
    if (!levelGroups.has(l)) levelGroups.set(l, [])
    levelGroups.get(l)!.push(tc)
  }
  for (const [, group] of levelGroups) {
    group.sort((a, b) => a.featureId.localeCompare(b.featureId) || a.name.localeCompare(b.name))
  }

  const maxLevel = Math.max(...levelGroups.keys())
  const maxNodesInLevel = Math.max(...[...levelGroups.values()].map((g) => g.length))

  const svgWidth = (maxLevel + 1) * COL_GAP + NODE_W + 2 * PADDING
  const svgHeight = maxNodesInLevel * (NODE_H + ROW_GAP) + 2 * PADDING

  const nodeMap = new Map<string, GraphNode>()
  const nodes: GraphNode[] = []

  for (const [l, group] of levelGroups) {
    const totalH = group.length * (NODE_H + ROW_GAP) - ROW_GAP
    const startY = (svgHeight - totalH) / 2

    group.forEach((tc, i) => {
      const feature = featureMap.get(tc.featureId) ?? features[0]
      const node: GraphNode = {
        tc,
        feature,
        level: l,
        indexInLevel: i,
        x: PADDING + l * COL_GAP,
        y: startY + i * (NODE_H + ROW_GAP),
      }
      nodes.push(node)
      nodeMap.set(tc.id, node)
    })
  }

  const edges: GraphEdge[] = []
  for (const tc of graphTCs) {
    const to = nodeMap.get(tc.id)
    if (!to) continue
    for (const dep of tc.dependencies ?? []) {
      const from = nodeMap.get(dep)
      if (from) edges.push({ from, to })
    }
  }

  return { nodes, edges, svgWidth, svgHeight, independentTCs }
}

export const NODE_DIMS = { W: NODE_W, H: NODE_H }
