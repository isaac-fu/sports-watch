# Sports Watch

Sports Watch is a personalized NBA companion: follow the teams and players you care about, see a focused feed, monitor a live game, and catch up on what you missed.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the production checks locally with:

```bash
npm test
npm run lint
npm run build
```

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
- BALLDONTLIE player profiles that paginate game logs across the current and prior regular seasons, plus provider-backed team records, conference rank, scoring, and opponent scoring.
- Clickable feed and team-news stories with related team/player context, safe publisher links, and account-specific save/unsave controls.
- Saved-story library backed by PostgreSQL with an in-memory local fallback, plus compact mobile navigation for every main section.
- High-value alert candidate generation for game starts, close games, final scores, and standout performances.
- Ranked, deduplicated alert delivery with PostgreSQL persistence, an in-memory fallback, an in-app inbox, and a Docker polling worker.
- Provider-backed canonical teams/players, news, and season-stat synchronization with PostgreSQL caching and automatic static/mock fallback.
- Email/password accounts with scrypt password hashing, revocable database sessions, HTTP-only cookies, and isolated preferences and alerts.
- Persistent, skippable new-account onboarding for initial teams, players, and alert choices; skipped accounts retain the popular cold-start experience.

Mock data remains the default so the full app runs without paid API credentials. Account preferences and synchronized content are persisted to PostgreSQL when the database is available, with in-memory fallbacks for local development.

## NBA.com stats through `nba_api`

Player and team statistics can be loaded without a BALLDONTLIE stats subscription by running the bundled Python `nba_api` service. The service resolves NBA.com IDs, rate-limits upstream requests, caches responses for 15 minutes by default, and exposes only normalized data to the Next.js app. Scheduled synchronization then stores the current season snapshot in PostgreSQL.

For Docker Compose, set these values in `.env` and start the stack:

```dotenv
CATALOG_DATA_PROVIDER=nba_api
STATS_DATA_PROVIDER=nba_api
```

```bash
docker compose up -d --build
```

Compose makes the service available to the web container at `http://nba-api:8000` and to the host at `http://localhost:8001`. Its health endpoint is `GET /health`. No NBA API key is required.

For `npm run dev` outside Docker, start the Python service separately and keep `NBA_API_SERVICE_URL=http://localhost:8001`:

```powershell
py -m venv .venv
.\.venv\Scripts\python -m pip install -r .\nba-api-service\requirements.txt
.\.venv\Scripts\python -m uvicorn app:app --app-dir .\nba-api-service --host 127.0.0.1 --port 8001
```

The catalog sync stores NBA identifiers under `providerIds.nba_api`. Player profiles use `PlayerCareerStats` and `CommonPlayerInfo`; their last-ten list merges `PlayerGameLog` data from the requested and previous seasons, then sorts by date. Team profiles use league standings and automatically fall back to the previous completed season when the requested season has no completed games yet. If the Python service or NBA.com fails, the existing application-level mock fallback remains active; BALLDONTLIE can be restored at any time with `STATS_DATA_PROVIDER=balldontlie`.

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
| `GET /api/ingestion/sync` | Latest catalog/news/stats synchronization results. |
| `POST /api/ingestion/sync` | Synchronize configured providers into the content cache; requires the data-sync worker token. |

The schedule screen reads from `GET /api/games`. The `alert-worker` polls the protected all-account alert processor every 30 seconds, while `data-sync-worker` refreshes the catalog, news, and stats every 15 minutes by default. Push-notification channels are still future work.

## Accounts and sessions

Guests can explore using a read-only demo profile with fixed Warriors/Curry favorites; saving, following, and alert mutations require an account. Registering creates an isolated account with empty team/player favorites and default alert settings. Passwords are stored as salted scrypt hashes; session cookies are HTTP-only and SameSite=Lax, and only SHA-256 session-token hashes are persisted. Login, registration, and password recovery endpoints are rate limited. Forgot-password emails use hashed, one-hour, single-use reset tokens; completing a reset verifies the email and revokes every existing session. Changing a password while signed in also revokes every session before requiring email verification again.

For local HTTP development, keep `AUTH_COOKIE_SECURE=false`. Set it to `true` behind HTTPS in a deployed environment. Replace `ALERT_WORKER_TOKEN` with a long random secret anywhere outside local development.

## Real NBA data provider

The games API now has a provider boundary. It uses the mock repository by default. For Docker Compose, copy `.env.example` to `.env`, add an API key, and set `SPORTS_DATA_PROVIDER=balldontlie`. For a non-Docker Next.js run, `.env.local` is also supported.

```powershell
Copy-Item .env.example .env
# edit .env and set BALLDONTLIE_API_KEY and SPORTS_DATA_PROVIDER=balldontlie
docker compose up -d --build
```

BALLDONTLIE requires an API key and exposes date-filtered NBA games through `/v1/games` plus play-by-play through `/v1/plays` for supported games. The adapter maps provider teams, statuses, scores, clocks, and plays into the app’s internal game-center model. If the configured real provider is unavailable, game-backed sections stay empty or use real news rather than exposing fabricated games. If live play-by-play is unavailable, the score still loads and the interface clearly reports that the timeline is unavailable; explicitly configured mock mode includes deterministic live and final-game timelines for local development.

## External news and stats

The data-sync worker can populate the same APIs and recommendation pipeline with external data. Configure any providers you have credentials for in `.env`:

```dotenv
NEWS_DATA_PROVIDER=rss-newsapi
NBA_RSS_FEED_URLS=https://www.espn.com/espn/rss/nba/news,https://www.cbssports.com/rss/headlines/nba
NEWS_API_KEY=your-newsapi-key
STATS_DATA_PROVIDER=nba_api
CATALOG_DATA_PROVIDER=nba_api
BALLDONTLIE_API_KEY=your-balldontlie-key
DATA_SYNC_WORKER_TOKEN=replace-with-a-long-random-secret
```

The catalog sync imports provider teams and active players, reconciles them to stable app IDs, and stores provider IDs in PostgreSQL. Existing curated artwork is retained; newly discovered `nba_api` teams and players receive NBA CDN logos and headshots automatically. NBA-focused RSS/Atom feeds are the primary news source, while NewsAPI.org is an optional secondary backfill when `NEWS_API_KEY` is configured. Feed failures are isolated, cross-source duplicates are removed, and every article passes through the NBA team/player classifier after the catalog is current. `NBA_RSS_FEED_URLS` accepts a comma-separated list, so publisher feeds can be changed without rebuilding the app. `nba_api` is the recommended stats/catalog option for local and beta use; BALLDONTLIE remains supported for games, catalog, and stats when the account tier exposes the necessary endpoints. Both stats adapters combine current and prior-season game logs to produce a true latest-10 list before a new season has enough games. If every live news source fails or returns no usable data, the last cached news remains available and other domains fall back to their static/mock dataset.

`POST /api/ingestion/sync` accepts the `x-worker-token` header. Docker Compose supplies `DATA_SYNC_WORKER_TOKEN` to both the web service and the sync worker; production deployments should replace the local default with a long random secret.
