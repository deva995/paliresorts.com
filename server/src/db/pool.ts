import pg from 'pg';
import { getEnv } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { DatabaseError } from '../utils/errors.js';
import { contextualPool } from './runtimeContext.js';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

export function setDbPool(pool: pg.Pool | null): void {
  poolInstance = pool ? contextualPool(pool) : null;
}

/**
 * Extracts the database hostname or socket path from a connection string.
 * Supports standard URLs, IPv6 brackets, query params (host=/path), and unix domain socket formats.
 */
export function extractDatabaseHost(databaseUrl?: string | null): string {
  if (!databaseUrl || typeof databaseUrl !== 'string') return '';

  // Check query parameter host first (e.g. ?host=/var/run/postgresql)
  const hostParamMatch = databaseUrl.match(/[?&]host=([^&#]+)/i);
  if (hostParamMatch) {
    try {
      return decodeURIComponent(hostParamMatch[1]);
    } catch {
      return hostParamMatch[1];
    }
  }

  try {
    const parsed = new URL(databaseUrl);
    let host = parsed.hostname || '';
    if (host.startsWith('[') && host.endsWith(']')) {
      host = host.slice(1, -1);
    }
    try {
      host = decodeURIComponent(host);
    } catch {
      // keep host as is
    }
    return host;
  } catch {
    // Fallback: extract host between @ and / or :
    const match = databaseUrl.match(/@([^/:?#]+)/);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    return '';
  }
}

/**
 * Checks whether the host represents localhost, 127.0.0.1, ::1 or a unix socket.
 */
export function isLocalDatabaseHost(host?: string | null): boolean {
  if (!host) return true; // Unix domain socket or omitted host defaults to local
  const trimmed = host.trim().toLowerCase();
  return (
    trimmed === '' ||
    trimmed === 'localhost' ||
    trimmed === '127.0.0.1' ||
    trimmed === '::1' ||
    trimmed.startsWith('/')
  );
}

/**
 * Resolves whether SSL should be enabled:
 * - If explicit DB_SSL is provided ("true" | "false" | boolean): explicit value always wins.
 * - If not set: false when host is localhost, 127.0.0.1, ::1 or a unix socket; true otherwise.
 */
export function shouldEnableSsl(
  databaseUrl?: string | null,
  explicitDbSsl?: boolean | string | null,
  ca?: string | null
): boolean {
  if (explicitDbSsl !== undefined && explicitDbSsl !== null && explicitDbSsl !== '') {
    if (typeof explicitDbSsl === 'boolean') {
      return explicitDbSsl;
    }
    const lower = String(explicitDbSsl).trim().toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
  }

  // If a custom CA certificate is explicitly configured, enable SSL
  if (ca && typeof ca === 'string' && ca.trim()) {
    return true;
  }

  const host = extractDatabaseHost(databaseUrl);
  return !isLocalDatabaseHost(host);
}

export interface ResolveDbSslOptions {
  databaseUrl?: string | null;
  dbSsl?: boolean | string | null;
  rejectUnauthorized?: boolean | string | null;
  nodeEnv?: string | null;
  ca?: string | null;
}

/**
 * Resolves pg.ConnectionConfig['ssl'] (false or object).
 * When SSL is enabled, honors DB_SSL_REJECT_UNAUTHORIZED and DB_SSL_CA.
 */
export function resolveDbSsl(
  options?: ResolveDbSslOptions
): false | { rejectUnauthorized: boolean; ca?: string } {
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL;
  const dbSsl = options?.dbSsl ?? process.env.DB_SSL;
  const nodeEnv = options?.nodeEnv ?? process.env.NODE_ENV;
  const rejectUnauthorizedRaw = options?.rejectUnauthorized ?? process.env.DB_SSL_REJECT_UNAUTHORIZED;
  const caRaw = options?.ca ?? process.env.DB_SSL_CA;

  const isSsl = shouldEnableSsl(databaseUrl, dbSsl, caRaw);
  if (!isSsl) {
    return false;
  }

  const rejectUnauthorized = nodeEnv === 'production'
    ? true
    : (rejectUnauthorizedRaw !== false && String(rejectUnauthorizedRaw).toLowerCase() !== 'false');

  let ca: string | undefined;
  if (caRaw && typeof caRaw === 'string' && caRaw.trim()) {
    const trimmed = caRaw.trim();
    if (trimmed.includes('-----BEGIN')) {
      ca = trimmed;
    } else {
      try {
        const decoded = Buffer.from(trimmed.replace(/\s+/g, ''), 'base64').toString('utf8');
        ca = decoded.includes('-----BEGIN') ? decoded : trimmed;
      } catch {
        ca = trimmed;
      }
    }
  }

  return {
    rejectUnauthorized,
    ...(ca ? { ca } : {})
  };
}

export function getDbPool(): pg.Pool {
  if (poolInstance) {
    return poolInstance;
  }

  const env = getEnv();

  const sslConfig = resolveDbSsl({
    databaseUrl: env.DATABASE_URL,
    dbSsl: env.DB_SSL,
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
    nodeEnv: env.NODE_ENV,
    ca: env.DB_SSL_CA
  });

  poolInstance = contextualPool(new Pool({
    connectionString: env.DATABASE_URL,
    ssl: sslConfig,
    max: env.DB_POOL_MAX,
    min: env.DB_POOL_MIN,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: env.DB_STATEMENT_TIMEOUT_MS,
    keepAlive: true
  }));

  poolInstance.on('error', (err) => {
    logger.error('Unexpected error on idle PostgreSQL client in pool', {
      error: err.message,
      name: err.name
    });
  });

  return poolInstance;
}

/**
 * Executes a callback within a managed database transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error('Failed to rollback transaction', {
        error: (rollbackErr as Error).message
      });
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Executes a callback inside a transaction with the outlet context set locally.
 *
 * CRITICAL FOR POOLED CONNECTIONS:
 * Uses `SELECT set_config('app.current_outlet_id', $1, true)`.
 * The 3rd parameter `is_local = true` ensures the setting applies ONLY to the
 * current transaction and is automatically cleared upon COMMIT or ROLLBACK.
 * This guarantees no state leaks across pooled connections in Neon/PgBouncer.
 */
export async function withOutletTransaction<T>(
  outletId: string,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  if (!outletId || typeof outletId !== 'string' || !outletId.trim()) {
    throw new DatabaseError('Cannot execute outlet transaction without a valid outletId');
  }

  return withTransaction(async (client) => {
    // Set parameter transaction-locally for PostgreSQL Row-Level Security
    await client.query("SELECT set_config('app.current_outlet_id', $1, true)", [outletId.trim()]);
    return await fn(client);
  });
}

/**
 * Checks database connection health by executing a simple SELECT 1 probe.
 * Does not expose internal schema details.
 */
export async function checkDatabaseHealth(): Promise<{
  isHealthy: boolean;
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const pool = getDbPool();
    await pool.query('SELECT 1');
    return {
      isHealthy: true,
      latencyMs: Date.now() - start
    };
  } catch (err) {
    const message = (err as Error).message || 'Database connection probe failed';
    return {
      isHealthy: false,
      latencyMs: Date.now() - start,
      error: message
    };
  }
}

/**
 * Gracefully drains and closes the PostgreSQL pool.
 */
export async function closeDbPool(): Promise<void> {
  if (poolInstance) {
    try {
      await poolInstance.end();
      logger.info('PostgreSQL connection pool drained and closed successfully');
    } catch (err) {
      logger.error('Error closing PostgreSQL connection pool', {
        error: (err as Error).message
      });
    } finally {
      poolInstance = null;
    }
  }
}
