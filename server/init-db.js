const { closeDatabase, initDatabase } = require("./db");

async function main() {
  await initDatabase();
  console.log("Database schema initialized.");
}

main()
  .catch((error) => {
    console.error("Failed to initialize database schema.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
