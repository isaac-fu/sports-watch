import type { Game, GameCenter, GameEvent } from "@/lib/models";
import { getNbaProvider } from "@/lib/providers";
import type { NbaProvider } from "@/lib/providers/types";
import { loadCatalog } from "@/lib/catalog-repository";

const parseClockSeconds = (clock: string) => {
  const match = /^(\d+):(\d{2})$/.exec(clock);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

function rankEvents(game: Game, events: GameEvent[]) {
  const chronological = [...events].sort((a, b) => a.sequence - b.sequence);
  return chronological.map((event, index) => {
    const previous = chronological[index - 1];
    const margin = event.homeScore === undefined || event.awayScore === undefined ? null : Math.abs(event.homeScore - event.awayScore);
    const previousMargin = previous?.homeScore === undefined || previous.awayScore === undefined ? null : previous.homeScore - previous.awayScore;
    const currentMargin = event.homeScore === undefined || event.awayScore === undefined ? null : event.homeScore - event.awayScore;
    const leadChanged = previousMargin !== null && currentMargin !== null && previousMargin !== 0 && currentMargin !== 0 && Math.sign(previousMargin) !== Math.sign(currentMargin);
    const clockSeconds = parseClockSeconds(event.clock);
    let score = 8;

    if (event.scoringPlay) score += 18 + (event.scoreValue ?? 0) * 3;
    if (event.type === "injury") score += 64;
    if (event.type === "milestone") score += 52;
    if (event.type === "turnover") score += 12;
    if (event.type === "period") score += event.clock === "00:00" ? 10 : 2;
    if (event.period >= 4) score += 18;
    if (margin !== null && margin <= 5) score += 20;
    if (margin === 0) score += 14;
    if (leadChanged) score += 24;
    if (event.period >= 4 && clockSeconds !== null && clockSeconds <= 300) score += 18;
    if (/game-winner|go-ahead|ahead for good|ties? the game|overtime/i.test(event.description)) score += 20;
    if (event.sequence === chronological.at(-1)?.sequence && game.status === "live") score += 5;

    return { ...event, importanceScore: Math.min(100, score) };
  });
}

async function loadFromProvider(provider: NbaProvider, gameId: string) {
  const game = await provider.getGame(gameId);
  if (!game) return null;
  let events: GameEvent[] = [];
  let eventsAvailable = true;
  try {
    events = await provider.getGameEvents(gameId);
  } catch {
    eventsAvailable = false;
  }
  return { game, events, eventsAvailable };
}

export async function getGameCenter(gameId: string): Promise<GameCenter | null> {
  await loadCatalog();
  const provider = getNbaProvider();
  let loaded;

  try {
    loaded = await loadFromProvider(provider, gameId);
  } catch {
    loaded = null;
  }
  if (!loaded) return null;

  const events = rankEvents(loaded.game, loaded.events);
  const keyMoments = [...events]
    .filter((event) => event.type !== "play" && event.importanceScore >= 35)
    .sort((a, b) => b.importanceScore - a.importanceScore || b.sequence - a.sequence)
    .slice(0, 3);

  return {
    game: loaded.game,
    events,
    keyMoments,
    updatedAt: loaded.game.updatedAt ?? new Date().toISOString(),
    source: provider.name,
    playByPlayStatus: !loaded.eventsAvailable ? "unavailable" : loaded.game.status === "scheduled" && events.length === 0 ? "pending" : events.length > 0 ? "available" : "unavailable",
  };
}
