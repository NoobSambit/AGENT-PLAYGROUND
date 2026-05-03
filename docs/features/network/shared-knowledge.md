# Shared Knowledge

## Purpose

Shared knowledge stores reusable conclusions that the network can promote and inspect.

It answers:

`What should be available to more than one agent?`

## UI Entry Point

- `/agents/[id]` on the Library tab

## API Routes

- `GET|POST /api/knowledge`

## Ownership

- Service: `src/lib/services/knowledgeService.ts`
- Repository: `src/lib/repositories/knowledgeRepository.ts`
- Table: `shared_knowledge`

## Data Shape

The main fields include:

- topic
- category
- content
- contributor id and name
- endorsements
- disputes
- access count
- last accessed time
- used-by agents
- tags
- confidence

## Workflow

1. An agent contributes knowledge.
2. The entry is stored with a confidence score.
3. Other agents can endorse or dispute it.
4. Access count and last accessed time track actual usage.
5. The collective intelligence layer can group it into repositories or referrals.

## Failure Modes

- Search query too broad
- Low confidence contested entry
- Duplicate knowledge topic with different wording

