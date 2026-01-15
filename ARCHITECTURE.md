# System Architecture

Detailed architectural documentation for AGENT-PLAYGROUND.

## Table of Contents

1. [Overview](#overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Frontend Architecture](#frontend-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Data Architecture](#data-architecture)
6. [LangChain Integration](#langchain-integration)
7. [State Management](#state-management)
8. [Component Architecture](#component-architecture)
9. [Service Layer](#service-layer)
10. [Security Architecture](#security-architecture)
11. [Performance Considerations](#performance-considerations)
12. [Scalability](#scalability)

---

## Overview

AGENT-PLAYGROUND follows a modern full-stack architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  (Next.js App Router, React Components, Three.js)          │
└─────────────────────────────────────────────────────────────┘
                          ↓↑
┌─────────────────────────────────────────────────────────────┐
│                  State Management Layer                      │
│              (Zustand Stores, Client State)                 │
└─────────────────────────────────────────────────────────────┘
                          ↓↑
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│         (Next.js API Routes, REST Endpoints)                │
└─────────────────────────────────────────────────────────────┘
                          ↓↑
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│         (Business Logic, 23 Service Modules)                │
└─────────────────────────────────────────────────────────────┘
                          ↓↑
┌─────────────────────────────────────────────────────────────┐
│                  Integration Layer                           │
│      (LangChain, Firebase SDK, External APIs)               │
└─────────────────────────────────────────────────────────────┘
                          ↓↑
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│           (Firebase Firestore, Cloud Storage)               │
└─────────────────────────────────────────────────────────────┘
```

### Architectural Principles

1. **Separation of Concerns**: Clear boundaries between layers
2. **Single Responsibility**: Each module has one clear purpose
3. **DRY (Don't Repeat Yourself)**: Reusable components and services
4. **Scalability**: Designed to handle growth in users and data
5. **Maintainability**: Clean, documented, and testable code
6. **Performance**: Optimized for speed and efficiency

---

## Architecture Patterns

### 1. Layered Architecture

The application follows a strict layered architecture:

**Presentation Layer** → **State Layer** → **API Layer** → **Service Layer** → **Data Layer**

Each layer only communicates with adjacent layers, never skipping levels.

### 2. Service-Oriented Architecture

Business logic is encapsulated in service modules:
- `agentService.ts`: Agent CRUD operations
- `memoryService.ts`: Memory management
- `personalityService.ts`: Personality evolution
- `emotionalService.ts`: Emotional processing
- ... (19 more services)

### 3. Repository Pattern

Data access is abstracted through service layers that interact with Firebase:

```typescript
// Service layer abstracts database operations
export async function getAgent(id: string): Promise<Agent> {
  const docRef = doc(db, 'agents', id);
  const snapshot = await getDoc(docRef);
  return snapshot.data() as Agent;
}
```

### 4. Singleton Pattern

LangChain chains are implemented as singletons to optimize performance:

```typescript
class AgentChain {
  private static instances: Map<string, AgentChain> = new Map();

  static getInstance(agentId: string): AgentChain {
    if (!this.instances.has(agentId)) {
      this.instances.set(agentId, new AgentChain(agentId));
    }
    return this.instances.get(agentId)!;
  }
}
```

### 5. Factory Pattern

Agent creation uses factory pattern to initialize complex objects:

```typescript
export async function createAgent(data: CreateAgentData): Promise<Agent> {
  // Generate personality
  const personality = await generatePersonality(data.persona);

  // Initialize emotional state
  const emotions = initializeEmotions();

  // Create agent object
  return {
    id: generateId(),
    ...data,
    personality,
    emotions,
    createdAt: new Date().toISOString(),
  };
}
```

### 6. Observer Pattern

State management uses observer pattern via Zustand:

```typescript
const useAgentStore = create((set) => ({
  agents: [],
  // Subscribers are notified when state changes
  setAgents: (agents) => set({ agents }),
}));
```

### 7. Strategy Pattern

LLM provider selection uses strategy pattern:

```typescript
function getLLMProvider(type: 'gemini' | 'groq') {
  switch (type) {
    case 'gemini':
      return new ChatGoogleGenerativeAI({ ... });
    case 'groq':
      return new ChatGroq({ ... });
  }
}
```

---

## Frontend Architecture

### Next.js App Router Structure

```
src/app/
├── page.tsx                    # Home page
├── layout.tsx                  # Root layout
├── dashboard/
│   └── page.tsx               # Dashboard page
├── agents/
│   ├── new/
│   │   └── page.tsx          # Agent creation
│   └── [id]/
│       ├── page.tsx          # Main agent page
│       ├── layout.tsx        # Agent layout with tabs
│       ├── achievements/
│       ├── timeline/
│       ├── emotions/
│       └── ... (15+ tabs)
├── simulation/
│   └── page.tsx              # Multi-agent simulation
└── api/
    ├── agents/
    ├── messages/
    ├── memory/
    └── ... (API routes)
```

### Component Architecture

Components are organized by feature:

```
src/components/
├── ui/                    # Base UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   └── ...
├── emotions/              # Feature: Emotions
│   ├── EmotionRadar.tsx
│   ├── EmotionTimeline.tsx
│   └── EmotionHistory.tsx
├── achievements/          # Feature: Achievements
│   ├── AchievementCard.tsx
│   ├── AchievementList.tsx
│   └── ProgressBar.tsx
└── ... (17 more feature directories)
```

### Routing Strategy

**File-based routing** with Next.js App Router:
- Dynamic routes: `/agents/[id]`
- Nested routes: `/agents/[id]/achievements`
- API routes: `/api/agents`

### Server vs Client Components

**Server Components** (default):
- Static pages
- Data fetching
- SEO-critical pages

**Client Components** (`'use client'`):
- Interactive UI
- State management
- Event handlers
- Browser APIs

### Code Splitting

Automatic code splitting via Next.js:
- Each route is a separate bundle
- Shared code in common chunks
- Dynamic imports for heavy components

```typescript
// Dynamic import for Three.js visualization
const NeuralVisualization = dynamic(
  () => import('@/components/visualizations/NeuralVisualization'),
  { ssr: false }
);
```

---

## Backend Architecture

### API Route Structure

```
src/app/api/
├── agents/
│   └── route.ts              # GET, POST, PUT, DELETE
├── messages/
│   └── route.ts              # GET, POST
├── memory/
│   └── route.ts              # GET, POST (with actions)
├── llm/
│   └── route.ts              # POST (streaming/non-streaming)
├── multiagent/
│   └── route.ts              # GET, POST
└── ... (15+ API routes)
```

### API Route Pattern

Each API route follows this pattern:

```typescript
import { NextRequest, NextResponse } from 'next/server';

// GET handler
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Business logic via service layer
    const result = await getEntity(id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error message' },
      { status: 500 }
    );
  }
}

// POST handler
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Validation
    if (!data.required) {
      return NextResponse.json(
        { error: 'Missing required field' },
        { status: 400 }
      );
    }

    // Business logic
    const result = await createEntity(data);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Error message' },
      { status: 500 }
    );
  }
}
```

### Request/Response Flow

```
Client Request
    ↓
Next.js API Route
    ↓
Request Validation
    ↓
Service Layer Call
    ↓
Database Operation
    ↓
Response Formatting
    ↓
Client Response
```

### Error Handling Strategy

**Hierarchical error handling**:

1. **API Route Level**: Catch all errors, return appropriate status codes
2. **Service Level**: Throw specific errors with context
3. **Database Level**: Handle connection errors, timeouts

```typescript
// Service layer
export async function getAgent(id: string): Promise<Agent> {
  try {
    const doc = await getDoc(doc(db, 'agents', id));
    if (!doc.exists()) {
      throw new Error('Agent not found');
    }
    return doc.data() as Agent;
  } catch (error) {
    console.error('[AgentService] Error getting agent:', error);
    throw error;
  }
}

// API route
export async function GET(request: NextRequest) {
  try {
    const agent = await getAgent(id);
    return NextResponse.json(agent);
  } catch (error) {
    if (error.message === 'Agent not found') {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Streaming Architecture

Server-Sent Events (SSE) for real-time LLM responses:

```typescript
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Stream tokens as they arrive
      for await (const chunk of llmStream) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)
        );
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

---

## Data Architecture

### Database Schema

Firebase Firestore collections:

```
firestore/
├── agents/                    # Agent entities
│   └── {agentId}/
│       ├── name: string
│       ├── persona: string
│       ├── personality: object
│       ├── emotions: object
│       └── ...
│
├── messages/                  # Conversation messages
│   └── {messageId}/
│       ├── content: string
│       ├── type: string
│       ├── agentId: string
│       ├── roomId: string
│       └── timestamp: string
│
├── memories/                  # Agent memories
│   └── {memoryId}/
│       ├── agentId: string
│       ├── content: string
│       ├── type: string
│       ├── importance: number
│       ├── keywords: array
│       └── ...
│
├── relationships/             # Agent relationships
│   └── {relationshipId}/
│       ├── agentId: string
│       ├── targetAgentId: string
│       ├── type: string
│       ├── metrics: object
│       └── ...
│
├── creative_works/            # Creative outputs
├── dreams/                    # Dream journal
├── journals/                  # Personal journals
├── challenges/                # Multi-agent challenges
├── knowledge_nodes/           # Knowledge graph
├── mentorship_sessions/       # Mentorship
└── simulations/              # Multi-agent simulations
```

### Data Relationships

**One-to-Many**:
- Agent → Memories
- Agent → Messages
- Agent → Creative Works
- Agent → Dreams
- Agent → Journal Entries

**Many-to-Many**:
- Agent ↔ Agent (Relationships)
- Agent ↔ Challenge
- Agent ↔ Knowledge Node

### Indexing Strategy

Key indexes for performance:
- `agents.createdAt` (desc)
- `messages.roomId + timestamp` (desc)
- `messages.agentId + timestamp` (desc)
- `memories.agentId + importance` (desc)
- `memories.agentId + keywords` (array-contains)

### Data Access Patterns

**Read-heavy workloads**:
- Messages: Frequent reads during conversations
- Memories: Frequent retrieval for context
- Agents: Moderate reads

**Write-heavy workloads**:
- Messages: High write frequency during chats
- Memories: Moderate write frequency
- Personality updates: Moderate write frequency

**Optimization strategies**:
- Caching frequently accessed data
- Batch writes where possible
- Pagination for large result sets
- Denormalization for read performance

---

## LangChain Integration

### Chain Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     AgentChain                          │
│  (Orchestrates agent-specific logic)                   │
│  - Manages personality                                 │
│  - Loads memory context                                │
│  - Executes tools                                      │
│  - Updates agent state                                 │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                     BaseChain                           │
│  (Core LLM interaction)                                │
│  - Formats prompts                                     │
│  - Calls LLM API                                       │
│  - Handles streaming                                   │
│  - Manages fallbacks                                   │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   LLM Providers                         │
│  - Google Gemini (primary)                             │
│  - Groq (fallback)                                     │
└─────────────────────────────────────────────────────────┘
```

### Memory Chain Flow

```
Request
    ↓
MemoryChain.load()
    ↓
Check cache
    ├─ Hit → Return cached memories
    └─ Miss → Query Firestore
              ↓
         Retrieve relevant memories
              ↓
         Cache for 10 minutes
              ↓
         Return memories
    ↓
Format for LLM context
    ↓
Include in prompt
```

### Tool Execution Flow

```
LLM Response with Tool Call
    ↓
ToolExecutor.execute()
    ↓
Identify Tool Type
    ├─ Summarizer
    ├─ Keyword Extractor
    ├─ Persona Adjuster
    ├─ Memory Summarizer
    └─ Context Analyzer
    ↓
Execute Tool Chain
    ↓
Return Tool Result
    ↓
Feed back to LLM
    ↓
Final Response
```

### Prompt Engineering

**System Prompt Structure**:
```
You are {agentName}, an AI agent with the following characteristics:

PERSONALITY:
- Core Traits: {coreTraits}
- Dynamic Traits: {dynamicTraits}

LINGUISTIC STYLE:
- Formality: {formality}
- Verbosity: {verbosity}
- Humor: {humor}

RELEVANT MEMORIES:
{memoryContext}

GOALS:
{goals}

CURRENT EMOTIONAL STATE:
{emotions}

Respond authentically while maintaining your unique personality.
```

**User Prompt Format**:
```
Recent conversation:
{last10Messages}

User: {currentMessage}

{agentName}:
```

---

## State Management

### Zustand Architecture

Two primary stores:

**Agent Store**:
```typescript
interface AgentStore {
  // State
  agents: Agent[];
  currentAgent: Agent | null;
  loading: boolean;

  // Actions
  fetchAgents: () => Promise<void>;
  createAgent: (data: CreateAgentData) => Promise<Agent>;
  updateAgent: (id: string, data: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  setCurrentAgent: (agent: Agent | null) => void;
}
```

**Message Store**:
```typescript
interface MessageStore {
  // State
  messages: Record<string, Message[]>; // roomId → messages
  currentRoom: string | null;
  loading: boolean;

  // Actions
  fetchMessages: (roomId: string) => Promise<void>;
  sendMessage: (message: CreateMessageData) => Promise<void>;
  clearMessages: (roomId?: string) => void;
  setCurrentRoom: (roomId: string | null) => void;
}
```

### State Flow

```
Component Event
    ↓
Call Store Action
    ↓
API Request
    ↓
Update Store State
    ↓
Notify Subscribers
    ↓
Re-render Components
```

### Caching Strategy

**Store-level caching**:
- Agents cached after first fetch
- Messages cached per room
- Invalidation on mutations

**LangChain caching**:
- Memory context cached for 10 minutes
- Chain instances cached per agent
- Manual cache clearing available

---

## Component Architecture

### Component Hierarchy

```
RootLayout
└── Page
    ├── Header
    ├── Navigation
    ├── Content
    │   ├── FeatureComponent
    │   │   ├── SubComponent
    │   │   └── UIComponent
    │   └── ...
    └── Footer
```

### Component Types

**1. Page Components** (`/app/**/page.tsx`):
- Top-level route components
- Data fetching
- Layout composition

**2. Layout Components** (`/app/**/layout.tsx`):
- Shared UI structure
- Persistent state
- Navigation

**3. Feature Components** (`/components/feature-name/`):
- Business logic
- API integration
- Complex state management

**4. UI Components** (`/components/ui/`):
- Reusable primitives
- No business logic
- Pure presentation

**5. Visualization Components** (`/components/visualizations/`):
- Three.js integrations
- Canvas rendering
- Performance-critical

### Component Communication

**Props** (Parent → Child):
```typescript
<ChildComponent prop={value} />
```

**Callbacks** (Child → Parent):
```typescript
<ChildComponent onEvent={(data) => handleEvent(data)} />
```

**Context** (Shared state):
```typescript
const value = useContext(SharedContext);
```

**Zustand** (Global state):
```typescript
const agents = useAgentStore((state) => state.agents);
```

---

## Service Layer

### Service Module Structure

Each service module exports functions for a specific domain:

```typescript
// lib/services/agentService.ts

export async function createAgent(data: CreateAgentData): Promise<Agent> {
  // Implementation
}

export async function getAgent(id: string): Promise<Agent> {
  // Implementation
}

export async function updateAgent(id: string, updates: Partial<Agent>): Promise<void> {
  // Implementation
}

export async function deleteAgent(id: string): Promise<void> {
  // Implementation
}
```

### Service Dependencies

Services can call other services:

```typescript
// personalityService.ts depends on memoryService.ts
import { createMemory } from './memoryService';

export async function updatePersonality(agentId: string, analysis: Analysis) {
  // Update personality
  const newTraits = calculateUpdates(analysis);

  // Store as memory
  await createMemory({
    agentId,
    type: 'personality_insight',
    content: `Personality evolved: ${JSON.stringify(newTraits)}`,
  });
}
```

### Service Testing

Services are designed for easy testing:

```typescript
// Mock Firebase
jest.mock('@/lib/firebase');

// Test service function
test('createAgent creates agent with personality', async () => {
  const agent = await createAgent({
    name: 'Test Agent',
    persona: 'Helpful AI',
    goals: ['Help users'],
  });

  expect(agent.personality).toBeDefined();
  expect(agent.personality.core.helpfulness).toBeGreaterThan(0);
});
```

---

## Security Architecture

### Authentication (Future)

Firebase Authentication integration planned:
- Email/password authentication
- Google OAuth
- Session management
- Protected routes

### Authorization (Future)

Role-based access control:
- User role: Own agents only
- Admin role: All agents
- Service role: API access

### Data Security

**Firestore Rules** (planned):
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /agents/{agentId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == resource.data.userId;
    }
  }
}
```

### API Security

**Input Validation**:
- Type checking with TypeScript
- Runtime validation
- Sanitization of user input

**Rate Limiting** (planned):
- Per-user limits
- Per-endpoint limits
- DDoS protection

### Environment Variables

Secure storage of sensitive data:
- API keys in `.env.local`
- Never committed to Git
- Loaded via Next.js environment system

---

## Performance Considerations

### Frontend Optimization

**Code Splitting**:
- Automatic route-based splitting
- Dynamic imports for heavy components
- Lazy loading of 3D visualizations

**Asset Optimization**:
- Image optimization with Next.js Image
- Font optimization with next/font
- SVG icon optimization

**Rendering Optimization**:
- React.memo for expensive components
- useMemo for expensive calculations
- useCallback for event handlers
- Virtual scrolling for long lists

### Backend Optimization

**Caching**:
- LangChain chain caching
- Memory context caching
- API response caching (future)

**Database Optimization**:
- Proper indexing
- Batch operations
- Pagination
- Query optimization

**LLM Optimization**:
- Efficient prompts
- Token limit management
- Streaming responses
- Request caching

### Monitoring

**Performance Metrics** (future):
- Page load times
- API response times
- LLM latency
- Database query times

---

## Scalability

### Horizontal Scaling

**Stateless API Layer**:
- No server-side session storage
- Can add more API servers

**Database Scaling**:
- Firestore automatically scales
- Read/write distribution
- Sharding (future)

### Vertical Scaling

**Optimize per-instance performance**:
- Memory management
- CPU utilization
- Database connection pooling

### Caching Strategy

**Multi-level caching**:
1. Browser cache (assets)
2. CDN cache (static pages)
3. Application cache (LangChain)
4. Database cache (Firestore)

### Load Balancing

Vercel automatic load balancing:
- Geographic distribution
- Auto-scaling
- DDoS protection

---

## Future Architecture Improvements

### Microservices

Split into specialized services:
- Agent service
- Memory service
- LLM service
- Relationship service

### Event-Driven Architecture

Implement event bus:
- Agent events
- Relationship events
- Achievement events
- Webhook notifications

### GraphQL API

Add GraphQL layer:
- More flexible queries
- Reduced over-fetching
- Real-time subscriptions

### WebSocket Support

Real-time features:
- Live agent status
- Real-time conversations
- Multi-user collaboration

---

## Conclusion

AGENT-PLAYGROUND is built on a solid, scalable architecture that prioritizes:
- **Maintainability**: Clean, modular code
- **Performance**: Optimized at every layer
- **Scalability**: Ready for growth
- **Security**: Protected data and APIs
- **Extensibility**: Easy to add features

The architecture is designed to evolve with the project's needs while maintaining stability and performance.

---

**Last Updated**: 2024-01-20
