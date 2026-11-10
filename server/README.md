# Solace AI — Server

Node.js + TypeScript + Express + Prisma + PostgreSQL. All AI calls happen here; the app never sees the API key.

## Setup
```bash
cd server
cp .env.example .env        # set DATABASE_URL, JWT_SECRET, AI_API_KEY (Groq or any OpenAI-compatible key)
npm install
npx prisma migrate dev --name init
npm run seed                # affirmations + activities
npm run dev                 # http://localhost:4000  (GET /health to check)
```
Need a database fast? `docker run -d --name solace-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=solace -p 5432:5432 postgres:16`

## API
All routes except register/login need `Authorization: Bearer <token>`. Errors look like `{ "error": "message" }`.

| Method | Path | What it does |
|---|---|---|
| POST | /api/auth/register | `{email, password(8+), displayName}` → `{token, user}` |
| POST | /api/auth/login | `{email, password}` → `{token, user}` |
| GET | /api/auth/me | current user + preferences + profile |
| PATCH | /api/profile | `{displayName?, avatarUrl?}` |
| PATCH | /api/profile/preferences | reminder on/off + `HH:MM` times, AI personalization flags |
| POST | /api/profile/device-token | `{token, platform}` Expo push token |
| DELETE | /api/profile/account | deletes the user and all their data |
| POST | /api/moods | `{mood, intensity 1-5, note?}` |
| GET | /api/moods | last 100 check-ins |
| GET | /api/moods/summary | last 30 days: counts, average intensity, entries |
| DELETE | /api/moods/:id | remove a check-in |
| GET / POST | /api/conversations | list / create |
| GET / PATCH / DELETE | /api/conversations/:id | read with messages / rename `{title}` / delete |
| POST | /api/conversations/:id/messages | `{content}` → `{userMessage, message}`. On AI failure returns 502 and saves nothing, so the app can retry cleanly |
| GET | /api/wellness/activities | activity catalogue |
| POST | /api/wellness/activities/:id/complete | mark a catalogue activity done |
| POST | /api/wellness/activities/log | `{type, duration}` free session, e.g. breathing |
| GET | /api/wellness/affirmations/daily | today's affirmation with `favorited` |
| GET | /api/wellness/affirmations/random?exclude=id | another affirmation |
| GET | /api/wellness/affirmations/favorites | saved affirmations |
| POST | /api/wellness/affirmations/:id/favorite | toggle favorite |
| POST | /api/wellness/assessments | `{answers, score 0-100}` |
| GET | /api/wellness/assessments/latest | latest reflection score |
| GET | /api/wellness/suggestion | one AI suggestion for today (null if AI unavailable) |
| GET | /api/wellness/progress/overview?tz=-360 | streak (in the user's local days), totals, recent moods |

## How Sol uses context
With "Personalized responses" on, each reply gets: the user's name, the last 5 check-ins (with notes, if "Use my moods" is on), titles of the last 3 other conversations, and the latest reflection score. The last 20 messages of the current chat are sent as history. Messages that look like self-harm add an extra safety instruction to the prompt. Turning personalization off sends none of this.
