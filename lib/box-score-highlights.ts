import type { GameBoxScore } from "./box-score";
import type { CatchUpMoment, Game, Preferences } from "./models";

const categories = ["points", "rebounds", "assists", "steals", "blocks"] as const;
const shooting = (value: string | null) => {
  const match = value?.match(/^(\d+)[–-](\d+)$/);
  return match ? { made: Number(match[1]), attempts: Number(match[2]) } : null;
};

export function boxScoreHighlights(game: Game, box: GameBoxScore | null, preferences: Preferences, limit = 3): CatchUpMoment[] {
  if (game.status === "scheduled") return [];
  const result: CatchUpMoment[] = [];
  if (game.homeScore !== undefined && game.awayScore !== undefined) {
    const margin = Math.abs(game.homeScore - game.awayScore);
    const leader = game.homeScore > game.awayScore ? game.home : game.away;
    const title = game.status === "final"
      ? margin ? `${leader.name} win by ${margin}` : "Final score tied"
      : margin ? `${leader.name} lead by ${margin}` : "Game tied";
    result.push({ id: `${game.id}:result`, title, detail: `${game.away.name} ${game.awayScore}, ${game.home.name} ${game.homeScore}. ${game.status === "final" ? "Final" : "In progress"}; ${margin}-point differential.`, reason: game.status === "final" ? "Final result" : "Live score", importanceScore: 100, source: "box-score" });
  }
  if (!box || box.gameId !== game.id || box.status !== "available") return result;
  const players = box.teams.flatMap((team) => team.players.map((player, index) => ({ player, team, index })));
  const gameHigh = Math.max(0, ...players.map(({ player }) => player.points ?? 0));
  const candidates = players.flatMap(({ player, team, index }) => {
    const values = categories.map((key) => player[key]);
    if (!values.some((value) => value !== null && value > 0)) return [];
    const doubles = values.filter((value) => value !== null && value >= 10).length;
    const filled = values.every((value) => value !== null && value >= 5);
    const feats: string[] = [];
    let priority = 0;
    if (doubles >= 4) { feats.push("quadruple-double"); priority = 1000; }
    else if (doubles >= 3) { feats.push("triple-double"); priority = 800; }
    if (filled) { feats.push("five-by-five stat line"); priority = Math.max(priority, 850); }
    if (doubles === 2) { feats.push("double-double"); priority = Math.max(priority, 400); }
    if (doubles < 2 && (player.points ?? 0) >= 20 && (player.assists ?? 0) >= 7 && (player.rebounds ?? 0) >= 7) {
      feats.push("all-around stat line"); priority = Math.max(priority, 350);
    }
    const thresholds = { points: 30, assists: 10, rebounds: 10, steals: 3, blocks: 3 };
    const exceptional = { points: 50, assists: 20, rebounds: 25, steals: 7, blocks: 7 };
    for (const key of categories) {
      const value = player[key];
      if (value !== null && value >= thresholds[key]) {
        feats.push(`${value} ${key}`);
        priority = Math.max(priority, value >= exceptional[key] ? 700 + value : 250 + value);
      }
    }
    const fg = shooting(player.fieldGoals), three = shooting(player.threePointers), ft = shooting(player.freeThrows);
    for (const [split, name, minimum] of [[fg, "FG", 8], [three, "3PT", 5], [ft, "FT", 8]] as const) {
      if (split && split.attempts >= minimum && split.made === split.attempts) {
        feats.push(`${split.made}/${split.attempts} ${name} (100%)`);
        priority = Math.max(priority, 300 + split.made);
      }
    }
    if (fg && fg.attempts >= 15 && fg.made / fg.attempts >= .7) { feats.push(`${Math.round(fg.made / fg.attempts * 100)}% FG on ${fg.attempts} shots`); priority = Math.max(priority, 280); }
    if (three && three.made >= 6) { feats.push(`${three.made} made threes`); priority = Math.max(priority, 280 + three.made); }
    const highs = categories.filter((key) => ["points", "assists", "rebounds"].includes(key) && (player[key] ?? 0) > 0 && (key === "points" || (player[key] ?? 0) >= 7) && player[key] === Math.max(...team.players.map((row) => row[key] ?? 0)));
    if (!feats.length && !highs.length) return [];
    const pointLead = highs.includes("points") ? (player.points === gameHigh ? "game-leading scorer" : `${team.name} top scorer`) : "";
    const leading = highs.filter((key) => key !== "points").map((key) => `team-leading ${player[key]} ${key}`);
    const caption = feats.length ? feats.join(" · ") : [pointLead, ...leading].filter(Boolean).join(" · ");
    const statLine = categories.filter((key) => player[key] !== null).map((key) => `${player[key]} ${key}`).join(", ");
    const splits = ([['FG', player.fieldGoals], ['3PT', player.threePointers], ['FT', player.freeThrows]] as const).filter(([, value]) => value !== null).map(([name, value]) => `${name} ${value}`).join("; ");
    const followed = preferences.followedPlayerIds.includes(player.playerId ?? "") ? 2 : preferences.followedTeamIds.includes(team.teamId) ? 1 : 0;
    return [{ priority: priority || 100 + (player.points ?? 0), followed, moment: {
      id: `${game.id}:player:${team.teamId}:${player.playerId ?? index}`, title: `${player.name}: ${caption}`,
      detail: `${player.name} (${team.name}) recorded ${statLine}.${splits ? ` Shooting: ${splits}.` : ""}${pointLead && feats.length ? ` ${pointLead}.` : ""}${game.status === "live" ? " Stats are in progress." : ""}`,
      reason: feats.length ? "Standout box-score performance" : "Team statistical leader", importanceScore: Math.min(99, Math.round((priority || 100) / 10) + 30), source: "box-score" as const,
    } }];
  });
  candidates.sort((a, b) => b.priority - a.priority || b.followed - a.followed || a.moment.id.localeCompare(b.moment.id));
  return [...result, ...candidates.map((candidate) => candidate.moment)].slice(0, limit);
}
