import { closeDb, getDb } from "./client";
import { seedDatabase } from "./seed";

async function run() {
  const seeded = await seedDatabase(await getDb());
  console.log(
    seeded
      ? "Sample data loaded."
      : "Database already has data; nothing seeded. Run npm run db:reset first for a clean start.",
  );
  await closeDb();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
