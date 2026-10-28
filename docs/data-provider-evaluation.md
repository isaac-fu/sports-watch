# Live data provider evaluation

Updated: October 20, 2026

## SharpAPI

SharpAPI (`sharpapi.io`) is not a suitable replacement for the app's NBA game or play-by-play provider. Its published product and SDK are centered on sportsbook odds, line movement, expected-value opportunities, arbitrage, and related game-state metadata. It does not document a possession-level NBA play-by-play endpoint.

It may be useful later behind a separate `OddsProvider` if Sports Watch adds betting-market context, but it should not be connected to `NbaProvider` or used to generate game recaps.

Sources:

- https://sharpapi.io/
- https://github.com/Sharp-API
- https://www.npmjs.com/package/@sharp-api/client

## Recommended direction

- Keep BALLDONTLIE as the configured hosted provider for games and plays when an API key is available.
- If the project needs a second live-data path, extend the existing Python `nba_api` service with NBA live scoreboard and play-by-play endpoints, then map those payloads into the existing `Game` and `GameEvent` models.
- Never silently present repository mock events as live provider data. Mock events should remain an explicit demo-mode choice.

The `nba_api` project documents both stats play-by-play and NBA live-data support:

- https://github.com/swar/nba_api/blob/master/docs/nba_api/stats/endpoints/playbyplay.md
- https://github.com/swar/nba_api/tree/master/docs/nba_api/live
