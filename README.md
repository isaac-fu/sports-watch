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

The web app will be available at [http://localhost:3000](http://localhost:3000). Compose runs the web app, PostgreSQL, the alert worker, and the news/stats synchronization worker.

## Current slice

- Personalized home feed with game, performance, injury, and storyline cards ranked by followed teams, followed players, and freshness.
- Recommendation explanations and relevance scores so users can see why each item appears.
- Separate candidate-generation and ranking modules for feed, team discovery, and player discovery.
- Cold-start popularity ranking for news, teams, players, and games when an account has no favorites; personalization takes over after the first follow.
- Eight-slot team/player discovery: personalized candidates are ranked first and remaining slots are filled from current coverage and high-visibility-game popularity signals.
- Schedule view with a current-month-through-June calendar, followed-team filtering, selected-day details, and day/week/month soonest-game views.
- Selectable game center with a live scoreboard, chronological play-by-play, ranked key moments, and 15-second in-view refreshes.
- Event-driven “Catch me up” briefs built from personalized play-by-play moments, with score-aware live/final summaries and news fallback when no timeline is available.
- Team and player preference management that saves through the API and immediately refreshes the feed and schedule.
- Separate My teams and My players screens, each with ranked discovery suggestions and recommendation reasons.
- Clickable team profiles with current record and efficiency metrics, roster links, relevant news, and recent/upcoming games that open in the game center.
- Clickable player profiles with team and bio information, current-season averages, weighted regular-season career averages, season history, and last-10 box scores.
- Clickable feed and team-news stories with related team/player context, safe publisher links, and account-specific save/unsave controls.
- Saved-story library backed by PostgreSQL with an in-memory local fallback, plus compact mobile navigation for every main section.
- High-value alert candidate generation for game starts, close games, final scores, and standout performances.
- Ranked, deduplicated alert delivery with PostgreSQL persistence, an in-memory fallback, an in-app inbox, and a Docker polling worker.
- Provider-backed news and season-stat synchronization with PostgreSQL caching and automatic mock fallback.
- Email/password accounts with scrypt password hashing, revocable database sessions, HTTP-only cookies, and isolated preferences and alerts.
- Persistent, skippable new-account onboarding for initial teams, players, and alert choices; skipped accounts retain the popular cold-start experience.

Mock data remains the default so the full app runs without paid API credentials. Account preferences and synchronized content are persisted to PostgreSQL when the database is available, with in-memory fallbacks for local development.

## MVP API surface

The backend seam is implemented as Next.js route handlers. Preferences use PostgreSQL when configured, and the games route can use either the local mock provider or an external NBA provider.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Service health check. |
| `GET /api/account` | Current account profile. |
| `POST /api/auth/register` | Create an account and begin a session. |
| `POST /api/auth/login` | Authenticate and begin a session. |
| `POST /api/auth/logout` | Revoke the current session. |
| `POST /api/onboarding` | Atomically save initial preferences and mark onboarding complete. |
| `GET /api/catalog` | Teams and players available for personalization. |
| `GET /api/catch-up` | Personalized recent/live game brief; accepts `gameId` for a specific live or final game and falls back to ranked news when play-by-play is unavailable. |
| `GET /api/alerts` | Delivered alert inbox and unread count. |
| `POST /api/alerts` | Generate, rank, and deduplicate current alert candidates. |
| `POST /api/alerts/process` | Internal worker endpoint that processes alerts for every account. |
| `PATCH /api/alerts` | Mark one or all delivered alerts as read. |
| `GET /api/preferences` | Followed teams, players, and alert settings. |
| `PATCH /api/preferences` | Update followed IDs or alert settings. |
| `GET /api/games` | Upcoming games; supports `teamId`, `from`, and `to`. |
| `GET /api/games/:id` | One game center with current score, play-by-play, and up to three ranked key moments. |
| `GET /api/teams/:id` | Team profile with season performance, roster, relevant news, and recent/upcoming games. |
| `GET /api/players/:id` | Player profile with current season, career history, and last-10 game logs. |
| `GET /api/stats` | Current-season player and team stats; supports `teamId` and `playerId`. |
| `GET /api/news` | Latest articles; supports `teamId`, `playerId`, and `q`. |
| `GET /api/news/:id` | One synchronized news article with its team/player tags and publisher URL. |
| `GET /api/saved/articles` | Saved stories for the current account. |
| `POST /api/saved/articles` | Save a current article by `articleId`. |
| `DELETE /api/saved/articles?articleId=:id` | Remove a story from the current account's library. |
| `GET /api/feed` | Ranked personalized feed with relevance scores and recommendation reasons; supports `limit`. |
| `GET /api/recommendations/discovery` | Ranked team and player suggestions based on favorites, upcoming opponents, and current stories. |
| `GET /api/ingestion/sync` | Latest news/stats synchronization results. |
| `POST /api/ingestion/sync` | Synchronize configured providers into the content cache. |

The schedule screen reads from `GET /api/games`. The `alert-worker` polls the protected all-account alert processor every 30 seconds, while `data-sync-worker` refreshes news and stats every 15 minutes by default. Push-notification channels are still future work.

## Accounts and sessions

Guests can explore using the shared demo profile. Registering creates an isolated account with empty team/player favorites and default alert settings. Passwords are stored as salted scrypt hashes; session cookies are HTTP-only and SameSite=Lax, and only SHA-256 session-token hashes are persisted.

For local HTTP development, keep `AUTH_COOKIE_SECURE=false`. Set it to `true` behind HTTPS in a deployed environment. Replace `ALERT_WORKER_TOKEN` with a long random secret anywhere outside local development.

## Real NBA data provider

The games API now has a provider boundary. It uses the mock repository by default. For Docker Compose, copy `.env.example` to `.env`, add an API key, and set `SPORTS_DATA_PROVIDER=balldontlie`. For a non-Docker Next.js run, `.env.local` is also supported.

```powershell
Copy-Item .env.example .env
# edit .env and set BALLDONTLIE_API_KEY and SPORTS_DATA_PROVIDER=balldontlie
docker compose up -d --build
```

BALLDONTLIE requires an API key and exposes date-filtered NBA games through `/v1/games` plus play-by-play through `/v1/plays` for supported games. The adapter maps provider teams, statuses, scores, clocks, and plays into the app’s internal game-center model. If live play-by-play is unavailable, the score still loads and the interface clearly reports that the timeline is unavailable; mock mode includes deterministic live and final-game timelines for local development.

## External news and stats

The data-sync worker can populate the same APIs and recommendation pipeline with external data. Configure any providers you have credentials for in `.env`:

```dotenv
NEWS_DATA_PROVIDER=newsapi
NEWS_API_KEY=your-newsapi-key
STATS_DATA_PROVIDER=balldontlie
BALLDONTLIE_API_KEY=your-balldontlie-key
```

NewsAPI articles are tagged to known teams and players before they are cached. BALLDONTLIE season averages are mapped to the app's player model; team aggregates remain the local MVP dataset for now. If either provider fails or returns no usable data, that domain falls back to mock data and records the fallback in `GET /api/ingestion/sync`.
