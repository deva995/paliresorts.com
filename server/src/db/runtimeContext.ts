import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, createHmac } from 'node:crypto';
import type { RequestHandler } from 'express';
import type pg from 'pg';

/** The signing key is independent of DATABASE_URL; never send it to PostgreSQL.
 * Context is bound to one backend PID and transaction, and is never accepted from HTTP.
 */
type Context = Record<string, unknown> & { mode: string };
const storage = new AsyncLocalStorage<Context>();

export function setDatabaseContext(context: Context): void {
  const current = storage.getStore();
  if (current) { for (const key of Object.keys(current)) delete current[key]; Object.assign(current, context); }
}

export function runWithDatabaseContext<T>(context: Context, fn: () => T): T {
  return storage.run({ ...context }, fn);
}

export const databaseRequestContext = (apiPrefix = '/api/v1'): RequestHandler => (req, _res, next) => {
  // Public capabilities only describe a route; operational identity is installed by auth middleware.
  const prefix = apiPrefix.replace(/\/+$/, '');
  const path = req.path.startsWith(prefix + '/') ? '/api/v1' + req.path.slice(prefix.length) : req.path;
  storage.run({ mode: 'public', path, qr: req.body?.qrPublicCode,
    challenge: req.body?.sessionTokenId, phone: req.body?.phone?.replace?.(/[\s-]/g, ''),
    tokenHash: typeof req.headers.authorization === 'string' && /^Bearer /i.test(req.headers.authorization)
      ? createHash('sha256').update(req.headers.authorization.replace(/^Bearer\s+/i, '').trim()).digest('hex') : null }, next);
};

export function runtimeContextEnabled(): boolean {
  return Boolean(process.env.DB_RUNTIME_CONTEXT_KEY);
}

export function databaseGuestSessionId(): string | null {
  const c = storage.getStore();
  return c?.mode === 'guest' && typeof c.sessionId === 'string' ? c.sessionId : null;
}

/** Wrap pg's promise API. Every statement receives transaction-local context, including
 * explicitly acquired clients. No SET SESSION state can leak to the next pool borrower.
 */
export function contextualPool(pool: pg.Pool): pg.Pool {
  if (!runtimeContextEnabled()) return pool;
  const key = process.env.DB_RUNTIME_CONTEXT_KEY!;
  if (!/^[0-9a-f]{64}$/i.test(key)) throw new Error('DB_RUNTIME_CONTEXT_KEY must be 32 random bytes encoded as hex');
  const verified = new WeakSet<pg.PoolClient>();
  async function connect(): Promise<pg.PoolClient> {
    const client = await pool.connect();
    const query = client.query.bind(client) as (...args: any[]) => Promise<any>;
    if (!verified.has(client)) {
      try {
        const identity = (await query(`SELECT r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication AS elevated,
          pg_has_role(current_user,'pali_runtime','USAGE') AS runtime,
          EXISTS (SELECT FROM pg_roles other WHERE other.rolname NOT IN (current_user,'pali_runtime') AND pg_has_role(current_user,other.oid,'USAGE')) AS extra,
          EXISTS (SELECT FROM pg_class c WHERE c.relnamespace IN ('public'::regnamespace,'pali_runtime'::regnamespace) AND pg_has_role(current_user,c.relowner,'USAGE'))
            OR EXISTS (SELECT FROM pg_database d WHERE d.datname=current_database() AND pg_has_role(current_user,d.datdba,'USAGE')) AS owner
          FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
        if (!identity || identity.elevated || !identity.runtime || identity.extra || identity.owner) throw new Error('Standalone application requires the restricted runtime login, never migration/owner credentials');
        verified.add(client);
      } catch (error) { client.release(true); throw error; }
    }
    let transaction = false;
    let broken = false;
    async function wrappedQuery(...args: any[]) {
      const text = typeof args[0] === 'string' ? args[0] : args[0]?.text;
      if (typeof text !== 'string' || args.some(arg => typeof arg === 'function')) throw new Error('Runtime pool requires promise queries');
      const command = text.trim().replace(/;$/, '').toUpperCase();
      if (command === 'BEGIN' || command === 'BEGIN TRANSACTION') {
        const result = await query(...args); transaction = true; return result;
      }
      if (command === 'COMMIT' || command === 'ROLLBACK') {
        try { return await query(...args); } finally { transaction = false; }
      }
      const ownTransaction = !transaction;
      try {
        if (ownTransaction) await query('BEGIN');
        const binding = (await query('SELECT pg_backend_pid() AS pid, txid_current()::text AS tx')).rows[0];
        const payload = JSON.stringify({ ...storage.getStore() || { mode: 'none' },
          pid: binding.pid, tx: binding.tx, expires: Math.floor(Date.now() / 1000) + 60 });
        const signature = createHmac('sha256', key).update(payload).digest('hex');
        await query("SELECT set_config('pali.context', $1, true), set_config('pali.signature', $2, true)", [payload, signature]);
        const result = await query(...args);
        if (ownTransaction) await query('COMMIT');
        return result;
      } catch (error) {
        if (ownTransaction) { try { await query('ROLLBACK'); } catch { broken = true; } }
        throw error;
      }
    }
    return new Proxy(client, { get(target, property) {
      if (property === 'query') return wrappedQuery;
      if (property === 'release') return (error?: Error | boolean) => {
        // Destroy an abandoned transaction rather than return its context to the pool.
        target.release(error || transaction || broken || undefined);
      };
      const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  return new Proxy(pool, { get(target, property) {
    if (property === 'connect') return connect;
    if (property === 'query') return async (...args: any[]) => {
      const client = await connect(); try { return await (client.query as any)(...args); } finally { client.release(); }
    };
    const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
  } });
}
