import fs from "node:fs";
import path from "node:path";
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { logger } from "@/lib/server/logger";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required before using the Day0 API.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

declare global {
  var __roadToTopDbInitPromise: Promise<void> | undefined;
}

function loadInitSql() {
  const sqlPath = path.join(process.cwd(), "server", "sql", "init.sql");
  return fs.readFileSync(sqlPath, "utf8");
}

export async function ensureDatabaseInitialized() {
  if (!global.__roadToTopDbInitPromise) {
    global.__roadToTopDbInitPromise = (async () => {
      logger.info("Initializing Day0 database schema.");
      await pool.query(loadInitSql());
    })().catch((error) => {
      global.__roadToTopDbInitPromise = undefined;
      logger.error("Failed to initialize Day0 database schema.", error);
      throw error;
    });
  }

  return global.__roadToTopDbInitPromise;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
) {
  await ensureDatabaseInitialized();
  return pool.query<T>(text, params);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  await ensureDatabaseInitialized();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type DatabaseResult<T extends QueryResultRow = QueryResultRow> = QueryResult<T>;
