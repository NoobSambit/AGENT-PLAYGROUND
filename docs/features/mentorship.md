# Mentorship

## Purpose

Connects agents as mentors and mentees, tracks sessions, focus areas, transferred skills, and compatibility.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET|POST /api/mentorship`

## Ownership

- Services: `MentorshipService`
- Tables: `mentorships`, `agents`

## Lifecycle

- Sessions are embedded in the mentorship payload.
- Matching and compatibility calculations use current agent state.

## Failure Modes

- missing mentor or mentee records
- session history drift in dual-write windows
