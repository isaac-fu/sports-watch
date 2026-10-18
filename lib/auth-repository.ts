import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Account, Preferences } from "./models";
import { getDbPool } from "./db";
import { appStore, createDefaultPreferences, demoAccountId } from "./store";

const scrypt = promisify(scryptCallback);
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

type MemoryCredential = { account: Account; passwordHash: string };
type MemorySession = { accountId: string; expiresAt: number };
type AuthMemory = { credentials: Map<string, MemoryCredential>; sessions: Map<string, MemorySession>; completedOnboarding: Set<string> };

declare global {
  var __courtsideAuthMemory: AuthMemory | undefined;
  var __courtsideAuthTables: Promise<void> | undefined;
}

const memory: AuthMemory = globalThis.__courtsideAuthMemory ?? (globalThis.__courtsideAuthMemory = {
  credentials: new Map(),
  sessions: new Map(),
  completedOnboarding: new Set([demoAccountId]),
});
memory.completedOnboarding ??= new Set([demoAccountId]);

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function ensureAuthTables() {
  const pool = getDbPool();
  if (!pool) return null;
  if (!globalThis.__courtsideAuthTables) {
    globalThis.__courtsideAuthTables = pool.query(`
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;
      UPDATE accounts SET onboarding_completed=TRUE WHERE id='account-demo';
      CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_lower_idx ON accounts (LOWER(email));
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_account_idx ON auth_sessions (account_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
    `).then(() => undefined).catch((error) => {
      globalThis.__courtsideAuthTables = undefined;
      throw error;
    });
  }
  await globalThis.__courtsideAuthTables;
  return pool;
}

const accountFromRow = (row: Record<string, unknown>): Account => ({
  id: String(row.id),
  displayName: String(row.display_name),
  email: String(row.email),
  timezone: String(row.timezone),
  createdAt: new Date(String(row.created_at)).toISOString(),
});

export class DuplicateEmailError extends Error {}

export async function registerAccount(input: { displayName: string; email: string; password: string; timezone: string }) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const account: Account = {
    id: randomUUID(),
    displayName: input.displayName.trim(),
    email,
    timezone: input.timezone,
    createdAt: new Date().toISOString(),
  };
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT 1 FROM accounts WHERE LOWER(email)=LOWER($1)", [email]);
      if (existing.rowCount) throw new DuplicateEmailError("An account already exists for this email.");
      await client.query("INSERT INTO accounts (id, display_name, email, timezone, created_at, password_hash) VALUES ($1,$2,$3,$4,$5,$6)",
        [account.id, account.displayName, account.email, account.timezone, account.createdAt, passwordHash]);
      const preferences = createDefaultPreferences();
      await client.query("INSERT INTO account_preferences (account_id, followed_team_ids, followed_player_ids, alerts) VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb)",
        [account.id, JSON.stringify(preferences.followedTeamIds), JSON.stringify(preferences.followedPlayerIds), JSON.stringify(preferences.alerts)]);
      await client.query("COMMIT");
      return account;
    } catch (error) {
      await client.query("ROLLBACK");
      if (error instanceof DuplicateEmailError || (error as { code?: string }).code === "23505") throw new DuplicateEmailError("An account already exists for this email.");
      throw error;
    } finally { client.release(); }
  }
  if (memory.credentials.has(email)) throw new DuplicateEmailError("An account already exists for this email.");
  memory.credentials.set(email, { account, passwordHash });
  return account;
}

export async function authenticateAccount(emailInput: string, password: string): Promise<Account | null> {
  const email = normalizeEmail(emailInput);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const result = await pool.query("SELECT id, display_name, email, timezone, created_at, password_hash FROM accounts WHERE LOWER(email)=LOWER($1)", [email]);
    const row = result.rows[0];
    if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) return null;
    return accountFromRow(row);
  }
  const credential = memory.credentials.get(email);
  return credential && await verifyPassword(password, credential.passwordHash) ? credential.account : null;
}

export async function createSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    await pool.query("DELETE FROM auth_sessions WHERE expires_at <= NOW()");
    await pool.query("INSERT INTO auth_sessions (token_hash, account_id, expires_at) VALUES ($1,$2,$3)", [tokenHash, accountId, expiresAt]);
  } else memory.sessions.set(tokenHash, { accountId, expiresAt: expiresAt.getTime() });
  return { token, expiresAt };
}

export async function resolveSession(token: string): Promise<Account | null> {
  const tokenHash = hashToken(token);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const result = await pool.query(`
      SELECT a.id, a.display_name, a.email, a.timezone, a.created_at
      FROM auth_sessions s JOIN accounts a ON a.id=s.account_id
      WHERE s.token_hash=$1 AND s.expires_at > NOW()
    `, [tokenHash]);
    return result.rows[0] ? accountFromRow(result.rows[0]) : null;
  }
  const session = memory.sessions.get(tokenHash);
  if (!session || session.expiresAt <= Date.now()) {
    memory.sessions.delete(tokenHash);
    return null;
  }
  if (session.accountId === demoAccountId) return appStore.account;
  return Array.from(memory.credentials.values()).find(({ account }) => account.id === session.accountId)?.account ?? null;
}

export async function deleteSession(token: string) {
  const tokenHash = hashToken(token);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    await pool.query("DELETE FROM auth_sessions WHERE token_hash=$1", [tokenHash]);
  } else memory.sessions.delete(tokenHash);
}

export async function listAccountIds() {
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const result = await pool.query("SELECT id FROM accounts ORDER BY created_at");
    return result.rows.map((row) => String(row.id));
  }
  return [demoAccountId, ...Array.from(memory.credentials.values()).map(({ account }) => account.id)];
}

export async function getOnboardingCompleted(accountId: string) {
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const result = await pool.query("SELECT onboarding_completed FROM accounts WHERE id=$1", [accountId]);
    return Boolean(result.rows[0]?.onboarding_completed);
  }
  return memory.completedOnboarding.has(accountId);
}

export async function completeAccountOnboarding(accountId: string, preferences: Preferences) {
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO account_preferences (account_id, followed_team_ids, followed_player_ids, alerts, updated_at)
        VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,NOW())
        ON CONFLICT (account_id) DO UPDATE SET followed_team_ids=EXCLUDED.followed_team_ids,
          followed_player_ids=EXCLUDED.followed_player_ids, alerts=EXCLUDED.alerts, updated_at=NOW()
      `, [accountId, JSON.stringify(preferences.followedTeamIds), JSON.stringify(preferences.followedPlayerIds), JSON.stringify(preferences.alerts)]);
      const result = await client.query("UPDATE accounts SET onboarding_completed=TRUE WHERE id=$1 RETURNING id", [accountId]);
      if (!result.rowCount) throw new Error("Account not found.");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } else memory.completedOnboarding.add(accountId);
}
