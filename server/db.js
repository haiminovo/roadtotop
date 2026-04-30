const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required before starting the websocket server.");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

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
  const sqlPath = path.join(__dirname, "sql", "init.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");
  await query(sql);
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  closeDatabase,
  initDatabase,
  query,
  withTransaction,
};
