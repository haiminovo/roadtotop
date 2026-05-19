const dotenv = require("dotenv");
const { Pool, types } = require("pg");
const { runMigrations } = require("./migrations");

dotenv.config();

types.setTypeParser(20, (value) => Number.parseInt(value, 10));

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required before starting the websocket server.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});
let closePromise = null;

async function query(text, params) {
  return pool.query(text, params);
}

async function withTransaction(callback) {
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

async function initDatabase() {
  await runMigrations(pool);
}

async function closeDatabase() {
  if (!closePromise) {
    closePromise = pool.end();
  }

  await closePromise;
}

module.exports = {
  closeDatabase,
  initDatabase,
  query,
  withTransaction,
};
