'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { KnowledgeGraphData, KnowledgeGraphNode, ConceptCategory } from '@/types/database'

interface KnowledgeGraphProps {
  agentId: string
  onNodeClick?: (node: KnowledgeGraphNode) => void
}

// Force-directed graph simulation parameters
const SIMULATION_PARAMS = {
  repulsion: 500,
  linkStrength: 0.3,
  centerForce: 0.05,
  damping: 0.9,
  iterations: 50
}

// Category colors
const CATEGORY_COLORS: Record<ConceptCategory | 'memory', string> = {
  entity: '#4A90E2',
  topic: '#7ED321',
  emotion: '#F5A623',
  event: '#BD10E0',
  attribute: '#50E3C2',
  relation: '#F8E71C',
  memory: '#9B9B9B'
}

interface SimulatedNode extends KnowledgeGraphNode {
  x: number
  y: number
  vx: number
  vy: number
}

export function KnowledgeGraph({ agentId, onNodeClick }: KnowledgeGraphProps) {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ConceptCategory | 'all' | 'memory'>('all')
  const [showMemories, setShowMemories] = useState(true)

  // Canvas dimensions
  const width = 800
  const height = 600
  const padding = 50

  // Fetch graph data
  useEffect(() => {
    async function fetchGraph() {
      try {
        setLoading(true)
        const response = await fetch(`/api/agents/${agentId}/memory-graph`)

        if (!response.ok) {
          throw new Error('Failed to fetch knowledge graph')
        }

        const data = await response.json()
        setGraphData(data.graphData || { nodes: [], edges: [] })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        // Set empty data on error
        setGraphData({ nodes: [], edges: [] })
      } finally {
        setLoading(false)
      }
    }

    fetchGraph()
  }, [agentId])

  // Run force-directed simulation
  const simulatedNodes = useMemo(() => {
    if (!graphData || graphData.nodes.length === 0) return []

    // Filter nodes based on selection
    let filteredNodes = graphData.nodes
    if (selectedCategory !== 'all') {
      if (selectedCategory === 'memory') {
        filteredNodes = graphData.nodes.filter(n => n.type === 'memory')
      } else {
        filteredNodes = graphData.nodes.filter(
          n => n.type === 'concept' && n.metadata.category === selectedCategory
        )
      }
      // Also include memories if showMemories is true and not filtering by memory
      if (showMemories && selectedCategory !== 'memory') {
        const memories = graphData.nodes.filter(n => n.type === 'memory')
        filteredNodes = [...filteredNodes, ...memories]
      }
    } else if (!showMemories) {
      filteredNodes = graphData.nodes.filter(n => n.type !== 'memory')
    }

    // Initialize positions randomly
    const nodes: SimulatedNode[] = filteredNodes.map(node => ({
      ...node,
      x: Math.random() * (width - 2 * padding) + padding,
      y: Math.random() * (height - 2 * padding) + padding,
      vx: 0,
      vy: 0
    }))

    // Get relevant edges
    const nodeIds = new Set(nodes.map(n => n.id))
    const edges = graphData.edges.filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target)
    )

    // Run simulation
    for (let iter = 0; iter < SIMULATION_PARAMS.iterations; iter++) {
      // Apply repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
          const force = SIMULATION_PARAMS.repulsion / (dist * dist)

          nodes[i].vx -= (dx / dist) * force
          nodes[i].vy -= (dy / dist) * force
          nodes[j].vx += (dx / dist) * force
          nodes[j].vy += (dy / dist) * force
        }
      }

      // Apply attraction along edges
      for (const edge of edges) {
        const source = nodes.find(n => n.id === edge.source)
        const target = nodes.find(n => n.id === edge.target)
        if (!source || !target) continue

        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const force = dist * SIMULATION_PARAMS.linkStrength * edge.strength

        source.vx += (dx / dist) * force
        source.vy += (dy / dist) * force
        target.vx -= (dx / dist) * force
        target.vy -= (dy / dist) * force
      }

      // Apply center force
      const centerX = width / 2
      const centerY = height / 2
      for (const node of nodes) {
        node.vx += (centerX - node.x) * SIMULATION_PARAMS.centerForce
        node.vy += (centerY - node.y) * SIMULATION_PARAMS.centerForce
      }

      // Update positions
      for (const node of nodes) {
        node.vx *= SIMULATION_PARAMS.damping
        node.vy *= SIMULATION_PARAMS.damping
        node.x += node.vx
        node.y += node.vy

        // Constrain to bounds
        node.x = Math.max(padding, Math.min(width - padding, node.x))
        node.y = Math.max(padding, Math.min(height - padding, node.y))
      }
    }

    return nodes
  }, [graphData, selectedCategory, showMemories, width, height])

  // Get edges for current nodes
  const visibleEdges = useMemo(() => {
    if (!graphData) return []
    const nodeIds = new Set(simulatedNodes.map(n => n.id))
    return graphData.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target))
  }, [graphData, simulatedNodes])

  const handleNodeClick = useCallback((node: SimulatedNode) => {
    if (onNodeClick) {
      onNodeClick(node)
    }
  }, [onNodeClick])

  const getNodeColor = (node: SimulatedNode): string => {
    if (node.type === 'memory') {
      return CATEGORY_COLORS.memory
    }
    return CATEGORY_COLORS[node.metadata.category as ConceptCategory] || '#9B9B9B'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Building knowledge graph...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 rounded-lg">
        <div className="text-center text-red-600">
          <p className="font-semibold">Error loading knowledge graph</p>
          <p className="text-sm mt-2">{error}</p>
        </div>
      </div>
    )
  }

  if (!graphData || simulatedNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
        <div className="text-center text-gray-600">
          <p className="font-semibold">No knowledge graph data</p>
          <p className="text-sm mt-2">Have more conversations to build connections!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Controls */}
      <div className="p-4 border-b flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Filter:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ConceptCategory | 'all' | 'memory')}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="all">All Concepts</option>
            <option value="entity">Entities</option>
            <option value="topic">Topics</option>
            <option value="emotion">Emotions</option>
            <option value="event">Events</option>
            <option value="attribute">Attributes</option>
            <option value="relation">Relations</option>
            <option value="memory">Memories Only</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showMemories}
            onChange={(e) => setShowMemories(e.target.checked)}
            className="rounded"
          />
          Show Memories
        </label>

        <div className="ml-auto text-sm text-gray-500">
          {simulatedNodes.length} nodes, {visibleEdges.length} connections
        </div>
      </div>

      {/* Graph SVG */}
      <svg width={width} height={height} className="bg-gray-50">
        {/* Edges */}
        {visibleEdges.map(edge => {
          const source = simulatedNodes.find(n => n.id === edge.source)
          const target = simulatedNodes.find(n => n.id === edge.target)
          if (!source || !target) return null

          const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target

          return (
            <line
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isHighlighted ? '#3B82F6' : '#CBD5E1'}
              strokeWidth={isHighlighted ? 2 : 1}
              strokeOpacity={isHighlighted ? 0.8 : 0.3 + edge.strength * 0.4}
            />
          )
        })}

        {/* Nodes */}
        {simulatedNodes.map(node => {
          const isHovered = hoveredNode === node.id
          const color = getNodeColor(node)

          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
              onClick={() => handleNodeClick(node)}
              style={{ cursor: 'pointer' }}
            >
              {/* Node circle */}
              <circle
                r={node.size}
                fill={color}
                stroke={isHovered ? '#1F2937' : '#FFF'}
                strokeWidth={isHovered ? 3 : 2}
                opacity={0.9}
              />

              {/* Label (shown on hover or for important nodes) */}
              {(isHovered || node.metadata.importance && node.metadata.importance > 0.7) && (
                <text
                  y={-node.size - 5}
                  textAnchor="middle"
                  fontSize={isHovered ? 12 : 10}
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fill="#1F2937"
                >
                  {node.label.length > 20 ? node.label.substring(0, 20) + '...' : node.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex flex-wrap gap-4 text-sm">
          {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
            <div key={category} className="flex items-center gap-1">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="capitalize">{category}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hovered node details */}
      {hoveredNode && (
        <div className="absolute bg-white shadow-lg rounded-lg p-4 max-w-sm border pointer-events-none"
          style={{ top: 'auto', bottom: 20, right: 20 }}>
          {(() => {
            const node = simulatedNodes.find(n => n.id === hoveredNode)
            if (!node) return null

            return (
              <>
                <h4 className="font-semibold">{node.label}</h4>
                <p className="text-sm text-gray-500 capitalize">{node.type}</p>
                {node.metadata.category && (
                  <p className="text-sm text-gray-500">Category: {node.metadata.category}</p>
                )}
                {node.metadata.importance !== undefined && (
                  <p className="text-sm text-gray-500">
                    Importance: {(node.metadata.importance * 100).toFixed(0)}%
                  </p>
                )}
                <p className="text-sm text-gray-500">
                  Connections: {node.metadata.connectionCount}
                </p>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export default KnowledgeGraph
