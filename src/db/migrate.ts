import { migrate } from "drizzle-orm/neon-http/migrator";
import { database } from "./client";

async function run() {
  await migrate(database(), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
