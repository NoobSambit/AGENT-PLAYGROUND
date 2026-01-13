'use client'

/**
 * Relationship Network Graph Component - Phase 2
 *
 * Displays an interactive network graph of agent relationships
 * using SVG for cross-platform compatibility.
 */

import React, { useState, useEffect, useCallback } from 'react'
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
  friendship: '#32CD32',
  rivalry: '#FF4500',
  mentorship: '#9932CC',
  professional: '#4169E1',
  acquaintance: '#808080',
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

  // Initialize nodes and edges
  useEffect(() => {
    const connectionCounts: Record<string, number> = {}

    for (const rel of relationships) {
      connectionCounts[rel.agentId1] = (connectionCounts[rel.agentId1] || 0) + 1
      connectionCounts[rel.agentId2] = (connectionCounts[rel.agentId2] || 0) + 1
    }

    // Create nodes with initial positions
    const newNodes: Node[] = agents.map((agent, i) => {
      const angle = (2 * Math.PI * i) / agents.length
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

    // Create edges
    const newEdges: Edge[] = relationships.map(rel => {
      const avgMetric = (rel.metrics.trust + rel.metrics.respect + rel.metrics.affection) / 3
      let color = RELATIONSHIP_COLORS.acquaintance

      if (rel.status === 'broken') {
        color = '#DC143C'
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

  // Simple force simulation
  useEffect(() => {
    if (nodes.length < 2) return

    const interval = setInterval(() => {
      setNodes(prevNodes => {
        const newNodes = prevNodes.map(node => ({ ...node }))

        // Apply forces
        for (let i = 0; i < newNodes.length; i++) {
          const node = newNodes[i]

          // Center gravity
          const dx = width / 2 - node.x
          const dy = height / 2 - node.y
          node.vx += dx * 0.001
          node.vy += dy * 0.001

          // Repulsion from other nodes
          for (let j = 0; j < newNodes.length; j++) {
            if (i === j) continue
            const other = newNodes[j]
            const diffX = node.x - other.x
            const diffY = node.y - other.y
            const dist = Math.sqrt(diffX * diffX + diffY * diffY) || 1
            const force = 1000 / (dist * dist)
            node.vx += (diffX / dist) * force
            node.vy += (diffY / dist) * force
          }

          // Attraction along edges
          for (const edge of edges) {
            let other: Node | undefined
            if (edge.source === node.id) {
              other = newNodes.find(n => n.id === edge.target)
            } else if (edge.target === node.id) {
              other = newNodes.find(n => n.id === edge.source)
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

          // Apply velocity with damping
          node.x += node.vx * 0.1
          node.y += node.vy * 0.1
          node.vx *= 0.9
          node.vy *= 0.9

          // Keep within bounds
          node.x = Math.max(30, Math.min(width - 30, node.x))
          node.y = Math.max(30, Math.min(height - 30, node.y))
        }

        return newNodes
      })
    }, 50)

    // Stop after stabilization
    const timeout = setTimeout(() => clearInterval(interval), 3000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [nodes.length, edges, width, height])

  const getNodeById = useCallback((id: string) => nodes.find(n => n.id === id), [nodes])

  const getEdgeKey = (edge: Edge) => `${edge.source}-${edge.target}`

  const handleEdgeClick = (edge: Edge) => {
    const rel = relationships.find(
      r => (r.agentId1 === edge.source && r.agentId2 === edge.target) ||
           (r.agentId1 === edge.target && r.agentId2 === edge.source)
    )
    if (rel) {
      setSelectedRelationship(rel)
      onRelationshipClick?.(rel)
    }
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No relationships to display
      </div>
    )
  }

  return (
    <div className="relative">
      <svg width={width} height={height} className="bg-gray-900 rounded-lg">
        {/* Edges */}
        {edges.map(edge => {
          const sourceNode = getNodeById(edge.source)
          const targetNode = getNodeById(edge.target)
          if (!sourceNode || !targetNode) return null

          const key = getEdgeKey(edge)
          const isHovered = hoveredEdge === key

          return (
            <g key={key}>
              <line
                x1={sourceNode.x}
                y1={sourceNode.y}
                x2={targetNode.x}
                y2={targetNode.y}
                stroke={edge.color}
                strokeWidth={isHovered ? 4 : 2 + edge.strength * 3}
                strokeOpacity={isHovered ? 1 : 0.6}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredEdge(key)}
                onMouseLeave={() => setHoveredEdge(null)}
                onClick={() => handleEdgeClick(edge)}
              />
            </g>
          )
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const isHovered = hoveredNode === node.id
          const isCurrent = node.id === currentAgentId
          const radius = 12 + node.connectionCount * 3

          return (
            <g key={node.id}>
              {/* Node circle */}
              <circle
                cx={node.x}
                cy={node.y}
                r={isHovered ? radius + 4 : radius}
                fill={isCurrent ? '#FFD700' : '#4A90E2'}
                stroke={isHovered ? '#fff' : '#2A2A2A'}
                strokeWidth={2}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              />

              {/* Node label */}
              <text
                x={node.x}
                y={node.y + radius + 16}
                textAnchor="middle"
                fill="#fff"
                fontSize="12"
                fontWeight={isHovered ? 'bold' : 'normal'}
              >
                {node.name}
              </text>

              {/* Connection count badge */}
              {node.connectionCount > 0 && (
                <g>
                  <circle
                    cx={node.x + radius - 4}
                    cy={node.y - radius + 4}
                    r={8}
                    fill="#FF6B6B"
                  />
                  <text
                    x={node.x + radius - 4}
                    y={node.y - radius + 8}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    {node.connectionCount}
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-gray-800 rounded-lg p-3 text-xs">
        <div className="text-gray-400 mb-2">Relationship Types</div>
        <div className="space-y-1">
          {Object.entries(RELATIONSHIP_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="text-gray-300 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Relationship details popup */}
      {selectedRelationship && (
        <div className="absolute top-4 right-4 bg-gray-800 rounded-lg p-4 max-w-xs">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-semibold text-white">
              Relationship Details
            </h4>
            <button
              onClick={() => setSelectedRelationship(null)}
              className="text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="text-sm space-y-2">
            <div>
              <span className="text-gray-400">Type:</span>
              <span className="ml-2 text-white capitalize">
                {selectedRelationship.relationshipTypes.join(', ')}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Status:</span>
              <span className="ml-2 text-white capitalize">
                {selectedRelationship.status}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Trust:</span>
                <span className="text-green-400">
                  {(selectedRelationship.metrics.trust * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-green-500 h-1.5 rounded-full"
                  style={{ width: `${selectedRelationship.metrics.trust * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Respect:</span>
                <span className="text-blue-400">
                  {(selectedRelationship.metrics.respect * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full"
                  style={{ width: `${selectedRelationship.metrics.respect * 100}%` }}
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-400">Affection:</span>
                <span className="text-pink-400">
                  {(selectedRelationship.metrics.affection * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-pink-500 h-1.5 rounded-full"
                  style={{ width: `${selectedRelationship.metrics.affection * 100}%` }}
                />
              </div>
            </div>
            <div className="text-gray-400 text-xs mt-2">
              {selectedRelationship.interactionCount} interactions
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
