import { useState, useMemo } from 'react'
import type { TestCase, Feature } from '../types'
import { computeGraphLayout, getUpstream, getDownstream, NODE_DIMS } from '../lib/depGraph'

// ── Feature color palette ──────────────────────────────────────────────────────

const FEATURE_PALETTE = [
  '#6366f1', // indigo
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#f97316', // orange
  '#14b8a6', // teal
  '#a3e635', // lime
  '#e879f9', // fuchsia
]

function featureColor(featureId: string, featureIds: string[]): string {
  const idx = featureIds.indexOf(featureId)
  return FEATURE_PALETTE[idx % FEATURE_PALETTE.length] ?? '#6366f1'
}

// ── Arrow head marker ─────────────────────────────────────────────────────────

function Defs() {
  return (
    <defs>
      <marker id="dep-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0 0 L8 4 L0 8 Z" fill="currentColor" />
      </marker>
      <marker id="dep-arrow-dim" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0 0 L8 4 L0 8 Z" fill="#28283A" />
      </marker>
      <marker id="dep-arrow-hi" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <path d="M0 0 L8 4 L0 8 Z" fill="#6366f1" />
      </marker>
    </defs>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  features: Feature[]
  testCases: TestCase[]
  projectId: string
  onNavigate: (tc: TestCase) => void
}

export function DependencyGraph({ features, testCases, projectId, onNavigate }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const layout = useMemo(
    () => computeGraphLayout(testCases, features, projectId),
    [testCases, features, projectId]
  )

  const featureIds = useMemo(
    () => [...new Set(features.map((f) => f.id))],
    [features]
  )

  // Compute which nodes are highlighted when hovering
  const { highlightedUp, highlightedDown } = useMemo(() => {
    if (!hoveredId) return { highlightedUp: new Set<string>(), highlightedDown: new Set<string>() }
    return {
      highlightedUp: getUpstream(hoveredId, testCases),
      highlightedDown: getDownstream(hoveredId, testCases),
    }
  }, [hoveredId, testCases])

  const { nodes, edges, svgWidth, svgHeight, independentTCs } = layout

  const anyDeps = nodes.length > 0

  if (!anyDeps && independentTCs.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-vsc-dim text-sm">
        No test cases in this project yet.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Legend */}
      {featureIds.length > 0 && anyDeps && (
        <div className="flex flex-wrap gap-3">
          {features
            .filter((f) => nodes.some((n) => n.feature.id === f.id))
            .map((f) => (
              <div key={f.id} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: featureColor(f.id, featureIds) }}
                />
                <span className="text-xs text-vsc-muted">{f.name}</span>
              </div>
            ))}
        </div>
      )}

      {/* Graph canvas */}
      {anyDeps && (
        <div className="border border-vsc-border rounded-xl overflow-auto bg-vsc-panel/50">
          <svg
            width={svgWidth}
            height={svgHeight}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="block min-w-full"
          >
            <Defs />

            {/* Edges */}
            {edges.map((edge, i) => {
              const { from, to } = edge
              const x1 = from.x + NODE_DIMS.W
              const y1 = from.y + NODE_DIMS.H / 2
              const x2 = to.x
              const y2 = to.y + NODE_DIMS.H / 2
              const mx = (x1 + x2) / 2

              const isHi =
                hoveredId &&
                (edge.from.tc.id === hoveredId ||
                  edge.to.tc.id === hoveredId ||
                  highlightedUp.has(edge.from.tc.id) ||
                  highlightedDown.has(edge.to.tc.id) ||
                  (highlightedUp.has(edge.to.tc.id) && highlightedUp.has(edge.from.tc.id)) ||
                  (highlightedDown.has(edge.from.tc.id) && highlightedDown.has(edge.to.tc.id)))

              const isDim = hoveredId && !isHi

              return (
                <path
                  key={i}
                  d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={isDim ? '#28283A' : isHi ? '#6366f1' : '#38384A'}
                  strokeWidth={isHi ? 1.8 : 1.2}
                  markerEnd={isDim ? 'url(#dep-arrow-dim)' : isHi ? 'url(#dep-arrow-hi)' : 'url(#dep-arrow)'}
                  className="transition-all duration-150"
                />
              )
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const { tc, feature, x, y } = node
              const color = featureColor(feature.id, featureIds)
              const isHovered = hoveredId === tc.id
              const isUp = highlightedUp.has(tc.id)
              const isDown = highlightedDown.has(tc.id)
              const isDim = hoveredId && !isHovered && !isUp && !isDown

              const borderColor = isHovered ? color : isUp || isDown ? `${color}80` : '#28283A'
              const bgOpacity = isHovered ? '18' : isUp || isDown ? '0f' : '08'
              const textOpacity = isDim ? 'opacity-40' : 'opacity-100'

              return (
                <g
                  key={tc.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredId(tc.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onNavigate(tc)}
                >
                  {/* Drop shadow */}
                  {(isHovered || isUp || isDown) && (
                    <rect
                      x={-1} y={-1}
                      width={NODE_DIMS.W + 2} height={NODE_DIMS.H + 2}
                      rx="9"
                      fill="none"
                      stroke={color}
                      strokeOpacity="0.2"
                      strokeWidth="4"
                    />
                  )}

                  {/* Background rect */}
                  <rect
                    width={NODE_DIMS.W} height={NODE_DIMS.H}
                    rx="8"
                    fill={`${color}${bgOpacity}`}
                    stroke={borderColor}
                    strokeWidth={isHovered ? 1.5 : 1}
                    className="transition-all duration-150"
                  />

                  {/* Left accent bar */}
                  <rect
                    x={0} y={8}
                    width={3} height={NODE_DIMS.H - 16}
                    rx="2"
                    fill={color}
                    fillOpacity={isDim ? 0.2 : 1}
                    className="transition-all duration-150"
                  />

                  {/* Feature name */}
                  <text
                    x={14} y={20}
                    className={`text-[9px] font-semibold fill-current transition-opacity duration-150 ${textOpacity}`}
                    fill={color}
                    fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
                    fontSize="9"
                    fontWeight="600"
                  >
                    {feature.name.length > 22 ? feature.name.slice(0, 22) + '…' : feature.name}
                  </text>

                  {/* TC name */}
                  <text
                    x={14} y={37}
                    className={`transition-opacity duration-150 ${textOpacity}`}
                    fill={isDim ? '#4A4A60' : isHovered ? '#EEEEF0' : '#C8C8E0'}
                    fontFamily="Plus Jakarta Sans, system-ui, sans-serif"
                    fontSize="11"
                    fontWeight={isHovered ? '600' : '500'}
                  >
                    {tc.name.length > 20 ? tc.name.slice(0, 20) + '…' : tc.name}
                  </text>

                  {/* Dependency count badge */}
                  {(tc.dependencies?.length ?? 0) > 0 && (
                    <g>
                      <rect
                        x={NODE_DIMS.W - 28} y={8}
                        width={20} height={14}
                        rx="4"
                        fill={`${color}20`}
                        stroke={`${color}40`}
                        strokeWidth={0.8}
                      />
                      <text
                        x={NODE_DIMS.W - 18} y={19}
                        fill={color}
                        fontSize="8"
                        fontWeight="600"
                        textAnchor="middle"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {tc.dependencies!.length}d
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>
      )}

      {!anyDeps && (
        <div className="border border-dashed border-vsc-border/60 rounded-xl p-8 text-center">
          <p className="text-vsc-dim text-sm font-medium">No dependencies defined</p>
          <p className="text-vsc-dim/70 text-xs mt-1">
            Open a test case, expand Configuration, and set its Dependencies.
          </p>
        </div>
      )}

      {/* Independent TCs section */}
      {independentTCs.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold text-vsc-dim uppercase tracking-widest whitespace-nowrap">
              Independent ({independentTCs.length})
            </span>
            <div className="flex-1 h-px bg-vsc-border/60" />
          </div>
          <div className="flex flex-wrap gap-2">
            {independentTCs.map((tc) => {
              const feature = features.find((f) => f.id === tc.featureId)
              const color = featureColor(tc.featureId, featureIds)
              return (
                <button
                  key={tc.id}
                  onClick={() => onNavigate(tc)}
                  className="flex items-center gap-2 bg-vsc-panel border border-vsc-border rounded-lg px-3 py-1.5 text-xs text-vsc-muted hover:text-vsc-text hover:border-vsc-border/80 transition-all group"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-vsc-dim group-hover:text-vsc-muted transition-colors">
                    {feature?.name}
                  </span>
                  <span className="text-vsc-border/80">/</span>
                  <span>{tc.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
