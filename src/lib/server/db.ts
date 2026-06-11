import { Pool, QueryResult } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

let pool: Pool | null = null;
let initialized = false;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/roadtotop',
    });
  }
  return pool;
}

export async function query(text: string, params?: unknown[]): Promise<QueryResult> {
  const client = getPool();
  const result = await client.query(text, params);
  // 将 bigint 转为 number
  for (const row of result.rows) {
    for (const key of Object.keys(row)) {
      if (typeof row[key] === 'bigint') {
        row[key] = Number(row[key]);
      }
    }
  }
  return result;
}

export async function withTransaction<T>(fn: (query: typeof import('./db').query) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const txQuery = async (text: string, params?: unknown[]) => {
      const result = await client.query(text, params);
      for (const row of result.rows) {
        for (const key of Object.keys(row)) {
          if (typeof row[key] === 'bigint') {
            row[key] = Number(row[key]);
          }
        }
      }
      return result;
    };
    const result = await fn(txQuery as typeof query);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function ensureDatabaseInitialized(): Promise<void> {
  if (initialized) return;
  const migrationPath = join(process.cwd(), 'migrations', '001_initial_schema.sql');
  try {
    const sql = readFileSync(migrationPath, 'utf-8');
    const statements = sql.split(';').filter(s => s.trim());
    for (const stmt of statements) {
      try {
        await query(stmt);
      } catch (err: any) {
        if (!err.message?.includes('already exists')) {
          throw err;
        }
      }
    }
    initialized = true;
  } catch (err) {
    console.error('[DB] Migration failed:', err);
    throw err;
  }
}
