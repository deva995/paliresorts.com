import type pg from 'pg';

/** Standalone schema compatibility only: Express sessions are authenticated separately.
 * Never derive identity from caller-set PostgreSQL settings or invent a shared user.
 * Preserve provider-managed functions and their existing privileges.
 */
export async function ensureAuthCompatibility(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT,
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
    DO $$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF;
    END $$;
  `);
  const existing = await client.query<{ body: string; language: string }>(`
    SELECT p.prosrc AS body, l.lanname AS language
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_language l ON l.oid = p.prolang
    WHERE n.nspname = 'auth' AND p.proname = 'uid' AND p.pronargs = 0;
  `);
  const fn = existing.rows[0];
  // Exact legacy runner body only. Do not replace arbitrary Supabase/custom providers.
  const legacy = fn?.language === 'sql' &&
    /^\s*SELECT\s+'771d3cd6-2cac-4c47-aa22-3be7c6de35fc'\s*::\s*uuid\s*;?\s*$/i.test(fn.body);
  if (!fn || legacy) {
    await client.query(`
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
      LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
      AS $$ SELECT NULL::uuid; $$;
      REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC;
      GRANT USAGE ON SCHEMA auth TO authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated, service_role;
    `);
  }
}

/** Each migration and its ledger record commit together; recorded files are skipped. */
export async function applyTrackedMigrations(
  client: pg.PoolClient,
  migrations: Array<{ name: string; sql: string }>
): Promise<{ applied: string[]; skipped: string[] }> {
  await client.query(`CREATE TABLE IF NOT EXISTS public._schema_migrations (
    id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`);
  const records = await client.query<{ name: string }>('SELECT name FROM public._schema_migrations');
  const recorded = new Set(records.rows.map(row => row.name));
  const result = { applied: [] as string[], skipped: [] as string[] };
  for (const migration of migrations) {
    if (recorded.has(migration.name)) { result.skipped.push(migration.name); continue; }
    await client.query('BEGIN');
    try {
      await client.query(migration.sql);
      await client.query('INSERT INTO public._schema_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [migration.name]);
      await client.query('COMMIT');
      recorded.add(migration.name);
      result.applied.push(migration.name);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  return result;
}
