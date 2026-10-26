
import crypto from 'node:crypto';
import pg from 'pg';
import { encryptQrSecret } from '../server/src/utils/qrEncryption.ts';

const connectionString = process.env.MIGRATION_DATABASE_URL;

if (!connectionString) {
  throw new Error('MIGRATION_DATABASE_URL is required');
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query('BEGIN');

  const result = await client.query(`
    SELECT t.id, t.outlet_id, t.table_number, t.qr_public_code
    FROM public.restaurant_tables t
    LEFT JOIN public.table_qr_credentials c ON c.table_id = t.id
    WHERE t.outlet_id = 'rest-1'
      AND t.is_active = true
      AND t.table_number IN (
        'T-06','T-07','T-08','T-09','T-10',
        'T-11','T-12','T-13','T-14','T-15',
        'T-16','T-17','T-18','T-19','T-20'
      )
      AND c.table_id IS NULL
    FOR UPDATE OF t
  `);

  for (const table of result.rows) {
    const secret = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(secret).digest('hex');

    await client.query(
      `UPDATE public.restaurant_tables
       SET qr_secret_token_hash = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [table.id, hash]
    );

    await client.query(
      `INSERT INTO public.table_qr_credentials
       (table_id, outlet_id, encrypted_secret)
       VALUES ($1, $2, $3)`,
      [table.id, table.outlet_id, encryptQrSecret(secret)]
    );

    console.log('Generated:', table.table_number);
  }

  await client.query('COMMIT');
  console.log('SUCCESS:', result.rowCount, 'new QR credentials created.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
