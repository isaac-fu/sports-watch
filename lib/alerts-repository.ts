import { randomUUID } from "crypto";
import type { AlertCandidate, AlertType, DeliveredAlert } from "./models";
import { getDbPool } from "./db";
import { demoAccountId } from "./store";

declare global { var __courtsideAlertDeliveriesByAccount: Record<string, DeliveredAlert[]> | undefined; }

const memoryDeliveriesByAccount = globalThis.__courtsideAlertDeliveriesByAccount ?? (globalThis.__courtsideAlertDeliveriesByAccount = {});
const memoryFor = (accountId: string) => memoryDeliveriesByAccount[accountId] ?? (memoryDeliveriesByAccount[accountId] = []);

async function ensureTable() {
  const pool = getDbPool();
  if (!pool) return null;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alert_deliveries (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      candidate_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      priority INTEGER NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL,
      game_id TEXT,
      team_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      player_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      UNIQUE (account_id, candidate_id)
    )
  `);
  return pool;
}

function mapRow(row: Record<string, unknown>): DeliveredAlert {
  return {
    id: String(row.id),
    candidateId: String(row.candidate_id),
    type: String(row.alert_type) as AlertType,
    title: String(row.title),
    body: String(row.body),
    priority: Number(row.priority),
    occurredAt: new Date(String(row.occurred_at)).toISOString(),
    gameId: row.game_id ? String(row.game_id) : undefined,
    teamIds: row.team_ids as string[],
    playerIds: row.player_ids as string[],
    read: Boolean(row.read_at),
    deliveredAt: new Date(String(row.delivered_at)).toISOString(),
    readAt: row.read_at ? new Date(String(row.read_at)).toISOString() : null,
  };
}

function deliverToMemory(accountId: string, candidates: AlertCandidate[]) {
  const memoryDeliveries = memoryFor(accountId);
  const inserted: DeliveredAlert[] = [];
  for (const candidate of candidates) {
    if (memoryDeliveries.some((delivery) => delivery.candidateId === candidate.candidateId)) continue;
    const delivery: DeliveredAlert = { ...candidate, id: randomUUID(), read: false, deliveredAt: new Date().toISOString(), readAt: null };
    memoryDeliveries.push(delivery);
    inserted.push(delivery);
  }
  return inserted;
}

export async function deliverAlertCandidates(accountId: string, candidates: AlertCandidate[]) {
  if (accountId === demoAccountId) return [];
  try {
    const pool = await ensureTable();
    if (!pool) return deliverToMemory(accountId, candidates);
    const inserted: DeliveredAlert[] = [];
    for (const candidate of candidates) {
      const result = await pool.query(`
        INSERT INTO alert_deliveries (id, account_id, candidate_id, alert_type, title, body, priority, occurred_at, game_id, team_ids, player_ids)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb)
        ON CONFLICT (account_id, candidate_id) DO NOTHING
        RETURNING *
      `, [randomUUID(), accountId, candidate.candidateId, candidate.type, candidate.title, candidate.body, candidate.priority, candidate.occurredAt, candidate.gameId ?? null, JSON.stringify(candidate.teamIds), JSON.stringify(candidate.playerIds)]);
      if (result.rows[0]) inserted.push(mapRow(result.rows[0]));
    }
    return inserted;
  } catch {
    return deliverToMemory(accountId, candidates);
  }
}

export async function listDeliveredAlerts(accountId: string) {
  if (accountId === demoAccountId) return [];
  try {
    const pool = await ensureTable();
    if (!pool) return [...memoryFor(accountId)].sort((left, right) => right.priority - left.priority || right.deliveredAt.localeCompare(left.deliveredAt));
    const result = await pool.query("SELECT * FROM alert_deliveries WHERE account_id = $1 ORDER BY read_at NULLS FIRST, priority DESC, delivered_at DESC LIMIT 50", [accountId]);
    return result.rows.map(mapRow);
  } catch {
    return [...memoryFor(accountId)].sort((left, right) => right.priority - left.priority || right.deliveredAt.localeCompare(left.deliveredAt));
  }
}

export async function markAlertsRead(accountId: string, id?: string) {
  if (accountId === demoAccountId) return [];
  const readAt = new Date().toISOString();
  try {
    const pool = await ensureTable();
    if (!pool) throw new Error("memory fallback");
    const result = id
      ? await pool.query("UPDATE alert_deliveries SET read_at = COALESCE(read_at, NOW()) WHERE account_id = $1 AND id = $2 RETURNING *", [accountId, id])
      : await pool.query("UPDATE alert_deliveries SET read_at = COALESCE(read_at, NOW()) WHERE account_id = $1 AND read_at IS NULL RETURNING *", [accountId]);
    return result.rows.map(mapRow);
  } catch {
    const updated: DeliveredAlert[] = [];
    for (const delivery of memoryFor(accountId)) {
      if ((!id || delivery.id === id) && !delivery.read) {
        delivery.read = true;
        delivery.readAt = readAt;
        updated.push(delivery);
      }
    }
    return updated;
  }
}
