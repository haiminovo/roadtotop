// ============================================================
// 服务端数据库连接池（独立 WS 服务器使用）
// ============================================================

import { Pool, QueryResult } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: join(process.cwd(), '.env.local') });
dotenv.config({ path: join(process.cwd(), '.env') });

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
  const result = await getPool().query(text, params);
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
    await query(sql);
    initialized = true;
    console.log('[DB] Database initialized');
  } catch (err) {
    console.error('[DB] Migration failed:', err);
    throw err;
  }
}
