# Sports Watch / Courtside

Courtside is the first vertical slice of a personalized NBA companion: follow the teams and players you care about, see a focused feed, monitor a live game, and catch up on what you missed.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Run with Docker

```bash
docker compose up -d --build
```

The web app will be available at [http://localhost:3000](http://localhost:3000). The Compose file runs the web app and PostgreSQL. Ingestion, live updates, and alert workers remain future services.

## Current slice

- Personalized home feed with game, performance, injury, and storyline cards ranked by followed teams, followed players, and freshness.
- Recommendation explanations and relevance scores so users can see why each item appears.
- Schedule view with a current-month-through-June calendar, followed-team filtering, selected-day details, and day/week/month soonest-game views.
- Live game center card with a sample in-progress matchup.
- “Catch me up” recap modal with the three moments that decided the game.
- Team and player preference management that saves through the API and immediately refreshes the feed and schedule.
- High-value alert toggles for game start, close games, final scores, and standout performances.

The current feed, stats, and news data are intentionally local mock data. Account preferences are persisted to PostgreSQL when the database is available, with an in-memory fallback for local development.

## MVP API surface

The backend seam is implemented as Next.js route handlers. Preferences use PostgreSQL when configured, and the games route can use either the local mock provider or an external NBA provider.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service health check. |
| `GET /api/account` | Current account profile. |
| `GET /api/catalog` | Teams and players available for personalization. |
| `GET /api/preferences` | Followed teams, players, and alert settings. |
| `PATCH /api/preferences` | Update followed IDs or alert settings. |
| `GET /api/games` | Upcoming games; supports `teamId`, `from`, and `to`. |
| `GET /api/stats` | Current-season player and team stats; supports `teamId` and `playerId`. |
| `GET /api/news` | Latest articles; supports `teamId`, `playerId`, and `q`. |
| `GET /api/feed` | Ranked personalized feed with relevance scores and recommendation reasons; supports `limit`. |

The schedule screen currently reads from `GET /api/games`. Authentication, external stats/news providers, and background synchronization are still future work.

## Real NBA data provider

The games API now has a provider boundary. It uses the mock repository by default. For Docker Compose, copy `.env.example` to `.env`, add an API key, and set `SPORTS_DATA_PROVIDER=balldontlie`. For a non-Docker Next.js run, `.env.local` is also supported.

```powershell
Copy-Item .env.example .env
# edit .env and set BALLDONTLIE_API_KEY and SPORTS_DATA_PROVIDER=balldontlie
docker compose up -d --build
```

BALLDONTLIE requires an API key and exposes date-filtered NBA games through its `/v1/games` endpoint. The adapter maps provider teams and statuses into the app’s internal game model. Stats and news remain separate provider seams because their coverage, plan requirements, and content rights need to be evaluated independently.
