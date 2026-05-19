const fs = require("fs/promises");
const path = require("path");

const MIGRATIONS_DIR = path.join(process.cwd(), "migrations");

async function listMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getAppliedVersions(client) {
  const result = await client.query(`SELECT version FROM schema_migrations`);
  return new Set(result.rows.map((row) => row.version));
}

async function runMigrations(pool, options = {}) {
  const logger = options.logger ?? console;
  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);
    const appliedVersions = await getAppliedVersions(client);
    const files = await listMigrationFiles();
    const applied = [];

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");

      if (appliedVersions.has(version)) {
        continue;
      }

      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO schema_migrations (version) VALUES ($1)`,
          [version],
        );
        await client.query("COMMIT");
        appliedVersions.add(version);
        applied.push(version);
        logger.info?.(`Applied database migration ${version}.`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    return applied;
  } finally {
    client.release();
  }
}

module.exports = {
  runMigrations,
};
