import { randomBytes, createHash } from 'node:crypto';
import type pg from 'pg';

// Privileged fixture setup only; application middleware validates normal sessions.
export async function fixtureSession(pool: pg.Pool, staffId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await pool.query("INSERT INTO staff_sessions(staff_id,token_hash,expires_at) VALUES($1,$2,CURRENT_TIMESTAMP+interval '1 hour')",
    [staffId, createHash('sha256').update(token).digest('hex')]);
  return token;
}
