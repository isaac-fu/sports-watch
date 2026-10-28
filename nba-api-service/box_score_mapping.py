from typing import Any


def normalize_box_line(row: dict[str, Any], name: str) -> dict[str, Any]:
    def numeric(key: str) -> int | None:
        value = row.get(key)
        return int(float(value)) if value is not None and str(value).strip() else None

    def shooting(made: str, attempted: str) -> str | None:
        m, a = numeric(made), numeric(attempted)
        return f"{m}-{a}" if m is not None and a is not None else None

    return {
        "name": name, "minutes": row.get("minutes") or None, "comment": row.get("comment") or "",
        "points": numeric("points"), "rebounds": numeric("reboundsTotal"), "assists": numeric("assists"),
        "steals": numeric("steals"), "blocks": numeric("blocks"), "turnovers": numeric("turnovers"),
        "fouls": numeric("foulsPersonal"), "plusMinus": numeric("plusMinusPoints"),
        "fieldGoals": shooting("fieldGoalsMade", "fieldGoalsAttempted"),
        "threePointers": shooting("threePointersMade", "threePointersAttempted"),
        "freeThrows": shooting("freeThrowsMade", "freeThrowsAttempted"),
        "freeThrowsMade": numeric("freeThrowsMade"),
    }
