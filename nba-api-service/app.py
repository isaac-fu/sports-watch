from __future__ import annotations

import math
import os
import re
import threading
import time
import unicodedata
from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import Body, FastAPI, HTTPException
from nba_api.stats.endpoints import (
    commonallplayers,
    commonplayerinfo,
    leaguedashplayerstats,
    leaguegamelog,
    leaguestandingsv3,
    playercareerstats,
    playergamelog,
)
from nba_api.stats.static import teams as static_teams


app = FastAPI(title="Sports Watch nba_api provider", version="1.0.0")


def _positive_float(name: str, fallback: float) -> float:
    try:
        value = float(os.getenv(name, str(fallback)))
        return value if value > 0 else fallback
    except ValueError:
        return fallback


CACHE_TTL_SECONDS = _positive_float("NBA_API_CACHE_TTL_SECONDS", 900)
REQUEST_TIMEOUT_SECONDS = _positive_float("NBA_API_REQUEST_TIMEOUT_SECONDS", 30)
MIN_REQUEST_INTERVAL_SECONDS = _positive_float("NBA_API_MIN_REQUEST_INTERVAL_SECONDS", 0.7)


class TtlCache:
    def __init__(self, ttl_seconds: float):
        self.ttl_seconds = ttl_seconds
        self.values: dict[str, tuple[float, Any]] = {}
        self.lock = threading.RLock()

    def get_or_load(self, key: str, loader: Callable[[], Any]) -> Any:
        now = time.monotonic()
        with self.lock:
            cached = self.values.get(key)
            if cached and cached[0] > now:
                return cached[1]
            value = loader()
            self.values[key] = (time.monotonic() + self.ttl_seconds, value)
            return value


cache = TtlCache(CACHE_TTL_SECONDS)
request_lock = threading.Lock()
last_request_at = 0.0


def _nba_request(loader: Callable[[], Any]) -> Any:
    global last_request_at
    error: Exception | None = None
    for attempt in range(3):
        try:
            with request_lock:
                wait_for = MIN_REQUEST_INTERVAL_SECONDS - (time.monotonic() - last_request_at)
                if wait_for > 0:
                    time.sleep(wait_for)
                try:
                    return loader()
                finally:
                    last_request_at = time.monotonic()
        except Exception as exc:  # NBA.com intermittently times out or throttles requests.
            error = exc
            if attempt < 2:
                time.sleep(1.5 * (attempt + 1))
    raise error or RuntimeError("NBA.com request failed")


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if hasattr(value, "item"):
        return _clean(value.item())
    return value


def _records(data_set: Any) -> list[dict[str, Any]]:
    return [{str(key): _clean(value) for key, value in row.items()} for row in data_set.get_data_frame().to_dict("records")]


def _cached_records(key: str, loader: Callable[[], Any]) -> list[dict[str, Any]]:
    return cache.get_or_load(key, lambda: _records(_nba_request(loader)))


def _season_label(season: int) -> str:
    return f"{season}-{(season + 1) % 100:02d}"


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    return re.sub(r"[^a-z0-9]+", " ", "".join(char for char in text if not unicodedata.combining(char)).lower()).strip()


def _number(row: dict[str, Any], *keys: str, fallback: float = 0) -> float:
    for key in keys:
        value = row.get(key)
        if value is not None:
            try:
                result = float(value)
                if math.isfinite(result):
                    return result
            except (TypeError, ValueError):
                pass
    return fallback


def _integer(row: dict[str, Any], *keys: str, fallback: int = 0) -> int:
    return int(round(_number(row, *keys, fallback=fallback)))


def _rounded(value: float) -> float:
    return round(value, 1)


def _percentage(value: float) -> float:
    return _rounded(value * 100 if abs(value) <= 1 else value)


def _provider_id(entity: dict[str, Any]) -> int | None:
    provider_ids = entity.get("providerIds") or {}
    value = provider_ids.get("nba_api") or provider_ids.get("nba")
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _all_nba_teams() -> list[dict[str, Any]]:
    return static_teams.get_teams()


def _resolve_team(team: dict[str, Any]) -> dict[str, Any] | None:
    known_id = _provider_id(team)
    candidates = _all_nba_teams()
    if known_id is not None:
        match = next((candidate for candidate in candidates if int(candidate["id"]) == known_id), None)
        if match:
            return match
    short = str(team.get("short") or "").upper()
    name = _normalize(team.get("name"))
    return next((candidate for candidate in candidates if candidate.get("abbreviation") == short), None) or next(
        (candidate for candidate in candidates if _normalize(candidate.get("full_name")) == name), None
    )


def _common_players(season: int) -> list[dict[str, Any]]:
    label = _season_label(season)
    return _cached_records(
        f"common-all-players:{label}",
        lambda: commonallplayers.CommonAllPlayers(
            is_only_current_season=1,
            league_id="00",
            season=label,
            timeout=REQUEST_TIMEOUT_SECONDS,
        ).common_all_players,
    )


def _resolve_player(player: dict[str, Any], season: int) -> dict[str, Any] | None:
    rows: list[dict[str, Any]] = []
    for candidate_season in (season, season - 1):
        try:
            rows.extend(_common_players(candidate_season))
        except Exception:
            continue
    known_id = _provider_id(player)
    if known_id is not None:
        match = next((row for row in rows if _integer(row, "PERSON_ID") == known_id), None)
        if match:
            return match
    name = _normalize(player.get("name"))
    return next((row for row in rows if _normalize(row.get("DISPLAY_FIRST_LAST")) == name), None)


def _league_player_stats(season: int) -> list[dict[str, Any]]:
    label = _season_label(season)
    return _cached_records(
        f"league-player-stats:{label}",
        lambda: leaguedashplayerstats.LeagueDashPlayerStats(
            season=label,
            season_type_all_star="Regular Season",
            per_mode_detailed="PerGame",
            timeout=REQUEST_TIMEOUT_SECONDS,
        ).league_dash_player_stats,
    )


def _standings(season: int) -> list[dict[str, Any]]:
    label = _season_label(season)
    return _cached_records(
        f"standings:{label}",
        lambda: leaguestandingsv3.LeagueStandingsV3(
            league_id="00",
            season=label,
            season_type="Regular Season",
            timeout=REQUEST_TIMEOUT_SECONDS,
        ).standings,
    )


def _find_player_row(player: dict[str, Any], season: int, rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    known = _resolve_player(player, season)
    known_id = _integer(known, "PERSON_ID") if known else _provider_id(player)
    if known_id:
        match = next((row for row in rows if _integer(row, "PLAYER_ID") == known_id), None)
        if match:
            return match
    name = _normalize(player.get("name"))
    return next((row for row in rows if _normalize(row.get("PLAYER_NAME")) == name), None)


def _player_stat(player: dict[str, Any], season: int, row: dict[str, Any]) -> dict[str, Any]:
    return {
        "playerId": player["id"],
        "playerName": player["name"],
        "teamId": player["teamId"],
        "teamName": player["teamName"],
        "gamesPlayed": _integer(row, "GP"),
        "pointsPerGame": _rounded(_number(row, "PTS")),
        "reboundsPerGame": _rounded(_number(row, "REB")),
        "assistsPerGame": _rounded(_number(row, "AST")),
        "fieldGoalPercentage": _percentage(_number(row, "FG_PCT")),
        "threePointPercentage": _percentage(_number(row, "FG3_PCT")),
    }


def _team_stat(team: dict[str, Any], season: int, row: dict[str, Any]) -> dict[str, Any]:
    return {
        "teamId": team["id"],
        "teamName": team["name"],
        "season": season,
        "wins": _integer(row, "WINS", "W"),
        "losses": _integer(row, "LOSSES", "L"),
        "conferenceRank": _integer(row, "PlayoffRank", "ConferenceRank", "LeagueRank"),
        "pointsPerGame": _rounded(_number(row, "PointsPG", "PTS")),
        "pointsAllowedPerGame": _rounded(_number(row, "OppPointsPG", "OPP_PTS")),
    }


def _find_team_row(team: dict[str, Any], rows: list[dict[str, Any]]) -> dict[str, Any] | None:
    nba_team = _resolve_team(team)
    known_id = int(nba_team["id"]) if nba_team else _provider_id(team)
    if known_id:
        match = next((row for row in rows if _integer(row, "TeamID", "TEAM_ID") == known_id), None)
        if match:
            return match
    short = str(team.get("short") or "").upper()
    return next((row for row in rows if str(row.get("TeamAbbreviation") or row.get("TEAM_ABBREVIATION") or "").upper() == short), None)


def _season_stats(season: int, players: list[dict[str, Any]], teams: list[dict[str, Any]]) -> dict[str, Any]:
    player_rows = _league_player_stats(season)
    standing_rows = _standings(season)
    mapped_players = []
    for player in players:
        row = _find_player_row(player, season, player_rows)
        if row and _integer(row, "GP") > 0:
            mapped_players.append(_player_stat(player, season, row))
    mapped_teams = []
    for team in teams:
        row = _find_team_row(team, standing_rows)
        if row and _integer(row, "WINS", "W") + _integer(row, "LOSSES", "L") > 0:
            mapped_teams.append(_team_stat(team, season, row))
    return {"players": mapped_players, "teams": mapped_teams}


def _career_rows(player_id: int) -> list[dict[str, Any]]:
    return _cached_records(
        f"career:{player_id}",
        lambda: playercareerstats.PlayerCareerStats(
            player_id=player_id,
            per_mode36="PerGame",
            timeout=REQUEST_TIMEOUT_SECONDS,
        ).season_totals_regular_season,
    )


def _bio_row(player_id: int) -> dict[str, Any]:
    rows = _cached_records(
        f"player-info:{player_id}",
        lambda: commonplayerinfo.CommonPlayerInfo(player_id=player_id, timeout=REQUEST_TIMEOUT_SECONDS).common_player_info,
    )
    return rows[0] if rows else {}


def _select_career_row(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = next((row for row in rows if str(row.get("TEAM_ABBREVIATION") or "").upper() == "TOT"), None)
    if total or len(rows) == 1:
        return total or rows[0]
    games = sum(_integer(row, "GP") for row in rows)
    if games <= 0:
        return rows[-1]
    result = dict(rows[-1])
    result["GP"] = games
    for key in ("PTS", "REB", "AST", "STL", "BLK", "TOV", "FG_PCT", "FG3_PCT"):
        result[key] = sum(_number(row, key) * _integer(row, "GP") for row in rows) / games
    result["TEAM_ABBREVIATION"] = "TOT"
    return result


def _season_history(
    player: dict[str, Any],
    requested_season: int,
    rows: list[dict[str, Any]],
    teams: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    teams_by_short = {str(team.get("short") or "").upper(): team for team in teams}
    grouped: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        try:
            start = int(str(row.get("SEASON_ID") or "")[:4])
        except ValueError:
            continue
        if start <= requested_season:
            grouped.setdefault(start, []).append(row)
    seasons = []
    for season in sorted(grouped, reverse=True):
        row = _select_career_row(grouped[season])
        stat = _player_stat(player, season, row)
        historical_short = str(row.get("TEAM_ABBREVIATION") or "").upper()
        historical_team = teams_by_short.get(historical_short)
        if historical_team:
            stat["teamId"] = historical_team["id"]
            stat["teamName"] = historical_team["name"]
        elif historical_short == "TOT":
            stat["teamName"] = "Multiple teams"
        stat.update({
            "season": season,
            "seasonLabel": _season_label(season),
            "stealsPerGame": _rounded(_number(row, "STL")),
            "blocksPerGame": _rounded(_number(row, "BLK")),
            "turnoversPerGame": _rounded(_number(row, "TOV")),
        })
        seasons.append(stat)
    return seasons


def _career_summary(seasons: list[dict[str, Any]]) -> dict[str, Any] | None:
    played = [season for season in seasons if season["gamesPlayed"] > 0]
    games = sum(season["gamesPlayed"] for season in played)
    if games <= 0:
        return None
    latest = played[0]
    summary = {
        "playerId": latest["playerId"],
        "playerName": latest["playerName"],
        "gamesPlayed": games,
        "seasonsPlayed": len(played),
    }
    for key in (
        "pointsPerGame", "reboundsPerGame", "assistsPerGame", "stealsPerGame",
        "blocksPerGame", "turnoversPerGame", "fieldGoalPercentage", "threePointPercentage",
    ):
        summary[key] = _rounded(sum(season[key] * season["gamesPlayed"] for season in played) / games)
    return summary


def _player_game_rows(player_id: int, season: int) -> list[dict[str, Any]]:
    label = _season_label(season)
    return _cached_records(
        f"player-game-log:{player_id}:{label}",
        lambda: playergamelog.PlayerGameLog(
            player_id=player_id,
            season=label,
            season_type_all_star="Regular Season",
            timeout=REQUEST_TIMEOUT_SECONDS,
        ).player_game_log,
    )


def _league_game_rows(season: int) -> list[dict[str, Any]]:
    label = _season_label(season)
    return _cached_records(
        f"league-team-game-log:{label}",
        lambda: leaguegamelog.LeagueGameLog(
            player_or_team_abbreviation="T",
            season=label,
            season_type_all_star="Regular Season",
            sorter="DATE",
            direction="DESC",
            timeout=REQUEST_TIMEOUT_SECONDS,
        ).league_game_log,
    )


def _date_iso(value: Any) -> str:
    text = str(value or "").strip()
    for pattern in ("%Y-%m-%d", "%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(text.title(), pattern).date().isoformat()
        except ValueError:
            pass
    return text[:10]


def _last_ten(player_id: int, season: int, teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    team_names = {str(team.get("short") or "").upper(): team.get("name") for team in teams}
    combined: list[tuple[int, dict[str, Any]]] = []
    score_rows: dict[str, list[dict[str, Any]]] = {}
    for season_number in (season, season - 1):
        try:
            combined.extend((season_number, row) for row in _player_game_rows(player_id, season_number))
        except Exception:
            continue
        try:
            for row in _league_game_rows(season_number):
                score_rows.setdefault(str(row.get("GAME_ID") or ""), []).append(row)
        except Exception:
            pass
    combined.sort(key=lambda item: _date_iso(item[1].get("GAME_DATE")), reverse=True)
    games = []
    for season_number, row in combined[:10]:
        matchup = str(row.get("MATCHUP") or "")
        home = " vs. " in matchup
        parts = re.split(r"\s+(?:vs\.|@)\s+", matchup)
        own_short = parts[0].strip().upper() if parts else ""
        opponent_short = parts[-1].strip().upper() if len(parts) > 1 else "OPP"
        game_id = str(row.get("Game_ID") or row.get("GAME_ID") or "")
        game_scores = score_rows.get(game_id, [])
        own_score_row = next((item for item in game_scores if str(item.get("TEAM_ABBREVIATION") or "").upper() == own_short), None)
        opponent_score_row = next((item for item in game_scores if str(item.get("TEAM_ABBREVIATION") or "").upper() == opponent_short), None)
        score = "—"
        if own_score_row and opponent_score_row:
            score = f"{_integer(own_score_row, 'PTS')}-{_integer(opponent_score_row, 'PTS')}"
        result = str(row.get("WL") or "").upper()
        if result not in ("W", "L"):
            result = "W" if own_score_row and opponent_score_row and _number(own_score_row, "PTS") > _number(opponent_score_row, "PTS") else "L"
        minutes = _number(row, "MIN")
        games.append({
            "id": f"nba-api-{game_id}-{player_id}",
            "gameId": f"nba-{game_id}",
            "date": _date_iso(row.get("GAME_DATE")),
            "season": season_number,
            "opponentName": team_names.get(opponent_short, opponent_short),
            "opponentShort": opponent_short,
            "homeAway": "home" if home else "away",
            "result": result,
            "score": score,
            "minutes": str(int(minutes)) if minutes.is_integer() else str(_rounded(minutes)),
            "points": _integer(row, "PTS"),
            "rebounds": _integer(row, "REB"),
            "assists": _integer(row, "AST"),
            "steals": _integer(row, "STL"),
            "blocks": _integer(row, "BLK"),
            "turnovers": _integer(row, "TOV"),
            "fieldGoals": f"{_integer(row, 'FGM')}-{_integer(row, 'FGA')}",
            "threePointers": f"{_integer(row, 'FG3M')}-{_integer(row, 'FG3A')}",
            "plusMinus": _integer(row, "PLUS_MINUS"),
        })
    return games


def _optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@app.get("/health")
def health() -> dict[str, Any]:
    return {"status": "ok", "provider": "nba_api", "cacheTtlSeconds": CACHE_TTL_SECONDS}


@app.post("/v1/catalog")
def catalog(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    try:
        season = int(payload["season"])
        teams = [{"providerId": str(team["id"]), "name": team["full_name"], "short": team["abbreviation"]} for team in _all_nba_teams()]
        players = []
        player_rows: list[dict[str, Any]] = []
        for candidate_season in (season, season - 1):
            try:
                player_rows = _common_players(candidate_season)
                if player_rows:
                    break
            except Exception:
                continue
        for row in player_rows:
            team_id = _integer(row, "TEAM_ID")
            player_id = _integer(row, "PERSON_ID")
            name = str(row.get("DISPLAY_FIRST_LAST") or "").strip()
            if team_id and player_id and name and _integer(row, "ROSTERSTATUS", fallback=1) == 1:
                players.append({"providerId": str(player_id), "name": name, "position": "", "teamProviderId": str(team_id)})
        return {"teams": teams, "players": players}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"NBA catalog request failed: {exc}") from exc


@app.post("/v1/season-stats")
def season_stats(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    try:
        return _season_stats(int(payload["season"]), list(payload.get("players") or []), list(payload.get("teams") or []))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"NBA season stats request failed: {exc}") from exc


@app.post("/v1/team-stats")
def team_stats(payload: dict[str, Any] = Body(...)) -> dict[str, Any] | None:
    try:
        requested = int(payload["season"])
        team = dict(payload["team"])
        for season in (requested, requested - 1):
            try:
                row = _find_team_row(team, _standings(season))
            except Exception:
                continue
            if row and _integer(row, "WINS", "W") + _integer(row, "LOSSES", "L") > 0:
                return _team_stat(team, season, row)
        return None
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"NBA team stats request failed: {exc}") from exc


@app.post("/v1/player-profile")
def player_profile(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    try:
        season = int(payload["season"])
        player = dict(payload["player"])
        teams = list(payload.get("teams") or [])
        nba_player = _resolve_player(player, season)
        if not nba_player:
            raise ValueError(f"Could not resolve NBA player {player.get('name')}")
        player_id = _integer(nba_player, "PERSON_ID")
        seasons = _season_history(player, season, _career_rows(player_id), teams)
        bio_row = _bio_row(player_id)
        bio = {
            "height": bio_row.get("HEIGHT") or None,
            "weight": bio_row.get("WEIGHT") or None,
            "jerseyNumber": bio_row.get("JERSEY") or None,
            "college": bio_row.get("SCHOOL") or None,
            "country": bio_row.get("COUNTRY") or None,
            "draftYear": _optional_int(bio_row.get("DRAFT_YEAR")),
            "draftRound": _optional_int(bio_row.get("DRAFT_ROUND")),
            "draftNumber": _optional_int(bio_row.get("DRAFT_NUMBER")),
        }
        bio = {key: value for key, value in bio.items() if value is not None}
        return {
            "player": player,
            "bio": bio,
            "currentSeason": next((item for item in seasons if item["season"] == season), None),
            "career": _career_summary(seasons),
            "seasons": seasons,
            "lastTenGames": _last_ten(player_id, season, teams),
            "source": "nba_api",
            "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"NBA player profile request failed: {exc}") from exc
