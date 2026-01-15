# Contributing to AGENT-PLAYGROUND

Thank you for your interest in contributing to AGENT-PLAYGROUND! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Process](#development-process)
4. [Coding Standards](#coding-standards)
5. [Commit Guidelines](#commit-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing Guidelines](#testing-guidelines)
8. [Documentation](#documentation)
9. [Issue Reporting](#issue-reporting)
10. [Feature Requests](#feature-requests)
11. [Areas for Contribution](#areas-for-contribution)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of:
- Age, body size, disability, ethnicity
- Gender identity and expression
- Level of experience
- Nationality, personal appearance, race
- Religion, sexual identity and orientation

### Expected Behavior

- Be respectful and considerate
- Welcome newcomers and help them get started
- Focus on constructive feedback
- Accept criticism gracefully
- Show empathy toward others

### Unacceptable Behavior

- Harassment, trolling, or derogatory comments
- Personal or political attacks
- Publishing others' private information
- Any conduct inappropriate in a professional setting

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Git installed
- GitHub account
- Firebase account
- Google Gemini API key
- Code editor (VS Code recommended)

### Fork and Clone

1. **Fork the repository**
   - Visit [AGENT-PLAYGROUND](https://github.com/NoobSambit/AGENT-PLAYGROUND)
   - Click "Fork" button

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/AGENT-PLAYGROUND.git
   cd AGENT-PLAYGROUND
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/NoobSambit/AGENT-PLAYGROUND.git
   ```

### Setup Development Environment

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   - Copy `.env.example` to `.env.local`
   - Add your API keys

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Verify setup**
   - Open http://localhost:3000
   - Create a test agent
   - Send a message

---

## Development Process

### Workflow

1. **Sync with upstream**
   ```bash
   git checkout main
   git fetch upstream
   git merge upstream/main
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes**
   - Write code
   - Add tests
   - Update documentation

4. **Test your changes**
   ```bash
   npm run build
   npm run lint
   ```

5. **Commit changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Open a Pull Request**
   - Go to your fork on GitHub
   - Click "New Pull Request"
   - Fill in the PR template

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Maintenance tasks

**Examples**:
- `feature/dream-system`
- `fix/memory-retrieval-bug`
- `docs/api-documentation`
- `refactor/personality-service`

---

## Coding Standards

### TypeScript

**Use strict mode**:
```typescript
// tsconfig.json already configured with strict mode
// Always add type annotations
```

**Type definitions**:
```typescript
// Good
function createAgent(data: CreateAgentData): Promise<Agent> {
  // ...
}

// Bad
function createAgent(data: any) {
  // ...
}
```

**Avoid `any`**:
```typescript
// Good
const config: FirebaseConfig = { ... };

// Bad
const config: any = { ... };
```

### React Components

**Functional components with TypeScript**:
```typescript
import React from 'react';

interface Props {
  name: string;
  age?: number;
}

export const MyComponent: React.FC<Props> = ({ name, age }) => {
  return (
    <div>
      <h1>{name}</h1>
      {age && <p>Age: {age}</p>}
    </div>
  );
};
```

**Use hooks properly**:
```typescript
// Good - dependencies specified
useEffect(() => {
  fetchData();
}, [id]);

// Bad - missing dependencies
useEffect(() => {
  fetchData();
}, []);
```

**Component organization**:
```typescript
// 1. Imports
import React, { useState, useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';

// 2. Type definitions
interface Props { ... }

// 3. Component
export const Component: React.FC<Props> = ({ prop }) => {
  // 4. Hooks
  const [state, setState] = useState(...);

  // 5. Effects
  useEffect(() => { ... }, []);

  // 6. Event handlers
  const handleClick = () => { ... };

  // 7. Render
  return ( ... );
};
```

### Naming Conventions

**Files**:
- Components: `PascalCase.tsx`
- Services: `camelCase.ts`
- Types: `camelCase.ts`
- Utilities: `camelCase.ts`

**Variables**:
- `camelCase` for variables and functions
- `PascalCase` for types and interfaces
- `UPPER_SNAKE_CASE` for constants

**Examples**:
```typescript
// Variables
const agentName = "Alice";
const memoryCount = 42;

// Functions
function createAgent() { }
function calculateScore() { }

// Types
interface Agent { }
type EmotionType = 'joy' | 'sadness';

// Constants
const MAX_MEMORY_COUNT = 1000;
const API_BASE_URL = 'https://api.example.com';
```

### Code Style

**Indentation**: 2 spaces

**Quotes**: Single quotes for strings, double quotes for JSX

**Semicolons**: Required

**Line length**: Max 80-100 characters (flexible)

**Formatting**:
```typescript
// Good
const result = condition
  ? longFunctionName(param1, param2)
  : anotherFunction();

// Bad
const result = condition ? longFunctionName(param1, param2) : anotherFunction();
```

### Comments

**Use JSDoc for functions**:
```typescript
/**
 * Creates a new AI agent with the given configuration.
 *
 * @param data - The agent configuration
 * @returns Promise resolving to the created agent
 * @throws Error if validation fails
 */
export async function createAgent(
  data: CreateAgentData
): Promise<Agent> {
  // Implementation
}
```

**Inline comments**:
```typescript
// Good - Explain WHY, not WHAT
// Use conservative update to prevent trait oscillation
const update = Math.min(change, MAX_TRAIT_CHANGE);

// Bad - Obvious comment
// Set update to change
const update = change;
```

---

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Scope** (optional):
- `agent`: Agent-related changes
- `memory`: Memory system
- `ui`: User interface
- `api`: API changes
- `llm`: LangChain/LLM

**Subject**:
- Imperative mood ("add" not "added")
- No capital letter at start
- No period at end
- Max 50 characters

**Examples**:
```
feat(agent): add dream generation system

Add ability for agents to generate symbolic dreams based on
recent memories and emotional states.

- Create dream generation service
- Add dream storage to Firestore
- Implement dream analysis
- Add dream journal UI component

Closes #123
```

```
fix(memory): resolve keyword extraction bug

Fix issue where keywords were not being extracted properly
for memories with special characters.

Fixes #456
```

```
docs: update API reference for relationships

Add detailed documentation for relationship endpoints including
request/response examples and error codes.
```

### Commit Best Practices

**Atomic commits**: One logical change per commit

**Good**:
```bash
git commit -m "feat(ui): add emotion radar chart"
git commit -m "feat(ui): add emotion timeline"
```

**Bad**:
```bash
git commit -m "add emotion features and fix bugs"
```

**Commit often**: Small, frequent commits are better than large ones

**Test before committing**: Ensure code builds and runs

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] Documentation updated
- [ ] No console.log statements (use proper logging)
- [ ] No commented-out code
- [ ] Branch is up to date with main

### PR Title

Follow commit message format:
```
feat(scope): add new feature
fix(scope): resolve bug
docs: update documentation
```

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Documentation update
- [ ] Refactoring
- [ ] Performance improvement

## Changes Made
- Change 1
- Change 2
- Change 3

## Testing
How to test these changes

## Screenshots (if applicable)
Before/after screenshots for UI changes

## Related Issues
Closes #123
Relates to #456

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No breaking changes
- [ ] Tests added/updated
```

### Review Process

1. **Automated checks**: Must pass CI/CD (future)
2. **Code review**: At least one approval required
3. **Testing**: Reviewer tests changes locally
4. **Feedback**: Address review comments
5. **Approval**: Maintainer approves and merges

### After PR Merge

- Delete your feature branch
- Pull latest main
- Start new feature from updated main

---

## Testing Guidelines

### Manual Testing

**Test checklist**:
- [ ] Create agent
- [ ] Send messages
- [ ] Check memory creation
- [ ] Verify personality evolution
- [ ] Test all tabs/features
- [ ] Check error handling
- [ ] Test on different screen sizes

### Unit Testing (Future)

**Test structure**:
```typescript
import { createAgent } from '@/lib/services/agentService';

describe('agentService', () => {
  describe('createAgent', () => {
    it('should create agent with valid data', async () => {
      const data = {
        name: 'Test Agent',
        persona: 'Helpful AI',
        goals: ['Help users'],
      };

      const agent = await createAgent(data);

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Test Agent');
      expect(agent.personality).toBeDefined();
    });

    it('should throw error with invalid data', async () => {
      const data = { name: '' };

      await expect(createAgent(data)).rejects.toThrow();
    });
  });
});
```

### Integration Testing (Future)

Test API endpoints, database interactions, and LLM integration.

---

## Documentation

### When to Update Documentation

- Adding new features
- Changing API endpoints
- Modifying architecture
- Adding configuration options
- Fixing bugs (if documented)

### Documentation Files

- **README.md**: Quick start and overview
- **PROJECT_DOCUMENTATION.md**: Comprehensive guide
- **API_REFERENCE.md**: API endpoints
- **ARCHITECTURE.md**: System design
- **CONTRIBUTING.md**: This file

### Code Documentation

**Functions**:
```typescript
/**
 * Calculates the relevance score between a query and memory.
 *
 * @param query - The search query
 * @param memory - The memory to score
 * @returns Relevance score between 0 and 1
 */
function calculateRelevance(query: string, memory: Memory): number {
  // Implementation
}
```

**Complex logic**:
```typescript
// Calculate trait update using conservative approach
// to prevent rapid personality changes that feel inauthentic
const traitDelta = Math.min(
  suggestedChange,
  MAX_TRAIT_CHANGE
);
```

---

## Issue Reporting

### Before Creating an Issue

1. **Search existing issues**: Check if already reported
2. **Verify the bug**: Reproduce consistently
3. **Check documentation**: Might be expected behavior
4. **Update dependencies**: Use latest versions

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Screenshots
If applicable

## Environment
- OS: [e.g., Windows 10]
- Browser: [e.g., Chrome 120]
- Node version: [e.g., 18.17.0]

## Additional Context
Any other relevant information
```

### Issue Labels

- `bug`: Something isn't working
- `enhancement`: New feature or improvement
- `documentation`: Documentation updates
- `question`: Questions about usage
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention needed
- `priority: high`: Critical issues
- `priority: low`: Nice to have

---

## Feature Requests

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature

## Problem to Solve
What problem does this solve?

## Proposed Solution
How should this work?

## Alternatives Considered
Other approaches considered

## Additional Context
Mockups, examples, or references

## Priority
[ ] Critical
[ ] High
[ ] Medium
[ ] Low
```

---

## Areas for Contribution

### 🌟 Good First Issues

Perfect for newcomers:
- Documentation improvements
- UI enhancements
- Bug fixes
- Test coverage
- Code cleanup

### 🎨 Frontend

- New UI components
- Animation improvements
- Responsive design
- Accessibility enhancements
- Performance optimization

### 🔧 Backend

- New API endpoints
- Service layer improvements
- Database optimization
- Error handling
- Caching strategies

### 🤖 AI/LLM

- Prompt engineering
- New LLM integrations
- Tool development
- Context optimization
- Response quality

### 📊 Features

- New agent capabilities
- Visualization improvements
- Relationship system enhancements
- Creative system expansion
- Knowledge graph features

### 📚 Documentation

- Tutorial creation
- API examples
- Architecture diagrams
- Use case documentation
- Translation (future)

### 🧪 Testing

- Unit tests
- Integration tests
- E2E tests
- Performance tests
- Load tests

### 🚀 Performance

- Code optimization
- Bundle size reduction
- Database query optimization
- Caching improvements
- Lazy loading

---

## Recognition

### Contributors

All contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Mentioned in relevant PRs

### Levels of Contribution

**Contributor**: 1+ merged PRs
**Regular Contributor**: 5+ merged PRs
**Core Contributor**: 20+ merged PRs or significant feature
**Maintainer**: Invited based on sustained contributions

---

## Getting Help

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Pull Requests**: Code review and collaboration

### Resources

- [PROJECT_DOCUMENTATION.md](./PROJECT_DOCUMENTATION.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [Next.js Docs](https://nextjs.org/docs)
- [LangChain Docs](https://js.langchain.com/)
- [Firebase Docs](https://firebase.google.com/docs)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## Thank You!

Thank you for contributing to AGENT-PLAYGROUND! Your efforts help make AI agents more intelligent and engaging for everyone.

**Questions?** Open an issue or discussion on GitHub.

---

**Last Updated**: 2024-01-20
