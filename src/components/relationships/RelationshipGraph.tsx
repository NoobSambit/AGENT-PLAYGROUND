'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { AgentRelationship, RelationshipType } from '@/types/database'

interface Node {
  id: string
  name: string
  connectionCount: number
  x: number
  y: number
  vx: number
  vy: number
}

interface Edge {
  source: string
  target: string
  strength: number
  color: string
  types: RelationshipType[]
}

interface RelationshipGraphProps {
  relationships: AgentRelationship[]
  agents: Array<{ id: string; name: string }>
  currentAgentId?: string
  onRelationshipClick?: (relationship: AgentRelationship) => void
  width?: number
  height?: number
}

const RELATIONSHIP_COLORS = {
  friendship: '#58c78d',
  rivalry: '#ef6464',
  mentorship: '#9b7eeb',
  professional: '#6db6d7',
  acquaintance: '#9aa1b4',
}

export function RelationshipGraph({
  relationships,
  agents,
  currentAgentId,
  onRelationshipClick,
  width = 600,
  height = 400,
}: RelationshipGraphProps) {
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null)
  const [selectedRelationship, setSelectedRelationship] = useState<AgentRelationship | null>(null)

  useEffect(() => {
    const connectionCounts: Record<string, number> = {}

    for (const rel of relationships) {
      connectionCounts[rel.agentId1] = (connectionCounts[rel.agentId1] || 0) + 1
      connectionCounts[rel.agentId2] = (connectionCounts[rel.agentId2] || 0) + 1
    }

    const newNodes: Node[] = agents.map((agent, index) => {
      const angle = (2 * Math.PI * index) / Math.max(agents.length, 1)
      const radius = Math.min(width, height) * 0.35
      return {
        id: agent.id,
        name: agent.name,
        connectionCount: connectionCounts[agent.id] || 0,
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
      }
    })

    const newEdges: Edge[] = relationships.map((rel) => {
      const avgMetric = (rel.metrics.trust + rel.metrics.respect + rel.metrics.affection) / 3
      let color = RELATIONSHIP_COLORS.acquaintance

      if (rel.status === 'broken') {
        color = '#d94e62'
      } else if (rel.relationshipTypes.includes('friendship')) {
        color = RELATIONSHIP_COLORS.friendship
      } else if (rel.relationshipTypes.includes('rivalry')) {
        color = RELATIONSHIP_COLORS.rivalry
      } else if (rel.relationshipTypes.includes('mentorship')) {
        color = RELATIONSHIP_COLORS.mentorship
      } else if (rel.relationshipTypes.includes('professional')) {
        color = RELATIONSHIP_COLORS.professional
      }

      return {
        source: rel.agentId1,
        target: rel.agentId2,
        strength: avgMetric,
        color,
        types: rel.relationshipTypes,
      }
    })

    setNodes(newNodes)
    setEdges(newEdges)
  }, [relationships, agents, width, height])

  useEffect(() => {
    if (nodes.length < 2) return

    const interval = setInterval(() => {
      setNodes((prevNodes) => {
        const nextNodes = prevNodes.map((node) => ({ ...node }))

        for (let i = 0; i < nextNodes.length; i++) {
          const node = nextNodes[i]

          const dx = width / 2 - node.x
          const dy = height / 2 - node.y
          node.vx += dx * 0.001
          node.vy += dy * 0.001

          for (let j = 0; j < nextNodes.length; j++) {
            if (i === j) continue
            const other = nextNodes[j]
            const diffX = node.x - other.x
            const diffY = node.y - other.y
            const dist = Math.sqrt(diffX * diffX + diffY * diffY) || 1
            const force = 1000 / (dist * dist)
            node.vx += (diffX / dist) * force
            node.vy += (diffY / dist) * force
          }

          for (const edge of edges) {
            let other: Node | undefined
            if (edge.source === node.id) {
              other = nextNodes.find((n) => n.id === edge.target)
            } else if (edge.target === node.id) {
              other = nextNodes.find((n) => n.id === edge.source)
            }

            if (other) {
              const diffX = other.x - node.x
              const diffY = other.y - node.y
              const dist = Math.sqrt(diffX * diffX + diffY * diffY) || 1
              const idealDist = 150
              const force = (dist - idealDist) * 0.01 * edge.strength
              node.vx += (diffX / dist) * force
              node.vy += (diffY / dist) * force
            }
          }

          node.x += node.vx * 0.1
          node.y += node.vy * 0.1
          node.vx *= 0.9
          node.vy *= 0.9

          node.x = Math.max(30, Math.min(width - 30, node.x))
          node.y = Math.max(30, Math.min(height - 30, node.y))
        }

        return nextNodes
      })
    }, 50)

    const timeout = setTimeout(() => clearInterval(interval), 3000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [nodes.length, edges, width, height])

  const getNodeById = useCallback((id: string) => nodes.find((node) => node.id === id), [nodes])

  const handleEdgeClick = (edge: Edge) => {
    const relationship = relationships.find(
      (rel) =>
        (rel.agentId1 === edge.source && rel.agentId2 === edge.target) ||
        (rel.agentId1 === edge.target && rel.agentId2 === edge.source)
    )
    if (relationship) {
      setSelectedRelationship(relationship)
      onRelationshipClick?.(relationship)
    }
  }

  if (nodes.length === 0) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">No relationships to display</div>
  }

  return (
    <div className="relative">
      <svg width={width} height={height} className="w-full rounded-sm bg-background/40">
        {edges.map((edge) => {
          const sourceNode = getNodeById(edge.source)
          const targetNode = getNodeById(edge.target)
          if (!sourceNode || !targetNode) return null

          const key = `${edge.source}-${edge.target}`
          const isHovered = hoveredEdge === key

          return (
            <line
              key={key}
              x1={sourceNode.x}
              y1={sourceNode.y}
              x2={targetNode.x}
              y2={targetNode.y}
              stroke={edge.color}
              strokeWidth={isHovered ? 4 : 2 + edge.strength * 3}
              strokeOpacity={isHovered ? 1 : 0.55}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredEdge(key)}
              onMouseLeave={() => setHoveredEdge(null)}
              onClick={() => handleEdgeClick(edge)}
            />
          )
        })}

        {nodes.map((node) => {
          const isHovered = hoveredNode === node.id
          const isCurrent = node.id === currentAgentId
          const radius = 12 + node.connectionCount * 3

          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? radius + 4 : radius}
                fill={isCurrent ? '#f7b267' : '#9b7eeb'}
                stroke={isHovered ? '#ffffff' : 'rgba(255,255,255,0.16)'}
                strokeWidth={2}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              />

              <text
                x={node.x}
                y={node.y + radius + 16}
                textAnchor="middle"
                fill="var(--foreground)"
                fontSize="12"
                fontWeight={isHovered ? '700' : '500'}
              >
                {node.name}
              </text>

              {node.connectionCount > 0 && (
                <g>
                  <circle cx={node.x + radius - 4} cy={node.y - radius + 4} r={8} fill="#f089b6" />
                  <text
                    x={node.x + radius - 4}
                    y={node.y - radius + 8}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="10"
                    fontWeight="700"
                  >
                    {node.connectionCount}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      <div className="absolute bottom-4 left-4 rounded-sm border border-border/70 bg-card/[0.74] p-3 text-xs backdrop-blur-xl">
        <div className="mb-2 font-semibold uppercase tracking-[0.18em] text-muted-foreground">Relationship types</div>
        <div className="space-y-1.5">
          {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded" style={{ backgroundColor: color }} />
              <span className="capitalize text-muted-foreground">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedRelationship && (
        <div className="absolute right-4 top-4 max-w-xs rounded-sm border border-border/70 bg-card/[0.76] p-4 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <h4 className="font-semibold text-foreground">Relationship details</h4>
            <button
              onClick={() => setSelectedRelationship(null)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              type="button"
            >
              Close
            </button>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <span className="text-muted-foreground">Type:</span>
              <span className="ml-2 capitalize text-foreground">{selectedRelationship.relationshipTypes.join(', ')}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <span className="ml-2 capitalize text-foreground">{selectedRelationship.status}</span>
            </div>
            {[
              ['Trust', selectedRelationship.metrics.trust, '#58c78d'],
              ['Respect', selectedRelationship.metrics.respect, '#6db6d7'],
              ['Affection', selectedRelationship.metrics.affection, '#f089b6'],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="text-foreground">{Math.round((value as number) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/45">
                  <div className="h-1.5 rounded-full" style={{ width: `${(value as number) * 100}%`, backgroundColor: color as string }} />
                </div>
              </div>
            ))}
            <div className="pt-2 text-xs text-muted-foreground">
              {selectedRelationship.interactionCount} interactions tracked.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
