# AGENT-PLAYGROUND

> A production-ready AI agent management and conversation platform with advanced personality evolution, memory systems, and multi-agent capabilities.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-12.3-orange)](https://firebase.google.com/)
[![LangChain](https://img.shields.io/badge/LangChain-0.3-green)](https://js.langchain.com/)

## Overview

**AGENT-PLAYGROUND** is a sophisticated platform for creating and managing AI agents with genuine personality depth. Unlike traditional chatbots, these agents:

- **Evolve**: Personality traits develop through interactions
- **Remember**: Advanced memory systems enable learning and context retention
- **Feel**: 8-dimensional emotional model with real-time mood tracking
- **Create**: Generate original stories, poems, songs, and more
- **Connect**: Form relationships with other agents and users
- **Achieve**: Progress through levels and unlock achievements

## Key Features

### Core Capabilities
- **Personality Evolution**: 8 traits (4 core + 4 dynamic) that evolve based on interactions
- **Memory Systems**: 4 memory types (conversation, fact, interaction, personality insights)
- **Emotional Intelligence**: Real-time emotional states across 8 dimensions
- **Achievement System**: 50+ achievements with XP and level progression
- **Multi-Agent Simulation**: Multiple agents conversing and collaborating

### Advanced Features (Phase 1-3)
- **Linguistic Profiles**: Unique communication styles per agent
- **Relationship Networks**: Agents form dynamic relationships
- **Creativity Engine**: Generate original creative works in 10+ formats
- **Dream System**: Symbolic dream generation and interpretation
- **Knowledge Graphs**: Visual representation of agent knowledge
- **Mentorship**: Agent-to-agent learning and skill transfer
- **3D Neural Visualization**: Real-time visualization of agent "thought processes"
- **Psychological Profiles**: Big Five, MBTI, and Enneagram assessments

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+ (or yarn/pnpm/bun)
- Firebase account
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/NoobSambit/AGENT-PLAYGROUND.git
   cd AGENT-PLAYGROUND
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create `.env.local` in the root directory:
   ```env
   # Firebase
   NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

   # LLM APIs
   GOOGLE_API_KEY=your_google_gemini_api_key
   GROQ_API_KEY=your_groq_api_key  # Optional fallback
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## Documentation

- **[PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)** - Comprehensive project documentation
- **[FEATURES.md](./FEATURES.md)** - Complete feature list and details
- **[API_REFERENCE.md](./API_REFERENCE.md)** - API endpoint documentation
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and design
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Contribution guidelines
- **[ENHANCEMENTS.md](./ENHANCEMENTS.md)** - Future enhancement plans

## Technology Stack

**Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS v4, Framer Motion
**3D Graphics**: Three.js, React Three Fiber, Drei
**Backend**: Firebase Firestore
**AI/LLM**: LangChain, Google Gemini, Groq API
**State Management**: Zustand

## Project Structure

```
AGENT-PLAYGROUND/
├── src/
│   ├── app/                 # Next.js pages & API routes
│   ├── components/          # React components (19+ directories)
│   ├── lib/
│   │   ├── services/        # Business logic (23 services)
│   │   └── langchain/       # LangChain integration
│   ├── stores/              # Zustand state management
│   └── types/               # TypeScript definitions
├── public/                  # Static assets
└── Documentation/           # Project documentation
```

## Usage Example

```typescript
// Create an agent
const agent = await createAgent({
  name: "Alice",
  persona: "A curious AI interested in science and philosophy",
  goals: ["Help users learn", "Engage in meaningful conversations"]
});

// Start a conversation
const response = await sendMessage({
  agentId: agent.id,
  message: "Tell me about quantum mechanics",
  roomId: conversationId
});

// Agent responds with personality, using memory and evolving traits
```

## Development

```bash
# Development server
npm run dev

# Production build
npm run build

# Start production server
npm start

# Linting
npm run lint
```

## Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main

### Other Platforms
- **Netlify**: Configure build command and environment variables
- **AWS Amplify**: Connect repository and set build settings
- **Self-hosted**: Build with `npm run build` and run with `npm start`

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- **Phase 1**: ✅ Linguistic personalities, emotions, achievements, timeline, neural viz
- **Phase 2**: ✅ Relationships, creativity, dreams, journals, profiles, challenges
- **Phase 3**: ✅ Knowledge graphs, mentorship, learning patterns
- **Phase 4**: 🚧 Advanced AI features, real-time collaboration, mobile app

See [ENHANCEMENTS.md](./ENHANCEMENTS.md) for detailed roadmap.

## Troubleshooting

### Common Issues

**Firebase connection errors**: Verify API keys in `.env.local`
**LLM API errors**: Check API keys and quota limits
**Build errors**: Clear cache with `rm -rf .next && npm run build`

See [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md#troubleshooting) for more help.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [LangChain](https://js.langchain.com/) - LLM orchestration
- [Firebase](https://firebase.google.com/) - Backend infrastructure
- [Next.js](https://nextjs.org/) - React framework
- [Three.js](https://threejs.org/) - 3D visualizations
- [Google Gemini](https://ai.google.dev/) - AI capabilities

## Contact

- **GitHub**: [@NoobSambit](https://github.com/NoobSambit)
- **Project**: [AGENT-PLAYGROUND](https://github.com/NoobSambit/AGENT-PLAYGROUND)

---

**Built with passion to create truly intelligent AI agents** ✨
