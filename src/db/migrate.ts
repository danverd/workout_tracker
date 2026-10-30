import path from "node:path";
import { closeDb, configureNeon, getDb } from "./client";

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // PGlite applies pending migrations when the first connection opens.
    await getDb();
    await closeDb();
    console.log("Migrations applied to .data/pglite.");
    return;
  }
  const [{ Pool }, { drizzle }, { migrate }] = await Promise.all([
    import("@neondatabase/serverless"),
    import("drizzle-orm/neon-serverless"),
    import("drizzle-orm/neon-serverless/migrator"),
  ]);
  await configureNeon();
  const pool = new Pool({ connectionString: url });
  try {
    await migrate(drizzle({ client: pool }), {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
  } finally {
    await pool.end();
  }
  console.log("Migrations applied to DATABASE_URL.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
