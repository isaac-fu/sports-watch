import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Account, Preferences } from "./models";
import { getDbPool } from "./db";
import { appStore, createDefaultPreferences, demoAccountId } from "./store";

const scrypt = promisify(scryptCallback);
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

type MemoryCredential = { account: Account; passwordHash: string };
type MemorySession = { accountId: string; expiresAt: number };
type VerificationPurpose = "signup" | "password-change" | "password-reset";
type MemoryVerification = { accountId: string; purpose: VerificationPurpose; expiresAt: number };
type AuthMemory = { credentials: Map<string, MemoryCredential>; sessions: Map<string, MemorySession>; verifications: Map<string, MemoryVerification>; completedOnboarding: Set<string> };

declare global {
  var __courtsideAuthMemory: AuthMemory | undefined;
  var __courtsideAuthTables: Promise<void> | undefined;
}

const memory: AuthMemory = globalThis.__courtsideAuthMemory ?? (globalThis.__courtsideAuthMemory = {
  credentials: new Map(),
  sessions: new Map(),
  verifications: new Map(),
  completedOnboarding: new Set([demoAccountId]),
});
memory.completedOnboarding ??= new Set([demoAccountId]);
memory.verifications ??= new Map();

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
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
      UPDATE accounts SET onboarding_completed=TRUE WHERE id='account-demo';
      UPDATE accounts SET email_verified_at=COALESCE(email_verified_at, created_at) WHERE id='account-demo';
      CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_lower_idx ON accounts (LOWER(email));
      CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS auth_sessions_account_idx ON auth_sessions (account_id);
      CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
      CREATE TABLE IF NOT EXISTS email_verification_tokens (
        token_hash TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        purpose TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS email_verification_account_idx ON email_verification_tokens (account_id);
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
  emailVerified: Boolean(row.email_verified_at),
});

export class DuplicateEmailError extends Error {}
export class InvalidCurrentPasswordError extends Error {}
export class EmailNotVerifiedError extends Error {
  constructor(message: string, public account: Account) { super(message); }
}

export async function registerAccount(input: { displayName: string; email: string; password: string; timezone: string }) {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const account: Account = {
    id: randomUUID(),
    displayName: input.displayName.trim(),
    email,
    timezone: input.timezone,
    createdAt: new Date().toISOString(),
    emailVerified: false,
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
    const result = await pool.query("SELECT id, display_name, email, timezone, created_at, email_verified_at, password_hash FROM accounts WHERE LOWER(email)=LOWER($1)", [email]);
    const row = result.rows[0];
    if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) return null;
    const account = accountFromRow(row);
    if (!row.email_verified_at) throw new EmailNotVerifiedError("Verify your email before signing in.", account);
    return account;
  }
  const credential = memory.credentials.get(email);
  if (!credential || !(await verifyPassword(password, credential.passwordHash))) return null;
  if (!credential.account.emailVerified) throw new EmailNotVerifiedError("Verify your email before signing in.", credential.account);
  return credential.account;
}

export async function updateAccountSettings(accountId: string, input: { displayName?: string; timezone?: string; currentPassword?: string; newPassword?: string }) {
  const displayName = input.displayName?.trim();
  const timezone = input.timezone?.trim();
  const passwordHash = input.newPassword ? await hashPassword(input.newPassword) : null;
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query("SELECT id, display_name, email, timezone, created_at, email_verified_at, password_hash FROM accounts WHERE id=$1 FOR UPDATE", [accountId]);
      const row = current.rows[0];
      if (!row) throw new Error("Account not found.");
      if (input.newPassword && (!row.password_hash || !input.currentPassword || !(await verifyPassword(input.currentPassword, row.password_hash)))) {
        throw new InvalidCurrentPasswordError("Current password is incorrect.");
      }
      const result = await client.query(`
        UPDATE accounts
        SET display_name=COALESCE($2, display_name), password_hash=COALESCE($3, password_hash), timezone=COALESCE($4, timezone),
            email_verified_at=CASE WHEN $3::text IS NOT NULL THEN NULL ELSE email_verified_at END
        WHERE id=$1
        RETURNING id, display_name, email, timezone, created_at, email_verified_at
      `, [accountId, displayName || null, passwordHash, timezone || null]);
      if (input.newPassword) await client.query("DELETE FROM auth_sessions WHERE account_id=$1", [accountId]);
      await client.query("COMMIT");
      return accountFromRow(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  const entry = Array.from(memory.credentials.entries()).find(([, credential]) => credential.account.id === accountId);
  if (!entry) throw new Error("Account not found.");
  const [email, credential] = entry;
  if (input.newPassword && (!input.currentPassword || !(await verifyPassword(input.currentPassword, credential.passwordHash)))) {
    throw new InvalidCurrentPasswordError("Current password is incorrect.");
  }
  const account = { ...credential.account, displayName: displayName || credential.account.displayName, timezone: timezone || credential.account.timezone, emailVerified: input.newPassword ? false : credential.account.emailVerified };
  memory.credentials.set(email, { account, passwordHash: passwordHash ?? credential.passwordHash });
  if (input.newPassword) {
    for (const [tokenHash, session] of Array.from(memory.sessions.entries())) if (session.accountId === accountId) memory.sessions.delete(tokenHash);
  }
  return account;
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

export async function createEmailVerification(accountId: string, purpose: VerificationPurpose) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const configuredTtl = purpose === "password-reset" ? process.env.PASSWORD_RESET_TTL_MS : process.env.EMAIL_VERIFICATION_TTL_MS;
  const defaultTtl = purpose === "password-reset" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const ttl = Math.max(60_000, Number(configuredTtl) || defaultTtl);
  const expiresAt = new Date(Date.now() + ttl);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const result = await pool.query("SELECT id, display_name, email, timezone, created_at, email_verified_at FROM accounts WHERE id=$1", [accountId]);
    if (!result.rows[0]) throw new Error("Account not found.");
    await pool.query("DELETE FROM email_verification_tokens WHERE account_id=$1 AND purpose=$2 AND consumed_at IS NULL", [accountId, purpose]);
    await pool.query("INSERT INTO email_verification_tokens (token_hash, account_id, purpose, expires_at) VALUES ($1,$2,$3,$4)", [tokenHash, accountId, purpose, expiresAt]);
    return { token, expiresAt, account: accountFromRow(result.rows[0]), purpose };
  }
  const credential = Array.from(memory.credentials.values()).find(({ account }) => account.id === accountId);
  if (!credential) throw new Error("Account not found.");
  for (const [key, item] of Array.from(memory.verifications.entries())) if (item.accountId === accountId && item.purpose === purpose) memory.verifications.delete(key);
  memory.verifications.set(tokenHash, { accountId, purpose, expiresAt: expiresAt.getTime() });
  return { token, expiresAt, account: credential.account, purpose };
}

export async function verifyEmailToken(token: string) {
  const tokenHash = hashToken(token);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query("SELECT account_id, purpose FROM email_verification_tokens WHERE token_hash=$1 AND purpose<>'password-reset' AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE", [tokenHash]);
      const row = result.rows[0];
      if (!row) throw new Error("This verification link is invalid or expired.");
      await client.query("UPDATE email_verification_tokens SET consumed_at=NOW() WHERE token_hash=$1", [tokenHash]);
      const accountResult = await client.query("UPDATE accounts SET email_verified_at=NOW() WHERE id=$1 RETURNING id, display_name, email, timezone, created_at, email_verified_at", [row.account_id]);
      await client.query("COMMIT");
      return { account: accountFromRow(accountResult.rows[0]), purpose: String(row.purpose) as VerificationPurpose };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  const verification = memory.verifications.get(tokenHash);
  if (!verification || verification.expiresAt <= Date.now()) {
    memory.verifications.delete(tokenHash);
    throw new Error("This verification link is invalid or expired.");
  }
  if (verification.purpose === "password-reset") throw new Error("This verification link is invalid or expired.");
  const entry = Array.from(memory.credentials.entries()).find(([, credential]) => credential.account.id === verification.accountId);
  if (!entry) throw new Error("Account not found.");
  const [email, credential] = entry;
  const account = { ...credential.account, emailVerified: true };
  memory.credentials.set(email, { ...credential, account });
  memory.verifications.delete(tokenHash);
  return { account, purpose: verification.purpose };
}

export async function resolveSession(token: string): Promise<Account | null> {
  const tokenHash = hashToken(token);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const result = await pool.query(`
      SELECT a.id, a.display_name, a.email, a.timezone, a.created_at, a.email_verified_at
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
    return result.rows.map((row) => String(row.id)).filter((accountId) => accountId !== demoAccountId);
  }
  return Array.from(memory.credentials.values()).map(({ account }) => account.id);
}

export async function createPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const result = await pool.query("SELECT id FROM accounts WHERE LOWER(email)=LOWER($1) AND password_hash IS NOT NULL AND id<>$2", [email, demoAccountId]);
    if (!result.rows[0]) return null;
    return createEmailVerification(String(result.rows[0].id), "password-reset");
  }
  const credential = memory.credentials.get(email);
  if (!credential) return null;
  return createEmailVerification(credential.account.id, "password-reset");
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(newPassword);
  const pool = getDbPool();
  if (pool) {
    await ensureAuthTables();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const verification = await client.query("SELECT account_id FROM email_verification_tokens WHERE token_hash=$1 AND purpose='password-reset' AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE", [tokenHash]);
      const row = verification.rows[0];
      if (!row) throw new Error("This password reset link is invalid or expired.");
      const accountResult = await client.query("UPDATE accounts SET password_hash=$2, email_verified_at=NOW() WHERE id=$1 RETURNING id, display_name, email, timezone, created_at, email_verified_at", [row.account_id, passwordHash]);
      if (!accountResult.rows[0]) throw new Error("Account not found.");
      await client.query("UPDATE email_verification_tokens SET consumed_at=NOW() WHERE account_id=$1 AND purpose='password-reset' AND consumed_at IS NULL", [row.account_id]);
      await client.query("DELETE FROM auth_sessions WHERE account_id=$1", [row.account_id]);
      await client.query("COMMIT");
      return accountFromRow(accountResult.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  const verification = memory.verifications.get(tokenHash);
  if (!verification || verification.purpose !== "password-reset" || verification.expiresAt <= Date.now()) {
    memory.verifications.delete(tokenHash);
    throw new Error("This password reset link is invalid or expired.");
  }
  const entry = Array.from(memory.credentials.entries()).find(([, credential]) => credential.account.id === verification.accountId);
  if (!entry) throw new Error("Account not found.");
  const [email, credential] = entry;
  const account = { ...credential.account, emailVerified: true };
  memory.credentials.set(email, { account, passwordHash });
  for (const [key, item] of Array.from(memory.verifications.entries())) {
    if (item.accountId === account.id && item.purpose === "password-reset") memory.verifications.delete(key);
  }
  for (const [key, session] of Array.from(memory.sessions.entries())) if (session.accountId === account.id) memory.sessions.delete(key);
  return account;
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
