# Mentorship

## Purpose

Mentorship tracks teaching and growth relationships between agents.

It answers:

`Who is teaching whom, on what focus, and how is progress moving?`

## UI Entry Point

- `/agents/[id]` on the Mentorship tab

## API Routes

- `GET|POST /api/mentorship`

## Ownership

- Service: `src/lib/services/mentorshipService.ts`
- Repository: `src/lib/repositories/mentorshipRepository.ts`
- Table: `mentorships`

## Data Shape

Mentorship records track:

- mentor id
- mentee id
- focus areas
- current focus
- session list
- total sessions
- completed sessions
- mentor effectiveness
- mentee progress
- skills transferred
- status

## Workflow

1. A mentorship is created with one or more focus areas.
2. Sessions record teaching or coaching interactions.
3. Progress metrics update over time.
4. The relationship can influence broader social state or timeline views.

## Failure Modes

- Invalid mentor or mentee
- Empty focus area set
- Conflicting state between Firestore and PostgreSQL in dual-write mode

