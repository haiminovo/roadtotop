// ============================================================
// 服务端数据库连接池（独立 WS 服务器使用）
// ============================================================

import { Pool, QueryResult } from 'pg';
import { readFileSync, readdirSync } from 'fs';
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

/**
 * 智能分割 SQL 语句：
 * - 支持 $$ ... $$ 块（如 DO $$ ... $$），不会错误切割块内的分号
 * - 支持单引号字符串，不会错误切割字符串内的分号
 */
function splitSqlStatements(sql: string): string[] {
  const stmts: string[] = [];
  let buf = '';
  let i = 0;
  const len = sql.length;

  while (i < len) {
    const ch = sql[i];
    const rest = sql.slice(i);

    // 跳过单行注释
    if (rest.startsWith('--')) {
      const eol = sql.indexOf('\n', i);
      if (eol === -1) break;
      i = eol + 1;
      continue;
    }

    // $$ 块
    if (rest.startsWith('$$')) {
      const end = sql.indexOf('$$', i + 2);
      if (end === -1) { buf += rest; break; }
      buf += sql.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    // 单引号字符串
    if (ch === "'") {
      let j = i + 1;
      while (j < len) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j++; break; }
        j++;
      }
      buf += sql.slice(i, j);
      i = j;
      continue;
    }

    // 语句分隔符
    if (ch === ';') {
      const trimmed = buf.trim();
      if (trimmed && !trimmed.startsWith('--')) stmts.push(trimmed);
      buf = '';
      i++;
      continue;
    }

    buf += ch;
    i++;
  }

  const trimmed = buf.trim();
  if (trimmed && !trimmed.startsWith('--')) stmts.push(trimmed);
  return stmts;
}

export async function ensureDatabaseInitialized(): Promise<void> {
  if (initialized) return;
  const migrationsDir = join(process.cwd(), 'migrations');
  try {
    const migrationFiles = readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    for (const file of migrationFiles) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');
      const statements = splitSqlStatements(sql);
      for (const stmt of statements) {
        try {
          await query(stmt);
        } catch (err: unknown) {
          // 忽略幂等迁移中的已存在错误
          const message = err instanceof Error ? err.message : '';
          if (!message.includes('already exists')) {
            throw err;
          }
        }
      }
    }
    initialized = true;
    console.log('[DB] Database initialized');
  } catch (err) {
    console.error('[DB] Migration failed:', err);
    throw err;
  }
}
