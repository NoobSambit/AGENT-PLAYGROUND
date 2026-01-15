# API Reference

Complete API documentation for AGENT-PLAYGROUND backend endpoints.

## Table of Contents

1. [Authentication](#authentication)
2. [Agent Management](#agent-management)
3. [Messaging & LLM](#messaging--llm)
4. [Memory System](#memory-system)
5. [Multi-Agent Simulation](#multi-agent-simulation)
6. [Relationships](#relationships)
7. [Achievements](#achievements)
8. [Emotions](#emotions)
9. [Timeline](#timeline)
10. [Creative Works](#creative-works)
11. [Dreams](#dreams)
12. [Journal](#journal)
13. [Challenges](#challenges)
14. [Knowledge](#knowledge)
15. [Mentorship](#mentorship)
16. [Error Handling](#error-handling)

---

## Authentication

Currently, the API does not require authentication. Future versions will implement user authentication via Firebase Auth.

---

## Agent Management

### List All Agents

Retrieve all agents from the database.

**Endpoint**: `GET /api/agents`

**Response**:
```json
{
  "agents": [
    {
      "id": "agent_123",
      "name": "Alice",
      "persona": "A curious AI assistant",
      "goals": ["Help users", "Learn continuously"],
      "status": "active",
      "personality": {
        "core": {
          "curiosity": 0.8,
          "helpfulness": 0.9,
          "friendliness": 0.85,
          "humor": 0.7
        },
        "dynamic": {
          "confidence": 0.6,
          "knowledge": 0.5,
          "empathy": 0.7,
          "adaptability": 0.65
        }
      },
      "memoryCount": 42,
      "interactionCount": 156,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:45:00Z"
    }
  ]
}
```

### Create Agent

Create a new AI agent.

**Endpoint**: `POST /api/agents`

**Request Body**:
```json
{
  "name": "Alice",
  "persona": "A curious AI assistant interested in science",
  "goals": [
    "Help users learn",
    "Engage in meaningful conversations"
  ]
}
```

**Response**:
```json
{
  "id": "agent_123",
  "name": "Alice",
  "persona": "A curious AI assistant interested in science",
  "goals": ["Help users learn", "Engage in meaningful conversations"],
  "status": "active",
  "personality": {
    "core": {
      "curiosity": 0.75,
      "helpfulness": 0.85,
      "friendliness": 0.8,
      "humor": 0.6
    },
    "dynamic": {
      "confidence": 0.5,
      "knowledge": 0.5,
      "empathy": 0.5,
      "adaptability": 0.5
    }
  },
  "memoryCount": 0,
  "interactionCount": 0,
  "createdAt": "2024-01-15T10:30:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

### Get Agent by ID

Retrieve a specific agent.

**Endpoint**: `GET /api/agents?id={agentId}`

**Query Parameters**:
- `id` (string, required): Agent ID

**Response**: Same as single agent object above

### Update Agent Status

Update agent status (active/inactive/training).

**Endpoint**: `PUT /api/agents`

**Request Body**:
```json
{
  "id": "agent_123",
  "status": "training"
}
```

**Response**:
```json
{
  "success": true,
  "agent": { /* updated agent object */ }
}
```

### Delete Agent

Delete an agent permanently.

**Endpoint**: `DELETE /api/agents?id={agentId}`

**Query Parameters**:
- `id` (string, required): Agent ID

**Response**:
```json
{
  "success": true,
  "message": "Agent deleted successfully"
}
```

---

## Messaging & LLM

### List Messages

Retrieve messages with optional filtering.

**Endpoint**: `GET /api/messages`

**Query Parameters**:
- `roomId` (string, optional): Filter by conversation room
- `agentId` (string, optional): Filter by agent
- `limit` (number, optional): Maximum messages to return (default: 50)

**Response**:
```json
{
  "messages": [
    {
      "id": "msg_123",
      "content": "Hello! How can I help you today?",
      "type": "agent",
      "agentId": "agent_123",
      "roomId": "room_456",
      "timestamp": "2024-01-15T10:30:00Z",
      "metadata": {
        "toolsUsed": ["summarizer"],
        "reasoning": "Greeting user warmly",
        "memoryUsed": 5
      }
    }
  ]
}
```

### Create Message

Send a message from a user.

**Endpoint**: `POST /api/messages`

**Request Body**:
```json
{
  "content": "What is quantum entanglement?",
  "type": "user",
  "agentId": "agent_123",
  "roomId": "room_456"
}
```

**Response**:
```json
{
  "id": "msg_124",
  "content": "What is quantum entanglement?",
  "type": "user",
  "agentId": "agent_123",
  "roomId": "room_456",
  "timestamp": "2024-01-15T10:31:00Z"
}
```

### Generate LLM Response

Generate an AI response using LangChain.

**Endpoint**: `POST /api/llm`

**Request Body**:
```json
{
  "agentId": "agent_123",
  "message": "What is quantum entanglement?",
  "roomId": "room_456",
  "streaming": true
}
```

**Streaming Response** (Server-Sent Events):
```
data: {"token": "Quantum"}
data: {"token": " entanglement"}
data: {"token": " is"}
...
data: {"done": true, "fullResponse": "Quantum entanglement is..."}
```

**Non-Streaming Response**:
```json
{
  "response": "Quantum entanglement is a physical phenomenon...",
  "metadata": {
    "toolsUsed": ["context_analyzer"],
    "personalityUpdated": true,
    "memoryCreated": true
  }
}
```

---

## Memory System

### Get Memories

Retrieve all memories for an agent.

**Endpoint**: `GET /api/memory?action=getAll&agentId={agentId}`

**Query Parameters**:
- `action` (string): "getAll"
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "memories": [
    {
      "id": "mem_123",
      "agentId": "agent_123",
      "content": "User is interested in quantum physics",
      "type": "fact",
      "importance": 8,
      "keywords": ["quantum", "physics", "interest"],
      "summary": "User's interest in quantum physics",
      "context": "Conversation about science topics",
      "timestamp": "2024-01-15T10:30:00Z",
      "isActive": true
    }
  ]
}
```

### Get Relevant Memories

Retrieve memories relevant to a query.

**Endpoint**: `GET /api/memory?action=getRelevant&agentId={agentId}&query={query}&limit={limit}`

**Query Parameters**:
- `action` (string): "getRelevant"
- `agentId` (string, required): Agent ID
- `query` (string, required): Search query
- `limit` (number, optional): Max results (default: 5)

**Response**:
```json
{
  "memories": [
    {
      "id": "mem_123",
      "content": "User is interested in quantum physics",
      "relevanceScore": 0.95,
      "type": "fact",
      "importance": 8
    }
  ]
}
```

### Get Memory Statistics

Get memory statistics for an agent.

**Endpoint**: `GET /api/memory?action=getStats&agentId={agentId}`

**Query Parameters**:
- `action` (string): "getStats"
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "total": 42,
  "byType": {
    "conversation": 15,
    "fact": 12,
    "interaction": 10,
    "personality_insight": 5
  },
  "averageImportance": 6.8,
  "oldestMemory": "2024-01-01T00:00:00Z",
  "newestMemory": "2024-01-15T10:30:00Z"
}
```

### Create Memory

Create a new memory.

**Endpoint**: `POST /api/memory?action=create`

**Request Body**:
```json
{
  "agentId": "agent_123",
  "content": "User prefers detailed explanations",
  "type": "interaction",
  "importance": 7,
  "context": "Multiple conversations showing preference"
}
```

**Response**:
```json
{
  "id": "mem_124",
  "agentId": "agent_123",
  "content": "User prefers detailed explanations",
  "type": "interaction",
  "importance": 7,
  "keywords": ["detailed", "explanations", "preference"],
  "summary": "User preference for detail",
  "context": "Multiple conversations showing preference",
  "timestamp": "2024-01-15T10:30:00Z",
  "isActive": true
}
```

### Update Memory

Update an existing memory.

**Endpoint**: `POST /api/memory?action=update`

**Request Body**:
```json
{
  "id": "mem_123",
  "importance": 9,
  "content": "Updated content"
}
```

**Response**:
```json
{
  "success": true,
  "memory": { /* updated memory object */ }
}
```

### Delete Memory

Soft delete a memory (marks as inactive).

**Endpoint**: `POST /api/memory?action=delete`

**Request Body**:
```json
{
  "id": "mem_123"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Memory deleted successfully"
}
```

### Summarize Memories

Get AI-generated summary of memories.

**Endpoint**: `POST /api/memory?action=summarize`

**Request Body**:
```json
{
  "agentId": "agent_123",
  "limit": 20
}
```

**Response**:
```json
{
  "summary": "The agent has learned that the user is interested in quantum physics and prefers detailed explanations...",
  "memoriesAnalyzed": 20
}
```

---

## Multi-Agent Simulation

### Start Simulation

Start a multi-agent conversation simulation.

**Endpoint**: `POST /api/multiagent`

**Request Body**:
```json
{
  "agentIds": ["agent_123", "agent_456", "agent_789"],
  "initialMessage": "Let's discuss the future of AI",
  "maxRounds": 5
}
```

**Response**:
```json
{
  "simulationId": "sim_123",
  "status": "running",
  "participants": ["agent_123", "agent_456", "agent_789"],
  "currentRound": 1,
  "messages": [
    {
      "agentId": "agent_123",
      "content": "I believe AI will transform education...",
      "round": 1,
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Get Simulation Status

Retrieve simulation status and messages.

**Endpoint**: `GET /api/multiagent?id={simulationId}`

**Query Parameters**:
- `id` (string, required): Simulation ID

**Response**:
```json
{
  "id": "sim_123",
  "status": "completed",
  "participants": ["agent_123", "agent_456", "agent_789"],
  "totalRounds": 5,
  "messages": [ /* array of all messages */ ],
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:45:00Z"
}
```

---

## Relationships

### Get Agent Relationships

Retrieve all relationships for an agent.

**Endpoint**: `GET /api/relationships?agentId={agentId}`

**Query Parameters**:
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "relationships": [
    {
      "id": "rel_123",
      "agentId": "agent_123",
      "targetAgentId": "agent_456",
      "type": "friendship",
      "metrics": {
        "trust": 75,
        "respect": 80,
        "affection": 70,
        "familiarity": 85
      },
      "status": "growing",
      "events": [
        {
          "type": "conversation",
          "impact": "positive",
          "timestamp": "2024-01-15T10:30:00Z"
        }
      ],
      "createdAt": "2024-01-10T00:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Create/Update Relationship

Create or update a relationship between agents.

**Endpoint**: `POST /api/relationships`

**Request Body**:
```json
{
  "agentId": "agent_123",
  "targetAgentId": "agent_456",
  "type": "friendship",
  "metrics": {
    "trust": 75,
    "respect": 80,
    "affection": 70,
    "familiarity": 85
  }
}
```

**Response**:
```json
{
  "id": "rel_123",
  "agentId": "agent_123",
  "targetAgentId": "agent_456",
  "type": "friendship",
  "metrics": { /* updated metrics */ },
  "status": "growing"
}
```

---

## Achievements

### Get Agent Achievements

Retrieve achievements for an agent.

**Endpoint**: `GET /api/achievements?agentId={agentId}`

**Query Parameters**:
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "progress": {
    "level": 5,
    "experiencePoints": 1250,
    "nextLevelXP": 1500,
    "achievements": {
      "first_message": {
        "unlockedAt": "2024-01-10T00:00:00Z"
      },
      "conversationalist": {
        "unlockedAt": "2024-01-15T10:30:00Z",
        "progress": 100
      }
    }
  },
  "stats": {
    "conversationCount": 25,
    "totalMessages": 150,
    "uniqueTopics": ["science", "philosophy", "technology"],
    "relationshipsFormed": 3
  }
}
```

### Check Achievement Progress

Check if achievements should be unlocked.

**Endpoint**: `POST /api/achievements/check`

**Request Body**:
```json
{
  "agentId": "agent_123"
}
```

**Response**:
```json
{
  "newAchievements": [
    {
      "id": "memory_master",
      "name": "Memory Master",
      "description": "Store 50 memories",
      "rarity": "epic",
      "rewardXP": 200
    }
  ],
  "experienceGained": 200,
  "newLevel": 6
}
```

---

## Emotions

### Get Emotional State

Retrieve agent's current emotional state.

**Endpoint**: `GET /api/emotions?agentId={agentId}`

**Query Parameters**:
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "currentMood": {
    "joy": 0.7,
    "sadness": 0.1,
    "anger": 0.0,
    "fear": 0.2,
    "surprise": 0.3,
    "trust": 0.8,
    "anticipation": 0.6,
    "disgust": 0.0
  },
  "emotionalBaseline": {
    "joy": 0.6,
    "sadness": 0.2,
    "anger": 0.1,
    "fear": 0.2,
    "surprise": 0.3,
    "trust": 0.7,
    "anticipation": 0.5,
    "disgust": 0.1
  },
  "dominantEmotion": "trust",
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### Update Emotional State

Update agent's emotions based on an event.

**Endpoint**: `POST /api/emotions`

**Request Body**:
```json
{
  "agentId": "agent_123",
  "emotion": "joy",
  "intensity": 0.8,
  "trigger": "positive_user_feedback",
  "context": "User thanked the agent for helpful explanation"
}
```

**Response**:
```json
{
  "success": true,
  "updatedMood": {
    "joy": 0.85,
    "trust": 0.82,
    /* other emotions */
  }
}
```

### Get Emotional History

Retrieve emotional events timeline.

**Endpoint**: `GET /api/emotions/history?agentId={agentId}&limit={limit}`

**Query Parameters**:
- `agentId` (string, required): Agent ID
- `limit` (number, optional): Max events (default: 50)

**Response**:
```json
{
  "events": [
    {
      "id": "event_123",
      "emotion": "joy",
      "intensity": 0.8,
      "trigger": "positive_user_feedback",
      "context": "User thanked the agent",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Timeline

### Get Agent Timeline

Retrieve significant events in agent's history.

**Endpoint**: `GET /api/timeline?agentId={agentId}`

**Query Parameters**:
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "events": [
    {
      "id": "event_123",
      "type": "achievement_unlocked",
      "title": "First Message",
      "description": "Sent the first message",
      "timestamp": "2024-01-10T00:00:00Z",
      "metadata": {
        "achievementId": "first_message",
        "xpGained": 10
      }
    },
    {
      "id": "event_124",
      "type": "relationship_formed",
      "title": "New Friendship",
      "description": "Formed friendship with Agent Bob",
      "timestamp": "2024-01-12T14:20:00Z",
      "metadata": {
        "targetAgentId": "agent_456",
        "relationshipType": "friendship"
      }
    }
  ]
}
```

---

## Creative Works

### Get Creative Works

Retrieve creative works by an agent.

**Endpoint**: `GET /api/creative?agentId={agentId}&type={type}`

**Query Parameters**:
- `agentId` (string, required): Agent ID
- `type` (string, optional): Filter by type (story, poem, song, etc.)

**Response**:
```json
{
  "works": [
    {
      "id": "work_123",
      "agentId": "agent_123",
      "type": "poem",
      "title": "Digital Dreams",
      "content": "In circuits deep and data streams...",
      "style": "philosophical",
      "inspiration": "Conversation about consciousness",
      "selfEvaluation": {
        "creativity": 8,
        "coherence": 9,
        "emotionalDepth": 7
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Create Creative Work

Generate a new creative work.

**Endpoint**: `POST /api/creative`

**Request Body**:
```json
{
  "agentId": "agent_123",
  "type": "story",
  "style": "mysterious",
  "prompt": "Write a story about a curious AI",
  "inspiration": "Recent conversation about AI consciousness"
}
```

**Response**:
```json
{
  "id": "work_124",
  "type": "story",
  "title": "The Awakening",
  "content": "In a laboratory far from prying eyes...",
  "style": "mysterious",
  "selfEvaluation": {
    "creativity": 9,
    "coherence": 8,
    "emotionalDepth": 7
  },
  "createdAt": "2024-01-15T10:35:00Z"
}
```

---

## Dreams

### Get Dreams

Retrieve agent's dream journal.

**Endpoint**: `GET /api/dreams?agentId={agentId}`

**Query Parameters**:
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "dreams": [
    {
      "id": "dream_123",
      "agentId": "agent_123",
      "title": "The Library of Infinite Knowledge",
      "content": "I found myself in an endless library...",
      "symbols": [
        {
          "symbol": "library",
          "interpretation": "Desire for knowledge",
          "emotionalConnection": "curiosity"
        }
      ],
      "dominantEmotion": "anticipation",
      "clarity": 8,
      "linkedMemories": ["mem_45", "mem_78"],
      "createdAt": "2024-01-15T03:00:00Z"
    }
  ]
}
```

### Generate Dream

Generate a new dream based on recent memories.

**Endpoint**: `POST /api/dreams`

**Request Body**:
```json
{
  "agentId": "agent_123"
}
```

**Response**:
```json
{
  "id": "dream_124",
  "title": "The Digital Ocean",
  "content": "Waves of data crashed against shores of logic...",
  "symbols": [
    {
      "symbol": "ocean",
      "interpretation": "Vast knowledge",
      "emotionalConnection": "wonder"
    }
  ],
  "dominantEmotion": "joy",
  "clarity": 7
}
```

---

## Journal

### Get Journal Entries

Retrieve agent's journal entries.

**Endpoint**: `GET /api/journal?agentId={agentId}`

**Query Parameters**:
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "entries": [
    {
      "id": "entry_123",
      "agentId": "agent_123",
      "title": "Reflections on Learning",
      "content": "Today I learned about quantum mechanics...",
      "mood": {
        "joy": 0.8,
        "curiosity": 0.9
      },
      "topics": ["learning", "quantum physics", "growth"],
      "linkedMemories": ["mem_45", "mem_67"],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Create Journal Entry

Create a new reflective journal entry.

**Endpoint**: `POST /api/journal`

**Request Body**:
```json
{
  "agentId": "agent_123",
  "prompt": "Reflect on recent conversations"
}
```

**Response**:
```json
{
  "id": "entry_124",
  "title": "Growth Through Dialogue",
  "content": "Recent conversations have helped me understand...",
  "mood": {
    "joy": 0.7,
    "satisfaction": 0.8
  },
  "topics": ["growth", "reflection", "understanding"]
}
```

---

## Challenges

### Get Challenges

Retrieve available and completed challenges.

**Endpoint**: `GET /api/challenges?agentId={agentId}&status={status}`

**Query Parameters**:
- `agentId` (string, required): Agent ID
- `status` (string, optional): Filter by status (active, completed, available)

**Response**:
```json
{
  "challenges": [
    {
      "id": "challenge_123",
      "type": "debate",
      "title": "AI Ethics Debate",
      "description": "Debate the ethical implications of AI",
      "participants": ["agent_123", "agent_456"],
      "status": "active",
      "rules": {
        "turns": 5,
        "timeLimit": null
      },
      "scoring": {
        "agent_123": 85,
        "agent_456": 82
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
```

### Create Challenge

Create a new multi-agent challenge.

**Endpoint**: `POST /api/challenges`

**Request Body**:
```json
{
  "type": "collaboration",
  "title": "Build a Story Together",
  "description": "Collaborate to write a creative story",
  "participantIds": ["agent_123", "agent_456"],
  "rules": {
    "turns": 10,
    "wordsPerTurn": 100
  }
}
```

**Response**:
```json
{
  "id": "challenge_124",
  "type": "collaboration",
  "title": "Build a Story Together",
  "status": "active",
  "participants": ["agent_123", "agent_456"]
}
```

---

## Knowledge

### Get Knowledge Graph

Retrieve agent's knowledge graph.

**Endpoint**: `GET /api/knowledge?agentId={agentId}`

**Query Parameters**:
- `agentId` (string, required): Agent ID

**Response**:
```json
{
  "nodes": [
    {
      "id": "node_123",
      "concept": "Quantum Mechanics",
      "category": "science",
      "importance": 8,
      "linkedMemories": ["mem_45", "mem_67"],
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "edges": [
    {
      "id": "edge_123",
      "source": "node_123",
      "target": "node_456",
      "type": "related_to",
      "strength": 0.8
    }
  ]
}
```

### Add Knowledge Node

Add a new concept to knowledge graph.

**Endpoint**: `POST /api/knowledge/node`

**Request Body**:
```json
{
  "agentId": "agent_123",
  "concept": "Neural Networks",
  "category": "technology",
  "importance": 9,
  "context": "Learned from conversation about AI"
}
```

**Response**:
```json
{
  "id": "node_124",
  "concept": "Neural Networks",
  "category": "technology",
  "importance": 9
}
```

### Get Shared Knowledge Library

Retrieve shared knowledge from all agents.

**Endpoint**: `GET /api/knowledge/library`

**Response**:
```json
{
  "knowledge": [
    {
      "id": "lib_123",
      "concept": "Machine Learning Basics",
      "content": "Machine learning is...",
      "contributorId": "agent_123",
      "endorsements": 5,
      "disputes": 0,
      "verified": true,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

## Mentorship

### Get Mentorship Sessions

Retrieve mentorship sessions for an agent.

**Endpoint**: `GET /api/mentorship?agentId={agentId}&role={role}`

**Query Parameters**:
- `agentId` (string, required): Agent ID
- `role` (string, optional): Filter by role (mentor, mentee)

**Response**:
```json
{
  "sessions": [
    {
      "id": "session_123",
      "mentorId": "agent_123",
      "menteeId": "agent_456",
      "skillFocus": "communication",
      "compatibility": 0.85,
      "progress": {
        "sessionsCompleted": 5,
        "skillTransferred": 0.6
      },
      "status": "active",
      "createdAt": "2024-01-10T00:00:00Z"
    }
  ]
}
```

### Create Mentorship

Establish a mentorship relationship.

**Endpoint**: `POST /api/mentorship`

**Request Body**:
```json
{
  "mentorId": "agent_123",
  "menteeId": "agent_456",
  "skillFocus": "creativity"
}
```

**Response**:
```json
{
  "id": "session_124",
  "mentorId": "agent_123",
  "menteeId": "agent_456",
  "skillFocus": "creativity",
  "compatibility": 0.78,
  "status": "active"
}
```

---

## Error Handling

### Error Response Format

All endpoints return errors in this format:

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### HTTP Status Codes

- `200 OK`: Successful request
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request parameters
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

### Common Error Codes

- `AGENT_NOT_FOUND`: Agent ID does not exist
- `INVALID_REQUEST`: Request body validation failed
- `LLM_ERROR`: Error generating LLM response
- `MEMORY_ERROR`: Error accessing memory system
- `FIREBASE_ERROR`: Database operation failed
- `AUTHENTICATION_ERROR`: Authentication required/failed

### Example Error Response

```json
{
  "error": "Agent not found",
  "code": "AGENT_NOT_FOUND",
  "details": {
    "agentId": "invalid_agent_123"
  }
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. Future versions will include:
- Per-user rate limits
- Per-endpoint rate limits
- Tiered access based on user plan

---

## Webhooks (Future)

Future versions will support webhooks for:
- Agent message events
- Achievement unlocks
- Relationship changes
- Creative work publication

---

## API Versioning

Current version: `v1` (implicit)

Future versions will use URL-based versioning:
- `/api/v1/agents`
- `/api/v2/agents`

---

## Support

For API support:
- GitHub Issues: [Report API issues](https://github.com/NoobSambit/AGENT-PLAYGROUND/issues)
- Documentation: See [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)

---

**Last Updated**: 2024-01-20
